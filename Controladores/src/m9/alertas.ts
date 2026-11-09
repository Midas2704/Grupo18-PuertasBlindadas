import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { SenalM9, SenalesM9 } from './puertos';

export type ConfiguracionAlertaM9={codigo:string;metrica:string;operador:'GT'|'GTE'|'LT'|'LTE'|'EQ';umbral:number};
export interface FuenteConfiguracionAlertasM9{vigentes(fecha:Date):Promise<ConfiguracionAlertaM9[]>}
export class ConfiguracionAlertasMemoriaM9 implements FuenteConfiguracionAlertasM9{
  constructor(private configuraciones:ConfiguracionAlertaM9[]=[]){ }
  async vigentes(){return this.configuraciones.map(item=>({...item}));}
}
export class ConfiguracionAlertasPrismaM9 implements FuenteConfiguracionAlertasM9{
  async vigentes(fecha:Date){const filas=await prisma.configuracion_alerta_m9.findMany({where:{activa:true,vigencia_desde:{lte:fecha},OR:[{vigencia_hasta:null},{vigencia_hasta:{gte:fecha}}]}});return filas.map(f=>({codigo:f.codigo,metrica:f.metrica,operador:f.operador as ConfiguracionAlertaM9['operador'],umbral:Number(f.umbral)}));}
}
const cumple=(valor:number,item:ConfiguracionAlertaM9)=>({GT:valor>item.umbral,GTE:valor>=item.umbral,LT:valor<item.umbral,LTE:valor<=item.umbral,EQ:valor===item.umbral})[item.operador];
export class MotorAlertasM9{
  constructor(private fuente:FuenteConfiguracionAlertasM9,private senales:SenalesM9){ }
  async evaluar(metricas:Record<string,number>,fecha=new Date()):Promise<SenalM9[]>{
    const activadas:SenalM9[]=[];
    for(const config of await this.fuente.vigentes(fecha)){const valor=metricas[config.metrica];if(valor!==undefined&&Number.isFinite(valor)&&cumple(valor,config)){const senal:SenalM9={tipo:'ALERTA_TECNICA',productor:'M9',codigoConfiguracion:config.codigo,metrica:config.metrica};this.senales.emitir(senal);activadas.push(senal);}}
    return activadas;
  }
}

// Referencia explícita para que la configuración pueda usar Decimal sin conversiones flotantes al persistir.
export const umbralDecimalM9=(valor:string)=>new Prisma.Decimal(valor);
