import React, { useMemo, useRef, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, Environment, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import { useSpring, animated, config } from '@react-spring/three'

// --- KONFIGURATION ---
const GRID_X = 9
const GRID_Y = 5
const SPACING = 4.0
const SCALE_BASE = 20.0
const SCALE_HOVER = 22.0
const SCALE_DETAIL = 100.0

// --- FARBE ---
const BLACK_COLOR = '#1a1a1a'

// --- BASIS MATERIAL ---
// Wir nutzen weiß als Basis, damit die zugewiesene Farbe (Schwarz) korrekt wirkt
const baseCeramicMaterial = new THREE.MeshPhysicalMaterial({
  color: '#ffffff', 
  roughness: 0.15,
  metalness: 0.0,
  clearcoat: 1.0,
  clearcoatRoughness: 0.1,
  envMapIntensity: 2.0
})

function useScrollRotation() {
  const rotationTarget = useRef(0)
  useEffect(() => {
    const handleWheel = (e) => rotationTarget.current += e.deltaY * 0.001
    window.addEventListener('wheel', handleWheel)
    return () => window.removeEventListener('wheel', handleWheel)
  }, [])
  return rotationTarget
}

// --- DAS MODELL ---
function CabalModel({ gridPosition, id, scrollRef, selectedId, onSelect, color }) {
  const { scene } = useGLTF('/cabal.glb')
  const { viewport } = useThree()
  const meshRef = useRef()

  const isSelected = selectedId === id
  const isAnotherSelected = selectedId !== null && !isSelected
  const isGridMode = selectedId === null

  const spring = useSpring({
    position: isSelected ? [0, 0, 0] : gridPosition,
    scale: isSelected ? SCALE_DETAIL : (isAnotherSelected ? 0 : SCALE_BASE),
    rotation: isGridMode ? [0, 0, 0] : [0, 0, 0],
    config: config.molasses
  })

  // Material clonen und Farbe setzen
  const clone = useMemo(() => {
    const clonedScene = scene.clone()
    clonedScene.traverse((child) => {
      if (child.isMesh) {
        child.material = baseCeramicMaterial.clone()
        child.material.color.set(color)
        child.castShadow = true
        child.receiveShadow = true
      }
    })
    return clonedScene
  }, [scene, color])

  useFrame((state) => {
    if (!meshRef.current) return

    const currentScrollRot = scrollRef.current
    const mouseX = (state.pointer.x * viewport.width) / 1.5
    const mouseY = (state.pointer.y * viewport.height) / 1.5

    const effectivePos = isSelected ? [0,0,0] : gridPosition
    const dist = Math.sqrt(Math.pow(mouseX - effectivePos[0], 2) + Math.pow(mouseY - effectivePos[1], 2))

    const radius = isSelected ? 15 : 8
    let influence = Math.max(0, 1 - dist / radius)

    if (isAnotherSelected) influence = 0

    const targetRotY = currentScrollRot + (state.pointer.x * influence * (isSelected ? 0.8 : 1.5))
    const targetRotX = (-state.pointer.y * influence * (isSelected ? 0.5 : 1.0))
    const targetZ = isSelected ? 0 : influence * 0.25

    meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, targetRotY, 0.08)
    meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, targetRotX, 0.1)
    meshRef.current.position.z = THREE.MathUtils.lerp(meshRef.current.position.z, targetZ, 0.1)
    
    if (isGridMode) {
       const targetScale = THREE.MathUtils.lerp(1, SCALE_HOVER / SCALE_BASE, influence)
       meshRef.current.scale.setScalar(targetScale)
    } else {
       meshRef.current.scale.setScalar(1)
    }
  })

  return (
    <animated.group 
      {...spring} 
      onClick={isGridMode ? () => onSelect(id) : undefined}
      onPointerOver={() => { if (isGridMode) document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { document.body.style.cursor = 'auto' }}
    >
      <primitive object={clone} ref={meshRef} />
    </animated.group>
  )
}

function Grid({ selectedId, setSelectedId }) {
  const startX = -((GRID_X - 1) * SPACING) / 2
  const startY = -((GRID_Y - 1) * SPACING) / 2
  const scrollRef = useScrollRotation()

  // --- GRID DATEN ---
  const modelsData = useMemo(() => {
    const items = []
    
    // Wir iterieren einfach durch das Grid und geben jedem Item die Farbe Schwarz
    for (let i = 0; i < GRID_X; i++) {
      for (let j = 0; j < GRID_Y; j++) {
        const x = startX + i * SPACING
        const y = startY + j * SPACING
        
        items.push({
          id: `${i}-${j}`,
          position: [x, y, 0],
          color: BLACK_COLOR // Hier setzen wir alles auf Schwarz
        })
      }
    }
    return items
  }, [])

  return (
    <group>
      {modelsData.map((data) => (
        <CabalModel 
          key={data.id}
          id={data.id}
          gridPosition={data.position} 
          scrollRef={scrollRef}
          selectedId={selectedId} 
          onSelect={setSelectedId}
          color={data.color}
        />
      ))}
    </group>
  )
}

export default function App() {
  const [selectedId, setSelectedId] = useState(null)

  return (
    <>
      <Canvas camera={{ position: [0, 0, 50], fov: 25 }} shadows>
        <color attach="background" args={['#F0F0F0']} />
        
        {/* Beleuchtung */}
        <ambientLight intensity={0.6} />
        <spotLight position={[15, 15, 15]} angle={0.2} penumbra={1} intensity={1.5} castShadow />
        <pointLight position={[-10, -5, -10]} intensity={1} color="#ffffff" />

        <Grid selectedId={selectedId} setSelectedId={setSelectedId} />

        <Environment preset="warehouse" />
        <animated.group visible={selectedId === null ? true : false}>
             <ContactShadows position={[0, -100, 0]} opacity={0.6} scale={80} blur={2} far={20} resolution={512} color="#000000" />
        </animated.group>
      </Canvas>

      {selectedId !== null && (
        <button className="close-button" onClick={() => setSelectedId(null)}></button>
      )}
    </>
  )
}