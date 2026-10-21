-- ══════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Sistema de Plantillas y Personalización Visual para Tiendas Web
-- Fecha: 2026-10-21
-- Reversible y no destructiva
-- ══════════════════════════════════════════════════════════════════════════

-- 1. Añadir columnas de plantillas a public.configuracion si no existen
ALTER TABLE public.configuracion 
  ADD COLUMN IF NOT EXISTS plantilla_id TEXT NOT NULL DEFAULT 'beauty',
  ADD COLUMN IF NOT EXISTS plantilla_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS plantilla_draft JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS plantilla_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 2. Índice para acelerar búsquedas
CREATE INDEX IF NOT EXISTS idx_configuracion_plantilla_id 
  ON public.configuracion(plantilla_id);

-- 3. Documentación en esquema
COMMENT ON COLUMN public.configuracion.plantilla_id IS 'Identificador del tema visual activo (ej: beauty, autoparts, ferremax)';
COMMENT ON COLUMN public.configuracion.plantilla_config IS 'Configuración visual publicada del tema (colores, banners, secciones, tipografía)';
COMMENT ON COLUMN public.configuracion.plantilla_draft IS 'Borrador de configuración visual pendiente de publicación';
