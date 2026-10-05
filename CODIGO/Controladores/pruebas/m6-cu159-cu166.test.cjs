const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const express = require('express');
const { prisma } = require('../dist/db');
const { M6Controller } = require('../dist/controladores/M6Controller');
const { C_Finanzas } = require('../dist/controladores/C_Finanzas');
const { crearRutasFinanzas } = require('../dist/rutas/finanzas');
const { operacionesPermiso, codigosTodosLosCU, matrizPermisosPorCU, permiteOperacion } = require('../dist/validaciones/permisos');

function rutValido() {
  const cuerpo=String(Math.floor(Math.random()*8_000_000)+1_000_000); let suma=0,m=2;
  for(let i=cuerpo.length-1;i>=0;i--){suma+=Number(cuerpo[i])*m;m=m===7?2:m+1;}
  const r=11-(suma%11); return `${cuerpo}-${r===11?'0':r===10?'K':r}`;
}
const borrarEmpleado=async(id)=>{await prisma.asignacion_concepto_remuneracion_empleado.deleteMany({where:{id_empleado:id}});await prisma.asignacion_esquema_remuneracional.deleteMany({where:{id_empleado:id}});await prisma.empleado.delete({where:{id_empleado:id}})};
const borrarEsquema=async(id)=>{await prisma.tarifa_esquema_remuneracional.deleteMany({where:{id_esquema:id}});await prisma.asignacion_esquema_remuneracional.deleteMany({where:{id_esquema:id}});await prisma.esquema_remuneracional.delete({where:{id_esquema_remuneracional:id}})};
const borrarConcepto=async(id)=>{await prisma.asignacion_concepto_remuneracion_empleado.deleteMany({where:{id_concepto:id}});await prisma.configuracion_concepto_remuneracion.deleteMany({where:{id_concepto:id}});await prisma.concepto_remuneracion.delete({where:{id_concepto_remuneracion:id}})};

test('M6 T2 CU159-CU166 configura esquemas y HABER sin calcular remuneraciones',async t=>{
  const modulo=new M6Controller();

  await t.test('CU159 consume esquemas existentes, permite varios y bloquea superposición',async()=>{
    const sufijo=randomUUID().slice(0,8); const empleado=await modulo.crearEmpleado({rut:rutValido(),nombres:'Eva',apellidoPaterno:'Esquemas'});
    const sueldoAntes=(await prisma.empleado.findUniqueOrThrow({where:{id_empleado:empleado.id}})).sueldo_base;
    assert.ok(Array.isArray(await modulo.catalogosAsignacionEsquemas()));
    const e1=await prisma.esquema_remuneracional.create({data:{codigo:`T159A${sufijo}`,nombre:`Esquema A ${sufijo}`,vigencia_desde:new Date('2026-01-01')}});
    const e2=await prisma.esquema_remuneracional.create({data:{codigo:`T159B${sufijo}`,nombre:`Esquema B ${sufijo}`,vigencia_desde:new Date('2026-01-01')}});
    const e3=await prisma.esquema_remuneracional.create({data:{codigo:`T159C${sufijo}`,nombre:`Esquema C ${sufijo}`,vigencia_desde:new Date('2026-01-01')}});
    try{
      await modulo.asignarEsquemaEmpleado(empleado.id,{idEsquema:e1.id_esquema_remuneracional,vigenciaDesde:'2026-01-01'});
      const asignaciones=await modulo.asignarEsquemaEmpleado(empleado.id,{idEsquema:e2.id_esquema_remuneracional,vigenciaDesde:'2026-02-01'});
      assert.equal(asignaciones.length,2);
      await assert.rejects(modulo.asignarEsquemaEmpleado(empleado.id,{idEsquema:e1.id_esquema_remuneracional,vigenciaDesde:'2026-03-01'}),e=>e.estado===409);
      await assert.rejects(modulo.asignarEsquemaEmpleado(2_000_000_000,{idEsquema:e1.id_esquema_remuneracional,vigenciaDesde:'2026-01-01'}),e=>e.estado===404);
      await assert.rejects(modulo.asignarEsquemaEmpleado(empleado.id,{idEsquema:2_000_000_000,vigenciaDesde:'2026-01-01'}),e=>e.estado===404);
      await assert.rejects(modulo.asignarEsquemaEmpleado(empleado.id,{idEsquema:e3.id_esquema_remuneracional,vigenciaDesde:'2025-12-31'}),e=>e.estado===400);
      const carrera=await Promise.allSettled([modulo.asignarEsquemaEmpleado(empleado.id,{idEsquema:e3.id_esquema_remuneracional,vigenciaDesde:'2026-04-01'}),modulo.asignarEsquemaEmpleado(empleado.id,{idEsquema:e3.id_esquema_remuneracional,vigenciaDesde:'2026-04-01'})]);
      assert.equal(carrera.filter(x=>x.status==='fulfilled').length,1);assert.equal(await prisma.asignacion_esquema_remuneracional.count({where:{id_empleado:empleado.id,id_esquema:e3.id_esquema_remuneracional}}),1);
      assert.equal((await prisma.empleado.findUniqueOrThrow({where:{id_empleado:empleado.id}})).sueldo_base?.toString()??null,sueldoAntes?.toString()??null);
    }finally{await borrarEmpleado(empleado.id);await borrarEsquema(e1.id_esquema_remuneracional);await borrarEsquema(e2.id_esquema_remuneracional);await borrarEsquema(e3.id_esquema_remuneracional)}
  });

  await t.test('CU160 asigna sólo conceptos HABER y no calcula liquidación',async()=>{
    const sufijo=randomUUID().slice(0,8); const empleado=await modulo.crearEmpleado({rut:rutValido(),nombres:'Eva',apellidoPaterno:'Haberes'});
    const crear=(tipo,naturaleza)=>prisma.concepto_remuneracion.create({data:{codigo_m6:`${tipo.slice(0,3)}${sufijo}`,nombre_concepto:`${tipo} ${sufijo}`,naturaleza_concepto:naturaleza}});
    const haber=await crear('HABER','haber'),deduccion=await crear('DEDUCCION','descuento'),aporte=await crear('APORTE_EMPLEADOR','aporte_empleador');
    try{
      const antes=await prisma.liquidacion_remuneracion.count({where:{rut_empleado:empleado.rut}});
      const asignaciones=await modulo.asignarHaberEmpleado(empleado.id,{idConcepto:haber.id_concepto_remuneracion,vigenciaDesde:'2026-01-01',valorAplicable:100});assert.equal(asignaciones.length,1);
      await assert.rejects(modulo.asignarHaberEmpleado(empleado.id,{idConcepto:deduccion.id_concepto_remuneracion,vigenciaDesde:'2026-01-01'}),e=>e.estado===400);
      await assert.rejects(modulo.asignarHaberEmpleado(empleado.id,{idConcepto:aporte.id_concepto_remuneracion,vigenciaDesde:'2026-01-01'}),e=>e.estado===400);
      await assert.rejects(modulo.asignarHaberEmpleado(empleado.id,{idConcepto:haber.id_concepto_remuneracion,vigenciaDesde:'2026-02-01'}),e=>e.estado===409);
      assert.equal(await prisma.liquidacion_remuneracion.count({where:{rut_empleado:empleado.rut}}),antes);
    }finally{await borrarEmpleado(empleado.id);await borrarConcepto(haber.id_concepto_remuneracion);await borrarConcepto(deduccion.id_concepto_remuneracion);await borrarConcepto(aporte.id_concepto_remuneracion)}
  });

  await t.test('CU161 reutiliza estado actual y valida disponibilidad del canal',async()=>{
    const empleado=await modulo.crearEmpleado({rut:rutValido(),nombres:'Eva',apellidoPaterno:'Documental'});
    try{
      await prisma.empleado.update({where:{id_empleado:empleado.id},data:{correo_particular:'eva@example.cl'}});
      let actual=await modulo.actualizarConfiguracionDocumental(empleado.id,{consentimientoElectronico:true,canalDocumental:'correo_particular'});assert.equal(actual.canalDocumental,'correo_particular');assert.deepEqual(actual.canalesDisponibles,['correo_particular']);
      actual=await modulo.actualizarConfiguracionDocumental(empleado.id,{consentimientoElectronico:false,canalDocumental:''});assert.equal(actual.consentimientoElectronico,false);assert.equal(actual.canalDocumental,null);
      await assert.rejects(modulo.actualizarConfiguracionDocumental(empleado.id,{consentimientoElectronico:false,canalDocumental:'papel'}),e=>e.estado===400);
      await assert.rejects(modulo.actualizarConfiguracionDocumental(empleado.id,{consentimientoElectronico:true,canalDocumental:'correo_corporativo'}),e=>e.estado===409);
    }finally{await borrarEmpleado(empleado.id)}
  });

  await t.test('CU162 administra esquemas y Cargo default sin alterar empleado',async()=>{
    const sufijo=randomUUID().slice(0,8); const empleado=await modulo.crearEmpleado({rut:rutValido(),nombres:'Eva',apellidoPaterno:'Catalogo'}); const cargo=await prisma.cargo.findFirstOrThrow({where:{estado_cargo:'activo'}});
    let id;
    try{
      let lista=await modulo.crearEsquema({codigo:`C162${sufijo}`,nombre:`Catálogo ${sufijo}`,vigenciaDesde:'2026-01-01'}); const creado=lista.find(x=>x.codigo===`C162${sufijo}`.toUpperCase());id=creado.id;
      lista=await modulo.actualizarEsquema(id,{descripcion:'Configuración reutilizable'});assert.equal(lista.find(x=>x.id===id).descripcion,'Configuración reutilizable');
      await assert.rejects(modulo.actualizarEsquema(id,{vigenciaHasta:'2025-12-31'}),e=>e.estado===400);
      await modulo.asignarEsquemaCargo(id,{idCargo:cargo.id_cargo,vigenciaDesde:'2026-01-01'});
      await modulo.asignarEsquemaEmpleado(empleado.id,{idEsquema:id,vigenciaDesde:'2026-01-01'});
      assert.equal((await modulo.listarEsquemas()).find(x=>x.id===id).cargos.length,1);
      assert.equal((await prisma.empleado.findUniqueOrThrow({where:{id_empleado:empleado.id}})).id_cargo,null);
    }finally{await borrarEmpleado(empleado.id);if(id)await borrarEsquema(id)}
  });

  await t.test('CU163 conserva vigencias, excepciones y rechaza carreras',async()=>{
    const sufijo=randomUUID().slice(0,8); const esquema=await prisma.esquema_remuneracional.create({data:{codigo:`C163${sufijo}`,nombre:`Tarifa ${sufijo}`,vigencia_desde:new Date('2026-01-01')}});
    try{
      await modulo.crearTarifaEsquema(esquema.id_esquema_remuneracional,{modalidad:'FIJO',valor:100,vigenciaDesde:'2026-01-01',vigenciaHasta:'2026-06-30'});
      await modulo.crearTarifaEsquema(esquema.id_esquema_remuneracional,{modalidad:'FIJO',valor:120,vigenciaDesde:'2026-07-01'});
      await modulo.crearTarifaEsquema(esquema.id_esquema_remuneracional,{modalidad:'FIJO',valor:130,vigenciaDesde:'2026-07-10',vigenciaHasta:'2026-07-20',esExcepcion:true});
      assert.equal((await modulo.listarTarifasEsquema(esquema.id_esquema_remuneracional)).length,3);
      await assert.rejects(modulo.crearTarifaEsquema(esquema.id_esquema_remuneracional,{modalidad:'FIJO',valor:140,vigenciaDesde:'2026-08-01'}),e=>e.estado===409);
      const carrera=await Promise.allSettled([modulo.crearTarifaEsquema(esquema.id_esquema_remuneracional,{modalidad:'FIJO',valor:1,vigenciaDesde:'2027-01-01',esExcepcion:true}),modulo.crearTarifaEsquema(esquema.id_esquema_remuneracional,{modalidad:'FIJO',valor:2,vigenciaDesde:'2027-01-01',esExcepcion:true})]);
      assert.equal(carrera.filter(x=>x.status==='fulfilled').length,1);assert.equal(await prisma.tarifa_esquema_remuneracional.count({where:{id_esquema:esquema.id_esquema_remuneracional,es_excepcion:true,vigencia_desde:new Date('2027-01-01')}}),1);
    }finally{await borrarEsquema(esquema.id_esquema_remuneracional)}
  });

  await t.test('CU164 activa configuración completa y bloquea dependencia ambigua',async()=>{
    const sufijo=randomUUID().slice(0,8); const esquema=await prisma.esquema_remuneracional.create({data:{codigo:`C164${sufijo}`,nombre:`Revisión ${sufijo}`,vigencia_desde:new Date('2026-01-01')}});
    try{
      let tarifas=await modulo.crearTarifaEsquema(esquema.id_esquema_remuneracional,{modalidad:'FIJO',valor:100,vigenciaDesde:'2026-01-01'}); const valida=tarifas[0];
      tarifas=await modulo.crearTarifaEsquema(esquema.id_esquema_remuneracional,{modalidad:'REGLA',reglaTipo:'REFERENCIA_CONTROLADA',vigenciaDesde:'2026-01-01',esExcepcion:true}); const incompleta=tarifas.find(x=>x.modalidad==='REGLA');
      assert.equal((await modulo.revisarTarifaEsquema(esquema.id_esquema_remuneracional,valida.id)).find(x=>x.id===valida.id).estadoRevision,'activa');
      const revisadas=await modulo.revisarTarifaEsquema(esquema.id_esquema_remuneracional,incompleta.id);assert.equal(revisadas.find(x=>x.id===incompleta.id).estadoRevision,'bloqueada');assert.ok(revisadas.find(x=>x.id===incompleta.id).causaBloqueo);
    }finally{await borrarEsquema(esquema.id_esquema_remuneracional)}
  });

  await t.test('CU165 crea HABER común y CU160 lo consume extremo a extremo',async()=>{
    const sufijo=randomUUID().slice(0,8); const empleado=await modulo.crearEmpleado({rut:rutValido(),nombres:'Eva',apellidoPaterno:'Integración'});let id;
    try{
      const lista=await modulo.crearHaber({codigo:`H165${sufijo}`,nombre:`Bono ${sufijo}`,modalidad:'FIJO',valor:500,vigenciaDesde:'2026-01-01'});id=lista.find(x=>x.codigo===`H165${sufijo}`.toUpperCase()).id;
      assert.equal((await modulo.asignarHaberEmpleado(empleado.id,{idConcepto:id,vigenciaDesde:'2026-01-01'})).length,1);
      assert.equal((await prisma.concepto_remuneracion.findUniqueOrThrow({where:{id_concepto_remuneracion:id}})).naturaleza_concepto,'haber');
    }finally{await borrarEmpleado(empleado.id);if(id)await borrarConcepto(id)}
  });

  await t.test('CU166 conserva configuración anterior, futura y excepción temporal',async()=>{
    const sufijo=randomUUID().slice(0,8);let id;
    try{
      const lista=await modulo.crearHaber({codigo:`H166${sufijo}`,nombre:`Bono vigencia ${sufijo}`,modalidad:'FIJO',valor:100,vigenciaDesde:'2026-01-01',vigenciaHasta:'2026-06-30'});id=lista.find(x=>x.codigo===`H166${sufijo}`.toUpperCase()).id;
      await modulo.crearConfiguracionHaber(id,{modalidad:'FIJO',valor:120,vigenciaDesde:'2026-07-01'});
      await modulo.crearConfiguracionHaber(id,{modalidad:'FIJO',valor:150,vigenciaDesde:'2026-07-10',vigenciaHasta:'2026-07-20',esExcepcion:true});
      assert.equal((await modulo.resolverConfiguracionHaber(id,'2026-05-01')).valor,100);assert.equal((await modulo.resolverConfiguracionHaber(id,'2026-07-15')).valor,150);
      await assert.rejects(modulo.crearConfiguracionHaber(id,{modalidad:'FIJO',valor:130,vigenciaDesde:'2026-08-01'}),e=>e.estado===409);
      assert.equal((await modulo.listarHaberes()).find(x=>x.id===id).configuraciones.length,3);
    }finally{if(id)await borrarConcepto(id)}
  });

  await t.test('permisos CU159-CU166 permanecen sin perfiles inventados',async()=>{
    assert.equal(codigosTodosLosCU.length,274);assert.equal(codigosTodosLosCU.includes('CU198'),true);
    for(let numero=159;numero<=166;numero++)assert.deepEqual(matrizPermisosPorCU[`CU${numero}`],[]);
    assert.equal(operacionesPermiso.asignarEsquemaEmpleado,'CU159');assert.equal(operacionesPermiso.asignarHaberEmpleado,'CU160');assert.equal(operacionesPermiso.actualizarConfiguracionDocumental,'CU161');assert.equal(operacionesPermiso.crearEsquema,'CU162');assert.equal(operacionesPermiso.crearTarifaEsquema,'CU163');assert.equal(operacionesPermiso.revisarTarifaEsquema,'CU164');assert.equal(operacionesPermiso.crearHaber,'CU165');assert.equal(operacionesPermiso.crearConfiguracionHaber,'CU166');
    let ejecutado=false;const fachada=new C_Finanzas({autorizar:async()=>{const e=new Error('No autorizado');e.estado=403;throw e;}},{},{},{},{},{},{listarEsquemas:async()=>{ejecutado=true}});await assert.rejects(fachada.ejecutar('listarEsquemas',{contexto:{}}),e=>e.estado===403);assert.equal(ejecutado,false);
  });

  await t.test('la vista compartida no convierte CU162 en permiso maestro',async()=>{
    const actor=(permisos)=>({autorizar:async(operacion)=>{if(!permiteOperacion(operacion,permisos)){const error=new Error('No autorizado');error.estado=403;throw error;}return{id:1n,permisos,configuracion:'particular',administrador:false}}});
    const fachada=(permisos)=>new C_Finanzas(actor(permisos),{},{},{},{},{},modulo);
    assert.ok(Array.isArray(await fachada(['CU165']).ejecutar('listarHaberes',{contexto:{}})));
    await assert.rejects(fachada(['CU165']).ejecutar('crearEsquema',{contexto:{},cuerpo:{}}),e=>e.estado===403);
    assert.ok(Array.isArray(await fachada(['CU162']).ejecutar('listarEsquemas',{contexto:{}})));
    await assert.rejects(fachada(['CU162']).ejecutar('crearTarifaEsquema',{contexto:{},parametros:{id:'1'},cuerpo:{}}),e=>e.estado===403);
    await assert.rejects(fachada(['CU162']).ejecutar('revisarTarifaEsquema',{contexto:{},parametros:{id:'1',tarifaId:'1'}}),e=>e.estado===403);
    await assert.rejects(fachada(['CU162']).ejecutar('crearHaber',{contexto:{},cuerpo:{}}),e=>e.estado===403);
    await assert.rejects(fachada(['CU162']).ejecutar('crearConfiguracionHaber',{contexto:{},parametros:{id:'1'},cuerpo:{}}),e=>e.estado===403);
    assert.equal(permiteOperacion('listarEsquemas',['CU163']),true);assert.equal(permiteOperacion('listarEsquemas',['CU164']),true);assert.equal(permiteOperacion('listarHaberes',['CU166']),true);
    const app=readFileSync(resolve('../Vistas/src/App.tsx'),'utf8');const menu=readFileSync(resolve('../Vistas/src/views/DashboardWrapper/DashboardWrapper.tsx'),'utf8');
    assert.match(app,/\['CU162','CU163','CU164','CU165','CU166'\]/);assert.match(menu,/permissions:\s*\['CU162', 'CU163', 'CU164', 'CU165', 'CU166'\]/);
  });

  await t.test('concepto conserva identidad y configuración es la única fuente temporal',()=>{
    const schema=readFileSync(resolve('prisma/schema.prisma'),'utf8');const migracion=readFileSync(resolve('prisma/migrations/023_m6_asignaciones_haberes/migration.sql'),'utf8');
    assert.doesNotMatch(schema,/modalidad_calculo_m6/);assert.doesNotMatch(migracion,/modalidad_calculo_m6/);
    assert.match(schema,/model configuracion_concepto_remuneracion[\s\S]*modalidad\s+String[\s\S]*vigencia_desde[\s\S]*es_excepcion/);
  });

  await t.test('rutas estáticas de catálogos M6 preceden a /empleados/:id',async()=>{
    const operaciones=[];const aplicacion=express();aplicacion.use('/api/finanzas',crearRutasFinanzas({ejecutar:async operacion=>{operaciones.push(operacion);return[]}}));
    const servidor=await new Promise(resolve=>{const instancia=aplicacion.listen(0,'127.0.0.1',()=>resolve(instancia))});
    try{const puerto=servidor.address().port;const respuesta=await fetch(`http://127.0.0.1:${puerto}/api/finanzas/empleados/catalogos/esquemas`);assert.equal(respuesta.status,200);assert.deepEqual(operaciones,['catalogosAsignacionEsquemas']);}
    finally{await new Promise((resolve,reject)=>servidor.close(error=>error?reject(error):resolve()))}
  });
});
