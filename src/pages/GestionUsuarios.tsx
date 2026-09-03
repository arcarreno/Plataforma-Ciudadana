/**
 * @file GestionUsuarios.tsx
 * @description CRUD de usuarios internos (solo admin). Lista usuarios, crea nuevos con validación
 *              y elimina con confirmación.
 *
 * Roles: ROL_OPTS con iconos (revisor Shield, admin ShieldCheck, diputado Users, senador User).
 * Flujo:
 *  - Guardia: si !user o rol!=='admin' -> navigate('/admin') y no carga.
 *  - cargarUsuarios(): listarUsuarios() -> setUsuarios o warn. loading spinner.
 *  - Crear: showForm toggle, inputs nombres/apellidos/username/password/rol (botones select).
 *    handleCrear valida campos no vacíos y password >=6, setFormLoading, crearUsuario(user.id,
 *    username, password, rol, nombres, apellidos) -> maneja error, resetea form, cierra y recarga.
 *  - Eliminar: deleteTarget + DeleteConfirmModal, handleEliminar -> eliminarUsuario(user.id,
 *    target.id) -> warn en error, recarga lista. Botón Trash deshabilitado para propio id.
 *  - Tabla: cabeceras Nombre/Usuario/Rol/ID/Acciones; rol badge con color (admin guinda, revisor
 *    azul, otros ámbar) e icono; hover bg gray-50.
 *
 * Endpoints: lib/auth - listarUsuarios, crearUsuario, eliminarUsuario.
 * UI: Card wrapper, Button UserPlus, inputs Tailwind, modal confirm.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { listarUsuarios, crearUsuario, eliminarUsuario } from '../lib/auth'
import type { Usuario } from '../types/auth'
import { UserPlus, Shield, ShieldCheck, User, Users, ArrowLeft, Trash2, Landmark } from 'lucide-react'
import Card from '../shared/Card'
import Button from '../shared/Button'
import DeleteConfirmModal from '../shared/DeleteConfirmModal'

// Opciones de rol con iconos: revisor, admin, diputado, legislador (Congreso local), senador
const ROL_OPTS = [
  { value: 'revisor', label: 'Revisor', icon: Shield },
  { value: 'admin', label: 'Administrador', icon: ShieldCheck },
  { value: 'diputado', label: 'Diputado', icon: Users },
  { value: 'legislador', label: 'Legislador', icon: Landmark },
  { value: 'senador', label: 'Senador', icon: User },
] as const

/** Gestión de usuarios (solo admin): lista, crea con validación y elimina con confirmación. */
export default function GestionUsuarios() {
  const { user } = useAuth()
  const navigate = useNavigate()
  // usuarios lista; loading/showForm + campos new* y formError/loading/delete
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newNombres, setNewNombres] = useState('')
  const [newApellidos, setNewApellidos] = useState('')
  const [newRol, setNewRol] = useState<string>('revisor')
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Usuario | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Guardia admin: si no es admin navega a /admin, sino carga
  useEffect(() => {
    if (!user || user.rol !== 'admin') { navigate('/admin'); return }
    cargarUsuarios()
  }, [user])

    // Carga inicial y refresh tras mutaciones
async function cargarUsuarios() {
    setLoading(true)
    setLoadError('')
    const res = await listarUsuarios()
    if (res.data) {
      setUsuarios(res.data)
    } else if (res.error) {
      setLoadError(res.error)
    }
    setLoading(false)
  }

    // Valida campos + password>=6 y llama crearUsuario(user.id, ...)
const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUsername.trim() || !newPassword.trim() || !newNombres.trim() || !newApellidos.trim()) {
      setFormError('Completa todos los campos')
      return
    }
    if (newPassword.length < 6) {
      setFormError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setFormLoading(true)
    setFormError('')
    const res = await crearUsuario(user!.id, newUsername.trim(), newPassword, newRol, newNombres.trim(), newApellidos.trim())
    if (res.error) {
      setFormError(res.error)
      setFormLoading(false)
      return
    }
    setNewUsername('')
    setNewPassword('')
    setNewNombres('')
    setNewApellidos('')
    setNewRol('revisor')
    setShowForm(false)
    setFormLoading(false)
    cargarUsuarios()
  }

    // Elimina via eliminarUsuario y recarga
const handleEliminar = async () => {
    if (!deleteTarget || !user) return
    setDeleteLoading(true)
    const res = await eliminarUsuario(user.id, deleteTarget.id)
    if (res.error) {
      console.warn('Error al eliminar:', res.error)
      setDeleteLoading(false)
      setDeleteTarget(null)
      return
    }
    setDeleteLoading(false)
    setDeleteTarget(null)
    cargarUsuarios()
  }

  // --- JSX: header con volver + contador + nuevo usuario, form condicional, tabla y modal delete ---
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-institutional transition-colors hover:bg-gray-100 hover:text-guinda"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-guinda">Gestionar usuarios</h1>
            <p className="text-sm text-gray-institutional/60">
              {usuarios.length} usuario(s) registrado(s)
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)} disabled={showForm}>
          <UserPlus className="mr-1.5 h-4 w-4" />
          Nuevo usuario
        </Button>
      </div>

            {/* Form nuevo usuario con grid nombres/apellidos, user/pass y selector de rol */}
  {showForm && (
        <Card title="Nuevo usuario">
          <form onSubmit={handleCrear} className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-institutional">Nombres</label>
                <input
                  type="text"
                  value={newNombres}
                  onChange={e => setNewNombres(e.target.value)}
                  className="rounded-xl border-2 border-alabaster-dark/30 bg-alabaster/30 px-4 py-2.5 text-sm text-gray-institutional outline-none transition-colors focus:border-guinda"
                  placeholder="Nombres"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-institutional">Apellidos</label>
                <input
                  type="text"
                  value={newApellidos}
                  onChange={e => setNewApellidos(e.target.value)}
                  className="rounded-xl border-2 border-alabaster-dark/30 bg-alabaster/30 px-4 py-2.5 text-sm text-gray-institutional outline-none transition-colors focus:border-guinda"
                  placeholder="Apellidos"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-institutional">Usuario</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  className="rounded-xl border-2 border-alabaster-dark/30 bg-alabaster/30 px-4 py-2.5 text-sm text-gray-institutional outline-none transition-colors focus:border-guinda"
                  placeholder="Nombre de usuario"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-institutional">Contraseña</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="rounded-xl border-2 border-alabaster-dark/30 bg-alabaster/30 px-4 py-2.5 text-sm text-gray-institutional outline-none transition-colors focus:border-guinda"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-institutional">Rol</label>
              <div className="flex flex-wrap gap-3">
                {ROL_OPTS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setNewRol(value)}
                    className={`flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition-all ${
                      newRol === value
                        ? 'border-guinda bg-guinda/5 text-guinda'
                        : 'border-alabaster-dark/30 text-gray-institutional/60 hover:border-guinda/30'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {formError && <p className="text-xs text-red-500">{formError}</p>}

            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={formLoading}>
                {formLoading ? 'Creando...' : 'Crear usuario'}
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        {loadError && (
          <p className="mb-3 rounded-xl bg-red-50 px-4 py-2.5 text-xs text-red-600">
            No se pudieron cargar los usuarios: {loadError}
          </p>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-guinda/20 border-t-guinda" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-medium text-gray-institutional/60">
                  <th className="whitespace-nowrap px-3 py-3">Nombre</th>
                  <th className="whitespace-nowrap px-3 py-3">Usuario</th>
                  <th className="whitespace-nowrap px-3 py-3">Rol</th>
                  <th className="whitespace-nowrap px-3 py-3">ID</th>
                  <th className="whitespace-nowrap px-3 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id} className="border-b border-gray-50 transition-colors hover:bg-gray-50">
                    <td className="whitespace-nowrap px-3 py-3 font-medium text-gray-institutional">
                      {u.nombres} {u.apellidos}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-gray-institutional/70">
                      {u.username}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {(() => {
                        const opt = ROL_OPTS.find(o => o.value === u.rol)
                        const Icon = opt?.icon ?? Shield
                        const colorClass = u.rol === 'admin' ? 'bg-guinda/10 text-guinda'
                          : u.rol === 'revisor' ? 'bg-blue-50 text-blue-600'
                          : 'bg-amber-50 text-amber-700'
                        return (
                          <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium ${colorClass}`}>
                            <Icon className="h-3 w-3" />
                            {opt?.label ?? u.rol}
                          </span>
                        )
                      })()}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-gray-institutional/50">
                      #{u.id}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">
                      {u.id !== user?.id && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(u)}
                          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                          title="Eliminar usuario"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        itemName={deleteTarget ? `${deleteTarget.nombres} ${deleteTarget.apellidos}` : ''}
        itemSubtitle={deleteTarget ? `@${deleteTarget.username} · ${ROL_OPTS.find(o => o.value === deleteTarget.rol)?.label}` : ''}
        onConfirm={handleEliminar}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteLoading}
      />
    </div>
  )
}
