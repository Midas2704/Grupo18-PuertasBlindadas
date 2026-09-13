const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { prisma } = require('../dist/db');
const { M2Controller } = require('../dist/controladores/M2Controller');
const { M3Controller } = require('../dist/controladores/M3Controller');
const { C_BancoCentral } = require('../dist/utilidades/C_BancoCentral');
// Apolo en modo prueba: cubrimos los bordes sin depender de servicios externos

test('CU13 registra desde M2 y asocia el cliente a un borrador', async () => {
  const m2 = new M2Controller();
  const ficha = await prisma.ficha_cliente.findFirstOrThrow();
  const moneda = await prisma.moneda.findUniqueOrThrow({ where: { codigo_moneda: 'CLP' } });
  const cot = await prisma.cotizacion.create({ data: { id_ficha_cliente: ficha.id_ficha_cliente, id_moneda: moneda.id_moneda, fecha_emision: new Date(), estado_cotizacion: 'borrador' } });
  try {
    const resultado = await m2.registrarClienteDesdeCotizacion({ tipo: 'B2C', nombre: 'Prueba CU13', contacto: 'Contacto', telefono: '555-0101', confirmado: true, idCotizacion: cot.id_cotizacion });
    const actual = await prisma.cotizacion.findUniqueOrThrow({ where: { id_cotizacion: cot.id_cotizacion } });
    assert.equal(actual.id_ficha_cliente, resultado.cliente.ficha_cliente.id_ficha_cliente);
  } finally {
    const actual = await prisma.cotizacion.findUnique({ where: { id_cotizacion: cot.id_cotizacion } });
    await prisma.cotizacion.delete({ where: { id_cotizacion: cot.id_cotizacion } });
    if (actual && actual.id_ficha_cliente !== ficha.id_ficha_cliente) { const nueva = await prisma.ficha_cliente.findUnique({ where: { id_ficha_cliente: actual.id_ficha_cliente }, select: { id_cliente_financiero: true } }); if (nueva) { await prisma.ficha_cliente.delete({ where: { id_ficha_cliente: actual.id_ficha_cliente } }); await prisma.cliente_financiero.delete({ where: { id_cliente_financiero: nueva.id_cliente_financiero } }); } }
  }
});

test('CU35 modifica sólo la guía asociada y conserva la NV', async () => {
  const m2 = new M2Controller(); const nota = await prisma.nota_venta.findFirstOrThrow(); const folio = `TEST-GUIA-${randomUUID()}`;
  const guia = await prisma.guia_despacho.create({ data: { id_nota_venta: nota.id_nota_venta, folio, fecha_emision: new Date() } });
  try { const actual = await m2.modificarGuia(guia.id_guia_despacho, { folio: `${folio}-EDIT`, antecedentes: { prueba: true } }); assert.equal(actual.id_nota_venta, nota.id_nota_venta); assert.equal(actual.folio, `${folio}-EDIT`); } finally { await prisma.guia_despacho.delete({ where: { id_guia_despacho: guia.id_guia_despacho } }); }
});

test('CU41 consulta y actualiza el umbral vigente', async () => {
  const m2 = new M2Controller(); const anterior = await m2.consultarUmbral(); const valor = Number(anterior.dias_habiles || 0) + 1;
  await m2.configurarUmbral({ diasHabiles: valor }); const vigente = await m2.consultarUmbral(); assert.equal(vigente.dias_habiles, valor);
  await m2.configurarUmbral({ diasHabiles: Number(anterior.dias_habiles || 0) });
});

test('CU47 C_BancoCentral se prueba con mock sin depender de API externa', async () => {
  const adaptador = new C_BancoCentral(async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ valor: 912.34 }) }), 'https://mock');
  assert.equal(await adaptador.obtenerTipoCambio('USD', '2026-09-08'), 912.34);
  await assert.rejects(() => new C_BancoCentral(async () => ({ ok: false, status: 503, text: async () => '' }), 'https://mock').obtenerTipoCambio('USD'), /503/);
});

test('CU54 rechaza aplicar más que el saldo pendiente dentro de la transacción', async () => {
  const saldo = await prisma.saldo_favor_cliente.findFirst({ where: { monto_disponible: { gt: 0 } }, include: { nota_venta: true } });
  if (!saldo) return;
  const m3 = new M3Controller();
  await assert.rejects(() => m3.aplicarSaldoFavor(saldo.id_saldo_favor_cliente, { idNota: saldo.id_nota_venta, monto: Number(saldo.nota_venta.monto_total) + 1 }, 'prueba'), /no elegible|disponible/);
});

test('CU55 devuelve detalle de pago de sólo lectura', async () => {
  const pago = await prisma.pago_cliente.findFirst(); if (!pago) return;
  const detalle = await new M3Controller().consultarPago(pago.id_pago_cliente);
  assert.equal(detalle.id_pago_cliente, pago.id_pago_cliente); assert.ok('montoEfectivo' in detalle);
});
