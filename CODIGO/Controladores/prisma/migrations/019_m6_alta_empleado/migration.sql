ALTER TABLE "finanzas"."empleado"
  ALTER COLUMN "id_cargo" DROP NOT NULL,
  ALTER COLUMN "id_tipo_vinculo_laboral" DROP NOT NULL,
  ALTER COLUMN "fecha_ingreso" DROP NOT NULL,
  ALTER COLUMN "sueldo_base" DROP NOT NULL;
