-- RPC transaccional para registrar una venta completa del POS en una sola operación atómica.
-- Crea la venta, sus detalles, descuenta stock (productos, variantes y componentes de combos),
-- registra los movimientos de inventario y, si corresponde, la deuda por venta fiada.
-- Si cualquier paso falla, PostgreSQL revierte TODO (no quedan datos parciales).

CREATE OR REPLACE FUNCTION public.crear_venta_pos(
  _lineas jsonb,
  _subtotal numeric,
  _descuento numeric,
  _total numeric,
  _pago text,
  _efectivo_rec numeric DEFAULT NULL,
  _cliente_id uuid DEFAULT NULL,
  _sucursal_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid        uuid := auth.uid();
  _nid        uuid := current_negocio_id();
  _venta_id   uuid;
  _ln         jsonb;
  _it         jsonb;
  _tipo       text;
  _pid        uuid;
  _vid        uuid;
  _qty        integer;
  _nombre     text;
  _precio     numeric;
  _desc_linea numeric;
  _sub_linea  numeric;
  _consumos   jsonb := '[]'::jsonb;
  _cons       jsonb;
  _stock_p    integer;
  _stock_v    integer;
  _sin_ctrl   boolean;
  _nombre_p   text;
  _detalle_txt text := '';
  _cli_deuda  numeric;
BEGIN
  -- ── Seguridad / aislamiento multiempresa ────────────────────────────────
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  IF _nid IS NULL OR _nid = '00000000-0000-0000-0000-000000000000'::uuid THEN
    RAISE EXCEPTION 'Sin negocio asociado al usuario';
  END IF;

  IF _lineas IS NULL OR jsonb_typeof(_lineas) <> 'array' OR jsonb_array_length(_lineas) = 0 THEN
    RAISE EXCEPTION 'La venta no tiene líneas';
  END IF;
  IF jsonb_array_length(_lineas) > 300 THEN
    RAISE EXCEPTION 'Demasiadas líneas en la venta';
  END IF;

  -- La sucursal debe pertenecer al negocio del usuario
  IF _sucursal_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM sucursales WHERE id = _sucursal_id AND negocio_id = _nid) THEN
    RAISE EXCEPTION 'Sucursal inválida';
  END IF;

  -- El cliente debe pertenecer al negocio del usuario
  IF _cliente_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM clientes WHERE id = _cliente_id AND negocio_id = _nid) THEN
    RAISE EXCEPTION 'Cliente inválido';
  END IF;

  IF _pago = 'fiado' AND _cliente_id IS NULL THEN
    RAISE EXCEPTION 'Una venta fiada requiere un cliente';
  END IF;

  -- ── Cabecera de la venta ────────────────────────────────────────────────
  INSERT INTO ventas (negocio_id, subtotal, descuento, total, pago, efectivo_rec,
                      cliente_id, sucursal_id, usuario_id)
  VALUES (_nid, COALESCE(_subtotal, 0), COALESCE(_descuento, 0), COALESCE(_total, 0),
          _pago, _efectivo_rec, _cliente_id, _sucursal_id, _uid)
  RETURNING id INTO _venta_id;

  -- ── Detalles + acumulación de consumos de stock ─────────────────────────
  FOR _ln IN SELECT * FROM jsonb_array_elements(_lineas)
  LOOP
    _tipo       := COALESCE(_ln->>'tipo', 'producto');
    _qty        := COALESCE((_ln->>'qty')::int, 0);
    _nombre     := NULLIF(_ln->>'nombre', '');
    _precio     := COALESCE((_ln->>'precio')::numeric, 0);
    _desc_linea := COALESCE((_ln->>'descuento')::numeric, 0);
    _sub_linea  := COALESCE((_ln->>'subtotal')::numeric, _precio * _qty);

    IF _qty <= 0 OR _qty > 100000 THEN
      RAISE EXCEPTION 'Cantidad inválida en %', COALESCE(_nombre, 'línea');
    END IF;

    IF _tipo = 'combo' THEN
      _pid := NULLIF(_ln->>'combo_id', '')::uuid;
      IF _pid IS NULL
         OR NOT EXISTS (SELECT 1 FROM combos WHERE id = _pid AND negocio_id = _nid) THEN
        RAISE EXCEPTION 'Combo inválido';
      END IF;

      -- El combo se registra como línea sin producto_id (igual que hoy)
      INSERT INTO detalle_ventas (negocio_id, venta_id, producto_id, nombre, qty, precio, descuento, subtotal)
      VALUES (_nid, _venta_id, NULL, _nombre, _qty, _precio, _desc_linea, _sub_linea);

      -- Cada componente del combo consume stock
      FOR _it IN SELECT * FROM jsonb_array_elements(COALESCE(_ln->'items', '[]'::jsonb))
      LOOP
        IF NULLIF(_it->>'producto_id', '') IS NULL THEN
          CONTINUE;
        END IF;
        _consumos := _consumos || jsonb_build_object(
          'producto_id', _it->>'producto_id',
          'variante_id', NULL,
          'qty', COALESCE((_it->>'qty')::int, 0) * _qty,
          'combo', _nombre
        );
      END LOOP;
    ELSE
      _pid := NULLIF(_ln->>'producto_id', '')::uuid;
      _vid := NULLIF(_ln->>'variante_id', '')::uuid;
      IF _pid IS NULL THEN
        RAISE EXCEPTION 'Línea sin producto';
      END IF;

      INSERT INTO detalle_ventas (negocio_id, venta_id, producto_id, nombre, qty, precio, descuento, subtotal)
      VALUES (_nid, _venta_id, _pid, _nombre, _qty, _precio, _desc_linea, _sub_linea);

      _consumos := _consumos || jsonb_build_object(
        'producto_id', _pid,
        'variante_id', _vid,
        'qty', _qty,
        'combo', NULL
      );
    END IF;

    _detalle_txt := _detalle_txt
      || CASE WHEN _detalle_txt = '' THEN '' ELSE ', ' END
      || _qty::text || 'x ' || COALESCE(_nombre, 'Producto');
  END LOOP;

  -- ── Descuento de stock y movimientos de inventario ──────────────────────
  -- Ordenado por producto para minimizar deadlocks entre cajas simultáneas.
  FOR _cons IN
    SELECT e FROM jsonb_array_elements(_consumos) AS t(e)
    ORDER BY (t.e->>'producto_id')
  LOOP
    _pid := (_cons->>'producto_id')::uuid;
    _vid := NULLIF(_cons->>'variante_id', '')::uuid;
    _qty := COALESCE((_cons->>'qty')::int, 0);
    IF _qty <= 0 THEN CONTINUE; END IF;

    SELECT stock, COALESCE(sin_control_stock, false), nombre
      INTO _stock_p, _sin_ctrl, _nombre_p
      FROM productos
      WHERE id = _pid AND negocio_id = _nid
      FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Producto no encontrado en este negocio';
    END IF;

    -- Productos confeccionados / sin control de stock: no se toca inventario
    IF _sin_ctrl THEN
      CONTINUE;
    END IF;

    IF _vid IS NOT NULL THEN
      SELECT stock INTO _stock_v
        FROM producto_variantes
        WHERE id = _vid AND producto_id = _pid AND negocio_id = _nid
        FOR UPDATE;
      IF _stock_v IS NULL THEN
        RAISE EXCEPTION 'Variante no encontrada para %', COALESCE(_nombre_p, 'producto');
      END IF;
      UPDATE producto_variantes SET stock = stock - _qty WHERE id = _vid;
    END IF;

    UPDATE productos SET stock = COALESCE(stock, 0) - _qty WHERE id = _pid;

    INSERT INTO stock_movements
      (negocio_id, producto_id, tipo, cantidad, stock_antes, ref_id, ref_tipo, notas, usuario_id)
    VALUES
      (_nid, _pid, 'venta', -_qty, _stock_p, _venta_id::text, 'venta',
       CASE
         WHEN _cons->>'combo' IS NOT NULL THEN 'combo:' || (_cons->>'combo')
         WHEN _vid IS NOT NULL THEN 'variante:' || _vid::text
         ELSE NULL
       END,
       _uid);
  END LOOP;

  -- ── Venta fiada: deuda del cliente dentro de la misma transacción ───────
  IF _pago = 'fiado' AND _cliente_id IS NOT NULL AND COALESCE(_total, 0) > 0 THEN
    SELECT COALESCE(deuda_total, 0) INTO _cli_deuda
      FROM clientes WHERE id = _cliente_id AND negocio_id = _nid FOR UPDATE;

    INSERT INTO deudas (negocio_id, cliente_id, venta_id, monto, tipo, notas)
    VALUES (_nid, _cliente_id, _venta_id, _total, 'deuda', 'Venta fiada: ' || _detalle_txt);

    UPDATE clientes
      SET deuda_total = COALESCE(deuda_total, 0) + _total
      WHERE id = _cliente_id;
  END IF;

  RETURN jsonb_build_object(
    'venta_id', _venta_id,
    'total', COALESCE(_total, 0),
    'lineas', jsonb_array_length(_lineas)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.crear_venta_pos(jsonb, numeric, numeric, numeric, text, numeric, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_venta_pos(jsonb, numeric, numeric, numeric, text, numeric, uuid, uuid) TO authenticated;