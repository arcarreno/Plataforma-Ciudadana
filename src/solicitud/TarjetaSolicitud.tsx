import type { Solicitud } from '../types/solicitud'

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

export default function TarjetaSolicitud({ solicitud }: { solicitud: Solicitud }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-alabaster/50 p-4 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium text-guinda">Folio</span>
        <span className="font-bold text-guinda">{solicitud.folio_unico}</span>
      </div>
      <div className="h-px bg-alabaster-dark" />
      <div className="flex justify-between">
        <span className="text-gray-institutional/60">Solicitante</span>
        <span className="text-gray-institutional">{solicitud.nombre_solicitante}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-institutional/60">Tipo de obra</span>
        <span className="text-gray-institutional">{solicitud.tipo_solicitud}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-institutional/60">Colonia</span>
        <span className="text-gray-institutional">{solicitud.colonia}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-institutional/60">Estatus</span>
        <FormatoEstatus estatus={solicitud.estatus_fase} />
      </div>
      <div className="flex justify-between">
        <span className="text-gray-institutional/60">Fecha</span>
        <span className="text-gray-institutional">
          {new Date(solicitud.fecha_creacion ?? '').toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </span>
      </div>
    </div>
  )
}