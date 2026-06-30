import * as THREE from 'three'

// Centers geometry and scales it so its largest dimension is 3 units.
// Shared by STLViewer (3D render) and the water tunnel (cross-section slice)
// so both operate on the exact same spatial frame.
export function normalizeGeometry(geometry) {
  const geo = geometry.clone()
  geo.center()
  geo.computeBoundingBox()
  const size = new THREE.Vector3()
  geo.boundingBox.getSize(size)
  const maxDim = Math.max(size.x, size.y, size.z)
  const scale = 3 / maxDim
  geo.scale(scale, scale, scale)
  const normals = geo.getAttribute('normal')
  const hasValidNormals = normals && normals.array.some(n => n !== 0)
  if (!hasValidNormals) geo.computeVertexNormals()
  return geo
}
