const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { prisma } = require('../dist/db');
const { M6Controller } = require('../dist/controladores/M6Controller');
const { codigosTodosLosCU, matrizPermisosPorCU, operacionesPermiso, permiteOperacion } = require('../dist/validaciones/permisos');

test('M6 T10 CU196-CU197 consulta y prepara boletas sin implementar tributación', async t => {
  const modulo = new M6Controller();
  const marca = randomUUID().slice(0, 8).toUpperCase();
  const ids = { usuarios: [], medios: [], prestadores: [], boletas: [], pagos: [], reversiones: [] };
  const usuario = await prisma.usuario.create({ data: { usuario_username: `m6t10_${marca}` } }); ids.usuarios.push(usuario.usuario_id_usuario);
  const medio = await prisma.medio_pago.create({ data: { nombre_medio_pago: `M6 T10 ${marca}`, codigo_medio_pago: `M6T10${marca}`, estado_medio_pago: 'activo', requiere_respaldo: false } }); ids.medios.push(medio.id_medio_pago);
  const prestador = await prisma.prestador_honorarios.create({ data: { identificador: `PREST-${marca}`, nombre_razon_social: `Prestador ${marca}`, contacto: 'prestador@test.cl' } }); ids.prestadores.push(prestador.id_prestador_honorarios);
  const pendiente = await prisma.boleta_honorarios.create({ data: { id_prestador: prestador.id_prestador_honorarios, folio: `P-${marca}`, fecha_emision: new Date('2099-06-01'), bruto: 1000, modalidad_tributaria: 'MODALIDAD_FIXTURE_PENDIENTE', estado_documental: 'PENDIENTE_CONFIRMACION' } }); ids.boletas.push(pendiente.id_boleta_honorarios);
  const confirmada = await prisma.boleta_honorarios.create({ data: { id_prestador: prestador.id_prestador_honorarios, folio: `C-${marca}`, fecha_emision: new Date('2099-06-02'), bruto: 1000, modalidad_tributaria: 'MODALIDAD_FIXTURE_CONFIRMADA', tasa_aplicada: 10, retencion: 100, liquido: 900, estado_documental: 'CONFIRMADA' } }); ids.boletas.push(confirmada.id_boleta_honorarios);
  const pago = await prisma.pago_remuneracion.create({ data: { origen_tipo: 'BOLETA_HONORARIOS', origen_id: confirmada.id_boleta_honorarios, monto: 900, id_medio_pago: medio.id_medio_pago, estado: 'CONFIRMADO', clave_idempotencia: `t10-${marca}`, creado_por: usuario.usuario_id_usuario, confirmado_por: usuario.usuario_id_usuario, confirmado_en: new Date() } }); ids.pagos.push(pago.id_pago_remuneracion);
  const reversion = await prisma.reversion_pago_remuneracion.create({ data: { id_pago_remuneracion: pago.id_pago_remuneracion, monto: 100, motivo: 'Fixture condición económica', registrado_por: usuario.usuario_id_usuario } }); ids.reversiones.push(reversion.id_reversion_pago_remuneracion);
  try {
    await t.test('CU196 lista pendientes y confirmadas sin romper campos tributarios NULL', async () => {
      const lista = await modulo.listarBoletasHonorarios({ busqueda: marca });
      assert.equal(lista.length, 2);
      const borrador = lista.find(item => item.id === pendiente.id_boleta_honorarios);
      assert.equal(borrador.estadoDocumental, 'PENDIENTE_CONFIRMACION');
      assert.equal(borrador.tasaAplicada, null); assert.equal(borrador.retencion, null); assert.equal(borrador.liquido, null);
      assert.equal(borrador.economia.condicion, 'PENDIENTE_TRIBUTARIA'); assert.equal(borrador.economia.saldoPendiente, null);
      assert.equal((await modulo.listarBoletasHonorarios({ estado: 'CONFIRMADA', idPrestador: prestador.id_prestador_honorarios })).length, 1);
    });
    await t.test('CU196 detalle presenta prestador y deriva pago/reversión', async () => {
      const detalle = await modulo.obtenerBoletaHonorarios(confirmada.id_boleta_honorarios);
      assert.equal(detalle.prestador.identificador, prestador.identificador);
      assert.equal(detalle.bruto, 1000); assert.equal(detalle.liquido, 900);
      assert.equal(detalle.economia.montoEfectivo, 800); assert.equal(detalle.economia.saldoPendiente, 100); assert.equal(detalle.economia.condicion, 'PAGO_PARCIAL');
    });
    await t.test('CU197 crea PENDIENTE_CONFIRMACION sin calcular ni asignar modalidad por defecto', async () => {
      await assert.rejects(modulo.crearBoletaHonorarios({ idPrestador: prestador.id_prestador_honorarios, folio: `SIN-M-${marca}`, fechaEmision: '2099-06-03', bruto: 500 }), error => error.estado === 400);
      const creada = await modulo.crearBoletaHonorarios({ idPrestador: prestador.id_prestador_honorarios, folio: `N-${marca}`, fechaEmision: '2099-06-03', bruto: 500, modalidadTributaria: 'MODALIDAD_DECLARADA_FIXTURE', respaldo: 'fixture://boleta', referencia: 'REF-T10' });
      ids.boletas.push(creada.id);
      assert.equal(creada.estadoDocumental, 'PENDIENTE_CONFIRMACION'); assert.equal(creada.modalidadTributaria, 'MODALIDAD_DECLARADA_FIXTURE');
      assert.equal(creada.tasaAplicada, null); assert.equal(creada.retencion, null); assert.equal(creada.liquido, null);
    });
    await t.test('CU197 crea prestador mínimo, valida duplicidad/campos/estado y lo usa inmediatamente', async () => {
      await assert.rejects(modulo.crearPrestadorHonorarios({ identificador: '', nombreRazonSocial: '' }), error => error.estado === 400);
      await assert.rejects(modulo.crearPrestadorHonorarios({ identificador: `NUEVO-${marca}`, nombreRazonSocial: 'Prestador inválido', estado: 'PENDIENTE' }), error => error.estado === 400);
      const nuevo = await modulo.crearPrestadorHonorarios({ identificador: `NUEVO-${marca}`, nombreRazonSocial: `Nuevo prestador ${marca}`, contacto: 'nuevo@test.cl' });
      ids.prestadores.push(nuevo.id); assert.equal(nuevo.estado, 'ACTIVO'); assert.equal(nuevo.identificador, `NUEVO-${marca}`);
      await assert.rejects(modulo.crearPrestadorHonorarios({ identificador: nuevo.identificador, nombreRazonSocial: 'Duplicado' }), error => error.estado === 409 && /identificador/i.test(error.message));
      const boleta = await modulo.crearBoletaHonorarios({ idPrestador: nuevo.id, folio: `PRIMERA-${marca}`, fechaEmision: '2099-06-05', bruto: 750, modalidadTributaria: 'MODALIDAD_INFORMADA_FIXTURE' });
      ids.boletas.push(boleta.id); assert.equal(boleta.prestador.id, nuevo.id); assert.equal(boleta.estadoDocumental, 'PENDIENTE_CONFIRMACION'); assert.equal(boleta.tasaAplicada, null);
    });
    await t.test('CU197 edita pendiente y bloquea bruto inválido, modalidad vacía y confirmada', async () => {
      await assert.rejects(modulo.crearBoletaHonorarios({ idPrestador: prestador.id_prestador_honorarios, folio: `CERO-${marca}`, fechaEmision: '2099-06-03', bruto: 0, modalidadTributaria: 'FIXTURE' }), error => error.estado === 400);
      await assert.rejects(modulo.actualizarBoletaHonorarios(pendiente.id_boleta_honorarios, { idPrestador: prestador.id_prestador_honorarios, folio: pendiente.folio, fechaEmision: '2099-06-01', bruto: 1100, modalidadTributaria: '' }), error => error.estado === 400);
      const editada = await modulo.actualizarBoletaHonorarios(pendiente.id_boleta_honorarios, { idPrestador: prestador.id_prestador_honorarios, folio: `PE-${marca}`, fechaEmision: '2099-06-04', bruto: 1100, modalidadTributaria: 'MODALIDAD_EDITADA_FIXTURE', respaldo: '', referencia: 'EDITADA' });
      assert.equal(editada.folio, `PE-${marca}`); assert.equal(editada.bruto, 1100); assert.equal(editada.tasaAplicada, null);
      await assert.rejects(modulo.actualizarBoletaHonorarios(confirmada.id_boleta_honorarios, { idPrestador: prestador.id_prestador_honorarios, folio: confirmada.folio, fechaEmision: '2099-06-02', bruto: 1000, modalidadTributaria: confirmada.modalidad_tributaria }), error => error.estado === 409);
    });
    await t.test('permisos CU196/CU197 siguen específicos al incorporar CU198', () => {
      assert.equal(codigosTodosLosCU.length, 274); assert.deepEqual(matrizPermisosPorCU.CU196, []); assert.deepEqual(matrizPermisosPorCU.CU197, []); assert.deepEqual(matrizPermisosPorCU.CU198, []);
      assert.equal(operacionesPermiso.listarBoletasHonorarios, 'CU196'); assert.equal(operacionesPermiso.crearPrestadorHonorarios, 'CU197'); assert.equal(operacionesPermiso.crearBoletaHonorarios, 'CU197');
      assert.equal(permiteOperacion('crearBoletaHonorarios', ['CU196']), false); assert.equal(codigosTodosLosCU.includes('CU198'), true); assert.equal(codigosTodosLosCU.includes('CU201'), true); assert.equal(codigosTodosLosCU.includes('CU202'), true); assert.equal(codigosTodosLosCU.includes('CU203'), true); assert.equal(codigosTodosLosCU.includes('CU204'), true); assert.equal(codigosTodosLosCU.includes('CU205'), true); assert.equal(codigosTodosLosCU.includes('CU206'), true); assert.equal(codigosTodosLosCU.includes('CU215'),true);
      const rutas = readFileSync(resolve('src/rutas/finanzas.ts'), 'utf8'); assert.match(rutas, /confirmarBoletaHonorarios/);
    });
  } finally {
    await prisma.reversion_pago_remuneracion.deleteMany({ where: { id_reversion_pago_remuneracion: { in: ids.reversiones } } });
    await prisma.pago_remuneracion.deleteMany({ where: { id_pago_remuneracion: { in: ids.pagos } } });
    await prisma.$executeRawUnsafe('ALTER TABLE finanzas.boleta_honorarios DISABLE TRIGGER tr_proteger_boleta_honorarios_confirmada');
    try { await prisma.boleta_honorarios.deleteMany({ where: { id_boleta_honorarios: { in: ids.boletas } } }); }
    finally { await prisma.$executeRawUnsafe('ALTER TABLE finanzas.boleta_honorarios ENABLE TRIGGER tr_proteger_boleta_honorarios_confirmada'); }
    await prisma.prestador_honorarios.deleteMany({ where: { id_prestador_honorarios: { in: ids.prestadores } } });
    await prisma.medio_pago.deleteMany({ where: { id_medio_pago: { in: ids.medios } } });
    await prisma.usuario.deleteMany({ where: { usuario_id_usuario: { in: ids.usuarios } } });
  }
});
