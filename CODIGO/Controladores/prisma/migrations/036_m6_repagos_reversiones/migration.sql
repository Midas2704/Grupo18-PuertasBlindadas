DROP INDEX finanzas.uq_pago_remuneracion_confirmado_origen;

CREATE OR REPLACE FUNCTION finanzas.validar_saldo_pago_remuneracion()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  monto_original NUMERIC(14,4);
  pagado_efectivo NUMERIC(14,4);
BEGIN
  IF NEW.estado <> 'CONFIRMADO' OR (TG_OP = 'UPDATE' AND OLD.estado = 'CONFIRMADO') THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(NEW.origen_tipo)::INTEGER, NEW.origen_id);

  CASE NEW.origen_tipo
    WHEN 'REMUNERACION' THEN
      SELECT liquido_preliminar INTO monto_original
      FROM finanzas.remuneracion WHERE id_remuneracion = NEW.origen_id FOR UPDATE;
    WHEN 'ANTICIPO' THEN
      SELECT monto_final INTO monto_original
      FROM finanzas.anticipo_remuneracion WHERE id_anticipo = NEW.origen_id FOR UPDATE;
    WHEN 'REGULARIZACION' THEN
      SELECT monto INTO monto_original
      FROM finanzas.regularizacion_extraordinaria WHERE id_regularizacion = NEW.origen_id FOR UPDATE;
    WHEN 'BOLETA_HONORARIOS' THEN
      SELECT liquido INTO monto_original
      FROM finanzas.boleta_honorarios WHERE id_boleta_honorarios = NEW.origen_id FOR UPDATE;
  END CASE;

  IF monto_original IS NULL OR monto_original <= 0 THEN
    RAISE EXCEPTION 'El origen no posee un monto pagable válido';
  END IF;

  SELECT COALESCE(SUM(p.monto - COALESCE(r.total, 0)), 0)
  INTO pagado_efectivo
  FROM finanzas.pago_remuneracion p
  LEFT JOIN (
    SELECT id_pago_remuneracion, SUM(monto) AS total
    FROM finanzas.reversion_pago_remuneracion
    GROUP BY id_pago_remuneracion
  ) r ON r.id_pago_remuneracion = p.id_pago_remuneracion
  WHERE p.origen_tipo = NEW.origen_tipo
    AND p.origen_id = NEW.origen_id
    AND p.estado = 'CONFIRMADO'
    AND p.id_pago_remuneracion <> NEW.id_pago_remuneracion;

  IF pagado_efectivo + NEW.monto > monto_original THEN
    RAISE EXCEPTION 'El pago excede el saldo económico pendiente del origen';
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER tr_validar_saldo_pago_remuneracion
BEFORE INSERT OR UPDATE OF estado ON finanzas.pago_remuneracion
FOR EACH ROW EXECUTE FUNCTION finanzas.validar_saldo_pago_remuneracion();

CREATE OR REPLACE FUNCTION finanzas.validar_reversion_pago_remuneracion()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  pago finanzas.pago_remuneracion%ROWTYPE;
  total NUMERIC(14,4);
BEGIN
  SELECT * INTO pago FROM finanzas.pago_remuneracion
  WHERE id_pago_remuneracion = NEW.id_pago_remuneracion FOR UPDATE;
  IF pago.id_pago_remuneracion IS NULL OR pago.estado <> 'CONFIRMADO' THEN
    RAISE EXCEPTION 'Sólo un pago CONFIRMADO admite reversión';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(pago.origen_tipo)::INTEGER, pago.origen_id);
  SELECT COALESCE(SUM(monto),0) INTO total
  FROM finanzas.reversion_pago_remuneracion
  WHERE id_pago_remuneracion = NEW.id_pago_remuneracion;
  IF total + NEW.monto > pago.monto THEN
    RAISE EXCEPTION 'La suma de reversiones excede el pago';
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION finanzas.proteger_boleta_honorarios_confirmada()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.estado_documental = 'CONFIRMADA' THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Una boleta CONFIRMADA no puede eliminarse';
    END IF;
    IF NEW.id_prestador IS DISTINCT FROM OLD.id_prestador
       OR NEW.folio IS DISTINCT FROM OLD.folio
       OR NEW.fecha_emision IS DISTINCT FROM OLD.fecha_emision
       OR NEW.bruto IS DISTINCT FROM OLD.bruto
       OR NEW.modalidad_tributaria IS DISTINCT FROM OLD.modalidad_tributaria
       OR NEW.tasa_aplicada IS DISTINCT FROM OLD.tasa_aplicada
       OR NEW.retencion IS DISTINCT FROM OLD.retencion
       OR NEW.liquido IS DISTINCT FROM OLD.liquido
       OR NEW.estado_documental IS DISTINCT FROM OLD.estado_documental
       OR NEW.respaldo IS DISTINCT FROM OLD.respaldo
       OR NEW.referencia IS DISTINCT FROM OLD.referencia THEN
      RAISE EXCEPTION 'Una boleta CONFIRMADA es inmutable';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

CREATE TRIGGER tr_proteger_boleta_honorarios_confirmada
BEFORE UPDATE OR DELETE ON finanzas.boleta_honorarios
FOR EACH ROW EXECUTE FUNCTION finanzas.proteger_boleta_honorarios_confirmada();
