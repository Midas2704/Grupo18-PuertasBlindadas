const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { M7Controller } = require('../dist/controladores/M7Controller');
const { operacionesPermiso } = require('../dist/validaciones/permisos');

const permisos = ['CU215','CU218','CU219','CU220','CU230','CU238','CU242','CU247','CU250','CU253'];
const claves = datos => datos.meses.map(fila => fila.periodo);

test('M7 histórico gerencial de doce meses', async t => {
  const controlador = new M7Controller();
  const octubre = await controlador.consultarHistoricoPanelGeneral({ anio: 2026, mes: 10, meses: 12 }, permisos);
  const octubreComparativo = await controlador.consultarHistoricoPanelGeneral({ anio: 2026, mes: 10, meses: 13 }, permisos);
  const abril = await controlador.consultarHistoricoPanelGeneral({ anio: 2026, mes: 4, meses: 12 }, permisos);
  const vacio = await controlador.consultarHistoricoPanelGeneral({ anio: 2190, mes: 12, meses: 12 }, permisos);

  await t.test('devuelve exactamente doce períodos para octubre 2026', () => assert.deepEqual(claves(octubre), ['2025-11','2025-12','2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07','2026-08','2026-09','2026-10']));
  await t.test('comparación interanual de octubre 2026 incluye octubre 2025 y conserva doce meses visibles', () => {
    assert.deepEqual(claves(octubreComparativo), ['2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07','2026-08','2026-09','2026-10']);
    assert.deepEqual(claves(octubreComparativo).slice(-12), claves(octubre));
    const fuente = readFileSync(resolve('../Vistas/src/views/DashboardM7/PanelGeneralM7.tsx'), 'utf8');
    assert.match(fuente, /historico\?anio=\$\{anio\}&mes=\$\{mes\}&meses=13/);
    assert.match(fuente, /mesesComparacion\.slice\(-12\)/);
    assert.match(fuente, /meses\.length === 13 \? meses\[0\]/);
  });
  await t.test('cambiar el corte desplaza la ventana completa', () => assert.deepEqual(claves(abril), ['2025-05','2025-06','2025-07','2025-08','2025-09','2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04']));
  await t.test('orden cronológico estable', () => assert.deepEqual(claves(octubre), [...claves(octubre)].sort()));
  await t.test('mes sin hechos no fabrica costos ni resultado cero', () => { assert.ok(vacio.meses.every(fila => fila.ventasNetas === null && fila.costosDirectos === null && fila.resultadoGerencial === null)); });
  await t.test('cobertura evita falsa evolución CxC CxP Crédito e Inventario', () => { for (const clave of ['cuentasCobrar','cuentasPagar','credito','inventario']) assert.match(octubre.cobertura[clave], /NO_HISTORIZABLE|CORTE_DISPONIBLE/); });
  await t.test('Resultado gerencial conserva cobertura limitada', () => assert.match(octubre.cobertura.resultadoGerencial, /costos directos atribuibles.*no es un Estado de Resultados/i));
  await t.test('permiso y ruta reutilizan CU215', () => { assert.equal(operacionesPermiso.consultarHistoricoPanelGeneralM7, 'CU215'); assert.match(readFileSync(resolve('src/rutas/finanzas.ts'), 'utf8'), /dashboard-m7\/historico/); });
  await t.test('frontend consume una fuente histórica acotada', () => { const fuente = readFileSync(resolve('../Vistas/src/views/DashboardM7/PanelGeneralM7.tsx'), 'utf8'); assert.match(fuente, /dashboard-m7\/historico/); assert.doesNotMatch(fuente, /Array\.from\(\{ length: 12 \}.*dashboard-m7/s); });
  await t.test('ventana inválida se rechaza', async () => assert.rejects(controlador.consultarHistoricoPanelGeneral({ anio: 2026, mes: 10, meses: 25 }, permisos), error => error.estado === 400));
});
