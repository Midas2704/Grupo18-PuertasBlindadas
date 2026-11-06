ALTER TABLE "finanzas"."empleado"
  ADD COLUMN "fecha_aplicacion_sueldo_base" DATE,
  ADD COLUMN "correo_particular" VARCHAR(254),
  ADD COLUMN "telefono_particular" VARCHAR(30),
  ADD COLUMN "direccion_particular" TEXT,
  ADD COLUMN "tipo_correo" VARCHAR(30),
  ADD COLUMN "consentimiento_electronico" BOOLEAN,
  ADD COLUMN "canal_documental" VARCHAR(30);
