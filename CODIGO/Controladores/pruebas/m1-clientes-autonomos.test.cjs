const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { M1Controller } = require('../dist/controladores/M1Controller');
const { prisma } = require('../dist/db');
const { esRutValido, normalizarRut } = require('../dist/utilidades/rut');

const modulo = new M1Controller();
const clientesCreados = [];

function calcularDv(cuerpo) {
  let suma = 0;
  let multiplicador = 2;
  for (let indice = cuerpo.length - 1; indice >= 0; indice--) {
    suma += Number(cuerpo[indice]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }
  const resultado = 11 - (suma % 11);
  return resultado === 11 ? '0' : resultado === 10 ? 'K' : String(resultado);
}

async function rutNuevoDisponible() {
  for (let intento = 0; intento < 100; intento++) {
    const cuerpo = String(78000000 + Math.floor(Math.random() * 1000000));
    const compacto = `${cuerpo}-${calcularDv(cuerpo)}`;
    const canonico = normalizarRut(compacto);
    const [finanzas, terreno] = await Promise.all([
      prisma.cliente_financiero.count({ where: { rut_cliente: { in: [compacto, canonico], mode: 'insensitive' } } }),
      prisma.cliente.count({ where: { cliente_cliente_rut: { in: [compacto, canonico] } } }),
    ]);
    if (!finanzas && !terreno) return compacto;
  }
  throw new Error('No fue posible reservar un RUT de prueba disponible');
}

after(async () => {
  if (clientesCreados.length) {
    await prisma.ficha_cliente.deleteMany({ where: { id_cliente_financiero: { in: clientesCreados } } });
    await prisma.cliente_financiero.deleteMany({ where: { id_cliente_financiero: { in: clientesCreados } } });
  }
  await prisma.$disconnect();
});

test('valida y normaliza RUT chileno con módulo 11', () => {
  assert.equal(esRutValido('12.345.678-5'), true);
  assert.equal(esRutValido('12345678-5'), true);
  assert.equal(esRutValido('12.345.678-0'), false);
  assert.equal(normalizarRut('12.345.678-k'), '12.345.678-K');
});

test('crea B2B con RUT válido nuevo sin crear ni exigir cliente en Terreno', async () => {
  const rutCompacto = await rutNuevoDisponible();
  const rutCanonico = normalizarRut(rutCompacto);
  const resultado = await modulo.crearCliente({ tipo: 'B2B', rut: rutCompacto, nombre: 'B2B autónomo de prueba' });
  clientesCreados.push(resultado.cliente.id_cliente_financiero);
  assert.equal(resultado.cliente.rut_cliente, rutCanonico);
  assert.ok(resultado.cliente.ficha_cliente);
  assert.equal(await prisma.cliente.count({ where: { cliente_cliente_rut: { in: [rutCompacto, rutCanonico] } } }), 0);

  await assert.rejects(
    modulo.crearCliente({ tipo: 'B2B', rut: rutCanonico, nombre: 'B2B duplicado' }),
    error => error.estado === 409 && /Ya existe/.test(error.message),
  );
});

test('rechaza B2B sin RUT con error 400', async () => {
  await assert.rejects(
    modulo.crearCliente({ tipo: 'B2B', nombre: 'B2B sin RUT' }),
    error => error.estado === 400 && /obligatorio/.test(error.message),
  );
});

test('rechaza RUT inválido con error 400 claro', async () => {
  await assert.rejects(
    modulo.crearCliente({ tipo: 'B2B', rut: '12.345.678-0', nombre: 'B2B inválido' }),
    error => error.estado === 400 && error.codigo === 'RUT_INVALIDO' && /no es válido/.test(error.message),
  );
});

test('mantiene permitido el cliente B2C provisional sin RUT', async () => {
  const resultado = await modulo.crearCliente({ tipo: 'B2C', nombre: 'B2C provisional de prueba' });
  clientesCreados.push(resultado.cliente.id_cliente_financiero);
  assert.equal(resultado.cliente.rut_cliente, null);
  assert.equal(resultado.cliente.nivel_formalizacion, 'provisional');
  assert.ok(resultado.cliente.ficha_cliente);
});
