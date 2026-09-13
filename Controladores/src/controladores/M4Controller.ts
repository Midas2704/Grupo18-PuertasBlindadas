import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { ErrorAplicacion } from '../utilidades/ErrorAplicacion';
import { comprobarClave, hashClave, validarClave, secreto, huella, futuro, politica } from '../utilidades/seguridad';
import { CorreoRecuperacion, CorreoDesarrollo } from '../utilidades/correo';
import { codigosTodosLosCU, operacionesPermiso, operacionesQueRequierenAdministrador } from '../validaciones/permisos';
import { texto } from '../validaciones/solicitudes';

type Transaccion = Prisma.TransactionClient;
type Entrada = Record<string, unknown>;
export interface ContextoSesion { direccion?: string; agente?: string; secretoSesion?: string }
const incluirAccesos = { perfil: { include: { perfil_permiso: { include: { permiso: true } } } }, particulares: { include: { permiso: true } }, seguridad: true, empleado_seguridad: true } satisfies Prisma.usuarioInclude;
type Cuenta = Prisma.usuarioGetPayload<{include: typeof incluirAccesos}>;
export interface ActorAutenticado { id: bigint; sesion: string; permisos: string[]; configuracion: string; administrador: boolean; cambiarClave: boolean; nombre: string; acceso: string }
const error = (estado: number, mensaje: string): never => { throw new ErrorAplicacion(estado,mensaje); };
const idCuenta = (valor: unknown) => { if (!/^\d+$/.test(String(valor))) return error(400,'Usuario inválido'); return BigInt(String(valor)); };
const confirmar = (entrada: Entrada) => { if (entrada.confirmado !== true) error(400,'Debes confirmar la operación'); };
const permisosEfectivos = (cuenta: Cuenta) => {
 if(cuenta.usuario_es_administrador && cuenta.perfil?.codigo_m4 === 'gerencia') return codigosTodosLosCU;
 const permisos = cuenta.configuracion_particular ? cuenta.particulares.map(v => v.permiso) : (cuenta.perfil?.perfil_permiso.filter(v => v.perfil_permiso_activo).map(v => v.permiso) || []);
 return permisos.filter(p => p.activo_m4 && p.codigo_m4 && (!p.requiere_administrador || cuenta.usuario_es_administrador)).map(p => p.codigo_m4!);
};

/** Único controlador funcional M4 (CU59–CU74). Ningún otro módulo lo invoca. */
// En seguridad vamos despacio; Midas tiene la última palabra acá.
export class M4Controller {
 constructor(private readonly correo: CorreoRecuperacion = new CorreoDesarrollo()) {}
 private async transaccion<T>(accion: (tx: Transaccion)=>Promise<T>): Promise<T> {
  for(let intento=0;;intento++) {
   try { return await prisma.$transaction(accion, {isolationLevel:Prisma.TransactionIsolationLevel.Serializable, timeout:30000}); }
   catch(e) { if ((e as {code?:string}).code === 'P2034' && intento < 2) continue; throw e; }
  }
 }
 private async cuenta(tx: Transaccion, id: bigint) {
  const cuenta = await tx.usuario.findUnique({where:{usuario_id_usuario:id},include:incluirAccesos});
  if (!cuenta) return error(404,'Usuario no encontrado'); return cuenta;
 }
 private async invalidar(tx: Transaccion, id: bigint, motivo: string) {
  await tx.sesion_usuario.updateMany({where:{id_usuario:id,invalidada:null},data:{invalidada:new Date(),motivo}});
  await tx.usuario.update({where:{usuario_id_usuario:id},data:{version_seguridad:{increment:1},usuario_fecha_de_ultima_edicion:new Date()}});
 }
 private async credencial(tx: Transaccion, id: bigint) {
  const credencial = await tx.usuario_contrasena.findFirst({where:{usuario_id_usuario:id,activa:true},orderBy:{creada:'desc'}});
  if(!credencial) return error(401,'Credencial no disponible'); return credencial;
 }
 private async nuevaClave(tx: Transaccion, id: bigint, clave: string, temporal=false) {
  validarClave(clave);
  const historial=await tx.usuario_contrasena.findMany({where:{usuario_id_usuario:id},orderBy:{creada:'desc'},take:politica.historial});
  for(const anterior of historial) if(await comprobarClave(clave,anterior.usuario_contrasena)) error(400,'La contraseña ya fue utilizada recientemente');
  const hash=await hashClave(clave);
  await tx.usuario_contrasena.updateMany({where:{usuario_id_usuario:id,activa:true},data:{activa:false,invalidada:new Date()}});
  await tx.usuario_contrasena.create({data:{usuario_id_usuario:id,usuario_contrasena:hash,activa:true,temporal,vence:futuro(temporal?politica.temporalMinutos:politica.vigenciaDias*1440)}});
  await tx.token_recuperacion.updateMany({where:{id_usuario:id,utilizado:null},data:{utilizado:new Date()}});
  await this.invalidar(tx,id,'Cambio de credencial');
 }
 private async reiniciarSeguridad(tx:Transaccion,id:bigint,responsable:string) {
  await tx.estado_seguridad_usuario.upsert({where:{id_usuario:id},create:{id_usuario:id,responsable},update:{intentos:0,bloqueos:0,bloqueo_hasta:null,bloqueo_persistente:false,actualizado:new Date(),responsable}});
 }
 private presentar(cuenta:Cuenta) {
  return {id:cuenta.usuario_id_usuario.toString(),acceso:cuenta.acceso_m4 || 'Pendiente de habilitación M4',nombre:cuenta.empleado_seguridad?`${cuenta.empleado_seguridad.nombres} ${cuenta.empleado_seguridad.apellido_paterno}`:(cuenta.usuario_nombre_completo_primer_nombre_usuario || cuenta.usuario_username || `Cuenta heredada ${cuenta.usuario_id_usuario}`),
   correo:cuenta.usuario_correo,estado:cuenta.usuario_estado_cuenta,configuracion:cuenta.perfil?.codigo_m4,configuracionParticular:cuenta.configuracion_particular,
   administrador:!!cuenta.usuario_es_administrador,original:cuenta.administrador_original,bloqueada:!!cuenta.seguridad?.bloqueo_persistente,bloqueoHasta:cuenta.seguridad?.bloqueo_hasta,
   permisos:permisosEfectivos(cuenta),permisosParticulares:cuenta.particulares.map(p=>p.permiso.codigo_m4),rutEmpleado:cuenta.empleado_m4};
 }
 async autorizar(operacion:string, contexto:ContextoSesion, adicionales:string[]=[]):Promise<ActorAutenticado> {
  if(!contexto.secretoSesion) return error(401,'Inicia sesión para continuar');
  const sesion=await prisma.sesion_usuario.findUnique({where:{secreto_hash:huella(contexto.secretoSesion)},include:{usuario:{include:incluirAccesos}}});
  const ahora = new Date();
  const finAbsoluto = sesion ? new Date(sesion.inicio.getTime() + politica.sesionMinutos * 60000) : ahora;
  if(!sesion || sesion.invalidada || sesion.vence<=ahora || finAbsoluto<=ahora || sesion.version_seguridad!==sesion.usuario.version_seguridad || sesion.usuario.usuario_estado_cuenta!=='activo') return error(401,'La sesión finalizó; vuelve a iniciar sesión');
  const cuenta=sesion.usuario;
  if(cuenta.seguridad?.bloqueo_persistente || (cuenta.seguridad?.bloqueo_hasta && cuenta.seguridad.bloqueo_hasta>new Date())) return error(401,'Cuenta bloqueada');
  const credencial=await this.credencial(prisma,cuenta.usuario_id_usuario);
  const cambiarClave=credencial.temporal || !!(credencial.vence && credencial.vence<=new Date());
  const personales=['miSesion','cambiarClave','cerrarSesion'];
  if(cambiarClave && !personales.includes(operacion)) return error(403,'Debes cambiar tu contraseña antes de continuar');
  const permisos=permisosEfectivos(cuenta);
  if (Number(operacionesPermiso[operacion]?.slice(2)) >= 59 && cuenta.perfil?.codigo_m4 !== 'gerencia') return error(403,'La operación requiere configuración de Gerencia');
  if (operacionesQueRequierenAdministrador.has(operacion) && !cuenta.usuario_es_administrador) return error(403,'La operación requiere rol Administrador');
  if(!personales.includes(operacion) && (!operacionesPermiso[operacion] || !permisos.includes(operacionesPermiso[operacion]!))) return error(403,'No tienes permiso para esta operación');
  if(adicionales.some(p=>!permisos.includes(p))) return error(403,'No tienes permiso para los filtros o condiciones solicitados');
  const vencePorInactividad = new Date(Math.min(finAbsoluto.getTime(), ahora.getTime() + politica.inactividadMinutos * 60000));
  await prisma.sesion_usuario.update({where:{id:sesion.id},data:{vence:vencePorInactividad}});
  return {id:cuenta.usuario_id_usuario,sesion:sesion.id,permisos,configuracion:cuenta.perfil?.codigo_m4 || '',administrador:!!cuenta.usuario_es_administrador,cambiarClave,nombre:this.presentar(cuenta).nombre || '',acceso:cuenta.acceso_m4 || ''};
 }
 async iniciarSesion(entrada:Entrada, contexto:ContextoSesion) {
  const acceso=texto(entrada.acceso,100).replace(/\./g,'').toLowerCase();
  const resultado=await this.transaccion(async tx=>{
   const cuenta=await tx.usuario.findUnique({where:{acceso_m4:acceso},include:incluirAccesos});
   const credencial=cuenta?await tx.usuario_contrasena.findFirst({where:{usuario_id_usuario:cuenta.usuario_id_usuario,activa:true},orderBy:{creada:'desc'}}):null;
   const valido=credencial && await comprobarClave(entrada.clave,credencial.usuario_contrasena);
   if(!valido) {
    if(cuenta) {
     const anterior=cuenta.seguridad;
     const intentos=(anterior?.intentos || 0)+1;
     const umbral=intentos>=politica.intentos;
     const bloqueos=(anterior?.bloqueos || 0)+(umbral?1:0);
     const datos={intentos:umbral?0:intentos,bloqueos,bloqueo_persistente:!!anterior?.bloqueo_persistente || bloqueos>=politica.bloqueos,bloqueo_hasta:umbral?futuro(politica.bloqueoMinutos):anterior?.bloqueo_hasta,actualizado:new Date()};
     await tx.estado_seguridad_usuario.upsert({where:{id_usuario:cuenta.usuario_id_usuario},create:{id_usuario:cuenta.usuario_id_usuario,...datos},update:datos});
    }
    return {fallo:401,mensaje:'Credenciales incorrectas'};
   }
   if(cuenta!.usuario_estado_cuenta!=='activo') return {fallo:403,mensaje:'Cuenta inactiva'};
   if(cuenta!.seguridad?.bloqueo_persistente || (cuenta!.seguridad?.bloqueo_hasta && cuenta!.seguridad.bloqueo_hasta>new Date())) return {fallo:403,mensaje:'Cuenta bloqueada'};
   if(credencial!.temporal && credencial!.vence && credencial!.vence<=new Date()) return {fallo:403,mensaje:'Credencial temporal vencida; solicita restablecimiento'};
   await tx.sesion_usuario.updateMany({where:{id_usuario:cuenta!.usuario_id_usuario,invalidada:null,vence:{lte:new Date()}},data:{invalidada:new Date(),motivo:'Vencimiento'}});
   const anterior=await tx.sesion_usuario.findFirst({where:{id_usuario:cuenta!.usuario_id_usuario,invalidada:null,vence:{gt:new Date()}},orderBy:{inicio:'desc'}});
   if(anterior && entrada.reemplazarSesion!==true) return {fallo:409,mensaje:'Ya existe una sesión activa. Confirma si quieres cerrarla e iniciar una nueva.',codigo:'SESION_ACTIVA_REQUIERE_CONFIRMACION'};
   if(anterior) await tx.sesion_usuario.updateMany({where:{id_usuario:cuenta!.usuario_id_usuario,invalidada:null},data:{invalidada:new Date(),motivo:'Reemplazo confirmado por el usuario'}});
   const token=secreto();
   await tx.sesion_usuario.create({data:{id_usuario:cuenta!.usuario_id_usuario,secreto_hash:huella(token),vence:futuro(Math.min(politica.sesionMinutos,politica.inactividadMinutos)),version_seguridad:cuenta!.version_seguridad,direccion:contexto.direccion,agente:contexto.agente?.slice(0,300)}});
   await tx.usuario.update({where:{usuario_id_usuario:cuenta!.usuario_id_usuario},data:{usuario_fecha_ultima_conexion:new Date()}});
   await tx.estado_seguridad_usuario.updateMany({where:{id_usuario:cuenta!.usuario_id_usuario},data:{intentos:0,bloqueos:0}});
   return {token,usuario:{...this.presentar(cuenta!),cambiarClave:credencial!.temporal || !!(credencial!.vence && credencial!.vence<=new Date())}};
  });
  if(resultado.fallo) throw new ErrorAplicacion(resultado.fallo,resultado.mensaje!,'codigo' in resultado?resultado.codigo:undefined); return resultado;
 }
 async cambiarClave(actor:ActorAutenticado,entrada:Entrada) {
  return this.transaccion(async tx=>{
   const actual=await this.credencial(tx,actor.id);
   if(!await comprobarClave(entrada.claveActual,actual.usuario_contrasena)) error(400,'Contraseña actual incorrecta');
   validarClave(entrada.claveNueva); await this.nuevaClave(tx,actor.id,entrada.claveNueva); await this.reiniciarSeguridad(tx,actor.id,actor.id.toString());
   return {mensaje:'Contraseña actualizada. Inicia sesión nuevamente.'};
  });
 }
 async cerrarSesion(actor:ActorAutenticado) { await prisma.sesion_usuario.updateMany({where:{id:actor.sesion,id_usuario:actor.id,invalidada:null},data:{invalidada:new Date(),motivo:'Cierre propio'}});return {mensaje:'Sesión cerrada'}; }
 async usuarios() { return (await prisma.usuario.findMany({include:incluirAccesos,orderBy:{acceso_m4:'asc'}})).map(c=>this.presentar(c)); }
 async catalogosUsuarios() {
  const [empleados,configuraciones,permisos,dependencias]=await Promise.all([
   prisma.empleado.findMany({where:{estado_laboral:'activo',cuenta_m4:null,usuario:{none:{}}},select:{rut_empleado:true,nombres:true,apellido_paterno:true}}),
   prisma.perfil.findMany({where:{activo_m4:true},select:{codigo_m4:true,perfil_nombre_perfil:true,admite_particulares:true}}),
   prisma.permiso.findMany({where:{activo_m4:true},select:{codigo_m4:true,permiso_descripcion:true,requiere_administrador:true}}),
   prisma.permiso_dependencia.findMany({include:{permiso:{select:{codigo_m4:true}},requerido:{select:{codigo_m4:true}}}})]);
  return {empleados,configuraciones,permisos,dependencias:dependencias.map(d=>({permiso:d.permiso.codigo_m4,requiere:d.requerido.codigo_m4}))};
 }
 private async validarPermisos(tx:Transaccion,codigos:string[],administrador=false) {
  const seleccion=await tx.permiso.findMany({where:{codigo_m4:{in:codigos},activo_m4:true},include:{dependencias:{include:{requerido:true}}}});
  if(seleccion.length!==new Set(codigos).size || seleccion.some(p=>(p.requiere_administrador || Number(p.codigo_m4?.slice(2))>=59)&&!administrador)) error(400,'Permiso no asignable');
  if(seleccion.some(p=>p.dependencias.some(d=>!codigos.includes(d.requerido.codigo_m4!)))) error(409,'No se puede mantener un permiso sin sus dependencias');
  return seleccion;
 }
 async registrarUsuario(actor:ActorAutenticado,entrada:Entrada) {
  confirmar(entrada);
  return this.transaccion(async tx=>{
   const rut=texto(entrada.rutEmpleado,15);
   const empleado=await tx.empleado.findUnique({where:{rut_empleado:rut},include:{usuario:true,cuenta_m4:true}});
   if(!empleado || empleado.estado_laboral!=='activo') return error(400,'Sólo puede crearse una cuenta para un Empleado activo');
   if(empleado.cuenta_m4 || empleado.usuario.length) return error(409,'El Empleado ya tiene un Usuario asociado');
   const perfil=await tx.perfil.findUnique({where:{codigo_m4:texto(entrada.configuracion)}});
   if(!perfil?.activo_m4) return error(400,'Configuración no válida');
   const correo=texto(entrada.correo,254);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return error(400,'Correo inválido');
   const cuenta=await tx.usuario.create({data:{acceso_m4:rut.replace(/\./g,'').toLowerCase(),empleado_m4:rut,empleado_rut_empleado:rut,usuario_correo:correo,usuario_username:rut,usuario_estado_cuenta:'activo',perfil_id_perfil:perfil.perfil_id_perfil,usuario_fecha_de_creacion:new Date(),usuario_es_administrador:false}});
   if(entrada.permisos!==undefined) {
    if(!perfil.admite_particulares || !Array.isArray(entrada.permisos) || !entrada.permisos.length) return error(400,'Configuración particular no válida');
    const permisos=await this.validarPermisos(tx,entrada.permisos.map(p=>texto(p)));
    await tx.usuario.update({where:{usuario_id_usuario:cuenta.usuario_id_usuario},data:{configuracion_particular:true}});
    await tx.usuario_permiso_particular.createMany({data:permisos.map(p=>({id_usuario:cuenta.usuario_id_usuario,id_permiso:p.permiso_id_permiso}))});
   }
   const temporal=secreto(); await this.nuevaClave(tx,cuenta.usuario_id_usuario,temporal,true);await this.reiniciarSeguridad(tx,cuenta.usuario_id_usuario,actor.id.toString());
   return {mensaje:'Usuario registrado',id:cuenta.usuario_id_usuario.toString(),claveTemporal:temporal};
  });
 }
 private async continuidad(tx:Transaccion,cuenta:Cuenta) {
  if(cuenta.administrador_original) return error(409,'La cuenta administrativa original está protegida');
  if(!cuenta.usuario_es_administrador || cuenta.usuario_estado_cuenta!=='activo') return;
  const otras=await tx.usuario.findMany({where:{usuario_id_usuario:{not:cuenta.usuario_id_usuario},usuario_estado_cuenta:'activo',usuario_es_administrador:true,perfil:{codigo_m4:'gerencia'},seguridad:{is:{bloqueo_persistente:false}}},include:incluirAccesos});
  if(!otras.some(c=>['CU65','CU66','CU74'].every(p=>permisosEfectivos(c).includes(p)) && (!c.seguridad?.bloqueo_hasta || c.seguridad.bloqueo_hasta<=new Date()))) error(409,'Continuidad administrativa insuficiente: debe quedar otra cuenta Activa habilitada');
 }
 async modificarUsuario(operacion:string,actor:ActorAutenticado,entrada:Entrada) {
  const id=idCuenta(entrada.id); confirmar(entrada);
  return this.transaccion(async tx=>{
   const cuenta=await this.cuenta(tx,id); if(cuenta.administrador_original) error(409,'La cuenta raíz Midas no puede modificarse'); let temporal:string|undefined;
   if(operacion==='desactivarUsuario') { if(cuenta.usuario_estado_cuenta!=='activo') error(409,'La cuenta no está Activa');await this.continuidad(tx,cuenta);await tx.usuario.update({where:{usuario_id_usuario:id},data:{usuario_estado_cuenta:'inactivo'}}); }
   else if(operacion==='reactivarUsuario') {
    if(cuenta.usuario_estado_cuenta!=='inactivo' || cuenta.empleado_seguridad?.estado_laboral!=='activo') error(409,'La reactivación requiere cuenta Inactiva y Empleado activo');
    if(!permisosEfectivos(cuenta).length) error(409,'Regulariza los permisos antes de reactivar');
    if(cuenta.configuracion_particular) await this.validarPermisos(tx,permisosEfectivos(cuenta));
    else if(!cuenta.perfil?.activo_m4) error(409,'Configuración base no habilitada');
    await tx.usuario.update({where:{usuario_id_usuario:id},data:{usuario_estado_cuenta:'activo'}});temporal=secreto();
   } else if(operacion==='cambiarConfiguracion') {
    const perfil=await tx.perfil.findUnique({where:{codigo_m4:texto(entrada.configuracion)}});
    if(!perfil?.activo_m4) return error(400,'Configuración no válida');
    if(cuenta.usuario_es_administrador && perfil.codigo_m4!=='gerencia') error(409,'Retira primero el rol Administrador, respetando continuidad');
    await tx.usuario_permiso_particular.deleteMany({where:{id_usuario:id}});
    await tx.usuario.update({where:{usuario_id_usuario:id},data:{perfil_id_perfil:perfil.perfil_id_perfil,configuracion_particular:false}});
   } else if(['asignarPermisos','retirarPermisos'].includes(operacion)) {
    if(!cuenta.perfil?.admite_particulares || cuenta.perfil.codigo_m4==='gerencia') error(409,'Esta configuración base no admite permisos particulares');
    if(!Array.isArray(entrada.permisos) || !entrada.permisos.length) error(400,'Selecciona permisos');
    const elegidos=(entrada.permisos as unknown[]).map(p=>texto(p));
    const actuales=permisosEfectivos(cuenta);
    const finales=operacion==='asignarPermisos'?[...new Set([...actuales,...elegidos])]:actuales.filter(p=>!elegidos.includes(p));
    if(!finales.length && cuenta.usuario_estado_cuenta==='activo') error(409,'Una cuenta Activa particular debe conservar permisos efectivos');
    const permisos=await this.validarPermisos(tx,finales);
    await tx.usuario_permiso_particular.deleteMany({where:{id_usuario:id}});
    await tx.usuario_permiso_particular.createMany({data:permisos.map(p=>({id_usuario:id,id_permiso:p.permiso_id_permiso}))});
    await tx.usuario.update({where:{usuario_id_usuario:id},data:{configuracion_particular:true}});
   } else if(operacion==='asignarAdministrador') {
    if(cuenta.usuario_estado_cuenta!=='activo' || cuenta.perfil?.codigo_m4!=='gerencia' || cuenta.usuario_es_administrador || cuenta.seguridad?.bloqueo_persistente) error(409,'Cuenta no habilitada para Administrador');
    const credencial=await this.credencial(tx,actor.id);
    if(!await comprobarClave(entrada.claveActual,credencial.usuario_contrasena)) error(403,'Reautenticación fallida');
    await tx.usuario.update({where:{usuario_id_usuario:id},data:{usuario_es_administrador:true}});
   } else if(operacion==='retirarAdministrador') {
    if(!cuenta.usuario_es_administrador) error(409,'La cuenta no es Administrador');await this.continuidad(tx,cuenta);
    await tx.usuario.update({where:{usuario_id_usuario:id},data:{usuario_es_administrador:false}});
   } else if(['restablecerClave','desbloquearUsuario'].includes(operacion)) {
    if(cuenta.usuario_estado_cuenta!=='activo' || cuenta.empleado_seguridad?.estado_laboral!=='activo') error(409,'Cuenta no habilitada para el procedimiento');
    if(operacion==='desbloquearUsuario' && !cuenta.seguridad?.bloqueo_persistente) error(409,'La cuenta no tiene bloqueo persistente');
    if(operacion==='restablecerClave' && cuenta.seguridad?.bloqueo_persistente) error(409,'Utiliza el desbloqueo administrativo');
    temporal=secreto();
   } else return error(400,'Operación M4 desconocida');
   if(temporal) { await this.nuevaClave(tx,id,temporal,true);await this.reiniciarSeguridad(tx,id,actor.id.toString()); }
   else await this.invalidar(tx,id,operacion);
   return {mensaje:'Operación realizada; la sesión anterior de la cuenta quedó invalidada',...(temporal?{claveTemporal:temporal}:{})};
  });
 }
 async solicitarRecuperacion(entrada:Entrada) {
  const acceso=typeof entrada.acceso==='string'?entrada.acceso.replace(/\./g,'').toLowerCase().slice(0,100):'';
  let envio:{correo:string;token:string}|undefined;
  await this.transaccion(async tx=>{
   const cuenta=await tx.usuario.findUnique({where:{acceso_m4:acceso},include:{seguridad:true}});
   if(!cuenta || cuenta.usuario_estado_cuenta!=='activo' || !cuenta.usuario_correo || (cuenta.seguridad?.bloqueo_persistente && !cuenta.administrador_original)) return;
   await tx.token_recuperacion.updateMany({where:{id_usuario:cuenta.usuario_id_usuario,utilizado:null},data:{utilizado:new Date()}});
   const token=secreto();await tx.token_recuperacion.create({data:{id_usuario:cuenta.usuario_id_usuario,secreto_hash:huella(token),vence:futuro(politica.recuperacionMinutos)}});
   envio={correo:cuenta.usuario_correo,token};
  });
  // TODO: revisar este enlace cuando dejemos de usar el buzón local
  if(envio) try { await this.correo.enviar(envio.correo,`${process.env.M4_URL_VISTA || 'http://127.0.0.1:5174'}/recuperar#${envio.token}`); } catch { console.error('M4: entrega de recuperación pendiente de proveedor/configuración'); }
  return {mensaje:'Si la cuenta está habilitada, recibirás las instrucciones en su correo asociado.'};
 }
 async validarRecuperacion(entrada:Entrada) {
  const recuperacion=await prisma.token_recuperacion.findUnique({where:{secreto_hash:huella(texto(entrada.token,200))},include:{usuario:{include:{seguridad:true}}}});
  if(!recuperacion || recuperacion.utilizado || recuperacion.vence<=new Date() || recuperacion.usuario.usuario_estado_cuenta!=='activo' || (recuperacion.usuario.seguridad?.bloqueo_persistente && !recuperacion.usuario.administrador_original)) return error(400,'Enlace de recuperación no válido');
  return {valido:true};
 }
 async recuperarClave(entrada:Entrada) {
  const token=texto(entrada.token,200);validarClave(entrada.claveNueva);
  return this.transaccion(async tx=>{
   const recuperacion=await tx.token_recuperacion.findUnique({where:{secreto_hash:huella(token)},include:{usuario:{include:{seguridad:true}}}});
   if(!recuperacion || recuperacion.utilizado || recuperacion.vence<=new Date() || recuperacion.usuario.usuario_estado_cuenta!=='activo' || (recuperacion.usuario.seguridad?.bloqueo_persistente && !recuperacion.usuario.administrador_original)) return error(400,'Enlace de recuperación no válido');
   await this.nuevaClave(tx,recuperacion.id_usuario,entrada.claveNueva as string);await this.reiniciarSeguridad(tx,recuperacion.id_usuario,'Recuperación autónoma');
   return {mensaje:'Contraseña recuperada. Inicia sesión nuevamente.'};
  });
 }
  async consultarSesiones(actor:ActorAutenticado) {
   const cuentas=await prisma.usuario.findMany({where:{acceso_m4:{not:null}},select:{usuario_id_usuario:true,acceso_m4:true,sesiones:{where:{invalidada:null,vence:{gt:new Date()}},select:{id:true,inicio:true,vence:true,direccion:true,agente:true},orderBy:{inicio:'desc'},take:1}},orderBy:{acceso_m4:'asc'}});
   if(actor.administrador) return cuentas.map(({sesiones,...usuario})=>{const sesion=sesiones[0];return {activa:!!sesion,usuario,...(sesion||{})};});
   return cuentas.map(({sesiones,...usuario})=>({activa:sesiones.length>0,usuario}));
  }
  async cerrarSesionAdministrativa(actor:ActorAutenticado,entrada:Entrada) {
   if(!actor.administrador) error(403,'La operación requiere rol Administrador');
   confirmar(entrada);const id=texto(entrada.id,100);
   const sesion=await prisma.sesion_usuario.findUnique({where:{id},include:{usuario:{select:{administrador_original:true}}}});
   if(!sesion) return error(409,'La sesión seleccionada ya no está activa');
   if(sesion.invalidada || sesion.vence<=new Date()) error(409,'La sesión seleccionada ya no está activa');
   if(sesion.usuario.administrador_original) error(409,'La sesión del administrador original está protegida');
   await prisma.sesion_usuario.update({where:{id},data:{invalidada:new Date(),motivo:`Cierre administrativo por ${actor.id}`}});
   return {mensaje:'Sesión invalidada; se exige un nuevo inicio de sesión'};
  }
}
