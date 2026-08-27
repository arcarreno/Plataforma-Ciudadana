/**
 * @file useTalkBack.ts
 * @description
 * Hook de accesibilidad TalkBack que verbaliza contenido al hacer clic,
 * usando Web Speech API (`speechSynthesis`). Soporta habilitar/deshabilitar
 * globalmente, selección de voz femenina/masculina y lectura de
 * `aria-label`/`alt`/`title` antes que `textContent`.
 * Se integra con `lib/speech` (`findVoice`) y el tema (`VoiceType`).
 *
 * Dependencias:
 * - React (`useEffect`, `useRef`, `useCallback`)
 * - `VoiceType` de `../core/theme`
 * - `findVoice` de `../lib/speech` (selección de voz en español)
 *
 * Uso:
 * ```tsx
 * const { speak, speakElement } = useTalkBack(accesibilidad.talkBack, voz)
 * speak("Solicitud creada correctamente")
 * ```
 */

import { useEffect, useRef, useCallback } from 'react'
import type { VoiceType } from '../core/theme'
import { findVoice } from '../lib/speech'

/**
 * Hook que provee funcionalidad TalkBack (texto a voz) con control de habilitación y voz.
 * @param enabled - Si es `false`, no verbaliza y cancela cualquier utterance en curso.
 * @param voiceType - Preferencia de voz ('female' | 'male') usada por `findVoice`.
 * @returns Objeto con `speak` y `speakElement` para verbalizar texto o elementos del DOM.
 */
export function useTalkBack(enabled: boolean, voiceType: VoiceType) {
  // Referencia al utterance actual para posible control futuro (no se expone, solo se guarda).
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  /**
   * Verbaliza un texto arbitrario con la voz configurada.
   * Cancela cualquier síntesis previa antes de hablar (evita solapamiento).
   * @param text - Texto a verbalizar en español de México.
   */
  const speak = useCallback(
    (text: string) => {
      // Si TalkBack está deshabilitado o no hay API, no hace nada (fail-safe).
      if (!enabled || !window.speechSynthesis) return
      // Detiene lo que esté sonando para dar prioridad al nuevo mensaje.
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'es-MX' // Idioma mexicano para mejor pronunciación local
      utterance.rate = 0.9 // Ligeramente más lento para claridad en accesibilidad
      utterance.pitch = 1 // Tono natural
      const voice = findVoice(voiceType) // Busca voz femenina/masculina en español
      if (voice) utterance.voice = voice
      utteranceRef.current = utterance
      window.speechSynthesis.speak(utterance)
    },
    [enabled, voiceType],
  )

  /**
   * Verbaliza el contenido accesible de un elemento del DOM.
   * Prioriza atributos accesibles (`aria-label` > `alt` > `title`) sobre `textContent`.
   * @param el - Elemento objetivo (puede ser null si el evento no tiene target).
   */
  const speakElement = useCallback(
    (el: EventTarget | null) => {
      // Validaciones: habilitado, elemento existe y es un Element del DOM.
      if (!enabled || !el || !(el instanceof Element)) return

      // Intenta leer etiqueta accesible explícita primero (mejor para lectores de pantalla).
      const ariaLabel =
        el.getAttribute('aria-label') ||
        el.getAttribute('alt') ||
        el.getAttribute('title')

      if (ariaLabel) {
        speak(ariaLabel)
        return
      }

      // Fallback: texto visible del elemento (trim para evitar leer espacios).
      const text = el.textContent?.trim()
      if (text) speak(text)
    },
    [enabled, speak],
  )

  /**
   * Efecto que registra un listener global de `click` para TalkBack automático.
   * Cuando `enabled` es true, cada clic en elemento interactivo verbaliza su etiqueta.
   * Limpia el listener y cancela síntesis al desmontar o deshabilitar.
   */
  useEffect(() => {
    // Si se deshabilita, detiene cualquier voz en curso y no registra listener.
    if (!enabled) {
      window.speechSynthesis?.cancel()
      return
    }

    /** Handler de clic global que detecta el elemento interactivo más cercano. */
    const handler = (e: MouseEvent) => {
      const target = e.target as Element | null
      if (!target) return

      // Busca ancestro interactivo (botón, enlace, input, etc.) para leer su etiqueta completa.
      const interactive = target.closest('button, a, input, select, textarea, [role="button"]')
      if (interactive) {
        const label =
          interactive.getAttribute('aria-label') ||
          interactive.getAttribute('title') ||
          interactive.textContent?.trim()
        if (label) speak(label)
      } else {
        // Si no es interactivo, intenta leer el elemento clickeado directamente.
        speakElement(target)
      }
    }

    // Registra listener a nivel document para capturar todos los clics.
    document.addEventListener('click', handler)
    return () => {
      // Limpieza: remueve listener y detiene voz al salir del modo TalkBack o desmontar.
      document.removeEventListener('click', handler)
      window.speechSynthesis?.cancel()
    }
  }, [enabled, speak, speakElement])

  // Expone funciones para uso manual (ej. anunciar "Solicitud guardada" programáticamente).
  return { speak, speakElement }
}
