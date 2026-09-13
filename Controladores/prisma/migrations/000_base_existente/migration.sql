--
-- PostgreSQL database dump
--


-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', 'finanzas,public', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: finanzas; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA finanzas;


--
-- Name: inventario; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA inventario;


--
-- Name: terreno; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA terreno;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: afp; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.afp (
    id_afp integer NOT NULL,
    nombre_afp character varying(100) NOT NULL,
    estado_afp character varying(20) DEFAULT 'activo'::character varying NOT NULL,
    CONSTRAINT chk_afp_estado CHECK (((estado_afp)::text = ANY ((ARRAY['activo'::character varying, 'inactivo'::character varying])::text[])))
);


--
-- Name: afp_id_afp_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.afp ALTER COLUMN id_afp ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.afp_id_afp_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: alerta_financiera; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.alerta_financiera (
    id_alerta_financiera integer NOT NULL,
    tipo_alerta character varying(80) NOT NULL,
    fecha_generacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    descripcion_alerta text NOT NULL,
    nivel_alerta character varying(30) DEFAULT 'media'::character varying NOT NULL,
    estado_alerta character varying(30) DEFAULT 'abierta'::character varying NOT NULL,
    fecha_cierre timestamp without time zone,
    observacion text,
    CONSTRAINT chk_alerta_financiera_estado CHECK (((estado_alerta)::text = ANY ((ARRAY['abierta'::character varying, 'en_revision'::character varying, 'cerrada'::character varying, 'anulada'::character varying])::text[]))),
    CONSTRAINT chk_alerta_financiera_nivel CHECK (((nivel_alerta)::text = ANY ((ARRAY['baja'::character varying, 'media'::character varying, 'alta'::character varying, 'critica'::character varying])::text[])))
);


--
-- Name: alerta_financiera_id_alerta_financiera_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.alerta_financiera ALTER COLUMN id_alerta_financiera ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.alerta_financiera_id_alerta_financiera_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: asignacion_pago_cliente; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.asignacion_pago_cliente (
    id_asignacion_pago_cliente integer NOT NULL,
    id_pago_cliente integer NOT NULL,
    id_nota_venta integer,
    id_documento_tributario integer,
    id_hito_cobro integer,
    monto_asignado numeric(14,2) NOT NULL,
    fecha_asignacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    observacion text,
    CONSTRAINT chk_asignacion_pago_cliente_monto CHECK ((monto_asignado > (0)::numeric)),
    CONSTRAINT chk_asignacion_pago_cliente_origen CHECK (((id_nota_venta IS NOT NULL) OR (id_documento_tributario IS NOT NULL) OR (id_hito_cobro IS NOT NULL)))
);


--
-- Name: asignacion_pago_cliente_id_asignacion_pago_cliente_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.asignacion_pago_cliente ALTER COLUMN id_asignacion_pago_cliente ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.asignacion_pago_cliente_id_asignacion_pago_cliente_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: asignacion_pago_proveedor; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.asignacion_pago_proveedor (
    id_asignacion_pago_proveedor integer NOT NULL,
    id_pago_proveedor integer NOT NULL,
    id_documento_compra_proveedor integer CONSTRAINT asignacion_pago_proveedor_id_documento_compra_proveedo_not_null NOT NULL,
    monto_asignado numeric(14,2) NOT NULL,
    fecha_asignacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    observacion text,
    CONSTRAINT chk_asignacion_pago_proveedor_monto CHECK ((monto_asignado > (0)::numeric))
);


--
-- Name: asignacion_pago_proveedor_id_asignacion_pago_proveedor_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.asignacion_pago_proveedor ALTER COLUMN id_asignacion_pago_proveedor ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.asignacion_pago_proveedor_id_asignacion_pago_proveedor_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: cargo; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.cargo (
    id_cargo integer NOT NULL,
    nombre_cargo character varying(100) NOT NULL,
    descripcion_cargo text,
    estado_cargo character varying(20) DEFAULT 'activo'::character varying NOT NULL,
    CONSTRAINT chk_cargo_estado CHECK (((estado_cargo)::text = ANY ((ARRAY['activo'::character varying, 'inactivo'::character varying])::text[])))
);


--
-- Name: cargo_id_cargo_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.cargo ALTER COLUMN id_cargo ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.cargo_id_cargo_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: cliente_financiero; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.cliente_financiero (
    id_cliente_financiero integer NOT NULL,
    rut_cliente character varying(15) NOT NULL,
    id_tipo_cliente_financiero integer NOT NULL,
    nombre_razon_social_referencia character varying(150) NOT NULL,
    contacto_financiero character varying(150),
    correo_financiero character varying(150),
    telefono_financiero character varying(30),
    estado_financiero character varying(20) DEFAULT 'activo'::character varying NOT NULL,
    fecha_actualizacion_datos_cliente timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_cliente_financiero_estado CHECK (((estado_financiero)::text = ANY ((ARRAY['activo'::character varying, 'inactivo'::character varying, 'bloqueado'::character varying])::text[])))
);


--
-- Name: COLUMN cliente_financiero.rut_cliente; Type: COMMENT; Schema: finanzas; Owner: -
--

COMMENT ON COLUMN finanzas.cliente_financiero.rut_cliente IS 'FK física hacia terreno.cliente(cliente_cliente_rut). Finanzas conserva solo la representación financiera del cliente.';


--
-- Name: cliente_financiero_id_cliente_financiero_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.cliente_financiero ALTER COLUMN id_cliente_financiero ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.cliente_financiero_id_cliente_financiero_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: concepto_remuneracion; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.concepto_remuneracion (
    id_concepto_remuneracion integer NOT NULL,
    nombre_concepto character varying(100) NOT NULL,
    descripcion_concepto text,
    naturaleza_concepto character varying(30) NOT NULL,
    estado_concepto character varying(20) DEFAULT 'activo'::character varying NOT NULL,
    CONSTRAINT chk_concepto_remuneracion_estado CHECK (((estado_concepto)::text = ANY ((ARRAY['activo'::character varying, 'inactivo'::character varying])::text[]))),
    CONSTRAINT chk_concepto_remuneracion_naturaleza CHECK (((naturaleza_concepto)::text = ANY ((ARRAY['haber'::character varying, 'descuento'::character varying, 'bono'::character varying, 'retencion'::character varying, 'otro'::character varying])::text[])))
);


--
-- Name: concepto_remuneracion_id_concepto_remuneracion_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.concepto_remuneracion ALTER COLUMN id_concepto_remuneracion ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.concepto_remuneracion_id_concepto_remuneracion_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: conciliacion; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.conciliacion (
    id_conciliacion integer NOT NULL,
    id_movimiento_financiero integer NOT NULL,
    id_movimiento_bancario integer NOT NULL,
    fecha_conciliacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    monto_conciliado numeric(14,2) NOT NULL,
    diferencia_conciliacion numeric(14,2) DEFAULT 0,
    estado_conciliacion character varying(30) DEFAULT 'pendiente'::character varying NOT NULL,
    responsable_conciliacion character varying(150),
    observacion text,
    CONSTRAINT chk_conciliacion_estado CHECK (((estado_conciliacion)::text = ANY ((ARRAY['pendiente'::character varying, 'conciliada'::character varying, 'observada'::character varying, 'anulada'::character varying])::text[]))),
    CONSTRAINT chk_conciliacion_monto CHECK ((monto_conciliado >= (0)::numeric))
);


--
-- Name: conciliacion_id_conciliacion_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.conciliacion ALTER COLUMN id_conciliacion ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.conciliacion_id_conciliacion_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: costo_proyecto; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.costo_proyecto (
    id_costo_proyecto integer NOT NULL,
    id_proyecto_financiero integer NOT NULL,
    id_moneda integer NOT NULL,
    descripcion_costo text NOT NULL,
    categoria_costo character varying(80),
    monto_costo numeric(14,2) NOT NULL,
    fecha_costo date NOT NULL,
    origen_costo character varying(80),
    estado_costo character varying(30) DEFAULT 'registrado'::character varying NOT NULL,
    observacion text,
    CONSTRAINT chk_costo_proyecto_estado CHECK (((estado_costo)::text = ANY ((ARRAY['registrado'::character varying, 'validado'::character varying, 'anulado'::character varying])::text[]))),
    CONSTRAINT chk_costo_proyecto_monto CHECK ((monto_costo >= (0)::numeric))
);


--
-- Name: costo_proyecto_id_costo_proyecto_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.costo_proyecto ALTER COLUMN id_costo_proyecto ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.costo_proyecto_id_costo_proyecto_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: cotizacion; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.cotizacion (
    id_cotizacion integer NOT NULL,
    id_ficha_cliente integer NOT NULL,
    id_moneda integer NOT NULL,
    fecha_emision date NOT NULL,
    fecha_vigencia date,
    subtotal_costos_estimados numeric(14,2) DEFAULT 0 NOT NULL,
    margen_esperado numeric(5,2),
    precio_sugerido numeric(14,2),
    monto_total_estimado numeric(14,2),
    estado_cotizacion character varying(30) DEFAULT 'emitida'::character varying NOT NULL,
    observacion text,
    CONSTRAINT chk_cotizacion_estado CHECK (((estado_cotizacion)::text = ANY ((ARRAY['borrador'::character varying, 'emitida'::character varying, 'aprobada'::character varying, 'rechazada'::character varying, 'vencida'::character varying, 'anulada'::character varying])::text[]))),
    CONSTRAINT chk_cotizacion_margen CHECK (((margen_esperado IS NULL) OR (margen_esperado >= (0)::numeric))),
    CONSTRAINT chk_cotizacion_precio CHECK (((precio_sugerido IS NULL) OR (precio_sugerido >= (0)::numeric))),
    CONSTRAINT chk_cotizacion_subtotal CHECK ((subtotal_costos_estimados >= (0)::numeric)),
    CONSTRAINT chk_cotizacion_total CHECK (((monto_total_estimado IS NULL) OR (monto_total_estimado >= (0)::numeric)))
);


--
-- Name: cotizacion_id_cotizacion_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.cotizacion ALTER COLUMN id_cotizacion ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.cotizacion_id_cotizacion_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: credito_proyecto; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.credito_proyecto (
    id_credito_proyecto integer NOT NULL,
    id_ficha_cliente integer NOT NULL,
    id_proyecto_financiero integer,
    id_limite_credito_cliente integer NOT NULL,
    id_fondo_global_credito integer NOT NULL,
    id_evaluacion_credito integer NOT NULL,
    monto_credito numeric(14,2) NOT NULL,
    fecha_otorgamiento date NOT NULL,
    fecha_vencimiento date,
    estado_credito character varying(30) DEFAULT 'vigente'::character varying NOT NULL,
    motivo_aprobacion text,
    observacion text,
    CONSTRAINT chk_credito_proyecto_estado CHECK (((estado_credito)::text = ANY ((ARRAY['vigente'::character varying, 'pagado'::character varying, 'vencido'::character varying, 'anulado'::character varying])::text[]))),
    CONSTRAINT chk_credito_proyecto_monto CHECK ((monto_credito > (0)::numeric))
);


--
-- Name: credito_proyecto_id_credito_proyecto_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.credito_proyecto ALTER COLUMN id_credito_proyecto ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.credito_proyecto_id_credito_proyecto_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: detalle_conciliacion; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.detalle_conciliacion (
    id_detalle_conciliacion integer NOT NULL,
    id_conciliacion integer NOT NULL,
    descripcion_diferencia text,
    monto_diferencia numeric(14,2),
    tipo_diferencia character varying(50),
    estado_revision character varying(30) DEFAULT 'pendiente'::character varying NOT NULL,
    observacion text,
    CONSTRAINT chk_detalle_conciliacion_estado CHECK (((estado_revision)::text = ANY ((ARRAY['pendiente'::character varying, 'revisado'::character varying, 'resuelto'::character varying, 'anulado'::character varying])::text[])))
);


--
-- Name: detalle_conciliacion_id_detalle_conciliacion_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.detalle_conciliacion ALTER COLUMN id_detalle_conciliacion ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.detalle_conciliacion_id_detalle_conciliacion_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: detalle_costo_material_cotizacion; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.detalle_costo_material_cotizacion (
    id_detalle_costo_material_cotizacion integer CONSTRAINT detalle_costo_material_coti_id_detalle_costo_material__not_null NOT NULL,
    id_detalle_cotizacion integer CONSTRAINT detalle_costo_material_cotizacio_id_detalle_cotizacion_not_null NOT NULL,
    id_historial_precio_material integer CONSTRAINT detalle_costo_material_coti_id_historial_precio_materi_not_null NOT NULL,
    cantidad_material_estimada numeric(14,4) CONSTRAINT detalle_costo_material_coti_cantidad_material_estimada_not_null NOT NULL,
    precio_unitario_usado numeric(14,2) CONSTRAINT detalle_costo_material_cotizacio_precio_unitario_usado_not_null NOT NULL,
    subtotal_material_estimado numeric(14,2) CONSTRAINT detalle_costo_material_coti_subtotal_material_estimado_not_null NOT NULL,
    observacion text,
    CONSTRAINT chk_detalle_costo_material_cantidad CHECK ((cantidad_material_estimada >= (0)::numeric)),
    CONSTRAINT chk_detalle_costo_material_precio CHECK ((precio_unitario_usado >= (0)::numeric)),
    CONSTRAINT chk_detalle_costo_material_subtotal CHECK ((subtotal_material_estimado >= (0)::numeric))
);


--
-- Name: detalle_costo_material_cotiza_id_detalle_costo_material_cot_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.detalle_costo_material_cotizacion ALTER COLUMN id_detalle_costo_material_cotizacion ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.detalle_costo_material_cotiza_id_detalle_costo_material_cot_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: detalle_costo_proyecto_documento_proveedor; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.detalle_costo_proyecto_documento_proveedor (
    id_detalle_costo_proyecto_documento_proveedor integer CONSTRAINT detalle_costo_proyecto_docu_id_detalle_costo_proyecto__not_null NOT NULL,
    id_documento_compra_proveedor integer CONSTRAINT detalle_costo_proyecto_docu_id_documento_compra_provee_not_null NOT NULL,
    id_costo_proyecto integer CONSTRAINT detalle_costo_proyecto_documento_pro_id_costo_proyecto_not_null NOT NULL,
    monto_imputado numeric(14,2) CONSTRAINT detalle_costo_proyecto_documento_provee_monto_imputado_not_null NOT NULL,
    porcentaje_imputado numeric(5,2),
    observacion text,
    CONSTRAINT chk_detalle_costo_proyecto_monto CHECK ((monto_imputado >= (0)::numeric)),
    CONSTRAINT chk_detalle_costo_proyecto_porcentaje CHECK (((porcentaje_imputado IS NULL) OR ((porcentaje_imputado >= (0)::numeric) AND (porcentaje_imputado <= (100)::numeric))))
);


--
-- Name: detalle_costo_proyecto_docume_id_detalle_costo_proyecto_doc_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.detalle_costo_proyecto_documento_proveedor ALTER COLUMN id_detalle_costo_proyecto_documento_proveedor ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.detalle_costo_proyecto_docume_id_detalle_costo_proyecto_doc_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: detalle_cotizacion; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.detalle_cotizacion (
    id_detalle_cotizacion integer NOT NULL,
    id_cotizacion integer NOT NULL,
    id_item_comercial integer NOT NULL,
    cantidad_item numeric(12,2) DEFAULT 1 NOT NULL,
    medida_alto_referencial numeric(10,2),
    medida_ancho_referencial numeric(10,2),
    medida_espesor_referencial numeric(10,2),
    descripcion_item_cotizado text,
    observacion_medidas text,
    subtotal_item_estimado numeric(14,2) DEFAULT 0 NOT NULL,
    CONSTRAINT chk_detalle_cotizacion_cantidad CHECK ((cantidad_item > (0)::numeric)),
    CONSTRAINT chk_detalle_cotizacion_subtotal CHECK ((subtotal_item_estimado >= (0)::numeric))
);


--
-- Name: COLUMN detalle_cotizacion.id_item_comercial; Type: COMMENT; Schema: finanzas; Owner: -
--

COMMENT ON COLUMN finanzas.detalle_cotizacion.id_item_comercial IS 'FK física hacia terreno.item_comercial(id_item_comercial). Tabla externa mínima de compatibilidad para cotización.';


--
-- Name: detalle_cotizacion_id_detalle_cotizacion_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.detalle_cotizacion ALTER COLUMN id_detalle_cotizacion ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.detalle_cotizacion_id_detalle_cotizacion_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: detalle_documento_compra_proveedor; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.detalle_documento_compra_proveedor (
    id_detalle_documento_compra_proveedor integer CONSTRAINT detalle_documento_compra_pr_id_detalle_documento_compr_not_null NOT NULL,
    id_documento_compra_proveedor integer CONSTRAINT detalle_documento_compra_pr_id_documento_compra_provee_not_null NOT NULL,
    id_historial_precio_material integer CONSTRAINT detalle_documento_compra_pr_id_historial_precio_materi_not_null NOT NULL,
    cantidad_material numeric(14,4) NOT NULL,
    unidad_medida character varying(30),
    precio_unitario_documento numeric(14,2) CONSTRAINT detalle_documento_compra_pro_precio_unitario_documento_not_null NOT NULL,
    subtotal_linea numeric(14,2) NOT NULL,
    observacion text,
    CONSTRAINT chk_detalle_documento_compra_cantidad CHECK ((cantidad_material > (0)::numeric)),
    CONSTRAINT chk_detalle_documento_compra_precio CHECK ((precio_unitario_documento >= (0)::numeric)),
    CONSTRAINT chk_detalle_documento_compra_subtotal CHECK ((subtotal_linea >= (0)::numeric))
);


--
-- Name: detalle_documento_compra_prov_id_detalle_documento_compra_p_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.detalle_documento_compra_proveedor ALTER COLUMN id_detalle_documento_compra_proveedor ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.detalle_documento_compra_prov_id_detalle_documento_compra_p_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: detalle_evento_auditoria; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.detalle_evento_auditoria (
    id_detalle_evento_auditoria integer NOT NULL,
    id_evento_auditoria integer NOT NULL,
    atributo_modificado character varying(100) NOT NULL,
    valor_anterior text,
    valor_nuevo text,
    observacion text
);


--
-- Name: detalle_evento_auditoria_id_detalle_evento_auditoria_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.detalle_evento_auditoria ALTER COLUMN id_detalle_evento_auditoria ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.detalle_evento_auditoria_id_detalle_evento_auditoria_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: detalle_liquidacion_remuneracion; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.detalle_liquidacion_remuneracion (
    id_detalle_liquidacion_remuneracion integer CONSTRAINT detalle_liquidacion_remuner_id_detalle_liquidacion_rem_not_null NOT NULL,
    id_liquidacion_remuneracion integer CONSTRAINT detalle_liquidacion_remuner_id_liquidacion_remuneracio_not_null NOT NULL,
    id_concepto_remuneracion integer CONSTRAINT detalle_liquidacion_remunerac_id_concepto_remuneracion_not_null NOT NULL,
    monto_concepto numeric(14,2) NOT NULL,
    observacion text,
    CONSTRAINT chk_detalle_liquidacion_monto CHECK ((monto_concepto >= (0)::numeric))
);


--
-- Name: detalle_liquidacion_remunerac_id_detalle_liquidacion_remune_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.detalle_liquidacion_remuneracion ALTER COLUMN id_detalle_liquidacion_remuneracion ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.detalle_liquidacion_remunerac_id_detalle_liquidacion_remune_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: documento_compra_proveedor; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.documento_compra_proveedor (
    id_documento_compra_proveedor integer CONSTRAINT documento_compra_proveedor_id_documento_compra_proveed_not_null NOT NULL,
    id_proveedor integer NOT NULL,
    id_tipo_documento integer NOT NULL,
    id_moneda integer NOT NULL,
    numero_documento character varying(80) NOT NULL,
    fecha_emision date NOT NULL,
    fecha_vencimiento date,
    monto_neto numeric(14,2) DEFAULT 0 NOT NULL,
    monto_impuesto numeric(14,2) DEFAULT 0 NOT NULL,
    monto_total numeric(14,2) DEFAULT 0 NOT NULL,
    tipo_cambio_usado numeric(14,4),
    fecha_tipo_cambio date,
    monto_convertido numeric(14,2),
    estado_documento character varying(30) DEFAULT 'registrado'::character varying NOT NULL,
    respaldo_documento text,
    observacion text,
    CONSTRAINT chk_documento_compra_proveedor_convertido CHECK (((monto_convertido IS NULL) OR (monto_convertido >= (0)::numeric))),
    CONSTRAINT chk_documento_compra_proveedor_estado CHECK (((estado_documento)::text = ANY ((ARRAY['registrado'::character varying, 'pendiente_pago'::character varying, 'pagado'::character varying, 'vencido'::character varying, 'anulado'::character varying])::text[]))),
    CONSTRAINT chk_documento_compra_proveedor_montos CHECK (((monto_neto >= (0)::numeric) AND (monto_impuesto >= (0)::numeric) AND (monto_total >= (0)::numeric)))
);


--
-- Name: documento_compra_proveedor_id_documento_compra_proveedor_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.documento_compra_proveedor ALTER COLUMN id_documento_compra_proveedor ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.documento_compra_proveedor_id_documento_compra_proveedor_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: documento_tributario; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.documento_tributario (
    id_documento_tributario integer NOT NULL,
    id_ficha_cliente integer NOT NULL,
    id_nota_venta integer NOT NULL,
    id_tipo_documento integer NOT NULL,
    id_moneda integer NOT NULL,
    id_documento_referencia integer,
    folio_documento character varying(80) NOT NULL,
    fecha_emision date NOT NULL,
    fecha_vencimiento date,
    monto_neto numeric(14,2) DEFAULT 0 NOT NULL,
    monto_impuesto numeric(14,2) DEFAULT 0 NOT NULL,
    monto_total numeric(14,2) DEFAULT 0 NOT NULL,
    estado_documento character varying(30) DEFAULT 'emitido'::character varying NOT NULL,
    fecha_anulacion timestamp without time zone,
    respaldo_documento text,
    observacion text,
    CONSTRAINT chk_documento_tributario_estado CHECK (((estado_documento)::text = ANY ((ARRAY['emitido'::character varying, 'pagado'::character varying, 'vencido'::character varying, 'anulado'::character varying, 'referenciado'::character varying])::text[]))),
    CONSTRAINT chk_documento_tributario_montos CHECK (((monto_neto >= (0)::numeric) AND (monto_impuesto >= (0)::numeric) AND (monto_total >= (0)::numeric)))
);


--
-- Name: documento_tributario_id_documento_tributario_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.documento_tributario ALTER COLUMN id_documento_tributario ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.documento_tributario_id_documento_tributario_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: empleado; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.empleado (
    rut_empleado character varying(15) NOT NULL,
    id_cargo integer NOT NULL,
    id_tipo_vinculo_laboral integer NOT NULL,
    id_prevision_salud integer,
    id_afp integer,
    nombres character varying(120) NOT NULL,
    apellido_paterno character varying(80) NOT NULL,
    apellido_materno character varying(80),
    fecha_nacimiento date,
    fecha_ingreso date NOT NULL,
    sueldo_base numeric(14,2) NOT NULL,
    seguro_cesantia boolean DEFAULT true NOT NULL,
    estado_laboral character varying(30) DEFAULT 'activo'::character varying NOT NULL,
    CONSTRAINT chk_empleado_estado CHECK (((estado_laboral)::text = ANY ((ARRAY['activo'::character varying, 'inactivo'::character varying, 'desvinculado'::character varying, 'suspendido'::character varying])::text[]))),
    CONSTRAINT chk_empleado_sueldo CHECK ((sueldo_base >= (0)::numeric))
);


--
-- Name: evaluacion_credito; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.evaluacion_credito (
    id_evaluacion_credito integer NOT NULL,
    id_ficha_cliente integer NOT NULL,
    fecha_evaluacion date NOT NULL,
    resultado_evaluacion character varying(50) NOT NULL,
    puntaje_riesgo numeric(6,2),
    comportamiento_pago_evaluado text,
    fundamento_evaluacion text,
    estado_evaluacion character varying(30) DEFAULT 'vigente'::character varying NOT NULL,
    observacion text,
    CONSTRAINT chk_evaluacion_credito_estado CHECK (((estado_evaluacion)::text = ANY ((ARRAY['vigente'::character varying, 'reemplazada'::character varying, 'anulada'::character varying])::text[]))),
    CONSTRAINT chk_evaluacion_credito_puntaje CHECK (((puntaje_riesgo IS NULL) OR (puntaje_riesgo >= (0)::numeric)))
);


--
-- Name: evaluacion_credito_id_evaluacion_credito_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.evaluacion_credito ALTER COLUMN id_evaluacion_credito ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.evaluacion_credito_id_evaluacion_credito_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: evento_auditoria; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.evento_auditoria (
    id_evento_auditoria integer NOT NULL,
    id_usuario bigint NOT NULL,
    fecha_evento timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tipo_evento character varying(80) NOT NULL,
    entidad_afectada character varying(80) NOT NULL,
    id_registro_afectado integer NOT NULL,
    accion_realizada character varying(100) NOT NULL,
    descripcion_evento text,
    resultado_evento character varying(30) DEFAULT 'registrado'::character varying NOT NULL,
    observacion text,
    CONSTRAINT chk_evento_auditoria_resultado CHECK (((resultado_evento)::text = ANY ((ARRAY['registrado'::character varying, 'aprobado'::character varying, 'rechazado'::character varying, 'fallido'::character varying, 'anulado'::character varying])::text[])))
);


--
-- Name: COLUMN evento_auditoria.id_usuario; Type: COMMENT; Schema: finanzas; Owner: -
--

COMMENT ON COLUMN finanzas.evento_auditoria.id_usuario IS 'FK física hacia terreno.usuario(usuario_id_usuario). Uso acotado para auditoría mientras no exista schema transversal de seguridad.';


--
-- Name: evento_auditoria_id_evento_auditoria_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.evento_auditoria ALTER COLUMN id_evento_auditoria ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.evento_auditoria_id_evento_auditoria_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ficha_cliente; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.ficha_cliente (
    id_ficha_cliente integer NOT NULL,
    id_cliente_financiero integer NOT NULL,
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    estado_ficha character varying(20) DEFAULT 'activa'::character varying NOT NULL,
    fecha_ultima_revision timestamp without time zone,
    observacion_financiera_general text,
    CONSTRAINT chk_ficha_cliente_estado CHECK (((estado_ficha)::text = ANY ((ARRAY['activa'::character varying, 'inactiva'::character varying, 'bloqueada'::character varying, 'cerrada'::character varying])::text[])))
);


--
-- Name: ficha_cliente_id_ficha_cliente_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.ficha_cliente ALTER COLUMN id_ficha_cliente ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.ficha_cliente_id_ficha_cliente_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: fondo_global_credito; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.fondo_global_credito (
    id_fondo_global_credito integer NOT NULL,
    fecha_calculo date NOT NULL,
    monto_disponible numeric(14,2) NOT NULL,
    monto_comprometido numeric(14,2) DEFAULT 0 NOT NULL,
    monto_restante numeric(14,2) NOT NULL,
    estado_fondo character varying(30) DEFAULT 'vigente'::character varying NOT NULL,
    observacion text,
    CONSTRAINT chk_fondo_global_credito_estado CHECK (((estado_fondo)::text = ANY ((ARRAY['vigente'::character varying, 'cerrado'::character varying, 'anulado'::character varying])::text[]))),
    CONSTRAINT chk_fondo_global_credito_montos CHECK (((monto_disponible >= (0)::numeric) AND (monto_comprometido >= (0)::numeric) AND (monto_restante >= (0)::numeric)))
);


--
-- Name: fondo_global_credito_id_fondo_global_credito_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.fondo_global_credito ALTER COLUMN id_fondo_global_credito ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.fondo_global_credito_id_fondo_global_credito_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: gasto_caja_chica; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.gasto_caja_chica (
    id_gasto_caja_chica integer NOT NULL,
    fecha_gasto date NOT NULL,
    monto_gasto numeric(14,2) NOT NULL,
    descripcion_gasto text NOT NULL,
    motivo_gasto text,
    categoria_gasto character varying(80),
    responsable_gasto character varying(150),
    respaldo_gasto text,
    estado_validacion character varying(30) DEFAULT 'pendiente'::character varying NOT NULL,
    observacion text,
    CONSTRAINT chk_gasto_caja_chica_estado CHECK (((estado_validacion)::text = ANY ((ARRAY['pendiente'::character varying, 'aprobado'::character varying, 'rechazado'::character varying, 'anulado'::character varying])::text[]))),
    CONSTRAINT chk_gasto_caja_chica_monto CHECK ((monto_gasto > (0)::numeric))
);


--
-- Name: gasto_caja_chica_id_gasto_caja_chica_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.gasto_caja_chica ALTER COLUMN id_gasto_caja_chica ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.gasto_caja_chica_id_gasto_caja_chica_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: historial_precio_material; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.historial_precio_material (
    id_historial_precio_material integer NOT NULL,
    material_sku character varying(50) NOT NULL,
    id_proveedor integer,
    id_moneda integer NOT NULL,
    precio_unitario numeric(14,2) NOT NULL,
    tipo_cambio_usado numeric(14,4),
    precio_unitario_convertido numeric(14,2),
    fecha_registro timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_vigencia_inicio date NOT NULL,
    fecha_vigencia_fin date,
    estado_precio character varying(20) DEFAULT 'vigente'::character varying NOT NULL,
    observacion text,
    CONSTRAINT chk_historial_precio_material_estado CHECK (((estado_precio)::text = ANY ((ARRAY['vigente'::character varying, 'reemplazado'::character varying, 'anulado'::character varying])::text[]))),
    CONSTRAINT chk_historial_precio_material_precio CHECK ((precio_unitario >= (0)::numeric)),
    CONSTRAINT chk_historial_precio_material_precio_convertido CHECK (((precio_unitario_convertido IS NULL) OR (precio_unitario_convertido >= (0)::numeric))),
    CONSTRAINT chk_historial_precio_material_vigencia CHECK (((fecha_vigencia_fin IS NULL) OR (fecha_vigencia_fin >= fecha_vigencia_inicio)))
);


--
-- Name: COLUMN historial_precio_material.material_sku; Type: COMMENT; Schema: finanzas; Owner: -
--

COMMENT ON COLUMN finanzas.historial_precio_material.material_sku IS 'FK física hacia inventario.material(material_sku). Finanzas consulta el material para precio/costo, no administra stock.';


--
-- Name: historial_precio_material_id_historial_precio_material_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.historial_precio_material ALTER COLUMN id_historial_precio_material ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.historial_precio_material_id_historial_precio_material_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: historial_tarifa_tarea; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.historial_tarifa_tarea (
    id_historial_tarifa_tarea integer NOT NULL,
    id_tarea_catalogada integer NOT NULL,
    valor_unitario_tarea numeric(14,2) NOT NULL,
    fecha_vigencia_inicio date NOT NULL,
    fecha_vigencia_fin date,
    estado_tarifa character varying(30) DEFAULT 'vigente'::character varying NOT NULL,
    observacion text,
    CONSTRAINT chk_historial_tarifa_tarea_estado CHECK (((estado_tarifa)::text = ANY ((ARRAY['vigente'::character varying, 'reemplazada'::character varying, 'anulada'::character varying])::text[]))),
    CONSTRAINT chk_historial_tarifa_tarea_valor CHECK ((valor_unitario_tarea >= (0)::numeric)),
    CONSTRAINT chk_historial_tarifa_tarea_vigencia CHECK (((fecha_vigencia_fin IS NULL) OR (fecha_vigencia_fin >= fecha_vigencia_inicio)))
);


--
-- Name: historial_tarifa_tarea_id_historial_tarifa_tarea_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.historial_tarifa_tarea ALTER COLUMN id_historial_tarifa_tarea ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.historial_tarifa_tarea_id_historial_tarifa_tarea_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: hito_cobro; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.hito_cobro (
    id_hito_cobro integer NOT NULL,
    id_nota_venta integer NOT NULL,
    id_proyecto_financiero integer,
    descripcion_hito character varying(150) NOT NULL,
    fecha_programada_cobro date NOT NULL,
    monto_programado numeric(14,2) NOT NULL,
    estado_hito character varying(30) DEFAULT 'pendiente'::character varying NOT NULL,
    fecha_pago_real date,
    observacion text,
    CONSTRAINT chk_hito_cobro_estado CHECK (((estado_hito)::text = ANY ((ARRAY['pendiente'::character varying, 'pagado'::character varying, 'parcial'::character varying, 'vencido'::character varying, 'anulado'::character varying])::text[]))),
    CONSTRAINT chk_hito_cobro_monto CHECK ((monto_programado >= (0)::numeric))
);


--
-- Name: hito_cobro_id_hito_cobro_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.hito_cobro ALTER COLUMN id_hito_cobro ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.hito_cobro_id_hito_cobro_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: limite_credito_cliente; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.limite_credito_cliente (
    id_limite_credito_cliente integer NOT NULL,
    id_ficha_cliente integer NOT NULL,
    id_evaluacion_credito integer NOT NULL,
    monto_limite numeric(14,2) NOT NULL,
    fecha_inicio_vigencia date NOT NULL,
    fecha_fin_vigencia date,
    estado_limite character varying(30) DEFAULT 'vigente'::character varying NOT NULL,
    motivo_modificacion text,
    observacion text,
    CONSTRAINT chk_limite_credito_cliente_estado CHECK (((estado_limite)::text = ANY ((ARRAY['vigente'::character varying, 'reemplazado'::character varying, 'suspendido'::character varying, 'anulado'::character varying])::text[]))),
    CONSTRAINT chk_limite_credito_cliente_monto CHECK ((monto_limite >= (0)::numeric)),
    CONSTRAINT chk_limite_credito_cliente_vigencia CHECK (((fecha_fin_vigencia IS NULL) OR (fecha_fin_vigencia >= fecha_inicio_vigencia)))
);


--
-- Name: limite_credito_cliente_id_limite_credito_cliente_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.limite_credito_cliente ALTER COLUMN id_limite_credito_cliente ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.limite_credito_cliente_id_limite_credito_cliente_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: liquidacion_remuneracion; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.liquidacion_remuneracion (
    id_liquidacion_remuneracion integer NOT NULL,
    rut_empleado character varying(15) NOT NULL,
    periodo_liquidacion character varying(7) NOT NULL,
    fecha_generacion date NOT NULL,
    fecha_aprobacion date,
    sueldo_base_periodo numeric(14,2) NOT NULL,
    total_bonos numeric(14,2) DEFAULT 0 NOT NULL,
    total_descuentos numeric(14,2) DEFAULT 0 NOT NULL,
    total_haberes numeric(14,2) DEFAULT 0 NOT NULL,
    total_liquido numeric(14,2) DEFAULT 0 NOT NULL,
    estado_liquidacion character varying(30) DEFAULT 'generada'::character varying NOT NULL,
    respaldo_liquidacion text,
    observacion text,
    CONSTRAINT chk_liquidacion_remuneracion_estado CHECK (((estado_liquidacion)::text = ANY ((ARRAY['generada'::character varying, 'aprobada'::character varying, 'pagada'::character varying, 'anulada'::character varying])::text[]))),
    CONSTRAINT chk_liquidacion_remuneracion_montos CHECK (((sueldo_base_periodo >= (0)::numeric) AND (total_bonos >= (0)::numeric) AND (total_descuentos >= (0)::numeric) AND (total_haberes >= (0)::numeric) AND (total_liquido >= (0)::numeric))),
    CONSTRAINT chk_liquidacion_remuneracion_periodo CHECK (((periodo_liquidacion)::text ~ '^[0-9]{4}-[0-9]{2}$'::text))
);


--
-- Name: liquidacion_remuneracion_id_liquidacion_remuneracion_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.liquidacion_remuneracion ALTER COLUMN id_liquidacion_remuneracion ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.liquidacion_remuneracion_id_liquidacion_remuneracion_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: medio_pago; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.medio_pago (
    id_medio_pago integer NOT NULL,
    nombre_medio_pago character varying(80) NOT NULL,
    descripcion_medio_pago text,
    estado_medio_pago character varying(20) DEFAULT 'activo'::character varying NOT NULL,
    CONSTRAINT chk_medio_pago_estado CHECK (((estado_medio_pago)::text = ANY ((ARRAY['activo'::character varying, 'inactivo'::character varying])::text[])))
);


--
-- Name: medio_pago_id_medio_pago_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.medio_pago ALTER COLUMN id_medio_pago ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.medio_pago_id_medio_pago_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: moneda; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.moneda (
    id_moneda integer NOT NULL,
    codigo_moneda character varying(10) NOT NULL,
    nombre_moneda character varying(80) NOT NULL,
    simbolo_moneda character varying(10),
    estado_moneda character varying(20) DEFAULT 'activo'::character varying NOT NULL,
    CONSTRAINT chk_moneda_estado CHECK (((estado_moneda)::text = ANY ((ARRAY['activo'::character varying, 'inactivo'::character varying])::text[])))
);


--
-- Name: moneda_id_moneda_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.moneda ALTER COLUMN id_moneda ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.moneda_id_moneda_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: movimiento_bancario; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.movimiento_bancario (
    id_movimiento_bancario integer NOT NULL,
    id_moneda integer NOT NULL,
    fecha_movimiento_bancario timestamp without time zone NOT NULL,
    monto_bancario numeric(14,2) NOT NULL,
    descripcion_bancaria text,
    glosa_bancaria text,
    tipo_movimiento_bancario character varying(50),
    banco character varying(100),
    cuenta_bancaria character varying(80),
    numero_operacion character varying(100),
    estado_conciliacion character varying(30) DEFAULT 'pendiente'::character varying NOT NULL,
    CONSTRAINT chk_movimiento_bancario_estado CHECK (((estado_conciliacion)::text = ANY ((ARRAY['pendiente'::character varying, 'conciliado'::character varying, 'observado'::character varying, 'anulado'::character varying])::text[]))),
    CONSTRAINT chk_movimiento_bancario_monto CHECK ((monto_bancario > (0)::numeric))
);


--
-- Name: movimiento_bancario_id_movimiento_bancario_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.movimiento_bancario ALTER COLUMN id_movimiento_bancario ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.movimiento_bancario_id_movimiento_bancario_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: movimiento_financiero; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.movimiento_financiero (
    id_movimiento_financiero integer NOT NULL,
    id_moneda integer NOT NULL,
    fecha_movimiento timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tipo_movimiento_financiero character varying(50) NOT NULL,
    naturaleza_movimiento character varying(30) NOT NULL,
    motivo_movimiento text,
    monto_movimiento numeric(14,2) NOT NULL,
    estado_movimiento character varying(30) DEFAULT 'registrado'::character varying NOT NULL,
    observacion text,
    CONSTRAINT chk_movimiento_financiero_estado CHECK (((estado_movimiento)::text = ANY ((ARRAY['registrado'::character varying, 'conciliado'::character varying, 'anulado'::character varying])::text[]))),
    CONSTRAINT chk_movimiento_financiero_monto CHECK ((monto_movimiento > (0)::numeric)),
    CONSTRAINT chk_movimiento_financiero_naturaleza CHECK (((naturaleza_movimiento)::text = ANY ((ARRAY['ingreso'::character varying, 'egreso'::character varying, 'ajuste'::character varying])::text[])))
);


--
-- Name: movimiento_financiero_id_movimiento_financiero_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.movimiento_financiero ALTER COLUMN id_movimiento_financiero ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.movimiento_financiero_id_movimiento_financiero_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: nota_venta; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.nota_venta (
    id_nota_venta integer NOT NULL,
    id_ficha_cliente integer NOT NULL,
    id_cotizacion integer,
    id_moneda integer NOT NULL,
    numero_nota_venta character varying(50) NOT NULL,
    fecha_emision date NOT NULL,
    monto_neto numeric(14,2) DEFAULT 0 NOT NULL,
    monto_impuesto numeric(14,2) DEFAULT 0 NOT NULL,
    monto_total numeric(14,2) DEFAULT 0 NOT NULL,
    tipo_cambio_usado numeric(14,4),
    monto_convertido numeric(14,2),
    estado_nota_venta character varying(30) DEFAULT 'emitida'::character varying NOT NULL,
    estado_pago character varying(30) DEFAULT 'pendiente'::character varying NOT NULL,
    descuento_aplicado numeric(14,2) DEFAULT 0,
    motivo_descuento text,
    fecha_anulacion timestamp without time zone,
    motivo_anulacion text,
    observacion text,
    fecha_vencimiento date,
    CONSTRAINT chk_nota_venta_descuento CHECK (((descuento_aplicado IS NULL) OR (descuento_aplicado >= (0)::numeric))),
    CONSTRAINT chk_nota_venta_estado CHECK (((estado_nota_venta)::text = ANY ((ARRAY['emitida'::character varying, 'confirmada'::character varying, 'anulada'::character varying, 'cerrada'::character varying])::text[]))),
    CONSTRAINT chk_nota_venta_estado_pago CHECK (((estado_pago)::text = ANY ((ARRAY['pendiente'::character varying, 'parcial'::character varying, 'pagada'::character varying, 'vencida'::character varying])::text[]))),
    CONSTRAINT chk_nota_venta_monto_convertido CHECK (((monto_convertido IS NULL) OR (monto_convertido >= (0)::numeric))),
    CONSTRAINT chk_nota_venta_montos CHECK (((monto_neto >= (0)::numeric) AND (monto_impuesto >= (0)::numeric) AND (monto_total >= (0)::numeric)))
);


--
-- Name: nota_venta_id_nota_venta_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.nota_venta ALTER COLUMN id_nota_venta ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.nota_venta_id_nota_venta_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: origen_alerta_financiera; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.origen_alerta_financiera (
    id_origen_alerta_financiera integer NOT NULL,
    id_alerta_financiera integer NOT NULL,
    entidad_origen character varying(80) NOT NULL,
    id_registro_origen integer NOT NULL,
    descripcion_origen text,
    CONSTRAINT chk_origen_alerta_financiera_entidad CHECK (((entidad_origen)::text = ANY ((ARRAY['ficha_cliente'::character varying, 'nota_venta'::character varying, 'documento_tributario'::character varying, 'documento_compra_proveedor'::character varying, 'proyecto_financiero'::character varying, 'credito_proyecto'::character varying, 'evaluacion_credito'::character varying, 'fondo_global_credito'::character varying, 'proveedor'::character varying])::text[])))
);


--
-- Name: origen_alerta_financiera_id_origen_alerta_financiera_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.origen_alerta_financiera ALTER COLUMN id_origen_alerta_financiera ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.origen_alerta_financiera_id_origen_alerta_financiera_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: origen_movimiento_financiero; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.origen_movimiento_financiero (
    id_origen_movimiento_financiero integer CONSTRAINT origen_movimiento_financier_id_origen_movimiento_finan_not_null NOT NULL,
    id_movimiento_financiero integer NOT NULL,
    entidad_origen character varying(80) NOT NULL,
    id_registro_origen integer NOT NULL,
    descripcion_origen text,
    CONSTRAINT chk_origen_movimiento_financiero_entidad CHECK (((entidad_origen)::text = ANY ((ARRAY['pago_cliente'::character varying, 'pago_proveedor'::character varying, 'gasto_caja_chica'::character varying, 'liquidacion_remuneracion'::character varying, 'ajuste_manual'::character varying])::text[])))
);


--
-- Name: origen_movimiento_financiero_id_origen_movimiento_financier_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.origen_movimiento_financiero ALTER COLUMN id_origen_movimiento_financiero ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.origen_movimiento_financiero_id_origen_movimiento_financier_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: pago_cliente; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.pago_cliente (
    id_pago_cliente integer NOT NULL,
    id_ficha_cliente integer NOT NULL,
    id_moneda integer NOT NULL,
    id_medio_pago integer NOT NULL,
    fecha_pago date NOT NULL,
    monto_pago numeric(14,2) NOT NULL,
    tipo_cambio_usado numeric(14,4),
    monto_convertido numeric(14,2),
    naturaleza_pago character varying(30) DEFAULT 'ingreso_cliente'::character varying NOT NULL,
    estado_verificacion character varying(30) DEFAULT 'pendiente'::character varying NOT NULL,
    comprobante_pago text,
    observacion text,
    CONSTRAINT chk_pago_cliente_estado CHECK (((estado_verificacion)::text = ANY ((ARRAY['pendiente'::character varying, 'verificado'::character varying, 'rechazado'::character varying, 'anulado'::character varying])::text[]))),
    CONSTRAINT chk_pago_cliente_monto CHECK ((monto_pago > (0)::numeric)),
    CONSTRAINT chk_pago_cliente_monto_convertido CHECK (((monto_convertido IS NULL) OR (monto_convertido >= (0)::numeric)))
);


--
-- Name: pago_cliente_id_pago_cliente_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.pago_cliente ALTER COLUMN id_pago_cliente ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.pago_cliente_id_pago_cliente_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: pago_proveedor; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.pago_proveedor (
    id_pago_proveedor integer NOT NULL,
    id_proveedor integer NOT NULL,
    id_moneda integer NOT NULL,
    id_medio_pago integer NOT NULL,
    fecha_pago date NOT NULL,
    monto_pago numeric(14,2) NOT NULL,
    tipo_cambio_usado numeric(14,4),
    monto_convertido numeric(14,2),
    estado_pago character varying(30) DEFAULT 'registrado'::character varying NOT NULL,
    comprobante_pago text,
    observacion text,
    CONSTRAINT chk_pago_proveedor_convertido CHECK (((monto_convertido IS NULL) OR (monto_convertido >= (0)::numeric))),
    CONSTRAINT chk_pago_proveedor_estado CHECK (((estado_pago)::text = ANY ((ARRAY['registrado'::character varying, 'verificado'::character varying, 'anulado'::character varying])::text[]))),
    CONSTRAINT chk_pago_proveedor_monto CHECK ((monto_pago > (0)::numeric))
);


--
-- Name: pago_proveedor_id_pago_proveedor_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.pago_proveedor ALTER COLUMN id_pago_proveedor ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.pago_proveedor_id_pago_proveedor_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: pais; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.pais (
    id_pais integer NOT NULL,
    nombre_pais character varying(100) NOT NULL,
    codigo_iso_pais character varying(10),
    estado_pais character varying(20) DEFAULT 'activo'::character varying NOT NULL,
    CONSTRAINT chk_pais_estado CHECK (((estado_pais)::text = ANY ((ARRAY['activo'::character varying, 'inactivo'::character varying])::text[])))
);


--
-- Name: pais_id_pais_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.pais ALTER COLUMN id_pais ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.pais_id_pais_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: prevision_salud; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.prevision_salud (
    id_prevision_salud integer NOT NULL,
    nombre_prevision_salud character varying(100) NOT NULL,
    tipo_prevision_salud character varying(50),
    estado_prevision_salud character varying(20) DEFAULT 'activo'::character varying NOT NULL,
    CONSTRAINT chk_prevision_salud_estado CHECK (((estado_prevision_salud)::text = ANY ((ARRAY['activo'::character varying, 'inactivo'::character varying])::text[])))
);


--
-- Name: prevision_salud_id_prevision_salud_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.prevision_salud ALTER COLUMN id_prevision_salud ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.prevision_salud_id_prevision_salud_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: proveedor; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.proveedor (
    id_proveedor integer NOT NULL,
    id_tipo_identificador integer NOT NULL,
    id_pais integer,
    id_moneda_preferente integer,
    identificador_tributario character varying(50) NOT NULL,
    nombre_razon_social character varying(150) NOT NULL,
    nacionalidad_origen character varying(80),
    contacto_proveedor character varying(150),
    correo_proveedor character varying(150),
    telefono_proveedor character varying(30),
    direccion_proveedor text,
    estado_proveedor character varying(30) DEFAULT 'activo'::character varying NOT NULL,
    fecha_registro date DEFAULT CURRENT_DATE NOT NULL,
    CONSTRAINT chk_proveedor_estado CHECK (((estado_proveedor)::text = ANY ((ARRAY['activo'::character varying, 'inactivo'::character varying, 'bloqueado'::character varying])::text[])))
);


--
-- Name: proveedor_id_proveedor_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.proveedor ALTER COLUMN id_proveedor ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.proveedor_id_proveedor_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: proyecto_financiero; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.proyecto_financiero (
    id_proyecto_financiero integer NOT NULL,
    id_ficha_cliente integer NOT NULL,
    id_nota_venta integer,
    id_proyecto_terreno bigint,
    id_moneda integer NOT NULL,
    codigo_proyecto_financiero character varying(80) NOT NULL,
    fecha_inicio_financiera date,
    fecha_cierre_financiera date,
    estado_financiero_proyecto character varying(30) DEFAULT 'activo'::character varying NOT NULL,
    monto_venta_estimado numeric(14,2),
    monto_costo_estimado numeric(14,2),
    monto_costo_real numeric(14,2),
    margen_estimado numeric(14,2),
    margen_real numeric(14,2),
    observacion_financiera text,
    CONSTRAINT chk_proyecto_financiero_estado CHECK (((estado_financiero_proyecto)::text = ANY ((ARRAY['activo'::character varying, 'en_revision'::character varying, 'cerrado'::character varying, 'anulado'::character varying])::text[]))),
    CONSTRAINT chk_proyecto_financiero_montos CHECK ((((monto_venta_estimado IS NULL) OR (monto_venta_estimado >= (0)::numeric)) AND ((monto_costo_estimado IS NULL) OR (monto_costo_estimado >= (0)::numeric)) AND ((monto_costo_real IS NULL) OR (monto_costo_real >= (0)::numeric))))
);


--
-- Name: COLUMN proyecto_financiero.id_proyecto_terreno; Type: COMMENT; Schema: finanzas; Owner: -
--

COMMENT ON COLUMN finanzas.proyecto_financiero.id_proyecto_terreno IS 'FK física hacia terreno.proyecto(proyecto_proyecto_id). Finanzas registra el seguimiento financiero del proyecto.';


--
-- Name: proyecto_financiero_id_proyecto_financiero_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.proyecto_financiero ALTER COLUMN id_proyecto_financiero ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.proyecto_financiero_id_proyecto_financiero_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: tarea_catalogada; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.tarea_catalogada (
    id_tarea_catalogada integer NOT NULL,
    nombre_tarea character varying(120) NOT NULL,
    descripcion_tarea text,
    estado_tarea character varying(30) DEFAULT 'activa'::character varying NOT NULL,
    CONSTRAINT chk_tarea_catalogada_estado CHECK (((estado_tarea)::text = ANY ((ARRAY['activa'::character varying, 'inactiva'::character varying])::text[])))
);


--
-- Name: tarea_catalogada_id_tarea_catalogada_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.tarea_catalogada ALTER COLUMN id_tarea_catalogada ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.tarea_catalogada_id_tarea_catalogada_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: tarea_remunerable; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.tarea_remunerable (
    id_tarea_remunerable integer NOT NULL,
    rut_empleado character varying(15) NOT NULL,
    id_historial_tarifa_tarea integer NOT NULL,
    id_proyecto_financiero integer,
    id_liquidacion_remuneracion integer,
    id_orden_trabajo bigint,
    fecha_tarea date NOT NULL,
    cantidad_realizada numeric(12,2) NOT NULL,
    estado_validacion character varying(30) DEFAULT 'pendiente'::character varying NOT NULL,
    monto_calculado numeric(14,2) DEFAULT 0 NOT NULL,
    referencia_unidad_terminada character varying(100),
    observacion text,
    CONSTRAINT chk_tarea_remunerable_cantidad CHECK ((cantidad_realizada > (0)::numeric)),
    CONSTRAINT chk_tarea_remunerable_estado CHECK (((estado_validacion)::text = ANY ((ARRAY['pendiente'::character varying, 'validada'::character varying, 'rechazada'::character varying, 'anulada'::character varying])::text[]))),
    CONSTRAINT chk_tarea_remunerable_monto CHECK ((monto_calculado >= (0)::numeric))
);


--
-- Name: COLUMN tarea_remunerable.id_orden_trabajo; Type: COMMENT; Schema: finanzas; Owner: -
--

COMMENT ON COLUMN finanzas.tarea_remunerable.id_orden_trabajo IS 'FK física hacia inventario.orden_trabajo(orden_trabajo_id_orden). Finanzas la usa solo para remuneración/tarea validada.';


--
-- Name: tarea_remunerable_id_tarea_remunerable_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.tarea_remunerable ALTER COLUMN id_tarea_remunerable ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.tarea_remunerable_id_tarea_remunerable_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: tipo_cliente_financiero; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.tipo_cliente_financiero (
    id_tipo_cliente_financiero integer NOT NULL,
    nombre_tipo_cliente_financiero character varying(80) NOT NULL,
    descripcion_tipo_cliente_financiero text,
    estado_tipo_cliente_financiero character varying(20) DEFAULT 'activo'::character varying NOT NULL,
    CONSTRAINT chk_tipo_cliente_financiero_estado CHECK (((estado_tipo_cliente_financiero)::text = ANY ((ARRAY['activo'::character varying, 'inactivo'::character varying])::text[])))
);


--
-- Name: tipo_cliente_financiero_id_tipo_cliente_financiero_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.tipo_cliente_financiero ALTER COLUMN id_tipo_cliente_financiero ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.tipo_cliente_financiero_id_tipo_cliente_financiero_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: tipo_documento; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.tipo_documento (
    id_tipo_documento integer NOT NULL,
    nombre_tipo_documento character varying(80) NOT NULL,
    descripcion_tipo_documento text,
    aplica_venta boolean DEFAULT false NOT NULL,
    aplica_compra boolean DEFAULT false NOT NULL,
    requiere_vencimiento boolean DEFAULT false NOT NULL,
    afecta_impuesto boolean DEFAULT true NOT NULL,
    estado_tipo_documento character varying(20) DEFAULT 'activo'::character varying NOT NULL,
    CONSTRAINT chk_tipo_documento_aplica CHECK ((aplica_venta OR aplica_compra)),
    CONSTRAINT chk_tipo_documento_estado CHECK (((estado_tipo_documento)::text = ANY ((ARRAY['activo'::character varying, 'inactivo'::character varying])::text[])))
);


--
-- Name: tipo_documento_id_tipo_documento_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.tipo_documento ALTER COLUMN id_tipo_documento ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.tipo_documento_id_tipo_documento_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: tipo_identificador; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.tipo_identificador (
    id_tipo_identificador integer NOT NULL,
    nombre_tipo_identificador character varying(80) NOT NULL,
    descripcion_tipo_identificador text,
    estado_tipo_identificador character varying(20) DEFAULT 'activo'::character varying NOT NULL,
    CONSTRAINT chk_tipo_identificador_estado CHECK (((estado_tipo_identificador)::text = ANY ((ARRAY['activo'::character varying, 'inactivo'::character varying])::text[])))
);


--
-- Name: tipo_identificador_id_tipo_identificador_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.tipo_identificador ALTER COLUMN id_tipo_identificador ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.tipo_identificador_id_tipo_identificador_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: tipo_vinculo_laboral; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.tipo_vinculo_laboral (
    id_tipo_vinculo_laboral integer NOT NULL,
    nombre_tipo_vinculo_laboral character varying(80) NOT NULL,
    descripcion_tipo_vinculo_laboral text,
    estado_tipo_vinculo_laboral character varying(20) DEFAULT 'activo'::character varying NOT NULL,
    CONSTRAINT chk_tipo_vinculo_laboral_estado CHECK (((estado_tipo_vinculo_laboral)::text = ANY ((ARRAY['activo'::character varying, 'inactivo'::character varying])::text[])))
);


--
-- Name: tipo_vinculo_laboral_id_tipo_vinculo_laboral_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.tipo_vinculo_laboral ALTER COLUMN id_tipo_vinculo_laboral ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.tipo_vinculo_laboral_id_tipo_vinculo_laboral_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: v_ficha_cliente_movimientos; Type: VIEW; Schema: finanzas; Owner: -
--

CREATE VIEW finanzas.v_ficha_cliente_movimientos AS
 SELECT fc.id_ficha_cliente,
    cf.id_cliente_financiero,
    cf.rut_cliente,
    'nota_venta'::text AS tipo_origen,
    nv.id_nota_venta AS id_origen,
    (nv.fecha_emision)::timestamp without time zone AS fecha_movimiento,
    nv.estado_nota_venta AS estado,
    nv.monto_total AS monto,
    nv.observacion AS descripcion
   FROM ((finanzas.ficha_cliente fc
     JOIN finanzas.cliente_financiero cf ON ((cf.id_cliente_financiero = fc.id_cliente_financiero)))
     JOIN finanzas.nota_venta nv ON ((nv.id_ficha_cliente = fc.id_ficha_cliente)))
UNION ALL
 SELECT fc.id_ficha_cliente,
    cf.id_cliente_financiero,
    cf.rut_cliente,
    'documento_tributario'::text AS tipo_origen,
    dt.id_documento_tributario AS id_origen,
    (dt.fecha_emision)::timestamp without time zone AS fecha_movimiento,
    dt.estado_documento AS estado,
    dt.monto_total AS monto,
    dt.observacion AS descripcion
   FROM ((finanzas.ficha_cliente fc
     JOIN finanzas.cliente_financiero cf ON ((cf.id_cliente_financiero = fc.id_cliente_financiero)))
     JOIN finanzas.documento_tributario dt ON ((dt.id_ficha_cliente = fc.id_ficha_cliente)))
UNION ALL
 SELECT fc.id_ficha_cliente,
    cf.id_cliente_financiero,
    cf.rut_cliente,
    'pago_cliente'::text AS tipo_origen,
    pc.id_pago_cliente AS id_origen,
    (pc.fecha_pago)::timestamp without time zone AS fecha_movimiento,
    pc.estado_verificacion AS estado,
    pc.monto_pago AS monto,
    pc.observacion AS descripcion
   FROM ((finanzas.ficha_cliente fc
     JOIN finanzas.cliente_financiero cf ON ((cf.id_cliente_financiero = fc.id_cliente_financiero)))
     JOIN finanzas.pago_cliente pc ON ((pc.id_ficha_cliente = fc.id_ficha_cliente)))
UNION ALL
 SELECT fc.id_ficha_cliente,
    cf.id_cliente_financiero,
    cf.rut_cliente,
    'proyecto_financiero'::text AS tipo_origen,
    pf.id_proyecto_financiero AS id_origen,
    (pf.fecha_inicio_financiera)::timestamp without time zone AS fecha_movimiento,
    pf.estado_financiero_proyecto AS estado,
    COALESCE(pf.monto_venta_estimado, (0)::numeric) AS monto,
    pf.observacion_financiera AS descripcion
   FROM ((finanzas.ficha_cliente fc
     JOIN finanzas.cliente_financiero cf ON ((cf.id_cliente_financiero = fc.id_cliente_financiero)))
     JOIN finanzas.proyecto_financiero pf ON ((pf.id_ficha_cliente = fc.id_ficha_cliente)))
UNION ALL
 SELECT fc.id_ficha_cliente,
    cf.id_cliente_financiero,
    cf.rut_cliente,
    'evaluacion_credito'::text AS tipo_origen,
    ec.id_evaluacion_credito AS id_origen,
    (ec.fecha_evaluacion)::timestamp without time zone AS fecha_movimiento,
    ec.estado_evaluacion AS estado,
    ec.puntaje_riesgo AS monto,
    ec.resultado_evaluacion AS descripcion
   FROM ((finanzas.ficha_cliente fc
     JOIN finanzas.cliente_financiero cf ON ((cf.id_cliente_financiero = fc.id_cliente_financiero)))
     JOIN finanzas.evaluacion_credito ec ON ((ec.id_ficha_cliente = fc.id_ficha_cliente)));


--
-- Name: v_ficha_cliente_resumen; Type: VIEW; Schema: finanzas; Owner: -
--

CREATE VIEW finanzas.v_ficha_cliente_resumen AS
 SELECT fc.id_ficha_cliente,
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
    COALESCE(nv.cantidad_notas_venta, (0)::bigint) AS cantidad_notas_venta,
    COALESCE(nv.total_notas_venta, (0)::numeric) AS total_notas_venta,
    COALESCE(dt.cantidad_documentos, (0)::bigint) AS cantidad_documentos_tributarios,
    COALESCE(dt.total_documentos, (0)::numeric) AS total_documentos_tributarios,
    COALESCE(pc.cantidad_pagos_cliente, (0)::bigint) AS cantidad_pagos_cliente,
    COALESCE(pc.total_pagado_cliente, (0)::numeric) AS total_pagado_cliente,
    COALESCE(pf.cantidad_proyectos_financieros, (0)::bigint) AS cantidad_proyectos_financieros,
    COALESCE(pf.total_costo_real, (0)::numeric) AS total_costo_real_proyectos,
    COALESCE(ec.cantidad_evaluaciones_credito, (0)::bigint) AS cantidad_evaluaciones_credito,
    lc.monto_limite AS limite_credito_vigente,
    lc.estado_limite AS estado_limite_credito,
    COALESCE(cp.cantidad_creditos, (0)::bigint) AS cantidad_creditos_proyecto,
    COALESCE(cp.total_creditos, (0)::numeric) AS total_creditos_proyecto,
    COALESCE(al.cantidad_alertas, (0)::bigint) AS cantidad_alertas_financieras
   FROM ((((((((((finanzas.ficha_cliente fc
     JOIN finanzas.cliente_financiero cf ON ((cf.id_cliente_financiero = fc.id_cliente_financiero)))
     LEFT JOIN finanzas.tipo_cliente_financiero tcf ON ((tcf.id_tipo_cliente_financiero = cf.id_tipo_cliente_financiero)))
     LEFT JOIN ( SELECT nota_venta.id_ficha_cliente,
            count(*) AS cantidad_notas_venta,
            sum(nota_venta.monto_total) AS total_notas_venta
           FROM finanzas.nota_venta
          WHERE ((nota_venta.estado_nota_venta)::text <> 'anulada'::text)
          GROUP BY nota_venta.id_ficha_cliente) nv ON ((nv.id_ficha_cliente = fc.id_ficha_cliente)))
     LEFT JOIN ( SELECT documento_tributario.id_ficha_cliente,
            count(*) AS cantidad_documentos,
            sum(documento_tributario.monto_total) AS total_documentos
           FROM finanzas.documento_tributario
          WHERE ((documento_tributario.estado_documento)::text <> 'anulado'::text)
          GROUP BY documento_tributario.id_ficha_cliente) dt ON ((dt.id_ficha_cliente = fc.id_ficha_cliente)))
     LEFT JOIN ( SELECT pago_cliente.id_ficha_cliente,
            count(*) AS cantidad_pagos_cliente,
            sum(pago_cliente.monto_pago) AS total_pagado_cliente
           FROM finanzas.pago_cliente
          WHERE ((pago_cliente.estado_verificacion)::text <> 'anulado'::text)
          GROUP BY pago_cliente.id_ficha_cliente) pc ON ((pc.id_ficha_cliente = fc.id_ficha_cliente)))
     LEFT JOIN ( SELECT proyecto_financiero.id_ficha_cliente,
            count(*) AS cantidad_proyectos_financieros,
            sum(COALESCE(proyecto_financiero.monto_costo_real, (0)::numeric)) AS total_costo_real
           FROM finanzas.proyecto_financiero
          WHERE ((proyecto_financiero.estado_financiero_proyecto)::text <> 'anulado'::text)
          GROUP BY proyecto_financiero.id_ficha_cliente) pf ON ((pf.id_ficha_cliente = fc.id_ficha_cliente)))
     LEFT JOIN ( SELECT evaluacion_credito.id_ficha_cliente,
            count(*) AS cantidad_evaluaciones_credito
           FROM finanzas.evaluacion_credito
          WHERE ((evaluacion_credito.estado_evaluacion)::text <> 'anulada'::text)
          GROUP BY evaluacion_credito.id_ficha_cliente) ec ON ((ec.id_ficha_cliente = fc.id_ficha_cliente)))
     LEFT JOIN LATERAL ( SELECT lcx.monto_limite,
            lcx.estado_limite
           FROM finanzas.limite_credito_cliente lcx
          WHERE ((lcx.id_ficha_cliente = fc.id_ficha_cliente) AND ((lcx.estado_limite)::text = 'vigente'::text))
          ORDER BY lcx.fecha_inicio_vigencia DESC, lcx.id_limite_credito_cliente DESC
         LIMIT 1) lc ON (true))
     LEFT JOIN ( SELECT credito_proyecto.id_ficha_cliente,
            count(*) AS cantidad_creditos,
            sum(credito_proyecto.monto_credito) AS total_creditos
           FROM finanzas.credito_proyecto
          WHERE ((credito_proyecto.estado_credito)::text <> 'anulado'::text)
          GROUP BY credito_proyecto.id_ficha_cliente) cp ON ((cp.id_ficha_cliente = fc.id_ficha_cliente)))
     LEFT JOIN ( SELECT oa.id_registro_origen AS id_ficha_cliente,
            count(*) AS cantidad_alertas
           FROM (finanzas.origen_alerta_financiera oa
             JOIN finanzas.alerta_financiera af ON ((af.id_alerta_financiera = oa.id_alerta_financiera)))
          WHERE (((oa.entidad_origen)::text = 'ficha_cliente'::text) AND ((af.estado_alerta)::text <> 'anulada'::text))
          GROUP BY oa.id_registro_origen) al ON ((al.id_ficha_cliente = fc.id_ficha_cliente)));


--
-- Name: alerta_faltante_pedido; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.alerta_faltante_pedido (
    alerta_faltante_pedido_id_alerta_faltante bigint CONSTRAINT alerta_faltante_pedido_alerta_faltante_pedido_id_alert_not_null NOT NULL,
    alerta_faltante_pedido_fecha_generacion timestamp with time zone,
    alerta_faltante_pedido_cantidad_disponible numeric(12,4),
    alerta_faltante_pedido_cantidad_requerida numeric(12,4),
    alerta_faltante_pedido_horas_anticipacion integer,
    alerta_faltante_pedido_estado character varying(50),
    material_sku character varying(16),
    proveedor_id_proveedor integer,
    usuario_id_usuario bigint,
    proyecto_id_proyecto bigint
);


--
-- Name: alerta_faltante_pedido_alerta_faltante_pedido_id_alerta_fal_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

ALTER TABLE inventario.alerta_faltante_pedido ALTER COLUMN alerta_faltante_pedido_id_alerta_faltante ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME inventario.alerta_faltante_pedido_alerta_faltante_pedido_id_alerta_fal_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: alerta_inventario; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.alerta_inventario (
    alerta_inventario_id_alerta bigint NOT NULL,
    alerta_inventario_mensaje text,
    alerta_inventario_fecha_generacion timestamp with time zone,
    alerta_inventario_fecha_est_agotamiento date,
    alerta_inventario_estado character varying(50),
    material_sku character varying(16),
    proveedor_id_proveedor integer,
    alerta_inventario_tipo_alerta_id_tipo_alerta bigint,
    historial_alerta_id_historial bigint
);


--
-- Name: alerta_inventario_alerta_inventario_id_alerta_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

ALTER TABLE inventario.alerta_inventario ALTER COLUMN alerta_inventario_id_alerta ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME inventario.alerta_inventario_alerta_inventario_id_alerta_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: alerta_inventario_nivel_prioridad; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.alerta_inventario_nivel_prioridad (
    alerta_inventario_nivel_prioridad_id_nivel_prioridad bigint CONSTRAINT alerta_inventario_nivel_pri_alerta_inventario_nivel_pr_not_null NOT NULL,
    alerta_inventario_prioridad_nombre character varying(100)
);


--
-- Name: alerta_inventario_nivel_prior_alerta_inventario_nivel_prior_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

ALTER TABLE inventario.alerta_inventario_nivel_prioridad ALTER COLUMN alerta_inventario_nivel_prioridad_id_nivel_prioridad ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME inventario.alerta_inventario_nivel_prior_alerta_inventario_nivel_prior_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: alerta_inventario_tipo_alerta; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.alerta_inventario_tipo_alerta (
    alerta_inventario_tipo_alerta_id_tipo_alerta bigint CONSTRAINT alerta_inventario_tipo_aler_alerta_inventario_tipo_ale_not_null NOT NULL,
    alerta_inventario_tipo_alerta_nombre character varying(150),
    alerta_inventario_nivel_prioridad_id bigint
);


--
-- Name: alerta_inventario_tipo_alerta_alerta_inventario_tipo_alerta_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

ALTER TABLE inventario.alerta_inventario_tipo_alerta ALTER COLUMN alerta_inventario_tipo_alerta_id_tipo_alerta ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME inventario.alerta_inventario_tipo_alerta_alerta_inventario_tipo_alerta_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: anaquel; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.anaquel (
    anaquel_id_anaquel bigint NOT NULL,
    anaquel_descripcion text,
    bodega_id_bodega bigint
);


--
-- Name: anaquel_anaquel_id_anaquel_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

ALTER TABLE inventario.anaquel ALTER COLUMN anaquel_id_anaquel ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME inventario.anaquel_anaquel_id_anaquel_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: bodega; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.bodega (
    bodega_id_bodega bigint NOT NULL,
    bodega_nombre_bodega character varying(150),
    bodega_direccion text,
    bodega_estado character varying(50)
);


--
-- Name: bodega_bodega_id_bodega_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

ALTER TABLE inventario.bodega ALTER COLUMN bodega_id_bodega ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME inventario.bodega_bodega_id_bodega_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: factura_compra; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.factura_compra (
    factura_compra_id_factura bigint NOT NULL,
    factura_compra_numero_factura character varying(80),
    factura_compra_monto_neto numeric(14,2),
    factura_compra_tipo_compra character varying(100),
    factura_compra_fecha_emision date,
    proveedor_id_proveedor integer,
    factura_compra_tipo_cambio_id_tipo_cambio bigint
);


--
-- Name: factura_compra_factura_compra_id_factura_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

ALTER TABLE inventario.factura_compra ALTER COLUMN factura_compra_id_factura ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME inventario.factura_compra_factura_compra_id_factura_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: factura_compra_tipo_cambio; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.factura_compra_tipo_cambio (
    factura_compra_tipo_cambio_id_tipo_cambio bigint CONSTRAINT factura_compra_tipo_cambio_factura_compra_tipo_cambio__not_null NOT NULL,
    factura_compra_tipo_cambio_moneda character varying(10),
    factura_compra_tipo_cambio_valor numeric(14,4)
);


--
-- Name: factura_compra_tipo_cambio_factura_compra_tipo_cambio_id_ti_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

ALTER TABLE inventario.factura_compra_tipo_cambio ALTER COLUMN factura_compra_tipo_cambio_id_tipo_cambio ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME inventario.factura_compra_tipo_cambio_factura_compra_tipo_cambio_id_ti_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: historial_alerta; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.historial_alerta (
    historial_alerta_id_historial bigint NOT NULL,
    historial_alerta_fecha_hora_resolucion timestamp with time zone
);


--
-- Name: historial_alerta_historial_alerta_id_historial_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

ALTER TABLE inventario.historial_alerta ALTER COLUMN historial_alerta_id_historial ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME inventario.historial_alerta_historial_alerta_id_historial_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: insumo_estandar_proceso; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.insumo_estandar_proceso (
    insumo_estandar_proceso_id_insumo_estandar bigint CONSTRAINT insumo_estandar_proceso_insumo_estandar_proceso_id_ins_not_null NOT NULL,
    insumo_estandar_proceso_cantidad_estandar numeric(12,4),
    insumo_estandar_proceso_observacion text,
    insumo_estandar_proceso_activo boolean,
    material_sku character varying(16),
    area_trabajo_id_area bigint
);


--
-- Name: insumo_estandar_proceso_insumo_estandar_proceso_id_insumo_e_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

ALTER TABLE inventario.insumo_estandar_proceso ALTER COLUMN insumo_estandar_proceso_id_insumo_estandar ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME inventario.insumo_estandar_proceso_insumo_estandar_proceso_id_insumo_e_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: inventario_bodega; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.inventario_bodega (
    material_sku character varying(16) NOT NULL,
    lote_id_lote bigint NOT NULL,
    bodega_id_bodega bigint NOT NULL,
    inventario_bodega_cantidad_fisica numeric(12,4),
    inventario_bodega_cantidad_reservada numeric(12,4)
);


--
-- Name: lote; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.lote (
    lote_id_lote bigint NOT NULL,
    lote_numero_lote character varying(80),
    lote_fecha_ingreso date,
    lote_fecha_vencimiento date,
    lote_fecha_recepcion date,
    lote_estado character varying(50),
    proveedor_id_proveedor integer,
    factura_compra_id_factura bigint,
    proyecto_id_proyecto bigint
);


--
-- Name: lote_fecha_pedido; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.lote_fecha_pedido (
    lote_fecha_pedido_id bigint NOT NULL,
    lote_fecha_pedido_fecha_pedido date,
    lote_fecha_pedido_precio_unitario numeric(14,2),
    lote_id_lote bigint
);


--
-- Name: lote_fecha_pedido_lote_fecha_pedido_id_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

ALTER TABLE inventario.lote_fecha_pedido ALTER COLUMN lote_fecha_pedido_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME inventario.lote_fecha_pedido_lote_fecha_pedido_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: lote_lote_id_lote_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

ALTER TABLE inventario.lote ALTER COLUMN lote_id_lote ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME inventario.lote_lote_id_lote_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: material; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.material (
    material_sku character varying(16) NOT NULL,
    material_nombre_material character varying(200),
    material_descripcion text,
    material_material_critico boolean,
    material_presentacion character varying(150),
    material_stock_critico numeric(12,4),
    material_sotck_maximo numeric(12,4),
    material_stock_minimo numeric(12,4),
    material_es_rotativo boolean,
    material_estado character varying(50),
    es_material_pintura_custom boolean,
    material_pintura_custom character varying(100),
    es_material_pintura_no_custom boolean,
    material_pintura_no_custom character varying(100),
    material_categoria_general_id_categoria_general bigint,
    material_categoria_funcional_id_categoria_funcional bigint,
    material_clasificacion_nivel_especifico bigint,
    material_unidad_medida_id_medida bigint
);


--
-- Name: material_categoria_funcional; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.material_categoria_funcional (
    material_categoria_funcional_id_categoria_funcional bigint CONSTRAINT material_categoria_funciona_material_categoria_funcion_not_null NOT NULL,
    material_categoria_funcional_nombre character varying(150)
);


--
-- Name: material_categoria_funcional_material_categoria_funcional_i_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

ALTER TABLE inventario.material_categoria_funcional ALTER COLUMN material_categoria_funcional_id_categoria_funcional ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME inventario.material_categoria_funcional_material_categoria_funcional_i_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: material_categoria_general; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.material_categoria_general (
    material_categoria_general_id_categoria_general bigint CONSTRAINT material_categoria_general_material_categoria_general__not_null NOT NULL,
    material_categoria_general_nombre character varying(150)
);


--
-- Name: material_categoria_general_material_categoria_general_id_ca_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

ALTER TABLE inventario.material_categoria_general ALTER COLUMN material_categoria_general_id_categoria_general ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME inventario.material_categoria_general_material_categoria_general_id_ca_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: material_clasificacion_categoria; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.material_clasificacion_categoria (
    material_clasificacion_categoria_id bigint CONSTRAINT material_clasificacion_cate_material_clasificacion_cat_not_null NOT NULL,
    material_clasificacion_categoria_nombre_categoria character varying(150)
);


--
-- Name: material_clasificacion_catego_material_clasificacion_catego_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

ALTER TABLE inventario.material_clasificacion_categoria ALTER COLUMN material_clasificacion_categoria_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME inventario.material_clasificacion_catego_material_clasificacion_catego_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: material_clasificacion_nivel_especifico; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.material_clasificacion_nivel_especifico (
    material_clasificacion_nivel_especifico_id bigint CONSTRAINT material_clasificacion_nive_material_clasificacion_niv_not_null NOT NULL,
    material_clasificacion_nivel_especifico_nombre_nivel_especifico character varying(150),
    material_clasificacion_subcategoria_id bigint
);


--
-- Name: material_clasificacion_nivel__material_clasificacion_nivel__seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

ALTER TABLE inventario.material_clasificacion_nivel_especifico ALTER COLUMN material_clasificacion_nivel_especifico_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME inventario.material_clasificacion_nivel__material_clasificacion_nivel__seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: material_clasificacion_subcategoria; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.material_clasificacion_subcategoria (
    material_clasificacion_subcategoria_id bigint CONSTRAINT material_clasificacion_subc_material_clasificacion_sub_not_null NOT NULL,
    material_clasificacion_subcategoria_nombre_subcategoria character varying(150),
    material_clasificacion_subcategoria_es_color_custom boolean,
    material_clasificacion_categoria_id bigint
);


--
-- Name: material_clasificacion_subcat_material_clasificacion_subcat_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

ALTER TABLE inventario.material_clasificacion_subcategoria ALTER COLUMN material_clasificacion_subcategoria_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME inventario.material_clasificacion_subcat_material_clasificacion_subcat_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: material_codigo_barras; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.material_codigo_barras (
    material_sku character varying(16) NOT NULL,
    material_codigo_barras character varying(100) NOT NULL
);


--
-- Name: material_orden_trabajo; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.material_orden_trabajo (
    material_sku character varying(16) NOT NULL,
    orden_trabajo_id_orden bigint NOT NULL,
    material_orden_trabajo_consumo_estimado numeric(12,4),
    material_orden_trabajo_consumo_real numeric(12,4)
);


--
-- Name: material_producto_terminado; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.material_producto_terminado (
    material_sku character varying(16) NOT NULL,
    producto_terminado_id_producto bigint CONSTRAINT material_producto_terminado_producto_terminado_id_prod_not_null NOT NULL,
    material_producto_terminado_cantidad_estimada numeric(12,4),
    material_producto_terminado_merma_estimada numeric(12,4)
);


--
-- Name: material_proveedor; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.material_proveedor (
    material_sku character varying(16) NOT NULL,
    proveedor_id_proveedor integer NOT NULL,
    material_proveedor_tiempo_reposicion integer,
    material_proveedor_precio_referencial numeric(14,2),
    material_proveedor_proveedor_principal boolean
);


--
-- Name: material_unidad_medida; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.material_unidad_medida (
    material_unidad_medida_id_unidad_medida bigint CONSTRAINT material_unidad_medida_material_unidad_medida_id_unida_not_null NOT NULL,
    material_unidad_medida_nombre character varying(100)
);


--
-- Name: material_unidad_medida_material_unidad_medida_id_unidad_med_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

ALTER TABLE inventario.material_unidad_medida ALTER COLUMN material_unidad_medida_id_unidad_medida ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME inventario.material_unidad_medida_material_unidad_medida_id_unidad_med_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: movimiento_inventario; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.movimiento_inventario (
    movimiento_inventario_id_movimiento bigint CONSTRAINT movimiento_inventario_movimiento_inventario_id_movimie_not_null NOT NULL,
    movimiento_inventario_fecha_hora timestamp with time zone,
    movimiento_inventario_cantidad numeric(12,4),
    movimiento_inventario_estado character varying(50),
    material_sku character varying(16),
    bodega_id_bodega bigint,
    lote_id_lote bigint,
    proyecto_id_proyecto bigint,
    factura_compra_id_factura_compra bigint,
    usuario_id_usuario bigint,
    movimiento_inventario_tipo_movimiento_id_tipo_movimiento bigint,
    movimiento_inventario_motivo_movimiento_id_motivo_movimiento bigint
);


--
-- Name: movimiento_inventario_clasificacion_salida; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.movimiento_inventario_clasificacion_salida (
    id_clasificacion_salida bigint CONSTRAINT movimiento_inventario_clasific_id_clasificacion_salida_not_null NOT NULL,
    movimiento_inventario_clasificacion_salida_nombre character varying(150)
);


--
-- Name: movimiento_inventario_clasificacion_id_clasificacion_salida_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

ALTER TABLE inventario.movimiento_inventario_clasificacion_salida ALTER COLUMN id_clasificacion_salida ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME inventario.movimiento_inventario_clasificacion_id_clasificacion_salida_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: movimiento_inventario_motivo_movimiento; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.movimiento_inventario_motivo_movimiento (
    movimiento_inventario_motivo_movimiento_id_motivo_movimiento bigint CONSTRAINT movimiento_inventario_motiv_movimiento_inventario_moti_not_null NOT NULL,
    movimiento_inventario_motivo_movimiento_nombre character varying(150),
    id_clasificacion_salida bigint
);


--
-- Name: movimiento_inventario_motivo__movimiento_inventario_motivo__seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

ALTER TABLE inventario.movimiento_inventario_motivo_movimiento ALTER COLUMN movimiento_inventario_motivo_movimiento_id_motivo_movimiento ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME inventario.movimiento_inventario_motivo__movimiento_inventario_motivo__seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: movimiento_inventario_movimiento_inventario_id_movimiento_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

ALTER TABLE inventario.movimiento_inventario ALTER COLUMN movimiento_inventario_id_movimiento ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME inventario.movimiento_inventario_movimiento_inventario_id_movimiento_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: movimiento_inventario_tipo_movimiento; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.movimiento_inventario_tipo_movimiento (
    movimiento_inventario_tipo_movimiento_id_tipo_movimiento bigint CONSTRAINT movimiento_inventario_tipo__movimiento_inventario_tipo_not_null NOT NULL,
    movimiento_inventario_tipo_movimiento_nombre character varying(150)
);


--
-- Name: movimiento_inventario_tipo_mo_movimiento_inventario_tipo_mo_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

ALTER TABLE inventario.movimiento_inventario_tipo_movimiento ALTER COLUMN movimiento_inventario_tipo_movimiento_id_tipo_movimiento ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME inventario.movimiento_inventario_tipo_mo_movimiento_inventario_tipo_mo_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: notificacion; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.notificacion (
    notificacion_id_notificacion bigint NOT NULL,
    notificacion_tipo_notificacion character varying(150),
    notificacion_mensaje text,
    notificacion_fecha_generacion timestamp with time zone,
    notificacion_estado_lectura character varying(50),
    notificacion_origen character varying(150),
    alerta_inventario_id_alerta bigint,
    usuario_id_usuario bigint
);


--
-- Name: notificacion_notificacion_id_notificacion_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

ALTER TABLE inventario.notificacion ALTER COLUMN notificacion_id_notificacion ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME inventario.notificacion_notificacion_id_notificacion_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: orden_trabajo; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.orden_trabajo (
    orden_trabajo_id_orden bigint NOT NULL,
    orden_trabajo_fecha_hora timestamp with time zone,
    orden_trabajo_estado character varying(50),
    especificaciones_puerta_id_especificacion_puerta bigint,
    proyecto_id_proyecto bigint,
    area_trabajo_id_area bigint,
    usuario_id_usuario bigint
);


--
-- Name: orden_trabajo_orden_trabajo_id_orden_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

ALTER TABLE inventario.orden_trabajo ALTER COLUMN orden_trabajo_id_orden ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME inventario.orden_trabajo_orden_trabajo_id_orden_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: preparacion_pedido; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.preparacion_pedido (
    preparacion_pedido_id_preparacion bigint NOT NULL,
    preparacion_pedido_observacion text,
    reserva_inventario_id_reserva bigint,
    usuario_id_usuario bigint
);


--
-- Name: preparacion_pedido_estado; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.preparacion_pedido_estado (
    preparacion_pedido_estado_id_estado_preparacion bigint CONSTRAINT preparacion_pedido_estado_preparacion_pedido_estado_id_not_null NOT NULL,
    pedido_preparacion_estado_nombre_estado character varying(100),
    pedido_preparacion_estado_timestamp_accion timestamp with time zone,
    preparacion_pedido_id_preparacion bigint
);


--
-- Name: preparacion_pedido_estado_preparacion_pedido_estado_id_esta_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

ALTER TABLE inventario.preparacion_pedido_estado ALTER COLUMN preparacion_pedido_estado_id_estado_preparacion ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME inventario.preparacion_pedido_estado_preparacion_pedido_estado_id_esta_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: preparacion_pedido_preparacion_pedido_id_preparacion_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

ALTER TABLE inventario.preparacion_pedido ALTER COLUMN preparacion_pedido_id_preparacion ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME inventario.preparacion_pedido_preparacion_pedido_id_preparacion_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: producto_terminado; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.producto_terminado (
    producto_terminado_id_producto bigint NOT NULL,
    producto_terminado_tipo_producto character varying(150),
    producto_terminado_nombre_producto character varying(200),
    producto_terminado_codigo_producto character varying(80),
    producto_terminado_requerimientos_certificacion text,
    producto_terminado_requerimientos_medidas text,
    producto_terminado_requerimientos_produccion text,
    producto_terminado_requerimientos_instalacion text,
    producto_terminado_activo boolean
);


--
-- Name: producto_terminado_producto_terminado_id_producto_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

ALTER TABLE inventario.producto_terminado ALTER COLUMN producto_terminado_id_producto ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME inventario.producto_terminado_producto_terminado_id_producto_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: proveedor_contacto_correo; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.proveedor_contacto_correo (
    proveedor_id_proveedor integer NOT NULL,
    proveedor_contacto_correo character varying(254) NOT NULL
);


--
-- Name: proveedor_contacto_telefono; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.proveedor_contacto_telefono (
    proveedor_id_proveedor integer NOT NULL,
    proveedor_contacto_telefono character varying(30) CONSTRAINT proveedor_contacto_telefono_proveedor_contacto_telefon_not_null NOT NULL
);


--
-- Name: reporte; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.reporte (
    reporte_id_reporte bigint NOT NULL,
    reporte_periodo_fin date,
    reporte_fecha_generacion timestamp with time zone,
    reporte_formato_exportacion character varying(50),
    reporte_estado character varying(50),
    reporte_tipo_reporte character varying(50),
    reporte_periodo_inicio date,
    usuario_id_usuario bigint
);


--
-- Name: reporte_movimiento_inventario; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.reporte_movimiento_inventario (
    movimiento_inventario_id_movimiento bigint CONSTRAINT reporte_movimiento_inventar_movimiento_inventario_id_m_not_null NOT NULL,
    reporte_id_reporte bigint NOT NULL
);


--
-- Name: reporte_reporte_id_reporte_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

ALTER TABLE inventario.reporte ALTER COLUMN reporte_id_reporte ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME inventario.reporte_reporte_id_reporte_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: reserva_inventario; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.reserva_inventario (
    reserva_inventario_id_reserva bigint NOT NULL,
    reserva_inventario_cantidad_reservada numeric(12,4),
    reserva_inventario_fecha_reserva timestamp with time zone,
    reserva_inventario_fecha_liberacion timestamp with time zone,
    reserva_inventario_estado_reserva character varying(50),
    material_sku character varying(16),
    proyecto_id_proyecto bigint,
    orden_trabajo_id_orden bigint
);


--
-- Name: reserva_inventario_reserva_inventario_id_reserva_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

ALTER TABLE inventario.reserva_inventario ALTER COLUMN reserva_inventario_id_reserva ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME inventario.reserva_inventario_reserva_inventario_id_reserva_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: adicionales_pagados; Type: TABLE; Schema: terreno; Owner: -
--

CREATE TABLE terreno.adicionales_pagados (
    adicionales_pagados_id_adicionales bigint NOT NULL,
    adicionales_pagados_retiro_escombros boolean,
    adicionales_pagados_retiro_puerta_actual boolean,
    adicionales_pagados_alarma boolean,
    adicionales_pagados_subida_escalera text,
    adicionales_pagados_endolados boolean,
    adicionales_pagados_pilastras_alto numeric(12,4),
    adicionales_pagados_pilastras_ancho numeric(12,4),
    adicionales_pagados_pilastras_espesor numeric(12,4),
    adicionales_pagados_observaciones text,
    id_especificaciones_puerta bigint
);


--
-- Name: adicionales_pagados_adicionales_pagados_id_adicionales_seq; Type: SEQUENCE; Schema: terreno; Owner: -
--

ALTER TABLE terreno.adicionales_pagados ALTER COLUMN adicionales_pagados_id_adicionales ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME terreno.adicionales_pagados_adicionales_pagados_id_adicionales_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: area_trabajo; Type: TABLE; Schema: terreno; Owner: -
--

CREATE TABLE terreno.area_trabajo (
    area_trabajo_id_area bigint NOT NULL,
    area_trabajo_clasificacion character varying(150),
    area_trabajo_activo boolean,
    area_trabajo_nombre_area character varying(150)
);


--
-- Name: area_trabajo_area_trabajo_id_area_seq; Type: SEQUENCE; Schema: terreno; Owner: -
--

ALTER TABLE terreno.area_trabajo ALTER COLUMN area_trabajo_id_area ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME terreno.area_trabajo_area_trabajo_id_area_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: checklist_de_materiales; Type: TABLE; Schema: terreno; Owner: -
--

CREATE TABLE terreno.checklist_de_materiales (
    checklist_de_materiales_checklist_de_materials_id bigint CONSTRAINT checklist_de_materiales_checklist_de_materiales_checkl_not_null NOT NULL,
    checklist_de_materiales_tipo_inicio_tarea text,
    checklist_de_materiales_tipo_cierre_tarea text,
    checklist_de_materiales_item text,
    checklist_de_materiales_es_marcado boolean,
    checklist_de_materiales_marcado text,
    checklist_de_materiales_es_no_marcado boolean,
    checklist_de_materiales_no_marcado text
);


--
-- Name: checklist_de_materiales_checklist_de_materiales_checklist_d_seq; Type: SEQUENCE; Schema: terreno; Owner: -
--

ALTER TABLE terreno.checklist_de_materiales ALTER COLUMN checklist_de_materiales_checklist_de_materials_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME terreno.checklist_de_materiales_checklist_de_materiales_checklist_d_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: cliente; Type: TABLE; Schema: terreno; Owner: -
--

CREATE TABLE terreno.cliente (
    cliente_cliente_rut character varying(12) NOT NULL,
    cliente_razon_social text,
    cliente_contacto_principal text,
    cliente_correo text,
    cliente_telefono text,
    cliente_es_cliente_b2c boolean,
    cliente_cliente_b2c_rut character varying(12),
    cliente_cliente_b2c_correo text,
    cliente_cliente_b2c_primer_nombre text,
    cliente_cliente_b2c_segundo_nombre text,
    cliente_cliente_b2c_primer_apellido text,
    cliente_cliente_b2c_segundo_apellido text,
    cliente_cliente_b2c_telefono_contacto text,
    cliente_cliente_b2c_fecha_registro date,
    cliente_cliente_b2c_telefono_contacto_adicional text,
    cliente_cliente_b2c_fecha_ultima_edicion date,
    cliente_es_cliente_b2b boolean,
    cliente_cliente_b2b_fecha_ultima_edicion date,
    cliente_cliente_b2b_correo_institucional text,
    cliente_cliente_b2b_fecha_registro date,
    cliente_cliente_b2b_telefono_corporativo text,
    cliente_cliente_b2b_razon_social text,
    cliente_cliente_b2b_rut_empresa character varying(12),
    cliente_cliente_b2b_telefono_corp_adicional text,
    cliente_cliente_b2b_representante_legal_primer_nombre text,
    cliente_cliente_b2b_representante_legal_segundo_nombre text,
    cliente_cliente_b2b_representante_legal_primer_apellido text,
    cliente_cliente_b2b_representante_legal_segundo_apellido text
);


--
-- Name: detalles_herraje; Type: TABLE; Schema: terreno; Owner: -
--

CREATE TABLE terreno.detalles_herraje (
    detalles_herraje_detalle_herraje_id bigint NOT NULL,
    detalles_herraje_ubicacion text,
    detalles_herraje_color text,
    detalles_herraje_cantidad integer,
    detalles_herraje_observacion text,
    material_sku character varying(16),
    id_especificacion_puerta bigint
);


--
-- Name: detalles_herraje_detalles_herraje_detalle_herraje_id_seq; Type: SEQUENCE; Schema: terreno; Owner: -
--

ALTER TABLE terreno.detalles_herraje ALTER COLUMN detalles_herraje_detalle_herraje_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME terreno.detalles_herraje_detalles_herraje_detalle_herraje_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: especificacion_metalmecanica; Type: TABLE; Schema: terreno; Owner: -
--

CREATE TABLE terreno.especificacion_metalmecanica (
    especificacion_metalmecanica_id_metalmecanica bigint CONSTRAINT especificacion_metalmecanic_especificacion_metalmecani_not_null NOT NULL,
    especificacion_metalmecanica_bastidor text,
    especificacion_metalmecanica_cerradura text,
    especificacion_metalmecanica_manillon text,
    especificacion_metalmecanica_pernos_fijos text,
    especificacion_metalmecanica_manilla text,
    especificacion_metalmecanica_herraje text,
    especificacion_metalmecanica_cerrojo text,
    especificacion_metalmecanica_ojo text,
    especificacion_metalmecanica_otros text,
    id_especificacion_puerta bigint
);


--
-- Name: especificacion_metalmecanica_especificacion_metalmecanica_i_seq; Type: SEQUENCE; Schema: terreno; Owner: -
--

ALTER TABLE terreno.especificacion_metalmecanica ALTER COLUMN especificacion_metalmecanica_id_metalmecanica ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME terreno.especificacion_metalmecanica_especificacion_metalmecanica_i_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: especificacion_proyecto_terreno; Type: TABLE; Schema: terreno; Owner: -
--

CREATE TABLE terreno.especificacion_proyecto_terreno (
    id_especificacion_proyecto_terreno bigint CONSTRAINT especificacion_proyecto_ter_id_especificacion_proyecto_not_null NOT NULL,
    especificacion_proyecto_terreno_estado_operacional text,
    especificacion_proyecto_terreno_estado_produccion text,
    especificacion_proyecto_terreno_estado_instalacion text,
    especificacion_proyecto_terreno_fecha_inicio date,
    especificacion_proyecto_terreno_fecha_cierre_operativo date,
    especificacion_proyecto_terreno_observacion_estado text,
    especificacion_proyecto_terreno_conformidad_cliente text,
    id_especificacion_puerta bigint
);


--
-- Name: especificacion_proyecto_terre_id_especificacion_proyecto_te_seq; Type: SEQUENCE; Schema: terreno; Owner: -
--

ALTER TABLE terreno.especificacion_proyecto_terreno ALTER COLUMN id_especificacion_proyecto_terreno ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME terreno.especificacion_proyecto_terre_id_especificacion_proyecto_te_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: especificacion_servicio_terreno; Type: TABLE; Schema: terreno; Owner: -
--

CREATE TABLE terreno.especificacion_servicio_terreno (
    especificacion_servicio_terreno_servicio_terreno_id bigint CONSTRAINT especificacion_servicio_ter_especificacion_servicio_te_not_null NOT NULL,
    especificacion_servicio_terreno_especificacion_puerta_id bigint CONSTRAINT especificacion_servicio_te_especificacion_servicio_te_not_null1 NOT NULL
);


--
-- Name: especificacion_terminaciones; Type: TABLE; Schema: terreno; Owner: -
--

CREATE TABLE terreno.especificacion_terminaciones (
    especificacion_terminaciones_id_terminacion bigint CONSTRAINT especificacion_terminacione_especificacion_terminacion_not_null NOT NULL,
    especificacion_terminaciones_herrajes text,
    especificacion_terminaciones_pletina numeric(12,4),
    especificacion_terminaciones_funda numeric(12,4),
    especificacion_terminaciones_medida_final numeric(12,4),
    especificacion_terminaciones_manilla numeric(12,4),
    especificacion_terminaciones_marco_metalico numeric(12,4),
    especificacion_terminaciones_bisagras numeric(12,4),
    especificacion_terminaciones_molduras text,
    especificacion_terminaciones_rebaje text,
    especificacion_terminaciones_canterias text,
    especificacion_terminaciones_pura text,
    especificacion_terminaciones_enchape text,
    id_especificacion_puerta bigint
);


--
-- Name: especificacion_terminaciones_especificacion_terminaciones_i_seq; Type: SEQUENCE; Schema: terreno; Owner: -
--

ALTER TABLE terreno.especificacion_terminaciones ALTER COLUMN especificacion_terminaciones_id_terminacion ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME terreno.especificacion_terminaciones_especificacion_terminaciones_i_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: especificaciones_puerta; Type: TABLE; Schema: terreno; Owner: -
--

CREATE TABLE terreno.especificaciones_puerta (
    especificacion_puerta_especificacion_puerta_id bigint CONSTRAINT especificaciones_puerta_especificacion_puerta_especifi_not_null NOT NULL,
    especificacion_puerta_modelo_puerta text,
    especificacion_puerta_zona text,
    especificacion_puerta_sentido_apertura text,
    especificacion_puerta_materialidad_vano text,
    especificacion_puerta_materialidad_marco_actual text,
    especificacion_puerta_solucion_marco text,
    especificacion_puerta_hoja_pasiva text,
    especificacion_puerta_hoja_activa text,
    especificacion_puerta_diseno_puerta text,
    especificacion_puerta_observaciones_de_diseno text,
    especificacion_puerta_cubrejuntas boolean,
    especificacion_puerta_bisagras text,
    especificacion_puerta_observaciones text,
    id_medidas bigint
);


--
-- Name: especificaciones_puerta_especificacion_puerta_especificacio_seq; Type: SEQUENCE; Schema: terreno; Owner: -
--

ALTER TABLE terreno.especificaciones_puerta ALTER COLUMN especificacion_puerta_especificacion_puerta_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME terreno.especificaciones_puerta_especificacion_puerta_especificacio_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: evidencia_terreno; Type: TABLE; Schema: terreno; Owner: -
--

CREATE TABLE terreno.evidencia_terreno (
    evidencia_terreno_evidencia_terreno_id bigint CONSTRAINT evidencia_terreno_evidencia_terreno_evidencia_terreno__not_null NOT NULL,
    evidencia_terreno_tipo_evidencia text,
    evidencia_terreno_fecha_captura date,
    evidencia_terreno_imagen_o_vector bytea,
    evidencia_terreno_metadata_dispositivo text,
    evidencia_terreno_estado_temporal text,
    evidencia_terreno_estado_evidencia text,
    evidencia_terreno_observacion text,
    id_formulario_de_cierre bigint,
    id_servicio_terreno bigint
);


--
-- Name: evidencia_terreno_evidencia_terreno_evidencia_terreno_id_seq; Type: SEQUENCE; Schema: terreno; Owner: -
--

ALTER TABLE terreno.evidencia_terreno ALTER COLUMN evidencia_terreno_evidencia_terreno_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME terreno.evidencia_terreno_evidencia_terreno_evidencia_terreno_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: formulario_de_cierre; Type: TABLE; Schema: terreno; Owner: -
--

CREATE TABLE terreno.formulario_de_cierre (
    formulario_de_cierre_formulario_de_cierre_id bigint CONSTRAINT formulario_de_cierre_formulario_de_cierre_formulario_d_not_null NOT NULL,
    formulario_de_cierre_detalle_de_observaciones text,
    formulario_de_cierre_sentido_de_apertura_correcto boolean,
    formulario_de_cierre_pilastras_incluidas_y_ajustadas boolean,
    formulario_de_cierre_resultado_finalizado text,
    formulario_de_cierre_cilindro_correcto boolean,
    formulario_de_cierre_ausencia_de_rayones_o_danos boolean,
    id_tarea bigint
);


--
-- Name: formulario_de_cierre_formulario_de_cierre_formulario_de_cie_seq; Type: SEQUENCE; Schema: terreno; Owner: -
--

ALTER TABLE terreno.formulario_de_cierre ALTER COLUMN formulario_de_cierre_formulario_de_cierre_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME terreno.formulario_de_cierre_formulario_de_cierre_formulario_de_cie_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: historial_cambio_orden_trabajo; Type: TABLE; Schema: terreno; Owner: -
--

CREATE TABLE terreno.historial_cambio_orden_trabajo (
    historial_cambio_orden_trabajo_id_cambio bigint CONSTRAINT historial_cambio_orden_trab_historial_cambio_orden_tra_not_null NOT NULL,
    historial_cambio_orden_trabajo_version_nueva text,
    historial_cambio_orden_trabajo_version_antigua text,
    historial_cambio_orden_trabajo_fecha_hora timestamp with time zone,
    historial_cambio_orden_trabajo_descripcion text,
    id_especificaciones_puerta bigint
);


--
-- Name: historial_cambio_orden_trabaj_historial_cambio_orden_trabaj_seq; Type: SEQUENCE; Schema: terreno; Owner: -
--

ALTER TABLE terreno.historial_cambio_orden_trabajo ALTER COLUMN historial_cambio_orden_trabajo_id_cambio ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME terreno.historial_cambio_orden_trabaj_historial_cambio_orden_trabaj_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: hoja_doble; Type: TABLE; Schema: terreno; Owner: -
--

CREATE TABLE terreno.hoja_doble (
    hoja_doble_especificacion_puerta_id bigint NOT NULL,
    hoja_doble_actividad_derecha text,
    hoja_doble_medidas_derecha_vertical_alto numeric(12,4),
    hoja_doble_medidas_derecha_vertical_ancho numeric(12,4),
    hoja_doble_medidas_derecha_vertical_espesor numeric(12,4),
    hoja_doble_medidas_derecha_horizontal_alto numeric(12,4),
    hoja_doble_medidas_derecha_horizontal_ancho numeric(12,4),
    hoja_doble_medidas_derecha_horizontal_espesor numeric(12,4),
    hoja_doble_actividad_izquierda text,
    hoja_doble_medidas_izquierda_vertical_alto numeric(12,4),
    hoja_doble_medidas_izquierda_vertical_ancho numeric(12,4),
    hoja_doble_medidas_izquierda_vertical_espesor numeric(12,4),
    hoja_doble_medidas_izquierda_horizontal_alto numeric(12,4),
    hoja_doble_medidas_izquierda_horizontal_ancho numeric(12,4),
    hoja_doble_medidas_izquierda_horizontal_espesor numeric(12,4)
);


--
-- Name: hoja_simple; Type: TABLE; Schema: terreno; Owner: -
--

CREATE TABLE terreno.hoja_simple (
    hoja_simple_especificacion_puerta_id bigint NOT NULL,
    hoja_simple_medidas_vertical_alto numeric(12,4),
    hoja_simple_medidas_vertical_ancho numeric(12,4),
    hoja_simple_medidas_vertical_espesor numeric(12,4),
    hoja_simple_medidas_horizontal_alto numeric(12,4),
    hoja_simple_medidas_horizontal_ancho numeric(12,4),
    hoja_simple_medidas_horizontal_espesor numeric(12,4)
);


--
-- Name: item_comercial; Type: TABLE; Schema: terreno; Owner: -
--

CREATE TABLE terreno.item_comercial (
    id_item_comercial integer NOT NULL,
    nombre_item character varying(150) NOT NULL,
    descripcion_item text,
    tipo_item character varying(50),
    estado_item character varying(30) DEFAULT 'activo'::character varying NOT NULL,
    CONSTRAINT chk_terreno_item_estado CHECK (((estado_item)::text = ANY ((ARRAY['activo'::character varying, 'inactivo'::character varying])::text[])))
);


--
-- Name: item_comercial_id_item_comercial_seq; Type: SEQUENCE; Schema: terreno; Owner: -
--

ALTER TABLE terreno.item_comercial ALTER COLUMN id_item_comercial ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME terreno.item_comercial_id_item_comercial_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: medidas_puerta; Type: TABLE; Schema: terreno; Owner: -
--

CREATE TABLE terreno.medidas_puerta (
    medidas_puerta_medidas_id bigint NOT NULL,
    medidas_puerta_medidas_marco_ancho numeric(12,4),
    medidas_puerta_medidas_marco_alto numeric(12,4),
    medidas_puerta_medidas_marco_espesor numeric(12,4),
    medidas_puerta_medidas_vano_vertical_ancho numeric(12,4),
    medidas_puerta_medidas_vano_vertical_alto numeric(12,4),
    medidas_puerta_medidas_vano_vertical_espesor numeric(12,4),
    medidas_puerta_medidas_vano_horizontal_ancho numeric(12,4),
    medidas_puerta_medidas_vano_horizontal_alto numeric(12,4),
    medidas_puerta_medidas_vano_horizontal_espesor numeric(12,4),
    medidas_puerta_medidas_alojamiento_vertical_alto numeric(12,4),
    medidas_puerta_medidas_alojamiento_vertical_ancho numeric(12,4),
    medidas_puerta_medidas_alojamiento_vertical_espesor numeric(12,4),
    medidas_puerta_medidas_alojamiento_horizontal_alto numeric(12,4),
    medidas_puerta_medidas_alojamiento_horizontal_ancho numeric(12,4),
    medidas_puerta_medidas_alojamiento_horizontal_espesor numeric(12,4),
    medidas_puerta_alojamiento_vertical numeric(12,4),
    medidas_puerta_medidas_de_marco_ancho numeric(12,4),
    medidas_puerta_medidas_de_marco_alto numeric(12,4),
    medidas_puerta_medidas_de_marco_espesor numeric(12,4),
    id_especificacion_puerta bigint,
    id_cambio bigint
);


--
-- Name: medidas_puerta_medidas_puerta_medidas_id_seq; Type: SEQUENCE; Schema: terreno; Owner: -
--

ALTER TABLE terreno.medidas_puerta ALTER COLUMN medidas_puerta_medidas_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME terreno.medidas_puerta_medidas_puerta_medidas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: notificacion_tecnico; Type: TABLE; Schema: terreno; Owner: -
--

CREATE TABLE terreno.notificacion_tecnico (
    notificacion_tecnico_id_notificacion_tecnico bigint CONSTRAINT notificacion_tecnico_notificacion_tecnico_id_notificac_not_null NOT NULL,
    notificacion_tecnico_fecha_emision timestamp with time zone,
    notificacion_tecnico_mensaje text,
    usuario_id_usuario bigint,
    servicio_terreno_id_servicio_terreno bigint
);


--
-- Name: notificacion_tecnico_notificacion_tecnico_id_notificacion_t_seq; Type: SEQUENCE; Schema: terreno; Owner: -
--

ALTER TABLE terreno.notificacion_tecnico ALTER COLUMN notificacion_tecnico_id_notificacion_tecnico ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME terreno.notificacion_tecnico_notificacion_tecnico_id_notificacion_t_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: notificacion_terreno; Type: TABLE; Schema: terreno; Owner: -
--

CREATE TABLE terreno.notificacion_terreno (
    notificacion_terreno_id_notificacion_terreno bigint CONSTRAINT notificacion_terreno_notificacion_terreno_id_notificac_not_null NOT NULL,
    notificacion_terreno_mensaje text,
    usuario_id_usuario bigint,
    tarea_id_tarea bigint
);


--
-- Name: notificacion_terreno_notificacion_terreno_id_notificacion_t_seq; Type: SEQUENCE; Schema: terreno; Owner: -
--

ALTER TABLE terreno.notificacion_terreno ALTER COLUMN notificacion_terreno_id_notificacion_terreno ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME terreno.notificacion_terreno_notificacion_terreno_id_notificacion_t_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: obra; Type: TABLE; Schema: terreno; Owner: -
--

CREATE TABLE terreno.obra (
    obra_obra_id bigint NOT NULL,
    obra_nombre_obra text,
    obra_direccion_obra text,
    obra_comuna text,
    obra_region text,
    obra_tipo_obra text,
    obra_fecha_de_creacion date,
    obra_fecha_de_ultima_edicion date,
    obra_estado text,
    obra_cantidad_puerta integer,
    obra_referencia text,
    obra_observaciones text,
    rut_cliente character varying(12),
    id_especificacion_puerta bigint
);


--
-- Name: obra_obra_obra_id_seq; Type: SEQUENCE; Schema: terreno; Owner: -
--

ALTER TABLE terreno.obra ALTER COLUMN obra_obra_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME terreno.obra_obra_obra_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: perfil; Type: TABLE; Schema: terreno; Owner: -
--

CREATE TABLE terreno.perfil (
    perfil_id_perfil bigint NOT NULL,
    perfil_nombre_perfil character varying(150),
    perfil_descripcion text
);


--
-- Name: perfil_perfil_id_perfil_seq; Type: SEQUENCE; Schema: terreno; Owner: -
--

ALTER TABLE terreno.perfil ALTER COLUMN perfil_id_perfil ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME terreno.perfil_perfil_id_perfil_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: perfil_permiso; Type: TABLE; Schema: terreno; Owner: -
--

CREATE TABLE terreno.perfil_permiso (
    perfil_id_perfil bigint NOT NULL,
    permiso_id_permiso bigint NOT NULL,
    perfil_permiso_activo boolean
);


--
-- Name: permiso; Type: TABLE; Schema: terreno; Owner: -
--

CREATE TABLE terreno.permiso (
    permiso_id_permiso bigint NOT NULL,
    permiso_modulo character varying(150),
    permiso_accion character varying(150),
    permiso_descripcion text,
    permiso_nombre_del_permiso character varying(150)
);


--
-- Name: permiso_permiso_id_permiso_seq; Type: SEQUENCE; Schema: terreno; Owner: -
--

ALTER TABLE terreno.permiso ALTER COLUMN permiso_id_permiso ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME terreno.permiso_permiso_id_permiso_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: prestamo_herramientas; Type: TABLE; Schema: terreno; Owner: -
--

CREATE TABLE terreno.prestamo_herramientas (
    prestamo_herramienta_prestamo_herramienta_id bigint CONSTRAINT prestamo_herramientas_prestamo_herramienta_prestamo_he_not_null NOT NULL,
    prestamo_herramienta_fecha_entrega timestamp with time zone,
    prestamo_herramienta_fecha_devolucion timestamp with time zone,
    prestamo_herramienta_cantidad integer,
    prestamo_herramienta_estado_prestamo text,
    prestamo_herramienta_observacion text,
    rut_empleado character varying(12),
    sku_material character varying(16)
);


--
-- Name: prestamo_herramientas_prestamo_herramienta_prestamo_herrami_seq; Type: SEQUENCE; Schema: terreno; Owner: -
--

ALTER TABLE terreno.prestamo_herramientas ALTER COLUMN prestamo_herramienta_prestamo_herramienta_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME terreno.prestamo_herramientas_prestamo_herramienta_prestamo_herrami_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: proyecto; Type: TABLE; Schema: terreno; Owner: -
--

CREATE TABLE terreno.proyecto (
    proyecto_proyecto_id bigint NOT NULL,
    proyecto_codigo_proyecto text,
    proyecto_nombre_referencia text,
    proyecto_fecha_instalacion date,
    proyecto_fecha_ingreso date,
    proyecto_estado_operacional text,
    proyecto_estado_produccion text,
    rut_cliente character varying(12)
);


--
-- Name: proyecto_proyecto_proyecto_id_seq; Type: SEQUENCE; Schema: terreno; Owner: -
--

ALTER TABLE terreno.proyecto ALTER COLUMN proyecto_proyecto_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME terreno.proyecto_proyecto_proyecto_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: receptor; Type: TABLE; Schema: terreno; Owner: -
--

CREATE TABLE terreno.receptor (
    receptor_receptor_id bigint NOT NULL,
    receptor_primer_nombre_receptor text,
    receptor_segundo_nombre_receptor text,
    receptor_primer_apellido_receptor text,
    receptor_segundo_apellido_receptor text,
    receptor_rut_receptor text,
    id_tarea bigint
);


--
-- Name: receptor_receptor_receptor_id_seq; Type: SEQUENCE; Schema: terreno; Owner: -
--

ALTER TABLE terreno.receptor ALTER COLUMN receptor_receptor_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME terreno.receptor_receptor_receptor_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: servicio_terreno; Type: TABLE; Schema: terreno; Owner: -
--

CREATE TABLE terreno.servicio_terreno (
    servicio_terreno_servicio_terreno_id bigint NOT NULL,
    servicio_terreno_tipo_servicio character varying(50),
    servicio_terreno_fecha_real date,
    servicio_terreno_bloque_horario time without time zone,
    servicio_terreno_prioridad text,
    servicio_terreno_fecha_programada time without time zone,
    servicio_terreno_estado text,
    servicio_terreno_observaciones text,
    id_usuario bigint,
    id_checklist_de_materials bigint
);


--
-- Name: servicio_terreno_servicio_terreno_servicio_terreno_id_seq; Type: SEQUENCE; Schema: terreno; Owner: -
--

ALTER TABLE terreno.servicio_terreno ALTER COLUMN servicio_terreno_servicio_terreno_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME terreno.servicio_terreno_servicio_terreno_servicio_terreno_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: servicio_tterreno_herramientas_materiales; Type: TABLE; Schema: terreno; Owner: -
--

CREATE TABLE terreno.servicio_tterreno_herramientas_materiales (
    id_servicio_terreno_herr_material bigint CONSTRAINT servicio_tterreno_herramien_id_servicio_terreno_herr_m_not_null NOT NULL,
    servicio_terreno_herramientas_materiales_servicio_terreno_id bigint CONSTRAINT servicio_tterreno_herramien_servicio_terreno_herramien_not_null NOT NULL
);


--
-- Name: tarea; Type: TABLE; Schema: terreno; Owner: -
--

CREATE TABLE terreno.tarea (
    tarea_tarea_id bigint NOT NULL,
    tarea_descripcion text,
    tarea_fecha_de_visita date,
    tarea_fecha_de_termino date,
    tarea_bloque_horario timestamp with time zone,
    tarea_fecha_de_creacion date,
    tarea_fecha_de_ultima_actualizacion date,
    tarea_fecha_de_inicio date,
    tarea_fecha_de_inicio_en_terreno date,
    tarea_titulo text,
    tarea_horario_limite timestamp with time zone,
    tarea_instrucciones_de_oficina text,
    tarea_urgencia text,
    tarea_estado_de_tarea text,
    id_usuario bigint,
    id_servicio_terreno bigint,
    id_especificacion_puerta bigint
);


--
-- Name: tarea_tarea_tarea_id_seq; Type: SEQUENCE; Schema: terreno; Owner: -
--

ALTER TABLE terreno.tarea ALTER COLUMN tarea_tarea_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME terreno.tarea_tarea_tarea_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: tarea_tipo; Type: TABLE; Schema: terreno; Owner: -
--

CREATE TABLE terreno.tarea_tipo (
    tarea_tipo_tarea_tipo_id bigint NOT NULL,
    tarea_tipo_tiempo_estimado_tarea time without time zone,
    tarea_tipo_remuneracion_tarea integer,
    id_tarea bigint
);


--
-- Name: tarea_tipo_tarea_tipo_tarea_tipo_id_seq; Type: SEQUENCE; Schema: terreno; Owner: -
--

ALTER TABLE terreno.tarea_tipo ALTER COLUMN tarea_tipo_tarea_tipo_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME terreno.tarea_tipo_tarea_tipo_tarea_tipo_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: tarea_usuario; Type: TABLE; Schema: terreno; Owner: -
--

CREATE TABLE terreno.tarea_usuario (
    tarea_usuario_tarea_id bigint NOT NULL,
    tarea_usuario_usuario_id bigint NOT NULL
);


--
-- Name: usuario; Type: TABLE; Schema: terreno; Owner: -
--

CREATE TABLE terreno.usuario (
    usuario_id_usuario bigint NOT NULL,
    usuario_fecha_de_ultima_edicion timestamp with time zone,
    usuario_rut_usuario character varying(12),
    usuario_fecha_de_creacion timestamp with time zone,
    usuario_correo character varying(254),
    usuario_username character varying(100),
    usuario_estado_cuenta character varying(50),
    usuario_fecha_ultima_conexion timestamp with time zone,
    usuario_nombre_completo_primer_nombre_usuario character varying(100),
    usuario_nombre_completo_segundo_nombre_usuario character varying(100),
    usuario_nombre_completo_primer_apellido_usuario character varying(100),
    usuario_nombre_completo_segundo_apellido_usuario character varying(100),
    usuario_es_gerencia boolean,
    gerencia text,
    usuario_es_tecnico boolean,
    tecnico text,
    usuario_es_jop boolean,
    jop text,
    usuario_es_administrador boolean,
    administrador text,
    usuario_es_secretaria boolean,
    secretaria text,
    perfil_id_perfil bigint,
    empleado_rut_empleado character varying(12)
);


--
-- Name: usuario_contrasena; Type: TABLE; Schema: terreno; Owner: -
--

CREATE TABLE terreno.usuario_contrasena (
    usuario_id_usuario bigint NOT NULL,
    usuario_contrasena text NOT NULL
);


--
-- Name: usuario_usuario_id_usuario_seq; Type: SEQUENCE; Schema: terreno; Owner: -
--

ALTER TABLE terreno.usuario ALTER COLUMN usuario_id_usuario ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME terreno.usuario_usuario_id_usuario_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: afp afp_nombre_afp_key; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.afp
    ADD CONSTRAINT afp_nombre_afp_key UNIQUE (nombre_afp);


--
-- Name: afp afp_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.afp
    ADD CONSTRAINT afp_pkey PRIMARY KEY (id_afp);


--
-- Name: alerta_financiera alerta_financiera_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.alerta_financiera
    ADD CONSTRAINT alerta_financiera_pkey PRIMARY KEY (id_alerta_financiera);


--
-- Name: asignacion_pago_cliente asignacion_pago_cliente_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.asignacion_pago_cliente
    ADD CONSTRAINT asignacion_pago_cliente_pkey PRIMARY KEY (id_asignacion_pago_cliente);


--
-- Name: asignacion_pago_proveedor asignacion_pago_proveedor_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.asignacion_pago_proveedor
    ADD CONSTRAINT asignacion_pago_proveedor_pkey PRIMARY KEY (id_asignacion_pago_proveedor);


--
-- Name: cargo cargo_nombre_cargo_key; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.cargo
    ADD CONSTRAINT cargo_nombre_cargo_key UNIQUE (nombre_cargo);


--
-- Name: cargo cargo_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.cargo
    ADD CONSTRAINT cargo_pkey PRIMARY KEY (id_cargo);


--
-- Name: cliente_financiero cliente_financiero_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.cliente_financiero
    ADD CONSTRAINT cliente_financiero_pkey PRIMARY KEY (id_cliente_financiero);


--
-- Name: cliente_financiero cliente_financiero_rut_cliente_key; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.cliente_financiero
    ADD CONSTRAINT cliente_financiero_rut_cliente_key UNIQUE (rut_cliente);


--
-- Name: concepto_remuneracion concepto_remuneracion_nombre_concepto_key; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.concepto_remuneracion
    ADD CONSTRAINT concepto_remuneracion_nombre_concepto_key UNIQUE (nombre_concepto);


--
-- Name: concepto_remuneracion concepto_remuneracion_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.concepto_remuneracion
    ADD CONSTRAINT concepto_remuneracion_pkey PRIMARY KEY (id_concepto_remuneracion);


--
-- Name: conciliacion conciliacion_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.conciliacion
    ADD CONSTRAINT conciliacion_pkey PRIMARY KEY (id_conciliacion);


--
-- Name: costo_proyecto costo_proyecto_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.costo_proyecto
    ADD CONSTRAINT costo_proyecto_pkey PRIMARY KEY (id_costo_proyecto);


--
-- Name: cotizacion cotizacion_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.cotizacion
    ADD CONSTRAINT cotizacion_pkey PRIMARY KEY (id_cotizacion);


--
-- Name: credito_proyecto credito_proyecto_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.credito_proyecto
    ADD CONSTRAINT credito_proyecto_pkey PRIMARY KEY (id_credito_proyecto);


--
-- Name: detalle_conciliacion detalle_conciliacion_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.detalle_conciliacion
    ADD CONSTRAINT detalle_conciliacion_pkey PRIMARY KEY (id_detalle_conciliacion);


--
-- Name: detalle_costo_material_cotizacion detalle_costo_material_cotizacion_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.detalle_costo_material_cotizacion
    ADD CONSTRAINT detalle_costo_material_cotizacion_pkey PRIMARY KEY (id_detalle_costo_material_cotizacion);


--
-- Name: detalle_costo_proyecto_documento_proveedor detalle_costo_proyecto_documento_proveedor_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.detalle_costo_proyecto_documento_proveedor
    ADD CONSTRAINT detalle_costo_proyecto_documento_proveedor_pkey PRIMARY KEY (id_detalle_costo_proyecto_documento_proveedor);


--
-- Name: detalle_cotizacion detalle_cotizacion_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.detalle_cotizacion
    ADD CONSTRAINT detalle_cotizacion_pkey PRIMARY KEY (id_detalle_cotizacion);


--
-- Name: detalle_documento_compra_proveedor detalle_documento_compra_proveedor_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.detalle_documento_compra_proveedor
    ADD CONSTRAINT detalle_documento_compra_proveedor_pkey PRIMARY KEY (id_detalle_documento_compra_proveedor);


--
-- Name: detalle_evento_auditoria detalle_evento_auditoria_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.detalle_evento_auditoria
    ADD CONSTRAINT detalle_evento_auditoria_pkey PRIMARY KEY (id_detalle_evento_auditoria);


--
-- Name: detalle_liquidacion_remuneracion detalle_liquidacion_remuneracion_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.detalle_liquidacion_remuneracion
    ADD CONSTRAINT detalle_liquidacion_remuneracion_pkey PRIMARY KEY (id_detalle_liquidacion_remuneracion);


--
-- Name: documento_compra_proveedor documento_compra_proveedor_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.documento_compra_proveedor
    ADD CONSTRAINT documento_compra_proveedor_pkey PRIMARY KEY (id_documento_compra_proveedor);


--
-- Name: documento_tributario documento_tributario_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.documento_tributario
    ADD CONSTRAINT documento_tributario_pkey PRIMARY KEY (id_documento_tributario);


--
-- Name: empleado empleado_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.empleado
    ADD CONSTRAINT empleado_pkey PRIMARY KEY (rut_empleado);


--
-- Name: evaluacion_credito evaluacion_credito_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.evaluacion_credito
    ADD CONSTRAINT evaluacion_credito_pkey PRIMARY KEY (id_evaluacion_credito);


--
-- Name: evento_auditoria evento_auditoria_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.evento_auditoria
    ADD CONSTRAINT evento_auditoria_pkey PRIMARY KEY (id_evento_auditoria);


--
-- Name: ficha_cliente ficha_cliente_id_cliente_financiero_key; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.ficha_cliente
    ADD CONSTRAINT ficha_cliente_id_cliente_financiero_key UNIQUE (id_cliente_financiero);


--
-- Name: ficha_cliente ficha_cliente_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.ficha_cliente
    ADD CONSTRAINT ficha_cliente_pkey PRIMARY KEY (id_ficha_cliente);


--
-- Name: fondo_global_credito fondo_global_credito_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.fondo_global_credito
    ADD CONSTRAINT fondo_global_credito_pkey PRIMARY KEY (id_fondo_global_credito);


--
-- Name: gasto_caja_chica gasto_caja_chica_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.gasto_caja_chica
    ADD CONSTRAINT gasto_caja_chica_pkey PRIMARY KEY (id_gasto_caja_chica);


--
-- Name: historial_precio_material historial_precio_material_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.historial_precio_material
    ADD CONSTRAINT historial_precio_material_pkey PRIMARY KEY (id_historial_precio_material);


--
-- Name: historial_tarifa_tarea historial_tarifa_tarea_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.historial_tarifa_tarea
    ADD CONSTRAINT historial_tarifa_tarea_pkey PRIMARY KEY (id_historial_tarifa_tarea);


--
-- Name: hito_cobro hito_cobro_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.hito_cobro
    ADD CONSTRAINT hito_cobro_pkey PRIMARY KEY (id_hito_cobro);


--
-- Name: limite_credito_cliente limite_credito_cliente_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.limite_credito_cliente
    ADD CONSTRAINT limite_credito_cliente_pkey PRIMARY KEY (id_limite_credito_cliente);


--
-- Name: liquidacion_remuneracion liquidacion_remuneracion_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.liquidacion_remuneracion
    ADD CONSTRAINT liquidacion_remuneracion_pkey PRIMARY KEY (id_liquidacion_remuneracion);


--
-- Name: medio_pago medio_pago_nombre_medio_pago_key; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.medio_pago
    ADD CONSTRAINT medio_pago_nombre_medio_pago_key UNIQUE (nombre_medio_pago);


--
-- Name: medio_pago medio_pago_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.medio_pago
    ADD CONSTRAINT medio_pago_pkey PRIMARY KEY (id_medio_pago);


--
-- Name: moneda moneda_codigo_moneda_key; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.moneda
    ADD CONSTRAINT moneda_codigo_moneda_key UNIQUE (codigo_moneda);


--
-- Name: moneda moneda_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.moneda
    ADD CONSTRAINT moneda_pkey PRIMARY KEY (id_moneda);


--
-- Name: movimiento_bancario movimiento_bancario_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.movimiento_bancario
    ADD CONSTRAINT movimiento_bancario_pkey PRIMARY KEY (id_movimiento_bancario);


--
-- Name: movimiento_financiero movimiento_financiero_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.movimiento_financiero
    ADD CONSTRAINT movimiento_financiero_pkey PRIMARY KEY (id_movimiento_financiero);


--
-- Name: nota_venta nota_venta_numero_nota_venta_key; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.nota_venta
    ADD CONSTRAINT nota_venta_numero_nota_venta_key UNIQUE (numero_nota_venta);


--
-- Name: nota_venta nota_venta_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.nota_venta
    ADD CONSTRAINT nota_venta_pkey PRIMARY KEY (id_nota_venta);


--
-- Name: origen_alerta_financiera origen_alerta_financiera_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.origen_alerta_financiera
    ADD CONSTRAINT origen_alerta_financiera_pkey PRIMARY KEY (id_origen_alerta_financiera);


--
-- Name: origen_movimiento_financiero origen_movimiento_financiero_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.origen_movimiento_financiero
    ADD CONSTRAINT origen_movimiento_financiero_pkey PRIMARY KEY (id_origen_movimiento_financiero);


--
-- Name: pago_cliente pago_cliente_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.pago_cliente
    ADD CONSTRAINT pago_cliente_pkey PRIMARY KEY (id_pago_cliente);


--
-- Name: pago_proveedor pago_proveedor_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.pago_proveedor
    ADD CONSTRAINT pago_proveedor_pkey PRIMARY KEY (id_pago_proveedor);


--
-- Name: pais pais_nombre_pais_key; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.pais
    ADD CONSTRAINT pais_nombre_pais_key UNIQUE (nombre_pais);


--
-- Name: pais pais_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.pais
    ADD CONSTRAINT pais_pkey PRIMARY KEY (id_pais);


--
-- Name: prevision_salud prevision_salud_nombre_prevision_salud_key; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.prevision_salud
    ADD CONSTRAINT prevision_salud_nombre_prevision_salud_key UNIQUE (nombre_prevision_salud);


--
-- Name: prevision_salud prevision_salud_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.prevision_salud
    ADD CONSTRAINT prevision_salud_pkey PRIMARY KEY (id_prevision_salud);


--
-- Name: proveedor proveedor_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.proveedor
    ADD CONSTRAINT proveedor_pkey PRIMARY KEY (id_proveedor);


--
-- Name: proyecto_financiero proyecto_financiero_codigo_proyecto_financiero_key; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.proyecto_financiero
    ADD CONSTRAINT proyecto_financiero_codigo_proyecto_financiero_key UNIQUE (codigo_proyecto_financiero);


--
-- Name: proyecto_financiero proyecto_financiero_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.proyecto_financiero
    ADD CONSTRAINT proyecto_financiero_pkey PRIMARY KEY (id_proyecto_financiero);


--
-- Name: tarea_catalogada tarea_catalogada_nombre_tarea_key; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.tarea_catalogada
    ADD CONSTRAINT tarea_catalogada_nombre_tarea_key UNIQUE (nombre_tarea);


--
-- Name: tarea_catalogada tarea_catalogada_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.tarea_catalogada
    ADD CONSTRAINT tarea_catalogada_pkey PRIMARY KEY (id_tarea_catalogada);


--
-- Name: tarea_remunerable tarea_remunerable_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.tarea_remunerable
    ADD CONSTRAINT tarea_remunerable_pkey PRIMARY KEY (id_tarea_remunerable);


--
-- Name: tipo_cliente_financiero tipo_cliente_financiero_nombre_tipo_cliente_financiero_key; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.tipo_cliente_financiero
    ADD CONSTRAINT tipo_cliente_financiero_nombre_tipo_cliente_financiero_key UNIQUE (nombre_tipo_cliente_financiero);


--
-- Name: tipo_cliente_financiero tipo_cliente_financiero_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.tipo_cliente_financiero
    ADD CONSTRAINT tipo_cliente_financiero_pkey PRIMARY KEY (id_tipo_cliente_financiero);


--
-- Name: tipo_documento tipo_documento_nombre_tipo_documento_key; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.tipo_documento
    ADD CONSTRAINT tipo_documento_nombre_tipo_documento_key UNIQUE (nombre_tipo_documento);


--
-- Name: tipo_documento tipo_documento_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.tipo_documento
    ADD CONSTRAINT tipo_documento_pkey PRIMARY KEY (id_tipo_documento);


--
-- Name: tipo_identificador tipo_identificador_nombre_tipo_identificador_key; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.tipo_identificador
    ADD CONSTRAINT tipo_identificador_nombre_tipo_identificador_key UNIQUE (nombre_tipo_identificador);


--
-- Name: tipo_identificador tipo_identificador_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.tipo_identificador
    ADD CONSTRAINT tipo_identificador_pkey PRIMARY KEY (id_tipo_identificador);


--
-- Name: tipo_vinculo_laboral tipo_vinculo_laboral_nombre_tipo_vinculo_laboral_key; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.tipo_vinculo_laboral
    ADD CONSTRAINT tipo_vinculo_laboral_nombre_tipo_vinculo_laboral_key UNIQUE (nombre_tipo_vinculo_laboral);


--
-- Name: tipo_vinculo_laboral tipo_vinculo_laboral_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.tipo_vinculo_laboral
    ADD CONSTRAINT tipo_vinculo_laboral_pkey PRIMARY KEY (id_tipo_vinculo_laboral);


--
-- Name: documento_compra_proveedor uq_documento_compra_proveedor_numero; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.documento_compra_proveedor
    ADD CONSTRAINT uq_documento_compra_proveedor_numero UNIQUE (id_proveedor, numero_documento, id_tipo_documento);


--
-- Name: documento_tributario uq_documento_tributario_folio; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.documento_tributario
    ADD CONSTRAINT uq_documento_tributario_folio UNIQUE (id_tipo_documento, folio_documento);


--
-- Name: liquidacion_remuneracion uq_liquidacion_remuneracion_periodo; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.liquidacion_remuneracion
    ADD CONSTRAINT uq_liquidacion_remuneracion_periodo UNIQUE (rut_empleado, periodo_liquidacion);


--
-- Name: proveedor uq_proveedor_identificador; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.proveedor
    ADD CONSTRAINT uq_proveedor_identificador UNIQUE (id_tipo_identificador, identificador_tributario);


--
-- Name: alerta_faltante_pedido pk_alerta_faltante_pedido; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.alerta_faltante_pedido
    ADD CONSTRAINT pk_alerta_faltante_pedido PRIMARY KEY (alerta_faltante_pedido_id_alerta_faltante);


--
-- Name: alerta_inventario pk_alerta_inventario; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.alerta_inventario
    ADD CONSTRAINT pk_alerta_inventario PRIMARY KEY (alerta_inventario_id_alerta);


--
-- Name: alerta_inventario_nivel_prioridad pk_alerta_inventario_nivel_prioridad; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.alerta_inventario_nivel_prioridad
    ADD CONSTRAINT pk_alerta_inventario_nivel_prioridad PRIMARY KEY (alerta_inventario_nivel_prioridad_id_nivel_prioridad);


--
-- Name: alerta_inventario_tipo_alerta pk_alerta_inventario_tipo_alerta; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.alerta_inventario_tipo_alerta
    ADD CONSTRAINT pk_alerta_inventario_tipo_alerta PRIMARY KEY (alerta_inventario_tipo_alerta_id_tipo_alerta);


--
-- Name: anaquel pk_anaquel; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.anaquel
    ADD CONSTRAINT pk_anaquel PRIMARY KEY (anaquel_id_anaquel);


--
-- Name: bodega pk_bodega; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.bodega
    ADD CONSTRAINT pk_bodega PRIMARY KEY (bodega_id_bodega);


--
-- Name: factura_compra pk_factura_compra; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.factura_compra
    ADD CONSTRAINT pk_factura_compra PRIMARY KEY (factura_compra_id_factura);


--
-- Name: factura_compra_tipo_cambio pk_factura_compra_tipo_cambio; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.factura_compra_tipo_cambio
    ADD CONSTRAINT pk_factura_compra_tipo_cambio PRIMARY KEY (factura_compra_tipo_cambio_id_tipo_cambio);


--
-- Name: historial_alerta pk_historial_alerta; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.historial_alerta
    ADD CONSTRAINT pk_historial_alerta PRIMARY KEY (historial_alerta_id_historial);


--
-- Name: insumo_estandar_proceso pk_insumo_estandar_proceso; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.insumo_estandar_proceso
    ADD CONSTRAINT pk_insumo_estandar_proceso PRIMARY KEY (insumo_estandar_proceso_id_insumo_estandar);


--
-- Name: inventario_bodega pk_inventario_bodega; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.inventario_bodega
    ADD CONSTRAINT pk_inventario_bodega PRIMARY KEY (material_sku, lote_id_lote, bodega_id_bodega);


--
-- Name: lote pk_lote; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.lote
    ADD CONSTRAINT pk_lote PRIMARY KEY (lote_id_lote);


--
-- Name: lote_fecha_pedido pk_lote_fecha_pedido; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.lote_fecha_pedido
    ADD CONSTRAINT pk_lote_fecha_pedido PRIMARY KEY (lote_fecha_pedido_id);


--
-- Name: material pk_material; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.material
    ADD CONSTRAINT pk_material PRIMARY KEY (material_sku);


--
-- Name: material_categoria_funcional pk_material_categoria_funcional; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.material_categoria_funcional
    ADD CONSTRAINT pk_material_categoria_funcional PRIMARY KEY (material_categoria_funcional_id_categoria_funcional);


--
-- Name: material_categoria_general pk_material_categoria_general; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.material_categoria_general
    ADD CONSTRAINT pk_material_categoria_general PRIMARY KEY (material_categoria_general_id_categoria_general);


--
-- Name: material_clasificacion_categoria pk_material_clasificacion_categoria; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.material_clasificacion_categoria
    ADD CONSTRAINT pk_material_clasificacion_categoria PRIMARY KEY (material_clasificacion_categoria_id);


--
-- Name: material_clasificacion_nivel_especifico pk_material_clasificacion_nivel_especifico; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.material_clasificacion_nivel_especifico
    ADD CONSTRAINT pk_material_clasificacion_nivel_especifico PRIMARY KEY (material_clasificacion_nivel_especifico_id);


--
-- Name: material_clasificacion_subcategoria pk_material_clasificacion_subcategoria; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.material_clasificacion_subcategoria
    ADD CONSTRAINT pk_material_clasificacion_subcategoria PRIMARY KEY (material_clasificacion_subcategoria_id);


--
-- Name: material_codigo_barras pk_material_codigo_barras; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.material_codigo_barras
    ADD CONSTRAINT pk_material_codigo_barras PRIMARY KEY (material_sku, material_codigo_barras);


--
-- Name: material_orden_trabajo pk_material_orden_trabajo; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.material_orden_trabajo
    ADD CONSTRAINT pk_material_orden_trabajo PRIMARY KEY (material_sku, orden_trabajo_id_orden);


--
-- Name: material_producto_terminado pk_material_producto_terminado; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.material_producto_terminado
    ADD CONSTRAINT pk_material_producto_terminado PRIMARY KEY (material_sku, producto_terminado_id_producto);


--
-- Name: material_proveedor pk_material_proveedor; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.material_proveedor
    ADD CONSTRAINT pk_material_proveedor PRIMARY KEY (material_sku, proveedor_id_proveedor);


--
-- Name: material_unidad_medida pk_material_unidad_medida; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.material_unidad_medida
    ADD CONSTRAINT pk_material_unidad_medida PRIMARY KEY (material_unidad_medida_id_unidad_medida);


--
-- Name: movimiento_inventario pk_movimiento_inventario; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.movimiento_inventario
    ADD CONSTRAINT pk_movimiento_inventario PRIMARY KEY (movimiento_inventario_id_movimiento);


--
-- Name: movimiento_inventario_clasificacion_salida pk_movimiento_inventario_clasificacion_salida; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.movimiento_inventario_clasificacion_salida
    ADD CONSTRAINT pk_movimiento_inventario_clasificacion_salida PRIMARY KEY (id_clasificacion_salida);


--
-- Name: movimiento_inventario_motivo_movimiento pk_movimiento_inventario_motivo_movimiento; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.movimiento_inventario_motivo_movimiento
    ADD CONSTRAINT pk_movimiento_inventario_motivo_movimiento PRIMARY KEY (movimiento_inventario_motivo_movimiento_id_motivo_movimiento);


--
-- Name: movimiento_inventario_tipo_movimiento pk_movimiento_inventario_tipo_movimiento; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.movimiento_inventario_tipo_movimiento
    ADD CONSTRAINT pk_movimiento_inventario_tipo_movimiento PRIMARY KEY (movimiento_inventario_tipo_movimiento_id_tipo_movimiento);


--
-- Name: notificacion pk_notificacion; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.notificacion
    ADD CONSTRAINT pk_notificacion PRIMARY KEY (notificacion_id_notificacion);


--
-- Name: orden_trabajo pk_orden_trabajo; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.orden_trabajo
    ADD CONSTRAINT pk_orden_trabajo PRIMARY KEY (orden_trabajo_id_orden);


--
-- Name: preparacion_pedido pk_preparacion_pedido; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.preparacion_pedido
    ADD CONSTRAINT pk_preparacion_pedido PRIMARY KEY (preparacion_pedido_id_preparacion);


--
-- Name: preparacion_pedido_estado pk_preparacion_pedido_estado; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.preparacion_pedido_estado
    ADD CONSTRAINT pk_preparacion_pedido_estado PRIMARY KEY (preparacion_pedido_estado_id_estado_preparacion);


--
-- Name: producto_terminado pk_producto_terminado; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.producto_terminado
    ADD CONSTRAINT pk_producto_terminado PRIMARY KEY (producto_terminado_id_producto);


--
-- Name: proveedor_contacto_correo pk_proveedor_contacto_correo; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.proveedor_contacto_correo
    ADD CONSTRAINT pk_proveedor_contacto_correo PRIMARY KEY (proveedor_id_proveedor, proveedor_contacto_correo);


--
-- Name: proveedor_contacto_telefono pk_proveedor_contacto_telefono; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.proveedor_contacto_telefono
    ADD CONSTRAINT pk_proveedor_contacto_telefono PRIMARY KEY (proveedor_id_proveedor, proveedor_contacto_telefono);


--
-- Name: reporte pk_reporte; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.reporte
    ADD CONSTRAINT pk_reporte PRIMARY KEY (reporte_id_reporte);


--
-- Name: reporte_movimiento_inventario pk_reporte_movimiento_inventario; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.reporte_movimiento_inventario
    ADD CONSTRAINT pk_reporte_movimiento_inventario PRIMARY KEY (movimiento_inventario_id_movimiento, reporte_id_reporte);


--
-- Name: reserva_inventario pk_reserva_inventario; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.reserva_inventario
    ADD CONSTRAINT pk_reserva_inventario PRIMARY KEY (reserva_inventario_id_reserva);


--
-- Name: adicionales_pagados pk_adicionales_pagados; Type: CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.adicionales_pagados
    ADD CONSTRAINT pk_adicionales_pagados PRIMARY KEY (adicionales_pagados_id_adicionales);


--
-- Name: area_trabajo pk_area_trabajo; Type: CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.area_trabajo
    ADD CONSTRAINT pk_area_trabajo PRIMARY KEY (area_trabajo_id_area);


--
-- Name: checklist_de_materiales pk_checklist_de_materiales; Type: CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.checklist_de_materiales
    ADD CONSTRAINT pk_checklist_de_materiales PRIMARY KEY (checklist_de_materiales_checklist_de_materials_id);


--
-- Name: cliente pk_cliente; Type: CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.cliente
    ADD CONSTRAINT pk_cliente PRIMARY KEY (cliente_cliente_rut);


--
-- Name: detalles_herraje pk_detalles_herraje; Type: CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.detalles_herraje
    ADD CONSTRAINT pk_detalles_herraje PRIMARY KEY (detalles_herraje_detalle_herraje_id);


--
-- Name: especificacion_metalmecanica pk_especificacion_metalmecanica; Type: CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.especificacion_metalmecanica
    ADD CONSTRAINT pk_especificacion_metalmecanica PRIMARY KEY (especificacion_metalmecanica_id_metalmecanica);


--
-- Name: especificacion_proyecto_terreno pk_especificacion_proyecto_terreno; Type: CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.especificacion_proyecto_terreno
    ADD CONSTRAINT pk_especificacion_proyecto_terreno PRIMARY KEY (id_especificacion_proyecto_terreno);


--
-- Name: especificacion_servicio_terreno pk_especificacion_servicio_terreno; Type: CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.especificacion_servicio_terreno
    ADD CONSTRAINT pk_especificacion_servicio_terreno PRIMARY KEY (especificacion_servicio_terreno_servicio_terreno_id, especificacion_servicio_terreno_especificacion_puerta_id);


--
-- Name: especificacion_terminaciones pk_especificacion_terminaciones; Type: CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.especificacion_terminaciones
    ADD CONSTRAINT pk_especificacion_terminaciones PRIMARY KEY (especificacion_terminaciones_id_terminacion);


--
-- Name: especificaciones_puerta pk_especificaciones_puerta; Type: CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.especificaciones_puerta
    ADD CONSTRAINT pk_especificaciones_puerta PRIMARY KEY (especificacion_puerta_especificacion_puerta_id);


--
-- Name: evidencia_terreno pk_evidencia_terreno; Type: CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.evidencia_terreno
    ADD CONSTRAINT pk_evidencia_terreno PRIMARY KEY (evidencia_terreno_evidencia_terreno_id);


--
-- Name: formulario_de_cierre pk_formulario_de_cierre; Type: CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.formulario_de_cierre
    ADD CONSTRAINT pk_formulario_de_cierre PRIMARY KEY (formulario_de_cierre_formulario_de_cierre_id);


--
-- Name: historial_cambio_orden_trabajo pk_historial_cambio_orden_trabajo; Type: CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.historial_cambio_orden_trabajo
    ADD CONSTRAINT pk_historial_cambio_orden_trabajo PRIMARY KEY (historial_cambio_orden_trabajo_id_cambio);


--
-- Name: hoja_doble pk_hoja_doble; Type: CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.hoja_doble
    ADD CONSTRAINT pk_hoja_doble PRIMARY KEY (hoja_doble_especificacion_puerta_id);


--
-- Name: hoja_simple pk_hoja_simple; Type: CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.hoja_simple
    ADD CONSTRAINT pk_hoja_simple PRIMARY KEY (hoja_simple_especificacion_puerta_id);


--
-- Name: medidas_puerta pk_medidas_puerta; Type: CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.medidas_puerta
    ADD CONSTRAINT pk_medidas_puerta PRIMARY KEY (medidas_puerta_medidas_id);


--
-- Name: notificacion_tecnico pk_notificacion_tecnico; Type: CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.notificacion_tecnico
    ADD CONSTRAINT pk_notificacion_tecnico PRIMARY KEY (notificacion_tecnico_id_notificacion_tecnico);


--
-- Name: notificacion_terreno pk_notificacion_terreno; Type: CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.notificacion_terreno
    ADD CONSTRAINT pk_notificacion_terreno PRIMARY KEY (notificacion_terreno_id_notificacion_terreno);


--
-- Name: obra pk_obra; Type: CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.obra
    ADD CONSTRAINT pk_obra PRIMARY KEY (obra_obra_id);


--
-- Name: perfil pk_perfil; Type: CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.perfil
    ADD CONSTRAINT pk_perfil PRIMARY KEY (perfil_id_perfil);


--
-- Name: perfil_permiso pk_perfil_permiso; Type: CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.perfil_permiso
    ADD CONSTRAINT pk_perfil_permiso PRIMARY KEY (perfil_id_perfil, permiso_id_permiso);


--
-- Name: permiso pk_permiso; Type: CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.permiso
    ADD CONSTRAINT pk_permiso PRIMARY KEY (permiso_id_permiso);


--
-- Name: prestamo_herramientas pk_prestamo_herramientas; Type: CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.prestamo_herramientas
    ADD CONSTRAINT pk_prestamo_herramientas PRIMARY KEY (prestamo_herramienta_prestamo_herramienta_id);


--
-- Name: proyecto pk_proyecto; Type: CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.proyecto
    ADD CONSTRAINT pk_proyecto PRIMARY KEY (proyecto_proyecto_id);


--
-- Name: receptor pk_receptor; Type: CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.receptor
    ADD CONSTRAINT pk_receptor PRIMARY KEY (receptor_receptor_id);


--
-- Name: servicio_terreno pk_servicio_terreno; Type: CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.servicio_terreno
    ADD CONSTRAINT pk_servicio_terreno PRIMARY KEY (servicio_terreno_servicio_terreno_id);


--
-- Name: servicio_tterreno_herramientas_materiales pk_servicio_tterreno_herramientas_materiales; Type: CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.servicio_tterreno_herramientas_materiales
    ADD CONSTRAINT pk_servicio_tterreno_herramientas_materiales PRIMARY KEY (id_servicio_terreno_herr_material, servicio_terreno_herramientas_materiales_servicio_terreno_id);


--
-- Name: tarea pk_tarea; Type: CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.tarea
    ADD CONSTRAINT pk_tarea PRIMARY KEY (tarea_tarea_id);


--
-- Name: tarea_tipo pk_tarea_tipo; Type: CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.tarea_tipo
    ADD CONSTRAINT pk_tarea_tipo PRIMARY KEY (tarea_tipo_tarea_tipo_id);


--
-- Name: tarea_usuario pk_tarea_usuario; Type: CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.tarea_usuario
    ADD CONSTRAINT pk_tarea_usuario PRIMARY KEY (tarea_usuario_tarea_id, tarea_usuario_usuario_id);


--
-- Name: item_comercial pk_terreno_item_comercial; Type: CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.item_comercial
    ADD CONSTRAINT pk_terreno_item_comercial PRIMARY KEY (id_item_comercial);


--
-- Name: usuario pk_usuario; Type: CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.usuario
    ADD CONSTRAINT pk_usuario PRIMARY KEY (usuario_id_usuario);


--
-- Name: usuario_contrasena pk_usuario_contrasena; Type: CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.usuario_contrasena
    ADD CONSTRAINT pk_usuario_contrasena PRIMARY KEY (usuario_id_usuario, usuario_contrasena);


--
-- Name: idx_asignacion_pago_cliente_pago; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX idx_asignacion_pago_cliente_pago ON finanzas.asignacion_pago_cliente USING btree (id_pago_cliente);


--
-- Name: idx_asignacion_pago_proveedor_pago; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX idx_asignacion_pago_proveedor_pago ON finanzas.asignacion_pago_proveedor USING btree (id_pago_proveedor);


--
-- Name: idx_cliente_financiero_tipo; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX idx_cliente_financiero_tipo ON finanzas.cliente_financiero USING btree (id_tipo_cliente_financiero);


--
-- Name: idx_conciliacion_movimientos; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX idx_conciliacion_movimientos ON finanzas.conciliacion USING btree (id_movimiento_financiero, id_movimiento_bancario);


--
-- Name: idx_costo_proyecto_proyecto; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX idx_costo_proyecto_proyecto ON finanzas.costo_proyecto USING btree (id_proyecto_financiero);


--
-- Name: idx_cotizacion_ficha; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX idx_cotizacion_ficha ON finanzas.cotizacion USING btree (id_ficha_cliente);


--
-- Name: idx_credito_proyecto_ficha; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX idx_credito_proyecto_ficha ON finanzas.credito_proyecto USING btree (id_ficha_cliente);


--
-- Name: idx_detalle_costo_material_detalle; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX idx_detalle_costo_material_detalle ON finanzas.detalle_costo_material_cotizacion USING btree (id_detalle_cotizacion);


--
-- Name: idx_detalle_cotizacion_cotizacion; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX idx_detalle_cotizacion_cotizacion ON finanzas.detalle_cotizacion USING btree (id_cotizacion);


--
-- Name: idx_detalle_cotizacion_item; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX idx_detalle_cotizacion_item ON finanzas.detalle_cotizacion USING btree (id_item_comercial);


--
-- Name: idx_detalle_doc_compra_documento; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX idx_detalle_doc_compra_documento ON finanzas.detalle_documento_compra_proveedor USING btree (id_documento_compra_proveedor);


--
-- Name: idx_documento_compra_proveedor_proveedor; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX idx_documento_compra_proveedor_proveedor ON finanzas.documento_compra_proveedor USING btree (id_proveedor);


--
-- Name: idx_documento_tributario_ficha; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX idx_documento_tributario_ficha ON finanzas.documento_tributario USING btree (id_ficha_cliente);


--
-- Name: idx_documento_tributario_nota; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX idx_documento_tributario_nota ON finanzas.documento_tributario USING btree (id_nota_venta);


--
-- Name: idx_empleado_cargo; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX idx_empleado_cargo ON finanzas.empleado USING btree (id_cargo);


--
-- Name: idx_evaluacion_credito_ficha; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX idx_evaluacion_credito_ficha ON finanzas.evaluacion_credito USING btree (id_ficha_cliente);


--
-- Name: idx_evento_auditoria_entidad; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX idx_evento_auditoria_entidad ON finanzas.evento_auditoria USING btree (entidad_afectada, id_registro_afectado);


--
-- Name: idx_evento_auditoria_usuario; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX idx_evento_auditoria_usuario ON finanzas.evento_auditoria USING btree (id_usuario);


--
-- Name: idx_ficha_cliente_cliente; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX idx_ficha_cliente_cliente ON finanzas.ficha_cliente USING btree (id_cliente_financiero);


--
-- Name: idx_historial_precio_material_proveedor; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX idx_historial_precio_material_proveedor ON finanzas.historial_precio_material USING btree (id_proveedor);


--
-- Name: idx_historial_precio_material_sku; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX idx_historial_precio_material_sku ON finanzas.historial_precio_material USING btree (material_sku);


--
-- Name: idx_historial_tarifa_tarea_tarea; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX idx_historial_tarifa_tarea_tarea ON finanzas.historial_tarifa_tarea USING btree (id_tarea_catalogada);


--
-- Name: idx_hito_cobro_nota; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX idx_hito_cobro_nota ON finanzas.hito_cobro USING btree (id_nota_venta);


--
-- Name: idx_limite_credito_ficha; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX idx_limite_credito_ficha ON finanzas.limite_credito_cliente USING btree (id_ficha_cliente);


--
-- Name: idx_liquidacion_empleado_periodo; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX idx_liquidacion_empleado_periodo ON finanzas.liquidacion_remuneracion USING btree (rut_empleado, periodo_liquidacion);


--
-- Name: idx_movimiento_bancario_fecha; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX idx_movimiento_bancario_fecha ON finanzas.movimiento_bancario USING btree (fecha_movimiento_bancario);


--
-- Name: idx_movimiento_financiero_fecha; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX idx_movimiento_financiero_fecha ON finanzas.movimiento_financiero USING btree (fecha_movimiento);


--
-- Name: idx_nota_venta_ficha; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX idx_nota_venta_ficha ON finanzas.nota_venta USING btree (id_ficha_cliente);


--
-- Name: idx_origen_alerta_alerta; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX idx_origen_alerta_alerta ON finanzas.origen_alerta_financiera USING btree (id_alerta_financiera);


--
-- Name: idx_origen_movimiento_financiero_movimiento; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX idx_origen_movimiento_financiero_movimiento ON finanzas.origen_movimiento_financiero USING btree (id_movimiento_financiero);


--
-- Name: idx_pago_cliente_ficha; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX idx_pago_cliente_ficha ON finanzas.pago_cliente USING btree (id_ficha_cliente);


--
-- Name: idx_pago_proveedor_proveedor; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX idx_pago_proveedor_proveedor ON finanzas.pago_proveedor USING btree (id_proveedor);


--
-- Name: idx_proveedor_identificador; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX idx_proveedor_identificador ON finanzas.proveedor USING btree (id_tipo_identificador, identificador_tributario);


--
-- Name: idx_proyecto_financiero_ficha; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX idx_proyecto_financiero_ficha ON finanzas.proyecto_financiero USING btree (id_ficha_cliente);


--
-- Name: idx_proyecto_financiero_terreno; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX idx_proyecto_financiero_terreno ON finanzas.proyecto_financiero USING btree (id_proyecto_terreno);


--
-- Name: idx_tarea_remunerable_empleado; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX idx_tarea_remunerable_empleado ON finanzas.tarea_remunerable USING btree (rut_empleado);


--
-- Name: idx_tarea_remunerable_orden; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX idx_tarea_remunerable_orden ON finanzas.tarea_remunerable USING btree (id_orden_trabajo);


--
-- Name: asignacion_pago_cliente fk_asignacion_pago_cliente_documento; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.asignacion_pago_cliente
    ADD CONSTRAINT fk_asignacion_pago_cliente_documento FOREIGN KEY (id_documento_tributario) REFERENCES finanzas.documento_tributario(id_documento_tributario) ON DELETE RESTRICT;


--
-- Name: asignacion_pago_cliente fk_asignacion_pago_cliente_hito; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.asignacion_pago_cliente
    ADD CONSTRAINT fk_asignacion_pago_cliente_hito FOREIGN KEY (id_hito_cobro) REFERENCES finanzas.hito_cobro(id_hito_cobro) ON DELETE RESTRICT;


--
-- Name: asignacion_pago_cliente fk_asignacion_pago_cliente_nota; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.asignacion_pago_cliente
    ADD CONSTRAINT fk_asignacion_pago_cliente_nota FOREIGN KEY (id_nota_venta) REFERENCES finanzas.nota_venta(id_nota_venta) ON DELETE RESTRICT;


--
-- Name: asignacion_pago_cliente fk_asignacion_pago_cliente_pago; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.asignacion_pago_cliente
    ADD CONSTRAINT fk_asignacion_pago_cliente_pago FOREIGN KEY (id_pago_cliente) REFERENCES finanzas.pago_cliente(id_pago_cliente) ON DELETE RESTRICT;


--
-- Name: asignacion_pago_proveedor fk_asignacion_pago_proveedor_documento; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.asignacion_pago_proveedor
    ADD CONSTRAINT fk_asignacion_pago_proveedor_documento FOREIGN KEY (id_documento_compra_proveedor) REFERENCES finanzas.documento_compra_proveedor(id_documento_compra_proveedor) ON DELETE RESTRICT;


--
-- Name: asignacion_pago_proveedor fk_asignacion_pago_proveedor_pago; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.asignacion_pago_proveedor
    ADD CONSTRAINT fk_asignacion_pago_proveedor_pago FOREIGN KEY (id_pago_proveedor) REFERENCES finanzas.pago_proveedor(id_pago_proveedor) ON DELETE RESTRICT;


--
-- Name: cliente_financiero fk_cli_fin_cliente_ext; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.cliente_financiero
    ADD CONSTRAINT fk_cli_fin_cliente_ext FOREIGN KEY (rut_cliente) REFERENCES terreno.cliente(cliente_cliente_rut) ON DELETE RESTRICT;


--
-- Name: cliente_financiero fk_cliente_financiero_tipo_cliente; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.cliente_financiero
    ADD CONSTRAINT fk_cliente_financiero_tipo_cliente FOREIGN KEY (id_tipo_cliente_financiero) REFERENCES finanzas.tipo_cliente_financiero(id_tipo_cliente_financiero) ON DELETE RESTRICT;


--
-- Name: conciliacion fk_conciliacion_movimiento_bancario; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.conciliacion
    ADD CONSTRAINT fk_conciliacion_movimiento_bancario FOREIGN KEY (id_movimiento_bancario) REFERENCES finanzas.movimiento_bancario(id_movimiento_bancario) ON DELETE RESTRICT;


--
-- Name: conciliacion fk_conciliacion_movimiento_financiero; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.conciliacion
    ADD CONSTRAINT fk_conciliacion_movimiento_financiero FOREIGN KEY (id_movimiento_financiero) REFERENCES finanzas.movimiento_financiero(id_movimiento_financiero) ON DELETE RESTRICT;


--
-- Name: costo_proyecto fk_costo_proyecto_moneda; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.costo_proyecto
    ADD CONSTRAINT fk_costo_proyecto_moneda FOREIGN KEY (id_moneda) REFERENCES finanzas.moneda(id_moneda) ON DELETE RESTRICT;


--
-- Name: costo_proyecto fk_costo_proyecto_proyecto; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.costo_proyecto
    ADD CONSTRAINT fk_costo_proyecto_proyecto FOREIGN KEY (id_proyecto_financiero) REFERENCES finanzas.proyecto_financiero(id_proyecto_financiero) ON DELETE RESTRICT;


--
-- Name: cotizacion fk_cotizacion_ficha_cliente; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.cotizacion
    ADD CONSTRAINT fk_cotizacion_ficha_cliente FOREIGN KEY (id_ficha_cliente) REFERENCES finanzas.ficha_cliente(id_ficha_cliente) ON DELETE RESTRICT;


--
-- Name: cotizacion fk_cotizacion_moneda; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.cotizacion
    ADD CONSTRAINT fk_cotizacion_moneda FOREIGN KEY (id_moneda) REFERENCES finanzas.moneda(id_moneda) ON DELETE RESTRICT;


--
-- Name: credito_proyecto fk_credito_proyecto_evaluacion; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.credito_proyecto
    ADD CONSTRAINT fk_credito_proyecto_evaluacion FOREIGN KEY (id_evaluacion_credito) REFERENCES finanzas.evaluacion_credito(id_evaluacion_credito) ON DELETE RESTRICT;


--
-- Name: credito_proyecto fk_credito_proyecto_ficha_cliente; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.credito_proyecto
    ADD CONSTRAINT fk_credito_proyecto_ficha_cliente FOREIGN KEY (id_ficha_cliente) REFERENCES finanzas.ficha_cliente(id_ficha_cliente) ON DELETE RESTRICT;


--
-- Name: credito_proyecto fk_credito_proyecto_fondo; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.credito_proyecto
    ADD CONSTRAINT fk_credito_proyecto_fondo FOREIGN KEY (id_fondo_global_credito) REFERENCES finanzas.fondo_global_credito(id_fondo_global_credito) ON DELETE RESTRICT;


--
-- Name: credito_proyecto fk_credito_proyecto_limite; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.credito_proyecto
    ADD CONSTRAINT fk_credito_proyecto_limite FOREIGN KEY (id_limite_credito_cliente) REFERENCES finanzas.limite_credito_cliente(id_limite_credito_cliente) ON DELETE RESTRICT;


--
-- Name: credito_proyecto fk_credito_proyecto_proyecto; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.credito_proyecto
    ADD CONSTRAINT fk_credito_proyecto_proyecto FOREIGN KEY (id_proyecto_financiero) REFERENCES finanzas.proyecto_financiero(id_proyecto_financiero) ON DELETE RESTRICT;


--
-- Name: detalle_cotizacion fk_det_cot_item_ext; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.detalle_cotizacion
    ADD CONSTRAINT fk_det_cot_item_ext FOREIGN KEY (id_item_comercial) REFERENCES terreno.item_comercial(id_item_comercial) ON DELETE RESTRICT;


--
-- Name: detalle_conciliacion fk_detalle_conciliacion_conciliacion; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.detalle_conciliacion
    ADD CONSTRAINT fk_detalle_conciliacion_conciliacion FOREIGN KEY (id_conciliacion) REFERENCES finanzas.conciliacion(id_conciliacion) ON DELETE RESTRICT;


--
-- Name: detalle_costo_material_cotizacion fk_detalle_costo_material_detalle_cotizacion; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.detalle_costo_material_cotizacion
    ADD CONSTRAINT fk_detalle_costo_material_detalle_cotizacion FOREIGN KEY (id_detalle_cotizacion) REFERENCES finanzas.detalle_cotizacion(id_detalle_cotizacion) ON DELETE RESTRICT;


--
-- Name: detalle_costo_material_cotizacion fk_detalle_costo_material_historial_precio; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.detalle_costo_material_cotizacion
    ADD CONSTRAINT fk_detalle_costo_material_historial_precio FOREIGN KEY (id_historial_precio_material) REFERENCES finanzas.historial_precio_material(id_historial_precio_material) ON DELETE RESTRICT;


--
-- Name: detalle_costo_proyecto_documento_proveedor fk_detalle_costo_proyecto_costo; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.detalle_costo_proyecto_documento_proveedor
    ADD CONSTRAINT fk_detalle_costo_proyecto_costo FOREIGN KEY (id_costo_proyecto) REFERENCES finanzas.costo_proyecto(id_costo_proyecto) ON DELETE RESTRICT;


--
-- Name: detalle_costo_proyecto_documento_proveedor fk_detalle_costo_proyecto_documento; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.detalle_costo_proyecto_documento_proveedor
    ADD CONSTRAINT fk_detalle_costo_proyecto_documento FOREIGN KEY (id_documento_compra_proveedor) REFERENCES finanzas.documento_compra_proveedor(id_documento_compra_proveedor) ON DELETE RESTRICT;


--
-- Name: detalle_cotizacion fk_detalle_cotizacion_cotizacion; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.detalle_cotizacion
    ADD CONSTRAINT fk_detalle_cotizacion_cotizacion FOREIGN KEY (id_cotizacion) REFERENCES finanzas.cotizacion(id_cotizacion) ON DELETE RESTRICT;


--
-- Name: detalle_documento_compra_proveedor fk_detalle_documento_compra_documento; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.detalle_documento_compra_proveedor
    ADD CONSTRAINT fk_detalle_documento_compra_documento FOREIGN KEY (id_documento_compra_proveedor) REFERENCES finanzas.documento_compra_proveedor(id_documento_compra_proveedor) ON DELETE RESTRICT;


--
-- Name: detalle_documento_compra_proveedor fk_detalle_documento_compra_historial; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.detalle_documento_compra_proveedor
    ADD CONSTRAINT fk_detalle_documento_compra_historial FOREIGN KEY (id_historial_precio_material) REFERENCES finanzas.historial_precio_material(id_historial_precio_material) ON DELETE RESTRICT;


--
-- Name: detalle_evento_auditoria fk_detalle_evento_auditoria_evento; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.detalle_evento_auditoria
    ADD CONSTRAINT fk_detalle_evento_auditoria_evento FOREIGN KEY (id_evento_auditoria) REFERENCES finanzas.evento_auditoria(id_evento_auditoria) ON DELETE RESTRICT;


--
-- Name: detalle_liquidacion_remuneracion fk_detalle_liquidacion_concepto; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.detalle_liquidacion_remuneracion
    ADD CONSTRAINT fk_detalle_liquidacion_concepto FOREIGN KEY (id_concepto_remuneracion) REFERENCES finanzas.concepto_remuneracion(id_concepto_remuneracion) ON DELETE RESTRICT;


--
-- Name: detalle_liquidacion_remuneracion fk_detalle_liquidacion_liquidacion; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.detalle_liquidacion_remuneracion
    ADD CONSTRAINT fk_detalle_liquidacion_liquidacion FOREIGN KEY (id_liquidacion_remuneracion) REFERENCES finanzas.liquidacion_remuneracion(id_liquidacion_remuneracion) ON DELETE RESTRICT;


--
-- Name: documento_compra_proveedor fk_documento_compra_proveedor_moneda; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.documento_compra_proveedor
    ADD CONSTRAINT fk_documento_compra_proveedor_moneda FOREIGN KEY (id_moneda) REFERENCES finanzas.moneda(id_moneda) ON DELETE RESTRICT;


--
-- Name: documento_compra_proveedor fk_documento_compra_proveedor_proveedor; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.documento_compra_proveedor
    ADD CONSTRAINT fk_documento_compra_proveedor_proveedor FOREIGN KEY (id_proveedor) REFERENCES finanzas.proveedor(id_proveedor) ON DELETE RESTRICT;


--
-- Name: documento_compra_proveedor fk_documento_compra_proveedor_tipo_documento; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.documento_compra_proveedor
    ADD CONSTRAINT fk_documento_compra_proveedor_tipo_documento FOREIGN KEY (id_tipo_documento) REFERENCES finanzas.tipo_documento(id_tipo_documento) ON DELETE RESTRICT;


--
-- Name: documento_tributario fk_documento_tributario_ficha_cliente; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.documento_tributario
    ADD CONSTRAINT fk_documento_tributario_ficha_cliente FOREIGN KEY (id_ficha_cliente) REFERENCES finanzas.ficha_cliente(id_ficha_cliente) ON DELETE RESTRICT;


--
-- Name: documento_tributario fk_documento_tributario_moneda; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.documento_tributario
    ADD CONSTRAINT fk_documento_tributario_moneda FOREIGN KEY (id_moneda) REFERENCES finanzas.moneda(id_moneda) ON DELETE RESTRICT;


--
-- Name: documento_tributario fk_documento_tributario_nota_venta; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.documento_tributario
    ADD CONSTRAINT fk_documento_tributario_nota_venta FOREIGN KEY (id_nota_venta) REFERENCES finanzas.nota_venta(id_nota_venta) ON DELETE RESTRICT;


--
-- Name: documento_tributario fk_documento_tributario_referencia; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.documento_tributario
    ADD CONSTRAINT fk_documento_tributario_referencia FOREIGN KEY (id_documento_referencia) REFERENCES finanzas.documento_tributario(id_documento_tributario) ON DELETE RESTRICT;


--
-- Name: documento_tributario fk_documento_tributario_tipo_documento; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.documento_tributario
    ADD CONSTRAINT fk_documento_tributario_tipo_documento FOREIGN KEY (id_tipo_documento) REFERENCES finanzas.tipo_documento(id_tipo_documento) ON DELETE RESTRICT;


--
-- Name: empleado fk_empleado_afp; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.empleado
    ADD CONSTRAINT fk_empleado_afp FOREIGN KEY (id_afp) REFERENCES finanzas.afp(id_afp) ON DELETE RESTRICT;


--
-- Name: empleado fk_empleado_cargo; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.empleado
    ADD CONSTRAINT fk_empleado_cargo FOREIGN KEY (id_cargo) REFERENCES finanzas.cargo(id_cargo) ON DELETE RESTRICT;


--
-- Name: empleado fk_empleado_prevision_salud; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.empleado
    ADD CONSTRAINT fk_empleado_prevision_salud FOREIGN KEY (id_prevision_salud) REFERENCES finanzas.prevision_salud(id_prevision_salud) ON DELETE RESTRICT;


--
-- Name: empleado fk_empleado_tipo_vinculo; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.empleado
    ADD CONSTRAINT fk_empleado_tipo_vinculo FOREIGN KEY (id_tipo_vinculo_laboral) REFERENCES finanzas.tipo_vinculo_laboral(id_tipo_vinculo_laboral) ON DELETE RESTRICT;


--
-- Name: evaluacion_credito fk_evaluacion_credito_ficha_cliente; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.evaluacion_credito
    ADD CONSTRAINT fk_evaluacion_credito_ficha_cliente FOREIGN KEY (id_ficha_cliente) REFERENCES finanzas.ficha_cliente(id_ficha_cliente) ON DELETE RESTRICT;


--
-- Name: evento_auditoria fk_evento_aud_usuario_ext; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.evento_auditoria
    ADD CONSTRAINT fk_evento_aud_usuario_ext FOREIGN KEY (id_usuario) REFERENCES terreno.usuario(usuario_id_usuario) ON DELETE RESTRICT;


--
-- Name: ficha_cliente fk_ficha_cliente_cliente_financiero; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.ficha_cliente
    ADD CONSTRAINT fk_ficha_cliente_cliente_financiero FOREIGN KEY (id_cliente_financiero) REFERENCES finanzas.cliente_financiero(id_cliente_financiero) ON DELETE RESTRICT;


--
-- Name: historial_precio_material fk_historial_precio_material_moneda; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.historial_precio_material
    ADD CONSTRAINT fk_historial_precio_material_moneda FOREIGN KEY (id_moneda) REFERENCES finanzas.moneda(id_moneda) ON DELETE RESTRICT;


--
-- Name: historial_precio_material fk_historial_precio_material_proveedor; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.historial_precio_material
    ADD CONSTRAINT fk_historial_precio_material_proveedor FOREIGN KEY (id_proveedor) REFERENCES finanzas.proveedor(id_proveedor) ON DELETE RESTRICT;


--
-- Name: historial_tarifa_tarea fk_historial_tarifa_tarea_tarea; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.historial_tarifa_tarea
    ADD CONSTRAINT fk_historial_tarifa_tarea_tarea FOREIGN KEY (id_tarea_catalogada) REFERENCES finanzas.tarea_catalogada(id_tarea_catalogada) ON DELETE RESTRICT;


--
-- Name: hito_cobro fk_hito_cobro_nota_venta; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.hito_cobro
    ADD CONSTRAINT fk_hito_cobro_nota_venta FOREIGN KEY (id_nota_venta) REFERENCES finanzas.nota_venta(id_nota_venta) ON DELETE RESTRICT;


--
-- Name: hito_cobro fk_hito_cobro_proyecto_financiero; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.hito_cobro
    ADD CONSTRAINT fk_hito_cobro_proyecto_financiero FOREIGN KEY (id_proyecto_financiero) REFERENCES finanzas.proyecto_financiero(id_proyecto_financiero) ON DELETE RESTRICT;


--
-- Name: historial_precio_material fk_hpm_material_ext; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.historial_precio_material
    ADD CONSTRAINT fk_hpm_material_ext FOREIGN KEY (material_sku) REFERENCES inventario.material(material_sku) ON DELETE RESTRICT;


--
-- Name: limite_credito_cliente fk_limite_credito_cliente_evaluacion; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.limite_credito_cliente
    ADD CONSTRAINT fk_limite_credito_cliente_evaluacion FOREIGN KEY (id_evaluacion_credito) REFERENCES finanzas.evaluacion_credito(id_evaluacion_credito) ON DELETE RESTRICT;


--
-- Name: limite_credito_cliente fk_limite_credito_cliente_ficha; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.limite_credito_cliente
    ADD CONSTRAINT fk_limite_credito_cliente_ficha FOREIGN KEY (id_ficha_cliente) REFERENCES finanzas.ficha_cliente(id_ficha_cliente) ON DELETE RESTRICT;


--
-- Name: liquidacion_remuneracion fk_liquidacion_remuneracion_empleado; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.liquidacion_remuneracion
    ADD CONSTRAINT fk_liquidacion_remuneracion_empleado FOREIGN KEY (rut_empleado) REFERENCES finanzas.empleado(rut_empleado) ON DELETE RESTRICT;


--
-- Name: movimiento_bancario fk_movimiento_bancario_moneda; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.movimiento_bancario
    ADD CONSTRAINT fk_movimiento_bancario_moneda FOREIGN KEY (id_moneda) REFERENCES finanzas.moneda(id_moneda) ON DELETE RESTRICT;


--
-- Name: movimiento_financiero fk_movimiento_financiero_moneda; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.movimiento_financiero
    ADD CONSTRAINT fk_movimiento_financiero_moneda FOREIGN KEY (id_moneda) REFERENCES finanzas.moneda(id_moneda) ON DELETE RESTRICT;


--
-- Name: nota_venta fk_nota_venta_cotizacion; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.nota_venta
    ADD CONSTRAINT fk_nota_venta_cotizacion FOREIGN KEY (id_cotizacion) REFERENCES finanzas.cotizacion(id_cotizacion) ON DELETE RESTRICT;


--
-- Name: nota_venta fk_nota_venta_ficha_cliente; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.nota_venta
    ADD CONSTRAINT fk_nota_venta_ficha_cliente FOREIGN KEY (id_ficha_cliente) REFERENCES finanzas.ficha_cliente(id_ficha_cliente) ON DELETE RESTRICT;


--
-- Name: nota_venta fk_nota_venta_moneda; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.nota_venta
    ADD CONSTRAINT fk_nota_venta_moneda FOREIGN KEY (id_moneda) REFERENCES finanzas.moneda(id_moneda) ON DELETE RESTRICT;


--
-- Name: origen_alerta_financiera fk_origen_alerta_financiera_alerta; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.origen_alerta_financiera
    ADD CONSTRAINT fk_origen_alerta_financiera_alerta FOREIGN KEY (id_alerta_financiera) REFERENCES finanzas.alerta_financiera(id_alerta_financiera) ON DELETE RESTRICT;


--
-- Name: origen_movimiento_financiero fk_origen_movimiento_financiero_movimiento; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.origen_movimiento_financiero
    ADD CONSTRAINT fk_origen_movimiento_financiero_movimiento FOREIGN KEY (id_movimiento_financiero) REFERENCES finanzas.movimiento_financiero(id_movimiento_financiero) ON DELETE RESTRICT;


--
-- Name: pago_cliente fk_pago_cliente_ficha_cliente; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.pago_cliente
    ADD CONSTRAINT fk_pago_cliente_ficha_cliente FOREIGN KEY (id_ficha_cliente) REFERENCES finanzas.ficha_cliente(id_ficha_cliente) ON DELETE RESTRICT;


--
-- Name: pago_cliente fk_pago_cliente_medio_pago; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.pago_cliente
    ADD CONSTRAINT fk_pago_cliente_medio_pago FOREIGN KEY (id_medio_pago) REFERENCES finanzas.medio_pago(id_medio_pago) ON DELETE RESTRICT;


--
-- Name: pago_cliente fk_pago_cliente_moneda; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.pago_cliente
    ADD CONSTRAINT fk_pago_cliente_moneda FOREIGN KEY (id_moneda) REFERENCES finanzas.moneda(id_moneda) ON DELETE RESTRICT;


--
-- Name: pago_proveedor fk_pago_proveedor_medio_pago; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.pago_proveedor
    ADD CONSTRAINT fk_pago_proveedor_medio_pago FOREIGN KEY (id_medio_pago) REFERENCES finanzas.medio_pago(id_medio_pago) ON DELETE RESTRICT;


--
-- Name: pago_proveedor fk_pago_proveedor_moneda; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.pago_proveedor
    ADD CONSTRAINT fk_pago_proveedor_moneda FOREIGN KEY (id_moneda) REFERENCES finanzas.moneda(id_moneda) ON DELETE RESTRICT;


--
-- Name: pago_proveedor fk_pago_proveedor_proveedor; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.pago_proveedor
    ADD CONSTRAINT fk_pago_proveedor_proveedor FOREIGN KEY (id_proveedor) REFERENCES finanzas.proveedor(id_proveedor) ON DELETE RESTRICT;


--
-- Name: proveedor fk_proveedor_moneda_preferente; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.proveedor
    ADD CONSTRAINT fk_proveedor_moneda_preferente FOREIGN KEY (id_moneda_preferente) REFERENCES finanzas.moneda(id_moneda) ON DELETE RESTRICT;


--
-- Name: proveedor fk_proveedor_pais; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.proveedor
    ADD CONSTRAINT fk_proveedor_pais FOREIGN KEY (id_pais) REFERENCES finanzas.pais(id_pais) ON DELETE RESTRICT;


--
-- Name: proveedor fk_proveedor_tipo_identificador; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.proveedor
    ADD CONSTRAINT fk_proveedor_tipo_identificador FOREIGN KEY (id_tipo_identificador) REFERENCES finanzas.tipo_identificador(id_tipo_identificador) ON DELETE RESTRICT;


--
-- Name: proyecto_financiero fk_proy_fin_terreno_ext; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.proyecto_financiero
    ADD CONSTRAINT fk_proy_fin_terreno_ext FOREIGN KEY (id_proyecto_terreno) REFERENCES terreno.proyecto(proyecto_proyecto_id) ON DELETE RESTRICT;


--
-- Name: proyecto_financiero fk_proyecto_financiero_ficha_cliente; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.proyecto_financiero
    ADD CONSTRAINT fk_proyecto_financiero_ficha_cliente FOREIGN KEY (id_ficha_cliente) REFERENCES finanzas.ficha_cliente(id_ficha_cliente) ON DELETE RESTRICT;


--
-- Name: proyecto_financiero fk_proyecto_financiero_moneda; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.proyecto_financiero
    ADD CONSTRAINT fk_proyecto_financiero_moneda FOREIGN KEY (id_moneda) REFERENCES finanzas.moneda(id_moneda) ON DELETE RESTRICT;


--
-- Name: proyecto_financiero fk_proyecto_financiero_nota_venta; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.proyecto_financiero
    ADD CONSTRAINT fk_proyecto_financiero_nota_venta FOREIGN KEY (id_nota_venta) REFERENCES finanzas.nota_venta(id_nota_venta) ON DELETE RESTRICT;


--
-- Name: tarea_remunerable fk_tarea_rem_orden_ext; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.tarea_remunerable
    ADD CONSTRAINT fk_tarea_rem_orden_ext FOREIGN KEY (id_orden_trabajo) REFERENCES inventario.orden_trabajo(orden_trabajo_id_orden) ON DELETE RESTRICT;


--
-- Name: tarea_remunerable fk_tarea_remunerable_empleado; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.tarea_remunerable
    ADD CONSTRAINT fk_tarea_remunerable_empleado FOREIGN KEY (rut_empleado) REFERENCES finanzas.empleado(rut_empleado) ON DELETE RESTRICT;


--
-- Name: tarea_remunerable fk_tarea_remunerable_liquidacion; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.tarea_remunerable
    ADD CONSTRAINT fk_tarea_remunerable_liquidacion FOREIGN KEY (id_liquidacion_remuneracion) REFERENCES finanzas.liquidacion_remuneracion(id_liquidacion_remuneracion) ON DELETE RESTRICT;


--
-- Name: tarea_remunerable fk_tarea_remunerable_proyecto; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.tarea_remunerable
    ADD CONSTRAINT fk_tarea_remunerable_proyecto FOREIGN KEY (id_proyecto_financiero) REFERENCES finanzas.proyecto_financiero(id_proyecto_financiero) ON DELETE RESTRICT;


--
-- Name: tarea_remunerable fk_tarea_remunerable_tarifa; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.tarea_remunerable
    ADD CONSTRAINT fk_tarea_remunerable_tarifa FOREIGN KEY (id_historial_tarifa_tarea) REFERENCES finanzas.historial_tarifa_tarea(id_historial_tarifa_tarea) ON DELETE RESTRICT;


--
-- Name: alerta_faltante_pedido fk_alerta_faltante_pedido_material_sku; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.alerta_faltante_pedido
    ADD CONSTRAINT fk_alerta_faltante_pedido_material_sku FOREIGN KEY (material_sku) REFERENCES inventario.material(material_sku);


--
-- Name: alerta_faltante_pedido fk_alerta_faltante_pedido_proveedor_id_proveedor; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.alerta_faltante_pedido
    ADD CONSTRAINT fk_alerta_faltante_pedido_proveedor_id_proveedor FOREIGN KEY (proveedor_id_proveedor) REFERENCES finanzas.proveedor(id_proveedor);


--
-- Name: alerta_faltante_pedido fk_alerta_faltante_pedido_proyecto_id_proyecto; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.alerta_faltante_pedido
    ADD CONSTRAINT fk_alerta_faltante_pedido_proyecto_id_proyecto FOREIGN KEY (proyecto_id_proyecto) REFERENCES terreno.proyecto(proyecto_proyecto_id);


--
-- Name: alerta_faltante_pedido fk_alerta_faltante_pedido_usuario_id_usuario; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.alerta_faltante_pedido
    ADD CONSTRAINT fk_alerta_faltante_pedido_usuario_id_usuario FOREIGN KEY (usuario_id_usuario) REFERENCES terreno.usuario(usuario_id_usuario);


--
-- Name: alerta_inventario fk_alerta_inventario_alerta_inventario_tipo_alerta__2344ac23; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.alerta_inventario
    ADD CONSTRAINT fk_alerta_inventario_alerta_inventario_tipo_alerta__2344ac23 FOREIGN KEY (alerta_inventario_tipo_alerta_id_tipo_alerta) REFERENCES inventario.alerta_inventario_tipo_alerta(alerta_inventario_tipo_alerta_id_tipo_alerta);


--
-- Name: alerta_inventario fk_alerta_inventario_historial_alerta_id_historial; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.alerta_inventario
    ADD CONSTRAINT fk_alerta_inventario_historial_alerta_id_historial FOREIGN KEY (historial_alerta_id_historial) REFERENCES inventario.historial_alerta(historial_alerta_id_historial);


--
-- Name: alerta_inventario fk_alerta_inventario_material_sku; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.alerta_inventario
    ADD CONSTRAINT fk_alerta_inventario_material_sku FOREIGN KEY (material_sku) REFERENCES inventario.material(material_sku);


--
-- Name: alerta_inventario fk_alerta_inventario_proveedor_id_proveedor; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.alerta_inventario
    ADD CONSTRAINT fk_alerta_inventario_proveedor_id_proveedor FOREIGN KEY (proveedor_id_proveedor) REFERENCES finanzas.proveedor(id_proveedor);


--
-- Name: alerta_inventario_tipo_alerta fk_alerta_inventario_tipo_alerta_alerta_inventario__b68d21a3; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.alerta_inventario_tipo_alerta
    ADD CONSTRAINT fk_alerta_inventario_tipo_alerta_alerta_inventario__b68d21a3 FOREIGN KEY (alerta_inventario_nivel_prioridad_id) REFERENCES inventario.alerta_inventario_nivel_prioridad(alerta_inventario_nivel_prioridad_id_nivel_prioridad);


--
-- Name: anaquel fk_anaquel_bodega_id_bodega; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.anaquel
    ADD CONSTRAINT fk_anaquel_bodega_id_bodega FOREIGN KEY (bodega_id_bodega) REFERENCES inventario.bodega(bodega_id_bodega);


--
-- Name: factura_compra fk_factura_compra_factura_compra_tipo_cambio_id_tipo_cambio; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.factura_compra
    ADD CONSTRAINT fk_factura_compra_factura_compra_tipo_cambio_id_tipo_cambio FOREIGN KEY (factura_compra_tipo_cambio_id_tipo_cambio) REFERENCES inventario.factura_compra_tipo_cambio(factura_compra_tipo_cambio_id_tipo_cambio);


--
-- Name: factura_compra fk_factura_compra_proveedor_id_proveedor; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.factura_compra
    ADD CONSTRAINT fk_factura_compra_proveedor_id_proveedor FOREIGN KEY (proveedor_id_proveedor) REFERENCES finanzas.proveedor(id_proveedor);


--
-- Name: insumo_estandar_proceso fk_insumo_estandar_proceso_area_trabajo_id_area; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.insumo_estandar_proceso
    ADD CONSTRAINT fk_insumo_estandar_proceso_area_trabajo_id_area FOREIGN KEY (area_trabajo_id_area) REFERENCES terreno.area_trabajo(area_trabajo_id_area);


--
-- Name: insumo_estandar_proceso fk_insumo_estandar_proceso_material_sku; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.insumo_estandar_proceso
    ADD CONSTRAINT fk_insumo_estandar_proceso_material_sku FOREIGN KEY (material_sku) REFERENCES inventario.material(material_sku);


--
-- Name: inventario_bodega fk_inventario_bodega_bodega_id_bodega; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.inventario_bodega
    ADD CONSTRAINT fk_inventario_bodega_bodega_id_bodega FOREIGN KEY (bodega_id_bodega) REFERENCES inventario.bodega(bodega_id_bodega);


--
-- Name: inventario_bodega fk_inventario_bodega_lote_id_lote; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.inventario_bodega
    ADD CONSTRAINT fk_inventario_bodega_lote_id_lote FOREIGN KEY (lote_id_lote) REFERENCES inventario.lote(lote_id_lote);


--
-- Name: inventario_bodega fk_inventario_bodega_material_sku; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.inventario_bodega
    ADD CONSTRAINT fk_inventario_bodega_material_sku FOREIGN KEY (material_sku) REFERENCES inventario.material(material_sku);


--
-- Name: lote fk_lote_factura_compra_id_factura; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.lote
    ADD CONSTRAINT fk_lote_factura_compra_id_factura FOREIGN KEY (factura_compra_id_factura) REFERENCES inventario.factura_compra(factura_compra_id_factura);


--
-- Name: lote_fecha_pedido fk_lote_fecha_pedido_lote_id_lote; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.lote_fecha_pedido
    ADD CONSTRAINT fk_lote_fecha_pedido_lote_id_lote FOREIGN KEY (lote_id_lote) REFERENCES inventario.lote(lote_id_lote);


--
-- Name: lote fk_lote_proveedor_id_proveedor; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.lote
    ADD CONSTRAINT fk_lote_proveedor_id_proveedor FOREIGN KEY (proveedor_id_proveedor) REFERENCES finanzas.proveedor(id_proveedor);


--
-- Name: lote fk_lote_proyecto_id_proyecto; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.lote
    ADD CONSTRAINT fk_lote_proyecto_id_proyecto FOREIGN KEY (proyecto_id_proyecto) REFERENCES terreno.proyecto(proyecto_proyecto_id);


--
-- Name: material_clasificacion_nivel_especifico fk_material_clasificacion_nivel_especifico_material_295c8a27; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.material_clasificacion_nivel_especifico
    ADD CONSTRAINT fk_material_clasificacion_nivel_especifico_material_295c8a27 FOREIGN KEY (material_clasificacion_subcategoria_id) REFERENCES inventario.material_clasificacion_subcategoria(material_clasificacion_subcategoria_id);


--
-- Name: material_clasificacion_subcategoria fk_material_clasificacion_subcategoria_material_cla_e8cfce14; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.material_clasificacion_subcategoria
    ADD CONSTRAINT fk_material_clasificacion_subcategoria_material_cla_e8cfce14 FOREIGN KEY (material_clasificacion_categoria_id) REFERENCES inventario.material_clasificacion_categoria(material_clasificacion_categoria_id);


--
-- Name: material_codigo_barras fk_material_codigo_barras_material_sku; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.material_codigo_barras
    ADD CONSTRAINT fk_material_codigo_barras_material_sku FOREIGN KEY (material_sku) REFERENCES inventario.material(material_sku);


--
-- Name: material fk_material_material_categoria_funcional_id_categor_7cec335a; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.material
    ADD CONSTRAINT fk_material_material_categoria_funcional_id_categor_7cec335a FOREIGN KEY (material_categoria_funcional_id_categoria_funcional) REFERENCES inventario.material_categoria_funcional(material_categoria_funcional_id_categoria_funcional);


--
-- Name: material fk_material_material_categoria_general_id_categoria_general; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.material
    ADD CONSTRAINT fk_material_material_categoria_general_id_categoria_general FOREIGN KEY (material_categoria_general_id_categoria_general) REFERENCES inventario.material_categoria_general(material_categoria_general_id_categoria_general);


--
-- Name: material fk_material_material_clasificacion_nivel_especifico; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.material
    ADD CONSTRAINT fk_material_material_clasificacion_nivel_especifico FOREIGN KEY (material_clasificacion_nivel_especifico) REFERENCES inventario.material_clasificacion_nivel_especifico(material_clasificacion_nivel_especifico_id);


--
-- Name: material fk_material_material_unidad_medida_id_medida; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.material
    ADD CONSTRAINT fk_material_material_unidad_medida_id_medida FOREIGN KEY (material_unidad_medida_id_medida) REFERENCES inventario.material_unidad_medida(material_unidad_medida_id_unidad_medida);


--
-- Name: material_orden_trabajo fk_material_orden_trabajo_material_sku; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.material_orden_trabajo
    ADD CONSTRAINT fk_material_orden_trabajo_material_sku FOREIGN KEY (material_sku) REFERENCES inventario.material(material_sku);


--
-- Name: material_orden_trabajo fk_material_orden_trabajo_orden_trabajo_id_orden; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.material_orden_trabajo
    ADD CONSTRAINT fk_material_orden_trabajo_orden_trabajo_id_orden FOREIGN KEY (orden_trabajo_id_orden) REFERENCES inventario.orden_trabajo(orden_trabajo_id_orden);


--
-- Name: material_producto_terminado fk_material_producto_terminado_material_sku; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.material_producto_terminado
    ADD CONSTRAINT fk_material_producto_terminado_material_sku FOREIGN KEY (material_sku) REFERENCES inventario.material(material_sku);


--
-- Name: material_producto_terminado fk_material_producto_terminado_producto_terminado_i_5cce9a2a; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.material_producto_terminado
    ADD CONSTRAINT fk_material_producto_terminado_producto_terminado_i_5cce9a2a FOREIGN KEY (producto_terminado_id_producto) REFERENCES inventario.producto_terminado(producto_terminado_id_producto);


--
-- Name: material_proveedor fk_material_proveedor_material_sku; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.material_proveedor
    ADD CONSTRAINT fk_material_proveedor_material_sku FOREIGN KEY (material_sku) REFERENCES inventario.material(material_sku);


--
-- Name: material_proveedor fk_material_proveedor_proveedor_id_proveedor; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.material_proveedor
    ADD CONSTRAINT fk_material_proveedor_proveedor_id_proveedor FOREIGN KEY (proveedor_id_proveedor) REFERENCES finanzas.proveedor(id_proveedor);


--
-- Name: movimiento_inventario fk_movimiento_inventario_bodega_id_bodega; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.movimiento_inventario
    ADD CONSTRAINT fk_movimiento_inventario_bodega_id_bodega FOREIGN KEY (bodega_id_bodega) REFERENCES inventario.bodega(bodega_id_bodega);


--
-- Name: movimiento_inventario fk_movimiento_inventario_factura_compra_id_factura_compra; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.movimiento_inventario
    ADD CONSTRAINT fk_movimiento_inventario_factura_compra_id_factura_compra FOREIGN KEY (factura_compra_id_factura_compra) REFERENCES inventario.factura_compra(factura_compra_id_factura);


--
-- Name: movimiento_inventario fk_movimiento_inventario_lote_id_lote; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.movimiento_inventario
    ADD CONSTRAINT fk_movimiento_inventario_lote_id_lote FOREIGN KEY (lote_id_lote) REFERENCES inventario.lote(lote_id_lote);


--
-- Name: movimiento_inventario fk_movimiento_inventario_material_sku; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.movimiento_inventario
    ADD CONSTRAINT fk_movimiento_inventario_material_sku FOREIGN KEY (material_sku) REFERENCES inventario.material(material_sku);


--
-- Name: movimiento_inventario_motivo_movimiento fk_movimiento_inventario_motivo_movimiento_movimien_cf1b5d9c; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.movimiento_inventario_motivo_movimiento
    ADD CONSTRAINT fk_movimiento_inventario_motivo_movimiento_movimien_cf1b5d9c FOREIGN KEY (id_clasificacion_salida) REFERENCES inventario.movimiento_inventario_clasificacion_salida(id_clasificacion_salida);


--
-- Name: movimiento_inventario fk_movimiento_inventario_movimiento_inventario_moti_5114c33e; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.movimiento_inventario
    ADD CONSTRAINT fk_movimiento_inventario_movimiento_inventario_moti_5114c33e FOREIGN KEY (movimiento_inventario_motivo_movimiento_id_motivo_movimiento) REFERENCES inventario.movimiento_inventario_motivo_movimiento(movimiento_inventario_motivo_movimiento_id_motivo_movimiento);


--
-- Name: movimiento_inventario fk_movimiento_inventario_movimiento_inventario_tipo_491f04a7; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.movimiento_inventario
    ADD CONSTRAINT fk_movimiento_inventario_movimiento_inventario_tipo_491f04a7 FOREIGN KEY (movimiento_inventario_tipo_movimiento_id_tipo_movimiento) REFERENCES inventario.movimiento_inventario_tipo_movimiento(movimiento_inventario_tipo_movimiento_id_tipo_movimiento);


--
-- Name: movimiento_inventario fk_movimiento_inventario_proyecto_id_proyecto; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.movimiento_inventario
    ADD CONSTRAINT fk_movimiento_inventario_proyecto_id_proyecto FOREIGN KEY (proyecto_id_proyecto) REFERENCES terreno.proyecto(proyecto_proyecto_id);


--
-- Name: movimiento_inventario fk_movimiento_inventario_usuario_id_usuario; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.movimiento_inventario
    ADD CONSTRAINT fk_movimiento_inventario_usuario_id_usuario FOREIGN KEY (usuario_id_usuario) REFERENCES terreno.usuario(usuario_id_usuario);


--
-- Name: notificacion fk_notificacion_alerta_inventario_id_alerta; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.notificacion
    ADD CONSTRAINT fk_notificacion_alerta_inventario_id_alerta FOREIGN KEY (alerta_inventario_id_alerta) REFERENCES inventario.alerta_inventario(alerta_inventario_id_alerta);


--
-- Name: notificacion fk_notificacion_usuario_id_usuario; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.notificacion
    ADD CONSTRAINT fk_notificacion_usuario_id_usuario FOREIGN KEY (usuario_id_usuario) REFERENCES terreno.usuario(usuario_id_usuario);


--
-- Name: orden_trabajo fk_orden_trabajo_area_trabajo_id_area; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.orden_trabajo
    ADD CONSTRAINT fk_orden_trabajo_area_trabajo_id_area FOREIGN KEY (area_trabajo_id_area) REFERENCES terreno.area_trabajo(area_trabajo_id_area);


--
-- Name: orden_trabajo fk_orden_trabajo_especificaciones_puerta_id_especif_6a769728; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.orden_trabajo
    ADD CONSTRAINT fk_orden_trabajo_especificaciones_puerta_id_especif_6a769728 FOREIGN KEY (especificaciones_puerta_id_especificacion_puerta) REFERENCES terreno.especificaciones_puerta(especificacion_puerta_especificacion_puerta_id);


--
-- Name: orden_trabajo fk_orden_trabajo_proyecto_id_proyecto; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.orden_trabajo
    ADD CONSTRAINT fk_orden_trabajo_proyecto_id_proyecto FOREIGN KEY (proyecto_id_proyecto) REFERENCES terreno.proyecto(proyecto_proyecto_id);


--
-- Name: orden_trabajo fk_orden_trabajo_usuario_id_usuario; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.orden_trabajo
    ADD CONSTRAINT fk_orden_trabajo_usuario_id_usuario FOREIGN KEY (usuario_id_usuario) REFERENCES terreno.usuario(usuario_id_usuario);


--
-- Name: preparacion_pedido_estado fk_preparacion_pedido_estado_preparacion_pedido_id__ee3b6a24; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.preparacion_pedido_estado
    ADD CONSTRAINT fk_preparacion_pedido_estado_preparacion_pedido_id__ee3b6a24 FOREIGN KEY (preparacion_pedido_id_preparacion) REFERENCES inventario.preparacion_pedido(preparacion_pedido_id_preparacion);


--
-- Name: preparacion_pedido fk_preparacion_pedido_reserva_inventario_id_reserva; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.preparacion_pedido
    ADD CONSTRAINT fk_preparacion_pedido_reserva_inventario_id_reserva FOREIGN KEY (reserva_inventario_id_reserva) REFERENCES inventario.reserva_inventario(reserva_inventario_id_reserva);


--
-- Name: preparacion_pedido fk_preparacion_pedido_usuario_id_usuario; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.preparacion_pedido
    ADD CONSTRAINT fk_preparacion_pedido_usuario_id_usuario FOREIGN KEY (usuario_id_usuario) REFERENCES terreno.usuario(usuario_id_usuario);


--
-- Name: proveedor_contacto_correo fk_proveedor_contacto_correo_proveedor_id_proveedor; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.proveedor_contacto_correo
    ADD CONSTRAINT fk_proveedor_contacto_correo_proveedor_id_proveedor FOREIGN KEY (proveedor_id_proveedor) REFERENCES finanzas.proveedor(id_proveedor);


--
-- Name: proveedor_contacto_telefono fk_proveedor_contacto_telefono_proveedor_id_proveedor; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.proveedor_contacto_telefono
    ADD CONSTRAINT fk_proveedor_contacto_telefono_proveedor_id_proveedor FOREIGN KEY (proveedor_id_proveedor) REFERENCES finanzas.proveedor(id_proveedor);


--
-- Name: reporte_movimiento_inventario fk_reporte_movimiento_inventario_movimiento_inventa_c5801b43; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.reporte_movimiento_inventario
    ADD CONSTRAINT fk_reporte_movimiento_inventario_movimiento_inventa_c5801b43 FOREIGN KEY (movimiento_inventario_id_movimiento) REFERENCES inventario.movimiento_inventario(movimiento_inventario_id_movimiento);


--
-- Name: reporte_movimiento_inventario fk_reporte_movimiento_inventario_reporte_id_reporte; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.reporte_movimiento_inventario
    ADD CONSTRAINT fk_reporte_movimiento_inventario_reporte_id_reporte FOREIGN KEY (reporte_id_reporte) REFERENCES inventario.reporte(reporte_id_reporte);


--
-- Name: reporte fk_reporte_usuario_id_usuario; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.reporte
    ADD CONSTRAINT fk_reporte_usuario_id_usuario FOREIGN KEY (usuario_id_usuario) REFERENCES terreno.usuario(usuario_id_usuario);


--
-- Name: reserva_inventario fk_reserva_inventario_material_sku; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.reserva_inventario
    ADD CONSTRAINT fk_reserva_inventario_material_sku FOREIGN KEY (material_sku) REFERENCES inventario.material(material_sku);


--
-- Name: reserva_inventario fk_reserva_inventario_orden_trabajo_id_orden; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.reserva_inventario
    ADD CONSTRAINT fk_reserva_inventario_orden_trabajo_id_orden FOREIGN KEY (orden_trabajo_id_orden) REFERENCES inventario.orden_trabajo(orden_trabajo_id_orden);


--
-- Name: reserva_inventario fk_reserva_inventario_proyecto_id_proyecto; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.reserva_inventario
    ADD CONSTRAINT fk_reserva_inventario_proyecto_id_proyecto FOREIGN KEY (proyecto_id_proyecto) REFERENCES terreno.proyecto(proyecto_proyecto_id);


--
-- Name: adicionales_pagados fk_adicionales_pagados_id_especificaciones_puerta; Type: FK CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.adicionales_pagados
    ADD CONSTRAINT fk_adicionales_pagados_id_especificaciones_puerta FOREIGN KEY (id_especificaciones_puerta) REFERENCES terreno.especificaciones_puerta(especificacion_puerta_especificacion_puerta_id);


--
-- Name: detalles_herraje fk_detalles_herraje_id_especificacion_puerta; Type: FK CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.detalles_herraje
    ADD CONSTRAINT fk_detalles_herraje_id_especificacion_puerta FOREIGN KEY (id_especificacion_puerta) REFERENCES terreno.especificaciones_puerta(especificacion_puerta_especificacion_puerta_id);


--
-- Name: detalles_herraje fk_detalles_herraje_material_sku; Type: FK CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.detalles_herraje
    ADD CONSTRAINT fk_detalles_herraje_material_sku FOREIGN KEY (material_sku) REFERENCES inventario.material(material_sku);


--
-- Name: especificacion_metalmecanica fk_especificacion_metalmecanica_id_especificacion_puerta; Type: FK CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.especificacion_metalmecanica
    ADD CONSTRAINT fk_especificacion_metalmecanica_id_especificacion_puerta FOREIGN KEY (id_especificacion_puerta) REFERENCES terreno.especificaciones_puerta(especificacion_puerta_especificacion_puerta_id);


--
-- Name: especificacion_proyecto_terreno fk_especificacion_proyecto_terreno_id_especificacion_puerta; Type: FK CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.especificacion_proyecto_terreno
    ADD CONSTRAINT fk_especificacion_proyecto_terreno_id_especificacion_puerta FOREIGN KEY (id_especificacion_puerta) REFERENCES terreno.especificaciones_puerta(especificacion_puerta_especificacion_puerta_id);


--
-- Name: especificacion_servicio_terreno fk_especificacion_servicio_terreno_especificacion_s_79bfd2c7; Type: FK CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.especificacion_servicio_terreno
    ADD CONSTRAINT fk_especificacion_servicio_terreno_especificacion_s_79bfd2c7 FOREIGN KEY (especificacion_servicio_terreno_servicio_terreno_id) REFERENCES terreno.servicio_terreno(servicio_terreno_servicio_terreno_id);


--
-- Name: especificacion_servicio_terreno fk_especificacion_servicio_terreno_especificacion_s_ca0b84a5; Type: FK CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.especificacion_servicio_terreno
    ADD CONSTRAINT fk_especificacion_servicio_terreno_especificacion_s_ca0b84a5 FOREIGN KEY (especificacion_servicio_terreno_especificacion_puerta_id) REFERENCES terreno.especificaciones_puerta(especificacion_puerta_especificacion_puerta_id);


--
-- Name: especificacion_terminaciones fk_especificacion_terminaciones_id_especificacion_puerta; Type: FK CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.especificacion_terminaciones
    ADD CONSTRAINT fk_especificacion_terminaciones_id_especificacion_puerta FOREIGN KEY (id_especificacion_puerta) REFERENCES terreno.especificaciones_puerta(especificacion_puerta_especificacion_puerta_id);


--
-- Name: evidencia_terreno fk_evidencia_terreno_id_formulario_de_cierre; Type: FK CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.evidencia_terreno
    ADD CONSTRAINT fk_evidencia_terreno_id_formulario_de_cierre FOREIGN KEY (id_formulario_de_cierre) REFERENCES terreno.formulario_de_cierre(formulario_de_cierre_formulario_de_cierre_id);


--
-- Name: evidencia_terreno fk_evidencia_terreno_id_servicio_terreno; Type: FK CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.evidencia_terreno
    ADD CONSTRAINT fk_evidencia_terreno_id_servicio_terreno FOREIGN KEY (id_servicio_terreno) REFERENCES terreno.servicio_terreno(servicio_terreno_servicio_terreno_id);


--
-- Name: formulario_de_cierre fk_formulario_de_cierre_id_tarea; Type: FK CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.formulario_de_cierre
    ADD CONSTRAINT fk_formulario_de_cierre_id_tarea FOREIGN KEY (id_tarea) REFERENCES terreno.tarea(tarea_tarea_id);


--
-- Name: historial_cambio_orden_trabajo fk_historial_cambio_orden_trabajo_id_especificaciones_puerta; Type: FK CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.historial_cambio_orden_trabajo
    ADD CONSTRAINT fk_historial_cambio_orden_trabajo_id_especificaciones_puerta FOREIGN KEY (id_especificaciones_puerta) REFERENCES terreno.especificaciones_puerta(especificacion_puerta_especificacion_puerta_id);


--
-- Name: medidas_puerta fk_medidas_puerta_id_cambio; Type: FK CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.medidas_puerta
    ADD CONSTRAINT fk_medidas_puerta_id_cambio FOREIGN KEY (id_cambio) REFERENCES terreno.historial_cambio_orden_trabajo(historial_cambio_orden_trabajo_id_cambio);


--
-- Name: medidas_puerta fk_medidas_puerta_id_especificacion_puerta; Type: FK CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.medidas_puerta
    ADD CONSTRAINT fk_medidas_puerta_id_especificacion_puerta FOREIGN KEY (id_especificacion_puerta) REFERENCES terreno.especificaciones_puerta(especificacion_puerta_especificacion_puerta_id);


--
-- Name: notificacion_tecnico fk_notificacion_tecnico_servicio_terreno_id_servicio_terreno; Type: FK CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.notificacion_tecnico
    ADD CONSTRAINT fk_notificacion_tecnico_servicio_terreno_id_servicio_terreno FOREIGN KEY (servicio_terreno_id_servicio_terreno) REFERENCES terreno.servicio_terreno(servicio_terreno_servicio_terreno_id);


--
-- Name: notificacion_tecnico fk_notificacion_tecnico_usuario_id_usuario; Type: FK CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.notificacion_tecnico
    ADD CONSTRAINT fk_notificacion_tecnico_usuario_id_usuario FOREIGN KEY (usuario_id_usuario) REFERENCES terreno.usuario(usuario_id_usuario);


--
-- Name: notificacion_terreno fk_notificacion_terreno_tarea_id_tarea; Type: FK CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.notificacion_terreno
    ADD CONSTRAINT fk_notificacion_terreno_tarea_id_tarea FOREIGN KEY (tarea_id_tarea) REFERENCES terreno.tarea(tarea_tarea_id);


--
-- Name: notificacion_terreno fk_notificacion_terreno_usuario_id_usuario; Type: FK CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.notificacion_terreno
    ADD CONSTRAINT fk_notificacion_terreno_usuario_id_usuario FOREIGN KEY (usuario_id_usuario) REFERENCES terreno.usuario(usuario_id_usuario);


--
-- Name: obra fk_obra_id_especificacion_puerta; Type: FK CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.obra
    ADD CONSTRAINT fk_obra_id_especificacion_puerta FOREIGN KEY (id_especificacion_puerta) REFERENCES terreno.especificaciones_puerta(especificacion_puerta_especificacion_puerta_id);


--
-- Name: obra fk_obra_rut_cliente; Type: FK CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.obra
    ADD CONSTRAINT fk_obra_rut_cliente FOREIGN KEY (rut_cliente) REFERENCES terreno.cliente(cliente_cliente_rut);


--
-- Name: perfil_permiso fk_perfil_permiso_perfil_id_perfil; Type: FK CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.perfil_permiso
    ADD CONSTRAINT fk_perfil_permiso_perfil_id_perfil FOREIGN KEY (perfil_id_perfil) REFERENCES terreno.perfil(perfil_id_perfil);


--
-- Name: perfil_permiso fk_perfil_permiso_permiso_id_permiso; Type: FK CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.perfil_permiso
    ADD CONSTRAINT fk_perfil_permiso_permiso_id_permiso FOREIGN KEY (permiso_id_permiso) REFERENCES terreno.permiso(permiso_id_permiso);


--
-- Name: prestamo_herramientas fk_prestamo_herramientas_rut_empleado; Type: FK CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.prestamo_herramientas
    ADD CONSTRAINT fk_prestamo_herramientas_rut_empleado FOREIGN KEY (rut_empleado) REFERENCES finanzas.empleado(rut_empleado);


--
-- Name: prestamo_herramientas fk_prestamo_herramientas_sku_material; Type: FK CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.prestamo_herramientas
    ADD CONSTRAINT fk_prestamo_herramientas_sku_material FOREIGN KEY (sku_material) REFERENCES inventario.material(material_sku);


--
-- Name: proyecto fk_proyecto_rut_cliente; Type: FK CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.proyecto
    ADD CONSTRAINT fk_proyecto_rut_cliente FOREIGN KEY (rut_cliente) REFERENCES terreno.cliente(cliente_cliente_rut);


--
-- Name: receptor fk_receptor_id_tarea; Type: FK CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.receptor
    ADD CONSTRAINT fk_receptor_id_tarea FOREIGN KEY (id_tarea) REFERENCES terreno.tarea(tarea_tarea_id);


--
-- Name: servicio_terreno fk_servicio_terreno_id_checklist_de_materials; Type: FK CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.servicio_terreno
    ADD CONSTRAINT fk_servicio_terreno_id_checklist_de_materials FOREIGN KEY (id_checklist_de_materials) REFERENCES terreno.checklist_de_materiales(checklist_de_materiales_checklist_de_materials_id);


--
-- Name: servicio_terreno fk_servicio_terreno_id_usuario; Type: FK CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.servicio_terreno
    ADD CONSTRAINT fk_servicio_terreno_id_usuario FOREIGN KEY (id_usuario) REFERENCES terreno.usuario(usuario_id_usuario);


--
-- Name: servicio_tterreno_herramientas_materiales fk_servicio_tterreno_herramientas_materiales_servic_58285965; Type: FK CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.servicio_tterreno_herramientas_materiales
    ADD CONSTRAINT fk_servicio_tterreno_herramientas_materiales_servic_58285965 FOREIGN KEY (servicio_terreno_herramientas_materiales_servicio_terreno_id) REFERENCES terreno.servicio_terreno(servicio_terreno_servicio_terreno_id);


--
-- Name: tarea fk_tarea_id_especificacion_puerta; Type: FK CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.tarea
    ADD CONSTRAINT fk_tarea_id_especificacion_puerta FOREIGN KEY (id_especificacion_puerta) REFERENCES terreno.especificaciones_puerta(especificacion_puerta_especificacion_puerta_id);


--
-- Name: tarea fk_tarea_id_servicio_terreno; Type: FK CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.tarea
    ADD CONSTRAINT fk_tarea_id_servicio_terreno FOREIGN KEY (id_servicio_terreno) REFERENCES terreno.servicio_terreno(servicio_terreno_servicio_terreno_id);


--
-- Name: tarea fk_tarea_id_usuario; Type: FK CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.tarea
    ADD CONSTRAINT fk_tarea_id_usuario FOREIGN KEY (id_usuario) REFERENCES terreno.usuario(usuario_id_usuario);


--
-- Name: tarea_tipo fk_tarea_tipo_id_tarea; Type: FK CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.tarea_tipo
    ADD CONSTRAINT fk_tarea_tipo_id_tarea FOREIGN KEY (id_tarea) REFERENCES terreno.tarea(tarea_tarea_id);


--
-- Name: usuario_contrasena fk_usuario_contrasena_usuario_id_usuario; Type: FK CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.usuario_contrasena
    ADD CONSTRAINT fk_usuario_contrasena_usuario_id_usuario FOREIGN KEY (usuario_id_usuario) REFERENCES terreno.usuario(usuario_id_usuario);


--
-- Name: usuario fk_usuario_empleado_rut_empleado; Type: FK CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.usuario
    ADD CONSTRAINT fk_usuario_empleado_rut_empleado FOREIGN KEY (empleado_rut_empleado) REFERENCES finanzas.empleado(rut_empleado);


--
-- Name: usuario fk_usuario_perfil_id_perfil; Type: FK CONSTRAINT; Schema: terreno; Owner: -
--

ALTER TABLE ONLY terreno.usuario
    ADD CONSTRAINT fk_usuario_perfil_id_perfil FOREIGN KEY (perfil_id_perfil) REFERENCES terreno.perfil(perfil_id_perfil);


--
-- PostgreSQL database dump complete
--



