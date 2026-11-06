const test=require('node:test');
const assert=require('node:assert/strict');
const {M9Controller}=require('../dist/controladores/M9Controller');
const {C_Finanzas}=require('../dist/controladores/C_Finanzas');
const {RepositorioAuditoriaM9Memoria}=require('../dist/m9/RepositorioAuditoriaM9');
const {ProductorAuditoriaM9}=require('../dist/m9/contratoProductor');
const {operacionesPermiso,permiteOperacion,matrizPermisosPorCU}=require('../dist/validaciones/permisos');

const base=(identidad,modulo='M1',extra={})=>({identidadLogica:identidad,versionContrato:'1.0',ocurridoEn:'2026-10-02T12:00:00Z',zonaHoraria:'UTC',ejecutor:{tipo:'HUMANO',referencia:'17'},productor:modulo,modulo,operacion:'CAMBIO_CONFIRMADO',resultado:'EXITOSO',referencia:{tipo:'CLIENTE',id:'11'},anterior:{nombre:'Anterior'},nuevo:{nombre:'Nuevo'},motivo:'Corrección autorizada',capacidad:'EMITIR_EVENTO_M9',...extra});
const actor=(permisos,configuracion='secretaria')=>({id:17n,sesion:'s',permisos,configuracion,administrador:false,cambiarClave:false,nombre:'A',acceso:'activo'});
const autorizacion=(permisos,configuracion='secretaria')=>({autorizar:async operacion=>{if(!permiteOperacion(operacion,permisos)){const e=new Error('No autorizado');e.estado=403;throw e}return actor(permisos,configuracion)}});
const fachada=(auth,m9)=>new C_Finanzas(auth,{},{},{},{},{},{},{},{},m9,new ProductorAuditoriaM9(m9,50));

test('M9 CUT354-CUT362 integra permisos M4, scope, masking y agregado',async()=>{
 assert.equal(operacionesPermiso.consultarAuditoriaM9,'CU355');
 assert.equal(operacionesPermiso.exportarAuditoriaM9,'CU359');
 assert.deepEqual(matrizPermisosPorCU.CU355,['gerencia','secretaria','contador']);
 assert.deepEqual(matrizPermisosPorCU.CU359,['gerencia','contador']);
 assert.equal(permiteOperacion('exportarAuditoriaM9',['CU355']),false);
 const repo=new RepositorioAuditoriaM9Memoria(),m9=new M9Controller({repositorio:repo});
 await m9.recibir(base('scope-m1'));
 await m9.recibir(base('scope-m5','M5'));
 const f=fachada(autorizacion(['CU355','CU05']),m9);
 const listado=await f.ejecutar('consultarAuditoriaM9',{consulta:{tamano:20},contexto:{}});
 assert.equal(listado.total,1);assert.equal(listado.eventos[0].modulo,'M1');
 assert.equal(listado.eventos[0].cambios,'***');assert.equal(listado.eventos[0].motivo,'***');
 const permitido=await f.ejecutar('obtenerDetalleAuditoriaM9',{parametros:{id:'1'},contexto:{}});assert.equal(permitido.navegacionOwner,null);
 await assert.rejects(f.ejecutar('obtenerDetalleAuditoriaM9',{parametros:{id:'2'},contexto:{}}),e=>e.estado===404);
 await assert.rejects(f.ejecutar('exportarAuditoriaM9',{parametros:{formato:'CSV'},contexto:{}}),e=>e.estado===403);
 const resumen=await f.ejecutar('consultarResumenAuditoriaM9',{contexto:{}});assert.equal(resumen.estado,'DISPONIBLE');assert.ok(resumen.porModulo.M1>=1);assert.equal(resumen.porModulo.M5,undefined);
});

test('CU363-CU365 lista, detalle y exportan el mismo scope con eventos terminales únicos',async()=>{
 const repo=new RepositorioAuditoriaM9Memoria(),m9=new M9Controller({repositorio:repo});
 const creado=(await m9.recibir(base('e2e-m1'))).evento;
 const f=fachada(autorizacion(['CU355','CU359','CU05','CU09'],'gerencia'),m9);
 const antes=await repo.cantidad();
 const lista=await f.ejecutar('consultarAuditoriaM9',{consulta:{modulo:'M1'},contexto:{}});assert.equal(lista.total,1);assert.equal(await repo.cantidad(),antes+1);
 const detalle=await f.ejecutar('obtenerDetalleAuditoriaM9',{parametros:{id:String(creado.id)},contexto:{}});assert.equal(detalle.evento.id,creado.id);assert.equal(detalle.navegacionOwner.ruta,'/clientes/11');assert.equal(await repo.cantidad(),antes+2);
 const salida=await f.ejecutar('exportarAuditoriaM9',{parametros:{formato:'CSV'},consulta:{modulo:'M1'},contexto:{}});assert.equal(salida.total,1);assert.match(salida.contenido,/^data:text\/csv;base64,/);assert.equal(await repo.cantidad(),antes+3);
 const terminales=(await repo.listar({tamano:50},['M9'])).eventos;assert.deepEqual(terminales.map(e=>e.operacion).sort(),['APERTURA_DETALLE','CONSULTA_EVIDENCIA','EXPORTACION_EVIDENCIA']);assert.ok(terminales.every(e=>e.contextoTerminal));
});

test('frontera HTTP M9 normaliza paginación string sin debilitar validación ni scope',async()=>{
 const repo=new RepositorioAuditoriaM9Memoria(),m9=new M9Controller({repositorio:repo});
 await m9.recibir(base('http-m1-a','M1',{resultado:'RECHAZADO'}));
 await m9.recibir(base('http-m1-b','M1',{operacion:'OTRA'}));
 await m9.recibir(base('http-m5','M5'));
 const f=fachada(autorizacion(['CU355','CU359','CU05'],'gerencia'),m9);
 const primera=await f.ejecutar('consultarAuditoriaM9',{consulta:{pagina:'1',tamano:'25',modulo:'M1',resultado:'RECHAZADO'},contexto:{}});
 assert.equal(primera.total,1);assert.equal(primera.pagina,1);assert.equal(primera.tamano,25);assert.equal(primera.eventos[0].identidadLogica,'http-m1-a');
 const segunda=await f.ejecutar('consultarAuditoriaM9',{consulta:{pagina:'2',tamano:'1',modulo:'M1',orden:'asc'},contexto:{}});
 assert.equal(segunda.pagina,2);assert.equal(segunda.tamano,1);assert.equal(segunda.total,2);assert.equal(segunda.eventos.length,1);
 for(const consulta of [{pagina:'abc'},{pagina:'1.5'},{pagina:'0'},{tamano:'0'},{tamano:'-1'},{tamano:'999999'}]) await assert.rejects(f.ejecutar('consultarAuditoriaM9',{consulta,contexto:{}}),e=>e.estado===400&&e.codigo==='M9_FILTRO_INVALIDO');
 const csv=await f.ejecutar('exportarAuditoriaM9',{parametros:{formato:'CSV'},consulta:{pagina:'1',tamano:'25',desde:'2026-10-01',hasta:'2026-10-31',modulo:'M1',resultado:'RECHAZADO'},contexto:{}});
 assert.equal(csv.total,1);assert.match(csv.contenido,/^data:text\/csv;base64/);
 const pdf=await f.ejecutar('exportarAuditoriaM9',{parametros:{formato:'PDF'},consulta:{pagina:'1',tamano:'25',modulo:'M1'},contexto:{}});
 assert.equal(pdf.total,2);assert.match(pdf.contenido,/^data:application\/pdf;base64/);
 assert.equal((await f.ejecutar('consultarAuditoriaM9',{consulta:{pagina:'1',tamano:'25'},contexto:{}})).eventos.some(e=>e.modulo==='M5'),false);
});

test('exportación revalida M4 en cada solicitud y conserva masking',async()=>{
 const repo=new RepositorioAuditoriaM9Memoria(),m9=new M9Controller({repositorio:repo});await m9.recibir(base('revalidar'));
 let permitir=true,veces=0;const auth={autorizar:async operacion=>{veces++;if(operacion==='exportarAuditoriaM9'&&!permitir){const e=new Error('revocado');e.estado=403;throw e}return actor(['CU355','CU359','CU05'],'contador')}};
 const f=fachada(auth,m9);const primera=await f.ejecutar('exportarAuditoriaM9',{parametros:{formato:'CSV'},contexto:{}});assert.equal(primera.total,1);permitir=false;await assert.rejects(f.ejecutar('exportarAuditoriaM9',{parametros:{formato:'CSV'},contexto:{}}),e=>e.estado===403);assert.equal(veces,2);
});

test('la vista única expone filtros, cadena, masking backend y exportación por permiso',()=>{
 const fs=require('node:fs'),path=require('node:path');const raiz=path.join(__dirname,'../../Vistas/src');
 const vista=fs.readFileSync(path.join(raiz,'views/Auditoria/Auditoria.tsx'),'utf8');const app=fs.readFileSync(path.join(raiz,'App.tsx'),'utf8');
 assert.match(app,/path="auditoria"[\s\S]*permiso="CU355"/);assert.match(vista,/puedeExportar[\s\S]*CU359/);assert.match(vista,/detalle\.cadena/);assert.doesNotMatch(vista,/crear evento|editar auditor/i);
});
