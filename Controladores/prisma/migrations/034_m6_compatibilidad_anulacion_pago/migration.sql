ALTER TABLE finanzas.pago_remuneracion
  ADD COLUMN motivo_anulacion TEXT,
  ADD COLUMN anulado_por BIGINT,
  ADD COLUMN anulado_en TIMESTAMPTZ,
  ADD CONSTRAINT fk_pago_remuneracion_anulador
    FOREIGN KEY (anulado_por) REFERENCES terreno.usuario(usuario_id_usuario)
    ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE finanzas.pago_remuneracion
  DROP CONSTRAINT ck_pago_remuneracion_confirmacion,
  ADD CONSTRAINT ck_pago_remuneracion_confirmacion CHECK (
    (estado = 'PREPARADO' AND confirmado_por IS NULL AND confirmado_en IS NULL)
    OR (estado IN ('CONFIRMADO','ANULADO') AND confirmado_por IS NOT NULL AND confirmado_en IS NOT NULL)
  ),
  ADD CONSTRAINT ck_pago_remuneracion_anulacion CHECK (
    (estado = 'ANULADO' AND length(trim(motivo_anulacion)) > 0 AND anulado_por IS NOT NULL AND anulado_en IS NOT NULL)
    OR (estado <> 'ANULADO' AND motivo_anulacion IS NULL AND anulado_por IS NULL AND anulado_en IS NULL)
  );

CREATE OR REPLACE FUNCTION finanzas.proteger_pago_remuneracion_confirmado()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.estado = 'CONFIRMADO' THEN
    IF NEW.estado = 'ANULADO'
       AND length(trim(NEW.motivo_anulacion)) > 0
       AND NEW.anulado_por IS NOT NULL
       AND NEW.anulado_en IS NOT NULL
       AND NEW.id_pago_remuneracion IS NOT DISTINCT FROM OLD.id_pago_remuneracion
       AND NEW.origen_tipo IS NOT DISTINCT FROM OLD.origen_tipo
       AND NEW.origen_id IS NOT DISTINCT FROM OLD.origen_id
       AND NEW.monto IS NOT DISTINCT FROM OLD.monto
       AND NEW.id_medio_pago IS NOT DISTINCT FROM OLD.id_medio_pago
       AND NEW.respaldo IS NOT DISTINCT FROM OLD.respaldo
       AND NEW.referencia IS NOT DISTINCT FROM OLD.referencia
       AND NEW.clave_idempotencia IS NOT DISTINCT FROM OLD.clave_idempotencia
       AND NEW.creado_por IS NOT DISTINCT FROM OLD.creado_por
       AND NEW.creado_en IS NOT DISTINCT FROM OLD.creado_en
       AND NEW.confirmado_por IS NOT DISTINCT FROM OLD.confirmado_por
       AND NEW.confirmado_en IS NOT DISTINCT FROM OLD.confirmado_en
    THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Un pago confirmado sólo admite transición registral controlada a ANULADO';
  END IF;
  IF OLD.estado = 'ANULADO' THEN
    RAISE EXCEPTION 'Un pago anulado es inmutable';
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION finanzas.proteger_borrado_origen_pago_remuneracion()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  id_origen INTEGER;
BEGIN
  id_origen := CASE TG_ARGV[0]
    WHEN 'REMUNERACION' THEN (to_jsonb(OLD)->>'id_remuneracion')::INTEGER
    WHEN 'ANTICIPO' THEN (to_jsonb(OLD)->>'id_anticipo')::INTEGER
    WHEN 'REGULARIZACION' THEN (to_jsonb(OLD)->>'id_regularizacion')::INTEGER
  END;
  IF EXISTS (
    SELECT 1 FROM finanzas.pago_remuneracion
    WHERE origen_tipo = TG_ARGV[0] AND origen_id = id_origen
  ) THEN
    RAISE EXCEPTION 'El origen posee pagos asociados';
  END IF;
  RETURN OLD;
END $$;

CREATE TRIGGER tr_proteger_borrado_remuneracion_pagada
BEFORE DELETE ON finanzas.remuneracion FOR EACH ROW
EXECUTE FUNCTION finanzas.proteger_borrado_origen_pago_remuneracion('REMUNERACION');

CREATE TRIGGER tr_proteger_borrado_anticipo_pagado
BEFORE DELETE ON finanzas.anticipo_remuneracion FOR EACH ROW
EXECUTE FUNCTION finanzas.proteger_borrado_origen_pago_remuneracion('ANTICIPO');

CREATE TRIGGER tr_proteger_borrado_regularizacion_pagada
BEFORE DELETE ON finanzas.regularizacion_extraordinaria FOR EACH ROW
EXECUTE FUNCTION finanzas.proteger_borrado_origen_pago_remuneracion('REGULARIZACION');
