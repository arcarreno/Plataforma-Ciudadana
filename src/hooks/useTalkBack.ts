import { useEffect, useRef, useCallback } from 'react'

export function useTalkBack(enabled: boolean) {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const speak = useCallback(
    (text: string) => {
      if (!enabled || !window.speechSynthesis) return
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'es-MX'
      utterance.rate = 0.9
      utterance.pitch = 1
      utteranceRef.current = utterance
      window.speechSynthesis.speak(utterance)
    },
    [enabled]
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
