const textoPdf = (valor: unknown) => String(valor ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^\x20-\x7E]/g, '?')
  .replace(/([\\()])/g, '\\$1');

/** Renderer PDF liviano compartido por los documentos financieros del sistema. */
export function crearPdf(lineas: string[]) {
  const porPagina = 29;
  const paginas = Array.from({ length: Math.max(1, Math.ceil(lineas.length / porPagina)) }, (_, indice) =>
    lineas.slice(indice * porPagina, (indice + 1) * porPagina));
  const objetos: string[] = ['', '<< /Type /Catalog /Pages 2 0 R >>', ''];
  const paginasIds: number[] = [];

  for (const [indice, contenido] of paginas.entries()) {
    const paginaId = objetos.length;
    const streamId = paginaId + 1;
    paginasIds.push(paginaId);
    const instrucciones = [
      'q', '0.996 0.561 0.004 rg', '50 807 495 3 re', 'f', 'Q',
      'BT', '/F1 18 Tf', '0 0 0 rg', '50 780 Td', `(${textoPdf(contenido[0] || '')}) Tj`,
      '/F1 10 Tf', '0.404 0.404 0.404 rg',
      ...contenido.slice(1).flatMap((linea) => ['0 -23 Td', `(${textoPdf(linea)}) Tj`]),
      ...(paginas.length > 1 ? ['0 -23 Td', `(Pagina ${indice + 1} de ${paginas.length}) Tj`] : []),
      'ET',
    ].join('\n');
    objetos.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 FONT_ID 0 R >> >> /Contents ${streamId} 0 R >>`);
    objetos.push(`<< /Length ${Buffer.byteLength(instrucciones, 'latin1')} >>\nstream\n${instrucciones}\nendstream`);
  }
  const fuenteId = objetos.length;
  objetos.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  objetos[2] = `<< /Type /Pages /Kids [${paginasIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${paginasIds.length} >>`;
  for (const paginaId of paginasIds) objetos[paginaId] = objetos[paginaId].replace('FONT_ID', String(fuenteId));

  let salida = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const posiciones = [0];
  for (let indice = 1; indice < objetos.length; indice++) {
    posiciones[indice] = Buffer.byteLength(salida, 'latin1');
    salida += `${indice} 0 obj\n${objetos[indice]}\nendobj\n`;
  }
  const inicioXref = Buffer.byteLength(salida, 'latin1');
  salida += `xref\n0 ${objetos.length}\n0000000000 65535 f \n${posiciones.slice(1).map((posicion) => `${String(posicion).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objetos.length} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;
  return Buffer.from(salida, 'latin1');
}

export const archivoPdf = (nombre: string, lineas: string[]) => ({
  nombre,
  mime: 'application/pdf',
  contenido: `data:application/pdf;base64,${crearPdf(lineas).toString('base64')}`,
});

export type TonoInformePdf = 'neutro' | 'exitoso' | 'rechazado' | 'fallido';

export type InformePdf = {
  titulo: string;
  subtitulo: string;
  generado: string;
  periodo: string;
  solicitante: string;
  total: number;
  filtros: Array<{ etiqueta: string; valor: string }>;
  tarjetas: Array<{ etiqueta: string; valor: string; detalle?: string; tono?: TonoInformePdf }>;
  modulos: Array<{ etiqueta: string; cantidad: number }>;
  resultados: Array<{ etiqueta: string; cantidad: number; porcentaje: number; tono?: TonoInformePdf }>;
  tabla: {
    columnas: Array<{ clave: string; etiqueta: string; ancho: number }>;
    filas: Array<Record<string, string>>;
  };
  pie: string;
};

const coloresInforme: Record<TonoInformePdf, string> = {
  neutro: '0.404 0.404 0.404',
  exitoso: '0.180 0.490 0.196',
  rechazado: '0.996 0.561 0.004',
  fallido: '0.702 0.149 0.118',
};

const textoPdfInforme = (valor: unknown) => String(valor ?? '')
  .replace(/[\u2013\u2014]/g, '-')
  .replace(/[^\x20-\x7E\xA0-\xFF]/g, '?')
  .replace(/([\\()])/g, '\\$1');

const textoInforme = (x: number, y: number, valor: unknown, tamano = 9, fuente = 'F1', color = '0 0 0') =>
  `BT /${fuente} ${tamano} Tf ${color} rg ${x} ${y} Td (${textoPdfInforme(valor)}) Tj ET`;
const rectanguloInforme = (x: number, y: number, ancho: number, alto: number, relleno: string, borde?: string) =>
  `${relleno} rg${borde ? ` ${borde} RG 0.6 w` : ''} ${x} ${y} ${ancho} ${alto} re ${borde ? 'B' : 'f'}`;
const acotarInforme = (valor: unknown, ancho: number, tamano = 8) => {
  const texto = String(valor ?? '').replace(/\s+/g, ' ').trim() || '-';
  const maximo = Math.max(4, Math.floor(ancho / (tamano * 0.48)));
  return texto.length <= maximo ? texto : `${texto.slice(0, Math.max(1, maximo - 3))}...`;
};

const ensamblarPaginasPdf = (paginas: string[][], anchoPagina = 595, altoPagina = 842) => {
  const objetos: string[] = ['', '<< /Type /Catalog /Pages 2 0 R >>', ''];
  const paginasIds: number[] = [];
  for (const instrucciones of paginas) {
    const paginaId = objetos.length, streamId = paginaId + 1;
    paginasIds.push(paginaId);
    const stream = instrucciones.join('\n');
    objetos.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${anchoPagina} ${altoPagina}] /Resources << /Font << /F1 REGULAR_ID 0 R /F2 BOLD_ID 0 R >> >> /Contents ${streamId} 0 R >>`);
    objetos.push(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
  }
  const regularId = objetos.length; objetos.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const boldId = objetos.length; objetos.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  objetos[2] = `<< /Type /Pages /Kids [${paginasIds.map(id => `${id} 0 R`).join(' ')}] /Count ${paginasIds.length} >>`;
  for (const id of paginasIds) objetos[id] = objetos[id].replace('REGULAR_ID', String(regularId)).replace('BOLD_ID', String(boldId));
  let salida = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'; const posiciones = [0];
  for (let indice = 1; indice < objetos.length; indice++) { posiciones[indice] = Buffer.byteLength(salida, 'latin1'); salida += `${indice} 0 obj\n${objetos[indice]}\nendobj\n`; }
  const inicioXref = Buffer.byteLength(salida, 'latin1');
  salida += `xref\n0 ${objetos.length}\n0000000000 65535 f \n${posiciones.slice(1).map(posicion => `${String(posicion).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objetos.length} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;
  return Buffer.from(salida, 'latin1');
};

/** Renderer estructurado para informes tabulares, sin acceder a fuentes de datos. */
export function crearInformePdf(informe: InformePdf) {
  const anchoPagina = 595, altoPagina = 842, margen = 42, anchoUtil = anchoPagina - margen * 2;
  const paginas: string[][] = [[]];
  let pagina = 0;
  const actual = () => paginas[pagina];
  const agregarEncabezado = () => {
    actual().push(rectanguloInforme(0, 815, anchoPagina, 27, '0.996 0.561 0.004'));
    actual().push(textoInforme(margen, 824, 'PUERTAS BLINDADAS', 9, 'F2', '1 1 1'));
    actual().push(textoInforme(472, 824, 'AUDITORÍA M9', 8, 'F2', '1 1 1'));
  };
  const nuevaPagina = () => { paginas.push([]); pagina += 1; agregarEncabezado(); };
  agregarEncabezado();

  actual().push(textoInforme(margen, 780, informe.titulo, 22, 'F2'));
  actual().push(textoInforme(margen, 758, informe.subtitulo, 11, 'F1', '0.404 0.404 0.404'));
  actual().push(rectanguloInforme(margen, 688, anchoUtil, 50, '0.965 0.965 0.965', '0.820 0.820 0.820'));
  actual().push(textoInforme(margen + 12, 719, `Generado: ${informe.generado}`, 8));
  actual().push(textoInforme(margen + 275, 719, `Periodo: ${acotarInforme(informe.periodo, 210, 8)}`, 8));
  actual().push(textoInforme(margen + 12, 701, `Solicitante: ${acotarInforme(informe.solicitante, 220, 8)}`, 8));
  actual().push(textoInforme(margen + 275, 701, `Eventos exportados: ${informe.total}`, 8, 'F2'));

  actual().push(textoInforme(margen, 666, 'Filtros aplicados', 10, 'F2'));
  const filtros = informe.filtros.length ? informe.filtros.map(filtro => `${filtro.etiqueta}: ${filtro.valor}`).join('  |  ') : 'Ninguno';
  actual().push(textoInforme(margen, 649, acotarInforme(filtros, anchoUtil, 8), 8, 'F1', '0.404 0.404 0.404'));

  const espacioTarjeta = 8, anchoTarjeta = (anchoUtil - espacioTarjeta * Math.max(0, informe.tarjetas.length - 1)) / Math.max(1, informe.tarjetas.length);
  informe.tarjetas.forEach((tarjeta, indice) => {
    const x = margen + indice * (anchoTarjeta + espacioTarjeta), tono = coloresInforme[tarjeta.tono || 'neutro'];
    actual().push(rectanguloInforme(x, 570, anchoTarjeta, 58, '1 1 1', '0.820 0.820 0.820'));
    actual().push(rectanguloInforme(x, 624, anchoTarjeta, 4, tono));
    actual().push(textoInforme(x + 9, 608, acotarInforme(tarjeta.etiqueta, anchoTarjeta - 18, 7), 7, 'F2', '0.404 0.404 0.404'));
    actual().push(textoInforme(x + 9, 586, tarjeta.valor, 15, 'F2'));
    if (tarjeta.detalle) actual().push(textoInforme(x + 9, 575, acotarInforme(tarjeta.detalle, anchoTarjeta - 18, 7), 7, 'F1', tono));
  });

  actual().push(textoInforme(margen, 543, 'Distribución por módulo', 10, 'F2'));
  actual().push(textoInforme(320, 543, 'Distribución por resultado', 10, 'F2'));
  const maximoModulo = Math.max(1, ...informe.modulos.map(modulo => modulo.cantidad));
  informe.modulos.slice(0, 10).forEach((modulo, indice) => {
    const y = 524 - indice * 14, ancho = Math.max(2, Math.round(modulo.cantidad / maximoModulo * 145));
    actual().push(textoInforme(margen, y, acotarInforme(modulo.etiqueta, 65, 7), 7, 'F2'));
    actual().push(rectanguloInforme(91, y - 2, ancho, 7, '0.996 0.561 0.004'));
    actual().push(textoInforme(243, y, modulo.cantidad, 7, 'F2'));
  });
  informe.resultados.forEach((resultado, indice) => {
    const y = 519 - indice * 38, tono = coloresInforme[resultado.tono || 'neutro'];
    actual().push(textoInforme(320, y + 10, resultado.etiqueta, 8, 'F2'));
    actual().push(rectanguloInforme(320, y - 4, 205, 8, '0.920 0.920 0.920'));
    actual().push(rectanguloInforme(320, y - 4, Math.max(0, Math.round(resultado.porcentaje / 100 * 205)), 8, tono));
    actual().push(textoInforme(532, y - 1, `${resultado.cantidad} (${resultado.porcentaje.toFixed(1).replace('.', ',')}%)`, 7, 'F1', tono));
  });

  const dibujarCabeceraTabla = (y: number) => {
    actual().push(rectanguloInforme(margen, y - 4, anchoUtil, 20, '0.404 0.404 0.404'));
    let x = margen;
    for (const columna of informe.tabla.columnas) {
      actual().push(textoInforme(x + 4, y + 3, acotarInforme(columna.etiqueta, columna.ancho - 8, 7), 7, 'F2', '1 1 1'));
      x += columna.ancho;
    }
  };
  actual().push(textoInforme(margen, 370, 'Detalle de eventos', 11, 'F2'));
  let y = 345;
  dibujarCabeceraTabla(y);
  y -= 23;
  for (const [indice, fila] of informe.tabla.filas.entries()) {
    if (y < 65) { nuevaPagina(); actual().push(textoInforme(margen, 785, 'Detalle de eventos', 11, 'F2')); y = 758; dibujarCabeceraTabla(y); y -= 23; }
    if (indice % 2 === 1) actual().push(rectanguloInforme(margen, y - 7, anchoUtil, 22, '0.965 0.965 0.965'));
    let x = margen;
    for (const columna of informe.tabla.columnas) {
      const valor = acotarInforme(fila[columna.clave], columna.ancho - 8, 7);
      const color = columna.clave === 'resultado' ? coloresInforme[(fila.tonoResultado as TonoInformePdf) || 'neutro'] : '0 0 0';
      actual().push(textoInforme(x + 4, y, valor, 7, columna.clave === 'resultado' ? 'F2' : 'F1', color));
      x += columna.ancho;
    }
    actual().push('0.875 0.875 0.875 RG 0.3 w 42 ' + (y - 8) + ' m 553 ' + (y - 8) + ' l S');
    y -= 23;
  }

  const totalPaginas = paginas.length;
  paginas.forEach((instrucciones, indice) => {
    instrucciones.push('0.820 0.820 0.820 RG 0.5 w 42 39 m 553 39 l S');
    instrucciones.push(textoInforme(margen, 22, informe.pie, 7, 'F1', '0.404 0.404 0.404'));
    instrucciones.push(textoInforme(493, 22, `Página ${indice + 1} de ${totalPaginas}`, 7, 'F2', '0.404 0.404 0.404'));
  });

  return ensamblarPaginasPdf(paginas, anchoPagina, altoPagina);
}

export const archivoPdfInforme = (nombre: string, informe: InformePdf) => ({
  nombre,
  mime: 'application/pdf',
  contenido: `data:application/pdf;base64,${crearInformePdf(informe).toString('base64')}`,
});

export type TarjetaDocumentoPdf = { etiqueta: string; valor: string; detalle?: string; tono?: TonoInformePdf };
export type SerieDocumentoPdf = { etiqueta: string; valores: Array<number | null>; color?: 'naranja' | 'gris' | 'negro' | 'verde'; estilo?: 'barra' | 'linea'; eje?: 'izquierdo' | 'derecho' };
export type BloqueDocumentoPdf =
  | { tipo: 'tarjetas'; tarjetas: TarjetaDocumentoPdf[] }
  | { tipo: 'grafico'; titulo: string; categorias: string[]; series: SerieDocumentoPdf[]; formato?: 'moneda' | 'numero' | 'porcentaje'; ejeIzquierdo?: string; ejeDerecho?: { etiqueta: string; formato?: 'moneda' | 'numero' | 'porcentaje'; minimo?: number; maximo?: number }; alto?: number; nota?: string }
  | { tipo: 'barras'; titulo: string; filas: Array<{ etiqueta: string; valor: number; detalle?: string }>; formato?: 'moneda' | 'numero' | 'porcentaje'; maximoFilas?: number }
  | { tipo: 'tabla'; titulo: string; columnas: Array<{ clave: string; etiqueta: string; ancho: number; alinear?: 'izquierda' | 'derecha' }>; filas: Array<Record<string, string>>; nota?: string }
  | { tipo: 'notas'; titulo?: string; lineas: string[]; tono?: TonoInformePdf };

export type DocumentoGerencialPdf = {
  titulo: string;
  subtitulo: string;
  generado: string;
  periodo: string;
  filtros: string;
  moneda?: string;
  paginas: Array<{ titulo: string; subtitulo?: string; bloques: BloqueDocumentoPdf[] }>;
  pie: string;
};

const coloresSeries = { naranja: '0.996 0.561 0.004', gris: '0.404 0.404 0.404', negro: '0 0 0', verde: '0.180 0.490 0.196' };
const formatoEscala = (valor: number, formato: 'moneda' | 'numero' | 'porcentaje' = 'numero') => {
  if (formato === 'porcentaje') return `${valor.toFixed(0)}%`;
  if (formato === 'moneda') {
    const absoluto = Math.abs(valor), signo = valor < 0 ? '-' : '';
    if (absoluto >= 1_000_000_000) return `${signo}$${(absoluto / 1_000_000_000).toFixed(1).replace('.', ',')} mil M`;
    if (absoluto >= 1_000_000) return `${signo}$${(absoluto / 1_000_000).toFixed(1).replace('.', ',')} M`;
    if (absoluto >= 1_000) return `${signo}$${(absoluto / 1_000).toFixed(0)} mil`;
    return `${signo}$${Math.round(absoluto)}`;
  }
  return Math.abs(valor) >= 1_000 ? `${(valor / 1_000).toFixed(1).replace('.', ',')} mil` : String(Math.round(valor));
};
const dividirTextoInforme = (valor: unknown, ancho: number, tamano = 8, maximoLineas = 4) => {
  const palabras = String(valor ?? '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const limite = Math.max(8, Math.floor(ancho / (tamano * 0.48))), lineas: string[] = [];
  let actual = '';
  for (const palabra of palabras) {
    if (`${actual} ${palabra}`.trim().length <= limite) actual = `${actual} ${palabra}`.trim();
    else { if (actual) lineas.push(actual); actual = palabra; }
    if (lineas.length >= maximoLineas) break;
  }
  if (actual && lineas.length < maximoLineas) lineas.push(actual);
  if (palabras.join(' ').length > lineas.join(' ').length && lineas.length) lineas[lineas.length - 1] = acotarInforme(`${lineas[lineas.length - 1]}...`, ancho, tamano);
  return lineas.length ? lineas : ['No disponible para este período'];
};

// MIDAS: este renderer sólo dibuja; las reglas y los montos deben llegar resueltos por cada módulo.
export function crearDocumentoGerencialPdf(documento: DocumentoGerencialPdf) {
  const anchoPagina = 595, altoPagina = 842, margen = 42, anchoUtil = 511;
  const paginas = documento.paginas.map((pagina, indicePagina) => {
    const instrucciones: string[] = [];
    instrucciones.push(rectanguloInforme(0, 815, anchoPagina, 27, '0.996 0.561 0.004'));
    instrucciones.push(textoInforme(margen, 824, 'PUERTAS BLINDADAS', 9, 'F2', '1 1 1'));
    instrucciones.push(textoInforme(410, 824, acotarInforme(documento.titulo, 143, 8), 8, 'F2', '1 1 1'));
    instrucciones.push(textoInforme(margen, 780, pagina.titulo, indicePagina === 0 ? 22 : 18, 'F2'));
    if (pagina.subtitulo) instrucciones.push(textoInforme(margen, 758, acotarInforme(pagina.subtitulo, anchoUtil, 9), 9, 'F1', '0.404 0.404 0.404'));
    let y = pagina.subtitulo ? 730 : 746;
    if (indicePagina === 0) {
      instrucciones.push(rectanguloInforme(margen, y - 53, anchoUtil, 52, '0.965 0.965 0.965', '0.820 0.820 0.820'));
      instrucciones.push(textoInforme(margen + 12, y - 20, `Generado: ${documento.generado}`, 8));
      instrucciones.push(textoInforme(margen + 275, y - 20, `Período: ${acotarInforme(documento.periodo, 215, 8)}`, 8));
      instrucciones.push(textoInforme(margen + 12, y - 38, `Filtros: ${acotarInforme(documento.filtros || 'Ninguno', 240, 8)}`, 8));
      instrucciones.push(textoInforme(margen + 275, y - 38, `Moneda: ${documento.moneda || 'Según fuente'}`, 8, 'F2'));
      y -= 76;
    }
    const tituloBloque = (titulo: string) => { instrucciones.push(textoInforme(margen, y, titulo, 11, 'F2')); y -= 22; };
    for (const bloque of pagina.bloques) {
      if (bloque.tipo === 'tarjetas') {
        const espacio = 8, ancho = (anchoUtil - espacio * Math.max(0, bloque.tarjetas.length - 1)) / Math.max(1, bloque.tarjetas.length);
        bloque.tarjetas.forEach((tarjeta, indice) => {
          const x = margen + indice * (ancho + espacio), tono = coloresInforme[tarjeta.tono || 'neutro'];
          instrucciones.push(rectanguloInforme(x, y - 72, ancho, 66, '1 1 1', '0.820 0.820 0.820'));
          instrucciones.push(rectanguloInforme(x, y - 10, ancho, 4, tono));
          instrucciones.push(textoInforme(x + 9, y - 27, acotarInforme(tarjeta.etiqueta, ancho - 18, 7), 7, 'F2', '0.404 0.404 0.404'));
          instrucciones.push(textoInforme(x + 9, y - 49, acotarInforme(tarjeta.valor, ancho - 18, 14), 14, 'F2'));
          if (tarjeta.detalle) instrucciones.push(textoInforme(x + 9, y - 64, acotarInforme(tarjeta.detalle, ancho - 18, 6.5), 6.5, 'F1', tono));
        });
        y -= 92;
      } else if (bloque.tipo === 'grafico') {
        tituloBloque(bloque.titulo);
        const alto = bloque.alto || 170, tieneEjeDerecho = Boolean(bloque.ejeDerecho || bloque.series.some(serie => serie.eje === 'derecho'));
        const x0 = margen + 42, y0 = y - alto + 30, ancho = anchoUtil - (tieneEjeDerecho ? 88 : 58), altoGrafico = alto - 48;
        const seriesIzquierda = bloque.series.filter(serie => serie.eje !== 'derecho');
        const seriesDerecha = bloque.series.filter(serie => serie.eje === 'derecho');
        const valores = bloque.series.flatMap(serie => serie.valores.filter((valor): valor is number => valor !== null && Number.isFinite(valor)));
        if (!valores.length) {
          instrucciones.push(textoInforme(margen + 12, y - 34, 'No disponible para este período', 9, 'F1', '0.404 0.404 0.404'));
        } else {
          const valoresIzquierda = seriesIzquierda.flatMap(serie => serie.valores.filter((valor): valor is number => valor !== null && Number.isFinite(valor)));
          const valoresDerecha = seriesDerecha.flatMap(serie => serie.valores.filter((valor): valor is number => valor !== null && Number.isFinite(valor)));
          const minimo = Math.min(0, ...(valoresIzquierda.length ? valoresIzquierda : [0])), maximo = Math.max(0, ...(valoresIzquierda.length ? valoresIzquierda : [1])), rango = maximo - minimo || 1;
          const minimoDerecho = bloque.ejeDerecho?.minimo ?? Math.min(0, ...(valoresDerecha.length ? valoresDerecha : [0]));
          const maximoDerecho = bloque.ejeDerecho?.maximo ?? Math.max(0, ...(valoresDerecha.length ? valoresDerecha : [1]));
          const rangoDerecho = maximoDerecho - minimoDerecho || 1;
          const ejeY = y0 + ((0 - minimo) / rango) * altoGrafico;
          instrucciones.push(`0.820 0.820 0.820 RG 0.5 w ${x0} ${y0} m ${x0} ${y0 + altoGrafico} l S`);
          if (tieneEjeDerecho) instrucciones.push(`0.820 0.820 0.820 RG 0.5 w ${x0 + ancho} ${y0} m ${x0 + ancho} ${y0 + altoGrafico} l S`);
          instrucciones.push(`0.820 0.820 0.820 RG 0.5 w ${x0} ${ejeY} m ${x0 + ancho} ${ejeY} l S`);
          for (let paso = 0; paso <= 3; paso++) {
            const valor = minimo + rango * paso / 3, yy = y0 + altoGrafico * paso / 3;
            instrucciones.push(textoInforme(margen, yy - 2, formatoEscala(valor, bloque.formato), 6.5, 'F1', '0.404 0.404 0.404'));
            if (tieneEjeDerecho) {
              const valorDerecho = minimoDerecho + rangoDerecho * paso / 3;
              instrucciones.push(textoInforme(x0 + ancho + 6, yy - 2, formatoEscala(valorDerecho, bloque.ejeDerecho?.formato), 6.5, 'F1', '0.404 0.404 0.404'));
            }
            instrucciones.push(`0.920 0.920 0.920 RG 0.25 w ${x0} ${yy} m ${x0 + ancho} ${yy} l S`);
          }
          if (bloque.ejeIzquierdo) instrucciones.push(textoInforme(margen, y0 + altoGrafico + 25, `Eje izquierdo: ${bloque.ejeIzquierdo}`, 6.5, 'F1', '0.404 0.404 0.404'));
          if (bloque.ejeDerecho) instrucciones.push(textoInforme(x0 + ancho - 72, y0 + altoGrafico + 25, `Eje derecho: ${bloque.ejeDerecho.etiqueta}`, 6.5, 'F1', '0.404 0.404 0.404'));
          const pasoX = ancho / Math.max(1, bloque.categorias.length), barras = bloque.series.filter(serie => serie.estilo !== 'linea');
          bloque.series.forEach((serie, indiceSerie) => {
            const color = coloresSeries[serie.color || (indiceSerie === 0 ? 'naranja' : indiceSerie === 1 ? 'gris' : 'negro')];
            const escalaDerecha = serie.eje === 'derecho';
            const minimoSerie = escalaDerecha ? minimoDerecho : minimo, rangoSerie = escalaDerecha ? rangoDerecho : rango;
            if (serie.estilo === 'linea') {
              const puntos = serie.valores.map((valor, indice) => valor === null ? null : { x: x0 + pasoX * (indice + 0.5), y: y0 + ((valor - minimoSerie) / rangoSerie) * altoGrafico }).filter((punto): punto is { x: number; y: number } => punto !== null);
              if (puntos.length > 1) instrucciones.push(`${color} RG 1.5 w ${puntos.map((punto, indice) => `${punto.x} ${punto.y} ${indice ? 'l' : 'm'}`).join(' ')} S`);
              for (const punto of puntos) instrucciones.push(`${color} rg ${punto.x - 2} ${punto.y - 2} 4 4 re f`);
            } else serie.valores.forEach((valor, indice) => {
              if (valor === null) return;
              const anchoBarra = Math.max(2, pasoX * 0.7 / Math.max(1, barras.length)), x = x0 + pasoX * indice + pasoX * 0.15 + barras.indexOf(serie) * anchoBarra;
              const yy = y0 + ((valor - minimoSerie) / rangoSerie) * altoGrafico, base = escalaDerecha ? y0 + ((0 - minimoDerecho) / rangoDerecho) * altoGrafico : ejeY;
              instrucciones.push(rectanguloInforme(x, Math.min(base, yy), anchoBarra - 1, Math.max(1, Math.abs(yy - base)), color));
            });
          });
          bloque.categorias.forEach((categoria, indice) => instrucciones.push(textoInforme(x0 + pasoX * indice + 2, y0 - 13, acotarInforme(categoria, pasoX - 2, 6), 6, 'F1', '0.404 0.404 0.404')));
          let lx = x0;
          bloque.series.forEach((serie, indice) => { const color = coloresSeries[serie.color || (indice === 0 ? 'naranja' : indice === 1 ? 'gris' : 'negro')]; instrucciones.push(rectanguloInforme(lx, y0 + altoGrafico + 12, 10, 5, color)); instrucciones.push(textoInforme(lx + 14, y0 + altoGrafico + 11, serie.etiqueta, 7)); lx += Math.min(165, 20 + serie.etiqueta.length * 4.2); });
        }
        y -= alto + 18;
        if (bloque.nota) { instrucciones.push(textoInforme(margen, y + 8, acotarInforme(bloque.nota, anchoUtil, 7), 7, 'F1', '0.404 0.404 0.404')); y -= 12; }
      } else if (bloque.tipo === 'barras') {
        tituloBloque(bloque.titulo); const filas = bloque.filas.slice(0, bloque.maximoFilas || 10), maximo = Math.max(1, ...filas.map(fila => Math.abs(fila.valor)));
        if (!filas.length) { instrucciones.push(textoInforme(margen + 12, y - 8, 'No disponible para este período', 9, 'F1', '0.404 0.404 0.404')); y -= 32; }
        else for (const fila of filas) { instrucciones.push(textoInforme(margen, y, acotarInforme(fila.etiqueta, 155, 7), 7, 'F2')); instrucciones.push(rectanguloInforme(205, y - 2, Math.max(2, Math.abs(fila.valor) / maximo * 225), 8, '0.996 0.561 0.004')); instrucciones.push(textoInforme(438, y, fila.detalle || formatoEscala(fila.valor, bloque.formato), 7, 'F2')); y -= 21; }
        y -= 12;
      } else if (bloque.tipo === 'tabla') {
        tituloBloque(bloque.titulo); instrucciones.push(rectanguloInforme(margen, y - 4, anchoUtil, 20, '0.404 0.404 0.404'));
        let x = margen; for (const columna of bloque.columnas) { instrucciones.push(textoInforme(x + 4, y + 3, acotarInforme(columna.etiqueta, columna.ancho - 8, 7), 7, 'F2', '1 1 1')); x += columna.ancho; } y -= 23;
        bloque.filas.forEach((fila, indice) => { if (indice % 2) instrucciones.push(rectanguloInforme(margen, y - 7, anchoUtil, 22, '0.965 0.965 0.965')); let xx = margen; for (const columna of bloque.columnas) { const valor = acotarInforme(fila[columna.clave] || '—', columna.ancho - 8, 7); const posicion = columna.alinear === 'derecha' ? xx + Math.max(4, columna.ancho - 8 - valor.length * 3.4) : xx + 4; instrucciones.push(textoInforme(posicion, y, valor, 7)); xx += columna.ancho; } instrucciones.push(`0.875 0.875 0.875 RG 0.3 w ${margen} ${y - 8} m ${margen + anchoUtil} ${y - 8} l S`); y -= 23; });
        if (bloque.nota) { instrucciones.push(textoInforme(margen, y, acotarInforme(bloque.nota, anchoUtil, 7), 7, 'F1', '0.404 0.404 0.404')); y -= 16; } else y -= 8;
      } else {
        if (bloque.titulo) tituloBloque(bloque.titulo);
        const tono = coloresInforme[bloque.tono || 'neutro'];
        for (const linea of bloque.lineas.flatMap(linea => dividirTextoInforme(linea, anchoUtil - 22, 8, 3))) { instrucciones.push(textoInforme(margen + 12, y, `- ${linea}`, 8, 'F1', tono)); y -= 15; }
        y -= 8;
      }
    }
    instrucciones.push('0.820 0.820 0.820 RG 0.5 w 42 39 m 553 39 l S');
    instrucciones.push(textoInforme(margen, 22, documento.pie, 7, 'F1', '0.404 0.404 0.404'));
    instrucciones.push(textoInforme(493, 22, `Página ${indicePagina + 1} de ${documento.paginas.length}`, 7, 'F2', '0.404 0.404 0.404'));
    return instrucciones;
  });
  return ensamblarPaginasPdf(paginas, anchoPagina, altoPagina);
}

export const archivoPdfGerencial = (nombre: string, documento: DocumentoGerencialPdf) => ({
  nombre,
  mime: 'application/pdf',
  contenido: `data:application/pdf;base64,${crearDocumentoGerencialPdf(documento).toString('base64')}`,
});
