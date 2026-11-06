import 'dotenv/config';
import { crearAplicacion } from './app';
import { prisma } from './db';
const puerto = Number(process.env.PORT || 3000);
const direccion = process.env.HOST || '127.0.0.1';
const servidor = crearAplicacion().listen(puerto, direccion, () => {
  // mensaje de arranque para quien está levantando el proyecto a mano
  console.log(`Finanzas disponible en http://${direccion}:${puerto} (sesiones y permisos M4)`);
});
servidor.on('error', error => { console.error(error.message); process.exitCode = 1; });
for (const senal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(senal, () => { servidor.close(() => { void prisma.$disconnect().then(() => process.exit(0)); }); });
}
