ALTER TABLE finanzas.reversion_nota_venta ADD COLUMN destino_excedente VARCHAR(30);
ALTER TABLE finanzas.reversion_nota_venta ADD CONSTRAINT destino_excedente_valido CHECK (destino_excedente IS NULL OR destino_excedente IN ('devolucion','saldo_favor'));
