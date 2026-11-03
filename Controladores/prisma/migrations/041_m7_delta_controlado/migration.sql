ALTER TABLE "finanzas"."orden_compra_servicio_m5"
  ADD COLUMN "id_ficha_cliente_contexto" INTEGER,
  ADD COLUMN "id_cotizacion_contexto" INTEGER,
  ADD COLUMN "id_proyecto_financiero_contexto" INTEGER,
  ADD COLUMN "id_orden_trabajo_contexto" BIGINT,
  ADD COLUMN "fecha_esperada_recepcion" DATE;

ALTER TABLE "finanzas"."orden_compra_servicio_m5"
  ADD CONSTRAINT "fk_ocs_m5_ficha_contexto" FOREIGN KEY ("id_ficha_cliente_contexto") REFERENCES "finanzas"."ficha_cliente"("id_ficha_cliente") ON DELETE RESTRICT,
  ADD CONSTRAINT "fk_ocs_m5_cotizacion_contexto" FOREIGN KEY ("id_cotizacion_contexto") REFERENCES "finanzas"."cotizacion"("id_cotizacion") ON DELETE RESTRICT,
  ADD CONSTRAINT "fk_ocs_m5_proyecto_contexto" FOREIGN KEY ("id_proyecto_financiero_contexto") REFERENCES "finanzas"."proyecto_financiero"("id_proyecto_financiero") ON DELETE RESTRICT,
  ADD CONSTRAINT "fk_ocs_m5_ot_contexto" FOREIGN KEY ("id_orden_trabajo_contexto") REFERENCES "inventario"."orden_trabajo"("orden_trabajo_id_orden") ON DELETE RESTRICT;

CREATE INDEX "idx_ocs_m5_contexto" ON "finanzas"."orden_compra_servicio_m5" ("id_proyecto_financiero_contexto", "id_orden_trabajo_contexto");

CREATE TABLE "finanzas"."detalle_material_orden_compra_m5" (
  "id_detalle_material_oc_m5" SERIAL PRIMARY KEY,
  "id_ocs_m5" INTEGER NOT NULL,
  "material_sku" VARCHAR(16) NOT NULL,
  "cantidad_pedida" DECIMAL(12,4) NOT NULL,
  "cantidad_recibida" DECIMAL(12,4) NOT NULL DEFAULT 0,
  "fecha_esperada" DATE,
  CONSTRAINT "chk_detalle_material_oc_m5_cantidades" CHECK ("cantidad_pedida" > 0 AND "cantidad_recibida" >= 0 AND "cantidad_recibida" <= "cantidad_pedida"),
  CONSTRAINT "fk_detalle_material_oc_m5_ocs" FOREIGN KEY ("id_ocs_m5") REFERENCES "finanzas"."orden_compra_servicio_m5"("id_orden_compra_servicio_m5") ON DELETE RESTRICT,
  CONSTRAINT "fk_detalle_material_oc_m5_material" FOREIGN KEY ("material_sku") REFERENCES "inventario"."material"("material_sku") ON DELETE RESTRICT,
  CONSTRAINT "uq_detalle_material_oc_m5" UNIQUE ("id_ocs_m5", "material_sku")
);

CREATE INDEX "idx_detalle_material_oc_m5_material_fecha" ON "finanzas"."detalle_material_orden_compra_m5" ("material_sku", "fecha_esperada");

ALTER TABLE "terreno"."obra" ADD COLUMN "obra_ciudad" TEXT;
