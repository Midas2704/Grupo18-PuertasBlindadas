const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { prisma } = require('../dist/db');
const { M6Controller } = require('../dist/controladores/M6Controller');
const { C_Finanzas } = require('../dist/controladores/C_Finanzas');
const { codigosTodosLosCU, matrizPermisosPorCU, operacionesPermiso, permiteOperacion } = require('../dist/validaciones/permisos');

test('M6 Terreno CU206 genera tareas explícitas para una OT liberada', async (t) => {
  const modulo = new M6Controller(); const sufijo = randomUUID().slice(0, 8);
  const ids = { usuarios: [], tareas: [], visitas: [], obras: [], especificaciones: [], clientes: [], ots: [] };
  const cliente = await prisma.cliente.create({ data: { cliente_cliente_rut: `P${sufijo}`.slice(0, 12), cliente_razon_social: `Cliente producción ${sufijo}` } }); ids.clientes.push(cliente.cliente_cliente_rut);
  const puerta = await prisma.especificaciones_puerta.create({ data: { especificacion_puerta_modelo_puerta: `Puerta producción ${sufijo}`, especificacion_puerta_zona: 'Producción' } }); ids.especificaciones.push(puerta.especificacion_puerta_especificacion_puerta_id);
  const obra = await prisma.obra.create({ data: { obra_nombre_obra: `Obra producción ${sufijo}`, rut_cliente: cliente.cliente_cliente_rut, id_especificacion_puerta: puerta.especificacion_puerta_especificacion_puerta_id } }); ids.obras.push(obra.obra_obra_id);
  const visita = await prisma.servicio_terreno.create({ data: { servicio_terreno_tipo_servicio: 'Levantamiento', id_obra: obra.obra_obra_id } }); ids.visitas.push(visita.servicio_terreno_servicio_terreno_id);
  const tecnico = await prisma.usuario.create({ data: { usuario_username: `prod_${sufijo}` } }); ids.usuarios.push(tecnico.usuario_id_usuario);
  const tareaOrigen = await prisma.tarea.create({ data: { tarea_titulo: `Origen OT ${sufijo}`, id_servicio_terreno: visita.servicio_terreno_servicio_terreno_id } }); ids.tareas.push(tareaOrigen.tarea_tarea_id);
  await prisma.tarea_usuario.create({ data: { tarea_usuario_tarea_id: tareaOrigen.tarea_tarea_id, tarea_usuario_usuario_id: tecnico.usuario_id_usuario } });
  const actor = { id: tecnico.usuario_id_usuario, administrador: false };
  try {
    await modulo.guardarLevantamientoTerreno(Number(tareaOrigen.tarea_tarea_id), { medidas: { marcoAncho: '90', marcoAlto: '210' } }, actor);
    const creada = await modulo.generarOrdenTrabajoLevantamiento(Number(tareaOrigen.tarea_tarea_id), actor); ids.ots.push(BigInt(creada.ordenTrabajo.id));

    await t.test('rechaza OT pendiente activa completada y cancelada', async () => {
      for (const estado of ['pendiente', 'activa', 'completada', 'cancelada']) {
        await prisma.orden_trabajo.update({ where: { orden_trabajo_id_orden: ids.ots[0] }, data: { orden_trabajo_estado: estado } });
        await assert.rejects(modulo.generarTareasProduccion(Number(tareaOrigen.tarea_tarea_id), Number(ids.ots[0]), { tareas: [{ titulo: 'Explícita' }] }, actor), (error) => error.estado === 409);
      }
      assert.equal(await prisma.tarea.count({ where: { id_orden_trabajo: ids.ots[0] } }), 0);
    });

    await t.test('CU205 libera la OT y CU206 valida entrada explícita', async () => {
      await prisma.orden_trabajo.update({ where: { orden_trabajo_id_orden: ids.ots[0] }, data: { orden_trabajo_estado: 'pendiente' } });
      assert.equal((await modulo.liberarOrdenTrabajoTerreno(Number(tareaOrigen.tarea_tarea_id), Number(ids.ots[0]), actor)).ordenTrabajo.estado, 'en_progreso');
      await assert.rejects(modulo.generarTareasProduccion(Number(tareaOrigen.tarea_tarea_id), Number(ids.ots[0]), { tareas: [] }, actor), (error) => error.estado === 400);
      await assert.rejects(modulo.generarTareasProduccion(Number(tareaOrigen.tarea_tarea_id), Number(ids.ots[0]), { tareas: [{ titulo: '' }] }, actor), (error) => error.estado === 400);
      await assert.rejects(modulo.generarTareasProduccion(Number(tareaOrigen.tarea_tarea_id), Number(ids.ots[0]), { tareas: [{ titulo: 'No asignar', responsable: tecnico.usuario_id_usuario.toString() }] }, actor), (error) => error.estado === 400);
      await assert.rejects(modulo.generarTareasProduccion(Number(tareaOrigen.tarea_tarea_id), Number(ids.ots[0]), { tareas: [{ titulo: 'No debe persistir' }, { titulo: '' }] }, actor), (error) => error.estado === 400);
      assert.equal(await prisma.tarea.count({ where: { id_orden_trabajo: ids.ots[0] } }), 0);
    });

    const entrada = { tareas: [
      { titulo: `Preparación especial ${sufijo}`, descripcion: 'Definida manualmente', instrucciones: 'Seguir especificación vigente' },
      { titulo: `Verificación especial ${sufijo}`, descripcion: '', instrucciones: '' },
    ] };

    await t.test('crea exactamente el lote recibido, pendiente y vinculado a OT y puerta', async () => {
      const resultado = await modulo.generarTareasProduccion(Number(tareaOrigen.tarea_tarea_id), Number(ids.ots[0]), entrada, actor);
      assert.equal(resultado.ordenTrabajo.tareasProduccion.length, 2);
      assert.deepEqual(resultado.ordenTrabajo.tareasProduccion.map((item) => item.titulo), entrada.tareas.map((item) => item.titulo));
      const fisicas = await prisma.tarea.findMany({ where: { id_orden_trabajo: ids.ots[0] }, orderBy: { tarea_tarea_id: 'asc' } }); ids.tareas.push(...fisicas.map((item) => item.tarea_tarea_id));
      assert.equal(fisicas.length, 2);
      for (const tarea of fisicas) {
        assert.equal(tarea.tarea_estado_de_tarea, 'pendiente'); assert.equal(tarea.id_orden_trabajo, ids.ots[0]);
        assert.equal(tarea.id_especificacion_puerta, puerta.especificacion_puerta_especificacion_puerta_id); assert.equal(tarea.id_usuario, null); assert.equal(tarea.id_servicio_terreno, null);
        assert.ok(tarea.tarea_fecha_de_creacion); assert.ok(tarea.tarea_fecha_de_ultima_actualizacion);
      }
      assert.equal(await prisma.tarea_usuario.count({ where: { tarea_usuario_tarea_id: { in: fisicas.map((item) => item.tarea_tarea_id) } } }), 0);
    });

    await t.test('segunda llamada devuelve el lote persistido sin duplicar', async () => {
      const resultado = await modulo.generarTareasProduccion(Number(tareaOrigen.tarea_tarea_id), Number(ids.ots[0]), { tareas: [{ titulo: 'No debe crearse' }] }, actor);
      assert.equal(resultado.ordenTrabajo.tareasProduccion.length, 2);
      assert.equal(await prisma.tarea.count({ where: { id_orden_trabajo: ids.ots[0] } }), 2);
    });

    await t.test('dos llamadas concurrentes no crean un segundo lote', async () => {
      await prisma.tarea.deleteMany({ where: { id_orden_trabajo: ids.ots[0] } }); ids.tareas = [tareaOrigen.tarea_tarea_id];
      const resultados = await Promise.allSettled([
        modulo.generarTareasProduccion(Number(tareaOrigen.tarea_tarea_id), Number(ids.ots[0]), entrada, actor),
        modulo.generarTareasProduccion(Number(tareaOrigen.tarea_tarea_id), Number(ids.ots[0]), entrada, actor),
      ]);
      assert.equal(resultados.filter((resultado) => resultado.status === 'fulfilled').length >= 1, true);
      assert.equal(await prisma.tarea.count({ where: { id_orden_trabajo: ids.ots[0] } }), 2);
      ids.tareas.push(...(await prisma.tarea.findMany({ where: { id_orden_trabajo: ids.ots[0] }, select: { tarea_tarea_id: true } })).map((item) => item.tarea_tarea_id));
    });

    await t.test('CU206 tiene permiso independiente y CU207 permanece ausente', async () => {
      assert.equal(codigosTodosLosCU.length, 274); assert.deepEqual(matrizPermisosPorCU.CU206, []); assert.equal(operacionesPermiso.generarTareasProduccion, 'CU206');
      assert.equal(permiteOperacion('generarTareasProduccion', ['CU205']), false); assert.equal(permiteOperacion('generarTareasProduccion', ['CU206']), true); assert.equal(permiteOperacion('obtenerLevantamientoTerreno', ['CU206']), true); assert.equal(codigosTodosLosCU.includes('CU215'),true);
      const autorizacion = { autorizar: async (operacion) => { if (!permiteOperacion(operacion, ['CU206'])) { const error = new Error('No autorizado'); error.estado = 403; throw error; } return { ...actor, permisos: ['CU206'], configuracion: 'particular' }; } };
      const m6 = { generarTareasProduccion: async (_id, ordenId, cuerpo, recibido) => ({ ordenId, cantidad: cuerpo.tareas.length, actor: recibido.id.toString() }) };
      const fachada = new C_Finanzas(autorizacion, {}, {}, {}, {}, {}, m6); const respuesta = await fachada.ejecutar('generarTareasProduccion', { parametros: { id: tareaOrigen.tarea_tarea_id.toString(), ordenId: ids.ots[0].toString() }, cuerpo: entrada, contexto: {} });
      assert.equal(respuesta.ordenId, Number(ids.ots[0])); assert.equal(respuesta.cantidad, 2);
    });

    await t.test('migración es mínima y no existen tareas hardcodeadas ni CU207', () => {
      const migracion = readFileSync(resolve('prisma/migrations/038_m6_terreno_tarea_orden_trabajo/migration.sql'), 'utf8'); const controlador = readFileSync(resolve('src/controladores/M6Controller.ts'), 'utf8'); const rutas = readFileSync(resolve('src/rutas/finanzas.ts'), 'utf8');
      assert.match(migracion, /ADD COLUMN id_orden_trabajo BIGINT/i); assert.match(migracion, /REFERENCES inventario\.orden_trabajo/i); assert.match(migracion, /CREATE INDEX idx_tarea_orden_trabajo/i);
      assert.doesNotMatch(controlador, /['"](?:Corte|Soldadura|Pintura)['"]/i); assert.doesNotMatch(controlador, /tarea_tipo\.(?:create|upsert)/); assert.match(rutas, /generarTareasProduccion/); assert.doesNotMatch(rutas, /CU207|asignarTareasProduccion/);
    });
  } finally {
    await prisma.tarea_usuario.deleteMany({ where: { tarea_usuario_tarea_id: { in: ids.tareas } } });
    await prisma.tarea.deleteMany({ where: { id_orden_trabajo: { in: ids.ots } } });
    await prisma.tarea.deleteMany({ where: { tarea_tarea_id: { in: ids.tareas } } });
    await prisma.orden_trabajo.deleteMany({ where: { orden_trabajo_id_orden: { in: ids.ots } } });
    await prisma.especificaciones_puerta.updateMany({ where: { especificacion_puerta_especificacion_puerta_id: { in: ids.especificaciones } }, data: { id_medidas: null } });
    await prisma.medidas_puerta.deleteMany({ where: { id_especificacion_puerta: { in: ids.especificaciones } } }); await prisma.historial_cambio_orden_trabajo.deleteMany({ where: { id_especificaciones_puerta: { in: ids.especificaciones } } });
    await prisma.servicio_terreno.deleteMany({ where: { servicio_terreno_servicio_terreno_id: { in: ids.visitas } } }); await prisma.obra.deleteMany({ where: { obra_obra_id: { in: ids.obras } } });
    await prisma.especificaciones_puerta.deleteMany({ where: { especificacion_puerta_especificacion_puerta_id: { in: ids.especificaciones } } }); await prisma.cliente.deleteMany({ where: { cliente_cliente_rut: { in: ids.clientes } } }); await prisma.usuario.deleteMany({ where: { usuario_id_usuario: { in: ids.usuarios } } });
  }
});
