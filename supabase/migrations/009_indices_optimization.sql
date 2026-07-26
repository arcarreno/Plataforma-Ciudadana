-- ============================================================
-- Migration 009: Índices para optimización de búsqueda
-- ============================================================
-- Estos índices aceleran las consultas más frecuentes:
-- 1. folio_unico → ConsultarFolio (búsqueda exacta)
-- 2. fecha_creacion → AdminDashboard (ordenamiento)
-- 3. estatus_fase → AdminDashboard (filtro)
-- 4. peso_ranking → AdminDashboard (filtro de prioridad)
-- ============================================================

-- Índice para búsqueda exacta de folio (ConsultarFolio)
-- Elimina el full table scan en WHERE folio_unico = '...'
CREATE INDEX IF NOT EXISTS idx_solicitudes_folio_unico
  ON solicitudes (folio_unico);

-- Índice para ordenamiento por fecha (AdminDashboard)
-- Acelera ORDER BY fecha_creacion
CREATE INDEX IF NOT EXISTS idx_solicitudes_fecha_creacion
  ON solicitudes (fecha_creacion DESC);

-- Índice para filtro de estatus (AdminDashboard)
-- Acelera WHERE estatus_fase = '...'
CREATE INDEX IF NOT EXISTS idx_solicitudes_estatus_fase
  ON solicitudes (estatus_fase);

-- Índice compuesto para búsquedas combinadas del admin
-- Folio + nombre para búsqueda de texto libre
CREATE INDEX IF NOT EXISTS idx_solicitudes_folio_nombre
  ON solicitudes (folio_unico, nombre_solicitante);

-- Índice para filtro de prioridad (peso_ranking >= 15)
CREATE INDEX IF NOT EXISTS idx_solicitudes_peso_ranking
  ON solicitudes (peso_ranking DESC NULLS LAST);
