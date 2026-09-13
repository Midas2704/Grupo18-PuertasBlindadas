const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Prisma } = require('@prisma/client');
const { prepararPago } = require('../dist/utilidades/pago');
const { calcularNota } = require('../dist/utilidades/finanzas');

const notaBase = (vencimiento) => ({
  estado_nota_venta: 'emitida',
  monto_total: new Prisma.Decimal(100),
  fecha_vencimiento: vencimiento ? new Date(`${vencimiento}T00:00:00Z`) : null,
  moneda: { codigo_moneda: 'CLP' },
  reversion_nota_venta: [], asignacion_pago_cliente: [], aplicacion_saldo_favor: [],
});

test('CU56: la mora comienza al día siguiente de la fecha final', () => {
  const hoy = calcularNota(notaBase('2026-09-10'), '2026-09-10');
  const mañana = calcularNota(notaBase('2026-09-10'), '2026-09-11');
  assert.equal(hoy.esMorosa, false);
  assert.equal(mañana.esMorosa, true);
  assert.equal(calcularNota(notaBase('2026-09-10'), '2026-09-12').esMorosa, true);
});

test('CU45: un medio no efectivo necesita antecedente y crédito necesita cuotas', () => {
  const nota = notaBase(null);
  const catalogo = { medios: [{ id_medio_pago: 1, nombre_medio_pago: 'Transferencia' }], categorias: [{ id_categoria_pago: 1, nombre: 'Anticipo' }], cuotas: [] };
  assert.throws(() => prepararPago(nota, { monto: 10, idMedio: 1, respaldo: 'ok' }, catalogo, 1, 'test'), /antecedente/);
  assert.equal(prepararPago(nota, { monto: 10, idMedio: 1, respaldo: 'ok', antecedentesMedio: 'TRX-1' }, catalogo, 1, 'test').antecedentes_medio, 'TRX-1');
});

test('CU13: el cliente B2C provisional exige teléfono antes de persistir', async () => {
  const { M2Controller } = require('../dist/controladores/M2Controller');
  await assert.rejects(new M2Controller().registrarClienteDesdeCotizacion({ tipo: 'B2C', nombre: 'Sin teléfono', confirmado: true }), /teléfono/);
});

test('CU58: una conciliación nunca acepta monto cero', async () => {
  const { M3Controller } = require('../dist/controladores/M3Controller');
  await assert.rejects(new M3Controller().conciliarPago(1, { monto: 0, evidencia: 'x' }, 'test'), /positivo/);
});
