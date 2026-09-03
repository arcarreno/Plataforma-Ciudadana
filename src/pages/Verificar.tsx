/**
 * @file Verificar.tsx
 * @description Ruta `/verificar?token=...` — destino del enlace del correo.
 * Funciona en cualquier dispositivo (el teléfono donde se abrió el correo):
 * 1. Marca el token como verificado (`verificarRegistro`, idempotente).
 * 2. Muestra `PasswordSetupModal` con el nombre del directorio ("Bienvenida
 *    Diputada {nombre}") o con campo de nombre si no está listado.
 * 3. Al completar hace auto-login (`establecerSesion`) y navega al inicio.
 *
 * Estados: cargando, inválido (404), usado/vencido (410) con mensaje y botón
 * para solicitar un enlace nuevo (volver al inicio y registrarse de nuevo).
 */

import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, MailWarning, Loader2 } from 'lucide-react'
import PasswordSetupModal from '../shared/PasswordSetupModal'
import { verificarRegistro, obtenerDirectorio, type RegistroVerificado } from '../lib/registro'
import { useAuth } from '../contexts/AuthContext'

type Estado = 'cargando' | 'listo' | 'error'

export default function Verificar() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { establecerSesion } = useAuth()
  const token = params.get('token') ?? ''

  const [estado, setEstado] = useState<Estado>('cargando')
  const [error, setError] = useState('')
  const [datos, setDatos] = useState<RegistroVerificado | null>(null)
  const [genero, setGenero] = useState<string | undefined>(undefined)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [completado, setCompletado] = useState(false)

  useEffect(() => {
    if (!token) {
      setEstado('error')
      setError('Enlace incompleto: falta el token de verificación.')
      return
    }
    let vivo = true
    ;(async () => {
      const res = await verificarRegistro(token)
      if (!vivo) return
      if (res.error || !res.data) {
        setEstado('error')
        setError(
          res.status === 410
            ? 'Este enlace ya fue usado o venció. Solicita uno nuevo registrándote otra vez.'
            : res.error || 'Enlace no válido.',
        )
        return
      }
      setDatos(res.data)
      setEstado('listo')
      setModalAbierto(true)
      // Género para el saludo (solo legisladores traen el campo; best-effort)
      const tipo = res.data.rol === 'legislador' ? 'legisladores'
        : res.data.rol === 'diputado' ? 'diputados'
        : res.data.rol === 'senador' ? 'senadores' : null
      if (tipo) {
        const dir = await obtenerDirectorio(tipo)
        if (!vivo) return
        const hit = dir.data?.find(
          (e) => String(e.email || '').trim().toLowerCase() === res.data!.email.trim().toLowerCase(),
        )
        const g = hit?.genero
        if (typeof g === 'string') setGenero(g)
      }
    })()
    return () => {
      vivo = false
    }
  }, [token])

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 py-16">
      {estado === 'cargando' && (
        <div className="flex flex-col items-center gap-3 text-gray-institutional">
          <Loader2 className="h-8 w-8 animate-spin text-guinda" />
          <p className="text-sm">Verificando tu correo…</p>
        </div>
      )}

      {estado === 'error' && (
        <div className="flex w-full flex-col items-center gap-3 rounded-2xl bg-white p-8 text-center shadow-card">
          <MailWarning className="h-10 w-10 text-guinda" />
          <h1 className="text-lg font-bold text-guinda">No se pudo verificar</h1>
          <p className="text-sm text-gray-institutional/70">{error}</p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-2 w-full rounded-xl bg-guinda px-6 py-3 text-sm font-medium text-white shadow-button transition-all hover:brightness-110"
          >
            Volver al inicio
          </button>
        </div>
      )}

      {estado === 'listo' && completado && (
        <div className="flex w-full flex-col items-center gap-3 rounded-2xl bg-white p-8 text-center shadow-card">
          <CheckCircle2 className="h-10 w-10 text-[#41504D]" />
          <h1 className="text-lg font-bold text-guinda">¡Cuenta lista!</h1>
          <p className="text-sm text-gray-institutional/70">Tu contraseña se guardó. Redirigiendo…</p>
        </div>
      )}

      {datos && (
        <PasswordSetupModal
          open={modalAbierto}
          token={token}
          email={datos.email}
          rol={datos.rol}
          nombreSugerido={datos.nombre_sugerido}
          enDirectorio={datos.en_directorio}
          genero={genero}
          onDone={(sesion) => {
            establecerSesion(
              {
                id: sesion.id,
                username: sesion.username,
                email: sesion.email,
                rol: sesion.rol as 'admin' | 'revisor' | 'diputado' | 'senador' | 'legislador',
                nombres: sesion.nombres,
                apellidos: sesion.apellidos,
              },
              sesion.token,
            )
            setModalAbierto(false)
            setCompletado(true)
            window.setTimeout(() => navigate('/'), 1200)
          }}
          onUsado={() => {
            setModalAbierto(false)
            setEstado('error')
            setError('Esta cuenta ya completó su registro en otro dispositivo. Inicia sesión.')
          }}
          onClose={() => setModalAbierto(false)}
        />
      )}
    </div>
  )
}
