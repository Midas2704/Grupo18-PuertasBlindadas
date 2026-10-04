-- La política de sesión única se controla temporalmente desde M4_SESION_UNICA.
-- El índice parcial impedía incluso el modo de sesiones múltiples.
DROP INDEX IF EXISTS terreno.sesion_unica_vigente;
