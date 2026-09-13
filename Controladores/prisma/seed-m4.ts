import { prisma } from '../src/db';
import { futuro } from '../src/utilidades/seguridad';
import { codigosImplementados, codigosTodosLosCU, codigosGerencia, codigosSecretaria, codigosContador, dependenciasPermiso } from '../src/validaciones/permisos';
import { asegurarCuentaRaiz } from '../src/administracion/cuentaRaiz';
export async function sembrarM4() {
 if(process.env.NODE_ENV==='production') throw new Error('El seed de credenciales ficticias sólo se permite en desarrollo');
 let claveInicialCreada: string | undefined;
 await prisma.$transaction(async tx=>{
  const permisos=new Map<string,bigint>();
  for(const codigo of [...new Set([...codigosImplementados, ...codigosTodosLosCU])]) {
   const permiso=await tx.permiso.upsert({where:{codigo_m4:codigo},update:{},create:{codigo_m4:codigo,activo_m4:true,permiso_modulo:Number(codigo.slice(2))>=59?'M4':Number(codigo.slice(2))>=42?'M3':Number(codigo.slice(2))>=12?'M2':'M1',permiso_nombre_del_permiso:codigo,permiso_descripcion:`Operación ${codigo}`,requiere_administrador:['CU65','CU66','CU74'].includes(codigo)}});
   permisos.set(codigo,permiso.permiso_id_permiso);
  }
  for(const [codigo,necesarios] of Object.entries(dependenciasPermiso)) for(const requerido of necesarios) await tx.permiso_dependencia.upsert({where:{id_permiso_id_requerido:{id_permiso:permisos.get(codigo)!,id_requerido:permisos.get(requerido)!}},update:{},create:{id_permiso:permisos.get(codigo)!,id_requerido:permisos.get(requerido)!}});
  const perfiles=new Map<string,bigint>();
  for(const [codigo,nombre,codigos] of [['gerencia','Gerencia',codigosGerencia],['secretaria','Secretaría',codigosSecretaria],['contador','Contador',codigosContador]] as const) {
   const perfil=await tx.perfil.upsert({where:{codigo_m4:codigo},update:{},create:{codigo_m4:codigo,perfil_nombre_perfil:nombre,activo_m4:true,admite_particulares:codigo!=='gerencia'}});perfiles.set(codigo,perfil.perfil_id_perfil);
   await tx.perfil_permiso.updateMany({where:{perfil_id_perfil:perfil.perfil_id_perfil},data:{perfil_permiso_activo:false}});
   for(const permiso of codigos) await tx.perfil_permiso.upsert({where:{perfil_id_perfil_permiso_id_permiso:{perfil_id_perfil:perfil.perfil_id_perfil,permiso_id_permiso:permisos.get(permiso)!}},update:{perfil_permiso_activo:true},create:{perfil_id_perfil:perfil.perfil_id_perfil,permiso_id_permiso:permisos.get(permiso)!,perfil_permiso_activo:true}});
  }
  const raiz=await asegurarCuentaRaiz(tx,{claveInicial:process.env.M4_CLAVE_INICIAL,generarClaveSiFalta:true});
  if(raiz.claveCreada) claveInicialCreada=raiz.claveCreada;
  const cliente=await tx.cliente_financiero.findFirst({where:{nombre_razon_social_referencia:'Demostración I2 — Elena Robles'},include:{ficha_cliente:true}});
  const moneda=await tx.moneda.findUnique({where:{codigo_moneda:'CLP'}});
  if(cliente?.ficha_cliente && moneda) await tx.cotizacion.upsert({where:{referencia_demostracion:'I2-COT-B2C-EMITIDA-M4'},update:{},create:{referencia_demostracion:'I2-COT-B2C-EMITIDA-M4',id_ficha_cliente:cliente.ficha_cliente.id_ficha_cliente,id_moneda:moneda.id_moneda,fecha_emision:new Date(),fecha_vigencia:futuro(30*1440),estado_cotizacion:'emitida',monto_neto:100000,monto_impuesto:19000,monto_total_estimado:119000,exento_iva:false}});
 },{timeout:60000});
 console.log('Seed M4 completado sin reemplazar credenciales vigentes.');
 if(claveInicialCreada) console.log(`Credencial inicial de desarrollo creada para la cuenta raíz: ${claveInicialCreada}`);
}
