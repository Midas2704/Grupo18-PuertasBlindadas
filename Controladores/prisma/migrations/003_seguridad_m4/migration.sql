BEGIN;
-- AlterTable
ALTER TABLE "terreno"."perfil" ADD COLUMN     "activo_m4" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "admite_particulares" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "codigo_m4" TEXT;

-- AlterTable
ALTER TABLE "terreno"."permiso" ADD COLUMN     "activo_m4" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "codigo_m4" TEXT,
ADD COLUMN     "requiere_administrador" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "terreno"."usuario" ADD COLUMN     "acceso_m4" TEXT,
ADD COLUMN     "administrador_original" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "configuracion_particular" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "empleado_m4" VARCHAR(15),
ADD COLUMN     "version_seguridad" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "terreno"."usuario_contrasena" ADD COLUMN     "activa" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "creada" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "invalidada" TIMESTAMPTZ(6),
ADD COLUMN     "temporal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vence" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "terreno"."usuario_permiso_particular" (
    "id_usuario" BIGINT NOT NULL,
    "id_permiso" BIGINT NOT NULL,

    CONSTRAINT "usuario_permiso_particular_pkey" PRIMARY KEY ("id_usuario","id_permiso")
);

-- CreateTable
CREATE TABLE "terreno"."permiso_dependencia" (
    "id_permiso" BIGINT NOT NULL,
    "id_requerido" BIGINT NOT NULL,

    CONSTRAINT "permiso_dependencia_pkey" PRIMARY KEY ("id_permiso","id_requerido")
);

-- CreateTable
CREATE TABLE "terreno"."estado_seguridad_usuario" (
    "id_usuario" BIGINT NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "bloqueos" INTEGER NOT NULL DEFAULT 0,
    "bloqueo_hasta" TIMESTAMPTZ(6),
    "bloqueo_persistente" BOOLEAN NOT NULL DEFAULT false,
    "actualizado" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responsable" TEXT,

    CONSTRAINT "estado_seguridad_usuario_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "terreno"."sesion_usuario" (
    "id" TEXT NOT NULL,
    "id_usuario" BIGINT NOT NULL,
    "secreto_hash" TEXT NOT NULL,
    "inicio" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vence" TIMESTAMPTZ(6) NOT NULL,
    "invalidada" TIMESTAMPTZ(6),
    "motivo" TEXT,
    "direccion" TEXT,
    "agente" TEXT,
    "version_seguridad" INTEGER NOT NULL,

    CONSTRAINT "sesion_usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terreno"."token_recuperacion" (
    "id" TEXT NOT NULL,
    "id_usuario" BIGINT NOT NULL,
    "secreto_hash" TEXT NOT NULL,
    "creado" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vence" TIMESTAMPTZ(6) NOT NULL,
    "utilizado" TIMESTAMPTZ(6),

    CONSTRAINT "token_recuperacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sesion_usuario_secreto_hash_key" ON "terreno"."sesion_usuario"("secreto_hash");

-- CreateIndex
CREATE INDEX "sesion_usuario_id_usuario_idx" ON "terreno"."sesion_usuario"("id_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "token_recuperacion_secreto_hash_key" ON "terreno"."token_recuperacion"("secreto_hash");

-- CreateIndex
CREATE INDEX "token_recuperacion_id_usuario_idx" ON "terreno"."token_recuperacion"("id_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "perfil_codigo_m4_key" ON "terreno"."perfil"("codigo_m4");

-- CreateIndex
CREATE UNIQUE INDEX "permiso_codigo_m4_key" ON "terreno"."permiso"("codigo_m4");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_acceso_m4_key" ON "terreno"."usuario"("acceso_m4");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_empleado_m4_key" ON "terreno"."usuario"("empleado_m4");

-- AddForeignKey
ALTER TABLE "terreno"."usuario" ADD CONSTRAINT "usuario_empleado_m4_fkey" FOREIGN KEY ("empleado_m4") REFERENCES "finanzas"."empleado"("rut_empleado") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terreno"."usuario_permiso_particular" ADD CONSTRAINT "usuario_permiso_particular_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "terreno"."usuario"("usuario_id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terreno"."usuario_permiso_particular" ADD CONSTRAINT "usuario_permiso_particular_id_permiso_fkey" FOREIGN KEY ("id_permiso") REFERENCES "terreno"."permiso"("permiso_id_permiso") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terreno"."permiso_dependencia" ADD CONSTRAINT "permiso_dependencia_id_permiso_fkey" FOREIGN KEY ("id_permiso") REFERENCES "terreno"."permiso"("permiso_id_permiso") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terreno"."permiso_dependencia" ADD CONSTRAINT "permiso_dependencia_id_requerido_fkey" FOREIGN KEY ("id_requerido") REFERENCES "terreno"."permiso"("permiso_id_permiso") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terreno"."estado_seguridad_usuario" ADD CONSTRAINT "estado_seguridad_usuario_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "terreno"."usuario"("usuario_id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terreno"."sesion_usuario" ADD CONSTRAINT "sesion_usuario_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "terreno"."usuario"("usuario_id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terreno"."token_recuperacion" ADD CONSTRAINT "token_recuperacion_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "terreno"."usuario"("usuario_id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX sesion_unica_vigente ON terreno.sesion_usuario(id_usuario) WHERE invalidada IS NULL;
CREATE UNIQUE INDEX credencial_unica_vigente ON terreno.usuario_contrasena(usuario_id_usuario) WHERE activa;
ALTER TABLE terreno.permiso_dependencia ADD CONSTRAINT permiso_no_depende_de_si_mismo CHECK (id_permiso <> id_requerido);
DO $$
DECLARE nombre text; secuencia text; maximo bigint; ultimo bigint;
BEGIN
 FOR nombre IN SELECT unnest(ARRAY['usuario','perfil','permiso']) LOOP
  secuencia := pg_get_serial_sequence('terreno.' || nombre, nombre || '_id_' || nombre);
  EXECUTE format('SELECT COALESCE(MAX(%I),0) FROM terreno.%I',nombre || '_id_' || nombre,nombre) INTO maximo;
  EXECUTE format('SELECT last_value FROM %s',secuencia) INTO ultimo;
  IF maximo > 0 THEN PERFORM setval(secuencia::regclass,GREATEST(maximo,ultimo),true); END IF;
 END LOOP;
END $$;
COMMIT;
