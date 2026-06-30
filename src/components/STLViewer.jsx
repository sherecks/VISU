import { useRef, useMemo, useState, useCallback, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Grid, Environment, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import { normalizeGeometry } from '../lib/normalizeGeometry'

function Model({ geometry, wireframe }) {
  const geo = useMemo(() => normalizeGeometry(geometry), [geometry])

  return (
    <mesh geometry={geo} castShadow receiveShadow>
      <meshStandardMaterial
        color={wireframe ? '#aaaaaa' : '#7898aa'}
        wireframe={wireframe}
        metalness={wireframe ? 0 : 0.18}
        roughness={wireframe ? 1 : 0.48}
        envMapIntensity={wireframe ? 0 : 0.75}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

function CameraReset({ geometry, orbitRef }) {
  const { camera } = useThree()

  useEffect(() => {
    camera.position.set(0, 1.5, 6)
    camera.lookAt(0, 0, 0)
    if (orbitRef.current) {
      orbitRef.current.target.set(0, 0, 0)
      orbitRef.current.update()
    }
  }, [geometry, camera, orbitRef])

  return null
}

function Scene({ geometry, wireframe, autoRotate, orbitRef }) {
  return (
    <>
      <color attach="background" args={['#1a1a1a']} />

      <Environment preset="studio" />

      <directionalLight
        position={[3, 6, 4]}
        intensity={0.9}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0005}
      />
      <directionalLight position={[-4, 3, -5]} intensity={0.55} color="#c8d4ff" />
      <directionalLight position={[0, -4, 2]} intensity={0.18} color="#ffffff" />

      <Model geometry={geometry} wireframe={wireframe} />

      <ContactShadows
        position={[0, -1.55, 0]}
        opacity={0.45}
        scale={10}
        blur={2.5}
        far={2}
        color="#000010"
      />

      <Grid
        renderOrder={-1}
        position={[0, -2, 0]}
        infiniteGrid
        cellSize={0.4}
        cellThickness={0.4}
        cellColor="#2a2a2a"
        sectionSize={2}
        sectionThickness={0.8}
        sectionColor="#3a3a3a"
        fadeDistance={28}
        fadeStrength={1.2}
      />

      <OrbitControls
        ref={orbitRef}
        enableDamping
        dampingFactor={0.07}
        autoRotate={autoRotate}
        autoRotateSpeed={1.8}
        minDistance={1.5}
        maxDistance={22}
        touches={{
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_PAN,
        }}
      />

      <CameraReset geometry={geometry} orbitRef={orbitRef} />
    </>
  )
}

function formatVertices(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M verts`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K verts`
  return `${n} verts`
}

export default function STLViewer({ geometry, fileName, vertexCount, onLoadNew, onBack, onOpenBrowser, onOpenTunnel }) {
  const orbitRef = useRef()
  const inputRef = useRef()
  const [wireframe, setWireframe] = useState(false)
  const [autoRotate, setAutoRotate] = useState(false)
  const [hintVisible, setHintVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setHintVisible(false), 3000)
    return () => clearTimeout(t)
  }, [])

  const resetCamera = useCallback(() => {
    if (orbitRef.current) orbitRef.current.reset()
  }, [])

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) onLoadNew(file)
    e.target.value = ''
  }

  const shortName = fileName.replace(/\.stl$/i, '')

  return (
    <div className="viewer">
      <div className="viewer-topbar">
        <span className="viewer-logo">VISU</span>
        <span className="viewer-sep" />
        <span className="viewer-filename" title={shortName}>{shortName}</span>
        <span className="viewer-vertices">{formatVertices(vertexCount)}</span>
      </div>

      <div className="viewer-canvas-wrap">
        <Canvas
          camera={{ position: [0, 1.5, 6], fov: 48 }}
          shadows
          dpr={[1, 2]}
          style={{ position: 'absolute', inset: 0, touchAction: 'none' }}
        >
          <Scene
            geometry={geometry}
            wireframe={wireframe}
            autoRotate={autoRotate}
            orbitRef={orbitRef}
          />
        </Canvas>

        <div className={`touch-hint ${hintVisible ? '' : 'hidden'}`}>
          Arraste para girar · Pinça para zoom
        </div>
      </div>

      <div className="viewer-toolbar">
        <button className="tool-btn" onClick={onBack} title="Voltar">
          <BackIcon />
          <span>Voltar</span>
        </button>

        <button className="tool-btn" onClick={onOpenBrowser} title="Exemplos">
          <GalleryIcon />
          <span>Exemplos</span>
        </button>

        <button className="tool-btn" onClick={resetCamera} title="Resetar câmera">
          <ResetIcon />
          <span>Reset</span>
        </button>

        <button
          className={`tool-btn ${wireframe ? 'active' : ''}`}
          onClick={() => setWireframe(v => !v)}
          title="Wireframe"
        >
          <WireframeIcon />
          <span>Wire</span>
        </button>

        <button
          className={`tool-btn ${autoRotate ? 'active' : ''}`}
          onClick={() => setAutoRotate(v => !v)}
          title="Rotação automática"
        >
          <RotateIcon />
          <span>Auto</span>
        </button>

        <button className="tool-btn" onClick={onOpenTunnel} title="Túnel de água">
          <TunnelIcon />
          <span>Túnel</span>
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".stl,.3mf"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
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

function GalleryIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
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

function WireframeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 20 22 20" />
      <line x1="12" y1="2" x2="12" y2="20" />
      <line x1="4.5" y1="13" x2="19.5" y2="13" />
    </svg>
  )
}

function RotateIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.5 2v6h-6" />
      <path d="M21.34 15.57a10 10 0 1 1-.57-8.38" />
    </svg>
  )
}

function TunnelIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="7" x2="9" y2="7" />
      <line x1="2" y1="12" x2="7" y2="12" />
      <line x1="2" y1="17" x2="9" y2="17" />
      <ellipse cx="14" cy="12" rx="4" ry="9" />
      <line x1="18" y1="7" x2="22" y2="7" />
      <line x1="19" y1="12" x2="22" y2="12" />
      <line x1="18" y1="17" x2="22" y2="17" />
    </svg>
  )
}
