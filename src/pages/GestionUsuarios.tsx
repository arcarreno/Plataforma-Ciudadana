import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { listarUsuarios, crearUsuario } from '../lib/auth'
import type { Usuario } from '../types/auth'
import { UserPlus, Shield, ShieldCheck, ArrowLeft } from 'lucide-react'
import Card from '../shared/Card'
import Button from '../shared/Button'

export default function GestionUsuarios() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRol, setNewRol] = useState<'admin' | 'revisor'>('revisor')
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  useEffect(() => {
    if (!user || user.rol !== 'admin') { navigate('/admin'); return }
    cargarUsuarios()
  }, [user])

  async function cargarUsuarios() {
    setLoading(true)
    const res = await listarUsuarios()
    if (res.data) setUsuarios(res.data)
    setLoading(false)
  }

  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUsername.trim() || !newPassword.trim()) {
      setFormError('Completa todos los campos')
      return
    }
    if (newPassword.length < 6) {
      setFormError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setFormLoading(true)
    setFormError('')
    const res = await crearUsuario(user!.id, newUsername.trim(), newPassword, newRol)
    if (res.error) {
      setFormError(res.error)
      setFormLoading(false)
      return
    }
    setNewUsername('')
    setNewPassword('')
    setNewRol('revisor')
    setShowForm(false)
    setFormLoading(false)
    cargarUsuarios()
  }

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

      {showForm && (
        <Card title="Nuevo usuario">
          <form onSubmit={handleCrear} className="flex flex-col gap-4">
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
              <div className="flex gap-3">
                {(['revisor', 'admin'] as const).map(rol => (
                  <button
                    key={rol}
                    type="button"
                    onClick={() => setNewRol(rol)}
                    className={`flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition-all ${
                      newRol === rol
                        ? 'border-guinda bg-guinda/5 text-guinda'
                        : 'border-alabaster-dark/30 text-gray-institutional/60 hover:border-guinda/30'
                    }`}
                  >
                    {rol === 'admin' ? <ShieldCheck className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                    {rol === 'admin' ? 'Administrador' : 'Revisor'}
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
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-guinda/20 border-t-guinda" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-medium text-gray-institutional/60">
                  <th className="whitespace-nowrap px-3 py-3">Usuario</th>
                  <th className="whitespace-nowrap px-3 py-3">Rol</th>
                  <th className="whitespace-nowrap px-3 py-3">ID</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id} className="border-b border-gray-50 transition-colors hover:bg-gray-50">
                    <td className="whitespace-nowrap px-3 py-3 font-medium text-gray-institutional">
                      {u.username}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium ${
                        u.rol === 'admin'
                          ? 'bg-guinda/10 text-guinda'
                          : 'bg-blue-50 text-blue-600'
                      }`}>
                        {u.rol === 'admin' ? <ShieldCheck className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                        {u.rol === 'admin' ? 'Admin' : 'Revisor'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-gray-institutional/50">
                      #{u.id}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
