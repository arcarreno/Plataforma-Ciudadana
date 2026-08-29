/**
 * @file ConsentModals.tsx
 * @description Modales de consentimiento por pasos (cookies → términos) con header guinda y logo.
 * Se muestra solo la primera vez que el usuario visita la plataforma (sin sesión previa).
 * - Paso 1: Aviso de cookies (obligatorio para continuar)
 * - Paso 2: Términos y condiciones (obligatorio para continuar)
 * Guarda la respuesta en localStorage (persistente) y respeta el flujo móvil:
 *   móvil: primero ModalPrecarga (mapas) → luego cookies → luego términos
 *   desktop: directo cookies → términos (sin precarga de mapas)
 * Usa createPortal a document.body, overlay fijo y stepper visual.
 */

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Cookie, FileText, Check } from 'lucide-react'
import logoSemovinfra from '../assets/Logo_Semovinfra.jpg'

/** Claves de persistencia en localStorage */
const COOKIES_KEY = 'semovinfra_cookies_aceptadas'
const TERMINOS_KEY = 'semovinfra_terminos_aceptados'
/** Clave de sessionStorage del modal de mapas (para ordenar en móvil) */
const MAPA_KEY = 'semovinfra_precarga_datos'

type Paso = 1 | 2

export default function ConsentModals() {
  const [paso, setPaso] = useState<Paso>(1)
  const [visible, setVisible] = useState(false)

  // Decide si debe mostrarse (solo primera vez, y en móvil espera a que termine el modal de mapas)
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Ya aceptó ambos → no mostrar nunca más
    const cookiesOk = localStorage.getItem(COOKIES_KEY) === 'true'
    const terminosOk = localStorage.getItem(TERMINOS_KEY) === 'true'
    if (cookiesOk && terminosOk) return

    const esMovil = !window.matchMedia('(min-width: 768px)').matches

    // Si no hay cookies aceptadas, empezamos en paso 1, si ya aceptó cookies pero no términos, paso 2
    if (cookiesOk && !terminosOk) setPaso(2)
    else setPaso(1)

    // En móvil, espera a que el modal de mapas termine (sessionStorage con ok/skip)
    if (esMovil) {
      const mapaListo = sessionStorage.getItem(MAPA_KEY) !== null
      if (!mapaListo) {
        // Espera polling cada 600ms hasta que el usuario cierre el modal de mapas
        const id = window.setInterval(() => {
          if (sessionStorage.getItem(MAPA_KEY) !== null) {
            window.clearInterval(id)
            setVisible(true)
          }
        }, 600)
        // Limpieza si se desmonta
        return () => window.clearInterval(id)
      }
    }

    // Desktop o móvil con mapa ya listo → muestra inmediato
    setVisible(true)
  }, [])

  const aceptarCookies = () => {
    localStorage.setItem(COOKIES_KEY, 'true')
    setPaso(2)
  }

  const aceptarTerminos = () => {
    localStorage.setItem(TERMINOS_KEY, 'true')
    setVisible(false)
  }

  // Bloquea el scroll del fondo (Inicio) mientras el modal está visible
  useEffect(() => {
    if (!visible) return
    const prevBody = document.body.style.overflow
    const prevHtml = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevBody
      document.documentElement.style.overflow = prevHtml
    }
  }, [visible])

  if (!visible) return null

  const esPaso1 = paso === 1

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
        {/* Header guinda con logo */}
        <div className="flex items-center gap-3 bg-guinda px-6 py-4">
          <img
            src={logoSemovinfra}
            alt="SEMOVINFRA"
            className="h-10 w-10 rounded-full bg-white object-cover p-0.5"
          />
          <div className="flex flex-col">
            <h2 className="text-sm font-bold tracking-wide text-white">
              {esPaso1 ? 'Aviso de Cookies' : 'Términos y Condiciones'}
            </h2>
            <span className="text-xs text-white/80">Paso {paso} de 2</span>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className={`h-2 w-6 rounded-full transition-colors ${esPaso1 ? 'bg-white' : 'bg-white/40'}`} />
            <span className={`h-2 w-6 rounded-full transition-colors ${!esPaso1 ? 'bg-white' : 'bg-white/40'}`} />
          </div>
        </div>

        {/* Contenido scrolleable — scroll interno con indicador oculto */}
        <div className="max-h-[60vh] overflow-y-auto px-6 py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {esPaso1 ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-guinda">
                <Cookie className="h-5 w-5" />
                <h3 className="text-sm font-semibold">Uso de cookies</h3>
              </div>
              <p className="text-sm leading-relaxed text-gray-institutional/80">
                Utilizamos cookies propias y de terceros para garantizar el funcionamiento de la plataforma,
                recordar tus preferencias (tamaño de letra, contraste), analizar el uso del sitio y mejorar
                la experiencia. Al continuar navegando aceptas su uso conforme a nuestro Aviso de Privacidad.
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-gray-institutional/70">
                <li>
                  <span className="font-medium text-gray-institutional">Necesarias:</span> sesión, seguridad y
                  funcionamiento del mapa.
                </li>
                <li>
                  <span className="font-medium text-gray-institutional">Preferencias:</span> accesibilidad y
                  configuración de la interfaz.
                </li>
                <li>
                  <span className="font-medium text-gray-institutional">Analíticas:</span> métricas anónimas de uso
                  para mejorar el servicio.
                </li>
              </ul>
              <p className="text-xs text-gray-institutional/60">
                Puedes cambiar esta elección borrando el almacenamiento local de tu navegador. Más información en
                nuestro Aviso de Privacidad.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-guinda">
                <FileText className="h-5 w-5" />
                <h3 className="text-sm font-semibold">Términos y Condiciones</h3>
              </div>
              <div className="space-y-3 text-sm leading-relaxed text-gray-institutional/80">
                <p>
                  Al utilizar la Plataforma Ciudadana de SEMOVINFRA aceptas los siguientes términos:
                </p>
                <ol className="list-decimal space-y-2 pl-5">
                  <li>
                    <span className="font-medium text-gray-institutional">Uso legítimo:</span> la información
                    proporcionada (datos personales, ubicación y evidencias) será utilizada exclusivamente
                    para registrar, dar seguimiento y atender tu solicitud de obra pública.
                  </li>
                  <li>
                    <span className="font-medium text-gray-institutional">Veracidad:</span> te comprometes a
                    proporcionar datos veraces y a no suplantar identidad. La falsedad de datos es causa de
                    desechamiento de la solicitud.
                  </li>
                  <li>
                    <span className="font-medium text-gray-institutional">Protección de datos:</span> el
                    Ayuntamiento de Puebla, a través de SEMOVINFRA, resguardará tus datos conforme a la Ley
                    General de Protección de Datos en Posesión de Sujetos Obligados y al Aviso de Privacidad
                    publicado en esta plataforma.
                  </li>
                  <li>
                    <span className="font-medium text-gray-institutional">Seguimiento:</span> se realizará
                    mediante el folio único asignado. Conserva dicho folio para consultas futuras.
                  </li>
                  <li>
                    <span className="font-medium text-gray-institutional">Conductas prohibidas:</span> queda
                    prohibido el uso automatizado (bots, scraping, spam), la sobrecarga deliberada, el envío
                    masivo de solicitudes falsas, el contenido ofensivo o ajeno a obra pública, y cualquier
                    intento de vulnerar la seguridad (inyección SQL/XSS, fuerza bruta, manipulación de
                    peticiones, evasión de controles).
                  </li>
                  <li>
                    <span className="font-medium text-gray-institutional">Medidas por mal uso:</span> ante uso
                    indebido comprobado (ej. datos falsos reiterados, spam o suplantación), SEMOVINFRA podrá
                    suspender temporalmente la CURP asociada para nuevas solicitudes, previo análisis del caso.
                    En casos graves y reiterados, la suspensión podrá ser definitiva, con notificación al
                    titular y derecho a solicitar revisión ante la Unidad de Transparencia.
                  </li>
                  <li>
                    <span className="font-medium text-gray-institutional">Medidas por seguridad:</span> ante
                    intentos de intrusión, hackeo o ataque a la disponibilidad, se podrá bloquear de forma
                    temporal o permanente la dirección IP origen, registrar el evento y, en su caso, dar vista
                    a las autoridades competentes. Al tratarse de IPs dinámicas/compartidas, el bloqueo se
                    aplicará con criterios técnicos proporcionales y con posibilidad de revisión.
                  </li>
                  <li>
                    <span className="font-medium text-gray-institutional">Propiedad y disponibilidad:</span> la
                    plataforma y sus contenidos son de titularidad municipal. El servicio se ofrece sin
                    garantía de disponibilidad ininterrumpida y podrá suspenderse por mantenimiento.
                  </li>
                  <li>
                    <span className="font-medium text-gray-institutional">Actualizaciones:</span> estos términos
                    podrán actualizarse. Se te notificará en tu próxima visita si existen cambios relevantes.
                  </li>
                </ol>
                <p className="text-xs text-gray-institutional/60">
                  Al aceptar, confirmas haber leído y comprendido el Aviso de Privacidad y los presentes
                  Términos y Condiciones. Para solicitar revisión de un bloqueo, acude a la Unidad de
                  Transparencia del Municipio de Puebla.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer con acciones */}
        <div className="flex items-center justify-end gap-3 border-t border-alabaster-dark/30 bg-alabaster/30 px-6 py-4">
          <span className="mr-auto text-xs text-gray-institutional/60">
            {esPaso1 ? 'Paso 1 de 2' : 'Paso 2 de 2'}
          </span>
          {esPaso1 ? (
            <button
              type="button"
              onClick={aceptarCookies}
              className="inline-flex items-center gap-2 rounded-xl bg-guinda px-5 py-2.5 text-sm font-semibold text-white shadow-button transition-colors hover:bg-guinda/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-guinda/50"
            >
              <Check className="h-4 w-4" />
              Aceptar cookies y continuar
            </button>
          ) : (
            <button
              type="button"
              onClick={aceptarTerminos}
              className="inline-flex items-center gap-2 rounded-xl bg-guinda px-5 py-2.5 text-sm font-semibold text-white shadow-button transition-colors hover:bg-guinda/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-guinda/50"
            >
              <Check className="h-4 w-4" />
              Aceptar términos y continuar
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
