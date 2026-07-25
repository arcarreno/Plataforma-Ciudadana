-- Columnas para datos extraídos del mapa al crear la solicitud
ALTER TABLE solicitudes
ADD COLUMN IF NOT EXISTS zona_zap BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS cobertura_agua BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS escuelas_cercanas TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS iglesias_cercanas TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS transportes_cercanos TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS distancia_tramo_m DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS ancho_calle_m DOUBLE PRECISION;
