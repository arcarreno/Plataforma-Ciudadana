-- ============================================================
-- Migración combinada: calle, entre_calles, tramo_puntos
-- Ejecutar TODO en Supabase SQL Editor
-- ============================================================

-- 1. Columnas nuevas
ALTER TABLE solicitudes
ADD COLUMN IF NOT EXISTS calle TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS entre_calles TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS tramo_puntos JSONB DEFAULT '[]'::jsonb;

-- 2. Política UPDATE para que se puedan guardar datos después
-- (necesaria para guardar calle/entre_calles al generar documentos)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'solicitudes'
      AND policyname = 'Cualquiera puede actualizar solicitudes'
  ) THEN
    CREATE POLICY "Cualquiera puede actualizar solicitudes"
      ON solicitudes FOR UPDATE
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
