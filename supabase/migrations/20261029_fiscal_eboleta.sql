-- ══════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Facturación Electrónica eBoleta SII & API Gateway
-- Fecha: 2026-10-29
-- Idempotente, reversible y no destructiva
-- ══════════════════════════════════════════════════════════════════════════

-- 1. Asegurar columna de configuración fiscal en tabla configuracion
ALTER TABLE public.configuracion
  ADD COLUMN IF NOT EXISTS libredte_config JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.configuracion.libredte_config IS 'Configuración de facturación electrónica SII (API Gateway o LibreDTE): credenciales, proveedor, certificados y modo';

-- 2. Asegurar columnas de seguimiento DTE en la tabla ventas
ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS dte_tipo INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dte_folio BIGINT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dte_pdf_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dte_estado TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dte_error TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dte_fecha TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.ventas.dte_estado IS 'Estado de emisión tributaria SII: emitido, error, o pendiente_conciliacion';

-- 3. Índices para acelerar consultas por folio fiscal y estado
CREATE INDEX IF NOT EXISTS idx_ventas_dte_folio ON public.ventas(dte_folio) WHERE dte_folio IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ventas_dte_estado ON public.ventas(negocio_id, dte_estado);

-- 4. Notificar a PostgREST para recargar el esquema
NOTIFY pgrst, 'reload schema';
