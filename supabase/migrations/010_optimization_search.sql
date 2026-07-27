-- ============================================================
-- Migration 010: Índices GIN para búsqueda de texto y cleanup
-- ============================================================
-- Esta migración:
-- 1. Habilita pg_trgm para búsqueda con ILIKE
-- 2. Agrega índices GIN (trigram) para búsqueda en múltiples
--    columnas (folio, nombre, colonia, junta, curp)
-- 3. Agrega índice compuesto estatus + fecha para el panel admin
-- 4. Elimina índices duplicados de migraciones anteriores
-- ============================================================

-- 1. Enable pg_trgm extension for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. GIN trigram index for ILIKE searches across text columns
--    Acelera: WHERE folio_unico ILIKE '%texto%' OR nombre... OR colonia...
CREATE INDEX IF NOT EXISTS idx_solicitudes_search_gin
  ON solicitudes
  USING gin (
    folio_unico gin_trgm_ops,
    nombre_solicitante gin_trgm_ops,
    colonia gin_trgm_ops,
    junta_auxiliar gin_trgm_ops,
    curp gin_trgm_ops,
    tipo_solicitud gin_trgm_ops
  );

-- 3. Composite index for admin dashboard filter pattern
--    Acelera: WHERE estatus_fase = '...' ORDER BY fecha_creacion DESC
CREATE INDEX IF NOT EXISTS idx_solicitudes_estatus_fecha
  ON solicitudes (estatus_fase, fecha_creacion DESC);

-- 4. Drop redundant indexes (duplicated from 001 → 009)
DROP INDEX IF EXISTS idx_solicitudes_folio;
DROP INDEX IF EXISTS idx_solicitudes_fecha;

-- 5. También conviene dropear el compuesto folio+nombre
--    porque el GIN de búsqueda ya lo cubre ampliamente.
--    Este índice solo servía para búsqueda exacta en dos columnas,
--    y los B-tree individuales (idx_solicitudes_folio_unico) ya
--    cubren búsqueda exacta de folio.
DROP INDEX IF EXISTS idx_solicitudes_folio_nombre;
