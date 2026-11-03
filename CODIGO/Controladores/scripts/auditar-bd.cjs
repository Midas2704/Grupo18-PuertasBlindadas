/* Offline evidence index. Run from Controladores. Uses the installed TypeScript parser. */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve('../..'), out = path.join(root, 'CODIGO/documentacion');
const slash = p => p.split(path.sep).join('/');
const rel = p => slash(path.relative(root, p));
function files(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => ['node_modules','.git','dist'].includes(e.name) ? [] : e.isDirectory() ? files(path.join(dir,e.name)) : [path.join(dir,e.name)]); }
const read = f => fs.readFileSync(f,'utf8');
const schema = read('prisma/schema.prisma');
const modelos = [...schema.matchAll(/^(model|view)\s+(\w+)\s*\{([\s\S]*?)^\}/gm)].map(m => ({ nombre:m[2], clase:m[1], esquema:/@@schema\("([^"]+)"\)/.exec(m[3])?.[1], tabla:/@@map\("([^"]+)"\)/.exec(m[3])?.[1] || m[2], cuerpo:m[3] }));
const names = new Set(modelos.map(m=>m.nombre));
const sources = files(path.join(root,'CODIGO')).filter(f=>/\.(ts|tsx|sql|cjs|md)$/.test(f) && !/\.d\.ts$/.test(f));
const runtime = sources.filter(f=> /Controladores[\\/]src[\\/]/.test(f) && !/[\\/]administracion[\\/]/.test(f));
const src = new Map(sources.map(f=>[f,read(f)]));
const methods=[];
for(const f of runtime) {
  const ast=ts.createSourceFile(f,src.get(f),ts.ScriptTarget.Latest,true);
  function visit(n, cls='') {
    if(ts.isClassDeclaration(n)) cls=n.name?.text || cls;
    if((ts.isMethodDeclaration(n)||ts.isFunctionDeclaration(n)) && n.name && n.body) methods.push({archivo:rel(f),clase:cls,nombre:n.name.getText(ast),texto:n.body.getText(ast),linea:ast.getLineAndCharacterOfPosition(n.getStart(ast)).line+1, llamadas:[], tablas:[]});
    ts.forEachChild(n,c=>visit(c,cls));
  } visit(ast);
}
const operacionSQL = op => ({ findMany:['SELECT'],findUnique:['SELECT'],findFirst:['SELECT'],findFirstOrThrow:['SELECT'],findUniqueOrThrow:['SELECT'],count:['SELECT'],aggregate:['SELECT'],groupBy:['SELECT'],create:['INSERT'],createMany:['INSERT'],createManyAndReturn:['INSERT'],update:['UPDATE'],updateMany:['UPDATE'],upsert:['SELECT','INSERT','UPDATE'],delete:['DELETE'],deleteMany:['DELETE'] }[op] || []);
const queryCache = new Map();
function queries(text) {
  if(queryCache.has(text)) return queryCache.get(text);
  const q=[];
  for(const m of text.matchAll(/\.\s*(\w+)\s*\.\s*(\w+)\s*\(/g)) if(names.has(m[1]) && operacionSQL(m[2]).length) q.push({tabla:m[1],operacion:m[2],sql:operacionSQL(m[2])});
  for(const m of modelos) if(new RegExp('(?:FROM|JOIN|INTO|UPDATE)\\s+(?:"?'+m.esquema+'"?\\.)?"?'+m.tabla+'"?\\b','i').test(text)) q.push({tabla:m.nombre,operacion:'SQL directo',sql:['SELECT/REVISAR SQL']});
  queryCache.set(text,q); return q;
}
for(const m of methods) {
  m.tablas=queries(m.texto);
  for(const c of m.texto.matchAll(/(?:this\.(?:(\w+)\.)?)?(\w+)\s*\(/g)) {
    const found=methods.filter(x=> x.nombre===c[2] && (c[1] && /^m\d$/i.test(c[1]) ? x.clase===c[1].toUpperCase()+'Controller' : x.clase===m.clase || (!x.clase && x.archivo===m.archivo)));
    for(const x of found) if(x!==m) m.llamadas.push(methods.indexOf(x));
  }
}
function closure(ids,seen=new Set()) { for(const id of ids) { if(seen.has(id)) continue; seen.add(id); closure(methods[id].llamadas,seen); } return [...seen]; }
const seed=read('src/administracion/demoCompletoDatos.ts').replace(/async function limpiarDemo\(\)[\s\S]*?(?=async function conteos\()/,'')+'\n'+read('src/administracion/demo/trazabilidad.ts');
const oldSeeds=['prisma/seed.ts','prisma/seed-m4.ts'].map(f=>({archivo:f,tablas:[...new Set(queries(read(f)).map(q=>q.tabla))]}));
const migrations=files(path.resolve('prisma/migrations')).filter(f=>f.endsWith('.sql'));
const migrationsText=migrations.map(f=>read(f)).join('\n');
const migrationContents = new Map(migrations.map(f=>[f,read(f)]));
const views=files(path.resolve('prisma/views')).map(f=>({archivo:rel(f),tablas:queries(read(f)).map(q=>q.tabla)}));
const inventory=modelos.map(m=>{
 const evidence=[];
 for(const f of runtime) {
   const consumers=methods.filter(fn=>fn.archivo===rel(f)&&fn.tablas.some(t=>t.tabla===m.nombre));
   if(consumers.length) for(const fn of consumers) for(const q of fn.tablas.filter(q=>q.tabla===m.nombre)) evidence.push({archivo:rel(f),funcion:fn.nombre,linea:fn.linea,...q});
   else for(const q of queries(src.get(f)).filter(q=>q.tabla===m.nombre)) evidence.push({archivo:rel(f),funcion:'consulta de archivo',...q});
 }
 const nested=[];
 for(const f of runtime) if(new RegExp('\\b'+m.nombre+'\\s*:').test(src.get(f))) nested.push(rel(f));
 const relations=[...m.cuerpo.matchAll(/^\s+\w+\s+(\w+)[?\[\]]*.*$/gm)].map(r=>r[1]).filter(n=>names.has(n));
 const parents=m.cuerpo.split('\n').filter(l=>/@relation\([^\n]*fields:/.test(l)).map(l=>/^\s*\w+\s+(\w+)/.exec(l)?.[1]).filter(n=>names.has(n));
 const sqlViews=views.filter(v=>v.tablas.includes(m.nombre)).map(v=>v.archivo);
 const coverage=new RegExp('\\b(?:tx|prisma)\\.'+m.nombre+'\\.(?:create|upsert)').test(seed) || new RegExp('\\b'+m.nombre+'\\s*:\\s*\\{\\s*create').test(seed);
 const clasificacion=evidence.length?'ACTIVA':nested.length||sqlViews.length?'ACTIVA INDIRECTA':/^(usuario|perfil|permiso|sesion|token|estado_seguridad|config_)/.test(m.nombre)?'ESTRUCTURAL':/historial|historico|evento_auditoria$/.test(m.nombre)?'HISTÓRICA/LEGACY':'NO UTILIZADA';
 const migrationFiles=migrations.filter(f=>new RegExp('"'+m.tabla+'"').test(migrationContents.get(f))).map(rel);
 return {...m,cuerpo:undefined,relaciones:[...new Set(relations)],padresFK:parents,clasificacion,evidencia:evidence,referenciasRelacion:nested,vistas:sqlViews,semilla:coverage?'CREACIÓN LOCALIZADA; validar escenario':'BRECHA / catálogo externo',registrosComprobados:null,recomendados:coverage?/^(moneda|tipo_|pais|bodega|prevision_salud|limite_global|parametro)/.test(m.nombre)?'Cardinalidad de dominio (ver excepciones)':/cotizacion|pago|nota_venta|documento|remuneracion|movimiento|obligacion/.test(m.nombre)?'>=36 meses; volumen transaccional':'≥7 cuando aplique':'Revisar consumidor y regla antes de sembrar',migraciones:migrationFiles};
});
// Propagate real FK dependencies; an unqueried parent is still required for integrity.
for(let pass=0;pass<inventory.length;pass++) {
  let changed=false;
  for(const child of inventory.filter(m=>['ACTIVA','ACTIVA INDIRECTA','ESTRUCTURAL'].includes(m.clasificacion))) for(const parent of child.padresFK) {
    const p=inventory.find(m=>m.nombre===parent);
    if(p && ['NO UTILIZADA','HISTÓRICA/LEGACY'].includes(p.clasificacion)) {p.clasificacion='ACTIVA INDIRECTA';p.referenciasRelacion.push('FK desde '+child.nombre);changed=true;}
  }
  if(!changed) break;
}
for(const m of inventory.filter(m=>m.clasificacion==='NO UTILIZADA')) {
  if(m.clase==='view') m.clasificacion='HISTÓRICA/LEGACY';
  else if(runtime.some(f=>new RegExp('\\b'+m.nombre+'\\b').test(src.get(f)))) m.clasificacion='PENDIENTE';
}
const facade=read('src/controladores/C_Finanzas.ts');
const routes=read('src/rutas/finanzas.ts');
const dispatch = new Map();
const facadeAst = ts.createSourceFile('C_Finanzas.ts',facade,ts.ScriptTarget.Latest,true);
function cases(n) {
  if(ts.isSwitchStatement(n)) {
    const clauses=n.caseBlock.clauses;
    clauses.forEach((c,i)=>{
      if(!ts.isCaseClause(c)||!ts.isStringLiteral(c.expression)) return;
      let statements=c.statements, j=i;
      while(!statements.length && ++j<clauses.length) statements=clauses[j].statements;
      dispatch.set(c.expression.text,(dispatch.get(c.expression.text)||'')+'\n'+statements.map(s=>s.getText(facadeAst)).join('\n'));
    });
  }
  ts.forEachChild(n,cases);
} cases(facadeAst);
const frontend=sources.filter(f=>/Vistas[\\/]src/.test(f));
const endpoints=[...routes.matchAll(/rutas\.(get|post|put|patch|delete)\('([^']+)',\s*derivar\('([^']+)'\)/g)].map(r=>{
 const op=r[3], block=dispatch.get(op)||'';
 const delegated=[...block.matchAll(/this\.(m\d)\.(\w+)\(/g)].map(x=>({clase:x[1].toUpperCase()+'Controller',metodo:x[2]}));
 const ids=methods.flatMap((m,i)=>delegated.some(d=>d.clase===m.clase&&d.metodo===m.nombre)?[i]:[]);
 const expanded=closure(ids), tables=[...new Set(expanded.flatMap(i=>methods[i].tablas.map(q=>q.tabla)))];
 const front=frontend.filter(f=>src.get(f).includes(r[2].split('/:')[0])||src.get(f).includes(op)).map(rel);
 return {modulo:delegated[0]?.clase.replace('Controller','')||(/M[1-9]$/.exec(op)?.[0])||'TRANSVERSAL',funcionalidad:op,endpoint:r[1].toUpperCase()+' /api/finanzas'+r[2],servicios:delegated,tablas:tables,consultas:expanded.map(i=>({archivo:methods[i].archivo,funcion:methods[i].nombre,linea:methods[i].linea,consultas:methods[i].tablas})),frontend:front,estado:tables.length?tables.every(t=>inventory.find(m=>m.nombre===t)?.semilla.startsWith('CREACIÓN'))?'ESCENARIO PARCIAL; no ejecutado':'BRECHA: tablas sin generación':'PENDIENTE trazado indirecto',datos:'Consultar inventario y casos de borde; no basta la existencia de filas'};
});
fs.mkdirSync(out,{recursive:true});
let gitDir=path.join(root,'.git');
if(fs.statSync(gitDir).isFile()) gitDir=path.resolve(root,read(gitDir).trim().replace(/^gitdir:\s*/,''));
const commonDir=fs.existsSync(path.join(gitDir,'commondir'))?path.resolve(gitDir,read(path.join(gitDir,'commondir')).trim()):gitDir;
const head=read(path.join(gitDir,'HEAD')).trim();
const ref=head.startsWith('ref: ')?head.slice(5):null;
const packed=fs.existsSync(path.join(commonDir,'packed-refs'))?read(path.join(commonDir,'packed-refs')):'';
const commit=ref?(fs.existsSync(path.join(gitDir,ref))?read(path.join(gitDir,ref)).trim():fs.existsSync(path.join(commonDir,ref))?read(path.join(commonDir,ref)).trim():packed.split('\n').find(l=>l.endsWith(' '+ref))?.split(' ')[0]||'NO_RESUELTO'):head;
const evidence={commit,alcance:{modelos:modelos.filter(m=>m.clase==='model').length,vistas:modelos.filter(m=>m.clase==='view').length,migraciones:migrations.length,archivos: sources.length,archivosRuntime:runtime.length,endpoints:endpoints.length},baseDesplegada:'NO INSPECCIONADA: no hay DATABASE_URL ni servidor PostgreSQL configurado',inventario:inventory,endpoints,vistas:views,semillasOriginales:oldSeeds,metodos:methods.map(({texto,...m})=>m)};
fs.writeFileSync(path.join(out,'EVIDENCIA_BD_REAL.json'),JSON.stringify(evidence,null,2)+'\n');
const esc=s=>String(s??'').replaceAll('|','\\|').replaceAll('\n',' ');
const table=(headers,rows)=>'| '+headers.join(' | ')+' |\n| '+headers.map(()=>'---').join(' | ')+' |\n'+rows.map(r=>'| '+r.map(esc).join(' | ')+' |').join('\n')+'\n';
let map=`# Mapa de base de datos utilizada por el código\n\nCommit auditado: ${evidence.commit}.\n\n${JSON.stringify(evidence.alcance)}. Base desplegada: **NO INSPECCIONADA**. No se ejecutaron migraciones ni SQL histórico.\n\n`;
map+='## Método y límites\n\nÍndice reproducible de todos los modelos, vistas, rutas y consultas de CODIGO. AST TypeScript para funciones y métodos; rastreo de delegados Prisma y SQL estático, relaciones anidadas y dependencias de vistas. Las operaciones son capacidades localizadas, no escrituras ejecutadas. SQL dinámico, aliases de repositorios e indirecciones no resolubles se mantienen pendientes; NO UTILIZADA significa sin consumidor localizado por este análisis estático, no prueba de ausencia en despliegue. Las tablas históricas necesitan evaluación de retención antes de cualquier retiro. Cada entrada JSON conserva archivos, funciones, operaciones, relaciones y migraciones. El frontend se enlaza por rutas literales; llamadas con URLs construidas requieren revisión del cliente API. No se inventan conteos desplegados.\n\n';
map+='## Inventario completo\n\n'+table(['Prisma → tabla','Esquema','Clasificación / propósito','Relaciones','Operaciones / consumidores','Semilla','Volumen'],inventory.map(m=>[`${m.nombre} → ${m.tabla}`,m.esquema,`${m.clasificacion}; ${m.nombre.replaceAll('_',' ')}`,m.relaciones.join(', '),[...new Set(m.evidencia.map(e=>`${e.sql.join('/')} ${e.archivo}:${e.funcion}`))].join('; ')||m.referenciasRelacion.join('; ')||'Sin consumidor localizado',m.semilla,m.recomendados]));
map+='\n## Vistas y migraciones\n\n'+table(['Vista SQL','Tablas fuente'],views.map(v=>[v.archivo,v.tablas.join(', ')]));
map+='\nLas definiciones SQL de vistas usan nombres sin esquema: su ejecución depende de search_path. Revisar el despliegue con introspección de sólo lectura. Los CHECK, triggers e índices de expresión definidos en migraciones no quedan completamente expresados por Prisma. El baseline 000 y los SQL de CODIGO/db son artefactos históricos; no se usan para reinicializar bases. EVIDENCIA_BD_REAL.json relaciona cada tabla con cada migración que la menciona; no afirma que esas migraciones estén aplicadas.\n';
map+='\n## Tablas sin uso directo comprobado\n\n'+inventory.filter(m=>!m.evidencia.length).map(m=>`- ${m.esquema}.${m.tabla}: ${m.clasificacion}; ${m.referenciasRelacion.length} archivos con relación y ${m.vistas.length} vistas.`).join('\n')+'\n';
map+='\n## Semillas previas\n\n'+oldSeeds.map(s=>`- ${s.archivo}: ${s.tablas.join(', ')}.`).join('\n')+'\n\nseed.ts llama a seed-m4.ts: puede actualizar permisos y dependencias y aprovisionar credenciales. No se invoca automáticamente por la nueva carga histórica. La semilla original DEMO dependía del administrador original preexistente, contabilizaba todos los usuarios como si fueran DEMO y tenía 25 meses. Tenía upserts con updates en clientes, empleados y catálogos; pagos posteriores al corte; stock fijo desacoplado de entradas; compromisos M8 con fracciones arbitrarias del total; eventos M9 sintéticos a través de contrato. Se conserva la lógica de generación y los contratos de M7/M8/M9, con barreras adicionales y verificaciones.\n';
fs.writeFileSync(path.join(out,'MAPA_BD_REAL.md'),map);
let matrix='# Matriz de cobertura de semilla histórica\n\nCobertura estática, no aceptación funcional. Todas las rutas HTTP registradas se enumeran; las consultas detalladas y las referencias frontend están en EVIDENCIA_BD_REAL.json. ESCENARIO PARCIAL significa generación encontrada, no proceso validado. BRECHA no se oculta con filas artificiales.\n\n';
matrix+=table(['Módulo','Funcionalidad / endpoint','Tablas involucradas','Escenario DEMO','Registros esperados','Estado','Evidencia'],endpoints.map(e=>[e.modulo,e.funcionalidad+'; '+e.endpoint,e.tablas.join(', ')||'Indirección pendiente',e.funcionalidad.match(/anular|revertir|reclasific|compensa|conciliar|reasign|tarifa|deduccion|retencion|aporte/i)?'BRECHA: generar por servicio de dominio en prueba aislada':'Cartera y operaciones históricas; filtros de períodos',e.tablas.map(t=>`${t}: ${inventory.find(m=>m.nombre===t).recomendados}`).join('; '),e.estado,e.servicios.map(s=>`${s.clase}.${s.metodo}`).join('; ')||'C_Finanzas.ejecutar']));
matrix+='\n## Excepciones de cardinalidad y brechas\n\nMoneda CLP, dos tipos B2B/B2C, siete AFP, una bodega DEMO, un país/identificador ficticio, dos tipos de vínculo, una configuración global de límite y fondos mensuales: no se inflan a siete por cuota. Tipos de documentos, categorías de pago y previsiones se rigen por semántica de negocio. Relaciones 1:1 siguen a su padre. Se crean siete identidades sin acceso ni credenciales; roles efectivos, autenticación, sesiones y asignaciones de permisos permanecen pendientes. Siete esquemas/haberes/categorías de egreso; no equivale a cubrir tarifas o deducciones recurrentes.\n\nNo se generan automáticamente compensaciones, reversiones, reclasificaciones, ajustes, todas las políticas M9, postpagos M6 ni todos los flujos M5. Sus endpoints se mantienen visibles como brechas. M9 registra recepción auténtica del contrato de carga; no afirma que cada operación comercial haya pasado por el servicio productor. Inventario concilia entradas/salidas por lote; el costo/consumo por OT requiere todavía validación de dominio. No se considera cumplimiento integral hasta ejecutar las pruebas PostgreSQL y resolver las brechas.\n';
fs.writeFileSync(path.join(out,'MATRIZ_COBERTURA_SEMILLA.md'),matrix);
console.log(JSON.stringify(evidence.alcance));
