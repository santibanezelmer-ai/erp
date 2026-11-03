-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Módulo Tributario SimpleAPI & Documentos Tributarios Electrónicos
-- Fecha: 2026-11-02
-- Proyecto: Operix ERP · SimpleAPI (Chilesystems)
-- Idempotente, no destructiva, preserva historial previo.
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. EXTENSIÓN CRIPTOGRÁFICA PARA ALMACENAMIENTO SEGURO
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. TABLA: CONFIGURACIÓN TRIBUTARIA POR EMPRESA (100% PRIVADA)
-- Aísla credenciales, certificados y datos tributarios de public.configuracion
CREATE TABLE IF NOT EXISTS public.configuracion_tributaria (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id                UUID UNIQUE NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  rut_emisor                TEXT NOT NULL,
  razon_social              TEXT NOT NULL,
  giro                      TEXT NOT NULL,
  acteco                    INTEGER NOT NULL DEFAULT 471100, -- Actividad económica SII
  direccion                 TEXT NOT NULL,
  comuna                    TEXT NOT NULL,
  ciudad                    TEXT NOT NULL,
  cdg_sii_sucur             INTEGER NOT NULL DEFAULT 0,
  simpleapi_key             TEXT, -- API Key de SimpleAPI
  ambiente                  TEXT NOT NULL DEFAULT 'certificacion' CHECK (ambiente IN ('certificacion', 'produccion')),
  emision_automatica        BOOLEAN NOT NULL DEFAULT true,
  certificado_storage_path  TEXT, -- Path en bucket privado de storage
  certificado_password_enc  TEXT, -- Contraseña cifrada con pgp_sym_encrypt
  certificado_rut_titular   TEXT, -- RUT del titular autorizado en el SII
  certificado_vence         DATE,
  activo                    BOOLEAN NOT NULL DEFAULT true,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.configuracion_tributaria IS 'Configuración y credenciales de facturación electrónica SimpleAPI / SII con aislamiento multiempresa';

-- RLS y Privilegios: Aislamiento Total en Base de Datos
-- Ningún usuario cliente (ni cajero, ni admin, ni dueño) tiene permisos de lectura sobre la tabla base de secretos.
-- Las credenciales privadas (simpleapi_key, contraseñas, paths) solo son accesibles por el backend (service_role).
ALTER TABLE public.configuracion_tributaria ENABLE ROW LEVEL SECURITY;

-- Limpieza exhaustiva de cualquier política previa
DROP POLICY IF EXISTS "cfg_trib_read" ON public.configuracion_tributaria;
DROP POLICY IF EXISTS "cfg_trib_write" ON public.configuracion_tributaria;
DROP POLICY IF EXISTS "cfg_trib_deny_client_read" ON public.configuracion_tributaria;

-- Revocación absoluta de privilegios directos a clientes
REVOKE ALL ON public.configuracion_tributaria FROM anon, authenticated;
GRANT ALL ON public.configuracion_tributaria TO service_role;

-- Función segura SECURITY DEFINER para que el comercio consulte su estado fiscal sin exponer secretos
CREATE OR REPLACE FUNCTION public.obtener_mi_configuracion_tributaria()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _nid UUID := current_negocio_id();
  _res RECORD;
BEGIN
  -- Validar que el usuario esté debidamente autenticado
  IF auth.uid() IS NULL OR _nid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No autenticado o sin negocio asignado');
  END IF;

  -- Validar que cuente con rol administrativo para ver la configuración tributaria
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Permiso denegado: Requiere rol de Administrador');
  END IF;

  SELECT 
    id, negocio_id, rut_emisor, razon_social, giro, acteco,
    direccion, comuna, ciudad, cdg_sii_sucur, ambiente,
    emision_automatica, certificado_rut_titular, certificado_vence, activo,
    (simpleapi_key IS NOT NULL AND length(trim(simpleapi_key)) > 0) AS tiene_apikey,
    (certificado_storage_path IS NOT NULL AND length(trim(certificado_storage_path)) > 0) AS tiene_certificado,
    created_at, updated_at
  INTO _res
  FROM public.configuracion_tributaria
  WHERE negocio_id = _nid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'configurado', false);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'configurado', true,
    'data', to_jsonb(_res)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.obtener_mi_configuracion_tributaria() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.obtener_mi_configuracion_tributaria() TO authenticated, service_role;

-- 3. TABLA: GESTIÓN DE FOLIOS Y ARCHIVOS CAF POR EMPRESA
-- Administra los rangos autorizados por el SII y el XML del CAF
CREATE TABLE IF NOT EXISTS public.folios_caf (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id          UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  tipo_dte            INTEGER NOT NULL CHECK (tipo_dte IN (39, 41, 33, 34, 61, 56)),
  folio_desde         BIGINT NOT NULL,
  folio_hasta         BIGINT NOT NULL,
  ultimo_folio_usado  BIGINT NOT NULL,
  fecha_autorizacion  DATE NOT NULL DEFAULT CURRENT_DATE,
  caf_xml             TEXT NOT NULL,
  activo              BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_folios_rango CHECK (
    folio_hasta >= folio_desde 
    AND ultimo_folio_usado >= (folio_desde - 1) 
    AND ultimo_folio_usado <= folio_hasta
  ),
  CONSTRAINT unq_folios_caf_rango UNIQUE (negocio_id, tipo_dte, folio_desde, folio_hasta)
);

COMMENT ON TABLE public.folios_caf IS 'Almacén de archivos CAF del SII con control transaccional de folios por empresa';

CREATE INDEX IF NOT EXISTS idx_folios_caf_lookup 
  ON public.folios_caf(negocio_id, tipo_dte, activo) 
  WHERE activo = true;

ALTER TABLE public.folios_caf ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "folios_caf_policy" ON public.folios_caf;
DROP POLICY IF EXISTS "folios_caf_deny_client_read" ON public.folios_caf;

-- Revocación de acceso directo al XML del CAF (contiene clave privada RSA)
REVOKE ALL ON public.folios_caf FROM anon, authenticated;
GRANT ALL ON public.folios_caf TO service_role;

-- Función segura SECURITY DEFINER para consultar saldo de folios sin exponer el CAF XML
CREATE OR REPLACE FUNCTION public.obtener_resumen_folios_caf()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _nid UUID := current_negocio_id();
  _res JSONB;
BEGIN
  -- Validar que el usuario esté debidamente autenticado
  IF auth.uid() IS NULL OR _nid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No autenticado o sin negocio asignado');
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'tipo_dte', tipo_dte,
      'folio_desde', folio_desde,
      'folio_hasta', folio_hasta,
      'ultimo_folio_usado', ultimo_folio_usado,
      'fecha_autorizacion', fecha_autorizacion,
      'activo', activo,
      'folios_restantes', (folio_hasta - ultimo_folio_usado),
      'created_at', created_at
    )
  )
  INTO _res
  FROM public.folios_caf
  WHERE negocio_id = _nid
    AND activo = true;

  RETURN jsonb_build_object('ok', true, 'folios', COALESCE(_res, '[]'::jsonb));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.obtener_resumen_folios_caf() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.obtener_resumen_folios_caf() TO authenticated, service_role;

-- 4. FUNCIÓN ATÓMICA DE ASIGNACIÓN DE FOLIOS (PREVENCIÓN DE CONDICIONES DE CARRERA EN EL POS)
-- Utiliza SELECT ... FOR UPDATE para garantizar que dos cajas jamás reciban el mismo folio
CREATE OR REPLACE FUNCTION public.obtener_siguiente_folio_dte(
  _negocio_id UUID,
  _tipo_dte INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caf_record RECORD;
  _siguiente_folio BIGINT;
  _folios_restantes BIGINT;
BEGIN
  -- Validar aislamiento multiempresa
  IF _negocio_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Debe especificar el negocio');
  END IF;

  -- Si es invocado dentro de una sesión de usuario, verificar pertenencia estricta
  IF auth.uid() IS NOT NULL AND _negocio_id <> current_negocio_id() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No autorizado para este negocio');
  END IF;

  -- Bloqueo pesimista a nivel de fila sobre el CAF activo más antiguo con folios disponibles
  SELECT id, folio_desde, folio_hasta, ultimo_folio_usado, caf_xml
  INTO _caf_record
  FROM public.folios_caf
  WHERE negocio_id = _negocio_id
    AND tipo_dte = _tipo_dte
    AND activo = true
    AND ultimo_folio_usado < folio_hasta
  ORDER BY folio_desde ASC
  FOR UPDATE
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Sin folios disponibles para el tipo de documento. Cargue un nuevo CAF en Configuración Tributaria.',
      'sin_folios', true
    );
  END IF;

  _siguiente_folio := _caf_record.ultimo_folio_usado + 1;
  _folios_restantes := _caf_record.folio_hasta - _siguiente_folio;

  -- Actualizar el último folio usado
  UPDATE public.folios_caf
  SET ultimo_folio_usado = _siguiente_folio,
      activo = (_folios_restantes > 0)
  WHERE id = _caf_record.id;

  RETURN jsonb_build_object(
    'ok', true,
    'folio', _siguiente_folio,
    'caf_id', _caf_record.id,
    'caf_xml', _caf_record.caf_xml,
    'folio_hasta', _caf_record.folio_hasta,
    'folios_restantes', _folios_restantes
  );
END;
$$;

-- 5. TABLA: DOCUMENTOS TRIBUTARIOS ELECTRÓNICOS (DTE)
-- Registro oficial de todos los documentos emitidos ante el SII
CREATE TABLE IF NOT EXISTS public.documentos_tributarios (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id              UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  venta_id                UUID REFERENCES public.ventas(id) ON DELETE SET NULL,
  tipo_dte                INTEGER NOT NULL CHECK (tipo_dte IN (39, 41, 33, 34, 61, 56)),
  folio                   BIGINT NOT NULL,
  rut_emisor              TEXT NOT NULL,
  rut_receptor            TEXT NOT NULL DEFAULT '66666666-6',
  razon_social_receptor   TEXT NOT NULL DEFAULT 'Cliente Boleta',
  fecha_emision           TIMESTAMPTZ NOT NULL DEFAULT now(),
  monto_neto              NUMERIC(12,2) NOT NULL DEFAULT 0,
  iva                     NUMERIC(12,2) NOT NULL DEFAULT 0,
  monto_exento            NUMERIC(12,2) NOT NULL DEFAULT 0,
  monto_total             NUMERIC(12,2) NOT NULL,
  estado                  TEXT NOT NULL DEFAULT 'borrador' CHECK (
    estado IN (
      'borrador',
      'generado',
      'enviado',
      'procesando',
      'aceptado',
      'aceptado_con_reparos',
      'rechazado',
      'pendiente_conciliacion',
      'error'
    )
  ),
  track_id                BIGINT,
  xml_dte_url             TEXT, -- Referencia en storage privado
  xml_envio_url           TEXT,
  pdf_url                 TEXT,
  ted_timbre              TEXT, -- Datos del timbre electrónico PDF417
  respuesta_proveedor     JSONB DEFAULT '{}'::jsonb,
  ultimo_error            TEXT,
  proveedor               TEXT NOT NULL DEFAULT 'simpleapi',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unq_doc_trib_folio UNIQUE (negocio_id, tipo_dte, folio),
  CONSTRAINT unq_doc_trib_venta_tipo UNIQUE (negocio_id, venta_id, tipo_dte)
);

COMMENT ON TABLE public.documentos_tributarios IS 'Histórico auditable de DTEs emitidos con trazabilidad ante el SII';

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_doc_trib_negocio_fecha ON public.documentos_tributarios(negocio_id, fecha_emision DESC);
CREATE INDEX IF NOT EXISTS idx_doc_trib_folio ON public.documentos_tributarios(negocio_id, tipo_dte, folio);
CREATE INDEX IF NOT EXISTS idx_doc_trib_venta ON public.documentos_tributarios(venta_id);
CREATE INDEX IF NOT EXISTS idx_doc_trib_estado ON public.documentos_tributarios(negocio_id, estado);
CREATE INDEX IF NOT EXISTS idx_doc_trib_track ON public.documentos_tributarios(track_id) WHERE track_id IS NOT NULL;

-- RLS para documentos tributarios
ALTER TABLE public.documentos_tributarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "doc_trib_read" ON public.documentos_tributarios;
CREATE POLICY "doc_trib_read" ON public.documentos_tributarios
  FOR SELECT TO authenticated
  USING (negocio_id = current_negocio_id());

DROP POLICY IF EXISTS "doc_trib_write" ON public.documentos_tributarios;
CREATE POLICY "doc_trib_write" ON public.documentos_tributarios
  FOR ALL TO authenticated
  USING (negocio_id = current_negocio_id())
  WITH CHECK (negocio_id = current_negocio_id());

-- 6. DISPARADOR PARA ACTUALIZAR updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cfg_trib_updated ON public.configuracion_tributaria;
CREATE TRIGGER trg_cfg_trib_updated
  BEFORE UPDATE ON public.configuracion_tributaria
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_doc_trib_updated ON public.documentos_tributarios;
CREATE TRIGGER trg_doc_trib_updated
  BEFORE UPDATE ON public.documentos_tributarios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. TABLA Y FUNCIÓN PARA RATE LIMIT DISTRIBUIDO (SERVERLESS MULTI-INSTANCIA)
CREATE TABLE IF NOT EXISTS public.tributario_rate_limits (
  recurso               TEXT PRIMARY KEY, -- 'dte' | 'folio'
  ultimo_llamado        TIMESTAMPTZ NOT NULL DEFAULT now(),
  llamados_en_ventana   INTEGER NOT NULL DEFAULT 0,
  ventana_inicio        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inicializar contadores si no existen
INSERT INTO public.tributario_rate_limits (recurso, ultimo_llamado, llamados_en_ventana, ventana_inicio)
VALUES 
  ('dte', now(), 0, now()),
  ('folio', now(), 0, now())
ON CONFLICT (recurso) DO NOTHING;

-- Función atómica para reservar turno de llamada
CREATE OR REPLACE FUNCTION public.verificar_rate_limit_tributario(
  _recurso TEXT, -- 'dte' o 'folio'
  _max_por_minuto INTEGER DEFAULT 36,
  _min_intervalo_ms INTEGER DEFAULT 380
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rec RECORD;
  _ahora TIMESTAMPTZ := clock_timestamp();
  _diff_ms NUMERIC;
  _diff_minuto_seg NUMERIC;
  _espera_ms NUMERIC := 0;
BEGIN
  SELECT recurso, ultimo_llamado, llamados_en_ventana, ventana_inicio
  INTO _rec
  FROM public.tributario_rate_limits
  WHERE recurso = _recurso
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.tributario_rate_limits (recurso, ultimo_llamado, llamados_en_ventana, ventana_inicio)
    VALUES (_recurso, _ahora, 1, _ahora);
    RETURN jsonb_build_object('ok', true, 'espera_ms', 0);
  END IF;

  -- 1. Intervalo mínimo
  _diff_ms := EXTRACT(EPOCH FROM (_ahora - _rec.ultimo_llamado)) * 1000;
  IF _diff_ms < _min_intervalo_ms THEN
    _espera_ms := GREATEST(_espera_ms, _min_intervalo_ms - _diff_ms);
  END IF;

  -- 2. Ventana de 1 minuto
  _diff_minuto_seg := EXTRACT(EPOCH FROM (_ahora - _rec.ventana_inicio));
  IF _diff_minuto_seg >= 60 THEN
    -- Reiniciar ventana
    UPDATE public.tributario_rate_limits
    SET ventana_inicio = _ahora,
        llamados_en_ventana = 1,
        ultimo_llamado = _ahora + (_espera_ms || ' milliseconds')::interval
    WHERE recurso = _recurso;
    RETURN jsonb_build_object('ok', true, 'espera_ms', CEIL(_espera_ms));
  END IF;

  IF _rec.llamados_en_ventana >= _max_por_minuto THEN
    _espera_ms := GREATEST(_espera_ms, ((60 - _diff_minuto_seg) * 1000) + 200);
  END IF;

  UPDATE public.tributario_rate_limits
  SET llamados_en_ventana = _rec.llamados_en_ventana + 1,
      ultimo_llamado = _ahora + (_espera_ms || ' milliseconds')::interval
  WHERE recurso = _recurso;

  RETURN jsonb_build_object('ok', true, 'espera_ms', CEIL(_espera_ms));
END;
$$;

-- 8. BUCKET PRIVADO DE STORAGE PARA CERTIFICADOS DIGITALES PFX
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'certificados-tributarios',
  'certificados-tributarios',
  false,
  5242880, -- 5MB máx
  ARRAY['application/x-pkcs12', 'application/octet-stream']::text[]
)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Denegación total de descarga de certificados desde el navegador (solo backend service_role)
DROP POLICY IF EXISTS "certificados_privados_select" ON storage.objects;

DROP POLICY IF EXISTS "certificados_privados_insert" ON storage.objects;
CREATE POLICY "certificados_privados_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'certificados-tributarios'
    AND (storage.foldername(name))[1] = current_negocio_id()::text
    AND has_role(auth.uid(), 'admin'::app_role)
  );

-- 9. PERMISOS ESTRICTOS DE EJECUCIÓN RPC (SOLO BACKEND SERVICE_ROLE)
-- No se permite ejecución a clientes web/authenticated; la asignación de folios y rate limiting
-- son operaciones críticas gestionadas exclusivamente por las Edge Functions / Backend.
REVOKE EXECUTE ON FUNCTION public.obtener_siguiente_folio_dte(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.obtener_siguiente_folio_dte(UUID, INTEGER) TO service_role;

REVOKE EXECUTE ON FUNCTION public.verificar_rate_limit_tributario(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verificar_rate_limit_tributario(TEXT, INTEGER, INTEGER) TO service_role;

-- 10. RECARGAR SCHEMA POSTGREST
NOTIFY pgrst, 'reload schema';
