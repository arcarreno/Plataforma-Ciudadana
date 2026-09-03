/**
 * @file App.tsx
 * @description
 * Componente raíz de la aplicación. Configura el enrutamiento con `react-router-dom`,
 * el proveedor de autenticación (`AuthProvider`), el layout compartido y las páginas.
 * Usa `lazy` + `Suspense` para code-splitting de la ruta pesada de mapas/estadísticas.
 *
 * Dependencias:
 * - `react` (`lazy`, `Suspense` para carga diferida)
 * - `react-router-dom` (`BrowserRouter`, `Routes`, `Route`)
 * - `contexts/AuthContext` (sesión global)
 * - `shared/Layout` y `shared/ModalPrecarga` (estructura y precarga de voces)
 * - Páginas: `Inicio`, `NuevaSolicitud`, `ConsultarFolio`, `Consultar`, `AdminDashboard`, `GestionUsuarios`, `MapasEstadisticas`
 *
 * Estructura de rutas:
 * - `/` → Inicio
 * - `/nueva-solicitud` → Formulario de solicitud
 * - `/consultar-curp` → Consulta por CURP/folio (alias ConsultarFolio)
 * - `/consultar` → Consulta general
 * - `/admin` → Dashboard admin
 * - `/admin/usuarios` → Gestión de usuarios
 * - `/admin/mapas` → Mapas y estadísticas (lazy)
 *
 * Todas las rutas hijas comparten el `Layout` (header, accesibilidad, footer).
 */

import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './shared/Layout'
import ModalPrecarga from './shared/ModalPrecarga'
import Inicio from './pages/Inicio'
import NuevaSolicitud from './pages/NuevaSolicitud'
import ConsultarFolio from './pages/ConsultarFolio'
import Consultar from './pages/Consultar'
import Verificar from './pages/Verificar'
import AdminDashboard from './pages/AdminDashboard'
import GestionUsuarios from './pages/GestionUsuarios'

/**
 * Importación diferida de la página de mapas/estadísticas.
 * Es pesada (Leaflet, heatmap, turf) y no todos los usuarios la visitan,
 * por lo que se separa en un chunk aparte para mejorar el tiempo de carga inicial.
 */
const MapasEstadisticas = lazy(() => import('./pages/MapasEstadisticas'))

/**
 * Componente principal de la app.
 * Envuelve toda la UI en `BrowserRouter` (historial HTML5) y `AuthProvider` (sesión).
 * Define el árbol de rutas y el `Suspense` fallback para la ruta lazy.
 * @returns JSX con providers, rutas y modal de precarga global.
 */
export default function App() {
  return (
    // Provee navegación SPA con URLs limpias (requiere fallback en servidor/Vercel).
    <BrowserRouter>
      {/* Provee `user`, `iniciarSesion`, `cerrarSesion` a toda la app vía contexto. */}
      <AuthProvider>
        <Routes>
          {/* Ruta padre que renderiza `Layout` (header/nav/footer) y outlet para hijas. */}
          <Route element={<Layout />}>
            {/* Página de inicio / landing con acceso a acciones principales. */}
            <Route path="/" element={<Inicio />} />
            {/* Formulario para crear una nueva solicitud ciudadana. */}
            <Route path="/nueva-solicitud" element={<NuevaSolicitud />} />
            {/* Consulta de solicitudes por CURP o folio único. */}
            <Route path="/consultar-curp" element={<ConsultarFolio />} />
            {/* Vista de consulta/listado general de solicitudes. */}
            <Route path="/consultar" element={<Consultar />} />
            {/* Verificación de correo para auto-registro (muestra PasswordSetupModal). */}
            <Route path="/verificar" element={<Verificar />} />
            {/* Panel de administración (requiere rol autorizado). */}
            <Route path="/admin" element={<AdminDashboard />} />
            {/* Gestión de usuarios operadores (solo admin). */}
            <Route path="/admin/usuarios" element={<GestionUsuarios />} />
            {/* Ruta pesada con lazy loading y spinner de fallback mientras carga el chunk. */}
            <Route path="/admin/mapas" element={
              <Suspense fallback={
                // Spinner centrado con colores institucionales mientras se descarga el chunk.
                <div className="flex items-center justify-center py-24">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-guinda border-t-transparent" />
                </div>
              }>
                <MapasEstadisticas />
              </Suspense>
            } />
          </Route>
        </Routes>
        {/* Modal global de precarga (ej. voces TalkBack); se monta fuera de Routes pero dentro de AuthProvider. */}
        <ModalPrecarga />
      </AuthProvider>
    </BrowserRouter>
  )
}
