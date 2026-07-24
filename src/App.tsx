import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './shared/Layout'
import Inicio from './pages/Inicio'
import NuevaSolicitud from './pages/NuevaSolicitud'
import ConsultarFolio from './pages/ConsultarFolio'
import AdminDashboard from './pages/AdminDashboard'
import GestionUsuarios from './pages/GestionUsuarios'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Inicio />} />
            <Route path="/nueva-solicitud" element={<NuevaSolicitud />} />
            <Route path="/consultar-folio" element={<ConsultarFolio />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/usuarios" element={<GestionUsuarios />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
