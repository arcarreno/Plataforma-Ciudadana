/**
 * @file ModalEnviarGrupoDGPP.tsx
 * @description Modal de confirmación para enviar a DGPP una solicitud que pertenece
 * a un grupo de concentración (peso 12). Pregunta si se mandan todas o solo una
 * en específico, con checklist a la derecha (todas marcadas por defecto).
 *
 * Flujo:
 *  1. `modo=todas` marca todo el grupo; `modo=una` deja solo la actual.
 *     El checklist sigue editable en ambos modos (confirmación explícita).
 *  2. Confirmar llama `onConfirm(ids)` con los IDs marcados; el padre hace el
 *     bulk y actualiza la lista. Cancelar cierra sin cambiar nada (el select de
 *     estatus del detalle revierte solo porque es controlado).
 *
 * @portal `createPortal(..., document.body)` con z-[10003] (encima del detalle).
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Send, Users } from 'lucide-react'
import type { MiembroGrupo } from '../lib/servidor'
import logoSemovinfra from '../assets/Logo_Semovinfra.jpg'

/** Props del modal de envío grupal a DGPP. */
interface ModalEnviarGrupoDGPPProps {
  /** Miembros del grupo (incluye la actual). */
  miembros: MiembroGrupo[]
  /** ID de la solicitud desde la que se abrió (la "actual"). */
  actualId: number
  /** Estatus destino (ej. "Dirección General de Planeación y Proyectos"). */
  destino: string
  /** True mientras el padre ejecuta el bulk. */
  enviando: boolean
  /** Error del bulk (lo muestra el modal). */
  error: string | null
  /** Confirma con los IDs marcados. */
  onConfirm: (ids: number[]) => void
  /** Cierra sin cambios. */
  onCancel: () => void
}

/**
 * Modal con header guinda + logo SEMOVINFRA para enviar un grupo a DGPP.
 */
export default function ModalEnviarGrupoDGPP({
  miembros,
  actualId,
  destino,
  enviando,
  error,
  onConfirm,
  onCancel,
}: ModalEnviarGrupoDGPPProps) {
  /** Modo rápido: todas marcadas o solo la actual. */
  const [modo, setModo] = useState<'todas' | 'una'>('todas')
  /** IDs marcados (por defecto: todos). */
  const [seleccionados, setSeleccionados] = useState<Set<number>>(
    () => new Set(miembros.map(m => m.id_solicitud))
  )

  /** Si cambia el grupo (otra tarjeta), reinicia a todas marcadas. */
  useEffect(() => {
    setModo('todas')
    setSeleccionados(new Set(miembros.map(m => m.id_solicitud)))
  }, [miembros])

  /** Cambia de modo y ajusta los marcados en consecuencia. */
  const elegirModo = (m: 'todas' | 'una') => {
    setModo(m)
    setSeleccionados(
      m === 'todas'
        ? new Set(miembros.map(x => x.id_solicitud))
        : new Set([actualId])
    )
  }

  /** Alterna un miembro en el checklist. */
  const alternar = (id: number) => {
    setSeleccionados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const ids = miembros.map(m => m.id_solicitud).filter(id => seleccionados.has(id))

  return createPortal(
    <div className="fixed inset-0 z-[10003] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header guinda con logo */}
        <div className="flex items-center gap-3 bg-guinda px-6 py-4">
          <img src={logoSemovinfra} alt="SEMOVINFRA" className="h-10 w-10 rounded-full bg-white object-cover p-0.5" />
          <div className="flex flex-col">
            <h2 className="text-sm font-bold tracking-wide text-white">Enviar a DGPP</h2>
            <span className="text-xs text-white/80">Grupo de concentración ({miembros.length})</span>
          </div>
          <Users className="ml-auto h-5 w-5 text-white/80" />
        </div>

        {/* Cuerpo: pregunta + modo a la izquierda, checklist a la derecha */}
        <div className="grid gap-5 px-6 py-5 md:grid-cols-[1fr_1.2fr]">
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-gray-institutional">
              Esta petición es parte de un grupo. ¿Quieres mandar todas o solo una en específico a {destino}?
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => elegirModo('todas')}
                className={`rounded-xl border-2 px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                  modo === 'todas'
                    ? 'border-guinda bg-guinda/5 text-guinda'
                    : 'border-gray-200 text-gray-institutional hover:border-gray-300'
                }`}
              >
                Mandar todas ({miembros.length})
              </button>
              <button
                type="button"
                onClick={() => elegirModo('una')}
                className={`rounded-xl border-2 px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                  modo === 'una'
                    ? 'border-guinda bg-guinda/5 text-guinda'
                    : 'border-gray-200 text-gray-institutional hover:border-gray-300'
                }`}
              >
                Solo una en específico
              </button>
            </div>
            <p className="text-xs text-gray-institutional/60">
              Puedes ajustar la selección en la lista de la derecha antes de confirmar.
            </p>
          </div>

          <div className="flex min-h-0 flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-institutional/60">
              Peticiones a enviar ({ids.length})
            </span>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-100 p-1.5">
              {miembros.map(m => (
                <label
                  key={m.id_solicitud}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-guinda/5 ${
                    m.id_solicitud === actualId ? 'bg-alabaster/40' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={seleccionados.has(m.id_solicitud)}
                    onChange={() => alternar(m.id_solicitud)}
                    className="h-4 w-4 shrink-0 accent-[#7D2447]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-xs font-bold text-guinda">
                      {m.folio_unico}
                      {m.id_solicitud === actualId && (
                        <span className="ml-1 rounded bg-guinda/10 px-1.5 py-0.5 font-sans text-[10px] font-medium">actual</span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-gray-institutional/70">
                      {m.nombre_solicitante || 'Sin nombre'} · {m.estatus_fase}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="px-6 pb-2 text-sm text-red-600">{error}</p>}

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-alabaster-dark/30 bg-alabaster/30 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={enviando}
            className="rounded-xl border-2 border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 disabled:opacity-30"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(ids)}
            disabled={enviando || ids.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-guinda px-5 py-2.5 text-sm font-semibold text-white shadow-button transition-colors hover:bg-guinda/90 disabled:opacity-50"
          >
            {enviando ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {enviando ? 'Enviando…' : `Enviar ${ids.length} a DGPP`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
