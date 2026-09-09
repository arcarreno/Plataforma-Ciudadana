/**
 * @file Paquetes.tsx
 * @description Pestaña limpia de paquetes de fichas: recibidos (con badge de
 * nuevo) y enviados. Abrir uno navega a `/paquetes/:id`, donde se ven
 * únicamente esas fichas. Requiere sesión.
 */
import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Inbox, Package, Send } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getToken } from '../lib/auth'
import { paquetesRecibidos, paquetesEnviados, type PaqueteResumen } from '../lib/chat'

/** Formato corto de fecha es-MX. */
function fechaCorta(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

export default function Paquetes() {
  const { user } = useAuth()
  const [tab, setTab] = useState<'recibidos' | 'enviados'>('recibidos')
  const [recibidos, setRecibidos] = useState<PaqueteResumen[]>([])
  const [enviados, setEnviados] = useState<PaqueteResumen[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!user) return
    const token = getToken() ?? undefined
    setCargando(true)
    Promise.all([
      paquetesRecibidos(token).then(
        (r) => r.data ?? [],
        () => [] as PaqueteResumen[],
      ),
      paquetesEnviados(token).then(
        (r) => r.data ?? [],
        () => [] as PaqueteResumen[],
      ),
    ]).then(([rec, env]) => {
      setRecibidos(rec)
      setEnviados(env)
      setCargando(false)
    })
  }, [user])

  if (!user) return <Navigate to="/iniciar-sesion" replace />

  const lista = tab === 'recibidos' ? recibidos : enviados

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="text-xl font-bold text-guinda">Paquetes de fichas</h1>
        <p className="text-sm text-gray-institutional/60">
          Cada paquete muestra únicamente las fichas que te enviaron
        </p>
      </div>

      <div className="flex gap-2">
        {(['recibidos', 'enviados'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              tab === t ? 'bg-guinda text-white shadow-button' : 'bg-white text-gray-institutional hover:bg-guinda/5'
            } border ${tab === t ? 'border-guinda' : 'border-gray-100'}`}
          >
            {t === 'recibidos' ? <Inbox className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            {t === 'recibidos' ? 'Recibidos' : 'Enviados'}
            {t === 'recibidos' && recibidos.some((p) => !p.leido) && (
              <span className="rounded-full bg-white px-1.5 text-[11px] font-bold text-guinda">•</span>
            )}
          </button>
        ))}
      </div>

      {cargando ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-guinda border-t-transparent" />
        </div>
      ) : lista.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-institutional/50">
          {tab === 'recibidos' ? 'Aún no te han enviado paquetes' : 'Aún no has enviado paquetes'}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {lista.map((p) => (
            <Link
              key={p.id}
              to={`/paquetes/${p.id}`}
              className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-guinda/10">
                <Package className="h-5 w-5 text-guinda" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-gray-institutional">
                  Paquete #{p.id} · {p.total} ficha(s)
                </span>
                <span className="block truncate text-xs text-gray-institutional/60">
                  {tab === 'recibidos' ? `De ${p.remitente}` : `Para ${p.destinatario}`} · {fechaCorta(p.fecha)}
                </span>
              </span>
              {tab === 'recibidos' && !p.leido && (
                <span className="shrink-0 rounded-full bg-guinda px-2.5 py-1 text-[10px] font-bold text-white">
                  Nuevo
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
