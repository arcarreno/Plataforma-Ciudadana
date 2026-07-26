-- Columnas para tramo con puntos intermedios y geocoding
ALTER TABLE solicitudes
ADD COLUMN IF NOT EXISTS tramo_puntos JSONB DEFAULT '[]'::jsonb;
