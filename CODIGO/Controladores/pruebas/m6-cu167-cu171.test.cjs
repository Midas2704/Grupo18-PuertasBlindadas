const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { prisma } = require('../dist/db');
const { M6Controller } = require('../dist/controladores/M6Controller');
const { M3Controller } = require('../dist/controladores/M3Controller');
const { C_Finanzas } = require('../dist/controladores/C_Finanzas');
const { operacionesPermiso, codigosTodosLosCU, matrizPermisosPorCU, permiteOperacion } = require('../dist/validaciones/permisos');

const borrarConcepto = async (id) => {
  await prisma.asignacion_concepto_remuneracion_empleado.deleteMany({ where: { id_concepto: id } });
  await prisma.configuracion_concepto_remuneracion.deleteMany({ where: { id_concepto: id } });
  await prisma.concepto_remuneracion.delete({ where: { id_concepto_remuneracion: id } });
};

test('M6 T3 CU167-CU171 mantiene parámetros seguros sin ejecutar procesos posteriores', async (t) => {
  const modulo = new M6Controller();
  const sufijo = randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();

  await t.test('CU167 conserva vigencias, resuelve por fecha y rechaza solapamiento concurrente', async () => {
    const codigo = `P167${sufijo}`;
    const codigoCarrera = `R167${sufijo}`;
    const codigoPendiente = `N167${sufijo}`;
    const anioTramos = 2100 + Number(sufijo.charCodeAt(0) % 100);
    const idsTramos = [];
    const afpAntes = await prisma.afp.count();
    const saludAntes = await prisma.prevision_salud.count();
    try {
      assert.ok(Array.isArray(await modulo.listarParametrosRemuneracionales()));
      await modulo.crearParametroRemuneracional({ codigo: codigoPendiente, tipo: 'PREVISIONAL', nombre: 'Fixture pendiente', vigenciaDesde: '2090-01-01', estado: 'pendiente' });
      const pendiente = (await modulo.listarParametrosRemuneracionales('PREVISIONAL')).find((item) => item.codigo === codigoPendiente);
      assert.equal(pendiente.valor, null);
      await assert.rejects(modulo.resolverParametroRemuneracional(codigoPendiente, '2090-03-01'), (error) => error.estado === 404);
      await assert.rejects(modulo.crearParametroRemuneracional({ codigo: `X167${sufijo}`, tipo: 'ARBITRARIO', nombre: 'Tipo inválido', vigenciaDesde: '2090-01-01' }), (error) => error.estado === 400);
      await modulo.crearParametroRemuneracional({ codigo, tipo: 'LEGAL', nombre: 'Fixture inicial', valor: 1, unidad: 'FIXTURE', vigenciaDesde: '2090-01-01', vigenciaHasta: '2090-06-30', fuente: 'Fuente artificial', referencia: 'REF-TEST', estado: 'activo' });
      await modulo.crearParametroRemuneracional({ codigo, tipo: 'LEGAL', nombre: 'Fixture futura', valor: 2, unidad: 'FIXTURE', vigenciaDesde: '2090-07-01', fuente: 'Fuente artificial', referencia: 'REF-TEST-2', estado: 'activo' });
      assert.equal((await modulo.resolverParametroRemuneracional(codigo, '2090-03-01')).valor, 1);
      assert.equal((await modulo.resolverParametroRemuneracional(codigo, '2090-08-01')).valor, 2);
      const historial = (await modulo.listarParametrosRemuneracionales('LEGAL')).filter((item) => item.codigo === codigo);
      assert.equal(historial.length, 2);
      assert.equal(historial.find((item) => item.valor === 1).fuente, 'Fuente artificial');
      assert.equal(historial.find((item) => item.valor === 1).referencia, 'REF-TEST');
      await modulo.actualizarParametroRemuneracional(historial[0].id, { nombre: 'Fixture actualizado' });
      await assert.rejects(modulo.crearParametroRemuneracional({ codigo, tipo: 'LEGAL', nombre: 'Solapado', valor: 3, unidad: 'FIXTURE', vigenciaDesde: '2090-06-01', vigenciaHasta: '2090-08-01', estado: 'activo' }), (error) => error.estado === 409);
      const primera = historial.find((item) => item.valor === 1);
      await modulo.actualizarParametroRemuneracional(primera.id, { estado: 'inactivo' });
      const solapadaInactiva = await modulo.crearParametroRemuneracional({ codigo, tipo: 'LEGAL', nombre: 'Reemplazo activo', valor: 3, unidad: 'FIXTURE', vigenciaDesde: '2090-02-01', vigenciaHasta: '2090-05-01', estado: 'activo' });
      assert.ok(solapadaInactiva.some((item) => item.codigo === codigo && item.valor === 3));
      await assert.rejects(modulo.actualizarParametroRemuneracional(primera.id, { estado: 'activo' }), (error) => error.estado === 409);

      const carrera = await Promise.allSettled([
        modulo.crearParametroRemuneracional({ codigo: codigoCarrera, tipo: 'TRIBUTARIO', nombre: 'Carrera A', valor: 1, unidad: 'FIXTURE', vigenciaDesde: '2091-01-01', estado: 'activo' }),
        modulo.crearParametroRemuneracional({ codigo: codigoCarrera, tipo: 'TRIBUTARIO', nombre: 'Carrera B', valor: 2, unidad: 'FIXTURE', vigenciaDesde: '2091-01-01', estado: 'activo' }),
      ]);
      assert.equal(carrera.filter((resultado) => resultado.status === 'fulfilled').length, 1);
      assert.equal(await prisma.parametro_remuneracional.count({ where: { codigo: codigoCarrera } }), 1);

      const inicio = `${anioTramos}-01-01`, fin = `${anioTramos}-06-30`, inicioNuevo = `${anioTramos}-07-01`, finNuevo = `${anioTramos}-12-31`;
      let tramos = await modulo.crearTramoImpuestoRenta({ orden: 1, limiteDesde: 0, limiteHasta: 10, factor: 0.1, rebaja: 0, unidad: 'FIXTURE', vigenciaDesde: inicio, vigenciaHasta: fin, fuente: 'Fuente artificial', referencia: `TRAMO-1-${sufijo}` });
      idsTramos.push(tramos.find((item) => item.vigenciaDesde.toISOString().slice(0, 10) === inicio && item.orden === 1).id);
      tramos = await modulo.crearTramoImpuestoRenta({ orden: 2, limiteDesde: 11, limiteHasta: 20, factor: 0.2, rebaja: 1, unidad: 'FIXTURE', vigenciaDesde: inicio, vigenciaHasta: fin, fuente: 'Fuente artificial', referencia: `TRAMO-2-${sufijo}` });
      idsTramos.push(tramos.find((item) => item.vigenciaDesde.toISOString().slice(0, 10) === inicio && item.orden === 2).id);
      assert.equal((await modulo.listarTramosImpuestoRenta(`${anioTramos}-03-01`)).filter((item) => idsTramos.includes(item.id)).length, 2);
      await assert.rejects(modulo.crearTramoImpuestoRenta({ orden: 2, limiteDesde: 21, limiteHasta: 30, factor: 0.3, rebaja: 2, unidad: 'FIXTURE', vigenciaDesde: inicio, vigenciaHasta: fin }), (error) => error.estado === 409);
      await assert.rejects(modulo.crearTramoImpuestoRenta({ orden: 3, limiteDesde: 9, limiteHasta: 12, factor: 0.3, rebaja: 2, unidad: 'FIXTURE', vigenciaDesde: inicio, vigenciaHasta: fin }), (error) => error.estado === 409);
      await assert.rejects(modulo.crearTramoImpuestoRenta({ orden: 3, limiteDesde: 20, limiteHasta: 10, factor: 0.3, rebaja: 2, unidad: 'FIXTURE', vigenciaDesde: inicio, vigenciaHasta: fin }), (error) => error.estado === 400);
      tramos = await modulo.crearTramoImpuestoRenta({ orden: 1, limiteDesde: 0, limiteHasta: 15, factor: 0.4, rebaja: 0, unidad: 'FIXTURE', vigenciaDesde: inicioNuevo, vigenciaHasta: finNuevo, fuente: 'Fuente artificial', referencia: `TRAMO-NUEVO-${sufijo}` });
      idsTramos.push(tramos.find((item) => item.vigenciaDesde.toISOString().slice(0, 10) === inicioNuevo && item.orden === 1).id);
      assert.equal((await modulo.listarTramosImpuestoRenta(`${anioTramos}-03-01`)).filter((item) => idsTramos.includes(item.id)).length, 2);
      assert.equal((await modulo.listarTramosImpuestoRenta(`${anioTramos}-09-01`)).filter((item) => idsTramos.includes(item.id)).length, 1);
      const anioCarrera = anioTramos + 1;
      const carreraTramos = await Promise.allSettled([
        modulo.crearTramoImpuestoRenta({ orden: 1, limiteDesde: 0, limiteHasta: 10, factor: 0.1, rebaja: 0, unidad: 'FIXTURE', vigenciaDesde: `${anioCarrera}-01-01`, vigenciaHasta: `${anioCarrera}-06-30`, referencia: `TRAMO-CA-${sufijo}` }),
        modulo.crearTramoImpuestoRenta({ orden: 2, limiteDesde: 20, limiteHasta: 30, factor: 0.2, rebaja: 0, unidad: 'FIXTURE', vigenciaDesde: `${anioCarrera}-02-01`, vigenciaHasta: `${anioCarrera}-05-31`, referencia: `TRAMO-CB-${sufijo}` }),
      ]);
      assert.equal(carreraTramos.filter((resultado) => resultado.status === 'fulfilled').length, 1);
      assert.equal(await prisma.afp.count(), afpAntes);
      assert.equal(await prisma.prevision_salud.count(), saludAntes);
    } finally {
      await prisma.tramo_impuesto_renta.deleteMany({ where: { OR: [{ id_tramo_impuesto_renta: { in: idsTramos } }, { referencia: { contains: sufijo } }] } });
      await prisma.parametro_remuneracional.deleteMany({ where: { codigo: { in: [codigo, codigoCarrera, codigoPendiente] } } });
    }
  });

  await t.test('CU168 reutiliza concepto_remuneracion sin asignar ni calcular', async () => {
    const ids = [];
    const liquidacionesAntes = await prisma.liquidacion_remuneracion.count();
    try {
      let lista = await modulo.crearConceptoDeduccionAporte({ codigo: `D168${sufijo}`, nombre: `Deducción fixture ${sufijo}`, naturaleza: 'DEDUCCION', vigenciaDesde: '2090-01-01' });
      const deduccion = lista.find((item) => item.codigo === `D168${sufijo}`); ids.push(deduccion.id);
      lista = await modulo.crearConceptoDeduccionAporte({ codigo: `A168${sufijo}`, nombre: `Aporte fixture ${sufijo}`, naturaleza: 'APORTE_EMPLEADOR', vigenciaDesde: '2090-01-01' });
      const aporte = lista.find((item) => item.codigo === `A168${sufijo}`); ids.push(aporte.id);
      assert.deepEqual(new Set([deduccion.naturaleza, aporte.naturaleza]), new Set(['DEDUCCION', 'APORTE_EMPLEADOR']));
      assert.equal(deduccion.configuraciones.length, 0);
      assert.equal(aporte.configuraciones.length, 0);
      assert.equal((await modulo.actualizarConceptoDeduccionAporte(deduccion.id, { estado: 'inactivo' })).find((item) => item.id === deduccion.id).estado, 'inactivo');
      await assert.rejects(modulo.crearConceptoDeduccionAporte({ codigo: `X168${sufijo}`, nombre: 'Inválido', naturaleza: 'OTRO', modalidad: 'FIJO', valor: 1, vigenciaDesde: '2090-01-01' }), (error) => error.estado === 400);
      assert.equal(await prisma.asignacion_concepto_remuneracion_empleado.count({ where: { id_concepto: { in: ids } } }), 0);
      assert.equal(await prisma.liquidacion_remuneracion.count(), liquidacionesAntes);
      assert.ok((await prisma.concepto_remuneracion.count({ where: { naturaleza_concepto: 'haber' } })) >= 0);
    } finally {
      for (const id of ids) await borrarConcepto(id);
    }
  });

  await t.test('CU169 conserva una configuración provisional sin fórmula ni familia propia', async () => {
    const codigo = `PR169${sufijo}`;
    try {
      assert.ok(Array.isArray(await modulo.listarConfiguracionProrrateo()));
      await modulo.crearConfiguracionProrrateo({ codigo, nombre: 'Configuración pendiente', vigenciaDesde: '2090-01-01', vigenciaHasta: '2090-06-30', fuente: 'Fundamento artificial', referencia: 'PR-1', estado: 'pendiente' });
      await modulo.crearConfiguracionProrrateo({ codigo, nombre: 'Configuración futura', vigenciaDesde: '2090-07-01', fuente: 'Fundamento artificial', referencia: 'PR-2', estado: 'activo' });
      const historial = (await modulo.listarConfiguracionProrrateo()).filter((item) => item.codigo === codigo);
      assert.equal(historial.length, 2);
      assert.equal(historial.every((item) => item.valor === null), true);
      assert.deepEqual(new Set(historial.map((item) => item.estado)), new Set(['pendiente', 'activo']));
      assert.equal((await modulo.listarConfiguracionProrrateo('2090-03-01')).filter((item) => item.codigo === codigo).length, 1);
      await assert.rejects(modulo.resolverParametroRemuneracional(codigo, '2090-08-01'), (error) => error.estado === 404);
    } finally {
      await prisma.parametro_remuneracional.deleteMany({ where: { codigo } });
    }
  });

  await t.test('CU170 registra sólo elegibilidad descriptiva sin borrar ni anonimizar', async () => {
    const dia = new Date(Date.UTC(2080 + Number(sufijo.charCodeAt(2) % 10), Number(sufijo.charCodeAt(3) % 12), Number(sufijo.charCodeAt(4) % 20) + 1));
    const vigenciaDesde = dia.toISOString().slice(0, 10);
    const empleadosAntes = await prisma.empleado.count();
    let id;
    try {
      assert.ok(Array.isArray(await modulo.listarPoliticasConservacion()));
      const lista = await modulo.crearPoliticaConservacion({ estado: 'pendiente', vigenciaDesde, fuente: 'Fuente artificial', referencia: `C170-${sufijo}` });
      const politica = lista.find((item) => item.referencia === `C170-${sufijo}`); id = politica.id;
      assert.equal(politica.ejecutaTratamiento, false);
      assert.equal(politica.criterioDescriptivo, null);
      assert.equal(await prisma.empleado.count(), empleadosAntes);
    } finally {
      if (id) await prisma.configuracion_conservacion_documental.delete({ where: { id_configuracion_conservacion: id } });
    }
  });

  await t.test('CU171 distingue NULL Legacy de false y conserva M1-M5', async () => {
    const codigo = `MP171${sufijo}`;
    const nombre = `Medio Legacy ${sufijo}`;
    const pagosClienteAntes = await prisma.pago_cliente.count();
    const pagosProveedorAntes = await prisma.pago_proveedor.count();
    const ids = [];
    try {
      const legacy = await prisma.medio_pago.create({ data: { nombre_medio_pago: nombre } }); ids.push(legacy.id_medio_pago);
      const segundoLegacy = await prisma.medio_pago.create({ data: { nombre_medio_pago: `${nombre} 2` } }); ids.push(segundoLegacy.id_medio_pago);
      let medio = (await modulo.listarMediosPagoM6()).find((item) => item.id === legacy.id_medio_pago);
      assert.equal(medio.codigo, null);
      assert.equal(medio.requiereRespaldo, null);
      assert.equal((await modulo.listarMediosPagoM6(true)).some((item) => item.id === legacy.id_medio_pago), false);
      assert.equal((await new M3Controller().consultarCatalogos()).medios.some((item) => item.id_medio_pago === legacy.id_medio_pago), true);
      let lista = await modulo.actualizarMedioPagoM6(legacy.id_medio_pago, { codigo, requiereRespaldo: false });
      medio = lista.find((item) => item.id === legacy.id_medio_pago);
      assert.equal(medio.requiereRespaldo, false);
      assert.equal((await modulo.listarMediosPagoM6(true)).some((item) => item.id === legacy.id_medio_pago), true);
      lista = await modulo.actualizarMedioPagoM6(legacy.id_medio_pago, { requiereRespaldo: true });
      assert.equal(lista.find((item) => item.id === legacy.id_medio_pago).requiereRespaldo, true);
      await assert.rejects(modulo.crearMedioPagoM6({ codigo, nombre: `${nombre} duplicado`, requiereRespaldo: true }), (error) => error.estado === 409);
      assert.equal(await prisma.pago_cliente.count(), pagosClienteAntes);
      assert.equal(await prisma.pago_proveedor.count(), pagosProveedorAntes);
    } finally {
      await prisma.medio_pago.deleteMany({ where: { id_medio_pago: { in: ids } } });
    }
  });

  await t.test('permisos CU167-CU171 son individuales y no asignan perfiles', async () => {
    assert.equal(codigosTodosLosCU.length, 274);
    assert.equal(codigosTodosLosCU.includes('CU183'), true);
    for (let numero = 167; numero <= 171; numero++) assert.deepEqual(matrizPermisosPorCU[`CU${numero}`], []);
    assert.equal(operacionesPermiso.crearParametroRemuneracional, 'CU167');
    assert.equal(operacionesPermiso.crearConceptoDeduccionAporte, 'CU168');
    assert.equal(operacionesPermiso.crearConfiguracionProrrateo, 'CU169');
    assert.equal(operacionesPermiso.crearPoliticaConservacion, 'CU170');
    assert.equal(operacionesPermiso.crearMedioPagoM6, 'CU171');
    const actor = (permisos) => ({ autorizar: async (operacion) => {
      if (!permiteOperacion(operacion, permisos)) { const error = new Error('No autorizado'); error.estado = 403; throw error; }
      return { id: 1n, permisos, configuracion: 'particular', administrador: false };
    } });
    const fachada = (permisos) => new C_Finanzas(actor(permisos), {}, {}, {}, {}, {}, modulo);
    assert.ok(Array.isArray(await fachada(['CU168']).ejecutar('listarConceptosDeduccionAporte', { contexto: {} })));
    await assert.rejects(fachada(['CU168']).ejecutar('crearParametroRemuneracional', { contexto: {}, cuerpo: {} }), (error) => error.estado === 403);
    assert.ok(Array.isArray(await fachada(['CU171']).ejecutar('listarMediosPagoM6', { contexto: {} })));
    await assert.rejects(fachada(['CU171']).ejecutar('crearParametroRemuneracional', { contexto: {}, cuerpo: {} }), (error) => error.estado === 403);
    await assert.rejects(fachada(['CU167']).ejecutar('crearConceptoDeduccionAporte', { contexto: {}, cuerpo: {} }), (error) => error.estado === 403);
  });

  await t.test('persistencia y frontend respetan las decisiones de alcance', () => {
    const schema = readFileSync(resolve('prisma/schema.prisma'), 'utf8');
    const migracion = readFileSync(resolve('prisma/migrations/027_m6_parametros_configuraciones/migration.sql'), 'utf8');
    const controlador = readFileSync(resolve('src/controladores/M6Controller.ts'), 'utf8');
    const app = readFileSync(resolve('../Vistas/src/App.tsx'), 'utf8');
    const menu = readFileSync(resolve('../Vistas/src/views/DashboardWrapper/DashboardWrapper.tsx'), 'utf8');
    const vista = readFileSync(resolve('../Vistas/src/views/MantenedorParametros/MantenedorParametros.tsx'), 'utf8');
    const conjunto = `${schema}\n${migracion}\n${controlador}`;
    assert.doesNotMatch(conjunto, /version_parametro_remuneracional|parametro_remuneracional_version|model\s+regla_prorrateo|version_regla_prorrateo|aplicacion_prorrateo|historial_prorrateo|politica_conservacion_version|historial_politica_conservacion|eval\s*\(|new\s+Function\s*\(/i);
    assert.doesNotMatch(schema, /model\s+(deduccion|aporte_empleador)\s*\{/i);
    assert.match(schema, /model\s+concepto_remuneracion\s*\{/);
    assert.match(schema, /model\s+medio_pago\s*\{[\s\S]*requiere_respaldo\s+Boolean\?/);
    assert.match(app, /\['CU167','CU168','CU169','CU170','CU171','CU246'\]/);
    assert.match(menu, /permissions:\s*\['CU167', 'CU168', 'CU169', 'CU170', 'CU171', 'CU246'\]/);
    for (let numero = 167; numero <= 171; numero++) assert.match(vista, new RegExp(`puede${numero}`));
    assert.doesNotMatch(vista, /CU172/);
  });
});
