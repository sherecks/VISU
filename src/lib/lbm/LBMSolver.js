import { QUAD_VS, INIT_FS, STEP_FS, RENDER_FS } from './shaders'

function compileShader(gl, type, src) {
  const sh = gl.createShader(type)
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(sh)
    gl.deleteShader(sh)
    throw new Error(`Erro ao compilar shader: ${info}`)
  }
  return sh
}

function createProgram(gl, vsSrc, fsSrc) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc)
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc)
  const prog = gl.createProgram()
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(prog)
    throw new Error(`Erro ao linkar programa: ${info}`)
  }
  return prog
}

function createDataTexture(gl, width, height) {
  const tex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, null)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  return tex
}

function createFBO(gl, textures) {
  const fbo = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  textures.forEach((tex, i) => {
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, tex, 0)
  })
  gl.drawBuffers(textures.map((_, i) => gl.COLOR_ATTACHMENT0 + i))
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error(`Framebuffer incompleto (status ${status})`)
  }
  return fbo
}

export class LBMSolver {
  constructor(canvas, { width, height, mask, tau = 0.6, inflowVel = 0.06 }) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: false })
    if (!gl) throw new Error('WebGL2 não suportado neste navegador.')
    if (!gl.getExtension('EXT_color_buffer_float')) {
      throw new Error('Este dispositivo não suporta render para textura em ponto flutuante (EXT_color_buffer_float).')
    }

    this.gl = gl
    this.width = width
    this.height = height
    this.tau = tau
    this.inflowVel = inflowVel
    this.current = 0

    this._setupQuad()

    this.initProgram = createProgram(gl, QUAD_VS, INIT_FS)
    this.stepProgram = createProgram(gl, QUAD_VS, STEP_FS)
    this.renderProgram = createProgram(gl, QUAD_VS, RENDER_FS)

    this.sets = [0, 1].map(() => {
      const a = createDataTexture(gl, width, height)
      const b = createDataTexture(gl, width, height)
      const c = createDataTexture(gl, width, height)
      const fbo = createFBO(gl, [a, b, c])
      return { a, b, c, fbo }
    })

    this.obstacleTex = this._createObstacleTexture(mask)
    this._initState()
  }

  _setupQuad() {
    const gl = this.gl
    const verts = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1])
    this.quadVAO = gl.createVertexArray()
    gl.bindVertexArray(this.quadVAO)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    gl.bindVertexArray(null)
  }

  _createObstacleTexture(mask) {
    const gl = this.gl
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    const data = new Float32Array(this.width * this.height)
    for (let i = 0; i < mask.length; i++) data[i] = mask[i]
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, this.width, this.height, 0, gl.RED, gl.FLOAT, data)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return tex
  }

  _drawQuad() {
    const gl = this.gl
    gl.bindVertexArray(this.quadVAO)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    gl.bindVertexArray(null)
  }

  _initState() {
    const gl = this.gl
    const target = this.sets[this.current]
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo)
    gl.viewport(0, 0, this.width, this.height)
    gl.useProgram(this.initProgram)
    this._drawQuad()
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  setParams({ tau, inflowVel }) {
    if (tau !== undefined) this.tau = tau
    if (inflowVel !== undefined) this.inflowVel = inflowVel
  }

  step(n = 1) {
    const gl = this.gl
    gl.useProgram(this.stepProgram)
    const loc = {
      uF_A: gl.getUniformLocation(this.stepProgram, 'uF_A'),
      uF_B: gl.getUniformLocation(this.stepProgram, 'uF_B'),
      uF_C: gl.getUniformLocation(this.stepProgram, 'uF_C'),
      uObstacle: gl.getUniformLocation(this.stepProgram, 'uObstacle'),
      uTexel: gl.getUniformLocation(this.stepProgram, 'uTexel'),
      uResolution: gl.getUniformLocation(this.stepProgram, 'uResolution'),
      uTau: gl.getUniformLocation(this.stepProgram, 'uTau'),
      uInflowVel: gl.getUniformLocation(this.stepProgram, 'uInflowVel'),
    }

    gl.viewport(0, 0, this.width, this.height)
    gl.uniform2f(loc.uTexel, 1 / this.width, 1 / this.height)
    gl.uniform2f(loc.uResolution, this.width, this.height)
    gl.uniform1f(loc.uTau, this.tau)
    gl.uniform1f(loc.uInflowVel, this.inflowVel)

    for (let s = 0; s < n; s++) {
      const src = this.sets[this.current]
      const dst = this.sets[1 - this.current]
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo)
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.a); gl.uniform1i(loc.uF_A, 0)
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, src.b); gl.uniform1i(loc.uF_B, 1)
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, src.c); gl.uniform1i(loc.uF_C, 2)
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.obstacleTex); gl.uniform1i(loc.uObstacle, 3)
      this._drawQuad()
      this.current = 1 - this.current
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  render(velScale = 0.16) {
    const gl = this.gl
    const canvas = gl.canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.useProgram(this.renderProgram)
    const src = this.sets[this.current]
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.c)
    gl.uniform1i(gl.getUniformLocation(this.renderProgram, 'uF_C'), 0)
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.obstacleTex)
    gl.uniform1i(gl.getUniformLocation(this.renderProgram, 'uObstacle'), 1)
    gl.uniform1f(gl.getUniformLocation(this.renderProgram, 'uVelScale'), velScale)
    this._drawQuad()
  }

  dispose() {
    const gl = this.gl
    this.sets.forEach(({ a, b, c, fbo }) => {
      gl.deleteTexture(a); gl.deleteTexture(b); gl.deleteTexture(c)
      gl.deleteFramebuffer(fbo)
    })
    gl.deleteTexture(this.obstacleTex)
    gl.deleteProgram(this.initProgram)
    gl.deleteProgram(this.stepProgram)
    gl.deleteProgram(this.renderProgram)
    gl.deleteVertexArray(this.quadVAO)
  }
}
