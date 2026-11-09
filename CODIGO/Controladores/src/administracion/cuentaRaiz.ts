import { Prisma } from '@prisma/client';
import { comprobarClave, futuro, hashClave, politica, secreto, validarClave } from '../utilidades/seguridad';

export const ACCESO_CUENTA_RAIZ = '20776101-k';

interface OpcionesCuentaRaiz {
  claveInicial?: string;
  correo?: string;
  generarClaveSiFalta?: boolean;
  sincronizarClave?: boolean;
}

/** Aprovisionamiento idempotente de la única cuenta raíz funcional. */
export async function asegurarCuentaRaiz(tx: Prisma.TransactionClient, opciones: OpcionesCuentaRaiz = {}) {
  const acceso = ACCESO_CUENTA_RAIZ;
  const perfil = await tx.perfil.upsert({
    where: { codigo_m4: 'gerencia' },
    update: { activo_m4: true },
    create: { codigo_m4: 'gerencia', perfil_nombre_perfil: 'Gerencia', activo_m4: true, admite_particulares: false },
  });
  const cargo = await tx.cargo.upsert({
    where: { nombre_cargo: 'Demostración M4' },
    update: { estado_cargo: 'activo' },
    create: { nombre_cargo: 'Demostración M4', descripcion_cargo: 'Cargo ficticio para la cuenta raíz', estado_cargo: 'activo' },
  });
  const vinculo = await tx.tipo_vinculo_laboral.upsert({
    where: { nombre_tipo_vinculo_laboral: 'Demostración M4' },
    update: { estado_tipo_vinculo_laboral: 'activo' },
    create: { nombre_tipo_vinculo_laboral: 'Demostración M4', descripcion_tipo_vinculo_laboral: 'Vínculo ficticio para la cuenta raíz', estado_tipo_vinculo_laboral: 'activo' },
  });
  await tx.empleado.upsert({
    where: { rut_empleado: acceso },
    update: { id_cargo: cargo.id_cargo, id_tipo_vinculo_laboral: vinculo.id_tipo_vinculo_laboral, nombres: 'Midas', apellido_paterno: 'Demostración', estado_laboral: 'activo' },
    create: { rut_empleado: acceso, id_cargo: cargo.id_cargo, id_tipo_vinculo_laboral: vinculo.id_tipo_vinculo_laboral, nombres: 'Midas', apellido_paterno: 'Demostración', fecha_ingreso: new Date(), sueldo_base: 0, estado_laboral: 'activo' },
  });

  // Sólo esta cuenta conserva la protección especial; las anteriores siguen con su rol Administrador.
  await tx.usuario.updateMany({ where: { administrador_original: true, acceso_m4: { not: acceso } }, data: { administrador_original: false } });
  const correo = opciones.correo?.trim();
  const datos = {
    empleado_m4: acceso, empleado_rut_empleado: acceso, usuario_username: 'Midas',
    usuario_nombre_completo_primer_nombre_usuario: 'Midas', usuario_rut_usuario: acceso,
    usuario_estado_cuenta: 'activo', usuario_es_gerencia: true, gerencia: 'Gerencia',
    usuario_es_administrador: true, administrador_original: true,
    configuracion_particular: false, perfil_id_perfil: perfil.perfil_id_perfil,
    ...(correo ? { usuario_correo: correo } : {}),
  };
  const cuenta = await tx.usuario.upsert({
    where: { acceso_m4: acceso },
    update: datos,
    create: { acceso_m4: acceso, ...datos, usuario_correo: correo || 'midas@puertasblindadas.local', usuario_fecha_de_creacion: new Date() },
  });

  const vigente = await tx.usuario_contrasena.findFirst({ where: { usuario_id_usuario: cuenta.usuario_id_usuario, activa: true }, orderBy: { creada: 'desc' } });
  const coincide = vigente && opciones.claveInicial ? await comprobarClave(opciones.claveInicial, vigente.usuario_contrasena) : false;
  const debeCrear = !vigente || !!(opciones.sincronizarClave && opciones.claveInicial && !coincide);
  let claveCreada: string | undefined;
  if (debeCrear) {
    claveCreada = opciones.claveInicial || (opciones.generarClaveSiFalta ? secreto() : undefined);
    if (!claveCreada) throw new Error('Configura M4_CLAVE_RAIZ para aprovisionar la credencial raíz');
    validarClave(claveCreada);
    const hash = await hashClave(claveCreada);
    const ahora = new Date();
    await tx.usuario_contrasena.updateMany({ where: { usuario_id_usuario: cuenta.usuario_id_usuario, activa: true }, data: { activa: false, invalidada: ahora } });
    await tx.usuario_contrasena.create({ data: { usuario_id_usuario: cuenta.usuario_id_usuario, usuario_contrasena: hash, activa: true, temporal: false, vence: futuro(politica.vigenciaDias * 1440) } });
    await tx.token_recuperacion.updateMany({ where: { id_usuario: cuenta.usuario_id_usuario, utilizado: null }, data: { utilizado: ahora } });
    await tx.sesion_usuario.updateMany({ where: { id_usuario: cuenta.usuario_id_usuario, invalidada: null }, data: { invalidada: ahora, motivo: 'Aprovisionamiento de cuenta raíz' } });
    await tx.usuario.update({ where: { usuario_id_usuario: cuenta.usuario_id_usuario }, data: { version_seguridad: { increment: 1 }, usuario_fecha_de_ultima_edicion: ahora } });
  }
  await tx.estado_seguridad_usuario.upsert({
    where: { id_usuario: cuenta.usuario_id_usuario },
    create: { id_usuario: cuenta.usuario_id_usuario, responsable: 'Aprovisionamiento de cuenta raíz' },
    update: { intentos: 0, bloqueos: 0, bloqueo_hasta: null, bloqueo_persistente: false, actualizado: new Date(), responsable: 'Aprovisionamiento de cuenta raíz' },
  });
  return { cuenta, claveCreada };
}
