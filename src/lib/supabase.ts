/**
 * @file supabase.ts
 * @description
 * Cliente singleton de Supabase para toda la aplicación "Atención Ciudadana" (SEMOVINFRA).
 * Centraliza la creación del cliente `@supabase/supabase-js` y la lectura de credenciales
 * desde variables de entorno Vite.
 *
 * Dependencias:
 * - `@supabase/supabase-js` → `createClient`
 * - `import.meta.env.VITE_SUPABASE_URL` → URL del proyecto Supabase
 * - `import.meta.env.VITE_SUPABASE_ANON_KEY` → anon key (clave pública con RLS)
 *
 * Flujo:
 * 1. Lee `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` del entorno (Vite expone solo `VITE_*`).
 * 2. Si alguna falta, emite `console.warn` para alertar al dev — no rompe el bundle, pero las
 *    llamadas a Supabase fallarán hasta configurar `.env`.
 * 3. Exporta `supabase` como instancia única reutilizable en `backend.ts`, `auth.ts`, `solicitud.ts`, etc.
 *
 * Decisiones de diseño:
 * - Uso de `?? ''` en lugar de `||` para distinguir cadena vacía de `undefined` de forma explícita.
 * - No se lanza excepción si faltan vars: permite que el build pase y que el modo "servidor" funcione
 *   aunque Supabase no esté configurado (útil en desarrollo local sin .env).
 * - Re-exportar una sola instancia evita crear múltiples clientes con distintos estados de auth.
 */
import { createClient } from '@supabase/supabase-js'

/** URL base del proyecto Supabase — viene de `.env` (`VITE_SUPABASE_URL`). Vacío si no está configurado. */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''

/** Anon key pública de Supabase — viene de `.env` (`VITE_SUPABASE_ANON_KEY`). Respeta RLS del lado servidor. */
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

// ---------------------------------------------------------------------------
// Validación temprana de configuración
// ---------------------------------------------------------------------------
// Si falta alguna variable, se avisa en consola. No se hace `throw` para no
// bloquear el arranque cuando el backend local (Express) sí está disponible.
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase no configurado. Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env'
  )
}

/**
 * Instancia singleton del cliente Supabase.
 * Usar directamente: `supabase.from('tabla').select()`, `supabase.rpc(...)`, etc.
 * @example
 * import { supabase } from './supabase'
 * const { data } = await supabase.from('heartbeat_servidor').select('*')
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
