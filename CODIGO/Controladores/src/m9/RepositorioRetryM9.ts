import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { FuentePendientesM9, NuevoPendienteM9, PendienteM9 } from './puertos';
import { EventoNormalizadoM9 } from './tipos';

const aJson = (evento: EventoNormalizadoM9): Prisma.InputJsonValue => ({
  ...evento,
  fechaOcurrencia:evento.fechaOcurrencia.toISOString(),
  fechaPersistencia:evento.fechaPersistencia.toISOString(),
}) as unknown as Prisma.InputJsonValue;

const desdeJson = (valor: Prisma.JsonValue): EventoNormalizadoM9 => {
  const evento=valor as unknown as EventoNormalizadoM9 & { fechaOcurrencia:string; fechaPersistencia:string };
  return {...evento,fechaOcurrencia:new Date(evento.fechaOcurrencia),fechaPersistencia:new Date(evento.fechaPersistencia)};
};

type Fila=Awaited<ReturnType<typeof prisma.pendiente_evento_m9.findFirst>>;
const mapear=(fila:NonNullable<Fila>):PendienteM9=>{
  const evento=desdeJson(fila.payload_evento);
  return {id:fila.id_pendiente_m9,identidadLogica:fila.identidad_logica,versionContrato:evento.versionContrato,ocurridoEn:evento.fechaOcurrencia.toISOString(),zonaHoraria:evento.zonaHoraria,productor:fila.productor,modulo:fila.modulo_origen,operacion:fila.operacion,resultado:evento.resultado,creadoEn:fila.creado_en,intentos:fila.cantidad_intentos,evento,estado:fila.estado as PendienteM9['estado'],proximoIntentoEn:fila.proximo_intento_en,resueltoEn:fila.resuelto_en,ultimoErrorCodigo:fila.ultimo_error_codigo,ultimoErrorEn:fila.ultimo_error_en};
};

export class RepositorioRetryM9Prisma implements FuentePendientesM9 {
  async guardar(item:NuevoPendienteM9){
    if(!item.evento) throw new Error('El pendiente durable requiere evento normalizado');
    await prisma.pendiente_evento_m9.upsert({where:{identidad_logica:item.identidadLogica},update:{},create:{identidad_logica:item.identidadLogica,productor:item.productor,modulo_origen:item.modulo,operacion:item.operacion,fecha_ocurrencia:item.evento.fechaOcurrencia,creado_en:item.creadoEn,proximo_intento_en:item.creadoEn,payload_evento:aJson(item.evento)}});
  }
  async listar(){return (await prisma.pendiente_evento_m9.findMany({orderBy:{creado_en:'asc'}})).map(mapear);}
  async elegibles(ahora:Date,limite:number){
    return (await prisma.pendiente_evento_m9.findMany({where:{estado:{in:['PENDIENTE','REINTENTANDO']},resuelto_en:null,proximo_intento_en:{lte:ahora}},orderBy:{creado_en:'asc'},take:limite})).map(mapear);
  }
  async reclamar(id:number,ahora:Date,leaseHasta:Date){const resultado=await prisma.pendiente_evento_m9.updateMany({where:{id_pendiente_m9:id,resuelto_en:null,estado:{in:['PENDIENTE','REINTENTANDO']},proximo_intento_en:{lte:ahora}},data:{estado:'REINTENTANDO',proximo_intento_en:leaseHasta}});return resultado.count===1;}
  async registrarResultado(id:number,resultado:'EXITOSO'|'FALLIDO',fecha:Date,errorCodigo?:string,proximoIntentoEn?:Date){
    await prisma.$transaction(async tx=>{
      const actual=await tx.pendiente_evento_m9.findUniqueOrThrow({where:{id_pendiente_m9:id}}); const numero=actual.cantidad_intentos+1;
      await tx.intento_retry_m9.create({data:{id_pendiente_m9:id,numero_intento:numero,estado:resultado,error_codigo:resultado==='FALLIDO'?errorCodigo??'M9_RETRY_FALLIDO':null,iniciado_en:fecha,finalizado_en:fecha}});
      await tx.pendiente_evento_m9.update({where:{id_pendiente_m9:id},data:resultado==='EXITOSO'?{estado:'RESUELTO',resuelto_en:fecha,cantidad_intentos:numero,ultimo_error_codigo:null,ultimo_error_en:null}:{estado:'PENDIENTE',cantidad_intentos:numero,ultimo_error_codigo:errorCodigo??'M9_RETRY_FALLIDO',ultimo_error_en:fecha,proximo_intento_en:proximoIntentoEn??fecha}});
    });
  }
}
