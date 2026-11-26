-- ============================================================================
-- Migración: 20261126_variantes_comandas.sql
-- Propósito: Variantes en comandas de restaurante.
--   1. comanda_items.variante_id: guarda la variante elegida al tomar el pedido.
--   2. cerrar_comanda_restaurante: envía la variante a crear_venta_pos para que
--      descuente el stock propio de la variante (igual que el POS).
-- Idempotente: se puede ejecutar más de una vez.
-- ============================================================================

ALTER TABLE public.comanda_items
  ADD COLUMN IF NOT EXISTS variante_id uuid
  REFERENCES public.producto_variantes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS comanda_items_variante_id_idx
  ON public.comanda_items(variante_id)
  WHERE variante_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.cerrar_comanda_restaurante(
  _comanda_id   uuid,
  _pago         text,
  _efectivo_rec numeric DEFAULT NULL,
  _sucursal_id  uuid    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid                uuid := auth.uid();
  _nid                uuid := public.current_negocio_id();
  _comanda            record;
  _lineas             jsonb := '[]'::jsonb;
  _total_calc         numeric := 0;
  _item               record;
  _mod_txt            text;
  _nombre_linea       text;
  _res_pos            jsonb;
  _venta_id           uuid;
  _hay_otras_comandas boolean;
BEGIN
  -- ── 1. SEGURIDAD Y PERTENENCIA MULTIEMPRESA ──────────────────────────────
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  IF _nid IS NULL OR _nid = '00000000-0000-0000-0000-000000000000'::uuid THEN
    RAISE EXCEPTION 'No se encontró un comercio válido asociado a la sesión';
  END IF;

  -- ── 2. VALIDACIÓN ESTRICTA DEL MEDIO DE PAGO EN BASE DE DATOS ─────────────
  -- Se rechaza cualquier medio no admitido o nulo sin depender de validaciones cliente
  IF _pago IS NULL OR _pago NOT IN ('efectivo', 'debito', 'credito', 'transferencia') THEN
    RAISE EXCEPTION 'Medio de pago no proporcionado o no permitido para cierre gastronómico: "%"', _pago;
  END IF;

  -- ── 3. BLOQUEO COORDINADO DE FILAS (SERIALIZACIÓN DE CONCURRENCIA) ────────
  -- Bloqueo exclusivo de la comanda
  SELECT id, negocio_id, mesa_id, estado, venta_id, total
    INTO _comanda
    FROM public.comandas
   WHERE id = _comanda_id AND negocio_id = _nid
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comanda no encontrada o no pertenece a su comercio';
  END IF;

  -- Bloqueo coordinado y validación de existencia de la mesa física
  IF _comanda.mesa_id IS NOT NULL THEN
    PERFORM 1 
       FROM public.mesas 
      WHERE id = _comanda.mesa_id AND negocio_id = _nid 
        FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'La mesa asociada (%) no existe o no pertenece a su comercio', _comanda.mesa_id;
    END IF;
  END IF;

  -- ── 4. GARANTÍA DE IDEMPOTENCIA (REINTENTO TRANSPARENTE) ─────────────────
  -- Si ya fue cobrada previamente (ej. microcorte de red), recupera la venta existente sin duplicar
  IF _comanda.venta_id IS NOT NULL AND _comanda.estado = 'cobrada' THEN
    IF EXISTS (
      SELECT 1 FROM public.ventas WHERE id = _comanda.venta_id AND negocio_id = _nid
    ) THEN
      RETURN jsonb_build_object(
        'ok',         true,
        'ya_cobrada', true,
        'venta_id',   _comanda.venta_id,
        'total',      _comanda.total,
        'comanda_id', _comanda_id,
        'mensaje',    'La comanda ya fue cobrada exitosamente con anterioridad'
      );
    ELSE
      RAISE EXCEPTION 'Inconsistencia crítica: la comanda figura como cobrada pero la venta asociada (%) no existe en su comercio', _comanda.venta_id;
    END IF;
  END IF;

  IF _comanda.estado = 'cancelada' THEN
    RAISE EXCEPTION 'La comanda está cancelada y no puede ser procesada para cobro';
  END IF;

  IF _comanda.estado <> 'abierta' THEN
    RAISE EXCEPTION 'La comanda no está abierta para cobro (estado actual: %)', _comanda.estado;
  END IF;

  -- ── 5. INTEGRIDAD DE ÍTEMS Y TOTALIZACIÓN DETERMINISTA EN SERVIDOR ────────
  -- Se calculan cantidades y subtotales desde la BD (el cliente no puede manipular precios)
  FOR _item IN
    SELECT ci.id, ci.producto_id, ci.variante_id, ci.nombre, ci.qty, ci.precio, ci.notas, ci.modificadores
      FROM public.comanda_items ci
     WHERE ci.comanda_id = _comanda_id
       AND ci.negocio_id = _nid
       AND ci.estado <> 'cancelado' -- Exclusión obligatoria de platos cancelados
     ORDER BY ci.created_at ASC
  LOOP
    -- Validación estricta de cantidad (no nula y estrictamente positiva)
    IF _item.qty IS NULL OR _item.qty <= 0 THEN
      RAISE EXCEPTION 'El producto "%" tiene una cantidad inválida (%) en la comanda', 
        COALESCE(_item.nombre, 'Sin nombre'), COALESCE(_item.qty::text, 'NULL');
    END IF;

    -- Validación estricta de precio (no nulo y no negativo)
    IF _item.precio IS NULL OR _item.precio < 0 THEN
      RAISE EXCEPTION 'El producto "%" tiene un precio inválido (%) en la comanda', 
        COALESCE(_item.nombre, 'Sin nombre'), COALESCE(_item.precio::text, 'NULL');
    END IF;

    -- Validar que el producto exista en el catálogo del comercio
    IF _item.producto_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.productos WHERE id = _item.producto_id AND negocio_id = _nid
    ) THEN
      RAISE EXCEPTION 'El producto "%" no cuenta con un registro válido en inventario', COALESCE(_item.nombre, 'Sin nombre');
    END IF;

    -- Validar que la variante (si existe) pertenezca al producto y al comercio
    IF _item.variante_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.producto_variantes
       WHERE id = _item.variante_id
         AND producto_id = _item.producto_id
         AND negocio_id = _nid
    ) THEN
      RAISE EXCEPTION 'La variante de "%" no es válida para este producto', COALESCE(_item.nombre, 'Sin nombre');
    END IF;

    -- Acumular total exacto desde la base de datos
    _total_calc := _total_calc + (_item.qty * _item.precio);

    -- Preservar modificadores y notas en el nombre de la línea para detalle_ventas
    -- Validación anidada estricta: jsonb_array_length solo se evalúa si es un arreglo
    _mod_txt := NULL;
    IF _item.modificadores IS NOT NULL THEN
      IF jsonb_typeof(_item.modificadores) = 'array' THEN
        IF jsonb_array_length(_item.modificadores) > 0 THEN
          SELECT string_agg(
                   NULLIF(
                     TRIM(
                       CASE 
                         WHEN jsonb_typeof(m) = 'object' THEN COALESCE(m->>'nombre', m->>'name', '')
                         WHEN jsonb_typeof(m) = 'string' THEN m#>>'{}'
                         ELSE ''
                       END
                     ),
                     ''
                   ),
                   ', '
                 )
            INTO _mod_txt
            FROM jsonb_array_elements(_item.modificadores) AS m;
        END IF;
      END IF;
    END IF;

    _nombre_linea := _item.nombre;
    IF COALESCE(_mod_txt, '') <> '' THEN
      _nombre_linea := _nombre_linea || ' [' || _mod_txt || ']';
    END IF;
    IF COALESCE(TRIM(_item.notas), '') <> '' THEN
      _nombre_linea := _nombre_linea || ' (' || TRIM(_item.notas) || ')';
    END IF;

    -- Construir línea con cantidad entera pura (sin redondeos)
    _lineas := _lineas || jsonb_build_object(
      'producto_id', _item.producto_id,
      'variante_id', _item.variante_id,
      'nombre',      _nombre_linea,
      'qty',         _item.qty::int,
      'precio',      _item.precio,
      'descuento',   0,
      'subtotal',    _item.qty * _item.precio
    );
  END LOOP;

  IF jsonb_array_length(_lineas) = 0 THEN
    RAISE EXCEPTION 'La comanda no tiene productos válidos para cobrar';
  END IF;

  -- ── 6. REGLAS ESTRICTAS DE EFECTIVO VS MEDIOS ELECTRÓNICOS ────────────────
  IF _pago = 'efectivo' THEN
    IF _efectivo_rec IS NULL THEN
      RAISE EXCEPTION 'Para pagos en efectivo se requiere registrar el monto recibido';
    END IF;
    IF _efectivo_rec < _total_calc THEN
      RAISE EXCEPTION 'El efectivo recibido ($%) es menor al total a cobrar ($%)', _efectivo_rec, _total_calc;
    END IF;
  ELSE
    -- Débito, crédito y transferencia exigen NULL
    _efectivo_rec := NULL;
  END IF;

  -- ── 7. LLAMADA ATÓMICA AL MOTOR CENTRAL crear_venta_pos ────────────────────
  _res_pos := public.crear_venta_pos(
    _lineas       := _lineas,
    _subtotal     := _total_calc,
    _descuento    := 0,
    _total        := _total_calc,
    _pago         := _pago,
    _efectivo_rec := _efectivo_rec,
    _cliente_id   := null,
    _sucursal_id  := _sucursal_id
  );

  _venta_id := (_res_pos->>'venta_id')::uuid;

  IF _venta_id IS NULL THEN
    RAISE EXCEPTION 'Error al generar la venta central en el motor transaccional';
  END IF;

  -- ── 8. ACTUALIZACIÓN DE COMANDA A ESTADO 'COBRADA' ────────────────────────
  UPDATE public.comandas
     SET estado    = 'cobrada',
         closed_at = now(),
         venta_id  = _venta_id,
         total     = _total_calc
   WHERE id = _comanda_id;

  -- ── 9. LIBERACIÓN CONDICIONAL DE MESA (GESTIÓN DE MULTI-COMANDAS) ──────────
  -- La mesa física solo pasa a 'libre' si no quedan otras comandas abiertas en ella
  IF _comanda.mesa_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 
        FROM public.comandas
       WHERE mesa_id = _comanda.mesa_id
         AND negocio_id = _nid
         AND estado = 'abierta'
         AND id <> _comanda_id
    ) INTO _hay_otras_comandas;

    IF NOT _hay_otras_comandas THEN
      UPDATE public.mesas
         SET estado = 'libre'
       WHERE id = _comanda.mesa_id AND negocio_id = _nid;
    END IF;
  END IF;

  -- ── 10. RETORNO INEQUÍVOCO ────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'ok',         true,
    'ya_cobrada', false,
    'venta_id',   _venta_id,
    'total',      _total_calc,
    'comanda_id', _comanda_id
  );
END;
$function$;

-- Restricción de permisos: solo usuarios autenticados
REVOKE ALL ON FUNCTION public.cerrar_comanda_restaurante(uuid, text, numeric, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cerrar_comanda_restaurante(uuid, text, numeric, uuid) TO authenticated;


NOTIFY pgrst, 'reload schema';
