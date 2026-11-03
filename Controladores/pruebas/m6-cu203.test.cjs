const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { prisma } = require('../dist/db');
const { M6Controller } = require('../dist/controladores/M6Controller');
const { C_Finanzas } = require('../dist/controladores/C_Finanzas');
const { codigosTodosLosCU, matrizPermisosPorCU, operacionesPermiso, permiteOperacion } = require('../dist/validaciones/permisos');

test('M6 Terreno CU203 corrige levantamientos con historial Legacy', async (t) => {
  const modulo = new M6Controller(); const sufijo = randomUUID().slice(0, 8);
  const ids = { usuarios: [], tareas: [], visitas: [], obras: [], especificaciones: [], clientes: [] };
  const cliente = await prisma.cliente.create({ data: { cliente_cliente_rut: `C${sufijo}`.slice(0, 12), cliente_razon_social: `Cliente ${sufijo}` } }); ids.clientes.push(cliente.cliente_cliente_rut);
  const puerta = await prisma.especificaciones_puerta.create({ data: { especificacion_puerta_modelo_puerta: `Modelo ${sufijo}`, especificacion_puerta_zona: 'Acceso' } }); ids.especificaciones.push(puerta.especificacion_puerta_especificacion_puerta_id);
  const obra = await prisma.obra.create({ data: { obra_nombre_obra: `Obra ${sufijo}`, rut_cliente: cliente.cliente_cliente_rut, id_especificacion_puerta: puerta.especificacion_puerta_especificacion_puerta_id } }); ids.obras.push(obra.obra_obra_id);
  const visita = await prisma.servicio_terreno.create({ data: { servicio_terreno_tipo_servicio: 'Levantamiento', id_obra: obra.obra_obra_id } }); ids.visitas.push(visita.servicio_terreno_servicio_terreno_id);
  const tecnico = await prisma.usuario.create({ data: { usuario_username: `corr_${sufijo}` } }); const ajeno = await prisma.usuario.create({ data: { usuario_username: `ajeno_${sufijo}` } }); ids.usuarios.push(tecnico.usuario_id_usuario, ajeno.usuario_id_usuario);
  const tarea = await prisma.tarea.create({ data: { tarea_titulo: `Corregir ${sufijo}`, id_servicio_terreno: visita.servicio_terreno_servicio_terreno_id, id_usuario: ajeno.usuario_id_usuario } }); ids.tareas.push(tarea.tarea_tarea_id);
  await prisma.tarea_usuario.create({ data: { tarea_usuario_tarea_id: tarea.tarea_tarea_id, tarea_usuario_usuario_id: tecnico.usuario_id_usuario } });
  const actor = { id: tecnico.usuario_id_usuario, administrador: false }; const actorAjeno = { id: ajeno.usuario_id_usuario, administrador: false };
  try {
    let medidaInicial;
    await t.test('corrección requiere un levantamiento previamente registrado', async () => {
      await assert.rejects(modulo.corregirLevantamientoTerreno(Number(tarea.tarea_tarea_id), { motivo: 'Corrección prematura', medidas: { marcoAncho: '91' } }, actor), (error) => error.estado === 409);
    });
    await t.test('CU202 registra la medida inicial y establece el puntero vigente', async () => {
      const inicial = await modulo.guardarLevantamientoTerreno(Number(tarea.tarea_tarea_id), { especificacion: { sentidoApertura: 'Interior' }, medidas: { marcoAncho: '90', marcoAlto: '210' } }, actor);
      medidaInicial = BigInt(inicial.medidas.id); const fisica = await prisma.especificaciones_puerta.findUniqueOrThrow({ where: { especificacion_puerta_especificacion_puerta_id: puerta.especificacion_puerta_especificacion_puerta_id } });
      assert.equal(fisica.id_medidas, medidaInicial); assert.equal(inicial.historial.length, 0);
    });
    await t.test('corrección exige motivo', async () => {
      await assert.rejects(modulo.corregirLevantamientoTerreno(Number(tarea.tarea_tarea_id), { motivo: '', medidas: { marcoAncho: '91' } }, actor), (error) => error.estado === 400);
    });
    let primerCambio; let medidaCorregida;
    await t.test('crea historial v1 a v2, conserva medida anterior y apunta a la nueva', async () => {
      const corregido = await modulo.corregirLevantamientoTerreno(Number(tarea.tarea_tarea_id), { motivo: 'Ajuste de medición en terreno', especificacion: { sentidoApertura: 'Exterior' }, medidas: { marcoAncho: '91.5' } }, actor);
      assert.equal(corregido.especificacion.sentidoApertura, 'Exterior'); assert.equal(corregido.medidas.marcoAncho, '91.5'); assert.notEqual(BigInt(corregido.medidas.id), medidaInicial);
      assert.equal(corregido.historial.length, 1); primerCambio = corregido.historial[0]; assert.equal(primerCambio.versionAnterior, 'v1'); assert.equal(primerCambio.versionNueva, 'v2'); assert.match(primerCambio.descripcion, /sentidoApertura, marcoAncho/);
      const anterior = await prisma.medidas_puerta.findUnique({ where: { medidas_puerta_medidas_id: medidaInicial } }); assert.equal(anterior.medidas_puerta_medidas_marco_ancho.toString(), '90');
      const vigente = await prisma.especificaciones_puerta.findUniqueOrThrow({ where: { especificacion_puerta_especificacion_puerta_id: puerta.especificacion_puerta_especificacion_puerta_id } }); assert.equal(vigente.id_medidas, BigInt(corregido.medidas.id)); medidaCorregida = vigente.id_medidas;
      const nueva = await prisma.medidas_puerta.findUniqueOrThrow({ where: { medidas_puerta_medidas_id: vigente.id_medidas } }); assert.equal(nueva.id_cambio, BigInt(primerCambio.id)); assert.equal(nueva.medidas_puerta_medidas_marco_alto.toString(), '210');
    });
    await t.test('edición CU202 posterior modifica sólo la medida vigente', async () => {
      const editado = await modulo.guardarLevantamientoTerreno(Number(tarea.tarea_tarea_id), { medidas: { marcoAlto: '211' } }, actor); assert.equal(BigInt(editado.medidas.id), medidaCorregida); assert.equal(editado.medidas.marcoAlto, '211');
      const anterior = await prisma.medidas_puerta.findUniqueOrThrow({ where: { medidas_puerta_medidas_id: medidaInicial } }); assert.equal(anterior.medidas_puerta_medidas_marco_alto.toString(), '210');
      const vigente = await prisma.medidas_puerta.findUniqueOrThrow({ where: { medidas_puerta_medidas_id: medidaCorregida } }); assert.equal(vigente.medidas_puerta_medidas_marco_alto.toString(), '211');
      assert.equal(await prisma.medidas_puerta.count({ where: { id_especificacion_puerta: puerta.especificacion_puerta_especificacion_puerta_id } }), 2);
    });
    await t.test('segunda corrección incrementa v2 a v3 y lectura muestra valores vigentes', async () => {
      const corregido = await modulo.corregirLevantamientoTerreno(Number(tarea.tarea_tarea_id), { motivo: 'Corrección de zona', especificacion: { zona: 'Acceso lateral' } }, actor);
      assert.equal(corregido.historial.length, 2); assert.equal(corregido.historial[1].versionAnterior, 'v2'); assert.equal(corregido.historial[1].versionNueva, 'v3');
      const lectura = await modulo.obtenerLevantamientoTerreno(Number(tarea.tarea_tarea_id), actor); assert.equal(lectura.especificacion.zona, 'Acceso lateral'); assert.equal(lectura.medidas.marcoAncho, '91.5'); assert.ok(lectura.tarea.fechaActualizacion);
    });
    await t.test('técnico no asignado no puede corregir aunque tarea.id_usuario lo identifique', async () => {
      await assert.rejects(modulo.corregirLevantamientoTerreno(Number(tarea.tarea_tarea_id), { motivo: 'Intento ajeno', especificacion: { zona: 'Otra' } }, actorAjeno), (error) => error.estado === 403);
    });
    await t.test('permiso CU203 sigue independiente al incorporar CU205', async () => {
      assert.equal(codigosTodosLosCU.length, 274); assert.deepEqual(matrizPermisosPorCU.CU203, []); assert.equal(operacionesPermiso.corregirLevantamientoTerreno, 'CU203');
      assert.equal(permiteOperacion('corregirLevantamientoTerreno', ['CU202']), false); assert.equal(permiteOperacion('obtenerLevantamientoTerreno', ['CU203']), true); assert.equal(codigosTodosLosCU.includes('CU204'), true); assert.equal(codigosTodosLosCU.includes('CU205'), true); assert.equal(codigosTodosLosCU.includes('CU206'), true); assert.equal(codigosTodosLosCU.includes('CU215'),true);
      const autorizacion = { autorizar: async (operacion) => { if (!permiteOperacion(operacion, ['CU203'])) { const error = new Error('No autorizado'); error.estado = 403; throw error; } return { ...actor, permisos: ['CU203'], configuracion: 'particular' }; } };
      const m6 = { corregirLevantamientoTerreno: async (_id, cuerpo, recibido) => ({ motivo: cuerpo.motivo, id: recibido.id.toString() }) };
      const fachada = new C_Finanzas(autorizacion, {}, {}, {}, {}, {}, m6); const respuesta = await fachada.ejecutar('corregirLevantamientoTerreno', { parametros: { id: tarea.tarea_tarea_id.toString() }, cuerpo: { motivo: 'Autorizada' }, contexto: {} }); assert.equal(respuesta.id, tecnico.usuario_id_usuario.toString());
      const schema = readFileSync(resolve('prisma/schema.prisma'), 'utf8'); assert.doesNotMatch(schema, /model\s+(historial_levantamiento|version_levantamiento)/i);
    });
  } finally {
    await prisma.especificaciones_puerta.updateMany({ where: { especificacion_puerta_especificacion_puerta_id: { in: ids.especificaciones } }, data: { id_medidas: null } });
    await prisma.medidas_puerta.deleteMany({ where: { id_especificacion_puerta: { in: ids.especificaciones } } }); await prisma.historial_cambio_orden_trabajo.deleteMany({ where: { id_especificaciones_puerta: { in: ids.especificaciones } } });
    await prisma.tarea_usuario.deleteMany({ where: { tarea_usuario_tarea_id: { in: ids.tareas } } }); await prisma.tarea.deleteMany({ where: { tarea_tarea_id: { in: ids.tareas } } });
    await prisma.servicio_terreno.deleteMany({ where: { servicio_terreno_servicio_terreno_id: { in: ids.visitas } } }); await prisma.obra.deleteMany({ where: { obra_obra_id: { in: ids.obras } } });
    await prisma.especificaciones_puerta.deleteMany({ where: { especificacion_puerta_especificacion_puerta_id: { in: ids.especificaciones } } }); await prisma.cliente.deleteMany({ where: { cliente_cliente_rut: { in: ids.clientes } } }); await prisma.usuario.deleteMany({ where: { usuario_id_usuario: { in: ids.usuarios } } });
  }
});
