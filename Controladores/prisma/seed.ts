import { sembrarM4 } from './seed-m4';
import { prisma } from '../src/db';
import { fechaNegocio } from '../src/utilidades/finanzas';

/** Demostración I2 ficticia, repetible y aditiva: nunca borra ni actualiza registros existentes. */
async function sembrar() {
  await prisma.$transaction(async transaccion => {
    const clp = await transaccion.moneda.upsert({ where: { codigo_moneda: 'CLP' }, update: {}, create: { codigo_moneda: 'CLP', nombre_moneda: 'Peso chileno' } });
    const usd = await transaccion.moneda.upsert({ where: { codigo_moneda: 'USD' }, update: {}, create: { codigo_moneda: 'USD', nombre_moneda: 'Dólar estadounidense' } });
    const empresa = await transaccion.tipo_cliente_financiero.upsert({ where: { nombre_tipo_cliente_financiero: 'B2B' }, update: {}, create: { nombre_tipo_cliente_financiero: 'B2B' } });
    const persona = await transaccion.tipo_cliente_financiero.upsert({ where: { nombre_tipo_cliente_financiero: 'B2C' }, update: {}, create: { nombre_tipo_cliente_financiero: 'B2C' } });
    const medio = await transaccion.medio_pago.upsert({ where: { nombre_medio_pago: 'Transferencia' }, update: {}, create: { nombre_medio_pago: 'Transferencia' } });
    for (const nombre of ['Efectivo', 'Débito', 'Crédito', 'Cheque']) await transaccion.medio_pago.upsert({ where: { nombre_medio_pago: nombre }, update: {}, create: { nombre_medio_pago: nombre } });
    for (const nombre of ['Anticipo', 'Abono parcial', 'Pago final']) await transaccion.categoria_pago.upsert({ where: { nombre }, update: {}, create: { nombre } });
    await transaccion.config_cuotas_tarjeta.upsert({ where: { cantidad: 1 }, update: {}, create: { cantidad: 1 } });
    const categoria = await transaccion.categoria_pago.findUniqueOrThrow({ where: { nombre: 'Anticipo' } });
    const tipoFactura = await transaccion.tipo_documento.upsert({ where: { nombre_tipo_documento: 'Factura Electrónica' }, update: {}, create: { nombre_tipo_documento: 'Factura Electrónica', aplica_venta: true } });
    let item = await transaccion.item_comercial.findFirst({ where: { nombre_item: 'Puerta demostración I2' } });
    if (!item) item = await transaccion.item_comercial.create({ data: { nombre_item: 'Puerta demostración I2', descripcion_item: 'Producto ficticio para verificar la migración', estado_item: 'activo' } });
    await transaccion.material.upsert({ where: { material_sku: 'DEMO-I2-ACERO' }, update: {}, create: { material_sku: 'DEMO-I2-ACERO', material_nombre_material: 'Acero demostración I2' } });
    if (!await transaccion.historial_precio_material.findFirst({ where: { material_sku: 'DEMO-I2-ACERO' } })) {
      await transaccion.historial_precio_material.create({ data: { material_sku: 'DEMO-I2-ACERO', id_moneda: clp.id_moneda, precio_unitario: 70000, fecha_vigencia_inicio: new Date('2026-01-01'), estado_precio: 'vigente' } });
    }
    const fecha = (dias: number) => { const resultado = new Date(`${fechaNegocio()}T00:00:00Z`); resultado.setUTCDate(resultado.getUTCDate() + dias); return resultado; };
    const rutFicticio = (numero: number) => {
      let suma = 0, factor = 2;
      for (const digito of String(numero).split('').reverse()) { suma += Number(digito) * factor; factor = factor === 7 ? 2 : factor + 1; }
      const verificador = 11 - suma % 11;
      return `${numero}-${verificador === 11 ? '0' : verificador === 10 ? 'K' : verificador}`;
    };
    const demostraciones = [
      { clave: 'empresa', nombre: 'Demostración I2 — Taller Aurora', b2b: true, activo: true, provisional: false },
      { clave: 'persona', nombre: 'Demostración I2 — Elena Robles', b2b: false, activo: true, provisional: false },
      { clave: 'inactivo', nombre: 'Demostración I2 — Comercial Inactiva', b2b: true, activo: false, provisional: false },
      { clave: 'provisional', nombre: 'Demostración I2 — Cliente Incompleto', b2b: false, activo: true, provisional: true },
      { clave: 'sin-historial', nombre: 'Demostración I2 — Sin movimientos', b2b: false, activo: true, provisional: false },
    ];
    for (const [indice, demostracion] of demostraciones.entries()) {
      const rut = demostracion.provisional ? null : rutFicticio(99000001 + indice);
      if (rut) await transaccion.cliente.upsert({ where: { cliente_cliente_rut: rut }, update: {}, create: {
        cliente_cliente_rut: rut, cliente_razon_social: demostracion.nombre, cliente_correo: `${demostracion.clave}@example.invalid`,
        cliente_telefono: '+56 9 0000 0000', cliente_es_cliente_b2b: demostracion.b2b, cliente_es_cliente_b2c: !demostracion.b2b,
      } });
      const cliente = await transaccion.cliente_financiero.upsert({ where: { referencia_demostracion: `I2-${demostracion.clave}` }, update: {}, create: {
        referencia_demostracion: `I2-${demostracion.clave}`, rut_cliente: rut,
        id_tipo_cliente_financiero: demostracion.b2b ? empresa.id_tipo_cliente_financiero : persona.id_tipo_cliente_financiero,
        nombre_razon_social_referencia: demostracion.nombre, telefono_financiero: '+56 9 0000 0000',
        correo_financiero: demostracion.provisional ? null : `${demostracion.clave}@example.invalid`,
        estado_financiero: demostracion.activo ? 'activo' : 'inactivo', nivel_formalizacion: demostracion.provisional ? 'provisional' : 'formal',
      } });
      const ficha = await transaccion.ficha_cliente.upsert({ where: { id_cliente_financiero: cliente.id_cliente_financiero }, update: {}, create: {
        id_cliente_financiero: cliente.id_cliente_financiero, estado_ficha: demostracion.activo ? 'activa' : 'inactiva',
      } });
      if (demostracion.clave === 'sin-historial' || !demostracion.activo) continue;
      const cotizacion = await transaccion.cotizacion.upsert({ where: { referencia_demostracion: `I2-COT-${demostracion.clave}` }, update: {}, create: {
        referencia_demostracion: `I2-COT-${demostracion.clave}`, id_ficha_cliente: ficha.id_ficha_cliente, id_moneda: clp.id_moneda,
        fecha_emision: fecha(-15), fecha_vigencia: fecha(30), estado_cotizacion: demostracion.provisional ? 'borrador' : 'aprobada',
        subtotal_costos_estimados: 70000, margen_esperado: 30, precio_sugerido: 100000, monto_neto: 100000, monto_impuesto: 19000, monto_total_estimado: 119000,
        detalle_cotizacion: { create: { id_item_comercial: item.id_item_comercial, cantidad_item: 1, subtotal_item_estimado: 100000, descripcion_item_cotizado: 'Puerta ficticia 2100x900x50', medida_alto_referencial: 2100, medida_ancho_referencial: 900, medida_espesor_referencial: 50 } },
      } });
      if (demostracion.provisional) continue;
      let proyecto = await transaccion.proyecto.findFirst({ where: { proyecto_codigo_proyecto: `DEMO-I2-${demostracion.clave}` } });
      if (!proyecto) proyecto = await transaccion.proyecto.create({ data: { proyecto_codigo_proyecto: `DEMO-I2-${demostracion.clave}`, rut_cliente: rut, proyecto_nombre_referencia: `Proyecto ficticio ${demostracion.clave}`, proyecto_fecha_ingreso: fecha(-20), proyecto_estado_operacional: demostracion.b2b ? 'activo' : 'terminado' } });
      const nota = await transaccion.nota_venta.upsert({ where: { numero_nota_venta: `DEMO-I2-NV-${demostracion.clave}` }, update: {}, create: {
        numero_nota_venta: `DEMO-I2-NV-${demostracion.clave}`, id_ficha_cliente: ficha.id_ficha_cliente, id_cotizacion: cotizacion.id_cotizacion,
        id_moneda: clp.id_moneda, id_proyecto_contexto: proyecto.proyecto_proyecto_id, fecha_emision: fecha(-15), fecha_vencimiento: fecha(-5),
        monto_neto: 100000, monto_impuesto: 19000, monto_total: 119000, estado_nota_venta: 'confirmada', estado_pago: demostracion.b2b ? 'parcial' : 'pagada',
      } });
      const documento = await transaccion.documento_tributario.upsert({ where: { id_tipo_documento_folio_documento: { id_tipo_documento: tipoFactura.id_tipo_documento, folio_documento: `DEMO-I2-${demostracion.clave}` } }, update: {}, create: {
        id_ficha_cliente: ficha.id_ficha_cliente, id_nota_venta: nota.id_nota_venta, id_moneda: clp.id_moneda, id_tipo_documento: tipoFactura.id_tipo_documento,
        folio_documento: `DEMO-I2-${demostracion.clave}`, fecha_emision: fecha(-15), monto_neto: 100000, monto_impuesto: 19000, monto_total: 119000,
      } });
      await transaccion.documento_tributario_nota_venta.upsert({ where: { id_documento_tributario_id_nota_venta: { id_documento_tributario: documento.id_documento_tributario, id_nota_venta: nota.id_nota_venta } }, update: {}, create: { id_documento_tributario: documento.id_documento_tributario, id_nota_venta: nota.id_nota_venta } });
      if (!await transaccion.condicion_cobro_nv.findFirst({ where: { id_nota_venta: nota.id_nota_venta } })) await transaccion.condicion_cobro_nv.create({ data: { id_nota_venta: nota.id_nota_venta, descripcion: 'Referencia de cobro ficticia; no genera mora independiente' } });
      const monto = demostracion.b2b ? 19000 : 119000;
      const pago = await transaccion.pago_cliente.upsert({ where: { referencia_demostracion: `I2-PAGO-${demostracion.clave}` }, update: {}, create: {
        referencia_demostracion: `I2-PAGO-${demostracion.clave}`, id_ficha_cliente: ficha.id_ficha_cliente, id_moneda: clp.id_moneda,
        id_medio_pago: medio.id_medio_pago, id_categoria_pago: categoria.id_categoria_pago, fecha_pago: fecha(-10), monto_pago: monto,
        comprobante_pago: 'demostracion://respaldo-ficticio', asignacion_pago_cliente: { create: { id_nota_venta: nota.id_nota_venta, monto_asignado: monto } },
      } });
      if (!demostracion.b2b) continue;
      if (!await transaccion.reversion_pago.findFirst({ where: { id_pago_cliente: pago.id_pago_cliente } })) await transaccion.reversion_pago.create({ data: { id_pago_cliente: pago.id_pago_cliente, monto: 4000, motivo: 'Devolución ficticia parcial', responsable: 'Demostración I2', respaldo: 'demostracion://devolucion' } });
      await transaccion.reversion_nota_venta.upsert({ where: { folio_nota_credito: 'DEMO-I2-NC-1' }, update: {}, create: { id_nota_venta: nota.id_nota_venta, monto: 19000, motivo: 'Reversión comercial ficticia parcial', responsable: 'Demostración I2', folio_nota_credito: 'DEMO-I2-NC-1', respaldo_pdf: 'demostracion://nota-credito.pdf' } });
      const anulado = await transaccion.pago_cliente.upsert({ where: { referencia_demostracion: 'I2-PAGO-ANULADO' }, update: {}, create: {
        referencia_demostracion: 'I2-PAGO-ANULADO', id_ficha_cliente: ficha.id_ficha_cliente, id_moneda: clp.id_moneda, id_medio_pago: medio.id_medio_pago,
        fecha_pago: fecha(-8), monto_pago: 5000, asignacion_pago_cliente: { create: { id_nota_venta: nota.id_nota_venta, monto_asignado: 5000 } },
      } });
      await transaccion.anulacion_pago.upsert({ where: { id_pago_cliente: anulado.id_pago_cliente }, update: {}, create: { id_pago_cliente: anulado.id_pago_cliente, motivo: 'Corrección registral ficticia', responsable: 'Demostración I2', respaldo: 'demostracion://anulacion' } });
      await transaccion.nota_venta.upsert({ where: { numero_nota_venta: 'DEMO-I2-NV-VIGENTE' }, update: {}, create: { numero_nota_venta: 'DEMO-I2-NV-VIGENTE', id_ficha_cliente: ficha.id_ficha_cliente, id_moneda: clp.id_moneda, fecha_emision: fecha(0), fecha_vencimiento: fecha(30), monto_neto: 50000, monto_impuesto: 9500, monto_total: 59500 } });
      await transaccion.nota_venta.upsert({ where: { numero_nota_venta: 'DEMO-I2-NV-ANULADA' }, update: {}, create: { numero_nota_venta: 'DEMO-I2-NV-ANULADA', id_ficha_cliente: ficha.id_ficha_cliente, id_moneda: clp.id_moneda, fecha_emision: fecha(-20), fecha_vencimiento: fecha(-10), monto_neto: 70000, monto_impuesto: 13300, monto_total: 83300, estado_nota_venta: 'anulada' } });
      const notaUsd = await transaccion.nota_venta.upsert({ where: { numero_nota_venta: 'DEMO-I2-NV-USD' }, update: {}, create: { numero_nota_venta: 'DEMO-I2-NV-USD', id_ficha_cliente: ficha.id_ficha_cliente, id_moneda: usd.id_moneda, fecha_emision: fecha(0), fecha_vencimiento: fecha(30), monto_neto: 1000, monto_total: 1000, exento_iva: true } });
      await transaccion.pago_cliente.upsert({ where: { referencia_demostracion: 'I2-PAGO-USD' }, update: {}, create: { referencia_demostracion: 'I2-PAGO-USD', id_ficha_cliente: ficha.id_ficha_cliente, id_moneda: usd.id_moneda, id_medio_pago: medio.id_medio_pago, fecha_pago: fecha(0), monto_pago: 250, tipo_cambio_usado: 900, monto_convertido: 225000, observacion: 'Factor ficticio de demostración, no cotización de mercado', asignacion_pago_cliente: { create: { id_nota_venta: notaUsd.id_nota_venta, monto_asignado: 250 } } } });
    }
  }, { timeout: 60000 });
  console.log('Seed I2 completado: datos ficticios relacionados, sin borrar ni actualizar información previa.');
}
sembrar().then(sembrarM4).catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
