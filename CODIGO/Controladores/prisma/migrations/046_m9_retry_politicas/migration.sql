CREATE TABLE "finanzas"."pendiente_evento_m9" (
  "id_pendiente_m9" SERIAL PRIMARY KEY,
  "identidad_logica" VARCHAR(160) NOT NULL UNIQUE,
  "productor" VARCHAR(80) NOT NULL,
  "modulo_origen" VARCHAR(40) NOT NULL,
  "operacion" VARCHAR(100) NOT NULL,
  "fecha_ocurrencia" TIMESTAMPTZ(6) NOT NULL,
  "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "proximo_intento_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resuelto_en" TIMESTAMPTZ(6),
  "estado" VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
  "cantidad_intentos" INTEGER NOT NULL DEFAULT 0,
  "ultimo_error_codigo" VARCHAR(100),
  "ultimo_error_en" TIMESTAMPTZ(6),
  "payload_evento" JSONB NOT NULL,
  CONSTRAINT "chk_m9_pendiente_estado" CHECK ("estado" IN ('PENDIENTE','REINTENTANDO','RESUELTO')),
  CONSTRAINT "chk_m9_pendiente_intentos" CHECK ("cantidad_intentos" >= 0)
);
CREATE INDEX "idx_m9_pendiente_elegible" ON "finanzas"."pendiente_evento_m9" ("estado", "proximo_intento_en");
CREATE INDEX "idx_m9_pendiente_productor" ON "finanzas"."pendiente_evento_m9" ("productor", "estado");

CREATE TABLE "finanzas"."intento_retry_m9" (
  "id_intento_m9" SERIAL PRIMARY KEY,
  "id_pendiente_m9" INTEGER NOT NULL REFERENCES "finanzas"."pendiente_evento_m9"("id_pendiente_m9") ON DELETE RESTRICT,
  "numero_intento" INTEGER NOT NULL,
  "estado" VARCHAR(20) NOT NULL,
  "error_codigo" VARCHAR(100),
  "iniciado_en" TIMESTAMPTZ(6) NOT NULL,
  "finalizado_en" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "uq_m9_intento_numero" UNIQUE ("id_pendiente_m9", "numero_intento"),
  CONSTRAINT "chk_m9_intento_estado" CHECK ("estado" IN ('EXITOSO','FALLIDO'))
);
CREATE INDEX "idx_m9_intento_estado" ON "finanzas"."intento_retry_m9" ("estado", "finalizado_en");

CREATE TABLE "finanzas"."configuracion_alerta_m9" (
  "id_configuracion_alerta" SERIAL PRIMARY KEY,
  "codigo" VARCHAR(100) NOT NULL UNIQUE,
  "metrica" VARCHAR(80) NOT NULL,
  "operador" VARCHAR(4) NOT NULL,
  "umbral" NUMERIC(24,6) NOT NULL,
  "activa" BOOLEAN NOT NULL DEFAULT TRUE,
  "vigencia_desde" TIMESTAMPTZ(6) NOT NULL,
  "vigencia_hasta" TIMESTAMPTZ(6),
  CONSTRAINT "chk_m9_alerta_operador" CHECK ("operador" IN ('GT','GTE','LT','LTE','EQ')),
  CONSTRAINT "chk_m9_alerta_vigencia" CHECK ("vigencia_hasta" IS NULL OR "vigencia_hasta" >= "vigencia_desde")
);
CREATE INDEX "idx_m9_alerta_vigente" ON "finanzas"."configuracion_alerta_m9" ("metrica", "activa", "vigencia_desde");

CREATE TABLE "finanzas"."categoria_retencion_m9" (
  "id_categoria_retencion" SERIAL PRIMARY KEY,
  "codigo" VARCHAR(100) NOT NULL UNIQUE,
  "descripcion" VARCHAR(300),
  "ownership" VARCHAR(40) NOT NULL,
  "creada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "finanzas"."politica_tratamiento_m9" (
  "id_politica_m9" SERIAL PRIMARY KEY,
  "id_categoria_retencion" INTEGER NOT NULL REFERENCES "finanzas"."categoria_retencion_m9"("id_categoria_retencion") ON DELETE RESTRICT,
  "version" INTEGER NOT NULL,
  "accion" VARCHAR(20) NOT NULL,
  "modulo_objetivo" VARCHAR(40),
  "entidad_objetivo" VARCHAR(80),
  "estrategia_ref" VARCHAR(100),
  "permite_correlacion" BOOLEAN NOT NULL DEFAULT FALSE,
  "preservar_minimo" BOOLEAN NOT NULL DEFAULT FALSE,
  "finalidad_ref" VARCHAR(200),
  "base_ref" VARCHAR(200),
  "politica_owner_ref" VARCHAR(200),
  "vigencia_desde" TIMESTAMPTZ(6) NOT NULL,
  "vigencia_hasta" TIMESTAMPTZ(6),
  "creada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "uq_m9_politica_version" UNIQUE ("id_categoria_retencion", "version"),
  CONSTRAINT "chk_m9_politica_accion" CHECK ("accion" IN ('NONE','ANONYMIZE','PURGE','BLOCK')),
  CONSTRAINT "chk_m9_politica_vigencia" CHECK ("vigencia_hasta" IS NULL OR "vigencia_hasta" >= "vigencia_desde")
);
CREATE INDEX "idx_m9_politica_vigente" ON "finanzas"."politica_tratamiento_m9" ("id_categoria_retencion", "vigencia_desde", "vigencia_hasta");

CREATE TABLE "finanzas"."tratamiento_privacidad_m9" (
  "id_tratamiento_m9" SERIAL PRIMARY KEY,
  "id_evento_m9" INTEGER NOT NULL REFERENCES "finanzas"."evento_auditoria_m9"("id_evento_m9") ON DELETE RESTRICT,
  "id_politica_m9" INTEGER NOT NULL REFERENCES "finanzas"."politica_tratamiento_m9"("id_politica_m9") ON DELETE RESTRICT,
  "accion" VARCHAR(20) NOT NULL,
  "estado" VARCHAR(30) NOT NULL,
  "correlacion_anonima" VARCHAR(160),
  "aplicado_en" TIMESTAMPTZ(6) NOT NULL,
  "evidencia_terminal_id" INTEGER REFERENCES "finanzas"."evento_auditoria_m9"("id_evento_m9") ON DELETE RESTRICT,
  CONSTRAINT "uq_m9_tratamiento_evento_politica" UNIQUE ("id_evento_m9", "id_politica_m9"),
  CONSTRAINT "chk_m9_tratamiento_estado" CHECK ("estado" IN ('APLICADO','BLOQUEADO','DEPENDENCIA_OWNER'))
);
CREATE INDEX "idx_m9_tratamiento_evento" ON "finanzas"."tratamiento_privacidad_m9" ("id_evento_m9", "aplicado_en");

CREATE FUNCTION "finanzas"."bloquear_mutacion_politica_m9"()
RETURNS TRIGGER AS $$ BEGIN RAISE EXCEPTION 'Las versiones de política M9 son inmutables'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "trg_m9_politica_inmutable" BEFORE UPDATE OR DELETE ON "finanzas"."politica_tratamiento_m9"
FOR EACH ROW EXECUTE FUNCTION "finanzas"."bloquear_mutacion_politica_m9"();
