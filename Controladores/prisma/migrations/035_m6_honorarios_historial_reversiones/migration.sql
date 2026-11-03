CREATE TABLE finanzas.prestador_honorarios (
  id_prestador_honorarios SERIAL PRIMARY KEY,
  identificador VARCHAR(30) NOT NULL UNIQUE,
  nombre_razon_social VARCHAR(160) NOT NULL,
  contacto TEXT,
  estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
  CONSTRAINT ck_prestador_honorarios_identidad CHECK (length(trim(identificador)) > 0 AND length(trim(nombre_razon_social)) > 0),
  CONSTRAINT ck_prestador_honorarios_estado CHECK (estado IN ('ACTIVO','INACTIVO'))
);

CREATE TABLE finanzas.boleta_honorarios (
  id_boleta_honorarios SERIAL PRIMARY KEY,
  id_prestador INTEGER NOT NULL,
  folio VARCHAR(80) NOT NULL,
  fecha_emision DATE NOT NULL,
  bruto NUMERIC(14,4) NOT NULL,
  modalidad_tributaria VARCHAR(40) NOT NULL,
  tasa_aplicada NUMERIC(10,6),
  retencion NUMERIC(14,4),
  liquido NUMERIC(14,4),
  estado_documental VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE_CONFIRMACION',
  respaldo TEXT,
  referencia VARCHAR(200),
  CONSTRAINT fk_boleta_honorarios_prestador FOREIGN KEY (id_prestador) REFERENCES finanzas.prestador_honorarios(id_prestador_honorarios) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT uq_boleta_honorarios_prestador_folio UNIQUE (id_prestador, folio),
  CONSTRAINT ck_boleta_honorarios_folio CHECK (length(trim(folio)) > 0),
  CONSTRAINT ck_boleta_honorarios_montos CHECK (bruto > 0 AND (retencion IS NULL OR retencion >= 0) AND (liquido IS NULL OR liquido > 0)),
  CONSTRAINT ck_boleta_honorarios_estado CHECK (estado_documental IN ('PENDIENTE_CONFIRMACION','CONFIRMADA')),
  CONSTRAINT ck_boleta_honorarios_confirmada CHECK (estado_documental <> 'CONFIRMADA' OR (tasa_aplicada IS NOT NULL AND retencion IS NOT NULL AND liquido IS NOT NULL AND bruto = retencion + liquido))
);
CREATE INDEX idx_boleta_honorarios_estado_fecha ON finanzas.boleta_honorarios(estado_documental, fecha_emision);

CREATE TABLE finanzas.reversion_pago_remuneracion (
  id_reversion_pago_remuneracion SERIAL PRIMARY KEY,
  id_pago_remuneracion INTEGER NOT NULL,
  monto NUMERIC(14,4) NOT NULL,
  motivo TEXT NOT NULL,
  registrado_por BIGINT NOT NULL,
  registrado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_reversion_pago_remuneracion_pago FOREIGN KEY (id_pago_remuneracion) REFERENCES finanzas.pago_remuneracion(id_pago_remuneracion) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT fk_reversion_pago_remuneracion_usuario FOREIGN KEY (registrado_por) REFERENCES terreno.usuario(usuario_id_usuario) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT ck_reversion_pago_remuneracion_monto CHECK (monto > 0),
  CONSTRAINT ck_reversion_pago_remuneracion_motivo CHECK (length(trim(motivo)) > 0)
);
CREATE INDEX idx_reversion_pago_remuneracion_pago ON finanzas.reversion_pago_remuneracion(id_pago_remuneracion, registrado_en);

ALTER TABLE finanzas.pago_remuneracion DROP CONSTRAINT ck_pago_remuneracion_origen;
ALTER TABLE finanzas.pago_remuneracion ADD CONSTRAINT ck_pago_remuneracion_origen CHECK (origen_tipo IN ('REMUNERACION','ANTICIPO','REGULARIZACION','BOLETA_HONORARIOS'));

CREATE OR REPLACE FUNCTION finanzas.validar_origen_pago_remuneracion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.origen_tipo = 'REMUNERACION' AND NOT EXISTS (SELECT 1 FROM finanzas.remuneracion WHERE id_remuneracion = NEW.origen_id) THEN RAISE EXCEPTION 'Origen REMUNERACION inexistente';
  ELSIF NEW.origen_tipo = 'ANTICIPO' AND NOT EXISTS (SELECT 1 FROM finanzas.anticipo_remuneracion WHERE id_anticipo = NEW.origen_id) THEN RAISE EXCEPTION 'Origen ANTICIPO inexistente';
  ELSIF NEW.origen_tipo = 'REGULARIZACION' AND NOT EXISTS (SELECT 1 FROM finanzas.regularizacion_extraordinaria WHERE id_regularizacion = NEW.origen_id) THEN RAISE EXCEPTION 'Origen REGULARIZACION inexistente';
  ELSIF NEW.origen_tipo = 'BOLETA_HONORARIOS' AND NOT EXISTS (SELECT 1 FROM finanzas.boleta_honorarios WHERE id_boleta_honorarios = NEW.origen_id) THEN RAISE EXCEPTION 'Origen BOLETA_HONORARIOS inexistente';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION finanzas.proteger_borrado_origen_pago_remuneracion() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE id_origen INTEGER;
BEGIN
  id_origen := CASE TG_ARGV[0]
    WHEN 'REMUNERACION' THEN (to_jsonb(OLD)->>'id_remuneracion')::INTEGER
    WHEN 'ANTICIPO' THEN (to_jsonb(OLD)->>'id_anticipo')::INTEGER
    WHEN 'REGULARIZACION' THEN (to_jsonb(OLD)->>'id_regularizacion')::INTEGER
    WHEN 'BOLETA_HONORARIOS' THEN (to_jsonb(OLD)->>'id_boleta_honorarios')::INTEGER
  END;
  IF EXISTS (SELECT 1 FROM finanzas.pago_remuneracion WHERE origen_tipo = TG_ARGV[0] AND origen_id = id_origen) THEN RAISE EXCEPTION 'El origen posee pagos asociados'; END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER tr_proteger_borrado_boleta_pagada BEFORE DELETE ON finanzas.boleta_honorarios FOR EACH ROW EXECUTE FUNCTION finanzas.proteger_borrado_origen_pago_remuneracion('BOLETA_HONORARIOS');

CREATE FUNCTION finanzas.validar_reversion_pago_remuneracion() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE pago finanzas.pago_remuneracion%ROWTYPE; total NUMERIC(14,4);
BEGIN
  SELECT * INTO pago FROM finanzas.pago_remuneracion WHERE id_pago_remuneracion = NEW.id_pago_remuneracion FOR UPDATE;
  IF pago.id_pago_remuneracion IS NULL OR pago.estado <> 'CONFIRMADO' THEN RAISE EXCEPTION 'Sólo un pago CONFIRMADO admite reversión'; END IF;
  SELECT COALESCE(SUM(monto),0) INTO total FROM finanzas.reversion_pago_remuneracion WHERE id_pago_remuneracion = NEW.id_pago_remuneracion;
  IF total + NEW.monto > pago.monto THEN RAISE EXCEPTION 'La suma de reversiones excede el pago'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tr_validar_reversion_pago_remuneracion BEFORE INSERT ON finanzas.reversion_pago_remuneracion FOR EACH ROW EXECUTE FUNCTION finanzas.validar_reversion_pago_remuneracion();

CREATE FUNCTION finanzas.proteger_reversion_pago_remuneracion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Una reversión registrada es inmutable'; END $$;
CREATE TRIGGER tr_proteger_reversion_pago_remuneracion BEFORE UPDATE ON finanzas.reversion_pago_remuneracion FOR EACH ROW EXECUTE FUNCTION finanzas.proteger_reversion_pago_remuneracion();

CREATE OR REPLACE FUNCTION finanzas.proteger_pago_remuneracion_confirmado() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.estado = 'CONFIRMADO' THEN
    IF NEW.estado = 'ANULADO' AND length(trim(NEW.motivo_anulacion)) > 0 AND NEW.anulado_por IS NOT NULL AND NEW.anulado_en IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM finanzas.reversion_pago_remuneracion WHERE id_pago_remuneracion = OLD.id_pago_remuneracion)
       AND NEW.id_pago_remuneracion IS NOT DISTINCT FROM OLD.id_pago_remuneracion AND NEW.origen_tipo IS NOT DISTINCT FROM OLD.origen_tipo
       AND NEW.origen_id IS NOT DISTINCT FROM OLD.origen_id AND NEW.monto IS NOT DISTINCT FROM OLD.monto AND NEW.id_medio_pago IS NOT DISTINCT FROM OLD.id_medio_pago
       AND NEW.respaldo IS NOT DISTINCT FROM OLD.respaldo AND NEW.referencia IS NOT DISTINCT FROM OLD.referencia AND NEW.clave_idempotencia IS NOT DISTINCT FROM OLD.clave_idempotencia
       AND NEW.creado_por IS NOT DISTINCT FROM OLD.creado_por AND NEW.creado_en IS NOT DISTINCT FROM OLD.creado_en
       AND NEW.confirmado_por IS NOT DISTINCT FROM OLD.confirmado_por AND NEW.confirmado_en IS NOT DISTINCT FROM OLD.confirmado_en THEN RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Un pago confirmado sólo admite anulación controlada y sin reversiones';
  END IF;
  IF OLD.estado = 'ANULADO' THEN RAISE EXCEPTION 'Un pago anulado es inmutable'; END IF;
  RETURN NEW;
END $$;
