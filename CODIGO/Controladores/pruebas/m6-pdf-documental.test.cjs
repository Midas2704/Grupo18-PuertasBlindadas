const test = require('node:test');
const assert = require('node:assert/strict');
const {
  archivoLiquidacionM6,
  archivoCalculoPreliminarM6,
  archivoPeriodoRemuneracionesM6,
  archivoComprobanteAnticipoM6,
  formatoClpM6,
} = require('../dist/m6/documentosRemuneracionPdf');

const decodificar = archivo => Buffer.from(archivo.contenido.split(',')[1], 'base64').toString('latin1');
const empleado = {
  nombres: 'Camila Fernanda', apellido_paterno: 'Rojas', apellido_materno: 'Soto', rut_empleado: '12345678-5',
  fecha_ingreso: new Date('2024-03-04T00:00:00Z'), cargo: { nombre_cargo: 'Técnica de instalación' },
  asignaciones_esquema_remuneracional: [{ activa: true, vigencia_desde: new Date('2024-03-01'), vigencia_hasta: null, esquema: { nombre: 'DEMO-UI Esquema 1' } }],
};
const periodo = { anio: 2026, mes: 9, fecha_inicio: new Date('2026-09-01'), fecha_fin: new Date('2026-09-30') };
const componentes = [
  { tipo: 'SUELDO_BASE', descripcion: 'DEMO-UI sueldo', monto: 1_200_000, direccion: 'POSITIVO', concepto: null },
  { tipo: 'HABER_AUTOMATICO', descripcion: 'Bono de producción', monto: 180_000, direccion: 'POSITIVO', concepto: { naturaleza_concepto: 'haber' } },
  { tipo: 'DEDUCCION_AUTOMATICA', descripcion: 'DEMO-UI deduccion', monto: 100_000, direccion: 'NEGATIVO', concepto: { naturaleza_concepto: 'descuento' } },
  { tipo: 'APORTE_EMPLEADOR_AUTOMATICO', descripcion: 'Aporte empleador', monto: 75_000, direccion: 'POSITIVO', concepto: { naturaleza_concepto: 'aporte_empleador' } },
];
const remuneracion = {
  id_remuneracion: 77, estado: 'cerrada', empleado, periodo, cerrado_en: new Date('2026-10-02T14:30:00Z'), componentes,
  total_haberes: 1_380_000, total_deducciones: 100_000, total_aportes_empleador: 75_000,
  base_imponible: 1_200_000, base_tributable: 1_100_000, liquido_preliminar: 1_280_000,
};

test('M6 genera documentos laborales profesionales sin alterar cálculos', async t => {
  await t.test('liquidación oficial presenta empleado, componentes, totales y condición vigente', () => {
    const pdf = decodificar(archivoLiquidacionM6(remuneracion));
    assert.match(pdf, /Liquidación de Remuneración/); assert.match(pdf, /Oficial vigente/);
    for (const texto of ['Camila Fernanda Rojas Soto', '12.345.678-5', 'Técnica de instalación', '09/2026', 'Haber', 'Deducción', 'Aporte empleador', 'LÍQUIDO A PAGAR', '$1.280.000']) assert.ok(pdf.includes(texto), `Falta texto: ${texto}`);
    assert.match(pdf, /no reducen el líquido del trabajador/); assert.doesNotMatch(pdf, /estado_revision|liquido_preliminar|\{"/);
    assert.match(pdf, /Esquema 1/); assert.match(pdf, /Sueldo/); assert.match(pdf, /Deducción/); assert.doesNotMatch(pdf, /DEMO-UI/);
    assert.doesNotMatch(pdf, /0\.180 0\.490 0\.196/);
    assert.equal((pdf.match(/\/Type \/Page\b/g) || []).length, 1);
  });

  await t.test('liquidación histórica queda diferenciada de la vigente', () => {
    const pdf = decodificar(archivoLiquidacionM6({ ...remuneracion, estado: 'reemplazada' }));
    assert.match(pdf, /Documento histórico - reemplazado/); assert.doesNotMatch(pdf, /Oficial vigente/);
  });

  await t.test('preliminar es no oficial y conserva bloqueos y advertencias humanizados', () => {
    const pdf = decodificar(archivoCalculoPreliminarM6({ ...remuneracion, estado: 'abierta', cerrado_en: null }, {
      bloqueos: [{ codigo: 'TEMPORAL_M6_SIN_TRAMO', detalle: 'Falta tramo tributario vigente' }],
      advertencias: [{ codigo: 'REVISION_MONTO', detalle: 'Revisar monto excepcional' }],
    }));
    assert.match(pdf, /CÁLCULO PRELIMINAR/); assert.match(pdf, /NO OFICIAL/); assert.match(pdf, /Bloqueos detectados/); assert.match(pdf, /Falta tramo tributario vigente/); assert.match(pdf, /Advertencias/);
    assert.match(pdf, /Este documento no constituye una liquidación oficial/); assert.doesNotMatch(pdf, /TEMPORAL_M6_SIN_TRAMO:/);
    assert.ok((pdf.match(/\/Type \/Page\b/g) || []).length <= 2);
  });

  await t.test('documentos complejos agregan páginas sin perder componentes', () => {
    const muchos = Array.from({ length: 25 }, (_, indice) => ({ tipo: 'HABER_AUTOMATICO', descripcion: `Concepto especial ${indice + 1}`, monto: 10_000 + indice, direccion: 'POSITIVO', concepto: { naturaleza_concepto: 'haber' } }));
    const pdf = decodificar(archivoLiquidacionM6({ ...remuneracion, componentes: muchos }));
    assert.ok((pdf.match(/\/Type \/Page\b/g) || []).length > 1);
    for (let indice = 1; indice <= 25; indice++) assert.match(pdf, new RegExp(`Concepto especial ${indice}`));
  });

  await t.test('informe de período agrega valores directos y pagina la nómina completa', () => {
    const items = Array.from({ length: 22 }, (_, indice) => ({ ...remuneracion, id_remuneracion: 100 + indice, empleado: { ...empleado, nombres: `Empleado ${String(indice + 1).padStart(2, '0')}` } }));
    const pdf = decodificar(archivoPeriodoRemuneracionesM6(items, 2026, 9));
    assert.match(pdf, /Informe de Remuneraciones Oficiales/); assert.match(pdf, /22/); assert.match(pdf, /\$30.360.000/); assert.match(pdf, /\$28.160.000/); assert.match(pdf, /\$1.650.000/);
    for (let indice = 1; indice <= 22; indice++) assert.match(pdf, new RegExp(`Empleado ${String(indice).padStart(2, '0')}`));
    assert.equal((pdf.match(/\/Type \/Page\b/g) || []).length, 3); assert.doesNotMatch(pdf, /id_remuneracion|Remuneracion 1/);
  });

  await t.test('comprobante de anticipo respeta reversiones y humaniza estado', () => {
    const anticipo = { id_anticipo: 9, empleado, periodo, monto_final: 150_000 };
    const pagos = [{ monto: 150_000, estado: 'CONFIRMADO', confirmado_en: new Date('2026-09-15T12:00:00Z'), reversiones: [{ monto: 40_000 }] }];
    const pdf = decodificar(archivoComprobanteAnticipoM6(anticipo, pagos));
    assert.match(pdf, /Comprobante de Anticipo/); assert.match(pdf, /15-09-2026/); assert.match(pdf, /\$150.000/); assert.match(pdf, /\$40.000/); assert.match(pdf, /\$110.000/); assert.match(pdf, /Confirmado/); assert.match(pdf, /Con pago efectivo/);
    assert.doesNotMatch(pdf, /Pago 9|CON PAGO EFECTIVO/); assert.equal((pdf.match(/\/Type \/Page\b/g) || []).length, 1);
  });

  await t.test('formato monetario usa CLP y signo correcto', () => {
    assert.equal(formatoClpM6(1_234_567), '$1.234.567'); assert.equal(formatoClpM6(-123_456), '-$123.456'); assert.equal(formatoClpM6(null), 'Pendiente de cálculo');
  });
});
