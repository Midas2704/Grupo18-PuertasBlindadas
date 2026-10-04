const test=require('node:test');
const assert=require('node:assert/strict');
const {M9Controller}=require('../dist/controladores/M9Controller');
const {C_Finanzas}=require('../dist/controladores/C_Finanzas');
const {RepositorioAuditoriaM9Memoria}=require('../dist/m9/RepositorioAuditoriaM9');
const {ProductorAuditoriaM9,CATALOGO_PRODUCTORES_M9,VERSION_CONTRATO_M9}=require('../dist/m9/contratoProductor');

const actor={id:9n,sesion:'s',permisos:['CU01','CU24','CU43','CU59','CU75','CU186','CU245','CU260'],configuracion:'gerencia',administrador:true,cambiarClave:false,nombre:'Gerencia',acceso:'activo'};
const auth={autorizar:async()=>actor};

test('contrato compartido es versionado, explícito y rechaza productores/versiones no soportados',async()=>{
 assert.equal(VERSION_CONTRATO_M9,'1.0');assert.equal(CATALOGO_PRODUCTORES_M9.consultarPanelGeneralM7,undefined);assert.equal(CATALOGO_PRODUCTORES_M9.descargarPdfDashboardM7.modulo,'M7');
 const repo=new RepositorioAuditoriaM9Memoria(),m9=new M9Controller({repositorio:repo}),productor=new ProductorAuditoriaM9(m9,50);
 const entrada={identidadLogica:'contrato-x',versionContrato:'1.0',ocurridoEn:'2026-10-02T12:00:00Z',zonaHoraria:'UTC',ejecutor:{tipo:'SISTEMA'},productor:'DESCONOCIDO',modulo:'M1',operacion:'X',resultado:'EXITOSO',capacidad:'EMITIR_EVENTO_M9'};
 const acuse=await productor.ejecutarCritico(entrada,async()=>1,async()=>2).then(()=>null,e=>e);assert.equal(acuse.codigo,'M9_PRODUCTOR_NO_AUTORIZADO');assert.equal(await repo.cantidad(),0);
 await assert.rejects(m9.recibir({...entrada,productor:'M1',versionContrato:'9.9'}),e=>e.codigo==='M9_VERSION_INVALIDA');
});

test('la fachada emite al menos una operación real M1-M8 sin observar lecturas',async()=>{
 const repo=new RepositorioAuditoriaM9Memoria(),m9=new M9Controller({repositorio:repo}),productor=new ProductorAuditoriaM9(m9,50);
 const m1={crearCliente:async()=>({idCliente:1})};
 const m2={aprobarCotizacionB2B:async()=>({id:2})};
 const m3={registrarPago:async()=>({id:3})};
 const m4={registrarUsuario:async()=>({id:4})};
 const m5={crearProveedor:async()=>({id:5})};
 const m6={confirmarPagoFinal:async()=>({id:6})};
 const m7={conectarCreditoM8:()=>{},descargarPdfContextual:async()=>({nombre:'x.pdf'})};
 const m8={crearSolicitud:async()=>({id:8})};
 const f=new C_Finanzas(auth,m1,m2,m3,m4,m5,m6,m7,m8,m9,productor);
 await f.ejecutar('crearCliente',{cuerpo:{nombre:'A'},idSolicitud:'m1',contexto:{}});
 await f.ejecutar('aprobarCotizacion',{parametros:{id:'2'},cuerpo:{folioOrdenCompra:'OC-1'},idSolicitud:'m2',contexto:{}});
 await f.ejecutar('registrarPago',{cuerpo:{monto:10},idSolicitud:'m3',contexto:{}});
 await f.ejecutar('registrarUsuario',{cuerpo:{password:'Nunca debe copiarse'},idSolicitud:'m4',contexto:{}});
 await f.ejecutar('crearProveedor',{cuerpo:{nombre:'P'},idSolicitud:'m5',contexto:{}});
 await f.ejecutar('confirmarPagoFinal',{parametros:{id:'6'},idSolicitud:'m6',contexto:{}});
 await f.ejecutar('descargarPdfDashboardM7',{cuerpo:{},idSolicitud:'m7',contexto:{}});
 await f.ejecutar('crearSolicitudInicialM8',{cuerpo:{},idSolicitud:'m8',contexto:{}});
 const eventos=(await repo.listar({tamano:50})).eventos;assert.deepEqual([...new Set(eventos.map(e=>e.productor))].sort(),['M1','M2','M3','M4','M5','M6','M7','M8']);assert.equal(eventos.length,8);assert.doesNotMatch(JSON.stringify(eventos),/Nunca debe copiarse|password/i);
 const antes=await repo.cantidad();await productor.ejecutar('consultarPanelGeneralM7',actor,{idSolicitud:'lectura'},async()=>({}));assert.equal(await repo.cantidad(),antes);
});

test('identidad lógica es estable por request y reintento no duplica',async()=>{
 const repo=new RepositorioAuditoriaM9Memoria(),m9=new M9Controller({repositorio:repo}),productor=new ProductorAuditoriaM9(m9,50);
 await productor.ejecutar('crearCliente',actor,{idSolicitud:'estable',ocurridoEn:'2026-10-02T12:00:00Z'},async()=>({id:1}));await productor.ejecutar('crearCliente',actor,{idSolicitud:'estable',ocurridoEn:'2026-10-02T12:00:00Z'},async()=>({id:1}));assert.equal(await repo.cantidad(),1);
});

test('fail-closed crítico exige ACK durable; NACK y timeout no confirman owner',async()=>{
 const entrada={identidadLogica:'critico-1',versionContrato:'1.0',ocurridoEn:'2026-10-02T12:00:00Z',zonaHoraria:'UTC',ejecutor:{tipo:'SISTEMA'},productor:'M8',modulo:'M8',operacion:'DECISION_CRITICA',resultado:'EXITOSO',capacidad:'EMITIR_EVENTO_M9',critico:true};
 let confirmaciones=0;
 const ok=new ProductorAuditoriaM9({recibir:async()=>({estado:'PERSISTIDO',evento:{id:77}})},20);assert.equal(await ok.ejecutarCritico(entrada,async()=>({preparado:true}),async()=>++confirmaciones),1);
 const nack=new ProductorAuditoriaM9({recibir:async()=>{throw Object.assign(new Error('nack'),{codigo:'NACK'})}},20);await assert.rejects(nack.ejecutarCritico({...entrada,identidadLogica:'critico-2'},async()=>1,async()=>++confirmaciones));assert.equal(confirmaciones,1);
 const timeout=new ProductorAuditoriaM9({recibir:async()=>new Promise(()=>{})},5);await assert.rejects(timeout.ejecutarCritico({...entrada,identidadLogica:'critico-3'},async()=>1,async()=>++confirmaciones),e=>e.codigo==='M9_TIMEOUT');assert.equal(confirmaciones,1);
});
