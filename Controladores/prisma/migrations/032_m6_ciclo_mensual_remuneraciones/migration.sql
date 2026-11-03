ALTER TABLE finanzas.periodo_remuneracion
  ADD COLUMN cerrado_en TIMESTAMPTZ,
  ADD COLUMN cerrado_por BIGINT,
  ADD CONSTRAINT fk_periodo_remuneracion_cerrador FOREIGN KEY (cerrado_por)
    REFERENCES terreno.usuario(usuario_id_usuario) ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT ck_periodo_remuneracion_cierre CHECK (
    (cerrado_en IS NULL AND cerrado_por IS NULL) OR (cerrado_en IS NOT NULL AND cerrado_por IS NOT NULL)
  );

ALTER TABLE finanzas.remuneracion
  ADD COLUMN calculado_en TIMESTAMPTZ,
  ADD COLUMN calculado_por BIGINT,
  ADD COLUMN total_haberes NUMERIC(14,4),
  ADD COLUMN total_deducciones NUMERIC(14,4),
  ADD COLUMN total_aportes_empleador NUMERIC(14,4),
  ADD COLUMN base_imponible NUMERIC(14,4),
  ADD COLUMN base_tributable NUMERIC(14,4),
  ADD COLUMN liquido_preliminar NUMERIC(14,4),
  ADD COLUMN cerrado_en TIMESTAMPTZ,
  ADD COLUMN cerrado_por BIGINT,
  ADD COLUMN reapertura_solicitada_en TIMESTAMPTZ,
  ADD COLUMN reapertura_solicitada_por BIGINT,
  ADD COLUMN reapertura_motivo TEXT,
  ADD COLUMN reapertura_aprobada_en TIMESTAMPTZ,
  ADD COLUMN reapertura_aprobada_por BIGINT,
  ADD CONSTRAINT fk_remuneracion_calculador FOREIGN KEY (calculado_por)
    REFERENCES terreno.usuario(usuario_id_usuario) ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT fk_remuneracion_cerrador FOREIGN KEY (cerrado_por)
    REFERENCES terreno.usuario(usuario_id_usuario) ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT fk_remuneracion_reapertura_solicitante FOREIGN KEY (reapertura_solicitada_por)
    REFERENCES terreno.usuario(usuario_id_usuario) ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT fk_remuneracion_reapertura_aprobador FOREIGN KEY (reapertura_aprobada_por)
    REFERENCES terreno.usuario(usuario_id_usuario) ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT ck_remuneracion_totales_no_negativos CHECK (
    (total_haberes IS NULL OR total_haberes >= 0) AND
    (total_deducciones IS NULL OR total_deducciones >= 0) AND
    (total_aportes_empleador IS NULL OR total_aportes_empleador >= 0) AND
    (base_imponible IS NULL OR base_imponible >= 0) AND
    (base_tributable IS NULL OR base_tributable >= 0) AND
    (liquido_preliminar IS NULL OR liquido_preliminar >= 0)
  ),
  ADD CONSTRAINT ck_remuneracion_cierre CHECK (
    (estado = 'cerrada' AND cerrado_en IS NOT NULL AND cerrado_por IS NOT NULL)
    OR (estado <> 'cerrada')
  ),
  ADD CONSTRAINT ck_remuneracion_reapertura CHECK (
    (reapertura_solicitada_en IS NULL AND reapertura_solicitada_por IS NULL AND reapertura_motivo IS NULL)
    OR (reapertura_solicitada_en IS NOT NULL AND reapertura_solicitada_por IS NOT NULL AND length(trim(reapertura_motivo)) > 0)
  ),
  ADD CONSTRAINT ck_remuneracion_aprobacion_reapertura CHECK (
    (reapertura_aprobada_en IS NULL AND reapertura_aprobada_por IS NULL)
    OR (reapertura_aprobada_en IS NOT NULL AND reapertura_aprobada_por IS NOT NULL
      AND reapertura_solicitada_por IS NOT NULL AND reapertura_aprobada_por <> reapertura_solicitada_por)
  );

DROP INDEX finanzas.uq_remuneracion_actual_periodo_empleado;
CREATE UNIQUE INDEX uq_remuneracion_actual_periodo_empleado
  ON finanzas.remuneracion(id_periodo_remuneracion, id_empleado)
  WHERE estado <> 'reemplazada';

ALTER TABLE finanzas.componente_remuneracion
  DROP CONSTRAINT ck_componente_remuneracion_tipo,
  ADD CONSTRAINT ck_componente_remuneracion_tipo CHECK (tipo IN (
    'EXCEPCIONAL_POSITIVO', 'VARIABLE_ADMINISTRATIVA', 'VARIABLE_COMERCIAL',
    'VALOR_EXTERNO', 'AJUSTE_MANUAL', 'PRORRATEO', 'SUELDO_BASE',
    'HABER_AUTOMATICO', 'HECHO_TERRENO', 'DEDUCCION_AUTOMATICA',
    'APORTE_EMPLEADOR_AUTOMATICO', 'IMPUESTO_RENTA'
  ));

CREATE UNIQUE INDEX uq_componente_automatico_clave
  ON finanzas.componente_remuneracion(id_remuneracion, tipo, clave_negocio)
  WHERE fuente_tipo = 'AUTOMATICA' AND clave_negocio IS NOT NULL;

CREATE INDEX idx_periodo_remuneracion_cierre
  ON finanzas.periodo_remuneracion(cerrado_en);
CREATE INDEX idx_remuneracion_reapertura
  ON finanzas.remuneracion(reapertura_solicitada_en, reapertura_aprobada_en);
