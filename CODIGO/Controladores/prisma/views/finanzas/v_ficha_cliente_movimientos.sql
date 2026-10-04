SELECT
  fc.id_ficha_cliente,
  cf.id_cliente_financiero,
  cf.rut_cliente,
  'nota_venta' :: text AS tipo_origen,
  nv.id_nota_venta AS id_origen,
  (nv.fecha_emision) :: timestamp without time zone AS fecha_movimiento,
  nv.estado_nota_venta AS estado,
  nv.monto_total AS monto,
  nv.observacion AS descripcion
FROM
  (
    (
      ficha_cliente fc
      JOIN cliente_financiero cf ON (
        (
          cf.id_cliente_financiero = fc.id_cliente_financiero
        )
      )
    )
    JOIN nota_venta nv ON ((nv.id_ficha_cliente = fc.id_ficha_cliente))
  )
UNION
ALL
SELECT
  fc.id_ficha_cliente,
  cf.id_cliente_financiero,
  cf.rut_cliente,
  'documento_tributario' :: text AS tipo_origen,
  dt.id_documento_tributario AS id_origen,
  (dt.fecha_emision) :: timestamp without time zone AS fecha_movimiento,
  dt.estado_documento AS estado,
  dt.monto_total AS monto,
  dt.observacion AS descripcion
FROM
  (
    (
      ficha_cliente fc
      JOIN cliente_financiero cf ON (
        (
          cf.id_cliente_financiero = fc.id_cliente_financiero
        )
      )
    )
    JOIN documento_tributario dt ON ((dt.id_ficha_cliente = fc.id_ficha_cliente))
  )
UNION
ALL
SELECT
  fc.id_ficha_cliente,
  cf.id_cliente_financiero,
  cf.rut_cliente,
  'pago_cliente' :: text AS tipo_origen,
  pc.id_pago_cliente AS id_origen,
  (pc.fecha_pago) :: timestamp without time zone AS fecha_movimiento,
  pc.estado_verificacion AS estado,
  pc.monto_pago AS monto,
  pc.observacion AS descripcion
FROM
  (
    (
      ficha_cliente fc
      JOIN cliente_financiero cf ON (
        (
          cf.id_cliente_financiero = fc.id_cliente_financiero
        )
      )
    )
    JOIN pago_cliente pc ON ((pc.id_ficha_cliente = fc.id_ficha_cliente))
  )
UNION
ALL
SELECT
  fc.id_ficha_cliente,
  cf.id_cliente_financiero,
  cf.rut_cliente,
  'proyecto_financiero' :: text AS tipo_origen,
  pf.id_proyecto_financiero AS id_origen,
  (pf.fecha_inicio_financiera) :: timestamp without time zone AS fecha_movimiento,
  pf.estado_financiero_proyecto AS estado,
  COALESCE(pf.monto_venta_estimado, (0) :: numeric) AS monto,
  pf.observacion_financiera AS descripcion
FROM
  (
    (
      ficha_cliente fc
      JOIN cliente_financiero cf ON (
        (
          cf.id_cliente_financiero = fc.id_cliente_financiero
        )
      )
    )
    JOIN proyecto_financiero pf ON ((pf.id_ficha_cliente = fc.id_ficha_cliente))
  )
UNION
ALL
SELECT
  fc.id_ficha_cliente,
  cf.id_cliente_financiero,
  cf.rut_cliente,
  'evaluacion_credito' :: text AS tipo_origen,
  ec.id_evaluacion_credito AS id_origen,
  (ec.fecha_evaluacion) :: timestamp without time zone AS fecha_movimiento,
  ec.estado_evaluacion AS estado,
  ec.puntaje_riesgo AS monto,
  ec.resultado_evaluacion AS descripcion
FROM
  (
    (
      ficha_cliente fc
      JOIN cliente_financiero cf ON (
        (
          cf.id_cliente_financiero = fc.id_cliente_financiero
        )
      )
    )
    JOIN evaluacion_credito ec ON ((ec.id_ficha_cliente = fc.id_ficha_cliente))
  );