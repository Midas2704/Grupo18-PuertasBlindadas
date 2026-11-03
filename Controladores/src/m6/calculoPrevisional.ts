import { Prisma } from '@prisma/client';
import { ErrorAplicacion } from '../utilidades/ErrorAplicacion';

type Tx = Prisma.TransactionClient;
type ComponenteLegal = {
  tipo: 'DEDUCCION_PREVISIONAL' | 'IMPUESTO_RENTA' | 'APORTE_EMPLEADOR_AUTOMATICO';
  descripcion: string;
  monto: Prisma.Decimal;
  claveNegocio: string;
  referenciaOrigen: string;
  versionOrigen: string;
};

type EntradaCalculo = {
  idEmpleado: number;
  fechaInicio: Date;
  fechaFin: Date;
  baseImponible: Prisma.Decimal;
  afp: string | null;
  salud: { nombre: string; tipo: string | null } | null;
  seguroCesantia: boolean;
  fundamentoExclusionCesantia: string | null;
};

const redondear = (valor: Prisma.Decimal) => valor.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
const fechaClave = (fecha: Date) => fecha.toISOString().slice(0, 10);
const codigoNombre = (valor: string) => valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

export async function calcularPrevisionLegal(tx: Tx, entrada: EntradaCalculo) {
  const parametros = await tx.parametro_remuneracional.findMany({
    where: {
      estado: 'activo',
      tipo: { in: ['LEGAL', 'PREVISIONAL', 'TRIBUTARIO'] },
      vigencia_desde: { lte: entrada.fechaInicio },
      OR: [{ vigencia_hasta: null }, { vigencia_hasta: { gte: entrada.fechaFin } }],
    },
  });
  const porCodigo = new Map<string, typeof parametros>();
  for (const parametro of parametros) porCodigo.set(parametro.codigo, [...(porCodigo.get(parametro.codigo) || []), parametro]);
  const usados = new Map<string, (typeof parametros)[number]>();
  const resolver = (codigo: string, unidad: string) => {
    const candidatos = porCodigo.get(codigo) || [];
    if (candidatos.length !== 1 || candidatos[0].valor === null || candidatos[0].unidad !== unidad) {
      throw new ErrorAplicacion(409, `Falta configuración previsional única para ${codigo} en ${fechaClave(entrada.fechaInicio)}`, 'CONFIGURACION_PREVISIONAL_INCOMPLETA');
    }
    usados.set(codigo, candidatos[0]);
    return candidatos[0];
  };
  const referencia = (parametro: (typeof parametros)[number]) => `PARAMETRO:${parametro.id_parametro_remuneracional}`;
  const version = (parametro: (typeof parametros)[number]) => fechaClave(parametro.vigencia_desde);
  const tasa = (parametro: (typeof parametros)[number]) => new Prisma.Decimal(parametro.valor!);
  const componente = (tipo: ComponenteLegal['tipo'], descripcion: string, monto: Prisma.Decimal, claveNegocio: string, parametro: (typeof parametros)[number]): ComponenteLegal => ({
    tipo, descripcion, monto: redondear(monto), claveNegocio, referenciaOrigen: referencia(parametro), versionOrigen: version(parametro),
  });

  if (!entrada.afp || !entrada.salud) {
    throw new ErrorAplicacion(409, 'AFP y previsión de salud son obligatorias para calcular la remuneración', 'CONFIGURACION_PREVISIONAL_INCOMPLETA');
  }
  const uf = resolver('UF_CLP', 'CLP_POR_UF');
  const topeAfp = resolver('TOPE_AFP_UF', 'UF');
  const topeSalud = resolver('TOPE_SALUD_UF', 'UF');
  const topeLey = resolver('TOPE_LEY16744_UF', 'UF');
  const topeCesantia = resolver('TOPE_CESANTIA_UF', 'UF');
  const valorUf = tasa(uf);
  const baseConTope = (tope: (typeof parametros)[number]) => Prisma.Decimal.min(entrada.baseImponible, tasa(tope).mul(valorUf));
  const baseAfp = baseConTope(topeAfp);
  const baseSalud = baseConTope(topeSalud);
  const baseLey = baseConTope(topeLey);
  const baseCesantia = baseConTope(topeCesantia);
  const componentes: ComponenteLegal[] = [];

  const cotizacionAfp = resolver('AFP_COTIZACION_OBLIGATORIA', 'FACTOR_DECIMAL');
  componentes.push(componente('DEDUCCION_PREVISIONAL', `AFP ${entrada.afp} — Cotización obligatoria`, baseAfp.mul(tasa(cotizacionAfp)), 'AFP_COTIZACION_OBLIGATORIA', cotizacionAfp));
  const nombreAfp = codigoNombre(entrada.afp).replace(/^AFP/, '');
  const comisionAfp = resolver(`AFP_COMISION_${nombreAfp}`, 'FACTOR_DECIMAL');
  componentes.push(componente('DEDUCCION_PREVISIONAL', `AFP ${entrada.afp} — Comisión`, baseAfp.mul(tasa(comisionAfp)), 'AFP_COMISION', comisionAfp));

  const tipoSalud = codigoNombre(entrada.salud.tipo || entrada.salud.nombre);
  if (!['FONASA', 'ISAPRE'].includes(tipoSalud)) {
    throw new ErrorAplicacion(409, `El régimen de salud ${entrada.salud.nombre} no tiene una regla previsional configurada`, 'CONFIGURACION_PREVISIONAL_INCOMPLETA');
  }
  const saludLegal = resolver('SALUD_TASA_LEGAL', 'FACTOR_DECIMAL');
  const montoSaludLegal = redondear(baseSalud.mul(tasa(saludLegal)));
  componentes.push(componente('DEDUCCION_PREVISIONAL', `Salud ${entrada.salud.nombre}`, montoSaludLegal, 'SALUD_LEGAL', saludLegal));
  let planSaludSnapshot: Record<string, unknown> | null = null;
  if (tipoSalud === 'ISAPRE') {
    const planes = await tx.cotizacion_salud_empleado.findMany({ where: { id_empleado: entrada.idEmpleado, activa: true, vigencia_desde: { lte: entrada.fechaInicio }, OR: [{ vigencia_hasta: null }, { vigencia_hasta: { gte: entrada.fechaFin } }] } });
    if (planes.length !== 1) throw new ErrorAplicacion(409, 'La cotización pactada de Isapre no está configurada de forma única para el período', 'CONFIGURACION_PREVISIONAL_INCOMPLETA');
    const plan = planes[0];
    planSaludSnapshot = { id: plan.id_cotizacion_salud, valor: plan.valor.toString(), unidad: plan.unidad, vigenciaDesde: fechaClave(plan.vigencia_desde), vigenciaHasta: plan.vigencia_hasta ? fechaClave(plan.vigencia_hasta) : null };
    const pactado = plan.unidad === 'PORCENTAJE'
      ? entrada.baseImponible.mul(plan.valor)
      : plan.unidad === 'UF' ? plan.valor.mul(valorUf) : plan.unidad === 'CLP' ? plan.valor : null;
    if (pactado === null) throw new ErrorAplicacion(409, 'La unidad de la cotización pactada de Isapre es inválida', 'CONFIGURACION_PREVISIONAL_INCOMPLETA');
    const adicional = Prisma.Decimal.max(new Prisma.Decimal(0), redondear(pactado).sub(montoSaludLegal));
    if (adicional.gt(0)) componentes.push({ tipo: 'DEDUCCION_PREVISIONAL', descripcion: `Adicional Isapre — ${entrada.salud.nombre}`, monto: adicional, claveNegocio: 'SALUD_ADICIONAL_ISAPRE', referenciaOrigen: `COTIZACION_SALUD:${plan.id_cotizacion_salud}`, versionOrigen: fechaClave(plan.vigencia_desde) });
  }

  const relaciones = await tx.relacion_laboral_empleado.findMany({
    where: { id_empleado: entrada.idEmpleado, fecha_inicio: { lte: entrada.fechaFin }, OR: [{ fecha_termino: null }, { fecha_termino: { gte: entrada.fechaInicio } }] },
    include: { tipo_vinculo_laboral: true },
  });
  const tiposVinculo = new Map(relaciones.filter(item => item.tipo_vinculo_laboral).map(item => [item.id_tipo_vinculo_laboral, item.tipo_vinculo_laboral!]));
  if (!relaciones.length || relaciones.some(item => !item.tipo_vinculo_laboral) || tiposVinculo.size !== 1) throw new ErrorAplicacion(409, 'El tipo de relación laboral no está resuelto de forma única para el período', 'CONFIGURACION_PREVISIONAL_INCOMPLETA');
  const tipoVinculo = [...tiposVinculo.values()][0];
  if (!entrada.seguroCesantia) {
    if (!entrada.fundamentoExclusionCesantia?.trim()) throw new ErrorAplicacion(409, 'La exclusión del Seguro de Cesantía requiere fundamento', 'CONFIGURACION_PREVISIONAL_INCOMPLETA');
  } else {
    const vinculo = codigoNombre(tipoVinculo.nombre_tipo_vinculo_laboral);
    if (vinculo.includes('INDEFINID')) {
      const trabajador = resolver('CESANTIA_TRABAJADOR_INDEFINIDO', 'FACTOR_DECIMAL');
      const empleador = resolver('CESANTIA_EMPLEADOR_INDEFINIDO', 'FACTOR_DECIMAL');
      componentes.push(componente('DEDUCCION_PREVISIONAL', 'Seguro de Cesantía — trabajador', baseCesantia.mul(tasa(trabajador)), 'CESANTIA_TRABAJADOR', trabajador));
      componentes.push(componente('APORTE_EMPLEADOR_AUTOMATICO', 'Seguro de Cesantía — empleador', baseCesantia.mul(tasa(empleador)), 'CESANTIA_EMPLEADOR', empleador));
    } else if (vinculo.includes('PLAZO') || vinculo.includes('OBRA') || vinculo.includes('FAENA')) {
      const empleador = resolver('CESANTIA_EMPLEADOR_PLAZO', 'FACTOR_DECIMAL');
      componentes.push(componente('APORTE_EMPLEADOR_AUTOMATICO', 'Seguro de Cesantía — empleador', baseCesantia.mul(tasa(empleador)), 'CESANTIA_EMPLEADOR', empleador));
    } else throw new ErrorAplicacion(409, 'El tipo de vínculo laboral no permite resolver el Seguro de Cesantía', 'CONFIGURACION_PREVISIONAL_INCOMPLETA');
  }

  const codigosReforma = ['REFORMA_CUENTA_INDIVIDUAL', 'REFORMA_CRP', 'REFORMA_SIS_CEV'];
  const parametrosReformaPresentes = codigosReforma.filter(codigo => (porCodigo.get(codigo) || []).length > 0);
  if (parametrosReformaPresentes.length > 0) {
    if (parametrosReformaPresentes.length !== codigosReforma.length) {
      throw new ErrorAplicacion(409, 'La configuración del aporte previsional del empleador está incompleta para el período', 'CONFIGURACION_PREVISIONAL_INCOMPLETA');
    }
    const cuenta = resolver('REFORMA_CUENTA_INDIVIDUAL', 'FACTOR_DECIMAL');
    const crp = resolver('REFORMA_CRP', 'FACTOR_DECIMAL');
    const sisCev = resolver('REFORMA_SIS_CEV', 'FACTOR_DECIMAL');
    resolver('SIS_TASA_INFORMATIVA', 'FACTOR_DECIMAL');
    componentes.push(componente('APORTE_EMPLEADOR_AUTOMATICO', 'Cuenta individual — aporte empleador', baseAfp.mul(tasa(cuenta)), 'REFORMA_CUENTA_INDIVIDUAL', cuenta));
    componentes.push(componente('APORTE_EMPLEADOR_AUTOMATICO', 'Cotización con Rentabilidad Protegida', baseAfp.mul(tasa(crp)), 'REFORMA_CRP', crp));
    componentes.push(componente('APORTE_EMPLEADOR_AUTOMATICO', 'Seguro Social Previsional — SIS / CEV', baseAfp.mul(tasa(sisCev)), 'REFORMA_SIS_CEV', sisCev));
  }
  const leyBase = resolver('LEY16744_TASA_BASE', 'FACTOR_DECIMAL');
  const leyAdicional = resolver('LEY16744_TASA_ADICIONAL', 'FACTOR_DECIMAL');
  componentes.push(componente('APORTE_EMPLEADOR_AUTOMATICO', 'Seguro accidentes del trabajo — tasa base', baseLey.mul(tasa(leyBase)), 'LEY16744_BASE', leyBase));
  componentes.push(componente('APORTE_EMPLEADOR_AUTOMATICO', 'Seguro accidentes del trabajo — tasa adicional', baseLey.mul(tasa(leyAdicional)), 'LEY16744_ADICIONAL', leyAdicional));
  const sanna = resolver('SANNA_TASA', 'FACTOR_DECIMAL');
  componentes.push(componente('APORTE_EMPLEADOR_AUTOMATICO', 'Seguro SANNA', baseLey.mul(tasa(sanna)), 'SANNA', sanna));

  const descuentosPrevisionales = componentes.filter(item => item.tipo === 'DEDUCCION_PREVISIONAL').reduce((total, item) => total.add(item.monto), new Prisma.Decimal(0));
  const baseTributable = Prisma.Decimal.max(new Prisma.Decimal(0), entrada.baseImponible.sub(descuentosPrevisionales));
  const tramos = await tx.tramo_impuesto_renta.findMany({ where: { estado: 'activo', vigencia_desde: { lte: entrada.fechaInicio }, OR: [{ vigencia_hasta: null }, { vigencia_hasta: { gte: entrada.fechaFin } }] }, orderBy: { orden: 'asc' } });
  const conjuntos = new Set(tramos.map(item => `${fechaClave(item.vigencia_desde)}|${item.vigencia_hasta ? fechaClave(item.vigencia_hasta) : ''}`));
  const tramo = conjuntos.size === 1 ? tramos.find(item => item.unidad === 'CLP' && baseTributable.gte(item.limite_desde) && (item.limite_hasta === null || baseTributable.lte(item.limite_hasta))) : null;
  if (!tramo) throw new ErrorAplicacion(409, 'No existe una tabla tributaria única y completa para el período', 'CONFIGURACION_TRIBUTARIA_INCOMPLETA');
  const impuesto = redondear(Prisma.Decimal.max(new Prisma.Decimal(0), baseTributable.mul(tramo.factor).sub(tramo.rebaja)));
  componentes.push({ tipo: 'IMPUESTO_RENTA', descripcion: 'Impuesto Único de Segunda Categoría', monto: impuesto, claveNegocio: 'IMPUESTO_UNICO_SEGUNDA_CATEGORIA', referenciaOrigen: `TRAMO:${tramo.id_tramo_impuesto_renta}`, versionOrigen: fechaClave(tramo.vigencia_desde) });

  const aportesEmpleador = componentes.filter(item => item.tipo === 'APORTE_EMPLEADOR_AUTOMATICO').reduce((total, item) => total.add(item.monto), new Prisma.Decimal(0));
  const snapshot = {
    afp: entrada.afp,
    salud: { nombre: entrada.salud.nombre, tipo: entrada.salud.tipo, plan: planSaludSnapshot },
    seguroCesantia: { incluido: entrada.seguroCesantia, fundamentoExclusion: entrada.fundamentoExclusionCesantia, tipoVinculo: tipoVinculo.nombre_tipo_vinculo_laboral },
    baseImponible: entrada.baseImponible.toString(),
    baseTributable: baseTributable.toString(),
    basesConTope: { afp: baseAfp.toString(), salud: baseSalud.toString(), cesantia: baseCesantia.toString(), ley16744: baseLey.toString() },
    parametros: [...usados.values()].map(parametro => ({ id: parametro.id_parametro_remuneracional, codigo: parametro.codigo, valor: parametro.valor!.toString(), unidad: parametro.unidad, vigenciaDesde: fechaClave(parametro.vigencia_desde), vigenciaHasta: parametro.vigencia_hasta ? fechaClave(parametro.vigencia_hasta) : null })),
    impuesto: { tramoId: tramo.id_tramo_impuesto_renta, factor: tramo.factor.toString(), rebaja: tramo.rebaja.toString(), limiteDesde: tramo.limite_desde.toString(), limiteHasta: tramo.limite_hasta?.toString() ?? null, vigenciaDesde: fechaClave(tramo.vigencia_desde), vigenciaHasta: tramo.vigencia_hasta ? fechaClave(tramo.vigencia_hasta) : null },
  };
  return { componentes, baseImponible: entrada.baseImponible, baseTributable, descuentosPrevisionales, impuesto, aportesEmpleador, snapshot };
}
