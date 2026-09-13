import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { ACCESO_CUENTA_RAIZ, asegurarCuentaRaiz } from './cuentaRaiz';

async function ejecutar() {
  const clave = process.env.M4_CLAVE_RAIZ;
  if (!clave) throw new Error('Configura M4_CLAVE_RAIZ en el entorno del backend');
  await prisma.$transaction(
    tx => asegurarCuentaRaiz(tx, { claveInicial: clave, correo: process.env.M4_CORREO_RAIZ, sincronizarClave: true }),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 },
  );
  console.log(`Cuenta raíz ${ACCESO_CUENTA_RAIZ} aprovisionada correctamente.`);
}

ejecutar().catch(error => {
  console.error(error instanceof Error ? error.message : 'No fue posible aprovisionar la cuenta raíz');
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
