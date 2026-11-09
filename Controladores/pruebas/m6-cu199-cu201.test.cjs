const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { prisma } = require('../dist/db');
const { M6Controller } = require('../dist/controladores/M6Controller');
const { C_Finanzas } = require('../dist/controladores/C_Finanzas');
const { codigosTodosLosCU, matrizPermisosPorCU, operacionesPermiso, permiteOperacion } = require('../dist/validaciones/permisos');

test('M6 Terreno CU199-CU201 reutiliza visita y asignaciones Legacy canónicas', async (t) => {
  const modulo = new M6Controller(); const sufijo = randomUUID().slice(0, 8);
  const ids = { visitas: [], tareas: [], usuarios: [], obras: [], especificaciones: [], clientes: [] };
  const cliente = await prisma.cliente.create({ data: { cliente_cliente_rut: `T${sufijo}`.slice(0, 12), cliente_razon_social: `Cliente ${sufijo}` } }); ids.clientes.push(cliente.cliente_cliente_rut);
  const especificacion = await prisma.especificaciones_puerta.create({ data: { especificacion_puerta_modelo_puerta: `Modelo ${sufijo}`, especificacion_puerta_zona: 'Acceso principal' } }); ids.especificaciones.push(especificacion.especificacion_puerta_especificacion_puerta_id);
  const obra = await prisma.obra.create({ data: { obra_nombre_obra: `Obra ${sufijo}`, obra_direccion_obra: 'Dirección de prueba', rut_cliente: cliente.cliente_cliente_rut, id_especificacion_puerta: especificacion.especificacion_puerta_especificacion_puerta_id } }); ids.obras.push(obra.obra_obra_id);
  const usuario1 = await prisma.usuario.create({ data: { usuario_username: `tec1_${sufijo}`, usuario_nombre_completo_primer_nombre_usuario: 'Ana', usuario_nombre_completo_primer_apellido_usuario: 'Técnica' } }); ids.usuarios.push(usuario1.usuario_id_usuario);
  const usuario2 = await prisma.usuario.create({ data: { usuario_username: `tec2_${sufijo}`, usuario_nombre_completo_primer_nombre_usuario: 'Beto', usuario_nombre_completo_primer_apellido_usuario: 'Técnico' } }); ids.usuarios.push(usuario2.usuario_id_usuario);
  let visita;
  try {
    await t.test('crear visita vinculada a obra con estado inicial seguro', async () => {
      visita = await modulo.crearVisitaTerreno({ idObra: obra.obra_obra_id.toString(), tipoServicio: 'Levantamiento', fecha: '2026-09-28', bloqueHorario: '10:30', prioridad: 'normal', observaciones: 'Acceso coordinado' }); ids.visitas.push(BigInt(visita.id));
      assert.equal(visita.estado, 'pendiente'); assert.equal(visita.obra.id, obra.obra_obra_id.toString());
    });
    await t.test('desde visita se deriva cliente', async () => {
      const detalle = await modulo.obtenerVisitaTerreno(Number(visita.id)); assert.equal(detalle.obra.cliente.rut, cliente.cliente_cliente_rut); assert.equal(detalle.obra.cliente.nombre, cliente.cliente_razon_social);
    });
    await t.test('desde visita se deriva puerta y especificación', async () => {
      const detalle = await modulo.obtenerVisitaTerreno(Number(visita.id)); assert.equal(detalle.obra.especificacion.id, especificacion.especificacion_puerta_especificacion_puerta_id.toString()); assert.equal(detalle.obra.especificacion.modelo, especificacion.especificacion_puerta_modelo_puerta);
    });
    await t.test('asignar responsable actualiza servicio_terreno.id_usuario', async () => {
      const asignada = await modulo.asignarResponsableVisita(Number(visita.id), { idUsuario: usuario1.usuario_id_usuario.toString() }); assert.equal(asignada.responsable.id, usuario1.usuario_id_usuario.toString());
      const fisica = await prisma.servicio_terreno.findUnique({ where: { servicio_terreno_servicio_terreno_id: BigInt(visita.id) } }); assert.equal(fisica.id_usuario, usuario1.usuario_id_usuario);
    });
    await t.test('usuario inexistente bloquea asignación', async () => {
      await assert.rejects(modulo.asignarResponsableVisita(Number(visita.id), { idUsuario: '999999999' }), (error) => error.estado === 404);
    });
    const tareaAsignada = await prisma.tarea.create({ data: { tarea_titulo: `Asignada ${sufijo}`, tarea_estado_de_tarea: 'pendiente', id_servicio_terreno: BigInt(visita.id), id_usuario: usuario2.usuario_id_usuario } }); ids.tareas.push(tareaAsignada.tarea_tarea_id);
    await prisma.tarea_usuario.create({ data: { tarea_usuario_tarea_id: tareaAsignada.tarea_tarea_id, tarea_usuario_usuario_id: usuario1.usuario_id_usuario } });
    const tareaSoloLegacy = await prisma.tarea.create({ data: { tarea_titulo: `Sólo Legacy ${sufijo}`, id_usuario: usuario1.usuario_id_usuario, id_servicio_terreno: BigInt(visita.id) } }); ids.tareas.push(tareaSoloLegacy.tarea_tarea_id);
    const tareaAjena = await prisma.tarea.create({ data: { tarea_titulo: `Ajena ${sufijo}`, id_servicio_terreno: BigInt(visita.id) } }); ids.tareas.push(tareaAjena.tarea_tarea_id);
    await prisma.tarea_usuario.create({ data: { tarea_usuario_tarea_id: tareaAjena.tarea_tarea_id, tarea_usuario_usuario_id: usuario2.usuario_id_usuario } });
    await t.test('Mis tareas devuelve asignaciones por tarea_usuario', async () => {
      const tareas = await modulo.listarMisTareasTerreno(usuario1.usuario_id_usuario); assert.equal(tareas.some((item) => item.id === tareaAsignada.tarea_tarea_id.toString()), true); assert.equal(tareas.find((item) => item.id === tareaAsignada.tarea_tarea_id.toString()).visita.obra.cliente.rut, cliente.cliente_cliente_rut);
    });
    await t.test('tarea con sólo tarea.id_usuario no aparece asignada', async () => {
      const tareas = await modulo.listarMisTareasTerreno(usuario1.usuario_id_usuario); assert.equal(tareas.some((item) => item.id === tareaSoloLegacy.tarea_tarea_id.toString()), false);
    });
    await t.test('otro usuario no ve tareas ajenas', async () => {
      const tareas = await modulo.listarMisTareasTerreno(usuario2.usuario_id_usuario); assert.equal(tareas.some((item) => item.id === tareaAsignada.tarea_tarea_id.toString()), false); assert.equal(tareas.some((item) => item.id === tareaAjena.tarea_tarea_id.toString()), true);
    });
    await t.test('permisos CU199 CU200 y CU201 son independientes', async () => {
      assert.equal(codigosTodosLosCU.length, 274); assert.deepEqual(matrizPermisosPorCU.CU199, []); assert.deepEqual(matrizPermisosPorCU.CU200, []); assert.deepEqual(matrizPermisosPorCU.CU201, []);
      assert.equal(operacionesPermiso.crearVisitaTerreno, 'CU199'); assert.equal(operacionesPermiso.asignarResponsableVisita, 'CU200'); assert.equal(operacionesPermiso.listarMisTareasTerreno, 'CU201');
      assert.equal(permiteOperacion('asignarResponsableVisita', ['CU199']), false); assert.equal(permiteOperacion('crearVisitaTerreno', ['CU200']), false); assert.equal(permiteOperacion('listarMisTareasTerreno', ['CU200']), false);
      const autorizacion = (permisos, id = usuario1.usuario_id_usuario) => ({ autorizar: async (operacion) => { if (!permiteOperacion(operacion, permisos)) { const error = new Error('No autorizado'); error.estado = 403; throw error; } return { id, permisos, configuracion: 'particular', administrador: false }; } });
      const m6 = { crearVisitaTerreno: async () => ({ id: '1' }), asignarResponsableVisita: async () => ({ id: '1' }), listarMisTareasTerreno: async (id) => [{ idUsuario: id.toString() }] };
      const fachada199 = new C_Finanzas(autorizacion(['CU199']), {}, {}, {}, {}, {}, m6); const fachada200 = new C_Finanzas(autorizacion(['CU200']), {}, {}, {}, {}, {}, m6); const fachada201 = new C_Finanzas(autorizacion(['CU201']), {}, {}, {}, {}, {}, m6);
      await fachada199.ejecutar('crearVisitaTerreno', { contexto: {}, cuerpo: {} }); await assert.rejects(fachada199.ejecutar('asignarResponsableVisita', { contexto: {}, parametros: { id: '1' }, cuerpo: { idUsuario: '1' } }), (error) => error.estado === 403);
      await fachada200.ejecutar('asignarResponsableVisita', { contexto: {}, parametros: { id: '1' }, cuerpo: { idUsuario: '1' } }); const propias = await fachada201.ejecutar('listarMisTareasTerreno', { contexto: {} }); assert.equal(propias[0].idUsuario, usuario1.usuario_id_usuario.toString());
    });
  } finally {
    await prisma.tarea_usuario.deleteMany({ where: { tarea_usuario_tarea_id: { in: ids.tareas } } });
    await prisma.tarea.deleteMany({ where: { tarea_tarea_id: { in: ids.tareas } } });
    await prisma.servicio_terreno.deleteMany({ where: { servicio_terreno_servicio_terreno_id: { in: ids.visitas } } });
    await prisma.obra.deleteMany({ where: { obra_obra_id: { in: ids.obras } } });
    await prisma.especificaciones_puerta.deleteMany({ where: { especificacion_puerta_especificacion_puerta_id: { in: ids.especificaciones } } });
    await prisma.cliente.deleteMany({ where: { cliente_cliente_rut: { in: ids.clientes } } });
    await prisma.usuario.deleteMany({ where: { usuario_id_usuario: { in: ids.usuarios } } });
  }
});
