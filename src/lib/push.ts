/**
 * @file push.ts
 * @description Registro Web Push (notificaciones del sistema cuando la app
 * está cerrada). Flujo: registra `/sw.js` → pide permiso → suscribe con la
 * llave VAPID pública (`VITE_VAPID_PUBLIC_KEY`) → envía la suscripción al
 * backend (`POST /api/push/suscripciones`).
 *
 * Todo es best-effort, pero NUNCA silencioso al activar manualmente:
 * `registrarPush` devuelve el motivo exacto para mostrar la solución
 * (permiso cerrado, Brave sin FCM, /sw.js mal servido, backend sin endpoint…).
 */

import { api, ApiError } from './api'

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

/** Causa exacta del resultado de `registrarPush` (para guiar al usuario). */
export type MotivoPush =
  | 'ok'                 // Suscrito y vinculado al usuario.
  | 'sin-llave'          // Falta VITE_VAPID_PUBLIC_KEY en el deploy.
  | 'no-soportado'       // Sin SW/PushManager/Notification en este navegador.
  | 'permiso-denegado'   // El usuario (o el navegador) bloqueó el permiso.
  | 'permiso-cerrado'    // Cerró el aviso sin responder: puede reintentar.
  | 'sw-fallo'           // /sw.js no se registra (mal servido o bloqueado).
  | 'suscripcion-fallo'  // PushManager.subscribe lanzó (Shields, FCM off, iOS…).
  | 'backend-fallo'      // El servidor no aceptó la suscripción.

/** True en iPhone/iPad (el push exige agregar a pantalla de inicio). */
export function esIOS(): boolean {
  try {
    return /iPad|iPhone|iPod/.test(navigator.userAgent)
  } catch {
    return false
  }
}

/** True en Brave (expone navigator.brave.isBrave). */
async function esBrave(): Promise<boolean> {
  try {
    const nav = navigator as Navigator & { brave?: { isBrave?: unknown } }
    const fn = nav.brave?.isBrave
    if (typeof fn !== 'function') return false
    return await (fn as () => Promise<boolean>)()
  } catch {
    return false
  }
}

/**
 * Registra este navegador para push y lo vincula al usuario del token.
 * @param token - JWT de sesión (el backend vincula la suscripción a ese usuario).
 * @returns `{ ok, motivo }`: motivo exacto para mostrar la solución al usuario.
 */
export async function registrarPush(token: string): Promise<{ ok: boolean; motivo: MotivoPush }> {
  if (!VAPID_PUBLIC_KEY) return { ok: false, motivo: 'sin-llave' }
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return { ok: false, motivo: 'no-soportado' }
  }
  if (Notification.permission === 'denied') return { ok: false, motivo: 'permiso-denegado' }

  // 1) Service worker: verifica que /sw.js se sirva como JS (no el index.html del SPA).
  let reg: ServiceWorkerRegistration
  try {
    const probe = await fetch('/sw.js', { method: 'HEAD' })
    const ct = probe.headers.get('content-type') ?? ''
    if (!probe.ok || (!ct.includes('javascript') && !ct.includes('ecmascript'))) {
      return { ok: false, motivo: 'sw-fallo' }
    }
    reg = await navigator.serviceWorker.register('/sw.js')
  } catch {
    return { ok: false, motivo: 'sw-fallo' }
  }

  // 2) Suscripción existente: solo falta vincularla al usuario actual.
  let sub: PushSubscription | null = null
  try {
    sub = await reg.pushManager.getSubscription()
  } catch {
    sub = null
  }

  // 3) Sin suscripción: pide permiso y suscribe.
  if (!sub) {
    if (Notification.permission === 'default') {
      let permiso: NotificationPermission = 'default'
      try {
        permiso = await Notification.requestPermission()
      } catch {
        permiso = 'default'
      }
      if (permiso === 'denied') return { ok: false, motivo: 'permiso-denegado' }
      if (permiso !== 'granted') return { ok: false, motivo: 'permiso-cerrado' }
    }
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    } catch {
      return { ok: false, motivo: 'suscripcion-fallo' }
    }
  }

  // 4) Vincula la suscripción al usuario en el backend.
  try {
    await api.post(
      '/api/push/suscripciones',
      { suscripcion: sub.toJSON() },
      { headers: { Authorization: `Bearer ${token}` } },
    )
  } catch (err) {
    // 404 = backend sin el endpoint (deploy viejo); 401 = sesión inválida.
    if (err instanceof ApiError && err.status === 404) return { ok: false, motivo: 'backend-fallo' }
    return { ok: false, motivo: 'backend-fallo' }
  }
  return { ok: true, motivo: 'ok' }
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
    for (const r of regs) {
      try {
        if (await r.pushManager.getSubscription()) return 'activas'
      } catch {
        /* sigue buscando en otros registros */
      }
    }
    return 'sin-permiso'
  } catch {
    return 'no-disponible'
  }
}

/**
 * Mensaje de solución según el motivo de fallo (con casos Brave e iOS).
 * Para mostrar en el toast cuando falla la activación manual.
 */
export async function ayudaPush(motivo: MotivoPush): Promise<string> {
  const ios = esIOS()
  switch (motivo) {
    case 'ok':
      return 'Notificaciones activadas: te avisaremos aunque cierres la app.'
    case 'sin-llave':
      return 'Falta VITE_VAPID_PUBLIC_KEY en el deploy de Vercel.'
    case 'no-soportado':
      return ios
        ? 'En iPhone: Comparte → Agregar a pantalla de inicio y abre desde el icono.'
        : 'Este navegador no soporta notificaciones push.'
    case 'permiso-denegado':
      return ios
        ? 'Permiso bloqueado: en iPhone agrega el sitio a pantalla de inicio y permite desde el icono.'
        : 'Permiso bloqueado: permite en el candado de la URL (o Ajustes del sitio).'
    case 'permiso-cerrado':
      return 'Cerraste el aviso sin responder: presiona la campana otra vez y elige Permitir.'
    case 'sw-fallo':
      return 'El servidor no entrega /sw.js como worker (revisa rewrites de Vercel).'
    case 'suscripcion-fallo':
      if (ios) return 'En iPhone: Comparte → Agregar a pantalla de inicio y abre desde el icono.'
      if (await esBrave()) {
        return 'Brave bloqueó la suscripción: abre brave://settings/privacy y activa "Usar servicios de Google para mensajería push".'
      }
      return 'El navegador rechazó la suscripción (revisa Shields o extensiones).'
    case 'backend-fallo':
      return 'El servidor aún no acepta suscripciones (/api/push/suscripciones).'
  }
}
