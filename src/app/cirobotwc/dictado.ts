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

export function useDictado(onTexto: (texto: string) => void, idioma = 'es-PE') {
  const Constructor = obtenerConstructor();
  const [escuchando, setEscuchando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<ReconocimientoVoz | null>(null);
  // El callback cambia en cada render (cierra sobre `input`); se guarda en
  // un ref para que la sesión de reconocimiento siempre llame a la última.
  const onTextoRef = useRef(onTexto);
  onTextoRef.current = onTexto;

  const detener = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const iniciar = useCallback(() => {
    if (!Constructor || recRef.current) return;
    setError(null);

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
      onTextoRef.current(texto);
    };
    rec.onerror = (e) => {
      // 'aborted' = lo cancelamos nosotros (cerrar/minimizar), no es un error.
      if (e.error !== 'aborted') setError(MENSAJES_ERROR[e.error] ?? 'No pude usar el micrófono. Intenta de nuevo.');
    };
    rec.onend = () => {
      recRef.current = null;
      setEscuchando(false);
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
  useEffect(() => () => recRef.current?.abort(), []);

  return { soportado: Constructor !== null, escuchando, error, iniciar, detener, limpiarError: () => setError(null) };
}