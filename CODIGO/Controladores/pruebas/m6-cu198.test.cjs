const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { prisma } = require('../dist/db');
const { M6Controller } = require('../dist/controladores/M6Controller');
const { codigosTodosLosCU, matrizPermisosPorCU, operacionesPermiso, permiteOperacion } = require('../dist/validaciones/permisos');

test('M6 T11 CU198 confirma boletas con tributación parametrizada', async t => {
  const modulo = new M6Controller();
  const marca = randomUUID().slice(0, 8).toUpperCase();
  const ids = { usuarios: [], medios: [], prestadores: [], boletas: [], pagos: [], parametros: [] };
  const usuario = await prisma.usuario.create({ data: { usuario_username: `m6t11_${marca}` } }); ids.usuarios.push(usuario.usuario_id_usuario);
  const medio = await prisma.medio_pago.create({ data: { nombre_medio_pago: `M6 T11 ${marca}`, codigo_medio_pago: `M6T11${marca}`, estado_medio_pago: 'activo', requiere_respaldo: false } }); ids.medios.push(medio.id_medio_pago);
  const prestador = await prisma.prestador_honorarios.create({ data: { identificador: `CU198-${marca}`, nombre_razon_social: `Prestador CU198 ${marca}` } }); ids.prestadores.push(prestador.id_prestador_honorarios);
  const parametro = async (data = {}) => {
    const creado = await prisma.parametro_remuneracional.create({ data: { codigo: 'BH_TASA_RETENCION_PPM', tipo: 'TRIBUTARIO', nombre: `Tasa BH ${marca}`, valor: '0.125000', unidad: 'FACTOR_DECIMAL', vigencia_desde: new Date('2188-01-01'), vigencia_hasta: new Date('2188-12-31'), estado: 'activo', ...data } });
    ids.parametros.push(creado.id_parametro_remuneracional); return creado;
  };
  const boleta = async (folio, fecha, bruto, modalidad) => {
    const creada = await prisma.boleta_honorarios.create({ data: { id_prestador: prestador.id_prestador_honorarios, folio: `${folio}-${marca}`, fecha_emision: new Date(fecha), bruto, modalidad_tributaria: modalidad, estado_documental: 'PENDIENTE_CONFIRMACION' } });
    ids.boletas.push(creada.id_boleta_honorarios); return creada;
  };
  await parametro();
  await parametro({ nombre: `Tasa vencida ${marca}`, valor: '0.990000', vigencia_desde: new Date('2187-01-01'), vigencia_hasta: new Date('2187-12-31') });
  try {
    let conRetencion;
    await t.test('CON_RETENCION_RECEPTOR calcula retención y líquido con la tasa vigente por emisión', async () => {
      const creada = await boleta('RET', '2188-01-15', '1000', 'CON_RETENCION_RECEPTOR');
      const previa = await modulo.previsualizarConfirmacionBoletaHonorarios(creada.id_boleta_honorarios);
      assert.equal(previa.tasaAplicada, 0.125); assert.equal(previa.retencion, 125); assert.equal(previa.liquido, 875);
      conRetencion = await modulo.confirmarBoletaHonorarios(creada.id_boleta_honorarios);
      assert.equal(conRetencion.estadoDocumental, 'CONFIRMADA'); assert.equal(conRetencion.tasaAplicada, 0.125); assert.equal(conRetencion.retencion, 125); assert.equal(conRetencion.liquido, 875);
    });
    await t.test('SIN_RETENCION_PPM_EMISOR fija tasa pero no descuenta ni persiste PPM', async () => {
      const creada = await boleta('PPM', '2188-02-10', '1500', 'SIN_RETENCION_PPM_EMISOR');
      const confirmada = await modulo.confirmarBoletaHonorarios(creada.id_boleta_honorarios);
      assert.equal(confirmada.tasaAplicada, 0.125); assert.equal(confirmada.retencion, 0); assert.equal(confirmada.liquido, 1500);
      assert.equal(Object.keys(confirmada).some(clave => /ppm/i.test(clave)), false);
    });
    await t.test('no usa un parámetro vencido y bloquea cuando no existe uno vigente', async () => {
      const creada = await boleta('SIN-TASA', '2186-06-01', '1000', 'CON_RETENCION_RECEPTOR');
      await assert.rejects(modulo.confirmarBoletaHonorarios(creada.id_boleta_honorarios), error => error.estado === 409 && /no existe/i.test(error.message));
      const persistida = await prisma.boleta_honorarios.findUniqueOrThrow({ where: { id_boleta_honorarios: creada.id_boleta_honorarios } });
      assert.equal(persistida.estado_documental, 'PENDIENTE_CONFIRMACION'); assert.equal(persistida.tasa_aplicada, null);
    });
    await t.test('múltiples parámetros vigentes bloquean atómicamente', async () => {
      await parametro({ nombre: `Tasa ambigua A ${marca}`, vigencia_desde: new Date('2189-01-01'), vigencia_hasta: new Date('2189-12-31') });
      await parametro({ nombre: `Tasa ambigua B ${marca}`, vigencia_desde: new Date('2189-02-01'), vigencia_hasta: new Date('2189-11-30') });
      const creada = await boleta('AMB', '2189-06-01', '1000', 'CON_RETENCION_RECEPTOR');
      await assert.rejects(modulo.confirmarBoletaHonorarios(creada.id_boleta_honorarios), error => error.estado === 409 && /más de una/i.test(error.message));
      assert.equal((await prisma.boleta_honorarios.findUniqueOrThrow({ where: { id_boleta_honorarios: creada.id_boleta_honorarios } })).estado_documental, 'PENDIENTE_CONFIRMACION');
    });
    await t.test('unidad incorrecta bloquea la confirmación', async () => {
      await parametro({ nombre: `Unidad inválida ${marca}`, unidad: 'PORCENTAJE', vigencia_desde: new Date('2190-01-01'), vigencia_hasta: new Date('2190-12-31') });
      const creada = await boleta('UNIDAD', '2190-06-01', '1000', 'CON_RETENCION_RECEPTOR');
      await assert.rejects(modulo.confirmarBoletaHonorarios(creada.id_boleta_honorarios), error => error.estado === 409 && /unidad/i.test(error.message));
    });
    await t.test('modalidad inválida bloquea la confirmación', async () => {
      const creada = await boleta('MOD', '2188-03-01', '1000', 'MODALIDAD_NO_APROBADA');
      await assert.rejects(modulo.confirmarBoletaHonorarios(creada.id_boleta_honorarios), error => error.estado === 400 && /modalidad/i.test(error.message));
    });
    await t.test('una boleta CONFIRMADA no puede confirmarse otra vez', async () => {
      await assert.rejects(modulo.confirmarBoletaHonorarios(conRetencion.id), error => error.estado === 409 && /PENDIENTE_CONFIRMACION/.test(error.message));
    });
    await t.test('ROUND_HALF_UP redondea la retención a cero decimales', async () => {
      const creada = await boleta('HALF-UP', '2188-01-20', '1004', 'CON_RETENCION_RECEPTOR');
      const confirmada = await modulo.confirmarBoletaHonorarios(creada.id_boleta_honorarios);
      assert.equal(confirmada.retencion, 126); assert.equal(confirmada.liquido, 878);
    });
    await t.test('agregado mensual suma sólo retenciones de boletas confirmadas', async () => {
      const pendiente = await boleta('PEND-MES', '2188-01-25', '1000', 'CON_RETENCION_RECEPTOR');
      const resumen = await modulo.consultarRetencionesHonorariosMensuales(2188, 1);
      assert.equal(resumen.totalRetenciones, 251); assert.equal(resumen.cantidadBoletas, 2);
      assert.equal((await prisma.boleta_honorarios.findUniqueOrThrow({ where: { id_boleta_honorarios: pendiente.id_boleta_honorarios } })).estado_documental, 'PENDIENTE_CONFIRMACION');
    });
    await t.test('CU187 puede pagar el líquido fijado por CU198', async () => {
      const creada = await boleta('PAGO', '2188-04-01', '2000', 'CON_RETENCION_RECEPTOR');
      const confirmada = await modulo.confirmarBoletaHonorarios(creada.id_boleta_honorarios);
      const pago = await modulo.prepararPagoHonorarios(confirmada.id, { monto: confirmada.liquido, idMedioPago: medio.id_medio_pago, claveIdempotencia: `cu198-${marca}` }, usuario.usuario_id_usuario);
      ids.pagos.push(pago.id); await modulo.confirmarPagoHonorarios(pago.id, usuario.usuario_id_usuario);
      const detalle = await modulo.obtenerBoletaHonorarios(confirmada.id);
      assert.equal(detalle.economia.saldoPendiente, 0); assert.equal(detalle.economia.condicion, 'PAGADA');
    });
    await t.test('CU198 usa permiso específico y no adelanta CU206', () => {
      assert.equal(codigosTodosLosCU.length, 274); assert.deepEqual(matrizPermisosPorCU.CU198, []);
      assert.equal(operacionesPermiso.previsualizarConfirmacionBoletaHonorarios, 'CU198'); assert.equal(operacionesPermiso.confirmarBoletaHonorarios, 'CU198'); assert.equal(operacionesPermiso.consultarRetencionesHonorariosMensuales, 'CU198');
      assert.equal(permiteOperacion('confirmarBoletaHonorarios', ['CU197']), false); assert.equal(permiteOperacion('confirmarBoletaHonorarios', ['CU198']), true); assert.equal(codigosTodosLosCU.includes('CU201'), true); assert.equal(codigosTodosLosCU.includes('CU202'), true); assert.equal(codigosTodosLosCU.includes('CU203'), true); assert.equal(codigosTodosLosCU.includes('CU204'), true); assert.equal(codigosTodosLosCU.includes('CU205'), true); assert.equal(codigosTodosLosCU.includes('CU206'), true); assert.equal(codigosTodosLosCU.includes('CU215'),true);
    });
    await t.test('no existe tasa tributaria hardcodeada ni obligación paralela', () => {
      const controlador = readFileSync(resolve('src/controladores/M6Controller.ts'), 'utf8');
      const schema = readFileSync(resolve('prisma/schema.prisma'), 'utf8');
      assert.doesNotMatch(controlador, /0\.1525|15[,.]25/); assert.match(controlador, /BH_TASA_RETENCION_PPM/); assert.match(controlador, /ROUND_HALF_UP/);
      assert.doesNotMatch(schema, /model\s+obligacion_tributaria_honorarios\s*\{/i);
    });
  } finally {
    await prisma.reversion_pago_remuneracion.deleteMany({ where: { pago: { id_pago_remuneracion: { in: ids.pagos } } } });
    await prisma.pago_remuneracion.deleteMany({ where: { id_pago_remuneracion: { in: ids.pagos } } });
    await prisma.$executeRawUnsafe('ALTER TABLE finanzas.boleta_honorarios DISABLE TRIGGER tr_proteger_boleta_honorarios_confirmada');
    try { await prisma.boleta_honorarios.deleteMany({ where: { id_boleta_honorarios: { in: ids.boletas } } }); }
    finally { await prisma.$executeRawUnsafe('ALTER TABLE finanzas.boleta_honorarios ENABLE TRIGGER tr_proteger_boleta_honorarios_confirmada'); }
    await prisma.prestador_honorarios.deleteMany({ where: { id_prestador_honorarios: { in: ids.prestadores } } });
    await prisma.parametro_remuneracional.deleteMany({ where: { id_parametro_remuneracional: { in: ids.parametros } } });
    await prisma.medio_pago.deleteMany({ where: { id_medio_pago: { in: ids.medios } } });
    await prisma.usuario.deleteMany({ where: { usuario_id_usuario: { in: ids.usuarios } } });
  }
});
