ALTER TABLE "finanzas"."solicitud_crediticia_m8"
  ADD COLUMN "motivo_solicitud" TEXT,
  ADD COLUMN "condiciones_solicitadas" TEXT;

CREATE TABLE "finanzas"."condicion_crediticia_m8" (
  "id_condicion_crediticia" SERIAL PRIMARY KEY,
  "id_ficha_cliente" INTEGER NOT NULL UNIQUE,
  "credito_habilitado" BOOLEAN NOT NULL DEFAULT FALSE,
  "monto_cupo" DECIMAL(14,2),
  "vigencia_desde" DATE,
  "vigencia_hasta" DATE,
  "suspendido" BOOLEAN NOT NULL DEFAULT FALSE,
  "motivo_suspension" TEXT,
  "fecha_suspension" TIMESTAMP(6),
  "fecha_reactivacion" TIMESTAMP(6),
  "actualizado_en" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chk_condicion_crediticia_m8_cupo" CHECK ("monto_cupo" IS NULL OR "monto_cupo" >= 0),
  CONSTRAINT "chk_condicion_crediticia_m8_vigencia" CHECK ("vigencia_hasta" IS NULL OR "vigencia_desde" IS NULL OR "vigencia_hasta" >= "vigencia_desde"),
  CONSTRAINT "fk_condicion_crediticia_m8_ficha" FOREIGN KEY ("id_ficha_cliente") REFERENCES "finanzas"."ficha_cliente"("id_ficha_cliente") ON DELETE RESTRICT
);

CREATE TABLE "finanzas"."limite_global_credito_m8" (
  "id_limite_global" SERIAL PRIMARY KEY,
  "monto_limite" DECIMAL(14,2) NOT NULL,
  "vigencia_desde" DATE NOT NULL,
  "vigencia_hasta" DATE,
  "motivo" TEXT NOT NULL,
  "id_responsable" BIGINT NOT NULL,
  "creado_en" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chk_limite_global_credito_m8_monto" CHECK ("monto_limite" >= 0),
  CONSTRAINT "chk_limite_global_credito_m8_vigencia" CHECK ("vigencia_hasta" IS NULL OR "vigencia_hasta" >= "vigencia_desde")
);
CREATE INDEX "idx_limite_global_credito_m8_vigencia" ON "finanzas"."limite_global_credito_m8" ("vigencia_desde", "vigencia_hasta");

CREATE TABLE "finanzas"."resolucion_solicitud_crediticia_m8" (
  "id_resolucion" SERIAL PRIMARY KEY,
  "id_solicitud_crediticia" INTEGER NOT NULL UNIQUE,
  "decision" VARCHAR(20) NOT NULL,
  "motivo" TEXT NOT NULL,
  "monto_cupo_aprobado" DECIMAL(14,2),
  "vigencia_desde" DATE,
  "vigencia_hasta" DATE,
  "condiciones_aprobadas" TEXT,
  "id_usuario_responsable" BIGINT NOT NULL,
  "fecha_resolucion" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chk_resolucion_crediticia_m8_decision" CHECK ("decision" IN ('APROBADA','RECHAZADA')),
  CONSTRAINT "chk_resolucion_crediticia_m8_cupo" CHECK ("monto_cupo_aprobado" IS NULL OR "monto_cupo_aprobado" >= 0),
  CONSTRAINT "fk_resolucion_crediticia_m8_solicitud" FOREIGN KEY ("id_solicitud_crediticia") REFERENCES "finanzas"."solicitud_crediticia_m8"("id_solicitud_crediticia") ON DELETE RESTRICT,
  CONSTRAINT "fk_resolucion_crediticia_m8_responsable" FOREIGN KEY ("id_usuario_responsable") REFERENCES "terreno"."usuario"("usuario_id_usuario") ON DELETE RESTRICT
);

CREATE TABLE "finanzas"."compromiso_credito_m8" (
  "id_compromiso" SERIAL PRIMARY KEY,
  "id_ficha_cliente" INTEGER NOT NULL,
  "id_nota_venta" INTEGER NOT NULL UNIQUE,
  "id_solicitud_excepcion" INTEGER,
  "monto_original" DECIMAL(14,2) NOT NULL,
  "monto_pendiente" DECIMAL(14,2) NOT NULL,
  "condiciones" TEXT,
  "estado" VARCHAR(20) NOT NULL DEFAULT 'VIGENTE',
  "fecha_formalizacion" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fecha_liberacion" TIMESTAMP(6),
  CONSTRAINT "chk_compromiso_credito_m8_montos" CHECK ("monto_original" > 0 AND "monto_pendiente" >= 0 AND "monto_pendiente" <= "monto_original"),
  CONSTRAINT "chk_compromiso_credito_m8_estado" CHECK ("estado" IN ('VIGENTE','LIBERADO')),
  CONSTRAINT "fk_compromiso_credito_m8_ficha" FOREIGN KEY ("id_ficha_cliente") REFERENCES "finanzas"."ficha_cliente"("id_ficha_cliente") ON DELETE RESTRICT,
  CONSTRAINT "fk_compromiso_credito_m8_nota" FOREIGN KEY ("id_nota_venta") REFERENCES "finanzas"."nota_venta"("id_nota_venta") ON DELETE RESTRICT,
  CONSTRAINT "fk_compromiso_credito_m8_excepcion" FOREIGN KEY ("id_solicitud_excepcion") REFERENCES "finanzas"."solicitud_crediticia_m8"("id_solicitud_crediticia") ON DELETE RESTRICT
);
CREATE INDEX "idx_compromiso_credito_m8_cliente_estado" ON "finanzas"."compromiso_credito_m8" ("id_ficha_cliente", "estado");

CREATE TABLE "finanzas"."reduccion_compromiso_credito_m8" (
  "id_reduccion" SERIAL PRIMARY KEY,
  "id_compromiso" INTEGER NOT NULL,
  "id_pago_cliente" INTEGER NOT NULL UNIQUE,
  "monto_reduccion" DECIMAL(14,2) NOT NULL,
  "fecha_reduccion" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chk_reduccion_credito_m8_monto" CHECK ("monto_reduccion" > 0),
  CONSTRAINT "fk_reduccion_credito_m8_compromiso" FOREIGN KEY ("id_compromiso") REFERENCES "finanzas"."compromiso_credito_m8"("id_compromiso") ON DELETE RESTRICT,
  CONSTRAINT "fk_reduccion_credito_m8_pago" FOREIGN KEY ("id_pago_cliente") REFERENCES "finanzas"."pago_cliente"("id_pago_cliente") ON DELETE RESTRICT
);
CREATE INDEX "idx_reduccion_credito_m8_compromiso" ON "finanzas"."reduccion_compromiso_credito_m8" ("id_compromiso");

CREATE TABLE "finanzas"."evento_credito_m8" (
  "id_evento" SERIAL PRIMARY KEY,
  "id_ficha_cliente" INTEGER NOT NULL,
  "tipo_evento" VARCHAR(40) NOT NULL,
  "motivo" TEXT,
  "valor_anterior" TEXT,
  "valor_nuevo" TEXT,
  "id_referencia" INTEGER,
  "id_usuario" BIGINT NOT NULL,
  "fecha_evento" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fk_evento_credito_m8_ficha" FOREIGN KEY ("id_ficha_cliente") REFERENCES "finanzas"."ficha_cliente"("id_ficha_cliente") ON DELETE RESTRICT,
  CONSTRAINT "fk_evento_credito_m8_responsable" FOREIGN KEY ("id_usuario") REFERENCES "terreno"."usuario"("usuario_id_usuario") ON DELETE RESTRICT
);
CREATE INDEX "idx_evento_credito_m8_cliente_fecha" ON "finanzas"."evento_credito_m8" ("id_ficha_cliente", "fecha_evento");

INSERT INTO "terreno"."permiso" ("permiso_modulo","permiso_accion","permiso_descripcion","permiso_nombre_del_permiso","codigo_m4","activo_m4","requiere_administrador")
SELECT 'M8', 'ejecutar ' || codigo, descripcion, codigo, codigo, TRUE, FALSE
FROM (VALUES
 ('CU260','Crear y enviar solicitud inicial'),('CU261','Crear y enviar solicitud de excepción'),('CU262','Cancelar solicitud crediticia'),
 ('CU263','Resolver solicitud inicial'),('CU264','Resolver solicitud de excepción'),('CU265','Modificar cupo y vigencia'),
 ('CU266','Suspender Crédito'),('CU267','Reactivar Crédito'),('CU268','Configurar límite global'),
 ('CU269','Consultar exposición global'),('CU270','Consultar situación crediticia'),('CU271','Consultar historial crediticio'),
 ('CU272','Exportar Crédito contextual'),('CU273','Consultar distribución crediticia'),('CU274','Consultar composición del Crédito comprometido')
) AS nuevos(codigo, descripcion)
ON CONFLICT ("codigo_m4") DO UPDATE SET "permiso_modulo"='M8',"permiso_accion"=EXCLUDED."permiso_accion","permiso_descripcion"=EXCLUDED."permiso_descripcion","permiso_nombre_del_permiso"=EXCLUDED."permiso_nombre_del_permiso","activo_m4"=TRUE,"requiere_administrador"=FALSE;

INSERT INTO "terreno"."perfil_permiso" ("perfil_id_perfil","permiso_id_permiso","perfil_permiso_activo")
SELECT perfil."perfil_id_perfil", permiso."permiso_id_permiso", TRUE
FROM "terreno"."perfil" perfil
JOIN "terreno"."permiso" permiso ON permiso."codigo_m4" BETWEEN 'CU260' AND 'CU274'
WHERE (perfil."codigo_m4"='gerencia' AND permiso."codigo_m4" IN ('CU262','CU263','CU264','CU265','CU266','CU267','CU268','CU269','CU270','CU271','CU272','CU273','CU274'))
   OR (perfil."codigo_m4"='secretaria' AND permiso."codigo_m4" IN ('CU260','CU261','CU262','CU270','CU272'))
   OR (perfil."codigo_m4"='contador' AND permiso."codigo_m4" IN ('CU270','CU272'))
ON CONFLICT ("perfil_id_perfil","permiso_id_permiso") DO UPDATE SET "perfil_permiso_activo"=TRUE;
