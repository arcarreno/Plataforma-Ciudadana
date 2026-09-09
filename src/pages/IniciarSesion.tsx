/**
 * @file IniciarSesion.tsx
 * @description Pestaña pública de acceso: renderiza `ContenidoAcceso` directo,
 * sin contenedor (card). Si ya hay sesión redirige al panel; al autenticar
 * navega a `/admin` (cada rol ve su vista: peticiones o mis peticiones).
 */
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import ContenidoAcceso from '../shared/ContenidoAcceso'

export default function IniciarSesion() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Con sesión no hay nada que hacer aquí: al panel correspondiente al rol.
  if (user) return <Navigate to="/admin" replace />

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-10">
      <ContenidoAcceso onAutenticado={() => navigate('/admin')} />
    </div>
  )
}
