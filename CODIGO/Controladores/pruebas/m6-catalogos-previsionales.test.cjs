const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { prisma } = require('../dist/db');
const { M6Controller } = require('../dist/controladores/M6Controller');

function crearRutValido() {
  const cuerpo = String(Math.floor(Math.random() * 8_000_000) + 1_000_000);
  let suma = 0;
  let multiplicador = 2;
  for (let indice = cuerpo.length - 1; indice >= 0; indice--) {
    suma += Number(cuerpo[indice]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }
  const resultado = 11 - (suma % 11);
  return `${cuerpo}-${resultado === 11 ? '0' : resultado === 10 ? 'K' : resultado}`;
}

test('M6 expone catálogos previsionales funcionales sin depender del seed', async t => {
  const modulo = new M6Controller();

  await t.test('devuelve siete AFP activas y los sistemas de salud con su tipo', async () => {
    const catalogos = await modulo.catalogosRemuneracionales();
    assert.deepEqual(catalogos.afps.map(item => item.nombre), ['Capital', 'Cuprum', 'Habitat', 'Modelo', 'PlanVital', 'Provida', 'Uno']);
    assert.equal(catalogos.institucionesSalud.find(item => item.nombre === 'Fonasa')?.tipo, 'FONASA');
    assert.equal(catalogos.institucionesSalud.find(item => item.nombre === 'DIPRECA')?.tipo, 'DIPRECA');
    assert.equal(catalogos.institucionesSalud.find(item => item.nombre === 'Otro')?.tipo, 'OTRO');
    assert.deepEqual(
      catalogos.institucionesSalud.filter(item => item.tipo === 'ISAPRE').map(item => item.nombre),
      ['Banmédica', 'Colmena Golden Cross', 'Consalud', 'Cruz Blanca', 'Cruz del Norte', 'Esencial', 'Fundación', 'Isalud', 'Nueva Masvida', 'Vida Tres'],
    );
  });

  await t.test('persiste AFP, Fonasa e Isapre y desactiva el pacto al salir de Isapre', async () => {
    const catalogos = await modulo.catalogosRemuneracionales();
    const afp = catalogos.afps.find(item => item.nombre === 'Habitat');
    const fonasa = catalogos.institucionesSalud.find(item => item.tipo === 'FONASA');
    const isapre = catalogos.institucionesSalud.find(item => item.nombre === 'Banmédica');
    const empleado = await modulo.crearEmpleado({ rut: crearRutValido(), nombres: 'Perfil', apellidoPaterno: 'Previsional' });
    try {
      let perfil = await modulo.actualizarPerfilRemuneracional(empleado.id, { idAfp: afp.id, idInstitucionSalud: fonasa.id });
      assert.equal(perfil.idAfp, afp.id);
      assert.equal(perfil.idInstitucionSalud, fonasa.id);
      assert.equal(perfil.tipoInstitucionSalud, 'FONASA');

      perfil = await modulo.actualizarPerfilRemuneracional(empleado.id, {
        idInstitucionSalud: isapre.id,
        cotizacionSaludValor: 0.08,
        cotizacionSaludUnidad: 'PORCENTAJE',
        cotizacionSaludVigenciaDesde: '2026-10-01',
      });
      assert.equal(perfil.idInstitucionSalud, isapre.id);
      assert.equal(perfil.tipoInstitucionSalud, 'ISAPRE');
      assert.equal(perfil.cotizacionSalud.valor, 0.08);

      perfil = await modulo.actualizarPerfilRemuneracional(empleado.id, { idInstitucionSalud: fonasa.id });
      assert.equal(perfil.idInstitucionSalud, fonasa.id);
      assert.equal(perfil.cotizacionSalud, null);
      assert.equal(await prisma.cotizacion_salud_empleado.count({ where: { id_empleado: empleado.id, activa: true } }), 0);
    } finally {
      await prisma.cotizacion_salud_empleado.deleteMany({ where: { id_empleado: empleado.id } });
      await prisma.empleado.delete({ where: { id_empleado: empleado.id } });
    }
  });

  await t.test('la UI separa sistema e institución y traduce porcentaje humano sin hardcodear catálogos', () => {
    const fuente = readFileSync(resolve('..', 'Vistas/src/views/FichaEmpleado/FichaEmpleado.tsx'), 'utf8');
    assert.match(fuente, /Sistema de salud/);
    assert.match(fuente, /institucionesSalud\.filter\(\(item\) => item\.tipo === 'ISAPRE'\)/);
    assert.match(fuente, /actual\.cotizacionSalud\.valor \* 100/);
    assert.match(fuente, /Number\(perfil\.cotizacionSaludValor\) \/ 100/);
    assert.match(fuente, />Porcentaje<\/option>/);
    assert.doesNotMatch(fuente, /Porcentaje decimal/);
  });
});
