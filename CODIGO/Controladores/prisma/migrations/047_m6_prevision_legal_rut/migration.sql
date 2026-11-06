ALTER TABLE "finanzas"."empleado"
  ADD COLUMN "seguro_cesantia_fundamento_exclusion" TEXT;

ALTER TABLE "finanzas"."remuneracion"
  ADD COLUMN "total_descuentos_previsionales" DECIMAL(14,4),
  ADD COLUMN "total_impuesto" DECIMAL(14,4),
  ADD COLUMN "total_otras_deducciones" DECIMAL(14,4),
  ADD COLUMN "costo_empresa" DECIMAL(14,4);

CREATE TABLE "finanzas"."cotizacion_salud_empleado" (
  "id_cotizacion_salud" SERIAL NOT NULL,
  "id_empleado" INTEGER NOT NULL,
  "valor" DECIMAL(14,6) NOT NULL,
  "unidad" VARCHAR(20) NOT NULL,
  "vigencia_desde" DATE NOT NULL,
  "vigencia_hasta" DATE,
  "activa" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "cotizacion_salud_empleado_pkey" PRIMARY KEY ("id_cotizacion_salud"),
  CONSTRAINT "chk_cotizacion_salud_empleado_unidad" CHECK ("unidad" IN ('PORCENTAJE', 'UF', 'CLP')),
  CONSTRAINT "chk_cotizacion_salud_empleado_valor" CHECK ("valor" >= 0),
  CONSTRAINT "chk_cotizacion_salud_empleado_vigencia" CHECK ("vigencia_hasta" IS NULL OR "vigencia_hasta" >= "vigencia_desde"),
  CONSTRAINT "fk_cotizacion_salud_empleado" FOREIGN KEY ("id_empleado") REFERENCES "finanzas"."empleado"("id_empleado") ON DELETE RESTRICT ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX "uq_cotizacion_salud_empleado_vigencia"
  ON "finanzas"."cotizacion_salud_empleado"("id_empleado", "vigencia_desde");

CREATE INDEX "idx_cotizacion_salud_empleado_resolucion"
  ON "finanzas"."cotizacion_salud_empleado"("id_empleado", "vigencia_desde", "vigencia_hasta");

INSERT INTO "finanzas"."parametro_remuneracional"
  ("codigo", "tipo", "nombre", "descripcion", "valor", "unidad", "vigencia_desde", "vigencia_hasta", "fuente", "referencia", "estado")
VALUES
  ('AFP_COTIZACION_OBLIGATORIA', 'PREVISIONAL', 'Cotización obligatoria AFP', 'Deducción del trabajador sobre base imponible afecta', 0.10, 'FACTOR_DECIMAL', DATE '2026-02-01', NULL, 'Configuración legal M6', 'Definición funcional aprobada', 'activo'),
  ('AFP_COMISION_CAPITAL', 'PREVISIONAL', 'Comisión AFP Capital', 'Comisión vigente de AFP', 0.0144, 'FACTOR_DECIMAL', DATE '2026-10-01', NULL, 'Configuración legal M6', 'Definición funcional aprobada', 'activo'),
  ('AFP_COMISION_CUPRUM', 'PREVISIONAL', 'Comisión AFP Cuprum', 'Comisión vigente de AFP', 0.0144, 'FACTOR_DECIMAL', DATE '2026-10-01', NULL, 'Configuración legal M6', 'Definición funcional aprobada', 'activo'),
  ('AFP_COMISION_HABITAT', 'PREVISIONAL', 'Comisión AFP Habitat', 'Comisión vigente de AFP', 0.0127, 'FACTOR_DECIMAL', DATE '2026-10-01', NULL, 'Configuración legal M6', 'Definición funcional aprobada', 'activo'),
  ('AFP_COMISION_MODELO', 'PREVISIONAL', 'Comisión AFP Modelo', 'Comisión vigente de AFP', 0.0058, 'FACTOR_DECIMAL', DATE '2026-10-01', NULL, 'Configuración legal M6', 'Definición funcional aprobada', 'activo'),
  ('AFP_COMISION_PLANVITAL', 'PREVISIONAL', 'Comisión AFP PlanVital', 'Comisión vigente de AFP', 0.0116, 'FACTOR_DECIMAL', DATE '2026-10-01', NULL, 'Configuración legal M6', 'Definición funcional aprobada', 'activo'),
  ('AFP_COMISION_PROVIDA', 'PREVISIONAL', 'Comisión AFP Provida', 'Comisión vigente de AFP', 0.0145, 'FACTOR_DECIMAL', DATE '2026-10-01', NULL, 'Configuración legal M6', 'Definición funcional aprobada', 'activo'),
  ('AFP_COMISION_UNO', 'PREVISIONAL', 'Comisión AFP Uno', 'Comisión vigente de AFP', 0.0046, 'FACTOR_DECIMAL', DATE '2026-10-01', NULL, 'Configuración legal M6', 'Definición funcional aprobada', 'activo'),
  ('SALUD_TASA_LEGAL', 'PREVISIONAL', 'Cotización legal de salud', 'Deducción legal base del trabajador', 0.07, 'FACTOR_DECIMAL', DATE '2026-02-01', NULL, 'Configuración legal M6', 'Definición funcional aprobada', 'activo'),
  ('TOPE_AFP_UF', 'PREVISIONAL', 'Tope imponible AFP', 'Tope mensual expresado en UF', 90.0, 'UF', DATE '2026-02-01', DATE '2026-12-31', 'Configuración legal M6', 'Definición funcional aprobada', 'activo'),
  ('TOPE_SALUD_UF', 'PREVISIONAL', 'Tope imponible salud', 'Tope mensual expresado en UF', 90.0, 'UF', DATE '2026-02-01', DATE '2026-12-31', 'Configuración legal M6', 'Definición funcional aprobada', 'activo'),
  ('TOPE_LEY16744_UF', 'PREVISIONAL', 'Tope imponible Ley 16.744', 'Tope mensual expresado en UF', 90.0, 'UF', DATE '2026-02-01', DATE '2026-12-31', 'Configuración legal M6', 'Definición funcional aprobada', 'activo'),
  ('TOPE_CESANTIA_UF', 'PREVISIONAL', 'Tope imponible Seguro de Cesantía', 'Tope mensual expresado en UF', 135.2, 'UF', DATE '2026-02-01', DATE '2026-12-31', 'Configuración legal M6', 'Definición funcional aprobada', 'activo'),
  ('CESANTIA_TRABAJADOR_INDEFINIDO', 'PREVISIONAL', 'Seguro de Cesantía trabajador indefinido', 'Deducción del trabajador con contrato indefinido', 0.006, 'FACTOR_DECIMAL', DATE '2026-02-01', NULL, 'Configuración legal M6', 'Definición funcional aprobada', 'activo'),
  ('CESANTIA_EMPLEADOR_INDEFINIDO', 'PREVISIONAL', 'Seguro de Cesantía empleador indefinido', 'Aporte del empleador con contrato indefinido', 0.024, 'FACTOR_DECIMAL', DATE '2026-02-01', NULL, 'Configuración legal M6', 'Definición funcional aprobada', 'activo'),
  ('CESANTIA_EMPLEADOR_PLAZO', 'PREVISIONAL', 'Seguro de Cesantía empleador plazo u obra', 'Aporte del empleador con contrato a plazo, obra o faena', 0.03, 'FACTOR_DECIMAL', DATE '2026-02-01', NULL, 'Configuración legal M6', 'Definición funcional aprobada', 'activo'),
  ('REFORMA_CUENTA_INDIVIDUAL', 'PREVISIONAL', 'Cuenta individual — aporte empleador', 'Componente del aporte previsional del empleador', 0.001, 'FACTOR_DECIMAL', DATE '2026-08-01', NULL, 'Configuración legal M6', 'Definición funcional aprobada', 'activo'),
  ('REFORMA_CRP', 'PREVISIONAL', 'Cotización con Rentabilidad Protegida', 'Componente del aporte previsional del empleador', 0.009, 'FACTOR_DECIMAL', DATE '2026-08-01', NULL, 'Configuración legal M6', 'Definición funcional aprobada', 'activo'),
  ('REFORMA_SIS_CEV', 'PREVISIONAL', 'Seguro Social Previsional — SIS / CEV', 'Componente del aporte previsional del empleador; incluye SIS', 0.025, 'FACTOR_DECIMAL', DATE '2026-08-01', NULL, 'Configuración legal M6', 'Definición funcional aprobada', 'activo'),
  ('SIS_TASA_INFORMATIVA', 'PREVISIONAL', 'Tasa SIS informativa', 'Parámetro auditado; no se suma al aporte SIS/CEV', 0.0162, 'FACTOR_DECIMAL', DATE '2026-04-01', NULL, 'Configuración legal M6', 'Definición funcional aprobada', 'activo'),
  ('LEY16744_TASA_BASE', 'PREVISIONAL', 'Seguro accidentes del trabajo — tasa base', 'Aporte base del empleador', 0.009, 'FACTOR_DECIMAL', DATE '2026-02-01', NULL, 'Configuración legal M6', 'Definición funcional aprobada', 'activo'),
  ('SANNA_TASA', 'PREVISIONAL', 'Seguro SANNA', 'Aporte del empleador', 0.0003, 'FACTOR_DECIMAL', DATE '2026-02-01', NULL, 'Configuración legal M6', 'Definición funcional aprobada', 'activo')
ON CONFLICT ("codigo", "vigencia_desde") DO NOTHING;

INSERT INTO "finanzas"."tramo_impuesto_renta"
  ("vigencia_desde", "vigencia_hasta", "orden", "limite_desde", "limite_hasta", "factor", "rebaja", "unidad", "fuente", "referencia", "estado")
VALUES
  (DATE '2026-10-01', DATE '2026-10-31', 1, 0, 974038.50, 0, 0, 'CLP', 'Tabla mensual SII', 'Octubre 2026', 'activo'),
  (DATE '2026-10-01', DATE '2026-10-31', 2, 974038.51, 2164530, 0.04, 38961.54, 'CLP', 'Tabla mensual SII', 'Octubre 2026', 'activo'),
  (DATE '2026-10-01', DATE '2026-10-31', 3, 2164530.01, 3607550, 0.08, 125542.74, 'CLP', 'Tabla mensual SII', 'Octubre 2026', 'activo'),
  (DATE '2026-10-01', DATE '2026-10-31', 4, 3607550.01, 5050570, 0.135, 323957.99, 'CLP', 'Tabla mensual SII', 'Octubre 2026', 'activo'),
  (DATE '2026-10-01', DATE '2026-10-31', 5, 5050570.01, 6493590, 0.23, 803762.14, 'CLP', 'Tabla mensual SII', 'Octubre 2026', 'activo'),
  (DATE '2026-10-01', DATE '2026-10-31', 6, 6493590.01, 8658120, 0.304, 1284287.80, 'CLP', 'Tabla mensual SII', 'Octubre 2026', 'activo'),
  (DATE '2026-10-01', DATE '2026-10-31', 7, 8658120.01, 22366810, 0.35, 1682561.32, 'CLP', 'Tabla mensual SII', 'Octubre 2026', 'activo'),
  (DATE '2026-10-01', DATE '2026-10-31', 8, 22366810.01, NULL, 0.40, 2800901.82, 'CLP', 'Tabla mensual SII', 'Octubre 2026', 'activo')
ON CONFLICT ("vigencia_desde", "orden") DO NOTHING;
