require('dotenv/config');
const { Client } = require('pg');
// Explicit command only. Connection is read-only at server session and transaction levels.
async function main() {
  if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL requerida para introspección de sólo lectura');
  const db=new Client({connectionString:process.env.DATABASE_URL,options:'-c default_transaction_read_only=on -c statement_timeout=15000'});
  await db.connect();
  try {
    await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const tablas=(await db.query("SELECT table_schema,table_name,table_type FROM information_schema.tables WHERE table_schema IN ('finanzas','inventario','terreno') ORDER BY 1,2")).rows;
    const columnas=(await db.query("SELECT table_schema,table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema IN ('finanzas','inventario','terreno') ORDER BY 1,2,ordinal_position")).rows;
    const restricciones=(await db.query("SELECT n.nspname AS esquema,t.relname AS tabla,c.conname,c.contype,c.convalidated,pg_get_constraintdef(c.oid) AS definicion FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname IN ('finanzas','inventario','terreno') ORDER BY 1,2,3")).rows;
    const indices=(await db.query("SELECT schemaname,tablename,indexname,indexdef FROM pg_indexes WHERE schemaname IN ('finanzas','inventario','terreno') ORDER BY 1,2,3")).rows;
    const vistas=(await db.query("SELECT schemaname,viewname,definition FROM pg_views WHERE schemaname IN ('finanzas','inventario','terreno') ORDER BY 1,2")).rows;
    const conteos=[];
    if(process.env.DEMO_AUDIT_CONTEOS==='SI') for(const t of tablas.filter(t=>t.table_type==='BASE TABLE')) {
      const quote=s=>'"'+s.replaceAll('"','""')+'"';
      const result=await db.query(`SELECT count(*)::text AS cantidad FROM ${quote(t.table_schema)}.${quote(t.table_name)}`);
      conteos.push({...t,cantidad:result.rows[0].cantidad});
    }
    await db.query('COMMIT');
    console.log(JSON.stringify({modo:'SOLO_LECTURA',tablas,columnas,restricciones,indices,vistas,conteos},null,2));
  } finally { await db.end(); }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
