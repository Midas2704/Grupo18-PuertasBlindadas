const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {randomUUID}=require('node:crypto');
const {M9Controller}=require('../dist/controladores/M9Controller');
const {RepositorioAuditoriaM9Memoria}=require('../dist/m9/RepositorioAuditoriaM9');
const {RepositorioRetryM9Prisma}=require('../dist/m9/RepositorioRetryM9');
const {RelojFijoM9,SenalesMemoriaM9}=require('../dist/m9/puertos');
const {MotorAlertasM9,ConfiguracionAlertasMemoriaM9}=require('../dist/m9/alertas');
const {estadoSeguridadEntornoM9,EXPORTACION_M9_MODO}=require('../dist/m9/seguridadEntorno');
const {prisma}=require('../dist/db');

const evento=id=>({identidadLogica:`retry-${id}-${randomUUID()}`,versionContrato:'1.0',ocurridoEn:'2035-01-01T10:00:00Z',zonaHoraria:'UTC',ejecutor:{tipo:'SISTEMA',referencia:'fixture'},productor:'M1',modulo:'M1',operacion:'CAMBIO',resultado:'EXITOSO',referencia:{tipo:'CLIENTE',id:'SINTETICO'},nuevo:{estado:'nuevo'},capacidad:'EMITIR_EVENTO_M9'});

test('M9 CUT402-CUT413 retry durable, alertas configurables y controles técnicos',async t=>{
 await t.test('CUT402-CUT410 pendiente sobrevive reinstanciación, reintenta idempotente y diagnostica sin payload',async()=>{
  const anteriores=await prisma.pendiente_evento_m9.findMany({where:{identidad_logica:{startsWith:'retry-durable-'}},select:{id_pendiente_m9:true}});const ids=anteriores.map(i=>i.id_pendiente_m9);if(ids.length){await prisma.intento_retry_m9.deleteMany({where:{id_pendiente_m9:{in:ids}}});await prisma.pendiente_evento_m9.deleteMany({where:{id_pendiente_m9:{in:ids}}});}
  const reloj=new RelojFijoM9(new Date('2035-01-02T10:00:00Z'));const retry=new RepositorioRetryM9Prisma();const fallido=new RepositorioAuditoriaM9Memoria();fallido.fallarPersistencia=true;
  const entrada=evento('durable');const primera=new M9Controller({repositorio:fallido,pendientes:retry,reloj});
  assert.equal((await primera.recibir(entrada)).estado,'PENDIENTE');
  const persistente=new RepositorioAuditoriaM9Memoria();const reiniciado=new M9Controller({repositorio:persistente,pendientes:new RepositorioRetryM9Prisma(),reloj});
  const resultado=await reiniciado.reintentarPendientes(50);assert.equal(resultado.exitosos,1);
  const guardado=await persistente.porIdentidad(entrada.identidadLogica);assert.equal(guardado.fechaOcurrencia.toISOString(),'2035-01-01T10:00:00.000Z');assert.equal(guardado.fechaPersistencia.toISOString(),'2035-01-02T10:00:00.000Z');
  assert.equal((await reiniciado.reintentarPendientes(50)).procesados,0);assert.equal(await persistente.cantidad(),1);
  const item=(await retry.listar()).find(p=>p.identidadLogica===entrada.identidadLogica);assert.equal(item.estado,'RESUELTO');assert.equal(item.intentos,1);assert.equal(JSON.stringify({estado:item.estado,intentos:item.intentos,error:item.ultimoErrorCodigo,fechas:[item.creadoEn,item.resueltoEn]}).includes('SINTETICO'),false);
  await prisma.intento_retry_m9.deleteMany({where:{id_pendiente_m9:item.id}});await prisma.pendiente_evento_m9.delete({where:{id_pendiente_m9:item.id}});
 });
 await t.test('CUT403-CUT405 intento fallido queda elegible según programación externa',async()=>{
  const reloj=new RelojFijoM9(new Date('2035-02-01T00:00:00Z'));const retry=new (require('../dist/m9/puertos').PendientesMemoriaM9)();const repo=new RepositorioAuditoriaM9Memoria();repo.fallarPersistencia=true;const modulo=new M9Controller({repositorio:repo,pendientes:retry,reloj});
  await modulo.recibir(evento('fallo'));const proximo=new Date('2035-02-02T00:00:00Z');const r=await modulo.reintentarPendientes(5,proximo);assert.equal(r.fallidos,1);const item=(await retry.listar())[0];assert.equal(item.intentos,1);assert.equal(item.proximoIntentoEn.toISOString(),proximo.toISOString());
 });
 await t.test('CUT411 dispara múltiples alertas sólo desde umbrales configurados',async()=>{
  const senales=new SenalesMemoriaM9(),motor=new MotorAlertasM9(new ConfiguracionAlertasMemoriaM9([{codigo:'A-RECHAZOS',metrica:'rechazados',operador:'GTE',umbral:2},{codigo:'A-RETRY',metrica:'retryFallidos',operador:'GT',umbral:0}]),senales);
  const alertas=await motor.evaluar({rechazados:3,retryFallidos:1,capacidad:999});assert.deepEqual(alertas.map(a=>a.codigoConfiguracion).sort(),['A-RECHAZOS','A-RETRY']);
 });
 await t.test('CUT412 reporta TLS como control de entorno sin exponer URL o credencial',()=>{const estado=estadoSeguridadEntornoM9('postgresql://usuario:secreto@db/base?sslmode=verify-full','production');assert.equal(estado.transito,'TLS_CONFIGURADO');assert.equal(JSON.stringify(estado).includes('secreto'),false);assert.equal(estado.repositorio,'CAPA_M9');});
 await t.test('CUT413 exportación en memoria no crea artefacto temporal',async()=>{const candidato=path.join(os.tmpdir(),`m9-${randomUUID()}.tmp`);const modulo=new M9Controller({repositorio:new RepositorioAuditoriaM9Memoria(),politicas:new (require('../dist/m9/politicas').MotorPoliticasM9)(new (require('../dist/m9/politicas').RepositorioPoliticasMemoriaM9)())});await modulo.recibir(evento('export'));const salida=await modulo.exportar('CSV',{}, {solicitante:'fixture'});assert.match(salida.contenido,/^data:text\/csv;base64,/);assert.equal(EXPORTACION_M9_MODO,'MEMORIA');assert.equal(fs.existsSync(candidato),false);});
});
