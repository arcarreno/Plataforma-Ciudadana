/**
 * @file TarjetaSolicitud.tsx
 * @description Tarjeta resumida de una Solicitud para listados de consulta y dashboard.
 *              Muestra folio, solicitante, tipo/colonia, estatus, fecha, fotos de visita y
 *              checklist de campo (luz, drenaje, banquetas, naturaleza).
 *              Los comentarios de visita ya NO se muestran (decisión de producto).
 *
 * Componentes:
 *  - FormatoEstatus: badge con color según estatus (verde Concluido favorable, rojo no favorable,
 *    guinda por defecto).
 *  - TarjetaSolicitud: layout en alabaster/50, divide secciones con h-px, grid 3-4 fotos con
 *    lazy loading y enlaces a urlFotoVisita, checklist con ✓/✗ por rubro.
 *
 * Props: solicitud: Solicitud (tipado en types/solicitud)
 * Helpers: urlFotoVisita (lib/api) resuelve URL absoluta de foto.
 * Uso: Consultar.tsx, ConsultarFolio.tsx, AdminDashboard (grid de cards).
 */
import { Camera, Check, ClipboardCheck, X } from 'lucide-react'
import type { Solicitud } from '../types/solicitud'
import { urlFotoVisita } from '../lib/api'

/** Badge de estatus con color condicional (verde/rojo/guinda). */
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

/** Tarjeta resumida: folio, solicitante, tipo, colonia, estatus, fecha + fotos/checklist de visita. */
export default function TarjetaSolicitud({ solicitud: s }: { solicitud: Solicitud }) {
  const fotos = s.visita_fotos ?? []
  // Checklist de campo (true/false por rubro). Solo se muestra si hubo visita.
  const checklist: { etiqueta: string; valor: boolean }[] = [
    { etiqueta: 'Luz', valor: !!s.visita_check_luz },
    { etiqueta: 'Drenaje', valor: !!s.visita_check_drenaje },
    { etiqueta: 'Banquetas', valor: !!s.visita_check_banquetas },
    { etiqueta: 'Naturaleza (árboles grandes)', valor: !!s.visita_check_naturaleza },
  ]

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

            {/* --- Sección fotos de visita: grid 3-4 con enlaces a urlFotoVisita --- */}
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

            {/* --- Checklist de campo si hubo visita (true/false por rubro) --- */}
{s.visita_id != null && (
        <>
          <div className="h-px bg-alabaster-dark" />
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-gray-institutional/70">
              <ClipboardCheck className="h-3.5 w-3.5" />
              Checklist de la visita
            </p>
            <ul className="grid grid-cols-2 gap-1.5">
              {checklist.map((c) => (
                <li
                  key={c.etiqueta}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium"
                  style={{
                    backgroundColor: c.valor ? '#41504D' : '#f3f0ea',
                    color: c.valor ? '#ffffff' : '#6f1728',
                  }}
                >
                  {c.valor ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                  {c.etiqueta}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}