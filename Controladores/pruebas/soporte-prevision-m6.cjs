const PARAMETROS = [
  ['UF_CLP', 40000, 'CLP_POR_UF'],
  ['TOPE_AFP_UF', 90, 'UF'],
  ['TOPE_SALUD_UF', 90, 'UF'],
  ['TOPE_LEY16744_UF', 90, 'UF'],
  ['TOPE_CESANTIA_UF', 135.2, 'UF'],
  ['AFP_COTIZACION_OBLIGATORIA', 0.1, 'FACTOR_DECIMAL'],
  ['AFP_COMISION_HABITAT', 0.0127, 'FACTOR_DECIMAL'],
  ['SALUD_TASA_LEGAL', 0.07, 'FACTOR_DECIMAL'],
  ['CESANTIA_TRABAJADOR_INDEFINIDO', 0.006, 'FACTOR_DECIMAL'],
  ['CESANTIA_EMPLEADOR_INDEFINIDO', 0.024, 'FACTOR_DECIMAL'],
  ['CESANTIA_EMPLEADOR_PLAZO', 0.03, 'FACTOR_DECIMAL'],
  ['REFORMA_CUENTA_INDIVIDUAL', 0.001, 'FACTOR_DECIMAL'],
  ['REFORMA_CRP', 0.009, 'FACTOR_DECIMAL'],
  ['REFORMA_SIS_CEV', 0.025, 'FACTOR_DECIMAL'],
  ['SIS_TASA_INFORMATIVA', 0.0162, 'FACTOR_DECIMAL'],
  ['LEY16744_TASA_BASE', 0.009, 'FACTOR_DECIMAL'],
  ['LEY16744_TASA_ADICIONAL', 0.005, 'FACTOR_DECIMAL'],
  ['SANNA_TASA', 0.0003, 'FACTOR_DECIMAL'],
];

async function prepararPrevisionM6(prisma, { empleados, desde, hasta, sinDeduccionesTrabajador = false }) {
  const afp = await prisma.afp.upsert({
    where: { nombre_afp: 'Habitat' },
    create: { nombre_afp: 'Habitat', estado_afp: 'activo' },
    update: { estado_afp: 'activo' },
  });
  const salud = await prisma.prevision_salud.upsert({
    where: { nombre_prevision_salud: 'Fonasa' },
    create: { nombre_prevision_salud: 'Fonasa', tipo_prevision_salud: 'FONASA', estado_prevision_salud: 'activo' },
    update: { tipo_prevision_salud: 'FONASA', estado_prevision_salud: 'activo' },
  });
  const vinculo = await prisma.tipo_vinculo_laboral.upsert({
    where: { nombre_tipo_vinculo_laboral: 'Contrato indefinido' },
    create: { nombre_tipo_vinculo_laboral: 'Contrato indefinido', estado_tipo_vinculo_laboral: 'activo' },
    update: { estado_tipo_vinculo_laboral: 'activo' },
  });
  await prisma.empleado.updateMany({
    where: { id_empleado: { in: empleados } },
    data: { id_afp: afp.id_afp, id_prevision_salud: salud.id_prevision_salud, seguro_cesantia: true, seguro_cesantia_fundamento_exclusion: null },
  });
  await prisma.relacion_laboral_empleado.updateMany({
    where: { id_empleado: { in: empleados } },
    data: { id_tipo_vinculo_laboral: vinculo.id_tipo_vinculo_laboral },
  });
  const ids = [];
  const sinDeduccion = new Set(['AFP_COTIZACION_OBLIGATORIA', 'AFP_COMISION_HABITAT', 'SALUD_TASA_LEGAL', 'CESANTIA_TRABAJADOR_INDEFINIDO']);
  for (const [codigo, valorBase, unidad] of PARAMETROS) {
    const valor = sinDeduccionesTrabajador && sinDeduccion.has(codigo) ? 0 : valorBase;
    const parametro = await prisma.parametro_remuneracional.upsert({
      where: { codigo_vigencia_desde: { codigo, vigencia_desde: new Date(desde) } },
      create: { codigo, tipo: 'LEGAL', nombre: `Fixture ${codigo}`, valor, unidad, vigencia_desde: new Date(desde), vigencia_hasta: new Date(hasta), fuente: 'PRUEBA_M6_PREVISION', estado: 'activo' },
      update: { valor, unidad, vigencia_hasta: new Date(hasta), fuente: 'PRUEBA_M6_PREVISION', estado: 'activo' },
    });
    ids.push(parametro.id_parametro_remuneracional);
  }
  return ids;
}

module.exports = { prepararPrevisionM6 };
