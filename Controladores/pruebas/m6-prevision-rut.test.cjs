const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Prisma } = require('@prisma/client');
const { calcularPrevisionLegal } = require('../dist/m6/calculoPrevisional');
const { esRutValido, normalizarRut, validarYNormalizarRut } = require('../dist/utilidades/rut');

const fecha = valor => new Date(`${valor}T00:00:00Z`);
const parametro = (id, codigo, valor, unidad = 'FACTOR_DECIMAL') => ({
  id_parametro_remuneracional: id, codigo, tipo: 'PREVISIONAL', nombre: codigo,
  descripcion: null, valor: new Prisma.Decimal(valor), unidad,
  vigencia_desde: fecha('2026-10-01'), vigencia_hasta: fecha('2026-10-31'),
  fuente: 'Prueba focal', referencia: null, estado: 'activo', creado_en: fecha('2026-10-01'),
});

function parametros() {
  const datos = [
    ['UF_CLP', 40000, 'CLP_POR_UF'], ['TOPE_AFP_UF', 90, 'UF'], ['TOPE_SALUD_UF', 90, 'UF'],
    ['TOPE_LEY16744_UF', 90, 'UF'], ['TOPE_CESANTIA_UF', 135.2, 'UF'],
    ['AFP_COTIZACION_OBLIGATORIA', 0.10], ['AFP_COMISION_HABITAT', 0.0127], ['AFP_COMISION_MODELO', 0.0058],
    ['SALUD_TASA_LEGAL', 0.07], ['CESANTIA_TRABAJADOR_INDEFINIDO', 0.006],
    ['CESANTIA_EMPLEADOR_INDEFINIDO', 0.024], ['CESANTIA_EMPLEADOR_PLAZO', 0.03],
    ['REFORMA_CUENTA_INDIVIDUAL', 0.001], ['REFORMA_CRP', 0.009], ['REFORMA_SIS_CEV', 0.025],
    ['SIS_TASA_INFORMATIVA', 0.0162], ['LEY16744_TASA_BASE', 0.009], ['LEY16744_TASA_ADICIONAL', 0.002],
    ['SANNA_TASA', 0.0003],
  ];
  return datos.map(([codigo, valor, unidad], indice) => parametro(indice + 1, codigo, valor, unidad));
}

const tramos = [
  { id_tramo_impuesto_renta: 1, vigencia_desde: fecha('2026-10-01'), vigencia_hasta: fecha('2026-10-31'), orden: 1, limite_desde: new Prisma.Decimal(0), limite_hasta: new Prisma.Decimal('974038.50'), factor: new Prisma.Decimal(0), rebaja: new Prisma.Decimal(0), unidad: 'CLP', estado: 'activo' },
  { id_tramo_impuesto_renta: 2, vigencia_desde: fecha('2026-10-01'), vigencia_hasta: fecha('2026-10-31'), orden: 2, limite_desde: new Prisma.Decimal('974038.51'), limite_hasta: new Prisma.Decimal(2164530), factor: new Prisma.Decimal('0.04'), rebaja: new Prisma.Decimal('38961.54'), unidad: 'CLP', estado: 'activo' },
  { id_tramo_impuesto_renta: 3, vigencia_desde: fecha('2026-10-01'), vigencia_hasta: fecha('2026-10-31'), orden: 3, limite_desde: new Prisma.Decimal('2164530.01'), limite_hasta: null, factor: new Prisma.Decimal('0.08'), rebaja: new Prisma.Decimal('125542.74'), unidad: 'CLP', estado: 'activo' },
];

function tx({ lista = parametros(), vinculo = 'Contrato indefinido', plan = [] } = {}) {
  return {
    parametro_remuneracional: { findMany: async () => lista },
    cotizacion_salud_empleado: { findMany: async () => plan },
    relacion_laboral_empleado: { findMany: async () => [{ tipo_vinculo_laboral: { nombre_tipo_vinculo_laboral: vinculo } }] },
    tramo_impuesto_renta: { findMany: async () => tramos },
  };
}

const entrada = (cambios = {}) => ({
  idEmpleado: 1, fechaInicio: fecha('2026-10-01'), fechaFin: fecha('2026-10-31'),
  baseImponible: new Prisma.Decimal(2000000), afp: 'AFP Habitat',
  salud: { nombre: 'Fonasa', tipo: 'FONASA' }, seguroCesantia: true,
  fundamentoExclusionCesantia: null, ...cambios,
});

test('M6 calcula previsión legal versionada sin mezclar aportes patronales', async () => {
  const resultado = await calcularPrevisionLegal(tx(), entrada());
  assert.equal(resultado.descuentosPrevisionales.toNumber(), 377400);
  assert.equal(resultado.baseTributable.toNumber(), 1622600);
  assert.equal(resultado.impuesto.toNumber(), 25942);
  assert.equal(resultado.aportesEmpleador.toNumber(), 140600);
  assert.equal(resultado.componentes.some(item => item.claveNegocio === 'SIS_TASA_INFORMATIVA'), false);
  assert.equal(resultado.componentes.filter(item => item.claveNegocio.startsWith('REFORMA_')).reduce((total, item) => total + item.monto.toNumber(), 0), 70000);
  assert.equal(resultado.snapshot.impuesto.factor, '0.04');
  assert.equal(resultado.snapshot.impuesto.rebaja, '38961.54');
  assert.equal(resultado.snapshot.parametros.find(item => item.codigo === 'UF_CLP').valor, '40000');
});

test('M6 aplica Isapre, vínculo y comisión AFP sin alterar reglas ajenas', async t => {
  await t.test('plan Isapre superior al siete por ciento genera sólo el adicional', async () => {
    const plan = [{ id_cotizacion_salud: 7, id_empleado: 1, valor: new Prisma.Decimal('0.08'), unidad: 'PORCENTAJE', vigencia_desde: fecha('2026-10-01'), vigencia_hasta: null, activa: true }];
    const resultado = await calcularPrevisionLegal(tx({ plan }), entrada({ salud: { nombre: 'Isapre de prueba', tipo: 'ISAPRE' } }));
    assert.equal(resultado.componentes.find(item => item.claveNegocio === 'SALUD_ADICIONAL_ISAPRE').monto.toNumber(), 20000);
  });
  await t.test('plan Isapre igual al siete por ciento no genera adicional', async () => {
    const plan = [{ id_cotizacion_salud: 8, id_empleado: 1, valor: new Prisma.Decimal('0.07'), unidad: 'PORCENTAJE', vigencia_desde: fecha('2026-10-01'), vigencia_hasta: null, activa: true }];
    const resultado = await calcularPrevisionLegal(tx({ plan }), entrada({ salud: { nombre: 'Isapre de prueba', tipo: 'ISAPRE' } }));
    assert.equal(resultado.componentes.some(item => item.claveNegocio === 'SALUD_ADICIONAL_ISAPRE'), false);
    assert.equal(resultado.snapshot.salud.plan.valor, '0.07');
  });
  await t.test('plazo fijo no descuenta cesantía al trabajador', async () => {
    const resultado = await calcularPrevisionLegal(tx({ vinculo: 'Contrato a plazo fijo' }), entrada());
    assert.equal(resultado.componentes.some(item => item.claveNegocio === 'CESANTIA_TRABAJADOR'), false);
    assert.equal(resultado.componentes.find(item => item.claveNegocio === 'CESANTIA_EMPLEADOR').monto.toNumber(), 60000);
  });
  await t.test('exclusión fundada no aplica cesantía de trabajador ni empleador', async () => {
    const resultado = await calcularPrevisionLegal(tx(), entrada({ seguroCesantia: false, fundamentoExclusionCesantia: 'Exclusión legal acreditada en antecedentes laborales' }));
    assert.equal(resultado.componentes.some(item => item.claveNegocio.startsWith('CESANTIA_')), false);
    assert.equal(resultado.snapshot.seguroCesantia.incluido, false);
    assert.match(resultado.snapshot.seguroCesantia.fundamentoExclusion, /Exclusión legal/);
  });
  await t.test('la AFP seleccionada cambia sólo su comisión', async () => {
    const habitat = await calcularPrevisionLegal(tx(), entrada());
    const modelo = await calcularPrevisionLegal(tx(), entrada({ afp: 'Modelo' }));
    assert.equal(habitat.componentes.find(item => item.claveNegocio === 'AFP_COTIZACION_OBLIGATORIA').monto.toNumber(), modelo.componentes.find(item => item.claveNegocio === 'AFP_COTIZACION_OBLIGATORIA').monto.toNumber());
    assert.notEqual(habitat.componentes.find(item => item.claveNegocio === 'AFP_COMISION').monto.toNumber(), modelo.componentes.find(item => item.claveNegocio === 'AFP_COMISION').monto.toNumber());
  });
});

test('M6 activa la reforma sólo por parámetros vigentes y no por una fecha hardcodeada', async t => {
  const sinReforma = parametros().filter(item => !item.codigo.startsWith('REFORMA_') && item.codigo !== 'SIS_TASA_INFORMATIVA');
  await t.test('período sin parámetros de reforma no agrega aportes de reforma', async () => {
    const resultado = await calcularPrevisionLegal(tx({ lista: sinReforma }), entrada({ fechaInicio: fecha('2026-07-01'), fechaFin: fecha('2026-07-31') }));
    assert.equal(resultado.componentes.some(item => item.claveNegocio.startsWith('REFORMA_')), false);
  });
  await t.test('período con parámetros de reforma agrega exactamente 3,5%', async () => {
    const resultado = await calcularPrevisionLegal(tx(), entrada({ fechaInicio: fecha('2026-08-01'), fechaFin: fecha('2026-08-31') }));
    const reforma = resultado.componentes.filter(item => item.claveNegocio.startsWith('REFORMA_'));
    assert.equal(reforma.length, 3);
    assert.equal(reforma.reduce((total, item) => total + item.monto.toNumber(), 0), 70000);
    assert.equal(resultado.componentes.some(item => item.claveNegocio === 'SIS_TASA_INFORMATIVA'), false);
  });
  await t.test('configuración parcial de reforma bloquea el cálculo', async () => {
    const parcial = parametros().filter(item => item.codigo !== 'REFORMA_CRP');
    await assert.rejects(() => calcularPrevisionLegal(tx({ lista: parcial }), entrada()), error => error.codigo === 'CONFIGURACION_PREVISIONAL_INCOMPLETA');
  });
});

test('M6 respeta topes, exención tributaria y bloquea configuración incompleta', async t => {
  const alto = await calcularPrevisionLegal(tx(), entrada({ baseImponible: new Prisma.Decimal(10000000) }));
  assert.equal(alto.componentes.find(item => item.claveNegocio === 'AFP_COTIZACION_OBLIGATORIA').monto.toNumber(), 360000);
  const bajo = await calcularPrevisionLegal(tx(), entrada({ baseImponible: new Prisma.Decimal(700000) }));
  assert.equal(bajo.impuesto.toNumber(), 0);
  const incompletos = parametros().filter(item => item.codigo !== 'UF_CLP');
  await assert.rejects(() => calcularPrevisionLegal(tx({ lista: incompletos }), entrada()), error => error.codigo === 'CONFIGURACION_PREVISIONAL_INCOMPLETA');
  const sinAdicionalLey = parametros().filter(item => item.codigo !== 'LEY16744_TASA_ADICIONAL');
  await assert.rejects(() => calcularPrevisionLegal(tx({ lista: sinAdicionalLey }), entrada()), error => error.codigo === 'CONFIGURACION_PREVISIONAL_INCOMPLETA');
});

test('M6 no inventa reglas previsionales para DIPRECA u Otro', async () => {
  for (const salud of [
    { nombre: 'DIPRECA', tipo: 'DIPRECA' },
    { nombre: 'Otro', tipo: 'OTRO' },
  ]) {
    await assert.rejects(
      () => calcularPrevisionLegal(tx(), entrada({ salud })),
      error => error.codigo === 'CONFIGURACION_PREVISIONAL_INCOMPLETA' && /no tiene una regla previsional configurada/.test(error.message),
    );
  }
});

test('RUT módulo 11 acepta formatos válidos y rechaza dígitos incorrectos', () => {
  for (const valor of ['12.345.678-5', '12345678-5', '20.776.101-K', '20776101-k']) assert.equal(esRutValido(valor), true);
  for (const valor of ['12.345.678-4', '20.776.101-1', 'texto', '']) assert.equal(esRutValido(valor), false);
  assert.equal(normalizarRut('20776101-k'), '20.776.101-K');
  assert.throws(() => validarYNormalizarRut('12.345.678-4'), error => error.codigo === 'RUT_INVALIDO');
});
