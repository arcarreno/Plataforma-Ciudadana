import Card from '../shared/Card'

export default function ConsultarFolio() {
  return (
    <div className="mx-auto max-w-lg py-4">
      <Card title="Consultar Folio">
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-guinda/10">
            <span className="text-2xl font-bold text-guinda">?</span>
          </div>
          <p className="text-gray-institutional/70">
            La consulta de folio se integrará aquí próximamente.
          </p>
        </div>
      </Card>
    </div>
  )
}
