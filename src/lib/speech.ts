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
}

export function hablar(texto: string, type: VoiceType = 'female'): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  const synth = window.speechSynthesis
  const decir = () => {
    synth.cancel()
    synth.resume()
    const utterance = new SpeechSynthesisUtterance(texto)
    utterance.lang = 'es-MX'
    utterance.rate = 0.95
    utterance.pitch = 1
    const voice = findVoice(type)
    if (voice) utterance.voice = voice
    if (!vocesCargadas && (synth.getVoices() ?? []).length === 0) {
      synth.addEventListener('voiceschanged', () => {
        const v = findVoice(type)
        if (v) utterance.voice = v
        synth.speak(utterance)
      }, { once: true })
    }
    synth.speak(utterance)
  }
  decir()
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
    if (t && !out.includes(t)) out += (out ? ' ' : '') + t
  }
  return out.trim()
}

export function ultimoTranscripcion(e: SpeechRecognitionEventLike): string {
  const n = e.results.length
  if (!n) return ''
  return e.results[n - 1][0]?.transcript ?? ''
}
