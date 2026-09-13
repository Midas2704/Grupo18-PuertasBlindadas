BEGIN;

ALTER TABLE finanzas.cliente_financiero
  DROP CONSTRAINT IF EXISTS fk_cli_fin_cliente_ext;

COMMENT ON COLUMN finanzas.cliente_financiero.rut_cliente IS
  'RUT propio del cliente financiero; no requiere existencia previa en terreno.cliente.';

COMMIT;
