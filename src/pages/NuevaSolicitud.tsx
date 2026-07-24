import SolicitudForm from '../solicitud/SolicitudForm'

export default function NuevaSolicitud() {
  return (
    <div className="mx-auto max-w-2xl py-4">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-guinda">
        Nueva Solicitud de Obra
      </h1>
      <SolicitudForm />
    </div>
  )
}
