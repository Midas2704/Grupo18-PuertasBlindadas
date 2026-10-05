const test = require('node:test');
const assert = require('node:assert/strict');
const { M9Controller } = require('../dist/controladores/M9Controller');
const { RepositorioAuditoriaM9Memoria } = require('../dist/m9/RepositorioAuditoriaM9');
const { RelojFijoM9 } = require('../dist/m9/puertos');

const decodificar = salida => Buffer.from(salida.contenido.split(',')[1], 'base64').toString('latin1');
const entrada = indice => ({
  identidadLogica: `DEMO-UI_ESCENARIO_${indice}`,
  versionContrato: '1.0',
  ocurridoEn: `2026-09-${String((indice % 28) + 1).padStart(2, '0')}T${String(indice % 24).padStart(2, '0')}:15:00Z`,
  zonaHoraria: 'UTC',
  ejecutor: indice % 5 === 0 ? { tipo: 'SISTEMA', referencia: 'M9' } : { tipo: 'HUMANO', referencia: String((indice % 9) + 1) },
  productor: `M${(indice % 9) + 1}`,
  modulo: `M${(indice % 9) + 1}`,
  operacion: indice % 2 ? 'CONSULTA_EVIDENCIA' : 'EXPORTACION_DASHBOARD_CONFIRMADA',
  resultado: indice <= 30 ? 'EXITOSO' : indice <= 38 ? 'RECHAZADO' : 'FALLIDO',
  referencia: { tipo: 'CASO', id: `REF-${String(indice).padStart(2, '0')}` },
  capacidad: 'EMITIR_EVENTO_M9',
});

test('M9 exporta un informe PDF profesional, completo y paginado', async t => {
  const repo = new RepositorioAuditoriaM9Memoria();
  const modulo = new M9Controller({ repositorio: repo, reloj: new RelojFijoM9(new Date('2026-10-03T15:30:00Z')) });
  for (let indice = 1; indice <= 44; indice++) await modulo.recibir(entrada(indice));
  const scope = { solicitante: '8', permitirCambios: true, permitirMotivos: true };
  const salida = await modulo.exportar('PDF', {}, scope), pdf = decodificar(salida);

  await t.test('conserva exactamente los 44 eventos congelados', () => {
    assert.equal(salida.total, 44);
    const referencias = [...pdf.matchAll(/Caso REF-(\d{2})/g)].map(coincidencia => coincidencia[1]);
    assert.equal(referencias.length, 44); assert.equal(new Set(referencias).size, 44);
  });
  await t.test('incluye encabezado, solicitante humano y resumen ejecutivo', () => {
    assert.match(pdf, /Informe de Auditoría/); assert.match(pdf, /Puertas Blindadas - Módulo de Auditoría M9/);
    assert.match(pdf, /Solicitante: Usuario #8/); assert.match(pdf, /Eventos exportados: 44/);
    assert.match(pdf, /Exitosos/); assert.match(pdf, /30/); assert.match(pdf, /68,2%/);
    assert.match(pdf, /Rechazados/); assert.match(pdf, /8/); assert.match(pdf, /18,2%/);
    assert.match(pdf, /Fallidos/); assert.match(pdf, /6/); assert.match(pdf, /13,6%/);
  });
  await t.test('muestra módulos ordenados y operaciones humanizadas', () => {
    for (let modulo = 1; modulo <= 9; modulo++) assert.match(pdf, new RegExp(`\\(M${modulo}\\)`));
    assert.match(pdf, /Consulta de evidencia/); assert.match(pdf, /Exportación de Dashboard confirmada/);
  });
  await t.test('pagina tabla sin cortar filas y repite cabecera y pie', () => {
    const paginas = (pdf.match(/\/Type \/Page\b/g) || []).length;
    assert.ok(paginas >= 2); assert.equal((pdf.match(/Fecha y hora/g) || []).length, paginas);
    assert.equal((pdf.match(/Documento generado por el Sistema Financiero Puertas Blindadas/g) || []).length, paginas);
    for (let pagina = 1; pagina <= paginas; pagina++) assert.match(pdf, new RegExp(`Página ${pagina} de ${paginas}`));
  });
  await t.test('informa filtros aplicados sin alterar el conjunto filtrado', async () => {
    const filtrado = await modulo.exportar('PDF', { modulo: 'M7', resultado: 'EXITOSO', buscar: 'ESCENARIO', desde: '2026-09-01', hasta: '2026-09-30' }, scope);
    const contenido = decodificar(filtrado);
    assert.ok(filtrado.total > 0); assert.match(contenido, /Módulo: M7/); assert.match(contenido, /Resultado: Exitoso/);
    assert.match(contenido, /Búsqueda: ESCENARIO/); assert.match(contenido, /Desde: 01-09-2026/); assert.match(contenido, /Hasta: 30-09-2026/);
  });
  await t.test('no presenta valores nulos ni payloads técnicos en el cuerpo', () => {
    assert.doesNotMatch(pdf, /\bnull\b|\bundefined\b|\{\}/); assert.doesNotMatch(pdf, /hashIntegridad|versionContrato|payload/i);
  });
});
