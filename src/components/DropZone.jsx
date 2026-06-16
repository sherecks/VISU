import { useRef, useState, useCallback } from 'react'

export default function DropZone({ onFile, onOpenBrowser }) {
  const inputRef = useRef()
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')

  const processFile = useCallback((file) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.stl')) {
      setError('Selecione um arquivo .STL')
      setTimeout(() => setError(''), 3000)
      return
    }
    setError('')
    onFile(file)
  }, [onFile])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    processFile(e.dataTransfer.files[0])
  }, [processFile])

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragging(true)
  }

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false)
  }

  const handleChange = (e) => {
    processFile(e.target.files[0])
    e.target.value = ''
  }

  return (
    <div
      className={`dropzone ${dragging ? 'dragging' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="dropzone-panel">
        <div className="dropzone-icon">
          <CubeIcon />
        </div>
        <h1>VISU</h1>
        <p className="dropzone-subtitle">Visualizador STL 3D</p>

        <div className="dropzone-divider" />

        <button
          className="dropzone-btn"
          onClick={() => inputRef.current.click()}
        >
          Abrir Arquivo STL...
        </button>

        <button
          className="dropzone-btn"
          onClick={onOpenBrowser}
        >
          Modelos de Exemplo...
        </button>

        {error
          ? <p className="dropzone-error">{error}</p>
          : <p className="dropzone-hint">
              {dragging ? 'Solte o arquivo aqui' : 'ou arraste um arquivo .STL aqui'}
            </p>
        }
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".stl"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
    </div>
  )
}

function CubeIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 22 L44 22 L44 58 L6 58 Z" strokeWidth="2.5" />
      <line x1="6"  y1="22" x2="20" y2="8"  strokeWidth="2.5" />
      <line x1="44" y1="22" x2="58" y2="8"  strokeWidth="2.5" />
      <line x1="20" y1="8"  x2="58" y2="8"  strokeWidth="2.5" />
      <line x1="58" y1="8"  x2="58" y2="44" strokeWidth="2.5" />
      <line x1="58" y1="44" x2="44" y2="58" strokeWidth="2.5" />
      <line x1="20" y1="8"  x2="20" y2="44" strokeWidth="2" strokeDasharray="5 3.5" />
      <line x1="20" y1="44" x2="58" y2="44" strokeWidth="2" strokeDasharray="5 3.5" />
      <line x1="20" y1="44" x2="6"  y2="58" strokeWidth="2" strokeDasharray="5 3.5" />
    </svg>
  )
}
