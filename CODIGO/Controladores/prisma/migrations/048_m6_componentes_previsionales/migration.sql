-- Las tasas informadas para 2026 no deben proyectarse sobre períodos futuros.
UPDATE "finanzas"."parametro_remuneracional"
SET "vigencia_hasta" = DATE '2026-12-31'
WHERE "fuente" = 'Configuración legal M6'
  AND "vigencia_desde" <= DATE '2026-12-31'
  AND "vigencia_hasta" IS NULL;

ALTER TABLE "finanzas"."componente_remuneracion"
  DROP CONSTRAINT "ck_componente_remuneracion_tipo";

ALTER TABLE "finanzas"."componente_remuneracion"
  ADD CONSTRAINT "ck_componente_remuneracion_tipo" CHECK (
    "tipo" IN (
      'EXCEPCIONAL_POSITIVO',
      'VARIABLE_ADMINISTRATIVA',
      'VARIABLE_COMERCIAL',
      'VALOR_EXTERNO',
      'AJUSTE_MANUAL',
      'PRORRATEO',
      'SUELDO_BASE',
      'HABER_AUTOMATICO',
      'HECHO_TERRENO',
      'DEDUCCION_AUTOMATICA',
      'DEDUCCION_PREVISIONAL',
      'APORTE_EMPLEADOR_AUTOMATICO',
      'IMPUESTO_RENTA'
    )
  );
