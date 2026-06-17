import { useState, useCallback } from 'react'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import DropZone from './components/DropZone'
import STLViewer from './components/STLViewer'
import ModelBrowser from './components/ModelBrowser'

const SUPPORTED_EXTENSIONS = ['.stl', '.3mf']

const stlLoader = new STLLoader()
const threeMFLoader = new ThreeMFLoader()

function getExtension(fileName) {
  const match = fileName.toLowerCase().match(/\.[^.]+$/)
  return match ? match[0] : ''
}

function parseGeometry(buffer, extension) {
  if (extension === '.3mf') {
    const group = threeMFLoader.parse(buffer)
    group.updateMatrixWorld(true)
    const geometries = []
    group.traverse((child) => {
      if (child.isMesh && child.geometry) {
        const geo = child.geometry.clone()
        geo.applyMatrix4(child.matrixWorld)
        geometries.push(geo)
      }
    })
    const geometry = geometries.length > 1 ? mergeGeometries(geometries) : geometries[0]
    const vertices = geometry.attributes.position.count
    return { geometry, vertices }
  }
  const geometry = stlLoader.parse(buffer)
  const vertices = geometry.attributes.position.count
  return { geometry, vertices }
}

export default function App() {
  const [model, setModel] = useState(null)
  const [loading, setLoading] = useState(false)
  const [browserOpen, setBrowserOpen] = useState(false)

  const handleFile = useCallback((file) => {
    const extension = file ? getExtension(file.name) : ''
    if (!file || !SUPPORTED_EXTENSIONS.includes(extension)) return
    setLoading(true)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const { geometry, vertices } = parseGeometry(e.target.result, extension)
        setModel({ geometry, name: file.name, vertices })
      } catch {
        setModel(null)
      } finally {
        setLoading(false)
      }
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const handleCatalogItem = useCallback(async (item) => {
    setBrowserOpen(false)
    setLoading(true)
    try {
      const res = await fetch(item.url)
      if (!res.ok) throw new Error('fetch failed')
      const buffer = await res.arrayBuffer()
      const { geometry, vertices } = parseGeometry(buffer, getExtension(item.url))
      setModel({ geometry, name: item.name, vertices })
    } catch {
      setModel(null)
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <>
      {loading && (
        <div className="loading-overlay">
          <div className="loading-box">
            <div className="loading-titlebar">Aguarde</div>
            <div className="loading-body">
              <div className="spinner" />
              <span>Carregando modelo...</span>
            </div>
          </div>
        </div>
      )}

      {browserOpen && (
        <ModelBrowser
          onSelect={handleCatalogItem}
          onClose={() => setBrowserOpen(false)}
        />
      )}

      {!loading && !model && (
        <DropZone
          onFile={handleFile}
          onOpenBrowser={() => setBrowserOpen(true)}
        />
      )}

      {!loading && model && (
        <STLViewer
          geometry={model.geometry}
          fileName={model.name}
          vertexCount={model.vertices}
          onLoadNew={handleFile}
          onBack={() => setModel(null)}
          onOpenBrowser={() => setBrowserOpen(true)}
        />
      )}
    </>
  )
}
