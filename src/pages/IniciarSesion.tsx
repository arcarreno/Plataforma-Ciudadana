/**
 * @file IniciarSesion.tsx
 * @description Pestaña pública de acceso: en móvil muestra solo el formulario
 * (`ContenidoAcceso` directo, sin card); en pantallas grandes (lg+) agrega un
 * panel lateral premium con la animación Lottie de construcción.
 * El panel solo se monta en desktop (matchMedia) para no gastar recursos en móvil.
 * Si ya hay sesión redirige al panel; al autenticar navega a `/admin`.
 */
import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import lottie, { type AnimationItem } from 'lottie-web'
import { useAuth } from '../contexts/AuthContext'
import ContenidoAcceso from '../shared/ContenidoAcceso'
import construccionAnimation from '../assets/lottie/construccion.json'

export default function IniciarSesion() {
  const { user } = useAuth()
  const navigate = useNavigate()
  /** True solo en pantallas grandes: ahí se monta el panel con Lottie. */
  const [pantallaGrande, setPantallaGrande] = useState(false)
  /** Contenedor donde Lottie inyecta el SVG animado. */
  const lottieRef = useRef<HTMLDivElement>(null)

  /** Escucha el breakpoint lg para montar/desmontar el panel (ahorra CPU en móvil). */
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const sincronizar = () => setPantallaGrande(mq.matches)
    sincronizar()
    mq.addEventListener('change', sincronizar)
    return () => mq.removeEventListener('change', sincronizar)
  }, [])

  /** Carga la animación de construcción cuando existe el contenedor (solo desktop). */
  useEffect(() => {
    if (!pantallaGrande || !lottieRef.current) return
    const anim: AnimationItem = lottie.loadAnimation({
      container: lottieRef.current,
      animationData: construccionAnimation,
      renderer: 'svg',
      loop: true,
      autoplay: true,
    })
    return () => anim.destroy()
  }, [pantallaGrande])

  // Con sesión no hay nada que hacer aquí: al panel correspondiente al rol.
  if (user) return <Navigate to="/admin" replace />

  return (
    <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-10 lg:grid-cols-2">
      {/* Columna del formulario (igual en todas las pantallas, sin card) */}
      <div className="mx-auto w-full max-w-sm">
        <ContenidoAcceso onAutenticado={() => navigate('/admin')} />
      </div>

      {/* Panel premium con Lottie — solo pantallas grandes */}
      {pantallaGrande && (
        <div className="relative hidden overflow-hidden rounded-3xl bg-gradient-to-br from-guinda via-[#5c1a35] to-[#3d1023] shadow-card lg:block">
          <div ref={lottieRef} className="aspect-video w-full" />
          <div className="flex items-center justify-between gap-4 px-8 pb-7">
            <div>
              <p className="text-lg font-bold tracking-wide text-white">Atención Ciudadana</p>
              <p className="text-xs text-white/70">
                Reporta, consulta y da seguimiento a las obras de tu ciudad
              </p>
              <p className="mt-2 text-[11px] font-semibold tracking-widest text-white/60">
                SECRETARÍA DE MOVILIDAD E INFRAESTRUCTURA
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
