export type EstadoSeguridadEntornoM9={repositorio:'CAPA_M9';transito:'CONFIGURACION_INFRAESTRUCTURA'|'TLS_CONFIGURADO';temporalesExportacion:'NO_APLICA_MEMORIA';advertencias:string[]};

export function estadoSeguridadEntornoM9(databaseUrl=process.env.DATABASE_URL,entorno=process.env.NODE_ENV):EstadoSeguridadEntornoM9{
  const advertencias:string[]=[];let transito:EstadoSeguridadEntornoM9['transito']='CONFIGURACION_INFRAESTRUCTURA';
  if(databaseUrl){
    try{const url=new URL(databaseUrl);const ssl=url.searchParams.get('sslmode');if(['require','verify-ca','verify-full'].includes(ssl??''))transito='TLS_CONFIGURADO';else if(entorno==='production')advertencias.push('M9_DATABASE_TLS_NO_VERIFICADO');}
    catch{advertencias.push('M9_DATABASE_CONFIG_INVALIDA');}
  }else advertencias.push('M9_DATABASE_CONFIG_AUSENTE');
  return{repositorio:'CAPA_M9',transito,temporalesExportacion:'NO_APLICA_MEMORIA',advertencias};
}

export const EXPORTACION_M9_MODO='MEMORIA' as const;
