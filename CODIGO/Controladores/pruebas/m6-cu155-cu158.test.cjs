const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const express = require('express');
const { prisma } = require('../dist/db');
const { M6Controller } = require('../dist/controladores/M6Controller');
const { C_Finanzas } = require('../dist/controladores/C_Finanzas');
const { crearRutasFinanzas } = require('../dist/rutas/finanzas');
const { operacionesPermiso, moduloPermiso } = require('../dist/validaciones/permisos');

function crearRutValido() {
  const cuerpo = String(Math.floor(Math.random() * 8_000_000) + 1_000_000);
  let suma = 0;
  let multiplicador = 2;
  for (let indice = cuerpo.length - 1; indice >= 0; indice--) {
    suma += Number(cuerpo[indice]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }
  const resultado = 11 - (suma % 11);
  const dv = resultado === 11 ? '0' : resultado === 10 ? 'K' : String(resultado);
  return `${cuerpo}-${dv}`;
}

test('M6 T1 CU155-CU158 administra el maestro actual de empleados', async (t) => {
  const modulo = new M6Controller();

  await t.test('CU155 consulta, busca, filtra, ordena y selecciona minimizando datos', async () => {
    const cargo = await prisma.cargo.findFirstOrThrow();
    const vinculo = await prisma.tipo_vinculo_laboral.findFirstOrThrow();
    const sufijo = randomUUID().slice(0, 6);
    const rut = `${Number.parseInt(sufijo, 16) % 8_000_000 + 1_000_000}-0`;
    const empleado = await prisma.empleado.create({ data: {
      rut_empleado: rut,
      nombres: `Prueba${sufijo}`,
      apellido_paterno: 'Catalogo',
      id_cargo: cargo.id_cargo,
      id_tipo_vinculo_laboral: vinculo.id_tipo_vinculo_laboral,
      fecha_ingreso: new Date('2024-01-01'),
      sueldo_base: 123456,
      estado_laboral: 'activo',
    } });
    try {
      const listado = await modulo.listarEmpleados({ busqueda: `Prueba${sufijo}`, estado: 'activo', ordenar: 'rut', direccion: 'desc' });
      assert.equal(listado.length, 1);
      assert.equal(listado[0].id, empleado.id_empleado);
      assert.equal(listado[0].cargoActual, cargo.nombre_cargo);
      assert.deepEqual(Object.keys(listado[0]).sort(), ['cargoActual', 'estado', 'id', 'nombreCompleto', 'rut']);
      assert.equal('sueldoBase' in listado[0], false);
      assert.equal('afp' in listado[0], false);
      const ficha = await modulo.obtenerEmpleado(empleado.id_empleado);
      assert.equal(ficha.id, empleado.id_empleado);
      await assert.rejects(modulo.obtenerEmpleado(2_000_000_000), (error) => error.estado === 404);
      assert.equal(operacionesPermiso.listarEmpleados, 'CU155');
      assert.equal(moduloPermiso('CU155'), 'M6');
      let autorizado = false;
      const fachada = new C_Finanzas(
        { autorizar: async () => { autorizado = true; return { id: 1n, permisos: ['CU155'], configuracion: 'particular', administrador: false }; } },
        {}, {}, {}, {}, {}, { listarEmpleados: async () => [] },
      );
      await fachada.ejecutar('listarEmpleados', { consulta: {}, contexto: {} });
      assert.equal(autorizado, true);
    } finally {
      await prisma.empleado.delete({ where: { rut_empleado: empleado.rut_empleado } });
    }
  });

  await t.test('CU156 registra empleado sin Usuario y controla payload y duplicidad', async () => {
    const rut = crearRutValido();
    const usuariosAntes = await prisma.usuario.count();
    const creado = await modulo.crearEmpleado({ rut, nombres: 'Elena', apellidoPaterno: 'Dependiente', apellidoMaterno: 'Prueba' });
    try {
      const persistido = await prisma.empleado.findUniqueOrThrow({ where: { id_empleado: creado.id } });
      assert.equal(persistido.id_cargo, null);
      assert.equal(persistido.id_tipo_vinculo_laboral, null);
      assert.equal(persistido.sueldo_base, null);
      assert.equal(persistido.fecha_ingreso, null);
      assert.equal(await prisma.usuario.count(), usuariosAntes);
      assert.equal(await prisma.usuario.count({ where: { OR: [{ empleado_m4: persistido.rut_empleado }, { empleado_rut_empleado: persistido.rut_empleado }] } }), 0);
      assert.equal((await modulo.listarEmpleados({ busqueda: rut })).some((item) => item.id === creado.id), true);
      await assert.rejects(modulo.crearEmpleado({ rut, nombres: 'Duplicado', apellidoPaterno: 'Prueba' }), (error) => error.estado === 409);
      await assert.rejects(modulo.crearEmpleado({ rut: '123', nombres: '', apellidoPaterno: '' }), (error) => error.estado === 400);
      assert.equal(operacionesPermiso.crearEmpleado, 'CU156');
      let escribio = false;
      const fachada = new C_Finanzas(
        { autorizar: async () => { const error = new Error('No autorizado'); error.estado = 403; throw error; } },
        {}, {}, {}, {}, {}, { crearEmpleado: async () => { escribio = true; } },
      );
      await assert.rejects(fachada.ejecutar('crearEmpleado', { cuerpo: { rut, nombres: 'X', apellidoPaterno: 'Y' }, contexto: {} }), (error) => error.estado === 403);
      assert.equal(escribio, false);
    } finally {
      await prisma.empleado.delete({ where: { id_empleado: creado.id } });
    }
  });

  await t.test('CU157 conserva períodos laborales al terminar y reingresar', async () => {
    const creado = await modulo.crearEmpleado({ rut: crearRutValido(), nombres: 'Mario', apellidoPaterno: 'Reingreso' });
    const tipo = await prisma.tipo_vinculo_laboral.findFirstOrThrow({ where: { estado_tipo_vinculo_laboral: 'activo' } });
    try {
      let relaciones = await modulo.crearRelacionLaboral(creado.id, { fechaInicio: '2024-01-01', idTipoVinculo: tipo.id_tipo_vinculo_laboral, jornada: 'Completa' });
      const primera = relaciones[0];
      assert.equal(primera.estado, 'vigente');
      assert.equal('idCargo' in primera, false);
      await assert.rejects(modulo.actualizarRelacionLaboral(creado.id, primera.id, { fechaTermino: '2023-12-31' }), (error) => error.estado === 400);
      const sinCambio = await prisma.relacion_laboral_empleado.findUniqueOrThrow({ where: { id_relacion_laboral_empleado: primera.id } });
      assert.equal(sinCambio.fecha_termino, null);
      relaciones = await modulo.actualizarRelacionLaboral(creado.id, primera.id, { fechaTermino: '2025-08-31' });
      assert.equal(relaciones.find((item) => item.id === primera.id).estado, 'terminada');
      assert.equal((await prisma.empleado.findUniqueOrThrow({ where: { id_empleado: creado.id } })).estado_laboral, 'desvinculado');
      relaciones = await modulo.crearRelacionLaboral(creado.id, { fechaInicio: '2026-02-01', idTipoVinculo: tipo.id_tipo_vinculo_laboral });
      assert.equal(relaciones.length, 2);
      const anterior = relaciones.find((item) => item.id === primera.id);
      const vigente = relaciones.find((item) => item.id !== primera.id);
      assert.equal(anterior.fechaInicio.toISOString().slice(0, 10), '2024-01-01');
      assert.equal(anterior.fechaTermino.toISOString().slice(0, 10), '2025-08-31');
      assert.equal(anterior.estado, 'terminada');
      assert.equal(vigente.estado, 'vigente');
      assert.equal((await prisma.empleado.findUniqueOrThrow({ where: { id_empleado: creado.id } })).estado_laboral, 'activo');
      await assert.rejects(modulo.crearRelacionLaboral(creado.id, { fechaInicio: '2026-03-01' }), (error) => error.estado === 409);
      assert.equal(operacionesPermiso.crearRelacionLaboral, 'CU157');
    } finally {
      await prisma.relacion_laboral_empleado.deleteMany({ where: { id_empleado: creado.id } });
      await prisma.empleado.delete({ where: { id_empleado: creado.id } });
    }
  });

  await t.test('CU157 impide dos períodos vigentes ante creación concurrente', async () => {
    const creado = await modulo.crearEmpleado({ rut: crearRutValido(), nombres: 'Ana', apellidoPaterno: 'Concurrente' });
    try {
      const resultados = await Promise.allSettled([
        modulo.crearRelacionLaboral(creado.id, { fechaInicio: '2026-04-01' }),
        modulo.crearRelacionLaboral(creado.id, { fechaInicio: '2026-04-02' }),
      ]);
      assert.equal(resultados.filter((resultado) => resultado.status === 'fulfilled').length, 1);
      const rechazado = resultados.find((resultado) => resultado.status === 'rejected');
      assert.equal(rechazado.reason.estado, 409);
      assert.equal(await prisma.relacion_laboral_empleado.count({
        where: { id_empleado: creado.id, estado: 'vigente', fecha_termino: null },
      }), 1);
    } finally {
      await prisma.relacion_laboral_empleado.deleteMany({ where: { id_empleado: creado.id } });
      await prisma.empleado.delete({ where: { id_empleado: creado.id } });
    }
  });

  await t.test('CU158 enruta el catálogo remuneracional antes del parámetro de empleado', async () => {
    const operaciones = [];
    const aplicacion = express();
    aplicacion.use('/api/finanzas', crearRutasFinanzas({
      ejecutar: async (operacion) => {
        operaciones.push(operacion);
        return { cargos: [], afps: [], institucionesSalud: [] };
      },
    }));
    const servidor = await new Promise((resolve) => {
      const instancia = aplicacion.listen(0, '127.0.0.1', () => resolve(instancia));
    });
    try {
      const direccion = servidor.address();
      const respuesta = await fetch(`http://127.0.0.1:${direccion.port}/api/finanzas/empleados/catalogos/remuneracionales`);
      assert.equal(respuesta.status, 200);
      assert.deepEqual(await respuesta.json(), { cargos: [], afps: [], institucionesSalud: [] });
      assert.deepEqual(operaciones, ['catalogosRemuneracionales']);
    } finally {
      await new Promise((resolve, reject) => servidor.close((error) => error ? reject(error) : resolve()));
    }
  });

  await t.test('CU158 mantiene perfil actual sin históricos ni acoplar cargo y sueldo', async () => {
    const sufijo = randomUUID();
    const cargoExistente = await prisma.cargo.findFirst({ where: { estado_cargo: 'activo' } });
    const afpExistente = await prisma.afp.findFirst({ where: { estado_afp: 'activo' } });
    const saludExistente = await prisma.prevision_salud.findFirst({ where: { estado_prevision_salud: 'activo' } });
    const cargo = cargoExistente || await prisma.cargo.create({ data: { nombre_cargo: `Cargo prueba ${sufijo}`, estado_cargo: 'activo' } });
    const afp = afpExistente || await prisma.afp.create({ data: { nombre_afp: `AFP prueba ${sufijo}`, estado_afp: 'activo' } });
    const salud = saludExistente || await prisma.prevision_salud.create({ data: { nombre_prevision_salud: `Salud prueba ${sufijo}`, estado_prevision_salud: 'activo' } });
    const creado = await modulo.crearEmpleado({ rut: crearRutValido(), nombres: 'Laura', apellidoPaterno: 'Perfil' });
    try {
      await modulo.crearRelacionLaboral(creado.id, { fechaInicio: '2025-01-01' });
      const relacionesAntes = await prisma.relacion_laboral_empleado.findMany({ where: { id_empleado: creado.id } });
      let perfil = await modulo.actualizarPerfilRemuneracional(creado.id, { sueldoBaseActual: 950000, fechaAplicacionSueldoBase: '2026-03-01' });
      assert.equal(perfil.sueldoBaseActual, 950000);
      perfil = await modulo.actualizarPerfilRemuneracional(creado.id, { idCargo: cargo.id_cargo });
      assert.equal(perfil.idCargo, cargo.id_cargo);
      assert.equal(perfil.sueldoBaseActual, 950000);
      perfil = await modulo.actualizarPerfilRemuneracional(creado.id, {
        idAfp: afp.id_afp,
        idInstitucionSalud: salud.id_prevision_salud,
        seguroCesantia: false,
        correoParticular: 'laura@example.cl',
        telefonoParticular: '+56912345678',
        direccionParticular: 'Dirección de prueba',
        tipoCorreo: 'personal',
        consentimientoElectronico: true,
        canalDocumental: 'correo',
      });
      assert.equal(perfil.idAfp, afp.id_afp);
      assert.equal(perfil.idInstitucionSalud, salud.id_prevision_salud);
      assert.equal(perfil.correoParticular, 'laura@example.cl');
      assert.equal(perfil.fechaAplicacionSueldoBase.toISOString().slice(0, 10), '2026-03-01');
      await assert.rejects(modulo.actualizarPerfilRemuneracional(creado.id, { sueldoBaseActual: -1 }), (error) => error.estado === 400);
      const relacionesDespues = await prisma.relacion_laboral_empleado.findMany({ where: { id_empleado: creado.id } });
      assert.deepEqual(relacionesDespues.map((item) => item.id_relacion_laboral_empleado), relacionesAntes.map((item) => item.id_relacion_laboral_empleado));
      assert.equal(operacionesPermiso.actualizarPerfilRemuneracional, 'CU158');
    } finally {
      await prisma.relacion_laboral_empleado.deleteMany({ where: { id_empleado: creado.id } });
      await prisma.empleado.delete({ where: { id_empleado: creado.id } });
      if (!afpExistente) await prisma.afp.delete({ where: { id_afp: afp.id_afp } });
      if (!saludExistente) await prisma.prevision_salud.delete({ where: { id_prevision_salud: salud.id_prevision_salud } });
      if (!cargoExistente) await prisma.cargo.delete({ where: { id_cargo: cargo.id_cargo } });
    }
  });
});
