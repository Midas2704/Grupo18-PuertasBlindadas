const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { M7Controller } = require('../dist/controladores/M7Controller');
const { codigosTodosLosCU, operacionesPermiso, permiteOperacion } = require('../dist/validaciones/permisos');

test('M7 rebaseline definitivo CU215-CU258', async t => {
  await t.test('operaciones existentes usan los CU definitivos', () => {
    assert.equal(operacionesPermiso.consultarAnalisisVentasM7, 'CU219');
    assert.equal(operacionesPermiso.consultarCuentasCobrarM7, 'CU222');
    assert.equal(operacionesPermiso.consultarCuentasPagarM7, 'CU226');
    assert.equal(operacionesPermiso.consultarLiquidezM7, 'CU230');
    assert.equal(operacionesPermiso.consultarMargenProyectosM7, 'CU233');
    assert.equal(operacionesPermiso.consultarResumenResultadosM7, 'CU238');
    assert.equal(operacionesPermiso.consultarSituacionFinancieraM7, 'CU239');
    assert.equal(operacionesPermiso.descargarPdfDashboardM7, 'CU245');
    assert.equal(operacionesPermiso.configurarUmbralMargenM7, 'CU246');
  });

  await t.test('números provisionales no conceden las capacidades remapeadas', () => {
    assert.equal(permiteOperacion('consultarAnalisisVentasM7', ['CU216']), false);
    assert.equal(permiteOperacion('consultarCuentasCobrarM7', ['CU217']), false);
    assert.equal(permiteOperacion('consultarCuentasPagarM7', ['CU218']), false);
    assert.equal(permiteOperacion('consultarLiquidezM7', ['CU219']), false);
    assert.equal(permiteOperacion('consultarMargenProyectosM7', ['CU220']), false);
  });

  await t.test('permisos alternativos sólo abren su segmento real', () => {
    assert.equal(permiteOperacion('consultarAnalisisVentasM7', ['CU220']), true);
    assert.equal(permiteOperacion('consultarCuentasCobrarM7', ['CU223']), true);
    assert.equal(permiteOperacion('consultarCuentasCobrarM7', ['CU225']), true);
    assert.equal(permiteOperacion('consultarCuentasPagarM7', ['CU227']), true);
    assert.equal(permiteOperacion('consultarLiquidezM7', ['CU231']), true);
    assert.equal(permiteOperacion('consultarMargenProyectosM7', ['CU234']), true);
    assert.equal(permiteOperacion('consultarMargenProyectosM7', ['CU235']), true);
  });

  await t.test('CU245 sin permiso del análisis de origen no descarga', async () => {
    await assert.rejects(
      new M7Controller().descargarPdfContextual({ origen: 'margen', consulta: {} }, ['CU245']),
      error => error.estado === 403,
    );
  });

  await t.test('CU233 no filtra información propia de CU234 o CU235', async () => {
    const modulo = new M7Controller();
    modulo.consultarMargenProyectosCompleto = async () => ({
      periodo: {}, estado: 'VALIDO', umbralMargen: {}, cobertura: {},
      proyectos: [{ idProyecto: 1, codigo: 'P', proyectoTerreno: null, nombre: 'P', moneda: 'CLP', estado: 'VALIDO', margenDirecto: 10, porcentajeMargen: 10, clasificacion: 'OK', ingresosAtribuibles: 100, desgloseIngresos: [1], costosDirectosAtribuibles: 90, desgloseCostos: [2], cobertura: {} }],
    });
    const resultado = await modulo.consultarMargenProyectos({}, ['CU233']);
    assert.equal(resultado.proyectos[0].margenDirecto, 10);
    assert.equal('ingresosAtribuibles' in resultado.proyectos[0], false);
    assert.equal('costosDirectosAtribuibles' in resultado.proyectos[0], false);
  });

  await t.test('CU228 y CU229 acceden a segmentos independientes de liquidez', () => {
    assert.equal(permiteOperacion('consultarLiquidezM7', ['CU228']), true);
    assert.equal(permiteOperacion('consultarLiquidezM7', ['CU229']), true);
    assert.equal(permiteOperacion('registrarAjusteLiquidezM7', ['CU229']), false);
  });

  await t.test('M7 definitivo termina en CU258 y CU259 pertenece a M8', () => {
    const fuentes = [
      readFileSync(resolve('src/validaciones/permisos.ts'), 'utf8'),
      readFileSync(resolve('src/controladores/M7Controller.ts'), 'utf8'),
      readFileSync(resolve('../Vistas/src/App.tsx'), 'utf8'),
    ].join('\n');
    assert.equal(codigosTodosLosCU.length, 274);
    assert.equal(codigosTodosLosCU[257], 'CU258');
    assert.equal(codigosTodosLosCU.at(-1), 'CU274');
    assert.doesNotMatch(fuentes, /CU249-PRE/);
  });
});
