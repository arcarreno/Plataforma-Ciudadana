import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './shared/Layout'
import ModalPrecarga from './shared/ModalPrecarga'
import Inicio from './pages/Inicio'
import NuevaSolicitud from './pages/NuevaSolicitud'
import ConsultarFolio from './pages/ConsultarFolio'
import Consultar from './pages/Consultar'
import AdminDashboard from './pages/AdminDashboard'
import GestionUsuarios from './pages/GestionUsuarios'

const MapasEstadisticas = lazy(() => import('./pages/MapasEstadisticas'))

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Inicio />} />
            <Route path="/nueva-solicitud" element={<NuevaSolicitud />} />
            <Route path="/consultar-curp" element={<ConsultarFolio />} />
            <Route path="/consultar" element={<Consultar />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/usuarios" element={<GestionUsuarios />} />
            <Route path="/admin/mapas" element={
              <Suspense fallback={
                <div className="flex items-center justify-center py-24">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-guinda border-t-transparent" />
                </div>
              }>
                <MapasEstadisticas />
              </Suspense>
            } />
          </Route>
        </Routes>
        <ModalPrecarga />
      </AuthProvider>
    </BrowserRouter>
  )
}
