import { Camera, MessageSquare } from 'lucide-react'
import type { Solicitud } from '../types/solicitud'
import { urlFotoVisita } from '../lib/api'

export function FormatoEstatus({ estatus }: { estatus?: string }) {
  const color =
    estatus === 'Concluido favorable'
      ? 'bg-green-100 text-green-700'
      : estatus === 'Concluido no favorable'
      ? 'bg-red-100 text-red-700'
      : 'bg-guinda/10 text-guinda'
  return (
    <span className={`rounded-lg px-2 py-0.5 text-xs font-medium ${color}`}>
      {estatus || 'Sin estatus'}
    </span>
  )
}

export default function TarjetaSolicitud({ solicitud: s }: { solicitud: Solicitud }) {
  const fotos = s.visita_fotos ?? []
  const comentario = s.visita_comentarios?.trim()

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-alabaster/50 p-4 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium text-guinda">Folio</span>
        <span className="font-bold text-guinda">{s.folio_unico}</span>
      </div>
      <div className="h-px bg-alabaster-dark" />
      <div className="flex justify-between">
        <span className="text-gray-institutional/60">Solicitante</span>
        <span className="text-gray-institutional">{s.nombre_solicitante}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-institutional/60">Tipo de obra</span>
        <span className="text-gray-institutional">{s.tipo_solicitud}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-institutional/60">Colonia</span>
        <span className="text-gray-institutional">{s.colonia}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-institutional/60">Estatus</span>
        <FormatoEstatus estatus={s.estatus_fase} />
      </div>
      <div className="flex justify-between">
        <span className="text-gray-institutional/60">Fecha</span>
        <span className="text-gray-institutional">
          {new Date(s.fecha_creacion ?? '').toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </span>
      </div>

      {fotos.length > 0 && (
        <>
          <div className="h-px bg-alabaster-dark" />
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-gray-institutional/70">
              <Camera className="h-3.5 w-3.5" />
              Evidencia de la visita ({fotos.length})
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {fotos.map((f, i) => (
                <a
                  key={i}
                  href={urlFotoVisita(f)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-lg border border-alabaster-dark"
                >
                  <img
                    src={urlFotoVisita(f)}
                    alt={`Foto de la visita ${i + 1}`}
                    className="aspect-square w-full object-cover"
                    loading="lazy"
                  />
                </a>
              ))}
            </div>
          </div>
        </>
      )}

      {comentario && (
        <>
          <div className="h-px bg-alabaster-dark" />
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-gray-institutional/70">
              <MessageSquare className="h-3.5 w-3.5" />
              Comentarios de la visita
            </p>
            <p className="whitespace-pre-wrap rounded-lg bg-white/60 px-3 py-2 text-sm text-gray-institutional">
              {comentario}
            </p>
          </div>
        </>
      )}
    </div>
  )
}