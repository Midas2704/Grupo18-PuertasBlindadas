const {test}=require('node:test');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {readFileSync}=require('node:fs');
const {configuracionDemo,planDemo,fechaMes,acotarEfectiva,variar,validarComparativasM7}=require('../dist/administracion/demo/configuracion');
const {validarDestinoDemo}=require('../dist/administracion/demo/seguridad');

test('ventana consecutiva, dos años completos y cantidades variables',()=>{
  const p=planDemo(configuracionDemo({}));
  assert.equal(p.desde,'2023-11'); assert.equal(p.hasta,'2026-10'); assert.equal(p.meses.length,36);
  assert.deepEqual(p.aniosCompletos,['2024','2025']);
  assert.ok(new Set(p.meses.map(m=>m.ventas)).size>=3);
  for(let i=1;i<p.meses.length;i++) {
    const a=new Date(p.meses[i-1].mes+'-01T00:00:00Z'); a.setUTCMonth(a.getUTCMonth()+1);
    assert.equal(a.toISOString().slice(0,7),p.meses[i].mes);
  }
});
test('cortes tempranos, bisiestos y validación de configuración',()=>{
  for(const corte of ['2024-02-29','2026-01-01','2026-10-02','2026-12-31']) {
    const c=configuracionDemo({DEMO_FECHA_CORTE:corte});
    for(let m=0;m<36;m++) for(let d=1;d<=28;d++) assert.ok(fechaMes(c,m,d).toISOString().slice(0,10)<=corte);
    assert.ok(planDemo(c).aniosCompletos.length>=2);
  }
  for(const corte of ['2026-02-30','2025-02-29','2026-13-01','x']) assert.throws(()=>configuracionDemo({DEMO_FECHA_CORTE:corte}));
  for(const meses of ['25','35','121','36.5','x']) assert.throws(()=>configuracionDemo({DEMO_MESES:meses}));
  assert.throws(()=>configuracionDemo({DEMO_SEMILLA:'NaN'}));
  assert.equal(acotarEfectiva(new Date('2030-01-01Z'),configuracionDemo({})).toISOString().slice(0,10),'2026-10-21');
});
test('escenario independiente del reloj y aleatoriedad reproducible',()=>{
  assert.deepEqual(planDemo(configuracionDemo({})),planDemo(configuracionDemo({})));
  const a=Array.from({length:50},(_,i)=>variar(2704,1,100000,i,3));
  assert.deepEqual(a,Array.from({length:50},(_,i)=>variar(2704,1,100000,i,3)));
  assert.notDeepEqual(a,Array.from({length:50},(_,i)=>variar(12,1,100000,i,3)));
});
test('M7 rechaza estructura vacía, constantes y ausencia de datos',()=>{
  const cortes=[1,2,3].map(n=>({corte:`202${n}-10`,ventas:{monto:n*100000,cantidad:n}}));
  assert.doesNotThrow(()=>validarComparativasM7(cortes));
  assert.throws(()=>validarComparativasM7([]));
  assert.throws(()=>validarComparativasM7(cortes.map(c=>({...c,ventas:{monto:100,cantidad:1}}))));
  assert.throws(()=>validarComparativasM7(cortes.map(c=>({...c,ventas:{monto:null,cantidad:0}}))));
});
test('destino: sólo PostgreSQL local aislado explícito',()=>{
  const env={DEMO_BASE_AISLADA:'SI',DATABASE_URL:'postgresql://demo:demo@localhost/puertas_test'};
  assert.equal(validarDestinoDemo(env),true);
  for(const cambio of [{NODE_ENV:'production'},{DEMO_BASE_AISLADA:''},{DATABASE_URL:'postgresql://x@db.example/puertas_test'},{DATABASE_URL:'postgresql://x@localhost/production'},{DATABASE_URL:'postgresql://x@localhost/puertas_test?host=remote'},{DATABASE_URL:'file:local_test'}]) assert.throws(()=>validarDestinoDemo({...env,...cambio}));
});
test('preview no carga Prisma ni requiere DATABASE_URL',()=>{
  const env={...process.env}; delete env.DATABASE_URL;
  const p=JSON.parse(execFileSync(process.execPath,['dist/administracion/sembrarDemoCompleto.js','preview'],{env,encoding:'utf8'}));
  assert.equal(p.estado,'PREVISUALIZACION_SIN_CONEXION_NI_ESCRITURAS'); assert.equal(p.meses.length,36);
});
test('carga mantiene contrato M9, catálogo compartido y barreras de propiedad',()=>{
  const s=readFileSync('src/administracion/demoCompletoDatos.ts','utf8');
  assert.doesNotMatch(s,/evento_auditoria_m9\.(create|createMany|update|delete)/);
  assert.match(s,/controlador\.recibir\(/); assert.match(s,/pg_try_advisory_lock/);
  assert.match(s,/contiene registros preexistentes/); assert.match(s,/manifiesto.descripcion !== firma/);
  assert.doesNotMatch(s,/item.id_item_comercial %/);
  assert.doesNotMatch(s,/update: \{ estado_afp/);
});
test('mapa cubre modelos, vistas y rutas declaradas y no pierde repositorios con alias',()=>{
  const e=JSON.parse(readFileSync('../documentacion/EVIDENCIA_BD_REAL.json','utf8'));
  const schema=readFileSync('prisma/schema.prisma','utf8');
  const nombres=[...schema.matchAll(/^(?:model|view)\s+(\w+)\s*\{/gm)].map(m=>m[1]);
  assert.deepEqual(e.inventario.map(m=>m.nombre),nombres);
  const rutas=[...readFileSync('src/rutas/finanzas.ts','utf8').matchAll(/rutas\.(get|post|put|patch|delete)\('([^']+)',\s*derivar\('([^']+)'\)/g)];
  assert.equal(e.endpoints.length,rutas.length);
  assert.equal(e.inventario.find(m=>m.nombre==='pago_remuneracion').clasificacion,'ACTIVA');
  assert.equal(e.inventario.find(m=>m.nombre==='lote').clasificacion,'ACTIVA INDIRECTA');
});
