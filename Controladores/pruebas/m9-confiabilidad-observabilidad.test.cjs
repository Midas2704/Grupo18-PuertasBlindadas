const { test } = require('node:test');
const assert = require('node:assert/strict');
const { M9Controller } = require('../dist/controladores/M9Controller');
const { RepositorioAuditoriaM9Memoria } = require('../dist/m9/RepositorioAuditoriaM9');
const { PendientesMemoriaM9, RelojFijoM9, RetryMemoriaM9 } = require('../dist/m9/puertos');

const evento = (id, extra = {}) => ({ identidadLogica: `confiabilidad-${id}`, versionContrato: '1.0', ocurridoEn: '2034-03-01T12:00:00Z', zonaHoraria: 'UTC', ejecutor: { tipo: 'SISTEMA', referencia: 'fixture' }, productor: 'PRODUCTOR-SINTETICO', modulo: 'SINTETICO', operacion: 'PROCESAR', resultado: 'EXITOSO', referencia: { tipo: 'OBJETO', id: `O-${id}` }, capacidad: 'EMITIR_EVENTO_M9', ...extra });

test('M9 CUT333-CUT353 confiabilidad, observabilidad y soporte de pruebas', async t => {
  await t.test('CUT333-CUT336 crítico confirma sólo tras persistencia y falla sin PII', async () => {
    const repo = new RepositorioAuditoriaM9Memoria(); repo.fallarPersistencia = true;
    const modulo = new M9Controller({ repositorio: repo });
    await assert.rejects(modulo.recibir(evento(1, { critico: true, nuevo: { correo: 'persona@invalid.test' } })), error => error.codigo === 'M9_FALLO_CRITICO');
    assert.equal(await repo.cantidad(), 0); assert.equal(modulo.senales.listar()[0].tipo, 'FALLO_CRITICO');
    assert.equal(JSON.stringify(modulo.diagnosticos.listar()).includes('persona@invalid.test'), false);
  });
  await t.test('CUT337-CUT339 no crítico pendiente conserva ocurrencia y minimiza payload', async () => {
    const repo = new RepositorioAuditoriaM9Memoria(); repo.fallarPersistencia = true;
    const pendientes = new PendientesMemoriaM9(), modulo = new M9Controller({ repositorio: repo, pendientes });
    const respuesta = await modulo.recibir(evento(2, { anterior: { saldo: 10 }, nuevo: { saldo: 5 } }));
    const item = (await pendientes.listar())[0];
    assert.equal(respuesta.estado, 'PENDIENTE'); assert.equal(item.ocurridoEn, '2034-03-01T12:00:00Z');
    assert.equal(Object.hasOwn(item, 'anterior'), false); assert.equal(Object.hasOwn(item, 'ejecutor'), false);
  });
  await t.test('CUT340-CUT341 detector abstracto usa umbral externo y emite señal', async () => {
    const reloj = new RelojFijoM9(new Date('2034-03-02T12:00:00Z')), pendientes = new PendientesMemoriaM9();
    await pendientes.guardar({ ...evento(3), creadoEn: new Date('2034-03-01T12:00:00Z'), intentos: 2 });
    const modulo = new M9Controller({ repositorio: new RepositorioAuditoriaM9Memoria(), pendientes, reloj });
    const r = await modulo.diagnosticarPendientes(1000);
    assert.equal(r.envejecidos, 1); assert.equal(modulo.senales.listar()[0].tipo, 'PENDIENTE_ENVEJECIDO');
  });
  await t.test('CUT342-CUT347 mide recibidos, persistidos, rechazos, fallos y latencias', async () => {
    const repo = new RepositorioAuditoriaM9Memoria(), modulo = new M9Controller({ repositorio: repo });
    await modulo.recibir(evento(4));
    await assert.rejects(modulo.recibir(evento(5, { versionContrato: 'X' })));
    repo.fallarPersistencia = true; await modulo.recibir(evento(6));
    const m = modulo.observabilidad.snapshot();
    assert.equal(m.recibidos, 3); assert.equal(m.persistidos, 1); assert.equal(m.rechazados, 1); assert.equal(m.fallosPersistencia, 1);
    assert.notEqual(m.latenciaMs.ingesta, null); assert.notEqual(m.latenciaMs.persistencia, null);
  });
  await t.test('CUT345-CUT349 expone pending, retry, salud por productor y capacidad sin umbral inventado', async () => {
    const retry = new RetryMemoriaM9({ exitosos: 3, fallidos: 1 }), modulo = new M9Controller({ repositorio: new RepositorioAuditoriaM9Memoria(), retry });
    await modulo.recibir(evento(7));
    const estado = await modulo.estadoObservabilidad(5000);
    assert.deepEqual(estado.retry, { exitosos: 3, fallidos: 1 }); assert.equal(estado.almacenamiento.eventos, 1);
    assert.equal(estado.metricas.productores['PRODUCTOR-SINTETICO'].persistidos, 1); assert.equal(Object.hasOwn(estado.almacenamiento, 'umbral'), false);
  });
  await t.test('CUT350 fixtures son sintéticos y no contienen credenciales reales', () => {
    const serializado = JSON.stringify(evento(8)); assert.match(serializado, /SINTETICO/); assert.doesNotMatch(serializado, /password|token|secret/i);
  });
  await t.test('CUT351 reloj inyectable controla persistencia y envejecimiento', async () => {
    const reloj = new RelojFijoM9(new Date('2040-01-01T00:00:00Z')), modulo = new M9Controller({ repositorio: new RepositorioAuditoriaM9Memoria(), reloj });
    const creado = (await modulo.recibir(evento(9))).evento; assert.equal(creado.fechaPersistencia.toISOString(), '2040-01-01T00:00:00.000Z');
  });
  await t.test('CUT352 diagnósticos son inspeccionables sin editar evidencia', async () => {
    const repo = new RepositorioAuditoriaM9Memoria(), modulo = new M9Controller({ repositorio: repo });
    await assert.rejects(modulo.recibir(evento(10, { capacidad: undefined })));
    assert.equal(modulo.diagnosticos.listar().length, 1); assert.equal(await repo.cantidad(), 0);
  });
  await t.test('CUT353 configuración variable se inyecta sin editar lógica', async () => {
    const configuracion = { versionesSoportadas: ['2.0'], metadatosPermitidos: ['traceId'], maximoPagina: 7, maximoTexto: 120 };
    const modulo = new M9Controller({ repositorio: new RepositorioAuditoriaM9Memoria(), configuracion });
    const creado = await modulo.recibir(evento(11, { versionContrato: '2.0', metadatos: { traceId: 'T', requestId: 'descartar' } }));
    assert.deepEqual(creado.evento.metadatos, { traceId: 'T' });
    await assert.rejects(modulo.consultar({ tamano: 8 }, { solicitante: 'test' }), error => error.codigo === 'M9_FILTRO_INVALIDO');
  });
  await t.test('el core previo conserva límites y CUT446 permanece fuera', () => {
    const modulo = new M9Controller();
    assert.equal(typeof modulo.asignarPermiso, 'undefined'); assert.equal(typeof modulo.ejecutarPoliticaLegal, 'undefined'); assert.equal(typeof modulo.CUT446, 'undefined');
  });
});
