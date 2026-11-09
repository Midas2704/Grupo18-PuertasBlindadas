import { M9Controller } from '../controladores/M9Controller';
import { ErrorAplicacion } from '../utilidades/ErrorAplicacion';
import { validarSinSecretos } from './seguridad';

type ContextoOwnerM9={owner:string;identidadLogica:string;ocurridoEn:string;zonaHoraria:string;referenciaOwner:string;finalidadRef?:string;baseRef?:string;politicaRef?:string};
type DerechoOwnerM9=ContextoOwnerM9&{tipo:'EJERCICIO'|'ACUSE'|'RESOLUCION'|'PROPAGACION'|'BLOQUEO_INICIO'|'BLOQUEO_FIN';estado?:string;fechaAcuse?:string;fechaInicio?:string;fechaFin?:string;plazoRef?:string;decision?:'RESUELTO'|'DENEGADO';fundamentoRef?:string;receptores?:string[]};
type IncidenteOwnerM9=ContextoOwnerM9&{clasificadoPorOwner:boolean;naturaleza?:string;efectos?:string;categorias?:string[];volumenAproximado?:string;medidas?:string[];comunicacionRef?:string;tratamientoAdicionalRef?:string};

const compactar=(valor:Record<string,unknown>)=>Object.fromEntries(Object.entries(valor).filter(([,contenido])=>contenido!==undefined));
const datosOwner=(entrada:ContextoOwnerM9)=>compactar({finalidadRef:entrada.finalidadRef,baseRef:entrada.baseRef,politicaRef:entrada.politicaRef});
export class ReceptorPostM9{
  constructor(private m9:M9Controller){ }
  async recibirDerecho(entrada:DerechoOwnerM9){
    validarSinSecretos(entrada);
    if(!entrada.owner.trim()||!entrada.referenciaOwner.trim())throw new ErrorAplicacion(400,'Owner o referencia ausente','M9_OWNER_INVALIDO');
    if(entrada.tipo==='RESOLUCION'&&(!entrada.decision||!entrada.fundamentoRef?.trim()))throw new ErrorAplicacion(400,'La resolución debe venir decidida y fundada por el owner','M9_DEPENDENCIA_OWNER');
    const nuevo=compactar({tipo:entrada.tipo,estado:entrada.estado,fechaAcuse:entrada.fechaAcuse,fechaInicio:entrada.fechaInicio,fechaFin:entrada.fechaFin,plazoRef:entrada.plazoRef,decision:entrada.decision,fundamentoRef:entrada.fundamentoRef,receptores:entrada.receptores,...datosOwner(entrada)});
    return this.m9.recibir({identidadLogica:entrada.identidadLogica,versionContrato:'1.0',ocurridoEn:entrada.ocurridoEn,zonaHoraria:entrada.zonaHoraria,ejecutor:{tipo:'SISTEMA',referencia:entrada.owner},productor:'M9',modulo:'M9',operacion:`DERECHO_${entrada.tipo}`,resultado:'EXITOSO',referencia:{tipo:'DERECHO_OWNER',id:entrada.referenciaOwner},nuevo,eventoPrivacidad:true,contextoTerminal:true,capacidad:'EMITIR_EVENTO_M9',critico:true});
  }
  async recibirIncidente(entrada:IncidenteOwnerM9){
    validarSinSecretos(entrada);
    if(!entrada.clasificadoPorOwner)throw new ErrorAplicacion(400,'M9 no clasifica incidentes','M9_DEPENDENCIA_OWNER');
    const nuevo=compactar({naturaleza:entrada.naturaleza,efectos:entrada.efectos,categorias:entrada.categorias,volumenAproximado:entrada.volumenAproximado,medidas:entrada.medidas,comunicacionRef:entrada.comunicacionRef,tratamientoAdicionalRef:entrada.tratamientoAdicionalRef,...datosOwner(entrada)});
    return this.m9.recibir({identidadLogica:entrada.identidadLogica,versionContrato:'1.0',ocurridoEn:entrada.ocurridoEn,zonaHoraria:entrada.zonaHoraria,ejecutor:{tipo:'SISTEMA',referencia:entrada.owner},productor:'M9',modulo:'M9',operacion:'INCIDENTE_CLASIFICADO_OWNER',resultado:'EXITOSO',referencia:{tipo:'INCIDENTE_OWNER',id:entrada.referenciaOwner},nuevo,eventoPrivacidad:true,contextoTerminal:true,capacidad:'EMITIR_EVENTO_M9',critico:true});
  }
  estadoContextoFinalidad(entrada:Pick<ContextoOwnerM9,'finalidadRef'|'baseRef'|'politicaRef'>){
    return entrada.finalidadRef||entrada.baseRef||entrada.politicaRef?{estado:'INFORMADO_POR_OWNER',...datosOwner(entrada as ContextoOwnerM9)}:{estado:'DEPENDENCIA_OWNER',finalidadRef:null,baseRef:null,politicaRef:null};
  }
}
