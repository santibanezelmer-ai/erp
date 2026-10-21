-- ============================================================================
-- Migración: Acceso Público Seguro al Catálogo y Sistema de Plantillas
-- Permite que los visitantes anónimos puedan consultar la información pública
-- de cualquier tienda registrada, sus productos activos, variantes y configuración visual.
-- ============================================================================

-- 1. Permisos para anon en negocios (lectura pública del catálogo)
GRANT SELECT ON public.negocios TO anon;
DROP POLICY IF EXISTS "negocios_read_anon_public" ON public.negocios;
CREATE POLICY "negocios_read_anon_public" ON public.negocios
  FOR SELECT TO anon
  USING (true);

-- 2. Permisos para anon en configuracion (para temas y plantillas)
GRANT SELECT ON public.configuracion TO anon;
DROP POLICY IF EXISTS "cfg_read_anon_public" ON public.configuracion;
CREATE POLICY "cfg_read_anon_public" ON public.configuracion
  FOR SELECT TO anon
  USING (true);

-- 3. Permitir ver productos y variantes activas en el catálogo a visitantes anónimos
GRANT SELECT ON public.productos TO anon;
DROP POLICY IF EXISTS "prod_read_anon_public" ON public.productos;
CREATE POLICY "prod_read_anon_public" ON public.productos
  FOR SELECT TO anon
  USING (activo = true);

GRANT SELECT ON public.producto_variantes TO anon;
DROP POLICY IF EXISTS "pv_read_anon_public" ON public.producto_variantes;
CREATE POLICY "pv_read_anon_public" ON public.producto_variantes
  FOR SELECT TO anon
  USING (activo = true);

GRANT SELECT ON public.marcas TO anon;
DROP POLICY IF EXISTS "marcas_public_read_activas" ON public.marcas;
CREATE POLICY "marcas_public_read_activas" ON public.marcas
  FOR SELECT TO anon
  USING (activa = true);

-- 4. Permitir a clientes anónimos registrar pedidos por WhatsApp
GRANT INSERT ON public.pedidos_whatsapp TO anon;
DROP POLICY IF EXISTS "pw_anon_insert" ON public.pedidos_whatsapp;
CREATE POLICY "pw_anon_insert" ON public.pedidos_whatsapp
  FOR INSERT TO anon
  WITH CHECK (negocio_id IS NOT NULL);

-- 5. Notificar a PostgREST para refrescar el schema cache
NOTIFY pgrst, 'reload schema';
