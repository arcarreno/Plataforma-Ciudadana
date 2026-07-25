-- Ejecutar esto en el SQL Editor de Supabase

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE SEQUENCE IF NOT EXISTS folio_st_seq START 1;

CREATE TABLE solicitudes (
  id_solicitud BIGSERIAL PRIMARY KEY,
  folio_unico TEXT UNIQUE NOT NULL DEFAULT ('ST-' || LPAD(nextval('folio_st_seq')::TEXT, 6, '0')),

  nombre_solicitante TEXT NOT NULL,
  curp TEXT NOT NULL,
  telefono TEXT,
  correo TEXT,
  aviso_privacidad_aceptado BOOLEAN NOT NULL DEFAULT false,

  tipo_solicitud TEXT NOT NULL,
  colonia TEXT NOT NULL,
  junta_auxiliar TEXT NOT NULL,
  ubicacion GEOMETRY(Point, 4326),
  latitud DOUBLE PRECISION NOT NULL,
  longitud DOUBLE PRECISION NOT NULL,

  tramo_lat_ini DOUBLE PRECISION,
  tramo_lng_ini DOUBLE PRECISION,
  tramo_lat_fin DOUBLE PRECISION,
  tramo_lng_fin DOUBLE PRECISION,

  descripcion TEXT,
  rutas_evidencia TEXT[] DEFAULT '{}',

  zona_zap BOOLEAN DEFAULT false,
  cobertura_agua BOOLEAN DEFAULT false,
  escuelas_cercanas TEXT[] DEFAULT '{}',
  iglesias_cercanas TEXT[] DEFAULT '{}',
  transportes_cercanos TEXT[] DEFAULT '{}',
  distancia_tramo_m DOUBLE PRECISION,
  ancho_calle_m DOUBLE PRECISION,

  peso_ranking INTEGER NOT NULL DEFAULT 5,

  estatus_fase TEXT NOT NULL DEFAULT 'Planeacion - Evaluacion',
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_solicitudes_curp ON solicitudes(curp);
CREATE INDEX idx_solicitudes_folio ON solicitudes(folio_unico);
CREATE INDEX idx_solicitudes_ubicacion ON solicitudes USING GIST (ubicacion);
CREATE INDEX idx_solicitudes_fecha ON solicitudes(fecha_creacion);

CREATE OR REPLACE FUNCTION check_curp_monthly_limit()
RETURNS TRIGGER AS $$
DECLARE
  cnt INT;
BEGIN
  IF NEW.curp = 'SIN CURP' THEN
    RETURN NEW;
  END IF;
  SELECT COUNT(*) INTO cnt
  FROM solicitudes
  WHERE curp = NEW.curp
    AND date_trunc('month', fecha_creacion) = date_trunc('month', NOW());
  IF cnt >= 3 THEN
    RAISE EXCEPTION 'Limite de 3 solicitudes mensuales alcanzado para este CURP';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_curp_limit
  BEFORE INSERT ON solicitudes
  FOR EACH ROW
  EXECUTE FUNCTION check_curp_monthly_limit();

CREATE OR REPLACE FUNCTION calcular_peso_ranking()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.peso_ranking = 5 THEN
    NEW.peso_ranking := CASE
      WHEN NEW.rutas_evidencia IS NOT NULL AND array_length(NEW.rutas_evidencia, 1) > 0 THEN 10
      ELSE 5
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_peso_ranking
  BEFORE INSERT ON solicitudes
  FOR EACH ROW
  EXECUTE FUNCTION calcular_peso_ranking();

ALTER TABLE solicitudes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cualquiera puede insertar solicitudes"
  ON solicitudes FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Cualquiera puede consultar por folio"
  ON solicitudes FOR SELECT
  TO anon
  USING (true);

-- ============================================================
-- Storage bucket para evidencias (ejecutar esta parte si no se
-- ejecutó junto con lo de arriba)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('evidencias', 'evidencias', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Subir evidencias"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'evidencias');

CREATE POLICY "Ver evidencias"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'evidencias');
