// D2Q9 Lattice-Boltzmann shaders (WebGL2 / GLSL ES 3.00).
//
// State is packed into 3 RGBA32F textures per ping-pong set:
//   texA = (f0, f1, f2, f3)
//   texB = (f4, f5, f6, f7)
//   texC = (f8, rho, ux, uy)   — rho/ux/uy recomputed each step for the
//                                 render pass, so it never needs all 9 f_i.
//
// Directions: 0=rest, 1=E, 2=N, 3=W, 4=S, 5=NE, 6=NW, 7=SW, 8=SE.
// Boundary handling: full bounce-back at obstacle/tunnel-wall cells
// (wet-node scheme), fixed-equilibrium inflow at x=0, zero-gradient
// outflow at x=width-1.

export const QUAD_VS = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`

const LATTICE_CONSTANTS = `
const float w[9] = float[9](
  4.0/9.0, 1.0/9.0, 1.0/9.0, 1.0/9.0, 1.0/9.0,
  1.0/36.0, 1.0/36.0, 1.0/36.0, 1.0/36.0
);
const vec2 e[9] = vec2[9](
  vec2(0.0,0.0), vec2(1.0,0.0), vec2(0.0,1.0), vec2(-1.0,0.0), vec2(0.0,-1.0),
  vec2(1.0,1.0), vec2(-1.0,1.0), vec2(-1.0,-1.0), vec2(1.0,-1.0)
);
const int opp[9] = int[9](0,3,4,1,2,7,8,5,6);

float feq(int i, float rho, vec2 u) {
  float eu = dot(e[i], u);
  float uu = dot(u, u);
  return w[i] * rho * (1.0 + 3.0*eu + 4.5*eu*eu - 1.5*uu);
}
`

export const INIT_FS = `#version 300 es
precision highp float;
layout(location=0) out vec4 outA;
layout(location=1) out vec4 outB;
layout(location=2) out vec4 outC;
${LATTICE_CONSTANTS}
void main() {
  outA = vec4(w[0], w[1], w[2], w[3]);
  outB = vec4(w[4], w[5], w[6], w[7]);
  outC = vec4(w[8], 1.0, 0.0, 0.0);
}
`

export const STEP_FS = `#version 300 es
precision highp float;

uniform sampler2D uF_A;
uniform sampler2D uF_B;
uniform sampler2D uF_C;
uniform sampler2D uObstacle;
uniform vec2 uTexel;
uniform vec2 uResolution;
uniform float uTau;
uniform float uInflowVel;

layout(location=0) out vec4 outA;
layout(location=1) out vec4 outB;
layout(location=2) out vec4 outC;

${LATTICE_CONSTANTS}

float getF(int i, vec2 uv) {
  if (i < 4) {
    vec4 v = texture(uF_A, uv);
    if (i == 0) return v.r;
    if (i == 1) return v.g;
    if (i == 2) return v.b;
    return v.a;
  } else if (i < 8) {
    vec4 v = texture(uF_B, uv);
    int j = i - 4;
    if (j == 0) return v.r;
    if (j == 1) return v.g;
    if (j == 2) return v.b;
    return v.a;
  }
  return texture(uF_C, uv).r;
}

void main() {
  vec2 uv = gl_FragCoord.xy * uTexel;
  ivec2 px = ivec2(gl_FragCoord.xy);

  float pulled[9];
  for (int i = 0; i < 9; i++) {
    vec2 srcUv = uv - e[i] * uTexel;
    pulled[i] = getF(i, srcUv);
  }

  bool solid = texture(uObstacle, uv).r > 0.5;
  float outF[9];

  if (solid) {
    for (int i = 0; i < 9; i++) outF[i] = pulled[opp[i]];
  } else if (px.x == 0) {
    vec2 uin = vec2(uInflowVel, 0.0);
    for (int i = 0; i < 9; i++) outF[i] = feq(i, 1.0, uin);
  } else if (px.x == int(uResolution.x) - 1) {
    vec2 srcUv = uv - vec2(uTexel.x, 0.0);
    for (int i = 0; i < 9; i++) outF[i] = getF(i, srcUv);
  } else {
    float rho = 0.0;
    vec2 mom = vec2(0.0);
    for (int i = 0; i < 9; i++) {
      rho += pulled[i];
      mom += pulled[i] * e[i];
    }
    vec2 u = mom / max(rho, 1e-6);
    for (int i = 0; i < 9; i++) {
      float eqv = feq(i, rho, u);
      outF[i] = pulled[i] - (pulled[i] - eqv) / uTau;
    }
  }

  outA = vec4(outF[0], outF[1], outF[2], outF[3]);
  outB = vec4(outF[4], outF[5], outF[6], outF[7]);

  float rho2 = 0.0;
  vec2 mom2 = vec2(0.0);
  for (int i = 0; i < 9; i++) {
    rho2 += outF[i];
    mom2 += outF[i] * e[i];
  }
  vec2 u2 = mom2 / max(rho2, 1e-6);
  outC = vec4(outF[8], rho2, u2.x, u2.y);
}
`

export const RENDER_FS = `#version 300 es
precision highp float;

uniform sampler2D uF_C;
uniform sampler2D uObstacle;
uniform float uVelScale;

in vec2 vUv;
out vec4 fragColor;

vec3 colormap(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 c0 = vec3(0.04, 0.05, 0.16);
  vec3 c1 = vec3(0.09, 0.45, 0.85);
  vec3 c2 = vec3(1.0, 0.92, 0.25);
  if (t < 0.5) return mix(c0, c1, t / 0.5);
  return mix(c1, c2, (t - 0.5) / 0.5);
}

void main() {
  bool solid = texture(uObstacle, vUv).r > 0.5;
  if (solid) {
    fragColor = vec4(0.04, 0.04, 0.04, 1.0);
    return;
  }
  vec4 c = texture(uF_C, vUv);
  float speed = length(vec2(c.b, c.a));
  fragColor = vec4(colormap(speed / uVelScale), 1.0);
}
`
