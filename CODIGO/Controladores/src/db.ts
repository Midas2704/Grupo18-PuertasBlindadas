import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
if (!process.env.DATABASE_URL) throw new Error('Configura DATABASE_URL en Controladores/.env');
// El adaptador configura la conexión; toda consulta atraviesa Prisma.
// no borrar: lo usa toda la aplicación
export const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
