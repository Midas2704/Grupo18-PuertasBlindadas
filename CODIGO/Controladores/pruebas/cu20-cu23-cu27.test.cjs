const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { prisma } = require('../dist/db');
const { M2Controller } = require('../dist/controladores/M2Controller');

const m2 = new M2Controller();
const fechaFutura = '2099-12-31';

function rutDePrueba() {
  const cuerpo = String(20000000 + Math.floor(Math.random() * 5000000));
  let suma = 0; let multiplicador = 2;
  for (let indice = cuerpo.length - 1; indice >= 0; indice--) { suma += Number(cuerpo[indice]) * multiplicador; multiplicador = multiplicador === 7 ? 2 : multiplicador + 1; }
  const resultado = 11 - suma % 11;
  return `${cuerpo}-${resultado === 11 ? '0' : resultado === 10 ? 'K' : resultado}`;
}

test('CU20: un borrador incompleto se recupera, completa y vuelve a guardar', async () => {
  const cliente = await prisma.cliente_financiero.findFirstOrThrow({ where: { estado_financiero: 'activo' }, include: { ficha_cliente: true } });
  const moneda = await prisma.moneda.findFirstOrThrow({ where: { codigo_moneda: 'CLP', estado_moneda: 'activo' } });
  const item = await prisma.item_comercial.findFirstOrThrow({ where: { estado_item: 'activo' } });
  const costo = await prisma.historial_precio_material.findFirstOrThrow({ where: { id_moneda: moneda.id_moneda, estado_precio: 'vigente' } });
  const creada = await prisma.cotizacion.create({ data: { id_ficha_cliente: cliente.ficha_cliente.id_ficha_cliente, id_moneda: moneda.id_moneda, fecha_emision: new Date(), fecha_vigencia: new Date(`${fechaFutura}T00:00:00Z`), estado_cotizacion: 'borrador', exento_iva: true } });

  try {
    const abierta = (await m2.consultarBandeja()).cotizaciones.find(cotizacion => cotizacion.id_cotizacion === creada.id_cotizacion);
    assert.equal(abierta.detalle_cotizacion.length, 0);

    await m2.editarCotizacion(creada.id_cotizacion, { id_ficha_cliente: cliente.ficha_cliente.id_ficha_cliente, id_moneda: moneda.id_moneda, fecha_vigencia: fechaFutura, margen_esperado: 25, exento_iva: true, productos: [{ id_item_comercial: item.id_item_comercial, cantidad: 2, medidas: '210x90x5', observaciones: 'Primera versión', materiales: [{ id_historial_precio_material: costo.id_historial_precio_material, cantidad: 1 }] }] });
    const guardada = await m2.editarCotizacion(creada.id_cotizacion, { id_ficha_cliente: cliente.ficha_cliente.id_ficha_cliente, id_moneda: moneda.id_moneda, fecha_vigencia: fechaFutura, margen_esperado: 25, exento_iva: true, productos: [{ id_item_comercial: item.id_item_comercial, cantidad: 3, medidas: '215x95x6', observaciones: 'Medidas completadas', materiales: [{ id_historial_precio_material: costo.id_historial_precio_material, cantidad: 2 }] }] });

    assert.equal(guardada.estado_cotizacion, 'borrador');
    assert.equal(guardada.detalle_cotizacion[0].cantidad_item.toNumber(), 3);
    assert.equal(guardada.detalle_cotizacion[0].medida_alto_referencial.toNumber(), 215);
    assert.equal(guardada.detalle_cotizacion[0].detalle_costo_material_cotizacion[0].cantidad_material_estimada.toNumber(), 2);

    await prisma.cotizacion.update({ where: { id_cotizacion: creada.id_cotizacion }, data: { estado_cotizacion: 'emitida' } });
    await assert.rejects(m2.editarCotizacion(creada.id_cotizacion, { margen_esperado: 25, productos: [] }), /Sólo se puede editar un Borrador/);
  } finally {
    await prisma.detalle_costo_material_cotizacion.deleteMany({ where: { detalle_cotizacion: { id_cotizacion: creada.id_cotizacion } } });
    await prisma.detalle_cotizacion.deleteMany({ where: { id_cotizacion: creada.id_cotizacion } });
    await prisma.cotizacion.delete({ where: { id_cotizacion: creada.id_cotizacion } });
  }
});

test('CU23: formaliza desde la cotización, conserva la asociación y rechaza RUT duplicado', async () => {
  const base = await prisma.cliente_financiero.findFirstOrThrow({ where: { estado_financiero: 'activo' }, include: { ficha_cliente: true } });
  const moneda = await prisma.moneda.findFirstOrThrow({ where: { codigo_moneda: 'CLP', estado_moneda: 'activo' } });
  const cotizacion = await prisma.cotizacion.create({ data: { id_ficha_cliente: base.ficha_cliente.id_ficha_cliente, id_moneda: moneda.id_moneda, fecha_emision: new Date(), fecha_vigencia: new Date(`${fechaFutura}T00:00:00Z`), estado_cotizacion: 'borrador' } });
  let primero; let segundo; let rutFormateado;

  try {
    primero = (await m2.registrarClienteDesdeCotizacion({ tipo: 'B2C', nombre: 'Cliente provisional CU23', telefono: '+56911111111', confirmado: true, idCotizacion: cotizacion.id_cotizacion })).cliente;
    const rut = rutDePrueba();
    const formalizado = await m2.formalizarClienteB2C({ idCliente: primero.id_cliente_financiero, idCotizacion: cotizacion.id_cotizacion, rut, nombre: 'Cliente formal CU23', telefono: '+56922222222' });
    rutFormateado = formalizado.cliente.rut_cliente;
    assert.equal(formalizado.cliente.nivel_formalizacion, 'formal');
    assert.equal((await prisma.cotizacion.findUniqueOrThrow({ where: { id_cotizacion: cotizacion.id_cotizacion } })).id_ficha_cliente, primero.ficha_cliente.id_ficha_cliente);

    segundo = (await m2.registrarClienteDesdeCotizacion({ tipo: 'B2C', nombre: 'Otro provisional CU23', telefono: '+56933333333', confirmado: true })).cliente;
    await assert.rejects(m2.formalizarClienteB2C({ idCliente: segundo.id_cliente_financiero, rut, nombre: 'Duplicado', telefono: '+56944444444' }), /RUT ya está asociado/);
  } finally {
    await prisma.cotizacion.delete({ where: { id_cotizacion: cotizacion.id_cotizacion } });
    for (const cliente of [segundo, primero].filter(Boolean)) {
      await prisma.ficha_cliente.deleteMany({ where: { id_cliente_financiero: cliente.id_cliente_financiero } });
      await prisma.cliente_financiero.deleteMany({ where: { id_cliente_financiero: cliente.id_cliente_financiero } });
    }
    if (rutFormateado) await prisma.cliente.deleteMany({ where: { cliente_cliente_rut: rutFormateado } });
  }
});

test('CU27: crea NV directa con varias líneas y referencias válidas; rechaza proyecto inactivo', async () => {
  const cliente = await prisma.cliente_financiero.findFirstOrThrow({ where: { estado_financiero: 'activo', nivel_formalizacion: 'formal' }, include: { ficha_cliente: true } });
  const item = await prisma.item_comercial.findFirstOrThrow({ where: { estado_item: 'activo' } });
  const activo = await prisma.proyecto.create({ data: { proyecto_codigo_proyecto: `CU27-A-${randomUUID()}`, proyecto_nombre_referencia: 'Proyecto activo CU27', proyecto_estado_operacional: 'Activo' } });
  const inactivo = await prisma.proyecto.create({ data: { proyecto_codigo_proyecto: `CU27-I-${randomUUID()}`, proyecto_nombre_referencia: 'Proyecto inactivo CU27', proyecto_estado_operacional: 'Cerrado' } });
  let nota;

  try {
    nota = await m2.crearVentaDirecta({ id_cliente: cliente.ficha_cliente.id_ficha_cliente, monto_neto: 350, moneda: 'CLP', exento_iva: true, detalle: [{ tipo: 'producto', descripcion: 'Puerta', cantidad: 2, valor: 100, idItemComercial: item.id_item_comercial, idProyecto: Number(activo.proyecto_proyecto_id) }, { tipo: 'trabajo posterior', descripcion: 'Ajuste en terreno', cantidad: 1, valor: 150, idProyecto: Number(activo.proyecto_proyecto_id) }] });
    assert.equal(nota.id_proyecto_contexto, activo.proyecto_proyecto_id);
    assert.equal(JSON.parse(nota.observacion).detalleComercial.length, 2);

    await assert.rejects(m2.crearVentaDirecta({ id_cliente: cliente.ficha_cliente.id_ficha_cliente, monto_neto: 100, moneda: 'CLP', exento_iva: true, detalle: [{ tipo: 'servicio', descripcion: 'Visita', cantidad: 1, valor: 100, idProyecto: Number(inactivo.proyecto_proyecto_id) }] }), /proyecto seleccionado no existe o no está activo/);
  } finally {
    if (nota) await prisma.nota_venta.delete({ where: { id_nota_venta: nota.id_nota_venta } });
    await prisma.proyecto.deleteMany({ where: { proyecto_proyecto_id: { in: [activo.proyecto_proyecto_id, inactivo.proyecto_proyecto_id] } } });
  }
});
