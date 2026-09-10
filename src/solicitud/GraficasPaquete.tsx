/**
 * @file GraficasPaquete.tsx
 * @description Analítica de un paquete de fichas: 8 gráficas abajo de las
 * fichas (recibidos, enviados y respuestas usan el mismo bloque).
 * 1) Fichas por colonia · 2) Beneficiarios por obra (fórmula de la ficha:
 * Math.round((largo/6)*2*4.5) con largo = distancia_tramo_m) · 3) Iglesias
 * por obra · 4) Escuelas por obra · 5) Transportes por obra · 6) Zona ZAP
 * (dona) · 7) Cobertura de agua (dona) · 8) Fichas por prioridad
 * (Alta ≥15, Media-alta 12, Media 10, Baja resto).
 * Reutiliza MonobarChart (barras) + Dona propia en SVG (binarias).
 */
import MonobarChart from '../shared/MonobarChart'
import type { Solicitud } from '../types/solicitud'

/** Etiqueta corta: folio o #id si no hay folio. */
function etiqueta(s: Solicitud): string {
  return s.folio_unico || `#${s.id_solicitud ?? '?'}` 
}

/** Beneficiarios estimados (misma fórmula que la ficha técnica). */
function beneficiarios(s: Solicitud): number {
  const largo = s.distancia_tramo_m ?? 0
  return Math.round((largo / 6) * 2 * 4.5)
}

/** Nivel de prioridad por peso (misma escala que banners y pines). */
function nivelPrioridad(peso?: number | null): 'Alta' | 'Media-alta' | 'Media' | 'Baja' {
  if (peso != null && peso >= 15) return 'Alta'
  if (peso === 12) return 'Media-alta'
  if (peso === 10) return 'Media'
  return 'Baja'
}

/** Dona SVG binaria con leyenda (para ZAP y agua). */
function Dona({ datos, total }: { datos: { label: string; value: number; color: string }[]; total: number }) {
  const R = 56
  const C = 2 * Math.PI * R
  let acc = 0
  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0">
        <svg width="140" height="140" viewBox="0 0 140 140">
          <circle cx="70" cy="70" r={R} fill="none" stroke="#f0ebe2" strokeWidth="20" />
          {datos.map((d) => {
            const frac = total > 0 ? d.value / total : 0
            const el = (
              <circle
                key={d.label}
                cx="70"
                cy="70"
                r={R}
                fill="none"
                stroke={d.color}
                strokeWidth="20"
                strokeDasharray={`${frac * C} ${C}`}
                strokeDashoffset={-acc * C}
                strokeLinecap="butt"
                transform="rotate(-90 70 70)"
              />
            )
            acc += frac
            return el
          })}
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xl font-extrabold text-gray-institutional">
          {total}
        </span>
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        {datos.map((d) => (
          <span key={d.label} className="flex items-center gap-2 text-xs text-gray-institutional">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: d.color }} />
            <span className="truncate font-medium">{d.label}</span>
            <span className="font-bold">{d.value}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

/** Tarjeta contenedora de cada gráfica. */
function Card({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card">
      <h3 className="mb-1 text-sm font-bold text-guinda">{titulo}</h3>
      {children}
    </section>
  )
}

/** Las 8 gráficas del paquete (null si no hay fichas). */
export default function GraficasPaquete({ solicitudes }: { solicitudes: Solicitud[] }) {
  if (solicitudes.length === 0) return null

  // 1) Colonias representadas.
  const porColonia = new Map<string, number>()
  for (const s of solicitudes) {
    const c = (s.colonia || 'Sin colonia').trim() || 'Sin colonia'
    porColonia.set(c, (porColonia.get(c) ?? 0) + 1)
  }

  // 2) Beneficiarios por obra + total.
  const benes = solicitudes.map((s) => ({ name: etiqueta(s), value: beneficiarios(s) }))
  const totalBenes = benes.reduce((a, b) => a + b.value, 0)

  // 3-5) Entorno por obra (conteos > 0; el resto se resume en el footer).
  const cuenta = (arr?: string[] | null) => (arr ?? []).length
  const topEntorno = (get: (s: Solicitud) => number) =>
    solicitudes
      .map((s) => ({ name: etiqueta(s), value: get(s) }))
      .filter((d) => d.value > 0)
  const igl = topEntorno((s) => cuenta(s.iglesias_cercanas))
  const esc = topEntorno((s) => cuenta(s.escuelas_cercanas))
  const tra = topEntorno((s) => cuenta(s.transportes_cercanos))

  // 6-7) Binarias.
  const zapSi = solicitudes.filter((s) => !!s.zona_zap).length
  const aguaSi = solicitudes.filter((s) => !!s.cobertura_agua).length

  // 8) Prioridad por nivel + folio(s) de mayor peso.
  const porNivel = new Map<string, number>()
  let maxPeso = -Infinity
  for (const s of solicitudes) {
    const n = nivelPrioridad(s.peso_ranking)
    porNivel.set(n, (porNivel.get(n) ?? 0) + 1)
    if (s.peso_ranking != null && s.peso_ranking > maxPeso) maxPeso = s.peso_ranking
  }
  const topFolios = maxPeso > -Infinity
    ? solicitudes.filter((s) => s.peso_ranking === maxPeso).map(etiqueta)
    : []
  const colorNivel = (name: string) =>
    name === 'Alta' ? '#7D2447' : name === 'Media-alta' ? '#C9B48A' : name === 'Media' ? '#41504D' : '#9AA0A6'

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Card titulo="1 · Fichas por colonia">
        <MonobarChart
          data={[...porColonia].map(([name, value]) => ({ name, value }))}
          subtitle={`${porColonia.size} colonia(s) en ${solicitudes.length} ficha(s)`}
          top={6}
        />
      </Card>
      <Card titulo="2 · Beneficiarios por obra">
        <MonobarChart
          data={benes}
          subtitle={`Estimados con la fórmula de la ficha · Total ${totalBenes.toLocaleString('es-MX')}`}
          top={8}
          footer={<p className="mt-2 text-xs font-bold text-guinda">Total: {totalBenes.toLocaleString('es-MX')} personas</p>}
        />
      </Card>
      <Card titulo="3 · Iglesias por obra">
        {igl.length > 0 ? (
          <MonobarChart
            data={igl}
            subtitle="Obras con iglesias registradas cerca"
            top={8}
            footer={igl.length < solicitudes.length ? (
              <p className="mt-2 text-[11px] text-gray-institutional/55">{solicitudes.length - igl.length} sin iglesias registradas</p>
            ) : undefined}
          />
        ) : (
          <p className="py-6 text-center text-xs text-gray-institutional/50">Sin iglesias registradas en estas fichas</p>
        )}
      </Card>
      <Card titulo="4 · Escuelas por obra">
        {esc.length > 0 ? (
          <MonobarChart
            data={esc}
            subtitle="Obras con escuelas registradas cerca"
            top={8}
            footer={esc.length < solicitudes.length ? (
              <p className="mt-2 text-[11px] text-gray-institutional/55">{solicitudes.length - esc.length} sin escuelas registradas</p>
            ) : undefined}
          />
        ) : (
          <p className="py-6 text-center text-xs text-gray-institutional/50">Sin escuelas registradas en estas fichas</p>
        )}
      </Card>
      <Card titulo="5 · Transportes por obra">
        {tra.length > 0 ? (
          <MonobarChart
            data={tra}
            subtitle="Obras con transporte registrado cerca"
            top={8}
            footer={tra.length < solicitudes.length ? (
              <p className="mt-2 text-[11px] text-gray-institutional/55">{solicitudes.length - tra.length} sin transporte registrado</p>
            ) : undefined}
          />
        ) : (
          <p className="py-6 text-center text-xs text-gray-institutional/50">Sin transporte registrado en estas fichas</p>
        )}
      </Card>
      <Card titulo="6 · Zona ZAP">
        <Dona
          total={solicitudes.length}
          datos={[
            { label: 'En ZAP', value: zapSi, color: '#7D2447' },
            { label: 'Fuera de ZAP', value: solicitudes.length - zapSi, color: '#DBC6B3' },
          ]}
        />
      </Card>
      <Card titulo="7 · Cobertura de agua">
        <Dona
          total={solicitudes.length}
          datos={[
            { label: 'Con agua', value: aguaSi, color: '#41504D' },
            { label: 'Sin agua', value: solicitudes.length - aguaSi, color: '#DBC6B3' },
          ]}
        />
      </Card>
      <Card titulo="8 · Fichas por prioridad">
        <MonobarChart
          data={[...porNivel].map(([name, value]) => ({ name, value }))}
          subtitle="Alta ≥15 · Media-alta 12 · Media 10 · Baja resto"
          top={4}
          getColor={(d) => colorNivel(d.name)}
          footer={topFolios.length > 0 ? (
            <p className="mt-2 text-xs text-gray-institutional/70">
              Mayor prioridad: <span className="font-bold text-guinda">{topFolios.join(', ')}</span> (peso {maxPeso})
            </p>
          ) : undefined}
        />
      </Card>
    </div>
  )
}
