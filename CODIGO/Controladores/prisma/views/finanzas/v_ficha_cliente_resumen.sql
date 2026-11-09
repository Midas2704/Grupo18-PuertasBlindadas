SELECT
  fc.id_ficha_cliente,
  cf.id_cliente_financiero,
  cf.rut_cliente,
  cf.nombre_razon_social_referencia,
  cf.contacto_financiero,
  cf.correo_financiero,
  cf.telefono_financiero,
  tcf.nombre_tipo_cliente_financiero,
  fc.estado_ficha,
  fc.fecha_creacion,
  fc.fecha_ultima_revision,
  fc.observacion_financiera_general,
  COALESCE(nv.cantidad_notas_venta, (0) :: bigint) AS cantidad_notas_venta,
  COALESCE(nv.total_notas_venta, (0) :: numeric) AS total_notas_venta,
  COALESCE(dt.cantidad_documentos, (0) :: bigint) AS cantidad_documentos_tributarios,
  COALESCE(dt.total_documentos, (0) :: numeric) AS total_documentos_tributarios,
  COALESCE(pc.cantidad_pagos_cliente, (0) :: bigint) AS cantidad_pagos_cliente,
  COALESCE(pc.total_pagado_cliente, (0) :: numeric) AS total_pagado_cliente,
  COALESCE(pf.cantidad_proyectos_financieros, (0) :: bigint) AS cantidad_proyectos_financieros,
  COALESCE(pf.total_costo_real, (0) :: numeric) AS total_costo_real_proyectos,
  COALESCE(ec.cantidad_evaluaciones_credito, (0) :: bigint) AS cantidad_evaluaciones_credito,
  lc.monto_limite AS limite_credito_vigente,
  lc.estado_limite AS estado_limite_credito,
  COALESCE(cp.cantidad_creditos, (0) :: bigint) AS cantidad_creditos_proyecto,
  COALESCE(cp.total_creditos, (0) :: numeric) AS total_creditos_proyecto,
  COALESCE(al.cantidad_alertas, (0) :: bigint) AS cantidad_alertas_financieras
FROM
  (
    (
      (
        (
          (
            (
              (
                (
                  (
                    (
                      ficha_cliente fc
                      JOIN cliente_financiero cf ON (
                        (
                          cf.id_cliente_financiero = fc.id_cliente_financiero
                        )
                      )
                    )
                    LEFT JOIN tipo_cliente_financiero tcf ON (
                      (
                        tcf.id_tipo_cliente_financiero = cf.id_tipo_cliente_financiero
                      )
                    )
                  )
                  LEFT JOIN (
                    SELECT
                      nota_venta.id_ficha_cliente,
                      count(*) AS cantidad_notas_venta,
                      sum(nota_venta.monto_total) AS total_notas_venta
                    FROM
                      nota_venta
                    WHERE
                      (
                        (nota_venta.estado_nota_venta) :: text <> 'anulada' :: text
                      )
                    GROUP BY
                      nota_venta.id_ficha_cliente
                  ) nv ON ((nv.id_ficha_cliente = fc.id_ficha_cliente))
                )
                LEFT JOIN (
                  SELECT
                    documento_tributario.id_ficha_cliente,
                    count(*) AS cantidad_documentos,
                    sum(documento_tributario.monto_total) AS total_documentos
                  FROM
                    documento_tributario
                  WHERE
                    (
                      (documento_tributario.estado_documento) :: text <> 'anulado' :: text
                    )
                  GROUP BY
                    documento_tributario.id_ficha_cliente
                ) dt ON ((dt.id_ficha_cliente = fc.id_ficha_cliente))
              )
              LEFT JOIN (
                SELECT
                  pago_cliente.id_ficha_cliente,
                  count(*) AS cantidad_pagos_cliente,
                  sum(pago_cliente.monto_pago) AS total_pagado_cliente
                FROM
                  pago_cliente
                WHERE
                  (
                    (pago_cliente.estado_verificacion) :: text <> 'anulado' :: text
                  )
                GROUP BY
                  pago_cliente.id_ficha_cliente
              ) pc ON ((pc.id_ficha_cliente = fc.id_ficha_cliente))
            )
            LEFT JOIN (
              SELECT
                proyecto_financiero.id_ficha_cliente,
                count(*) AS cantidad_proyectos_financieros,
                sum(
                  COALESCE(
                    proyecto_financiero.monto_costo_real,
                    (0) :: numeric
                  )
                ) AS total_costo_real
              FROM
                proyecto_financiero
              WHERE
                (
                  (proyecto_financiero.estado_financiero_proyecto) :: text <> 'anulado' :: text
                )
              GROUP BY
                proyecto_financiero.id_ficha_cliente
            ) pf ON ((pf.id_ficha_cliente = fc.id_ficha_cliente))
          )
          LEFT JOIN (
            SELECT
              evaluacion_credito.id_ficha_cliente,
              count(*) AS cantidad_evaluaciones_credito
            FROM
              evaluacion_credito
            WHERE
              (
                (evaluacion_credito.estado_evaluacion) :: text <> 'anulada' :: text
              )
            GROUP BY
              evaluacion_credito.id_ficha_cliente
          ) ec ON ((ec.id_ficha_cliente = fc.id_ficha_cliente))
        )
        LEFT JOIN LATERAL (
          SELECT
            lcx.monto_limite,
            lcx.estado_limite
          FROM
            limite_credito_cliente lcx
          WHERE
            (
              (lcx.id_ficha_cliente = fc.id_ficha_cliente)
              AND ((lcx.estado_limite) :: text = 'vigente' :: text)
            )
          ORDER BY
            lcx.fecha_inicio_vigencia DESC,
            lcx.id_limite_credito_cliente DESC
          LIMIT
            1
        ) lc ON (TRUE)
      )
      LEFT JOIN (
        SELECT
          credito_proyecto.id_ficha_cliente,
          count(*) AS cantidad_creditos,
          sum(credito_proyecto.monto_credito) AS total_creditos
        FROM
          credito_proyecto
        WHERE
          (
            (credito_proyecto.estado_credito) :: text <> 'anulado' :: text
          )
        GROUP BY
          credito_proyecto.id_ficha_cliente
      ) cp ON ((cp.id_ficha_cliente = fc.id_ficha_cliente))
    )
    LEFT JOIN (
      SELECT
        oa.id_registro_origen AS id_ficha_cliente,
        count(*) AS cantidad_alertas
      FROM
        (
          origen_alerta_financiera oa
          JOIN alerta_financiera af ON (
            (
              af.id_alerta_financiera = oa.id_alerta_financiera
            )
          )
        )
      WHERE
        (
          (
            (oa.entidad_origen) :: text = 'ficha_cliente' :: text
          )
          AND ((af.estado_alerta) :: text <> 'anulada' :: text)
        )
      GROUP BY
        oa.id_registro_origen
    ) al ON ((al.id_ficha_cliente = fc.id_ficha_cliente))
  );