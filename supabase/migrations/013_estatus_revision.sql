-- Cambiar default de estatus_fase a 'Revision'
ALTER TABLE solicitudes
  ALTER COLUMN estatus_fase SET DEFAULT 'Revision';
