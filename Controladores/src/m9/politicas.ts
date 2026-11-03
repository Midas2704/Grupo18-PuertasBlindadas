import { prisma } from '../db';
import { EventoPersistidoM9 } from './tipos';

export type AccionPoliticaM9='NONE'|'ANONYMIZE'|'PURGE'|'BLOCK';
export type CategoriaM9={id:number;codigo:string;ownership:string;descripcion:string|null};
export type PoliticaM9={id:number;categoriaId:number;version:number;accion:AccionPoliticaM9;modulo:string|null;entidad:string|null;estrategiaRef:string|null;permiteCorrelacion:boolean;preservarMinimo:boolean;finalidadRef:string|null;baseRef:string|null;politicaOwnerRef:string|null;desde:Date;hasta:Date|null};
export type TratamientoM9={eventoId:number;politicaId:number;accion:AccionPoliticaM9;estado:'APLICADO'|'BLOQUEADO'|'DEPENDENCIA_OWNER';correlacionAnonima:string|null;aplicadoEn:Date};
export interface EstrategiaAnonimizacionM9{nombre:string;aplicar(evento:EventoPersistidoM9,permitirCorrelacion:boolean):{evento:EventoPersistidoM9;correlacionAnonima?:string}}
export interface RepositorioPoliticasM9{
  categoria(codigo:string):Promise<CategoriaM9|null>;
  politicaAplicable(categoriaId:number,fecha:Date):Promise<PoliticaM9[]>;
  guardarTratamiento(item:TratamientoM9):Promise<void>;
  tratamientoVigente(eventoId:number):Promise<{tratamiento:TratamientoM9;politica:PoliticaM9}|null>;
}

export class RepositorioPoliticasMemoriaM9 implements RepositorioPoliticasM9{
  private tratamientos:TratamientoM9[]=[];
  constructor(private categorias:CategoriaM9[]=[],private politicas:PoliticaM9[]=[]){ }
  async categoria(codigo:string){return this.categorias.find(c=>c.codigo===codigo)??null;}
  async politicaAplicable(categoriaId:number,fecha:Date){return this.politicas.filter(p=>p.categoriaId===categoriaId&&p.desde<=fecha&&(!p.hasta||p.hasta>=fecha));}
  async guardarTratamiento(item:TratamientoM9){if(!this.tratamientos.some(t=>t.eventoId===item.eventoId&&t.politicaId===item.politicaId))this.tratamientos.push({...item});}
  async tratamientoVigente(eventoId:number){const tratamiento=this.tratamientos.filter(t=>t.eventoId===eventoId).sort((a,b)=>b.aplicadoEn.getTime()-a.aplicadoEn.getTime())[0];if(!tratamiento)return null;const politica=this.politicas.find(p=>p.id===tratamiento.politicaId);return politica?{tratamiento:{...tratamiento},politica:{...politica}}:null;}
}

const mapPolitica=(p:{id_politica_m9:number;id_categoria_retencion:number;version:number;accion:string;modulo_objetivo:string|null;entidad_objetivo:string|null;estrategia_ref:string|null;permite_correlacion:boolean;preservar_minimo:boolean;finalidad_ref:string|null;base_ref:string|null;politica_owner_ref:string|null;vigencia_desde:Date;vigencia_hasta:Date|null}):PoliticaM9=>({id:p.id_politica_m9,categoriaId:p.id_categoria_retencion,version:p.version,accion:p.accion as AccionPoliticaM9,modulo:p.modulo_objetivo,entidad:p.entidad_objetivo,estrategiaRef:p.estrategia_ref,permiteCorrelacion:p.permite_correlacion,preservarMinimo:p.preservar_minimo,finalidadRef:p.finalidad_ref,baseRef:p.base_ref,politicaOwnerRef:p.politica_owner_ref,desde:p.vigencia_desde,hasta:p.vigencia_hasta});
export class RepositorioPoliticasPrismaM9 implements RepositorioPoliticasM9{
  async categoria(codigo:string){const c=await prisma.categoria_retencion_m9.findUnique({where:{codigo}});return c?{id:c.id_categoria_retencion,codigo:c.codigo,ownership:c.ownership,descripcion:c.descripcion}:null;}
  async politicaAplicable(categoriaId:number,fecha:Date){return (await prisma.politica_tratamiento_m9.findMany({where:{id_categoria_retencion:categoriaId,vigencia_desde:{lte:fecha},OR:[{vigencia_hasta:null},{vigencia_hasta:{gte:fecha}}]},orderBy:{version:'desc'}})).map(mapPolitica);}
  async guardarTratamiento(item:TratamientoM9){await prisma.tratamiento_privacidad_m9.upsert({where:{id_evento_m9_id_politica_m9:{id_evento_m9:item.eventoId,id_politica_m9:item.politicaId}},update:{},create:{id_evento_m9:item.eventoId,id_politica_m9:item.politicaId,accion:item.accion,estado:item.estado,correlacion_anonima:item.correlacionAnonima,aplicado_en:item.aplicadoEn}});}
  async tratamientoVigente(eventoId:number){const t=await prisma.tratamiento_privacidad_m9.findFirst({where:{id_evento_m9:eventoId},orderBy:{aplicado_en:'desc'}});if(!t)return null;const p=await prisma.politica_tratamiento_m9.findUnique({where:{id_politica_m9:t.id_politica_m9}});return p?{tratamiento:{eventoId:t.id_evento_m9,politicaId:t.id_politica_m9,accion:t.accion as AccionPoliticaM9,estado:t.estado as TratamientoM9['estado'],correlacionAnonima:t.correlacion_anonima,aplicadoEn:t.aplicado_en},politica:mapPolitica(p)}:null;}
}

const minimo=(evento:EventoPersistidoM9,correlacion:string|null):EventoPersistidoM9=>({...evento,ejecutorReferencia:null,entidadReferencia:correlacion,anterior:null,nuevo:null,motivo:null,causa:null,metadatos:null,eventoPrivacidad:true});
export class MotorPoliticasM9{
  private estrategias=new Map<string,EstrategiaAnonimizacionM9>();
  constructor(private repositorio:RepositorioPoliticasM9){ }
  registrarEstrategia(estrategia:EstrategiaAnonimizacionM9){this.estrategias.set(estrategia.nombre,estrategia);}
  async tratar(evento:EventoPersistidoM9,categoriaCodigo:string,fecha:Date):Promise<{estado:string;politica:PoliticaM9|null}>{
    const categoria=await this.repositorio.categoria(categoriaCodigo);if(!categoria)return{estado:'SIN_POLITICA',politica:null};
    if(categoria.ownership!=='M9')return{estado:'DEPENDENCIA_OWNER',politica:null};
    const candidatas=(await this.repositorio.politicaAplicable(categoria.id,fecha)).filter(p=>(!p.modulo||p.modulo===evento.modulo)&&(!p.entidad||p.entidad===evento.entidadTipo));
    if(candidatas.length!==1)return{estado:candidatas.length?'POLITICA_AMBIGUA':'SIN_POLITICA',politica:null};
    const politica=candidatas[0];let estado:TratamientoM9['estado']='APLICADO',correlacion:string|null=null;
    if(politica.accion==='BLOCK')estado='BLOQUEADO';
    if(politica.accion==='ANONYMIZE'){
      const estrategia=politica.estrategiaRef?this.estrategias.get(politica.estrategiaRef):undefined;
      if(!estrategia)estado='DEPENDENCIA_OWNER';else correlacion=estrategia.aplicar(evento,politica.permiteCorrelacion).correlacionAnonima??null;
    }
    await this.repositorio.guardarTratamiento({eventoId:evento.id,politicaId:politica.id,accion:politica.accion,estado,correlacionAnonima:politica.permiteCorrelacion?correlacion:null,aplicadoEn:fecha});
    return{estado,politica};
  }
  private async ocultarVinculo(id:number|null){if(!id)return false;const vinculo=await this.repositorio.tratamientoVigente(id);return Boolean(vinculo&&vinculo.tratamiento.estado==='APLICADO'&&['ANONYMIZE','PURGE'].includes(vinculo.politica.accion));}
  private async limpiarRelaciones(evento:EventoPersistidoM9){const [origen,correctivo]=await Promise.all([this.ocultarVinculo(evento.eventoOrigenId),this.ocultarVinculo(evento.eventoCorrectivoId)]);return origen||correctivo?{...evento,eventoOrigenId:origen?null:evento.eventoOrigenId,eventoCorrectivoId:correctivo?null:evento.eventoCorrectivoId}:evento;}
  async proyectar(evento:EventoPersistidoM9):Promise<EventoPersistidoM9|null>{
    const vigente=await this.repositorio.tratamientoVigente(evento.id);if(!vigente||vigente.tratamiento.estado!=='APLICADO'||vigente.politica.accion==='NONE'||vigente.politica.accion==='BLOCK')return this.limpiarRelaciones(evento);
    if(vigente.politica.accion==='PURGE')return vigente.politica.preservarMinimo?minimo(evento,null):null;
    const estrategia=vigente.politica.estrategiaRef?this.estrategias.get(vigente.politica.estrategiaRef):undefined;
    if(!estrategia)return this.limpiarRelaciones(minimo(evento,vigente.tratamiento.correlacionAnonima));
    return this.limpiarRelaciones(estrategia.aplicar(evento,vigente.politica.permiteCorrelacion).evento);
  }
}
