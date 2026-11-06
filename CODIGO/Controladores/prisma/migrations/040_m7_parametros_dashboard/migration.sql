ALTER TABLE "finanzas"."parametro_remuneracional"
  DROP CONSTRAINT "chk_parametro_remuneracional_tipo";

ALTER TABLE "finanzas"."parametro_remuneracional"
  ADD CONSTRAINT "chk_parametro_remuneracional_tipo"
  CHECK ("tipo" IN ('LEGAL', 'PREVISIONAL', 'TRIBUTARIO', 'PRORRATEO', 'DASHBOARD'));
