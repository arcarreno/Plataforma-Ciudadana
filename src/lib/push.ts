/**
 * @file push.ts
 * @description Registro Web Push (notificaciones del sistema cuando la app
 * está cerrada). Flujo: registra `/sw.js` → pide permiso → suscribe con la
 * llave VAPID pública (`VITE_VAPID_PUBLIC_KEY`) → envía la suscripción al
 * backend (`POST /api/push/suscripciones`).
 *
 * Todo es best-effort: si no hay llave VAPID, no hay SW, el permiso se niega
 * o el backend aún no expone el endpoint (404), se ignora en silencio y la
 * app sigue con toasts in-app + badges. Llamar una vez por sesión.
 */

import { api } from './api'

/** Llave pública VAPID (base64url); se inyecta en build-time desde el .env. */
const VAPID_PUBLIC_KEY: string | undefined = import.meta.env.VITE_VAPID_PUBLIC_KEY || undefined

/** Convierte base64url a Uint8Array (formato que exige PushManager). */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = window.atob(base64.replace(/-/g, '+').replace(/_/g, '/') + padding)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

/**
 * Registra este navegador para push y lo vincula al usuario del token.
 * @param token - JWT de sesión (el backend vincula la suscripción a ese usuario).
 * @returns true si quedó suscrito, false en cualquier otro caso (sin throw).
 */
export async function registrarPush(token: string): Promise<boolean> {
  try {
    if (!VAPID_PUBLIC_KEY) return false
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
    if (Notification.permission === 'denied') return false
    const reg = await navigator.serviceWorker.register('/sw.js')
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      if (Notification.permission === 'default') {
        const permiso = await Notification.requestPermission()
        if (permiso !== 'granted') return false
      }
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    }
    await api.post(
      '/api/push/suscripciones',
      { suscripcion: sub.toJSON() },
      { headers: { Authorization: `Bearer ${token}` } },
    )
    return true
  } catch {
    // Sin VAPID configurado, sin SW o backend sin el endpoint: push no disponible.
    return false
  }
}

/** Estado del push en este navegador (para el icono de campana). */
export type EstadoPush =
  | 'activas'       // Hay suscripción: llegan con la app cerrada.
  | 'sin-permiso'   // Sin suscripción aún (o permiso sin pedir): se puede activar.
  | 'bloqueadas'    // Permiso denegado: solo se arregla en el navegador.
  | 'no-disponible' // Sin SW/PushManager (ej. iPhone sin agregar a inicio).
  | 'sin-llave'     // Falta VITE_VAPID_PUBLIC_KEY en el deploy.

/**
 * Revisa si este navegador puede recibir push del sistema.
 * No pide permiso ni registra nada; solo diagnostica.
 */
export async function estadoPush(): Promise<EstadoPush> {
  try {
    if (!VAPID_PUBLIC_KEY) return 'sin-llave'
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return 'no-disponible'
    }
    if (Notification.permission === 'denied') return 'bloqueadas'
    const regs = await navigator.serviceWorker.getRegistrations()
    for (const reg of regs) {
      try {
        if (await reg.pushManager.getSubscription()) return 'activas'
      } catch {
        /* sigue buscando en otros registros */
      }
    }
    return 'sin-permiso'
  } catch {
    return 'no-disponible'
  }
}
