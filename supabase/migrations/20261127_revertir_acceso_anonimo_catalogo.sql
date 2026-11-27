-- ============================================================================
-- Migración: 20261127_revertir_acceso_anonimo_catalogo.sql
-- Propósito: revertir 20261021_fix_catalogo_publico_rls.sql (ya eliminada del
-- repositorio), que se aplicó en producción y daba a visitantes anónimos:
--   * lectura de TODAS las columnas de negocios y configuracion de todas las
--     tiendas (RUT, kds_token, libredte_config, etc.);
--   * lectura de precio_costo/proveedor/notas de productos y variantes;
--   * INSERT directo en pedidos_whatsapp (pedidos falsos sin validar).
-- Restaura el contrato seguro anterior: anon sólo ve columnas de catálogo de
-- tiendas con plan activo, y los pedidos entran por crear_pedido_catalogo.
-- El catálogo público se arma en el servidor (service role), así que no
-- depende de estos permisos.
-- Transaccional: si algo falla, no se aplica nada. Idempotente.
-- ============================================================================

BEGIN;

-- 1. negocios: sólo identidad pública de tiendas con plan activo
DROP POLICY IF EXISTS "negocios_read_anon_public" ON public.negocios;
REVOKE ALL ON public.negocios FROM anon;
GRANT SELECT (id, nombre, slug, tipo_negocio) ON public.negocios TO anon;
CREATE POLICY "negocios_read_anon_public" ON public.negocios
  FOR SELECT TO anon
  USING (public.negocio_has_pro(id));

-- 2. configuracion: sin acceso anónimo (contiene libredte_config, rut, ...)
DROP POLICY IF EXISTS "cfg_read_anon_public" ON public.configuracion;
REVOKE ALL ON public.configuracion FROM anon;

-- 3. productos: columnas de catálogo, activos y de tiendas con plan activo
DROP POLICY IF EXISTS "prod_read_anon_public" ON public.productos;
REVOKE ALL ON public.productos FROM anon;
GRANT SELECT (id, negocio_id, nombre, descripcion, categoria, categorias, precio_venta,
              precio_promocional, promo_vence_at, stock, imagen_url, galeria, unidad,
              cantidad_minima, is_new_arrival, marca_id, codigo, sin_control_stock, activo)
  ON public.productos TO anon;
CREATE POLICY "prod_read_anon_public" ON public.productos
  FOR SELECT TO anon
  USING (activo = true AND public.negocio_has_pro(negocio_id));

-- 4. producto_variantes: igual que productos
DROP POLICY IF EXISTS "pv_read_anon_public" ON public.producto_variantes;
REVOKE ALL ON public.producto_variantes FROM anon;
GRANT SELECT (id, producto_id, negocio_id, nombre, stock, precio_venta,
              precio_promocional, promo_vence_at, imagen_url, activo)
  ON public.producto_variantes TO anon;
CREATE POLICY "pv_read_anon_public" ON public.producto_variantes
  FOR SELECT TO anon
  USING (activo = true AND public.negocio_has_pro(negocio_id));

-- 5. marcas: columnas públicas, activas y de tiendas con plan activo
DROP POLICY IF EXISTS "marcas_public_read_activas" ON public.marcas;
REVOKE ALL ON public.marcas FROM anon;
GRANT SELECT (id, negocio_id, nombre, logo_url, descripcion, orden, activa)
  ON public.marcas TO anon;
CREATE POLICY "marcas_public_read_activas" ON public.marcas
  FOR SELECT TO anon
  USING (activa = true AND public.negocio_has_pro(negocio_id));

-- 6. pedidos_whatsapp: sin INSERT directo; los pedidos usan crear_pedido_catalogo
DROP POLICY IF EXISTS "pw_anon_insert" ON public.pedidos_whatsapp;
REVOKE ALL ON public.pedidos_whatsapp FROM anon;

COMMIT;

NOTIFY pgrst, 'reload schema';
