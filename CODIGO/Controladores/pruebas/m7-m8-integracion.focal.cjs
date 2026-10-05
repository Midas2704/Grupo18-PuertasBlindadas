const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { M7Controller } = require('../dist/controladores/M7Controller');
const { AdaptadorCreditoM8ParaM7 } = require('../dist/servicios/AdaptadorCreditoM8ParaM7');

test('contrato M8 a M7 publica datos del owner sin recalcularlos', async () => {
  const resumen = {
    estado: 'DISPONIBLE', limiteGlobal: 18000000, exposicionUtilizada: 3461115,
    capacidadDisponible: 14538885, cupoTotalAgregado: 12300000,
    cupoUtilizadoAgregado: 3461115, cupoDisponibleAgregado: 8838885,
    totalSolicitudes: 5, totalCompromisos: 4,
    clientesSobreLimite: [{ idFicha: 2 }], clientesSuspendidos: [{ idFicha: 4 }],
    concentracion: { exposicionTotal: 3461115, clientes: [{ idFicha: 1, concentracion: 40 }] },
  };
  const alertas = { alertas: [{ idFicha: 4, tipo: 'SUSPENDIDO' }], criterio: 'M8' };
  const llamadas = [];
  const ownerM8 = {
    consultarResumenDashboardM7: async consulta => { llamadas.push(['resumen', consulta]); return resumen; },
    consultarAlertas: async consulta => { llamadas.push(['alertas', consulta]); return alertas; },
  };
  const modulo = new M7Controller(new AdaptadorCreditoM8ParaM7(ownerM8));
  const consulta = { mes: 10, anio: 2026 };
  assert.deepEqual((await modulo.consultarExposicionCreditoM7(consulta)).exposicion.valor, resumen);
  assert.deepEqual((await modulo.consultarAlertasCreditoM7(consulta)).alertas.valor, alertas);
  assert.deepEqual(llamadas, [['resumen', consulta], ['alertas', consulta]]);
});

test('error real de M8 conserva fuente no disponible sin ceros falsos', async () => {
  const caido = { consultarResumenDashboardM7: async () => { throw new Error('M8 no responde'); }, consultarAlertas: async () => { throw new Error('M8 no responde'); } };
  const modulo = new M7Controller(new AdaptadorCreditoM8ParaM7(caido));
  const exposicion = await modulo.consultarExposicionCreditoM7({});
  const alertas = await modulo.consultarAlertasCreditoM7({});
  assert.equal(exposicion.estado, 'FUENTE_NO_DISPONIBLE');
  assert.equal(exposicion.exposicion.valor, null);
  assert.equal(alertas.estado, 'FUENTE_NO_DISPONIBLE');
  assert.equal(alertas.alertas.valor, null);
});

test('M7 sólo consume el contrato y no consulta ni recalcula Crédito M8', () => {
  const m7 = readFileSync(resolve('src/controladores/M7Controller.ts'), 'utf8');
  const adaptador = readFileSync(resolve('src/servicios/AdaptadorCreditoM8ParaM7.ts'), 'utf8');
  assert.doesNotMatch(m7, /condicion_crediticia_m8|compromiso_credito_m8|limite_global_credito_m8|creditoM8\.ts/);
  assert.match(adaptador, /credito\.consultarResumenDashboardM7\(consulta\)/);
  assert.match(adaptador, /credito\.consultarAlertas\(consulta\)/);
  assert.doesNotMatch(adaptador, /Prisma|\bprisma\b|exposicionCredito|limiteCreditoVigente/);
});
