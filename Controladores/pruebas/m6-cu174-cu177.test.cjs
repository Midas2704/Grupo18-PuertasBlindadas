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

test('M6 T5 CU174-CU177 gestiona componentes individuales sin implementar CU178/CU179',async t=>{
 const modulo=new M6Controller();const sufijo=randomUUID().slice(0,8);const ids={empleados:[],usuarios:[],remuneraciones:[],periodos:[],parametros:[],relaciones:[]};
 const empleado=await modulo.crearEmpleado({rut:rutValido(),nombres:'Elena',apellidoPaterno:'Componentes'});ids.empleados.push(empleado.id);
 const usuario=await prisma.usuario.create({data:{usuario_username:`m6c_${sufijo}`,usuario_nombre_completo_primer_nombre_usuario:'Elena'}});ids.usuarios.push(usuario.usuario_id_usuario);
 const contexto=await modulo.obtenerOCrearContextoRemuneracion({idEmpleado:empleado.id,anio:2006,mes:9},usuario.usuario_id_usuario);ids.remuneraciones.push(contexto.id);ids.periodos.push(contexto.periodo.id);
 try{
  await t.test('scaffolding crea un único contexto abierto sin calcular ni cerrar',async()=>{
   const mismo=await modulo.obtenerOCrearContextoRemuneracion({idEmpleado:empleado.id,anio:2006,mes:9},usuario.usuario_id_usuario);
   assert.equal(mismo.id,contexto.id);assert.equal(mismo.estado,'abierta');assert.equal(mismo.componentes.length,0);
   assert.equal(await prisma.periodo_remuneracion.count({where:{anio:2006,mes:9}}),1);assert.equal(await prisma.remuneracion.count({where:{id_periodo_remuneracion:contexto.periodo.id,id_empleado:empleado.id}}),1);
  });

  await t.test('CU174 valida monto positivo y no crea catálogos reutilizables',async()=>{
   const antes={conceptos:await prisma.concepto_remuneracion.count(),esquemas:await prisma.esquema_remuneracional.count(),tarifas:await prisma.tarifa_esquema_remuneracional.count()};
   await assert.rejects(modulo.proponerComponenteExcepcional(contexto.id,{modalidad:'MONTO',descripcion:'Bono único',monto:0},usuario.usuario_id_usuario),e=>e.estado===400);
   await assert.rejects(modulo.proponerComponenteExcepcional(contexto.id,{modalidad:'MONTO',descripcion:'Bono único',monto:-10},usuario.usuario_id_usuario),e=>e.estado===400);
   await assert.rejects(modulo.proponerComponenteExcepcional(999999999,{modalidad:'MONTO',descripcion:'Bono único',monto:10},usuario.usuario_id_usuario),e=>e.estado===404);
   let resultado=await modulo.proponerComponenteExcepcional(contexto.id,{modalidad:'MONTO',descripcion:'Reconocimiento extraordinario',monto:'125.5000',motivo:'Resultado excepcional'},usuario.usuario_id_usuario);
   const componente=resultado.componentes.find(item=>item.tipo==='EXCEPCIONAL_POSITIVO');assert.equal(componente.estadoRevision,'propuesto');assert.equal(componente.monto,125.5);assert.equal(componente.concepto,null);
   resultado=await modulo.resolverComponenteExcepcional(componente.id,{decision:'aprobar'},usuario.usuario_id_usuario);assert.equal(resultado.componentes.find(item=>item.id===componente.id).estadoRevision,'aprobado');
   assert.deepEqual({conceptos:await prisma.concepto_remuneracion.count(),esquemas:await prisma.esquema_remuneracional.count(),tarifas:await prisma.tarifa_esquema_remuneracional.count()},antes);
  });

  await t.test('CU174 conserva rechazo, trazabilidad, regla pendiente y bloquea remuneración cerrada',async()=>{
   let resultado=await modulo.proponerComponenteExcepcional(contexto.id,{modalidad:'MONTO',descripcion:'Propuesta descartable',monto:50},usuario.usuario_id_usuario);const rechazado=resultado.componentes.at(-1);
   await assert.rejects(modulo.resolverComponenteExcepcional(rechazado.id,{decision:'rechazar'},usuario.usuario_id_usuario),e=>e.estado===400);
   resultado=await modulo.resolverComponenteExcepcional(rechazado.id,{decision:'rechazar',motivo:'No corresponde al período'},usuario.usuario_id_usuario);const decision=resultado.componentes.find(item=>item.id===rechazado.id);assert.equal(decision.estadoRevision,'rechazado');assert.equal(decision.revisadoPor,usuario.usuario_id_usuario.toString());assert.ok(decision.fechaRevision);assert.equal(decision.motivo,'No corresponde al período');
   resultado=await modulo.proponerComponenteExcepcional(contexto.id,{modalidad:'REGLA_TEMPORAL',descripcion:'Regla excepcional sin fórmula',referenciaOrigen:'REFERENCIA_CONTROLADA'},usuario.usuario_id_usuario);const regla=resultado.componentes.at(-1);assert.equal(regla.estadoRevision,'pendiente_valorizacion');assert.equal(regla.monto,null);await assert.rejects(modulo.resolverComponenteExcepcional(regla.id,{decision:'aprobar'},usuario.usuario_id_usuario),e=>e.estado===409);
   await prisma.remuneracion.update({where:{id_remuneracion:contexto.id},data:{estado:'cerrada',cerrado_en:new Date(),cerrado_por:usuario.usuario_id_usuario}});await assert.rejects(modulo.proponerComponenteExcepcional(contexto.id,{modalidad:'MONTO',descripcion:'Fuera de estado',monto:10},usuario.usuario_id_usuario),e=>e.estado===409);await prisma.remuneracion.update({where:{id_remuneracion:contexto.id},data:{estado:'abierta',cerrado_en:null,cerrado_por:null}});
  });

  await t.test('CU174 serializa dos decisiones simultáneas',async()=>{
   const creado=await modulo.proponerComponenteExcepcional(contexto.id,{modalidad:'MONTO',descripcion:'Decisión concurrente',monto:80},usuario.usuario_id_usuario);const componente=creado.componentes.at(-1);
   const carrera=await Promise.allSettled([modulo.resolverComponenteExcepcional(componente.id,{decision:'aprobar'},usuario.usuario_id_usuario),modulo.resolverComponenteExcepcional(componente.id,{decision:'rechazar',motivo:'Alternativa'},usuario.usuario_id_usuario)]);
   assert.equal(carrera.filter(item=>item.status==='fulfilled').length,1);assert.equal(carrera.filter(item=>item.status==='rejected').length,1);
  });

  await t.test('CU175 registra variable manual con fuente, período y aprobación',async()=>{
   const conceptosAntes=await prisma.concepto_remuneracion.count();let resultado=await modulo.proponerVariableRemuneracion(contexto.id,{clase:'ADMINISTRATIVA',fuenteTipo:'MANUAL',claveNegocio:'META_ADMIN',descripcion:'Asignación administrativa septiembre',monto:'40.2500',fechaOrigen:'2026-09-15',referenciaOrigen:'CARGA-USUARIO'},usuario.usuario_id_usuario);
   const variable=resultado.componentes.at(-1);assert.equal(variable.tipo,'VARIABLE_ADMINISTRATIVA');assert.equal(variable.fuenteTipo,'MANUAL');assert.equal(variable.estadoRevision,'propuesto');assert.equal(resultado.periodo.mes,9);
   resultado=await modulo.resolverVariableRemuneracion(variable.id,{decision:'aprobar'},usuario.usuario_id_usuario);assert.equal(resultado.componentes.find(item=>item.id===variable.id).estadoRevision,'aprobado');assert.equal(await prisma.concepto_remuneracion.count(),conceptosAntes);
   resultado=await modulo.proponerVariableRemuneracion(contexto.id,{clase:'COMERCIAL',fuenteTipo:'MANUAL',claveNegocio:'META_COMERCIAL',descripcion:'Variable comercial manual',monto:25,fechaOrigen:'2026-09-20'},usuario.usuario_id_usuario);const rechazada=resultado.componentes.at(-1);resultado=await modulo.resolverVariableRemuneracion(rechazada.id,{decision:'rechazar',motivo:'Fuente insuficiente'},usuario.usuario_id_usuario);assert.equal(resultado.componentes.find(item=>item.id===rechazada.id).estadoRevision,'rechazado');
  });

  await t.test('CU175 automático versus manual genera conflicto y resolución sin overwrite',async()=>{
   let resultado=await modulo.proponerVariableRemuneracion(contexto.id,{clase:'COMERCIAL',fuenteTipo:'AUTOMATICA',claveNegocio:'VENTAS_PERIODO',descripcion:'Valor informado por módulo propietario',monto:100,fechaOrigen:'2026-09-25',referenciaOrigen:'VENTAS:2026-09',versionOrigen:'1'},usuario.usuario_id_usuario);const automatico=resultado.componentes.at(-1);
   resultado=await modulo.proponerVariableRemuneracion(contexto.id,{clase:'COMERCIAL',fuenteTipo:'MANUAL',claveNegocio:'VENTAS_PERIODO',descripcion:'Corrección propuesta por usuario',monto:120,fechaOrigen:'2026-09-25',referenciaOrigen:'REVISION-MANUAL'},usuario.usuario_id_usuario);const manual=resultado.componentes.at(-1);
   assert.equal(resultado.componentes.find(item=>item.id===automatico.id).estadoRevision,'conflicto');assert.equal(manual.estadoRevision,'conflicto');assert.equal(resultado.componentes.find(item=>item.id===automatico.id).monto,100);assert.equal(manual.monto,120);
   await assert.rejects(modulo.resolverVariableRemuneracion(manual.id,{decision:'aprobar'},usuario.usuario_id_usuario),e=>e.estado===400);
   resultado=await modulo.resolverVariableRemuneracion(manual.id,{decision:'aprobar',motivo:'Se valida antecedente comercial corregido'},usuario.usuario_id_usuario);
   assert.equal(resultado.componentes.find(item=>item.id===manual.id).estadoRevision,'aprobado');assert.equal(resultado.componentes.find(item=>item.id===automatico.id).estadoRevision,'rechazado');
   assert.equal(await prisma.tratamiento_remuneracional_ejecucion.count({where:{id_empleado:empleado.id}}),0);
  });

  await t.test('CU175 serializa la resolución simultánea de un conflicto',async()=>{
   let resultado=await modulo.proponerVariableRemuneracion(contexto.id,{clase:'ADMINISTRATIVA',fuenteTipo:'AUTOMATICA',claveNegocio:'CONFLICTO_CONCURRENTE',descripcion:'Candidato automático',monto:10},usuario.usuario_id_usuario);const automatico=resultado.componentes.at(-1);resultado=await modulo.proponerVariableRemuneracion(contexto.id,{clase:'ADMINISTRATIVA',fuenteTipo:'MANUAL',claveNegocio:'CONFLICTO_CONCURRENTE',descripcion:'Candidato manual',monto:11},usuario.usuario_id_usuario);const manual=resultado.componentes.at(-1);
   const carrera=await Promise.allSettled([modulo.resolverVariableRemuneracion(automatico.id,{decision:'aprobar',motivo:'Se elige fuente automática'},usuario.usuario_id_usuario),modulo.resolverVariableRemuneracion(manual.id,{decision:'aprobar',motivo:'Se elige revisión manual'},usuario.usuario_id_usuario)]);assert.equal(carrera.filter(item=>item.status==='fulfilled').length,1);assert.equal(carrera.filter(item=>item.status==='rejected').length,1);assert.equal(await prisma.componente_remuneracion.count({where:{id_componente_remuneracion:{in:[automatico.id,manual.id]},estado_revision:'aprobado'}}),1);
  });

  await t.test('CU176 conserva versiones externas e impide duplicar la misma versión',async()=>{
   let resultado=await modulo.registrarValorExterno(contexto.id,{fuenteTipo:'CRM',claveNegocio:'COMISION_EXTERNA',referenciaOrigen:'CRM:SEP-2026',versionOrigen:'1',fechaOrigen:'2026-09-26',descripcion:'Comisión informada por CRM',monto:'200.1250'},usuario.usuario_id_usuario);const version1=resultado.componentes.at(-1);
   assert.equal(version1.tipo,'VALOR_EXTERNO');assert.equal(version1.estadoRevision,'propuesto');assert.equal(version1.versionOrigen,'1');assert.equal(version1.fechaOrigen.toISOString().slice(0,10),'2026-09-26');
   resultado=await modulo.resolverValorOAjuste(version1.id,{decision:'aprobar'},usuario.usuario_id_usuario);const aprobacionOriginal=await prisma.componente_remuneracion.findUniqueOrThrow({where:{id_componente_remuneracion:version1.id}});assert.equal(aprobacionOriginal.estado_revision,'aprobado');
   await assert.rejects(modulo.registrarValorExterno(contexto.id,{fuenteTipo:'CRM',claveNegocio:'COMISION_EXTERNA',referenciaOrigen:'CRM:SEP-2026',versionOrigen:'1',fechaOrigen:'2026-09-26',descripcion:'Duplicado',monto:200.125},usuario.usuario_id_usuario),e=>e.estado===409);
   assert.equal(await prisma.componente_remuneracion.count({where:{id_remuneracion:contexto.id,tipo:'VALOR_EXTERNO',referencia_origen:'CRM:SEP-2026',version_origen:'1'}}),1);
   resultado=await modulo.registrarValorExterno(contexto.id,{fuenteTipo:'CRM',claveNegocio:'COMISION_EXTERNA',referenciaOrigen:'CRM:SEP-2026',versionOrigen:'2',fechaOrigen:'2026-09-27',descripcion:'Comisión corregida por CRM',monto:220},usuario.usuario_id_usuario);const version2=resultado.componentes.at(-1);
   assert.equal(resultado.componentes.find(item=>item.id===version1.id).estadoRevision,'aprobado');assert.equal(version2.estadoRevision,'conflicto');assert.equal(version2.idComponenteOrigen,version1.id);assert.equal(resultado.componentes.find(item=>item.id===version1.id).monto,200.125);
   resultado=await modulo.resolverValorOAjuste(version2.id,{decision:'aprobar',motivo:'Versión vigente confirmada por la fuente'},usuario.usuario_id_usuario);assert.equal(resultado.componentes.find(item=>item.id===version2.id).estadoRevision,'aprobado');assert.equal(resultado.componentes.find(item=>item.id===version1.id).estadoRevision,'reemplazado');const originalDespues=await prisma.componente_remuneracion.findUniqueOrThrow({where:{id_componente_remuneracion:version1.id}});assert.equal(originalDespues.revisado_por,aprobacionOriginal.revisado_por);assert.equal(originalDespues.fecha_revision.getTime(),aprobacionOriginal.fecha_revision.getTime());
   const entrada={fuenteTipo:'ERP',claveNegocio:'EXTERNO_CONCURRENTE',referenciaOrigen:'ERP:SEP-2026',versionOrigen:'1',fechaOrigen:'2026-09-28',descripcion:'Valor externo concurrente',monto:30};const carrera=await Promise.allSettled([modulo.registrarValorExterno(contexto.id,entrada,usuario.usuario_id_usuario),modulo.registrarValorExterno(contexto.id,entrada,usuario.usuario_id_usuario)]);assert.equal(carrera.filter(item=>item.status==='fulfilled').length,1);assert.equal(carrera.filter(item=>item.status==='rejected').length,1);assert.equal(await prisma.componente_remuneracion.count({where:{id_remuneracion:contexto.id,tipo:'VALOR_EXTERNO',referencia_origen:'ERP:SEP-2026',version_origen:'1'}}),1);
  });

  await t.test('CU176 ajustes positivos y negativos no modifican el valor externo',async()=>{
   const original=await prisma.componente_remuneracion.findFirstOrThrow({where:{id_remuneracion:contexto.id,tipo:'VALOR_EXTERNO',estado_revision:'aprobado'}});const montoOriginal=original.monto.toString();
   await assert.rejects(modulo.proponerAjusteManual(contexto.id,{idComponenteOrigen:original.id_componente_remuneracion,direccion:'NEGATIVO',descripcion:'Doble signo',motivo:'Inválido',monto:-10},usuario.usuario_id_usuario),e=>e.estado===400);
   let resultado=await modulo.proponerAjusteManual(contexto.id,{idComponenteOrigen:original.id_componente_remuneracion,direccion:'POSITIVO',descripcion:'Complemento externo',motivo:'Diferencia documentada',monto:15},usuario.usuario_id_usuario);const positivo=resultado.componentes.at(-1);assert.equal(positivo.direccion,'POSITIVO');assert.equal(positivo.idComponenteOrigen,original.id_componente_remuneracion);
   resultado=await modulo.proponerAjusteManual(contexto.id,{idComponenteOrigen:original.id_componente_remuneracion,direccion:'NEGATIVO',descripcion:'Descuento correctivo',motivo:'Corrección documentada',monto:5},usuario.usuario_id_usuario);const negativo=resultado.componentes.at(-1);assert.equal(negativo.direccion,'NEGATIVO');assert.equal(negativo.monto,5);
   resultado=await modulo.resolverValorOAjuste(positivo.id,{decision:'aprobar'},usuario.usuario_id_usuario);assert.equal(resultado.componentes.find(item=>item.id===positivo.id).estadoRevision,'aprobado');
   assert.equal((await prisma.componente_remuneracion.findUniqueOrThrow({where:{id_componente_remuneracion:original.id_componente_remuneracion}})).monto.toString(),montoOriginal);
  });

  await t.test('CU177 consulta CU169 y no inventa fórmula ni interpreta NULL como cero',async()=>{
   let prorrateo=await modulo.obtenerContextoProrrateo(contexto.id);assert.equal(prorrateo.estadoPropuesta,'sin_configuracion');assert.equal(prorrateo.montoCalculado,null);assert.equal(prorrateo.configuracion,null);
   const relacion=await prisma.relacion_laboral_empleado.create({data:{id_empleado:empleado.id,fecha_inicio:new Date('2006-09-10'),estado:'vigente'}});ids.relaciones.push(relacion.id_relacion_laboral_empleado);
   const codigoProrrateo=`PR${sufijo}`.toUpperCase();await modulo.crearConfiguracionProrrateo({codigo:codigoProrrateo,nombre:'Prorrateo provisional',descripcion:'Fórmula pendiente',estado:'activo',vigenciaDesde:'2006-09-01',referencia:'GUIA-M6'});const parametro=await prisma.parametro_remuneracional.findFirstOrThrow({where:{codigo:codigoProrrateo}});ids.parametros.push(parametro.id_parametro_remuneracional);
   prorrateo=await modulo.obtenerContextoProrrateo(contexto.id);assert.equal(prorrateo.estadoPropuesta,'pendiente_formula');assert.equal(prorrateo.montoCalculado,null);assert.equal(prorrateo.configuracion.valor,null);assert.equal(prorrateo.relacionesLaborales.length,1);
  });

  await t.test('CU177 excepción individual exige fundamento, se aprueba y no altera CU169 ni relación laboral',async()=>{
   const parametroAntes=await prisma.parametro_remuneracional.findUniqueOrThrow({where:{id_parametro_remuneracional:ids.parametros[0]}});const relacionAntes=await prisma.relacion_laboral_empleado.findUniqueOrThrow({where:{id_relacion_laboral_empleado:ids.relaciones[0]}});
   await assert.rejects(modulo.proponerProrrateoIndividual(contexto.id,{monto:75},usuario.usuario_id_usuario),e=>e.estado===400);
   let resultado=await modulo.proponerProrrateoIndividual(contexto.id,{monto:'75.2500',fundamento:'Excepción individual revisada para el período'},usuario.usuario_id_usuario);let propuesta=resultado.remuneracion.componentes.find(item=>item.tipo==='PRORRATEO');assert.equal(propuesta.estadoRevision,'propuesto');assert.equal(propuesta.monto,75.25);assert.match(propuesta.referenciaOrigen,/PARAMETRO:/);
   resultado={remuneracion:await modulo.resolverProrrateoIndividual(propuesta.id,{decision:'aprobar'},usuario.usuario_id_usuario)};propuesta=resultado.remuneracion.componentes.find(item=>item.id===propuesta.id);assert.equal(propuesta.estadoRevision,'aprobado');
   await assert.rejects(modulo.proponerProrrateoIndividual(contexto.id,{monto:80,fundamento:'Segunda propuesta incompatible'},usuario.usuario_id_usuario),e=>e.estado===409);
   assert.deepEqual(await prisma.parametro_remuneracional.findUniqueOrThrow({where:{id_parametro_remuneracional:ids.parametros[0]}}),parametroAntes);assert.deepEqual(await prisma.relacion_laboral_empleado.findUniqueOrThrow({where:{id_relacion_laboral_empleado:ids.relaciones[0]}}),relacionAntes);
   const contexto2=await modulo.obtenerOCrearContextoRemuneracion({idEmpleado:empleado.id,anio:2006,mes:10},usuario.usuario_id_usuario);ids.remuneraciones.push(contexto2.id);ids.periodos.push(contexto2.periodo.id);
   resultado=await modulo.proponerProrrateoIndividual(contexto2.id,{monto:60,fundamento:'Propuesta individual octubre'},usuario.usuario_id_usuario);const rechazada=resultado.remuneracion.componentes.find(item=>item.tipo==='PRORRATEO');const resuelta=await modulo.resolverProrrateoIndividual(rechazada.id,{decision:'rechazar',motivo:'No corresponde excepción'},usuario.usuario_id_usuario);assert.equal(resuelta.componentes.find(item=>item.id===rechazada.id).estadoRevision,'rechazado');
   const contexto3=await modulo.obtenerOCrearContextoRemuneracion({idEmpleado:empleado.id,anio:2006,mes:11},usuario.usuario_id_usuario);ids.remuneraciones.push(contexto3.id);ids.periodos.push(contexto3.periodo.id);const carrera=await Promise.allSettled([modulo.proponerProrrateoIndividual(contexto3.id,{monto:40,fundamento:'Primera propuesta noviembre'},usuario.usuario_id_usuario),modulo.proponerProrrateoIndividual(contexto3.id,{monto:45,fundamento:'Segunda propuesta noviembre'},usuario.usuario_id_usuario)]);assert.equal(carrera.filter(item=>item.status==='fulfilled').length,1);assert.equal(carrera.filter(item=>item.status==='rejected').length,1);assert.equal(await prisma.componente_remuneracion.count({where:{id_remuneracion:contexto3.id,tipo:'PRORRATEO',estado_revision:'propuesto'}}),1);
  });

  await t.test('scaffolding conserva reemplazos históricos y protege una sola remuneración actual',async()=>{
   const otro=await modulo.crearEmpleado({rut:rutValido(),nombres:'Rosa',apellidoPaterno:'Reemplazo'});ids.empleados.push(otro.id);
   const inicial=await modulo.obtenerOCrearContextoRemuneracion({idEmpleado:otro.id,anio:2007,mes:1},usuario.usuario_id_usuario);ids.remuneraciones.push(inicial.id);ids.periodos.push(inicial.periodo.id);
   await prisma.componente_remuneracion.create({data:{id_remuneracion:inicial.id,tipo:'PRORRATEO',descripcion:'Prorrateo histórico R1',monto:'10.0000',fuente_tipo:'MANUAL',estado_revision:'aprobado',motivo:'Fixture de persistencia',creado_por:usuario.usuario_id_usuario,revisado_por:usuario.usuario_id_usuario,fecha_revision:new Date()}});
   await prisma.remuneracion.update({where:{id_remuneracion:inicial.id},data:{estado:'reemplazada'}});
   const segunda=await prisma.remuneracion.create({data:{id_periodo_remuneracion:inicial.periodo.id,id_empleado:otro.id,reemplaza_a_id:inicial.id,estado:'cerrada',creado_por:usuario.usuario_id_usuario,cerrado_en:new Date(),cerrado_por:usuario.usuario_id_usuario}});ids.remuneraciones.push(segunda.id_remuneracion);
   await prisma.componente_remuneracion.create({data:{id_remuneracion:segunda.id_remuneracion,tipo:'PRORRATEO',descripcion:'Prorrateo propio R2',monto:'12.0000',fuente_tipo:'MANUAL',estado_revision:'aprobado',motivo:'Fixture de persistencia',creado_por:usuario.usuario_id_usuario,revisado_por:usuario.usuario_id_usuario,fecha_revision:new Date()}});
   assert.equal(await prisma.remuneracion.count({where:{id_periodo_remuneracion:inicial.periodo.id,id_empleado:otro.id}}),2);assert.equal(await prisma.componente_remuneracion.count({where:{id_remuneracion:{in:[inicial.id,segunda.id_remuneracion]},tipo:'PRORRATEO'}}),2);
   await assert.rejects(prisma.remuneracion.create({data:{id_periodo_remuneracion:inicial.periodo.id,id_empleado:otro.id,estado:'abierta',creado_por:usuario.usuario_id_usuario}}),e=>e.code==='P2002');
   await prisma.remuneracion.update({where:{id_remuneracion:segunda.id_remuneracion},data:{estado:'reemplazada'}});
   const tercera=await prisma.remuneracion.create({data:{id_periodo_remuneracion:inicial.periodo.id,id_empleado:otro.id,reemplaza_a_id:segunda.id_remuneracion,estado:'abierta',creado_por:usuario.usuario_id_usuario}});ids.remuneraciones.push(tercera.id_remuneracion);
   assert.equal(await prisma.remuneracion.count({where:{id_periodo_remuneracion:inicial.periodo.id,id_empleado:otro.id,estado:'reemplazada'}}),2);assert.equal(await prisma.remuneracion.count({where:{id_periodo_remuneracion:inicial.periodo.id,id_empleado:otro.id,estado:{not:'reemplazada'}}}),1);
   await assert.rejects(prisma.remuneracion.update({where:{id_remuneracion:inicial.id},data:{reemplaza_a_id:tercera.id_remuneracion}}),e=>/ck_remuneracion_reemplazo_orden/.test(String(e.message)));
  });

  await t.test('dos creaciones concurrentes dejan una sola remuneración actual',async()=>{
   const otro=await modulo.crearEmpleado({rut:rutValido(),nombres:'Carla',apellidoPaterno:'Concurrencia'});ids.empleados.push(otro.id);
   const periodo=await prisma.periodo_remuneracion.create({data:{anio:2007,mes:2,fecha_inicio:new Date('2007-02-01'),fecha_fin:new Date('2007-02-28')}});ids.periodos.push(periodo.id_periodo_remuneracion);
   const entrada={id_periodo_remuneracion:periodo.id_periodo_remuneracion,id_empleado:otro.id,creado_por:usuario.usuario_id_usuario};const carrera=await Promise.allSettled([prisma.remuneracion.create({data:entrada}),prisma.remuneracion.create({data:entrada})]);
   const exitosas=carrera.filter(item=>item.status==='fulfilled');assert.equal(exitosas.length,1);assert.equal(carrera.filter(item=>item.status==='rejected').length,1);ids.remuneraciones.push(exitosas[0].value.id_remuneracion);assert.equal(await prisma.remuneracion.count({where:{id_periodo_remuneracion:periodo.id_periodo_remuneracion,id_empleado:otro.id,estado:{not:'reemplazada'}}}),1);
  });

  await t.test('permisos CU174-CU177 siguen independientes tras incorporar CU178-CU182',async()=>{
   assert.equal(codigosTodosLosCU.length,274);for(let numero=174;numero<=205;numero++)assert.deepEqual(matrizPermisosPorCU[`CU${numero}`],[]);assert.equal(codigosTodosLosCU.includes('CU198'),true);
   assert.equal(operacionesPermiso.proponerComponenteExcepcional,'CU174');assert.equal(operacionesPermiso.proponerVariableRemuneracion,'CU175');assert.equal(operacionesPermiso.registrarValorExterno,'CU176');assert.equal(operacionesPermiso.proponerProrrateoIndividual,'CU177');
   assert.equal(permiteOperacion('proponerComponenteExcepcional',['CU175']),false);assert.equal(permiteOperacion('proponerVariableRemuneracion',['CU174']),false);assert.equal(permiteOperacion('proponerAjusteManual',['CU177']),false);assert.equal(permiteOperacion('resolverProrrateoIndividual',['CU176']),false);assert.equal(permiteOperacion('obtenerRemuneracion',['CU177']),true);
   const autorizacion=(permisos)=>({autorizar:async operacion=>{if(!permiteOperacion(operacion,permisos)){const error=new Error('No autorizado');error.estado=403;throw error}return{id:usuario.usuario_id_usuario,permisos,configuracion:'particular',administrador:false}}});const m6={obtenerOCrearContextoRemuneracion:async()=>({}),proponerComponenteExcepcional:async()=>({}),proponerVariableRemuneracion:async()=>({}),registrarValorExterno:async()=>({}),proponerProrrateoIndividual:async()=>({})};const fachada=new C_Finanzas(autorizacion(['CU175']),{},{},{},{},{},m6);await fachada.ejecutar('proponerVariableRemuneracion',{parametros:{id:String(contexto.id)},cuerpo:{},contexto:{}});await assert.rejects(fachada.ejecutar('proponerComponenteExcepcional',{parametros:{id:String(contexto.id)},cuerpo:{},contexto:{}}),e=>e.estado===403);
  });

  await t.test('modelo común no adelanta familias ni motores prohibidos',()=>{
   const schema=readFileSync(resolve('prisma/schema.prisma'),'utf8');const migracion=readFileSync(resolve('prisma/migrations/030_m6_componentes_individuales/migration.sql'),'utf8');const correccion=readFileSync(resolve('prisma/migrations/031_m6_reemplazo_remuneraciones/migration.sql'),'utf8');const controlador=readFileSync(resolve('src/controladores/M6Controller.ts'),'utf8');const conjunto=`${schema}\n${migracion}\n${correccion}\n${controlador}`;
   assert.match(schema,/model\s+periodo_remuneracion\s*\{/);assert.match(schema,/model\s+remuneracion\s*\{/);assert.match(schema,/model\s+componente_remuneracion\s*\{/);
   assert.match(schema,/reemplaza_a_id\s+Int\?/);assert.doesNotMatch(schema,/@@unique\(\[id_periodo_remuneracion, id_empleado\], map: "uq_remuneracion_periodo_empleado"\)/);assert.match(correccion,/CREATE UNIQUE INDEX uq_remuneracion_actual_periodo_empleado[\s\S]*WHERE estado <> 'reemplazada'/);assert.match(correccion,/CHECK \(reemplaza_a_id IS NULL OR reemplaza_a_id < id_remuneracion\)/);
   assert.doesNotMatch(conjunto,/model\s+(componente_excepcional|variable_administrativa_remuneracion|valor_externo_remuneracion|ajuste_manual_remuneracion|prorrateo_empleado|regla_prorrateo|version_regla_prorrateo|aplicacion_prorrateo|historial_prorrateo|version_componente|historial_componente|remuneracion_version|documento_remuneracional)\s*\{/i);assert.doesNotMatch(controlador,/eval\s*\(|new\s+Function\s*\(/);assert.doesNotMatch(`${migracion}\n${correccion}`,/ON DELETE CASCADE/i);
  });
 }finally{
  await prisma.componente_remuneracion.deleteMany({where:{id_remuneracion:{in:ids.remuneraciones}}});await prisma.remuneracion.updateMany({where:{id_remuneracion:{in:ids.remuneraciones}},data:{reemplaza_a_id:null}});await prisma.remuneracion.deleteMany({where:{id_remuneracion:{in:ids.remuneraciones}}});for(const idPeriodo of new Set(ids.periodos)){if(await prisma.remuneracion.count({where:{id_periodo_remuneracion:idPeriodo}})===0)await prisma.periodo_remuneracion.deleteMany({where:{id_periodo_remuneracion:idPeriodo}})}await prisma.parametro_remuneracional.deleteMany({where:{id_parametro_remuneracional:{in:ids.parametros}}});await prisma.relacion_laboral_empleado.deleteMany({where:{id_relacion_laboral_empleado:{in:ids.relaciones}}});await prisma.usuario.deleteMany({where:{usuario_id_usuario:{in:ids.usuarios}}});await prisma.empleado.deleteMany({where:{id_empleado:{in:ids.empleados}}});
 }
});
