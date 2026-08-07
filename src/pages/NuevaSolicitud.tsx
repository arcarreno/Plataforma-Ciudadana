import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { nombreCompleto, esCargoPublico } from '../types/auth'
import SolicitudForm from '../solicitud/SolicitudForm'

const MODAL_STORAGE_KEY = 'semovinfra_curp_modal_visto'

export default function NuevaSolicitud() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const esCargo = !!user && esCargoPublico(user.rol)
  const [showModal, setShowModal] = useState(false)
  const iniciarIA = searchParams.get('ia') !== null
  const iaKey = searchParams.get('ia') ?? 'manual'

  useEffect(() => {
    if (!esCargo) return
    const visto = localStorage.getItem(MODAL_STORAGE_KEY)
    if (visto !== 'true') {
      setShowModal(true)
      localStorage.setItem(MODAL_STORAGE_KEY, 'true')
    }
  }, [esCargo])

  return (
    <div className="py-4">
      <h1 className="mb-6 text-center text-2xl font-bold tracking-tight text-guinda">
        Nueva Solicitud de Obra
      </h1>

      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-3 text-lg font-semibold text-gray-institutional">
              Solicitud prioritaria
            </h3>
            <p className="text-sm leading-relaxed text-gray-institutional/70">
              No es necesario que ingreses tu CURP. Al ser una solicitud
              prioritaria, la tendremos en cuenta para tener una respuesta y
              proceder con la obra lo más pronto posible.
            </p>
            <button
              className="mt-4 w-full rounded-xl bg-guinda px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-guinda/90"
              onClick={() => setShowModal(false)}
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      <SolicitudForm
        key={iaKey}
        omitirCurp={esCargo}
        nombrePrefilled={esCargo ? nombreCompleto(user!) : undefined}
        iniciarIA={iniciarIA}
      />
    </div>
  )
}
