const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {prisma}=require('../dist/db');
const {M4Controller}=require('../dist/controladores/M4Controller');
const {hashClave,futuro}=require('../dist/utilidades/seguridad');

test('M4: separación de Gerencia y Administrador',async t=>{
 const ids=[];const empleados=[];const correos=[];
 const modulo=new M4Controller({enviar:async(correo,enlace)=>correos.push({correo,enlace})});
 const clave='Seguridad-fina-M4!2026';const hash=await hashClave(clave);
 const cargo=await prisma.cargo.findUniqueOrThrow({where:{nombre_cargo:'Demostración M4'}});
 const vinculo=await prisma.tipo_vinculo_laboral.findUniqueOrThrow({where:{nombre_tipo_vinculo_laboral:'Demostración M4'}});

 async function crear({perfil='gerencia',administrador=false,original=false}={}){
  const marca=randomUUID().slice(0,8);const acceso=`seg-fina-${marca}`;const rut=`8${String(Date.now()).slice(-6)}-${ids.length}${marca[0]}`;
  await prisma.empleado.create({data:{rut_empleado:rut,nombres:'Seguridad',apellido_paterno:'Fina',id_cargo:cargo.id_cargo,id_tipo_vinculo_laboral:vinculo.id_tipo_vinculo_laboral,fecha_ingreso:new Date(),sueldo_base:0}});empleados.push(rut);
  const base=await prisma.perfil.findUniqueOrThrow({where:{codigo_m4:perfil}});
  const usuario=await prisma.usuario.create({data:{acceso_m4:acceso,empleado_m4:rut,empleado_rut_empleado:rut,usuario_estado_cuenta:'activo',usuario_correo:`${acceso}@example.invalid`,perfil_id_perfil:base.perfil_id_perfil,usuario_es_administrador:administrador,administrador_original:original,seguridad:{create:{intentos:0,bloqueos:0}},usuario_contrasena:{create:{usuario_contrasena:hash,activa:true,vence:futuro(60)}}}});
  ids.push(usuario.usuario_id_usuario);return usuario;
 }
 const ingresar=(cuenta,contexto={})=>modulo.iniciarSesion({acceso:cuenta.acceso_m4,clave},contexto);

 try{
  const gerencia=await crear();const admin=await crear({administrador:true});const ordinaria=await crear({perfil:'secretaria'});const original=await crear({administrador:true,original:true});
  const loginGerencia=await ingresar(gerencia);const loginAdmin=await ingresar(admin);
  const actorGerencia=await modulo.autorizar('consultarSesiones',{secretoSesion:loginGerencia.token});
  const actorAdmin=await modulo.autorizar('usuarios',{secretoSesion:loginAdmin.token});

  await t.test('Gerencia sin Admin rechaza operación administrativa y Admin la autoriza',async()=>{
   assert.equal((await modulo.autorizar('usuarios',{secretoSesion:loginGerencia.token})).administrador,false);
   await assert.rejects(modulo.autorizar('registrarUsuario',{secretoSesion:loginGerencia.token}),/rol Administrador/);
   assert.equal((await modulo.autorizar('registrarUsuario',{secretoSesion:loginAdmin.token})).administrador,true);
  });

  let sesionOrdinaria;
  await t.test('CU73 limita metadatos para Gerencia y los entrega a Administrador',async()=>{
   const ingreso=await ingresar(ordinaria,{direccion:'203.0.113.10',agente:'Prueba CU73'});
   sesionOrdinaria=await modulo.autorizar('miSesion',{secretoSesion:ingreso.token});
   const limitada=await modulo.consultarSesiones(actorGerencia);
   const filaLimitada=limitada.find(s=>s.usuario.usuario_id_usuario===ordinaria.usuario_id_usuario);
   assert.deepEqual(Object.keys(filaLimitada).sort(),['activa','usuario']);assert.equal(filaLimitada.activa,true);
   assert.equal('id' in filaLimitada,false);assert.equal('direccion' in filaLimitada,false);assert.equal('agente' in filaLimitada,false);
   assert.equal(limitada.find(s=>s.usuario.usuario_id_usuario===original.usuario_id_usuario).activa,false);

   const completa=await modulo.consultarSesiones(actorAdmin);
   const filaCompleta=completa.find(s=>s.id===sesionOrdinaria.sesion);
   assert.equal(filaCompleta.direccion,'203.0.113.10');assert.equal(filaCompleta.agente,'Prueba CU73');
   assert.ok(filaCompleta.inicio instanceof Date);assert.ok(filaCompleta.vence instanceof Date);
  });

  await t.test('CU74 exige Admin, cierra sesión ordinaria y protege la original',async()=>{
   await assert.rejects(modulo.cerrarSesionAdministrativa(actorGerencia,{id:sesionOrdinaria.sesion,confirmado:true}),/rol Administrador/);
   await modulo.cerrarSesionAdministrativa(actorAdmin,{id:sesionOrdinaria.sesion,confirmado:true});
   assert.ok((await prisma.sesion_usuario.findUniqueOrThrow({where:{id:sesionOrdinaria.sesion}})).invalidada);

   const ingresoOriginal=await ingresar(original,{direccion:'203.0.113.20',agente:'Prueba CU74'});
   const sesionOriginal=await modulo.autorizar('miSesion',{secretoSesion:ingresoOriginal.token});
   await assert.rejects(modulo.cerrarSesionAdministrativa(actorAdmin,{id:sesionOriginal.sesion,confirmado:true}),/administrador original.*protegida/i);
   assert.equal((await prisma.sesion_usuario.findUniqueOrThrow({where:{id:sesionOriginal.sesion}})).invalidada,null);
  });

  await t.test('login exitoso reinicia intentos y ciclos de bloqueo',async()=>{
   await prisma.estado_seguridad_usuario.update({where:{id_usuario:gerencia.usuario_id_usuario},data:{intentos:2,bloqueos:2,bloqueo_hasta:new Date(Date.now()-60000),bloqueo_persistente:false}});
   await modulo.iniciarSesion({acceso:gerencia.acceso_m4,clave,reemplazarSesion:true},{});
   const estado=await prisma.estado_seguridad_usuario.findUniqueOrThrow({where:{id_usuario:gerencia.usuario_id_usuario}});
   assert.equal(estado.intentos,0);assert.equal(estado.bloqueos,0);
  });

  await t.test('administrador original conserva recuperación autónoma y no admite reset ajeno',async()=>{
   const antes=await prisma.sesion_usuario.count({where:{id_usuario:original.usuario_id_usuario,invalidada:null}});assert.ok(antes>0);
   await prisma.estado_seguridad_usuario.update({where:{id_usuario:ordinaria.usuario_id_usuario},data:{intentos:0,bloqueos:3,bloqueo_hasta:null,bloqueo_persistente:true}});
   const enviados=correos.length;await modulo.solicitarRecuperacion({acceso:ordinaria.acceso_m4});assert.equal(correos.length,enviados);
   await prisma.estado_seguridad_usuario.update({where:{id_usuario:original.usuario_id_usuario},data:{intentos:0,bloqueos:3,bloqueo_hasta:null,bloqueo_persistente:true}});
   await modulo.solicitarRecuperacion({acceso:original.acceso_m4});
   const enlace=correos.find(c=>c.correo===original.usuario_correo)?.enlace;assert.ok(enlace);
   const token=enlace.split('#')[1];const nueva='Original-recuperada-M4!2026';
   await modulo.validarRecuperacion({token});await modulo.recuperarClave({token,claveNueva:nueva});
   await assert.rejects(modulo.recuperarClave({token,claveNueva:'Otra-clave-original-M4!2026'}),/Enlace/);
   assert.equal(await prisma.sesion_usuario.count({where:{id_usuario:original.usuario_id_usuario,invalidada:null}}),0);
   await assert.rejects(ingresar(original),/Credenciales incorrectas/);
   assert.ok((await modulo.iniciarSesion({acceso:original.acceso_m4,clave:nueva},{})).token);
   await assert.rejects(modulo.modificarUsuario('restablecerClave',actorAdmin,{id:original.usuario_id_usuario.toString(),confirmado:true}),/raíz Midas|original.*protegida/i);
  });
 } finally {
  await prisma.$transaction(async tx=>{
   await tx.sesion_usuario.deleteMany({where:{id_usuario:{in:ids}}});await tx.token_recuperacion.deleteMany({where:{id_usuario:{in:ids}}});
   await tx.usuario_permiso_particular.deleteMany({where:{id_usuario:{in:ids}}});await tx.estado_seguridad_usuario.deleteMany({where:{id_usuario:{in:ids}}});
   await tx.usuario_contrasena.deleteMany({where:{usuario_id_usuario:{in:ids}}});await tx.usuario.deleteMany({where:{usuario_id_usuario:{in:ids}}});
   await tx.empleado.deleteMany({where:{rut_empleado:{in:empleados}}});
  });
 }
});
