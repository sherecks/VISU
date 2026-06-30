import { useRef, useEffect, useMemo, useState, useCallback } from 'react'
import { normalizeGeometry } from '../lib/normalizeGeometry'
import { sliceMaskFromGeometry } from '../lib/sliceGeometry'
import { LBMSolver } from '../lib/lbm/LBMSolver'

const GRID_WIDTH = 256
const GRID_HEIGHT = 128
const STEPS_PER_FRAME = 6
const TAU_MIN = 0.51
const TAU_MAX = 1.4
const VEL_MIN = 0.02
const VEL_MAX = 0.12

export default function WaterTunnel({ geometry, fileName, onBack }) {
  const canvasRef = useRef()
  const solverRef = useRef()
  const rafRef = useRef()
  const runningRef = useRef(true)

  const [running, setRunning] = useState(true)
  const [tau, setTau] = useState(0.6)
  const [inflowVel, setInflowVel] = useState(0.06)
  const [error, setError] = useState('')
  const [stepCount, setStepCount] = useState(0)

  const slice = useMemo(() => {
    try {
      const norm = normalizeGeometry(geometry)
      return sliceMaskFromGeometry(norm, { width: GRID_WIDTH, height: GRID_HEIGHT })
    } catch (err) {
      setError(err.message)
      return null
    }
  }, [geometry])

  const reynolds = useMemo(() => {
    if (!slice) return 0
    const domainWidth = slice.domain.x1 - slice.domain.x0
    const dx = domainWidth / slice.width
    const modelLength = slice.modelBounds.maxX - slice.modelBounds.minX
    const lLattice = modelLength / dx
    const nu = (tau - 0.5) / 3
    return (inflowVel * lLattice) / nu
  }, [slice, tau, inflowVel])

  useEffect(() => {
    if (!slice || !canvasRef.current) return
    const canvas = canvasRef.current
    canvas.width = GRID_WIDTH
    canvas.height = GRID_HEIGHT

    try {
      solverRef.current = new LBMSolver(canvas, {
        width: GRID_WIDTH,
        height: GRID_HEIGHT,
        mask: slice.mask,
        tau,
        inflowVel,
      })
    } catch (err) {
      setError(err.message)
      return
    }

    const loop = () => {
      const solver = solverRef.current
      if (solver) {
        if (runningRef.current) {
          solver.step(STEPS_PER_FRAME)
          setStepCount((c) => c + STEPS_PER_FRAME)
        }
        solver.render()
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafRef.current)
      solverRef.current?.dispose()
      solverRef.current = null
    }
  }, [slice])

  useEffect(() => {
    solverRef.current?.setParams({ tau, inflowVel })
  }, [tau, inflowVel])

  useEffect(() => {
    runningRef.current = running
  }, [running])

  const handleReset = useCallback(() => {
    if (!slice || !canvasRef.current) return
    solverRef.current?.dispose()
    setStepCount(0)
    try {
      solverRef.current = new LBMSolver(canvasRef.current, {
        width: GRID_WIDTH,
        height: GRID_HEIGHT,
        mask: slice.mask,
        tau,
        inflowVel,
      })
    } catch (err) {
      setError(err.message)
    }
  }, [slice, tau, inflowVel])

  const shortName = fileName ? fileName.replace(/\.(stl|3mf)$/i, '') : ''

  return (
    <div className="viewer">
      <div className="viewer-topbar">
        <span className="viewer-logo">VISU</span>
        <span className="viewer-sep" />
        <span className="viewer-filename" title={shortName}>Túnel de Água — {shortName}</span>
        <span className="viewer-vertices">{GRID_WIDTH}×{GRID_HEIGHT}</span>
      </div>

      <div className="viewer-canvas-wrap tunnel-canvas-wrap">
        {error ? (
          <div className="tunnel-error">
            <p>Não foi possível iniciar a simulação.</p>
            <p className="tunnel-error-detail">{error}</p>
          </div>
        ) : (
          <canvas ref={canvasRef} className="tunnel-canvas" />
        )}
      </div>

      <div className="viewer-toolbar tunnel-toolbar">
        <button className="tool-btn" onClick={onBack} title="Voltar">
          <BackIcon />
          <span>Voltar</span>
        </button>

        <button
          className={`tool-btn ${running ? 'active' : ''}`}
          onClick={() => setRunning((v) => !v)}
          title={running ? 'Pausar' : 'Rodar'}
        >
          {running ? <PauseIcon /> : <PlayIcon />}
          <span>{running ? 'Pausar' : 'Rodar'}</span>
        </button>

        <button className="tool-btn" onClick={handleReset} title="Reiniciar simulação">
          <ResetIcon />
          <span>Reset</span>
        </button>

        <div className="tunnel-controls">
          <div className="tunnel-row">
            <span className="tunnel-label">Velocidade</span>
            <input
              type="range"
              min={VEL_MIN}
              max={VEL_MAX}
              step={0.002}
              value={inflowVel}
              onChange={(e) => setInflowVel(parseFloat(e.target.value))}
            />
          </div>
          <div className="tunnel-row">
            <span className="tunnel-label">Viscosidade</span>
            <input
              type="range"
              min={TAU_MIN}
              max={TAU_MAX}
              step={0.005}
              value={tau}
              onChange={(e) => setTau(parseFloat(e.target.value))}
            />
          </div>
          <div className="tunnel-row tunnel-readout">
            <span>Re ≈ {reynolds.toFixed(0)}</span>
            <span>{stepCount.toLocaleString('pt-BR')} passos</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="6 4 20 12 6 20" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <rect x="5" y="4" width="5" height="16" />
      <rect x="14" y="4" width="5" height="16" />
    </svg>
  )
}

function ResetIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  )
}
