import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './shared/Layout'
import Inicio from './pages/Inicio'
import NuevaSolicitud from './pages/NuevaSolicitud'
import ConsultarFolio from './pages/ConsultarFolio'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Inicio />} />
          <Route path="/nueva-solicitud" element={<NuevaSolicitud />} />
          <Route path="/consultar-folio" element={<ConsultarFolio />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
