import { useState } from 'react'
import { CATALOG } from '../catalog'

export default function ModelBrowser({ onSelect, onClose }) {
  const [selected, setSelected] = useState(null)

  const handleOpen = () => {
    if (selected) onSelect(selected)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'Enter' && selected) handleOpen()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()} onKeyDown={handleKeyDown}>
      <div className="modal-window">
        <div className="modal-titlebar">
          <span>Abrir Modelo de Exemplo</span>
          <button className="modal-close" onClick={onClose} title="Fechar">✕</button>
        </div>

        <div className="modal-body">
          <p className="modal-label">Selecione um modelo:</p>
          <div className="modal-listbox">
            {CATALOG.map((item) => (
              <button
                key={item.id}
                className={`listbox-item ${selected?.id === item.id ? 'selected' : ''}`}
                onClick={() => setSelected(item)}
                onDoubleClick={() => onSelect(item)}
              >
                <span className="listbox-item-icon">
                  <ModelIcon />
                </span>
                <span className="listbox-item-info">
                  <span className="listbox-item-name">{item.name}</span>
                  {item.description && (
                    <span className="listbox-item-desc">{item.description}</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button
            className="win-btn"
            onClick={handleOpen}
            disabled={!selected}
          >
            Abrir
          </button>
          <button className="win-btn" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

function ModelIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 22 L44 22 L44 58 L6 58 Z" strokeWidth="3.5" />
      <line x1="6"  y1="22" x2="20" y2="8"  strokeWidth="3.5" />
      <line x1="44" y1="22" x2="58" y2="8"  strokeWidth="3.5" />
      <line x1="20" y1="8"  x2="58" y2="8"  strokeWidth="3.5" />
      <line x1="58" y1="8"  x2="58" y2="44" strokeWidth="3.5" />
      <line x1="58" y1="44" x2="44" y2="58" strokeWidth="3.5" />
      <line x1="20" y1="8"  x2="20" y2="44" strokeWidth="2.5" strokeDasharray="6 4" />
      <line x1="20" y1="44" x2="58" y2="44" strokeWidth="2.5" strokeDasharray="6 4" />
      <line x1="20" y1="44" x2="6"  y2="58" strokeWidth="2.5" strokeDasharray="6 4" />
    </svg>
  )
}
