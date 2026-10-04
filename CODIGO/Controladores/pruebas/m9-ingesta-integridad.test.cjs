const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { prisma } = require('../dist/db');
const { M9Controller } = require('../dist/controladores/M9Controller');
const { RepositorioAuditoriaM9Memoria, RepositorioAuditoriaM9Prisma } = require('../dist/m9/RepositorioAuditoriaM9');
const { RelojFijoM9 } = require('../dist/m9/puertos');

const reloj = new RelojFijoM9(new Date('2032-05-02T13:00:00Z'));
const entrada = (cambios = {}) => { const marca = randomUUID(); return ({
  identidadLogica: `fixture-m9-${marca}`, versionContrato: '1.0', ocurridoEn: '2032-05-02T08:00:00-04:00', zonaHoraria: 'America/Santiago',
  ejecutor: { tipo: 'SISTEMA', referencia: 'fixture-sintetico' }, productor: 'FIXTURE', modulo: 'SINTETICO', operacion: 'ACTUALIZAR', resultado: 'exito',
  referencia: { tipo: 'REGISTRO', id: `SYN-${marca}` }, secuencia: 1, anterior: { estado: 'A', igual: 7 }, nuevo: { estado: 'B', igual: 7 },
  capacidad: 'EMITIR_EVENTO_M9', ...cambios,
}); };

test('M9 CUT275-CUT302 ingesta, validación e integridad', async t => {
  await t.test('CUT275-CUT281 valida contrato, núcleo, condicionales y resultado normalizado', async () => {
    const modulo = new M9Controller({ repositorio: new RepositorioAuditoriaM9Memoria(), reloj });
    const creado = await modulo.recibir(entrada());
    assert.equal(creado.estado, 'PERSISTIDO'); assert.equal(creado.evento.resultado, 'EXITOSO');
    await assert.rejects(modulo.recibir(entrada({ versionContrato: '9.9' })), error => error.codigo === 'M9_VERSION_INVALIDA');
    await assert.rejects(modulo.recibir(entrada({ productor: '' })), error => error.codigo === 'M9_EVENTO_INVALIDO');
    await assert.rejects(modulo.recibir(entrada({ motivoRequerido: true })), error => error.codigo === 'M9_MOTIVO_REQUERIDO');
    await assert.rejects(modulo.recibir(entrada({ resultado: 'DESCONOCIDO' })), error => error.codigo === 'M9_RESULTADO_INVALIDO');
  });
  await t.test('CUT279 conserva sólo campos realmente cambiados', async () => {
    const modulo = new M9Controller({ repositorio: new RepositorioAuditoriaM9Memoria(), reloj });
    const { evento } = await modulo.recibir(entrada());
    assert.deepEqual(evento.anterior, { estado: 'A' }); assert.deepEqual(evento.nuevo, { estado: 'B' });
  });
  await t.test('CUT282-CUT284 sanitiza, minimiza y rechaza secretos antes de evidencia o diagnóstico sensible', async () => {
    const repo = new RepositorioAuditoriaM9Memoria(), modulo = new M9Controller({ repositorio: repo, reloj });
    await assert.rejects(modulo.recibir(entrada({ nuevo: { estado: 'B', password_hash: 'nunca-persistir' } })), error => error.codigo === 'M9_DATO_PROHIBIDO');
    assert.equal(await repo.cantidad(), 0); assert.equal(JSON.stringify(modulo.diagnosticos.listar()).includes('nunca-persistir'), false);
    const { evento } = await modulo.recibir(entrada({ metadatos: { requestId: 'REQ-1', campoFuncional: 'descartar' } }));
    assert.deepEqual(evento.metadatos, { requestId: 'REQ-1' });
  });
  await t.test('CUT285 exige timestamp y timezone coherentes', async () => {
    const modulo = new M9Controller({ repositorio: new RepositorioAuditoriaM9Memoria(), reloj });
    await assert.rejects(modulo.recibir(entrada({ ocurridoEn: '2032-05-02T12:00:00', zonaHoraria: 'UTC' })), error => error.codigo === 'M9_TIMESTAMP_INVALIDO');
    await assert.rejects(modulo.recibir(entrada({ ocurridoEn: '2032-05-02T12:00:00-04:00', zonaHoraria: 'UTC' })), error => error.codigo === 'M9_TIMEZONE_INCOHERENTE');
  });
  await t.test('CUT286/CUT298 retry conserva identidad y duplicado conflictivo se rechaza', async () => {
    const modulo = new M9Controller({ repositorio: new RepositorioAuditoriaM9Memoria(), reloj }), original = entrada();
    const uno = await modulo.recibir(original), dos = await modulo.recibir(original);
    assert.equal(dos.reintento, true); assert.equal(dos.evento.id, uno.evento.id);
    await assert.rejects(modulo.recibir({ ...original, resultado: 'FALLIDO' }), error => error.codigo === 'M9_DUPLICADO_CONFLICTIVO');
  });
  await t.test('CUT287 detecta fuera de orden sin romper silenciosamente', async () => {
    const modulo = new M9Controller({ repositorio: new RepositorioAuditoriaM9Memoria(), reloj });
    const referencia = { tipo: 'REGISTRO', id: 'SYN-ORDEN' };
    await modulo.recibir(entrada({ secuencia: 2, referencia }));
    await assert.rejects(modulo.recibir(entrada({ secuencia: 1, referencia })), error => error.codigo === 'M9_EVENTO_FUERA_DE_ORDEN');
  });
  await t.test('CUT288-CUT293 no inventa metadatos, invalidez no persiste y exige capacidad técnica', async () => {
    const repo = new RepositorioAuditoriaM9Memoria(), modulo = new M9Controller({ repositorio: repo, reloj });
    await assert.rejects(modulo.recibir(entrada({ capacidad: undefined })), error => error.codigo === 'M9_MINIMO_PRIVILEGIO');
    assert.equal(await repo.cantidad(), 0);
    const { evento } = await modulo.recibir(entrada({ anterior: undefined, nuevo: undefined }));
    assert.equal(evento.anterior, null); assert.equal(evento.nuevo, null); assert.equal(evento.fechaPersistencia.toISOString(), reloj.ahora().toISOString());
  });
  await t.test('CUT294-CUT297 origen, derivado y correctivo son nuevos eventos vinculados', async () => {
    const repo = new RepositorioAuditoriaM9Memoria(), modulo = new M9Controller({ repositorio: repo, reloj });
    const original = (await modulo.recibir(entrada())).evento;
    const derivado = (await modulo.recibir(entrada({ secuencia: 2, eventoOrigenId: original.id }))).evento;
    const correctivo = (await modulo.recibir(entrada({ secuencia: 3, eventoCorrectivoId: original.id, motivo: 'Corrección sintética' }))).evento;
    assert.equal(derivado.eventoOrigenId, original.id); assert.equal(correctivo.eventoCorrectivoId, original.id);
    assert.equal((await repo.porId(original.id)).resultado, 'EXITOSO');
    await assert.rejects(modulo.recibir(entrada({ eventoOrigenId: 99999 })), error => error.codigo === 'M9_REFERENCIA_INVALIDA');
  });
  await t.test('CUT299 verifica hash al recuperar evidencia', async () => {
    const repo = new RepositorioAuditoriaM9Memoria(), modulo = new M9Controller({ repositorio: repo, reloj });
    const creado = (await modulo.recibir(entrada())).evento;
    (await repo.porId(creado.id)).operacion = 'ALTERADA';
    await assert.rejects(modulo.detalle(creado.id, { solicitante: 'tester', modulos: ['SINTETICO'] }), error => error.codigo === 'M9_INTEGRIDAD_INVALIDA');
  });
  await t.test('CUT290-CUT292 persiste durable, separa fechas y trigger impide mutación', async () => {
    const modulo = new M9Controller({ repositorio: new RepositorioAuditoriaM9Prisma(), reloj });
    const creado = (await modulo.recibir(entrada())).evento;
    assert.notEqual(creado.fechaOcurrencia.toISOString(), creado.fechaPersistencia.toISOString());
    await assert.rejects(prisma.evento_auditoria_m9.update({ where: { id_evento_m9: creado.id }, data: { operacion: 'MUTADA' } }), /inmutable/i);
    assert.equal((await prisma.evento_auditoria_m9.findUnique({ where: { id_evento_m9: creado.id } })).operacion, 'ACTUALIZAR');
  });
  await t.test('CUT300-CUT302 mantiene mínimo privilegio y diagnóstico separado sin payload', async () => {
    const modulo = new M9Controller({ repositorio: new RepositorioAuditoriaM9Memoria(), reloj });
    await assert.rejects(modulo.recibir(entrada({ nuevo: { api_token: 'prohibido' } })), error => error.estado === 400);
    const diagnostico = modulo.diagnosticos.listar().at(-1);
    assert.equal(diagnostico.codigo, 'M9_DATO_PROHIBIDO'); assert.equal(Object.hasOwn(diagnostico, 'payload'), false);
  });
});
