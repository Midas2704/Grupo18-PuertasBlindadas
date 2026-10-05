const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const ejecutar = modo => execFileSync(process.execPath, [resolve('dist/administracion/sembrarDemoCompleto.js'), modo], { encoding: 'utf8' });

test('dataset DEMO integral es verificable e idempotente', () => {
  try {
    ejecutar('seed');
    const primeraEjecucion = JSON.parse(ejecutar('status'));
    ejecutar('seed');
    const despues = JSON.parse(ejecutar('status'));
    assert.deepEqual(despues, primeraEjecucion);
    const verificacion = JSON.parse(ejecutar('verify'));
    const credito = verificacion.creditoM7.exposicion.valor;
    assert.equal(verificacion.creditoM7.estado, 'VALIDO');
    assert.equal(credito.limiteGlobal, 18000000);
    assert.ok(credito.exposicionUtilizada > 0);
    assert.equal(credito.totalSolicitudes, 25);
    assert.ok(credito.totalCompromisos >= 10);
    assert.equal(despues.rangoHistorico.meses, 25);
    assert.equal(despues.actividadEfectivaPosteriorRango, 0);
    assert.ok(despues.fechasMaximasEfectivas.pagoCliente <= `${despues.rangoHistorico.hasta}-31`);
    assert.ok(despues.fechasMaximasEfectivas.movimientoFinanciero <= `${despues.rangoHistorico.hasta}-31`);
    assert.equal(Object.keys(despues.seriesMensuales.pagos).some(mes => mes > despues.rangoHistorico.hasta), false);
    assert.equal(Object.keys(despues.seriesMensuales.movimientosFinancieros).some(mes => mes > despues.rangoHistorico.hasta), false);
    assert.ok(despues.clientes >= 50);
    assert.ok(despues.usuarios >= 5);
    assert.ok(despues.items >= 10);
    assert.ok(despues.materiales >= 25);
    assert.ok(despues.cotizaciones >= 200);
    assert.ok(despues.notas >= 100);
    assert.ok(despues.pagos >= 100);
    assert.ok(despues.movimientosFinancieros >= 150);
    for (const clave of ['ocs', 'documentosProveedor', 'obligaciones', 'compras']) assert.ok(despues[clave] >= 80, `${clave} debe representar actividad histórica`);
    assert.ok(despues.proveedores >= 12);
    assert.ok(despues.empleados >= 15);
    assert.ok(despues.remuneraciones >= 250);
    assert.ok(despues.honorarios >= 50);
    assert.ok(despues.proyectos >= 30);
    assert.ok(despues.obras >= 30);
    assert.ok(despues.visitas >= 80);
    assert.ok(despues.tareas >= 150);
    assert.ok(despues.ejecuciones >= 100);
    assert.ok(despues.incidencias >= 20);
    assert.ok(despues.movimientosInventario >= 200);
    assert.ok(despues.solicitudes >= 20);
    assert.ok(Object.keys(despues.seriesMensuales.ventas).length >= 24);
    assert.ok(new Set(Object.values(despues.seriesMensuales.ventas).map(fila => fila.monto)).size > 1);
    assert.ok(despues.eventos >= 40);
    assert.ok(despues.limiteGlobal > 0);
    assert.ok(despues.exposicion > 0);
  } finally {
    ejecutar('clean');
  }
});

test('seeder DEMO no contiene borrado masivo, credenciales ni escritura directa de evidencia M9', () => {
  const fuente = readFileSync(resolve('src/administracion/sembrarDemoCompleto.ts'), 'utf8');
  const paquete = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
  const cargaNormal = fuente.slice(0, fuente.indexOf('async function limpiarDemo'));
  assert.doesNotMatch(cargaNormal, /deleteMany|truncate|DROP\s+TABLE/i);
  assert.match(fuente, /registros operativos DEMO-UI/);
  assert.match(fuente, /eventosM9DemoPreservados/);
  assert.match(fuente, /evidencia M9 no se elimina porque es inmutable/);
  assert.doesNotMatch(fuente, /password|contrase(?:n|ñ)a|claveTemporal/i);
  assert.match(fuente, /new M9Controller\(\)/);
  assert.match(fuente, /controlador\.recibir\(/);
  assert.doesNotMatch(fuente, /evento_auditoria_m9\.(create|createMany)/);
  assert.equal(paquete.scripts['db:seed:demo'], 'node dist/administracion/sembrarDemoCompleto.js seed');
  assert.doesNotMatch(paquete.scripts['db:seed:demo'], /prisma\/seed\.ts|prisma db seed/);
  assert.doesNotMatch(fuente, /correo_particular:\s*\{\s*endsWith:\s*'@example\.invalid'/);
});

test('clean retira sólo DEMO operativo, preserva usuarios y evidencia M9, y permite resembrar', () => {
  try {
    ejecutar('seed');
    const antes = JSON.parse(ejecutar('status'));
    const salida = JSON.parse(ejecutar('clean'));
    const limpio = JSON.parse(ejecutar('status'));
    assert.equal(salida.eventosM9DemoPreservados, antes.eventos);
    assert.equal(limpio.usuarios, antes.usuarios);
    assert.equal(limpio.eventos, antes.eventos);
    for (const clave of ['clientes', 'items', 'materiales', 'movimientosFinancieros', 'proveedores', 'ocs', 'documentosProveedor', 'obligaciones', 'pagosProveedor', 'categoriasEgreso', 'envios', 'cajaChica', 'empleados', 'esquemas', 'haberes', 'remuneraciones', 'documentosRemuneracion', 'pagosRemuneracion', 'honorarios', 'proyectos', 'proyectosFinancieros', 'obras', 'visitas', 'tareas', 'ejecuciones', 'incidencias', 'ots', 'stock', 'movimientosInventario', 'compras', 'solicitudes', 'compromisos']) assert.equal(limpio[clave], 0, `${clave} debe quedar limpio`);
    ejecutar('seed');
    assert.doesNotThrow(() => ejecutar('verify'));
  } finally {
    ejecutar('clean');
  }
});
