const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { prisma } = require('../dist/db');
const { M6Controller } = require('../dist/controladores/M6Controller');
const { C_Finanzas } = require('../dist/controladores/C_Finanzas');
const { codigosTodosLosCU, matrizPermisosPorCU, operacionesPermiso, permiteOperacion } = require('../dist/validaciones/permisos');

test('M6 Terreno CU202 registra levantamiento técnico sobre estructuras Legacy', async (t) => {
  const modulo = new M6Controller(); const sufijo = randomUUID().slice(0, 8);
  const ids = { usuarios: [], tareas: [], visitas: [], obras: [], especificaciones: [], clientes: [] };
  const cliente = await prisma.cliente.create({ data: { cliente_cliente_rut: `L${sufijo}`.slice(0, 12), cliente_razon_social: `Cliente ${sufijo}` } }); ids.clientes.push(cliente.cliente_cliente_rut);
  const puerta = await prisma.especificaciones_puerta.create({ data: { especificacion_puerta_modelo_puerta: `Puerta ${sufijo}`, especificacion_puerta_zona: 'Acceso' } }); ids.especificaciones.push(puerta.especificacion_puerta_especificacion_puerta_id);
  const obra = await prisma.obra.create({ data: { obra_nombre_obra: `Obra ${sufijo}`, rut_cliente: cliente.cliente_cliente_rut, id_especificacion_puerta: puerta.especificacion_puerta_especificacion_puerta_id } }); ids.obras.push(obra.obra_obra_id);
  const visita = await prisma.servicio_terreno.create({ data: { servicio_terreno_tipo_servicio: 'Levantamiento', servicio_terreno_estado: 'pendiente', id_obra: obra.obra_obra_id } }); ids.visitas.push(visita.servicio_terreno_servicio_terreno_id);
  const asignado = await prisma.usuario.create({ data: { usuario_username: `lev_${sufijo}` } }); const noAsignado = await prisma.usuario.create({ data: { usuario_username: `otro_${sufijo}` } }); ids.usuarios.push(asignado.usuario_id_usuario, noAsignado.usuario_id_usuario);
  const tarea = await prisma.tarea.create({ data: { tarea_titulo: `Levantar ${sufijo}`, tarea_estado_de_tarea: 'pendiente', id_servicio_terreno: visita.servicio_terreno_servicio_terreno_id, id_usuario: noAsignado.usuario_id_usuario } }); ids.tareas.push(tarea.tarea_tarea_id);
  await prisma.tarea_usuario.create({ data: { tarea_usuario_tarea_id: tarea.tarea_tarea_id, tarea_usuario_usuario_id: asignado.usuario_id_usuario } });
  const actor = { id: asignado.usuario_id_usuario, administrador: false }; const actorAjeno = { id: noAsignado.usuario_id_usuario, administrador: false };
  try {
    await t.test('técnico asignado abre el levantamiento y resuelve tarea visita obra cliente y puerta', async () => {
      const detalle = await modulo.obtenerLevantamientoTerreno(Number(tarea.tarea_tarea_id), actor);
      assert.equal(detalle.tarea.id, tarea.tarea_tarea_id.toString()); assert.equal(detalle.visita.id, visita.servicio_terreno_servicio_terreno_id.toString());
      assert.equal(detalle.obra.id, obra.obra_obra_id.toString()); assert.equal(detalle.obra.cliente.rut, cliente.cliente_cliente_rut); assert.equal(detalle.especificacion.id, puerta.especificacion_puerta_especificacion_puerta_id.toString());
    });
    await t.test('técnico no asignado no puede abrir aunque tarea.id_usuario lo identifique', async () => {
      await assert.rejects(modulo.obtenerLevantamientoTerreno(Number(tarea.tarea_tarea_id), actorAjeno), (error) => error.estado === 403);
    });
    await t.test('guarda especificación y medidas en las tablas Legacy', async () => {
      const guardado = await modulo.guardarLevantamientoTerreno(Number(tarea.tarea_tarea_id), { especificacion: { sentidoApertura: 'Interior', materialidadVano: 'Hormigón', cubrejuntas: true, observaciones: 'Medición verificada' }, medidas: { marcoAncho: '90.5', marcoAlto: '210', vanoVerticalEspesor: '12.25' } }, actor);
      assert.equal(guardado.especificacion.sentidoApertura, 'Interior'); assert.equal(guardado.especificacion.cubrejuntas, true); assert.equal(guardado.medidas.marcoAncho, '90.5');
      const fisica = await prisma.especificaciones_puerta.findUniqueOrThrow({ where: { especificacion_puerta_especificacion_puerta_id: puerta.especificacion_puerta_especificacion_puerta_id } });
      assert.equal(fisica.especificacion_puerta_materialidad_vano, 'Hormigón'); assert.equal(fisica.especificacion_puerta_observaciones, 'Medición verificada');
    });
    await t.test('editar medidas reutiliza la puerta y no crea duplicados', async () => {
      const antes = await prisma.medidas_puerta.count({ where: { id_especificacion_puerta: puerta.especificacion_puerta_especificacion_puerta_id } });
      const guardado = await modulo.guardarLevantamientoTerreno(Number(tarea.tarea_tarea_id), { medidas: { marcoAncho: '91.75' } }, actor);
      assert.equal(guardado.medidas.marcoAncho, '91.75'); assert.equal(await prisma.medidas_puerta.count({ where: { id_especificacion_puerta: puerta.especificacion_puerta_especificacion_puerta_id } }), antes);
      assert.equal((await prisma.tarea.findUniqueOrThrow({ where: { tarea_tarea_id: tarea.tarea_tarea_id } })).id_especificacion_puerta, null);
    });
    await t.test('administrador autorizado puede consultar sin asignación técnica', async () => {
      const detalle = await modulo.obtenerLevantamientoTerreno(Number(tarea.tarea_tarea_id), { id: noAsignado.usuario_id_usuario, administrador: true }); assert.equal(detalle.tarea.id, tarea.tarea_tarea_id.toString());
    });
    await t.test('permiso CU202 es independiente', async () => {
      assert.equal(codigosTodosLosCU.length, 274); assert.deepEqual(matrizPermisosPorCU.CU202, []); assert.equal(operacionesPermiso.obtenerLevantamientoTerreno, 'CU202'); assert.equal(operacionesPermiso.guardarLevantamientoTerreno, 'CU202');
      assert.equal(permiteOperacion('obtenerLevantamientoTerreno', ['CU201']), false); assert.equal(permiteOperacion('guardarLevantamientoTerreno', ['CU202']), true);
      const autorizacion = { autorizar: async (operacion) => { if (!permiteOperacion(operacion, ['CU202'])) { const error = new Error('No autorizado'); error.estado = 403; throw error; } return { ...actor, permisos: ['CU202'], configuracion: 'particular' }; } };
      const m6 = { obtenerLevantamientoTerreno: async (_id, recibido) => recibido.id.toString(), guardarLevantamientoTerreno: async (_id, _cuerpo, recibido) => recibido.id.toString() };
      const fachada = new C_Finanzas(autorizacion, {}, {}, {}, {}, {}, m6); assert.equal(await fachada.ejecutar('obtenerLevantamientoTerreno', { parametros: { id: tarea.tarea_tarea_id.toString() }, contexto: {} }), asignado.usuario_id_usuario.toString());
    });
    await t.test('CU205 reutiliza el levantamiento sin crear tabla paralela', () => {
      assert.equal(codigosTodosLosCU.includes('CU203'), true); assert.equal(codigosTodosLosCU.includes('CU204'), true); assert.equal(codigosTodosLosCU.includes('CU205'), true); assert.equal(codigosTodosLosCU.includes('CU206'), true); assert.equal(codigosTodosLosCU.includes('CU215'),true); const schema = readFileSync(resolve('prisma/schema.prisma'), 'utf8'); assert.doesNotMatch(schema, /model\s+levantamiento/i);
      const rutas = readFileSync(resolve('src/rutas/finanzas.ts'), 'utf8'); assert.match(rutas, /ajustarOrdenTrabajoTerreno|liberarOrdenTrabajoTerreno/);
    });
  } finally {
    await prisma.medidas_puerta.deleteMany({ where: { id_especificacion_puerta: { in: ids.especificaciones } } });
    await prisma.tarea_usuario.deleteMany({ where: { tarea_usuario_tarea_id: { in: ids.tareas } } }); await prisma.tarea.deleteMany({ where: { tarea_tarea_id: { in: ids.tareas } } });
    await prisma.servicio_terreno.deleteMany({ where: { servicio_terreno_servicio_terreno_id: { in: ids.visitas } } }); await prisma.obra.deleteMany({ where: { obra_obra_id: { in: ids.obras } } });
    await prisma.especificaciones_puerta.deleteMany({ where: { especificacion_puerta_especificacion_puerta_id: { in: ids.especificaciones } } }); await prisma.cliente.deleteMany({ where: { cliente_cliente_rut: { in: ids.clientes } } });
    await prisma.usuario.deleteMany({ where: { usuario_id_usuario: { in: ids.usuarios } } });
  }
});
