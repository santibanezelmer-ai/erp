-- ============================================================================
-- Operix ERP — Centro de Soporte y Atención a Tiendas (Multi-Tenant + Super Admin)
-- ============================================================================

-- 1. Configuración Global de SLA, Horarios Hábiles y Reglas de Soporte (Singleton id = 1)
CREATE TABLE IF NOT EXISTS public.soporte_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  sla_urgente_horas numeric(6,2) NOT NULL DEFAULT 1,
  sla_alta_horas numeric(6,2) NOT NULL DEFAULT 4,
  sla_normal_horas numeric(6,2) NOT NULL DEFAULT 8,
  sla_baja_horas numeric(6,2) NOT NULL DEFAULT 24,
  horario_inicio time NOT NULL DEFAULT '09:00:00',
  horario_fin time NOT NULL DEFAULT '18:00:00',
  dias_habiles integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5], -- 1=Lunes .. 5=Viernes (ISO DOW)
  timezone text NOT NULL DEFAULT 'America/Santiago',
  dias_reapertura integer NOT NULL DEFAULT 7 CHECK (dias_reapertura >= 0 AND dias_reapertura <= 90),
  notificaciones_activas boolean NOT NULL DEFAULT true,
  email_soporte text NOT NULL DEFAULT 'notificaciones@operixerp.cloud',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.soporte_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.soporte_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sop_cfg_super_all ON public.soporte_config;
CREATE POLICY sop_cfg_super_all ON public.soporte_config
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS sop_cfg_auth_read ON public.soporte_config;
CREATE POLICY sop_cfg_auth_read ON public.soporte_config
  FOR SELECT TO authenticated
  USING (true);

DO $$ BEGIN GRANT SELECT, INSERT, UPDATE ON public.soporte_config TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT ALL ON public.soporte_config TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 2. Secuencia correlativa única para tickets
CREATE SEQUENCE IF NOT EXISTS public.soporte_tickets_numero_seq START WITH 1001 INCREMENT BY 1;

-- 3. Tabla Principal de Tickets de Soporte
CREATE TABLE IF NOT EXISTS public.soporte_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero bigint NOT NULL UNIQUE DEFAULT nextval('public.soporte_tickets_numero_seq'),
  codigo text GENERATED ALWAYS AS ('TK-' || lpad(numero::text, 5, '0')) STORED,
  negocio_id uuid NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  solicitante_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  solicitante_nombre text NOT NULL,
  solicitante_email text,
  categoria text NOT NULL CHECK (
    categoria IN (
      'acceso_usuarios',
      'punto_de_venta',
      'ventas',
      'productos_inventario',
      'compras_proveedores',
      'caja_cierres',
      'facturacion',
      'suscripciones_pagos',
      'configuracion',
      'pedidos_delivery',
      'aplicacion_movil',
      'problemas_tecnicos',
      'solicitudes_mejora',
      'otros'
    )
  ),
  asunto text NOT NULL CHECK (char_length(trim(asunto)) >= 3),
  descripcion text NOT NULL CHECK (char_length(trim(descripcion)) >= 5),
  prioridad text NOT NULL DEFAULT 'normal' CHECK (
    prioridad IN ('baja', 'normal', 'alta', 'urgente')
  ),
  estado text NOT NULL DEFAULT 'nuevo' CHECK (
    estado IN (
      'nuevo',
      'abierto',
      'esperando_tienda',
      'en_resolucion',
      'resuelto',
      'cerrado'
    )
  ),
  responsable_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  responsable_nombre text,
  adjuntos jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Fechas de seguimiento y tiempos SLA (en minutos hábiles y calendario)
  primera_respuesta_at timestamptz,
  resuelto_at timestamptz,
  cerrado_at timestamptz,
  reabierto_at timestamptz,
  sla_objetivo_minutos integer NOT NULL DEFAULT 480,
  tiempo_primera_respuesta_min integer,
  tiempo_primera_respuesta_habil_min integer,
  tiempo_resolucion_min integer,
  tiempo_resolucion_habil_min integer,
  sla_incumplido boolean NOT NULL DEFAULT false,

  -- Evaluación del servicio por parte del comercio (1 a 5 estrellas)
  calificacion integer CHECK (calificacion IS NULL OR (calificacion >= 1 AND calificacion <= 5)),
  comentario_evaluacion text,
  evaluado_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_soporte_tickets_negocio ON public.soporte_tickets(negocio_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_soporte_tickets_estado_prio ON public.soporte_tickets(estado, prioridad, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_soporte_tickets_responsable ON public.soporte_tickets(responsable_id) WHERE responsable_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_soporte_tickets_numero ON public.soporte_tickets(numero DESC);

ALTER TABLE public.soporte_tickets ENABLE ROW LEVEL SECURITY;

-- Super Admin: control total de todos los tickets
DROP POLICY IF EXISTS sop_tickets_super_all ON public.soporte_tickets;
CREATE POLICY sop_tickets_super_all ON public.soporte_tickets
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Comercio: solo visualiza, crea y actualiza los tickets de su propio negocio
DROP POLICY IF EXISTS sop_tickets_tenant_select ON public.soporte_tickets;
CREATE POLICY sop_tickets_tenant_select ON public.soporte_tickets
  FOR SELECT TO authenticated
  USING (negocio_id = public.current_negocio_id());

DROP POLICY IF EXISTS sop_tickets_tenant_insert ON public.soporte_tickets;
CREATE POLICY sop_tickets_tenant_insert ON public.soporte_tickets
  FOR INSERT TO authenticated
  WITH CHECK (negocio_id = public.current_negocio_id());

DROP POLICY IF EXISTS sop_tickets_tenant_update ON public.soporte_tickets;
CREATE POLICY sop_tickets_tenant_update ON public.soporte_tickets
  FOR UPDATE TO authenticated
  USING (negocio_id = public.current_negocio_id())
  WITH CHECK (negocio_id = public.current_negocio_id());

DO $$ BEGIN GRANT SELECT, INSERT, UPDATE ON public.soporte_tickets TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT ALL ON public.soporte_tickets TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT USAGE, SELECT ON SEQUENCE public.soporte_tickets_numero_seq TO authenticated, service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DROP TRIGGER IF EXISTS trg_sop_tickets_updated ON public.soporte_tickets;
CREATE TRIGGER trg_sop_tickets_updated
  BEFORE UPDATE ON public.soporte_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 4. Tabla de Mensajes y Conversaciones del Ticket (Con blindaje RLS estricto para Notas Internas)
CREATE TABLE IF NOT EXISTS public.soporte_mensajes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.soporte_tickets(id) ON DELETE CASCADE,
  negocio_id uuid NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  autor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  autor_nombre text NOT NULL,
  autor_rol text NOT NULL DEFAULT 'comercio' CHECK (autor_rol IN ('comercio', 'soporte')),
  mensaje text NOT NULL CHECK (char_length(trim(mensaje)) >= 1),
  es_nota_interna boolean NOT NULL DEFAULT false,
  adjuntos jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_soporte_mensajes_ticket ON public.soporte_mensajes(ticket_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_soporte_mensajes_negocio ON public.soporte_mensajes(negocio_id, created_at DESC);

ALTER TABLE public.soporte_mensajes ENABLE ROW LEVEL SECURITY;

-- Super Admin: acceso completo a mensajes públicos y notas internas
DROP POLICY IF EXISTS sop_msg_super_all ON public.soporte_mensajes;
CREATE POLICY sop_msg_super_all ON public.soporte_mensajes
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Comercio: LECTURA ESTRICTAMENTE BLOQUEADA PARA NOTAS INTERNAS (`es_nota_interna = false`)
DROP POLICY IF EXISTS sop_msg_tenant_select ON public.soporte_mensajes;
CREATE POLICY sop_msg_tenant_select ON public.soporte_mensajes
  FOR SELECT TO authenticated
  USING (
    negocio_id = public.current_negocio_id()
    AND es_nota_interna = false
  );

-- Comercio: solo puede insertar mensajes públicos (`es_nota_interna = false` y `autor_rol = 'comercio'`)
DROP POLICY IF EXISTS sop_msg_tenant_insert ON public.soporte_mensajes;
CREATE POLICY sop_msg_tenant_insert ON public.soporte_mensajes
  FOR INSERT TO authenticated
  WITH CHECK (
    negocio_id = public.current_negocio_id()
    AND es_nota_interna = false
    AND autor_rol = 'comercio'
  );

DO $$ BEGIN GRANT SELECT, INSERT ON public.soporte_mensajes TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT ALL ON public.soporte_mensajes TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 5. Bucket Privado de Almacenamiento para Archivos Adjuntos de Soporte (URLs firmadas)
INSERT INTO storage.buckets (id, name, public)
VALUES ('soporte-adjuntos', 'soporte-adjuntos', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "soporte_adjuntos_super_all" ON storage.objects;
CREATE POLICY "soporte_adjuntos_super_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'soporte-adjuntos' AND public.is_super_admin(auth.uid()))
  WITH CHECK (bucket_id = 'soporte-adjuntos' AND public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "soporte_adjuntos_tenant_insert" ON storage.objects;
CREATE POLICY "soporte_adjuntos_tenant_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'soporte-adjuntos'
    AND (storage.foldername(name))[1] = public.current_negocio_id()::text
  );

DROP POLICY IF EXISTS "soporte_adjuntos_tenant_select" ON storage.objects;
CREATE POLICY "soporte_adjuntos_tenant_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'soporte-adjuntos'
    AND (storage.foldername(name))[1] = public.current_negocio_id()::text
  );
