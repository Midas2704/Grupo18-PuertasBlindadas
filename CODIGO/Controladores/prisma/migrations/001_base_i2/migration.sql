BEGIN;
SET LOCAL search_path = finanzas, public;
-- DropForeignKey
ALTER TABLE "cliente_financiero" DROP CONSTRAINT "fk_cli_fin_cliente_ext";

-- DropForeignKey
ALTER TABLE "conciliacion" DROP CONSTRAINT "fk_conciliacion_movimiento_bancario";

-- DropForeignKey
ALTER TABLE "conciliacion" DROP CONSTRAINT "fk_conciliacion_movimiento_financiero";

-- DropForeignKey
ALTER TABLE "documento_tributario" DROP CONSTRAINT "fk_documento_tributario_nota_venta";

-- AlterTable
ALTER TABLE "asignacion_pago_cliente" ALTER COLUMN "id_nota_venta" SET NOT NULL;

-- AlterTable
ALTER TABLE "cliente_financiero" ADD COLUMN     "nivel_formalizacion" VARCHAR(20) NOT NULL DEFAULT 'formal',
ADD COLUMN     "referencia_demostracion" VARCHAR(80),
ALTER COLUMN "rut_cliente" DROP NOT NULL;

-- AlterTable
ALTER TABLE "conciliacion" ADD COLUMN     "evidencia" TEXT,
ADD COLUMN     "id_pago_cliente" INTEGER,
ALTER COLUMN "id_movimiento_financiero" DROP NOT NULL,
ALTER COLUMN "id_movimiento_bancario" DROP NOT NULL;

-- AlterTable
ALTER TABLE "cotizacion" ADD COLUMN     "descuento_tipo" VARCHAR(20),
ADD COLUMN     "descuento_valor" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "exento_iva" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "monto_impuesto" DECIMAL(14,2),
ADD COLUMN     "monto_neto" DECIMAL(14,2),
ADD COLUMN     "referencia_demostracion" VARCHAR(80);

-- AlterTable
ALTER TABLE "documento_tributario" ALTER COLUMN "id_nota_venta" DROP NOT NULL;

-- AlterTable
ALTER TABLE "nota_venta" ADD COLUMN     "exento_iva" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "id_proyecto_contexto" BIGINT;

-- AlterTable
ALTER TABLE "pago_cliente" ADD COLUMN     "antecedentes_medio" JSONB,
ADD COLUMN     "cantidad_cuotas" INTEGER,
ADD COLUMN     "estado_conciliacion" VARCHAR(20) NOT NULL DEFAULT 'pendiente',
ADD COLUMN     "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "id_categoria_pago" INTEGER,
ADD COLUMN     "referencia_demostracion" VARCHAR(80);

-- CreateTable
CREATE TABLE "cotizacion_version" (
    "id_cotizacion_version" SERIAL NOT NULL,
    "id_cotizacion" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "antecedentes" JSONB NOT NULL,
    "motivo" TEXT NOT NULL,

    CONSTRAINT "cotizacion_version_pkey" PRIMARY KEY ("id_cotizacion_version")
);

-- CreateTable
CREATE TABLE "orden_compra_b2b" (
    "id_orden_compra_b2b" SERIAL NOT NULL,
    "id_cotizacion" INTEGER NOT NULL,
    "folio" TEXT NOT NULL,
    "respaldo" TEXT NOT NULL,
    "fecha" DATE NOT NULL,

    CONSTRAINT "orden_compra_b2b_pkey" PRIMARY KEY ("id_orden_compra_b2b")
);

-- CreateTable
CREATE TABLE "guia_despacho" (
    "id_guia_despacho" SERIAL NOT NULL,
    "id_nota_venta" INTEGER NOT NULL,
    "folio" TEXT NOT NULL,
    "fecha_emision" DATE NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'emitida',
    "antecedentes" JSONB,

    CONSTRAINT "guia_despacho_pkey" PRIMARY KEY ("id_guia_despacho")
);

-- CreateTable
CREATE TABLE "condicion_cobro_nv" (
    "id_condicion_cobro_nv" SERIAL NOT NULL,
    "id_nota_venta" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "monto_referencia" DECIMAL(14,2),
    "porcentaje_referencia" DECIMAL(5,2),
    "evento_referencia" TEXT,

    CONSTRAINT "condicion_cobro_nv_pkey" PRIMARY KEY ("id_condicion_cobro_nv")
);

-- CreateTable
CREATE TABLE "documento_tributario_nota_venta" (
    "id_documento_tributario" INTEGER NOT NULL,
    "id_nota_venta" INTEGER NOT NULL,

    CONSTRAINT "documento_tributario_nota_venta_pkey" PRIMARY KEY ("id_documento_tributario","id_nota_venta")
);

-- CreateTable
CREATE TABLE "reversion_nota_venta" (
    "id_reversion_nota_venta" SERIAL NOT NULL,
    "id_nota_venta" INTEGER NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivo" TEXT NOT NULL,
    "responsable" TEXT NOT NULL,
    "folio_nota_credito" TEXT NOT NULL,
    "respaldo_pdf" TEXT NOT NULL,

    CONSTRAINT "reversion_nota_venta_pkey" PRIMARY KEY ("id_reversion_nota_venta")
);

-- CreateTable
CREATE TABLE "anulacion_pago" (
    "id_anulacion_pago" SERIAL NOT NULL,
    "id_pago_cliente" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivo" TEXT NOT NULL,
    "responsable" TEXT NOT NULL,
    "respaldo" TEXT NOT NULL,

    CONSTRAINT "anulacion_pago_pkey" PRIMARY KEY ("id_anulacion_pago")
);

-- CreateTable
CREATE TABLE "reversion_pago" (
    "id_reversion_pago" SERIAL NOT NULL,
    "id_pago_cliente" INTEGER NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivo" TEXT NOT NULL,
    "responsable" TEXT NOT NULL,
    "respaldo" TEXT NOT NULL,

    CONSTRAINT "reversion_pago_pkey" PRIMARY KEY ("id_reversion_pago")
);

-- CreateTable
CREATE TABLE "saldo_favor_cliente" (
    "id_saldo_favor_cliente" SERIAL NOT NULL,
    "id_cliente_financiero" INTEGER NOT NULL,
    "id_nota_venta" INTEGER NOT NULL,
    "id_reversion_nota_venta" INTEGER NOT NULL,
    "monto_original" DECIMAL(14,2) NOT NULL,
    "monto_disponible" DECIMAL(14,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saldo_favor_cliente_pkey" PRIMARY KEY ("id_saldo_favor_cliente")
);

-- CreateTable
CREATE TABLE "aplicacion_saldo_favor" (
    "id_aplicacion_saldo_favor" SERIAL NOT NULL,
    "id_saldo_favor_cliente" INTEGER NOT NULL,
    "id_nota_venta" INTEGER NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responsable" TEXT NOT NULL,

    CONSTRAINT "aplicacion_saldo_favor_pkey" PRIMARY KEY ("id_aplicacion_saldo_favor")
);

-- CreateTable
CREATE TABLE "categoria_pago" (
    "id_categoria_pago" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categoria_pago_pkey" PRIMARY KEY ("id_categoria_pago")
);

-- CreateTable
CREATE TABLE "config_cuotas_tarjeta" (
    "cantidad" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "config_cuotas_tarjeta_pkey" PRIMARY KEY ("cantidad")
);

-- CreateTable
CREATE TABLE "config_umbral_por_vencer" (
    "id_configuracion" SERIAL NOT NULL,
    "dias_habiles" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "config_umbral_por_vencer_pkey" PRIMARY KEY ("id_configuracion")
);

-- CreateIndex
CREATE UNIQUE INDEX "orden_compra_b2b_id_cotizacion_key" ON "orden_compra_b2b"("id_cotizacion");

-- CreateIndex
CREATE UNIQUE INDEX "guia_despacho_folio_key" ON "guia_despacho"("folio");

-- CreateIndex
CREATE UNIQUE INDEX "reversion_nota_venta_folio_nota_credito_key" ON "reversion_nota_venta"("folio_nota_credito");

-- CreateIndex
CREATE UNIQUE INDEX "anulacion_pago_id_pago_cliente_key" ON "anulacion_pago"("id_pago_cliente");

-- CreateIndex
CREATE UNIQUE INDEX "categoria_pago_nombre_key" ON "categoria_pago"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "asignacion_pago_cliente_id_pago_cliente_key" ON "asignacion_pago_cliente"("id_pago_cliente");

-- CreateIndex
CREATE UNIQUE INDEX "cliente_financiero_referencia_demostracion_key" ON "cliente_financiero"("referencia_demostracion");

-- CreateIndex
CREATE UNIQUE INDEX "cotizacion_referencia_demostracion_key" ON "cotizacion"("referencia_demostracion");

-- CreateIndex
CREATE UNIQUE INDEX "nota_venta_id_cotizacion_key" ON "nota_venta"("id_cotizacion");

-- CreateIndex
CREATE UNIQUE INDEX "pago_cliente_referencia_demostracion_key" ON "pago_cliente"("referencia_demostracion");

-- AddForeignKey
ALTER TABLE "cliente_financiero" ADD CONSTRAINT "fk_cli_fin_cliente_ext" FOREIGN KEY ("rut_cliente") REFERENCES "terreno"."cliente"("cliente_cliente_rut") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "conciliacion" ADD CONSTRAINT "conciliacion_id_pago_cliente_fkey" FOREIGN KEY ("id_pago_cliente") REFERENCES "pago_cliente"("id_pago_cliente") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conciliacion" ADD CONSTRAINT "fk_conciliacion_movimiento_bancario" FOREIGN KEY ("id_movimiento_bancario") REFERENCES "movimiento_bancario"("id_movimiento_bancario") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "conciliacion" ADD CONSTRAINT "fk_conciliacion_movimiento_financiero" FOREIGN KEY ("id_movimiento_financiero") REFERENCES "movimiento_financiero"("id_movimiento_financiero") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "documento_tributario" ADD CONSTRAINT "fk_documento_tributario_nota_venta" FOREIGN KEY ("id_nota_venta") REFERENCES "nota_venta"("id_nota_venta") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nota_venta" ADD CONSTRAINT "nota_venta_id_proyecto_contexto_fkey" FOREIGN KEY ("id_proyecto_contexto") REFERENCES "terreno"."proyecto"("proyecto_proyecto_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago_cliente" ADD CONSTRAINT "pago_cliente_id_categoria_pago_fkey" FOREIGN KEY ("id_categoria_pago") REFERENCES "categoria_pago"("id_categoria_pago") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizacion_version" ADD CONSTRAINT "cotizacion_version_id_cotizacion_fkey" FOREIGN KEY ("id_cotizacion") REFERENCES "cotizacion"("id_cotizacion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_compra_b2b" ADD CONSTRAINT "orden_compra_b2b_id_cotizacion_fkey" FOREIGN KEY ("id_cotizacion") REFERENCES "cotizacion"("id_cotizacion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guia_despacho" ADD CONSTRAINT "guia_despacho_id_nota_venta_fkey" FOREIGN KEY ("id_nota_venta") REFERENCES "nota_venta"("id_nota_venta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "condicion_cobro_nv" ADD CONSTRAINT "condicion_cobro_nv_id_nota_venta_fkey" FOREIGN KEY ("id_nota_venta") REFERENCES "nota_venta"("id_nota_venta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento_tributario_nota_venta" ADD CONSTRAINT "documento_tributario_nota_venta_id_documento_tributario_fkey" FOREIGN KEY ("id_documento_tributario") REFERENCES "documento_tributario"("id_documento_tributario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento_tributario_nota_venta" ADD CONSTRAINT "documento_tributario_nota_venta_id_nota_venta_fkey" FOREIGN KEY ("id_nota_venta") REFERENCES "nota_venta"("id_nota_venta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reversion_nota_venta" ADD CONSTRAINT "reversion_nota_venta_id_nota_venta_fkey" FOREIGN KEY ("id_nota_venta") REFERENCES "nota_venta"("id_nota_venta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anulacion_pago" ADD CONSTRAINT "anulacion_pago_id_pago_cliente_fkey" FOREIGN KEY ("id_pago_cliente") REFERENCES "pago_cliente"("id_pago_cliente") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reversion_pago" ADD CONSTRAINT "reversion_pago_id_pago_cliente_fkey" FOREIGN KEY ("id_pago_cliente") REFERENCES "pago_cliente"("id_pago_cliente") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saldo_favor_cliente" ADD CONSTRAINT "saldo_favor_cliente_id_cliente_financiero_fkey" FOREIGN KEY ("id_cliente_financiero") REFERENCES "cliente_financiero"("id_cliente_financiero") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saldo_favor_cliente" ADD CONSTRAINT "saldo_favor_cliente_id_nota_venta_fkey" FOREIGN KEY ("id_nota_venta") REFERENCES "nota_venta"("id_nota_venta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saldo_favor_cliente" ADD CONSTRAINT "saldo_favor_cliente_id_reversion_nota_venta_fkey" FOREIGN KEY ("id_reversion_nota_venta") REFERENCES "reversion_nota_venta"("id_reversion_nota_venta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aplicacion_saldo_favor" ADD CONSTRAINT "aplicacion_saldo_favor_id_saldo_favor_cliente_fkey" FOREIGN KEY ("id_saldo_favor_cliente") REFERENCES "saldo_favor_cliente"("id_saldo_favor_cliente") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aplicacion_saldo_favor" ADD CONSTRAINT "aplicacion_saldo_favor_id_nota_venta_fkey" FOREIGN KEY ("id_nota_venta") REFERENCES "nota_venta"("id_nota_venta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Restricciones I2 y compatibilidad de estados históricos.
ALTER TABLE cotizacion DROP CONSTRAINT chk_cotizacion_estado;
ALTER TABLE cotizacion ADD CONSTRAINT chk_cotizacion_estado CHECK (estado_cotizacion IN ('borrador','emitida','aprobada','rechazada','vencida','anulada','descartada'));
ALTER TABLE nota_venta DROP CONSTRAINT chk_nota_venta_estado;
ALTER TABLE nota_venta ADD CONSTRAINT chk_nota_venta_estado CHECK (estado_nota_venta IN ('emitida','confirmada','anulada','cerrada','provisional','revertida_parcial','revertida_total'));
ALTER TABLE cliente_financiero ADD CONSTRAINT chk_formalizacion_i2 CHECK (nivel_formalizacion IN ('formal','provisional') AND (nivel_formalizacion <> 'formal' OR rut_cliente IS NOT NULL));
ALTER TABLE reversion_nota_venta ADD CONSTRAINT chk_reversion_nv_monto CHECK (monto > 0);
ALTER TABLE reversion_pago ADD CONSTRAINT chk_reversion_pago_monto CHECK (monto > 0);
ALTER TABLE saldo_favor_cliente ADD CONSTRAINT chk_saldo_favor_montos CHECK (monto_original > 0 AND monto_disponible >= 0 AND monto_disponible <= monto_original);
ALTER TABLE aplicacion_saldo_favor ADD CONSTRAINT chk_aplicacion_monto CHECK (monto > 0);
ALTER TABLE config_cuotas_tarjeta ADD CONSTRAINT chk_cuotas_cantidad CHECK (cantidad >= 1);
ALTER TABLE pago_cliente ADD CONSTRAINT chk_pago_cuotas CHECK (cantidad_cuotas IS NULL OR cantidad_cuotas >= 1);
ALTER TABLE config_umbral_por_vencer ADD CONSTRAINT chk_umbral_dias CHECK (dias_habiles >= 0);
-- Preservar asociaciones documentales antiguas en la nueva relación M:N.
INSERT INTO documento_tributario_nota_venta (id_documento_tributario,id_nota_venta)
SELECT id_documento_tributario,id_nota_venta FROM documento_tributario WHERE id_nota_venta IS NOT NULL;
-- No inventar impuestos/descuentos históricos de cotizaciones a partir de texto libre.
-- El tratamiento conocido de NV puede conservarse a partir del impuesto registrado.
UPDATE nota_venta SET exento_iva = (monto_impuesto = 0);
COMMIT;
