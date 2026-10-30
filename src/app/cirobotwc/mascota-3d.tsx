import { Suspense, useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useAnimations, useGLTF } from '@react-three/drei';
import {
  Box3, LoopOnce, MathUtils, Vector3,
  type AnimationAction, type Group, type Mesh, type MeshStandardMaterial,
} from 'three';

/**
 * Adaptado de D:\React\portafolio-jhordan\src\components\cirobot.jsx,
 * modelo propio de VILCAS.
 *
 * `/cirobot.glb` trae un esqueleto (cabeza, orejas, ojos, nariz) y 4 clips:
 * reposo (loop 4s: tics de orejas, parpadeo, olfateo, saca la lengua),
 * pensando (loop 2s: cabeza ladeada), hablando (loop 1s: asiente y jadea
 * con la lengua afuera) y saludo (una vez, 1.5s: orejas y lengua). La
 * lengua es una malla aparte que en reposo queda escondida dentro de la
 * cabeza. El rig se arma con un script de Blender aparte
 * (D:\Alba\Saas\Diseños\Ciro\riggear.py) — la malla original viene sin
 * soldar, así que los pesos se calculan por posición, no con auto-weights.
 * La respiración/flotación y el seguimiento del mouse siguen siendo código
 * (sobre el grupo entero), encima del clip.
 */
export type EstadoMascota = 'reposo' | 'pensando' | 'hablando';

const FUNDIDO_S = 0.3;

// Celulares/tablets: se mantienen los topes de calidad por memoria de GPU
// (ver comentario del <Canvas>); en desktop sobra margen para nitidez.
const ES_TACTIL = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
const MOVIMIENTO_REDUCIDO =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const ESCALA_MODELO = 1.1;

// La cabeza "sale" del agujero negro de carga (ver app-cirobot en Angular):
// crece desde su centro con un rebote y desenrollando un giro en espiral.
const DURACION_APARICION_S = 0.8;
const GIRO_APARICION_RAD = -2.6;

function rebote(t: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

// Posición del cursor en px de viewport. `activo` en false hasta el primer
// movimiento: sin eso, al cargar miraría a (0,0), la esquina superior izquierda.
const cursor = { x: 0, y: 0, activo: false };

function handleMouseMove(e: MouseEvent) {
  cursor.x = e.clientX;
  cursor.y = e.clientY;
  cursor.activo = true;
}

function useGlobalMouseTracking() {
  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);
}

// Distancia (px) a la que se imagina el plano del cursor delante de la
// cabeza: más chica = gira más con el mismo desplazamiento del mouse.
const PROFUNDIDAD_CURSOR_PX = 260;
const centroEnPantalla = new Vector3();

/**
 * Gira `ref` para que mire al cursor. Antes el giro salía de la posición
 * del mouse respecto al CENTRO de la ventana, pero la mascota vive en la
 * esquina inferior derecha: con el cursor a la derecha del centro (y aún a
 * la izquierda de la mascota) giraba hacia el lado equivocado. Ahora se
 * proyecta el centro de la cabeza a pantalla (con el rect real del canvas,
 * que ya incluye media queries y el "acercar" del CSS) y se apunta desde ahí.
 */
function useMirarCursor(ref: React.RefObject<Group | Mesh | null>, alturaCentro: number) {
  useFrame(({ camera, gl }) => {
    const obj = ref.current;
    if (!obj) return;
    let objetivoY = 0;
    let objetivoX = 0;
    if (cursor.activo) {
      const rect = gl.domElement.getBoundingClientRect();
      centroEnPantalla.set(0, alturaCentro, 0).project(camera);
      const cx = rect.left + ((centroEnPantalla.x + 1) / 2) * rect.width;
      const cy = rect.top + ((1 - centroEnPantalla.y) / 2) * rect.height;
      // rotation.y > 0 gira la cara hacia la derecha; rotation.x > 0 la baja.
      objetivoY = MathUtils.clamp(Math.atan2(cursor.x - cx, PROFUNDIDAD_CURSOR_PX), -1.1, 1.1);
      objetivoX = MathUtils.clamp(Math.atan2(cursor.y - cy, PROFUNDIDAD_CURSOR_PX), -0.6, 0.45);
    }
    obj.rotation.y += (objetivoY - obj.rotation.y) * 0.1;
    obj.rotation.x += (objetivoX - obj.rotation.x) * 0.1;
  });
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

/**
 * `saludo` es un contador: cada vez que cambia (y es > 0) se reproduce el
 * clip de saludo una vez y después se vuelve al clip del `estado` actual.
 */
function CirobotModel({
  estado,
  saludo,
  onCargado,
}: {
  estado: EstadoMascota;
  saludo: number;
  onCargado?: () => void;
}) {
  const groupRef = useRef<Group>(null);
  const aparicionRef = useRef<Group>(null);
  const tAparicion = useRef(0);
  const { scene, animations } = useGLTF('/cirobot.glb');
  const { actions, mixer } = useAnimations(animations, groupRef);
  const [saludando, setSaludando] = useState(false);
  const maxAnisotropia = useThree((s) => s.gl.capabilities.getMaxAnisotropy());
  // Altura del centro de la cabeza (el origen del modelo está en el mentón).
  const alturaCentro = useMemo(() => {
    const caja = new Box3();
    scene.traverse((o) => {
      const geometria = (o as Mesh).isMesh ? (o as Mesh).geometry : null;
      if (!geometria) return;
      geometria.computeBoundingBox();
      if (geometria.boundingBox) caja.union(geometria.boundingBox);
    });
    return caja.isEmpty() ? 0 : caja.getCenter(new Vector3()).y * ESCALA_MODELO;
  }, [scene]);
  useRespiracion(groupRef);
  useMirarCursor(groupRef, alturaCentro);

  // Este componente recién monta cuando el .glb terminó de bajar (Suspense).
  useEffect(() => {
    onCargado?.();
  }, [onCargado]);

  useFrame((_, delta) => {
    const g = aparicionRef.current;
    if (!g || tAparicion.current >= 1) return;
    tAparicion.current = Math.min(1, tAparicion.current + delta / DURACION_APARICION_S);
    const t = tAparicion.current;
    g.scale.setScalar(Math.max(0.001, rebote(t)));
    g.rotation.z = MOVIMIENTO_REDUCIDO ? 0 : (1 - t) ** 3 * GIRO_APARICION_RAD;
  });

  // La textura se ve en ángulo en los bordes de la cabeza; sin filtrado
  // anisotrópico ahí se emborrona.
  useEffect(() => {
    scene.traverse((o) => {
      const material = (o as Mesh).material as MeshStandardMaterial | undefined;
      if (material?.map) {
        material.map.anisotropy = Math.min(8, maxAnisotropia);
        material.map.needsUpdate = true;
      }
    });
  }, [scene, maxAnisotropia]);

  useEffect(() => {
    if (saludo > 0) setSaludando(true);
  }, [saludo]);

  useEffect(() => {
    const alTerminar = (e: { action: AnimationAction }) => {
      if (e.action === actions['saludo']) setSaludando(false);
    };
    mixer.addEventListener('finished', alTerminar);
    return () => mixer.removeEventListener('finished', alTerminar);
  }, [mixer, actions]);

  const clip = saludando ? 'saludo' : estado;
  useEffect(() => {
    const accion = actions[clip];
    if (!accion) return;
    if (clip === 'saludo') accion.setLoop(LoopOnce, 1);
    accion.reset().fadeIn(FUNDIDO_S).play();
    return () => {
      accion.fadeOut(FUNDIDO_S);
    };
  }, [clip, actions]);

  // aparición (escala/giro alrededor del centro de la cabeza) > respiración y
  // mirada (grupo interno, alrededor del mentón como siempre)
  return (
    <group ref={aparicionRef} position={[0, alturaCentro, 0]} scale={0.001}>
      <group position={[0, -alturaCentro, 0]}>
        <group ref={groupRef}>
          <primitive object={scene} scale={ESCALA_MODELO} />
        </group>
      </group>
    </group>
  );
}

/**
 * Burbuja estática (puro CSS, sin WebGL) que se muestra si el contexto
 * se pierde. Antes, cuando el proceso de GPU del navegador tumbaba el
 * contexto (típico en celulares de gama media/baja bajo presión de
 * memoria — ver el bug de Ventas: grid de fotos + animación "vuelo al
 * carrito" + este canvas corriendo sin parar en TODAS las páginas de
 * empresa), Chrome pintaba su propio ícono de "contexto perdido" arriba
 * del canvas y ahí se quedaba frito para el resto de la sesión. Con esto
 * al menos degradamos a algo intencional en vez del ícono roto del navegador.
 */
function BurbujaEstatica() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: '55%',
          height: '55%',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 30%, #7fe0ab, #2f8f63)',
        }}
      />
    </div>
  );
}

export function Mascota3D({
  estado = 'reposo',
  saludo = 0,
  onListo,
}: {
  estado?: EstadoMascota;
  saludo?: number;
  onListo?: () => void;
}) {
  useGlobalMouseTracking();
  const [contextoValido, setContextoValido] = useState(true);

  // Sin WebGL queda la burbuja estática: también cuenta como "listo", para
  // que la animación de carga del host no se quede girando para siempre.
  useEffect(() => {
    if (!contextoValido) onListo?.();
  }, [contextoValido, onListo]);

  // Reintenta un contexto nuevo si el usuario reabre/reinteractúa después
  // de una pérdida — sin esto, aunque el navegador restaure el contexto
  // solo, React seguiría pensando que sigue perdido.
  const reintentar = useCallback(() => setContextoValido(true), []);

  if (!contextoValido) {
    return (
      <div style={{ width: '100%', height: '100%', pointerEvents: 'auto' }} onClick={reintentar}>
        <BurbujaEstatica />
      </div>
    );
  }

  return (
    <Canvas
      camera={{ position: [0, 0, 2], fov: 50 }}
      // En celulares: antialias:false y dpr topeado a 1.5 — el MSAA y un
      // devicePixelRatio de 3 (común en gama media) multiplican el
      // framebuffer varias veces y eran la principal causa de que el
      // proceso de GPU se quedara sin memoria. En desktop, en cambio, con
      // dpr 1.5 y sin antialias el modelo se veía estirado y con bordes
      // dentados en pantallas de densidad 2; un canvas de 300x300 a dpr 2
      // con MSAA sigue siendo un framebuffer chico. powerPreference
      // low-power evita pelear por la GPU discreta/de alto consumo con el
      // resto de la página (grid de fotos, animaciones del carrito).
      dpr={[1, ES_TACTIL ? 1.5 : 2]}
      gl={{ alpha: true, antialias: !ES_TACTIL, powerPreference: 'low-power', preserveDrawingBuffer: false }}
      onCreated={({ gl }) => {
        const canvas = gl.domElement;
        // El evento es cancelable a propósito: si no se llama
        // preventDefault(), el navegador NUNCA intenta restaurar el
        // contexto y el canvas queda muerto para siempre en esa pestaña.
        const alPerderContexto = (e: Event) => {
          e.preventDefault();
          setContextoValido(false);
        };
        const alRestaurarContexto = () => setContextoValido(true);
        canvas.addEventListener('webglcontextlost', alPerderContexto);
        canvas.addEventListener('webglcontextrestored', alRestaurarContexto);
      }}
      // pointer-events: none a propósito — el <canvas> que crea r3f no
      // hereda el pointer-events:none de .cbot-mascota-wrap (maneja sus
      // propios eventos para el raycasting), así que sin esto se queda
      // encima del botón Enviar del chat (la caja de 300x300 del wrap
      // llega hasta ahí) y le roba el click aunque sea invisible. El
      // único punto clickeable de la mascota sigue siendo
      // .cbot-mascota-click, que ya tiene su propio pointer-events:auto.
      style={{ background: 'transparent', width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      {/* Luz principal + relleno + contraluz. Antes el material venía como
          metálico (default de glTF sin metallicFactor) y se compensaba con
          ~23 de intensidad total, que quemaba los blancos y aplastaba la
          mancha negra; con el material corregido en el .glb esto alcanza. */}
      <hemisphereLight args={['#ffffff', '#b0b8b4', 1.1]} />
      <directionalLight position={[2.5, 3, 4]} intensity={2.2} color="#ffffff" />
      <directionalLight position={[-4, 1, 3]} intensity={0.9} color="#ffffff" />
      <directionalLight position={[0, 3, -4]} intensity={1.2} color="#ffffff" />
      {/* Sin fallback 3D: mientras baja el .glb, el host (app-cirobot en
          Angular) muestra un agujero negro en HTML/CSS que no depende de
          que three.js ni este chunk hayan llegado. */}
      <Suspense fallback={null}>
        <CirobotModel estado={estado} saludo={saludo} onCargado={onListo} />
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload('/cirobot.glb');