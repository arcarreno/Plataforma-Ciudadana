import { useEffect, useRef, useCallback } from 'react'
import type { VoiceType } from '../core/theme'

const femaleNames = ['maria', 'sofia', 'paulina', 'helena', 'lucia', 'valentina', 'camila', 'isabella', 'gabriela', 'alejandra', 'fernanda', 'ximena', 'renata', 'victoria', 'diana', 'julia', 'monica', 'ana', 'carmen', 'rosa', 'laura', 'martha', 'silvia', 'patricia', 'claudia', 'veronica', 'beatriz', 'elena', 'adriana', 'teresa']
const maleNames = ['miguel', 'jorge', 'raul', 'pablo', 'carlos', 'juan', 'david', 'jose', 'antonio', 'luis', 'javier', 'alejandro', 'manuel', 'fernando', 'pedro', 'diego', 'ricardo', 'daniel', 'rodrigo', 'andres']

function findVoice(type: VoiceType): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices() ?? []
  const spanish = voices.filter((v) => v.lang.startsWith('es'))
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
  } else if (type === 'male') {
    for (const v of spanish) {
      if (isMale(lower(v.name))) return v
    }
    const ms = spanish.find((v) => lower(v.name).includes('microsoft') && !isFemale(lower(v.name)))
    if (ms) return ms
  }

  return spanish[0] ?? null
}

export function useTalkBack(enabled: boolean, voiceType: VoiceType) {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const speak = useCallback(
    (text: string) => {
      if (!enabled || !window.speechSynthesis) return
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'es-MX'
      utterance.rate = 0.9
      utterance.pitch = 1
      const voice = findVoice(voiceType)
      if (voice) utterance.voice = voice
      utteranceRef.current = utterance
      window.speechSynthesis.speak(utterance)
    },
    [enabled, voiceType]
  )

  const speakElement = useCallback(
    (el: EventTarget | null) => {
      if (!enabled || !el || !(el instanceof Element)) return

      const ariaLabel =
        el.getAttribute('aria-label') ||
        el.getAttribute('alt') ||
        el.getAttribute('title')

      if (ariaLabel) {
        speak(ariaLabel)
        return
      }

      const text = el.textContent?.trim()
      if (text) speak(text)
    },
    [enabled, speak]
  )

  useEffect(() => {
    if (!enabled) {
      window.speechSynthesis?.cancel()
      return
    }

    const handler = (e: MouseEvent) => {
      const target = e.target as Element | null
      if (!target) return

      const interactive = target.closest('button, a, input, select, textarea, [role="button"]')
      if (interactive) {
        const label =
          interactive.getAttribute('aria-label') ||
          interactive.getAttribute('title') ||
          interactive.textContent?.trim()
        if (label) speak(label)
      } else {
        speakElement(target)
      }
    }

    document.addEventListener('click', handler)
    return () => {
      document.removeEventListener('click', handler)
      window.speechSynthesis?.cancel()
    }
  }, [enabled, speak, speakElement])

  return { speak, speakElement }
}
