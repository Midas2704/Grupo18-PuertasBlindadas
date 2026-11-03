import 'dotenv/config';
import { configuracionDemo, planDemo } from './demo/configuracion';
import { validarDestinoDemo } from './demo/seguridad';

async function ejecutar() {
  const modo = process.argv[2] || 'seed';
  if (modo === 'preview') { console.log(JSON.stringify(planDemo(configuracionDemo(process.env)), null, 2)); return; }
  if (!['seed', 'status', 'verify', 'clean'].includes(modo)) throw new Error(`Modo no soportado: ${modo}`);
  if (['seed', 'clean'].includes(modo)) validarDestinoDemo(process.env);
  const { ejecutarDatosDemo, desconectarDemo } = await import('./demoCompletoDatos');
  try { await ejecutarDatosDemo(modo); } finally { await desconectarDemo(); }
}
ejecutar().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
