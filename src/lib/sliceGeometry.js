// Slices a 3D mesh at the Z=0 plane (side profile, XY) and rasterizes the
// resulting silhouette into a binary obstacle grid for the LBM solver.
//
// Approach: walk every triangle once, find the 2D segment where it crosses
// Z=0 (a watertight mesh crossing a plane always yields closed polygon
// loops), then rasterize via even-odd scanline fill — no need to actually
// reconstruct polygon connectivity.

function extractZeroCrossingSegments(geometry) {
  const pos = geometry.attributes.position
  const index = geometry.index
  const triCount = index ? index.count / 3 : pos.count / 3
  const segments = []

  const ax = new Float32Array(3)
  const ay = new Float32Array(3)
  const az = new Float32Array(3)

  const pts = []

  for (let t = 0; t < triCount; t++) {
    let i0, i1, i2
    if (index) {
      const base = t * 3
      i0 = index.getX(base)
      i1 = index.getX(base + 1)
      i2 = index.getX(base + 2)
    } else {
      i0 = t * 3
      i1 = t * 3 + 1
      i2 = t * 3 + 2
    }

    ax[0] = pos.getX(i0); ay[0] = pos.getY(i0); az[0] = pos.getZ(i0)
    ax[1] = pos.getX(i1); ay[1] = pos.getY(i1); az[1] = pos.getZ(i1)
    ax[2] = pos.getX(i2); ay[2] = pos.getY(i2); az[2] = pos.getZ(i2)

    pts.length = 0
    for (let e = 0; e < 3; e++) {
      const n = (e + 1) % 3
      const za = az[e], zb = az[n]
      if ((za >= 0 && zb < 0) || (za < 0 && zb >= 0)) {
        const t2 = za / (za - zb)
        pts.push(ax[e] + (ax[n] - ax[e]) * t2, ay[e] + (ay[n] - ay[e]) * t2)
      }
    }

    if (pts.length === 4) {
      segments.push(pts[0], pts[1], pts[2], pts[3])
    }
  }

  return segments
}

function segmentsBounds(segments) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (let i = 0; i < segments.length; i += 4) {
    const x0 = segments[i], y0 = segments[i + 1]
    const x1 = segments[i + 2], y1 = segments[i + 3]
    if (x0 < minX) minX = x0
    if (x1 < minX) minX = x1
    if (x0 > maxX) maxX = x0
    if (x1 > maxX) maxX = x1
    if (y0 < minY) minY = y0
    if (y1 < minY) minY = y1
    if (y0 > maxY) maxY = y0
    if (y1 > maxY) maxY = y1
  }
  return { minX, maxX, minY, maxY }
}

function rasterize(segments, domain, width, height) {
  const { x0, x1, y0, y1 } = domain
  const mask = new Uint8Array(width * height)
  const dx = (x1 - x0) / width
  const dy = (y1 - y0) / height
  const xs = []

  for (let j = 0; j < height; j++) {
    const y = y0 + (j + 0.5) * dy
    xs.length = 0
    for (let i = 0; i < segments.length; i += 4) {
      const ay = segments[i + 1], by = segments[i + 3]
      if ((ay >= y && by < y) || (ay < y && by >= y)) {
        const t = (y - ay) / (by - ay)
        const sx = segments[i] + (segments[i + 2] - segments[i]) * t
        xs.push(sx)
      }
    }
    xs.sort((a, b) => a - b)

    const rowOffset = j * width
    for (let k = 0; k + 1 < xs.length; k += 2) {
      let iStart = Math.max(0, Math.ceil((xs[k] - x0) / dx - 0.5))
      let iEnd = Math.min(width - 1, Math.floor((xs[k + 1] - x0) / dx - 0.5))
      for (let i = iStart; i <= iEnd; i++) mask[rowOffset + i] = 1
    }
  }

  return mask
}

// `geometry` must already be normalized (centered, consistent scale — see
// normalizeGeometry.js) so the slice lines up with what's rendered in 3D.
export function sliceMaskFromGeometry(geometry, {
  width = 256,
  height = 128,
  inflowPad = 1.4,
  outflowPad = 2.2,
  sidePad = 0.5,
} = {}) {
  const segments = extractZeroCrossingSegments(geometry)
  if (segments.length === 0) {
    throw new Error('O modelo não cruza o plano Z=0 — não há perfil lateral para fatiar.')
  }

  const bounds = segmentsBounds(segments)
  const domain = {
    x0: bounds.minX - inflowPad,
    x1: bounds.maxX + outflowPad,
    y0: bounds.minY - sidePad,
    y1: bounds.maxY + sidePad,
  }

  const mask = rasterize(segments, domain, width, height)

  // Tunnel walls: top and bottom rows act as solid bounce-back boundaries,
  // matching a real test-section channel.
  for (let i = 0; i < width; i++) {
    mask[i] = 1
    mask[(height - 1) * width + i] = 1
  }

  return {
    mask,
    width,
    height,
    domain,
    modelBounds: bounds,
  }
}
