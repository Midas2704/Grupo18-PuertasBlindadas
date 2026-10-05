import type { ContextoSesion, ActorAutenticado } from '../controladores/M4Controller';
export type ContextoAutorizacion = ContextoSesion;
// Contrato de inyección para pruebas; no hay adaptador provisional en ejecución.
// esto quedó acá porque moverlo rompía el flujo de pruebas
export interface Autorizacion { autorizar(operacion: string, contexto: ContextoAutorizacion): Promise<ActorAutenticado | void>; }
