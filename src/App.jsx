import { useState, useCallback } from 'react'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import DropZone from './components/DropZone'
import STLViewer from './components/STLViewer'
import ModelBrowser from './components/ModelBrowser'

const loader = new STLLoader()

function parseGeometry(buffer) {
  const geometry = loader.parse(buffer)
  const vertices = geometry.attributes.position.count
  return { geometry, vertices }
}

export default function App() {
  const [model, setModel] = useState(null)
  const [loading, setLoading] = useState(false)
  const [browserOpen, setBrowserOpen] = useState(false)

  const handleFile = useCallback((file) => {
    if (!file || !file.name.toLowerCase().endsWith('.stl')) return
    setLoading(true)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const { geometry, vertices } = parseGeometry(e.target.result)
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
      const { geometry, vertices } = parseGeometry(buffer)
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
