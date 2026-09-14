
DROP SCHEMA IF EXISTS finanzas CASCADE;
DROP SCHEMA IF EXISTS inventario CASCADE;
DROP SCHEMA IF EXISTS terreno CASCADE;

CREATE SCHEMA terreno;
CREATE SCHEMA inventario;
CREATE SCHEMA finanzas;

SET search_path TO finanzas, public;


-- ============================================================
-- TABLAS TERRENO
-- ============================================================

CREATE TABLE terreno.area_trabajo (
    area_trabajo_id_area BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    area_trabajo_clasificacion VARCHAR(150),
    area_trabajo_activo BOOLEAN,
    area_trabajo_nombre_area VARCHAR(150),
    CONSTRAINT pk_area_trabajo PRIMARY KEY (area_trabajo_id_area)
);

CREATE TABLE terreno.checklist_de_materiales (
    checklist_de_materiales_checklist_de_materials_id BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    checklist_de_materiales_tipo_inicio_tarea TEXT,
    checklist_de_materiales_tipo_cierre_tarea TEXT,
    checklist_de_materiales_item TEXT,
    checklist_de_materiales_es_marcado BOOLEAN,
    checklist_de_materiales_marcado TEXT,
    checklist_de_materiales_es_no_marcado BOOLEAN,
    checklist_de_materiales_no_marcado TEXT,
    CONSTRAINT pk_checklist_de_materiales PRIMARY KEY (checklist_de_materiales_checklist_de_materials_id)
);

CREATE TABLE terreno.cliente (
    cliente_cliente_rut VARCHAR(12) NOT NULL,
    cliente_razon_social TEXT,
    cliente_contacto_principal TEXT,
    cliente_correo TEXT,
    cliente_telefono TEXT,
    cliente_es_cliente_b2c BOOLEAN,
    cliente_cliente_b2c_rut VARCHAR(12),
    cliente_cliente_b2c_correo TEXT,
    cliente_cliente_b2c_primer_nombre TEXT,
    cliente_cliente_b2c_segundo_nombre TEXT,
    cliente_cliente_b2c_primer_apellido TEXT,
    cliente_cliente_b2c_segundo_apellido TEXT,
    cliente_cliente_b2c_telefono_contacto TEXT,
    cliente_cliente_b2c_fecha_registro DATE,
    cliente_cliente_b2c_telefono_contacto_adicional TEXT,
    cliente_cliente_b2c_fecha_ultima_edicion DATE,
    cliente_es_cliente_b2b BOOLEAN,
    cliente_cliente_b2b_fecha_ultima_edicion DATE,
    cliente_cliente_b2b_correo_institucional TEXT,
    cliente_cliente_b2b_fecha_registro DATE,
    cliente_cliente_b2b_telefono_corporativo TEXT,
    cliente_cliente_b2b_razon_social TEXT,
    cliente_cliente_b2b_rut_empresa VARCHAR(12),
    cliente_cliente_b2b_telefono_corp_adicional TEXT,
    cliente_cliente_b2b_representante_legal_primer_nombre TEXT,
    cliente_cliente_b2b_representante_legal_segundo_nombre TEXT,
    cliente_cliente_b2b_representante_legal_primer_apellido TEXT,
    cliente_cliente_b2b_representante_legal_segundo_apellido TEXT,
    CONSTRAINT pk_cliente PRIMARY KEY (cliente_cliente_rut)
);

CREATE TABLE terreno.especificaciones_puerta (
    especificacion_puerta_especificacion_puerta_id BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    especificacion_puerta_modelo_puerta TEXT,
    especificacion_puerta_zona TEXT,
    especificacion_puerta_sentido_apertura TEXT,
    especificacion_puerta_materialidad_vano TEXT,
    especificacion_puerta_materialidad_marco_actual TEXT,
    especificacion_puerta_solucion_marco TEXT,
    especificacion_puerta_hoja_pasiva TEXT,
    especificacion_puerta_hoja_activa TEXT,
    especificacion_puerta_diseno_puerta TEXT,
    especificacion_puerta_observaciones_de_diseno TEXT,
    especificacion_puerta_cubrejuntas BOOLEAN,
    especificacion_puerta_bisagras TEXT,
    especificacion_puerta_observaciones TEXT,
    id_medidas BIGINT,
    CONSTRAINT pk_especificaciones_puerta PRIMARY KEY (especificacion_puerta_especificacion_puerta_id)
);

CREATE TABLE terreno.adicionales_pagados (
    adicionales_pagados_id_adicionales BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    adicionales_pagados_retiro_escombros BOOLEAN,
    adicionales_pagados_retiro_puerta_actual BOOLEAN,
    adicionales_pagados_alarma BOOLEAN,
    adicionales_pagados_subida_escalera TEXT,
    adicionales_pagados_endolados BOOLEAN,
    adicionales_pagados_pilastras_alto NUMERIC(12,4),
    adicionales_pagados_pilastras_ancho NUMERIC(12,4),
    adicionales_pagados_pilastras_espesor NUMERIC(12,4),
    adicionales_pagados_observaciones TEXT,
    id_especificaciones_puerta BIGINT,
    CONSTRAINT pk_adicionales_pagados PRIMARY KEY (adicionales_pagados_id_adicionales),
    CONSTRAINT fk_adicionales_pagados_id_especificaciones_puerta FOREIGN KEY (id_especificaciones_puerta) REFERENCES terreno.especificaciones_puerta(especificacion_puerta_especificacion_puerta_id)
);

CREATE TABLE terreno.especificacion_metalmecanica (
    especificacion_metalmecanica_id_metalmecanica BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    especificacion_metalmecanica_bastidor TEXT,
    especificacion_metalmecanica_cerradura TEXT,
    especificacion_metalmecanica_manillon TEXT,
    especificacion_metalmecanica_pernos_fijos TEXT,
    especificacion_metalmecanica_manilla TEXT,
    especificacion_metalmecanica_herraje TEXT,
    especificacion_metalmecanica_cerrojo TEXT,
    especificacion_metalmecanica_ojo TEXT,
    especificacion_metalmecanica_otros TEXT,
    id_especificacion_puerta BIGINT,
    CONSTRAINT pk_especificacion_metalmecanica PRIMARY KEY (especificacion_metalmecanica_id_metalmecanica),
    CONSTRAINT fk_especificacion_metalmecanica_id_especificacion_puerta FOREIGN KEY (id_especificacion_puerta) REFERENCES terreno.especificaciones_puerta(especificacion_puerta_especificacion_puerta_id)
);

CREATE TABLE terreno.especificacion_proyecto_terreno (
    id_especificacion_proyecto_terreno BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    especificacion_proyecto_terreno_estado_operacional TEXT,
    especificacion_proyecto_terreno_estado_produccion TEXT,
    especificacion_proyecto_terreno_estado_instalacion TEXT,
    especificacion_proyecto_terreno_fecha_inicio DATE,
    especificacion_proyecto_terreno_fecha_cierre_operativo DATE,
    especificacion_proyecto_terreno_observacion_estado TEXT,
    especificacion_proyecto_terreno_conformidad_cliente TEXT,
    id_especificacion_puerta BIGINT,
    CONSTRAINT pk_especificacion_proyecto_terreno PRIMARY KEY (id_especificacion_proyecto_terreno),
    CONSTRAINT fk_especificacion_proyecto_terreno_id_especificacion_puerta FOREIGN KEY (id_especificacion_puerta) REFERENCES terreno.especificaciones_puerta(especificacion_puerta_especificacion_puerta_id)
);

CREATE TABLE terreno.especificacion_terminaciones (
    especificacion_terminaciones_id_terminacion BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    especificacion_terminaciones_herrajes TEXT,
    especificacion_terminaciones_pletina NUMERIC(12,4),
    especificacion_terminaciones_funda NUMERIC(12,4),
    especificacion_terminaciones_medida_final NUMERIC(12,4),
    especificacion_terminaciones_manilla NUMERIC(12,4),
    especificacion_terminaciones_marco_metalico NUMERIC(12,4),
    especificacion_terminaciones_bisagras NUMERIC(12,4),
    especificacion_terminaciones_molduras TEXT,
    especificacion_terminaciones_rebaje TEXT,
    especificacion_terminaciones_canterias TEXT,
    especificacion_terminaciones_pura TEXT,
    especificacion_terminaciones_enchape TEXT,
    id_especificacion_puerta BIGINT,
    CONSTRAINT pk_especificacion_terminaciones PRIMARY KEY (especificacion_terminaciones_id_terminacion),
    CONSTRAINT fk_especificacion_terminaciones_id_especificacion_puerta FOREIGN KEY (id_especificacion_puerta) REFERENCES terreno.especificaciones_puerta(especificacion_puerta_especificacion_puerta_id)
);

CREATE TABLE terreno.historial_cambio_orden_trabajo (
    historial_cambio_orden_trabajo_id_cambio BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    historial_cambio_orden_trabajo_version_nueva TEXT,
    historial_cambio_orden_trabajo_version_antigua TEXT,
    historial_cambio_orden_trabajo_fecha_hora TIMESTAMPTZ,
    historial_cambio_orden_trabajo_descripcion TEXT,
    id_especificaciones_puerta BIGINT,
    CONSTRAINT pk_historial_cambio_orden_trabajo PRIMARY KEY (historial_cambio_orden_trabajo_id_cambio),
    CONSTRAINT fk_historial_cambio_orden_trabajo_id_especificaciones_puerta FOREIGN KEY (id_especificaciones_puerta) REFERENCES terreno.especificaciones_puerta(especificacion_puerta_especificacion_puerta_id)
);

CREATE TABLE terreno.hoja_doble (
    hoja_doble_especificacion_puerta_id BIGINT NOT NULL,
    hoja_doble_actividad_derecha TEXT,
    hoja_doble_medidas_derecha_vertical_alto NUMERIC(12,4),
    hoja_doble_medidas_derecha_vertical_ancho NUMERIC(12,4),
    hoja_doble_medidas_derecha_vertical_espesor NUMERIC(12,4),
    hoja_doble_medidas_derecha_horizontal_alto NUMERIC(12,4),
    hoja_doble_medidas_derecha_horizontal_ancho NUMERIC(12,4),
    hoja_doble_medidas_derecha_horizontal_espesor NUMERIC(12,4),
    hoja_doble_actividad_izquierda TEXT,
    hoja_doble_medidas_izquierda_vertical_alto NUMERIC(12,4),
    hoja_doble_medidas_izquierda_vertical_ancho NUMERIC(12,4),
    hoja_doble_medidas_izquierda_vertical_espesor NUMERIC(12,4),
    hoja_doble_medidas_izquierda_horizontal_alto NUMERIC(12,4),
    hoja_doble_medidas_izquierda_horizontal_ancho NUMERIC(12,4),
    hoja_doble_medidas_izquierda_horizontal_espesor NUMERIC(12,4),
    CONSTRAINT pk_hoja_doble PRIMARY KEY (hoja_doble_especificacion_puerta_id)
);

CREATE TABLE terreno.hoja_simple (
    hoja_simple_especificacion_puerta_id BIGINT NOT NULL,
    hoja_simple_medidas_vertical_alto NUMERIC(12,4),
    hoja_simple_medidas_vertical_ancho NUMERIC(12,4),
    hoja_simple_medidas_vertical_espesor NUMERIC(12,4),
    hoja_simple_medidas_horizontal_alto NUMERIC(12,4),
    hoja_simple_medidas_horizontal_ancho NUMERIC(12,4),
    hoja_simple_medidas_horizontal_espesor NUMERIC(12,4),
    CONSTRAINT pk_hoja_simple PRIMARY KEY (hoja_simple_especificacion_puerta_id)
);

CREATE TABLE terreno.item_comercial (
    id_item_comercial integer GENERATED ALWAYS AS IDENTITY,
    nombre_item varchar(150) NOT NULL,
    descripcion_item text,
    tipo_item varchar(50),
    estado_item varchar(30) NOT NULL DEFAULT 'activo',
    CONSTRAINT pk_terreno_item_comercial PRIMARY KEY (id_item_comercial),
    CONSTRAINT chk_terreno_item_estado CHECK (estado_item IN ('activo', 'inactivo'))
);

CREATE TABLE terreno.medidas_puerta (
    medidas_puerta_medidas_id BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    medidas_puerta_medidas_marco_ancho NUMERIC(12,4),
    medidas_puerta_medidas_marco_alto NUMERIC(12,4),
    medidas_puerta_medidas_marco_espesor NUMERIC(12,4),
    medidas_puerta_medidas_vano_vertical_ancho NUMERIC(12,4),
    medidas_puerta_medidas_vano_vertical_alto NUMERIC(12,4),
    medidas_puerta_medidas_vano_vertical_espesor NUMERIC(12,4),
    medidas_puerta_medidas_vano_horizontal_ancho NUMERIC(12,4),
    medidas_puerta_medidas_vano_horizontal_alto NUMERIC(12,4),
    medidas_puerta_medidas_vano_horizontal_espesor NUMERIC(12,4),
    medidas_puerta_medidas_alojamiento_vertical_alto NUMERIC(12,4),
    medidas_puerta_medidas_alojamiento_vertical_ancho NUMERIC(12,4),
    medidas_puerta_medidas_alojamiento_vertical_espesor NUMERIC(12,4),
    medidas_puerta_medidas_alojamiento_horizontal_alto NUMERIC(12,4),
    medidas_puerta_medidas_alojamiento_horizontal_ancho NUMERIC(12,4),
    medidas_puerta_medidas_alojamiento_horizontal_espesor NUMERIC(12,4),
    medidas_puerta_alojamiento_vertical NUMERIC(12,4),
    medidas_puerta_medidas_de_marco_ancho NUMERIC(12,4),
    medidas_puerta_medidas_de_marco_alto NUMERIC(12,4),
    medidas_puerta_medidas_de_marco_espesor NUMERIC(12,4),
    id_especificacion_puerta BIGINT,
    id_cambio BIGINT,
    CONSTRAINT pk_medidas_puerta PRIMARY KEY (medidas_puerta_medidas_id),
    CONSTRAINT fk_medidas_puerta_id_especificacion_puerta FOREIGN KEY (id_especificacion_puerta) REFERENCES terreno.especificaciones_puerta(especificacion_puerta_especificacion_puerta_id),
    CONSTRAINT fk_medidas_puerta_id_cambio FOREIGN KEY (id_cambio) REFERENCES terreno.historial_cambio_orden_trabajo(historial_cambio_orden_trabajo_id_cambio)
);

CREATE TABLE terreno.obra (
    obra_obra_id BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    obra_nombre_obra TEXT,
    obra_direccion_obra TEXT,
    obra_comuna TEXT,
    obra_region TEXT,
    obra_tipo_obra TEXT,
    obra_fecha_de_creacion DATE,
    obra_fecha_de_ultima_edicion DATE,
    obra_estado TEXT,
    obra_cantidad_puerta INTEGER,
    obra_referencia TEXT,
    obra_observaciones TEXT,
    rut_cliente VARCHAR(12),
    id_especificacion_puerta BIGINT,
    CONSTRAINT pk_obra PRIMARY KEY (obra_obra_id),
    CONSTRAINT fk_obra_rut_cliente FOREIGN KEY (rut_cliente) REFERENCES terreno.cliente(cliente_cliente_rut),
    CONSTRAINT fk_obra_id_especificacion_puerta FOREIGN KEY (id_especificacion_puerta) REFERENCES terreno.especificaciones_puerta(especificacion_puerta_especificacion_puerta_id)
);

CREATE TABLE terreno.perfil (
    perfil_id_perfil BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    perfil_nombre_perfil VARCHAR(150),
    perfil_descripcion TEXT,
    CONSTRAINT pk_perfil PRIMARY KEY (perfil_id_perfil)
);

CREATE TABLE terreno.permiso (
    permiso_id_permiso BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    permiso_modulo VARCHAR(150),
    permiso_accion VARCHAR(150),
    permiso_descripcion TEXT,
    permiso_nombre_del_permiso VARCHAR(150),
    CONSTRAINT pk_permiso PRIMARY KEY (permiso_id_permiso)
);

CREATE TABLE terreno.perfil_permiso (
    perfil_id_perfil BIGINT NOT NULL,
    permiso_id_permiso BIGINT NOT NULL,
    perfil_permiso_activo BOOLEAN,
    CONSTRAINT pk_perfil_permiso PRIMARY KEY (perfil_id_perfil, permiso_id_permiso),
    CONSTRAINT fk_perfil_permiso_perfil_id_perfil FOREIGN KEY (perfil_id_perfil) REFERENCES terreno.perfil(perfil_id_perfil),
    CONSTRAINT fk_perfil_permiso_permiso_id_permiso FOREIGN KEY (permiso_id_permiso) REFERENCES terreno.permiso(permiso_id_permiso)
);

CREATE TABLE terreno.proyecto (
    proyecto_proyecto_id BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    proyecto_codigo_proyecto TEXT,
    proyecto_nombre_referencia TEXT,
    proyecto_fecha_instalacion DATE,
    proyecto_fecha_ingreso DATE,
    proyecto_estado_operacional TEXT,
    proyecto_estado_produccion TEXT,
    rut_cliente VARCHAR(12),
    CONSTRAINT pk_proyecto PRIMARY KEY (proyecto_proyecto_id),
    CONSTRAINT fk_proyecto_rut_cliente FOREIGN KEY (rut_cliente) REFERENCES terreno.cliente(cliente_cliente_rut)
);

CREATE TABLE terreno.tarea_usuario (
    tarea_usuario_tarea_id BIGINT NOT NULL,
    tarea_usuario_usuario_id BIGINT NOT NULL,
    CONSTRAINT pk_tarea_usuario PRIMARY KEY (tarea_usuario_tarea_id, tarea_usuario_usuario_id)
);


-- ============================================================
-- TABLAS INVENTARIO
-- ============================================================

CREATE TABLE inventario.alerta_inventario_nivel_prioridad (
    alerta_inventario_nivel_prioridad_id_nivel_prioridad BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    alerta_inventario_prioridad_nombre VARCHAR(100),
    CONSTRAINT pk_alerta_inventario_nivel_prioridad PRIMARY KEY (alerta_inventario_nivel_prioridad_id_nivel_prioridad)
);

CREATE TABLE inventario.alerta_inventario_tipo_alerta (
    alerta_inventario_tipo_alerta_id_tipo_alerta BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    alerta_inventario_tipo_alerta_nombre VARCHAR(150),
    alerta_inventario_nivel_prioridad_id BIGINT,
    CONSTRAINT pk_alerta_inventario_tipo_alerta PRIMARY KEY (alerta_inventario_tipo_alerta_id_tipo_alerta),
    CONSTRAINT fk_alerta_inventario_tipo_alerta_alerta_inventario__b68d21a3 FOREIGN KEY (alerta_inventario_nivel_prioridad_id) REFERENCES inventario.alerta_inventario_nivel_prioridad(alerta_inventario_nivel_prioridad_id_nivel_prioridad)
);

CREATE TABLE inventario.bodega (
    bodega_id_bodega BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    bodega_nombre_bodega VARCHAR(150),
    bodega_direccion TEXT,
    bodega_estado VARCHAR(50),
    CONSTRAINT pk_bodega PRIMARY KEY (bodega_id_bodega)
);

CREATE TABLE inventario.anaquel (
    anaquel_id_anaquel BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    anaquel_descripcion TEXT,
    bodega_id_bodega BIGINT,
    CONSTRAINT pk_anaquel PRIMARY KEY (anaquel_id_anaquel),
    CONSTRAINT fk_anaquel_bodega_id_bodega FOREIGN KEY (bodega_id_bodega) REFERENCES inventario.bodega(bodega_id_bodega)
);

CREATE TABLE inventario.factura_compra_tipo_cambio (
    factura_compra_tipo_cambio_id_tipo_cambio BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    factura_compra_tipo_cambio_moneda VARCHAR(10),
    factura_compra_tipo_cambio_valor NUMERIC(14,4),
    CONSTRAINT pk_factura_compra_tipo_cambio PRIMARY KEY (factura_compra_tipo_cambio_id_tipo_cambio)
);

CREATE TABLE inventario.historial_alerta (
    historial_alerta_id_historial BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    historial_alerta_fecha_hora_resolucion TIMESTAMPTZ,
    CONSTRAINT pk_historial_alerta PRIMARY KEY (historial_alerta_id_historial)
);

CREATE TABLE inventario.material_categoria_funcional (
    material_categoria_funcional_id_categoria_funcional BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    material_categoria_funcional_nombre VARCHAR(150),
    CONSTRAINT pk_material_categoria_funcional PRIMARY KEY (material_categoria_funcional_id_categoria_funcional)
);

CREATE TABLE inventario.material_categoria_general (
    material_categoria_general_id_categoria_general BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    material_categoria_general_nombre VARCHAR(150),
    CONSTRAINT pk_material_categoria_general PRIMARY KEY (material_categoria_general_id_categoria_general)
);

CREATE TABLE inventario.material_clasificacion_categoria (
    material_clasificacion_categoria_id BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    material_clasificacion_categoria_nombre_categoria VARCHAR(150),
    CONSTRAINT pk_material_clasificacion_categoria PRIMARY KEY (material_clasificacion_categoria_id)
);

CREATE TABLE inventario.material_clasificacion_subcategoria (
    material_clasificacion_subcategoria_id BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    material_clasificacion_subcategoria_nombre_subcategoria VARCHAR(150),
    material_clasificacion_subcategoria_es_color_custom BOOLEAN,
    material_clasificacion_categoria_id BIGINT,
    CONSTRAINT pk_material_clasificacion_subcategoria PRIMARY KEY (material_clasificacion_subcategoria_id),
    CONSTRAINT fk_material_clasificacion_subcategoria_material_cla_e8cfce14 FOREIGN KEY (material_clasificacion_categoria_id) REFERENCES inventario.material_clasificacion_categoria(material_clasificacion_categoria_id)
);

CREATE TABLE inventario.material_clasificacion_nivel_especifico (
    material_clasificacion_nivel_especifico_id BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    material_clasificacion_nivel_especifico_nombre_nivel_especifico VARCHAR(150),
    material_clasificacion_subcategoria_id BIGINT,
    CONSTRAINT pk_material_clasificacion_nivel_especifico PRIMARY KEY (material_clasificacion_nivel_especifico_id),
    CONSTRAINT fk_material_clasificacion_nivel_especifico_material_295c8a27 FOREIGN KEY (material_clasificacion_subcategoria_id) REFERENCES inventario.material_clasificacion_subcategoria(material_clasificacion_subcategoria_id)
);

CREATE TABLE inventario.material_unidad_medida (
    material_unidad_medida_id_unidad_medida BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    material_unidad_medida_nombre VARCHAR(100),
    CONSTRAINT pk_material_unidad_medida PRIMARY KEY (material_unidad_medida_id_unidad_medida)
);

CREATE TABLE inventario.material (
    material_sku VARCHAR(16) NOT NULL,
    material_nombre_material VARCHAR(200),
    material_descripcion TEXT,
    material_material_critico BOOLEAN,
    material_presentacion VARCHAR(150),
    material_stock_critico NUMERIC(12,4),
    material_sotck_maximo NUMERIC(12,4),
    material_stock_minimo NUMERIC(12,4),
    material_es_rotativo BOOLEAN,
    material_estado VARCHAR(50),
    es_material_pintura_custom BOOLEAN,
    material_pintura_custom VARCHAR(100),
    es_material_pintura_no_custom BOOLEAN,
    material_pintura_no_custom VARCHAR(100),
    material_categoria_general_id_categoria_general BIGINT,
    material_categoria_funcional_id_categoria_funcional BIGINT,
    material_clasificacion_nivel_especifico BIGINT,
    material_unidad_medida_id_medida BIGINT,
    CONSTRAINT pk_material PRIMARY KEY (material_sku),
    CONSTRAINT fk_material_material_categoria_general_id_categoria_general FOREIGN KEY (material_categoria_general_id_categoria_general) REFERENCES inventario.material_categoria_general(material_categoria_general_id_categoria_general),
    CONSTRAINT fk_material_material_categoria_funcional_id_categor_7cec335a FOREIGN KEY (material_categoria_funcional_id_categoria_funcional) REFERENCES inventario.material_categoria_funcional(material_categoria_funcional_id_categoria_funcional),
    CONSTRAINT fk_material_material_clasificacion_nivel_especifico FOREIGN KEY (material_clasificacion_nivel_especifico) REFERENCES inventario.material_clasificacion_nivel_especifico(material_clasificacion_nivel_especifico_id),
    CONSTRAINT fk_material_material_unidad_medida_id_medida FOREIGN KEY (material_unidad_medida_id_medida) REFERENCES inventario.material_unidad_medida(material_unidad_medida_id_unidad_medida)
);


-- ============================================================
-- TABLAS TERRENO
-- ============================================================

CREATE TABLE terreno.detalles_herraje (
    detalles_herraje_detalle_herraje_id BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    detalles_herraje_ubicacion TEXT,
    detalles_herraje_color TEXT,
    detalles_herraje_cantidad INTEGER,
    detalles_herraje_observacion TEXT,
    material_sku VARCHAR(16),
    id_especificacion_puerta BIGINT,
    CONSTRAINT pk_detalles_herraje PRIMARY KEY (detalles_herraje_detalle_herraje_id),
    CONSTRAINT fk_detalles_herraje_material_sku FOREIGN KEY (material_sku) REFERENCES inventario.material(material_sku),
    CONSTRAINT fk_detalles_herraje_id_especificacion_puerta FOREIGN KEY (id_especificacion_puerta) REFERENCES terreno.especificaciones_puerta(especificacion_puerta_especificacion_puerta_id)
);


-- ============================================================
-- TABLAS INVENTARIO
-- ============================================================

CREATE TABLE inventario.insumo_estandar_proceso (
    insumo_estandar_proceso_id_insumo_estandar BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    insumo_estandar_proceso_cantidad_estandar NUMERIC(12,4),
    insumo_estandar_proceso_observacion TEXT,
    insumo_estandar_proceso_activo BOOLEAN,
    material_sku VARCHAR(16),
    area_trabajo_id_area BIGINT,
    CONSTRAINT pk_insumo_estandar_proceso PRIMARY KEY (insumo_estandar_proceso_id_insumo_estandar),
    CONSTRAINT fk_insumo_estandar_proceso_material_sku FOREIGN KEY (material_sku) REFERENCES inventario.material(material_sku),
    CONSTRAINT fk_insumo_estandar_proceso_area_trabajo_id_area FOREIGN KEY (area_trabajo_id_area) REFERENCES terreno.area_trabajo(area_trabajo_id_area)
);

CREATE TABLE inventario.material_codigo_barras (
    material_sku VARCHAR(16) NOT NULL,
    material_codigo_barras VARCHAR(100) NOT NULL,
    CONSTRAINT pk_material_codigo_barras PRIMARY KEY (material_sku, material_codigo_barras),
    CONSTRAINT fk_material_codigo_barras_material_sku FOREIGN KEY (material_sku) REFERENCES inventario.material(material_sku)
);

CREATE TABLE inventario.movimiento_inventario_clasificacion_salida (
    id_clasificacion_salida BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    movimiento_inventario_clasificacion_salida_nombre VARCHAR(150),
    CONSTRAINT pk_movimiento_inventario_clasificacion_salida PRIMARY KEY (id_clasificacion_salida)
);

CREATE TABLE inventario.movimiento_inventario_motivo_movimiento (
    movimiento_inventario_motivo_movimiento_id_motivo_movimiento BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    movimiento_inventario_motivo_movimiento_nombre VARCHAR(150),
    id_clasificacion_salida BIGINT,
    CONSTRAINT pk_movimiento_inventario_motivo_movimiento PRIMARY KEY (movimiento_inventario_motivo_movimiento_id_motivo_movimiento),
    CONSTRAINT fk_movimiento_inventario_motivo_movimiento_movimien_cf1b5d9c FOREIGN KEY (id_clasificacion_salida) REFERENCES inventario.movimiento_inventario_clasificacion_salida(id_clasificacion_salida)
);

CREATE TABLE inventario.movimiento_inventario_tipo_movimiento (
    movimiento_inventario_tipo_movimiento_id_tipo_movimiento BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    movimiento_inventario_tipo_movimiento_nombre VARCHAR(150),
    CONSTRAINT pk_movimiento_inventario_tipo_movimiento PRIMARY KEY (movimiento_inventario_tipo_movimiento_id_tipo_movimiento)
);

CREATE TABLE inventario.producto_terminado (
    producto_terminado_id_producto BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    producto_terminado_tipo_producto VARCHAR(150),
    producto_terminado_nombre_producto VARCHAR(200),
    producto_terminado_codigo_producto VARCHAR(80),
    producto_terminado_requerimientos_certificacion TEXT,
    producto_terminado_requerimientos_medidas TEXT,
    producto_terminado_requerimientos_produccion TEXT,
    producto_terminado_requerimientos_instalacion TEXT,
    producto_terminado_activo BOOLEAN,
    CONSTRAINT pk_producto_terminado PRIMARY KEY (producto_terminado_id_producto)
);

CREATE TABLE inventario.material_producto_terminado (
    material_sku VARCHAR(16) NOT NULL,
    producto_terminado_id_producto BIGINT NOT NULL,
    material_producto_terminado_cantidad_estimada NUMERIC(12,4),
    material_producto_terminado_merma_estimada NUMERIC(12,4),
    CONSTRAINT pk_material_producto_terminado PRIMARY KEY (material_sku, producto_terminado_id_producto),
    CONSTRAINT fk_material_producto_terminado_material_sku FOREIGN KEY (material_sku) REFERENCES inventario.material(material_sku),
    CONSTRAINT fk_material_producto_terminado_producto_terminado_i_5cce9a2a FOREIGN KEY (producto_terminado_id_producto) REFERENCES inventario.producto_terminado(producto_terminado_id_producto)
);


-- ============================================================
-- TABLAS FINANZAS CORE 50
-- ============================================================

CREATE TABLE finanzas.afp (
    id_afp integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre_afp varchar(100) NOT NULL UNIQUE,
    estado_afp varchar(20) NOT NULL DEFAULT 'activo',
    CONSTRAINT chk_afp_estado CHECK (estado_afp IN ('activo', 'inactivo'))
);

CREATE TABLE finanzas.alerta_financiera (
    id_alerta_financiera integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tipo_alerta varchar(80) NOT NULL,
    fecha_generacion timestamp NOT NULL DEFAULT current_timestamp,
    descripcion_alerta text NOT NULL,
    nivel_alerta varchar(30) NOT NULL DEFAULT 'media',
    estado_alerta varchar(30) NOT NULL DEFAULT 'abierta',
    fecha_cierre timestamp,
    observacion text,
    CONSTRAINT chk_alerta_financiera_nivel CHECK (nivel_alerta IN ('baja', 'media', 'alta', 'critica')),
    CONSTRAINT chk_alerta_financiera_estado CHECK (estado_alerta IN ('abierta', 'en_revision', 'cerrada', 'anulada'))
);

CREATE TABLE finanzas.cargo (
    id_cargo integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre_cargo varchar(100) NOT NULL UNIQUE,
    descripcion_cargo text,
    estado_cargo varchar(20) NOT NULL DEFAULT 'activo',
    CONSTRAINT chk_cargo_estado CHECK (estado_cargo IN ('activo', 'inactivo'))
);

CREATE TABLE finanzas.concepto_remuneracion (
    id_concepto_remuneracion integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre_concepto varchar(100) NOT NULL UNIQUE,
    descripcion_concepto text,
    naturaleza_concepto varchar(30) NOT NULL,
    estado_concepto varchar(20) NOT NULL DEFAULT 'activo',
    CONSTRAINT chk_concepto_remuneracion_naturaleza CHECK (naturaleza_concepto IN ('haber', 'descuento', 'bono', 'retencion', 'otro')),
    CONSTRAINT chk_concepto_remuneracion_estado CHECK (estado_concepto IN ('activo', 'inactivo'))
);

CREATE TABLE finanzas.fondo_global_credito (
    id_fondo_global_credito integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fecha_calculo date NOT NULL,
    monto_disponible numeric(14,2) NOT NULL,
    monto_comprometido numeric(14,2) NOT NULL DEFAULT 0,
    monto_restante numeric(14,2) NOT NULL,
    estado_fondo varchar(30) NOT NULL DEFAULT 'vigente',
    observacion text,
    CONSTRAINT chk_fondo_global_credito_montos CHECK (monto_disponible >= 0 AND monto_comprometido >= 0 AND monto_restante >= 0),
    CONSTRAINT chk_fondo_global_credito_estado CHECK (estado_fondo IN ('vigente', 'cerrado', 'anulado'))
);

CREATE TABLE finanzas.gasto_caja_chica (
    id_gasto_caja_chica integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fecha_gasto date NOT NULL,
    monto_gasto numeric(14,2) NOT NULL,
    descripcion_gasto text NOT NULL,
    motivo_gasto text,
    categoria_gasto varchar(80),
    responsable_gasto varchar(150),
    respaldo_gasto text,
    estado_validacion varchar(30) NOT NULL DEFAULT 'pendiente',
    observacion text,
    CONSTRAINT chk_gasto_caja_chica_monto CHECK (monto_gasto > 0),
    CONSTRAINT chk_gasto_caja_chica_estado CHECK (estado_validacion IN ('pendiente', 'aprobado', 'rechazado', 'anulado'))
);

CREATE TABLE finanzas.medio_pago (
    id_medio_pago integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre_medio_pago varchar(80) NOT NULL UNIQUE,
    descripcion_medio_pago text,
    estado_medio_pago varchar(20) NOT NULL DEFAULT 'activo',
    CONSTRAINT chk_medio_pago_estado CHECK (estado_medio_pago IN ('activo', 'inactivo'))
);

CREATE TABLE finanzas.moneda (
    id_moneda integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo_moneda varchar(10) NOT NULL UNIQUE,
    nombre_moneda varchar(80) NOT NULL,
    simbolo_moneda varchar(10),
    estado_moneda varchar(20) NOT NULL DEFAULT 'activo',
    CONSTRAINT chk_moneda_estado CHECK (estado_moneda IN ('activo', 'inactivo'))
);

CREATE TABLE finanzas.movimiento_bancario (
    id_movimiento_bancario integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_moneda integer NOT NULL,
    fecha_movimiento_bancario timestamp NOT NULL,
    monto_bancario numeric(14,2) NOT NULL,
    descripcion_bancaria text,
    glosa_bancaria text,
    tipo_movimiento_bancario varchar(50),
    banco varchar(100),
    cuenta_bancaria varchar(80),
    numero_operacion varchar(100),
    estado_conciliacion varchar(30) NOT NULL DEFAULT 'pendiente',
    CONSTRAINT fk_movimiento_bancario_moneda FOREIGN KEY (id_moneda)
        REFERENCES moneda (id_moneda) ON DELETE RESTRICT,
    CONSTRAINT chk_movimiento_bancario_monto CHECK (monto_bancario > 0),
    CONSTRAINT chk_movimiento_bancario_estado CHECK (estado_conciliacion IN ('pendiente', 'conciliado', 'observado', 'anulado'))
);

CREATE TABLE finanzas.movimiento_financiero (
    id_movimiento_financiero integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_moneda integer NOT NULL,
    fecha_movimiento timestamp NOT NULL DEFAULT current_timestamp,
    tipo_movimiento_financiero varchar(50) NOT NULL,
    naturaleza_movimiento varchar(30) NOT NULL,
    motivo_movimiento text,
    monto_movimiento numeric(14,2) NOT NULL,
    estado_movimiento varchar(30) NOT NULL DEFAULT 'registrado',
    observacion text,
    CONSTRAINT fk_movimiento_financiero_moneda FOREIGN KEY (id_moneda)
        REFERENCES moneda (id_moneda) ON DELETE RESTRICT,
    CONSTRAINT chk_movimiento_financiero_monto CHECK (monto_movimiento > 0),
    CONSTRAINT chk_movimiento_financiero_naturaleza CHECK (naturaleza_movimiento IN ('ingreso', 'egreso', 'ajuste')),
    CONSTRAINT chk_movimiento_financiero_estado CHECK (estado_movimiento IN ('registrado', 'conciliado', 'anulado'))
);

CREATE TABLE finanzas.conciliacion (
    id_conciliacion integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_movimiento_financiero integer NOT NULL,
    id_movimiento_bancario integer NOT NULL,
    fecha_conciliacion timestamp NOT NULL DEFAULT current_timestamp,
    monto_conciliado numeric(14,2) NOT NULL,
    diferencia_conciliacion numeric(14,2) DEFAULT 0,
    estado_conciliacion varchar(30) NOT NULL DEFAULT 'pendiente',
    responsable_conciliacion varchar(150),
    observacion text,
    CONSTRAINT fk_conciliacion_movimiento_financiero FOREIGN KEY (id_movimiento_financiero)
        REFERENCES movimiento_financiero (id_movimiento_financiero) ON DELETE RESTRICT,
    CONSTRAINT fk_conciliacion_movimiento_bancario FOREIGN KEY (id_movimiento_bancario)
        REFERENCES movimiento_bancario (id_movimiento_bancario) ON DELETE RESTRICT,
    CONSTRAINT chk_conciliacion_monto CHECK (monto_conciliado >= 0),
    CONSTRAINT chk_conciliacion_estado CHECK (estado_conciliacion IN ('pendiente', 'conciliada', 'observada', 'anulada'))
);

CREATE TABLE finanzas.detalle_conciliacion (
    id_detalle_conciliacion integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_conciliacion integer NOT NULL,
    descripcion_diferencia text,
    monto_diferencia numeric(14,2),
    tipo_diferencia varchar(50),
    estado_revision varchar(30) NOT NULL DEFAULT 'pendiente',
    observacion text,
    CONSTRAINT fk_detalle_conciliacion_conciliacion FOREIGN KEY (id_conciliacion)
        REFERENCES conciliacion (id_conciliacion) ON DELETE RESTRICT,
    CONSTRAINT chk_detalle_conciliacion_estado CHECK (estado_revision IN ('pendiente', 'revisado', 'resuelto', 'anulado'))
);

CREATE TABLE finanzas.origen_alerta_financiera (
    id_origen_alerta_financiera integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_alerta_financiera integer NOT NULL,
    entidad_origen varchar(80) NOT NULL,
    id_registro_origen integer NOT NULL,
    descripcion_origen text,
    CONSTRAINT fk_origen_alerta_financiera_alerta FOREIGN KEY (id_alerta_financiera)
        REFERENCES alerta_financiera (id_alerta_financiera) ON DELETE RESTRICT,
    CONSTRAINT chk_origen_alerta_financiera_entidad CHECK (entidad_origen IN ('ficha_cliente', 'nota_venta', 'documento_tributario', 'documento_compra_proveedor', 'proyecto_financiero', 'credito_proyecto', 'evaluacion_credito', 'fondo_global_credito', 'proveedor'))
);

CREATE TABLE finanzas.origen_movimiento_financiero (
    id_origen_movimiento_financiero integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_movimiento_financiero integer NOT NULL,
    entidad_origen varchar(80) NOT NULL,
    id_registro_origen integer NOT NULL,
    descripcion_origen text,
    CONSTRAINT fk_origen_movimiento_financiero_movimiento FOREIGN KEY (id_movimiento_financiero)
        REFERENCES movimiento_financiero (id_movimiento_financiero) ON DELETE RESTRICT,
    CONSTRAINT chk_origen_movimiento_financiero_entidad CHECK (entidad_origen IN ('pago_cliente', 'pago_proveedor', 'gasto_caja_chica', 'liquidacion_remuneracion', 'ajuste_manual'))
);

CREATE TABLE finanzas.pais (
    id_pais integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre_pais varchar(100) NOT NULL UNIQUE,
    codigo_iso_pais varchar(10),
    estado_pais varchar(20) NOT NULL DEFAULT 'activo',
    CONSTRAINT chk_pais_estado CHECK (estado_pais IN ('activo', 'inactivo'))
);

CREATE TABLE finanzas.prevision_salud (
    id_prevision_salud integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre_prevision_salud varchar(100) NOT NULL UNIQUE,
    tipo_prevision_salud varchar(50),
    estado_prevision_salud varchar(20) NOT NULL DEFAULT 'activo',
    CONSTRAINT chk_prevision_salud_estado CHECK (estado_prevision_salud IN ('activo', 'inactivo'))
);

CREATE TABLE finanzas.tarea_catalogada (
    id_tarea_catalogada integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre_tarea varchar(120) NOT NULL UNIQUE,
    descripcion_tarea text,
    estado_tarea varchar(30) NOT NULL DEFAULT 'activa',
    CONSTRAINT chk_tarea_catalogada_estado CHECK (estado_tarea IN ('activa', 'inactiva'))
);

CREATE TABLE finanzas.historial_tarifa_tarea (
    id_historial_tarifa_tarea integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_tarea_catalogada integer NOT NULL,
    valor_unitario_tarea numeric(14,2) NOT NULL,
    fecha_vigencia_inicio date NOT NULL,
    fecha_vigencia_fin date,
    estado_tarifa varchar(30) NOT NULL DEFAULT 'vigente',
    observacion text,
    CONSTRAINT fk_historial_tarifa_tarea_tarea FOREIGN KEY (id_tarea_catalogada)
        REFERENCES tarea_catalogada (id_tarea_catalogada) ON DELETE RESTRICT,
    CONSTRAINT chk_historial_tarifa_tarea_valor CHECK (valor_unitario_tarea >= 0),
    CONSTRAINT chk_historial_tarifa_tarea_estado CHECK (estado_tarifa IN ('vigente', 'reemplazada', 'anulada')),
    CONSTRAINT chk_historial_tarifa_tarea_vigencia CHECK (fecha_vigencia_fin IS NULL OR fecha_vigencia_fin >= fecha_vigencia_inicio)
);

CREATE TABLE finanzas.tipo_cliente_financiero (
    id_tipo_cliente_financiero integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre_tipo_cliente_financiero varchar(80) NOT NULL UNIQUE,
    descripcion_tipo_cliente_financiero text,
    estado_tipo_cliente_financiero varchar(20) NOT NULL DEFAULT 'activo',
    CONSTRAINT chk_tipo_cliente_financiero_estado CHECK (estado_tipo_cliente_financiero IN ('activo', 'inactivo'))
);

CREATE TABLE finanzas.cliente_financiero (
    id_cliente_financiero integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    rut_cliente varchar(15) NOT NULL UNIQUE,
    id_tipo_cliente_financiero integer NOT NULL,
    nombre_razon_social_referencia varchar(150) NOT NULL,
    contacto_financiero varchar(150),
    correo_financiero varchar(150),
    telefono_financiero varchar(30),
    estado_financiero varchar(20) NOT NULL DEFAULT 'activo',
    fecha_actualizacion_datos_cliente timestamp NOT NULL DEFAULT current_timestamp,
    CONSTRAINT fk_cliente_financiero_tipo_cliente FOREIGN KEY (id_tipo_cliente_financiero)
        REFERENCES tipo_cliente_financiero (id_tipo_cliente_financiero) ON DELETE RESTRICT,
    CONSTRAINT chk_cliente_financiero_estado CHECK (estado_financiero IN ('activo', 'inactivo', 'bloqueado')),
    CONSTRAINT fk_cli_fin_cliente_ext FOREIGN KEY (rut_cliente)
            REFERENCES terreno.cliente (cliente_cliente_rut) ON DELETE RESTRICT
);

CREATE TABLE finanzas.ficha_cliente (
    id_ficha_cliente integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_cliente_financiero integer NOT NULL UNIQUE,
    fecha_creacion timestamp NOT NULL DEFAULT current_timestamp,
    estado_ficha varchar(20) NOT NULL DEFAULT 'activa',
    fecha_ultima_revision timestamp,
    observacion_financiera_general text,
    CONSTRAINT fk_ficha_cliente_cliente_financiero FOREIGN KEY (id_cliente_financiero)
        REFERENCES cliente_financiero (id_cliente_financiero) ON DELETE RESTRICT,
    CONSTRAINT chk_ficha_cliente_estado CHECK (estado_ficha IN ('activa', 'inactiva', 'bloqueada', 'cerrada'))
);

CREATE TABLE finanzas.cotizacion (
    id_cotizacion integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_ficha_cliente integer NOT NULL,
    id_moneda integer NOT NULL,
    fecha_emision date NOT NULL,
    fecha_vigencia date,
    subtotal_costos_estimados numeric(14,2) NOT NULL DEFAULT 0,
    margen_esperado numeric(5,2),
    precio_sugerido numeric(14,2),
    monto_total_estimado numeric(14,2),
    estado_cotizacion varchar(30) NOT NULL DEFAULT 'emitida',
    observacion text,
    CONSTRAINT fk_cotizacion_ficha_cliente FOREIGN KEY (id_ficha_cliente)
        REFERENCES ficha_cliente (id_ficha_cliente) ON DELETE RESTRICT,
    CONSTRAINT fk_cotizacion_moneda FOREIGN KEY (id_moneda)
        REFERENCES moneda (id_moneda) ON DELETE RESTRICT,
    CONSTRAINT chk_cotizacion_subtotal CHECK (subtotal_costos_estimados >= 0),
    CONSTRAINT chk_cotizacion_margen CHECK (margen_esperado IS NULL OR margen_esperado >= 0),
    CONSTRAINT chk_cotizacion_precio CHECK (precio_sugerido IS NULL OR precio_sugerido >= 0),
    CONSTRAINT chk_cotizacion_total CHECK (monto_total_estimado IS NULL OR monto_total_estimado >= 0),
    CONSTRAINT chk_cotizacion_estado CHECK (estado_cotizacion IN ('borrador', 'emitida', 'aprobada', 'rechazada', 'vencida', 'anulada'))
);

CREATE TABLE finanzas.detalle_cotizacion (
    id_detalle_cotizacion integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_cotizacion integer NOT NULL,
    id_item_comercial integer NOT NULL,
    cantidad_item numeric(12,2) NOT NULL DEFAULT 1,
    medida_alto_referencial numeric(10,2),
    medida_ancho_referencial numeric(10,2),
    medida_espesor_referencial numeric(10,2),
    descripcion_item_cotizado text,
    observacion_medidas text,
    subtotal_item_estimado numeric(14,2) NOT NULL DEFAULT 0,
    CONSTRAINT fk_detalle_cotizacion_cotizacion FOREIGN KEY (id_cotizacion)
        REFERENCES cotizacion (id_cotizacion) ON DELETE RESTRICT,
    CONSTRAINT chk_detalle_cotizacion_cantidad CHECK (cantidad_item > 0),
    CONSTRAINT chk_detalle_cotizacion_subtotal CHECK (subtotal_item_estimado >= 0),
    CONSTRAINT fk_det_cot_item_ext FOREIGN KEY (id_item_comercial)
            REFERENCES terreno.item_comercial (id_item_comercial) ON DELETE RESTRICT
);

CREATE TABLE finanzas.evaluacion_credito (
    id_evaluacion_credito integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_ficha_cliente integer NOT NULL,
    fecha_evaluacion date NOT NULL,
    resultado_evaluacion varchar(50) NOT NULL,
    puntaje_riesgo numeric(6,2),
    comportamiento_pago_evaluado text,
    fundamento_evaluacion text,
    estado_evaluacion varchar(30) NOT NULL DEFAULT 'vigente',
    observacion text,
    CONSTRAINT fk_evaluacion_credito_ficha_cliente FOREIGN KEY (id_ficha_cliente)
        REFERENCES ficha_cliente (id_ficha_cliente) ON DELETE RESTRICT,
    CONSTRAINT chk_evaluacion_credito_puntaje CHECK (puntaje_riesgo IS NULL OR puntaje_riesgo >= 0),
    CONSTRAINT chk_evaluacion_credito_estado CHECK (estado_evaluacion IN ('vigente', 'reemplazada', 'anulada'))
);

CREATE TABLE finanzas.limite_credito_cliente (
    id_limite_credito_cliente integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_ficha_cliente integer NOT NULL,
    id_evaluacion_credito integer NOT NULL,
    monto_limite numeric(14,2) NOT NULL,
    fecha_inicio_vigencia date NOT NULL,
    fecha_fin_vigencia date,
    estado_limite varchar(30) NOT NULL DEFAULT 'vigente',
    motivo_modificacion text,
    observacion text,
    CONSTRAINT fk_limite_credito_cliente_ficha FOREIGN KEY (id_ficha_cliente)
        REFERENCES ficha_cliente (id_ficha_cliente) ON DELETE RESTRICT,
    CONSTRAINT fk_limite_credito_cliente_evaluacion FOREIGN KEY (id_evaluacion_credito)
        REFERENCES evaluacion_credito (id_evaluacion_credito) ON DELETE RESTRICT,
    CONSTRAINT chk_limite_credito_cliente_monto CHECK (monto_limite >= 0),
    CONSTRAINT chk_limite_credito_cliente_estado CHECK (estado_limite IN ('vigente', 'reemplazado', 'suspendido', 'anulado')),
    CONSTRAINT chk_limite_credito_cliente_vigencia CHECK (fecha_fin_vigencia IS NULL OR fecha_fin_vigencia >= fecha_inicio_vigencia)
);

CREATE TABLE finanzas.nota_venta (
    id_nota_venta integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_ficha_cliente integer NOT NULL,
    id_cotizacion integer,
    id_moneda integer NOT NULL,
    numero_nota_venta varchar(50) NOT NULL UNIQUE,
    fecha_emision date NOT NULL,
    monto_neto numeric(14,2) NOT NULL DEFAULT 0,
    monto_impuesto numeric(14,2) NOT NULL DEFAULT 0,
    monto_total numeric(14,2) NOT NULL DEFAULT 0,
    tipo_cambio_usado numeric(14,4),
    monto_convertido numeric(14,2),
    estado_nota_venta varchar(30) NOT NULL DEFAULT 'emitida',
    estado_pago varchar(30) NOT NULL DEFAULT 'pendiente',
    descuento_aplicado numeric(14,2) DEFAULT 0,
    motivo_descuento text,
    fecha_anulacion timestamp,
    motivo_anulacion text,
    observacion text,
    CONSTRAINT fk_nota_venta_ficha_cliente FOREIGN KEY (id_ficha_cliente)
        REFERENCES ficha_cliente (id_ficha_cliente) ON DELETE RESTRICT,
    CONSTRAINT fk_nota_venta_cotizacion FOREIGN KEY (id_cotizacion)
        REFERENCES cotizacion (id_cotizacion) ON DELETE RESTRICT,
    CONSTRAINT fk_nota_venta_moneda FOREIGN KEY (id_moneda)
        REFERENCES moneda (id_moneda) ON DELETE RESTRICT,
    CONSTRAINT chk_nota_venta_montos CHECK (monto_neto >= 0 AND monto_impuesto >= 0 AND monto_total >= 0),
    CONSTRAINT chk_nota_venta_monto_convertido CHECK (monto_convertido IS NULL OR monto_convertido >= 0),
    CONSTRAINT chk_nota_venta_descuento CHECK (descuento_aplicado IS NULL OR descuento_aplicado >= 0),
    CONSTRAINT chk_nota_venta_estado CHECK (estado_nota_venta IN ('emitida', 'confirmada', 'anulada', 'cerrada')),
    CONSTRAINT chk_nota_venta_estado_pago CHECK (estado_pago IN ('pendiente', 'parcial', 'pagada', 'vencida'))
);

CREATE TABLE finanzas.pago_cliente (
    id_pago_cliente integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_ficha_cliente integer NOT NULL,
    id_moneda integer NOT NULL,
    id_medio_pago integer NOT NULL,
    fecha_pago date NOT NULL,
    monto_pago numeric(14,2) NOT NULL,
    tipo_cambio_usado numeric(14,4),
    monto_convertido numeric(14,2),
    naturaleza_pago varchar(30) NOT NULL DEFAULT 'ingreso_cliente',
    estado_verificacion varchar(30) NOT NULL DEFAULT 'pendiente',
    comprobante_pago text,
    observacion text,
    CONSTRAINT fk_pago_cliente_ficha_cliente FOREIGN KEY (id_ficha_cliente)
        REFERENCES ficha_cliente (id_ficha_cliente) ON DELETE RESTRICT,
    CONSTRAINT fk_pago_cliente_moneda FOREIGN KEY (id_moneda)
        REFERENCES moneda (id_moneda) ON DELETE RESTRICT,
    CONSTRAINT fk_pago_cliente_medio_pago FOREIGN KEY (id_medio_pago)
        REFERENCES medio_pago (id_medio_pago) ON DELETE RESTRICT,
    CONSTRAINT chk_pago_cliente_monto CHECK (monto_pago > 0),
    CONSTRAINT chk_pago_cliente_monto_convertido CHECK (monto_convertido IS NULL OR monto_convertido >= 0),
    CONSTRAINT chk_pago_cliente_estado CHECK (estado_verificacion IN ('pendiente', 'verificado', 'rechazado', 'anulado'))
);

CREATE TABLE finanzas.proyecto_financiero (
    id_proyecto_financiero integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_ficha_cliente integer NOT NULL,
    id_nota_venta integer,
    id_proyecto_terreno integer,
    id_moneda integer NOT NULL,
    codigo_proyecto_financiero varchar(80) NOT NULL UNIQUE,
    fecha_inicio_financiera date,
    fecha_cierre_financiera date,
    estado_financiero_proyecto varchar(30) NOT NULL DEFAULT 'activo',
    monto_venta_estimado numeric(14,2),
    monto_costo_estimado numeric(14,2),
    monto_costo_real numeric(14,2),
    margen_estimado numeric(14,2),
    margen_real numeric(14,2),
    observacion_financiera text,
    CONSTRAINT fk_proyecto_financiero_ficha_cliente FOREIGN KEY (id_ficha_cliente)
        REFERENCES ficha_cliente (id_ficha_cliente) ON DELETE RESTRICT,
    CONSTRAINT fk_proyecto_financiero_nota_venta FOREIGN KEY (id_nota_venta)
        REFERENCES nota_venta (id_nota_venta) ON DELETE RESTRICT,
    CONSTRAINT fk_proyecto_financiero_moneda FOREIGN KEY (id_moneda)
        REFERENCES moneda (id_moneda) ON DELETE RESTRICT,
    CONSTRAINT chk_proyecto_financiero_estado CHECK (estado_financiero_proyecto IN ('activo', 'en_revision', 'cerrado', 'anulado')),
    CONSTRAINT chk_proyecto_financiero_montos CHECK (
        (monto_venta_estimado IS NULL OR monto_venta_estimado >= 0) AND
        (monto_costo_estimado IS NULL OR monto_costo_estimado >= 0) AND
        (monto_costo_real IS NULL OR monto_costo_real >= 0)
    ),
    CONSTRAINT fk_proy_fin_terreno_ext FOREIGN KEY (id_proyecto_terreno)
            REFERENCES terreno.proyecto (proyecto_proyecto_id) ON DELETE RESTRICT
);

CREATE TABLE finanzas.costo_proyecto (
    id_costo_proyecto integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_proyecto_financiero integer NOT NULL,
    id_moneda integer NOT NULL,
    descripcion_costo text NOT NULL,
    categoria_costo varchar(80),
    monto_costo numeric(14,2) NOT NULL,
    fecha_costo date NOT NULL,
    origen_costo varchar(80),
    estado_costo varchar(30) NOT NULL DEFAULT 'registrado',
    observacion text,
    CONSTRAINT fk_costo_proyecto_proyecto FOREIGN KEY (id_proyecto_financiero)
        REFERENCES proyecto_financiero (id_proyecto_financiero) ON DELETE RESTRICT,
    CONSTRAINT fk_costo_proyecto_moneda FOREIGN KEY (id_moneda)
        REFERENCES moneda (id_moneda) ON DELETE RESTRICT,
    CONSTRAINT chk_costo_proyecto_monto CHECK (monto_costo >= 0),
    CONSTRAINT chk_costo_proyecto_estado CHECK (estado_costo IN ('registrado', 'validado', 'anulado'))
);

CREATE TABLE finanzas.credito_proyecto (
    id_credito_proyecto integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_ficha_cliente integer NOT NULL,
    id_proyecto_financiero integer,
    id_limite_credito_cliente integer NOT NULL,
    id_fondo_global_credito integer NOT NULL,
    id_evaluacion_credito integer NOT NULL,
    monto_credito numeric(14,2) NOT NULL,
    fecha_otorgamiento date NOT NULL,
    fecha_vencimiento date,
    estado_credito varchar(30) NOT NULL DEFAULT 'vigente',
    motivo_aprobacion text,
    observacion text,
    CONSTRAINT fk_credito_proyecto_ficha_cliente FOREIGN KEY (id_ficha_cliente)
        REFERENCES ficha_cliente (id_ficha_cliente) ON DELETE RESTRICT,
    CONSTRAINT fk_credito_proyecto_proyecto FOREIGN KEY (id_proyecto_financiero)
        REFERENCES proyecto_financiero (id_proyecto_financiero) ON DELETE RESTRICT,
    CONSTRAINT fk_credito_proyecto_limite FOREIGN KEY (id_limite_credito_cliente)
        REFERENCES limite_credito_cliente (id_limite_credito_cliente) ON DELETE RESTRICT,
    CONSTRAINT fk_credito_proyecto_fondo FOREIGN KEY (id_fondo_global_credito)
        REFERENCES fondo_global_credito (id_fondo_global_credito) ON DELETE RESTRICT,
    CONSTRAINT fk_credito_proyecto_evaluacion FOREIGN KEY (id_evaluacion_credito)
        REFERENCES evaluacion_credito (id_evaluacion_credito) ON DELETE RESTRICT,
    CONSTRAINT chk_credito_proyecto_monto CHECK (monto_credito > 0),
    CONSTRAINT chk_credito_proyecto_estado CHECK (estado_credito IN ('vigente', 'pagado', 'vencido', 'anulado'))
);

CREATE TABLE finanzas.hito_cobro (
    id_hito_cobro integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_nota_venta integer NOT NULL,
    id_proyecto_financiero integer,
    descripcion_hito varchar(150) NOT NULL,
    fecha_programada_cobro date NOT NULL,
    monto_programado numeric(14,2) NOT NULL,
    estado_hito varchar(30) NOT NULL DEFAULT 'pendiente',
    fecha_pago_real date,
    observacion text,
    CONSTRAINT fk_hito_cobro_nota_venta FOREIGN KEY (id_nota_venta)
        REFERENCES nota_venta (id_nota_venta) ON DELETE RESTRICT,
    CONSTRAINT fk_hito_cobro_proyecto_financiero FOREIGN KEY (id_proyecto_financiero)
        REFERENCES proyecto_financiero (id_proyecto_financiero) ON DELETE RESTRICT,
    CONSTRAINT chk_hito_cobro_monto CHECK (monto_programado >= 0),
    CONSTRAINT chk_hito_cobro_estado CHECK (estado_hito IN ('pendiente', 'pagado', 'parcial', 'vencido', 'anulado'))
);

CREATE TABLE finanzas.tipo_documento (
    id_tipo_documento integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre_tipo_documento varchar(80) NOT NULL UNIQUE,
    descripcion_tipo_documento text,
    aplica_venta boolean NOT NULL DEFAULT false,
    aplica_compra boolean NOT NULL DEFAULT false,
    requiere_vencimiento boolean NOT NULL DEFAULT false,
    afecta_impuesto boolean NOT NULL DEFAULT true,
    estado_tipo_documento varchar(20) NOT NULL DEFAULT 'activo',
    CONSTRAINT chk_tipo_documento_estado CHECK (estado_tipo_documento IN ('activo', 'inactivo')),
    CONSTRAINT chk_tipo_documento_aplica CHECK (aplica_venta OR aplica_compra)
);

CREATE TABLE finanzas.documento_tributario (
    id_documento_tributario integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_ficha_cliente integer NOT NULL,
    id_nota_venta integer NOT NULL,
    id_tipo_documento integer NOT NULL,
    id_moneda integer NOT NULL,
    id_documento_referencia integer,
    folio_documento varchar(80) NOT NULL,
    fecha_emision date NOT NULL,
    fecha_vencimiento date,
    monto_neto numeric(14,2) NOT NULL DEFAULT 0,
    monto_impuesto numeric(14,2) NOT NULL DEFAULT 0,
    monto_total numeric(14,2) NOT NULL DEFAULT 0,
    estado_documento varchar(30) NOT NULL DEFAULT 'emitido',
    fecha_anulacion timestamp,
    respaldo_documento text,
    observacion text,
    CONSTRAINT fk_documento_tributario_ficha_cliente FOREIGN KEY (id_ficha_cliente)
        REFERENCES ficha_cliente (id_ficha_cliente) ON DELETE RESTRICT,
    CONSTRAINT fk_documento_tributario_nota_venta FOREIGN KEY (id_nota_venta)
        REFERENCES nota_venta (id_nota_venta) ON DELETE RESTRICT,
    CONSTRAINT fk_documento_tributario_tipo_documento FOREIGN KEY (id_tipo_documento)
        REFERENCES tipo_documento (id_tipo_documento) ON DELETE RESTRICT,
    CONSTRAINT fk_documento_tributario_moneda FOREIGN KEY (id_moneda)
        REFERENCES moneda (id_moneda) ON DELETE RESTRICT,
    CONSTRAINT fk_documento_tributario_referencia FOREIGN KEY (id_documento_referencia)
        REFERENCES documento_tributario (id_documento_tributario) ON DELETE RESTRICT,
    CONSTRAINT uq_documento_tributario_folio UNIQUE (id_tipo_documento, folio_documento),
    CONSTRAINT chk_documento_tributario_montos CHECK (monto_neto >= 0 AND monto_impuesto >= 0 AND monto_total >= 0),
    CONSTRAINT chk_documento_tributario_estado CHECK (estado_documento IN ('emitido', 'pagado', 'vencido', 'anulado', 'referenciado'))
);

CREATE TABLE finanzas.asignacion_pago_cliente (
    id_asignacion_pago_cliente integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_pago_cliente integer NOT NULL,
    id_nota_venta integer,
    id_documento_tributario integer,
    id_hito_cobro integer,
    monto_asignado numeric(14,2) NOT NULL,
    fecha_asignacion timestamp NOT NULL DEFAULT current_timestamp,
    observacion text,
    CONSTRAINT fk_asignacion_pago_cliente_pago FOREIGN KEY (id_pago_cliente)
        REFERENCES pago_cliente (id_pago_cliente) ON DELETE RESTRICT,
    CONSTRAINT fk_asignacion_pago_cliente_nota FOREIGN KEY (id_nota_venta)
        REFERENCES nota_venta (id_nota_venta) ON DELETE RESTRICT,
    CONSTRAINT fk_asignacion_pago_cliente_documento FOREIGN KEY (id_documento_tributario)
        REFERENCES documento_tributario (id_documento_tributario) ON DELETE RESTRICT,
    CONSTRAINT fk_asignacion_pago_cliente_hito FOREIGN KEY (id_hito_cobro)
        REFERENCES hito_cobro (id_hito_cobro) ON DELETE RESTRICT,
    CONSTRAINT chk_asignacion_pago_cliente_monto CHECK (monto_asignado > 0),
    CONSTRAINT chk_asignacion_pago_cliente_origen CHECK (
        id_nota_venta IS NOT NULL OR id_documento_tributario IS NOT NULL OR id_hito_cobro IS NOT NULL
    )
);

CREATE TABLE finanzas.tipo_identificador (
    id_tipo_identificador integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre_tipo_identificador varchar(80) NOT NULL UNIQUE,
    descripcion_tipo_identificador text,
    estado_tipo_identificador varchar(20) NOT NULL DEFAULT 'activo',
    CONSTRAINT chk_tipo_identificador_estado CHECK (estado_tipo_identificador IN ('activo', 'inactivo'))
);

CREATE TABLE finanzas.proveedor (
    id_proveedor integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_tipo_identificador integer NOT NULL,
    id_pais integer,
    id_moneda_preferente integer,
    identificador_tributario varchar(50) NOT NULL,
    nombre_razon_social varchar(150) NOT NULL,
    nacionalidad_origen varchar(80),
    contacto_proveedor varchar(150),
    correo_proveedor varchar(150),
    telefono_proveedor varchar(30),
    direccion_proveedor text,
    estado_proveedor varchar(30) NOT NULL DEFAULT 'activo',
    fecha_registro date NOT NULL DEFAULT current_date,
    CONSTRAINT fk_proveedor_tipo_identificador FOREIGN KEY (id_tipo_identificador)
        REFERENCES tipo_identificador (id_tipo_identificador) ON DELETE RESTRICT,
    CONSTRAINT fk_proveedor_pais FOREIGN KEY (id_pais)
        REFERENCES pais (id_pais) ON DELETE RESTRICT,
    CONSTRAINT fk_proveedor_moneda_preferente FOREIGN KEY (id_moneda_preferente)
        REFERENCES moneda (id_moneda) ON DELETE RESTRICT,
    CONSTRAINT uq_proveedor_identificador UNIQUE (id_tipo_identificador, identificador_tributario),
    CONSTRAINT chk_proveedor_estado CHECK (estado_proveedor IN ('activo', 'inactivo', 'bloqueado'))
);


-- ============================================================
-- TABLAS INVENTARIO
-- ============================================================

CREATE TABLE inventario.alerta_inventario (
    alerta_inventario_id_alerta BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    alerta_inventario_mensaje TEXT,
    alerta_inventario_fecha_generacion TIMESTAMPTZ,
    alerta_inventario_fecha_est_agotamiento DATE,
    alerta_inventario_estado VARCHAR(50),
    material_sku VARCHAR(16),
    proveedor_id_proveedor BIGINT,
    alerta_inventario_tipo_alerta_id_tipo_alerta BIGINT,
    historial_alerta_id_historial BIGINT,
    CONSTRAINT pk_alerta_inventario PRIMARY KEY (alerta_inventario_id_alerta),
    CONSTRAINT fk_alerta_inventario_material_sku FOREIGN KEY (material_sku) REFERENCES inventario.material(material_sku),
    CONSTRAINT fk_alerta_inventario_proveedor_id_proveedor FOREIGN KEY (proveedor_id_proveedor) REFERENCES finanzas.proveedor(id_proveedor),
    CONSTRAINT fk_alerta_inventario_alerta_inventario_tipo_alerta__2344ac23 FOREIGN KEY (alerta_inventario_tipo_alerta_id_tipo_alerta) REFERENCES inventario.alerta_inventario_tipo_alerta(alerta_inventario_tipo_alerta_id_tipo_alerta),
    CONSTRAINT fk_alerta_inventario_historial_alerta_id_historial FOREIGN KEY (historial_alerta_id_historial) REFERENCES inventario.historial_alerta(historial_alerta_id_historial)
);

CREATE TABLE inventario.factura_compra (
    factura_compra_id_factura BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    factura_compra_numero_factura VARCHAR(80),
    factura_compra_monto_neto NUMERIC(14,2),
    factura_compra_tipo_compra VARCHAR(100),
    factura_compra_fecha_emision DATE,
    proveedor_id_proveedor BIGINT,
    factura_compra_tipo_cambio_id_tipo_cambio BIGINT,
    CONSTRAINT pk_factura_compra PRIMARY KEY (factura_compra_id_factura),
    CONSTRAINT fk_factura_compra_proveedor_id_proveedor FOREIGN KEY (proveedor_id_proveedor) REFERENCES finanzas.proveedor(id_proveedor),
    CONSTRAINT fk_factura_compra_factura_compra_tipo_cambio_id_tipo_cambio FOREIGN KEY (factura_compra_tipo_cambio_id_tipo_cambio) REFERENCES inventario.factura_compra_tipo_cambio(factura_compra_tipo_cambio_id_tipo_cambio)
);

CREATE TABLE inventario.lote (
    lote_id_lote BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    lote_numero_lote VARCHAR(80),
    lote_fecha_ingreso DATE,
    lote_fecha_vencimiento DATE,
    lote_fecha_recepcion DATE,
    lote_estado VARCHAR(50),
    proveedor_id_proveedor BIGINT,
    factura_compra_id_factura BIGINT,
    proyecto_id_proyecto BIGINT,
    CONSTRAINT pk_lote PRIMARY KEY (lote_id_lote),
    CONSTRAINT fk_lote_proveedor_id_proveedor FOREIGN KEY (proveedor_id_proveedor) REFERENCES finanzas.proveedor(id_proveedor),
    CONSTRAINT fk_lote_factura_compra_id_factura FOREIGN KEY (factura_compra_id_factura) REFERENCES inventario.factura_compra(factura_compra_id_factura),
    CONSTRAINT fk_lote_proyecto_id_proyecto FOREIGN KEY (proyecto_id_proyecto) REFERENCES terreno.proyecto(proyecto_proyecto_id)
);

CREATE TABLE inventario.inventario_bodega (
    material_sku VARCHAR(16) NOT NULL,
    lote_id_lote BIGINT NOT NULL,
    bodega_id_bodega BIGINT NOT NULL,
    inventario_bodega_cantidad_fisica NUMERIC(12,4),
    inventario_bodega_cantidad_reservada NUMERIC(12,4),
    CONSTRAINT pk_inventario_bodega PRIMARY KEY (material_sku, lote_id_lote, bodega_id_bodega),
    CONSTRAINT fk_inventario_bodega_material_sku FOREIGN KEY (material_sku) REFERENCES inventario.material(material_sku),
    CONSTRAINT fk_inventario_bodega_lote_id_lote FOREIGN KEY (lote_id_lote) REFERENCES inventario.lote(lote_id_lote),
    CONSTRAINT fk_inventario_bodega_bodega_id_bodega FOREIGN KEY (bodega_id_bodega) REFERENCES inventario.bodega(bodega_id_bodega)
);

CREATE TABLE inventario.lote_fecha_pedido (
    lote_fecha_pedido_id BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    lote_fecha_pedido_fecha_pedido DATE,
    lote_fecha_pedido_precio_unitario NUMERIC(14,2),
    lote_id_lote BIGINT,
    CONSTRAINT pk_lote_fecha_pedido PRIMARY KEY (lote_fecha_pedido_id),
    CONSTRAINT fk_lote_fecha_pedido_lote_id_lote FOREIGN KEY (lote_id_lote) REFERENCES inventario.lote(lote_id_lote)
);

CREATE TABLE inventario.material_proveedor (
    material_sku VARCHAR(16) NOT NULL,
    proveedor_id_proveedor BIGINT NOT NULL,
    material_proveedor_tiempo_reposicion INTEGER,
    material_proveedor_precio_referencial NUMERIC(14,2),
    material_proveedor_proveedor_principal BOOLEAN,
    CONSTRAINT pk_material_proveedor PRIMARY KEY (material_sku, proveedor_id_proveedor),
    CONSTRAINT fk_material_proveedor_material_sku FOREIGN KEY (material_sku) REFERENCES inventario.material(material_sku),
    CONSTRAINT fk_material_proveedor_proveedor_id_proveedor FOREIGN KEY (proveedor_id_proveedor) REFERENCES finanzas.proveedor(id_proveedor)
);

CREATE TABLE inventario.proveedor_contacto_correo (
    proveedor_id_proveedor BIGINT NOT NULL,
    proveedor_contacto_correo VARCHAR(254) NOT NULL,
    CONSTRAINT pk_proveedor_contacto_correo PRIMARY KEY (proveedor_id_proveedor, proveedor_contacto_correo),
    CONSTRAINT fk_proveedor_contacto_correo_proveedor_id_proveedor FOREIGN KEY (proveedor_id_proveedor) REFERENCES finanzas.proveedor(id_proveedor)
);

CREATE TABLE inventario.proveedor_contacto_telefono (
    proveedor_id_proveedor BIGINT NOT NULL,
    proveedor_contacto_telefono VARCHAR(30) NOT NULL,
    CONSTRAINT pk_proveedor_contacto_telefono PRIMARY KEY (proveedor_id_proveedor, proveedor_contacto_telefono),
    CONSTRAINT fk_proveedor_contacto_telefono_proveedor_id_proveedor FOREIGN KEY (proveedor_id_proveedor) REFERENCES finanzas.proveedor(id_proveedor)
);


-- ============================================================
-- TABLAS FINANZAS CORE 50
-- ============================================================

CREATE TABLE finanzas.documento_compra_proveedor (
    id_documento_compra_proveedor integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_proveedor integer NOT NULL,
    id_tipo_documento integer NOT NULL,
    id_moneda integer NOT NULL,
    numero_documento varchar(80) NOT NULL,
    fecha_emision date NOT NULL,
    fecha_vencimiento date,
    monto_neto numeric(14,2) NOT NULL DEFAULT 0,
    monto_impuesto numeric(14,2) NOT NULL DEFAULT 0,
    monto_total numeric(14,2) NOT NULL DEFAULT 0,
    tipo_cambio_usado numeric(14,4),
    fecha_tipo_cambio date,
    monto_convertido numeric(14,2),
    estado_documento varchar(30) NOT NULL DEFAULT 'registrado',
    respaldo_documento text,
    observacion text,
    CONSTRAINT fk_documento_compra_proveedor_proveedor FOREIGN KEY (id_proveedor)
        REFERENCES proveedor (id_proveedor) ON DELETE RESTRICT,
    CONSTRAINT fk_documento_compra_proveedor_tipo_documento FOREIGN KEY (id_tipo_documento)
        REFERENCES tipo_documento (id_tipo_documento) ON DELETE RESTRICT,
    CONSTRAINT fk_documento_compra_proveedor_moneda FOREIGN KEY (id_moneda)
        REFERENCES moneda (id_moneda) ON DELETE RESTRICT,
    CONSTRAINT uq_documento_compra_proveedor_numero UNIQUE (id_proveedor, numero_documento, id_tipo_documento),
    CONSTRAINT chk_documento_compra_proveedor_montos CHECK (monto_neto >= 0 AND monto_impuesto >= 0 AND monto_total >= 0),
    CONSTRAINT chk_documento_compra_proveedor_convertido CHECK (monto_convertido IS NULL OR monto_convertido >= 0),
    CONSTRAINT chk_documento_compra_proveedor_estado CHECK (estado_documento IN ('registrado', 'pendiente_pago', 'pagado', 'vencido', 'anulado'))
);

CREATE TABLE finanzas.detalle_costo_proyecto_documento_proveedor (
    id_detalle_costo_proyecto_documento_proveedor integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_documento_compra_proveedor integer NOT NULL,
    id_costo_proyecto integer NOT NULL,
    monto_imputado numeric(14,2) NOT NULL,
    porcentaje_imputado numeric(5,2),
    observacion text,
    CONSTRAINT fk_detalle_costo_proyecto_documento FOREIGN KEY (id_documento_compra_proveedor)
        REFERENCES documento_compra_proveedor (id_documento_compra_proveedor) ON DELETE RESTRICT,
    CONSTRAINT fk_detalle_costo_proyecto_costo FOREIGN KEY (id_costo_proyecto)
        REFERENCES costo_proyecto (id_costo_proyecto) ON DELETE RESTRICT,
    CONSTRAINT chk_detalle_costo_proyecto_monto CHECK (monto_imputado >= 0),
    CONSTRAINT chk_detalle_costo_proyecto_porcentaje CHECK (porcentaje_imputado IS NULL OR porcentaje_imputado BETWEEN 0 AND 100)
);

CREATE TABLE finanzas.historial_precio_material (
    id_historial_precio_material integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    material_sku varchar(50) NOT NULL,
    id_proveedor integer,
    id_moneda integer NOT NULL,
    precio_unitario numeric(14,2) NOT NULL,
    tipo_cambio_usado numeric(14,4),
    precio_unitario_convertido numeric(14,2),
    fecha_registro timestamp NOT NULL DEFAULT current_timestamp,
    fecha_vigencia_inicio date NOT NULL,
    fecha_vigencia_fin date,
    estado_precio varchar(20) NOT NULL DEFAULT 'vigente',
    observacion text,
    CONSTRAINT fk_historial_precio_material_proveedor FOREIGN KEY (id_proveedor)
        REFERENCES proveedor (id_proveedor) ON DELETE RESTRICT,
    CONSTRAINT fk_historial_precio_material_moneda FOREIGN KEY (id_moneda)
        REFERENCES moneda (id_moneda) ON DELETE RESTRICT,
    CONSTRAINT chk_historial_precio_material_precio CHECK (precio_unitario >= 0),
    CONSTRAINT chk_historial_precio_material_precio_convertido CHECK (precio_unitario_convertido IS NULL OR precio_unitario_convertido >= 0),
    CONSTRAINT chk_historial_precio_material_estado CHECK (estado_precio IN ('vigente', 'reemplazado', 'anulado')),
    CONSTRAINT chk_historial_precio_material_vigencia CHECK (fecha_vigencia_fin IS NULL OR fecha_vigencia_fin >= fecha_vigencia_inicio),
    CONSTRAINT fk_hpm_material_ext FOREIGN KEY (material_sku)
            REFERENCES inventario.material (material_sku) ON DELETE RESTRICT
);

CREATE TABLE finanzas.detalle_costo_material_cotizacion (
    id_detalle_costo_material_cotizacion integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_detalle_cotizacion integer NOT NULL,
    id_historial_precio_material integer NOT NULL,
    cantidad_material_estimada numeric(14,4) NOT NULL,
    precio_unitario_usado numeric(14,2) NOT NULL,
    subtotal_material_estimado numeric(14,2) NOT NULL,
    observacion text,
    CONSTRAINT fk_detalle_costo_material_detalle_cotizacion FOREIGN KEY (id_detalle_cotizacion)
        REFERENCES detalle_cotizacion (id_detalle_cotizacion) ON DELETE RESTRICT,
    CONSTRAINT fk_detalle_costo_material_historial_precio FOREIGN KEY (id_historial_precio_material)
        REFERENCES historial_precio_material (id_historial_precio_material) ON DELETE RESTRICT,
    CONSTRAINT chk_detalle_costo_material_cantidad CHECK (cantidad_material_estimada >= 0),
    CONSTRAINT chk_detalle_costo_material_precio CHECK (precio_unitario_usado >= 0),
    CONSTRAINT chk_detalle_costo_material_subtotal CHECK (subtotal_material_estimado >= 0)
);

CREATE TABLE finanzas.detalle_documento_compra_proveedor (
    id_detalle_documento_compra_proveedor integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_documento_compra_proveedor integer NOT NULL,
    id_historial_precio_material integer NOT NULL,
    cantidad_material numeric(14,4) NOT NULL,
    unidad_medida varchar(30),
    precio_unitario_documento numeric(14,2) NOT NULL,
    subtotal_linea numeric(14,2) NOT NULL,
    observacion text,
    CONSTRAINT fk_detalle_documento_compra_documento FOREIGN KEY (id_documento_compra_proveedor)
        REFERENCES documento_compra_proveedor (id_documento_compra_proveedor) ON DELETE RESTRICT,
    CONSTRAINT fk_detalle_documento_compra_historial FOREIGN KEY (id_historial_precio_material)
        REFERENCES historial_precio_material (id_historial_precio_material) ON DELETE RESTRICT,
    CONSTRAINT chk_detalle_documento_compra_cantidad CHECK (cantidad_material > 0),
    CONSTRAINT chk_detalle_documento_compra_precio CHECK (precio_unitario_documento >= 0),
    CONSTRAINT chk_detalle_documento_compra_subtotal CHECK (subtotal_linea >= 0)
);

CREATE TABLE finanzas.pago_proveedor (
    id_pago_proveedor integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_proveedor integer NOT NULL,
    id_moneda integer NOT NULL,
    id_medio_pago integer NOT NULL,
    fecha_pago date NOT NULL,
    monto_pago numeric(14,2) NOT NULL,
    tipo_cambio_usado numeric(14,4),
    monto_convertido numeric(14,2),
    estado_pago varchar(30) NOT NULL DEFAULT 'registrado',
    comprobante_pago text,
    observacion text,
    CONSTRAINT fk_pago_proveedor_proveedor FOREIGN KEY (id_proveedor)
        REFERENCES proveedor (id_proveedor) ON DELETE RESTRICT,
    CONSTRAINT fk_pago_proveedor_moneda FOREIGN KEY (id_moneda)
        REFERENCES moneda (id_moneda) ON DELETE RESTRICT,
    CONSTRAINT fk_pago_proveedor_medio_pago FOREIGN KEY (id_medio_pago)
        REFERENCES medio_pago (id_medio_pago) ON DELETE RESTRICT,
    CONSTRAINT chk_pago_proveedor_monto CHECK (monto_pago > 0),
    CONSTRAINT chk_pago_proveedor_convertido CHECK (monto_convertido IS NULL OR monto_convertido >= 0),
    CONSTRAINT chk_pago_proveedor_estado CHECK (estado_pago IN ('registrado', 'verificado', 'anulado'))
);

CREATE TABLE finanzas.asignacion_pago_proveedor (
    id_asignacion_pago_proveedor integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_pago_proveedor integer NOT NULL,
    id_documento_compra_proveedor integer NOT NULL,
    monto_asignado numeric(14,2) NOT NULL,
    fecha_asignacion timestamp NOT NULL DEFAULT current_timestamp,
    observacion text,
    CONSTRAINT fk_asignacion_pago_proveedor_pago FOREIGN KEY (id_pago_proveedor)
        REFERENCES pago_proveedor (id_pago_proveedor) ON DELETE RESTRICT,
    CONSTRAINT fk_asignacion_pago_proveedor_documento FOREIGN KEY (id_documento_compra_proveedor)
        REFERENCES documento_compra_proveedor (id_documento_compra_proveedor) ON DELETE RESTRICT,
    CONSTRAINT chk_asignacion_pago_proveedor_monto CHECK (monto_asignado > 0)
);

CREATE TABLE finanzas.tipo_vinculo_laboral (
    id_tipo_vinculo_laboral integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre_tipo_vinculo_laboral varchar(80) NOT NULL UNIQUE,
    descripcion_tipo_vinculo_laboral text,
    estado_tipo_vinculo_laboral varchar(20) NOT NULL DEFAULT 'activo',
    CONSTRAINT chk_tipo_vinculo_laboral_estado CHECK (estado_tipo_vinculo_laboral IN ('activo', 'inactivo'))
);

CREATE TABLE finanzas.empleado (
    rut_empleado varchar(15) PRIMARY KEY,
    id_cargo integer NOT NULL,
    id_tipo_vinculo_laboral integer NOT NULL,
    id_prevision_salud integer,
    id_afp integer,
    nombres varchar(120) NOT NULL,
    apellido_paterno varchar(80) NOT NULL,
    apellido_materno varchar(80),
    fecha_nacimiento date,
    fecha_ingreso date NOT NULL,
    sueldo_base numeric(14,2) NOT NULL,
    seguro_cesantia boolean NOT NULL DEFAULT true,
    estado_laboral varchar(30) NOT NULL DEFAULT 'activo',
    CONSTRAINT fk_empleado_cargo FOREIGN KEY (id_cargo)
        REFERENCES cargo (id_cargo) ON DELETE RESTRICT,
    CONSTRAINT fk_empleado_tipo_vinculo FOREIGN KEY (id_tipo_vinculo_laboral)
        REFERENCES tipo_vinculo_laboral (id_tipo_vinculo_laboral) ON DELETE RESTRICT,
    CONSTRAINT fk_empleado_prevision_salud FOREIGN KEY (id_prevision_salud)
        REFERENCES prevision_salud (id_prevision_salud) ON DELETE RESTRICT,
    CONSTRAINT fk_empleado_afp FOREIGN KEY (id_afp)
        REFERENCES afp (id_afp) ON DELETE RESTRICT,
    CONSTRAINT chk_empleado_sueldo CHECK (sueldo_base >= 0),
    CONSTRAINT chk_empleado_estado CHECK (estado_laboral IN ('activo', 'inactivo', 'desvinculado', 'suspendido'))
);


-- ============================================================
-- TABLAS TERRENO
-- ============================================================

CREATE TABLE terreno.prestamo_herramientas (
    prestamo_herramienta_prestamo_herramienta_id BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    prestamo_herramienta_fecha_entrega TIMESTAMPTZ,
    prestamo_herramienta_fecha_devolucion TIMESTAMPTZ,
    prestamo_herramienta_cantidad INTEGER,
    prestamo_herramienta_estado_prestamo TEXT,
    prestamo_herramienta_observacion TEXT,
    rut_empleado VARCHAR(12),
    sku_material VARCHAR(16),
    CONSTRAINT pk_prestamo_herramientas PRIMARY KEY (prestamo_herramienta_prestamo_herramienta_id),
    CONSTRAINT fk_prestamo_herramientas_rut_empleado FOREIGN KEY (rut_empleado) REFERENCES finanzas.empleado(rut_empleado),
    CONSTRAINT fk_prestamo_herramientas_sku_material FOREIGN KEY (sku_material) REFERENCES inventario.material(material_sku)
);

CREATE TABLE terreno.usuario (
    usuario_id_usuario BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    usuario_fecha_de_ultima_edicion TIMESTAMPTZ,
    usuario_rut_usuario VARCHAR(12),
    usuario_fecha_de_creacion TIMESTAMPTZ,
    usuario_correo VARCHAR(254),
    usuario_username VARCHAR(100),
    usuario_estado_cuenta VARCHAR(50),
    usuario_fecha_ultima_conexion TIMESTAMPTZ,
    usuario_nombre_completo_primer_nombre_usuario VARCHAR(100),
    usuario_nombre_completo_segundo_nombre_usuario VARCHAR(100),
    usuario_nombre_completo_primer_apellido_usuario VARCHAR(100),
    usuario_nombre_completo_segundo_apellido_usuario VARCHAR(100),
    usuario_es_gerencia BOOLEAN,
    gerencia TEXT,
    usuario_es_tecnico BOOLEAN,
    tecnico TEXT,
    usuario_es_jop BOOLEAN,
    jop TEXT,
    usuario_es_administrador BOOLEAN,
    administrador TEXT,
    usuario_es_secretaria BOOLEAN,
    secretaria TEXT,
    perfil_id_perfil BIGINT,
    empleado_rut_empleado VARCHAR(12),
    CONSTRAINT pk_usuario PRIMARY KEY (usuario_id_usuario),
    CONSTRAINT fk_usuario_perfil_id_perfil FOREIGN KEY (perfil_id_perfil) REFERENCES terreno.perfil(perfil_id_perfil),
    CONSTRAINT fk_usuario_empleado_rut_empleado FOREIGN KEY (empleado_rut_empleado) REFERENCES finanzas.empleado(rut_empleado)
);

CREATE TABLE terreno.servicio_terreno (
    servicio_terreno_servicio_terreno_id BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    servicio_terreno_tipo_servicio VARCHAR(50),
    servicio_terreno_fecha_real DATE,
    servicio_terreno_bloque_horario TIME,
    servicio_terreno_prioridad TEXT,
    servicio_terreno_fecha_programada TIME,
    servicio_terreno_estado TEXT,
    servicio_terreno_observaciones TEXT,
    id_usuario BIGINT,
    id_checklist_de_materials BIGINT,
    CONSTRAINT pk_servicio_terreno PRIMARY KEY (servicio_terreno_servicio_terreno_id),
    CONSTRAINT fk_servicio_terreno_id_usuario FOREIGN KEY (id_usuario) REFERENCES terreno.usuario(usuario_id_usuario),
    CONSTRAINT fk_servicio_terreno_id_checklist_de_materials FOREIGN KEY (id_checklist_de_materials) REFERENCES terreno.checklist_de_materiales(checklist_de_materiales_checklist_de_materials_id)
);

CREATE TABLE terreno.especificacion_servicio_terreno (
    especificacion_servicio_terreno_servicio_terreno_id BIGINT NOT NULL,
    especificacion_servicio_terreno_especificacion_puerta_id BIGINT NOT NULL,
    CONSTRAINT pk_especificacion_servicio_terreno PRIMARY KEY (especificacion_servicio_terreno_servicio_terreno_id, especificacion_servicio_terreno_especificacion_puerta_id),
    CONSTRAINT fk_especificacion_servicio_terreno_especificacion_s_79bfd2c7 FOREIGN KEY (especificacion_servicio_terreno_servicio_terreno_id) REFERENCES terreno.servicio_terreno(servicio_terreno_servicio_terreno_id),
    CONSTRAINT fk_especificacion_servicio_terreno_especificacion_s_ca0b84a5 FOREIGN KEY (especificacion_servicio_terreno_especificacion_puerta_id) REFERENCES terreno.especificaciones_puerta(especificacion_puerta_especificacion_puerta_id)
);

CREATE TABLE terreno.notificacion_tecnico (
    notificacion_tecnico_id_notificacion_tecnico BIGINT GENERATED ALWAYS AS IDENTITY,
    notificacion_tecnico_fecha_emision TIMESTAMPTZ,
    notificacion_tecnico_mensaje TEXT,
    usuario_id_usuario BIGINT,
    servicio_terreno_id_servicio_terreno BIGINT,
    CONSTRAINT pk_notificacion_tecnico PRIMARY KEY (notificacion_tecnico_id_notificacion_tecnico),
    CONSTRAINT fk_notificacion_tecnico_usuario_id_usuario FOREIGN KEY (usuario_id_usuario) REFERENCES terreno.usuario(usuario_id_usuario),
    CONSTRAINT fk_notificacion_tecnico_servicio_terreno_id_servicio_terreno FOREIGN KEY (servicio_terreno_id_servicio_terreno) REFERENCES terreno.servicio_terreno(servicio_terreno_servicio_terreno_id)
);

CREATE TABLE terreno.servicio_tterreno_herramientas_materiales (
    id_servicio_terreno_herr_material BIGINT NOT NULL,
    servicio_terreno_herramientas_materiales_servicio_terreno_id BIGINT NOT NULL,
    CONSTRAINT pk_servicio_tterreno_herramientas_materiales PRIMARY KEY (id_servicio_terreno_herr_material, servicio_terreno_herramientas_materiales_servicio_terreno_id),
    CONSTRAINT fk_servicio_tterreno_herramientas_materiales_servic_58285965 FOREIGN KEY (servicio_terreno_herramientas_materiales_servicio_terreno_id) REFERENCES terreno.servicio_terreno(servicio_terreno_servicio_terreno_id)
);

CREATE TABLE terreno.tarea (
    tarea_tarea_id BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    tarea_descripcion TEXT,
    tarea_fecha_de_visita DATE,
    tarea_fecha_de_termino DATE,
    tarea_bloque_horario TIMESTAMPTZ,
    tarea_fecha_de_creacion DATE,
    tarea_fecha_de_ultima_actualizacion DATE,
    tarea_fecha_de_inicio DATE,
    tarea_fecha_de_inicio_en_terreno DATE,
    tarea_titulo TEXT,
    tarea_horario_limite TIMESTAMPTZ,
    tarea_instrucciones_de_oficina TEXT,
    tarea_urgencia TEXT,
    tarea_estado_de_tarea TEXT,
    id_usuario BIGINT,
    id_servicio_terreno BIGINT,
    id_especificacion_puerta BIGINT,
    CONSTRAINT pk_tarea PRIMARY KEY (tarea_tarea_id),
    CONSTRAINT fk_tarea_id_usuario FOREIGN KEY (id_usuario) REFERENCES terreno.usuario(usuario_id_usuario),
    CONSTRAINT fk_tarea_id_servicio_terreno FOREIGN KEY (id_servicio_terreno) REFERENCES terreno.servicio_terreno(servicio_terreno_servicio_terreno_id),
    CONSTRAINT fk_tarea_id_especificacion_puerta FOREIGN KEY (id_especificacion_puerta) REFERENCES terreno.especificaciones_puerta(especificacion_puerta_especificacion_puerta_id)
);

CREATE TABLE terreno.formulario_de_cierre (
    formulario_de_cierre_formulario_de_cierre_id BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    formulario_de_cierre_detalle_de_observaciones TEXT,
    formulario_de_cierre_sentido_de_apertura_correcto BOOLEAN,
    formulario_de_cierre_pilastras_incluidas_y_ajustadas BOOLEAN,
    formulario_de_cierre_resultado_finalizado TEXT,
    formulario_de_cierre_cilindro_correcto BOOLEAN,
    formulario_de_cierre_ausencia_de_rayones_o_danos BOOLEAN,
    id_tarea BIGINT,
    CONSTRAINT pk_formulario_de_cierre PRIMARY KEY (formulario_de_cierre_formulario_de_cierre_id),
    CONSTRAINT fk_formulario_de_cierre_id_tarea FOREIGN KEY (id_tarea) REFERENCES terreno.tarea(tarea_tarea_id)
);

CREATE TABLE terreno.evidencia_terreno (
    evidencia_terreno_evidencia_terreno_id BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    evidencia_terreno_tipo_evidencia TEXT,
    evidencia_terreno_fecha_captura DATE,
    evidencia_terreno_imagen_o_vector BYTEA,
    evidencia_terreno_metadata_dispositivo TEXT,
    evidencia_terreno_estado_temporal TEXT,
    evidencia_terreno_estado_evidencia TEXT,
    evidencia_terreno_observacion TEXT,
    id_formulario_de_cierre BIGINT,
    id_servicio_terreno BIGINT,
    CONSTRAINT pk_evidencia_terreno PRIMARY KEY (evidencia_terreno_evidencia_terreno_id),
    CONSTRAINT fk_evidencia_terreno_id_formulario_de_cierre FOREIGN KEY (id_formulario_de_cierre) REFERENCES terreno.formulario_de_cierre(formulario_de_cierre_formulario_de_cierre_id),
    CONSTRAINT fk_evidencia_terreno_id_servicio_terreno FOREIGN KEY (id_servicio_terreno) REFERENCES terreno.servicio_terreno(servicio_terreno_servicio_terreno_id)
);

CREATE TABLE terreno.notificacion_terreno (
    notificacion_terreno_id_notificacion_terreno BIGINT GENERATED ALWAYS AS IDENTITY,
    notificacion_terreno_mensaje TEXT,
    usuario_id_usuario BIGINT,
    tarea_id_tarea BIGINT,
    CONSTRAINT pk_notificacion_terreno PRIMARY KEY (notificacion_terreno_id_notificacion_terreno),
    CONSTRAINT fk_notificacion_terreno_usuario_id_usuario FOREIGN KEY (usuario_id_usuario) REFERENCES terreno.usuario(usuario_id_usuario),
    CONSTRAINT fk_notificacion_terreno_tarea_id_tarea FOREIGN KEY (tarea_id_tarea) REFERENCES terreno.tarea(tarea_tarea_id)
);

CREATE TABLE terreno.receptor (
    receptor_receptor_id BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    receptor_primer_nombre_receptor TEXT,
    receptor_segundo_nombre_receptor TEXT,
    receptor_primer_apellido_receptor TEXT,
    receptor_segundo_apellido_receptor TEXT,
    receptor_rut_receptor TEXT,
    id_tarea BIGINT,
    CONSTRAINT pk_receptor PRIMARY KEY (receptor_receptor_id),
    CONSTRAINT fk_receptor_id_tarea FOREIGN KEY (id_tarea) REFERENCES terreno.tarea(tarea_tarea_id)
);

CREATE TABLE terreno.tarea_tipo (
    tarea_tipo_tarea_tipo_id BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    tarea_tipo_tiempo_estimado_tarea TIME,
    tarea_tipo_remuneracion_tarea INTEGER,
    id_tarea BIGINT,
    CONSTRAINT pk_tarea_tipo PRIMARY KEY (tarea_tipo_tarea_tipo_id),
    CONSTRAINT fk_tarea_tipo_id_tarea FOREIGN KEY (id_tarea) REFERENCES terreno.tarea(tarea_tarea_id)
);

CREATE TABLE terreno.usuario_contrasena (
    usuario_id_usuario BIGINT NOT NULL,
    usuario_contrasena TEXT NOT NULL,
    CONSTRAINT pk_usuario_contrasena PRIMARY KEY (usuario_id_usuario, usuario_contrasena),
    CONSTRAINT fk_usuario_contrasena_usuario_id_usuario FOREIGN KEY (usuario_id_usuario) REFERENCES terreno.usuario(usuario_id_usuario)
);


-- ============================================================
-- TABLAS INVENTARIO
-- ============================================================

CREATE TABLE inventario.alerta_faltante_pedido (
    alerta_faltante_pedido_id_alerta_faltante BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    alerta_faltante_pedido_fecha_generacion TIMESTAMPTZ,
    alerta_faltante_pedido_cantidad_disponible NUMERIC(12,4),
    alerta_faltante_pedido_cantidad_requerida NUMERIC(12,4),
    alerta_faltante_pedido_horas_anticipacion INTEGER,
    alerta_faltante_pedido_estado VARCHAR(50),
    material_sku VARCHAR(16),
    proveedor_id_proveedor BIGINT,
    usuario_id_usuario BIGINT,
    proyecto_id_proyecto BIGINT,
    CONSTRAINT pk_alerta_faltante_pedido PRIMARY KEY (alerta_faltante_pedido_id_alerta_faltante),
    CONSTRAINT fk_alerta_faltante_pedido_material_sku FOREIGN KEY (material_sku) REFERENCES inventario.material(material_sku),
    CONSTRAINT fk_alerta_faltante_pedido_proveedor_id_proveedor FOREIGN KEY (proveedor_id_proveedor) REFERENCES finanzas.proveedor(id_proveedor),
    CONSTRAINT fk_alerta_faltante_pedido_usuario_id_usuario FOREIGN KEY (usuario_id_usuario) REFERENCES terreno.usuario(usuario_id_usuario),
    CONSTRAINT fk_alerta_faltante_pedido_proyecto_id_proyecto FOREIGN KEY (proyecto_id_proyecto) REFERENCES terreno.proyecto(proyecto_proyecto_id)
);

CREATE TABLE inventario.movimiento_inventario (
    movimiento_inventario_id_movimiento BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    movimiento_inventario_fecha_hora TIMESTAMPTZ,
    movimiento_inventario_cantidad NUMERIC(12,4),
    movimiento_inventario_estado VARCHAR(50),
    material_sku VARCHAR(16),
    bodega_id_bodega BIGINT,
    lote_id_lote BIGINT,
    proyecto_id_proyecto BIGINT,
    factura_compra_id_factura_compra BIGINT,
    usuario_id_usuario BIGINT,
    movimiento_inventario_tipo_movimiento_id_tipo_movimiento BIGINT,
    movimiento_inventario_motivo_movimiento_id_motivo_movimiento BIGINT,
    CONSTRAINT pk_movimiento_inventario PRIMARY KEY (movimiento_inventario_id_movimiento),
    CONSTRAINT fk_movimiento_inventario_material_sku FOREIGN KEY (material_sku) REFERENCES inventario.material(material_sku),
    CONSTRAINT fk_movimiento_inventario_bodega_id_bodega FOREIGN KEY (bodega_id_bodega) REFERENCES inventario.bodega(bodega_id_bodega),
    CONSTRAINT fk_movimiento_inventario_lote_id_lote FOREIGN KEY (lote_id_lote) REFERENCES inventario.lote(lote_id_lote),
    CONSTRAINT fk_movimiento_inventario_proyecto_id_proyecto FOREIGN KEY (proyecto_id_proyecto) REFERENCES terreno.proyecto(proyecto_proyecto_id),
    CONSTRAINT fk_movimiento_inventario_factura_compra_id_factura_compra FOREIGN KEY (factura_compra_id_factura_compra) REFERENCES inventario.factura_compra(factura_compra_id_factura),
    CONSTRAINT fk_movimiento_inventario_usuario_id_usuario FOREIGN KEY (usuario_id_usuario) REFERENCES terreno.usuario(usuario_id_usuario),
    CONSTRAINT fk_movimiento_inventario_movimiento_inventario_tipo_491f04a7 FOREIGN KEY (movimiento_inventario_tipo_movimiento_id_tipo_movimiento) REFERENCES inventario.movimiento_inventario_tipo_movimiento(movimiento_inventario_tipo_movimiento_id_tipo_movimiento),
    CONSTRAINT fk_movimiento_inventario_movimiento_inventario_moti_5114c33e FOREIGN KEY (movimiento_inventario_motivo_movimiento_id_motivo_movimiento) REFERENCES inventario.movimiento_inventario_motivo_movimiento(movimiento_inventario_motivo_movimiento_id_motivo_movimiento)
);

CREATE TABLE inventario.notificacion (
    notificacion_id_notificacion BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    notificacion_tipo_notificacion VARCHAR(150),
    notificacion_mensaje TEXT,
    notificacion_fecha_generacion TIMESTAMPTZ,
    notificacion_estado_lectura VARCHAR(50),
    notificacion_origen VARCHAR(150),
    alerta_inventario_id_alerta BIGINT,
    usuario_id_usuario BIGINT,
    CONSTRAINT pk_notificacion PRIMARY KEY (notificacion_id_notificacion),
    CONSTRAINT fk_notificacion_alerta_inventario_id_alerta FOREIGN KEY (alerta_inventario_id_alerta) REFERENCES inventario.alerta_inventario(alerta_inventario_id_alerta),
    CONSTRAINT fk_notificacion_usuario_id_usuario FOREIGN KEY (usuario_id_usuario) REFERENCES terreno.usuario(usuario_id_usuario)
);

CREATE TABLE inventario.orden_trabajo (
    orden_trabajo_id_orden BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    orden_trabajo_fecha_hora TIMESTAMPTZ,
    orden_trabajo_estado VARCHAR(50),
    especificaciones_puerta_id_especificacion_puerta BIGINT,
    proyecto_id_proyecto BIGINT,
    area_trabajo_id_area BIGINT,
    usuario_id_usuario BIGINT,
    CONSTRAINT pk_orden_trabajo PRIMARY KEY (orden_trabajo_id_orden),
    CONSTRAINT fk_orden_trabajo_especificaciones_puerta_id_especif_6a769728 FOREIGN KEY (especificaciones_puerta_id_especificacion_puerta) REFERENCES terreno.especificaciones_puerta(especificacion_puerta_especificacion_puerta_id),
    CONSTRAINT fk_orden_trabajo_proyecto_id_proyecto FOREIGN KEY (proyecto_id_proyecto) REFERENCES terreno.proyecto(proyecto_proyecto_id),
    CONSTRAINT fk_orden_trabajo_area_trabajo_id_area FOREIGN KEY (area_trabajo_id_area) REFERENCES terreno.area_trabajo(area_trabajo_id_area),
    CONSTRAINT fk_orden_trabajo_usuario_id_usuario FOREIGN KEY (usuario_id_usuario) REFERENCES terreno.usuario(usuario_id_usuario)
);

CREATE TABLE inventario.material_orden_trabajo (
    material_sku VARCHAR(16) NOT NULL,
    orden_trabajo_id_orden BIGINT NOT NULL,
    material_orden_trabajo_consumo_estimado NUMERIC(12,4),
    material_orden_trabajo_consumo_real NUMERIC(12,4),
    CONSTRAINT pk_material_orden_trabajo PRIMARY KEY (material_sku, orden_trabajo_id_orden),
    CONSTRAINT fk_material_orden_trabajo_material_sku FOREIGN KEY (material_sku) REFERENCES inventario.material(material_sku),
    CONSTRAINT fk_material_orden_trabajo_orden_trabajo_id_orden FOREIGN KEY (orden_trabajo_id_orden) REFERENCES inventario.orden_trabajo(orden_trabajo_id_orden)
);

CREATE TABLE inventario.reporte (
    reporte_id_reporte BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    reporte_periodo_fin DATE,
    reporte_fecha_generacion TIMESTAMPTZ,
    reporte_formato_exportacion VARCHAR(50),
    reporte_estado VARCHAR(50),
    reporte_tipo_reporte VARCHAR(50),
    reporte_periodo_inicio DATE,
    usuario_id_usuario BIGINT,
    CONSTRAINT pk_reporte PRIMARY KEY (reporte_id_reporte),
    CONSTRAINT fk_reporte_usuario_id_usuario FOREIGN KEY (usuario_id_usuario) REFERENCES terreno.usuario(usuario_id_usuario)
);

CREATE TABLE inventario.reporte_movimiento_inventario (
    movimiento_inventario_id_movimiento BIGINT NOT NULL,
    reporte_id_reporte BIGINT NOT NULL,
    CONSTRAINT pk_reporte_movimiento_inventario PRIMARY KEY (movimiento_inventario_id_movimiento, reporte_id_reporte),
    CONSTRAINT fk_reporte_movimiento_inventario_movimiento_inventa_c5801b43 FOREIGN KEY (movimiento_inventario_id_movimiento) REFERENCES inventario.movimiento_inventario(movimiento_inventario_id_movimiento),
    CONSTRAINT fk_reporte_movimiento_inventario_reporte_id_reporte FOREIGN KEY (reporte_id_reporte) REFERENCES inventario.reporte(reporte_id_reporte)
);

CREATE TABLE inventario.reserva_inventario (
    reserva_inventario_id_reserva BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    reserva_inventario_cantidad_reservada NUMERIC(12,4),
    reserva_inventario_fecha_reserva TIMESTAMPTZ,
    reserva_inventario_fecha_liberacion TIMESTAMPTZ,
    reserva_inventario_estado_reserva VARCHAR(50),
    material_sku VARCHAR(16),
    proyecto_id_proyecto BIGINT,
    orden_trabajo_id_orden BIGINT,
    CONSTRAINT pk_reserva_inventario PRIMARY KEY (reserva_inventario_id_reserva),
    CONSTRAINT fk_reserva_inventario_material_sku FOREIGN KEY (material_sku) REFERENCES inventario.material(material_sku),
    CONSTRAINT fk_reserva_inventario_proyecto_id_proyecto FOREIGN KEY (proyecto_id_proyecto) REFERENCES terreno.proyecto(proyecto_proyecto_id),
    CONSTRAINT fk_reserva_inventario_orden_trabajo_id_orden FOREIGN KEY (orden_trabajo_id_orden) REFERENCES inventario.orden_trabajo(orden_trabajo_id_orden)
);

CREATE TABLE inventario.preparacion_pedido (
    preparacion_pedido_id_preparacion BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    preparacion_pedido_observacion TEXT,
    reserva_inventario_id_reserva BIGINT,
    usuario_id_usuario BIGINT,
    CONSTRAINT pk_preparacion_pedido PRIMARY KEY (preparacion_pedido_id_preparacion),
    CONSTRAINT fk_preparacion_pedido_reserva_inventario_id_reserva FOREIGN KEY (reserva_inventario_id_reserva) REFERENCES inventario.reserva_inventario(reserva_inventario_id_reserva),
    CONSTRAINT fk_preparacion_pedido_usuario_id_usuario FOREIGN KEY (usuario_id_usuario) REFERENCES terreno.usuario(usuario_id_usuario)
);

CREATE TABLE inventario.preparacion_pedido_estado (
    preparacion_pedido_estado_id_estado_preparacion BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    pedido_preparacion_estado_nombre_estado VARCHAR(100),
    pedido_preparacion_estado_timestamp_accion TIMESTAMPTZ,
    preparacion_pedido_id_preparacion BIGINT,
    CONSTRAINT pk_preparacion_pedido_estado PRIMARY KEY (preparacion_pedido_estado_id_estado_preparacion),
    CONSTRAINT fk_preparacion_pedido_estado_preparacion_pedido_id__ee3b6a24 FOREIGN KEY (preparacion_pedido_id_preparacion) REFERENCES inventario.preparacion_pedido(preparacion_pedido_id_preparacion)
);


-- ============================================================
-- TABLAS FINANZAS CORE 50
-- ============================================================

CREATE TABLE finanzas.evento_auditoria (
    id_evento_auditoria integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_usuario integer NOT NULL,
    fecha_evento timestamp NOT NULL DEFAULT current_timestamp,
    tipo_evento varchar(80) NOT NULL,
    entidad_afectada varchar(80) NOT NULL,
    id_registro_afectado integer NOT NULL,
    accion_realizada varchar(100) NOT NULL,
    descripcion_evento text,
    resultado_evento varchar(30) NOT NULL DEFAULT 'registrado',
    observacion text,
    CONSTRAINT chk_evento_auditoria_resultado CHECK (resultado_evento IN ('registrado', 'aprobado', 'rechazado', 'fallido', 'anulado')),
    CONSTRAINT fk_evento_aud_usuario_ext FOREIGN KEY (id_usuario)
            REFERENCES terreno.usuario (usuario_id_usuario) ON DELETE RESTRICT
);

CREATE TABLE finanzas.detalle_evento_auditoria (
    id_detalle_evento_auditoria integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_evento_auditoria integer NOT NULL,
    atributo_modificado varchar(100) NOT NULL,
    valor_anterior text,
    valor_nuevo text,
    observacion text,
    CONSTRAINT fk_detalle_evento_auditoria_evento FOREIGN KEY (id_evento_auditoria)
        REFERENCES evento_auditoria (id_evento_auditoria) ON DELETE RESTRICT
);

CREATE TABLE finanzas.liquidacion_remuneracion (
    id_liquidacion_remuneracion integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    rut_empleado varchar(15) NOT NULL,
    periodo_liquidacion varchar(7) NOT NULL,
    fecha_generacion date NOT NULL,
    fecha_aprobacion date,
    sueldo_base_periodo numeric(14,2) NOT NULL,
    total_bonos numeric(14,2) NOT NULL DEFAULT 0,
    total_descuentos numeric(14,2) NOT NULL DEFAULT 0,
    total_haberes numeric(14,2) NOT NULL DEFAULT 0,
    total_liquido numeric(14,2) NOT NULL DEFAULT 0,
    estado_liquidacion varchar(30) NOT NULL DEFAULT 'generada',
    respaldo_liquidacion text,
    observacion text,
    CONSTRAINT fk_liquidacion_remuneracion_empleado FOREIGN KEY (rut_empleado)
        REFERENCES empleado (rut_empleado) ON DELETE RESTRICT,
    CONSTRAINT uq_liquidacion_remuneracion_periodo UNIQUE (rut_empleado, periodo_liquidacion),
    CONSTRAINT chk_liquidacion_remuneracion_montos CHECK (
        sueldo_base_periodo >= 0 AND total_bonos >= 0 AND total_descuentos >= 0 AND total_haberes >= 0 AND total_liquido >= 0
    ),
    CONSTRAINT chk_liquidacion_remuneracion_estado CHECK (estado_liquidacion IN ('generada', 'aprobada', 'pagada', 'anulada')),
    CONSTRAINT chk_liquidacion_remuneracion_periodo CHECK (periodo_liquidacion ~ '^[0-9]{4}-[0-9]{2}$')
);

CREATE TABLE finanzas.detalle_liquidacion_remuneracion (
    id_detalle_liquidacion_remuneracion integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_liquidacion_remuneracion integer NOT NULL,
    id_concepto_remuneracion integer NOT NULL,
    monto_concepto numeric(14,2) NOT NULL,
    observacion text,
    CONSTRAINT fk_detalle_liquidacion_liquidacion FOREIGN KEY (id_liquidacion_remuneracion)
        REFERENCES liquidacion_remuneracion (id_liquidacion_remuneracion) ON DELETE RESTRICT,
    CONSTRAINT fk_detalle_liquidacion_concepto FOREIGN KEY (id_concepto_remuneracion)
        REFERENCES concepto_remuneracion (id_concepto_remuneracion) ON DELETE RESTRICT,
    CONSTRAINT chk_detalle_liquidacion_monto CHECK (monto_concepto >= 0)
);

CREATE TABLE finanzas.tarea_remunerable (
    id_tarea_remunerable integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    rut_empleado varchar(15) NOT NULL,
    id_historial_tarifa_tarea integer NOT NULL,
    id_proyecto_financiero integer,
    id_liquidacion_remuneracion integer,
    id_orden_trabajo integer,
    fecha_tarea date NOT NULL,
    cantidad_realizada numeric(12,2) NOT NULL,
    estado_validacion varchar(30) NOT NULL DEFAULT 'pendiente',
    monto_calculado numeric(14,2) NOT NULL DEFAULT 0,
    referencia_unidad_terminada varchar(100),
    observacion text,
    CONSTRAINT fk_tarea_remunerable_empleado FOREIGN KEY (rut_empleado)
        REFERENCES empleado (rut_empleado) ON DELETE RESTRICT,
    CONSTRAINT fk_tarea_remunerable_tarifa FOREIGN KEY (id_historial_tarifa_tarea)
        REFERENCES historial_tarifa_tarea (id_historial_tarifa_tarea) ON DELETE RESTRICT,
    CONSTRAINT fk_tarea_remunerable_proyecto FOREIGN KEY (id_proyecto_financiero)
        REFERENCES proyecto_financiero (id_proyecto_financiero) ON DELETE RESTRICT,
    CONSTRAINT fk_tarea_remunerable_liquidacion FOREIGN KEY (id_liquidacion_remuneracion)
        REFERENCES liquidacion_remuneracion (id_liquidacion_remuneracion) ON DELETE RESTRICT,
    CONSTRAINT chk_tarea_remunerable_cantidad CHECK (cantidad_realizada > 0),
    CONSTRAINT chk_tarea_remunerable_monto CHECK (monto_calculado >= 0),
    CONSTRAINT chk_tarea_remunerable_estado CHECK (estado_validacion IN ('pendiente', 'validada', 'rechazada', 'anulada')),
    CONSTRAINT fk_tarea_rem_orden_ext FOREIGN KEY (id_orden_trabajo)
            REFERENCES inventario.orden_trabajo (orden_trabajo_id_orden) ON DELETE RESTRICT
);

-- ============================================================
-- COMENTARIOS, ÍNDICES Y VISTAS FINANCIERAS
-- ============================================================

COMMENT ON COLUMN finanzas.cliente_financiero.rut_cliente IS 'FK física hacia terreno.cliente(cliente_cliente_rut). Finanzas conserva solo la representación financiera del cliente.';

COMMENT ON COLUMN finanzas.historial_precio_material.material_sku IS 'FK física hacia inventario.material(material_sku). Finanzas consulta el material para precio/costo, no administra stock.';

COMMENT ON COLUMN finanzas.detalle_cotizacion.id_item_comercial IS 'FK física hacia terreno.item_comercial(id_item_comercial). Tabla externa mínima de compatibilidad para cotización.';

COMMENT ON COLUMN finanzas.proyecto_financiero.id_proyecto_terreno IS 'FK física hacia terreno.proyecto(proyecto_proyecto_id). Finanzas registra el seguimiento financiero del proyecto.';

COMMENT ON COLUMN finanzas.tarea_remunerable.id_orden_trabajo IS 'FK física hacia inventario.orden_trabajo(orden_trabajo_id_orden). Finanzas la usa solo para remuneración/tarea validada.';

COMMENT ON COLUMN finanzas.evento_auditoria.id_usuario IS 'FK física hacia terreno.usuario(usuario_id_usuario). Uso acotado para auditoría mientras no exista schema transversal de seguridad.';

CREATE INDEX idx_cliente_financiero_tipo ON finanzas.cliente_financiero(id_tipo_cliente_financiero);

CREATE INDEX idx_ficha_cliente_cliente ON finanzas.ficha_cliente(id_cliente_financiero);

CREATE INDEX idx_proveedor_identificador ON finanzas.proveedor(id_tipo_identificador, identificador_tributario);

CREATE INDEX idx_historial_precio_material_sku ON finanzas.historial_precio_material(material_sku);

CREATE INDEX idx_historial_precio_material_proveedor ON finanzas.historial_precio_material(id_proveedor);

CREATE INDEX idx_cotizacion_ficha ON finanzas.cotizacion(id_ficha_cliente);

CREATE INDEX idx_detalle_cotizacion_cotizacion ON finanzas.detalle_cotizacion(id_cotizacion);

CREATE INDEX idx_detalle_cotizacion_item ON finanzas.detalle_cotizacion(id_item_comercial);

CREATE INDEX idx_detalle_costo_material_detalle ON finanzas.detalle_costo_material_cotizacion(id_detalle_cotizacion);

CREATE INDEX idx_nota_venta_ficha ON finanzas.nota_venta(id_ficha_cliente);

CREATE INDEX idx_documento_tributario_ficha ON finanzas.documento_tributario(id_ficha_cliente);

CREATE INDEX idx_documento_tributario_nota ON finanzas.documento_tributario(id_nota_venta);

CREATE INDEX idx_proyecto_financiero_ficha ON finanzas.proyecto_financiero(id_ficha_cliente);

CREATE INDEX idx_proyecto_financiero_terreno ON finanzas.proyecto_financiero(id_proyecto_terreno);

CREATE INDEX idx_hito_cobro_nota ON finanzas.hito_cobro(id_nota_venta);

CREATE INDEX idx_pago_cliente_ficha ON finanzas.pago_cliente(id_ficha_cliente);

CREATE INDEX idx_asignacion_pago_cliente_pago ON finanzas.asignacion_pago_cliente(id_pago_cliente);

CREATE INDEX idx_costo_proyecto_proyecto ON finanzas.costo_proyecto(id_proyecto_financiero);

CREATE INDEX idx_documento_compra_proveedor_proveedor ON finanzas.documento_compra_proveedor(id_proveedor);

CREATE INDEX idx_detalle_doc_compra_documento ON finanzas.detalle_documento_compra_proveedor(id_documento_compra_proveedor);

CREATE INDEX idx_pago_proveedor_proveedor ON finanzas.pago_proveedor(id_proveedor);

CREATE INDEX idx_asignacion_pago_proveedor_pago ON finanzas.asignacion_pago_proveedor(id_pago_proveedor);

CREATE INDEX idx_movimiento_financiero_fecha ON finanzas.movimiento_financiero(fecha_movimiento);

CREATE INDEX idx_origen_movimiento_financiero_movimiento ON finanzas.origen_movimiento_financiero(id_movimiento_financiero);

CREATE INDEX idx_movimiento_bancario_fecha ON finanzas.movimiento_bancario(fecha_movimiento_bancario);

CREATE INDEX idx_conciliacion_movimientos ON finanzas.conciliacion(id_movimiento_financiero, id_movimiento_bancario);

CREATE INDEX idx_evaluacion_credito_ficha ON finanzas.evaluacion_credito(id_ficha_cliente);

CREATE INDEX idx_limite_credito_ficha ON finanzas.limite_credito_cliente(id_ficha_cliente);

CREATE INDEX idx_credito_proyecto_ficha ON finanzas.credito_proyecto(id_ficha_cliente);

CREATE INDEX idx_empleado_cargo ON finanzas.empleado(id_cargo);

CREATE INDEX idx_historial_tarifa_tarea_tarea ON finanzas.historial_tarifa_tarea(id_tarea_catalogada);

CREATE INDEX idx_liquidacion_empleado_periodo ON finanzas.liquidacion_remuneracion(rut_empleado, periodo_liquidacion);

CREATE INDEX idx_tarea_remunerable_empleado ON finanzas.tarea_remunerable(rut_empleado);

CREATE INDEX idx_tarea_remunerable_orden ON finanzas.tarea_remunerable(id_orden_trabajo);

CREATE INDEX idx_origen_alerta_alerta ON finanzas.origen_alerta_financiera(id_alerta_financiera);

CREATE INDEX idx_evento_auditoria_usuario ON finanzas.evento_auditoria(id_usuario);

CREATE INDEX idx_evento_auditoria_entidad ON finanzas.evento_auditoria(entidad_afectada, id_registro_afectado);

CREATE OR REPLACE VIEW finanzas.v_ficha_cliente_resumen AS
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
    COALESCE(nv.cantidad_notas_venta, 0) AS cantidad_notas_venta,
    COALESCE(nv.total_notas_venta, 0) AS total_notas_venta,
    COALESCE(dt.cantidad_documentos, 0) AS cantidad_documentos_tributarios,
    COALESCE(dt.total_documentos, 0) AS total_documentos_tributarios,
    COALESCE(pc.cantidad_pagos_cliente, 0) AS cantidad_pagos_cliente,
    COALESCE(pc.total_pagado_cliente, 0) AS total_pagado_cliente,
    COALESCE(pf.cantidad_proyectos_financieros, 0) AS cantidad_proyectos_financieros,
    COALESCE(pf.total_costo_real, 0) AS total_costo_real_proyectos,
    COALESCE(ec.cantidad_evaluaciones_credito, 0) AS cantidad_evaluaciones_credito,
    lc.monto_limite AS limite_credito_vigente,
    lc.estado_limite AS estado_limite_credito,
    COALESCE(cp.cantidad_creditos, 0) AS cantidad_creditos_proyecto,
    COALESCE(cp.total_creditos, 0) AS total_creditos_proyecto,
    COALESCE(al.cantidad_alertas, 0) AS cantidad_alertas_financieras
FROM finanzas.ficha_cliente fc
JOIN finanzas.cliente_financiero cf
    ON cf.id_cliente_financiero = fc.id_cliente_financiero
LEFT JOIN finanzas.tipo_cliente_financiero tcf
    ON tcf.id_tipo_cliente_financiero = cf.id_tipo_cliente_financiero
LEFT JOIN (
    SELECT id_ficha_cliente, COUNT(*) AS cantidad_notas_venta, SUM(monto_total) AS total_notas_venta
    FROM finanzas.nota_venta
    WHERE estado_nota_venta <> 'anulada'
    GROUP BY id_ficha_cliente
) nv ON nv.id_ficha_cliente = fc.id_ficha_cliente
LEFT JOIN (
    SELECT id_ficha_cliente, COUNT(*) AS cantidad_documentos, SUM(monto_total) AS total_documentos
    FROM finanzas.documento_tributario
    WHERE estado_documento <> 'anulado'
    GROUP BY id_ficha_cliente
) dt ON dt.id_ficha_cliente = fc.id_ficha_cliente
LEFT JOIN (
    SELECT id_ficha_cliente, COUNT(*) AS cantidad_pagos_cliente, SUM(monto_pago) AS total_pagado_cliente
    FROM finanzas.pago_cliente
    WHERE estado_verificacion <> 'anulado'
    GROUP BY id_ficha_cliente
) pc ON pc.id_ficha_cliente = fc.id_ficha_cliente
LEFT JOIN (
    SELECT id_ficha_cliente, COUNT(*) AS cantidad_proyectos_financieros, SUM(COALESCE(monto_costo_real, 0)) AS total_costo_real
    FROM finanzas.proyecto_financiero
    WHERE estado_financiero_proyecto <> 'anulado'
    GROUP BY id_ficha_cliente
) pf ON pf.id_ficha_cliente = fc.id_ficha_cliente
LEFT JOIN (
    SELECT id_ficha_cliente, COUNT(*) AS cantidad_evaluaciones_credito
    FROM finanzas.evaluacion_credito
    WHERE estado_evaluacion <> 'anulada'
    GROUP BY id_ficha_cliente
) ec ON ec.id_ficha_cliente = fc.id_ficha_cliente
LEFT JOIN LATERAL (
    SELECT monto_limite, estado_limite
    FROM finanzas.limite_credito_cliente lcx
    WHERE lcx.id_ficha_cliente = fc.id_ficha_cliente
      AND lcx.estado_limite = 'vigente'
    ORDER BY lcx.fecha_inicio_vigencia DESC, lcx.id_limite_credito_cliente DESC
    LIMIT 1
) lc ON TRUE
LEFT JOIN (
    SELECT id_ficha_cliente, COUNT(*) AS cantidad_creditos, SUM(monto_credito) AS total_creditos
    FROM finanzas.credito_proyecto
    WHERE estado_credito <> 'anulado'
    GROUP BY id_ficha_cliente
) cp ON cp.id_ficha_cliente = fc.id_ficha_cliente
LEFT JOIN (
    SELECT oa.id_registro_origen AS id_ficha_cliente, COUNT(*) AS cantidad_alertas
    FROM finanzas.origen_alerta_financiera oa
    JOIN finanzas.alerta_financiera af
        ON af.id_alerta_financiera = oa.id_alerta_financiera
    WHERE oa.entidad_origen = 'ficha_cliente'
      AND af.estado_alerta <> 'anulada'
    GROUP BY oa.id_registro_origen
) al ON al.id_ficha_cliente = fc.id_ficha_cliente;

CREATE OR REPLACE VIEW finanzas.v_ficha_cliente_movimientos AS
SELECT
    fc.id_ficha_cliente,
    cf.id_cliente_financiero,
    cf.rut_cliente,
    'nota_venta'::text AS tipo_origen,
    nv.id_nota_venta AS id_origen,
    nv.fecha_emision::timestamp AS fecha_movimiento,
    nv.estado_nota_venta AS estado,
    nv.monto_total AS monto,
    nv.observacion AS descripcion
FROM finanzas.ficha_cliente fc
JOIN finanzas.cliente_financiero cf ON cf.id_cliente_financiero = fc.id_cliente_financiero
JOIN finanzas.nota_venta nv ON nv.id_ficha_cliente = fc.id_ficha_cliente
UNION ALL
SELECT
    fc.id_ficha_cliente,
    cf.id_cliente_financiero,
    cf.rut_cliente,
    'documento_tributario'::text,
    dt.id_documento_tributario,
    dt.fecha_emision::timestamp,
    dt.estado_documento,
    dt.monto_total,
    dt.observacion
FROM finanzas.ficha_cliente fc
JOIN finanzas.cliente_financiero cf ON cf.id_cliente_financiero = fc.id_cliente_financiero
JOIN finanzas.documento_tributario dt ON dt.id_ficha_cliente = fc.id_ficha_cliente
UNION ALL
SELECT
    fc.id_ficha_cliente,
    cf.id_cliente_financiero,
    cf.rut_cliente,
    'pago_cliente'::text,
    pc.id_pago_cliente,
    pc.fecha_pago::timestamp,
    pc.estado_verificacion,
    pc.monto_pago,
    pc.observacion
FROM finanzas.ficha_cliente fc
JOIN finanzas.cliente_financiero cf ON cf.id_cliente_financiero = fc.id_cliente_financiero
JOIN finanzas.pago_cliente pc ON pc.id_ficha_cliente = fc.id_ficha_cliente
UNION ALL
SELECT
    fc.id_ficha_cliente,
    cf.id_cliente_financiero,
    cf.rut_cliente,
    'proyecto_financiero'::text,
    pf.id_proyecto_financiero,
    pf.fecha_inicio_financiera::timestamp,
    pf.estado_financiero_proyecto,
    COALESCE(pf.monto_venta_estimado, 0),
    pf.observacion_financiera
FROM finanzas.ficha_cliente fc
JOIN finanzas.cliente_financiero cf ON cf.id_cliente_financiero = fc.id_cliente_financiero
JOIN finanzas.proyecto_financiero pf ON pf.id_ficha_cliente = fc.id_ficha_cliente
UNION ALL
SELECT
    fc.id_ficha_cliente,
    cf.id_cliente_financiero,
    cf.rut_cliente,
    'evaluacion_credito'::text,
    ec.id_evaluacion_credito,
    ec.fecha_evaluacion::timestamp,
    ec.estado_evaluacion,
    ec.puntaje_riesgo,
    ec.resultado_evaluacion
FROM finanzas.ficha_cliente fc
JOIN finanzas.cliente_financiero cf ON cf.id_cliente_financiero = fc.id_cliente_financiero
JOIN finanzas.evaluacion_credito ec ON ec.id_ficha_cliente = fc.id_ficha_cliente;

-- ============================================================
-- CONSULTAS ÚTILES DE VERIFICACIÓN
-- ============================================================
-- Cantidad de tablas por schema:
-- SELECT table_schema, COUNT(*)
-- FROM information_schema.tables
-- WHERE table_schema IN ('finanzas','inventario','terreno') AND table_type='BASE TABLE'
-- GROUP BY table_schema
-- ORDER BY table_schema;
--
-- FK declaradas:
-- SELECT conrelid::regclass AS tabla_origen, conname AS fk, confrelid::regclass AS tabla_destino
-- FROM pg_constraint
-- WHERE contype='f'
--   AND connamespace IN ('finanzas'::regnamespace,'inventario'::regnamespace,'terreno'::regnamespace)
-- ORDER BY 1,2;
