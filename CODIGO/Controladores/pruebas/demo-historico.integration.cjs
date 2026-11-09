const {test}=require('node:test');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {Client}=require('pg');
const {validarDestinoDemo}=require('../dist/administracion/demo/seguridad');
const run=modo=>JSON.parse(execFileSync(process.execPath,['dist/administracion/sembrarDemoCompleto.js',modo],{encoding:'utf8',maxBuffer:20*1024*1024}));
test('PostgreSQL: doble ejecución idéntica y seguridad preexistente intacta',{skip:process.env.DEMO_TEST_INTEGRACION!=='SI'},async()=>{
  validarDestinoDemo(process.env);
  const db=new Client({connectionString:process.env.DATABASE_URL}); await db.connect();
  const seguridad=async()=> (await db.query(`SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) AS filas FROM terreno.usuario t WHERE coalesce(usuario_username,'') NOT LIKE 'DEMO-UI-%'`)).rows[0].filas;
  const permisos=async()=> (await db.query(`SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) AS filas FROM terreno.perfil_permiso t`)).rows[0].filas;
  const snapshot=async()=>{
    const tablas=(await db.query("SELECT table_schema,table_name FROM information_schema.tables WHERE table_schema IN ('finanzas','inventario','terreno') AND table_type='BASE TABLE' ORDER BY 1,2")).rows;
    const salida={}; const quote=s=>'"'+s.replaceAll('"','""')+'"';
    for(const t of tablas) salida[t.table_schema+'.'+t.table_name]=(await db.query(`SELECT md5(to_jsonb(t)::text) AS hash FROM ${quote(t.table_schema)}.${quote(t.table_name)} t`)).rows.map(r=>r.hash);
    return salida;
  };
  try {
    const antes=await seguridad(), permisosAntes=await permisos();
    const preexistentes=await snapshot();
    run('seed'); const primero=run('status'); run('seed'); const segundo=run('status');
    assert.deepEqual(segundo,primero); assert.deepEqual(await seguridad(),antes); assert.deepEqual(await permisos(),permisosAntes);
    const despues=await snapshot();
    for(const [tabla,huellas] of Object.entries(preexistentes)) for(const huella of huellas) assert.ok(despues[tabla].includes(huella),`Registro preexistente modificado en ${tabla}`);
    assert.equal(run('verify').estado,'OK'); assert.equal(segundo.rangoHistorico.meses,Number(process.env.DEMO_MESES||36));
    assert.equal(segundo.actividadEfectivaPosteriorRango,0);
    assert.ok(Object.keys(segundo.seriesMensuales.ventas).length>=36);
    assert.ok(new Set(Object.values(segundo.seriesMensuales.ventas).map(v=>v.monto)).size>12);
  } finally { await db.end(); }
  // Deliberately no automatic cleanup; M9 is immutable and a failed fixture remains inspectable.
});
