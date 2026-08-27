/**
 * @file speech.ts
 * @description
 * Utilidades de voz para la app: Text-to-Speech (TTS) y Speech-to-Text (STT) en español mexicano (es-MX).
 * Provee selección de voz por género, precarga de voces, síntesis con `speechSynthesis`
 * y reconocimiento continuo con `SpeechRecognition` (webkit-prefixed), además de helpers
 * para fusionar transcripciones parciales.
 *
 * Dependencias:
 * - `../core/theme` → tipo `VoiceType` (`'female' | 'male'` para elegir voz).
 * - Web APIs: `window.speechSynthesis`, `SpeechSynthesisVoice/Utterance`, `SpeechRecognition` / `webkitSpeechRecognition`.
 *
 * Flujo TTS:
 * 1. `precargarVoces()` registra `voiceschanged` y fuerza `getVoices()` para poblar la lista (algunos navegadores la cargan async).
 * 2. `findVoice(type)` filtra voces `es*` y busca por nombre (listas `femaleNames`/`maleNames` + fallback Microsoft neutro).
 * 3. `hablar(texto, type)` espera a que haya voces (o reintenta 1s) y luego `emitir` hace `cancel`+`speak` con `lang=es-MX`, `rate=0.95`.
 *
 * Flujo STT:
 * 1. `crearReconocedor()` instancia `SpeechRecognition` con `lang=es-MX`, `continuous=true`, `interimResults=true`.
 * 2. Callers suscriben `onresult` y usan `transcribirTodo` / `ultimoTranscripcion` / `fusionarTranscripcion` para manejar resultados.
 *
 * Decisiones de diseño:
 * - Listas heurísticas de nombres para inferir género de la voz porque la API no expone género estándar.
 * - `rate=0.95` ligeramente más lento para mejor inteligibilidad en español.
 * - `fusionarTranscripcion` evita duplicar texto cuando el STT re-emite el mismo segmento con más contexto (solapamiento de 3+ chars).
 * - `precargarVoces` es idempotente (`vocesCargadas` flag + `voiceschanged` listener).
 */
import type { VoiceType } from '../core/theme'

// ---------------------------------------------------------------------------
// Heurísticas de género por nombre de voz
// ---------------------------------------------------------------------------

/** Nombres comunes que suelen aparecer en voces femeninas (para `findVoice('female')`). Lowercase para comparación. */
const femaleNames = ['maria', 'sofia', 'paulina', 'helena', 'lucia', 'valentina', 'camila', 'isabella', 'gabriela', 'alejandra', 'fernanda', 'ximena', 'renata', 'victoria', 'diana', 'julia', 'monica', 'ana', 'carmen', 'rosa', 'laura', 'martha', 'silvia', 'patricia', 'claudia', 'veronica', 'beatriz', 'elena', 'adriana', 'teresa']
/** Nombres comunes para voces masculinas. */
const maleNames = ['miguel', 'jorge', 'raul', 'pablo', 'carlos', 'juan', 'david', 'jose', 'antonio', 'luis', 'javier', 'alejandro', 'manuel', 'fernando', 'pedro', 'diego', 'ricardo', 'daniel', 'rodrigo', 'andres']

/**
 * Determina si una voz es en español por su `lang`.
 * @param v - Voz del sistema.
 * @returns `true` si `lang` empieza con `es` (case-insensitive, cubre `es-MX`, `es-ES`, etc.).
 */
function isSpanishVoice(v: SpeechSynthesisVoice): boolean {
  return v.lang.toLowerCase().startsWith('es')
}

/**
 * Busca una voz en español del género solicitado.
 * Estrategia: filtrar `es*`, luego buscar por nombre femenino/masculino, luego fallback Microsoft neutro, finalmente primera `es*`.
 * @param type - `'female'` o `'male'` (de `VoiceType`).
 * @returns Voz encontrada o `null` si no hay ninguna `es*`.
 */
export function findVoice(type: VoiceType): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices() ?? []
  const spanish = voices.filter(isSpanishVoice)
  if (!spanish.length) return null

  const isFemale = (name: string) => femaleNames.some((fn) => name.includes(fn))
  const isMale = (name: string) => maleNames.some((mn) => name.includes(mn))
  const lower = (s: string) => s.toLowerCase()

  if (type === 'female') {
    // Prioridad 1: voz con nombre femenino explícito
    for (const v of spanish) {
      if (isFemale(lower(v.name))) return v
    }
    // Prioridad 2: Microsoft no-masculina (heurística para Edge/Windows)
    const ms = spanish.find((v) => lower(v.name).includes('microsoft') && !isMale(lower(v.name)))
    if (ms) return ms
  } else {
    for (const v of spanish) {
      if (isMale(lower(v.name))) return v
    }
    const ms = spanish.find((v) => lower(v.name).includes('microsoft') && !isFemale(lower(v.name)))
    if (ms) return ms
  }

  // Fallback final: primera voz en español disponible
  return spanish[0] ?? null
}

// ---------------------------------------------------------------------------
// Precarga de voces (algunos navegadores las cargan de forma async)
// ---------------------------------------------------------------------------

/** Flag: `true` cuando `getVoices()` ya devolvió al menos una voz. */
let vocesCargadas = false

/**
 * Precarga la lista de voces del sistema y escucha `voiceschanged`.
 * Idempotente: si ya se cargaron, no re-registra. Fuerza `getVoices()` y reintenta a los 250ms.
 * Llamar temprano en el ciclo de vida de la app para que `hablar()` no tenga que esperar.
 */
export function precargarVoces(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  const synth = window.speechSynthesis
  if (vocesCargadas) return
  const escuchar = () => {
    vocesCargadas = (synth.getVoices() ?? []).length > 0
  }
  synth.addEventListener('voiceschanged', escuchar)
  escuchar()
  // Fuerza la carga en navegadores que no disparan el evento solos (ej. Chrome desktop inicial)
  if (!vocesCargadas && typeof synth.getVoices !== 'undefined') {
    void synth.getVoices()
    setTimeout(escuchar, 250)
  }
}

/** Flag para que `hablar()` solo llame a `precargarVoces()` una vez. */
let vocesPrecargadas = false

/**
 * Obtiene la voz esperada para un tipo, con fallback a `female` si no hay del tipo pedido.
 * @param type - Tipo de voz solicitado.
 * @returns Voz encontrada o `null`.
 */
function vozEsperada(type: VoiceType): SpeechSynthesisVoice | null {
  const v = findVoice(type)
  if (v) return v
  return findVoice('female') ?? null
}

/**
 * Emite texto por síntesis de voz de forma inmediata (asume que las voces ya están cargadas).
 * Hace `cancel` previo para no encolar, configura `lang=es-MX`, `rate=0.95`, `pitch=1` y `voice`.
 * @param texto - Texto a sintetizar.
 * @param type - Tipo de voz (`female`/`male`).
 */
function emitir(texto: string, type: VoiceType): void {
  const synth = window.speechSynthesis
  if (!synth) return
  synth.cancel() // cortar cualquier emisión previa
  const utterance = new SpeechSynthesisUtterance(texto)
  utterance.lang = 'es-MX'
  utterance.rate = 0.95 // ligeramente más lento que 1 para claridad
  utterance.pitch = 1
  const voice = vozEsperada(type)
  if (voice) utterance.voice = voice
  synth.resume() // por si estaba pausado
  synth.speak(utterance)
}

/**
 * Habla un texto en el idioma/es-MX con la voz del género indicado, esperando a que las voces estén listas si hace falta.
 * Si las voces ya están cargadas, emite inmediato; si no, escucha `voiceschanged` una vez y reintenta con timeout de 1s.
 * @param texto - Texto a hablar.
 * @param type - Tipo de voz, default `'female'`.
 * @example
 * hablar('Solicitud registrada con éxito', 'female')
 */
export function hablar(texto: string, type: VoiceType = 'female'): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  // Asegurar precarga solo la primera vez
  if (!vocesPrecargadas) {
    vocesPrecargadas = true
    precargarVoces()
  }
  const synth = window.speechSynthesis
  if (vocesCargadas || (synth.getVoices?.() ?? []).length > 0) {
    emitir(texto, type)
    return
  }
  // Voces aún no disponibles: hablar cuando carguen (una sola vez)
  const retry = () => {
    if ((synth.getVoices?.() ?? []).length === 0) return
    emitir(texto, type)
  }
  synth.addEventListener('voiceschanged', retry, { once: true })
  setTimeout(() => {
    synth.removeEventListener('voiceschanged', retry)
    if (!synth.speaking) emitir(texto, type) // fallback: emitir aunque no haya evento, si no está hablando
  }, 1000)
}

// ---------------------------------------------------------------------------
// Tipos y helpers de SpeechRecognition (STT)
// ---------------------------------------------------------------------------

/** Resultado de un segmento reconocido por STT. */
export interface ResultadoVoz {
  /** Texto transcripto del segmento. */
  transcript: string
  /** `true` si el resultado es final (no interim/provisional). */
  final: boolean
}

/**
 * Evento compatible con `SpeechRecognitionEvent` (tipado laxo para soportar vendors).
 * Contiene `results` como array-like de alternativas, cada una con `isFinal` y transcripts.
 */
interface SpeechRecognitionEventLike {
  resultIndex?: number
  results: {
    length: number
    [index: number]: {
      isFinal?: boolean
      length: number
      [i: number]: { transcript: string }
    }
  }
}

/**
 * Interfaz mínima de `SpeechRecognition` que la app necesita (compatible con `webkitSpeechRecognition`).
 */
export interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: ((e: unknown) => void) | null
  onend: (() => void) | null
  onstart?: (() => void) | null
  onaudiostart?: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

/** Constructor de `SpeechRecognitionLike` (para tipar `window.SpeechRecognition`). */
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

/**
 * Crea una instancia de reconocimiento de voz continua en `es-MX` si el navegador lo soporta.
 * @returns Instancia configurada (`continuous=true`, `interimResults=true`, `maxAlternatives=1`, `lang=es-MX`) o `null` si no hay API.
 * @example
 * const rec = crearReconocedor()
 * if (rec) { rec.onresult = (e) => console.log(transcribirTodo(e)); rec.start() }
 */
export function crearReconocedor(): SpeechRecognitionLike | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition
  if (!Ctor) return null
  const rec = new Ctor()
  rec.lang = 'es-MX'
  rec.interimResults = true  // recibir provisionales para feedback en tiempo real
  rec.continuous = true      // no cortar tras una frase
  rec.maxAlternatives = 1
  return rec
}

/**
 * Concatena todos los resultados de un evento STT en un solo string, fusionando con `fusionarTranscripcion`.
 * Útil para obtener el transcript acumulado del evento.
 * @param e - Evento `SpeechRecognitionEventLike`.
 * @returns Texto concatenado y trimmeado.
 */
export function transcribirTodo(e: SpeechRecognitionEventLike): string {
  let out = ''
  for (let i = 0; i < e.results.length; i++) {
    const t = e.results[i][0]?.transcript ?? ''
    if (t) out = fusionarTranscripcion(out, t)
  }
  return out.trim()
}

/**
 * Obtiene solo el transcript del último resultado del evento (el más reciente).
 * @param e - Evento STT.
 * @returns Transcript del último índice o `''` si no hay resultados.
 */
export function ultimoTranscripcion(e: SpeechRecognitionEventLike): string {
  const n = e.results.length
  if (!n) return ''
  return e.results[n - 1][0]?.transcript ?? ''
}

/**
 * Fusiona dos transcripciones evitando duplicación por solapamiento.
 * El STT a veces re-emite el mismo segmento con más contexto; esta función detecta:
 * - igualdad exacta / inclusión (`previo` contiene `nuevo` o viceversa) → evita duplicar.
 * - solapamiento de sufijo/prefijo de ≥3 chars → empalma sin repetir.
 * Si no hay solapamiento, concatena con espacio.
 * @param previo - Texto acumulado hasta ahora.
 * @param nuevo - Nuevo segmento a incorporar.
 * @returns Texto fusionado.
 * @example
 * fusionarTranscripcion('hola mundo', 'mundo cruel') // → "hola mundo cruel" (solapa "mundo")
 */
export function fusionarTranscripcion(previo: string, nuevo: string): string {
  const previoT = previo.trim().toLowerCase()
  const nuevoT = nuevo.trim().toLowerCase()
  if (!nuevoT) return previo
  if (!previoT) return nuevo
  if (previoT === nuevoT) return previo
  if (previoT.includes(nuevoT)) return previo
  if (nuevoT.includes(previoT)) return nuevo

  const limpiar = (s: string): string => s.trim().replace(/\s+/g, ' ')
  const p = limpiar(previo)
  const n = limpiar(nuevo)
  const pMin = p.toLowerCase()
  const nMin = n.toLowerCase()

  // Buscar el mayor sufijo de `p` que sea prefijo de `n` (empalme sin duplicar)
  const k = Math.min(pMin.length, nMin.length)
  for (let i = k; i >= Math.min(3, k); i--) {
    if (nMin.startsWith(pMin.slice(-i))) return p + n.slice(i)
  }
  // Y viceversa (nuevo contiene inicio de previo) — caso menos común pero posible en interim
  for (let i = k; i >= Math.min(3, k); i--) {
    if (pMin.startsWith(nMin.slice(-i))) return n + p.slice(i)
  }
  return `${p} ${n}`
}
