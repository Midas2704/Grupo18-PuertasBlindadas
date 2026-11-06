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

/** Escenarios visuales repetibles de M5 para catálogo, filtros y fichas CU75-CU84. */
async function sembrarM5() {
  await prisma.$transaction(async tx => {
    const [pais, tipoIdentificador, moneda, medioPago, usuario] = await Promise.all([
      tx.pais.upsert({ where: { nombre_pais: 'Chile' }, update: { estado_pais: 'activo', codigo_iso_pais: 'CL' }, create: { nombre_pais: 'Chile', codigo_iso_pais: 'CL' } }),
      tx.tipo_identificador.upsert({ where: { nombre_tipo_identificador: 'RUT' }, update: { estado_tipo_identificador: 'activo' }, create: { nombre_tipo_identificador: 'RUT', descripcion_tipo_identificador: 'Rol Único Tributario chileno' } }),
      tx.moneda.findUniqueOrThrow({ where: { codigo_moneda: 'CLP' } }),
      tx.medio_pago.findUniqueOrThrow({ where: { nombre_medio_pago: 'Transferencia' } }),
      tx.usuario.findFirstOrThrow({ where: { administrador_original: true } }),
    ]);
    const tipoDocumento = await tx.tipo_documento.upsert({
      where: { nombre_tipo_documento: 'Factura proveedor demo M5' },
      update: { aplica_compra: true, requiere_vencimiento: true, estado_tipo_documento: 'activo' },
      create: { nombre_tipo_documento: 'Factura proveedor demo M5', descripcion_tipo_documento: 'Documento ficticio para validar CU80-CU84', aplica_compra: true, requiere_vencimiento: true },
    });
    const fechaHabil = (desplazamiento: number) => {
      const fecha = new Date(); let restantes = Math.abs(desplazamiento); const paso = desplazamiento < 0 ? -1 : 1;
      while (restantes > 0) { fecha.setUTCDate(fecha.getUTCDate() + paso); if (![0, 6].includes(fecha.getUTCDay())) restantes--; }
      return fecha;
    };
    const escenarios = [
      { clave: 'SIN-DEUDA', rut: '76.543.210-3', nombre: 'Demo M5 Acero Austral', estado: 'activo', tipo: 'Insumos/Materiales', contacto: 'Camila Soto', correo: 'camila.demo@example.invalid', telefono: '+56 9 5555 0101', condicionDias: 0, condicionTipo: 'DIAS_CORRIDOS', total: 0, vence: null },
      { clave: 'INACTIVO', rut: '76.543.211-1', nombre: 'Demo M5 Servicios Históricos', estado: 'inactivo', tipo: 'Servicios', contacto: 'Tomás Vera', correo: 'tomas.demo@example.invalid', telefono: '+56 9 5555 0102', condicionDias: null, condicionTipo: null, total: 0, vence: null },
      { clave: 'POR-PAGAR', rut: '76.543.212-K', nombre: 'Demo M5 Materiales Andinos', estado: 'activo', tipo: 'Ambos', contacto: 'Elena Ruiz', correo: 'elena.demo@example.invalid', telefono: '+56 9 5555 0103', condicionDias: 30, condicionTipo: 'DIAS_CORRIDOS', total: 120000, vence: null },
      { clave: 'POR-VENCER', rut: '76.543.213-8', nombre: 'Demo M5 Logística Central', estado: 'activo', tipo: 'Servicios', contacto: 'Marco Díaz', correo: 'marco.demo@example.invalid', telefono: '+56 9 5555 0104', condicionDias: 15, condicionTipo: 'DIAS_HABILES', total: 240000, vence: fechaHabil(3) },
      { clave: 'VENCIDA', rut: '76.543.214-6', nombre: 'Demo M5 Suministros del Sur', estado: 'activo', tipo: 'Insumos/Materiales', contacto: 'Sofía Lagos', correo: 'sofia.demo@example.invalid', telefono: '+56 9 5555 0105', condicionDias: null, condicionTipo: null, total: 360000, vence: fechaHabil(-2) },
    ] as const;
    for (const escenario of escenarios) {
      const existente = await tx.proveedor.findFirst({ where: { id_pais: pais.id_pais, id_tipo_identificador: tipoIdentificador.id_tipo_identificador, identificador_tributario: escenario.rut } });
      const datos = { id_pais: pais.id_pais, id_tipo_identificador: tipoIdentificador.id_tipo_identificador, identificador_tributario: escenario.rut, nombre_razon_social: escenario.nombre, tipo_proveedor_m5: escenario.tipo, contacto_proveedor: escenario.contacto, correo_proveedor: escenario.correo, telefono_proveedor: escenario.telefono, direccion_proveedor: 'Dirección ficticia para demostración M5', condicion_pago_dias_m5: escenario.condicionDias, condicion_pago_tipo_m5: escenario.condicionTipo, estado_proveedor: escenario.estado };
      const proveedor = existente ? await tx.proveedor.update({ where: { id_proveedor: existente.id_proveedor }, data: datos }) : await tx.proveedor.create({ data: datos });
      if (!await tx.historial_proveedor_m5.findFirst({ where: { id_proveedor: proveedor.id_proveedor, motivo: 'Datos ficticios M5' } })) await tx.historial_proveedor_m5.create({ data: { id_proveedor: proveedor.id_proveedor, campo: escenario.estado === 'inactivo' ? 'estado' : 'razon_social', valor_anterior: escenario.estado === 'inactivo' ? 'activo' : null, valor_nuevo: escenario.estado === 'inactivo' ? 'inactivo' : escenario.nombre, motivo: 'Datos ficticios M5', usuario_id_usuario: usuario.usuario_id_usuario } });
      if (escenario.total > 0) {
        const numero = `DEMO-M5-${escenario.clave}`;
        const anterior = await tx.documento_compra_proveedor.findFirst({ where: { id_proveedor: proveedor.id_proveedor, id_tipo_documento: tipoDocumento.id_tipo_documento, numero_documento: numero } });
        const documento = anterior ? await tx.documento_compra_proveedor.update({ where: { id_documento_compra_proveedor: anterior.id_documento_compra_proveedor }, data: { fecha_emision: fechaHabil(-10), fecha_vencimiento: escenario.vence, monto_neto: escenario.total, monto_total: escenario.total, estado_documento: 'pendiente_pago' } }) : await tx.documento_compra_proveedor.create({ data: { id_proveedor: proveedor.id_proveedor, id_tipo_documento: tipoDocumento.id_tipo_documento, id_moneda: moneda.id_moneda, numero_documento: numero, fecha_emision: fechaHabil(-10), fecha_vencimiento: escenario.vence, monto_neto: escenario.total, monto_total: escenario.total, estado_documento: 'pendiente_pago', observacion: 'Documento ficticio M5' } });
        if (escenario.clave === 'POR-PAGAR') {
          let pago = await tx.pago_proveedor.findFirst({ where: { id_proveedor: proveedor.id_proveedor, observacion: 'DEMO_M5_PAGO_PARCIAL' } });
          if (!pago) pago = await tx.pago_proveedor.create({ data: { id_proveedor: proveedor.id_proveedor, id_moneda: moneda.id_moneda, id_medio_pago: medioPago.id_medio_pago, fecha_pago: fechaHabil(-3), monto_pago: 20000, estado_pago: 'verificado', observacion: 'DEMO_M5_PAGO_PARCIAL' } });
          if (!await tx.asignacion_pago_proveedor.findFirst({ where: { id_pago_proveedor: pago.id_pago_proveedor, id_documento_compra_proveedor: documento.id_documento_compra_proveedor } })) await tx.asignacion_pago_proveedor.create({ data: { id_pago_proveedor: pago.id_pago_proveedor, id_documento_compra_proveedor: documento.id_documento_compra_proveedor, monto_asignado: 20000, observacion: 'Asignación ficticia M5' } });
        }
      }
    }
    const ordenesDemo = [
      { referencia: 'DEMO-M5-OCS-ASESORIA', rut: '76.543.210-3', monto: 480000, periodo: '2026-09', descripcion: 'Asesoría técnica ficticia', estado: 'abierta' },
      { referencia: 'DEMO-M5-OCS-LOGISTICA', rut: '76.543.213-8', monto: 725000, periodo: '2026-10', descripcion: 'Servicio logístico ficticio', estado: 'abierta' },
      { referencia: 'DEMO-M5-OCS-MANTENCION', rut: '76.543.213-8', monto: 315000, periodo: null, descripcion: 'Mantención preventiva ficticia', estado: 'abierta' },
      { referencia: 'DEMO-M5-OCS-CERRADA', rut: '76.543.210-3', monto: 250000, periodo: '2026-07', descripcion: 'Escenario demo cerrado directamente por seed', estado: 'cerrada' },
      { referencia: 'DEMO-M5-OCS-ANULADA', rut: '76.543.213-8', monto: 180000, periodo: '2026-08', descripcion: 'Escenario demo anulado directamente por seed', estado: 'anulada' },
    ];
    for (const demo of ordenesDemo) {
      const proveedor = await tx.proveedor.findFirstOrThrow({ where: { identificador_tributario: demo.rut, estado_proveedor: 'activo' } });
      const existente = await tx.orden_compra_servicio_m5.findFirst({ where: { referencia: demo.referencia } });
      const orden = existente ? await tx.orden_compra_servicio_m5.update({ where: { id_orden_compra_servicio_m5: existente.id_orden_compra_servicio_m5 }, data: { id_proveedor: proveedor.id_proveedor, id_moneda: moneda.id_moneda, monto_autorizado: demo.monto, periodo: demo.periodo, descripcion: demo.descripcion, estado_ocs: demo.estado } }) : await tx.orden_compra_servicio_m5.create({ data: { id_proveedor: proveedor.id_proveedor, id_moneda: moneda.id_moneda, monto_autorizado: demo.monto, monto_autorizado_original: demo.monto, estado_ocs: demo.estado, referencia: demo.referencia, periodo: demo.periodo, descripcion: demo.descripcion, creado_por: usuario.usuario_id_usuario } });
      if (!await tx.historial_orden_compra_servicio_m5.findFirst({ where: { id_ocs_m5: orden.id_orden_compra_servicio_m5, campo: 'creacion' } })) await tx.historial_orden_compra_servicio_m5.create({ data: { id_ocs_m5: orden.id_orden_compra_servicio_m5, campo: 'creacion', valor_nuevo: JSON.stringify({ idProveedor: proveedor.id_proveedor, montoAutorizado: demo.monto, estado: demo.estado }), motivo: demo.estado === 'abierta' ? null : 'Escenario demo creado directamente por seed', usuario_id_usuario: usuario.usuario_id_usuario } });
    }
    for (const nombre of ['DEMO M5 Servicios', 'DEMO M5 Materiales', 'DEMO M5 Gastos generales']) await tx.categoria_egreso_m5.upsert({ where: { nombre }, update: { activo: true, nombre_normalizado: nombre.toLocaleUpperCase('es-CL') }, create: { nombre, nombre_normalizado: nombre.toLocaleUpperCase('es-CL') } });
    if (!await tx.config_umbral_por_vencer_m5.findFirst()) await tx.config_umbral_por_vencer_m5.create({ data: { dias_habiles: 5, usuario_id_usuario: usuario.usuario_id_usuario } });
    for (const [fecha, descripcion] of [['2026-01-01','Año Nuevo'],['2026-05-01','Día del Trabajo'],['2026-09-18','Fiestas Patrias'],['2026-09-19','Glorias del Ejército'],['2026-12-25','Navidad']] as const) await tx.feriado_chile_m5.upsert({ where: { fecha: new Date(`${fecha}T00:00:00Z`) }, update: { descripcion }, create: { fecha: new Date(`${fecha}T00:00:00Z`), descripcion } });
    const proveedorDemo = await tx.proveedor.findFirstOrThrow({ where: { identificador_tributario: '76.543.210-3' } });
    for (const demo of [{ clase: 'preliminar', folio: 'DEMO-M5-PRELIMINAR', monto: 125000 }, { clase: 'definitivo', folio: 'DEMO-M5-DEFINITIVO-PREPARACION', monto: 250000 }] as const) {
      if (!await tx.documento_proveedor_m5.findFirst({ where: { id_proveedor: proveedorDemo.id_proveedor, id_tipo_documento: tipoDocumento.id_tipo_documento, folio_normalizado: demo.folio } })) await tx.documento_proveedor_m5.create({ data: { id_proveedor: proveedorDemo.id_proveedor, clase: demo.clase, id_tipo_documento: tipoDocumento.id_tipo_documento, folio: demo.folio, folio_normalizado: demo.folio, fecha_emision: fechaHabil(-5), id_moneda: moneda.id_moneda, monto_total: demo.monto, descripcion: 'Escenario ficticio P4 en preparación', creado_por: usuario.usuario_id_usuario } });
    }
    const proveedorPago = await tx.proveedor.findFirstOrThrow({ where: { identificador_tributario: '76.543.213-8', estado_proveedor: 'activo' } });
    const usd = await tx.moneda.findUniqueOrThrow({ where: { codigo_moneda: 'USD' } });
    const medios = await tx.medio_pago.findMany({ where: { estado_medio_pago: 'activo' }, orderBy: { id_medio_pago: 'asc' }, take: 2 });
    const asegurarObligacion = async (folio: string, monto: number, idMoneda: number) => {
      let documento = await tx.documento_proveedor_m5.findFirst({ where: { id_proveedor: proveedorPago.id_proveedor, folio_normalizado: folio } });
      if (!documento) documento = await tx.documento_proveedor_m5.create({ data: { id_proveedor: proveedorPago.id_proveedor, clase: 'definitivo', id_tipo_documento: tipoDocumento.id_tipo_documento, folio, folio_normalizado: folio, fecha_emision: fechaHabil(-4), fecha_vencimiento: fechaHabil(15), id_moneda: idMoneda, monto_total: monto, estado: 'confirmado', respaldo: 'demostracion://documento-p6', descripcion: 'Escenario ficticio P6', creado_por: usuario.usuario_id_usuario, confirmado_por: usuario.usuario_id_usuario, fecha_confirmacion: new Date() } });
      let obligacion = await tx.obligacion_proveedor_m5.findUnique({ where: { id_documento_m5: documento.id_documento_m5 } });
      if (!obligacion) obligacion = await tx.obligacion_proveedor_m5.create({ data: { id_documento_m5: documento.id_documento_m5, id_proveedor: proveedorPago.id_proveedor, monto_original: monto, id_moneda: idMoneda, saldo_inicial: monto, saldo_actual: monto, fecha_emision: documento.fecha_emision, fecha_vencimiento: documento.fecha_vencimiento!, estado_pago: 'Pendiente', condicion_temporal: 'Por pagar', generado_por: usuario.usuario_id_usuario } });
      return obligacion;
    };
    const [obligacionClp1, obligacionClp2, obligacionUsd] = await Promise.all([asegurarObligacion('DEMO-M5-P6-CLP-1', 180000, moneda.id_moneda), asegurarObligacion('DEMO-M5-P6-CLP-2', 90000, moneda.id_moneda), asegurarObligacion('DEMO-M5-P6-USD', 500, usd.id_moneda)]);
    const asegurarOperacion = async (estado: 'borrador' | 'preparada', especificaciones: Array<{ obligacion: typeof obligacionClp1; monto: number; medio: number }>, conRespaldo: boolean) => {
      const marcador = especificaciones[0]; const movimientoExistente = await tx.movimiento_pago_proveedor_m5.findFirst({ where: { id_obligacion_m5: marcador.obligacion.id_obligacion_m5, monto_aplicado: marcador.monto, estado: 'borrador' } });
      let operacion = movimientoExistente ? await tx.operacion_pago_proveedor_m5.findFirst({ where: { id_operacion_pago_m5: movimientoExistente.id_operacion_pago_m5, estado } }) : null;
      if (operacion) return;
      operacion = await tx.operacion_pago_proveedor_m5.create({ data: { id_proveedor: proveedorPago.id_proveedor, estado, fecha_efectiva_pago: new Date('2026-09-20T00:00:00Z'), creado_por: usuario.usuario_id_usuario, preparado_por: estado === 'preparada' ? usuario.usuario_id_usuario : null, fecha_preparacion: estado === 'preparada' ? new Date() : null } });
      const creados = []; for (const especificacion of especificaciones) creados.push(await tx.movimiento_pago_proveedor_m5.create({ data: { id_operacion_pago_m5: operacion.id_operacion_pago_m5, id_obligacion_m5: especificacion.obligacion.id_obligacion_m5, id_medio_pago: especificacion.medio, id_moneda: especificacion.obligacion.id_moneda, monto_aplicado: especificacion.monto, equivalente_clp: especificacion.obligacion.id_moneda === moneda.id_moneda ? especificacion.monto : null } }));
      if (conRespaldo) { const respaldo = await tx.respaldo_pago_proveedor_m5.create({ data: { nombre_archivo: 'respaldo-demo-p6.pdf', contenido: 'demostracion://respaldo-p6', creado_por: usuario.usuario_id_usuario } }); await tx.asociacion_respaldo_pago_m5.createMany({ data: [{ id_respaldo_pago_m5: respaldo.id_respaldo_pago_m5, id_operacion_pago_m5: operacion.id_operacion_pago_m5 }, ...creados.map(movimiento => ({ id_respaldo_pago_m5: respaldo.id_respaldo_pago_m5, id_movimiento_pago_m5: movimiento.id_movimiento_pago_m5 }))] }); }
    };
    await asegurarOperacion('borrador', [{ obligacion: obligacionClp1, monto: 25000, medio: medioPago.id_medio_pago }], false);
    await asegurarOperacion('preparada', [{ obligacion: obligacionClp1, monto: 60000, medio: medioPago.id_medio_pago }, { obligacion: obligacionClp2, monto: 40000, medio: (medios[1] || medioPago).id_medio_pago }], true);
    await asegurarOperacion('borrador', [{ obligacion: obligacionUsd, monto: 100, medio: medioPago.id_medio_pago }], false);
    await tx.fondo_caja_chica_m5.upsert({ where: { anio_mes: { anio: 2026, mes: 9 } }, update: {}, create: { anio: 2026, mes: 9, monto: 500000, actualizado_por: usuario.usuario_id_usuario } });
    const asegurarGastoCaja = async (descripcion: string, monto: number, estado: 'pendiente' | 'aprobado' | 'rechazado', conRespaldo: boolean) => {
      let gasto = await tx.gasto_caja_chica_m5.findFirst({ where: { anio: 2026, mes: 9, descripcion } });
      if (!gasto) {
        gasto = await tx.gasto_caja_chica_m5.create({ data: { anio: 2026, mes: 9, monto, descripcion, fecha_gasto: new Date('2026-09-15T00:00:00Z'), comercio_emisor: 'Comercio demostración', estado, registrado_por: usuario.usuario_id_usuario, fecha_registro: new Date('2026-09-15T12:00:00Z'), resuelto_por: estado === 'pendiente' ? null : usuario.usuario_id_usuario, fecha_resolucion: estado === 'pendiente' ? null : new Date('2026-09-16T12:00:00Z'), condicion_aprobacion: estado === 'aprobado' ? 'normal' : null, motivo_rechazo: estado === 'rechazado' ? 'Respaldo observado en demostración' : null } });
        await tx.historial_gasto_caja_chica_m5.create({ data: { id_gasto_caja_chica_m5: gasto.id_gasto_caja_chica_m5, evento: 'registro', detalle: JSON.stringify({ origen: 'Caja Chica', demo: true }), usuario_id_usuario: usuario.usuario_id_usuario } });
      }
      if (conRespaldo && !await tx.respaldo_gasto_caja_chica_m5.count({ where: { id_gasto_caja_chica_m5: gasto.id_gasto_caja_chica_m5 } })) await tx.respaldo_gasto_caja_chica_m5.create({ data: { id_gasto_caja_chica_m5: gasto.id_gasto_caja_chica_m5, nombre_archivo: `factura-${gasto.id_gasto_caja_chica_m5}.pdf`, contenido: 'demostracion://caja-chica', tipo_respaldo: 'factura', comercio_emisor: gasto.comercio_emisor, adjuntado_por: usuario.usuario_id_usuario } });
    };
    await asegurarGastoCaja('Demo P11 pendiente con respaldo', 450000, 'pendiente', true);
    await asegurarGastoCaja('Demo P11 pendiente sin respaldo', 25000, 'pendiente', false);
    await asegurarGastoCaja('Demo P11 aprobado', 100000, 'aprobado', true);
    await asegurarGastoCaja('Demo P11 rechazado', 40000, 'rechazado', true);
  }, { timeout: 60000 });
  console.log('Seed M5 completado: proveedores, egresos, importaciones y Caja Chica para CU75-CU154.');
}

sembrar().then(sembrarM4).then(sembrarM5).catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
