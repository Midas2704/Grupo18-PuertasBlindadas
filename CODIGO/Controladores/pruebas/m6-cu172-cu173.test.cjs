const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { prisma } = require('../dist/db');
const { M6Controller } = require('../dist/controladores/M6Controller');
const { C_Finanzas } = require('../dist/controladores/C_Finanzas');
const { codigosTodosLosCU, matrizPermisosPorCU, operacionesPermiso, permiteOperacion } = require('../dist/validaciones/permisos');

function rutValido(){const cuerpo=String(Math.floor(Math.random()*8_000_000)+1_000_000);let suma=0,m=2;for(let i=cuerpo.length-1;i>=0;i--){suma+=Number(cuerpo[i])*m;m=m===7?2:m+1}const r=11-(suma%11);return `${cuerpo}-${r===11?'0':r===10?'K':r}`}

test('M6 T4 CU172-CU173 integra Terreno por referencia sin adelantar CU futuros',async t=>{
 const modulo=new M6Controller();const sufijo=randomUUID().slice(0,8);const ids={tratamientos:[],incidencias:[],ejecuciones:[],tareas:[],usuarios:[],esquemas:[],empleados:[]};
 const empleado=await modulo.crearEmpleado({rut:rutValido(),nombres:'Eva',apellidoPaterno:'Terreno'});ids.empleados.push(empleado.id);
 const usuario=await prisma.usuario.create({data:{usuario_username:`m6_${sufijo}`,usuario_nombre_completo_primer_nombre_usuario:'Eva',usuario_nombre_completo_primer_apellido_usuario:'Terreno',empleado_m4:empleado.rut}});ids.usuarios.push(usuario.usuario_id_usuario);
 const tarea=await prisma.tarea.create({data:{tarea_titulo:`Instalación ${sufijo}`,id_usuario:usuario.usuario_id_usuario}});ids.tareas.push(tarea.tarea_tarea_id);
 const esquema=await prisma.esquema_remuneracional.create({data:{codigo:`C172${sufijo}`,nombre:`Esquema CU172 ${sufijo}`,vigencia_desde:new Date('2026-01-01')}});ids.esquemas.push(esquema.id_esquema_remuneracional);
 await prisma.asignacion_esquema_remuneracional.create({data:{id_esquema:esquema.id_esquema_remuneracional,id_empleado:empleado.id,vigencia_desde:new Date('2026-01-01')}});
 const tarifa=await prisma.tarifa_esquema_remuneracional.create({data:{id_esquema:esquema.id_esquema_remuneracional,modalidad:'FIJO',valor:100,unidad:'UNIDAD',tipo_aplicacion:'por_unidad',vigencia_desde:new Date('2026-01-01'),estado_revision:'activa'}});
 const crearEjecucion=async(data={})=>{const fila=await prisma.ejecucion_tarea.create({data:{id_tarea:tarea.tarea_tarea_id,id_usuario_ejecutor:usuario.usuario_id_usuario,fecha_ejecucion:new Date('2026-06-15T12:00:00Z'),estado_ejecucion:'terminada',estado_validacion_productiva:'validada',cantidad:3,unidad:'UNIDAD',...data}});ids.ejecuciones.push(fila.id_ejecucion_tarea);return fila};
 try{
  await t.test('sólo una ejecución terminada y validada es elegible',async()=>{
   const asignada=await prisma.tarea.create({data:{tarea_titulo:`Sólo asignada ${sufijo}`,id_usuario:usuario.usuario_id_usuario}});ids.tareas.push(asignada.tarea_tarea_id);
   const pendiente=await crearEjecucion({estado_validacion_productiva:'pendiente'});const rechazada=await crearEjecucion({estado_validacion_productiva:'rechazada'});const enCurso=await crearEjecucion({estado_ejecucion:'en_ejecucion'});const valida=await crearEjecucion();
   const lista=await modulo.listarHechosRemunerables();const presentes=new Set(lista.map(x=>x.idEjecucion));
   assert.equal(presentes.has(valida.id_ejecucion_tarea.toString()),true);assert.equal(presentes.has(pendiente.id_ejecucion_tarea.toString()),false);assert.equal(presentes.has(rechazada.id_ejecucion_tarea.toString()),false);assert.equal(presentes.has(enCurso.id_ejecucion_tarea.toString()),false);assert.equal(presentes.has(asignada.tarea_tarea_id.toString()),false);
   await assert.rejects(modulo.revisarHechoRemunerable(pendiente.id_ejecucion_tarea),e=>e.estado===409);
  });

  await t.test('Usuario se resuelve a Empleado y alias de unidad/cantidad valorizan sin duplicar',async()=>{
   const ejecucion=await crearEjecucion({unidad:' un. '});const carrera=await Promise.allSettled([modulo.revisarHechoRemunerable(ejecucion.id_ejecucion_tarea),modulo.revisarHechoRemunerable(ejecucion.id_ejecucion_tarea)]);const exitoso=carrera.find(x=>x.status==='fulfilled').value;
   assert.ok(carrera.some(x=>x.status==='fulfilled'));assert.equal(exitoso.empleado.id,empleado.id);assert.equal(exitoso.tratamiento.estadoValorizacion,'valorizado');assert.equal(exitoso.tratamiento.valorPropuesto,300);
   assert.equal(await prisma.tratamiento_remuneracional_ejecucion.count({where:{id_ejecucion_tarea:ejecucion.id_ejecucion_tarea}}),1);
  });

  await t.test('unidad y cantidad tienen semántica explícita sin asumir cantidad uno',async()=>{
   let ejecucion=await crearEjecucion({cantidad:2,unidad:'HORA'});let revisado=await modulo.revisarHechoRemunerable(ejecucion.id_ejecucion_tarea);assert.equal(revisado.tratamiento.estadoValorizacion,'pendiente');assert.match(revisado.tratamiento.motivo,/unidad operacional/i);
   ejecucion=await crearEjecucion({cantidad:null,unidad:null});revisado=await modulo.revisarHechoRemunerable(ejecucion.id_ejecucion_tarea);assert.equal(revisado.tratamiento.estadoValorizacion,'pendiente');assert.equal(revisado.tratamiento.valorPropuesto,null);
   await prisma.tarifa_esquema_remuneracional.update({where:{id_tarifa_esquema:tarifa.id_tarifa_esquema},data:{tipo_aplicacion:null}});
   ejecucion=await crearEjecucion({cantidad:2,unidad:'UNIDAD'});revisado=await modulo.revisarHechoRemunerable(ejecucion.id_ejecucion_tarea);assert.equal(revisado.tratamiento.estadoValorizacion,'pendiente');assert.match(revisado.tratamiento.motivo,/no define/i);
   await prisma.tarifa_esquema_remuneracional.update({where:{id_tarifa_esquema:tarifa.id_tarifa_esquema},data:{tipo_aplicacion:'global',unidad:null}});
   ejecucion=await crearEjecucion({cantidad:null,unidad:null});revisado=await modulo.revisarHechoRemunerable(ejecucion.id_ejecucion_tarea);assert.equal(revisado.tratamiento.estadoValorizacion,'valorizado');assert.equal(revisado.tratamiento.valorPropuesto,100);
   await prisma.tarifa_esquema_remuneracional.update({where:{id_tarifa_esquema:tarifa.id_tarifa_esquema},data:{tipo_aplicacion:'por_unidad',unidad:'UNIDAD'}});
  });

  await t.test('Usuario sin Empleado queda pendiente y Empleado sin Usuario sigue válido',async()=>{
   const otroEmpleado=await modulo.crearEmpleado({rut:rutValido(),nombres:'Sin',apellidoPaterno:'Usuario'});ids.empleados.push(otroEmpleado.id);
   const otroUsuario=await prisma.usuario.create({data:{usuario_username:`sin_emp_${sufijo}`}});ids.usuarios.push(otroUsuario.usuario_id_usuario);
   const otraTarea=await prisma.tarea.create({data:{tarea_titulo:`Sin correspondencia ${sufijo}`,id_usuario:otroUsuario.usuario_id_usuario}});ids.tareas.push(otraTarea.tarea_tarea_id);
   const ejecucion=await prisma.ejecucion_tarea.create({data:{id_tarea:otraTarea.tarea_tarea_id,id_usuario_ejecutor:otroUsuario.usuario_id_usuario,fecha_ejecucion:new Date('2026-06-15T12:00:00Z'),estado_ejecucion:'terminada',estado_validacion_productiva:'validada'}});ids.ejecuciones.push(ejecucion.id_ejecucion_tarea);
   const revisado=await modulo.revisarHechoRemunerable(ejecucion.id_ejecucion_tarea);assert.equal(revisado.empleado,null);assert.equal(revisado.tratamiento.estadoRemunerabilidad,'pendiente');assert.match(revisado.tratamiento.motivo,/correspondencia/i);
   assert.ok(await prisma.empleado.findUnique({where:{id_empleado:otroEmpleado.id}}));
  });

  await t.test('falta, ambigüedad y REGLA no ejecutable no se resuelven arbitrariamente',async()=>{
   await prisma.asignacion_esquema_remuneracional.updateMany({where:{id_esquema:esquema.id_esquema_remuneracional,id_empleado:empleado.id},data:{vigencia_hasta:new Date('2026-12-31')}});
   const sinTarifa=await prisma.esquema_remuneracional.create({data:{codigo:`ST${sufijo}`,nombre:`Sin tarifa ${sufijo}`,vigencia_desde:new Date('2027-01-01')}});ids.esquemas.push(sinTarifa.id_esquema_remuneracional);
   await prisma.asignacion_esquema_remuneracional.create({data:{id_esquema:sinTarifa.id_esquema_remuneracional,id_empleado:empleado.id,vigencia_desde:new Date('2027-01-01')}});
   const eSin=await crearEjecucion({fecha_ejecucion:new Date('2027-06-01T12:00:00Z')});let revisado=await modulo.revisarHechoRemunerable(eSin.id_ejecucion_tarea);assert.equal(revisado.tratamiento.estadoValorizacion,'pendiente');assert.match(revisado.tratamiento.motivo,/tarifa/i);
   const regla=await prisma.tarifa_esquema_remuneracional.create({data:{id_esquema:sinTarifa.id_esquema_remuneracional,modalidad:'REGLA',regla_tipo:'REFERENCIA_CONTROLADA',referencia:'SIN_MOTOR',vigencia_desde:new Date('2027-01-01'),estado_revision:'activa'}});
   revisado=await modulo.revisarHechoRemunerable(eSin.id_ejecucion_tarea);assert.equal(revisado.tratamiento.estadoValorizacion,'pendiente');assert.match(revisado.tratamiento.motivo,/REGLA/);
   const extra=await prisma.tarifa_esquema_remuneracional.create({data:{id_esquema:sinTarifa.id_esquema_remuneracional,modalidad:'FIJO',valor:20,vigencia_desde:new Date('2027-01-01'),es_excepcion:true,estado_revision:'activa'}});
   revisado=await modulo.revisarHechoRemunerable(eSin.id_ejecucion_tarea);assert.equal(revisado.tratamiento.estadoValorizacion,'conflicto');assert.match(revisado.tratamiento.motivo,/múltiples tarifas/i);
   await prisma.tarifa_esquema_remuneracional.deleteMany({where:{id_tarifa_esquema:{in:[regla.id_tarifa_esquema,extra.id_tarifa_esquema]}}});
  });

  await t.test('CU173 decide dos retrabajos de una ejecución de forma independiente y conserva Terreno',async()=>{
   const resolutor2=await prisma.usuario.create({data:{usuario_username:`m6_r2_${sufijo}`,usuario_nombre_completo_primer_nombre_usuario:'Rosa'}});ids.usuarios.push(resolutor2.usuario_id_usuario);
   const ejecucion=await crearEjecucion();
   const incidencia1=await prisma.incidencia_retrabajo_tarea.create({data:{id_ejecucion_tarea:ejecucion.id_ejecucion_tarea,descripcion:'Corrección por pieza dañada',causa_referencia:'DAÑO_MATERIAL',responsabilidad:'compartida'}});ids.incidencias.push(incidencia1.id_incidencia_retrabajo);
   const incidencia2=await prisma.incidencia_retrabajo_tarea.create({data:{id_ejecucion_tarea:ejecucion.id_ejecucion_tarea,descripcion:'Revisión pendiente de clasificación',responsabilidad:'por determinar'}});ids.incidencias.push(incidencia2.id_incidencia_retrabajo);
   const terrenoAntes=await prisma.incidencia_retrabajo_tarea.findMany({where:{id_ejecucion_tarea:ejecucion.id_ejecucion_tarea},orderBy:{id_incidencia_retrabajo:'asc'}});
   let revisado=await modulo.revisarHechoRemunerable(ejecucion.id_ejecucion_tarea);assert.equal(revisado.tratamiento.estadoRemunerabilidad,'pendiente');assert.equal(revisado.retrabajos[0].causaReferencia,'DAÑO_MATERIAL');assert.equal(revisado.retrabajos[0].causaPendiente,false);assert.equal(revisado.retrabajos[1].causaReferencia,null);assert.equal(revisado.retrabajos[1].causaPendiente,true);
   await assert.rejects(modulo.resolverRetrabajo(incidencia1.id_incidencia_retrabajo,{decision:'remunerable',motivo:''},usuario.usuario_id_usuario),e=>e.estado===400);
   await modulo.resolverRetrabajo(incidencia1.id_incidencia_retrabajo,{decision:'remunerable',motivo:'Corresponde al trabajo contratado'},usuario.usuario_id_usuario);
   await new Promise(resolve=>setTimeout(resolve,10));
   revisado=await modulo.resolverRetrabajo(incidencia2.id_incidencia_retrabajo,{decision:'no_remunerable',motivo:'La segunda corrección no genera pago'},resolutor2.usuario_id_usuario);
   const decisiones=await prisma.decision_remuneracional_retrabajo.findMany({where:{id_incidencia_retrabajo:{in:[incidencia1.id_incidencia_retrabajo,incidencia2.id_incidencia_retrabajo]}},orderBy:{id_incidencia_retrabajo:'asc'}});
   assert.equal(decisiones.length,2);assert.equal(decisiones[0].decision,'remunerable');assert.equal(decisiones[1].decision,'no_remunerable');assert.notEqual(decisiones[0].motivo,decisiones[1].motivo);assert.notEqual(decisiones[0].id_usuario_resolutor,decisiones[1].id_usuario_resolutor);assert.notEqual(decisiones[0].fecha_resolucion.getTime(),decisiones[1].fecha_resolucion.getTime());
   assert.equal(revisado.retrabajos.filter(item=>item.decision).length,2);assert.equal(revisado.tratamiento.estadoRemunerabilidad,'remunerable');
   const terrenoDespues=await prisma.incidencia_retrabajo_tarea.findMany({where:{id_ejecucion_tarea:ejecucion.id_ejecucion_tarea},orderBy:{id_incidencia_retrabajo:'asc'}});assert.deepEqual(terrenoDespues,terrenoAntes);
   const pendientes=await modulo.listarRetrabajosPendientes();assert.equal(pendientes.some(item=>[incidencia1.id_incidencia_retrabajo.toString(),incidencia2.id_incidencia_retrabajo.toString()].includes(item.incidencia.id)),false);
  });

  await t.test('CU173 serializa decisiones incompatibles para la misma incidencia',async()=>{
   const ejecucion=await crearEjecucion();const incidencia=await prisma.incidencia_retrabajo_tarea.create({data:{id_ejecucion_tarea:ejecucion.id_ejecucion_tarea,descripcion:'Corrección concurrente'}});ids.incidencias.push(incidencia.id_incidencia_retrabajo);
   const carrera=await Promise.allSettled([modulo.resolverRetrabajo(incidencia.id_incidencia_retrabajo,{decision:'remunerable',motivo:'Corresponde pago'},usuario.usuario_id_usuario),modulo.resolverRetrabajo(incidencia.id_incidencia_retrabajo,{decision:'no_remunerable',motivo:'No corresponde pago'},usuario.usuario_id_usuario)]);
   assert.equal(carrera.filter(x=>x.status==='fulfilled').length,1);assert.equal(carrera.filter(x=>x.status==='rejected').length,1);assert.equal(await prisma.decision_remuneracional_retrabajo.count({where:{id_incidencia_retrabajo:incidencia.id_incidencia_retrabajo}}),1);
  });

  await t.test('permisos CU172 y CU173 son independientes y no adelanta CU211+',async()=>{
   assert.equal(codigosTodosLosCU.length,274);assert.equal(codigosTodosLosCU.includes('CU198'),true);assert.equal(codigosTodosLosCU.includes('CU201'),true);assert.equal(codigosTodosLosCU.includes('CU202'),true);assert.equal(codigosTodosLosCU.includes('CU203'),true);assert.equal(codigosTodosLosCU.includes('CU204'),true);assert.equal(codigosTodosLosCU.includes('CU205'),true);assert.equal(codigosTodosLosCU.includes('CU206'),true);assert.equal(codigosTodosLosCU.includes('CU215'),true);assert.deepEqual(matrizPermisosPorCU.CU172,[]);assert.deepEqual(matrizPermisosPorCU.CU173,[]);
   assert.equal(operacionesPermiso.revisarHechoRemunerable,'CU172');assert.equal(operacionesPermiso.resolverRetrabajo,'CU173');assert.equal(permiteOperacion('listarHechosRemunerables',['CU173']),true);assert.equal(permiteOperacion('resolverRetrabajo',['CU172']),false);assert.equal(permiteOperacion('revisarHechoRemunerable',['CU173']),false);
   assert.equal(codigosTodosLosCU.includes('CU215'),true);
   const autorizacion=(permisos)=>({autorizar:async operacion=>{if(!permiteOperacion(operacion,permisos)){const error=new Error('No autorizado');error.estado=403;throw error}return{id:usuario.usuario_id_usuario,sesion:'x',permisos,configuracion:'particular',administrador:false,cambiarClave:false,nombre:'Eva',acceso:'eva'}}});
   const m6={listarHechosRemunerables:async()=>[],revisarHechoRemunerable:async()=>({}),listarRetrabajosPendientes:async()=>[],resolverRetrabajo:async()=>({})};
   const fachada172=new C_Finanzas(autorizacion(['CU172']),{},{},{},{},{},m6);const fachada173=new C_Finanzas(autorizacion(['CU173']),{},{},{},{},{},m6);
   assert.deepEqual(await fachada172.ejecutar('listarHechosRemunerables',{contexto:{}}),[]);await assert.rejects(fachada172.ejecutar('resolverRetrabajo',{contexto:{},parametros:{id:'1'},cuerpo:{}}),e=>e.estado===403);
   assert.deepEqual(await fachada173.ejecutar('listarRetrabajosPendientes',{contexto:{}}),[]);await assert.rejects(fachada173.ejecutar('revisarHechoRemunerable',{contexto:{},parametros:{id:'1'}}),e=>e.estado===403);
  });

  await t.test('persistencia conserva referencia mínima y frontend separa acciones',()=>{
   const schema=readFileSync(resolve('prisma/schema.prisma'),'utf8');const migracion=readFileSync(resolve('prisma/migrations/028_m6_hechos_remunerables_retrabajo/migration.sql'),'utf8');const correccion=readFileSync(resolve('prisma/migrations/029_m6_auditoria_retrabajos_unidades/migration.sql'),'utf8');const controlador=readFileSync(resolve('src/controladores/M6Controller.ts'),'utf8');const vista=readFileSync(resolve('../Vistas/src/views/DetalleRemuneracion/DetalleRemuneracion.tsx'),'utf8');const app=readFileSync(resolve('../Vistas/src/App.tsx'),'utf8');
   assert.match(schema,/model\s+ejecucion_tarea\s*\{/);assert.match(schema,/id_usuario_ejecutor\s+BigInt/);assert.match(schema,/model\s+decision_remuneracional_retrabajo\s*\{/);assert.match(schema,/causa_referencia\s+String\?/);assert.match(schema,/tipo_aplicacion\s+String\?/);assert.doesNotMatch(schema,/model\s+(hecho_remunerable_consumido|snapshot_hecho|historial_retrabajo|version_retrabajo)\s*\{/i);assert.doesNotMatch(`${schema}\n${controlador}`,/eval\s*\(|new\s+Function\s*\(/);
   assert.doesNotMatch(migracion,/DROP\s+(TABLE|COLUMN)|ALTER\s+TABLE\s+inventario/i);assert.match(correccion,/UNIQUE \(id_incidencia_retrabajo\)/);assert.doesNotMatch(correccion,/ON DELETE CASCADE/i);assert.match(vista,/puede172/);assert.match(vista,/puede173/);assert.match(app,/\['CU172','CU173','CU174','CU175','CU176','CU177','CU179','CU180','CU182','CU183','CU184'\]/);
  });
 }finally{
  await prisma.decision_remuneracional_retrabajo.deleteMany({where:{id_incidencia_retrabajo:{in:ids.incidencias}}});await prisma.tratamiento_remuneracional_ejecucion.deleteMany({where:{id_ejecucion_tarea:{in:ids.ejecuciones}}});await prisma.incidencia_retrabajo_tarea.deleteMany({where:{id_ejecucion_tarea:{in:ids.ejecuciones}}});await prisma.ejecucion_tarea.deleteMany({where:{id_ejecucion_tarea:{in:ids.ejecuciones}}});await prisma.tarea.deleteMany({where:{tarea_tarea_id:{in:ids.tareas}}});await prisma.usuario.deleteMany({where:{usuario_id_usuario:{in:ids.usuarios}}});await prisma.asignacion_esquema_remuneracional.deleteMany({where:{id_esquema:{in:ids.esquemas}}});await prisma.tarifa_esquema_remuneracional.deleteMany({where:{id_esquema:{in:ids.esquemas}}});await prisma.esquema_remuneracional.deleteMany({where:{id_esquema_remuneracional:{in:ids.esquemas}}});await prisma.empleado.deleteMany({where:{id_empleado:{in:ids.empleados}}});
 }
});
