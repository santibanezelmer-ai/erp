-- Operix ERP - Esquema Consolidado Limpio

-- ----------------------------------------------------------------------------
-- Migration: 20260503015743_9e6019d4-c974-4c99-a5b0-a8be3f586e25.sql
-- ----------------------------------------------------------------------------
-- ═══════════════════════════════════════════════════════════════════════════
-- OperixERP — Schema adaptado a Lovable Auth
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── ENUM DE ROLES ─────────────────────────────────────────────────────────
CREATE TYPE public.app_role AS ENUM ('admin', 'cajero', 'vendedor', 'bodeguero');

-- ══════════════════════════════════════════════════════════════════════════
-- TABLAS DE IDENTIDAD
-- ══════════════════════════════════════════════════════════════════════════

-- ── negocios ───────────────────────────────────────────────────────────────
CREATE TABLE public.negocios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  plan        TEXT DEFAULT 'free' CHECK (plan IN ('free','paid','blocked')),
  rut         TEXT,
  direccion   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.negocios ENABLE ROW LEVEL SECURITY;

-- ── profiles (vincula auth.users con negocio) ──────────────────────────────
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  negocio_id  UUID REFERENCES public.negocios(id) ON DELETE SET NULL,
  nombre      TEXT NOT NULL,
  email       TEXT,
  activo      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_profiles_negocio ON public.profiles(negocio_id);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ── user_roles (separado por seguridad) ────────────────────────────────────
CREATE TABLE public.user_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  negocio_id  UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  role        app_role NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, negocio_id, role)
);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════════════════
-- FUNCIONES DE CONTEXTO Y SEGURIDAD
-- ══════════════════════════════════════════════════════════════════════════

-- Devuelve el negocio_id del usuario autenticado (lee del profile)
CREATE OR REPLACE FUNCTION public.current_negocio_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT negocio_id FROM public.profiles WHERE id = auth.uid()
$$;

-- Chequea si el usuario tiene un rol específico (evita recursión RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Trigger: crear profile automáticamente al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ══════════════════════════════════════════════════════════════════════════
-- POLICIES: identidad
-- ══════════════════════════════════════════════════════════════════════════

-- negocios: lectura pública (catálogo, registro), escritura solo admins de ese negocio
CREATE POLICY "negocios_public_read" ON public.negocios FOR SELECT USING (true);
CREATE POLICY "negocios_authenticated_insert" ON public.negocios FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "negocios_admin_update" ON public.negocios FOR UPDATE TO authenticated
  USING (id = current_negocio_id() AND has_role(auth.uid(), 'admin'))
  WITH CHECK (id = current_negocio_id());

-- profiles: cada usuario ve/edita el suyo; admins del negocio ven los del negocio
CREATE POLICY "profiles_self_read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR (negocio_id = current_negocio_id() AND has_role(auth.uid(), 'admin')));
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_admin_update" ON public.profiles FOR UPDATE TO authenticated
  USING (negocio_id = current_negocio_id() AND has_role(auth.uid(), 'admin'));

-- user_roles: el usuario ve sus roles; admins gestionan los del negocio
CREATE POLICY "roles_self_read" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (negocio_id = current_negocio_id() AND has_role(auth.uid(), 'admin')));
CREATE POLICY "roles_admin_insert" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (negocio_id = current_negocio_id() AND has_role(auth.uid(), 'admin'));
CREATE POLICY "roles_admin_delete" ON public.user_roles FOR DELETE TO authenticated
  USING (negocio_id = current_negocio_id() AND has_role(auth.uid(), 'admin'));

-- ══════════════════════════════════════════════════════════════════════════
-- TABLAS DEL NEGOCIO
-- ══════════════════════════════════════════════════════════════════════════

-- ── configuracion ──────────────────────────────────────────────────────────
CREATE TABLE public.configuracion (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id     UUID UNIQUE NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  business_name  TEXT,
  logo_url       TEXT,
  color_primary  TEXT,
  moneda         TEXT DEFAULT 'CLP',
  telefono       TEXT,
  rut            TEXT,
  direccion      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cfg_read" ON public.configuracion FOR SELECT USING (true); -- catálogo público
CREATE POLICY "cfg_write" ON public.configuracion FOR ALL TO authenticated
  USING (negocio_id = current_negocio_id()) WITH CHECK (negocio_id = current_negocio_id());

-- ── sucursales ─────────────────────────────────────────────────────────────
CREATE TABLE public.sucursales (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id  UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  direccion   TEXT,
  activa      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sucursales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suc_all" ON public.sucursales FOR ALL TO authenticated
  USING (negocio_id = current_negocio_id()) WITH CHECK (negocio_id = current_negocio_id());

-- ── productos ──────────────────────────────────────────────────────────────
CREATE TABLE public.productos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id       UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  nombre           TEXT NOT NULL,
  categoria        TEXT,
  proveedor        TEXT,
  precio_costo     NUMERIC(12,2) DEFAULT 0,
  precio_venta     NUMERIC(12,2) DEFAULT 0,
  stock            INTEGER DEFAULT 0,
  stock_min        INTEGER DEFAULT 5,
  codigo           TEXT,
  imagen_url       TEXT,
  notas            TEXT,
  unidad           TEXT DEFAULT 'unidad',
  cantidad_minima  NUMERIC(10,2) DEFAULT 1,
  variantes        JSONB,
  galeria          JSONB,
  activo           BOOLEAN NOT NULL DEFAULT true,
  sucursal_id      UUID REFERENCES public.sucursales(id) ON DELETE SET NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_prod_negocio   ON public.productos(negocio_id);
CREATE INDEX idx_prod_categoria ON public.productos(negocio_id, categoria);
CREATE INDEX idx_prod_codigo    ON public.productos(negocio_id, codigo) WHERE codigo IS NOT NULL;
CREATE INDEX idx_prod_activo    ON public.productos(negocio_id) WHERE activo = true;
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prod_read" ON public.productos FOR SELECT USING (true); -- catálogo público
CREATE POLICY "prod_write" ON public.productos FOR ALL TO authenticated
  USING (negocio_id = current_negocio_id()) WITH CHECK (negocio_id = current_negocio_id());
CREATE TRIGGER productos_updated_at BEFORE UPDATE ON public.productos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── clientes ───────────────────────────────────────────────────────────────
CREATE TABLE public.clientes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id   UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  nombre       TEXT NOT NULL,
  telefono     TEXT,
  email        TEXT,
  direccion    TEXT,
  notas        TEXT,
  deuda_total  NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cli_negocio ON public.clientes(negocio_id);
CREATE INDEX idx_cli_deuda   ON public.clientes(negocio_id) WHERE deuda_total > 0;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cli_all" ON public.clientes FOR ALL TO authenticated
  USING (negocio_id = current_negocio_id()) WITH CHECK (negocio_id = current_negocio_id());

-- ── ventas ─────────────────────────────────────────────────────────────────
CREATE TABLE public.ventas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id   UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  subtotal     NUMERIC(12,2),
  descuento    NUMERIC(5,2) DEFAULT 0,
  total        NUMERIC(12,2),
  pago         TEXT CHECK (pago IN ('efectivo','debito','credito','transferencia','fiado','cheque','otro')),
  efectivo_rec NUMERIC(12,2),
  estado       TEXT NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa','anulada')),
  cliente_id   UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  sucursal_id  UUID REFERENCES public.sucursales(id) ON DELETE SET NULL,
  usuario_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_vta_negocio ON public.ventas(negocio_id);
CREATE INDEX idx_vta_fecha   ON public.ventas(negocio_id, created_at DESC);
CREATE INDEX idx_vta_cliente ON public.ventas(negocio_id, cliente_id) WHERE cliente_id IS NOT NULL;
CREATE INDEX idx_vta_estado  ON public.ventas(negocio_id, estado);
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vta_all" ON public.ventas FOR ALL TO authenticated
  USING (negocio_id = current_negocio_id()) WITH CHECK (negocio_id = current_negocio_id());

-- ── detalle_ventas ─────────────────────────────────────────────────────────
CREATE TABLE public.detalle_ventas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id  UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  venta_id    UUID NOT NULL REFERENCES public.ventas(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES public.productos(id) ON DELETE SET NULL,
  nombre      TEXT,
  qty         INTEGER,
  precio      NUMERIC(12,2),
  descuento   NUMERIC(5,2) DEFAULT 0,
  subtotal    NUMERIC(12,2),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dtv_venta   ON public.detalle_ventas(venta_id);
CREATE INDEX idx_dtv_negocio ON public.detalle_ventas(negocio_id);
ALTER TABLE public.detalle_ventas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dtv_all" ON public.detalle_ventas FOR ALL TO authenticated
  USING (negocio_id = current_negocio_id()) WITH CHECK (negocio_id = current_negocio_id());

-- ── deudas ─────────────────────────────────────────────────────────────────
CREATE TABLE public.deudas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id  UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  cliente_id  UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
  venta_id    UUID REFERENCES public.ventas(id) ON DELETE SET NULL,
  monto       NUMERIC(12,2),
  tipo        TEXT CHECK (tipo IN ('deuda','pago')),
  notas       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_deu_cliente ON public.deudas(negocio_id, cliente_id);
ALTER TABLE public.deudas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deu_all" ON public.deudas FOR ALL TO authenticated
  USING (negocio_id = current_negocio_id()) WITH CHECK (negocio_id = current_negocio_id());

-- ── proveedores ────────────────────────────────────────────────────────────
CREATE TABLE public.proveedores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id  UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  telefono    TEXT, email TEXT, rut TEXT,
  activo      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prov_all" ON public.proveedores FOR ALL TO authenticated
  USING (negocio_id = current_negocio_id()) WITH CHECK (negocio_id = current_negocio_id());

-- ── proveedor_productos ────────────────────────────────────────────────────
CREATE TABLE public.proveedor_productos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id     UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  proveedor_id   UUID REFERENCES public.proveedores(id) ON DELETE CASCADE,
  producto_id    UUID REFERENCES public.productos(id) ON DELETE CASCADE,
  ultimo_precio  NUMERIC(12,2),
  ultima_fecha   DATE,
  activo         BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(negocio_id, proveedor_id, producto_id)
);
ALTER TABLE public.proveedor_productos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pp_all" ON public.proveedor_productos FOR ALL TO authenticated
  USING (negocio_id = current_negocio_id()) WITH CHECK (negocio_id = current_negocio_id());

-- ── compras ────────────────────────────────────────────────────────────────
CREATE TABLE public.compras (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id        UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  proveedor_id      UUID REFERENCES public.proveedores(id) ON DELETE SET NULL,
  proveedor_nombre  TEXT,
  fecha             DATE NOT NULL DEFAULT CURRENT_DATE,
  numero_doc        TEXT,
  tipo_doc          TEXT CHECK (tipo_doc IN ('factura','boleta','nota','otro')),
  subtotal          NUMERIC(12,2),
  descuento         NUMERIC(5,2) DEFAULT 0,
  total             NUMERIC(12,2),
  estado            TEXT NOT NULL DEFAULT 'completada' CHECK (estado IN ('completada','credito','pendiente')),
  observaciones     TEXT,
  usuario_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cmp_negocio ON public.compras(negocio_id);
CREATE INDEX idx_cmp_fecha   ON public.compras(negocio_id, fecha DESC);
ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cmp_all" ON public.compras FOR ALL TO authenticated
  USING (negocio_id = current_negocio_id()) WITH CHECK (negocio_id = current_negocio_id());

-- ── compra_detalle ─────────────────────────────────────────────────────────
CREATE TABLE public.compra_detalle (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id       UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  compra_id        UUID NOT NULL REFERENCES public.compras(id) ON DELETE CASCADE,
  producto_id      UUID REFERENCES public.productos(id) ON DELETE SET NULL,
  nombre_producto  TEXT,
  cantidad         INTEGER,
  precio_unitario  NUMERIC(12,2),
  total_linea      NUMERIC(12,2),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.compra_detalle ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cmpd_all" ON public.compra_detalle FOR ALL TO authenticated
  USING (negocio_id = current_negocio_id()) WITH CHECK (negocio_id = current_negocio_id());

-- ── cuentas_pagar ──────────────────────────────────────────────────────────
CREATE TABLE public.cuentas_pagar (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id   UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  proveedor    TEXT, descripcion TEXT,
  monto        NUMERIC(12,2),
  vencimiento  DATE,
  estado       TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','pagada','parcial')),
  usuario_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cuentas_pagar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cp_all" ON public.cuentas_pagar FOR ALL TO authenticated
  USING (negocio_id = current_negocio_id()) WITH CHECK (negocio_id = current_negocio_id());

-- ── flujo_caja ─────────────────────────────────────────────────────────────
CREATE TABLE public.flujo_caja (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id   UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  tipo         TEXT CHECK (tipo IN ('apertura','ingreso','egreso','cierre')),
  monto        NUMERIC(12,2),
  descripcion  TEXT,
  usuario_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fc_negocio ON public.flujo_caja(negocio_id, created_at DESC);
ALTER TABLE public.flujo_caja ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fc_all" ON public.flujo_caja FOR ALL TO authenticated
  USING (negocio_id = current_negocio_id()) WITH CHECK (negocio_id = current_negocio_id());

-- ── contabilidad ───────────────────────────────────────────────────────────
CREATE TABLE public.contabilidad (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id   UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  tipo         TEXT CHECK (tipo IN ('ingreso','egreso')),
  categoria    TEXT, descripcion TEXT,
  monto        NUMERIC(12,2),
  fecha        DATE NOT NULL DEFAULT CURRENT_DATE,
  usuario_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contabilidad ENABLE ROW LEVEL SECURITY;
CREATE POLICY "con_all" ON public.contabilidad FOR ALL TO authenticated
  USING (negocio_id = current_negocio_id()) WITH CHECK (negocio_id = current_negocio_id());

-- ── stock_movements ────────────────────────────────────────────────────────
CREATE TABLE public.stock_movements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id   UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  producto_id  UUID REFERENCES public.productos(id) ON DELETE SET NULL,
  tipo         TEXT CHECK (tipo IN ('venta','compra','ajuste','devolucion','entrada_manual')),
  cantidad     INTEGER,
  stock_antes  INTEGER,
  ref_id       TEXT, ref_tipo TEXT, notas TEXT,
  usuario_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sm_producto ON public.stock_movements(negocio_id, producto_id);
CREATE INDEX idx_sm_fecha    ON public.stock_movements(negocio_id, created_at DESC);
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "smov_read" ON public.stock_movements FOR SELECT TO authenticated
  USING (negocio_id = current_negocio_id());
CREATE POLICY "smov_insert" ON public.stock_movements FOR INSERT TO authenticated
  WITH CHECK (negocio_id = current_negocio_id());

-- ── ajustes_inventario ─────────────────────────────────────────────────────
CREATE TABLE public.ajustes_inventario (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id  UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  nombre      TEXT,
  estado      TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador','confirmado')),
  notas       TEXT,
  usuario_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ajustes_inventario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aj_all" ON public.ajustes_inventario FOR ALL TO authenticated
  USING (negocio_id = current_negocio_id()) WITH CHECK (negocio_id = current_negocio_id());

-- ── ajuste_lineas ──────────────────────────────────────────────────────────
CREATE TABLE public.ajuste_lineas (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id     UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  ajuste_id      UUID NOT NULL REFERENCES public.ajustes_inventario(id) ON DELETE CASCADE,
  producto_id    UUID REFERENCES public.productos(id) ON DELETE SET NULL,
  nombre         TEXT,
  stock_actual   INTEGER NOT NULL DEFAULT 0,
  stock_contado  INTEGER NOT NULL DEFAULT 0,
  diferencia     INTEGER GENERATED ALWAYS AS (stock_contado - stock_actual) STORED,
  motivo         TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ajl_ajuste ON public.ajuste_lineas(ajuste_id);
ALTER TABLE public.ajuste_lineas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ajl_all" ON public.ajuste_lineas FOR ALL TO authenticated
  USING (negocio_id = current_negocio_id()) WITH CHECK (negocio_id = current_negocio_id());

-- ── reorder_rules ──────────────────────────────────────────────────────────
CREATE TABLE public.reorder_rules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id   UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  producto_id  UUID REFERENCES public.productos(id) ON DELETE CASCADE,
  min_stock    INTEGER NOT NULL DEFAULT 5,
  reorder_qty  INTEGER NOT NULL DEFAULT 10,
  activa       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reorder_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rr_all" ON public.reorder_rules FOR ALL TO authenticated
  USING (negocio_id = current_negocio_id()) WITH CHECK (negocio_id = current_negocio_id());

-- ── historial_precios ──────────────────────────────────────────────────────
CREATE TABLE public.historial_precios (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id   UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  producto_id  UUID REFERENCES public.productos(id) ON DELETE CASCADE,
  precio_nuevo NUMERIC(12,2),
  precio_ant   NUMERIC(12,2),
  costo_nuevo  NUMERIC(12,2),
  usuario_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.historial_precios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hp_read" ON public.historial_precios FOR SELECT TO authenticated
  USING (negocio_id = current_negocio_id());
CREATE POLICY "hp_insert" ON public.historial_precios FOR INSERT TO authenticated
  WITH CHECK (negocio_id = current_negocio_id());

-- ── devoluciones ───────────────────────────────────────────────────────────
CREATE TABLE public.devoluciones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id      UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  venta_id        UUID REFERENCES public.ventas(id) ON DELETE SET NULL,
  producto_id     UUID REFERENCES public.productos(id) ON DELETE SET NULL,
  nombre          TEXT,
  qty             INTEGER,
  monto           NUMERIC(12,2),
  motivo          TEXT,
  restituir_stock BOOLEAN NOT NULL DEFAULT false,
  usuario_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.devoluciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_all" ON public.devoluciones FOR ALL TO authenticated
  USING (negocio_id = current_negocio_id()) WITH CHECK (negocio_id = current_negocio_id());

-- ── pedidos_whatsapp ───────────────────────────────────────────────────────
CREATE TABLE public.pedidos_whatsapp (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id        UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  cliente_nombre    TEXT,
  cliente_telefono  TEXT,
  notas             TEXT,
  items             JSONB,
  total             NUMERIC(12,2),
  estado            TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','confirmado','completado','cancelado')),
  saved_at          TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pedidos_whatsapp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pw_public_insert" ON public.pedidos_whatsapp FOR INSERT WITH CHECK (true); -- catálogo público crea pedidos
CREATE POLICY "pw_read" ON public.pedidos_whatsapp FOR SELECT TO authenticated
  USING (negocio_id = current_negocio_id());
CREATE POLICY "pw_update" ON public.pedidos_whatsapp FOR UPDATE TO authenticated
  USING (negocio_id = current_negocio_id()) WITH CHECK (negocio_id = current_negocio_id());

-- ── audit_logs ─────────────────────────────────────────────────────────────
CREATE TABLE public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id  UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  usuario_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action      TEXT,
  entity_type TEXT,
  entity_id   TEXT,
  before_data JSONB,
  after_data  JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_negocio ON public.audit_logs(negocio_id, created_at DESC);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_read" ON public.audit_logs FOR SELECT TO authenticated
  USING (negocio_id = current_negocio_id() AND has_role(auth.uid(), 'admin'));
CREATE POLICY "audit_insert" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (negocio_id = current_negocio_id());
-- audit_logs es inmutable: sin UPDATE ni DELETE

-- ----------------------------------------------------------------------------
-- Migration: 20260503015806_91c66792-b50c-46fb-9ee7-5b7468ef01bb.sql
-- ----------------------------------------------------------------------------
-- Fijar search_path en update_updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- handle_new_user solo debe ejecutarse desde el trigger, no desde la API
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- Migration: 20260503015833_86a92a66-2a45-4a8d-8fca-2beb845228f3.sql
-- ----------------------------------------------------------------------------
-- Revocar ejecución pública de funciones SECURITY DEFINER (solo authenticated/service)
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.current_negocio_id() FROM anon, public; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.current_negocio_id() TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Endurecer policies de inserción
DROP POLICY IF EXISTS "negocios_authenticated_insert" ON public.negocios;
CREATE POLICY "negocios_authenticated_insert" ON public.negocios
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND nombre IS NOT NULL AND slug IS NOT NULL);

DROP POLICY IF EXISTS "pw_public_insert" ON public.pedidos_whatsapp;
CREATE POLICY "pw_public_insert" ON public.pedidos_whatsapp
  FOR INSERT
  WITH CHECK (
    negocio_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.negocios WHERE id = negocio_id)
    AND cliente_nombre IS NOT NULL
  );

-- ----------------------------------------------------------------------------
-- Migration: 20260503020032_aac81b78-4863-4b88-ae1e-de6bcd11d6ee.sql
-- ----------------------------------------------------------------------------

-- Function to bootstrap a new negocio for the current user
CREATE OR REPLACE FUNCTION public.create_negocio_for_user(_nombre text, _slug text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _negocio_id uuid;
  _existing uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT negocio_id INTO _existing FROM public.profiles WHERE id = _uid;
  IF _existing IS NOT NULL THEN
    RETURN _existing;
  END IF;

  INSERT INTO public.negocios (nombre, slug)
  VALUES (_nombre, _slug)
  RETURNING id INTO _negocio_id;

  UPDATE public.profiles SET negocio_id = _negocio_id WHERE id = _uid;

  INSERT INTO public.user_roles (user_id, role, negocio_id)
  VALUES (_uid, 'admin', _negocio_id);

  INSERT INTO public.sucursales (nombre, negocio_id)
  VALUES ('Principal', _negocio_id);

  RETURN _negocio_id;
END;
$$;


-- ----------------------------------------------------------------------------
-- Migration: 20260503020107_7b8fb99a-c15f-463a-ac20-099bacac712a.sql
-- ----------------------------------------------------------------------------
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.create_negocio_for_user(text, text) FROM PUBLIC, anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.create_negocio_for_user(text, text) TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- Migration: 20260503023826_6af36004-ba12-438a-b6d0-ccf0c811748f.sql
-- ----------------------------------------------------------------------------

-- 1) NEGOCIOS: revoke sensitive columns from anon; keep id, nombre, slug public
DO $$ BEGIN REVOKE SELECT ON public.negocios FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (id, nombre, slug, plan, created_at) ON public.negocios TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 2) CONFIGURACION: remove public read; only authenticated members of the negocio can read
DROP POLICY IF EXISTS cfg_read ON public.configuracion;
CREATE POLICY cfg_read ON public.configuracion
  FOR SELECT TO authenticated
  USING (negocio_id = public.current_negocio_id());

-- 3) PRODUCTOS: keep public read for catalog but hide cost / internal columns from anon
DO $$ BEGIN REVOKE SELECT ON public.productos FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (
  id, nombre, precio_venta, stock, categoria, imagen_url,
  unidad, codigo, activo, negocio_id, sucursal_id, variantes, galeria, created_at, updated_at
) ON public.productos TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 4) HAS_ROLE: add negocio-scoped overload and update policies that use it
CREATE OR REPLACE FUNCTION public.has_role_in_negocio(_user_id uuid, _role public.app_role, _negocio_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role AND negocio_id = _negocio_id
  )
$$;

-- Recreate policies that previously used has_role() to use negocio-scoped check
DROP POLICY IF EXISTS negocios_admin_update ON public.negocios;
CREATE POLICY negocios_admin_update ON public.negocios
  FOR UPDATE TO authenticated
  USING (id = public.current_negocio_id() AND public.has_role_in_negocio(auth.uid(), 'admin', id))
  WITH CHECK (id = public.current_negocio_id());

DROP POLICY IF EXISTS audit_read ON public.audit_logs;
CREATE POLICY audit_read ON public.audit_logs
  FOR SELECT TO authenticated
  USING (negocio_id = public.current_negocio_id() AND public.has_role_in_negocio(auth.uid(), 'admin', negocio_id));

DROP POLICY IF EXISTS roles_admin_insert ON public.user_roles;
CREATE POLICY roles_admin_insert ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (negocio_id = public.current_negocio_id() AND public.has_role_in_negocio(auth.uid(), 'admin', negocio_id));

DROP POLICY IF EXISTS roles_admin_delete ON public.user_roles;
CREATE POLICY roles_admin_delete ON public.user_roles
  FOR DELETE TO authenticated
  USING (negocio_id = public.current_negocio_id() AND public.has_role_in_negocio(auth.uid(), 'admin', negocio_id));

DROP POLICY IF EXISTS roles_self_read ON public.user_roles;
CREATE POLICY roles_self_read ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (negocio_id = public.current_negocio_id() AND public.has_role_in_negocio(auth.uid(), 'admin', negocio_id)));

DROP POLICY IF EXISTS profiles_admin_update ON public.profiles;
CREATE POLICY profiles_admin_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (negocio_id = public.current_negocio_id() AND public.has_role_in_negocio(auth.uid(), 'admin', negocio_id));

DROP POLICY IF EXISTS profiles_self_read ON public.profiles;
CREATE POLICY profiles_self_read ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR (negocio_id = public.current_negocio_id() AND public.has_role_in_negocio(auth.uid(), 'admin', negocio_id)));

-- 5) Restrict EXECUTE on internal SECURITY DEFINER functions
DO $$ BEGIN REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
-- current_negocio_id is invoked from policies (definer); not needed by clients
DO $$ BEGIN REVOKE ALL ON FUNCTION public.current_negocio_id() FROM PUBLIC, anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
-- create_negocio_for_user must remain callable by authenticated users (onboarding RPC)
DO $$ BEGIN REVOKE ALL ON FUNCTION public.create_negocio_for_user(text, text) FROM PUBLIC, anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.create_negocio_for_user(text, text) TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 6) Pedidos WhatsApp: add basic length validation to limit spam payloads
DROP POLICY IF EXISTS pw_public_insert ON public.pedidos_whatsapp;
CREATE POLICY pw_public_insert ON public.pedidos_whatsapp
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    negocio_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.negocios WHERE negocios.id = pedidos_whatsapp.negocio_id)
    AND cliente_nombre IS NOT NULL
    AND char_length(cliente_nombre) BETWEEN 1 AND 120
    AND (cliente_telefono IS NULL OR char_length(cliente_telefono) <= 40)
    AND (notas IS NULL OR char_length(notas) <= 1000)
  );


-- ----------------------------------------------------------------------------
-- Migration: 20260503023844_e3d1ae26-4d14-4036-9e0f-5bbc9fca7fa2.sql
-- ----------------------------------------------------------------------------

DO $$ BEGIN REVOKE ALL ON FUNCTION public.has_role_in_negocio(uuid, public.app_role, uuid) FROM PUBLIC, anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ----------------------------------------------------------------------------
-- Migration: 20260503024612_b497f207-df04-4c05-b050-38bd225826aa.sql
-- ----------------------------------------------------------------------------
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.current_negocio_id() TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.has_role_in_negocio(uuid, app_role, uuid) TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.create_negocio_for_user(text, text) TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- Migration: 20260503025244_da193672-e278-41f6-ab80-3a0aaa90b07a.sql
-- ----------------------------------------------------------------------------
-- PRODUCTOS: revoke broad anon access, grant only safe catalog columns
DO $$ BEGIN REVOKE SELECT ON public.productos FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (
  id, negocio_id, sucursal_id, nombre, categoria, precio_venta,
  stock, imagen_url, unidad, codigo, activo, variantes, galeria,
  cantidad_minima, created_at, updated_at
) ON public.productos TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- NEGOCIOS: revoke broad anon access, grant only public-safe columns
DO $$ BEGIN REVOKE SELECT ON public.negocios FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (id, nombre, slug, plan, created_at) ON public.negocios TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- Migration: 20260503025847_8f1d2f84-aaef-47cd-b618-666b79c5ce2e.sql
-- ----------------------------------------------------------------------------
ALTER TABLE public.pedidos_whatsapp REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos_whatsapp;

-- ----------------------------------------------------------------------------
-- Migration: 20260503030615_183d2902-8d7a-4b90-9a1b-1fe07aa455a1.sql
-- ----------------------------------------------------------------------------

ALTER TABLE public.pedidos_whatsapp
  ADD COLUMN IF NOT EXISTS stock_reservado boolean NOT NULL DEFAULT false;

-- Función pública (anon) para crear pedido y reservar stock atómicamente
CREATE OR REPLACE FUNCTION public.crear_pedido_catalogo(
  _negocio_id uuid,
  _cliente_nombre text,
  _cliente_telefono text,
  _notas text,
  _items jsonb,
  _total numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pedido_id uuid;
  _it jsonb;
  _pid uuid;
  _qty integer;
  _stock_actual integer;
BEGIN
  -- Validaciones básicas
  IF _negocio_id IS NULL OR NOT EXISTS (SELECT 1 FROM negocios WHERE id = _negocio_id) THEN
    RAISE EXCEPTION 'Negocio inválido';
  END IF;
  IF _cliente_nombre IS NULL OR char_length(_cliente_nombre) < 1 OR char_length(_cliente_nombre) > 120 THEN
    RAISE EXCEPTION 'Nombre inválido';
  END IF;
  IF _cliente_telefono IS NOT NULL AND char_length(_cliente_telefono) > 40 THEN
    RAISE EXCEPTION 'Teléfono inválido';
  END IF;
  IF _notas IS NOT NULL AND char_length(_notas) > 1000 THEN
    RAISE EXCEPTION 'Notas demasiado largas';
  END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Pedido sin items';
  END IF;

  -- Validar stock disponible para todos los items
  FOR _it IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    _pid := (_it->>'id')::uuid;
    _qty := COALESCE((_it->>'qty')::int, 0);
    IF _qty <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida';
    END IF;
    SELECT stock INTO _stock_actual FROM productos WHERE id = _pid AND negocio_id = _negocio_id;
    IF _stock_actual IS NULL THEN
      RAISE EXCEPTION 'Producto no encontrado';
    END IF;
    IF _stock_actual < _qty THEN
      RAISE EXCEPTION 'Stock insuficiente para %', (_it->>'nombre');
    END IF;
  END LOOP;

  -- Insertar pedido
  INSERT INTO pedidos_whatsapp (negocio_id, cliente_nombre, cliente_telefono, notas, items, total, stock_reservado)
  VALUES (_negocio_id, _cliente_nombre, NULLIF(_cliente_telefono, ''), NULLIF(_notas, ''), _items, _total, true)
  RETURNING id INTO _pedido_id;

  -- Descontar stock (reserva) y registrar movimiento
  FOR _it IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    _pid := (_it->>'id')::uuid;
    _qty := (_it->>'qty')::int;
    SELECT stock INTO _stock_actual FROM productos WHERE id = _pid;
    UPDATE productos SET stock = stock - _qty WHERE id = _pid;
    INSERT INTO stock_movements (negocio_id, producto_id, tipo, cantidad, stock_antes, ref_id, ref_tipo, notas)
    VALUES (_negocio_id, _pid, 'reserva', -_qty, _stock_actual, _pedido_id::text, 'pedido_catalogo', 'Reserva por pedido del catálogo');
  END LOOP;

  RETURN _pedido_id;
END;
$$;

DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.crear_pedido_catalogo(uuid, text, text, text, jsonb, numeric) TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Función para cambiar estado y restaurar stock si se cancela
CREATE OR REPLACE FUNCTION public.cambiar_estado_pedido(_pedido_id uuid, _nuevo_estado text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ped pedidos_whatsapp%ROWTYPE;
  _it jsonb;
  _pid uuid;
  _qty integer;
  _stock_actual integer;
BEGIN
  IF _nuevo_estado NOT IN ('pendiente','confirmado','completado','cancelado') THEN
    RAISE EXCEPTION 'Estado inválido';
  END IF;

  SELECT * INTO _ped FROM pedidos_whatsapp WHERE id = _pedido_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado';
  END IF;

  -- Verificar acceso multi-tenant
  IF _ped.negocio_id <> current_negocio_id() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- Si se cancela y aún hay stock reservado, devolverlo
  IF _nuevo_estado = 'cancelado' AND _ped.stock_reservado = true THEN
    FOR _it IN SELECT * FROM jsonb_array_elements(COALESCE(_ped.items, '[]'::jsonb))
    LOOP
      _pid := (_it->>'id')::uuid;
      _qty := COALESCE((_it->>'qty')::int, 0);
      IF _pid IS NOT NULL AND _qty > 0 THEN
        SELECT stock INTO _stock_actual FROM productos WHERE id = _pid;
        IF _stock_actual IS NOT NULL THEN
          UPDATE productos SET stock = stock + _qty WHERE id = _pid;
          INSERT INTO stock_movements (negocio_id, producto_id, tipo, cantidad, stock_antes, ref_id, ref_tipo, notas)
          VALUES (_ped.negocio_id, _pid, 'devolucion_reserva', _qty, _stock_actual, _pedido_id::text, 'pedido_catalogo', 'Restauración por cancelación');
        END IF;
      END IF;
    END LOOP;
    UPDATE pedidos_whatsapp SET estado = _nuevo_estado, stock_reservado = false WHERE id = _pedido_id;
  ELSE
    UPDATE pedidos_whatsapp SET estado = _nuevo_estado WHERE id = _pedido_id;
  END IF;
END;
$$;

DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.cambiar_estado_pedido(uuid, text) TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ----------------------------------------------------------------------------
-- Migration: 20260503031154_1496ad1e-3187-47dc-9158-b35af4f8258c.sql
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cambiar_estado_pedido(_pedido_id uuid, _nuevo_estado text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ped pedidos_whatsapp%ROWTYPE;
  _it jsonb;
  _pid uuid;
  _qty integer;
  _stock_actual integer;
BEGIN
  IF _nuevo_estado NOT IN ('pendiente','confirmado','completado','cancelado','devuelto') THEN
    RAISE EXCEPTION 'Estado inválido';
  END IF;

  SELECT * INTO _ped FROM pedidos_whatsapp WHERE id = _pedido_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado';
  END IF;

  IF _ped.negocio_id <> current_negocio_id() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- Cancelado o devuelto: restaurar stock si aún está reservado/descontado
  IF (_nuevo_estado = 'cancelado' OR _nuevo_estado = 'devuelto') AND _ped.stock_reservado = true THEN
    FOR _it IN SELECT * FROM jsonb_array_elements(COALESCE(_ped.items, '[]'::jsonb))
    LOOP
      _pid := (_it->>'id')::uuid;
      _qty := COALESCE((_it->>'qty')::int, 0);
      IF _pid IS NOT NULL AND _qty > 0 THEN
        SELECT stock INTO _stock_actual FROM productos WHERE id = _pid;
        IF _stock_actual IS NOT NULL THEN
          UPDATE productos SET stock = stock + _qty WHERE id = _pid;
          INSERT INTO stock_movements (negocio_id, producto_id, tipo, cantidad, stock_antes, ref_id, ref_tipo, notas)
          VALUES (_ped.negocio_id, _pid,
            CASE WHEN _nuevo_estado = 'devuelto' THEN 'devolucion' ELSE 'devolucion_reserva' END,
            _qty, _stock_actual, _pedido_id::text, 'pedido_catalogo',
            CASE WHEN _nuevo_estado = 'devuelto' THEN 'Devolución de pedido' ELSE 'Restauración por cancelación' END);
        END IF;
      END IF;
    END LOOP;
    UPDATE pedidos_whatsapp SET estado = _nuevo_estado, stock_reservado = false WHERE id = _pedido_id;
  ELSE
    UPDATE pedidos_whatsapp SET estado = _nuevo_estado WHERE id = _pedido_id;
  END IF;
END;
$$;


-- ----------------------------------------------------------------------------
-- Migration: 20260503031428_39e42596-6346-4a60-8824-034564287031.sql
-- ----------------------------------------------------------------------------

ALTER TABLE public.pedidos_whatsapp
  ADD COLUMN IF NOT EXISTS motivo_devolucion text;

-- Endurecer permisos: revocar de PUBLIC y conceder solo a roles necesarios
DO $$ BEGIN REVOKE ALL ON FUNCTION public.crear_pedido_catalogo(uuid, text, text, text, jsonb, numeric) FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.crear_pedido_catalogo(uuid, text, text, text, jsonb, numeric) TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Reemplazar firma anterior y crear nueva con _motivo
DROP FUNCTION IF EXISTS public.cambiar_estado_pedido(uuid, text);

CREATE OR REPLACE FUNCTION public.cambiar_estado_pedido(
  _pedido_id uuid,
  _nuevo_estado text,
  _motivo text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ped pedidos_whatsapp%ROWTYPE;
  _it jsonb;
  _pid uuid;
  _qty integer;
  _stock_actual integer;
BEGIN
  IF _nuevo_estado NOT IN ('pendiente','confirmado','completado','cancelado','devuelto') THEN
    RAISE EXCEPTION 'Estado inválido';
  END IF;

  SELECT * INTO _ped FROM pedidos_whatsapp WHERE id = _pedido_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado';
  END IF;

  IF _ped.negocio_id <> current_negocio_id() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- Idempotencia: no permitir re-procesar
  IF _ped.estado = _nuevo_estado THEN
    RAISE EXCEPTION 'El pedido ya se encuentra en estado %', _nuevo_estado;
  END IF;

  -- Validar motivo cuando se devuelve
  IF _nuevo_estado = 'devuelto' THEN
    IF _ped.estado <> 'completado' THEN
      RAISE EXCEPTION 'Solo se pueden devolver pedidos completados';
    END IF;
    IF _motivo IS NULL OR char_length(trim(_motivo)) < 3 THEN
      RAISE EXCEPTION 'Debe indicar un motivo de devolución';
    END IF;
    IF char_length(_motivo) > 500 THEN
      RAISE EXCEPTION 'Motivo demasiado largo';
    END IF;
  END IF;

  -- Restaurar stock solo si aún hay reserva activa (evita doble restauración)
  IF (_nuevo_estado = 'cancelado' OR _nuevo_estado = 'devuelto') AND _ped.stock_reservado = true THEN
    FOR _it IN SELECT * FROM jsonb_array_elements(COALESCE(_ped.items, '[]'::jsonb))
    LOOP
      _pid := (_it->>'id')::uuid;
      _qty := COALESCE((_it->>'qty')::int, 0);
      IF _pid IS NOT NULL AND _qty > 0 THEN
        SELECT stock INTO _stock_actual FROM productos WHERE id = _pid;
        IF _stock_actual IS NOT NULL THEN
          UPDATE productos SET stock = stock + _qty WHERE id = _pid;
          INSERT INTO stock_movements (negocio_id, producto_id, tipo, cantidad, stock_antes, ref_id, ref_tipo, notas)
          VALUES (_ped.negocio_id, _pid,
            CASE WHEN _nuevo_estado = 'devuelto' THEN 'devolucion' ELSE 'devolucion_reserva' END,
            _qty, _stock_actual, _pedido_id::text, 'pedido_catalogo',
            CASE WHEN _nuevo_estado = 'devuelto' THEN COALESCE(_motivo, 'Devolución de pedido') ELSE 'Restauración por cancelación' END);
        END IF;
      END IF;
    END LOOP;
    UPDATE pedidos_whatsapp
      SET estado = _nuevo_estado,
          stock_reservado = false,
          motivo_devolucion = CASE WHEN _nuevo_estado = 'devuelto' THEN _motivo ELSE motivo_devolucion END
      WHERE id = _pedido_id;
  ELSIF _nuevo_estado = 'devuelto' AND _ped.stock_reservado = false THEN
    RAISE EXCEPTION 'Esta devolución ya fue procesada anteriormente';
  ELSE
    UPDATE pedidos_whatsapp SET estado = _nuevo_estado WHERE id = _pedido_id;
  END IF;
END;
$$;

DO $$ BEGIN REVOKE ALL ON FUNCTION public.cambiar_estado_pedido(uuid, text, text) FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.cambiar_estado_pedido(uuid, text, text) TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ----------------------------------------------------------------------------
-- Migration: 20260503033028_2af5c4a3-ee90-4a18-a0af-2a2ceec7b735.sql
-- ----------------------------------------------------------------------------
-- Agregar rol super_admin
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

-- ----------------------------------------------------------------------------
-- Migration: 20260503033114_51bb22ce-40e9-4cb0-a3e3-f89fbe7a7da1.sql
-- ----------------------------------------------------------------------------
-- 1. Tabla de suscripciones por negocio
CREATE TABLE IF NOT EXISTS public.suscripciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT 'free',
  estado text NOT NULL DEFAULT 'activa', -- activa, suspendida, cancelada, trial
  inicio_at timestamptz NOT NULL DEFAULT now(),
  vence_at timestamptz,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.suscripciones ENABLE ROW LEVEL SECURITY;

-- 2. Función auxiliar: ¿es super admin?
CREATE OR REPLACE FUNCTION public.is_super_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND role = 'super_admin'
  )
$$;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 3. Políticas RLS para suscripciones
CREATE POLICY susc_super_all ON public.suscripciones
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY susc_owner_read ON public.suscripciones
  FOR SELECT TO authenticated
  USING (negocio_id = current_negocio_id());

-- 4. Política extra en negocios para super_admin (lectura/edición global)
CREATE POLICY negocios_super_all ON public.negocios
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 5. Política extra en profiles para super admin (ver todos los usuarios)
CREATE POLICY profiles_super_read ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- 6. Trigger handle_new_user actualizado: asigna super_admin si es el email designado
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.email),
    NEW.email
  );

  -- Asignar super_admin al email designado
  IF lower(NEW.email) = 'santibanez.elmer@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role, negocio_id)
    VALUES (NEW.id, 'super_admin', NULL)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Si el usuario ya existe, asignarle el rol ahora
DO $$
DECLARE _uid uuid;
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = 'santibanez.elmer@gmail.com' LIMIT 1;
  IF _uid IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role, negocio_id)
    VALUES (_uid, 'super_admin', NULL)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- 8. Permitir que user_roles inserte/lea super_admin (la política existente ya cubre lectura propia)
-- Política extra para que super_admin pueda ver/gestionar todos los roles
CREATE POLICY roles_super_all ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 9. Función para que el super_admin actualice plan/estado de suscripción
CREATE OR REPLACE FUNCTION public.sa_set_suscripcion(
  _negocio_id uuid,
  _plan text,
  _estado text,
  _vence_at timestamptz,
  _notas text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _id uuid;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF _plan NOT IN ('free','pro','enterprise') THEN
    RAISE EXCEPTION 'Plan inválido';
  END IF;
  IF _estado NOT IN ('activa','suspendida','cancelada','trial') THEN
    RAISE EXCEPTION 'Estado inválido';
  END IF;

  INSERT INTO public.suscripciones (negocio_id, plan, estado, vence_at, notas)
  VALUES (_negocio_id, _plan, _estado, _vence_at, _notas)
  ON CONFLICT (negocio_id) DO UPDATE
    SET plan = EXCLUDED.plan,
        estado = EXCLUDED.estado,
        vence_at = EXCLUDED.vence_at,
        notas = COALESCE(EXCLUDED.notas, suscripciones.notas),
        updated_at = now()
  RETURNING id INTO _id;

  -- Sincronizar plan en negocios
  UPDATE public.negocios SET plan = _plan WHERE id = _negocio_id;

  RETURN _id;
END;
$$;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.sa_set_suscripcion(uuid,text,text,timestamptz,text) FROM PUBLIC, anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.sa_set_suscripcion(uuid,text,text,timestamptz,text) TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 10. Función para eliminar negocio (cascada manual de datos básicos)
CREATE OR REPLACE FUNCTION public.sa_eliminar_negocio(_negocio_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  DELETE FROM public.suscripciones WHERE negocio_id = _negocio_id;
  DELETE FROM public.user_roles WHERE negocio_id = _negocio_id;
  UPDATE public.profiles SET negocio_id = NULL WHERE negocio_id = _negocio_id;
  DELETE FROM public.negocios WHERE id = _negocio_id;
END;
$$;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.sa_eliminar_negocio(uuid) FROM PUBLIC, anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.sa_eliminar_negocio(uuid) TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 11. Función de KPIs globales
CREATE OR REPLACE FUNCTION public.sa_kpis_globales()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _r jsonb;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT jsonb_build_object(
    'total_negocios', (SELECT count(*) FROM negocios),
    'total_usuarios', (SELECT count(*) FROM profiles),
    'total_productos', (SELECT count(*) FROM productos WHERE activo = true),
    'total_ventas', (SELECT count(*) FROM ventas),
    'ingresos_totales', (SELECT COALESCE(sum(total),0) FROM ventas),
    'por_plan', (
      SELECT jsonb_object_agg(plan, c) FROM (
        SELECT COALESCE(plan,'free') AS plan, count(*) AS c FROM negocios GROUP BY plan
      ) t
    ),
    'por_estado_susc', (
      SELECT jsonb_object_agg(estado, c) FROM (
        SELECT estado, count(*) AS c FROM suscripciones GROUP BY estado
      ) t
    )
  ) INTO _r;
  RETURN _r;
END;
$$;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.sa_kpis_globales() FROM PUBLIC, anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.sa_kpis_globales() TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 12. Trigger updated_at en suscripciones
CREATE TRIGGER trg_susc_updated
  BEFORE UPDATE ON public.suscripciones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 13. Crear suscripciones por defecto para negocios existentes
INSERT INTO public.suscripciones (negocio_id, plan, estado)
SELECT id, COALESCE(plan,'free'), 'activa' FROM public.negocios
ON CONFLICT (negocio_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Migration: 20260503034445_697bf13a-4018-40da-a3c5-6caf2e171747.sql
-- ----------------------------------------------------------------------------
ALTER TABLE public.user_roles ALTER COLUMN negocio_id DROP NOT NULL;

-- ----------------------------------------------------------------------------
-- Migration: 20260503035252_f894a124-e761-47c4-b273-e18f80d73225.sql
-- ----------------------------------------------------------------------------
-- Revocar EXECUTE público de funciones sensibles y otorgar solo a roles correctos
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.cambiar_estado_pedido(uuid, text, text) FROM PUBLIC, anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.cambiar_estado_pedido(uuid, text, text) TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.create_negocio_for_user(text, text) FROM PUBLIC, anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.create_negocio_for_user(text, text) TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.sa_kpis_globales() FROM PUBLIC, anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.sa_kpis_globales() TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.sa_set_suscripcion(uuid, text, text, timestamptz, text) FROM PUBLIC, anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.sa_set_suscripcion(uuid, text, text, timestamptz, text) TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.sa_eliminar_negocio(uuid) FROM PUBLIC, anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.sa_eliminar_negocio(uuid) TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.has_role_in_negocio(uuid, app_role, uuid) FROM PUBLIC, anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.has_role_in_negocio(uuid, app_role, uuid) TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.current_negocio_id() FROM PUBLIC, anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.current_negocio_id() TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- crear_pedido_catalogo SÍ debe seguir disponible para anon (catálogo público)
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.crear_pedido_catalogo(uuid, text, text, text, jsonb, numeric) FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.crear_pedido_catalogo(uuid, text, text, text, jsonb, numeric) TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- Migration: 20260503035930_312d970d-08ae-4110-99a8-da387b7b757d.sql
-- ----------------------------------------------------------------------------

-- 1. tipo_negocio
ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS tipo_negocio text NOT NULL DEFAULT 'tienda'
  CHECK (tipo_negocio IN ('tienda','restaurant'));

-- 2. Áreas (salón, barra, cocina, terraza...)
CREATE TABLE IF NOT EXISTS public.areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL,
  nombre text NOT NULL,
  tipo_impresion text DEFAULT 'salon', -- salon | cocina | barra
  activa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "areas_all" ON public.areas FOR ALL TO authenticated
  USING (negocio_id = current_negocio_id())
  WITH CHECK (negocio_id = current_negocio_id());

-- 3. Mesas
CREATE TABLE IF NOT EXISTS public.mesas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL,
  area_id uuid,
  numero text NOT NULL,
  capacidad int NOT NULL DEFAULT 4,
  estado text NOT NULL DEFAULT 'libre', -- libre | ocupada | reservada
  notas text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.mesas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mesas_all" ON public.mesas FOR ALL TO authenticated
  USING (negocio_id = current_negocio_id())
  WITH CHECK (negocio_id = current_negocio_id());

-- 4. Grupos de modificadores
CREATE TABLE IF NOT EXISTS public.modificador_grupos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL,
  nombre text NOT NULL,
  min_select int NOT NULL DEFAULT 0,
  max_select int NOT NULL DEFAULT 1,
  obligatorio boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.modificador_grupos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "modg_all" ON public.modificador_grupos FOR ALL TO authenticated
  USING (negocio_id = current_negocio_id())
  WITH CHECK (negocio_id = current_negocio_id());

-- 5. Modificadores
CREATE TABLE IF NOT EXISTS public.modificadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL,
  grupo_id uuid NOT NULL,
  nombre text NOT NULL,
  precio_extra numeric NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.modificadores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mod_all" ON public.modificadores FOR ALL TO authenticated
  USING (negocio_id = current_negocio_id())
  WITH CHECK (negocio_id = current_negocio_id());

-- 6. Vínculo producto - grupo modificadores
CREATE TABLE IF NOT EXISTS public.producto_modificador_grupos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL,
  producto_id uuid NOT NULL,
  grupo_id uuid NOT NULL,
  UNIQUE (producto_id, grupo_id)
);
ALTER TABLE public.producto_modificador_grupos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pmg_all" ON public.producto_modificador_grupos FOR ALL TO authenticated
  USING (negocio_id = current_negocio_id())
  WITH CHECK (negocio_id = current_negocio_id());

-- 7. Comandas (cuenta abierta)
CREATE TABLE IF NOT EXISTS public.comandas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL,
  mesa_id uuid,
  tipo text NOT NULL DEFAULT 'mesa', -- mesa | llevar | delivery
  estado text NOT NULL DEFAULT 'abierta', -- abierta | cobrada | cancelada
  cliente_nombre text,
  cliente_telefono text,
  direccion text,
  mesero_id uuid,
  total numeric NOT NULL DEFAULT 0,
  notas text,
  venta_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
ALTER TABLE public.comandas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "com_all" ON public.comandas FOR ALL TO authenticated
  USING (negocio_id = current_negocio_id())
  WITH CHECK (negocio_id = current_negocio_id());

-- 8. Items de comanda
CREATE TABLE IF NOT EXISTS public.comanda_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL,
  comanda_id uuid NOT NULL,
  producto_id uuid,
  nombre text NOT NULL,
  qty int NOT NULL DEFAULT 1,
  precio numeric NOT NULL DEFAULT 0,
  modificadores jsonb,
  notas text,
  area_id uuid,
  estado text NOT NULL DEFAULT 'pendiente', -- pendiente | preparando | listo | entregado | cancelado
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.comanda_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ci_all" ON public.comanda_items FOR ALL TO authenticated
  USING (negocio_id = current_negocio_id())
  WITH CHECK (negocio_id = current_negocio_id());

CREATE TRIGGER ci_updated BEFORE UPDATE ON public.comanda_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 9. Reservas
CREATE TABLE IF NOT EXISTS public.reservas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL,
  mesa_id uuid,
  cliente_nombre text NOT NULL,
  cliente_telefono text,
  fecha date NOT NULL,
  hora time NOT NULL,
  personas int NOT NULL DEFAULT 2,
  estado text NOT NULL DEFAULT 'pendiente', -- pendiente | confirmada | cancelada | completada
  notas text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "res_all" ON public.reservas FOR ALL TO authenticated
  USING (negocio_id = current_negocio_id())
  WITH CHECK (negocio_id = current_negocio_id());

CREATE INDEX IF NOT EXISTS idx_mesas_negocio ON public.mesas(negocio_id);
CREATE INDEX IF NOT EXISTS idx_comandas_negocio_estado ON public.comandas(negocio_id, estado);
CREATE INDEX IF NOT EXISTS idx_ci_comanda ON public.comanda_items(comanda_id);
CREATE INDEX IF NOT EXISTS idx_reservas_negocio_fecha ON public.reservas(negocio_id, fecha);

-- Realtime para KDS y comandas
ALTER PUBLICATION supabase_realtime ADD TABLE public.comandas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comanda_items;


-- ----------------------------------------------------------------------------
-- Migration: 20260503040013_3b7769a0-116c-4e8c-a0e3-624f91f55afe.sql
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_negocio_for_user(_nombre text, _slug text, _tipo text DEFAULT 'tienda')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _negocio_id uuid;
  _existing uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _tipo NOT IN ('tienda','restaurant') THEN RAISE EXCEPTION 'Tipo inválido'; END IF;

  SELECT negocio_id INTO _existing FROM public.profiles WHERE id = _uid;
  IF _existing IS NOT NULL THEN RETURN _existing; END IF;

  INSERT INTO public.negocios (nombre, slug, tipo_negocio)
  VALUES (_nombre, _slug, _tipo)
  RETURNING id INTO _negocio_id;

  UPDATE public.profiles SET negocio_id = _negocio_id WHERE id = _uid;
  INSERT INTO public.user_roles (user_id, role, negocio_id) VALUES (_uid, 'admin', _negocio_id);
  INSERT INTO public.sucursales (nombre, negocio_id) VALUES ('Principal', _negocio_id);

  -- Si es restaurant, crea áreas básicas
  IF _tipo = 'restaurant' THEN
    INSERT INTO public.areas (negocio_id, nombre, tipo_impresion) VALUES
      (_negocio_id, 'Salón', 'salon'),
      (_negocio_id, 'Cocina', 'cocina'),
      (_negocio_id, 'Barra', 'barra');
  END IF;

  RETURN _negocio_id;
END;
$function$;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.create_negocio_for_user(text, text, text) FROM PUBLIC, anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.create_negocio_for_user(text, text, text) TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.set_tipo_negocio(_tipo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _nid uuid := current_negocio_id();
BEGIN
  IF _nid IS NULL THEN RAISE EXCEPTION 'Sin negocio'; END IF;
  IF _tipo NOT IN ('tienda','restaurant') THEN RAISE EXCEPTION 'Tipo inválido'; END IF;
  IF NOT has_role_in_negocio(auth.uid(), 'admin'::app_role, _nid) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  UPDATE public.negocios SET tipo_negocio = _tipo WHERE id = _nid;

  IF _tipo = 'restaurant' AND NOT EXISTS (SELECT 1 FROM public.areas WHERE negocio_id = _nid) THEN
    INSERT INTO public.areas (negocio_id, nombre, tipo_impresion) VALUES
      (_nid, 'Salón', 'salon'),
      (_nid, 'Cocina', 'cocina'),
      (_nid, 'Barra', 'barra');
  END IF;
END;
$function$;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.set_tipo_negocio(text) FROM PUBLIC, anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.set_tipo_negocio(text) TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ----------------------------------------------------------------------------
-- Migration: 20260503192722_f146a669-c822-4bf4-bb90-a86c0cf6d4e1.sql
-- ----------------------------------------------------------------------------
-- Reemplazar política de lectura pública por una más segura
DROP POLICY IF EXISTS prod_read ON public.productos;

-- Anónimos: pueden ver productos (catálogo público)
CREATE POLICY prod_read_anon ON public.productos
  FOR SELECT TO anon
  USING (true);

-- Autenticados: solo ven productos de su negocio (o super admin ve todo)
CREATE POLICY prod_read_auth ON public.productos
  FOR SELECT TO authenticated
  USING (negocio_id = current_negocio_id() OR is_super_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- Migration: 20260503193249_07920c27-fb51-4d58-8367-6701151c7874.sql
-- ----------------------------------------------------------------------------
-- Storage bucket público para imágenes de productos
INSERT INTO storage.buckets (id, name, public) VALUES ('producto-imgs', 'producto-imgs', true)
ON CONFLICT (id) DO NOTHING;

-- Lectura pública del bucket
CREATE POLICY "producto-imgs public read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'producto-imgs');

-- Subir/actualizar/eliminar: usuarios autenticados, solo en carpeta de su negocio
CREATE POLICY "producto-imgs auth insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'producto-imgs'
    AND (storage.foldername(name))[1] = current_negocio_id()::text
  );

CREATE POLICY "producto-imgs auth update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'producto-imgs'
    AND (storage.foldername(name))[1] = current_negocio_id()::text
  );

CREATE POLICY "producto-imgs auth delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'producto-imgs'
    AND (storage.foldername(name))[1] = current_negocio_id()::text
  );

-- Variantes
CREATE TABLE public.producto_variantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL,
  producto_id uuid NOT NULL,
  nombre text NOT NULL,
  codigo text,
  imagen_url text,
  stock integer NOT NULL DEFAULT 0,
  precio_venta numeric,
  precio_costo numeric,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pv_producto ON public.producto_variantes(producto_id);
CREATE INDEX idx_pv_codigo ON public.producto_variantes(negocio_id, codigo);

ALTER TABLE public.producto_variantes ENABLE ROW LEVEL SECURITY;

CREATE POLICY pv_read_anon ON public.producto_variantes
  FOR SELECT TO anon USING (true);

CREATE POLICY pv_read_auth ON public.producto_variantes
  FOR SELECT TO authenticated
  USING (negocio_id = current_negocio_id() OR is_super_admin(auth.uid()));

CREATE POLICY pv_write ON public.producto_variantes
  FOR ALL TO authenticated
  USING (negocio_id = current_negocio_id())
  WITH CHECK (negocio_id = current_negocio_id());

CREATE TRIGGER trg_pv_updated BEFORE UPDATE ON public.producto_variantes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RPC: descontar stock de variante (si aplica) y del producto general
CREATE OR REPLACE FUNCTION public.descontar_stock_producto(
  _producto_id uuid,
  _variante_id uuid,
  _qty integer,
  _venta_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _nid uuid := current_negocio_id();
  _stock_p integer;
  _stock_v integer;
BEGIN
  IF _nid IS NULL THEN RAISE EXCEPTION 'Sin negocio'; END IF;
  IF _qty <= 0 THEN RAISE EXCEPTION 'Cantidad inválida'; END IF;

  SELECT stock INTO _stock_p FROM public.productos
    WHERE id = _producto_id AND negocio_id = _nid FOR UPDATE;
  IF _stock_p IS NULL THEN RAISE EXCEPTION 'Producto no encontrado'; END IF;

  IF _variante_id IS NOT NULL THEN
    SELECT stock INTO _stock_v FROM public.producto_variantes
      WHERE id = _variante_id AND producto_id = _producto_id AND negocio_id = _nid FOR UPDATE;
    IF _stock_v IS NULL THEN RAISE EXCEPTION 'Variante no encontrada'; END IF;

    UPDATE public.producto_variantes SET stock = stock - _qty WHERE id = _variante_id;
  END IF;

  UPDATE public.productos SET stock = stock - _qty WHERE id = _producto_id;

  INSERT INTO public.stock_movements
    (negocio_id, producto_id, tipo, cantidad, stock_antes, ref_id, ref_tipo, notas)
  VALUES
    (_nid, _producto_id, 'venta', -_qty, _stock_p, _venta_id::text, 'venta',
     CASE WHEN _variante_id IS NOT NULL THEN 'variante:' || _variante_id::text ELSE NULL END);
END;
$$;

-- ----------------------------------------------------------------------------
-- Migration: 20260506183417_f69000a4-f892-4c24-83df-26d2b38d75b9.sql
-- ----------------------------------------------------------------------------
-- productos: revoke and grant only safe columns to anon
DO $$ BEGIN REVOKE SELECT ON public.productos FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (
  id, negocio_id, nombre, categoria, precio_venta, stock,
  imagen_url, galeria, unidad, cantidad_minima, activo,
  sucursal_id, codigo, variantes, created_at, updated_at
) ON public.productos TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- producto_variantes: revoke and grant only safe columns to anon
DO $$ BEGIN REVOKE SELECT ON public.producto_variantes FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (
  id, negocio_id, producto_id, nombre, codigo,
  imagen_url, stock, precio_venta, activo,
  created_at, updated_at
) ON public.producto_variantes TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- negocios: revoke and grant only safe columns to anon (hide rut, direccion)
DO $$ BEGIN REVOKE SELECT ON public.negocios FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (
  id, nombre, slug, plan, tipo_negocio, created_at
) ON public.negocios TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- Migration: 20260506184707_fb3b8a53-88a7-4e79-ac97-378e29a48620.sql
-- ----------------------------------------------------------------------------
-- Restrict authenticated SELECT on negocios to safe columns only.
-- The negocios_public_read policy stays (needed for public catalog slug lookups),
-- but column-level GRANTs prevent reading rut/direccion across tenants.
DO $$ BEGIN REVOKE SELECT ON public.negocios FROM authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (id, nombre, slug, plan, tipo_negocio, created_at) ON public.negocios TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ----------------------------------------------------------------------------
-- Migration: 20260506190750_0e2cc40c-153d-41aa-a7d3-9d1a01d745df.sql
-- ----------------------------------------------------------------------------
-- Restore SELECT on negocios with proper RLS row-scoping.
-- Authenticated users can read full details only for their own negocio (or super_admin).
-- Anon users can read only safe columns (for public catalog by slug).

-- Grants
DO $$ BEGIN GRANT SELECT ON public.negocios TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (id, nombre, slug, plan, tipo_negocio, created_at) ON public.negocios TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Replace permissive public SELECT policy with row-scoped policies
DROP POLICY IF EXISTS negocios_public_read ON public.negocios;

-- Anon: public catalog read (column grants restrict which columns are visible)
CREATE POLICY negocios_anon_public_read
ON public.negocios
FOR SELECT
TO anon
USING (true);

-- Authenticated: only own negocio or super_admin
CREATE POLICY negocios_auth_own_read
ON public.negocios
FOR SELECT
TO authenticated
USING (
  id = public.current_negocio_id()
  OR public.is_super_admin(auth.uid())
);


-- ----------------------------------------------------------------------------
-- Migration: 20260510020957_4b826866-b27d-4d8f-9775-bcaa81e5d7e8.sql
-- ----------------------------------------------------------------------------
CREATE TABLE public.combos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  negocio_id uuid NOT NULL,
  nombre text NOT NULL,
  descripcion text,
  precio numeric NOT NULL DEFAULT 0,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.combos ENABLE ROW LEVEL SECURITY;

CREATE POLICY combos_all ON public.combos
  FOR ALL TO authenticated
  USING (negocio_id = current_negocio_id())
  WITH CHECK (negocio_id = current_negocio_id());

CREATE INDEX idx_combos_negocio ON public.combos(negocio_id) WHERE activo = true;

-- ----------------------------------------------------------------------------
-- Migration: 20260510021535_66f66805-9566-478c-9640-693b8cc8ac70.sql
-- ----------------------------------------------------------------------------
ALTER TABLE public.ventas ALTER COLUMN descuento TYPE numeric(14,2);
ALTER TABLE public.detalle_ventas ALTER COLUMN descuento TYPE numeric(14,2);

-- ----------------------------------------------------------------------------
-- Migration: 20260510023654_06d0eba1-b0cd-4e47-b446-26d93e38d17b.sql
-- ----------------------------------------------------------------------------
-- 1. Revoke sensitive columns from anon on productos
DO $$ BEGIN REVOKE SELECT ON public.productos FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (id, negocio_id, nombre, codigo, categoria, precio_venta, stock, unidad, imagen_url, galeria, activo, sucursal_id, variantes, cantidad_minima, created_at, updated_at) ON public.productos TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 2. Revoke sensitive columns from anon on producto_variantes
DO $$ BEGIN REVOKE SELECT ON public.producto_variantes FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (id, negocio_id, producto_id, nombre, codigo, imagen_url, stock, precio_venta, activo, created_at, updated_at) ON public.producto_variantes TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 3. Revoke sensitive columns from anon on negocios
DO $$ BEGIN REVOKE SELECT ON public.negocios FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (id, nombre, slug, plan, tipo_negocio, created_at) ON public.negocios TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 4. Prevent privilege escalation via user_roles
DROP POLICY IF EXISTS roles_admin_insert ON public.user_roles;
CREATE POLICY roles_admin_insert ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    negocio_id = current_negocio_id()
    AND has_role_in_negocio(auth.uid(), 'admin'::app_role, negocio_id)
    AND role <> 'super_admin'::app_role
  );

-- 5. Prevent cross-tenant pivot via profiles self update
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
CREATE POLICY profiles_self_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND negocio_id IS NOT DISTINCT FROM (SELECT p.negocio_id FROM public.profiles p WHERE p.id = auth.uid())
  );

-- 6. Realtime channel authorization: restrict to own negocio via topic naming "negocio:<uuid>:..."
-- Alter realtime.messages omitted

-- drop rt policy omitted
-- rt policy omitted

-- drop rt policy omitted
-- rt policy omitted

-- ----------------------------------------------------------------------------
-- Migration: 20260510023834_5792a42b-4dca-4996-ae67-e3129dd6ed78.sql
-- ----------------------------------------------------------------------------
ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_tipo_check;
ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_tipo_check
  CHECK (tipo = ANY (ARRAY['venta','compra','ajuste','devolucion','entrada_manual','reserva','devolucion_reserva']));

-- ----------------------------------------------------------------------------
-- Migration: 20260510024016_deaa112d-d662-4ff6-9e2f-373cd4dbd3c7.sql
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  _uid uuid;
  _nid uuid;
  _email text := 'demo-restaurant@operix.test';
  _pwd text := 'DemoResto2026!';
BEGIN
  -- Si ya existe, recuperar id; si no, crearlo
  SELECT id INTO _uid FROM auth.users WHERE email = _email;
  IF _uid IS NULL THEN
    _uid := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
    ) VALUES (
      _uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      _email, crypt(_pwd, gen_salt('bf')),
      now(), now(), now(),
      jsonb_build_object('provider','email','providers',ARRAY['email']),
      jsonb_build_object('nombre','Demo Restaurante'),
      false, false
    );
    INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at)
    VALUES (gen_random_uuid(), _uid, _uid::text, 'email',
      jsonb_build_object('sub', _uid::text, 'email', _email, 'email_verified', true),
      now(), now(), now());
  END IF;

  -- Asegurar profile (el trigger handle_new_user normalmente lo crea)
  INSERT INTO public.profiles (id, nombre, email)
  VALUES (_uid, 'Demo Restaurante', _email)
  ON CONFLICT (id) DO NOTHING;

  -- Negocio (si el profile aún no tiene uno)
  SELECT negocio_id INTO _nid FROM public.profiles WHERE id = _uid;
  IF _nid IS NULL THEN
    INSERT INTO public.negocios (nombre, slug, tipo_negocio)
    VALUES ('Demo Restaurante', 'demo-restaurante-' || substr(_uid::text,1,8), 'restaurant')
    RETURNING id INTO _nid;
    UPDATE public.profiles SET negocio_id = _nid WHERE id = _uid;
    INSERT INTO public.user_roles (user_id, role, negocio_id) VALUES (_uid, 'admin', _nid);
    INSERT INTO public.sucursales (nombre, negocio_id) VALUES ('Principal', _nid);
    INSERT INTO public.areas (negocio_id, nombre, tipo_impresion) VALUES
      (_nid, 'Salón', 'salon'),
      (_nid, 'Cocina', 'cocina'),
      (_nid, 'Barra', 'barra');
  END IF;

  -- Mesas demo si no hay
  IF NOT EXISTS (SELECT 1 FROM public.mesas WHERE negocio_id = _nid) THEN
    INSERT INTO public.mesas (negocio_id, numero, capacidad, area_id)
    SELECT _nid, n::text, 4, (SELECT id FROM public.areas WHERE negocio_id = _nid AND nombre='Salón' LIMIT 1)
    FROM generate_series(1,6) n;
  END IF;

  -- Productos demo si no hay
  IF NOT EXISTS (SELECT 1 FROM public.productos WHERE negocio_id = _nid) THEN
    INSERT INTO public.productos (negocio_id, nombre, categoria, precio_venta, precio_costo, stock, stock_min)
    VALUES
      (_nid, 'Lomo a lo pobre', 'Platos', 9990, 4500, 50, 5),
      (_nid, 'Empanada de pino', 'Entradas', 2500, 900, 100, 10),
      (_nid, 'Bebida 350ml', 'Bebidas', 1500, 500, 200, 20),
      (_nid, 'Cerveza artesanal', 'Bebidas', 4500, 1800, 60, 10),
      (_nid, 'Tiramisú', 'Postres', 3990, 1500, 30, 5);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Migration: 20260510024248_e2fa294b-38f7-4b07-bda6-0c7d7cfa4dac.sql
-- ----------------------------------------------------------------------------
UPDATE auth.users
SET confirmation_token = COALESCE(confirmation_token, ''),
    email_change = COALESCE(email_change, ''),
    email_change_token_new = COALESCE(email_change_token_new, ''),
    email_change_token_current = COALESCE(email_change_token_current, ''),
    recovery_token = COALESCE(recovery_token, ''),
    phone_change = COALESCE(phone_change, ''),
    phone_change_token = COALESCE(phone_change_token, ''),
    reauthentication_token = COALESCE(reauthentication_token, '')
WHERE email = 'demo-restaurant@operix.test';

-- ----------------------------------------------------------------------------
-- Migration: 20260510024425_01182fdb-d11e-4101-bfb4-606b19941828.sql
-- ----------------------------------------------------------------------------
UPDATE auth.users
SET encrypted_password = crypt('demo1234', gen_salt('bf')),
    updated_at = now()
WHERE email = 'demo-restaurant@operix.test';

-- ----------------------------------------------------------------------------
-- Migration: 20260519124830_1ca02440-ba8b-4258-9c42-12bcce91e013.sql
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.crear_pedido_catalogo(_negocio_id uuid, _cliente_nombre text, _cliente_telefono text, _notas text, _items jsonb, _total numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _pedido_id uuid;
  _it jsonb;
  _pid uuid;
  _vid uuid;
  _qty integer;
  _stock_actual integer;
  _stock_var integer;
BEGIN
  IF _negocio_id IS NULL OR NOT EXISTS (SELECT 1 FROM negocios WHERE id = _negocio_id) THEN
    RAISE EXCEPTION 'Negocio inválido';
  END IF;
  IF _cliente_nombre IS NULL OR char_length(_cliente_nombre) < 1 OR char_length(_cliente_nombre) > 120 THEN
    RAISE EXCEPTION 'Nombre inválido';
  END IF;
  IF _cliente_telefono IS NOT NULL AND char_length(_cliente_telefono) > 40 THEN
    RAISE EXCEPTION 'Teléfono inválido';
  END IF;
  IF _notas IS NOT NULL AND char_length(_notas) > 1000 THEN
    RAISE EXCEPTION 'Notas demasiado largas';
  END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Pedido sin items';
  END IF;

  -- Validar stock para todos los items (variante si existe, si no producto)
  FOR _it IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    _pid := (_it->>'id')::uuid;
    _vid := NULLIF(_it->>'variante_id','')::uuid;
    _qty := COALESCE((_it->>'qty')::int, 0);
    IF _qty <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida';
    END IF;
    SELECT stock INTO _stock_actual FROM productos WHERE id = _pid AND negocio_id = _negocio_id;
    IF _stock_actual IS NULL THEN
      RAISE EXCEPTION 'Producto no encontrado';
    END IF;
    IF _vid IS NOT NULL THEN
      SELECT stock INTO _stock_var FROM producto_variantes WHERE id = _vid AND producto_id = _pid AND negocio_id = _negocio_id;
      IF _stock_var IS NULL THEN
        RAISE EXCEPTION 'Variante no encontrada';
      END IF;
      IF _stock_var < _qty THEN
        RAISE EXCEPTION 'Stock insuficiente para %', (_it->>'nombre');
      END IF;
    ELSE
      IF _stock_actual < _qty THEN
        RAISE EXCEPTION 'Stock insuficiente para %', (_it->>'nombre');
      END IF;
    END IF;
  END LOOP;

  INSERT INTO pedidos_whatsapp (negocio_id, cliente_nombre, cliente_telefono, notas, items, total, stock_reservado)
  VALUES (_negocio_id, _cliente_nombre, NULLIF(_cliente_telefono, ''), NULLIF(_notas, ''), _items, _total, true)
  RETURNING id INTO _pedido_id;

  -- Descontar stock y registrar movimiento
  FOR _it IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    _pid := (_it->>'id')::uuid;
    _vid := NULLIF(_it->>'variante_id','')::uuid;
    _qty := (_it->>'qty')::int;
    SELECT stock INTO _stock_actual FROM productos WHERE id = _pid;
    UPDATE productos SET stock = stock - _qty WHERE id = _pid;
    IF _vid IS NOT NULL THEN
      UPDATE producto_variantes SET stock = stock - _qty WHERE id = _vid;
    END IF;
    INSERT INTO stock_movements (negocio_id, producto_id, tipo, cantidad, stock_antes, ref_id, ref_tipo, notas)
    VALUES (_negocio_id, _pid, 'reserva', -_qty, _stock_actual, _pedido_id::text, 'pedido_catalogo',
      CASE WHEN _vid IS NOT NULL THEN 'Reserva catálogo (variante:' || _vid::text || ')' ELSE 'Reserva por pedido del catálogo' END);
  END LOOP;

  RETURN _pedido_id;
END;
$function$;


-- ----------------------------------------------------------------------------
-- Migration: 20260519133525_b00c7b59-35e0-4447-a08b-0d15718bbaf9.sql
-- ----------------------------------------------------------------------------

-- 1) Column-level grants for anon (defense in depth on top of RLS)
DO $$ BEGIN REVOKE SELECT ON public.negocios FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (id, slug, nombre, tipo_negocio) ON public.negocios TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN REVOKE SELECT ON public.productos FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (id, negocio_id, nombre, categoria, precio_venta, stock, imagen_url, activo, unidad, galeria, codigo, variantes, updated_at, created_at) ON public.productos TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN REVOKE SELECT ON public.producto_variantes FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (id, producto_id, negocio_id, nombre, stock, precio_venta, imagen_url, activo, codigo) ON public.producto_variantes TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 2) Recalculate prices server-side in catalog order RPC
CREATE OR REPLACE FUNCTION public.crear_pedido_catalogo(_negocio_id uuid, _cliente_nombre text, _cliente_telefono text, _notas text, _items jsonb, _total numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _pedido_id uuid;
  _it jsonb;
  _pid uuid;
  _vid uuid;
  _qty integer;
  _stock_actual integer;
  _stock_var integer;
  _precio numeric;
  _nombre_p text;
  _nombre_v text;
  _items_clean jsonb := '[]'::jsonb;
  _total_server numeric := 0;
BEGIN
  IF _negocio_id IS NULL OR NOT EXISTS (SELECT 1 FROM negocios WHERE id = _negocio_id) THEN
    RAISE EXCEPTION 'Negocio inválido';
  END IF;
  IF _cliente_nombre IS NULL OR char_length(_cliente_nombre) < 1 OR char_length(_cliente_nombre) > 120 THEN
    RAISE EXCEPTION 'Nombre inválido';
  END IF;
  IF _cliente_telefono IS NOT NULL AND char_length(_cliente_telefono) > 40 THEN
    RAISE EXCEPTION 'Teléfono inválido';
  END IF;
  IF _notas IS NOT NULL AND char_length(_notas) > 1000 THEN
    RAISE EXCEPTION 'Notas demasiado largas';
  END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Pedido sin items';
  END IF;
  IF jsonb_array_length(_items) > 200 THEN
    RAISE EXCEPTION 'Demasiados items';
  END IF;

  FOR _it IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    _pid := (_it->>'id')::uuid;
    _vid := NULLIF(_it->>'variante_id','')::uuid;
    _qty := COALESCE((_it->>'qty')::int, 0);
    IF _qty <= 0 OR _qty > 1000 THEN
      RAISE EXCEPTION 'Cantidad inválida';
    END IF;

    SELECT stock, precio_venta, nombre INTO _stock_actual, _precio, _nombre_p
      FROM productos WHERE id = _pid AND negocio_id = _negocio_id AND activo = true;
    IF _stock_actual IS NULL THEN
      RAISE EXCEPTION 'Producto no encontrado';
    END IF;

    IF _vid IS NOT NULL THEN
      SELECT stock, COALESCE(precio_venta, _precio), nombre
        INTO _stock_var, _precio, _nombre_v
        FROM producto_variantes
        WHERE id = _vid AND producto_id = _pid AND negocio_id = _negocio_id AND activo = true;
      IF _stock_var IS NULL THEN
        RAISE EXCEPTION 'Variante no encontrada';
      END IF;
      IF _stock_var < _qty THEN
        RAISE EXCEPTION 'Stock insuficiente para %', _nombre_p;
      END IF;
    ELSE
      IF _stock_actual < _qty THEN
        RAISE EXCEPTION 'Stock insuficiente para %', _nombre_p;
      END IF;
    END IF;

    _precio := COALESCE(_precio, 0);
    _total_server := _total_server + (_precio * _qty);
    _items_clean := _items_clean || jsonb_build_object(
      'id', _pid,
      'variante_id', _vid,
      'nombre', CASE WHEN _vid IS NOT NULL THEN _nombre_p || ' - ' || _nombre_v ELSE _nombre_p END,
      'qty', _qty,
      'precio', _precio
    );
  END LOOP;

  INSERT INTO pedidos_whatsapp (negocio_id, cliente_nombre, cliente_telefono, notas, items, total, stock_reservado)
  VALUES (_negocio_id, _cliente_nombre, NULLIF(_cliente_telefono, ''), NULLIF(_notas, ''), _items_clean, _total_server, true)
  RETURNING id INTO _pedido_id;

  FOR _it IN SELECT * FROM jsonb_array_elements(_items_clean)
  LOOP
    _pid := (_it->>'id')::uuid;
    _vid := NULLIF(_it->>'variante_id','')::uuid;
    _qty := (_it->>'qty')::int;
    SELECT stock INTO _stock_actual FROM productos WHERE id = _pid;
    UPDATE productos SET stock = stock - _qty WHERE id = _pid;
    IF _vid IS NOT NULL THEN
      UPDATE producto_variantes SET stock = stock - _qty WHERE id = _vid;
    END IF;
    INSERT INTO stock_movements (negocio_id, producto_id, tipo, cantidad, stock_antes, ref_id, ref_tipo, notas)
    VALUES (_negocio_id, _pid, 'reserva', -_qty, _stock_actual, _pedido_id::text, 'pedido_catalogo',
      CASE WHEN _vid IS NOT NULL THEN 'Reserva catálogo (variante:' || _vid::text || ')' ELSE 'Reserva por pedido del catálogo' END);
  END LOOP;

  RETURN _pedido_id;
END;
$function$;

-- 3) Remove hardcoded super-admin email from trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, nombre, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$function$;

-- 4) DELETE policy for pedidos_whatsapp scoped to negocio + admin
CREATE POLICY pw_delete ON public.pedidos_whatsapp
  FOR DELETE TO authenticated
  USING (negocio_id = current_negocio_id() AND has_role_in_negocio(auth.uid(), 'admin'::app_role, negocio_id));

-- (Email queue helper functions omitted: Lovable proprietary pgmq queue)


-- ----------------------------------------------------------------------------
-- Migration: 20260520000059_64228de0-48eb-4bfe-ab85-d73d9a31980c.sql
-- ----------------------------------------------------------------------------

ALTER TABLE public.pedidos_whatsapp
  ADD COLUMN IF NOT EXISTS cliente_id uuid,
  ADD COLUMN IF NOT EXISTS fiado boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.vincular_pedido_a_fiado(_pedido_id uuid, _cliente_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _ped pedidos_whatsapp%ROWTYPE;
  _cli clientes%ROWTYPE;
  _nid uuid := current_negocio_id();
BEGIN
  IF _nid IS NULL THEN RAISE EXCEPTION 'Sin negocio'; END IF;

  SELECT * INTO _ped FROM pedidos_whatsapp WHERE id = _pedido_id FOR UPDATE;
  IF NOT FOUND OR _ped.negocio_id <> _nid THEN RAISE EXCEPTION 'Pedido no encontrado'; END IF;
  IF _ped.fiado = true THEN RAISE EXCEPTION 'Este pedido ya está cargado a un fiado'; END IF;
  IF _ped.estado IN ('cancelado','devuelto') THEN RAISE EXCEPTION 'No se puede fiar un pedido % ', _ped.estado; END IF;
  IF COALESCE(_ped.total,0) <= 0 THEN RAISE EXCEPTION 'Pedido sin monto'; END IF;

  SELECT * INTO _cli FROM clientes WHERE id = _cliente_id FOR UPDATE;
  IF NOT FOUND OR _cli.negocio_id <> _nid THEN RAISE EXCEPTION 'Cliente no encontrado'; END IF;

  INSERT INTO deudas (negocio_id, cliente_id, monto, tipo, notas)
  VALUES (_nid, _cliente_id, _ped.total, 'deuda',
          'Pedido catálogo ' || COALESCE(_ped.cliente_nombre,'') || ' (' || _pedido_id::text || ')');

  UPDATE clientes
    SET deuda_total = COALESCE(deuda_total,0) + _ped.total
    WHERE id = _cliente_id;

  UPDATE pedidos_whatsapp
    SET fiado = true, cliente_id = _cliente_id
    WHERE id = _pedido_id;
END;
$$;


-- ----------------------------------------------------------------------------
-- Migration: 20260525004002_aab72dbb-9f02-44de-86c4-10eb335be48d.sql
-- ----------------------------------------------------------------------------

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  paddle_subscription_id text not null unique,
  paddle_customer_id text not null,
  product_id text not null,
  price_id text not null,
  status text not null default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  environment text not null default 'sandbox',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_subscriptions_user_id on public.subscriptions(user_id);
create index idx_subscriptions_paddle_id on public.subscriptions(paddle_subscription_id);

alter table public.subscriptions enable row level security;

create policy "Users can view own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

create policy "Service role can manage subscriptions"
  on public.subscriptions for all
  using (auth.role() = 'service_role');

create or replace function public.has_active_subscription(
  user_uuid uuid,
  check_env text default 'live'
)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions
    where user_id = user_uuid
    and environment = check_env
    and (
      (status in ('active', 'trialing') and (current_period_end is null or current_period_end > now()))
      or (status = 'canceled' and current_period_end > now())
    )
  );
$$;

create or replace function public.get_user_plan(
  user_uuid uuid,
  check_env text default 'live'
)
returns text language sql security definer set search_path = public as $$
  select coalesce(
    (
      select product_id from public.subscriptions
      where user_id = user_uuid
        and environment = check_env
        and (
          (status in ('active','trialing') and (current_period_end is null or current_period_end > now()))
          or (status = 'canceled' and current_period_end > now())
        )
      order by created_at desc
      limit 1
    ),
    'free'
  );
$$;


-- ----------------------------------------------------------------------------
-- Migration: 20260528004551_30525db3-fa0c-4f58-829c-30f86e2cd3c5.sql
-- ----------------------------------------------------------------------------

-- Tabla de cupones internos (otorgan tiempo gratis de un plan al canjear)
CREATE TABLE public.cupones_internos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT 'pro',
  dias_otorgados integer NOT NULL DEFAULT 30,
  max_usos integer,
  usos integer NOT NULL DEFAULT 0,
  vence_at timestamptz,
  activo boolean NOT NULL DEFAULT true,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cupones_plan_check CHECK (plan IN ('free','basico','pro','enterprise')),
  CONSTRAINT cupones_dias_check CHECK (dias_otorgados > 0 AND dias_otorgados <= 36500)
);

DO $$ BEGIN GRANT SELECT, INSERT, UPDATE, DELETE ON public.cupones_internos TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT ALL ON public.cupones_internos TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;

ALTER TABLE public.cupones_internos ENABLE ROW LEVEL SECURITY;

CREATE POLICY cupones_super_all ON public.cupones_internos
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Lectura limitada para canjear: por código (un usuario auth puede verificar su existencia vía RPC)
-- (no damos SELECT general a authenticated; se hace por RPC SECURITY DEFINER)

-- Log de canjes
CREATE TABLE public.cupon_canjes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cupon_id uuid NOT NULL REFERENCES public.cupones_internos(id) ON DELETE CASCADE,
  negocio_id uuid NOT NULL,
  user_id uuid NOT NULL,
  plan_aplicado text NOT NULL,
  dias_aplicados integer NOT NULL,
  vence_at_nuevo timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cupon_id, negocio_id)
);

DO $$ BEGIN GRANT SELECT, INSERT, UPDATE, DELETE ON public.cupon_canjes TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT ALL ON public.cupon_canjes TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;

ALTER TABLE public.cupon_canjes ENABLE ROW LEVEL SECURITY;

CREATE POLICY canjes_super_all ON public.cupon_canjes
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY canjes_owner_read ON public.cupon_canjes
  FOR SELECT TO authenticated
  USING (negocio_id = current_negocio_id());

CREATE TRIGGER cupones_internos_updated_at
  BEFORE UPDATE ON public.cupones_internos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RPC super admin: crear/editar cupón
CREATE OR REPLACE FUNCTION public.sa_cupon_upsert(
  _id uuid,
  _codigo text,
  _plan text,
  _dias_otorgados integer,
  _max_usos integer,
  _vence_at timestamptz,
  _activo boolean,
  _notas text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _out uuid;
BEGIN
  IF NOT is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF _codigo IS NULL OR length(trim(_codigo)) < 3 THEN RAISE EXCEPTION 'Código inválido'; END IF;
  IF _id IS NULL THEN
    INSERT INTO public.cupones_internos (codigo, plan, dias_otorgados, max_usos, vence_at, activo, notas)
    VALUES (upper(trim(_codigo)), _plan, _dias_otorgados, _max_usos, _vence_at, COALESCE(_activo,true), _notas)
    RETURNING id INTO _out;
  ELSE
    UPDATE public.cupones_internos
      SET codigo = upper(trim(_codigo)),
          plan = _plan,
          dias_otorgados = _dias_otorgados,
          max_usos = _max_usos,
          vence_at = _vence_at,
          activo = COALESCE(_activo, activo),
          notas = _notas
      WHERE id = _id
      RETURNING id INTO _out;
  END IF;
  RETURN _out;
END;
$$;

-- RPC super admin: eliminar cupón
CREATE OR REPLACE FUNCTION public.sa_cupon_eliminar(_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  DELETE FROM public.cupones_internos WHERE id = _id;
END;
$$;

-- RPC canjear cupón (usuario autenticado, aplica a su negocio)
CREATE OR REPLACE FUNCTION public.canjear_cupon_interno(_codigo text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _nid uuid := current_negocio_id();
  _c cupones_internos%ROWTYPE;
  _vence_nuevo timestamptz;
  _plan_negocio text;
  _susc suscripciones%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF _nid IS NULL THEN RAISE EXCEPTION 'Sin negocio asignado'; END IF;

  SELECT * INTO _c FROM cupones_internos WHERE codigo = upper(trim(_codigo)) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cupón no válido'; END IF;
  IF NOT _c.activo THEN RAISE EXCEPTION 'Cupón desactivado'; END IF;
  IF _c.vence_at IS NOT NULL AND _c.vence_at < now() THEN RAISE EXCEPTION 'Cupón expirado'; END IF;
  IF _c.max_usos IS NOT NULL AND _c.usos >= _c.max_usos THEN RAISE EXCEPTION 'Cupón sin usos disponibles'; END IF;

  IF EXISTS (SELECT 1 FROM cupon_canjes WHERE cupon_id = _c.id AND negocio_id = _nid) THEN
    RAISE EXCEPTION 'Este cupón ya fue canjeado por tu negocio';
  END IF;

  -- Suscripción actual (si existe)
  SELECT * INTO _susc FROM suscripciones WHERE negocio_id = _nid;
  IF FOUND AND _susc.vence_at IS NOT NULL AND _susc.vence_at > now() AND _susc.plan = _c.plan THEN
    _vence_nuevo := _susc.vence_at + make_interval(days => _c.dias_otorgados);
  ELSE
    _vence_nuevo := now() + make_interval(days => _c.dias_otorgados);
  END IF;

  -- Mapear plan a constraint de negocios (free|paid|blocked)
  _plan_negocio := CASE WHEN _c.plan = 'free' THEN 'free' ELSE 'paid' END;

  INSERT INTO suscripciones (negocio_id, plan, estado, vence_at, notas)
  VALUES (_nid, _c.plan, 'activa', _vence_nuevo, 'Cupón ' || _c.codigo)
  ON CONFLICT (negocio_id) DO UPDATE
    SET plan = EXCLUDED.plan,
        estado = 'activa',
        vence_at = _vence_nuevo,
        notas = COALESCE(suscripciones.notas, '') || ' | Cupón ' || _c.codigo,
        updated_at = now();

  UPDATE negocios SET plan = _plan_negocio WHERE id = _nid;

  UPDATE cupones_internos SET usos = usos + 1 WHERE id = _c.id;

  INSERT INTO cupon_canjes (cupon_id, negocio_id, user_id, plan_aplicado, dias_aplicados, vence_at_nuevo)
  VALUES (_c.id, _nid, _uid, _c.plan, _c.dias_otorgados, _vence_nuevo);

  RETURN jsonb_build_object(
    'plan', _c.plan,
    'dias', _c.dias_otorgados,
    'vence_at', _vence_nuevo
  );
END;
$$;


-- ----------------------------------------------------------------------------
-- Migration: 20260529125717_65422a20-4de7-4a3a-8b3c-5fd62230c5a8.sql
-- ----------------------------------------------------------------------------

-- 1. Fix NULL bypass in cambiar_estado_pedido
CREATE OR REPLACE FUNCTION public.cambiar_estado_pedido(_pedido_id uuid, _nuevo_estado text, _motivo text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _ped pedidos_whatsapp%ROWTYPE;
  _nid uuid := current_negocio_id();
  _it jsonb;
  _pid uuid;
  _qty integer;
  _stock_actual integer;
BEGIN
  IF _nid IS NULL THEN
    RAISE EXCEPTION 'Sin negocio';
  END IF;

  IF _nuevo_estado NOT IN ('pendiente','confirmado','completado','cancelado','devuelto') THEN
    RAISE EXCEPTION 'Estado inválido';
  END IF;

  SELECT * INTO _ped FROM pedidos_whatsapp WHERE id = _pedido_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado';
  END IF;

  IF _ped.negocio_id IS NULL OR _ped.negocio_id <> _nid THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF _ped.estado = _nuevo_estado THEN
    RAISE EXCEPTION 'El pedido ya se encuentra en estado %', _nuevo_estado;
  END IF;

  IF _nuevo_estado = 'devuelto' THEN
    IF _ped.estado <> 'completado' THEN
      RAISE EXCEPTION 'Solo se pueden devolver pedidos completados';
    END IF;
    IF _motivo IS NULL OR char_length(trim(_motivo)) < 3 THEN
      RAISE EXCEPTION 'Debe indicar un motivo de devolución';
    END IF;
    IF char_length(_motivo) > 500 THEN
      RAISE EXCEPTION 'Motivo demasiado largo';
    END IF;
  END IF;

  IF (_nuevo_estado = 'cancelado' OR _nuevo_estado = 'devuelto') AND _ped.stock_reservado = true THEN
    FOR _it IN SELECT * FROM jsonb_array_elements(COALESCE(_ped.items, '[]'::jsonb))
    LOOP
      _pid := (_it->>'id')::uuid;
      _qty := COALESCE((_it->>'qty')::int, 0);
      IF _pid IS NOT NULL AND _qty > 0 THEN
        SELECT stock INTO _stock_actual FROM productos WHERE id = _pid;
        IF _stock_actual IS NOT NULL THEN
          UPDATE productos SET stock = stock + _qty WHERE id = _pid;
          INSERT INTO stock_movements (negocio_id, producto_id, tipo, cantidad, stock_antes, ref_id, ref_tipo, notas)
          VALUES (_ped.negocio_id, _pid,
            CASE WHEN _nuevo_estado = 'devuelto' THEN 'devolucion' ELSE 'devolucion_reserva' END,
            _qty, _stock_actual, _pedido_id::text, 'pedido_catalogo',
            CASE WHEN _nuevo_estado = 'devuelto' THEN COALESCE(_motivo, 'Devolución de pedido') ELSE 'Restauración por cancelación' END);
        END IF;
      END IF;
    END LOOP;
    UPDATE pedidos_whatsapp
      SET estado = _nuevo_estado,
          stock_reservado = false,
          motivo_devolucion = CASE WHEN _nuevo_estado = 'devuelto' THEN _motivo ELSE motivo_devolucion END
      WHERE id = _pedido_id;
  ELSIF _nuevo_estado = 'devuelto' AND _ped.stock_reservado = false THEN
    RAISE EXCEPTION 'Esta devolución ya fue procesada anteriormente';
  ELSE
    UPDATE pedidos_whatsapp SET estado = _nuevo_estado WHERE id = _pedido_id;
  END IF;
END;
$function$;

-- 2. Restrict subscription RPC functions to authenticated users only
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) FROM PUBLIC, anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO authenticated, service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.get_user_plan(uuid, text) FROM PUBLIC, anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.get_user_plan(uuid, text) TO authenticated, service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 3. Restrict anon access on productos to active products only
DROP POLICY IF EXISTS prod_read_anon ON public.productos;
CREATE POLICY prod_read_anon ON public.productos
  FOR SELECT TO anon
  USING (activo = true);

-- 4. Restrict anon access on producto_variantes to active variants only
DROP POLICY IF EXISTS pv_read_anon ON public.producto_variantes;
CREATE POLICY pv_read_anon ON public.producto_variantes
  FOR SELECT TO anon
  USING (activo = true);


-- ----------------------------------------------------------------------------
-- Migration: 20260529130254_d577b0fc-d4c9-4244-947b-e8143fa9d735.sql
-- ----------------------------------------------------------------------------

ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS categorias text[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_productos_categorias ON public.productos USING GIN (categorias);

-- Backfill: copy single categoria into the array when array is empty
UPDATE public.productos
  SET categorias = ARRAY[categoria]
  WHERE categoria IS NOT NULL AND categoria <> '' AND (categorias IS NULL OR cardinality(categorias) = 0);


-- ----------------------------------------------------------------------------
-- Migration: 20260530042501_34c4c9cd-02ef-4117-a045-07b030781b7c.sql
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.negocio_has_pro(_negocio_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _negocio_id IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.suscripciones s
      WHERE s.negocio_id = _negocio_id
        AND s.estado = 'activa'
        AND s.plan IN ('pro','enterprise','basico','paid')
        AND (s.vence_at IS NULL OR s.vence_at > now())
    )
    OR EXISTS (
      SELECT 1 FROM public.subscriptions sub
      JOIN public.profiles p ON p.id = sub.user_id
      WHERE p.negocio_id = _negocio_id
        AND (
          (sub.status IN ('active','trialing','past_due') AND (sub.current_period_end IS NULL OR sub.current_period_end > now()))
          OR (sub.status = 'canceled' AND sub.current_period_end > now())
        )
    )
  )
$$;

DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.negocio_has_pro(uuid) TO authenticated, service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DROP POLICY IF EXISTS cli_all ON public.clientes;
CREATE POLICY cli_all ON public.clientes
  FOR ALL TO authenticated
  USING (negocio_id = current_negocio_id() AND public.negocio_has_pro(negocio_id))
  WITH CHECK (negocio_id = current_negocio_id() AND public.negocio_has_pro(negocio_id));

DROP POLICY IF EXISTS deu_all ON public.deudas;
CREATE POLICY deu_all ON public.deudas
  FOR ALL TO authenticated
  USING (negocio_id = current_negocio_id() AND public.negocio_has_pro(negocio_id))
  WITH CHECK (negocio_id = current_negocio_id() AND public.negocio_has_pro(negocio_id));


-- ----------------------------------------------------------------------------
-- Migration: 20260530043415_5d96cbd1-5841-4fd3-a5a5-a14f98603fe6.sql
-- ----------------------------------------------------------------------------
DO $$ BEGIN GRANT SELECT ON public.negocios TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.productos TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.producto_variantes TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- Migration: 20260530043933_e102e03e-99ee-427a-95eb-f10587dbc8c7.sql
-- ----------------------------------------------------------------------------

-- Tighten anon access to public catalog: only pro-plan negocios, only safe columns

-- negocios: restrict anon SELECT to pro-plan businesses only
DROP POLICY IF EXISTS negocios_anon_public_read ON public.negocios;
CREATE POLICY negocios_anon_public_read ON public.negocios
  FOR SELECT TO anon
  USING (public.negocio_has_pro(id));

-- productos: scope to pro-plan negocio
DROP POLICY IF EXISTS prod_read_anon ON public.productos;
CREATE POLICY prod_read_anon ON public.productos
  FOR SELECT TO anon
  USING (activo = true AND public.negocio_has_pro(negocio_id));

-- producto_variantes: scope to pro-plan negocio
DROP POLICY IF EXISTS pv_read_anon ON public.producto_variantes;
CREATE POLICY pv_read_anon ON public.producto_variantes
  FOR SELECT TO anon
  USING (activo = true AND public.negocio_has_pro(negocio_id));

-- Column-level grants: restrict anon to only non-sensitive columns
DO $$ BEGIN REVOKE SELECT ON public.negocios FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (id, nombre, slug, plan, tipo_negocio) ON public.negocios TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN REVOKE SELECT ON public.productos FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (id, negocio_id, nombre, precio_venta, stock, categoria, categorias, imagen_url, activo, galeria, unidad) ON public.productos TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN REVOKE SELECT ON public.producto_variantes FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (id, producto_id, negocio_id, nombre, stock, precio_venta, imagen_url, activo) ON public.producto_variantes TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ----------------------------------------------------------------------------
-- Migration: 20260530045722_ec4173f4-431d-4c64-a1b9-55b8b7a1eb4a.sql
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sa_negocio_detalle(_negocio_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _r jsonb;
  _ini_dia timestamptz := date_trunc('day', now());
  _ini_mes timestamptz := date_trunc('month', now());
  _ini_mes_ant timestamptz := date_trunc('month', now() - interval '1 month');
  _fin_mes_ant timestamptz := date_trunc('month', now());
  _ventas_dia numeric;
  _ventas_mes numeric;
  _ventas_mes_ant numeric;
  _cant_dia int;
  _cant_mes int;
  _ultima_venta timestamptz;
  _crecimiento numeric;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT COALESCE(sum(total),0), count(*) INTO _ventas_dia, _cant_dia
    FROM ventas WHERE negocio_id = _negocio_id AND estado = 'activa' AND created_at >= _ini_dia;

  SELECT COALESCE(sum(total),0), count(*) INTO _ventas_mes, _cant_mes
    FROM ventas WHERE negocio_id = _negocio_id AND estado = 'activa' AND created_at >= _ini_mes;

  SELECT COALESCE(sum(total),0) INTO _ventas_mes_ant
    FROM ventas WHERE negocio_id = _negocio_id AND estado = 'activa'
      AND created_at >= _ini_mes_ant AND created_at < _fin_mes_ant;

  SELECT max(created_at) INTO _ultima_venta FROM ventas WHERE negocio_id = _negocio_id AND estado = 'activa';

  _crecimiento := CASE WHEN _ventas_mes_ant > 0 THEN ((_ventas_mes - _ventas_mes_ant) / _ventas_mes_ant) * 100 ELSE NULL END;

  SELECT jsonb_build_object(
    'negocio', (SELECT to_jsonb(n) FROM negocios n WHERE id = _negocio_id),
    'configuracion', (SELECT to_jsonb(c) FROM configuracion c WHERE negocio_id = _negocio_id LIMIT 1),
    'suscripcion', (SELECT to_jsonb(s) FROM suscripciones s WHERE negocio_id = _negocio_id LIMIT 1),
    'admin_email', (
      SELECT p.email FROM profiles p
      JOIN user_roles ur ON ur.user_id = p.id AND ur.role = 'admin'::app_role AND ur.negocio_id = _negocio_id
      ORDER BY p.created_at ASC LIMIT 1
    ),
    'metricas', jsonb_build_object(
      'ventas_total_dia', _ventas_dia,
      'cant_ventas_dia', _cant_dia,
      'ventas_total_mes', _ventas_mes,
      'cant_ventas_mes', _cant_mes,
      'ventas_mes_anterior', _ventas_mes_ant,
      'crecimiento_pct', _crecimiento,
      'ultima_venta', _ultima_venta,
      'productos_activos', (SELECT count(*) FROM productos WHERE negocio_id = _negocio_id AND activo = true),
      'stock_critico', (SELECT count(*) FROM productos WHERE negocio_id = _negocio_id AND activo = true AND COALESCE(stock,0) <= COALESCE(stock_min,0)),
      'usuarios', (SELECT count(*) FROM profiles WHERE negocio_id = _negocio_id),
      'clientes', (SELECT count(*) FROM clientes WHERE negocio_id = _negocio_id),
      'deuda_total', (SELECT COALESCE(sum(deuda_total),0) FROM clientes WHERE negocio_id = _negocio_id),
      'pedidos_pendientes', (SELECT count(*) FROM pedidos_whatsapp WHERE negocio_id = _negocio_id AND estado = 'pendiente')
    ),
    'alertas_stock', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre, 'stock', stock, 'stock_min', stock_min)), '[]'::jsonb)
      FROM (
        SELECT id, nombre, stock, stock_min FROM productos
        WHERE negocio_id = _negocio_id AND activo = true AND COALESCE(stock,0) <= COALESCE(stock_min,0)
        ORDER BY stock ASC LIMIT 10
      ) t
    ),
    'logs', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', id, 'action', action, 'entity_type', entity_type, 'entity_id', entity_id, 'created_at', created_at
      )), '[]'::jsonb)
      FROM (
        SELECT id, action, entity_type, entity_id, created_at FROM audit_logs
        WHERE negocio_id = _negocio_id ORDER BY created_at DESC LIMIT 20
      ) t
    ),
    'ultimas_ventas', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'total', total, 'pago', pago, 'created_at', created_at)), '[]'::jsonb)
      FROM (
        SELECT id, total, pago, created_at FROM ventas
        WHERE negocio_id = _negocio_id AND estado = 'activa'
        ORDER BY created_at DESC LIMIT 5
      ) t
    )
  ) INTO _r;

  RETURN _r;
END;
$$;


-- ----------------------------------------------------------------------------
-- Migration: 20260530123428_f2e9b513-e1b7-44ac-ba46-5c842d181b6e.sql
-- ----------------------------------------------------------------------------
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS descripcion text;

-- ----------------------------------------------------------------------------
-- Migration: 20260530124553_fd263462-e537-482e-8dc8-e5660fce1bf0.sql
-- ----------------------------------------------------------------------------

-- 1) Restrict anon column-level SELECT on negocios, productos, producto_variantes
DO $$ BEGIN REVOKE SELECT ON public.negocios FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (id, nombre, slug, plan, tipo_negocio) ON public.negocios TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN REVOKE SELECT ON public.productos FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (id, nombre, precio_venta, stock, stock_min, categoria, categorias, imagen_url, descripcion, unidad, activo, negocio_id, sucursal_id, galeria, cantidad_minima) ON public.productos TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN REVOKE SELECT ON public.producto_variantes FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (id, producto_id, nombre, stock, precio_venta, imagen_url, activo, negocio_id) ON public.producto_variantes TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 2) Fix crear_pedido_catalogo: enforce Pro plan and recalculate total server-side (signature unchanged; _total ignored)
CREATE OR REPLACE FUNCTION public.crear_pedido_catalogo(_negocio_id uuid, _cliente_nombre text, _cliente_telefono text, _notas text, _items jsonb, _total numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _pedido_id uuid;
  _it jsonb;
  _pid uuid;
  _vid uuid;
  _qty integer;
  _stock_actual integer;
  _stock_var integer;
  _precio numeric;
  _nombre_p text;
  _nombre_v text;
  _items_clean jsonb := '[]'::jsonb;
  _total_server numeric := 0;
BEGIN
  IF _negocio_id IS NULL OR NOT EXISTS (SELECT 1 FROM negocios WHERE id = _negocio_id) THEN
    RAISE EXCEPTION 'Negocio inválido';
  END IF;
  IF NOT public.negocio_has_pro(_negocio_id) THEN
    RAISE EXCEPTION 'Catálogo no disponible';
  END IF;
  IF _cliente_nombre IS NULL OR char_length(_cliente_nombre) < 1 OR char_length(_cliente_nombre) > 120 THEN
    RAISE EXCEPTION 'Nombre inválido';
  END IF;
  IF _cliente_telefono IS NOT NULL AND char_length(_cliente_telefono) > 40 THEN
    RAISE EXCEPTION 'Teléfono inválido';
  END IF;
  IF _notas IS NOT NULL AND char_length(_notas) > 1000 THEN
    RAISE EXCEPTION 'Notas demasiado largas';
  END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Pedido sin items';
  END IF;
  IF jsonb_array_length(_items) > 200 THEN
    RAISE EXCEPTION 'Demasiados items';
  END IF;

  FOR _it IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    _pid := (_it->>'id')::uuid;
    _vid := NULLIF(_it->>'variante_id','')::uuid;
    _qty := COALESCE((_it->>'qty')::int, 0);
    IF _qty <= 0 OR _qty > 1000 THEN
      RAISE EXCEPTION 'Cantidad inválida';
    END IF;

    SELECT stock, precio_venta, nombre INTO _stock_actual, _precio, _nombre_p
      FROM productos WHERE id = _pid AND negocio_id = _negocio_id AND activo = true;
    IF _stock_actual IS NULL THEN
      RAISE EXCEPTION 'Producto no encontrado';
    END IF;

    IF _vid IS NOT NULL THEN
      SELECT stock, COALESCE(precio_venta, _precio), nombre
        INTO _stock_var, _precio, _nombre_v
        FROM producto_variantes
        WHERE id = _vid AND producto_id = _pid AND negocio_id = _negocio_id AND activo = true;
      IF _stock_var IS NULL THEN
        RAISE EXCEPTION 'Variante no encontrada';
      END IF;
      IF _stock_var < _qty THEN
        RAISE EXCEPTION 'Stock insuficiente para %', _nombre_p;
      END IF;
    ELSE
      IF _stock_actual < _qty THEN
        RAISE EXCEPTION 'Stock insuficiente para %', _nombre_p;
      END IF;
    END IF;

    _precio := COALESCE(_precio, 0);
    _total_server := _total_server + (_precio * _qty);
    _items_clean := _items_clean || jsonb_build_object(
      'id', _pid,
      'variante_id', _vid,
      'nombre', CASE WHEN _vid IS NOT NULL THEN _nombre_p || ' - ' || _nombre_v ELSE _nombre_p END,
      'qty', _qty,
      'precio', _precio
    );
  END LOOP;

  INSERT INTO pedidos_whatsapp (negocio_id, cliente_nombre, cliente_telefono, notas, items, total, stock_reservado)
  VALUES (_negocio_id, _cliente_nombre, NULLIF(_cliente_telefono, ''), NULLIF(_notas, ''), _items_clean, _total_server, true)
  RETURNING id INTO _pedido_id;

  FOR _it IN SELECT * FROM jsonb_array_elements(_items_clean)
  LOOP
    _pid := (_it->>'id')::uuid;
    _vid := NULLIF(_it->>'variante_id','')::uuid;
    _qty := (_it->>'qty')::int;
    SELECT stock INTO _stock_actual FROM productos WHERE id = _pid;
    UPDATE productos SET stock = stock - _qty WHERE id = _pid;
    IF _vid IS NOT NULL THEN
      UPDATE producto_variantes SET stock = stock - _qty WHERE id = _vid;
    END IF;
    INSERT INTO stock_movements (negocio_id, producto_id, tipo, cantidad, stock_antes, ref_id, ref_tipo, notas)
    VALUES (_negocio_id, _pid, 'reserva', -_qty, _stock_actual, _pedido_id::text, 'pedido_catalogo',
      CASE WHEN _vid IS NOT NULL THEN 'Reserva catálogo (variante:' || _vid::text || ')' ELSE 'Reserva por pedido del catálogo' END);
  END LOOP;

  RETURN _pedido_id;
END;
$function$;


-- ----------------------------------------------------------------------------
-- Migration: 20260530131001_88d199fd-c7d4-4904-8c6f-092afcb2f812.sql
-- ----------------------------------------------------------------------------

-- Replace broad anon SELECT policies on base tables with security-barrier views that expose only safe public catalog columns.

-- 1) Drop anon SELECT policies on base tables
DROP POLICY IF EXISTS negocios_anon_public_read ON public.negocios;
DROP POLICY IF EXISTS prod_read_anon ON public.productos;
DROP POLICY IF EXISTS pv_read_anon ON public.producto_variantes;

-- Fully revoke any anon table-level/column-level grants on the base tables
DO $$ BEGIN REVOKE ALL ON public.negocios FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE ALL ON public.productos FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE ALL ON public.producto_variantes FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 2) Create public catalog views exposing only non-sensitive columns
CREATE OR REPLACE VIEW public.negocios_public
WITH (security_invoker = true, security_barrier = true) AS
SELECT id, nombre, slug, plan, tipo_negocio
FROM public.negocios
WHERE public.negocio_has_pro(id);

CREATE OR REPLACE VIEW public.productos_public
WITH (security_invoker = true, security_barrier = true) AS
SELECT id, negocio_id, sucursal_id, nombre, descripcion, categoria, categorias,
       precio_venta, stock, stock_min, imagen_url, galeria, unidad,
       cantidad_minima, activo
FROM public.productos
WHERE activo = true AND public.negocio_has_pro(negocio_id);

CREATE OR REPLACE VIEW public.producto_variantes_public
WITH (security_invoker = true, security_barrier = true) AS
SELECT id, producto_id, negocio_id, nombre, stock, precio_venta, imagen_url, activo
FROM public.producto_variantes
WHERE activo = true AND public.negocio_has_pro(negocio_id);

-- 3) For views to evaluate under security_invoker for anon, the anon role still needs
-- a SELECT policy on the base tables when accessed via the view. Add narrow anon
-- policies that mirror the view's WHERE clauses; column safety is enforced by the
-- view's column list and by the absence of any base-table GRANT to anon.
CREATE POLICY negocios_anon_via_view ON public.negocios
  FOR SELECT TO anon
  USING (public.negocio_has_pro(id));

CREATE POLICY prod_read_anon ON public.productos
  FOR SELECT TO anon
  USING (activo = true AND public.negocio_has_pro(negocio_id));

CREATE POLICY pv_read_anon ON public.producto_variantes
  FOR SELECT TO anon
  USING (activo = true AND public.negocio_has_pro(negocio_id));

-- Grant column-level SELECT on base tables matching exactly what the views expose
DO $$ BEGIN GRANT SELECT (id, nombre, slug, plan, tipo_negocio) ON public.negocios TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (id, negocio_id, sucursal_id, nombre, descripcion, categoria, categorias,
              precio_venta, stock, stock_min, imagen_url, galeria, unidad,
              cantidad_minima, activo) ON public.productos TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (id, producto_id, negocio_id, nombre, stock, precio_venta, imagen_url, activo)
  ON public.producto_variantes TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Grant the views themselves
DO $$ BEGIN GRANT SELECT ON public.negocios_public TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.productos_public TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.producto_variantes_public TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 4) configuracion: restrict sensitive columns (rut, direccion, telefono) to admins.
-- Keep business_name/logo/colors readable by all tenant members; rut/direccion/telefono only admins.
DROP POLICY IF EXISTS cfg_read ON public.configuracion;

CREATE POLICY cfg_read_admin ON public.configuracion
  FOR SELECT TO authenticated
  USING (negocio_id = current_negocio_id()
         AND has_role_in_negocio(auth.uid(), 'admin'::app_role, negocio_id));

-- Non-admin tenant members can only read non-sensitive columns via column-level grant
DO $$ BEGIN REVOKE SELECT ON public.configuracion FROM authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (id, negocio_id, business_name, moneda, color_primary, logo_url, created_at)
  ON public.configuracion TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (id, negocio_id, business_name, moneda, color_primary, logo_url, rut, direccion, telefono, created_at)
  ON public.configuracion TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
-- (The admin policy + full column grant is achieved via the second GRANT;
-- non-admins still can't read because cfg_read_admin gates the rows.)
-- Add a separate non-sensitive read policy for tenant members:
CREATE POLICY cfg_read_members ON public.configuracion
  FOR SELECT TO authenticated
  USING (negocio_id = current_negocio_id());

-- Preserve write permissions (cfg_write policy already covers ALL but requires table-level grants):
DO $$ BEGIN GRANT INSERT, UPDATE, DELETE ON public.configuracion TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ----------------------------------------------------------------------------
-- Migration: 20260531003351_22832006-966d-4465-b114-d4eabdfd2ec3.sql
-- ----------------------------------------------------------------------------
-- Fix: anon should only read via views, not base tables
DROP POLICY IF EXISTS negocios_anon_via_view ON public.negocios;
DROP POLICY IF EXISTS prod_read_anon ON public.productos;
DROP POLICY IF EXISTS pv_read_anon ON public.producto_variantes;

DO $$ BEGIN REVOKE ALL ON public.negocios FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE ALL ON public.productos FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE ALL ON public.producto_variantes FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Ensure the public views are accessible to anon
DO $$ BEGIN GRANT SELECT ON public.negocios_public TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.productos_public TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.producto_variantes_public TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Fix: non-admin members should not read rut/direccion/telefono from configuracion
DROP POLICY IF EXISTS cfg_read_members ON public.configuracion;
-- Only admins retain SELECT via cfg_read_admin. Non-admins do not need this table;
-- if a non-admin surface needs business_name/logo, a dedicated view should be added.

-- ----------------------------------------------------------------------------
-- Migration: 20260531232826_f8599649-6054-4205-84a7-d963c0abd77e.sql
-- ----------------------------------------------------------------------------

-- Restore narrow anon SELECT policies on base tables so security_invoker public views can return rows for anonymous catalog visitors.

CREATE POLICY negocios_anon_public_read ON public.negocios
  FOR SELECT TO anon
  USING (negocio_has_pro(id));

CREATE POLICY prod_read_anon ON public.productos
  FOR SELECT TO anon
  USING (activo = true AND negocio_has_pro(negocio_id));

CREATE POLICY pv_read_anon ON public.producto_variantes
  FOR SELECT TO anon
  USING (activo = true AND negocio_has_pro(negocio_id));

-- Anon needs base-table column SELECT grants too (the views are security_invoker).
-- Grant only the safe public catalog columns; sensitive columns remain unreachable.
DO $$ BEGIN GRANT SELECT (id, nombre, slug, plan, tipo_negocio) ON public.negocios TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (id, negocio_id, sucursal_id, nombre, descripcion, categoria, categorias, precio_venta, stock, stock_min, imagen_url, galeria, unidad, cantidad_minima, activo) ON public.productos TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (id, producto_id, negocio_id, nombre, stock, precio_venta, imagen_url, activo) ON public.producto_variantes TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ----------------------------------------------------------------------------
-- Migration: 20260601001951_6db9361a-6a89-4abf-a54b-6bbf96175705.sql
-- ----------------------------------------------------------------------------
-- Restrict configuracion writes to admins only
DROP POLICY IF EXISTS cfg_write ON public.configuracion;

CREATE POLICY cfg_write_admin_insert ON public.configuracion
  FOR INSERT TO authenticated
  WITH CHECK (negocio_id = current_negocio_id() AND has_role_in_negocio(auth.uid(), 'admin'::app_role, negocio_id));

CREATE POLICY cfg_write_admin_update ON public.configuracion
  FOR UPDATE TO authenticated
  USING (negocio_id = current_negocio_id() AND has_role_in_negocio(auth.uid(), 'admin'::app_role, negocio_id))
  WITH CHECK (negocio_id = current_negocio_id() AND has_role_in_negocio(auth.uid(), 'admin'::app_role, negocio_id));

CREATE POLICY cfg_write_admin_delete ON public.configuracion
  FOR DELETE TO authenticated
  USING (negocio_id = current_negocio_id() AND has_role_in_negocio(auth.uid(), 'admin'::app_role, negocio_id));

-- Explicitly block direct INSERTs into cupon_canjes from regular users.
-- Redemptions must go through the SECURITY DEFINER function canjear_cupon_interno.
CREATE POLICY canjes_no_direct_insert ON public.cupon_canjes
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- Migration: 20260601005759_2a4616c9-f324-48f9-a844-c2535e5bde02.sql
-- ----------------------------------------------------------------------------
-- Drop unused public insert policy on pedidos_whatsapp (orders go through crear_pedido_catalogo RPC)
DROP POLICY IF EXISTS pw_public_insert ON public.pedidos_whatsapp;

-- Revoke residual anon privileges on sensitive tables (defense in depth)
DO $$ BEGIN REVOKE ALL ON public.configuracion FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE ALL ON public.cupon_canjes FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE ALL ON public.pedidos_whatsapp FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- Migration: 20260601014246_b822a86c-0b30-4f54-8e99-adb522443759.sql
-- ----------------------------------------------------------------------------
-- Restrict anonymous SELECT to non-sensitive columns only.
-- Authenticated users keep full table access via existing grants.

-- productos: hide precio_costo, proveedor, notas from anon
DO $$ BEGIN REVOKE SELECT ON public.productos FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (
  id, negocio_id, nombre, descripcion, categoria, categorias,
  precio_venta, stock, stock_min, codigo, imagen_url, galeria,
  variantes, unidad, cantidad_minima, activo, sucursal_id,
  created_at, updated_at
) ON public.productos TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- producto_variantes: hide precio_costo from anon
DO $$ BEGIN REVOKE SELECT ON public.producto_variantes FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (
  id, negocio_id, producto_id, nombre, precio_venta, stock,
  imagen_url, codigo, activo, created_at, updated_at
) ON public.producto_variantes TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- negocios: hide rut from anon public catalog reads
DO $$ BEGIN REVOKE SELECT ON public.negocios FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (
  id, nombre, slug, direccion, plan, tipo_negocio, created_at
) ON public.negocios TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ----------------------------------------------------------------------------
-- Migration: 20260601020304_69807d67-f5be-40c3-b0da-88466f96c6f2.sql
-- ----------------------------------------------------------------------------
-- Add promotional price fields
ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS precio_promocional numeric,
  ADD COLUMN IF NOT EXISTS promo_vence_at timestamptz;

ALTER TABLE public.producto_variantes
  ADD COLUMN IF NOT EXISTS precio_promocional numeric,
  ADD COLUMN IF NOT EXISTS promo_vence_at timestamptz;

-- Recreate public views including new fields
CREATE OR REPLACE VIEW public.productos_public
WITH (security_invoker = true, security_barrier = true) AS
SELECT id, negocio_id, sucursal_id, nombre, descripcion, categoria, categorias,
       precio_venta, stock, stock_min, imagen_url, galeria, unidad, cantidad_minima, activo,
       precio_promocional, promo_vence_at
  FROM public.productos
 WHERE activo = true AND public.negocio_has_pro(negocio_id);

CREATE OR REPLACE VIEW public.producto_variantes_public
WITH (security_invoker = true, security_barrier = true) AS
SELECT id, producto_id, negocio_id, nombre, stock, precio_venta, imagen_url, activo,
       precio_promocional, promo_vence_at
  FROM public.producto_variantes
 WHERE activo = true AND public.negocio_has_pro(negocio_id);

-- ----------------------------------------------------------------------------
-- Migration: 20260601021238_d2119845-2461-429a-a559-05543735c044.sql
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL,
  nombre text NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  activa boolean NOT NULL DEFAULT true,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (negocio_id, nombre)
);

DO $$ BEGIN GRANT SELECT ON public.categorias TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT, INSERT, UPDATE, DELETE ON public.categorias TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT ALL ON public.categorias TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;

ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cat_read_anon" ON public.categorias FOR SELECT TO anon
  USING (activa = true AND public.negocio_has_pro(negocio_id));

CREATE POLICY "cat_read_auth" ON public.categorias FOR SELECT TO authenticated
  USING (negocio_id = public.current_negocio_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "cat_write" ON public.categorias FOR ALL TO authenticated
  USING (negocio_id = public.current_negocio_id())
  WITH CHECK (negocio_id = public.current_negocio_id());

CREATE INDEX IF NOT EXISTS idx_categorias_negocio_orden ON public.categorias(negocio_id, orden);

CREATE TRIGGER trg_categorias_updated_at
  BEFORE UPDATE ON public.categorias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ----------------------------------------------------------------------------
-- Migration: 20260601022218_b39babe0-bbf2-4830-a355-29b842afb8ab.sql
-- ----------------------------------------------------------------------------
DO $$ BEGIN GRANT SELECT (precio_promocional, promo_vence_at) ON public.productos TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (precio_promocional, promo_vence_at) ON public.producto_variantes TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- Migration: 20260604013931_e134b64e-4a4b-4fe7-97c0-4d1ba5ffafbd.sql
-- ----------------------------------------------------------------------------

-- 1) Estados de compra
ALTER TABLE public.compras DROP CONSTRAINT IF EXISTS compras_estado_check;
ALTER TABLE public.compras ADD CONSTRAINT compras_estado_check
  CHECK (estado = ANY (ARRAY['creada','recibida','completada','credito','pendiente','cancelada']));
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS recibida_at timestamptz;
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS recibida_por uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2) Cantidad recibida en detalle
ALTER TABLE public.compra_detalle ADD COLUMN IF NOT EXISTS cantidad_recibida integer;

-- 3) Catálogo de proveedor: costo promedio
ALTER TABLE public.proveedor_productos ADD COLUMN IF NOT EXISTS costo_promedio numeric(12,2);
ALTER TABLE public.proveedor_productos ADD COLUMN IF NOT EXISTS total_cantidad integer NOT NULL DEFAULT 0;
ALTER TABLE public.proveedor_productos ADD COLUMN IF NOT EXISTS total_compras integer NOT NULL DEFAULT 0;
ALTER TABLE public.proveedor_productos ADD COLUMN IF NOT EXISTS notas text;

-- 4) Función para recibir una compra
CREATE OR REPLACE FUNCTION public.recibir_compra(_compra_id uuid, _recepciones jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _nid uuid := current_negocio_id();
  _uid uuid := auth.uid();
  _cmp compras%ROWTYPE;
  _det compra_detalle%ROWTYPE;
  _it jsonb;
  _qty_rec int;
  _stock_actual int;
  _today date := current_date;
  _prev_total_qty int;
  _prev_avg numeric;
  _new_total_qty int;
  _new_avg numeric;
BEGIN
  IF _nid IS NULL THEN RAISE EXCEPTION 'Sin negocio'; END IF;

  SELECT * INTO _cmp FROM compras WHERE id = _compra_id AND negocio_id = _nid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Compra no encontrada'; END IF;
  IF _cmp.estado = 'recibida' THEN RAISE EXCEPTION 'La compra ya fue recibida'; END IF;
  IF _cmp.estado = 'cancelada' THEN RAISE EXCEPTION 'La compra está cancelada'; END IF;

  -- Recorrer recepciones [{detalle_id, cantidad_recibida}]
  FOR _it IN SELECT * FROM jsonb_array_elements(COALESCE(_recepciones, '[]'::jsonb))
  LOOP
    SELECT * INTO _det FROM compra_detalle
      WHERE id = (_it->>'detalle_id')::uuid AND compra_id = _compra_id FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;

    _qty_rec := GREATEST(COALESCE((_it->>'cantidad_recibida')::int, 0), 0);

    UPDATE compra_detalle SET cantidad_recibida = _qty_rec WHERE id = _det.id;

    IF _qty_rec > 0 AND _det.producto_id IS NOT NULL THEN
      SELECT COALESCE(stock,0) INTO _stock_actual FROM productos WHERE id = _det.producto_id FOR UPDATE;
      UPDATE productos
        SET stock = COALESCE(stock,0) + _qty_rec,
            precio_costo = _det.precio_unitario
        WHERE id = _det.producto_id;

      INSERT INTO stock_movements
        (negocio_id, producto_id, tipo, cantidad, stock_antes, ref_id, ref_tipo, notas)
      VALUES
        (_nid, _det.producto_id, 'compra', _qty_rec, _stock_actual,
         _compra_id::text, 'compra', 'Recepción de compra');

      -- Actualizar catálogo proveedor (promedio ponderado)
      IF _cmp.proveedor_id IS NOT NULL THEN
        SELECT COALESCE(total_cantidad,0), COALESCE(costo_promedio,0)
          INTO _prev_total_qty, _prev_avg
          FROM proveedor_productos
          WHERE proveedor_id = _cmp.proveedor_id AND producto_id = _det.producto_id;

        IF NOT FOUND THEN
          INSERT INTO proveedor_productos
            (negocio_id, proveedor_id, producto_id, ultimo_precio, ultima_fecha, activo,
             costo_promedio, total_cantidad, total_compras)
          VALUES
            (_nid, _cmp.proveedor_id, _det.producto_id, _det.precio_unitario, _today, true,
             _det.precio_unitario, _qty_rec, 1);
        ELSE
          _new_total_qty := _prev_total_qty + _qty_rec;
          _new_avg := CASE WHEN _new_total_qty > 0
            THEN ((_prev_avg * _prev_total_qty) + (_det.precio_unitario * _qty_rec)) / _new_total_qty
            ELSE _det.precio_unitario END;
          UPDATE proveedor_productos
            SET ultimo_precio = _det.precio_unitario,
                ultima_fecha = _today,
                costo_promedio = _new_avg,
                total_cantidad = _new_total_qty,
                total_compras = COALESCE(total_compras,0) + 1,
                activo = true
            WHERE proveedor_id = _cmp.proveedor_id AND producto_id = _det.producto_id;
        END IF;
      END IF;
    END IF;
  END LOOP;

  UPDATE compras
    SET estado = 'recibida',
        recibida_at = now(),
        recibida_por = _uid
    WHERE id = _compra_id;
END;
$$;

-- 5) Función para agregar manualmente al catálogo del proveedor
CREATE OR REPLACE FUNCTION public.agregar_producto_a_proveedor(
  _proveedor_id uuid, _producto_id uuid, _precio numeric, _notas text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _nid uuid := current_negocio_id();
  _id uuid;
BEGIN
  IF _nid IS NULL THEN RAISE EXCEPTION 'Sin negocio'; END IF;

  INSERT INTO proveedor_productos
    (negocio_id, proveedor_id, producto_id, ultimo_precio, ultima_fecha, activo, costo_promedio, notas)
  VALUES
    (_nid, _proveedor_id, _producto_id, _precio, current_date, true, _precio, _notas)
  ON CONFLICT (negocio_id, proveedor_id, producto_id)
    DO UPDATE SET ultimo_precio = COALESCE(EXCLUDED.ultimo_precio, proveedor_productos.ultimo_precio),
                  notas = COALESCE(EXCLUDED.notas, proveedor_productos.notas),
                  activo = true
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;


-- ----------------------------------------------------------------------------
-- Migration: 20260604014917_ce12aece-7226-4f69-b539-6c8588babf72.sql
-- ----------------------------------------------------------------------------

DO $$ BEGIN REVOKE SELECT ON public.productos FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (id, negocio_id, nombre, descripcion, categoria, categorias, precio_venta, precio_promocional, promo_vence_at, imagen_url, galeria, codigo, unidad, cantidad_minima, variantes, activo, stock, sucursal_id, created_at, updated_at) ON public.productos TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN REVOKE SELECT ON public.producto_variantes FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (id, negocio_id, producto_id, nombre, codigo, imagen_url, precio_venta, precio_promocional, promo_vence_at, stock, activo, created_at, updated_at) ON public.producto_variantes TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE POLICY roles_no_update_non_super ON public.user_roles
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));


-- ----------------------------------------------------------------------------
-- Migration: 20260604031845_e3512a44-decf-4445-b268-7d108f836bbc.sql
-- ----------------------------------------------------------------------------

-- 1) Código interno para productos
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS codigo_interno text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_prod_codint ON public.productos(negocio_id, codigo_interno) WHERE codigo_interno IS NOT NULL;

CREATE OR REPLACE FUNCTION public.next_codigo_interno(_negocio_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _max int;
  _n int;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(codigo_interno, '\D', '', 'g'), '')::int), 0)
    INTO _max
    FROM productos
    WHERE negocio_id = _negocio_id AND codigo_interno ~ '^P-?\d+$';
  _n := _max + 1;
  RETURN 'P-' || lpad(_n::text, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.productos_set_codigo_interno()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.codigo_interno IS NULL OR length(trim(NEW.codigo_interno)) = 0 THEN
    NEW.codigo_interno := public.next_codigo_interno(NEW.negocio_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_productos_codint ON public.productos;
CREATE TRIGGER trg_productos_codint
  BEFORE INSERT ON public.productos
  FOR EACH ROW EXECUTE FUNCTION public.productos_set_codigo_interno();

-- Backfill para productos existentes
DO $$
DECLARE r RECORD; _n int;
BEGIN
  FOR r IN SELECT DISTINCT negocio_id FROM productos WHERE codigo_interno IS NULL LOOP
    _n := COALESCE((SELECT MAX(NULLIF(regexp_replace(codigo_interno, '\D', '', 'g'), '')::int)
                    FROM productos WHERE negocio_id = r.negocio_id AND codigo_interno ~ '^P-?\d+$'), 0);
    FOR r IN SELECT id FROM productos WHERE negocio_id = r.negocio_id AND codigo_interno IS NULL ORDER BY created_at LOOP
      _n := _n + 1;
      UPDATE productos SET codigo_interno = 'P-' || lpad(_n::text, 5, '0') WHERE id = r.id;
    END LOOP;
  END LOOP;
END $$;

-- 2) Cancelar compra creada
CREATE OR REPLACE FUNCTION public.cancelar_compra(_compra_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _nid uuid := current_negocio_id(); _cmp compras%ROWTYPE;
BEGIN
  IF _nid IS NULL THEN RAISE EXCEPTION 'Sin negocio'; END IF;
  SELECT * INTO _cmp FROM compras WHERE id = _compra_id AND negocio_id = _nid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Compra no encontrada'; END IF;
  IF _cmp.estado = 'recibida' THEN RAISE EXCEPTION 'No se puede cancelar una compra ya recibida'; END IF;
  UPDATE compras SET estado = 'cancelada' WHERE id = _compra_id;
END;
$$;

-- 3) Función para ver email del recepcionista (super admin o mismo negocio)
CREATE OR REPLACE FUNCTION public.compra_recibida_por_email(_compra_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.email
  FROM compras c
  JOIN profiles p ON p.id = c.recibida_por
  WHERE c.id = _compra_id AND c.negocio_id = current_negocio_id();
$$;

DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.next_codigo_interno(uuid) TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.cancelar_compra(uuid) TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.compra_recibida_por_email(uuid) TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ----------------------------------------------------------------------------
-- Migration: 20260604032605_ef76b48a-8183-4769-99bc-e12c00c1d728.sql
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_productos_codint ON public.productos;
DROP FUNCTION IF EXISTS public.next_codigo_interno() CASCADE;
DROP FUNCTION IF EXISTS public.trg_set_codigo_interno() CASCADE;

-- ----------------------------------------------------------------------------
-- Migration: 20260605153103_32045344-ee5e-4a2d-b347-a2d6ddd255f0.sql
-- ----------------------------------------------------------------------------

ALTER TABLE public.categorias
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.categorias(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS imagen_url text,
  ADD COLUMN IF NOT EXISTS descripcion text;

CREATE INDEX IF NOT EXISTS idx_categorias_parent ON public.categorias(parent_id);

CREATE OR REPLACE FUNCTION public.categorias_validate_parent()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _parent_parent uuid;
  _has_children boolean;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    IF NEW.parent_id = NEW.id THEN
      RAISE EXCEPTION 'Una categoría no puede ser su propia padre';
    END IF;
    SELECT parent_id INTO _parent_parent FROM public.categorias WHERE id = NEW.parent_id;
    IF _parent_parent IS NOT NULL THEN
      RAISE EXCEPTION 'Máximo 2 niveles de jerarquía permitidos';
    END IF;
    SELECT EXISTS (SELECT 1 FROM public.categorias WHERE parent_id = NEW.id) INTO _has_children;
    IF _has_children THEN
      RAISE EXCEPTION 'Esta categoría tiene subcategorías y no puede convertirse en subcategoría';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_categorias_validate_parent ON public.categorias;
CREATE TRIGGER trg_categorias_validate_parent
  BEFORE INSERT OR UPDATE OF parent_id ON public.categorias
  FOR EACH ROW EXECUTE FUNCTION public.categorias_validate_parent();


-- ----------------------------------------------------------------------------
-- Migration: 20260605155121_22620cf5-8f9f-4e20-972d-d5d85a292472.sql
-- ----------------------------------------------------------------------------

-- 1) producto_variantes: revoke broad anon SELECT, grant only safe columns
DO $$ BEGIN REVOKE SELECT ON public.producto_variantes FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (id, producto_id, negocio_id, nombre, precio_venta, imagen_url, stock, activo, codigo, precio_promocional, promo_vence_at)
  ON public.producto_variantes TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 2) next_codigo_interno: add tenancy guard
CREATE OR REPLACE FUNCTION public.next_codigo_interno(_negocio_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _max int;
  _n int;
BEGIN
  IF _negocio_id IS NULL THEN
    RAISE EXCEPTION 'negocio_id requerido';
  END IF;
  IF _negocio_id <> public.current_negocio_id()
     AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT COALESCE(MAX(NULLIF(regexp_replace(codigo_interno, '\D', '', 'g'), '')::int), 0)
    INTO _max
    FROM productos
    WHERE negocio_id = _negocio_id AND codigo_interno ~ '^P-?\d+$';
  _n := _max + 1;
  RETURN 'P-' || lpad(_n::text, 5, '0');
END;
$function$;

-- 3) profiles_admin_update: add WITH CHECK to prevent tenant moving
DROP POLICY IF EXISTS profiles_admin_update ON public.profiles;
CREATE POLICY profiles_admin_update ON public.profiles
  FOR UPDATE
  USING (
    negocio_id = public.current_negocio_id()
    AND public.has_role_in_negocio(auth.uid(), 'admin'::app_role, negocio_id)
  )
  WITH CHECK (
    negocio_id = public.current_negocio_id()
    AND public.has_role_in_negocio(auth.uid(), 'admin'::app_role, negocio_id)
  );


-- ----------------------------------------------------------------------------
-- Migration: 20260606212628_ab379723-b226-4c9d-926b-b4d6890cdfa9.sql
-- ----------------------------------------------------------------------------
ALTER VIEW public.productos_public SET (security_invoker = false);
ALTER VIEW public.producto_variantes_public SET (security_invoker = false);
ALTER VIEW public.negocios_public SET (security_invoker = false);

-- ----------------------------------------------------------------------------
-- Migration: 20260606213309_f70f17a9-8356-4624-a682-bcd0ce2fea6d.sql
-- ----------------------------------------------------------------------------
-- Grant base SELECT so RLS can decide row visibility for catalog views
DO $$ BEGIN GRANT SELECT ON public.productos TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.producto_variantes TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.negocios TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Flip catalog views back to security_invoker so they honor caller RLS
ALTER VIEW public.productos_public SET (security_invoker = true);
ALTER VIEW public.producto_variantes_public SET (security_invoker = true);
ALTER VIEW public.negocios_public SET (security_invoker = true);

DO $$ BEGIN GRANT SELECT ON public.productos_public TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.producto_variantes_public TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.negocios_public TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- Migration: 20260608214453_c74a066a-c775-4c20-a0a5-4b3421e395f0.sql
-- ----------------------------------------------------------------------------

ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS requiere_preparacion boolean NOT NULL DEFAULT true;
ALTER TABLE public.comanda_items ADD COLUMN IF NOT EXISTS requiere_preparacion boolean NOT NULL DEFAULT true;
ALTER TABLE public.negocios ADD COLUMN IF NOT EXISTS kds_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE OR REPLACE FUNCTION public.kds_snapshot(_slug text, _token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _nid uuid; _nombre text;
BEGIN
  SELECT id, nombre INTO _nid, _nombre FROM public.negocios WHERE slug = _slug AND kds_token = _token;
  IF _nid IS NULL THEN RAISE EXCEPTION 'No autorizado'; END IF;
  RETURN jsonb_build_object(
    'negocio', jsonb_build_object('nombre', _nombre, 'slug', _slug),
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ci.id,
        'nombre', ci.nombre,
        'qty', ci.qty,
        'estado', ci.estado,
        'notas', ci.notas,
        'created_at', ci.created_at,
        'tipo', c.tipo,
        'mesa', (SELECT numero FROM public.mesas WHERE id = c.mesa_id)
      ) ORDER BY ci.created_at)
      FROM public.comanda_items ci
      JOIN public.comandas c ON c.id = ci.comanda_id
      WHERE ci.negocio_id = _nid
        AND ci.estado IN ('pendiente','preparando')
        AND ci.requiere_preparacion = true
    ), '[]'::jsonb)
  );
END; $$;

CREATE OR REPLACE FUNCTION public.kds_set_estado(_slug text, _token uuid, _item_id uuid, _estado text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _nid uuid;
BEGIN
  SELECT id INTO _nid FROM public.negocios WHERE slug = _slug AND kds_token = _token;
  IF _nid IS NULL THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF _estado NOT IN ('pendiente','preparando','listo','entregado') THEN RAISE EXCEPTION 'Estado inválido'; END IF;
  UPDATE public.comanda_items SET estado = _estado WHERE id = _item_id AND negocio_id = _nid;
END; $$;

DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.kds_snapshot(text, uuid) TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.kds_set_estado(text, uuid, uuid, text) TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ----------------------------------------------------------------------------
-- Migration: 20260609010339_c90edd65-b68a-4895-b3d5-8b88565b990b.sql
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kds_snapshot(_slug text, _token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _nid uuid; _nombre text;
BEGIN
  SELECT id, nombre INTO _nid, _nombre FROM public.negocios WHERE slug = _slug AND kds_token = _token;
  IF _nid IS NULL THEN RAISE EXCEPTION 'No autorizado'; END IF;
  RETURN jsonb_build_object(
    'negocio', jsonb_build_object('nombre', _nombre, 'slug', _slug),
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ci.id,
        'nombre', ci.nombre,
        'qty', ci.qty,
        'estado', ci.estado,
        'notas', ci.notas,
        'created_at', ci.created_at,
        'tipo', c.tipo,
        'mesa', (SELECT numero FROM public.mesas WHERE id = c.mesa_id)
      ) ORDER BY ci.created_at)
      FROM public.comanda_items ci
      JOIN public.comandas c ON c.id = ci.comanda_id
      WHERE ci.negocio_id = _nid
        AND ci.estado IN ('pendiente','preparando','listo')
        AND ci.requiere_preparacion = true
    ), '[]'::jsonb)
  );
END; $function$;

-- ----------------------------------------------------------------------------
-- Migration: 20260609011234_131455b5-6621-46c6-9447-73897da1959e.sql
-- ----------------------------------------------------------------------------
DO $$ BEGIN REVOKE SELECT ON public.negocios FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (id, nombre, slug, tipo_negocio, plan, rut, direccion, created_at) ON public.negocios TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- Migration: 20260611004703_0763d6da-b2f1-46a7-9193-6ad5c8bf66b5.sql
-- ----------------------------------------------------------------------------
DO $$ BEGIN REVOKE SELECT ON public.negocios FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (id, nombre, slug, tipo_negocio, plan, created_at) ON public.negocios TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- Migration: 20260612002214_c2b6eeba-0e86-4c87-a23d-b05cd1b804ad.sql
-- ----------------------------------------------------------------------------

CREATE TABLE public.producto_imagenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id uuid NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  negocio_id uuid NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  url text NOT NULL,
  orden int NOT NULL DEFAULT 0,
  es_principal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_producto_imagenes_producto ON public.producto_imagenes(producto_id, orden);
CREATE INDEX idx_producto_imagenes_negocio ON public.producto_imagenes(negocio_id);
CREATE UNIQUE INDEX uniq_producto_imagen_principal ON public.producto_imagenes(producto_id) WHERE es_principal = true;

DO $$ BEGIN GRANT SELECT, INSERT, UPDATE, DELETE ON public.producto_imagenes TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.producto_imagenes TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT ALL ON public.producto_imagenes TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;

ALTER TABLE public.producto_imagenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "negocio puede gestionar imágenes" ON public.producto_imagenes
  FOR ALL TO authenticated
  USING (negocio_id = public.current_negocio_id())
  WITH CHECK (negocio_id = public.current_negocio_id());

CREATE POLICY "lectura pública de imágenes" ON public.producto_imagenes
  FOR SELECT TO anon
  USING (true);

-- Validar máximo 4 imágenes por producto
CREATE OR REPLACE FUNCTION public.producto_imagenes_validar()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _count int;
BEGIN
  SELECT count(*) INTO _count FROM public.producto_imagenes WHERE producto_id = NEW.producto_id;
  IF TG_OP = 'INSERT' AND _count >= 4 THEN
    RAISE EXCEPTION 'Máximo 4 imágenes por producto';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_producto_imagenes_validar
BEFORE INSERT ON public.producto_imagenes
FOR EACH ROW EXECUTE FUNCTION public.producto_imagenes_validar();

-- Sincronizar imagen_url del producto con la principal (o la primera por orden)
CREATE OR REPLACE FUNCTION public.producto_imagenes_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _pid uuid; _url text;
BEGIN
  _pid := COALESCE(NEW.producto_id, OLD.producto_id);
  SELECT url INTO _url FROM public.producto_imagenes
    WHERE producto_id = _pid
    ORDER BY es_principal DESC, orden ASC, created_at ASC
    LIMIT 1;
  UPDATE public.productos SET imagen_url = _url WHERE id = _pid;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_producto_imagenes_sync
AFTER INSERT OR UPDATE OR DELETE ON public.producto_imagenes
FOR EACH ROW EXECUTE FUNCTION public.producto_imagenes_sync();


-- ----------------------------------------------------------------------------
-- Migration: 20260614155812_0fcb3e9b-a501-45fd-bafe-d8b4799d0067.sql
-- ----------------------------------------------------------------------------
-- Revoke table-wide SELECT from anon on productos so that only column-level grants apply.
DO $$ BEGIN REVOKE SELECT ON public.productos FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Ensure only safe public catalog columns are readable by anon.
DO $$ BEGIN GRANT SELECT (
  id, negocio_id, nombre, categoria, categorias, descripcion,
  precio_venta, precio_promocional, promo_vence_at,
  imagen_url, galeria, variantes, unidad, cantidad_minima,
  stock, activo, sucursal_id, codigo, created_at, updated_at
) ON public.productos TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Explicitly ensure sensitive columns are NOT granted to anon.
DO $$ BEGIN REVOKE SELECT (precio_costo, proveedor, notas, stock_min, codigo_interno, requiere_preparacion)
  ON public.productos FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- Migration: 20260617005512_2e9f0b26-ec30-4a9a-914d-b6e795af2e57.sql
-- ----------------------------------------------------------------------------

-- Fix privilege escalation: ensure target user belongs to same negocio
DROP POLICY IF EXISTS roles_admin_insert ON public.user_roles;
CREATE POLICY roles_admin_insert ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    negocio_id = current_negocio_id()
    AND has_role_in_negocio(auth.uid(), 'admin'::app_role, negocio_id)
    AND role <> 'super_admin'::app_role
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_id AND p.negocio_id = current_negocio_id()
    )
  );

-- Restrict public bucket listing: drop the broad SELECT policy.
-- Direct downloads via the public bucket URL continue to work without an RLS policy;
-- only listing via the storage API is blocked for anon. Authenticated tenant users
-- get a scoped list policy.
DROP POLICY IF EXISTS "producto-imgs public read" ON storage.objects;

CREATE POLICY "producto-imgs tenant list" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'producto-imgs'
    AND (storage.foldername(name))[1] = (current_negocio_id())::text
  );


-- ----------------------------------------------------------------------------
-- Migration: 20260617010039_fb4a9b26-1b46-47c8-b45e-21198c8a53de.sql
-- ----------------------------------------------------------------------------
UPDATE auth.users
SET encrypted_password = crypt(encode(gen_random_bytes(32), 'base64'), gen_salt('bf')),
    updated_at = now()
WHERE email = 'demo-restaurant@operix.test';

-- ----------------------------------------------------------------------------
-- Migration: 20260620003237_2b0b8b87-96f5-4714-969f-14a7d3ef427e.sql
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.productos_public
WITH (security_invoker = on) AS
SELECT id, negocio_id, sucursal_id, nombre, descripcion, categoria, categorias,
       precio_venta, stock, stock_min, imagen_url, galeria, unidad,
       cantidad_minima, activo, precio_promocional, promo_vence_at
FROM public.productos
WHERE activo = true;

DROP POLICY IF EXISTS prod_read_anon ON public.productos;
CREATE POLICY prod_read_anon ON public.productos
  FOR SELECT TO anon
  USING (activo = true);

DO $$ BEGIN GRANT SELECT ON public.productos_public TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- Migration: 20260620003807_31269f71-ff47-44e1-9a94-aa31676caa30.sql
-- ----------------------------------------------------------------------------
DO $$ BEGIN GRANT SELECT (
  id,
  negocio_id,
  sucursal_id,
  nombre,
  descripcion,
  categoria,
  categorias,
  precio_venta,
  stock,
  stock_min,
  imagen_url,
  galeria,
  unidad,
  cantidad_minima,
  activo,
  precio_promocional,
  promo_vence_at
) ON public.productos TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN GRANT SELECT ON public.productos_public TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- Migration: 20260620004104_5079e23e-f3f8-4c63-a50d-8e188362cbd4.sql
-- ----------------------------------------------------------------------------

-- 1) producto_variantes: revoke table-wide SELECT for anon, grant only safe columns
DO $$ BEGIN REVOKE ALL ON public.producto_variantes FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (id, producto_id, negocio_id, nombre, codigo, precio_venta, precio_promocional, promo_vence_at, stock, imagen_url, activo) ON public.producto_variantes TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 2) productos: revoke stock_min column from anon (already restricted for precio_costo/proveedor/notas)
DO $$ BEGIN REVOKE SELECT (stock_min) ON public.productos FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 3) historial_precios: revoke anon access entirely (it's an internal audit table)
DO $$ BEGIN REVOKE ALL ON public.historial_precios FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 4) stock_movements: revoke anon access entirely (it's an internal audit table)
DO $$ BEGIN REVOKE ALL ON public.stock_movements FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 5) historial_precios: add RESTRICTIVE policy preventing DELETE except for super_admin
DROP POLICY IF EXISTS "historial_precios_no_delete" ON public.historial_precios;
CREATE POLICY "historial_precios_no_delete"
  ON public.historial_precios AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- 6) stock_movements: add RESTRICTIVE policies preventing UPDATE/DELETE except super_admin
DROP POLICY IF EXISTS "stock_movements_no_update" ON public.stock_movements;
CREATE POLICY "stock_movements_no_update"
  ON public.stock_movements AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "stock_movements_no_delete" ON public.stock_movements;
CREATE POLICY "stock_movements_no_delete"
  ON public.stock_movements AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));


-- ----------------------------------------------------------------------------
-- Migration: 20260620004749_5a8f9825-0ec2-4f4b-9a75-7ce4b033eb59.sql
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'pedidos_whatsapp'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.pedidos_whatsapp';
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime
  ADD TABLE public.pedidos_whatsapp
  (id, negocio_id, estado, total, created_at, saved_at, stock_reservado, fiado, cliente_id, motivo_devolucion);


-- ----------------------------------------------------------------------------
-- Migration: 20260620004844_b218b035-82e3-41c5-b59d-ac55c7cce158.sql
-- ----------------------------------------------------------------------------

-- Defense-in-depth: add a RESTRICTIVE policy on cupones_internos that requires
-- super_admin for every operation, so any future permissive policy cannot
-- accidentally open coupon read/write to other roles.
DROP POLICY IF EXISTS "cupones_super_only_restrictive" ON public.cupones_internos;
CREATE POLICY "cupones_super_only_restrictive"
  ON public.cupones_internos AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));


-- ----------------------------------------------------------------------------
-- Migration: 20260620005026_42a16633-f5f6-4ce5-b611-d9d64e390e0c.sql
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_negocio_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT negocio_id FROM public.profiles WHERE id = auth.uid()),
    '00000000-0000-0000-0000-000000000000'::uuid
  )
$$;


-- ----------------------------------------------------------------------------
-- Migration: 20260620005824_bcf5c117-12ac-4f4c-9c34-0894b9b8b32f.sql
-- ----------------------------------------------------------------------------
-- Revoke EXECUTE from anon on SECURITY DEFINER functions that should not be callable by unauthenticated clients.
-- Keep anon EXECUTE only on the genuinely public endpoints: crear_pedido_catalogo (public catalog ordering),
-- kds_snapshot / kds_set_estado (token-authenticated kitchen display), and negocio_has_pro (catalog availability check).

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.agregar_producto_a_proveedor(uuid, uuid, numeric, text) FROM anon, public; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.cancelar_compra(uuid) FROM anon, public; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.canjear_cupon_interno(text) FROM anon, public; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.compra_recibida_por_email(uuid) FROM anon, public; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, public; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.descontar_stock_producto(uuid, uuid, integer, uuid) FROM anon, public; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, public; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, public; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.next_codigo_interno(uuid) FROM anon, public; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, public; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.recibir_compra(uuid, jsonb) FROM anon, public; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.sa_cupon_eliminar(uuid) FROM anon, public; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.sa_cupon_upsert(uuid, text, text, integer, integer, timestamptz, boolean, text) FROM anon, public; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.sa_eliminar_negocio(uuid) FROM anon, public; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.sa_kpis_globales() FROM anon, public; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.sa_negocio_detalle(uuid) FROM anon, public; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.sa_set_suscripcion(uuid, text, text, timestamptz, text) FROM anon, public; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.set_tipo_negocio(text) FROM anon, public; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.vincular_pedido_a_fiado(uuid, uuid) FROM anon, public; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.productos_set_codigo_interno() FROM anon, public; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.producto_imagenes_sync() FROM anon, public; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.producto_imagenes_validar() FROM anon, public; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.categorias_validate_parent() FROM anon, public; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM anon, public; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- Migration: 20260620010247_dcb6870c-d04e-48a6-a495-70b0e209c0bb.sql
-- ----------------------------------------------------------------------------
-- 1) Recreate productos_public WITHOUT stock_min, requiring pro plan
DROP VIEW IF EXISTS public.productos_public CASCADE;
CREATE VIEW public.productos_public
WITH (security_invoker = true) AS
SELECT id, negocio_id, sucursal_id, nombre, descripcion, categoria, categorias,
       precio_venta, stock, imagen_url, galeria, unidad, cantidad_minima,
       activo, precio_promocional, promo_vence_at
FROM public.productos
WHERE activo = true AND public.negocio_has_pro(negocio_id);

-- 2) Recreate negocios_public WITHOUT plan
DROP VIEW IF EXISTS public.negocios_public CASCADE;
CREATE VIEW public.negocios_public
WITH (security_invoker = true) AS
SELECT id, nombre, slug, tipo_negocio
FROM public.negocios
WHERE public.negocio_has_pro(id);

-- 3) Recreate producto_variantes_public with security_invoker (same columns)
DROP VIEW IF EXISTS public.producto_variantes_public CASCADE;
CREATE VIEW public.producto_variantes_public
WITH (security_invoker = true) AS
SELECT id, producto_id, negocio_id, nombre, stock, precio_venta, imagen_url,
       activo, precio_promocional, promo_vence_at
FROM public.producto_variantes
WHERE activo = true AND public.negocio_has_pro(negocio_id);

-- 4) Grants on views
DO $$ BEGIN GRANT SELECT ON public.productos_public TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.negocios_public TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.producto_variantes_public TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT ALL    ON public.productos_public TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT ALL    ON public.negocios_public TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT ALL    ON public.producto_variantes_public TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 5) Lock down anon privileges on base tables that wrongly had full CRUD
DO $$ BEGIN REVOKE ALL ON public.categorias FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE ALL ON public.producto_imagenes FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.categorias TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.producto_imagenes TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 6) Replace overly permissive image-read policy with pro-gated, anon-only SELECT
DROP POLICY IF EXISTS "lectura pública de imágenes" ON public.producto_imagenes;
DROP POLICY IF EXISTS pi_read_anon ON public.producto_imagenes;
CREATE POLICY pi_read_anon ON public.producto_imagenes
  FOR SELECT TO anon
  USING (public.negocio_has_pro(negocio_id));

-- 7) Remove vestigial anon policies on base tables (anon goes through views, not base tables)
DROP POLICY IF EXISTS prod_read_anon ON public.productos;
DROP POLICY IF EXISTS pv_read_anon ON public.producto_variantes;
DROP POLICY IF EXISTS negocios_anon_public_read ON public.negocios;

-- 8) Ensure anon has NO grants on base tables that should only be accessed via views or SECURITY DEFINER RPCs
DO $$ BEGIN REVOKE ALL ON public.productos FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE ALL ON public.producto_variantes FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE ALL ON public.negocios FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE ALL ON public.pedidos_whatsapp FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- Migration: 20260621011502_c681f906-1561-41cd-a304-7289daa8f649.sql
-- ----------------------------------------------------------------------------

-- Switch public views to SECURITY DEFINER semantics (run as owner, bypass RLS on base tables).
-- This is the safe boundary: anon can ONLY see the columns exposed by the view, never the base table.
ALTER VIEW public.productos_public SET (security_invoker = false);
ALTER VIEW public.producto_variantes_public SET (security_invoker = false);
ALTER VIEW public.negocios_public SET (security_invoker = false);

-- Grant SELECT on the public views to anon (read-only catalog)
DO $$ BEGIN GRANT SELECT ON public.productos_public TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.producto_variantes_public TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.negocios_public TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- categorias and producto_imagenes already have anon RLS policies (cat_read_anon, pi_read_anon)
-- but the Data API needs explicit GRANTs too.
DO $$ BEGIN GRANT SELECT ON public.categorias TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.producto_imagenes TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ----------------------------------------------------------------------------
-- Migration: 20260621012419_8158f777-97d3-48f7-861c-75f58e5ca08c.sql
-- ----------------------------------------------------------------------------

-- Hide kds_token column from authenticated SELECT; expose via admin-only SECURITY DEFINER function
DO $$ BEGIN REVOKE SELECT ON public.negocios FROM authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (id, nombre, slug, plan, rut, direccion, created_at, tipo_negocio) ON public.negocios TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE UPDATE ON public.negocios FROM authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT UPDATE (nombre, slug, plan, rut, direccion, tipo_negocio) ON public.negocios TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.get_kds_token()
RETURNS TABLE(slug text, kds_token text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  nid uuid;
BEGIN
  SELECT negocio_id INTO nid FROM public.profiles WHERE id = auth.uid();
  IF nid IS NULL THEN
    RETURN;
  END IF;
  IF NOT (public.has_role_in_negocio(auth.uid(), nid, 'admin'::app_role)
       OR public.has_role_in_negocio(auth.uid(), nid, 'dueno'::app_role)) THEN
    RETURN;
  END IF;
  RETURN QUERY SELECT n.slug, n.kds_token FROM public.negocios n WHERE n.id = nid;
END;
$$;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.get_kds_token() FROM PUBLIC, anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.get_kds_token() TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ----------------------------------------------------------------------------
-- Migration: 20260621012722_a9930f74-df92-47d7-9922-90bbd17bbf3f.sql
-- ----------------------------------------------------------------------------

-- Make views run as the querying user
ALTER VIEW public.productos_public SET (security_invoker = true);
ALTER VIEW public.producto_variantes_public SET (security_invoker = true);
ALTER VIEW public.negocios_public SET (security_invoker = true);

-- Anonymous SELECT policies mirroring the view filters
DROP POLICY IF EXISTS prod_read_anon_public ON public.productos;
CREATE POLICY prod_read_anon_public ON public.productos
  FOR SELECT TO anon
  USING (activo = true AND public.negocio_has_pro(negocio_id));

DROP POLICY IF EXISTS pv_read_anon_public ON public.producto_variantes;
CREATE POLICY pv_read_anon_public ON public.producto_variantes
  FOR SELECT TO anon
  USING (activo = true AND public.negocio_has_pro(negocio_id));

DROP POLICY IF EXISTS negocios_read_anon_public ON public.negocios;
CREATE POLICY negocios_read_anon_public ON public.negocios
  FOR SELECT TO anon
  USING (public.negocio_has_pro(id));

-- Column-level grants: anon may only read the safe columns exposed by the views
DO $$ BEGIN GRANT SELECT
  (id, negocio_id, sucursal_id, nombre, descripcion, categoria, categorias,
   precio_venta, stock, imagen_url, galeria, unidad, cantidad_minima, activo,
   precio_promocional, promo_vence_at)
  ON public.productos TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN GRANT SELECT
  (id, producto_id, negocio_id, nombre, stock, precio_venta, imagen_url,
   activo, precio_promocional, promo_vence_at)
  ON public.producto_variantes TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN GRANT SELECT (id, nombre, slug, tipo_negocio) ON public.negocios TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ----------------------------------------------------------------------------
-- Migration: 20260624020235_c361a16d-89ff-4964-978a-1c43a367a9ff.sql
-- ----------------------------------------------------------------------------

-- 1) New private table for KDS tokens
CREATE TABLE IF NOT EXISTS public.negocio_kds_tokens (
  negocio_id uuid PRIMARY KEY REFERENCES public.negocios(id) ON DELETE CASCADE,
  kds_token uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN GRANT ALL ON public.negocio_kds_tokens TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;
-- No grants for anon or authenticated: only SECURITY DEFINER functions read this table.

ALTER TABLE public.negocio_kds_tokens ENABLE ROW LEVEL SECURITY;
-- No policies = no direct access from PostgREST for anon/authenticated. SECURITY DEFINER functions bypass RLS.

-- 2) Backfill from negocios.kds_token (if column still exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='negocios' AND column_name='kds_token'
  ) THEN
    INSERT INTO public.negocio_kds_tokens (negocio_id, kds_token)
    SELECT id, kds_token FROM public.negocios
    ON CONFLICT (negocio_id) DO NOTHING;
  END IF;
END $$;

-- Ensure every negocio has a token row
INSERT INTO public.negocio_kds_tokens (negocio_id)
SELECT n.id FROM public.negocios n
LEFT JOIN public.negocio_kds_tokens t ON t.negocio_id = n.id
WHERE t.negocio_id IS NULL;

-- 3) Drop the column from negocios (removes exposure surface entirely)
ALTER TABLE public.negocios DROP COLUMN IF EXISTS kds_token;

-- 4) Update KDS functions to use the new table
CREATE OR REPLACE FUNCTION public.kds_snapshot(_slug text, _token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE _nid uuid; _nombre text;
BEGIN
  SELECT n.id, n.nombre INTO _nid, _nombre
    FROM public.negocios n
    JOIN public.negocio_kds_tokens t ON t.negocio_id = n.id
   WHERE n.slug = _slug AND t.kds_token = _token;
  IF _nid IS NULL THEN RAISE EXCEPTION 'No autorizado'; END IF;
  RETURN jsonb_build_object(
    'negocio', jsonb_build_object('nombre', _nombre, 'slug', _slug),
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ci.id,
        'nombre', ci.nombre,
        'qty', ci.qty,
        'estado', ci.estado,
        'notas', ci.notas,
        'created_at', ci.created_at,
        'tipo', c.tipo,
        'mesa', (SELECT numero FROM public.mesas WHERE id = c.mesa_id)
      ) ORDER BY ci.created_at)
      FROM public.comanda_items ci
      JOIN public.comandas c ON c.id = ci.comanda_id
      WHERE ci.negocio_id = _nid
        AND ci.estado IN ('pendiente','preparando','listo')
        AND ci.requiere_preparacion = true
    ), '[]'::jsonb)
  );
END; $function$;

CREATE OR REPLACE FUNCTION public.kds_set_estado(_slug text, _token uuid, _item_id uuid, _estado text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE _nid uuid;
BEGIN
  SELECT n.id INTO _nid
    FROM public.negocios n
    JOIN public.negocio_kds_tokens t ON t.negocio_id = n.id
   WHERE n.slug = _slug AND t.kds_token = _token;
  IF _nid IS NULL THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF _estado NOT IN ('pendiente','preparando','listo','entregado') THEN RAISE EXCEPTION 'Estado inválido'; END IF;
  UPDATE public.comanda_items SET estado = _estado WHERE id = _item_id AND negocio_id = _nid;
END; $function$;

CREATE OR REPLACE FUNCTION public.get_kds_token()
RETURNS TABLE(slug text, kds_token text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE nid uuid;
BEGIN
  SELECT negocio_id INTO nid FROM public.profiles WHERE id = auth.uid();
  IF nid IS NULL THEN RETURN; END IF;
  IF NOT (public.has_role_in_negocio(auth.uid(), 'admin'::app_role, nid)
       OR public.has_role_in_negocio(auth.uid(), 'dueno'::app_role, nid)) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT n.slug, t.kds_token::text
      FROM public.negocios n
      JOIN public.negocio_kds_tokens t ON t.negocio_id = n.id
     WHERE n.id = nid;
END;
$function$;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.get_kds_token() FROM PUBLIC, anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.get_kds_token() TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ----------------------------------------------------------------------------
-- Migration: 20260624020328_25cab6d5-008b-4592-99fb-12f80af179fc.sql
-- ----------------------------------------------------------------------------

-- Explicit restrictive UPDATE guard on historial_precios.
-- Even if a permissive UPDATE policy is added later, this restrictive policy
-- ensures only super_admin can ever update price history rows.
DROP POLICY IF EXISTS historial_precios_update_block ON public.historial_precios;
CREATE POLICY historial_precios_update_block
  ON public.historial_precios
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated, anon
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));


-- ----------------------------------------------------------------------------
-- Migration: 20260624020412_fd4da24a-3d1b-498b-acd9-89367d69f4f8.sql
-- ----------------------------------------------------------------------------

-- Block direct INSERT into negocios from PostgREST.
-- Creation must go through public.create_negocio_for_user(), which enforces
-- "one negocio per user" and sets the right defaults.
DROP POLICY IF EXISTS negocios_authenticated_insert ON public.negocios;
DO $$ BEGIN REVOKE INSERT ON public.negocios FROM authenticated, anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ----------------------------------------------------------------------------
-- Migration: 20260624021103_0ce00b13-d3cb-4ed4-a6f5-76f032cc98ea.sql
-- ----------------------------------------------------------------------------

-- 1. Add column
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS is_new_arrival boolean NOT NULL DEFAULT true;

-- 2. Backfill: existing products are NOT considered "recién llegados"
UPDATE public.productos SET is_new_arrival = false WHERE created_at < now();

-- 3. Trigger: clear is_new_arrival once stock reaches 0
CREATE OR REPLACE FUNCTION public.productos_clear_new_arrival()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_new_arrival = true AND COALESCE(NEW.stock, 0) <= 0 THEN
    NEW.is_new_arrival := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS productos_clear_new_arrival_trg ON public.productos;
CREATE TRIGGER productos_clear_new_arrival_trg
  BEFORE INSERT OR UPDATE OF stock ON public.productos
  FOR EACH ROW
  EXECUTE FUNCTION public.productos_clear_new_arrival();

-- 4. Recreate productos_public view including is_new_arrival
DROP VIEW IF EXISTS public.productos_public;
CREATE VIEW public.productos_public AS
SELECT id, negocio_id, sucursal_id, nombre, descripcion, categoria, categorias,
       precio_venta, stock, imagen_url, galeria, unidad, cantidad_minima,
       activo, precio_promocional, promo_vence_at, is_new_arrival
  FROM public.productos
 WHERE activo = true AND negocio_has_pro(negocio_id);

DO $$ BEGIN GRANT SELECT ON public.productos_public TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ----------------------------------------------------------------------------
-- Migration: 20260624021121_ee8f0ac8-620c-4316-adb2-a9b4a66785f6.sql
-- ----------------------------------------------------------------------------
ALTER VIEW public.productos_public SET (security_invoker = true);

-- ----------------------------------------------------------------------------
-- Migration: 20260625014936_3ea8808d-f967-4c42-9db8-46e6646505d7.sql
-- ----------------------------------------------------------------------------
DO $$ BEGIN GRANT SELECT ON public.negocios TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.categorias TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.productos TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.producto_variantes TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.producto_imagenes TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN GRANT SELECT ON public.negocios TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.categorias TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.productos TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.producto_variantes TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.producto_imagenes TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN GRANT ALL ON public.negocios TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT ALL ON public.categorias TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT ALL ON public.productos TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT ALL ON public.producto_variantes TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT ALL ON public.producto_imagenes TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN GRANT SELECT ON public.negocios_public TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.productos_public TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.producto_variantes_public TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN GRANT SELECT ON public.negocios_public TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.productos_public TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.producto_variantes_public TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN GRANT ALL ON public.negocios_public TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT ALL ON public.productos_public TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT ALL ON public.producto_variantes_public TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.crear_pedido_catalogo(uuid, text, text, text, jsonb, numeric) TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.negocio_has_pro(uuid) TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- Migration: 20260706013024_63bc267e-ea90-481a-8e1e-d7a5472c6a04.sql
-- ----------------------------------------------------------------------------

-- Revoke EXECUTE on SECURITY DEFINER helpers that must never be called via the client API.
-- These are internal: called only from triggers, server-side edge functions, or other server code.

-- Trigger-only helpers: fired by the DB itself, no client should invoke them directly.
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.producto_imagenes_sync() FROM PUBLIC, anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.productos_set_codigo_interno() FROM PUBLIC, anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Email queue helpers: only meant to be called by server-side workers (service_role).
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Ensure service_role can still call them from server contexts.
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Also tighten anon on functions that only need authenticated (were incorrectly granted to anon).
-- kds_snapshot / kds_set_estado authenticate via in-function token check, so anon EXECUTE stays.
-- crear_pedido_catalogo and negocio_has_pro must stay callable by anon (public catalog).
-- All remaining SECURITY DEFINER functions either:
--   - are RLS policy helpers (has_role, has_role_in_negocio, is_super_admin, current_negocio_id,
--     negocio_has_pro, has_active_subscription, get_user_plan) — must remain executable by
--     the querying role for RLS to evaluate,
--   - or are legitimate user-facing RPCs that perform their own authorization in-body
--     (auth.uid() checks, is_super_admin gates, or token verification).


-- ----------------------------------------------------------------------------
-- Migration: 20260706013125_dee5fedb-b3f2-45ca-bb18-2221b99faf2a.sql
-- ----------------------------------------------------------------------------

-- Restrict anon column-level SELECT to exclude sensitive cost/supplier fields
DO $$ BEGIN REVOKE SELECT ON public.productos FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (
  id, negocio_id, nombre, categoria, precio_venta, stock, stock_min,
  codigo, imagen_url, notas, unidad, cantidad_minima, variantes, galeria,
  activo, sucursal_id, updated_at, created_at, categorias, descripcion,
  precio_promocional, promo_vence_at, codigo_interno, requiere_preparacion,
  is_new_arrival
) ON public.productos TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN REVOKE SELECT ON public.producto_variantes FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (
  id, negocio_id, producto_id, nombre, codigo, imagen_url, stock,
  precio_venta, activo, created_at, updated_at,
  precio_promocional, promo_vence_at
) ON public.producto_variantes TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ----------------------------------------------------------------------------
-- Migration: 20260707224124_e128d717-e0e0-49e9-95b8-dd36c1719dca.sql
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.devolver_venta(
  _venta_id uuid,
  _items jsonb,
  _motivo text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _nid uuid := current_negocio_id();
  _uid uuid := auth.uid();
  _v ventas%ROWTYPE;
  _it jsonb;
  _det detalle_ventas%ROWTYPE;
  _qty int;
  _rest boolean;
  _monto numeric;
  _total_dev numeric := 0;
  _qty_prev_dev int;
  _stock_actual int;
  _total_qty_venta int;
  _total_qty_dev int;
BEGIN
  IF _nid IS NULL THEN RAISE EXCEPTION 'Sin negocio'; END IF;
  IF _uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO _v FROM ventas WHERE id = _venta_id AND negocio_id = _nid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Venta no encontrada'; END IF;
  IF _v.estado <> 'activa' THEN RAISE EXCEPTION 'La venta no está activa'; END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Debe indicar al menos un producto';
  END IF;

  FOR _it IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    SELECT * INTO _det FROM detalle_ventas
      WHERE id = (_it->>'detalle_id')::uuid AND venta_id = _venta_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Línea de venta no encontrada'; END IF;

    _qty := GREATEST(COALESCE((_it->>'qty')::int, 0), 0);
    _rest := COALESCE((_it->>'restituir_stock')::boolean, true);
    IF _qty = 0 THEN CONTINUE; END IF;
    IF _qty > COALESCE(_det.qty, 0) THEN
      RAISE EXCEPTION 'Cantidad a devolver mayor que la vendida en %', COALESCE(_det.nombre,'línea');
    END IF;

    -- Cantidad ya devuelta previamente de esta línea
    SELECT COALESCE(SUM(qty),0) INTO _qty_prev_dev
      FROM devoluciones
      WHERE venta_id = _venta_id
        AND ((producto_id IS NOT NULL AND producto_id = _det.producto_id)
             OR (producto_id IS NULL AND nombre = _det.nombre));

    IF _qty_prev_dev + _qty > _det.qty THEN
      RAISE EXCEPTION 'Se supera la cantidad disponible para devolver en %', COALESCE(_det.nombre,'línea');
    END IF;

    _monto := COALESCE(_det.precio,0) * _qty;
    _total_dev := _total_dev + _monto;

    INSERT INTO devoluciones (negocio_id, venta_id, producto_id, nombre, qty, monto, motivo, restituir_stock, usuario_id)
    VALUES (_nid, _venta_id, _det.producto_id, _det.nombre, _qty, _monto, _motivo, _rest, _uid);

    IF _rest AND _det.producto_id IS NOT NULL THEN
      SELECT COALESCE(stock,0) INTO _stock_actual FROM productos WHERE id = _det.producto_id FOR UPDATE;
      UPDATE productos SET stock = COALESCE(stock,0) + _qty WHERE id = _det.producto_id;
      INSERT INTO stock_movements (negocio_id, producto_id, tipo, cantidad, stock_antes, ref_id, ref_tipo, notas)
      VALUES (_nid, _det.producto_id, 'devolucion', _qty, _stock_actual, _venta_id::text, 'venta',
              COALESCE(_motivo, 'Devolución de venta'));
    END IF;
  END LOOP;

  -- Si todo lo vendido fue devuelto -> anular venta
  SELECT COALESCE(SUM(qty),0) INTO _total_qty_venta FROM detalle_ventas WHERE venta_id = _venta_id;
  SELECT COALESCE(SUM(qty),0) INTO _total_qty_dev FROM devoluciones WHERE venta_id = _venta_id;

  IF _total_qty_venta > 0 AND _total_qty_dev >= _total_qty_venta THEN
    UPDATE ventas SET estado = 'anulada' WHERE id = _venta_id;
  END IF;

  RETURN jsonb_build_object(
    'monto_devuelto', _total_dev,
    'anulada', (_total_qty_venta > 0 AND _total_qty_dev >= _total_qty_venta)
  );
END;
$$;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.devolver_venta(uuid, jsonb, text) FROM PUBLIC, anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.devolver_venta(uuid, jsonb, text) TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ----------------------------------------------------------------------------
-- Migration: 20260707225028_1336b0be-904e-4d6b-8b88-dda2b6564ce1.sql
-- ----------------------------------------------------------------------------
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM PUBLIC, anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM PUBLIC, anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- Migration: 20260707225332_574d2322-dae6-49ba-8934-69def75b0cfe.sql
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.devolver_venta(_venta_id uuid, _items jsonb, _motivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _nid uuid := current_negocio_id();
  _uid uuid := auth.uid();
  _v ventas%ROWTYPE;
  _it jsonb;
  _det detalle_ventas%ROWTYPE;
  _qty int;
  _rest boolean;
  _monto numeric;
  _total_dev numeric := 0;
  _qty_prev_dev int;
  _stock_actual int;
  _total_qty_venta int;
  _total_qty_dev int;
  _deuda_reducida numeric := 0;
  _cli_deuda numeric;
BEGIN
  IF _nid IS NULL THEN RAISE EXCEPTION 'Sin negocio'; END IF;
  IF _uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO _v FROM ventas WHERE id = _venta_id AND negocio_id = _nid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Venta no encontrada'; END IF;
  IF _v.estado <> 'activa' THEN RAISE EXCEPTION 'La venta no está activa'; END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Debe indicar al menos un producto';
  END IF;

  FOR _it IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    SELECT * INTO _det FROM detalle_ventas
      WHERE id = (_it->>'detalle_id')::uuid AND venta_id = _venta_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Línea de venta no encontrada'; END IF;

    _qty := GREATEST(COALESCE((_it->>'qty')::int, 0), 0);
    _rest := COALESCE((_it->>'restituir_stock')::boolean, true);
    IF _qty = 0 THEN CONTINUE; END IF;
    IF _qty > COALESCE(_det.qty, 0) THEN
      RAISE EXCEPTION 'Cantidad a devolver mayor que la vendida en %', COALESCE(_det.nombre,'línea');
    END IF;

    SELECT COALESCE(SUM(qty),0) INTO _qty_prev_dev
      FROM devoluciones
      WHERE venta_id = _venta_id
        AND ((producto_id IS NOT NULL AND producto_id = _det.producto_id)
             OR (producto_id IS NULL AND nombre = _det.nombre));

    IF _qty_prev_dev + _qty > _det.qty THEN
      RAISE EXCEPTION 'Se supera la cantidad disponible para devolver en %', COALESCE(_det.nombre,'línea');
    END IF;

    _monto := COALESCE(_det.precio,0) * _qty;
    _total_dev := _total_dev + _monto;

    INSERT INTO devoluciones (negocio_id, venta_id, producto_id, nombre, qty, monto, motivo, restituir_stock, usuario_id)
    VALUES (_nid, _venta_id, _det.producto_id, _det.nombre, _qty, _monto, _motivo, _rest, _uid);

    IF _rest AND _det.producto_id IS NOT NULL THEN
      SELECT COALESCE(stock,0) INTO _stock_actual FROM productos WHERE id = _det.producto_id FOR UPDATE;
      UPDATE productos SET stock = COALESCE(stock,0) + _qty WHERE id = _det.producto_id;
      INSERT INTO stock_movements (negocio_id, producto_id, tipo, cantidad, stock_antes, ref_id, ref_tipo, notas)
      VALUES (_nid, _det.producto_id, 'devolucion', _qty, _stock_actual, _venta_id::text, 'venta',
              COALESCE(_motivo, 'Devolución de venta'));
    END IF;
  END LOOP;

  -- Si la venta fue fiada y tiene cliente, reducir la deuda por el monto devuelto
  IF _v.pago = 'fiado' AND _v.cliente_id IS NOT NULL AND _total_dev > 0 THEN
    SELECT COALESCE(deuda_total,0) INTO _cli_deuda FROM clientes WHERE id = _v.cliente_id FOR UPDATE;
    _deuda_reducida := LEAST(_total_dev, _cli_deuda);

    IF _deuda_reducida > 0 THEN
      INSERT INTO deudas (negocio_id, cliente_id, venta_id, monto, tipo, notas)
      VALUES (_nid, _v.cliente_id, _venta_id, _deuda_reducida, 'pago',
              'Devolución de venta ' || _venta_id::text || COALESCE(' - ' || _motivo, ''));

      UPDATE clientes
        SET deuda_total = GREATEST(COALESCE(deuda_total,0) - _deuda_reducida, 0)
        WHERE id = _v.cliente_id;
    END IF;
  END IF;

  SELECT COALESCE(SUM(qty),0) INTO _total_qty_venta FROM detalle_ventas WHERE venta_id = _venta_id;
  SELECT COALESCE(SUM(qty),0) INTO _total_qty_dev FROM devoluciones WHERE venta_id = _venta_id;

  IF _total_qty_venta > 0 AND _total_qty_dev >= _total_qty_venta THEN
    UPDATE ventas SET estado = 'anulada' WHERE id = _venta_id;
  END IF;

  RETURN jsonb_build_object(
    'monto_devuelto', _total_dev,
    'anulada', (_total_qty_venta > 0 AND _total_qty_dev >= _total_qty_venta),
    'pago', _v.pago,
    'deuda_reducida', _deuda_reducida
  );
END;
$function$;

-- ----------------------------------------------------------------------------
-- Migration: 20260707225935_52fac80e-fb7e-43cd-bd74-04afed5c9a56.sql
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.productos_clear_new_arrival()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- INSERT: si nace con stock > 0, marcarlo como recién agregado.
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.stock, 0) > 0 THEN
      NEW.is_new_arrival := true;
    ELSE
      NEW.is_new_arrival := false;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE de stock: si pasa de 0 (o null) a positivo, marcarlo como recién agregado.
  IF TG_OP = 'UPDATE' THEN
    IF COALESCE(OLD.stock, 0) <= 0 AND COALESCE(NEW.stock, 0) > 0 THEN
      NEW.is_new_arrival := true;
    ELSIF NEW.is_new_arrival = true AND COALESCE(NEW.stock, 0) <= 0 THEN
      NEW.is_new_arrival := false;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Backfill: productos activos con stock > 0 se muestran como recién agregados
UPDATE public.productos SET is_new_arrival = true WHERE activo = true AND COALESCE(stock,0) > 0 AND is_new_arrival = false;

-- ----------------------------------------------------------------------------
-- Migration: 20260707230215_0eace6b3-4284-4d9b-abc0-a4e304defcff.sql
-- ----------------------------------------------------------------------------
-- productos: solo columnas de catálogo para anon (excluye precio_costo, proveedor)
DO $$ BEGIN REVOKE SELECT ON public.productos FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (id, negocio_id, sucursal_id, nombre, descripcion, categoria, categorias, precio_venta, stock, stock_min, imagen_url, galeria, unidad, cantidad_minima, codigo, codigo_interno, activo, precio_promocional, promo_vence_at, is_new_arrival, requiere_preparacion, updated_at, created_at, variantes)
  ON public.productos TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- producto_variantes: solo columnas de catálogo para anon (excluye precio_costo)
DO $$ BEGIN REVOKE SELECT ON public.producto_variantes FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (id, producto_id, negocio_id, nombre, codigo, imagen_url, stock, precio_venta, activo, precio_promocional, promo_vence_at, created_at, updated_at)
  ON public.producto_variantes TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- negocios: solo identidad pública (excluye rut, plan, direccion)
DO $$ BEGIN REVOKE SELECT ON public.negocios FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (id, nombre, slug, tipo_negocio)
  ON public.negocios TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- email_send_state: solo service_role puede leer/escribir esta configuración interna
DO $$ BEGIN REVOKE ALL ON public.email_send_state FROM anon, authenticated, PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT ALL ON public.email_send_state TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- Migration: 20260707230720_fb5f828a-f325-4eb7-bcda-99088d7f2f05.sql
-- ----------------------------------------------------------------------------
UPDATE public.productos SET is_new_arrival = false WHERE is_new_arrival = true AND created_at < (now() - interval '7 days');

-- ----------------------------------------------------------------------------
-- Migration: 20260708234408_0bc698c3-8564-49a9-8bf7-a4231340e824.sql
-- ----------------------------------------------------------------------------

-- Trigger functions: never called via API, revoke from anon/authenticated
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM anon, authenticated, PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.productos_clear_new_arrival() FROM anon, authenticated, PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.productos_set_codigo_interno() FROM anon, authenticated, PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.categorias_validate_parent() FROM anon, authenticated, PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.producto_imagenes_validar() FROM anon, authenticated, PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.producto_imagenes_sync() FROM anon, authenticated, PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM anon, authenticated, PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon, authenticated, PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Email queue helpers: only used by edge functions (service_role)
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated, PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated, PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated, PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated, PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Super-admin-only functions: revoke from anon (auth still needed; check inside)
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.sa_cupon_upsert(uuid, text, text, integer, integer, timestamptz, boolean, text) FROM anon, PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.sa_cupon_eliminar(uuid) FROM anon, PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.sa_negocio_detalle(uuid) FROM anon, PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.sa_eliminar_negocio(uuid) FROM anon, PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.sa_kpis_globales() FROM anon, PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.sa_set_suscripcion(uuid, text, text, timestamptz, text) FROM anon, PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Authenticated-only business functions: revoke anon
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.canjear_cupon_interno(text) FROM anon, PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.devolver_venta(uuid, jsonb, text) FROM anon, PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.vincular_pedido_a_fiado(uuid, uuid) FROM anon, PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.recibir_compra(uuid, jsonb) FROM anon, PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.cancelar_compra(uuid) FROM anon, PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.cambiar_estado_pedido(uuid, text, text) FROM anon, PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.set_tipo_negocio(text) FROM anon, PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.create_negocio_for_user(text, text) FROM anon, PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.create_negocio_for_user(text, text, text) FROM anon, PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.agregar_producto_a_proveedor(uuid, uuid, numeric, text) FROM anon, PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.descontar_stock_producto(uuid, uuid, integer, uuid) FROM anon, PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.get_kds_token() FROM anon, PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.compra_recibida_por_email(uuid) FROM anon, PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.next_codigo_interno(uuid) FROM anon, PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ----------------------------------------------------------------------------
-- Migration: 20260710011731_df50d6a0-a37e-45a2-b218-33944978cb8c.sql
-- ----------------------------------------------------------------------------

CREATE TABLE public.marcas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  logo_url text,
  descripcion text,
  orden integer NOT NULL DEFAULT 0,
  activa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marcas_nombre_check CHECK (length(trim(nombre)) > 0)
);

CREATE UNIQUE INDEX marcas_negocio_nombre_uniq ON public.marcas (negocio_id, lower(trim(nombre)));
CREATE INDEX marcas_negocio_idx ON public.marcas (negocio_id, orden);

DO $$ BEGIN GRANT SELECT ON public.marcas TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT, INSERT, UPDATE, DELETE ON public.marcas TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT ALL ON public.marcas TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;

ALTER TABLE public.marcas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marcas_select_negocio" ON public.marcas
  FOR SELECT TO authenticated
  USING (negocio_id = public.current_negocio_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "marcas_public_read_activas" ON public.marcas
  FOR SELECT TO anon
  USING (activa = true);

CREATE POLICY "marcas_insert_admin" ON public.marcas
  FOR INSERT TO authenticated
  WITH CHECK (
    negocio_id = public.current_negocio_id()
    AND public.has_role_in_negocio(auth.uid(), 'admin'::app_role, negocio_id)
  );

CREATE POLICY "marcas_update_admin" ON public.marcas
  FOR UPDATE TO authenticated
  USING (
    negocio_id = public.current_negocio_id()
    AND public.has_role_in_negocio(auth.uid(), 'admin'::app_role, negocio_id)
  );

CREATE POLICY "marcas_delete_admin" ON public.marcas
  FOR DELETE TO authenticated
  USING (
    negocio_id = public.current_negocio_id()
    AND public.has_role_in_negocio(auth.uid(), 'admin'::app_role, negocio_id)
  );

CREATE TRIGGER marcas_updated_at
  BEFORE UPDATE ON public.marcas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.productos
  ADD COLUMN marca_id uuid REFERENCES public.marcas(id) ON DELETE SET NULL;

CREATE INDEX productos_marca_idx ON public.productos (negocio_id, marca_id);

CREATE OR REPLACE FUNCTION public.get_or_create_marca(_nombre text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _nid uuid := public.current_negocio_id();
  _norm text;
  _id uuid;
  _max int;
BEGIN
  IF _nid IS NULL THEN RAISE EXCEPTION 'Sin negocio'; END IF;
  IF _nombre IS NULL THEN RETURN NULL; END IF;
  _norm := regexp_replace(trim(_nombre), '\s+', ' ', 'g');
  IF length(_norm) = 0 THEN RETURN NULL; END IF;

  SELECT id INTO _id FROM public.marcas
    WHERE negocio_id = _nid AND lower(trim(nombre)) = lower(_norm)
    LIMIT 1;
  IF FOUND THEN RETURN _id; END IF;

  SELECT COALESCE(MAX(orden), 0) INTO _max FROM public.marcas WHERE negocio_id = _nid;
  INSERT INTO public.marcas (negocio_id, nombre, orden, activa)
  VALUES (_nid, _norm, _max + 1, true)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.get_or_create_marca(text) FROM PUBLIC, anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.get_or_create_marca(text) TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ----------------------------------------------------------------------------
-- Migration: 20260710011825_1308017e-6160-43d4-a86b-4b81b5a70492.sql
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.productos_public AS
SELECT id, negocio_id, sucursal_id, nombre, descripcion, categoria, categorias,
       precio_venta, stock, imagen_url, galeria, unidad, cantidad_minima, activo,
       precio_promocional, promo_vence_at, is_new_arrival, marca_id
  FROM public.productos
 WHERE activo = true AND negocio_has_pro(negocio_id);

DO $$ BEGIN GRANT SELECT ON public.productos_public TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ----------------------------------------------------------------------------
-- Migration: 20260710013853_2306d6ee-619b-4d16-b7b3-8283940fd827.sql
-- ----------------------------------------------------------------------------

-- Fix SECURITY DEFINER view: productos_public should run with invoker's rights
ALTER VIEW public.productos_public SET (security_invoker = true);

-- Fix public brand catalog exposure: gate anon access with negocio_has_pro
DROP POLICY IF EXISTS "marcas_public_read_activas" ON public.marcas;
CREATE POLICY "marcas_public_read_activas" ON public.marcas
  FOR SELECT TO anon
  USING (activa = true AND public.negocio_has_pro(negocio_id));


-- ----------------------------------------------------------------------------
-- Migration: 20260710023851_ab12f66e-aebf-4d3d-893d-a4943f0f1862.sql
-- ----------------------------------------------------------------------------
DO $$ BEGIN GRANT SELECT ON public.productos TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.producto_variantes TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.negocios TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- Migration: 20260710024646_99dcbbc7-8c4e-47ea-abe4-e77ae6987d1f.sql
-- ----------------------------------------------------------------------------

-- =====================================================================
-- Arquitectura estable del catálogo público
-- Principio: mínimo privilegio + contrato explícito por columna para anon
-- =====================================================================

-- ---------- 1. Recrear vistas públicas con proyección mínima ----------
DROP VIEW IF EXISTS public.productos_public;
CREATE VIEW public.productos_public
WITH (security_invoker = true) AS
SELECT
  id, negocio_id, nombre, descripcion,
  categoria, categorias,
  precio_venta, precio_promocional, promo_vence_at,
  stock, imagen_url, galeria,
  unidad, cantidad_minima,
  is_new_arrival, marca_id, codigo
FROM public.productos
WHERE activo = true AND public.negocio_has_pro(negocio_id);

DROP VIEW IF EXISTS public.producto_variantes_public;
CREATE VIEW public.producto_variantes_public
WITH (security_invoker = true) AS
SELECT
  id, producto_id, negocio_id, nombre,
  stock, precio_venta, precio_promocional, promo_vence_at,
  imagen_url
FROM public.producto_variantes
WHERE activo = true AND public.negocio_has_pro(negocio_id);

DROP VIEW IF EXISTS public.negocios_public;
CREATE VIEW public.negocios_public
WITH (security_invoker = true) AS
SELECT id, nombre, slug, tipo_negocio
FROM public.negocios
WHERE public.negocio_has_pro(id);

DROP VIEW IF EXISTS public.marcas_public;
CREATE VIEW public.marcas_public
WITH (security_invoker = true) AS
SELECT id, negocio_id, nombre, logo_url, descripcion, orden
FROM public.marcas
WHERE activa = true AND public.negocio_has_pro(negocio_id);

DROP VIEW IF EXISTS public.categorias_public;
CREATE VIEW public.categorias_public
WITH (security_invoker = true) AS
SELECT id, negocio_id, nombre, parent_id, orden, color
FROM public.categorias
WHERE activa = true AND public.negocio_has_pro(negocio_id);

DROP VIEW IF EXISTS public.producto_imagenes_public;
CREATE VIEW public.producto_imagenes_public
WITH (security_invoker = true) AS
SELECT pi.id, pi.producto_id, pi.url, pi.orden, pi.es_principal
FROM public.producto_imagenes pi
WHERE public.negocio_has_pro(pi.negocio_id);

COMMENT ON VIEW public.productos_public IS
  'Contrato público del catálogo. NO agregar columnas sensibles (precio_costo, proveedor, stock_min, notas, codigo_interno, sucursal_id, timestamps). security_invoker=true — depende de las políticas RLS anon en la tabla base y de los GRANTs por columna.';
COMMENT ON VIEW public.producto_variantes_public IS 'Contrato público del catálogo. Solo columnas seguras.';
COMMENT ON VIEW public.negocios_public IS 'Contrato público del catálogo. Solo identidad del negocio con plan activo.';
COMMENT ON VIEW public.marcas_public IS 'Contrato público del catálogo. Solo columnas seguras.';
COMMENT ON VIEW public.categorias_public IS 'Contrato público del catálogo. Solo columnas seguras.';
COMMENT ON VIEW public.producto_imagenes_public IS 'Contrato público del catálogo. Solo columnas seguras.';

-- ---------- 2. Mínimo privilegio: revocar acceso amplio a anon ----------
--     y otorgar SELECT sólo sobre columnas seguras de las tablas base.
--     Estas GRANTs son permanentes: sobreviven a futuras migraciones y no
--     requieren re-otorgarse a menos que se haga DROP explícito de la tabla.

DO $$ BEGIN REVOKE ALL ON public.productos            FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE ALL ON public.producto_variantes   FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE ALL ON public.negocios             FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE ALL ON public.marcas               FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE ALL ON public.categorias           FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE ALL ON public.producto_imagenes    FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN GRANT SELECT (
  id, negocio_id, nombre, descripcion,
  categoria, categorias,
  precio_venta, precio_promocional, promo_vence_at,
  stock, imagen_url, galeria,
  unidad, cantidad_minima,
  is_new_arrival, marca_id, codigo, activo
) ON public.productos TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN GRANT SELECT (
  id, producto_id, negocio_id, nombre,
  stock, precio_venta, precio_promocional, promo_vence_at,
  imagen_url, activo
) ON public.producto_variantes TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN GRANT SELECT (
  id, nombre, slug, tipo_negocio
) ON public.negocios TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN GRANT SELECT (
  id, negocio_id, nombre, logo_url, descripcion, orden, activa
) ON public.marcas TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN GRANT SELECT (
  id, negocio_id, nombre, parent_id, orden, color, activa
) ON public.categorias TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN GRANT SELECT (
  id, producto_id, negocio_id, url, orden, es_principal
) ON public.producto_imagenes TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Las vistas ya heredan permisos vía security_invoker + column privileges,
-- pero necesitan SELECT explícito sobre la vista misma.
DO $$ BEGIN GRANT SELECT ON public.productos_public          TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.producto_variantes_public TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.negocios_public           TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.marcas_public             TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.categorias_public         TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.producto_imagenes_public  TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ----------------------------------------------------------------------------
-- Migration: 20260731130820_fd26f7a2-8b5a-4830-92c7-46e5228d0ca1.sql
-- ----------------------------------------------------------------------------
CREATE TABLE public.caja_sesiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL,
  usuario_id uuid,
  cerrada_por uuid,
  estado text NOT NULL DEFAULT 'abierta',
  monto_inicial numeric NOT NULL DEFAULT 0,
  monto_contado numeric,
  monto_esperado numeric,
  diferencia numeric,
  notas text,
  abierta_at timestamptz NOT NULL DEFAULT now(),
  cerrada_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX caja_sesiones_una_abierta ON public.caja_sesiones (negocio_id) WHERE estado = 'abierta';
CREATE INDEX caja_sesiones_negocio_idx ON public.caja_sesiones (negocio_id, abierta_at DESC);

DO $$ BEGIN GRANT SELECT, INSERT, UPDATE, DELETE ON public.caja_sesiones TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT ALL ON public.caja_sesiones TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;

ALTER TABLE public.caja_sesiones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "caja_sesiones negocio" ON public.caja_sesiones
FOR ALL TO authenticated
USING (negocio_id = public.current_negocio_id())
WITH CHECK (negocio_id = public.current_negocio_id());

CREATE TRIGGER caja_sesiones_updated_at BEFORE UPDATE ON public.caja_sesiones
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ----------------------------------------------------------------------------
-- Migration: 20260731160513_24ac28fd-c4d3-4224-9c26-e92a5553f3b6.sql
-- ----------------------------------------------------------------------------
-- 1) Extender suscripciones para soportar MercadoPago
ALTER TABLE public.suscripciones
  ADD COLUMN IF NOT EXISTS proveedor text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS ciclo text,
  ADD COLUMN IF NOT EXISTS mp_preapproval_id text,
  ADD COLUMN IF NOT EXISTS mp_payer_email text,
  ADD COLUMN IF NOT EXISTS ultimo_pago_at timestamptz,
  ADD COLUMN IF NOT EXISTS proximo_cobro_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS suscripciones_mp_preapproval_id_key
  ON public.suscripciones (mp_preapproval_id) WHERE mp_preapproval_id IS NOT NULL;

-- 2) Registro de pagos de MercadoPago
CREATE TABLE IF NOT EXISTS public.mp_pagos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  negocio_id uuid REFERENCES public.negocios(id) ON DELETE SET NULL,
  user_id uuid,
  preapproval_id text,
  payment_id text,
  plan text,
  ciclo text,
  monto numeric,
  moneda text,
  estado text NOT NULL DEFAULT 'pendiente',
  detalle text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS mp_pagos_payment_id_key
  ON public.mp_pagos (payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS mp_pagos_negocio_idx ON public.mp_pagos (negocio_id, created_at DESC);

DO $$ BEGIN GRANT SELECT ON public.mp_pagos TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT ALL ON public.mp_pagos TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;

ALTER TABLE public.mp_pagos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios ven los pagos de su negocio"
  ON public.mp_pagos FOR SELECT TO authenticated
  USING (negocio_id = public.current_negocio_id() OR public.is_super_admin(auth.uid()));

CREATE TRIGGER mp_pagos_updated_at
  BEFORE UPDATE ON public.mp_pagos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 3) Suspensión automática cuando no hay pago (vencimiento pasado)
CREATE OR REPLACE FUNCTION public.suspender_suscripciones_vencidas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _n integer := 0;
BEGIN
  WITH upd AS (
    UPDATE public.suscripciones
      SET estado = 'suspendida', updated_at = now()
      WHERE estado = 'activa'
        AND vence_at IS NOT NULL
        AND vence_at < now()
      RETURNING negocio_id
  )
  SELECT count(*) INTO _n FROM upd;

  UPDATE public.negocios n
    SET plan = 'free'
    WHERE EXISTS (
      SELECT 1 FROM public.suscripciones s
      WHERE s.negocio_id = n.id AND s.estado <> 'activa'
    ) AND n.plan <> 'free';

  RETURN _n;
END;
$$;

DO $$ BEGIN REVOKE ALL ON FUNCTION public.suspender_suscripciones_vencidas() FROM PUBLIC, anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.suspender_suscripciones_vencidas() TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('suspender-suscripciones-vencidas');
    PERFORM cron.schedule(
      'suspender-suscripciones-vencidas',
      '7 * * * *',
      $cron$ SELECT public.suspender_suscripciones_vencidas(); $cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- Migration: 20260807132909_654d7bf5-3745-4d06-8af0-c03a123e844a.sql
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sucursal_id uuid REFERENCES public.sucursales(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_sucursal_id ON public.profiles(sucursal_id);

-- ----------------------------------------------------------------------------
-- Migration: 20260807134034_723f7b87-cf99-4f79-b29f-8a859da3b067.sql
-- ----------------------------------------------------------------------------
CREATE TABLE public.invitaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  sucursal_id uuid REFERENCES public.sucursales(id) ON DELETE SET NULL,
  codigo text NOT NULL UNIQUE,
  email text,
  role app_role NOT NULL DEFAULT 'vendedor',
  estado text NOT NULL DEFAULT 'pendiente',
  creada_por uuid REFERENCES auth.users(id),
  usada_por uuid REFERENCES auth.users(id),
  usada_at timestamptz,
  expira_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitaciones TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT ALL ON public.invitaciones TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;

ALTER TABLE public.invitaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gestionan invitaciones de su negocio"
ON public.invitaciones FOR ALL TO authenticated
USING (negocio_id = public.current_negocio_id())
WITH CHECK (negocio_id = public.current_negocio_id());

CREATE TRIGGER update_invitaciones_updated_at
BEFORE UPDATE ON public.invitaciones
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.aceptar_invitacion(_codigo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inv public.invitaciones%ROWTYPE;
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para aceptar la invitación';
  END IF;

  SELECT * INTO _inv FROM public.invitaciones
  WHERE upper(codigo) = upper(trim(_codigo)) FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Código de invitación inválido';
  END IF;
  IF _inv.estado <> 'pendiente' THEN
    RAISE EXCEPTION 'Esta invitación ya fue utilizada o anulada';
  END IF;
  IF _inv.expira_at < now() THEN
    RAISE EXCEPTION 'Esta invitación expiró';
  END IF;

  UPDATE public.profiles
  SET negocio_id = _inv.negocio_id,
      sucursal_id = _inv.sucursal_id,
      activo = true,
      updated_at = now()
  WHERE id = _uid;

  INSERT INTO public.user_roles (user_id, negocio_id, role)
  VALUES (_uid, _inv.negocio_id, _inv.role)
  ON CONFLICT DO NOTHING;

  UPDATE public.invitaciones
  SET estado = 'aceptada', usada_por = _uid, usada_at = now()
  WHERE id = _inv.id;

  RETURN jsonb_build_object('negocio_id', _inv.negocio_id, 'sucursal_id', _inv.sucursal_id, 'role', _inv.role);
END;
$$;

DO $$ BEGIN REVOKE ALL ON FUNCTION public.aceptar_invitacion(text) FROM PUBLIC, anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.aceptar_invitacion(text) TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- Migration: 20260807150621_a53e34af-53f3-40c8-a882-16901ddc6998.sql
-- ----------------------------------------------------------------------------
ALTER TABLE public.negocios ADD COLUMN IF NOT EXISTS perfil text;

UPDATE public.negocios SET perfil = CASE WHEN tipo_negocio = 'restaurant' THEN 'restaurante_completo' ELSE 'tienda' END WHERE perfil IS NULL;

ALTER TABLE public.configuracion ADD COLUMN IF NOT EXISTS modulos_override jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.set_perfil_negocio(_perfil text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _neg uuid;
BEGIN
  IF _perfil NOT IN ('minimarket','perfumeria','tienda','restaurante_express','restaurante_completo','cafeteria') THEN
    RAISE EXCEPTION 'Perfil inválido';
  END IF;
  SELECT negocio_id INTO _neg FROM public.profiles WHERE id = auth.uid();
  IF _neg IS NULL THEN RAISE EXCEPTION 'Sin negocio'; END IF;
  IF NOT public.has_role_in_negocio(auth.uid(), 'admin', _neg) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  UPDATE public.negocios
     SET perfil = _perfil,
         tipo_negocio = CASE WHEN _perfil LIKE 'restaurante%' OR _perfil = 'cafeteria' THEN 'restaurant' ELSE 'tienda' END
   WHERE id = _neg;
END;
$$;

DO $$ BEGIN REVOKE ALL ON FUNCTION public.set_perfil_negocio(text) FROM PUBLIC, anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.set_perfil_negocio(text) TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.set_modulos_override(_overrides jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _neg uuid;
BEGIN
  SELECT negocio_id INTO _neg FROM public.profiles WHERE id = auth.uid();
  IF _neg IS NULL THEN RAISE EXCEPTION 'Sin negocio'; END IF;
  IF NOT public.has_role_in_negocio(auth.uid(), 'admin', _neg) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  INSERT INTO public.configuracion (negocio_id, modulos_override)
  VALUES (_neg, COALESCE(_overrides, '{}'::jsonb))
  ON CONFLICT (negocio_id) DO UPDATE SET modulos_override = COALESCE(_overrides, '{}'::jsonb);
END;
$$;

DO $$ BEGIN REVOKE ALL ON FUNCTION public.set_modulos_override(jsonb) FROM PUBLIC, anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.set_modulos_override(jsonb) TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- Migration: 20260807223339_0044bc0c-7b00-4135-97d6-929aa7783882.sql
-- ----------------------------------------------------------------------------
ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS sin_control_stock boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.descontar_stock_producto(_producto_id uuid, _variante_id uuid, _qty integer, _venta_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _nid uuid := current_negocio_id();
  _stock_p integer;
  _stock_v integer;
  _sin_ctrl boolean;
BEGIN
  IF _nid IS NULL THEN RAISE EXCEPTION 'Sin negocio'; END IF;
  IF _qty <= 0 THEN RAISE EXCEPTION 'Cantidad inválida'; END IF;

  SELECT stock, COALESCE(sin_control_stock, false) INTO _stock_p, _sin_ctrl
    FROM public.productos
    WHERE id = _producto_id AND negocio_id = _nid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Producto no encontrado'; END IF;

  IF _sin_ctrl THEN
    RETURN;
  END IF;

  IF _variante_id IS NOT NULL THEN
    SELECT stock INTO _stock_v FROM public.producto_variantes
      WHERE id = _variante_id AND producto_id = _producto_id AND negocio_id = _nid FOR UPDATE;
    IF _stock_v IS NULL THEN RAISE EXCEPTION 'Variante no encontrada'; END IF;

    UPDATE public.producto_variantes SET stock = stock - _qty WHERE id = _variante_id;
  END IF;

  UPDATE public.productos SET stock = stock - _qty WHERE id = _producto_id;

  INSERT INTO public.stock_movements
    (negocio_id, producto_id, tipo, cantidad, stock_antes, ref_id, ref_tipo, notas)
  VALUES
    (_nid, _producto_id, 'venta', -_qty, _stock_p, _venta_id::text, 'venta',
     CASE WHEN _variante_id IS NOT NULL THEN 'variante:' || _variante_id::text ELSE NULL END);
END;
$function$;

CREATE OR REPLACE FUNCTION public.crear_pedido_catalogo(_negocio_id uuid, _cliente_nombre text, _cliente_telefono text, _notas text, _items jsonb, _total numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _pedido_id uuid;
  _it jsonb;
  _pid uuid;
  _vid uuid;
  _qty integer;
  _stock_actual integer;
  _stock_var integer;
  _precio numeric;
  _nombre_p text;
  _nombre_v text;
  _sin_ctrl boolean;
  _items_clean jsonb := '[]'::jsonb;
  _total_server numeric := 0;
BEGIN
  IF _negocio_id IS NULL OR NOT EXISTS (SELECT 1 FROM negocios WHERE id = _negocio_id) THEN
    RAISE EXCEPTION 'Negocio inválido';
  END IF;
  IF NOT public.negocio_has_pro(_negocio_id) THEN
    RAISE EXCEPTION 'Catálogo no disponible';
  END IF;
  IF _cliente_nombre IS NULL OR char_length(_cliente_nombre) < 1 OR char_length(_cliente_nombre) > 120 THEN
    RAISE EXCEPTION 'Nombre inválido';
  END IF;
  IF _cliente_telefono IS NOT NULL AND char_length(_cliente_telefono) > 40 THEN
    RAISE EXCEPTION 'Teléfono inválido';
  END IF;
  IF _notas IS NOT NULL AND char_length(_notas) > 1000 THEN
    RAISE EXCEPTION 'Notas demasiado largas';
  END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Pedido sin items';
  END IF;
  IF jsonb_array_length(_items) > 200 THEN
    RAISE EXCEPTION 'Demasiados items';
  END IF;

  FOR _it IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    _pid := (_it->>'id')::uuid;
    _vid := NULLIF(_it->>'variante_id','')::uuid;
    _qty := COALESCE((_it->>'qty')::int, 0);
    IF _qty <= 0 OR _qty > 1000 THEN
      RAISE EXCEPTION 'Cantidad inválida';
    END IF;

    SELECT stock, precio_venta, nombre, COALESCE(sin_control_stock, false)
      INTO _stock_actual, _precio, _nombre_p, _sin_ctrl
      FROM productos WHERE id = _pid AND negocio_id = _negocio_id AND activo = true;
    IF _nombre_p IS NULL THEN
      RAISE EXCEPTION 'Producto no encontrado';
    END IF;

    IF _vid IS NOT NULL THEN
      SELECT stock, COALESCE(precio_venta, _precio), nombre
        INTO _stock_var, _precio, _nombre_v
        FROM producto_variantes
        WHERE id = _vid AND producto_id = _pid AND negocio_id = _negocio_id AND activo = true;
      IF _nombre_v IS NULL THEN
        RAISE EXCEPTION 'Variante no encontrada';
      END IF;
      IF NOT _sin_ctrl AND COALESCE(_stock_var, 0) < _qty THEN
        RAISE EXCEPTION 'Stock insuficiente para %', _nombre_p;
      END IF;
    ELSE
      IF NOT _sin_ctrl AND COALESCE(_stock_actual, 0) < _qty THEN
        RAISE EXCEPTION 'Stock insuficiente para %', _nombre_p;
      END IF;
    END IF;

    _precio := COALESCE(_precio, 0);
    _total_server := _total_server + (_precio * _qty);
    _items_clean := _items_clean || jsonb_build_object(
      'id', _pid,
      'variante_id', _vid,
      'nombre', CASE WHEN _vid IS NOT NULL THEN _nombre_p || ' - ' || _nombre_v ELSE _nombre_p END,
      'qty', _qty,
      'precio', _precio,
      'sin_control_stock', _sin_ctrl
    );
  END LOOP;

  INSERT INTO pedidos_whatsapp (negocio_id, cliente_nombre, cliente_telefono, notas, items, total, stock_reservado)
  VALUES (_negocio_id, _cliente_nombre, NULLIF(_cliente_telefono, ''), NULLIF(_notas, ''), _items_clean, _total_server, true)
  RETURNING id INTO _pedido_id;

  FOR _it IN SELECT * FROM jsonb_array_elements(_items_clean)
  LOOP
    IF COALESCE((_it->>'sin_control_stock')::boolean, false) THEN
      CONTINUE;
    END IF;
    _pid := (_it->>'id')::uuid;
    _vid := NULLIF(_it->>'variante_id','')::uuid;
    _qty := (_it->>'qty')::int;
    SELECT stock INTO _stock_actual FROM productos WHERE id = _pid;
    UPDATE productos SET stock = stock - _qty WHERE id = _pid;
    IF _vid IS NOT NULL THEN
      UPDATE producto_variantes SET stock = stock - _qty WHERE id = _vid;
    END IF;
    INSERT INTO stock_movements (negocio_id, producto_id, tipo, cantidad, stock_antes, ref_id, ref_tipo, notas)
    VALUES (_negocio_id, _pid, 'reserva', -_qty, _stock_actual, _pedido_id::text, 'pedido_catalogo',
      CASE WHEN _vid IS NOT NULL THEN 'Reserva catálogo (variante:' || _vid::text || ')' ELSE 'Reserva por pedido del catálogo' END);
  END LOOP;

  RETURN _pedido_id;
END;
$function$;

-- ----------------------------------------------------------------------------
-- Migration: 20260807223517_b2a8a907-7f58-420c-ab6f-e101ebe5ae86.sql
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.productos_public
WITH (security_invoker = true) AS
SELECT id,
    negocio_id,
    nombre,
    descripcion,
    categoria,
    categorias,
    precio_venta,
    precio_promocional,
    promo_vence_at,
    stock,
    imagen_url,
    galeria,
    unidad,
    cantidad_minima,
    is_new_arrival,
    marca_id,
    codigo,
    sin_control_stock
   FROM productos
  WHERE activo = true AND negocio_has_pro(negocio_id);

-- ----------------------------------------------------------------------------
-- Migration: 20260807225431_463009fd-6c24-4bba-ab23-ec3ba898346f.sql
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_negocio_for_user(_nombre text, _slug text, _tipo text DEFAULT 'tienda'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _negocio_id uuid;
  _existing uuid;
  _base text;
  _try text;
  _i int := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _tipo NOT IN ('tienda','restaurant') THEN RAISE EXCEPTION 'Tipo inválido'; END IF;

  SELECT negocio_id INTO _existing FROM public.profiles WHERE id = _uid;
  IF _existing IS NOT NULL THEN RETURN _existing; END IF;

  _base := nullif(trim(coalesce(_slug,'')), '');
  IF _base IS NULL THEN _base := 'negocio'; END IF;
  _try := _base;
  WHILE EXISTS (SELECT 1 FROM public.negocios WHERE slug = _try) LOOP
    _i := _i + 1;
    _try := _base || '-' || _i::text;
    IF _i > 500 THEN
      _try := _base || '-' || substr(replace(gen_random_uuid()::text,'-',''), 1, 6);
      EXIT;
    END IF;
  END LOOP;

  INSERT INTO public.negocios (nombre, slug, tipo_negocio)
  VALUES (_nombre, _try, _tipo)
  RETURNING id INTO _negocio_id;

  UPDATE public.profiles SET negocio_id = _negocio_id WHERE id = _uid;
  INSERT INTO public.user_roles (user_id, role, negocio_id) VALUES (_uid, 'admin', _negocio_id);
  INSERT INTO public.sucursales (nombre, negocio_id) VALUES ('Principal', _negocio_id);

  IF _tipo = 'restaurant' THEN
    INSERT INTO public.areas (negocio_id, nombre, tipo_impresion) VALUES
      (_negocio_id, 'Salón', 'salon'),
      (_negocio_id, 'Cocina', 'cocina'),
      (_negocio_id, 'Barra', 'barra');
  END IF;

  RETURN _negocio_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_negocio_for_user(_nombre text, _slug text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN public.create_negocio_for_user(_nombre, _slug, 'tienda');
END;
$function$;

-- ----------------------------------------------------------------------------
-- Migration: 20260807225939_d940f471-4ffa-40ec-874c-a1820536d7ee.sql
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins gestionan invitaciones de su negocio" ON public.invitaciones;

CREATE POLICY "Admins gestionan invitaciones de su negocio"
ON public.invitaciones
FOR ALL
TO authenticated
USING (
  negocio_id = public.current_negocio_id()
  AND public.has_role_in_negocio(auth.uid(), 'admin'::app_role, negocio_id)
)
WITH CHECK (
  negocio_id = public.current_negocio_id()
  AND public.has_role_in_negocio(auth.uid(), 'admin'::app_role, negocio_id)
);

DO $$ BEGIN REVOKE ALL ON public.invitaciones FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitaciones TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT ALL ON public.invitaciones TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- Migration: 20260808221356_6e416579-9f3e-45dc-a47f-b11d78c9b72f.sql
-- ----------------------------------------------------------------------------
ALTER TABLE public.caja_sesiones
  ADD COLUMN IF NOT EXISTS sucursal_id uuid REFERENCES public.sucursales(id) ON DELETE SET NULL;

UPDATE public.caja_sesiones c
SET sucursal_id = (
  SELECT s.id FROM public.sucursales s
  WHERE s.negocio_id = c.negocio_id
  ORDER BY s.created_at ASC
  LIMIT 1
)
WHERE c.sucursal_id IS NULL;

CREATE INDEX IF NOT EXISTS caja_sesiones_sucursal_idx
  ON public.caja_sesiones (negocio_id, sucursal_id, estado);

CREATE UNIQUE INDEX IF NOT EXISTS caja_sesiones_una_abierta_por_sucursal
  ON public.caja_sesiones (negocio_id, sucursal_id)
  WHERE estado = 'abierta';

-- ----------------------------------------------------------------------------
-- Migration: 20260808222841_7e4da98e-ae92-49e3-8808-454553d42a49.sql
-- ----------------------------------------------------------------------------
DROP INDEX IF EXISTS public.caja_sesiones_una_abierta;

-- ----------------------------------------------------------------------------
-- Migration: 20260808223727_b230fdf6-071f-4baf-9cfd-b872025726a0.sql
-- ----------------------------------------------------------------------------
DO $$ BEGIN GRANT SELECT, INSERT, UPDATE ON public.configuracion TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT, UPDATE ON public.profiles TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.user_roles TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT, INSERT, UPDATE, DELETE ON public.sucursales TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitaciones TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN GRANT ALL ON public.configuracion TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT ALL ON public.profiles TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT ALL ON public.user_roles TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT ALL ON public.sucursales TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT ALL ON public.invitaciones TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- Migration: 20260810003217_cbf0bcee-268e-4fd1-b451-bb2a12a5c134.sql
-- ----------------------------------------------------------------------------
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.descontar_stock_producto(uuid, uuid, integer, uuid) FROM anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.next_codigo_interno(uuid) FROM anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.set_tipo_negocio(text) FROM anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.get_user_plan(uuid, text) FROM anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) FROM anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- Migration: 20260816000558_9dac7796-2d8a-46d3-966c-450e0c5700e7.sql
-- ----------------------------------------------------------------------------

ALTER VIEW public.negocios_public SET (security_invoker = false);
ALTER VIEW public.productos_public SET (security_invoker = false);
ALTER VIEW public.producto_variantes_public SET (security_invoker = false);
ALTER VIEW public.producto_imagenes_public SET (security_invoker = false);
ALTER VIEW public.categorias_public SET (security_invoker = false);
ALTER VIEW public.marcas_public SET (security_invoker = false);

DO $$ BEGIN GRANT SELECT ON public.negocios_public TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.productos_public TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.producto_variantes_public TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.producto_imagenes_public TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.categorias_public TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON public.marcas_public TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.negocio_has_pro(uuid) TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ----------------------------------------------------------------------------
-- Migration: 20260816001433_c12fbea3-7e55-4c42-958a-e358e64b258a.sql
-- ----------------------------------------------------------------------------
-- 1) Public catalog views run with the caller's permissions (no more definer bypass)
ALTER VIEW public.negocios_public SET (security_invoker = on);
ALTER VIEW public.productos_public SET (security_invoker = on);
ALTER VIEW public.producto_variantes_public SET (security_invoker = on);
ALTER VIEW public.producto_imagenes_public SET (security_invoker = on);
ALTER VIEW public.categorias_public SET (security_invoker = on);
ALTER VIEW public.marcas_public SET (security_invoker = on);

-- 2) Column-scoped anon grants on base tables so the invoker views still work,
--    while rut/direccion/costs stay unreadable by anonymous visitors.
DO $$ BEGIN REVOKE ALL ON public.negocios FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (id, nombre, slug, tipo_negocio) ON public.negocios TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN REVOKE ALL ON public.productos FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (id, negocio_id, nombre, descripcion, categoria, categorias, precio_venta,
              precio_promocional, promo_vence_at, stock, imagen_url, galeria, unidad,
              cantidad_minima, is_new_arrival, marca_id, codigo, sin_control_stock, activo)
  ON public.productos TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN REVOKE ALL ON public.producto_variantes FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (id, producto_id, negocio_id, nombre, stock, precio_venta,
              precio_promocional, promo_vence_at, imagen_url, activo)
  ON public.producto_variantes TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN REVOKE ALL ON public.producto_imagenes FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (id, producto_id, negocio_id, url, orden, es_principal)
  ON public.producto_imagenes TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN REVOKE ALL ON public.categorias FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (id, negocio_id, nombre, parent_id, orden, color, activa)
  ON public.categorias TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN REVOKE ALL ON public.marcas FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT (id, negocio_id, nombre, logo_url, descripcion, orden, activa)
  ON public.marcas TO anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- Migration: 20260816002005_5e142370-2bb3-43fe-8652-66ac8cf27dee.sql
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_negocio_for_user(text, text);

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proname NOT IN ('crear_pedido_catalogo','kds_snapshot','kds_set_estado','negocio_has_pro')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, public', r.sig);
  END LOOP;
END $$;

DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.crear_pedido_catalogo(uuid, text, text, text, jsonb, numeric) TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.kds_snapshot(text, uuid) TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.kds_set_estado(text, uuid, uuid, text) TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.negocio_has_pro(uuid) TO anon, authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- Migration: 20260824002543_046db17d-46f0-4c3d-b915-69ad986248b3.sql
-- ----------------------------------------------------------------------------
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.descontar_stock_producto(uuid, uuid, integer, uuid) TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.set_tipo_negocio(text) TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.next_codigo_interno(uuid) TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.get_user_plan(uuid, text) TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

