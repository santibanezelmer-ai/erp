-- ============================================================================
-- Migración: 20261127_pedido_catalogo_precio_promocional.sql
-- Propósito: crear_pedido_catalogo calculaba el total con precio_venta e
-- ignoraba precio_promocional, así que un pedido del catálogo con productos
-- en oferta quedaba registrado en el ERP a precio completo (distinto del total
-- que ve el cliente). Ahora usa el precio efectivo, igual que el catálogo.
-- Idempotente: CREATE OR REPLACE con la misma firma.
-- ============================================================================

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
  _p_base numeric;
  _p_promo numeric;
  _p_vence timestamptz;
  _v_base numeric;
  _v_promo numeric;
  _v_vence timestamptz;
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

    SELECT stock, precio_venta, precio_promocional, promo_vence_at, nombre, COALESCE(sin_control_stock, false)
      INTO _stock_actual, _p_base, _p_promo, _p_vence, _nombre_p, _sin_ctrl
      FROM productos WHERE id = _pid AND negocio_id = _negocio_id AND activo = true;
    IF _nombre_p IS NULL THEN
      RAISE EXCEPTION 'Producto no encontrado';
    END IF;

    IF _vid IS NOT NULL THEN
      SELECT stock, precio_venta, precio_promocional, promo_vence_at, nombre
        INTO _stock_var, _v_base, _v_promo, _v_vence, _nombre_v
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

    -- Precio efectivo (mismo criterio que el catálogo, src/lib/promo.ts):
    -- la promoción vale si es > 0, menor al precio base y no ha vencido.
    -- La variante hereda el precio del producto cuando no tiene uno propio.
    IF _vid IS NOT NULL AND _v_promo IS NOT NULL THEN
      _precio := COALESCE(_v_base, _p_base);
      IF _v_promo > 0 AND _v_promo < _precio AND (_v_vence IS NULL OR _v_vence > now()) THEN
        _precio := _v_promo;
      END IF;
    ELSIF _vid IS NOT NULL AND _v_base IS NOT NULL THEN
      _precio := _v_base;
    ELSE
      _precio := _p_base;
      IF _p_promo IS NOT NULL AND _p_promo > 0 AND _p_promo < _p_base
         AND (_p_vence IS NULL OR _p_vence > now()) THEN
        _precio := _p_promo;
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

REVOKE ALL ON FUNCTION public.crear_pedido_catalogo(uuid, text, text, text, jsonb, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crear_pedido_catalogo(uuid, text, text, text, jsonb, numeric) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
