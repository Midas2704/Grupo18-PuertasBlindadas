-- Los seeds antiguos usaban OVERRIDING SYSTEM VALUE sin avanzar identidades.
-- Reparación administrativa; no modifica registros ni reduce contadores.
DO $$
DECLARE columna record; secuencia text; maximo bigint; ultimo bigint;
BEGIN
  FOR columna IN
    SELECT table_schema, table_name, column_name FROM information_schema.columns
    WHERE is_identity = 'YES' AND (
      (table_schema = 'finanzas' AND table_name IN ('moneda','tipo_cliente_financiero','medio_pago','tipo_documento','historial_precio_material','cliente_financiero','ficha_cliente','cotizacion','detalle_cotizacion','detalle_costo_material_cotizacion','nota_venta','pago_cliente','asignacion_pago_cliente','documento_tributario'))
      OR (table_schema = 'terreno' AND table_name IN ('item_comercial','proyecto'))
    )
  LOOP
    secuencia := pg_get_serial_sequence(format('%I.%I', columna.table_schema, columna.table_name), columna.column_name);
    EXECUTE format('SELECT COALESCE(MAX(%I),0) FROM %I.%I', columna.column_name, columna.table_schema, columna.table_name) INTO maximo;
    EXECUTE format('SELECT last_value FROM %s', secuencia) INTO ultimo;
    IF maximo > 0 THEN PERFORM setval(secuencia::regclass, GREATEST(maximo, ultimo), true); END IF;
  END LOOP;
END $$;
