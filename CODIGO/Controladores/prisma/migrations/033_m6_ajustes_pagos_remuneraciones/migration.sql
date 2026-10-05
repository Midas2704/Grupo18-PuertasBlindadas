CREATE TABLE finanzas.ajuste_posterior_remuneracion (
  id_ajuste_posterior SERIAL PRIMARY KEY,
  id_remuneracion INTEGER NOT NULL,
  id_empleado INTEGER NOT NULL,
  id_periodo_origen INTEGER NOT NULL,
  fecha_hallazgo DATE NOT NULL,
  monto NUMERIC(14,4) NOT NULL,
  direccion VARCHAR(20) NOT NULL,
  motivo TEXT NOT NULL,
  tratamiento VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
  id_periodo_aplicable INTEGER,
  estado VARCHAR(20) NOT NULL DEFAULT 'CONFIRMADO',
  clave_idempotencia VARCHAR(100) NOT NULL UNIQUE,
  motivo_tratamiento TEXT,
  requiere_resolucion_humana BOOLEAN NOT NULL DEFAULT FALSE,
  creado_por BIGINT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  postergado_por BIGINT,
  postergado_en TIMESTAMPTZ,
  CONSTRAINT fk_ajuste_posterior_remuneracion FOREIGN KEY (id_remuneracion) REFERENCES finanzas.remuneracion(id_remuneracion) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT fk_ajuste_posterior_empleado FOREIGN KEY (id_empleado) REFERENCES finanzas.empleado(id_empleado) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT fk_ajuste_posterior_periodo_origen FOREIGN KEY (id_periodo_origen) REFERENCES finanzas.periodo_remuneracion(id_periodo_remuneracion) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT fk_ajuste_posterior_periodo_aplicable FOREIGN KEY (id_periodo_aplicable) REFERENCES finanzas.periodo_remuneracion(id_periodo_remuneracion) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT fk_ajuste_posterior_creador FOREIGN KEY (creado_por) REFERENCES terreno.usuario(usuario_id_usuario) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT fk_ajuste_posterior_postergador FOREIGN KEY (postergado_por) REFERENCES terreno.usuario(usuario_id_usuario) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT ck_ajuste_posterior_monto CHECK (monto > 0),
  CONSTRAINT ck_ajuste_posterior_direccion CHECK (direccion IN ('POSITIVO','NEGATIVO')),
  CONSTRAINT ck_ajuste_posterior_estado CHECK (estado = 'CONFIRMADO'),
  CONSTRAINT ck_ajuste_posterior_motivo CHECK (length(trim(motivo)) > 0),
  CONSTRAINT ck_ajuste_posterior_postergacion CHECK ((tratamiento <> 'POSTERGADO') OR (postergado_por IS NOT NULL AND postergado_en IS NOT NULL))
);
CREATE INDEX idx_ajuste_posterior_remuneracion ON finanzas.ajuste_posterior_remuneracion(id_remuneracion, estado);
CREATE INDEX idx_ajuste_posterior_empleado_periodo ON finanzas.ajuste_posterior_remuneracion(id_empleado, id_periodo_origen);

CREATE TABLE finanzas.regularizacion_extraordinaria (
  id_regularizacion SERIAL PRIMARY KEY,
  id_ajuste_posterior INTEGER NOT NULL UNIQUE,
  monto NUMERIC(14,4) NOT NULL,
  motivo TEXT NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'ABIERTA',
  creado_por BIGINT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por BIGINT,
  actualizado_en TIMESTAMPTZ,
  cerrado_por BIGINT,
  cerrado_en TIMESTAMPTZ,
  CONSTRAINT fk_regularizacion_ajuste FOREIGN KEY (id_ajuste_posterior) REFERENCES finanzas.ajuste_posterior_remuneracion(id_ajuste_posterior) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT fk_regularizacion_creador FOREIGN KEY (creado_por) REFERENCES terreno.usuario(usuario_id_usuario) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT fk_regularizacion_actualizador FOREIGN KEY (actualizado_por) REFERENCES terreno.usuario(usuario_id_usuario) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT fk_regularizacion_cerrador FOREIGN KEY (cerrado_por) REFERENCES terreno.usuario(usuario_id_usuario) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT ck_regularizacion_monto CHECK (monto > 0),
  CONSTRAINT ck_regularizacion_estado CHECK (estado IN ('ABIERTA','CERRADA')),
  CONSTRAINT ck_regularizacion_cierre CHECK ((estado = 'CERRADA' AND cerrado_por IS NOT NULL AND cerrado_en IS NOT NULL) OR estado = 'ABIERTA'),
  CONSTRAINT ck_regularizacion_motivo CHECK (length(trim(motivo)) > 0)
);
CREATE INDEX idx_regularizacion_extraordinaria_estado ON finanzas.regularizacion_extraordinaria(estado);

CREATE TABLE finanzas.anticipo_remuneracion (
  id_anticipo SERIAL PRIMARY KEY,
  id_empleado INTEGER NOT NULL,
  id_periodo_remuneracion INTEGER NOT NULL,
  modalidad VARCHAR(20) NOT NULL,
  valor_ingresado NUMERIC(14,4) NOT NULL,
  codigo_base_porcentaje VARCHAR(50),
  monto_final NUMERIC(14,4),
  estado_valorizacion VARCHAR(30) NOT NULL,
  clave_idempotencia VARCHAR(100) NOT NULL UNIQUE,
  creado_por BIGINT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_anticipo_empleado FOREIGN KEY (id_empleado) REFERENCES finanzas.empleado(id_empleado) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT fk_anticipo_periodo FOREIGN KEY (id_periodo_remuneracion) REFERENCES finanzas.periodo_remuneracion(id_periodo_remuneracion) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT fk_anticipo_creador FOREIGN KEY (creado_por) REFERENCES terreno.usuario(usuario_id_usuario) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT ck_anticipo_modalidad CHECK (modalidad IN ('MONTO','PORCENTAJE')),
  CONSTRAINT ck_anticipo_valor CHECK (valor_ingresado > 0 AND (monto_final IS NULL OR monto_final > 0)),
  CONSTRAINT ck_anticipo_valorizacion CHECK (estado_valorizacion IN ('VALORIZADO','PENDIENTE_VALORIZACION')),
  CONSTRAINT ck_anticipo_base CHECK ((modalidad = 'MONTO' AND codigo_base_porcentaje IS NULL AND monto_final IS NOT NULL) OR modalidad = 'PORCENTAJE')
);
CREATE INDEX idx_anticipo_empleado_periodo ON finanzas.anticipo_remuneracion(id_empleado, id_periodo_remuneracion);

CREATE TABLE finanzas.pago_remuneracion (
  id_pago_remuneracion SERIAL PRIMARY KEY,
  origen_tipo VARCHAR(30) NOT NULL,
  origen_id INTEGER NOT NULL,
  monto NUMERIC(14,4) NOT NULL,
  id_medio_pago INTEGER NOT NULL,
  respaldo TEXT,
  referencia VARCHAR(200),
  estado VARCHAR(20) NOT NULL DEFAULT 'PREPARADO',
  clave_idempotencia VARCHAR(100) NOT NULL UNIQUE,
  creado_por BIGINT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmado_por BIGINT,
  confirmado_en TIMESTAMPTZ,
  CONSTRAINT fk_pago_remuneracion_medio FOREIGN KEY (id_medio_pago) REFERENCES finanzas.medio_pago(id_medio_pago) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT fk_pago_remuneracion_creador FOREIGN KEY (creado_por) REFERENCES terreno.usuario(usuario_id_usuario) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT fk_pago_remuneracion_confirmador FOREIGN KEY (confirmado_por) REFERENCES terreno.usuario(usuario_id_usuario) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT ck_pago_remuneracion_origen CHECK (origen_tipo IN ('REMUNERACION','ANTICIPO','REGULARIZACION')),
  CONSTRAINT ck_pago_remuneracion_monto CHECK (monto > 0),
  CONSTRAINT ck_pago_remuneracion_estado CHECK (estado IN ('PREPARADO','CONFIRMADO','ANULADO')),
  CONSTRAINT ck_pago_remuneracion_confirmacion CHECK ((estado = 'CONFIRMADO' AND confirmado_por IS NOT NULL AND confirmado_en IS NOT NULL) OR (estado <> 'CONFIRMADO' AND confirmado_por IS NULL AND confirmado_en IS NULL))
);
CREATE INDEX idx_pago_remuneracion_origen ON finanzas.pago_remuneracion(origen_tipo, origen_id, estado);
CREATE UNIQUE INDEX uq_pago_remuneracion_confirmado_origen ON finanzas.pago_remuneracion(origen_tipo, origen_id) WHERE estado = 'CONFIRMADO';

CREATE FUNCTION finanzas.validar_origen_pago_remuneracion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.origen_tipo = 'REMUNERACION' AND NOT EXISTS (SELECT 1 FROM finanzas.remuneracion WHERE id_remuneracion = NEW.origen_id) THEN RAISE EXCEPTION 'Origen REMUNERACION inexistente';
  ELSIF NEW.origen_tipo = 'ANTICIPO' AND NOT EXISTS (SELECT 1 FROM finanzas.anticipo_remuneracion WHERE id_anticipo = NEW.origen_id) THEN RAISE EXCEPTION 'Origen ANTICIPO inexistente';
  ELSIF NEW.origen_tipo = 'REGULARIZACION' AND NOT EXISTS (SELECT 1 FROM finanzas.regularizacion_extraordinaria WHERE id_regularizacion = NEW.origen_id) THEN RAISE EXCEPTION 'Origen REGULARIZACION inexistente';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tr_validar_origen_pago_remuneracion BEFORE INSERT OR UPDATE OF origen_tipo, origen_id ON finanzas.pago_remuneracion FOR EACH ROW EXECUTE FUNCTION finanzas.validar_origen_pago_remuneracion();

CREATE FUNCTION finanzas.proteger_pago_remuneracion_confirmado() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.estado = 'CONFIRMADO' THEN RAISE EXCEPTION 'Un pago confirmado es inmutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tr_proteger_pago_remuneracion_confirmado BEFORE UPDATE ON finanzas.pago_remuneracion FOR EACH ROW EXECUTE FUNCTION finanzas.proteger_pago_remuneracion_confirmado();
