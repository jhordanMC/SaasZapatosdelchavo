import { Suspense, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import type { Group, Mesh } from 'three';

/**
 * Adaptado de D:\React\portafolio-jhordan\src\components\cirobot.jsx —
 * misma lógica de seguimiento de mouse (probada), modelo propio de VILCAS
 * (`/cirobot.glb`, una malla estática sin animation clips ni blend
 * shapes — NO puede parpadear; acá se simula respiración/flotación con
 * un pulso de escala + bob vertical, no requiere rig).
 */
const mouseState = { x: 0, y: 0 };

function handleMouseMove(e: MouseEvent) {
  mouseState.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouseState.y = (e.clientY / window.innerHeight) * 2 - 1;
}

function useGlobalMouseTracking() {
  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);
}

function useRespiracion(ref: React.RefObject<Group | Mesh | null>) {
  const t = useRef(0);
  useFrame((_, delta) => {
    if (!ref.current) return;
    t.current += delta;
    const escala = 1 + Math.sin(t.current * 1.4) * 0.02;
    ref.current.scale.setScalar(escala);
    ref.current.position.y = Math.sin(t.current * 0.9) * 0.04;
  });
}

function CirobotModel() {
  const groupRef = useRef<Group>(null);
  const { scene } = useGLTF('/cirobot.glb');
  useRespiracion(groupRef);

  useFrame(() => {
    if (!groupRef.current) return;
    const targetY = Math.max(-1.2, Math.min(0.6, mouseState.x * 1.5));
    const targetX = Math.max(-0.6, Math.min(0.3, mouseState.y * 0.8));
    groupRef.current.rotation.y += (targetY - groupRef.current.rotation.y) * 0.1;
    groupRef.current.rotation.x += (targetX - groupRef.current.rotation.x) * 0.1;
  });

  return (
    <group ref={groupRef}>
      <primitive object={scene} scale={1.1} />
    </group>
  );
}

function FallbackBot() {
  const ref = useRef<Mesh>(null);
  useRespiracion(ref);
  useFrame(() => {
    if (!ref.current) return;
    const targetY = Math.max(-1.2, Math.min(0.6, mouseState.x * 1.5));
    const targetX = Math.max(-0.6, Math.min(0.3, mouseState.y * 0.8));
    ref.current.rotation.y += (targetY - ref.current.rotation.y) * 0.1;
    ref.current.rotation.x += (targetX - ref.current.rotation.x) * 0.1;
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial color="#64d59c" roughness={0.2} metalness={0.6} />
    </mesh>
  );
}

export function Mascota3D() {
  useGlobalMouseTracking();

  return (
    <Canvas
      camera={{ position: [0, 0, 2], fov: 50 }}
      gl={{ alpha: true, antialias: true }}
      // pointer-events: none a propósito — el <canvas> que crea r3f no
      // hereda el pointer-events:none de .cbot-mascota-wrap (maneja sus
      // propios eventos para el raycasting), así que sin esto se queda
      // encima del botón Enviar del chat (la caja de 300x300 del wrap
      // llega hasta ahí) y le roba el click aunque sea invisible. El
      // único punto clickeable de la mascota sigue siendo
      // .cbot-mascota-click, que ya tiene su propio pointer-events:auto.
      style={{ background: 'transparent', width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      <ambientLight intensity={3} />
      <directionalLight position={[5, 5, 5]} intensity={6} color="#ffffff" />
      <directionalLight position={[-5, 3, 5]} intensity={4} color="#ffffff" />
      <pointLight position={[0, 0, 3]} intensity={8} color="#ffffff" />
      <hemisphereLight args={['#ffffff', '#888888', 2.5]} />
      <Suspense fallback={<FallbackBot />}>
        <CirobotModel />
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload('/cirobot.glb');