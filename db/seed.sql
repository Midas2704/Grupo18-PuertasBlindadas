-- Prueba mínima para SQL_Completo_Tres_Schemas_Finanzas50_inline_FK_v1.sql
-- Ejecutar después del script principal completo.

SET search_path TO finanzas, public;

-- Datos externos completos mínimos
INSERT INTO terreno.cliente (
    cliente_cliente_rut,
    cliente_razon_social,
    cliente_correo,
    cliente_telefono,
    cliente_es_cliente_b2b,
    cliente_es_cliente_b2c
)
VALUES (
    '11111111-1',
    'Cliente de Prueba Finanzas',
    'cliente.prueba@correo.cl',
    '+56911111111',
    true,
    false
)
ON CONFLICT (cliente_cliente_rut) DO NOTHING;

INSERT INTO terreno.item_comercial (nombre_item, descripcion_item, tipo_item)
VALUES ('Puerta blindada de prueba', 'Ítem comercial externo de compatibilidad para cotización', 'puerta');

INSERT INTO terreno.proyecto (
    proyecto_codigo_proyecto,
    proyecto_nombre_referencia,
    proyecto_fecha_ingreso,
    proyecto_estado_operacional,
    proyecto_estado_produccion,
    rut_cliente
)
VALUES (
    'TER-PRUEBA-001',
    'Proyecto terreno de prueba',
    current_date,
    'activo',
    'pendiente',
    '11111111-1'
);

INSERT INTO terreno.usuario (
    usuario_rut_usuario,
    usuario_correo,
    usuario_username,
    usuario_estado_cuenta,
    usuario_fecha_de_creacion
)
VALUES (
    '22222222-2',
    'auditor.prueba@correo.cl',
    'auditor_prueba',
    'activo',
    current_timestamp
);

INSERT INTO inventario.material (material_sku, material_nombre_material, material_estado)
VALUES ('MAT-PRUEBA-001', 'Material prueba Finanzas', 'activo')
ON CONFLICT (material_sku) DO NOTHING;

INSERT INTO inventario.orden_trabajo (
    orden_trabajo_fecha_hora,
    orden_trabajo_estado,
    proyecto_id_proyecto,
    usuario_id_usuario
)
VALUES (
    current_timestamp,
    'pendiente',
    (SELECT proyecto_proyecto_id FROM terreno.proyecto WHERE proyecto_codigo_proyecto = 'TER-PRUEBA-001' ORDER BY proyecto_proyecto_id DESC LIMIT 1),
    (SELECT usuario_id_usuario FROM terreno.usuario WHERE usuario_correo = 'auditor.prueba@correo.cl' ORDER BY usuario_id_usuario DESC LIMIT 1)
);

-- Catálogos financieros mínimos
INSERT INTO finanzas.moneda (codigo_moneda, nombre_moneda, simbolo_moneda)
VALUES ('CLP', 'Peso chileno', '$')
ON CONFLICT (codigo_moneda) DO NOTHING;

INSERT INTO finanzas.tipo_documento (nombre_tipo_documento, aplica_venta, aplica_compra, requiere_vencimiento, afecta_impuesto)
VALUES ('Factura prueba', true, true, true, true)
ON CONFLICT (nombre_tipo_documento) DO NOTHING;

INSERT INTO finanzas.tipo_cliente_financiero (nombre_tipo_cliente_financiero, descripcion_tipo_cliente_financiero)
VALUES ('Empresa prueba', 'Tipo financiero de prueba')
ON CONFLICT (nombre_tipo_cliente_financiero) DO NOTHING;

INSERT INTO finanzas.medio_pago (nombre_medio_pago, descripcion_medio_pago)
VALUES ('Transferencia prueba', 'Medio de pago de prueba')
ON CONFLICT (nombre_medio_pago) DO NOTHING;

INSERT INTO finanzas.tipo_identificador (nombre_tipo_identificador, descripcion_tipo_identificador)
VALUES ('RUT proveedor prueba', 'Identificador tributario chileno de prueba')
ON CONFLICT (nombre_tipo_identificador) DO NOTHING;

INSERT INTO finanzas.pais (nombre_pais, codigo_iso_pais)
VALUES ('Chile prueba', 'CL')
ON CONFLICT (nombre_pais) DO NOTHING;

-- Cliente y ficha financiera
INSERT INTO finanzas.cliente_financiero (
    rut_cliente,
    id_tipo_cliente_financiero,
    nombre_razon_social_referencia,
    contacto_financiero,
    correo_financiero,
    telefono_financiero
)
VALUES (
    '11111111-1',
    (SELECT id_tipo_cliente_financiero FROM finanzas.tipo_cliente_financiero WHERE nombre_tipo_cliente_financiero = 'Empresa prueba'),
    'Cliente de Prueba Finanzas',
    'Contacto financiero prueba',
    'finanzas.cliente@correo.cl',
    '+56911111111'
)
ON CONFLICT (rut_cliente) DO NOTHING;

INSERT INTO finanzas.ficha_cliente (id_cliente_financiero, observacion_financiera_general)
VALUES (
    (SELECT id_cliente_financiero FROM finanzas.cliente_financiero WHERE rut_cliente = '11111111-1'),
    'Ficha financiera creada para prueba mínima completa.'
)
ON CONFLICT (id_cliente_financiero) DO NOTHING;

-- Proveedor y precio material
INSERT INTO finanzas.proveedor (
    id_tipo_identificador,
    id_pais,
    id_moneda_preferente,
    identificador_tributario,
    nombre_razon_social,
    correo_proveedor
)
VALUES (
    (SELECT id_tipo_identificador FROM finanzas.tipo_identificador WHERE nombre_tipo_identificador = 'RUT proveedor prueba'),
    (SELECT id_pais FROM finanzas.pais WHERE nombre_pais = 'Chile prueba'),
    (SELECT id_moneda FROM finanzas.moneda WHERE codigo_moneda = 'CLP'),
    '99999999-9',
    'Proveedor de Prueba Finanzas',
    'proveedor.prueba@correo.cl'
)
ON CONFLICT ON CONSTRAINT uq_proveedor_identificador DO NOTHING;

INSERT INTO finanzas.historial_precio_material (
    material_sku,
    id_proveedor,
    id_moneda,
    precio_unitario,
    fecha_vigencia_inicio,
    observacion
)
VALUES (
    'MAT-PRUEBA-001',
    (SELECT id_proveedor FROM finanzas.proveedor WHERE identificador_tributario = '99999999-9'),
    (SELECT id_moneda FROM finanzas.moneda WHERE codigo_moneda = 'CLP'),
    50000,
    current_date,
    'Precio material de prueba.'
);

-- Cotización, detalle, venta, documento y pago
INSERT INTO finanzas.cotizacion (
    id_ficha_cliente,
    id_moneda,
    fecha_emision,
    fecha_vigencia,
    subtotal_costos_estimados,
    margen_esperado,
    precio_sugerido,
    monto_total_estimado,
    estado_cotizacion
)
VALUES (
    (SELECT fc.id_ficha_cliente FROM finanzas.ficha_cliente fc JOIN finanzas.cliente_financiero cf ON cf.id_cliente_financiero = fc.id_cliente_financiero WHERE cf.rut_cliente = '11111111-1'),
    (SELECT id_moneda FROM finanzas.moneda WHERE codigo_moneda = 'CLP'),
    current_date,
    current_date + INTERVAL '15 days',
    50000,
    30,
    65000,
    77350,
    'emitida'
);

INSERT INTO finanzas.detalle_cotizacion (
    id_cotizacion,
    id_item_comercial,
    cantidad_item,
    subtotal_item_estimado
)
VALUES (
    (SELECT id_cotizacion FROM finanzas.cotizacion ORDER BY id_cotizacion DESC LIMIT 1),
    (SELECT id_item_comercial FROM terreno.item_comercial WHERE nombre_item = 'Puerta blindada de prueba' ORDER BY id_item_comercial DESC LIMIT 1),
    1,
    77350
);

INSERT INTO finanzas.detalle_costo_material_cotizacion (
    id_detalle_cotizacion,
    id_historial_precio_material,
    cantidad_material_estimada,
    precio_unitario_usado,
    subtotal_material_estimado
)
VALUES (
    (SELECT id_detalle_cotizacion FROM finanzas.detalle_cotizacion ORDER BY id_detalle_cotizacion DESC LIMIT 1),
    (SELECT id_historial_precio_material FROM finanzas.historial_precio_material ORDER BY id_historial_precio_material DESC LIMIT 1),
    1,
    50000,
    50000
);

INSERT INTO finanzas.nota_venta (
    id_ficha_cliente,
    id_cotizacion,
    id_moneda,
    numero_nota_venta,
    fecha_emision,
    monto_neto,
    monto_impuesto,
    monto_total,
    estado_nota_venta,
    estado_pago
)
VALUES (
    (SELECT fc.id_ficha_cliente FROM finanzas.ficha_cliente fc JOIN finanzas.cliente_financiero cf ON cf.id_cliente_financiero = fc.id_cliente_financiero WHERE cf.rut_cliente = '11111111-1'),
    (SELECT id_cotizacion FROM finanzas.cotizacion ORDER BY id_cotizacion DESC LIMIT 1),
    (SELECT id_moneda FROM finanzas.moneda WHERE codigo_moneda = 'CLP'),
    'NV-PRUEBA-001',
    current_date,
    65000,
    12350,
    77350,
    'emitida',
    'pendiente'
)
ON CONFLICT (numero_nota_venta) DO NOTHING;

INSERT INTO finanzas.documento_tributario (
    id_ficha_cliente,
    id_nota_venta,
    id_tipo_documento,
    id_moneda,
    folio_documento,
    fecha_emision,
    fecha_vencimiento,
    monto_neto,
    monto_impuesto,
    monto_total,
    estado_documento
)
VALUES (
    (SELECT fc.id_ficha_cliente FROM finanzas.ficha_cliente fc JOIN finanzas.cliente_financiero cf ON cf.id_cliente_financiero = fc.id_cliente_financiero WHERE cf.rut_cliente = '11111111-1'),
    (SELECT id_nota_venta FROM finanzas.nota_venta WHERE numero_nota_venta = 'NV-PRUEBA-001'),
    (SELECT id_tipo_documento FROM finanzas.tipo_documento WHERE nombre_tipo_documento = 'Factura prueba'),
    (SELECT id_moneda FROM finanzas.moneda WHERE codigo_moneda = 'CLP'),
    'FAC-PRUEBA-001',
    current_date,
    current_date + INTERVAL '30 days',
    65000,
    12350,
    77350,
    'emitido'
)
ON CONFLICT ON CONSTRAINT uq_documento_tributario_folio DO NOTHING;

INSERT INTO finanzas.pago_cliente (
    id_ficha_cliente,
    id_moneda,
    id_medio_pago,
    fecha_pago,
    monto_pago,
    estado_verificacion
)
VALUES (
    (SELECT fc.id_ficha_cliente FROM finanzas.ficha_cliente fc JOIN finanzas.cliente_financiero cf ON cf.id_cliente_financiero = fc.id_cliente_financiero WHERE cf.rut_cliente = '11111111-1'),
    (SELECT id_moneda FROM finanzas.moneda WHERE codigo_moneda = 'CLP'),
    (SELECT id_medio_pago FROM finanzas.medio_pago WHERE nombre_medio_pago = 'Transferencia prueba'),
    current_date,
    30000,
    'verificado'
);

INSERT INTO finanzas.asignacion_pago_cliente (
    id_pago_cliente,
    id_nota_venta,
    id_documento_tributario,
    monto_asignado
)
VALUES (
    (SELECT id_pago_cliente FROM finanzas.pago_cliente ORDER BY id_pago_cliente DESC LIMIT 1),
    (SELECT id_nota_venta FROM finanzas.nota_venta WHERE numero_nota_venta = 'NV-PRUEBA-001'),
    (SELECT id_documento_tributario FROM finanzas.documento_tributario WHERE folio_documento = 'FAC-PRUEBA-001'),
    30000
);

-- Proyecto y crédito
INSERT INTO finanzas.proyecto_financiero (
    id_ficha_cliente,
    id_nota_venta,
    id_proyecto_terreno,
    id_moneda,
    codigo_proyecto_financiero,
    fecha_inicio_financiera,
    estado_financiero_proyecto,
    monto_venta_estimado,
    monto_costo_estimado
)
VALUES (
    (SELECT fc.id_ficha_cliente FROM finanzas.ficha_cliente fc JOIN finanzas.cliente_financiero cf ON cf.id_cliente_financiero = fc.id_cliente_financiero WHERE cf.rut_cliente = '11111111-1'),
    (SELECT id_nota_venta FROM finanzas.nota_venta WHERE numero_nota_venta = 'NV-PRUEBA-001'),
    (SELECT proyecto_proyecto_id FROM terreno.proyecto WHERE proyecto_codigo_proyecto = 'TER-PRUEBA-001' ORDER BY proyecto_proyecto_id DESC LIMIT 1),
    (SELECT id_moneda FROM finanzas.moneda WHERE codigo_moneda = 'CLP'),
    'FIN-PRUEBA-001',
    current_date,
    'activo',
    77350,
    50000
)
ON CONFLICT (codigo_proyecto_financiero) DO NOTHING;

INSERT INTO finanzas.evaluacion_credito (
    id_ficha_cliente,
    fecha_evaluacion,
    resultado_evaluacion,
    puntaje_riesgo,
    estado_evaluacion
)
VALUES (
    (SELECT fc.id_ficha_cliente FROM finanzas.ficha_cliente fc JOIN finanzas.cliente_financiero cf ON cf.id_cliente_financiero = fc.id_cliente_financiero WHERE cf.rut_cliente = '11111111-1'),
    current_date,
    'aprobado_prueba',
    80,
    'vigente'
);

INSERT INTO finanzas.limite_credito_cliente (
    id_ficha_cliente,
    id_evaluacion_credito,
    monto_limite,
    fecha_inicio_vigencia,
    estado_limite
)
VALUES (
    (SELECT fc.id_ficha_cliente FROM finanzas.ficha_cliente fc JOIN finanzas.cliente_financiero cf ON cf.id_cliente_financiero = fc.id_cliente_financiero WHERE cf.rut_cliente = '11111111-1'),
    (SELECT id_evaluacion_credito FROM finanzas.evaluacion_credito ORDER BY id_evaluacion_credito DESC LIMIT 1),
    200000,
    current_date,
    'vigente'
);

INSERT INTO finanzas.fondo_global_credito (fecha_calculo, monto_disponible, monto_comprometido, monto_restante)
VALUES (current_date, 1000000, 0, 1000000);

INSERT INTO finanzas.credito_proyecto (
    id_ficha_cliente,
    id_proyecto_financiero,
    id_limite_credito_cliente,
    id_fondo_global_credito,
    id_evaluacion_credito,
    monto_credito,
    fecha_otorgamiento,
    estado_credito
)
VALUES (
    (SELECT fc.id_ficha_cliente FROM finanzas.ficha_cliente fc JOIN finanzas.cliente_financiero cf ON cf.id_cliente_financiero = fc.id_cliente_financiero WHERE cf.rut_cliente = '11111111-1'),
    (SELECT id_proyecto_financiero FROM finanzas.proyecto_financiero WHERE codigo_proyecto_financiero = 'FIN-PRUEBA-001'),
    (SELECT id_limite_credito_cliente FROM finanzas.limite_credito_cliente ORDER BY id_limite_credito_cliente DESC LIMIT 1),
    (SELECT id_fondo_global_credito FROM finanzas.fondo_global_credito ORDER BY id_fondo_global_credito DESC LIMIT 1),
    (SELECT id_evaluacion_credito FROM finanzas.evaluacion_credito ORDER BY id_evaluacion_credito DESC LIMIT 1),
    100000,
    current_date,
    'vigente'
);

-- Alerta y auditoría
INSERT INTO finanzas.alerta_financiera (tipo_alerta, descripcion_alerta, nivel_alerta, estado_alerta)
VALUES ('prueba_ficha', 'Alerta financiera de prueba asociada a ficha.', 'media', 'abierta');

INSERT INTO finanzas.origen_alerta_financiera (id_alerta_financiera, entidad_origen, id_registro_origen, descripcion_origen)
VALUES (
    (SELECT id_alerta_financiera FROM finanzas.alerta_financiera ORDER BY id_alerta_financiera DESC LIMIT 1),
    'ficha_cliente',
    (SELECT fc.id_ficha_cliente FROM finanzas.ficha_cliente fc JOIN finanzas.cliente_financiero cf ON cf.id_cliente_financiero = fc.id_cliente_financiero WHERE cf.rut_cliente = '11111111-1'),
    'Origen de prueba para ficha financiera.'
);

INSERT INTO finanzas.evento_auditoria (id_usuario, tipo_evento, entidad_afectada, id_registro_afectado, accion_realizada)
VALUES (
    (SELECT usuario_id_usuario FROM terreno.usuario WHERE usuario_correo = 'auditor.prueba@correo.cl' ORDER BY usuario_id_usuario DESC LIMIT 1),
    'prueba',
    'ficha_cliente',
    (SELECT fc.id_ficha_cliente FROM finanzas.ficha_cliente fc JOIN finanzas.cliente_financiero cf ON cf.id_cliente_financiero = fc.id_cliente_financiero WHERE cf.rut_cliente = '11111111-1'),
    'insert_prueba_minima'
);

-- Verificación visual de la ficha
SELECT * FROM finanzas.v_ficha_cliente_resumen WHERE rut_cliente = '11111111-1';
SELECT * FROM finanzas.v_ficha_cliente_movimientos WHERE rut_cliente = '11111111-1' ORDER BY fecha_movimiento;
