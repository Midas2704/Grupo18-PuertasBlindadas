ALTER TABLE "finanzas"."concepto_remuneracion"
  DROP CONSTRAINT "chk_concepto_remuneracion_naturaleza";

ALTER TABLE "finanzas"."concepto_remuneracion"
  ADD CONSTRAINT "chk_concepto_remuneracion_naturaleza"
  CHECK ("naturaleza_concepto" IN ('haber', 'descuento', 'bono', 'retencion', 'otro', 'aporte_empleador'));
