interface Props {
  onClose: () => void
}

export default function AvisoPrivacidad({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[85vh] max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-bold text-guinda">Aviso de Privacidad</h2>

        <div className="space-y-4 text-sm leading-relaxed text-gray-institutional/80">
          <section>
            <h3 className="mb-1 font-semibold text-gray-institutional">Responsable</h3>
            <p>
              El Ayuntamiento de Puebla, a través de la Secretaría de Gestión y Desarrollo
              Urbano, es el responsable del tratamiento de sus datos personales. Con domicilio
              en Palacio Municipal, Calle 2 Oriente s/n, Colonia Centro, Puebla, Pue.
            </p>
          </section>

          <section>
            <h3 className="mb-1 font-semibold text-gray-institutional">
              Datos personales recabados
            </h3>
            <p>
              Para la prestación de los servicios de atención ciudadana, recabamos los
              siguientes datos: nombre completo, CURP, teléfono, correo electrónico, ubicación
              geográfica (coordenadas) e información adicional que usted proporcione
              voluntariamente en su solicitud.
            </p>
          </section>

          <section>
            <h3 className="mb-1 font-semibold text-gray-institutional">
              Finalidad del tratamiento
            </h3>
            <p>
              Sus datos serán utilizados para registrar, dar seguimiento y atender su
              solicitud de obra o servicio público, así como para mantener comunicación
              sobre el estado de la misma y generar estadísticas internas que permitan
              mejorar la planeación urbana.
            </p>
          </section>

          <section>
            <h3 className="mb-1 font-semibold text-gray-institutional">
              Protección y seguridad
            </h3>
            <p>
              Implementamos medidas técnicas, administrativas y jurídicas para proteger
              sus datos personales contra daño, pérdida, alteración, destrucción o uso
              no autorizado. Su información se almacena en plataformas seguras con acceso
              restringido únicamente al personal autorizado.
            </p>
          </section>

          <section>
            <h3 className="mb-1 font-semibold text-gray-institutional">
              Transferencia de datos
            </h3>
            <p>
              No compartimos sus datos personales con terceros sin su consentimiento,
              salvo las excepciones previstas por la Ley General de Protección de Datos
              Personales en Posesión de Sujetos Obligados.
            </p>
          </section>

          <section>
            <h3 className="mb-1 font-semibold text-gray-institutional">
              Derechos ARCO
            </h3>
            <p>
              Usted puede ejercer sus derechos de Acceso, Rectificación, Cancelación y
              Oposición al tratamiento de sus datos (ARCO) presentando una solicitud por
              escrito en la Unidad de Transparencia del Municipio de Puebla, o a través
              de los medios electrónicos disponibles en el portal oficial.
            </p>
          </section>

          <section>
            <h3 className="mb-1 font-semibold text-gray-institutional">
              Cambios al aviso
            </h3>
            <p>
              Cualquier modificación a este aviso será publicada en los medios oficiales
              del Ayuntamiento de Puebla. Le recomendamos revisar periódicamente esta
              sección para mantenerse informado.
            </p>
          </section>

          <section>
            <h3 className="mb-1 font-semibold text-gray-institutional">Consentimiento</h3>
            <p>
              Al marcar la casilla correspondiente, usted otorga su consentimiento para
              el tratamiento de sus datos personales conforme a los términos de este
              aviso. Si no está de acuerdo, le informamos que no podremos procesar su
              solicitud.
            </p>
          </section>
        </div>

        <button
          className="mt-6 w-full rounded-xl bg-guinda px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-guinda/90"
          onClick={onClose}
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}
