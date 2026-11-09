const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { prisma } = require('../dist/db');
const { M6Controller } = require('../dist/controladores/M6Controller');
const { prepararPrevisionM6 } = require('./soporte-prevision-m6.cjs');

function rutValido() {
  const cuerpo = String(Math.floor(Math.random() * 8_000_000) + 1_000_000);
  let suma = 0;
  let multiplicador = 2;
  for (let indice = cuerpo.length - 1; indice >= 0; indice -= 1) {
    suma += Number(cuerpo[indice]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }
  const resto = 11 - (suma % 11);
  return `${cuerpo}-${resto === 11 ? '0' : resto === 10 ? 'K' : resto}`;
}

test('M6 correcciones finales post-auditoria', async (t) => {
  const modulo = new M6Controller();
  const sufijo = randomUUID().slice(0, 8);
  const ids = { empleados: [], usuarios: [], relaciones: [], tramos: [], conceptos: [], esquemas: [], periodos: [], parametros: [] };
  let calculoFebrero;

  const empleado = await modulo.crearEmpleado({ rut: rutValido(), nombres: 'Auditoria', apellidoPaterno: 'Final' });
  ids.empleados.push(empleado.id);
  await prisma.empleado.update({ where: { id_empleado: empleado.id }, data: { sueldo_base: 1000, fecha_aplicacion_sueldo_base: new Date('2199-01-01') } });
  const usuario = await prisma.usuario.create({ data: { usuario_username: `post_${sufijo}`, usuario_nombre_completo_primer_nombre_usuario: 'Auditoria final' } });
  ids.usuarios.push(usuario.usuario_id_usuario);
  const relacion = await prisma.relacion_laboral_empleado.create({ data: { id_empleado: empleado.id, fecha_inicio: new Date('2199-01-01'), estado: 'vigente' } });
  ids.relaciones.push(relacion.id_relacion_laboral_empleado);
  ids.parametros.push(...await prepararPrevisionM6(prisma,{empleados:[empleado.id],desde:'2199-01-01',hasta:'2199-12-31'}));
  const tramo = await prisma.tramo_impuesto_renta.create({ data: { vigencia_desde: new Date('2199-01-01'), vigencia_hasta: new Date('2199-12-31'), orden: 1, limite_desde: 0, limite_hasta: null, factor: 0, rebaja: 0, unidad: 'CLP', estado: 'activo' } });
  ids.tramos.push(tramo.id_tramo_impuesto_renta);

  const crearConcepto = async (codigo, naturaleza, modalidad, valor) => {
    const concepto = await prisma.concepto_remuneracion.create({
      data: {
        codigo_m6: `${codigo}${sufijo}`,
        nombre_concepto: `${codigo} ${sufijo}`,
        naturaleza_concepto: naturaleza,
        configuraciones_m6: { create: { modalidad, valor, vigencia_desde: new Date('2199-01-01'), vigencia_hasta: new Date('2199-12-31') } },
      },
    });
    ids.conceptos.push(concepto.id_concepto_remuneracion);
    return concepto;
  };

  const porcentaje = await crearConcepto('PCT', 'haber', 'PORCENTAJE', 10);
  const fijo = await crearConcepto('FIJ', 'haber', 'FIJO', 125);
  const explicito = await crearConcepto('EXP', 'haber', 'PORCENTAJE', 50);
  const haberHistorico = await crearConcepto('HHI', 'haber', 'FIJO', 40);
  const deduccionHistorica = await crearConcepto('DHI', 'descuento', 'FIJO', 30);

  await modulo.asignarHaberEmpleado(empleado.id, { idConcepto: porcentaje.id_concepto_remuneracion, vigenciaDesde: '2199-01-01', vigenciaHasta: '2199-03-31' });
  await modulo.asignarHaberEmpleado(empleado.id, { idConcepto: fijo.id_concepto_remuneracion, vigenciaDesde: '2199-01-01', vigenciaHasta: '2199-03-31' });
  await modulo.asignarHaberEmpleado(empleado.id, { idConcepto: explicito.id_concepto_remuneracion, vigenciaDesde: '2199-01-01', vigenciaHasta: '2199-03-31', valorAplicable: 75 });
  const asignacionHaberHistorico = (await modulo.asignarHaberEmpleado(empleado.id, { idConcepto: haberHistorico.id_concepto_remuneracion, vigenciaDesde: '2199-01-01' })).find((item) => item.idConcepto === haberHistorico.id_concepto_remuneracion);
  await modulo.finalizarAsignacionHaberEmpleado(empleado.id, asignacionHaberHistorico.id, { vigenciaHasta: '2199-03-31' });
  const asignacionDeduccionHistorica = (await modulo.asignarDeduccionEmpleado(empleado.id, { idConcepto: deduccionHistorica.id_concepto_remuneracion, vigenciaDesde: '2199-01-01', fundamento: 'Prueba histórica', autorizacionReferencia: 'AUD-1' })).find((item) => item.idConcepto === deduccionHistorica.id_concepto_remuneracion);
  await modulo.finalizarDeduccionEmpleado(empleado.id, asignacionDeduccionHistorica.id, { vigenciaHasta: '2199-03-31' });

  try {
    await t.test('1 HABER PORCENTAJE no infiere sueldo base', async () => {
      calculoFebrero = await modulo.calcularRemuneracion({ idEmpleado: empleado.id, anio: 2199, mes: 2 }, usuario.usuario_id_usuario);
      ids.periodos.push(calculoFebrero.remuneracion.periodo.id);
      const componente = calculoFebrero.remuneracion.componentes.find((item) => item.concepto?.id === porcentaje.id_concepto_remuneracion);
      assert.equal(componente.monto, null);
      assert.equal(componente.estadoRevision, 'pendiente_valorizacion');
      assert.equal(componente.motivo, 'El HABER porcentual no tiene una base de cálculo explícita');
    });

    await t.test('2 HABER FIJO conserva su cálculo', () => {
      const componente = calculoFebrero.remuneracion.componentes.find((item) => item.concepto?.id === fijo.id_concepto_remuneracion);
      assert.equal(componente.monto, 125);
      assert.equal(componente.estadoRevision, 'aprobado');
    });

    await t.test('3 valor_aplicable explícito prevalece sobre modalidad porcentual', () => {
      const componente = calculoFebrero.remuneracion.componentes.find((item) => item.concepto?.id === explicito.id_concepto_remuneracion);
      assert.equal(componente.monto, 75);
      assert.equal(componente.estadoRevision, 'aprobado');
    });

    await t.test('4 HABER finalizado aplica dentro de su vigencia histórica', () => {
      const componente = calculoFebrero.remuneracion.componentes.find((item) => item.concepto?.id === haberHistorico.id_concepto_remuneracion);
      assert.equal(componente.monto, 40);
      assert.equal(componente.estadoRevision, 'aprobado');
    });

    await t.test('5 DEDUCCION finalizada aplica dentro y no después de su vigencia', async () => {
      const febrero = calculoFebrero.remuneracion.componentes.find((item) => item.concepto?.id === deduccionHistorica.id_concepto_remuneracion);
      assert.equal(febrero.monto, 30);
      const abril = await modulo.calcularRemuneracion({ idEmpleado: empleado.id, anio: 2199, mes: 4 }, usuario.usuario_id_usuario);
      ids.periodos.push(abril.remuneracion.periodo.id);
      assert.equal(abril.remuneracion.componentes.some((item) => item.concepto?.id === haberHistorico.id_concepto_remuneracion), false);
      assert.equal(abril.remuneracion.componentes.some((item) => item.concepto?.id === deduccionHistorica.id_concepto_remuneracion), false);
    });

    await t.test('6 asignaciones históricas inactivas bloquean solapamientos', async () => {
      await assert.rejects(modulo.asignarHaberEmpleado(empleado.id, { idConcepto: haberHistorico.id_concepto_remuneracion, vigenciaDesde: '2199-02-01', vigenciaHasta: '2199-02-28' }), (error) => error.estado === 409);
      await assert.rejects(modulo.asignarDeduccionEmpleado(empleado.id, { idConcepto: deduccionHistorica.id_concepto_remuneracion, vigenciaDesde: '2199-02-01', vigenciaHasta: '2199-02-28', fundamento: 'Solapamiento', autorizacionReferencia: 'AUD-2' }), (error) => error.estado === 409);
    });

    await t.test('7 asignaciones posteriores al término histórico son permitidas', async () => {
      const haberes = await modulo.asignarHaberEmpleado(empleado.id, { idConcepto: haberHistorico.id_concepto_remuneracion, vigenciaDesde: '2199-04-01' });
      const deducciones = await modulo.asignarDeduccionEmpleado(empleado.id, { idConcepto: deduccionHistorica.id_concepto_remuneracion, vigenciaDesde: '2199-04-01', fundamento: 'Vigencia posterior', autorizacionReferencia: 'AUD-3' });
      assert.ok(haberes.some((item) => item.idConcepto === haberHistorico.id_concepto_remuneracion && item.activa));
      assert.ok(deducciones.some((item) => item.idConcepto === deduccionHistorica.id_concepto_remuneracion && item.activa));
    });

    await t.test('8 CU159 considera historia finalizada al validar solapamientos', async () => {
      const esquema = await prisma.esquema_remuneracional.create({ data: { codigo: `EHI${sufijo}`, nombre: `Esquema histórico ${sufijo}`, vigencia_desde: new Date('2199-01-01'), vigencia_hasta: new Date('2199-12-31') } });
      ids.esquemas.push(esquema.id_esquema_remuneracional);
      let asignaciones = await modulo.asignarEsquemaEmpleado(empleado.id, { idEsquema: esquema.id_esquema_remuneracional, vigenciaDesde: '2199-01-01', vigenciaHasta: '2199-12-31' });
      const asignacion = asignaciones.find((item) => item.idEsquema === esquema.id_esquema_remuneracional);
      await modulo.finalizarAsignacionEsquemaEmpleado(empleado.id, asignacion.id, { vigenciaHasta: '2199-03-31' });
      await assert.rejects(modulo.asignarEsquemaEmpleado(empleado.id, { idEsquema: esquema.id_esquema_remuneracional, vigenciaDesde: '2199-03-01', vigenciaHasta: '2199-03-15' }), (error) => error.estado === 409);
      asignaciones = await modulo.asignarEsquemaEmpleado(empleado.id, { idEsquema: esquema.id_esquema_remuneracional, vigenciaDesde: '2199-04-01', vigenciaHasta: '2199-12-31' });
      assert.equal(asignaciones.filter((item) => item.idEsquema === esquema.id_esquema_remuneracional).length, 2);
    });

    await t.test('9 CU159 finaliza concurrentemente una sola vez', async () => {
      const esquema = await prisma.esquema_remuneracional.create({ data: { codigo: `EC159${sufijo}`, nombre: `Carrera esquema ${sufijo}`, vigencia_desde: new Date('2199-01-01'), vigencia_hasta: new Date('2199-12-31') } });
      ids.esquemas.push(esquema.id_esquema_remuneracional);
      const asignacion = (await modulo.asignarEsquemaEmpleado(empleado.id, { idEsquema: esquema.id_esquema_remuneracional, vigenciaDesde: '2199-01-01', vigenciaHasta: '2199-12-31' })).find((item) => item.idEsquema === esquema.id_esquema_remuneracional);
      const carrera = await Promise.allSettled([
        modulo.finalizarAsignacionEsquemaEmpleado(empleado.id, asignacion.id, { vigenciaHasta: '2199-05-31' }),
        modulo.finalizarAsignacionEsquemaEmpleado(empleado.id, asignacion.id, { vigenciaHasta: '2199-06-30' }),
      ]);
      assert.equal(carrera.filter((item) => item.status === 'fulfilled').length, 1);
      assert.equal(carrera.filter((item) => item.status === 'rejected' && item.reason.estado === 409).length, 1);
      const actual = await prisma.asignacion_esquema_remuneracional.findUniqueOrThrow({ where: { id_asignacion_esquema: asignacion.id } });
      const esperada = carrera[0].status === 'fulfilled' ? '2199-05-31' : '2199-06-30';
      assert.equal(actual.vigencia_hasta.toISOString().slice(0, 10), esperada);
    });

    await t.test('10 CU160 finaliza concurrentemente una sola vez', async () => {
      const concepto = await crearConcepto('C160', 'haber', 'FIJO', 5);
      const asignacion = (await modulo.asignarHaberEmpleado(empleado.id, { idConcepto: concepto.id_concepto_remuneracion, vigenciaDesde: '2199-01-01' })).find((item) => item.idConcepto === concepto.id_concepto_remuneracion);
      const carrera = await Promise.allSettled([
        modulo.finalizarAsignacionHaberEmpleado(empleado.id, asignacion.id, { vigenciaHasta: '2199-05-31' }),
        modulo.finalizarAsignacionHaberEmpleado(empleado.id, asignacion.id, { vigenciaHasta: '2199-06-30' }),
      ]);
      assert.equal(carrera.filter((item) => item.status === 'fulfilled').length, 1);
      assert.equal(carrera.filter((item) => item.status === 'rejected' && item.reason.estado === 409).length, 1);
      const actual = await prisma.asignacion_concepto_remuneracion_empleado.findUniqueOrThrow({ where: { id_asignacion_concepto: asignacion.id } });
      const esperada = carrera[0].status === 'fulfilled' ? '2199-05-31' : '2199-06-30';
      assert.equal(actual.vigencia_hasta.toISOString().slice(0, 10), esperada);
    });

    await t.test('11 CU214 finaliza concurrentemente una sola vez', async () => {
      const concepto = await crearConcepto('C214', 'descuento', 'FIJO', 5);
      const asignacion = (await modulo.asignarDeduccionEmpleado(empleado.id, { idConcepto: concepto.id_concepto_remuneracion, vigenciaDesde: '2199-01-01', fundamento: 'Carrera', autorizacionReferencia: 'AUD-4' })).find((item) => item.idConcepto === concepto.id_concepto_remuneracion);
      const carrera = await Promise.allSettled([
        modulo.finalizarDeduccionEmpleado(empleado.id, asignacion.id, { vigenciaHasta: '2199-05-31' }),
        modulo.finalizarDeduccionEmpleado(empleado.id, asignacion.id, { vigenciaHasta: '2199-06-30' }),
      ]);
      assert.equal(carrera.filter((item) => item.status === 'fulfilled').length, 1);
      assert.equal(carrera.filter((item) => item.status === 'rejected' && item.reason.estado === 409).length, 1);
      const actual = await prisma.asignacion_concepto_remuneracion_empleado.findUniqueOrThrow({ where: { id_asignacion_concepto: asignacion.id } });
      const esperada = carrera[0].status === 'fulfilled' ? '2199-05-31' : '2199-06-30';
      assert.equal(actual.vigencia_hasta.toISOString().slice(0, 10), esperada);
    });

    await t.test('12 períodos cerrados permanecen intactos', async () => {
      const periodoCerrado = await modulo.calcularRemuneracion({ idEmpleado: empleado.id, anio: 2199, mes: 7 }, usuario.usuario_id_usuario);
      if (!ids.periodos.includes(periodoCerrado.remuneracion.periodo.id)) ids.periodos.push(periodoCerrado.remuneracion.periodo.id);
      assert.deepEqual(periodoCerrado.bloqueos, []);
      await modulo.cerrarRemuneracion(periodoCerrado.remuneracion.id, usuario.usuario_id_usuario);
      await prisma.periodo_remuneracion.update({ where: { id_periodo_remuneracion: periodoCerrado.remuneracion.periodo.id }, data: { cerrado_en: new Date(), cerrado_por: usuario.usuario_id_usuario } });
      const antes = await modulo.obtenerRemuneracion(periodoCerrado.remuneracion.id);
      await prisma.configuracion_concepto_remuneracion.updateMany({ where: { id_concepto: haberHistorico.id_concepto_remuneracion }, data: { valor: 999 } });
      await assert.rejects(modulo.calcularRemuneracion({ idEmpleado: empleado.id, anio: 2199, mes: 7 }, usuario.usuario_id_usuario), (error) => error.estado === 409);
      const despues = await modulo.obtenerRemuneracion(periodoCerrado.remuneracion.id);
      assert.deepEqual(despues.totales, antes.totales);
      assert.deepEqual(despues.componentes.map((item) => item.id), antes.componentes.map((item) => item.id));
    });
  } finally {
    const remuneraciones = await prisma.remuneracion.findMany({ where: { id_empleado: empleado.id }, select: { id_remuneracion: true, id_periodo_remuneracion: true } });
    const idsRemuneraciones = remuneraciones.map((item) => item.id_remuneracion);
    const idsPeriodos = [...new Set(remuneraciones.map((item) => item.id_periodo_remuneracion))];
    await prisma.componente_remuneracion.deleteMany({ where: { id_remuneracion: { in: idsRemuneraciones } } });
    await prisma.remuneracion.deleteMany({ where: { id_remuneracion: { in: idsRemuneraciones } } });
    await prisma.periodo_remuneracion.deleteMany({ where: { id_periodo_remuneracion: { in: idsPeriodos } } });
    await prisma.asignacion_concepto_remuneracion_empleado.deleteMany({ where: { id_empleado: empleado.id } });
    await prisma.asignacion_esquema_remuneracional.deleteMany({ where: { id_empleado: empleado.id } });
    await prisma.configuracion_concepto_remuneracion.deleteMany({ where: { id_concepto: { in: ids.conceptos } } });
    await prisma.concepto_remuneracion.deleteMany({ where: { id_concepto_remuneracion: { in: ids.conceptos } } });
    await prisma.tarifa_esquema_remuneracional.deleteMany({ where: { id_esquema: { in: ids.esquemas } } });
    await prisma.esquema_remuneracional.deleteMany({ where: { id_esquema_remuneracional: { in: ids.esquemas } } });
    await prisma.relacion_laboral_empleado.deleteMany({ where: { id_relacion_laboral_empleado: { in: ids.relaciones } } });
    await prisma.parametro_remuneracional.deleteMany({ where: { id_parametro_remuneracional: { in: [...new Set(ids.parametros)] } } });
    await prisma.tramo_impuesto_renta.deleteMany({ where: { id_tramo_impuesto_renta: { in: ids.tramos } } });
    await prisma.usuario.deleteMany({ where: { usuario_id_usuario: { in: ids.usuarios } } });
    await prisma.empleado.deleteMany({ where: { id_empleado: { in: ids.empleados } } });
  }
});
