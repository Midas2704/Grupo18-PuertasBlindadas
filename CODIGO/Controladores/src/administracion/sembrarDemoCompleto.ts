import { prisma } from '../db';
import { fechaNegocio } from '../utilidades/finanzas';
import { M7Controller } from '../controladores/M7Controller';
import { M8Controller } from '../controladores/M8Controller';
import { AdaptadorCreditoM8ParaM7 } from '../servicios/AdaptadorCreditoM8ParaM7';
import { M9Controller } from '../controladores/M9Controller';

const PREFIJO = 'DEMO-UI';
const hoy = new Date(`${fechaNegocio()}T00:00:00Z`);
const fecha = (dias = 0) => { const valor = new Date(hoy); valor.setUTCDate(valor.getUTCDate() + dias); return valor; };
const inicioMes = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
const finMes = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 0));
const acotarFechaEfectiva = (valor: Date) => valor > finMes ? new Date(finMes) : valor;
const MESES_HISTORICOS = 25;
const mesHistorico = (indice: number, dia = 1) => new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - (MESES_HISTORICOS - 1 - indice), dia));
const claveMes = (valor: Date) => `${valor.getUTCFullYear()}-${String(valor.getUTCMonth() + 1).padStart(2, '0')}`;
const variacion = (minimo: number, maximo: number, ...semillas: number[]) => {
  const valor = semillas.reduce((total, semilla, indice) => (total * 1664525 + semilla * (1013904223 + indice * 97)) >>> 0, 2166136261);
  return minimo + valor % (maximo - minimo + 1);
};
const rutDemo = (indice: number) => {
  const numero = 97910000 + indice; let suma = 0, factor = 2;
  for (const digito of String(numero).split('').reverse()) { suma += Number(digito) * factor; factor = factor === 7 ? 2 : factor + 1; }
  const dv = 11 - suma % 11;
  return `${numero}-${dv === 11 ? '0' : dv === 10 ? 'K' : dv}`;
};

async function sembrarFinanzas() {
  await prisma.$transaction(async tx => {
    const [clp, empresa, persona, transferencia, categoria, tipoFactura, item] = await Promise.all([
      tx.moneda.upsert({ where: { codigo_moneda: 'CLP' }, update: {}, create: { codigo_moneda: 'CLP', nombre_moneda: 'Peso chileno' } }),
      tx.tipo_cliente_financiero.upsert({ where: { nombre_tipo_cliente_financiero: 'B2B' }, update: {}, create: { nombre_tipo_cliente_financiero: 'B2B' } }),
      tx.tipo_cliente_financiero.upsert({ where: { nombre_tipo_cliente_financiero: 'B2C' }, update: {}, create: { nombre_tipo_cliente_financiero: 'B2C' } }),
      tx.medio_pago.upsert({ where: { nombre_medio_pago: 'Transferencia' }, update: {}, create: { nombre_medio_pago: 'Transferencia' } }),
      tx.categoria_pago.upsert({ where: { nombre: 'Abono parcial' }, update: {}, create: { nombre: 'Abono parcial' } }),
      tx.tipo_documento.upsert({ where: { nombre_tipo_documento: 'Factura Electrónica' }, update: {}, create: { nombre_tipo_documento: 'Factura Electrónica', aplica_venta: true } }),
      tx.item_comercial.findFirst({ where: { nombre_item: `${PREFIJO} Puerta de seguridad` } }).then(valor => valor ?? tx.item_comercial.create({ data: { nombre_item: `${PREFIJO} Puerta de seguridad`, descripcion_item: 'Producto ficticio para QA visual', estado_item: 'activo' } })),
    ]);
    const nombres = ['Constructora Horizonte', 'Taller Cordillera', 'Arquitectura Sur', 'Servicios Andinos', 'Proyecto Los Robles', 'Casa Mirador', 'Residencia Arrayán', 'Familia del Valle', 'Vivienda Parque Norte', 'Casa Costanera'];
    for (let indice = 0; indice < nombres.length; indice++) {
      const b2b = indice < 5, rut = rutDemo(indice + 1), marcador = `${PREFIJO}-CLIENTE-${indice + 1}`;
      await tx.cliente.upsert({ where: { cliente_cliente_rut: rut }, update: { cliente_correo: `demo-ui-cliente${indice + 1}@example.invalid` }, create: { cliente_cliente_rut: rut, cliente_razon_social: `Demo UI — ${nombres[indice]}`, cliente_correo: `demo-ui-cliente${indice + 1}@example.invalid`, cliente_telefono: `+56 9 0000 ${String(indice + 1).padStart(4, '0')}`, cliente_es_cliente_b2b: b2b, cliente_es_cliente_b2c: !b2b } });
      const cliente = await tx.cliente_financiero.upsert({ where: { referencia_demostracion: marcador }, update: { rut_cliente: rut, correo_financiero: `demo-ui-cliente${indice + 1}@example.invalid` }, create: { referencia_demostracion: marcador, rut_cliente: rut, id_tipo_cliente_financiero: b2b ? empresa.id_tipo_cliente_financiero : persona.id_tipo_cliente_financiero, nombre_razon_social_referencia: `Demo UI — ${nombres[indice]}`, telefono_financiero: `+56 9 0000 ${String(indice + 1).padStart(4, '0')}`, correo_financiero: `demo-ui-cliente${indice + 1}@example.invalid`, estado_financiero: indice === 9 ? 'inactivo' : 'activo', nivel_formalizacion: indice === 8 ? 'provisional' : 'formal' } });
      const ficha = await tx.ficha_cliente.upsert({ where: { id_cliente_financiero: cliente.id_cliente_financiero }, update: {}, create: { id_cliente_financiero: cliente.id_cliente_financiero, estado_ficha: indice === 9 ? 'inactiva' : 'activa', observacion_financiera_general: `${PREFIJO}: escenario ficticio de QA` } });
      if (indice >= 5) continue;
      const monto = [350000, 780000, 1250000, 2400000, 4800000][indice];
      const estadoCotizacion = indice % 2 ? 'emitida' : 'borrador';
      const cotizacion = await tx.cotizacion.upsert({ where: { referencia_demostracion: `${PREFIJO}-COT-${indice + 1}` }, update: { fecha_emision: fecha(-indice * 4), fecha_vigencia: fecha(indice === 3 ? -2 : 20), estado_cotizacion: estadoCotizacion }, create: { referencia_demostracion: `${PREFIJO}-COT-${indice + 1}`, id_ficha_cliente: ficha.id_ficha_cliente, id_moneda: clp.id_moneda, fecha_emision: fecha(-indice * 4), fecha_vigencia: fecha(indice === 3 ? -2 : 20), estado_cotizacion: estadoCotizacion, subtotal_costos_estimados: monto * .62, margen_esperado: 38, precio_sugerido: monto, monto_neto: monto, monto_impuesto: monto * .19, monto_total_estimado: monto * 1.19, detalle_cotizacion: { create: [{ id_item_comercial: item.id_item_comercial, cantidad_item: indice + 1, subtotal_item_estimado: monto, descripcion_item_cotizado: `Puerta QA ${indice + 1}` }] } } });
      let proyecto = await tx.proyecto.findFirst({ where: { proyecto_codigo_proyecto: `${PREFIJO}-PROY-${indice + 1}` } });
      if (!proyecto) proyecto = await tx.proyecto.create({ data: { proyecto_codigo_proyecto: `${PREFIJO}-PROY-${indice + 1}`, proyecto_nombre_referencia: `Demo UI — ${nombres[indice]}`, proyecto_fecha_ingreso: fecha(-30 + indice), proyecto_fecha_instalacion: fecha(indice - 2), proyecto_estado_operacional: indice < 3 ? 'activo' : 'terminado', proyecto_estado_produccion: indice < 2 ? 'en_progreso' : 'completada', rut_cliente: rut } });
      const nota = await tx.nota_venta.upsert({ where: { numero_nota_venta: `${PREFIJO}-NV-${indice + 1}` }, update: { fecha_emision: inicioMes, fecha_vencimiento: fecha(indice - 3) }, create: { numero_nota_venta: `${PREFIJO}-NV-${indice + 1}`, id_ficha_cliente: ficha.id_ficha_cliente, id_cotizacion: cotizacion.id_cotizacion, id_moneda: clp.id_moneda, id_proyecto_contexto: proyecto.proyecto_proyecto_id, fecha_emision: inicioMes, fecha_vencimiento: fecha(indice - 3), monto_neto: monto, monto_impuesto: monto * .19, monto_total: monto * 1.19, estado_nota_venta: indice === 4 ? 'anulada' : 'confirmada', estado_pago: ['pendiente', 'parcial', 'pagada', 'parcial', 'pendiente'][indice] } });
      const documento = await tx.documento_tributario.upsert({ where: { id_tipo_documento_folio_documento: { id_tipo_documento: tipoFactura.id_tipo_documento, folio_documento: `${PREFIJO}-FAC-${indice + 1}` } }, update: {}, create: { id_ficha_cliente: ficha.id_ficha_cliente, id_nota_venta: nota.id_nota_venta, id_moneda: clp.id_moneda, id_tipo_documento: tipoFactura.id_tipo_documento, folio_documento: `${PREFIJO}-FAC-${indice + 1}`, fecha_emision: fecha(-18 + indice), fecha_vencimiento: fecha(indice - 3), monto_neto: monto, monto_impuesto: monto * .19, monto_total: monto * 1.19 } });
      await tx.documento_tributario_nota_venta.upsert({ where: { id_documento_tributario_id_nota_venta: { id_documento_tributario: documento.id_documento_tributario, id_nota_venta: nota.id_nota_venta } }, update: {}, create: { id_documento_tributario: documento.id_documento_tributario, id_nota_venta: nota.id_nota_venta } });
      const pagado = indice === 0 ? 100000 : indice === 2 ? Number(nota.monto_total) : Math.round(Number(nota.monto_total) * .4);
      if (pagado > 0) {
        await tx.pago_cliente.upsert({ where: { referencia_demostracion: `${PREFIJO}-PAGO-${indice + 1}` }, update: { fecha_pago: fecha(indice === 2 ? 1 : -2) }, create: { referencia_demostracion: `${PREFIJO}-PAGO-${indice + 1}`, id_ficha_cliente: ficha.id_ficha_cliente, id_moneda: clp.id_moneda, id_medio_pago: transferencia.id_medio_pago, id_categoria_pago: categoria.id_categoria_pago, fecha_pago: fecha(indice === 2 ? 1 : -2), monto_pago: pagado, comprobante_pago: `${PREFIJO}://comprobante/${indice + 1}`, asignacion_pago_cliente: { create: { id_nota_venta: nota.id_nota_venta, monto_asignado: pagado } } } });
      }
      const codigoProyectoFinanciero = `${PREFIJO}-PF-${indice + 1}`;
      const proyectoFinanciero = await tx.proyecto_financiero.upsert({ where: { codigo_proyecto_financiero: codigoProyectoFinanciero }, update: { id_nota_venta: nota.id_nota_venta, id_proyecto_terreno: proyecto.proyecto_proyecto_id }, create: { id_ficha_cliente: ficha.id_ficha_cliente, id_nota_venta: nota.id_nota_venta, id_proyecto_terreno: proyecto.proyecto_proyecto_id, id_moneda: clp.id_moneda, codigo_proyecto_financiero: codigoProyectoFinanciero, fecha_inicio_financiera: inicioMes, estado_financiero_proyecto: 'activo', monto_venta_estimado: monto, monto_costo_estimado: monto * .62, observacion_financiera: `${PREFIJO} proyecto financiero ficticio` } });
      if (!await tx.costo_proyecto.findFirst({ where: { id_proyecto_financiero: proyectoFinanciero.id_proyecto_financiero, descripcion_costo: `${PREFIJO} Costo ${indice + 1}` } })) await tx.costo_proyecto.create({ data: { id_proyecto_financiero: proyectoFinanciero.id_proyecto_financiero, id_moneda: clp.id_moneda, descripcion_costo: `${PREFIJO} Costo ${indice + 1}`, categoria_costo: 'Materiales DEMO-UI', monto_costo: monto * .55, fecha_costo: inicioMes, origen_costo: 'DEMO_UI', estado_costo: 'registrado' } });
      if (!await tx.movimiento_financiero.findFirst({ where: { observacion: `${PREFIJO} Movimiento ${indice + 1}` } })) await tx.movimiento_financiero.create({ data: { id_moneda: clp.id_moneda, fecha_movimiento: fecha(-Math.min(indice, 1)), tipo_movimiento_financiero: indice % 2 ? 'PAGO_CLIENTE' : 'PAGO_PROVEEDOR', naturaleza_movimiento: indice % 2 ? 'ingreso' : 'egreso', motivo_movimiento: `${PREFIJO} flujo ficticio`, monto_movimiento: 90000 * (indice + 1), estado_movimiento: 'registrado', observacion: `${PREFIJO} Movimiento ${indice + 1}` } });
    }
    for (let indice = 1; indice <= 5; indice++) {
      const sku = `DEMOUI-MAT-${String(indice).padStart(2, '0')}`;
      await tx.material.upsert({ where: { material_sku: sku }, update: {}, create: { material_sku: sku, material_nombre_material: `${PREFIJO} Material ${indice}` } });
      if (!await tx.historial_precio_material.findFirst({ where: { material_sku: sku, fecha_vigencia_inicio: inicioMes } })) await tx.historial_precio_material.create({ data: { material_sku: sku, id_moneda: clp.id_moneda, precio_unitario: 15000 * indice, fecha_vigencia_inicio: inicioMes, estado_precio: 'vigente' } });
    }
  }, { timeout: 120000 });
}

async function sembrarProveedoresEInventario() {
  await prisma.$transaction(async tx => {
    const actor = await tx.usuario.findFirstOrThrow({ where: { administrador_original: true } });
    const clp = await tx.moneda.findUniqueOrThrow({ where: { codigo_moneda: 'CLP' } });
    const pais = await tx.pais.upsert({ where: { nombre_pais: `${PREFIJO} País` }, update: {}, create: { nombre_pais: `${PREFIJO} País`, codigo_iso_pais: 'DUI' } });
    const tipoId = await tx.tipo_identificador.upsert({ where: { nombre_tipo_identificador: `${PREFIJO} Identificador` }, update: {}, create: { nombre_tipo_identificador: `${PREFIJO} Identificador`, descripcion_tipo_identificador: 'Identificador ficticio para QA visual' } });
    const tipoDocumento = await tx.tipo_documento.upsert({ where: { nombre_tipo_documento: `${PREFIJO} Documento proveedor` }, update: {}, create: { nombre_tipo_documento: `${PREFIJO} Documento proveedor`, aplica_compra: true } });
    const medio = await tx.medio_pago.upsert({ where: { nombre_medio_pago: `${PREFIJO} Transferencia` }, update: {}, create: { nombre_medio_pago: `${PREFIJO} Transferencia`, codigo_medio_pago: 'DEMO_UI_TRANSFERENCIA', requiere_respaldo: false } });
    let bodega = await tx.bodega.findFirst({ where: { bodega_nombre_bodega: `${PREFIJO} Bodega central` } });
    if (!bodega) bodega = await tx.bodega.create({ data: { bodega_nombre_bodega: `${PREFIJO} Bodega central`, bodega_direccion: 'Dirección ficticia DEMO-UI', bodega_estado: 'activa' } });
    let tipoMovimiento = await tx.movimiento_inventario_tipo_movimiento.findFirst({ where: { movimiento_inventario_tipo_movimiento_nombre: `${PREFIJO} Entrada` } });
    if (!tipoMovimiento) tipoMovimiento = await tx.movimiento_inventario_tipo_movimiento.create({ data: { movimiento_inventario_tipo_movimiento_nombre: `${PREFIJO} Entrada` } });
    for (let indice = 1; indice <= 5; indice++) await tx.categoria_egreso_m5.upsert({ where: { nombre: `${PREFIJO} Categoría ${indice}` }, update: {}, create: { nombre: `${PREFIJO} Categoría ${indice}`, nombre_normalizado: `${PREFIJO.toLowerCase()} categoria ${indice}`, creado_por: actor.usuario_id_usuario } });
    for (let indice = 1; indice <= 5; indice++) {
      const identificador = `${PREFIJO}-PROV-${indice}`;
      let proveedor = await tx.proveedor.findFirst({ where: { id_pais: pais.id_pais, id_tipo_identificador: tipoId.id_tipo_identificador, identificador_tributario: identificador } });
      if (!proveedor) proveedor = await tx.proveedor.create({ data: { id_pais: pais.id_pais, id_tipo_identificador: tipoId.id_tipo_identificador, id_moneda_preferente: clp.id_moneda, identificador_tributario: identificador, nombre_razon_social: `${PREFIJO} Proveedor ${indice}`, tipo_proveedor_m5: indice % 2 ? 'Insumos/Materiales' : 'Ambos', condicion_pago_dias_m5: 30, condicion_pago_tipo_m5: 'DIAS_CORRIDOS', contacto_proveedor: `${PREFIJO} Contacto ${indice}`, correo_proveedor: `demo-ui-proveedor${indice}@example.invalid`, estado_proveedor: indice === 5 ? 'inactivo' : 'activo' } });
      let ocs = await tx.orden_compra_servicio_m5.findFirst({ where: { referencia: `${PREFIJO}-OCS-${indice}` } });
      if (!ocs) ocs = await tx.orden_compra_servicio_m5.create({ data: { id_proveedor: proveedor.id_proveedor, monto_autorizado: 180000 * indice, monto_autorizado_original: 180000 * indice, estado_ocs: indice < 4 ? 'abierta' : 'cerrada', referencia: `${PREFIJO}-OCS-${indice}`, periodo: `${hoy.getUTCFullYear()}-${String(hoy.getUTCMonth() + 1).padStart(2, '0')}`, descripcion: `${PREFIJO} compra ficticia ${indice}`, creado_por: actor.usuario_id_usuario, id_moneda: clp.id_moneda, fecha_esperada_recepcion: fecha(indice * 3) } });
      let documento = await tx.documento_proveedor_m5.findFirst({ where: { folio_normalizado: `${PREFIJO}-DOC-${indice}` } });
      if (!documento) documento = await tx.documento_proveedor_m5.create({ data: { id_proveedor: proveedor.id_proveedor, clase: 'definitivo', id_tipo_documento: tipoDocumento.id_tipo_documento, folio: `${PREFIJO}-DOC-${indice}`, folio_normalizado: `${PREFIJO}-DOC-${indice}`, fecha_emision: fecha(-20 + indice), id_moneda: clp.id_moneda, monto_total: 150000 * indice, estado: 'confirmado', respaldo: `${PREFIJO}://proveedor/${indice}`, descripcion: `${PREFIJO} documento ficticio ${indice}`, fecha_vencimiento: fecha(indice - 3), creado_por: actor.usuario_id_usuario, confirmado_por: actor.usuario_id_usuario, fecha_confirmacion: new Date() } });
      let obligacion = await tx.obligacion_proveedor_m5.findUnique({ where: { id_documento_m5: documento.id_documento_m5 } });
      if (!obligacion) obligacion = await tx.obligacion_proveedor_m5.create({ data: { id_documento_m5: documento.id_documento_m5, id_proveedor: proveedor.id_proveedor, monto_original: documento.monto_total, id_moneda: clp.id_moneda, saldo_inicial: documento.monto_total, saldo_actual: indice === 3 ? 0 : 75000 * indice, fecha_emision: documento.fecha_emision, fecha_vencimiento: documento.fecha_vencimiento!, estado_pago: indice === 3 ? 'Pagada' : indice % 2 ? 'Pendiente' : 'Parcial', generado_por: actor.usuario_id_usuario } });
      let operacion = await tx.operacion_pago_proveedor_m5.findFirst({ where: { id_proveedor: proveedor.id_proveedor, creado_por: actor.usuario_id_usuario } });
      if (!operacion) operacion = await tx.operacion_pago_proveedor_m5.create({ data: { id_proveedor: proveedor.id_proveedor, estado: indice % 2 ? 'borrador' : 'confirmada', fecha_efectiva_pago: fecha(-indice), creado_por: actor.usuario_id_usuario, confirmado_por: indice % 2 ? null : actor.usuario_id_usuario, fecha_confirmacion: indice % 2 ? null : new Date(), total_confirmado: indice % 2 ? null : 75000 * indice } });
      if (!await tx.movimiento_pago_proveedor_m5.findFirst({ where: { id_operacion_pago_m5: operacion.id_operacion_pago_m5, id_obligacion_m5: obligacion.id_obligacion_m5 } })) await tx.movimiento_pago_proveedor_m5.create({ data: { id_operacion_pago_m5: operacion.id_operacion_pago_m5, id_obligacion_m5: obligacion.id_obligacion_m5, id_medio_pago: medio.id_medio_pago, id_moneda: clp.id_moneda, monto_aplicado: 75000 * indice, equivalente_clp: 75000 * indice, estado: operacion.estado === 'confirmada' ? 'Vigente' : 'borrador' } });
      let envio = await tx.envio_importacion_m5.findUnique({ where: { referencia_normalizada: `${PREFIJO}-ENVIO-${indice}` } });
      if (!envio) envio = await tx.envio_importacion_m5.create({ data: { referencia: `${PREFIJO}-ENVIO-${indice}`, referencia_normalizada: `${PREFIJO}-ENVIO-${indice}`, fecha: fecha(-indice), descripcion: `${PREFIJO} importación ficticia ${indice}`, estado: indice < 4 ? 'abierto' : 'cerrado_financieramente', creado_por: actor.usuario_id_usuario } });
      await tx.envio_orden_compra_m5.upsert({ where: { id_envio_importacion_m5_id_ocs_m5: { id_envio_importacion_m5: envio.id_envio_importacion_m5, id_ocs_m5: ocs.id_orden_compra_servicio_m5 } }, update: {}, create: { id_envio_importacion_m5: envio.id_envio_importacion_m5, tipo_orden: 'OCS', id_ocs_m5: ocs.id_orden_compra_servicio_m5, asociado_por: actor.usuario_id_usuario } });
      const sku = `DEMOUI-MAT-${String(indice).padStart(2, '0')}`;
      await tx.material.update({ where: { material_sku: sku }, data: { material_descripcion: `${PREFIJO} inventario ficticio`, material_material_critico: indice <= 2, material_stock_critico: 3, material_stock_minimo: 6, material_sotck_maximo: 40, material_es_rotativo: indice % 2 === 0, material_estado: 'activo' } });
      await tx.material_proveedor.upsert({ where: { material_sku_proveedor_id_proveedor: { material_sku: sku, proveedor_id_proveedor: proveedor.id_proveedor } }, update: {}, create: { material_sku: sku, proveedor_id_proveedor: proveedor.id_proveedor, material_proveedor_tiempo_reposicion: 7 + indice, material_proveedor_precio_referencial: 15000 * indice, material_proveedor_proveedor_principal: true } });
      await tx.detalle_material_orden_compra_m5.upsert({ where: { id_ocs_m5_material_sku: { id_ocs_m5: ocs.id_orden_compra_servicio_m5, material_sku: sku } }, update: {}, create: { id_ocs_m5: ocs.id_orden_compra_servicio_m5, material_sku: sku, cantidad_pedida: 10 + indice, cantidad_recibida: indice < 4 ? indice : 10 + indice, fecha_esperada: fecha(indice * 3) } });
      let factura = await tx.factura_compra.findFirst({ where: { factura_compra_numero_factura: `${PREFIJO}-FC-${indice}` } });
      if (!factura) factura = await tx.factura_compra.create({ data: { factura_compra_numero_factura: `${PREFIJO}-FC-${indice}`, factura_compra_monto_neto: 150000 * indice, factura_compra_tipo_compra: `${PREFIJO} Materiales`, factura_compra_fecha_emision: fecha(-15 + indice), proveedor_id_proveedor: proveedor.id_proveedor } });
      let lote = await tx.lote.findFirst({ where: { lote_numero_lote: `${PREFIJO}-LOTE-${indice}` } });
      if (!lote) lote = await tx.lote.create({ data: { lote_numero_lote: `${PREFIJO}-LOTE-${indice}`, lote_fecha_ingreso: fecha(-70 - indice), lote_fecha_recepcion: indice < 4 ? fecha(-20 + indice) : null, lote_estado: indice < 4 ? 'recibido' : 'pendiente', proveedor_id_proveedor: proveedor.id_proveedor, factura_compra_id_factura: factura.factura_compra_id_factura } });
      await tx.inventario_bodega.upsert({ where: { material_sku_lote_id_lote_bodega_id_bodega: { material_sku: sku, lote_id_lote: lote.lote_id_lote, bodega_id_bodega: bodega.bodega_id_bodega } }, update: { inventario_bodega_cantidad_fisica: [2, 5, 12, 25, 0][indice - 1] }, create: { material_sku: sku, lote_id_lote: lote.lote_id_lote, bodega_id_bodega: bodega.bodega_id_bodega, inventario_bodega_cantidad_fisica: [2, 5, 12, 25, 0][indice - 1], inventario_bodega_cantidad_reservada: indice === 4 ? 4 : 0 } });
      if (!await tx.movimiento_inventario.findFirst({ where: { material_sku: sku, lote_id_lote: lote.lote_id_lote, movimiento_inventario_tipo_movimiento_id_tipo_movimiento: tipoMovimiento.movimiento_inventario_tipo_movimiento_id_tipo_movimiento } })) await tx.movimiento_inventario.create({ data: { movimiento_inventario_fecha_hora: fecha(-70 - indice), movimiento_inventario_cantidad: 10 + indice, movimiento_inventario_estado: 'confirmado', material_sku: sku, bodega_id_bodega: bodega.bodega_id_bodega, lote_id_lote: lote.lote_id_lote, factura_compra_id_factura_compra: factura.factura_compra_id_factura, usuario_id_usuario: actor.usuario_id_usuario, movimiento_inventario_tipo_movimiento_id_tipo_movimiento: tipoMovimiento.movimiento_inventario_tipo_movimiento_id_tipo_movimiento } });
    }
    await tx.fondo_caja_chica_m5.upsert({ where: { anio_mes: { anio: hoy.getUTCFullYear(), mes: hoy.getUTCMonth() + 1 } }, update: {}, create: { anio: hoy.getUTCFullYear(), mes: hoy.getUTCMonth() + 1, monto: 600000, actualizado_por: actor.usuario_id_usuario } });
    for (let indice = 1; indice <= 5; indice++) if (!await tx.gasto_caja_chica_m5.findFirst({ where: { descripcion: `${PREFIJO} Caja chica ${indice}` } })) await tx.gasto_caja_chica_m5.create({ data: { anio: hoy.getUTCFullYear(), mes: hoy.getUTCMonth() + 1, monto: 9000 * indice, descripcion: `${PREFIJO} Caja chica ${indice}`, fecha_gasto: fecha(-indice), comercio_emisor: `${PREFIJO} Comercio ${indice}`, estado: indice < 4 ? 'aprobado' : 'pendiente', registrado_por: actor.usuario_id_usuario, resuelto_por: indice < 4 ? actor.usuario_id_usuario : null, fecha_resolucion: indice < 4 ? new Date() : null } });
  }, { timeout: 120000 });
}

async function sembrarPersonasYOperacion() {
  await prisma.$transaction(async tx => {
    const actor = await tx.usuario.findFirstOrThrow({ where: { administrador_original: true } });
    const vinculo = await tx.tipo_vinculo_laboral.upsert({ where: { nombre_tipo_vinculo_laboral: `${PREFIJO} Contrato indefinido` }, update: {}, create: { nombre_tipo_vinculo_laboral: `${PREFIJO} Contrato indefinido`, descripcion_tipo_vinculo_laboral: 'Configuración ficticia de demostración' } });
    const esquemas = [];
    for (let indice = 1; indice <= 5; indice++) {
      esquemas.push(await tx.esquema_remuneracional.upsert({ where: { codigo: `${PREFIJO}-ESQUEMA-${indice}` }, update: {}, create: { codigo: `${PREFIJO}-ESQUEMA-${indice}`, nombre: `${PREFIJO} Esquema ${indice}`, descripcion: 'Esquema ficticio para QA visual', vigencia_desde: inicioMes } }));
      await tx.concepto_remuneracion.upsert({ where: { codigo_m6: `${PREFIJO}-HABER-${indice}` }, update: {}, create: { codigo_m6: `${PREFIJO}-HABER-${indice}`, nombre_concepto: `${PREFIJO} Haber ${indice}`, descripcion_concepto: 'Haber ficticio para QA visual', naturaleza_concepto: 'haber', estado_concepto: 'activo' } });
    }
    const periodo = await tx.periodo_remuneracion.upsert({ where: { anio_mes: { anio: hoy.getUTCFullYear(), mes: hoy.getUTCMonth() + 1 } }, update: {}, create: { anio: hoy.getUTCFullYear(), mes: hoy.getUTCMonth() + 1, fecha_inicio: inicioMes, fecha_fin: finMes } });
    const medio = await tx.medio_pago.upsert({ where: { nombre_medio_pago: `${PREFIJO} Transferencia` }, update: {}, create: { nombre_medio_pago: `${PREFIJO} Transferencia`, codigo_medio_pago: 'DEMO_UI_TRANSFERENCIA', requiere_respaldo: false } });
    for (let indice = 1; indice <= 5; indice++) {
      const rut = rutDemo(30 + indice);
      const empleado = await tx.empleado.upsert({ where: { rut_empleado: rut }, update: { correo_particular: `demo-ui-empleado${indice}@example.invalid` }, create: { rut_empleado: rut, nombres: `Empleado Demo ${indice}`, apellido_paterno: 'Visual', apellido_materno: 'QA', fecha_ingreso: fecha(-400 + indice * 30), sueldo_base: 700000 + indice * 175000, fecha_aplicacion_sueldo_base: inicioMes, estado_laboral: indice === 5 ? 'inactivo' : 'activo', correo_particular: `demo-ui-empleado${indice}@example.invalid`, telefono_particular: `+56 9 1000 ${String(indice).padStart(4, '0')}`, id_tipo_vinculo_laboral: vinculo.id_tipo_vinculo_laboral } });
      const relacionDemo = await tx.relacion_laboral_empleado.findFirst({ where: { id_empleado: empleado.id_empleado, estado: 'vigente' } });
      if (!relacionDemo) await tx.relacion_laboral_empleado.create({ data: { id_empleado: empleado.id_empleado, fecha_inicio: fecha(-400 + indice * 30), fecha_termino: finMes, estado: 'vigente', jornada: 'Completa', id_tipo_vinculo_laboral: vinculo.id_tipo_vinculo_laboral } });
      else await tx.relacion_laboral_empleado.update({ where: { id_relacion_laboral_empleado: relacionDemo.id_relacion_laboral_empleado }, data: { fecha_termino: finMes } });
      const esquema = esquemas[indice - 1];
      if (!await tx.asignacion_esquema_remuneracional.findFirst({ where: { id_empleado: empleado.id_empleado, id_esquema: esquema.id_esquema_remuneracional, activa: true } })) await tx.asignacion_esquema_remuneracional.create({ data: { id_empleado: empleado.id_empleado, id_esquema: esquema.id_esquema_remuneracional, vigencia_desde: inicioMes } });
      let remuneracion = await tx.remuneracion.findFirst({ where: { id_periodo_remuneracion: periodo.id_periodo_remuneracion, id_empleado: empleado.id_empleado, reemplaza_a_id: null } });
      const haberes = 700000 + indice * 175000, deducciones = 95000 + indice * 12000;
      if (!remuneracion) remuneracion = await tx.remuneracion.create({ data: { id_periodo_remuneracion: periodo.id_periodo_remuneracion, id_empleado: empleado.id_empleado, estado: 'cerrada', creado_por: actor.usuario_id_usuario, calculado_por: actor.usuario_id_usuario, calculado_en: new Date(), cerrado_por: actor.usuario_id_usuario, cerrado_en: new Date(), total_haberes: haberes, total_deducciones: deducciones, total_aportes_empleador: haberes * .04, base_imponible: haberes, base_tributable: haberes - deducciones, liquido_preliminar: haberes - deducciones } });
      else if (remuneracion.estado !== 'cerrada') remuneracion = await tx.remuneracion.update({ where: { id_remuneracion: remuneracion.id_remuneracion }, data: { estado: 'cerrada', cerrado_por: actor.usuario_id_usuario, cerrado_en: new Date() } });
      for (const componente of [{ clave: 'SUELDO', tipo: 'SUELDO_BASE', monto: haberes }, { clave: 'DEDUCCION', tipo: 'DEDUCCION_AUTOMATICA', monto: deducciones }]) if (!await tx.componente_remuneracion.findFirst({ where: { id_remuneracion: remuneracion.id_remuneracion, clave_negocio: `${PREFIJO}:${componente.clave}:${indice}` } })) await tx.componente_remuneracion.create({ data: { id_remuneracion: remuneracion.id_remuneracion, tipo: componente.tipo, descripcion: `${PREFIJO} ${componente.clave.toLowerCase()}`, monto: componente.monto, fuente_tipo: 'AUTOMATICA', clave_negocio: `${PREFIJO}:${componente.clave}:${indice}`, estado_revision: 'aprobado', creado_por: actor.usuario_id_usuario, revisado_por: actor.usuario_id_usuario, fecha_revision: new Date() } });
      await tx.pago_remuneracion.upsert({ where: { clave_idempotencia: `${PREFIJO}:PAGO-REM:${indice}` }, update: {}, create: { origen_tipo: 'REMUNERACION', origen_id: remuneracion.id_remuneracion, monto: haberes - deducciones, id_medio_pago: medio.id_medio_pago, respaldo: `${PREFIJO}://remuneracion/${indice}`, referencia: `${PREFIJO} pago remuneración ${indice}`, estado: indice < 4 ? 'CONFIRMADO' : 'PREPARADO', clave_idempotencia: `${PREFIJO}:PAGO-REM:${indice}`, creado_por: actor.usuario_id_usuario, confirmado_por: indice < 4 ? actor.usuario_id_usuario : null, confirmado_en: indice < 4 ? new Date() : null } });
    }
    for (let indice = 1; indice <= 5; indice++) {
      const identificador = `${PREFIJO}-HON-${indice}`;
      const prestador = await tx.prestador_honorarios.upsert({ where: { identificador }, update: {}, create: { identificador, nombre_razon_social: `${PREFIJO} Prestador ${indice}`, contacto: `demo-ui-honorarios${indice}@example.invalid`, estado: indice === 5 ? 'INACTIVO' : 'ACTIVO' } });
      if (!await tx.boleta_honorarios.findFirst({ where: { id_prestador: prestador.id_prestador_honorarios, folio: `${PREFIJO}-BH-${indice}` } })) await tx.boleta_honorarios.create({ data: { id_prestador: prestador.id_prestador_honorarios, folio: `${PREFIJO}-BH-${indice}`, fecha_emision: fecha(-indice), bruto: 120000 * indice, modalidad_tributaria: indice % 2 ? 'CON_RETENCION_RECEPTOR' : 'SIN_RETENCION_PPM_EMISOR', estado_documental: 'PENDIENTE_CONFIRMACION', respaldo: `${PREFIJO}://honorarios/${indice}`, referencia: `${PREFIJO} boleta ficticia ${indice}` } });
    }
    for (const parametro of [
      { codigo: 'M7_MARGEN_CRITICO', nombre: `${PREFIJO} Margen crítico`, valor: 15, unidad: 'PORCENTAJE' },
      { codigo: 'M7_LIQUIDEZ_UMBRAL_PREVENTIVO', nombre: `${PREFIJO} Liquidez preventiva`, valor: 2500000, unidad: 'MONTO' },
      { codigo: 'M7_LIQUIDEZ_UMBRAL_CRITICO', nombre: `${PREFIJO} Liquidez crítica`, valor: 1000000, unidad: 'MONTO' },
      { codigo: 'M7_DIAS_STOCK_INMOVIL', nombre: `${PREFIJO} Stock inmóvil`, valor: 60, unidad: 'DIAS' },
    ]) await tx.parametro_remuneracional.upsert({ where: { codigo_vigencia_desde: { codigo: parametro.codigo, vigencia_desde: inicioMes } }, update: {}, create: { ...parametro, tipo: 'DASHBOARD', descripcion: 'Configuración ficticia para QA visual', fuente: 'DEMO', referencia: PREFIJO, vigencia_desde: inicioMes, estado: 'activo' } });
    for (let indice = 1; indice <= 5; indice++) {
      const rut = rutDemo(indice), cliente = await tx.cliente.findUniqueOrThrow({ where: { cliente_cliente_rut: rut } });
      let especificacion = await tx.especificaciones_puerta.findFirst({ where: { especificacion_puerta_observaciones: `${PREFIJO}-ESP-${indice}` } });
      if (!especificacion) especificacion = await tx.especificaciones_puerta.create({ data: { especificacion_puerta_modelo_puerta: `Modelo Demo ${indice}`, especificacion_puerta_zona: ['Norte','Centro','Sur','Oriente','Poniente'][indice - 1], especificacion_puerta_sentido_apertura: indice % 2 ? 'Interior' : 'Exterior', especificacion_puerta_observaciones: `${PREFIJO}-ESP-${indice}` } });
      let medida = await tx.medidas_puerta.findFirst({ where: { id_especificacion_puerta: especificacion.especificacion_puerta_especificacion_puerta_id } });
      if (!medida) medida = await tx.medidas_puerta.create({ data: { id_especificacion_puerta: especificacion.especificacion_puerta_especificacion_puerta_id, medidas_puerta_medidas_marco_ancho: 900 + indice * 10, medidas_puerta_medidas_marco_alto: 2050 + indice * 10, medidas_puerta_medidas_marco_espesor: 50 } });
      if (!especificacion.id_medidas) await tx.especificaciones_puerta.update({ where: { especificacion_puerta_especificacion_puerta_id: especificacion.especificacion_puerta_especificacion_puerta_id }, data: { id_medidas: medida.medidas_puerta_medidas_id } });
      let obra = await tx.obra.findFirst({ where: { obra_referencia: `${PREFIJO}-OBRA-${indice}` } });
      if (!obra) obra = await tx.obra.create({ data: { obra_nombre_obra: `${PREFIJO} Obra ${indice}`, obra_direccion_obra: `Avenida Demo ${100 + indice}`, obra_comuna: ['Santiago','Providencia','Ñuñoa','Maipú','Las Condes'][indice - 1], obra_ciudad: 'Santiago', obra_region: 'Metropolitana', obra_tipo_obra: 'Instalación', obra_fecha_de_creacion: fecha(-30), obra_fecha_de_ultima_edicion: fecha(-indice), obra_estado: indice < 4 ? 'activa' : 'cerrada', obra_cantidad_puerta: indice, obra_referencia: `${PREFIJO}-OBRA-${indice}`, rut_cliente: cliente.cliente_cliente_rut, id_especificacion_puerta: especificacion.especificacion_puerta_especificacion_puerta_id } });
      let servicio = await tx.servicio_terreno.findFirst({ where: { id_obra: obra.obra_obra_id, servicio_terreno_observaciones: `${PREFIJO} visita ${indice}` } });
      const estadoServicio = ['pendiente','en_progreso','pendiente','cerrada','cerrada'][indice - 1];
      if (!servicio) servicio = await tx.servicio_terreno.create({ data: { servicio_terreno_tipo_servicio: 'Instalación', servicio_terreno_fecha_real: indice >= 4 ? inicioMes : null, servicio_terreno_prioridad: indice === 1 ? 'alta' : 'normal', servicio_terreno_estado: estadoServicio, servicio_terreno_observaciones: `${PREFIJO} visita ${indice}`, id_obra: obra.obra_obra_id } });
      else servicio = await tx.servicio_terreno.update({ where: { servicio_terreno_servicio_terreno_id: servicio.servicio_terreno_servicio_terreno_id }, data: { servicio_terreno_estado: estadoServicio, servicio_terreno_fecha_real: indice >= 4 ? inicioMes : null } });
      let tarea = await tx.tarea.findFirst({ where: { tarea_titulo: `${PREFIJO} Tarea ${indice}`, id_servicio_terreno: servicio.servicio_terreno_servicio_terreno_id } });
      if (!tarea) tarea = await tx.tarea.create({ data: { tarea_titulo: `${PREFIJO} Tarea ${indice}`, tarea_descripcion: 'Actividad ficticia para QA visual', tarea_fecha_de_creacion: fecha(-10), tarea_fecha_de_inicio: fecha(-5), tarea_fecha_de_termino: indice >= 4 ? fecha(-indice) : null, tarea_horario_limite: fecha(indice - 3), tarea_urgencia: indice === 1 ? 'alta' : 'normal', tarea_estado_de_tarea: indice >= 4 ? 'completada' : 'pendiente', id_servicio_terreno: servicio.servicio_terreno_servicio_terreno_id, id_especificacion_puerta: especificacion.especificacion_puerta_especificacion_puerta_id } });
      let ot = await tx.orden_trabajo.findFirst({ where: { especificaciones_puerta_id_especificacion_puerta: especificacion.especificacion_puerta_especificacion_puerta_id } });
      if (!ot) ot = await tx.orden_trabajo.create({ data: { orden_trabajo_fecha_hora: fecha(-8 + indice), orden_trabajo_estado: ['pendiente','en_progreso','en_progreso','completada','cancelada'][indice - 1], especificaciones_puerta_id_especificacion_puerta: especificacion.especificacion_puerta_especificacion_puerta_id } });
      await tx.material_orden_trabajo.upsert({ where: { material_sku_orden_trabajo_id_orden: { material_sku: `DEMOUI-MAT-${String(indice).padStart(2, '0')}`, orden_trabajo_id_orden: ot.orden_trabajo_id_orden } }, update: {}, create: { material_sku: `DEMOUI-MAT-${String(indice).padStart(2, '0')}`, orden_trabajo_id_orden: ot.orden_trabajo_id_orden, material_orden_trabajo_consumo_estimado: 3 + indice, material_orden_trabajo_consumo_real: indice >= 4 ? 2 + indice : null } });
      await tx.tarea.update({ where: { tarea_tarea_id: tarea.tarea_tarea_id }, data: { id_orden_trabajo: ot.orden_trabajo_id_orden } });
      await tx.tarea_usuario.upsert({ where: { tarea_usuario_tarea_id_tarea_usuario_usuario_id: { tarea_usuario_tarea_id: tarea.tarea_tarea_id, tarea_usuario_usuario_id: actor.usuario_id_usuario } }, update: {}, create: { tarea_usuario_tarea_id: tarea.tarea_tarea_id, tarea_usuario_usuario_id: actor.usuario_id_usuario } });
      let ejecucion = await tx.ejecucion_tarea.findFirst({ where: { id_tarea: tarea.tarea_tarea_id, id_usuario_ejecutor: actor.usuario_id_usuario } });
      if (!ejecucion) ejecucion = await tx.ejecucion_tarea.create({ data: { id_tarea: tarea.tarea_tarea_id, id_usuario_ejecutor: actor.usuario_id_usuario, fecha_ejecucion: fecha(-indice), estado_ejecucion: indice < 4 ? 'en_ejecucion' : 'terminada', estado_validacion_productiva: indice % 2 ? 'pendiente' : 'validada', cantidad: indice, unidad: 'UNIDAD' } });
      if (!await tx.incidencia_retrabajo_tarea.findFirst({ where: { id_ejecucion_tarea: ejecucion.id_ejecucion_tarea, descripcion: `${PREFIJO} incidencia ${indice}` } })) await tx.incidencia_retrabajo_tarea.create({ data: { id_ejecucion_tarea: ejecucion.id_ejecucion_tarea, descripcion: `${PREFIJO} incidencia ${indice}`, causa_referencia: `${PREFIJO}-CAUSA-${indice}`, estado: indice < 4 ? 'pendiente' : 'cerrada', responsabilidad: 'Proceso DEMO-UI' } });
    }
  }, { timeout: 120000 });
}

async function sembrarHistoricoRealista() {
  const nombresEmpresa = ['Constructora Horizonte', 'Inmobiliaria Cordillera', 'Arquitectura Norte', 'Proyectos Andes', 'Comercial Los Robles', 'Desarrollos Mapocho', 'Edifica Pacífico', 'Ingeniería Santa Elena', 'Grupo Vértice', 'Constructora Valle Central', 'Espacios Urbanos', 'Inversiones Alto Sur', 'Obras Nueva Alameda', 'Diseño y Seguridad Austral', 'Edificaciones Bellavista', 'Proyectos Parque Norte', 'Comercial San Cristóbal', 'Arquitectura del Valle', 'Constructora Los Canelos', 'Inmobiliaria Nueva Cordillera', 'Soluciones Habitacionales Sur', 'Obras Metropolitanas', 'Proyectos Costa Central', 'Constructora El Arrayán', 'Desarrollos Los Maitenes', 'Comercial Puerta Norte', 'Ingeniería Los Robles', 'Edifica Los Andes', 'Arquitectura Plaza Central', 'Proyectos Cerro Alto'];
  const nombresPersona = ['Camila Fuentes', 'Martín Reyes', 'Valentina Rojas', 'Diego Morales', 'Sofía Herrera', 'Tomás Castillo', 'Josefa Silva', 'Benjamín Muñoz', 'Antonia Navarro', 'Vicente Contreras', 'Isidora Vega', 'Matías Paredes', 'Florencia Soto', 'Joaquín Campos', 'Trinidad Sepúlveda', 'Agustín Araya', 'Catalina Espinoza', 'Felipe Valdés', 'Amanda Salazar', 'Nicolás Bustos', 'Renata Tapia', 'Sebastián Carrasco', 'Emilia Figueroa', 'Gabriel Medina', 'Maite Cabrera', 'Lucas Farías', 'Julieta Sandoval', 'Simón Godoy', 'Dominga Leiva', 'Bastián Correa'];
  const productos = ['Puerta blindada residencial estándar', 'Puerta blindada residencial premium', 'Puerta de seguridad comercial', 'Puerta cortafuego reforzada', 'Refuerzo de marco metálico', 'Cerradura multipunto', 'Cilindro de alta seguridad', 'Instalación estándar', 'Instalación especial', 'Retiro de puerta existente', 'Terminación y pintura', 'Mantención preventiva'];
  const materiales = ['Plancha de acero', 'Marco metálico', 'Cerradura multipunto', 'Bisagra reforzada', 'Cilindro de seguridad', 'Aislante acústico', 'Pintura anticorrosiva', 'Perno de anclaje', 'Manilla de seguridad', 'Burlete perimetral', 'Electrodo de soldadura', 'Disco de corte', 'Perfil estructural', 'Placa interior', 'Placa exterior', 'Mirilla de seguridad', 'Pasador reforzado', 'Sellante ignífugo', 'Espuma aislante', 'Tornillo autoperforante', 'Remache estructural', 'Imprimante metálico', 'Esmalte de terminación', 'Cable de control', 'Sensor magnético', 'Cierrapuertas hidráulico', 'Protector de cilindro', 'Junta de goma', 'Kit de fijación', 'Consumible de pulido'];
  const empleados = [['Daniel','Rojas','Mella'],['Francisca','Pérez','Silva'],['Cristóbal','Muñoz','Araya'],['Paula','González','Vega'],['Rodrigo','Castillo','León'],['Carolina','Soto','Mora'],['Ignacio','Herrera','Díaz'],['Daniela','Campos','Reyes'],['Felipe','Navarro','Sáez'],['Alejandra','Contreras','Lagos'],['Mauricio','Espinoza','Núñez'],['Verónica','Valdés','Pino'],['Javier','Salazar','Ríos'],['Constanza','Bustos','Toro'],['Patricio','Tapia','Cruz'],['María José','Carrasco','Paz'],['Álvaro','Figueroa','Vidal'],['Natalia','Medina','Lara']];

  await prisma.$transaction(async tx => {
    const [clp, empresa, persona, transferencia, categoria, tipoFactura] = await Promise.all([
      tx.moneda.findUniqueOrThrow({ where: { codigo_moneda: 'CLP' } }),
      tx.tipo_cliente_financiero.findUniqueOrThrow({ where: { nombre_tipo_cliente_financiero: 'B2B' } }),
      tx.tipo_cliente_financiero.findUniqueOrThrow({ where: { nombre_tipo_cliente_financiero: 'B2C' } }),
      tx.medio_pago.findUniqueOrThrow({ where: { nombre_medio_pago: 'Transferencia' } }),
      tx.categoria_pago.findUniqueOrThrow({ where: { nombre: 'Abono parcial' } }),
      tx.tipo_documento.findUniqueOrThrow({ where: { nombre_tipo_documento: 'Factura Electrónica' } }),
    ]);
    const items = [];
    for (let indice = 0; indice < productos.length; indice++) {
      const nombre = `${PREFIJO} | ${productos[indice]}`;
      let item = await tx.item_comercial.findFirst({ where: { nombre_item: nombre } });
      if (!item) item = await tx.item_comercial.create({ data: { nombre_item: nombre, descripcion_item: productos[indice], tipo_item: indice < 7 ? 'PRODUCTO' : 'SERVICIO', estado_item: 'activo' } });
      items.push(item);
    }
    const fichas = [];
    for (let indice = 0; indice < 60; indice++) {
      const razonSocial = indice < 30 ? nombresEmpresa[indice] : nombresPersona[indice - 30];
      const rut = rutDemo(indice + 1), marcador = `${PREFIJO}-CLIENTE-${indice + 1}`, b2b = indice < 30;
      await tx.cliente.upsert({ where: { cliente_cliente_rut: rut }, update: { cliente_razon_social: razonSocial, cliente_correo: `demo-ui-cliente${indice + 1}@example.invalid` }, create: { cliente_cliente_rut: rut, cliente_razon_social: razonSocial, cliente_correo: `demo-ui-cliente${indice + 1}@example.invalid`, cliente_telefono: `+56 9 7000 ${String(indice + 1).padStart(4, '0')}`, cliente_es_cliente_b2b: b2b, cliente_es_cliente_b2c: !b2b } });
      const cliente = await tx.cliente_financiero.upsert({ where: { referencia_demostracion: marcador }, update: { rut_cliente: rut, nombre_razon_social_referencia: razonSocial }, create: { referencia_demostracion: marcador, rut_cliente: rut, id_tipo_cliente_financiero: b2b ? empresa.id_tipo_cliente_financiero : persona.id_tipo_cliente_financiero, nombre_razon_social_referencia: razonSocial, telefono_financiero: `+56 9 7000 ${String(indice + 1).padStart(4, '0')}`, correo_financiero: `demo-ui-cliente${indice + 1}@example.invalid`, estado_financiero: indice >= 56 ? 'inactivo' : 'activo', nivel_formalizacion: indice % 11 === 0 ? 'provisional' : 'formal' } });
      fichas.push(await tx.ficha_cliente.upsert({ where: { id_cliente_financiero: cliente.id_cliente_financiero }, update: {}, create: { id_cliente_financiero: cliente.id_cliente_financiero, estado_ficha: indice >= 56 ? 'inactiva' : 'activa', observacion_financiera_general: `${PREFIJO}: cartera ficticia histórica` } }));
    }
    let correlativoVenta = 0;
    for (let mes = 0; mes < MESES_HISTORICOS; mes++) {
      const base = mesHistorico(mes), mesClave = claveMes(base), mesCalendario = base.getUTCMonth();
      const estacionalidad = [8,8,10,11,12,12,10,11,14,15,16,17][mesCalendario];
      const crecimiento = mes >= 12 ? 2 : 0;
      const cantidad = estacionalidad + crecimiento + (mes === 20 ? 3 : 0) - (mes === 5 ? 2 : 0);
      for (let orden = 1; orden <= cantidad; orden++) {
        const clave = `${mesClave}-${String(orden).padStart(3, '0')}`, ficha = fichas[variacion(0, fichas.length - 1, mes, orden)];
        const item = items[variacion(0, items.length - 1, orden, mes)];
        const cantidadItem = variacion(1, 4, mes, orden, 7);
        const baseProducto = 320000 + item.id_item_comercial % 7 * 185000;
        const monto = Math.round((baseProducto * cantidadItem + variacion(25000, 420000, mes, orden)) / 1000) * 1000;
        const fechaEmision = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), variacion(2, 22, mes, orden)));
        const convertido = (orden + mes * 3) % 10 < (mesCalendario >= 8 ? 7 : 6);
        const estado = convertido ? 'aprobada' : (orden % 3 === 0 ? 'rechazada' : orden % 4 === 0 ? 'vencida' : 'emitida');
        const referencia = `${PREFIJO}-COT-${clave}`;
        let cotizacion = await tx.cotizacion.findUnique({ where: { referencia_demostracion: referencia } });
        if (!cotizacion) cotizacion = await tx.cotizacion.create({ data: { referencia_demostracion: referencia, id_ficha_cliente: ficha.id_ficha_cliente, id_moneda: clp.id_moneda, fecha_emision: fechaEmision, fecha_vigencia: new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 5)), estado_cotizacion: estado, subtotal_costos_estimados: monto * (0.54 + (orden % 4) * .04), margen_esperado: 46 - (orden % 4) * 4, precio_sugerido: monto, monto_neto: monto, monto_impuesto: Math.round(monto * .19), monto_total_estimado: Math.round(monto * 1.19), detalle_cotizacion: { create: [{ id_item_comercial: item.id_item_comercial, cantidad_item: cantidadItem, subtotal_item_estimado: monto, descripcion_item_cotizado: productos[items.indexOf(item)] }] } } });
        if (!convertido) continue;
        correlativoVenta++;
        const numero = `${PREFIJO}-NV-${clave}`;
        const vencimiento = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, variacion(5, 20, mes, orden)));
        let proyecto = null;
        if (correlativoVenta % 4 === 0) {
          const codigoProyecto = `${PREFIJO}-PROY-${String(correlativoVenta).padStart(3, '0')}`;
          proyecto = await tx.proyecto.findFirst({ where: { proyecto_codigo_proyecto: codigoProyecto } });
          if (!proyecto) proyecto = await tx.proyecto.create({ data: { proyecto_codigo_proyecto: codigoProyecto, proyecto_nombre_referencia: `${PREFIJO} | ${ficha.id_ficha_cliente} | ${productos[items.indexOf(item)]}`, proyecto_fecha_ingreso: fechaEmision, proyecto_fecha_instalacion: new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 2, 10)), proyecto_estado_operacional: mes < 19 ? 'cerrado' : mes < 23 ? 'activo' : 'atrasado', proyecto_estado_produccion: mes < 19 ? 'completada' : 'en_progreso', rut_cliente: (await tx.cliente_financiero.findFirstOrThrow({ where: { ficha_cliente: { id_ficha_cliente: ficha.id_ficha_cliente } } })).rut_cliente } });
        }
        const total = Math.round(monto * 1.19);
        const nota = await tx.nota_venta.upsert({ where: { numero_nota_venta: numero }, update: {}, create: { numero_nota_venta: numero, id_ficha_cliente: ficha.id_ficha_cliente, id_cotizacion: cotizacion.id_cotizacion, id_moneda: clp.id_moneda, id_proyecto_contexto: proyecto?.proyecto_proyecto_id, fecha_emision: fechaEmision, fecha_vencimiento: vencimiento, monto_neto: monto, monto_impuesto: total - monto, monto_total: total, estado_nota_venta: 'confirmada', estado_pago: orden % 7 === 0 ? 'pendiente' : orden % 5 === 0 ? 'parcial' : 'pagada' } });
        const folio = `${PREFIJO}-FAC-${clave}`;
        const documento = await tx.documento_tributario.upsert({ where: { id_tipo_documento_folio_documento: { id_tipo_documento: tipoFactura.id_tipo_documento, folio_documento: folio } }, update: {}, create: { id_ficha_cliente: ficha.id_ficha_cliente, id_nota_venta: nota.id_nota_venta, id_moneda: clp.id_moneda, id_tipo_documento: tipoFactura.id_tipo_documento, folio_documento: folio, fecha_emision: fechaEmision, fecha_vencimiento: vencimiento, monto_neto: monto, monto_impuesto: total - monto, monto_total: total } });
        await tx.documento_tributario_nota_venta.upsert({ where: { id_documento_tributario_id_nota_venta: { id_documento_tributario: documento.id_documento_tributario, id_nota_venta: nota.id_nota_venta } }, update: {}, create: { id_documento_tributario: documento.id_documento_tributario, id_nota_venta: nota.id_nota_venta } });
        if (orden % 7 !== 0) {
          const pagado = orden % 5 === 0 ? Math.round(total * .45) : total;
          const fechaPagoCalculada = new Date(vencimiento); fechaPagoCalculada.setUTCDate(fechaPagoCalculada.getUTCDate() + (orden % 6 === 0 ? 18 : -variacion(1, 8, orden, mes)));
          const fechaPago = acotarFechaEfectiva(fechaPagoCalculada);
          const pago = await tx.pago_cliente.upsert({ where: { referencia_demostracion: `${PREFIJO}-PAGO-${clave}` }, update: { fecha_pago: fechaPago }, create: { referencia_demostracion: `${PREFIJO}-PAGO-${clave}`, id_ficha_cliente: ficha.id_ficha_cliente, id_moneda: clp.id_moneda, id_medio_pago: transferencia.id_medio_pago, id_categoria_pago: categoria.id_categoria_pago, fecha_pago: fechaPago, monto_pago: pagado, comprobante_pago: `${PREFIJO}://cobro/${clave}` } });
          if (!await tx.asignacion_pago_cliente.findFirst({ where: { id_pago_cliente: pago.id_pago_cliente, id_nota_venta: nota.id_nota_venta } })) await tx.asignacion_pago_cliente.create({ data: { id_pago_cliente: pago.id_pago_cliente, id_nota_venta: nota.id_nota_venta, monto_asignado: pagado } });
          const observacionMovimiento = `${PREFIJO} Movimiento venta ${clave}`;
          const movimiento = await tx.movimiento_financiero.findFirst({ where: { observacion: observacionMovimiento } });
          if (movimiento) await tx.movimiento_financiero.update({ where: { id_movimiento_financiero: movimiento.id_movimiento_financiero }, data: { fecha_movimiento: fechaPago } });
          else await tx.movimiento_financiero.create({ data: { id_moneda: clp.id_moneda, fecha_movimiento: fechaPago, tipo_movimiento_financiero: 'PAGO_CLIENTE', naturaleza_movimiento: 'ingreso', motivo_movimiento: `${PREFIJO} cobro histórico`, monto_movimiento: pagado, estado_movimiento: 'registrado', observacion: observacionMovimiento } });
        }
        if (proyecto) {
          const codigo = `${PREFIJO}-PF-${String(correlativoVenta).padStart(3, '0')}`;
          const costoFactor = .52 + (correlativoVenta % 6) * .055;
          const pf = await tx.proyecto_financiero.upsert({ where: { codigo_proyecto_financiero: codigo }, update: {}, create: { id_ficha_cliente: ficha.id_ficha_cliente, id_nota_venta: nota.id_nota_venta, id_proyecto_terreno: proyecto.proyecto_proyecto_id, id_moneda: clp.id_moneda, codigo_proyecto_financiero: codigo, fecha_inicio_financiera: fechaEmision, fecha_cierre_financiera: mes < 19 ? new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 2, 20)) : null, estado_financiero_proyecto: mes < 19 ? 'cerrado' : 'activo', monto_venta_estimado: monto, monto_costo_estimado: Math.round(monto * costoFactor), monto_costo_real: mes < 19 ? Math.round(monto * (costoFactor + .02)) : null, observacion_financiera: `${PREFIJO} proyecto histórico` } });
          if (!await tx.costo_proyecto.findFirst({ where: { id_proyecto_financiero: pf.id_proyecto_financiero, descripcion_costo: `${PREFIJO} Costo ${codigo}` } })) await tx.costo_proyecto.create({ data: { id_proyecto_financiero: pf.id_proyecto_financiero, id_moneda: clp.id_moneda, descripcion_costo: `${PREFIJO} Costo ${codigo}`, categoria_costo: 'Materiales DEMO-UI', monto_costo: Math.round(monto * costoFactor), fecha_costo: fechaEmision, origen_costo: 'DEMO_UI', estado_costo: 'registrado' } });
        }
      }
    }
  }, { timeout: 300000 });

  await prisma.$transaction(async tx => {
    const actor = await tx.usuario.findFirstOrThrow({ where: { administrador_original: true } });
    const clp = await tx.moneda.findUniqueOrThrow({ where: { codigo_moneda: 'CLP' } });
    const vinculo = await tx.tipo_vinculo_laboral.findUniqueOrThrow({ where: { nombre_tipo_vinculo_laboral: `${PREFIJO} Contrato indefinido` } });
    const medio = await tx.medio_pago.findUniqueOrThrow({ where: { nombre_medio_pago: `${PREFIJO} Transferencia` } });
    const esquemas = await tx.esquema_remuneracional.findMany({ where: { codigo: { startsWith: `${PREFIJO}-ESQUEMA-` } }, orderBy: { id_esquema_remuneracional: 'asc' } });
    const empleadosCreados = [];
    for (let indice = 0; indice < empleados.length; indice++) {
      const rut = rutDemo(31 + indice), ingreso = mesHistorico(Math.min(indice % 8, 7), 1);
      const [nombres, paterno, materno] = empleados[indice];
      const empleado = await tx.empleado.upsert({ where: { rut_empleado: rut }, update: { nombres, apellido_paterno: paterno, apellido_materno: materno }, create: { rut_empleado: rut, nombres, apellido_paterno: paterno, apellido_materno: materno, fecha_ingreso: ingreso, sueldo_base: 720000 + indice * 65000, fecha_aplicacion_sueldo_base: ingreso, estado_laboral: indice >= 16 ? 'inactivo' : 'activo', correo_particular: `demo-ui-empleado${indice + 1}@example.invalid`, telefono_particular: `+56 9 7100 ${String(indice + 1).padStart(4, '0')}`, id_tipo_vinculo_laboral: vinculo.id_tipo_vinculo_laboral } });
      empleadosCreados.push(empleado);
      if (!await tx.relacion_laboral_empleado.findFirst({ where: { id_empleado: empleado.id_empleado } })) await tx.relacion_laboral_empleado.create({ data: { id_empleado: empleado.id_empleado, fecha_inicio: ingreso, fecha_termino: indice >= 16 ? mesHistorico(21, 28) : null, estado: indice >= 16 ? 'terminada' : 'vigente', jornada: 'Completa', id_tipo_vinculo_laboral: vinculo.id_tipo_vinculo_laboral } });
      const esquema = esquemas[indice % esquemas.length];
      if (!await tx.asignacion_esquema_remuneracional.findFirst({ where: { id_empleado: empleado.id_empleado, activa: true } })) await tx.asignacion_esquema_remuneracional.create({ data: { id_empleado: empleado.id_empleado, id_esquema: esquema.id_esquema_remuneracional, vigencia_desde: ingreso } });
    }
    for (let mes = 0; mes < MESES_HISTORICOS; mes++) {
      const inicio = mesHistorico(mes), fin = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + 1, 0));
      const periodo = await tx.periodo_remuneracion.upsert({ where: { anio_mes: { anio: inicio.getUTCFullYear(), mes: inicio.getUTCMonth() + 1 } }, update: {}, create: { anio: inicio.getUTCFullYear(), mes: inicio.getUTCMonth() + 1, fecha_inicio: inicio, fecha_fin: fin } });
      for (let indice = 0; indice < empleadosCreados.length; indice++) {
        if (mes < indice % 8 || (indice >= 16 && mes > 21)) continue;
        let remuneracion = await tx.remuneracion.findFirst({ where: { id_periodo_remuneracion: periodo.id_periodo_remuneracion, id_empleado: empleadosCreados[indice].id_empleado, reemplaza_a_id: null } });
        const reajuste = mes >= 12 ? 1.045 : 1;
        const haberes = Math.round((720000 + indice * 65000) * reajuste + (mes % 4) * 12000), deducciones = Math.round(haberes * (.135 + (indice % 3) * .005));
        if (!remuneracion) remuneracion = await tx.remuneracion.create({ data: { id_periodo_remuneracion: periodo.id_periodo_remuneracion, id_empleado: empleadosCreados[indice].id_empleado, estado: 'cerrada', creado_por: actor.usuario_id_usuario, calculado_por: actor.usuario_id_usuario, calculado_en: fin, cerrado_por: actor.usuario_id_usuario, cerrado_en: fin, total_haberes: haberes, total_deducciones: deducciones, total_aportes_empleador: Math.round(haberes * .04), base_imponible: haberes, base_tributable: haberes - deducciones, liquido_preliminar: haberes - deducciones } });
        for (const componente of [{ clave: 'SUELDO', tipo: 'SUELDO_BASE', monto: haberes }, { clave: 'DEDUCCION', tipo: 'DEDUCCION_AUTOMATICA', monto: deducciones }]) {
          const claveNegocio = `${PREFIJO}:${componente.clave}:${claveMes(inicio)}:${indice + 1}`;
          if (!await tx.componente_remuneracion.findFirst({ where: { id_remuneracion: remuneracion.id_remuneracion, clave_negocio: claveNegocio } })) await tx.componente_remuneracion.create({ data: { id_remuneracion: remuneracion.id_remuneracion, tipo: componente.tipo, descripcion: `${PREFIJO} ${componente.clave.toLowerCase()}`, monto: componente.monto, fuente_tipo: 'AUTOMATICA', clave_negocio: claveNegocio, estado_revision: 'aprobado', creado_por: actor.usuario_id_usuario, revisado_por: actor.usuario_id_usuario, fecha_revision: fin } });
        }
        if (!await tx.pago_remuneracion.findFirst({ where: { origen_tipo: 'REMUNERACION', origen_id: remuneracion.id_remuneracion, estado: { not: 'REVERSADO' } } })) await tx.pago_remuneracion.upsert({ where: { clave_idempotencia: `${PREFIJO}:PAGO-REM:${claveMes(inicio)}:${indice + 1}` }, update: {}, create: { origen_tipo: 'REMUNERACION', origen_id: remuneracion.id_remuneracion, monto: haberes - deducciones, id_medio_pago: medio.id_medio_pago, respaldo: `${PREFIJO}://remuneracion/${claveMes(inicio)}/${indice + 1}`, referencia: `${PREFIJO} pago remuneración ${claveMes(inicio)} ${indice + 1}`, estado: 'CONFIRMADO', clave_idempotencia: `${PREFIJO}:PAGO-REM:${claveMes(inicio)}:${indice + 1}`, creado_por: actor.usuario_id_usuario, confirmado_por: actor.usuario_id_usuario, confirmado_en: fin } });
      }
    }
    for (let prestadorIndice = 1; prestadorIndice <= 10; prestadorIndice++) {
      const identificador = `${PREFIJO}-HON-${prestadorIndice}`;
      const prestador = await tx.prestador_honorarios.upsert({ where: { identificador }, update: {}, create: { identificador, nombre_razon_social: `Servicios Especializados ${String.fromCharCode(64 + prestadorIndice)}`, contacto: `demo-ui-honorarios${prestadorIndice}@example.invalid`, estado: prestadorIndice === 10 ? 'INACTIVO' : 'ACTIVO' } });
      for (let mes = prestadorIndice % 3; mes < MESES_HISTORICOS; mes += 3) {
        const folio = `${PREFIJO}-BH-${claveMes(mesHistorico(mes))}-${prestadorIndice}`;
        if (!await tx.boleta_honorarios.findFirst({ where: { id_prestador: prestador.id_prestador_honorarios, folio } })) await tx.boleta_honorarios.create({ data: { id_prestador: prestador.id_prestador_honorarios, folio, fecha_emision: mesHistorico(mes, 18), bruto: 180000 + prestadorIndice * 35000 + mes * 4000, modalidad_tributaria: prestadorIndice % 2 ? 'CON_RETENCION_RECEPTOR' : 'SIN_RETENCION_PPM_EMISOR', estado_documental: 'PENDIENTE_CONFIRMACION', respaldo: `${PREFIJO}://honorarios/${folio}`, referencia: `${PREFIJO} boleta histórica ${folio}` } });
      }
    }
    void clp;
  }, { timeout: 300000 });

  await prisma.$transaction(async tx => {
    const actor = await tx.usuario.findFirstOrThrow({ where: { administrador_original: true } });
    const clp = await tx.moneda.findUniqueOrThrow({ where: { codigo_moneda: 'CLP' } });
    for (let indice = 0; indice < materiales.length; indice++) {
      const sku = `DEMOUI-MAT-${String(indice + 1).padStart(2, '0')}`;
      await tx.material.upsert({ where: { material_sku: sku }, update: { material_nombre_material: materiales[indice] }, create: { material_sku: sku, material_nombre_material: materiales[indice], material_descripcion: `${PREFIJO} insumo ficticio`, material_material_critico: indice % 7 === 0, material_stock_critico: 4, material_stock_minimo: 10, material_sotck_maximo: 100, material_es_rotativo: indice % 4 !== 0, material_estado: 'activo' } });
      if (!await tx.historial_precio_material.findFirst({ where: { material_sku: sku, fecha_vigencia_inicio: mesHistorico(0) } })) await tx.historial_precio_material.create({ data: { material_sku: sku, id_moneda: clp.id_moneda, precio_unitario: 4500 + indice * 2750, fecha_vigencia_inicio: mesHistorico(0), estado_precio: 'vigente' } });
    }
    const clientes = await tx.cliente.findMany({ where: { cliente_correo: { startsWith: 'demo-ui-cliente', endsWith: '@example.invalid' } }, orderBy: { cliente_cliente_rut: 'asc' }, take: 40 });
    const materialesDb = await tx.material.findMany({ where: { material_sku: { startsWith: 'DEMOUI-MAT-' } }, orderBy: { material_sku: 'asc' } });
    for (let indice = 1; indice <= 40; indice++) {
      const codigo = `${PREFIJO}-OBRA-${indice}`;
      let especificacion = await tx.especificaciones_puerta.findFirst({ where: { especificacion_puerta_observaciones: `${PREFIJO}-ESP-${indice}` } });
      if (!especificacion) especificacion = await tx.especificaciones_puerta.create({ data: { especificacion_puerta_modelo_puerta: productos[indice % 5], especificacion_puerta_zona: ['Norte','Centro','Sur','Oriente','Poniente'][indice % 5], especificacion_puerta_sentido_apertura: indice % 2 ? 'Interior' : 'Exterior', especificacion_puerta_observaciones: `${PREFIJO}-ESP-${indice}` } });
      let medida = await tx.medidas_puerta.findFirst({ where: { id_especificacion_puerta: especificacion.especificacion_puerta_especificacion_puerta_id } });
      if (!medida) medida = await tx.medidas_puerta.create({ data: { id_especificacion_puerta: especificacion.especificacion_puerta_especificacion_puerta_id, medidas_puerta_medidas_marco_ancho: 880 + indice % 8 * 10, medidas_puerta_medidas_marco_alto: 2020 + indice % 6 * 10, medidas_puerta_medidas_marco_espesor: 45 + indice % 3 * 5 } });
      if (!especificacion.id_medidas) especificacion = await tx.especificaciones_puerta.update({ where: { especificacion_puerta_especificacion_puerta_id: especificacion.especificacion_puerta_especificacion_puerta_id }, data: { id_medidas: medida.medidas_puerta_medidas_id } });
      let obra = await tx.obra.findFirst({ where: { obra_referencia: codigo } });
      if (!obra) {
        const inicio = mesHistorico(indice % MESES_HISTORICOS, 4);
        obra = await tx.obra.create({ data: { obra_nombre_obra: `Instalación ${clientes[(indice - 1) % clientes.length].cliente_razon_social}`, obra_direccion_obra: `Avenida Ficticia ${120 + indice}`, obra_comuna: ['Santiago','Providencia','Ñuñoa','Maipú','Las Condes','La Florida'][indice % 6], obra_ciudad: 'Santiago', obra_region: 'Metropolitana', obra_tipo_obra: 'Instalación', obra_fecha_de_creacion: inicio, obra_fecha_de_ultima_edicion: new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + 1, 10)), obra_estado: indice <= 30 ? 'cerrada' : indice % 3 ? 'activa' : 'atrasada', obra_cantidad_puerta: 1 + indice % 4, obra_referencia: codigo, rut_cliente: clientes[(indice - 1) % clientes.length].cliente_cliente_rut, id_especificacion_puerta: especificacion.especificacion_puerta_especificacion_puerta_id } });
      }
      let ot = await tx.orden_trabajo.findFirst({ where: { especificaciones_puerta_id_especificacion_puerta: especificacion.especificacion_puerta_especificacion_puerta_id } });
      if (!ot) ot = await tx.orden_trabajo.create({ data: { orden_trabajo_fecha_hora: obra.obra_fecha_de_creacion, orden_trabajo_estado: indice <= 28 ? 'completada' : indice % 4 === 0 ? 'pendiente' : 'en_progreso', especificaciones_puerta_id_especificacion_puerta: especificacion.especificacion_puerta_especificacion_puerta_id } });
      const material = materialesDb[(indice - 1) % materialesDb.length];
      await tx.material_orden_trabajo.upsert({ where: { material_sku_orden_trabajo_id_orden: { material_sku: material.material_sku, orden_trabajo_id_orden: ot.orden_trabajo_id_orden } }, update: {}, create: { material_sku: material.material_sku, orden_trabajo_id_orden: ot.orden_trabajo_id_orden, material_orden_trabajo_consumo_estimado: 3 + indice % 8, material_orden_trabajo_consumo_real: indice <= 28 ? 2 + indice % 8 : null } });
      for (let visitaIndice = 1; visitaIndice <= (indice <= 20 ? 3 : 2); visitaIndice++) {
        const referenciaVisita = `${PREFIJO} visita ${indice}-${visitaIndice}`;
        let servicio = await tx.servicio_terreno.findFirst({ where: { id_obra: obra.obra_obra_id, servicio_terreno_observaciones: referenciaVisita } });
        const fechaVisita = new Date(obra.obra_fecha_de_creacion!); fechaVisita.setUTCDate(fechaVisita.getUTCDate() + visitaIndice * 7);
        if (!servicio) servicio = await tx.servicio_terreno.create({ data: { servicio_terreno_tipo_servicio: visitaIndice === 1 ? 'Levantamiento' : 'Instalación', servicio_terreno_fecha_real: indice <= 30 ? fechaVisita : null, servicio_terreno_prioridad: indice % 8 === 0 ? 'alta' : 'normal', servicio_terreno_estado: indice <= 30 ? 'cerrada' : visitaIndice === 1 ? 'en_progreso' : 'pendiente', servicio_terreno_observaciones: referenciaVisita, id_obra: obra.obra_obra_id } });
        for (let tareaIndice = 1; tareaIndice <= 2; tareaIndice++) {
          const titulo = `${PREFIJO} Tarea ${indice}-${visitaIndice}-${tareaIndice}`;
          let tarea = await tx.tarea.findFirst({ where: { tarea_titulo: titulo, id_servicio_terreno: servicio.servicio_terreno_servicio_terreno_id } });
          const inicioTarea = new Date(fechaVisita); inicioTarea.setUTCDate(inicioTarea.getUTCDate() + tareaIndice);
          if (!tarea) tarea = await tx.tarea.create({ data: { tarea_titulo: titulo, tarea_descripcion: tareaIndice === 1 ? 'Preparación y fabricación' : 'Instalación y cierre', tarea_fecha_de_creacion: fechaVisita, tarea_fecha_de_inicio: inicioTarea, tarea_fecha_de_termino: indice <= 30 ? new Date(inicioTarea.getTime() + 86400000 * (2 + indice % 3)) : null, tarea_horario_limite: new Date(inicioTarea.getTime() + 86400000 * (indice % 7 === 0 ? 1 : 5)), tarea_urgencia: indice % 9 === 0 ? 'alta' : 'normal', tarea_estado_de_tarea: indice <= 30 ? 'completada' : indice % 5 === 0 ? 'atrasada' : 'pendiente', id_servicio_terreno: servicio.servicio_terreno_servicio_terreno_id, id_especificacion_puerta: especificacion.especificacion_puerta_especificacion_puerta_id, id_orden_trabajo: ot.orden_trabajo_id_orden } });
          await tx.tarea_usuario.upsert({ where: { tarea_usuario_tarea_id_tarea_usuario_usuario_id: { tarea_usuario_tarea_id: tarea.tarea_tarea_id, tarea_usuario_usuario_id: actor.usuario_id_usuario } }, update: {}, create: { tarea_usuario_tarea_id: tarea.tarea_tarea_id, tarea_usuario_usuario_id: actor.usuario_id_usuario } });
          if (indice <= 30 || (indice + visitaIndice + tareaIndice) % 3 === 0) {
            let ejecucion = await tx.ejecucion_tarea.findFirst({ where: { id_tarea: tarea.tarea_tarea_id, id_usuario_ejecutor: actor.usuario_id_usuario } });
            if (!ejecucion) ejecucion = await tx.ejecucion_tarea.create({ data: { id_tarea: tarea.tarea_tarea_id, id_usuario_ejecutor: actor.usuario_id_usuario, fecha_ejecucion: inicioTarea, estado_ejecucion: indice <= 30 ? 'terminada' : 'en_ejecucion', estado_validacion_productiva: indice % 4 === 0 ? 'pendiente' : 'validada', cantidad: 1 + tareaIndice, unidad: 'UNIDAD' } });
            if ((indice + visitaIndice + tareaIndice) % 7 === 0 && !await tx.incidencia_retrabajo_tarea.findFirst({ where: { id_ejecucion_tarea: ejecucion.id_ejecucion_tarea } })) await tx.incidencia_retrabajo_tarea.create({ data: { id_ejecucion_tarea: ejecucion.id_ejecucion_tarea, descripcion: `${PREFIJO} incidencia ${indice}-${visitaIndice}-${tareaIndice}`, causa_referencia: `${PREFIJO}-CAUSA-${indice % 5}`, estado: indice <= 25 ? 'cerrada' : 'pendiente', responsabilidad: 'Proceso DEMO-UI' } });
          }
        }
      }
    }
  }, { timeout: 300000 });
}

async function sembrarComprasEInventarioHistorico() {
  const proveedores = ['Aceros Cordillera', 'Metales del Pacífico', 'Seguridad Multipunto', 'Herrajes Los Andes', 'Pinturas Industriales Sur', 'Fijaciones Metropolitanas', 'Aislación Austral', 'Ferretería Técnica Central', 'Importadora Bellavista', 'Suministros Mapocho', 'Componentes Vértice', 'Logística Puerta Norte', 'Perfiles Santa Elena', 'Tecnología de Acceso', 'Consumibles Industriales'];
  await prisma.$transaction(async tx => {
    const actor = await tx.usuario.findFirstOrThrow({ where: { administrador_original: true } });
    const clp = await tx.moneda.findUniqueOrThrow({ where: { codigo_moneda: 'CLP' } });
    const pais = await tx.pais.findUniqueOrThrow({ where: { nombre_pais: `${PREFIJO} País` } });
    const tipoId = await tx.tipo_identificador.findUniqueOrThrow({ where: { nombre_tipo_identificador: `${PREFIJO} Identificador` } });
    const tipoDocumento = await tx.tipo_documento.findUniqueOrThrow({ where: { nombre_tipo_documento: `${PREFIJO} Documento proveedor` } });
    const medio = await tx.medio_pago.findUniqueOrThrow({ where: { nombre_medio_pago: `${PREFIJO} Transferencia` } });
    const bodega = await tx.bodega.findFirstOrThrow({ where: { bodega_nombre_bodega: `${PREFIJO} Bodega central` } });
    const tipoMovimiento = await tx.movimiento_inventario_tipo_movimiento.findFirstOrThrow({ where: { movimiento_inventario_tipo_movimiento_nombre: `${PREFIJO} Entrada` } });
    const proveedoresDb = [];
    for (let indice = 0; indice < proveedores.length; indice++) {
      const identificador = `${PREFIJO}-PROV-${indice + 1}`;
      let proveedor = await tx.proveedor.findFirst({ where: { id_pais: pais.id_pais, id_tipo_identificador: tipoId.id_tipo_identificador, identificador_tributario: identificador } });
      if (!proveedor) proveedor = await tx.proveedor.create({ data: { id_pais: pais.id_pais, id_tipo_identificador: tipoId.id_tipo_identificador, id_moneda_preferente: clp.id_moneda, identificador_tributario: identificador, nombre_razon_social: proveedores[indice], tipo_proveedor_m5: indice % 3 === 0 ? 'Ambos' : 'Insumos/Materiales', condicion_pago_dias_m5: [15, 30, 45][indice % 3], condicion_pago_tipo_m5: 'DIAS_CORRIDOS', contacto_proveedor: `Contacto comercial ${indice + 1}`, correo_proveedor: `demo-ui-proveedor${indice + 1}@example.invalid`, estado_proveedor: indice === 14 ? 'inactivo' : 'activo' } });
      else proveedor = await tx.proveedor.update({ where: { id_proveedor: proveedor.id_proveedor }, data: { nombre_razon_social: proveedores[indice], condicion_pago_dias_m5: [15, 30, 45][indice % 3] } });
      proveedoresDb.push(proveedor);
    }
    const materialesDb = await tx.material.findMany({ where: { material_sku: { startsWith: 'DEMOUI-MAT-' } }, orderBy: { material_sku: 'asc' } });
    for (let indice = 0; indice < materialesDb.length; indice++) {
      const material = materialesDb[indice], proveedor = proveedoresDb[indice % proveedoresDb.length];
      await tx.material_proveedor.upsert({ where: { material_sku_proveedor_id_proveedor: { material_sku: material.material_sku, proveedor_id_proveedor: proveedor.id_proveedor } }, update: {}, create: { material_sku: material.material_sku, proveedor_id_proveedor: proveedor.id_proveedor, material_proveedor_tiempo_reposicion: 5 + indice % 18, material_proveedor_precio_referencial: 4500 + indice * 2750, material_proveedor_proveedor_principal: true } });
      const numeroLote = `${PREFIJO}-LOTE-${String(indice + 1).padStart(2, '0')}`;
      let factura = await tx.factura_compra.findFirst({ where: { factura_compra_numero_factura: `${PREFIJO}-FC-INV-${String(indice + 1).padStart(2, '0')}` } });
      if (!factura) factura = await tx.factura_compra.create({ data: { factura_compra_numero_factura: `${PREFIJO}-FC-INV-${String(indice + 1).padStart(2, '0')}`, factura_compra_monto_neto: 90000 + indice * 17500, factura_compra_tipo_compra: `${PREFIJO} Inventario`, factura_compra_fecha_emision: mesHistorico(indice % MESES_HISTORICOS, 7), proveedor_id_proveedor: proveedor.id_proveedor } });
      let lote = await tx.lote.findFirst({ where: { lote_numero_lote: numeroLote } });
      if (!lote) lote = await tx.lote.create({ data: { lote_numero_lote: numeroLote, lote_fecha_ingreso: mesHistorico(indice % MESES_HISTORICOS, 8), lote_fecha_recepcion: mesHistorico(indice % MESES_HISTORICOS, 12), lote_estado: 'recibido', proveedor_id_proveedor: proveedor.id_proveedor, factura_compra_id_factura: factura.factura_compra_id_factura } });
      await tx.inventario_bodega.upsert({ where: { material_sku_lote_id_lote_bodega_id_bodega: { material_sku: material.material_sku, lote_id_lote: lote.lote_id_lote, bodega_id_bodega: bodega.bodega_id_bodega } }, update: { inventario_bodega_cantidad_fisica: indice % 7 === 0 ? 3 : 18 + indice % 45 }, create: { material_sku: material.material_sku, lote_id_lote: lote.lote_id_lote, bodega_id_bodega: bodega.bodega_id_bodega, inventario_bodega_cantidad_fisica: indice % 7 === 0 ? 3 : 18 + indice % 45, inventario_bodega_cantidad_reservada: indice % 5 } });
      for (let movimiento = 0; movimiento < 8; movimiento++) {
        const fechaMovimiento = mesHistorico((indice + movimiento * 3) % MESES_HISTORICOS, 10 + movimiento);
        if (!await tx.movimiento_inventario.findFirst({ where: { material_sku: material.material_sku, lote_id_lote: lote.lote_id_lote, movimiento_inventario_fecha_hora: fechaMovimiento } })) await tx.movimiento_inventario.create({ data: { movimiento_inventario_fecha_hora: fechaMovimiento, movimiento_inventario_cantidad: 4 + (indice + movimiento) % 17, movimiento_inventario_estado: 'confirmado', material_sku: material.material_sku, bodega_id_bodega: bodega.bodega_id_bodega, lote_id_lote: lote.lote_id_lote, factura_compra_id_factura_compra: factura.factura_compra_id_factura, usuario_id_usuario: actor.usuario_id_usuario, movimiento_inventario_tipo_movimiento_id_tipo_movimiento: tipoMovimiento.movimiento_inventario_tipo_movimiento_id_tipo_movimiento } });
      }
    }
    for (let mes = 0; mes < MESES_HISTORICOS; mes++) {
      const base = mesHistorico(mes), mesClave = claveMes(base);
      await tx.fondo_caja_chica_m5.upsert({ where: { anio_mes: { anio: base.getUTCFullYear(), mes: base.getUTCMonth() + 1 } }, update: {}, create: { anio: base.getUTCFullYear(), mes: base.getUTCMonth() + 1, monto: 600000, actualizado_por: actor.usuario_id_usuario } });
      for (let orden = 1; orden <= 4; orden++) {
        const clave = `${mesClave}-${String(orden).padStart(2, '0')}`, proveedor = proveedoresDb[(mes * 4 + orden) % proveedoresDb.length], monto = 110000 + variacion(0, 780000, mes, orden);
        let ocs = await tx.orden_compra_servicio_m5.findFirst({ where: { referencia: `${PREFIJO}-OCS-${clave}` } });
        if (!ocs) ocs = await tx.orden_compra_servicio_m5.create({ data: { id_proveedor: proveedor.id_proveedor, monto_autorizado: monto, monto_autorizado_original: monto, estado_ocs: mes < 23 || orden < 3 ? 'cerrada' : 'abierta', referencia: `${PREFIJO}-OCS-${clave}`, periodo: mesClave, descripcion: `${PREFIJO} abastecimiento histórico ${clave}`, creado_por: actor.usuario_id_usuario, id_moneda: clp.id_moneda, fecha_esperada_recepcion: new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 18 + orden)) } });
        const material = materialesDb[(mes * 4 + orden) % materialesDb.length];
        await tx.detalle_material_orden_compra_m5.upsert({ where: { id_ocs_m5_material_sku: { id_ocs_m5: ocs.id_orden_compra_servicio_m5, material_sku: material.material_sku } }, update: {}, create: { id_ocs_m5: ocs.id_orden_compra_servicio_m5, material_sku: material.material_sku, cantidad_pedida: 8 + orden * 3, cantidad_recibida: orden === 4 && mes >= 23 ? 4 : 8 + orden * 3, fecha_esperada: new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 18 + orden)) } });
        const folio = `${PREFIJO}-DOC-${clave}`;
        let documento = await tx.documento_proveedor_m5.findFirst({ where: { folio_normalizado: folio } });
        if (!documento) documento = await tx.documento_proveedor_m5.create({ data: { id_proveedor: proveedor.id_proveedor, clase: 'definitivo', id_tipo_documento: tipoDocumento.id_tipo_documento, folio, folio_normalizado: folio, fecha_emision: new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 10 + orden)), id_moneda: clp.id_moneda, monto_total: monto, estado: 'confirmado', respaldo: `${PREFIJO}://proveedor/${clave}`, descripcion: `${PREFIJO} compra histórica ${clave}`, fecha_vencimiento: new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 10 + orden)), creado_por: actor.usuario_id_usuario, confirmado_por: actor.usuario_id_usuario, fecha_confirmacion: new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 11 + orden)) } });
        let obligacion = await tx.obligacion_proveedor_m5.findUnique({ where: { id_documento_m5: documento.id_documento_m5 } });
        const pagada = mes < 21 || orden === 1, parcial = !pagada && orden === 2, saldo = pagada ? 0 : parcial ? Math.round(monto * .45) : monto;
        if (!obligacion) obligacion = await tx.obligacion_proveedor_m5.create({ data: { id_documento_m5: documento.id_documento_m5, id_proveedor: proveedor.id_proveedor, monto_original: monto, id_moneda: clp.id_moneda, saldo_inicial: monto, saldo_actual: saldo, fecha_emision: documento.fecha_emision, fecha_vencimiento: documento.fecha_vencimiento!, estado_pago: pagada ? 'Pagada' : parcial ? 'Parcial' : 'Pendiente', generado_por: actor.usuario_id_usuario } });
        if (pagada || parcial) {
          const fechaPagoProveedor = acotarFechaEfectiva(new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 12 + orden)));
          const movimientoExistente = await tx.movimiento_pago_proveedor_m5.findFirst({ where: { id_obligacion_m5: obligacion.id_obligacion_m5 } });
          let operacion = movimientoExistente ? await tx.operacion_pago_proveedor_m5.update({ where: { id_operacion_pago_m5: movimientoExistente.id_operacion_pago_m5 }, data: { fecha_efectiva_pago: fechaPagoProveedor, fecha_confirmacion: fechaPagoProveedor } }) : await tx.operacion_pago_proveedor_m5.findFirst({ where: { id_proveedor: proveedor.id_proveedor, fecha_efectiva_pago: fechaPagoProveedor } });
          const aplicado = pagada ? monto : monto - saldo;
          if (!operacion) operacion = await tx.operacion_pago_proveedor_m5.create({ data: { id_proveedor: proveedor.id_proveedor, estado: 'confirmada', fecha_efectiva_pago: fechaPagoProveedor, creado_por: actor.usuario_id_usuario, confirmado_por: actor.usuario_id_usuario, fecha_confirmacion: fechaPagoProveedor, total_confirmado: aplicado } });
          if (!movimientoExistente) await tx.movimiento_pago_proveedor_m5.create({ data: { id_operacion_pago_m5: operacion.id_operacion_pago_m5, id_obligacion_m5: obligacion.id_obligacion_m5, id_medio_pago: medio.id_medio_pago, id_moneda: clp.id_moneda, monto_aplicado: aplicado, equivalente_clp: aplicado, estado: 'Vigente' } });
          const observacionMovimiento = `${PREFIJO} Movimiento proveedor ${clave}`;
          const movimientoFinanciero = await tx.movimiento_financiero.findFirst({ where: { observacion: observacionMovimiento } });
          if (movimientoFinanciero) await tx.movimiento_financiero.update({ where: { id_movimiento_financiero: movimientoFinanciero.id_movimiento_financiero }, data: { fecha_movimiento: fechaPagoProveedor } });
          else await tx.movimiento_financiero.create({ data: { id_moneda: clp.id_moneda, fecha_movimiento: fechaPagoProveedor, tipo_movimiento_financiero: 'PAGO_PROVEEDOR', naturaleza_movimiento: 'egreso', motivo_movimiento: `${PREFIJO} pago proveedor histórico`, monto_movimiento: aplicado, estado_movimiento: 'registrado', observacion: observacionMovimiento } });
        }
      }
      for (let gasto = 1; gasto <= 3; gasto++) {
        const descripcion = `${PREFIJO} Caja chica ${mesClave}-${gasto}`;
        if (!await tx.gasto_caja_chica_m5.findFirst({ where: { descripcion } })) await tx.gasto_caja_chica_m5.create({ data: { anio: base.getUTCFullYear(), mes: base.getUTCMonth() + 1, monto: 4500 + variacion(0, 28000, mes, gasto), descripcion, fecha_gasto: new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 5 + gasto * 6)), comercio_emisor: ['Estacionamiento Central','Ferretería Barrio Norte','Combustibles Ruta Sur'][gasto - 1], estado: 'aprobado', registrado_por: actor.usuario_id_usuario, resuelto_por: actor.usuario_id_usuario, fecha_resolucion: new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 6 + gasto * 6)) } });
      }
    }
  }, { timeout: 300000 });
}

async function sembrarCredito() {
  await prisma.$transaction(async tx => {
    const actor = await tx.usuario.findFirstOrThrow({ where: { administrador_original: true } });
    const fichas = await tx.ficha_cliente.findMany({ where: { cliente_financiero: { referencia_demostracion: { startsWith: `${PREFIJO}-CLIENTE-` } } }, include: { nota_venta: { orderBy: { numero_nota_venta: 'asc' } }, cotizacion: { orderBy: { referencia_demostracion: 'asc' } } }, orderBy: { id_ficha_cliente: 'asc' }, take: 25 });
    if (!await tx.limite_global_credito_m8.findFirst({ where: { motivo: { startsWith: PREFIJO } } })) await tx.limite_global_credito_m8.create({ data: { monto_limite: 18000000, vigencia_desde: inicioMes, motivo: `${PREFIJO} límite global ficticio`, id_responsable: actor.usuario_id_usuario } });
    const estados = ['BORRADOR', 'PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA'];
    for (let indice = 0; indice < fichas.length; indice++) {
      const ficha = fichas[indice], cupo = 900000 + indice * 175000;
      const estadoSolicitud = estados[indice % estados.length];
      await tx.condicion_crediticia_m8.upsert({ where: { id_ficha_cliente: ficha.id_ficha_cliente }, update: {}, create: { id_ficha_cliente: ficha.id_ficha_cliente, credito_habilitado: indice !== 3, monto_cupo: cupo, vigencia_desde: inicioMes, vigencia_hasta: fecha(180), suspendido: indice === 4, motivo_suspension: indice === 4 ? `${PREFIJO} revisión ficticia` : null } });
      let solicitud = await tx.solicitud_crediticia_m8.findFirst({ where: { referencia_contexto: `${PREFIJO}-SOL-${indice + 1}` } });
      if (!solicitud) solicitud = await tx.solicitud_crediticia_m8.create({ data: { id_ficha_cliente: ficha.id_ficha_cliente, tipo_solicitud: indice % 2 ? 'EXCEPCION' : 'INICIAL', estado_solicitud: estadoSolicitud, id_usuario_solicitante: actor.usuario_id_usuario, id_cotizacion: ficha.cotizacion[0]?.id_cotizacion, id_nota_venta: ficha.nota_venta[0]?.id_nota_venta, referencia_contexto: `${PREFIJO}-SOL-${indice + 1}`, antecedentes_resumen: 'Antecedentes ficticios para demostración', motivo_solicitud: `${PREFIJO} motivo ${indice + 1}`, condiciones_solicitadas: 'Condiciones ficticias sin valor normativo' } });
      if (['APROBADA','RECHAZADA'].includes(estadoSolicitud) && !await tx.resolucion_solicitud_crediticia_m8.findUnique({ where: { id_solicitud_crediticia: solicitud.id_solicitud_crediticia } })) await tx.resolucion_solicitud_crediticia_m8.create({ data: { id_solicitud_crediticia: solicitud.id_solicitud_crediticia, decision: estadoSolicitud, motivo: `${PREFIJO} resolución ficticia`, monto_cupo_aprobado: estadoSolicitud === 'APROBADA' ? cupo : null, vigencia_desde: estadoSolicitud === 'APROBADA' ? inicioMes : null, vigencia_hasta: estadoSolicitud === 'APROBADA' ? fecha(180) : null, condiciones_aprobadas: 'Uso demostrativo', id_usuario_responsable: actor.usuario_id_usuario } });
      const nota = ficha.nota_venta[0];
      if (nota && indice < 18) await tx.compromiso_credito_m8.upsert({ where: { id_nota_venta: nota.id_nota_venta }, update: {}, create: { id_ficha_cliente: ficha.id_ficha_cliente, id_nota_venta: nota.id_nota_venta, id_solicitud_excepcion: solicitud.tipo_solicitud === 'EXCEPCION' ? solicitud.id_solicitud_crediticia : null, monto_original: nota.monto_total, monto_pendiente: Number(nota.monto_total) * (indice % 4 === 2 ? .35 : .7), condiciones: `${PREFIJO} compromiso ficticio`, estado: indice < 15 ? 'VIGENTE' : 'LIBERADO' } });
    }
  }, { timeout: 60000 });
}

async function sembrarAuditoria() {
  const controlador = new M9Controller();
  for (let modulo = 1; modulo <= 8; modulo++) for (let indice = 1; indice <= 5; indice++) {
    const identidadLogica = `${PREFIJO}:M${modulo}:${indice}`;
    if (await prisma.evento_auditoria_m9.findUnique({ where: { identidad_logica: identidadLogica }, select: { identidad_logica: true } })) continue;
    await controlador.recibir({ identidadLogica, versionContrato: '1.0', ocurridoEn: fecha(-indice).toISOString(), zonaHoraria: 'UTC', ejecutor: { tipo: indice % 2 ? 'SISTEMA' : 'HUMANO', referencia: `${PREFIJO}-ACTOR` }, productor: `M${modulo}`, modulo: `M${modulo}`, operacion: `${PREFIJO}_ESCENARIO_${indice}`, resultado: indice === 4 ? 'RECHAZADO' : indice === 5 ? 'FALLIDO' : 'EXITOSO', referencia: { tipo: 'ESCENARIO_DEMO', id: `${PREFIJO}-M${modulo}-${indice}` }, anterior: { estado: indice === 1 ? 'nuevo' : 'pendiente' }, nuevo: { estado: indice >= 4 ? 'observado' : 'procesado', monto: indice * 100000 }, motivo: `${PREFIJO} evidencia ficticia`, capacidad: 'EMITIR_EVENTO_M9', critico: true });
  }
}

async function limpiarDemo() {
  const eventosM9Preservados = await prisma.evento_auditoria_m9.count({ where: { identidad_logica: { startsWith: `${PREFIJO}:` } } });
  await prisma.$transaction(async tx => {
    const fichas = await tx.ficha_cliente.findMany({ where: { cliente_financiero: { referencia_demostracion: { startsWith: `${PREFIJO}-CLIENTE-` } } }, select: { id_ficha_cliente: true, id_cliente_financiero: true } });
    const idsFicha = fichas.map(valor => valor.id_ficha_cliente);
    const idsClienteFinanciero = fichas.map(valor => valor.id_cliente_financiero);
    const solicitudes = await tx.solicitud_crediticia_m8.findMany({ where: { referencia_contexto: { startsWith: `${PREFIJO}-SOL-` } }, select: { id_solicitud_crediticia: true } });
    const idsSolicitud = solicitudes.map(valor => valor.id_solicitud_crediticia);
    const especificaciones = await tx.especificaciones_puerta.findMany({ where: { especificacion_puerta_observaciones: { startsWith: `${PREFIJO}-ESP-` } }, select: { especificacion_puerta_especificacion_puerta_id: true } });
    const idsEspecificacion = especificaciones.map(valor => valor.especificacion_puerta_especificacion_puerta_id);
    const empleados = await tx.empleado.findMany({ where: { OR: [{ correo_particular: { startsWith: 'demo-ui-empleado', endsWith: '@example.invalid' } }, { nombres: { startsWith: 'Empleado Demo ' }, apellido_paterno: 'Visual', apellido_materno: 'QA' }] }, select: { id_empleado: true } });
    const idsEmpleado = empleados.map(valor => valor.id_empleado);
    const remuneraciones = await tx.remuneracion.findMany({ where: { componentes: { some: { clave_negocio: { startsWith: `${PREFIJO}:` } } } }, select: { id_remuneracion: true } });
    const idsRemuneracion = remuneraciones.map(valor => valor.id_remuneracion);
    const notas = await tx.nota_venta.findMany({ where: { numero_nota_venta: { startsWith: `${PREFIJO}-NV-` } }, select: { id_nota_venta: true } });
    const idsNota = notas.map(valor => valor.id_nota_venta);
    const documentos = await tx.documento_tributario.findMany({ where: { folio_documento: { startsWith: `${PREFIJO}-FAC-` } }, select: { id_documento_tributario: true } });
    const idsDocumento = documentos.map(valor => valor.id_documento_tributario);
    const pagos = await tx.pago_cliente.findMany({ where: { referencia_demostracion: { startsWith: `${PREFIJO}-PAGO-` } }, select: { id_pago_cliente: true } });
    const idsPago = pagos.map(valor => valor.id_pago_cliente);
    const proveedores = await tx.proveedor.findMany({ where: { identificador_tributario: { startsWith: `${PREFIJO}-PROV-` } }, select: { id_proveedor: true } });
    const idsProveedor = proveedores.map(valor => valor.id_proveedor);
    const ocs = await tx.orden_compra_servicio_m5.findMany({ where: { referencia: { startsWith: `${PREFIJO}-OCS-` } }, select: { id_orden_compra_servicio_m5: true } });
    const idsOcs = ocs.map(valor => valor.id_orden_compra_servicio_m5);
    const docsProveedor = await tx.documento_proveedor_m5.findMany({ where: { folio_normalizado: { startsWith: `${PREFIJO}-DOC-` } }, select: { id_documento_m5: true } });
    const idsDocsProveedor = docsProveedor.map(valor => valor.id_documento_m5);
    const obligaciones = await tx.obligacion_proveedor_m5.findMany({ where: { id_documento_m5: { in: idsDocsProveedor } }, select: { id_obligacion_m5: true } });
    const idsObligacion = obligaciones.map(valor => valor.id_obligacion_m5);
    const operacionesProveedor = await tx.operacion_pago_proveedor_m5.findMany({ where: { id_proveedor: { in: idsProveedor } }, select: { id_operacion_pago_m5: true } });
    const idsOperacionProveedor = operacionesProveedor.map(valor => valor.id_operacion_pago_m5);
    const envios = await tx.envio_importacion_m5.findMany({ where: { referencia_normalizada: { startsWith: `${PREFIJO}-ENVIO-` } }, select: { id_envio_importacion_m5: true } });
    const idsEnvio = envios.map(valor => valor.id_envio_importacion_m5);
    const prestadores = await tx.prestador_honorarios.findMany({ where: { identificador: { startsWith: `${PREFIJO}-HON-` } }, select: { id_prestador_honorarios: true } });
    const idsPrestador = prestadores.map(valor => valor.id_prestador_honorarios);
    const tareas = await tx.tarea.findMany({ where: { tarea_titulo: { startsWith: `${PREFIJO} Tarea ` } }, select: { tarea_tarea_id: true } });
    const idsTarea = tareas.map(valor => valor.tarea_tarea_id);
    const ejecuciones = await tx.ejecucion_tarea.findMany({ where: { id_tarea: { in: idsTarea } }, select: { id_ejecucion_tarea: true } });
    const idsEjecucion = ejecuciones.map(valor => valor.id_ejecucion_tarea);
    const lotes = await tx.lote.findMany({ where: { lote_numero_lote: { startsWith: `${PREFIJO}-LOTE-` } }, select: { lote_id_lote: true, factura_compra_id_factura: true } });
    const idsLote = lotes.map(valor => valor.lote_id_lote);
    const idsFacturaCompra = lotes.flatMap(valor => valor.factura_compra_id_factura ? [valor.factura_compra_id_factura] : []);

    await tx.resolucion_solicitud_crediticia_m8.deleteMany({ where: { id_solicitud_crediticia: { in: idsSolicitud } } });
    await tx.compromiso_credito_m8.deleteMany({ where: { condiciones: { startsWith: PREFIJO } } });
    await tx.solicitud_crediticia_m8.deleteMany({ where: { id_solicitud_crediticia: { in: idsSolicitud } } });
    await tx.condicion_crediticia_m8.deleteMany({ where: { id_ficha_cliente: { in: idsFicha } } });
    await tx.limite_global_credito_m8.deleteMany({ where: { motivo: { startsWith: PREFIJO } } });
    await tx.parametro_remuneracional.deleteMany({ where: { referencia: PREFIJO } });
    await tx.incidencia_retrabajo_tarea.deleteMany({ where: { id_ejecucion_tarea: { in: idsEjecucion } } });
    await tx.tratamiento_remuneracional_ejecucion.deleteMany({ where: { id_ejecucion_tarea: { in: idsEjecucion } } });
    await tx.ejecucion_tarea.deleteMany({ where: { id_ejecucion_tarea: { in: idsEjecucion } } });
    await tx.tarea_usuario.deleteMany({ where: { tarea_usuario_tarea_id: { in: idsTarea } } });
    await tx.tarea.deleteMany({ where: { tarea_tarea_id: { in: idsTarea } } });
    await tx.material_orden_trabajo.deleteMany({ where: { material_sku: { startsWith: 'DEMOUI-MAT-' } } });
    await tx.orden_trabajo.deleteMany({ where: { especificaciones_puerta_id_especificacion_puerta: { in: idsEspecificacion } } });
    await tx.servicio_terreno.deleteMany({ where: { servicio_terreno_observaciones: { startsWith: PREFIJO } } });
    await tx.obra.deleteMany({ where: { obra_referencia: { startsWith: `${PREFIJO}-OBRA-` } } });
    await tx.medidas_puerta.deleteMany({ where: { id_especificacion_puerta: { in: idsEspecificacion } } });
    await tx.especificaciones_puerta.deleteMany({ where: { especificacion_puerta_especificacion_puerta_id: { in: idsEspecificacion } } });
    await tx.pago_remuneracion.deleteMany({ where: { clave_idempotencia: { startsWith: `${PREFIJO}:PAGO-REM:` } } });
    await tx.boleta_honorarios.deleteMany({ where: { id_prestador: { in: idsPrestador } } });
    await tx.prestador_honorarios.deleteMany({ where: { id_prestador_honorarios: { in: idsPrestador } } });
    await tx.componente_remuneracion.deleteMany({ where: { id_remuneracion: { in: idsRemuneracion } } });
    await tx.remuneracion.deleteMany({ where: { id_remuneracion: { in: idsRemuneracion } } });
    await tx.asignacion_esquema_remuneracional.deleteMany({ where: { OR: [{ id_empleado: { in: idsEmpleado } }, { esquema: { codigo: { startsWith: `${PREFIJO}-ESQUEMA` } } }] } });
    await tx.relacion_laboral_empleado.deleteMany({ where: { id_empleado: { in: idsEmpleado } } });
    await tx.empleado.deleteMany({ where: { id_empleado: { in: idsEmpleado } } });
    await tx.esquema_remuneracional.deleteMany({ where: { codigo: { startsWith: `${PREFIJO}-ESQUEMA` } } });
    await tx.concepto_remuneracion.deleteMany({ where: { codigo_m6: { startsWith: `${PREFIJO}-HABER-` } } });
    await tx.tipo_vinculo_laboral.deleteMany({ where: { nombre_tipo_vinculo_laboral: `${PREFIJO} Contrato indefinido` } });
    await tx.asignacion_pago_cliente.deleteMany({ where: { id_pago_cliente: { in: idsPago } } });
    await tx.pago_cliente.deleteMany({ where: { id_pago_cliente: { in: idsPago } } });
    await tx.documento_tributario_nota_venta.deleteMany({ where: { OR: [{ id_documento_tributario: { in: idsDocumento } }, { id_nota_venta: { in: idsNota } }] } });
    await tx.documento_tributario.deleteMany({ where: { id_documento_tributario: { in: idsDocumento } } });
    await tx.costo_proyecto.deleteMany({ where: { proyecto_financiero: { codigo_proyecto_financiero: { startsWith: `${PREFIJO}-PF-` } } } });
    await tx.proyecto_financiero.deleteMany({ where: { codigo_proyecto_financiero: { startsWith: `${PREFIJO}-PF-` } } });
    await tx.movimiento_financiero.deleteMany({ where: { observacion: { startsWith: `${PREFIJO} Movimiento ` } } });
    await tx.nota_venta.deleteMany({ where: { id_nota_venta: { in: idsNota } } });
    await tx.detalle_cotizacion.deleteMany({ where: { cotizacion: { referencia_demostracion: { startsWith: `${PREFIJO}-COT-` } } } });
    await tx.cotizacion.deleteMany({ where: { referencia_demostracion: { startsWith: `${PREFIJO}-COT-` } } });
    await tx.movimiento_inventario.deleteMany({ where: { lote_id_lote: { in: idsLote } } });
    await tx.inventario_bodega.deleteMany({ where: { lote_id_lote: { in: idsLote } } });
    await tx.lote_fecha_pedido.deleteMany({ where: { lote_id_lote: { in: idsLote } } });
    await tx.lote.deleteMany({ where: { lote_id_lote: { in: idsLote } } });
    await tx.factura_compra.deleteMany({ where: { factura_compra_id_factura: { in: idsFacturaCompra } } });
    await tx.material_proveedor.deleteMany({ where: { material_sku: { startsWith: 'DEMOUI-MAT-' }, proveedor_id_proveedor: { in: idsProveedor } } });
    await tx.detalle_material_orden_compra_m5.deleteMany({ where: { id_ocs_m5: { in: idsOcs } } });
    await tx.envio_orden_compra_m5.deleteMany({ where: { id_envio_importacion_m5: { in: idsEnvio } } });
    await tx.costo_envio_importacion_m5.deleteMany({ where: { id_envio_importacion_m5: { in: idsEnvio } } });
    await tx.historial_envio_importacion_m5.deleteMany({ where: { id_envio_importacion_m5: { in: idsEnvio } } });
    await tx.envio_importacion_m5.deleteMany({ where: { id_envio_importacion_m5: { in: idsEnvio } } });
    await tx.movimiento_pago_proveedor_m5.deleteMany({ where: { id_operacion_pago_m5: { in: idsOperacionProveedor } } });
    await tx.operacion_pago_proveedor_m5.deleteMany({ where: { id_operacion_pago_m5: { in: idsOperacionProveedor } } });
    await tx.obligacion_proveedor_m5.deleteMany({ where: { id_obligacion_m5: { in: idsObligacion } } });
    await tx.documento_proveedor_m5.deleteMany({ where: { id_documento_m5: { in: idsDocsProveedor } } });
    await tx.orden_compra_servicio_m5.deleteMany({ where: { id_orden_compra_servicio_m5: { in: idsOcs } } });
    await tx.historial_proveedor_m5.deleteMany({ where: { id_proveedor: { in: idsProveedor } } });
    await tx.gasto_caja_chica_m5.deleteMany({ where: { descripcion: { startsWith: `${PREFIJO} Caja chica ` } } });
    await tx.categoria_egreso_m5.deleteMany({ where: { nombre: { startsWith: `${PREFIJO} Categoría ` } } });
    await tx.proyecto.deleteMany({ where: { proyecto_codigo_proyecto: { startsWith: `${PREFIJO}-PROY-` } } });
    await tx.ficha_cliente.deleteMany({ where: { id_cliente_financiero: { in: idsClienteFinanciero } } });
    await tx.cliente_financiero.deleteMany({ where: { referencia_demostracion: { startsWith: `${PREFIJO}-CLIENTE-` } } });
    await tx.historial_precio_material.deleteMany({ where: { material_sku: { startsWith: 'DEMOUI-MAT-' } } });
    await tx.material.deleteMany({ where: { material_sku: { startsWith: 'DEMOUI-MAT-' } } });
    await tx.proveedor.deleteMany({ where: { id_proveedor: { in: idsProveedor } } });
    await tx.factura_compra.deleteMany({ where: { factura_compra_numero_factura: { startsWith: `${PREFIJO}-FC-` } } });
    await tx.bodega.deleteMany({ where: { bodega_nombre_bodega: `${PREFIJO} Bodega central` } });
    await tx.movimiento_inventario_tipo_movimiento.deleteMany({ where: { movimiento_inventario_tipo_movimiento_nombre: `${PREFIJO} Entrada` } });
    await tx.tipo_identificador.deleteMany({ where: { nombre_tipo_identificador: `${PREFIJO} Identificador` } });
    await tx.pais.deleteMany({ where: { nombre_pais: `${PREFIJO} País` } });
    await tx.tipo_documento.deleteMany({ where: { nombre_tipo_documento: `${PREFIJO} Documento proveedor` } });
    await tx.medio_pago.deleteMany({ where: { nombre_medio_pago: `${PREFIJO} Transferencia` } });
    await tx.cliente.deleteMany({ where: { cliente_correo: { startsWith: 'demo-ui-cliente', endsWith: '@example.invalid' } } });
    await tx.item_comercial.deleteMany({ where: { nombre_item: { startsWith: PREFIJO } } });
  }, { timeout: 120000 });
  console.log(JSON.stringify({ estado: 'OK', mensaje: 'Se retiraron sólo registros operativos DEMO-UI; la evidencia M9 no se elimina porque es inmutable.', eventosM9DemoPreservados: eventosM9Preservados }, null, 2));
}

async function conteos() {
  const idsProveedorDemo = (await prisma.proveedor.findMany({ where: { identificador_tributario: { startsWith: `${PREFIJO}-PROV-` } }, select: { id_proveedor: true } })).map(valor => valor.id_proveedor);
  const idsDocumentoProveedorDemo = (await prisma.documento_proveedor_m5.findMany({ where: { folio_normalizado: { startsWith: `${PREFIJO}-DOC-` } }, select: { id_documento_m5: true } })).map(valor => valor.id_documento_m5);
  const [usuarios, clientes, cotizaciones, notas, pagos, movimientosFinancieros, proveedores, ocs, documentosProveedor, obligaciones, pagosProveedor, categoriasEgreso, envios, cajaChica, empleados, esquemas, haberes, remuneraciones, documentosRemuneracion, pagosRemuneracion, honorarios, parametros, proyectos, proyectosFinancieros, visitas, tareas, ejecuciones, incidencias, ots, stock, movimientosInventario, compras, solicitudes, compromisos, eventos] = await Promise.all([
    prisma.usuario.count(),
    prisma.cliente_financiero.count({ where: { referencia_demostracion: { startsWith: `${PREFIJO}-CLIENTE-` } } }),
    prisma.cotizacion.count({ where: { referencia_demostracion: { startsWith: `${PREFIJO}-COT-` } } }),
    prisma.nota_venta.count({ where: { numero_nota_venta: { startsWith: `${PREFIJO}-NV-` } } }),
    prisma.pago_cliente.count({ where: { referencia_demostracion: { startsWith: `${PREFIJO}-PAGO-` } } }),
    prisma.movimiento_financiero.count({ where: { observacion: { startsWith: `${PREFIJO} Movimiento ` } } }),
    prisma.proveedor.count({ where: { identificador_tributario: { startsWith: `${PREFIJO}-PROV-` } } }),
    prisma.orden_compra_servicio_m5.count({ where: { referencia: { startsWith: `${PREFIJO}-OCS-` } } }),
    prisma.documento_proveedor_m5.count({ where: { folio_normalizado: { startsWith: `${PREFIJO}-DOC-` } } }),
    prisma.obligacion_proveedor_m5.count({ where: { id_documento_m5: { in: idsDocumentoProveedorDemo } } }),
    prisma.operacion_pago_proveedor_m5.count({ where: { id_proveedor: { in: idsProveedorDemo } } }),
    prisma.categoria_egreso_m5.count({ where: { nombre: { startsWith: `${PREFIJO} Categoría ` } } }),
    prisma.envio_importacion_m5.count({ where: { referencia_normalizada: { startsWith: `${PREFIJO}-ENVIO-` } } }),
    prisma.gasto_caja_chica_m5.count({ where: { descripcion: { startsWith: `${PREFIJO} Caja chica ` } } }),
    prisma.empleado.count({ where: { correo_particular: { startsWith: 'demo-ui-empleado', endsWith: '@example.invalid' } } }),
    prisma.esquema_remuneracional.count({ where: { codigo: { startsWith: `${PREFIJO}-ESQUEMA-` } } }),
    prisma.concepto_remuneracion.count({ where: { codigo_m6: { startsWith: `${PREFIJO}-HABER-` } } }),
    prisma.remuneracion.count({ where: { componentes: { some: { clave_negocio: { startsWith: `${PREFIJO}:` } } } } }),
    prisma.remuneracion.count({ where: { estado: { in: ['cerrada', 'reemplazada'] }, componentes: { some: { clave_negocio: { startsWith: `${PREFIJO}:` } } } } }),
    prisma.pago_remuneracion.count({ where: { clave_idempotencia: { startsWith: `${PREFIJO}:PAGO-REM:` } } }),
    prisma.boleta_honorarios.count({ where: { referencia: { startsWith: `${PREFIJO} boleta` } } }),
    prisma.parametro_remuneracional.count({ where: { referencia: PREFIJO } }),
    prisma.proyecto.count({ where: { proyecto_codigo_proyecto: { startsWith: `${PREFIJO}-PROY-` } } }),
    prisma.proyecto_financiero.count({ where: { codigo_proyecto_financiero: { startsWith: `${PREFIJO}-PF-` } } }),
    prisma.servicio_terreno.count({ where: { servicio_terreno_observaciones: { startsWith: `${PREFIJO} visita ` } } }),
    prisma.tarea.count({ where: { tarea_titulo: { startsWith: `${PREFIJO} Tarea ` } } }),
    prisma.ejecucion_tarea.count({ where: { tarea: { tarea_titulo: { startsWith: `${PREFIJO} Tarea ` } } } }),
    prisma.incidencia_retrabajo_tarea.count({ where: { descripcion: { startsWith: `${PREFIJO} incidencia ` } } }),
    prisma.orden_trabajo.count({ where: { especificaciones_puerta: { especificacion_puerta_observaciones: { startsWith: `${PREFIJO}-ESP-` } } } }),
    prisma.inventario_bodega.count({ where: { material_sku: { startsWith: 'DEMOUI-MAT-' }, lote: { lote_numero_lote: { startsWith: `${PREFIJO}-LOTE-` } } } }),
    prisma.movimiento_inventario.count({ where: { lote: { lote_numero_lote: { startsWith: `${PREFIJO}-LOTE-` } } } }),
    prisma.detalle_material_orden_compra_m5.count({ where: { orden_compra: { referencia: { startsWith: `${PREFIJO}-OCS-` } } } }),
    prisma.solicitud_crediticia_m8.count({ where: { referencia_contexto: { startsWith: `${PREFIJO}-SOL-` } } }),
    prisma.compromiso_credito_m8.count({ where: { condiciones: { startsWith: PREFIJO } } }),
    prisma.evento_auditoria_m9.count({ where: { identidad_logica: { startsWith: `${PREFIJO}:` } } }),
  ]);
  const limite = await prisma.limite_global_credito_m8.findFirst({ where: { motivo: { startsWith: PREFIJO } } });
  const exposicion = await prisma.compromiso_credito_m8.aggregate({ where: { condiciones: { startsWith: PREFIJO }, estado: 'VIGENTE' }, _sum: { monto_pendiente: true } });
  const [items, materiales, obras, cotizacionesFechadas, notasFechadas, pagosFechados, movimientosFechados, remuneracionesFechadas, notasSaldo, saldoCxp, stockDemo] = await Promise.all([
    prisma.item_comercial.count({ where: { nombre_item: { startsWith: PREFIJO } } }),
    prisma.material.count({ where: { material_sku: { startsWith: 'DEMOUI-MAT-' } } }),
    prisma.obra.count({ where: { obra_referencia: { startsWith: `${PREFIJO}-OBRA-` } } }),
    prisma.cotizacion.findMany({ where: { referencia_demostracion: { startsWith: `${PREFIJO}-COT-` } }, select: { fecha_emision: true } }),
    prisma.nota_venta.findMany({ where: { numero_nota_venta: { startsWith: `${PREFIJO}-NV-` } }, select: { fecha_emision: true, monto_total: true } }),
    prisma.pago_cliente.findMany({ where: { referencia_demostracion: { startsWith: `${PREFIJO}-PAGO-` } }, select: { fecha_pago: true, monto_pago: true } }),
    prisma.movimiento_financiero.findMany({ where: { observacion: { startsWith: `${PREFIJO} Movimiento ` } }, select: { fecha_movimiento: true, monto_movimiento: true, naturaleza_movimiento: true } }),
    prisma.remuneracion.findMany({ where: { componentes: { some: { clave_negocio: { startsWith: `${PREFIJO}:` } } } }, select: { total_haberes: true, periodo: { select: { anio: true, mes: true } } } }),
    prisma.nota_venta.findMany({ where: { numero_nota_venta: { startsWith: `${PREFIJO}-NV-` } }, select: { monto_total: true, asignacion_pago_cliente: { select: { monto_asignado: true } } } }),
    prisma.obligacion_proveedor_m5.aggregate({ where: { id_documento_m5: { in: idsDocumentoProveedorDemo } }, _sum: { saldo_actual: true } }),
    prisma.inventario_bodega.findMany({ where: { material_sku: { startsWith: 'DEMOUI-MAT-' } }, select: { inventario_bodega_cantidad_fisica: true } }),
  ]);
  type Serie = Record<string, { cantidad: number; monto: number }>;
  const acumular = (serie: Serie, clave: string, monto = 0) => { const actual = serie[clave] ?? { cantidad: 0, monto: 0 }; actual.cantidad++; actual.monto += monto; serie[clave] = actual; };
  const series = { cotizaciones: {} as Serie, ventas: {} as Serie, pagos: {} as Serie, movimientosFinancieros: {} as Serie, remuneraciones: {} as Serie };
  for (const fila of cotizacionesFechadas) acumular(series.cotizaciones, claveMes(fila.fecha_emision));
  for (const fila of notasFechadas) acumular(series.ventas, claveMes(fila.fecha_emision), Number(fila.monto_total));
  for (const fila of pagosFechados) acumular(series.pagos, claveMes(fila.fecha_pago), Number(fila.monto_pago));
  for (const fila of movimientosFechados) acumular(series.movimientosFinancieros, claveMes(fila.fecha_movimiento), Number(fila.monto_movimiento) * (fila.naturaleza_movimiento === 'egreso' ? -1 : 1));
  for (const fila of remuneracionesFechadas) acumular(series.remuneraciones, `${fila.periodo.anio}-${String(fila.periodo.mes).padStart(2, '0')}`, Number(fila.total_haberes || 0));
  const anuales = Object.fromEntries(Object.entries(series).map(([nombre, serie]) => [nombre, Object.entries(serie).reduce<Serie>((salida, [mes, valor]) => { const anio = mes.slice(0, 4); const actual = salida[anio] ?? { cantidad: 0, monto: 0 }; actual.cantidad += valor.cantidad; actual.monto += valor.monto; salida[anio] = actual; return salida; }, {})]));
  const meses = Object.keys(series.cotizaciones).sort();
  const fechaMaxima = (valores: Date[]) => valores.length ? new Date(Math.max(...valores.map(valor => valor.getTime()))) : null;
  const fechaMaximaPagoCliente = fechaMaxima(pagosFechados.map(fila => fila.fecha_pago));
  const fechaMaximaMovimientoFinanciero = fechaMaxima(movimientosFechados.map(fila => fila.fecha_movimiento));
  const actividadEfectivaPosteriorRango = pagosFechados.filter(fila => fila.fecha_pago > finMes).length + movimientosFechados.filter(fila => fila.fecha_movimiento > finMes).length;
  const saldoCxC = notasSaldo.reduce((total, nota) => total + Math.max(0, Number(nota.monto_total) - nota.asignacion_pago_cliente.reduce((suma, asignacion) => suma + Number(asignacion.monto_asignado), 0)), 0);
  const costoRemuneraciones = remuneracionesFechadas.reduce((total, fila) => total + Number(fila.total_haberes || 0), 0);
  const unidadesStock = stockDemo.reduce((total, fila) => total + Number(fila.inventario_bodega_cantidad_fisica || 0), 0);
  return { rangoHistorico: { desde: meses[0] ?? null, hasta: meses.length ? meses[meses.length - 1] : null, meses: meses.length }, fechasMaximasEfectivas: { pagoCliente: fechaMaximaPagoCliente?.toISOString().slice(0, 10) ?? null, movimientoFinanciero: fechaMaximaMovimientoFinanciero?.toISOString().slice(0, 10) ?? null }, actividadEfectivaPosteriorRango, usuarios, clientes, items, materiales, cotizaciones, notas, pagos, movimientosFinancieros, proveedores, ocs, documentosProveedor, obligaciones, pagosProveedor, categoriasEgreso, envios, cajaChica, empleados, esquemas, haberes, remuneraciones, documentosRemuneracion, pagosRemuneracion, honorarios, parametros, proyectos, proyectosFinancieros, obras, visitas, tareas, ejecuciones, incidencias, ots, stock, unidadesStock, movimientosInventario, compras, solicitudes, compromisos, eventos, limiteGlobal: Number(limite?.monto_limite || 0), exposicion: Number(exposicion._sum.monto_pendiente || 0), saldoCxC, saldoCxP: Number(saldoCxp._sum.saldo_actual || 0), costoRemuneraciones, seriesMensuales: series, seriesAnuales: anuales };
}

async function cortesHistoricosM7() {
  const controlador = new M7Controller(new AdaptadorCreditoM8ParaM7(new M8Controller()));
  const permisos = Array.from({ length: 44 }, (_, indice) => `CU${215 + indice}`);
  const indicador = (valor: unknown) => valor && typeof valor === 'object' && 'valor' in valor ? (valor as { valor: unknown }).valor : valor ?? null;
  const cortes = [];
  for (const retroceso of [0, 6, 12, 18]) {
    const corte = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - retroceso, 1));
    const panel = await controlador.consultarPanelGeneral({ anio: String(corte.getUTCFullYear()), mes: String(corte.getUTCMonth() + 1) }, permisos);
    const bloques = panel.bloques as Record<string, Record<string, unknown>>;
    const flujo = indicador(bloques.liquidez?.flujoHistorico) as { totales?: unknown } | null;
    const credito = indicador(bloques.exposicionCredito?.exposicion) as { exposicionUtilizada?: number; capacidadDisponible?: number; totalSolicitudes?: number; totalCompromisos?: number } | null;
    cortes.push({ corte: claveMes(corte), ventas: { estado: bloques.ventas?.estado, monto: indicador(bloques.ventas?.montoNeto), cantidad: indicador(bloques.ventas?.cantidad), conversion: indicador(bloques.ventas?.conversion) }, cxc: { estado: bloques.cuentasCobrar?.estado, saldo: indicador(bloques.cuentasCobrar?.saldo) }, cxp: { estado: bloques.cuentasPagar?.estado, saldo: indicador(bloques.cuentasPagar?.saldo) }, liquidez: { estado: bloques.liquidez?.estado, totales: flujo?.totales ?? null }, remuneraciones: { estado: bloques.costoRemuneraciones?.estado, costo: indicador(bloques.costoRemuneraciones?.costoLaboral) }, proyectos: { estado: bloques.margenProyectos?.estado, cantidad: Array.isArray(bloques.margenProyectos?.proyectos) ? bloques.margenProyectos.proyectos.length : null }, operacion: { estado: bloques.cargaOperacional?.estado }, instalaciones: { estado: bloques.instalaciones?.estado }, inventario: { estado: bloques.inventarioValorizado?.estado, valor: indicador(bloques.inventarioValorizado?.valorTotal) }, credito: { estado: bloques.exposicionCredito?.estado, exposicionUtilizada: credito?.exposicionUtilizada ?? null, capacidadDisponible: credito?.capacidadDisponible ?? null, solicitudes: credito?.totalSolicitudes ?? null, compromisos: credito?.totalCompromisos ?? null } });
  }
  return cortes;
}

async function verificar() {
  const resumen = await conteos();
  const minimos: Record<string, number> = { usuarios: 5, clientes: 50, items: 10, materiales: 25, cotizaciones: 200, notas: 100, pagos: 100, movimientosFinancieros: 150, proveedores: 12, ocs: 80, documentosProveedor: 80, obligaciones: 80, pagosProveedor: 60, empleados: 15, remuneraciones: 250, pagosRemuneracion: 250, honorarios: 50, proyectos: 30, proyectosFinancieros: 30, obras: 30, visitas: 80, tareas: 150, ejecuciones: 100, incidencias: 20, ots: 30, stock: 25, movimientosInventario: 200, compras: 80, solicitudes: 20, compromisos: 10, eventos: 40 };
  const fallos = Object.entries(minimos).filter(([clave, minimo]) => Number(resumen[clave as keyof typeof resumen]) < minimo).map(([clave, minimo]) => `${clave}: mínimo ${minimo}, actual ${resumen[clave as keyof typeof resumen]}`);
  if (resumen.limiteGlobal <= 0) fallos.push('límite global M8 no configurado');
  if (resumen.exposicion <= 0) fallos.push('exposición M8 no positiva');
  if (resumen.rangoHistorico.meses < 24) fallos.push(`histórico insuficiente: ${resumen.rangoHistorico.meses} meses`);
  if (resumen.actividadEfectivaPosteriorRango > 0) fallos.push(`actividad efectiva posterior al rango: ${resumen.actividadEfectivaPosteriorRango}`);
  for (const [tipo, fechaMaxima] of Object.entries(resumen.fechasMaximasEfectivas)) if (fechaMaxima && new Date(`${fechaMaxima}T00:00:00Z`) > finMes) fallos.push(`${tipo} excede el cierre ${finMes.toISOString().slice(0, 10)}: ${fechaMaxima}`);
  if (Object.keys(resumen.seriesMensuales.ventas).length < 12) fallos.push('menos de 12 meses con ventas');
  if (new Set(Object.values(resumen.seriesMensuales.ventas).map(valor => valor.monto)).size < 2) fallos.push('ventas mensuales sin variación');
  if (Object.keys(resumen.seriesAnuales.ventas).length < 2) fallos.push('ventas no cubren al menos dos años');
  if (resumen.saldoCxC <= 0) fallos.push('CxC DEMO sin saldo abierto');
  if (resumen.saldoCxP <= 0) fallos.push('CxP DEMO sin saldo abierto');
  if (resumen.unidadesStock <= 0) fallos.push('inventario DEMO sin existencias');
  if (resumen.costoRemuneraciones <= 0) fallos.push('remuneraciones DEMO sin costo');
  const panel = await new M7Controller(new AdaptadorCreditoM8ParaM7(new M8Controller())).consultarPanelGeneral({}, Array.from({ length: 44 }, (_, indice) => `CU${215 + indice}`));
  if (!panel.bloques || Object.keys(panel.bloques).length < 5) fallos.push('Dashboard M7 sin bloques suficientes');
  const bloques = panel.bloques as Record<string, { estado?: string }>;
  if (bloques.exposicionCredito?.estado !== 'VALIDO') fallos.push('Dashboard M7 sin productor M8 disponible');
  for (const clave of ['ventas', 'cuentasCobrar', 'cuentasPagar', 'liquidez', 'margenProyectos', 'costoRemuneraciones', 'cargaOperacional', 'instalaciones', 'inventarioValorizado']) if (!bloques[clave] || ['SIN_RESULTADOS', 'DATOS_INSUFICIENTES', 'FUENTE_NO_DISPONIBLE'].includes(String(bloques[clave].estado))) fallos.push(`Dashboard M7 sin datos demostrables en ${clave}`);
  const serializado = JSON.stringify(panel);
  if (!serializado.includes('DEMOUI-MAT-') || !serializado.includes(PREFIJO)) fallos.push('Dashboard M7 sin datos reales DEMO-UI de inventario/operación');
  if (fallos.length) throw new Error(`Dataset DEMO incompleto:\n- ${fallos.join('\n- ')}`);
  console.log(JSON.stringify({ estado: 'OK', ...resumen, bloquesM7: Object.keys(panel.bloques), creditoM7: bloques.exposicionCredito, cortesM7: await cortesHistoricosM7(), dependenciasExternas: [] }, null, 2));
}

async function ejecutar() {
  const modo = process.argv[2] || 'seed';
  if (modo === 'seed') { await sembrarFinanzas(); await sembrarProveedoresEInventario(); await sembrarPersonasYOperacion(); await sembrarHistoricoRealista(); await sembrarComprasEInventarioHistorico(); await sembrarCredito(); await sembrarAuditoria(); await verificar(); return; }
  if (modo === 'status') { console.log(JSON.stringify({ ...(await conteos()), cortesM7: await cortesHistoricosM7() }, null, 2)); return; }
  if (modo === 'verify') { await verificar(); return; }
  if (modo === 'clean') { await limpiarDemo(); return; }
  throw new Error(`Modo no soportado: ${modo}`);
}

ejecutar().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
