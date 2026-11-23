-- ============================================================================
-- Operix ERP — Sistema Automático de Recuperación y Reactivación de Tiendas
-- ============================================================================

-- 1. Configuración global del sistema de recuperación (Singleton id = 1)
CREATE TABLE IF NOT EXISTS public.recuperacion_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  automatizacion_activa boolean NOT NULL DEFAULT true,
  dias_inactividad integer NOT NULL DEFAULT 12 CHECK (dias_inactividad >= 1 AND dias_inactividad <= 365),
  segundo_seguimiento_activo boolean NOT NULL DEFAULT true,
  dias_segundo_seguimiento integer NOT NULL DEFAULT 5 CHECK (dias_segundo_seguimiento >= 1 AND dias_segundo_seguimiento <= 90),
  promocion_activa boolean NOT NULL DEFAULT true,
  dias_beneficio integer NOT NULL DEFAULT 30 CHECK (dias_beneficio >= 1 AND dias_beneficio <= 365),
  plan_beneficio text NOT NULL DEFAULT 'pro' CHECK (plan_beneficio IN ('basico', 'pro', 'enterprise')),
  remitente_nombre text NOT NULL DEFAULT 'Operix ERP',
  remitente_email text NOT NULL DEFAULT 'notificaciones@operixerp.cloud',
  asunto_correo_1 text NOT NULL DEFAULT '¡Te extrañamos! Queremos que vuelvas a Operix ERP.',
  cuerpo_correo_1 text NOT NULL DEFAULT 'Hemos notado que llevas un tiempo sin utilizar Operix ERP en {{tienda}}.\n\nSabemos lo importante que es mantener el control de tus ventas, inventario, caja y catálogo online en un solo lugar, de forma rápida y segura en la nube.\n\nQueremos que vuelvas a impulsar tu negocio con nosotros, por eso hemos preparado una oferta especial de reactivación exclusiva para tu tienda: UN MES GRATUITO en tu suscripción.',
  asunto_correo_2 text NOT NULL DEFAULT 'Recordatorio: Tu mes gratuito en Operix ERP sigue disponible para {{tienda}}',
  cuerpo_correo_2 text NOT NULL DEFAULT 'Hace unos días te enviamos una invitación especial para volver a Operix ERP.\n\nTe recordamos que tu beneficio exclusivo de UN MES GRATUITO para {{tienda}} sigue disponible y listo para activarse cuando tú lo decidas.\n\nToda tu configuración, productos y clientes te están esperando.',
  texto_boton text NOT NULL DEFAULT 'ACTIVAR MI MES GRATIS',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.recuperacion_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.recuperacion_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rec_cfg_super_all ON public.recuperacion_config;
CREATE POLICY rec_cfg_super_all ON public.recuperacion_config
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS rec_cfg_auth_read ON public.recuperacion_config;
CREATE POLICY rec_cfg_auth_read ON public.recuperacion_config
  FOR SELECT TO authenticated
  USING (true);

DO $$ BEGIN GRANT SELECT, INSERT, UPDATE ON public.recuperacion_config TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT ALL ON public.recuperacion_config TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 2. Campañas y seguimiento por tienda (1 registro único por negocio para garantizar uso único de promoción e idempotencia)
CREATE TABLE IF NOT EXISTS public.recuperacion_campanas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL UNIQUE REFERENCES public.negocios(id) ON DELETE CASCADE,
  destinatario_email text NOT NULL,
  destinatario_nombre text,
  token_reactivacion text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  ultima_actividad_real_at timestamptz,
  inactividad_detectada_at timestamptz NOT NULL DEFAULT now(),
  dias_inactivo_al_detectar integer NOT NULL DEFAULT 12,

  -- Primer correo (12 días)
  correo_1_enviado_at timestamptz,
  correo_1_resend_id text,
  correo_1_estado text NOT NULL DEFAULT 'pendiente' CHECK (
    correo_1_estado IN ('pendiente', 'enviado', 'entregado', 'abierto', 'clic', 'rebotado', 'fallido', 'suprimido')
  ),
  correo_1_entregado_at timestamptz,
  correo_1_abierto_at timestamptz,
  correo_1_clic_at timestamptz,

  -- Segundo correo de seguimiento (+5 días sin actividad)
  correo_2_enviado_at timestamptz,
  correo_2_resend_id text,
  correo_2_estado text CHECK (
    correo_2_estado IS NULL OR correo_2_estado IN ('pendiente', 'enviado', 'entregado', 'abierto', 'clic', 'rebotado', 'fallido', 'suprimido')
  ),
  correo_2_entregado_at timestamptz,
  correo_2_abierto_at timestamptz,
  correo_2_clic_at timestamptz,

  -- Eventos consolidados de correo
  primer_abierto_at timestamptz,
  primer_clic_at timestamptz,

  -- Gestión de la promoción (uso único por tienda, requiere aceptación expresa)
  estado_promocion text NOT NULL DEFAULT 'disponible' CHECK (
    estado_promocion IN ('disponible', 'aceptada', 'expirada', 'rechazada', 'no_elegible')
  ),
  plan_otorgado text NOT NULL DEFAULT 'pro',
  dias_otorgados integer NOT NULL DEFAULT 30,
  promocion_otorgada_at timestamptz,
  promocion_vence_at timestamptz,
  promocion_aceptada_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Estado de recuperación de la tienda
  tienda_recuperada boolean NOT NULL DEFAULT false,
  reactivada_at timestamptz,
  origen_reactivacion text, -- 'promocion_aceptada' | 'actividad_erp'

  baja_comunicaciones boolean NOT NULL DEFAULT false,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rec_camp_estado ON public.recuperacion_campanas(correo_1_estado, estado_promocion, tienda_recuperada);
CREATE INDEX IF NOT EXISTS idx_rec_camp_resend1 ON public.recuperacion_campanas(correo_1_resend_id) WHERE correo_1_resend_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rec_camp_resend2 ON public.recuperacion_campanas(correo_2_resend_id) WHERE correo_2_resend_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rec_camp_token ON public.recuperacion_campanas(token_reactivacion);

ALTER TABLE public.recuperacion_campanas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rec_camp_super_all ON public.recuperacion_campanas;
CREATE POLICY rec_camp_super_all ON public.recuperacion_campanas
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS rec_camp_owner_read ON public.recuperacion_campanas;
CREATE POLICY rec_camp_owner_read ON public.recuperacion_campanas
  FOR SELECT TO authenticated
  USING (negocio_id = public.current_negocio_id());

DO $$ BEGIN GRANT SELECT, INSERT, UPDATE ON public.recuperacion_campanas TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT ALL ON public.recuperacion_campanas TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DROP TRIGGER IF EXISTS trg_rec_camp_updated ON public.recuperacion_campanas;
CREATE TRIGGER trg_rec_camp_updated
  BEFORE UPDATE ON public.recuperacion_campanas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 3. Función que calcula la última actividad humana/operacional real de cada tienda
-- Considera únicamente:
-- - Inicio de sesión de propietarios o usuarios autorizados (auth.users.last_sign_in_at)
-- - Registro de ventas (ventas.created_at)
-- - Gestión de pedidos o comandas (comandas.created_at, pedidos_whatsapp.updated_at cuando estado <> 'pendiente')
-- - Actualización de productos, compras o inventario (productos.updated_at, compras.created_at, stock_movements manuales)
-- - Actividad administrativa relevante en el ERP (caja_sesiones.abierta_at, audit_logs.created_at)
CREATE OR REPLACE FUNCTION public.calcular_ultima_actividad_negocio(_negocio_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(
    (SELECT n.created_at FROM public.negocios n WHERE n.id = _negocio_id),
    (
      SELECT max(u.last_sign_in_at)
      FROM auth.users u
      JOIN public.profiles p ON p.id = u.id
      WHERE p.negocio_id = _negocio_id
    ),
    (SELECT max(v.created_at) FROM public.ventas v WHERE v.negocio_id = _negocio_id),
    (SELECT max(c.created_at) FROM public.comandas c WHERE c.negocio_id = _negocio_id),
    (
      SELECT max(p.updated_at)
      FROM public.productos p
      WHERE p.negocio_id = _negocio_id
    ),
    (SELECT max(co.created_at) FROM public.compras co WHERE co.negocio_id = _negocio_id),
    (SELECT max(cs.abierta_at) FROM public.caja_sesiones cs WHERE cs.negocio_id = _negocio_id),
    (
      SELECT max(sm.created_at)
      FROM public.stock_movements sm
      WHERE sm.negocio_id = _negocio_id
        AND sm.tipo IN ('venta', 'compra', 'ajuste', 'entrada_manual', 'devolucion')
    ),
    (
      SELECT max(al.created_at)
      FROM public.audit_logs al
      WHERE al.negocio_id = _negocio_id
        AND (al.action IS NULL OR al.action NOT LIKE 'system_%')
    )
  );
$$;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.calcular_ultima_actividad_negocio(uuid) FROM PUBLIC, anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.calcular_ultima_actividad_negocio(uuid) TO authenticated, service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 4. Función para que un propietario/admin active expresamente su mes gratuito de recuperación
CREATE OR REPLACE FUNCTION public.activar_promocion_recuperacion(_token text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _nid uuid := public.current_negocio_id();
  _cfg public.recuperacion_config%ROWTYPE;
  _camp public.recuperacion_campanas%ROWTYPE;
  _susc public.suscripciones%ROWTYPE;
  _vence_nuevo timestamptz;
  _plan_otorgar text;
  _dias_otorgar integer;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para activar tu promoción';
  END IF;

  IF _nid IS NULL THEN
    RAISE EXCEPTION 'Tu cuenta no tiene un comercio asociado';
  END IF;

  -- Validar que sea propietario/admin de la tienda
  IF NOT public.has_role_in_negocio(_uid, 'admin'::public.app_role, _nid) THEN
    RAISE EXCEPTION 'Solo el propietario o administrador de la tienda puede aceptar y activar esta promoción';
  END IF;

  SELECT * INTO _cfg FROM public.recuperacion_config WHERE id = 1;
  IF FOUND AND NOT _cfg.promocion_activa THEN
    RAISE EXCEPTION 'La promoción de reactivación no se encuentra disponible en este momento';
  END IF;

  SELECT * INTO _camp
  FROM public.recuperacion_campanas
  WHERE negocio_id = _nid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tu comercio no registra una invitación de recuperación elegible';
  END IF;

  IF _token IS NOT NULL AND length(trim(_token)) > 0 AND _camp.token_reactivacion <> trim(_token) THEN
    RAISE EXCEPTION 'El código de verificación de la promoción no coincide con tu tienda';
  END IF;

  -- Evitar uso repetido (uso único por tienda)
  IF _camp.estado_promocion = 'aceptada' OR _camp.promocion_otorgada_at IS NOT NULL THEN
    RAISE EXCEPTION 'Esta tienda ya utilizó su promoción única de mes gratuito anteriormente';
  END IF;

  IF _camp.estado_promocion IN ('expirada', 'rechazada', 'no_elegible') THEN
    RAISE EXCEPTION 'Esta promoción ya no es elegible para activación (estado: %)', _camp.estado_promocion;
  END IF;

  -- No acumulable con otros cupones promocionales activos vigentes
  IF EXISTS (
    SELECT 1 FROM public.cupon_canjes cc
    WHERE cc.negocio_id = _nid AND cc.vence_at_nuevo > now()
  ) THEN
    RAISE EXCEPTION 'Esta promoción no es acumulable con otros cupones promocionales activos en tu cuenta';
  END IF;

  -- Verificar suscripción actual
  SELECT * INTO _susc FROM public.suscripciones WHERE negocio_id = _nid;
  IF FOUND AND _susc.estado = 'activa' AND _susc.proveedor = 'mercadopago' AND _susc.vence_at IS NOT NULL AND _susc.vence_at > now() + interval '5 days' THEN
    RAISE EXCEPTION 'Tu tienda ya cuenta con una suscripción paga vigente. Esta promoción no es acumulable.';
  END IF;

  _plan_otorgar := COALESCE(_camp.plan_otorgado, _cfg.plan_beneficio, 'pro');
  _dias_otorgar := COALESCE(_camp.dias_otorgados, _cfg.dias_beneficio, 30);
  _vence_nuevo := now() + make_interval(days => _dias_otorgar);

  -- Actualizar campaña de recuperación
  UPDATE public.recuperacion_campanas
  SET estado_promocion = 'aceptada',
      plan_otorgado = _plan_otorgar,
      dias_otorgados = _dias_otorgar,
      promocion_otorgada_at = now(),
      promocion_vence_at = _vence_nuevo,
      promocion_aceptada_por = _uid,
      tienda_recuperada = true,
      reactivada_at = COALESCE(reactivada_at, now()),
      origen_reactivacion = 'promocion_aceptada',
      primer_clic_at = COALESCE(primer_clic_at, now()),
      updated_at = now()
  WHERE id = _camp.id;

  -- Integrar con el sistema actual de suscripciones y facturación
  INSERT INTO public.suscripciones (negocio_id, plan, estado, proveedor, inicio_at, vence_at, notas)
  VALUES (
    _nid,
    _plan_otorgar,
    'activa',
    'manual',
    now(),
    _vence_nuevo,
    'Promoción de Reactivación (1 Mes Gratis aceptado por el propietario)'
  )
  ON CONFLICT (negocio_id) DO UPDATE
    SET plan = EXCLUDED.plan,
        estado = 'activa',
        vence_at = _vence_nuevo,
        notas = COALESCE(public.suscripciones.notas, '') || ' | Reactivación 1 Mes Gratis (' || to_char(now(), 'YYYY-MM-DD') || ')',
        updated_at = now();

  -- Actualizar plan del negocio para habilitar todas las funciones inmediatamente
  UPDATE public.negocios
  SET plan = _plan_otorgar
  WHERE id = _nid;

  -- Registro de auditoría inmutable
  INSERT INTO public.audit_logs (negocio_id, usuario_id, action, entity_type, entity_id, after_data)
  VALUES (
    _nid,
    _uid,
    'promocion_recuperacion_activada',
    'suscripciones',
    _camp.id::text,
    jsonb_build_object(
      'plan', _plan_otorgar,
      'dias_otorgados', _dias_otorgar,
      'otorgada_at', now(),
      'vence_at', _vence_nuevo
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'plan', _plan_otorgar,
    'dias_otorgados', _dias_otorgar,
    'otorgada_at', now(),
    'vence_at', _vence_nuevo
  );
END;
$$;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.activar_promocion_recuperacion(text) FROM PUBLIC, anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.activar_promocion_recuperacion(text) TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
