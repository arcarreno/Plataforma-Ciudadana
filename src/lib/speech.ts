import type { VoiceType } from '../core/theme'

const femaleNames = ['maria', 'sofia', 'paulina', 'helena', 'lucia', 'valentina', 'camila', 'isabella', 'gabriela', 'alejandra', 'fernanda', 'ximena', 'renata', 'victoria', 'diana', 'julia', 'monica', 'ana', 'carmen', 'rosa', 'laura', 'martha', 'silvia', 'patricia', 'claudia', 'veronica', 'beatriz', 'elena', 'adriana', 'teresa']
const maleNames = ['miguel', 'jorge', 'raul', 'pablo', 'carlos', 'juan', 'david', 'jose', 'antonio', 'luis', 'javier', 'alejandro', 'manuel', 'fernando', 'pedro', 'diego', 'ricardo', 'daniel', 'rodrigo', 'andres']

function isSpanishVoice(v: SpeechSynthesisVoice): boolean {
  return v.lang.toLowerCase().startsWith('es')
}

export function findVoice(type: VoiceType): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices() ?? []
  const spanish = voices.filter(isSpanishVoice)
  if (!spanish.length) return null

  const isFemale = (name: string) => femaleNames.some((fn) => name.includes(fn))
  const isMale = (name: string) => maleNames.some((mn) => name.includes(mn))
  const lower = (s: string) => s.toLowerCase()

  if (type === 'female') {
    for (const v of spanish) {
      if (isFemale(lower(v.name))) return v
    }
    const ms = spanish.find((v) => lower(v.name).includes('microsoft') && !isMale(lower(v.name)))
    if (ms) return ms
  } else {
    for (const v of spanish) {
      if (isMale(lower(v.name))) return v
    }
    const ms = spanish.find((v) => lower(v.name).includes('microsoft') && !isFemale(lower(v.name)))
    if (ms) return ms
  }

  return spanish[0] ?? null
}

let vocesCargadas = false

export function precargarVoces(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  const synth = window.speechSynthesis
  if (vocesCargadas) return
  const escuchar = () => {
    vocesCargadas = (synth.getVoices() ?? []).length > 0
  }
  synth.addEventListener('voiceschanged', escuchar)
  escuchar()
  // Fuerza la carga en navegadores que no disparan el evento solos
  if (!vocesCargadas && typeof synth.getVoices !== 'undefined') {
    void synth.getVoices()
    setTimeout(escuchar, 250)
  }
}

let vocesPrecargadas = false

function vozEsperada(type: VoiceType): SpeechSynthesisVoice | null {
  const v = findVoice(type)
  if (v) return v
  return findVoice('female') ?? null
}

function emitir(texto: string, type: VoiceType): void {
  const synth = window.speechSynthesis
  if (!synth) return
  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(texto)
  utterance.lang = 'es-MX'
  utterance.rate = 0.95
  utterance.pitch = 1
  const voice = vozEsperada(type)
  if (voice) utterance.voice = voice
  synth.resume()
  synth.speak(utterance)
}

export function hablar(texto: string, type: VoiceType = 'female'): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
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
    if (!synth.speaking) emitir(texto, type)
  }, 1000)
}

export interface ResultadoVoz {
  transcript: string
  final: boolean
}

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

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

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
  rec.interimResults = true
  rec.continuous = true
  rec.maxAlternatives = 1
  return rec
}

export function transcribirTodo(e: SpeechRecognitionEventLike): string {
  let out = ''
  for (let i = 0; i < e.results.length; i++) {
    const t = e.results[i][0]?.transcript ?? ''
    if (t) out = fusionarTranscripcion(out, t)
  }
  return out.trim()
}

export function ultimoTranscripcion(e: SpeechRecognitionEventLike): string {
  const n = e.results.length
  if (!n) return ''
  return e.results[n - 1][0]?.transcript ?? ''
}

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

  const k = Math.min(pMin.length, nMin.length)
  for (let i = k; i >= Math.min(3, k); i--) {
    if (nMin.startsWith(pMin.slice(-i))) return p + n.slice(i)
  }
  for (let i = k; i >= Math.min(3, k); i--) {
    if (pMin.startsWith(nMin.slice(-i))) return n + p.slice(i)
  }
  return `${p} ${n}`
}
