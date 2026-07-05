-- ============================================================
-- SGGI — Script de Inicialización de PostgreSQL
-- Se ejecuta automáticamente al crear el contenedor por primera vez.
-- ============================================================

-- Extensión para búsqueda fuzzy (trigrams) - útil para buscar platos/ingredientes
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Extensión para generación de UUIDs v4
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Extensión para funciones criptográficas (hashing)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Confirmación
DO $$
BEGIN
  RAISE NOTICE '✅ SGGI: Extensiones PostgreSQL instaladas correctamente';
END
$$;
