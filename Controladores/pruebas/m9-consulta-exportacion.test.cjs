const { test } = require('node:test');
const assert = require('node:assert/strict');
const { M9Controller } = require('../dist/controladores/M9Controller');
const { RepositorioAuditoriaM9Memoria } = require('../dist/m9/RepositorioAuditoriaM9');
const { RelojFijoM9 } = require('../dist/m9/puertos');

const reloj = new RelojFijoM9(new Date('2033-01-10T12:00:00Z'));
const base = (id, extra = {}) => ({ identidadLogica: `consulta-${id}`, versionContrato: '1.0', ocurridoEn: `2033-01-0${id}T12:00:00Z`, zonaHoraria: 'UTC', ejecutor: { tipo: id % 2 ? 'HUMANO' : 'SISTEMA', referencia: `actor-${id}` }, productor: 'FIXTURE', modulo: id === 3 ? 'OTRO' : 'VENTAS', operacion: id === 2 ? 'RECHAZAR' : 'CREAR', resultado: id === 2 ? 'RECHAZADO' : 'EXITOSO', referencia: { tipo: 'CLIENTE', id: `C-${id}` }, anterior: { correo: `antes-${id}@invalid.test` }, nuevo: { correo: `despues-${id}@invalid.test` }, motivo: `motivo-${id}`, capacidad: 'EMITIR_EVENTO_M9', ...extra });
const scope = { solicitante: 'auditor-sintetico', modulos: ['VENTAS'], permitirCambios: true, permitirMotivos: true, camposOcultos: ['correo'] };

test('M9 CUT303-CUT332 consulta, exportación y no recursividad', async t => {
  const repo = new RepositorioAuditoriaM9Memoria(), modulo = new M9Controller({ repositorio: repo, reloj });
  const e1 = (await modulo.recibir(base(1))).evento, e2 = (await modulo.recibir(base(2))).evento;
  await modulo.recibir(base(3));
  const derivado = (await modulo.recibir(base(4, { identidadLogica: 'consulta-4', ocurridoEn: '2033-01-04T12:00:00Z', eventoOrigenId: e1.id, modulo: 'VENTAS' }))).evento;
  await modulo.recibir(base(5, { identidadLogica: 'consulta-5', ocurridoEn: '2033-01-05T12:00:00Z', eventoCorrectivoId: e1.id, modulo: 'VENTAS' }));

  await t.test('CUT303-CUT306 filtra, busca, ordena y pagina sin salir del scope', async () => {
    const r = await modulo.consultar({ resultado: 'RECHAZADO', pagina: 1, tamano: 1, orden: 'asc' }, scope);
    assert.equal(r.total, 1); assert.equal(r.eventos[0].id, e2.id);
    const b = await modulo.consultar({ buscar: 'C-1' }, scope); assert.equal(b.eventos.some(e => e.id === e1.id), true);
    await assert.rejects(modulo.consultar({ modulo: 'OTRO' }, scope), error => error.codigo === 'M9_SCOPE_DENEGADO');
  });
  await t.test('CUT307 distingue ocurrencia y persistencia', async () => {
    const r = await modulo.detalle(e1.id, scope); assert.notEqual(r.evento.ocurrencia, r.evento.persistencia);
  });
  await t.test('CUT308-CUT309 reconstruye cadenas y correctivos cronológicos', async () => {
    const r = await modulo.detalle(e1.id, scope);
    assert.equal(r.cadena.some(e => e.id === derivado.id), true); assert.equal(r.correctivos.length, 1);
  });
  await t.test('CUT310-CUT311 policy oculta cambios, motivo y causa', async () => {
    const r = await modulo.detalle(e1.id, { ...scope, permitirCambios: false, permitirMotivos: false });
    assert.equal(r.evento.cambios, null); assert.equal(r.evento.motivo, null); assert.equal(r.evento.causa, null);
  });
  await t.test('CUT312 distingue HUMANO/SISTEMA sin actor artificial', async () => {
    assert.equal((await modulo.detalle(e1.id, scope)).evento.ejecutor.tipo, 'HUMANO');
    assert.equal((await modulo.detalle(e2.id, scope)).evento.ejecutor.tipo, 'SISTEMA');
  });
  await t.test('CUT313-CUT314 privacidad y masking no reexponen información', async () => {
    const privado = (await modulo.recibir(base(6, { identidadLogica: 'consulta-privada', ocurridoEn: '2033-01-06T12:00:00Z', modulo: 'VENTAS', eventoPrivacidad: true }))).evento;
    const r = await modulo.detalle(privado.id, scope);
    assert.equal(r.evento.eventoPrivacidad, true); assert.equal(r.evento.cambios, null); assert.equal(r.evento.ejecutor.referencia, '***');
    const visible = await modulo.detalle(e1.id, scope); assert.equal(visible.evento.cambios.anterior.correo, '***');
  });
  await t.test('CUT315-CUT316 consulta y detalle generan una sola evidencia terminal cada uno', async () => {
    const antes = await repo.cantidad(); await modulo.consultar({ identidadLogica: e1.identidadLogica }, scope); assert.equal(await repo.cantidad(), antes + 1);
    const previo = await repo.cantidad(); await modulo.detalle(e1.id, scope); assert.equal(await repo.cantidad(), previo + 1);
  });
  await t.test('CUT317-CUT323 CSV/PDF congelan scope, no guardan dataset y registran terminal', async () => {
    const antes = await repo.cantidad();
    const csv = await modulo.exportar('CSV', { operacion: 'RECHAZAR' }, scope);
    assert.equal(csv.total, 1); assert.match(csv.contenido, /^data:text\/csv;base64,/); assert.equal(await repo.cantidad(), antes + 1);
    const pdf = await modulo.exportar('PDF', { identidadLogica: e1.identidadLogica }, scope);
    assert.equal(pdf.total, 1); assert.match(pdf.contenido, /^data:application\/pdf;base64,/);
    assert.equal(JSON.stringify(await repo.listar({}, ['M9'])).includes('antes-1@invalid.test'), false);
  });
  await t.test('CUT320-CUT324 metadatos mínimos y rechazo no copia conjunto exportable', async () => {
    await assert.rejects(modulo.exportar('CSV', { modulo: 'OTRO' }, scope), error => error.codigo === 'M9_SCOPE_DENEGADO');
    assert.equal(JSON.stringify(modulo.diagnosticos.listar()).includes('despues-1@invalid.test'), false);
  });
  await t.test('CUT325-CUT332 contexto terminal corta ciclos y retry no crea cascadas', async () => {
    const antes = await repo.cantidad(); await modulo.consultar({ identidadLogica: e1.identidadLogica }, scope);
    const despues = await repo.cantidad(); assert.equal(despues, antes + 1);
    const terminales = (await repo.listar({ modulo: 'M9' })).eventos.filter(e => e.contextoTerminal);
    assert.ok(terminales.length > 0); assert.equal(terminales.some(e => e.eventoOrigenId || e.eventoCorrectivoId), false);
  });
});
