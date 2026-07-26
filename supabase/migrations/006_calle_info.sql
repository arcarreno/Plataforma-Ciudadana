-- Columnas para nombre de calle y entre calles (geocoding)
ALTER TABLE solicitudes
ADD COLUMN IF NOT EXISTS calle TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS entre_calles TEXT DEFAULT '';
