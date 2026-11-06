const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Prisma } = require('@prisma/client');
const { prisma } = require('../dist/db');
const { M6Controller } = require('../dist/controladores/M6Controller');
const { M9Controller } = require('../dist/controladores/M9Controller');
const { RepositorioAuditoriaM9Memoria } = require('../dist/m9/RepositorioAuditoriaM9');
const { ProductorAuditoriaM9 } = require('../dist/m9/contratoProductor');
const { C_Finanzas } = require('../dist/controladores/C_Finanzas');

const d = value => new Date(`${value}T12:00:00Z`);
const decimal = value => new Prisma.Decimal(value);
const periodo = (id, mes) => ({ id_periodo_remuneracion:id, anio:2026, mes, fecha_inicio:d(`2026-${String(mes).padStart(2, '0')}-01`), fecha_fin:d(`2026-${String(mes).padStart(2, '0')}-28`), creado_en:d(`2026-${String(mes).padStart(2, '0')}-01`), cerrado_en:null, cerrado_por:null });
const componente = (id, nombre, monto) => ({ id_componente_remuneracion:id, tipo:'DEDUCCION_PREVISIONAL', modalidad:'MONTO', descripcion:nombre, monto:decimal(monto), direccion:'RESTA', fuente_tipo:'LEGAL', clave_negocio:nombre, referencia_origen:'PARAMETRO:1', version_origen:'2026-10-01', fecha_origen:d('2026-10-01'), estado_revision:'VIGENTE', motivo:null, id_componente_origen:null, tipo_relacion:null, creado_por:1n, revisado_por:null, fecha_revision:null, creado_en:d('2026-10-01'), concepto:{ id_concepto_remuneracion:id, codigo_m6:nombre, nombre_concepto:nombre } });
const remuneracion = (id, p, version, vigente = true) => ({
  id_remuneracion:id, id_empleado:7, id_periodo_remuneracion:p.id_periodo_remuneracion, periodo:p,
  reemplaza_a_id:version > 1 ? id - 1 : null, reemplazada_por:vigente ? null : { id_remuneracion:id + 1 }, estado:vigente ? 'cerrada' : 'reemplazada',
  creado_en:d(`2026-${String(p.mes).padStart(2, '0')}-05`), calculado_en:d(`2026-${String(p.mes).padStart(2, '0')}-05`), cerrado_en:d(`2026-${String(p.mes).padStart(2, '0')}-06`),
  creado_por:1n, calculado_por:1n, cerrado_por:1n, creador:{}, calculador:{}, cerrador:{},
  total_haberes:decimal(1500000), total_deducciones:decimal(300000), total_descuentos_previsionales:decimal(250000), total_impuesto:decimal(30000), total_otras_deducciones:decimal(20000), total_aportes_empleador:decimal(120000), liquido_preliminar:decimal(1200000), costo_empresa:decimal(1620000), base_imponible:decimal(1500000), base_tributable:decimal(1250000),
  snapshot_previsional:{ afp:version === 1 ? 'AFP Habitat' : 'AFP Modelo', parametros:[{ codigo:'AFP_COMISION', valor:version === 1 ? '0.0127' : '0.0058' }] },
  componentes:[componente(id, 'AFP — Cotización obligatoria', 150000)], ajustes_posteriores:[],
});

test('historial remuneracional conserva períodos, versiones, pagos, reversas y snapshot legal', async () => {
  const p8=periodo(8,8), p9=periodo(9,9), p10=periodo(10,10);
  const lista=[remuneracion(80,p8,1),remuneracion(90,p9,1,false),remuneracion(91,p9,2),remuneracion(100,p10,1)];
  lista[2].ajustes_posteriores=[{ id_ajuste_posterior:1,id_remuneracion:91,fecha_hallazgo:d('2026-10-10'),direccion:'POSITIVO',monto:decimal(45000),motivo:'Diferencia detectada',tratamiento:'REGULARIZACION',id_periodo_origen:9,id_periodo_aplicable:10,creado_en:d('2026-10-10'),regularizacion:{id_regularizacion:501,monto:decimal(45000),estado:'CERRADA',creado_en:d('2026-10-11'),cerrado_en:d('2026-10-12')}}];
  const pagos=[
    {id_pago_remuneracion:1,origen_tipo:'REMUNERACION',origen_id:100,monto:decimal(1200000),estado:'CONFIRMADO',creado_en:d('2026-10-07'),creado_por:1n,confirmado_en:d('2026-10-08'),confirmado_por:1n,anulado_en:null,anulado_por:null,motivo_anulacion:null,respaldo:null,referencia:'PAGO-1',medio_pago:{nombre_medio_pago:'Transferencia'},reversiones:[{monto:decimal(100000),registrado_en:d('2026-10-09'),registrado_por:1n,motivo:'Primera reversa'},{monto:decimal(50000),registrado_en:d('2026-10-10'),registrado_por:1n,motivo:'Segunda reversa'}]},
    {id_pago_remuneracion:2,origen_tipo:'REMUNERACION',origen_id:91,monto:decimal(1200000),estado:'ANULADO',creado_en:d('2026-09-07'),creado_por:1n,confirmado_en:null,confirmado_por:null,anulado_en:d('2026-09-08'),anulado_por:1n,motivo_anulacion:'Pago reemplazado',respaldo:null,referencia:'PAGO-2',medio_pago:{nombre_medio_pago:'Transferencia'},reversiones:[]},
    {id_pago_remuneracion:3,origen_tipo:'REGULARIZACION',origen_id:501,monto:decimal(45000),estado:'CONFIRMADO',creado_en:d('2026-10-12'),creado_por:1n,confirmado_en:d('2026-10-12'),confirmado_por:1n,anulado_en:null,anulado_por:null,motivo_anulacion:null,respaldo:null,referencia:'REG-1',medio_pago:{nombre_medio_pago:'Transferencia'},reversiones:[]},
  ];
  const originales={empleado:prisma.empleado.findUnique,remuneracion:prisma.remuneracion.findMany,anticipo:prisma.anticipo_remuneracion.findMany,pago:prisma.pago_remuneracion.findMany,usuario:prisma.usuario.findMany,evento:prisma.evento_auditoria.findMany};
  prisma.empleado.findUnique=async()=>({id_empleado:7,rut_empleado:'12.345.678-5',nombres:'Ana',apellido_paterno:'Pérez',apellido_materno:null});
  prisma.remuneracion.findMany=async()=>lista;
  prisma.anticipo_remuneracion.findMany=async()=>[{id_anticipo:1,id_empleado:7,periodo:p10,modalidad:'MONTO',valor_ingresado:decimal(100000),monto_final:decimal(100000),estado_valorizacion:'VALORIZADO',creado_en:d('2026-10-02')}];
  prisma.pago_remuneracion.findMany=async()=>pagos;
  prisma.usuario.findMany=async()=>[{usuario_id_usuario:1n,usuario_username:'operador',usuario_nombre_completo_primer_nombre_usuario:'Operador M6'}];
  prisma.evento_auditoria.findMany=async()=>[{id_evento_auditoria:1,tipo_evento:'M6_DOCUMENTO_REMUNERACION',entidad_afectada:'REMUNERACION',id_registro_afectado:100,accion_realizada:'LIQUIDACION_GENERADA',resultado_evento:'EXITOSO',fecha_evento:d('2026-10-13'),usuario:{usuario_username:'operador',usuario_nombre_completo_primer_nombre_usuario:'Operador M6'}}];
  try {
    const salida=await new M6Controller().obtenerHistorialRemuneracional(7,{tipoEvento:'TODOS'});
    assert.deepEqual(salida.periodos.map(item=>item.mes),[10,9,8]);
    assert.deepEqual(salida.periodos.find(item=>item.mes===9).remuneraciones.map(item=>[item.version,item.vigente]),[[1,false],[2,true]]);
    const pago=salida.periodos.find(item=>item.mes===10).pagos.find(item=>item.id===1);
    assert.equal(pago.montoOriginal,1200000); assert.equal(pago.montoRevertido,150000); assert.equal(pago.montoEfectivo,1050000); assert.equal(pago.eventos.filter(item=>item.tipo==='REVERSION').length,2);
    assert.equal(salida.periodos.find(item=>item.mes===9).pagos.find(item=>item.id===2).estado,'ANULADO');
    assert.equal(salida.periodos.find(item=>item.mes===9).ajustes[0].regularizacion.estado,'CERRADA');
    assert.equal(salida.periodos.find(item=>item.mes===9).remuneraciones[0].snapshotPrevisional.afp,'AFP Habitat');
    assert.equal(salida.periodos.find(item=>item.mes===9).remuneraciones[1].snapshotPrevisional.afp,'AFP Modelo');
    assert.equal(salida.periodos.find(item=>item.mes===10).documentos.length,1);
  } finally {
    prisma.empleado.findUnique=originales.empleado; prisma.remuneracion.findMany=originales.remuneracion; prisma.anticipo_remuneracion.findMany=originales.anticipo; prisma.pago_remuneracion.findMany=originales.pago; prisma.usuario.findMany=originales.usuario; prisma.evento_auditoria.findMany=originales.evento;
  }
});

test('edición de pago PREPARADO entrega a M9 el valor anterior y nuevo', async () => {
  const repo=new RepositorioAuditoriaM9Memoria(), m9=new M9Controller({repositorio:repo}), productor=new ProductorAuditoriaM9(m9,50);
  const actor={id:1n,sesion:'s',permisos:['CU187'],configuracion:'finanzas',administrador:false,cambiarClave:false,nombre:'Operador',acceso:'activo'};
  const salida={id:77}; Object.defineProperty(salida,'__auditoriaM9',{value:{anterior:{monto:100000,referencia:'ANTES'},nuevo:{monto:125000,referencia:'DESPUES'}},enumerable:false});
  await productor.ejecutar('actualizarPagoFinal',actor,{parametros:{id:'77'},idSolicitud:'historial-pago-77'},async()=>salida);
  const evento=(await repo.listar({tamano:10})).eventos[0];
  assert.equal(evento.operacion,'PAGO_PREPARADO_MODIFICADO'); assert.equal(evento.entidadReferencia,'77');
  assert.deepEqual(evento.anterior,{monto:100000,referencia:'ANTES'}); assert.deepEqual(evento.nuevo,{monto:125000,referencia:'DESPUES'});
});

test('historial respeta el permiso M9 al adjuntar evidencia técnica', async t => {
  const base=()=>({empleado:{id:7},periodos:[{pagos:[{id:77,auditoria:{entidadTipo:'PAGO_REMUNERACION',entidadReferencia:'77'}}]}]});
  const m6={obtenerHistorialRemuneracional:async()=>base()};
  const productor={ejecutar:async(_operacion,_actor,_solicitud,ejecutar)=>ejecutar()};
  await t.test('sin CU355 no consulta ni expone eventos M9',async()=>{
    let consultas=0; const m9={consultar:async()=>{consultas++;return {eventos:[]}}};
    const actor={id:1n,sesion:'s',permisos:['CU191'],configuracion:'rrhh',administrador:false,cambiarClave:false,nombre:'RRHH',acceso:'activo'};
    const fachada=new C_Finanzas({autorizar:async()=>actor},{},{},{},{},{},m6,{},{},m9,productor);
    const salida=await fachada.ejecutar('obtenerHistorialRemuneracionalEmpleado',{parametros:{id:'7'},contexto:{}});
    assert.equal(consultas,0); assert.equal(salida.periodos[0].pagos[0].auditoria.puedeVer,undefined);
  });
  await t.test('con CU355 referencia los eventos M9 del pago',async()=>{
    const actor={id:2n,sesion:'s',permisos:['CU191','CU355'],configuracion:'auditoria',administrador:false,cambiarClave:false,nombre:'Auditor',acceso:'activo'};
    const evento={id:900,referencia:{tipo:'PAGO_REMUNERACION',id:'77'},operacion:'PAGO_PREPARADO_MODIFICADO'};
    const m9={consultar:async()=>({eventos:[evento]})};
    const fachada=new C_Finanzas({autorizar:async()=>actor},{},{},{},{},{},m6,{},{},m9,productor);
    const salida=await fachada.ejecutar('obtenerHistorialRemuneracionalEmpleado',{parametros:{id:'7'},contexto:{}});
    assert.equal(salida.periodos[0].pagos[0].auditoria.puedeVer,true); assert.equal(salida.periodos[0].pagos[0].auditoria.eventos[0].id,900);
  });
});
