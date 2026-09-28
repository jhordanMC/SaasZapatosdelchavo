import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Dictado por voz (voice-to-text) para el chat de Varian Assist.
 *
 * Usa la Web Speech API nativa del navegador (SpeechRecognition), así que
 * no hace falta backend ni librerías: Chrome, Edge y Safari la soportan;
 * Firefox no (ahí `soportado` es false y el botón queda deshabilitado).
 * Requiere HTTPS (o localhost) y que el usuario dé permiso al micrófono.
 * Ojo: en Chrome/Edge el audio se procesa en el servicio de voz del
 * navegador, por eso necesita internet.
 *
 * Al terminar la sesión (el usuario dejó de hablar, o tocó el mic para
 * cortar) se llama `onFin` con el texto final, para que el chat lo envíe
 * solo. NO se llama si hubo error, si no se reconoció nada, o si la sesión
 * se canceló a propósito (`detener(true)`: el usuario escribió a mano,
 * dio Enter, minimizó o cerró el chat) — así nunca se envía doble.
 */

// lib.dom de TypeScript no trae estos tipos, se declara lo mínimo que se usa.
interface EventoResultadoVoz {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}
interface EventoErrorVoz {
  error: string;
}
interface ReconocimientoVoz {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: EventoResultadoVoz) => void) | null;
  onerror: ((e: EventoErrorVoz) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type ConstructorReconocimiento = new () => ReconocimientoVoz;

function obtenerConstructor(): ConstructorReconocimiento | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: ConstructorReconocimiento;
    webkitSpeechRecognition?: ConstructorReconocimiento;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const MENSAJES_ERROR: Record<string, string> = {
  'not-allowed': 'El micrófono está bloqueado. Permítelo desde el candado de la barra de direcciones.',
  'service-not-allowed': 'El navegador no permite el dictado por voz en este sitio.',
  'audio-capture': 'No encontré ningún micrófono conectado.',
  'no-speech': 'No te escuché. Intenta de nuevo.',
  network: 'El dictado necesita conexión a internet.',
};

export function useDictado(onTexto: (texto: string) => void, onFin: (texto: string) => void, idioma = 'es-PE') {
  const Constructor = obtenerConstructor();
  const [escuchando, setEscuchando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<ReconocimientoVoz | null>(null);
  // El callback cambia en cada render (cierra sobre `input`); se guarda en
  // un ref para que la sesión de reconocimiento siempre llame a la última.
  const onTextoRef = useRef(onTexto);
  onTextoRef.current = onTexto;
  const onFinRef = useRef(onFin);
  onFinRef.current = onFin;
  // Estado de la sesión en curso (no necesita re-render, por eso son refs).
  const ultimoTextoRef = useRef('');
  const canceladoRef = useRef(false);
  const huboErrorRef = useRef(false);

  /** `cancelar = true` corta sin enviar lo dictado; false lo deja terminar y enviar. */
  const detener = useCallback((cancelar = false) => {
    if (!recRef.current) return;
    if (cancelar) canceladoRef.current = true;
    recRef.current.stop();
  }, []);

  const iniciar = useCallback(() => {
    if (!Constructor || recRef.current) return;
    setError(null);
    ultimoTextoRef.current = '';
    canceladoRef.current = false;
    huboErrorRef.current = false;

    const rec = new Constructor();
    rec.lang = idioma;
    rec.continuous = false; // se corta solo al terminar de hablar
    rec.interimResults = true; // el texto aparece mientras hablas
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      const texto = Array.from(e.results)
        .map((r) => r[0]?.transcript ?? '')
        .join('')
        .trim();
      ultimoTextoRef.current = texto;
      onTextoRef.current(texto);
    };
    rec.onerror = (e) => {
      // 'aborted' = lo cancelamos nosotros (cerrar/minimizar), no es un error.
      huboErrorRef.current = true;
      if (e.error !== 'aborted') setError(MENSAJES_ERROR[e.error] ?? 'No pude usar el micrófono. Intenta de nuevo.');
    };
    rec.onend = () => {
      // recRef se limpia ANTES de llamar onFin: el envío llama detener() y no
      // debe encontrar una sesión viva.
      recRef.current = null;
      setEscuchando(false);
      const texto = ultimoTextoRef.current;
      ultimoTextoRef.current = '';
      if (texto && !canceladoRef.current && !huboErrorRef.current) onFinRef.current(texto);
    };

    recRef.current = rec;
    try {
      rec.start();
      setEscuchando(true);
    } catch {
      recRef.current = null;
      setError('No pude iniciar el micrófono. Intenta de nuevo.');
    }
  }, [Constructor, idioma]);

  // Al desmontar (cerrar el chat) se libera el micrófono.
  useEffect(
    () => () => {
      canceladoRef.current = true;
      recRef.current?.abort();
    },
    [],
  );

  return { soportado: Constructor !== null, escuchando, error, iniciar, detener, limpiarError: () => setError(null) };
}