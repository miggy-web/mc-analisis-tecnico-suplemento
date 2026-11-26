/* ============================================================
   MC Análisis Técnico™ — tipos del motor · MIGGY CAPITAL

   Todo lo que calcula este paquete entra y sale con estas formas. Son cuatro
   decisiones y las cuatro se pagaron antes en otros libros del ecosistema.
   ============================================================ */

/** Una vela. El volumen NO es opcional: media enciclopedia (VWAP, perfil, OBV,
 *  MFI, footprint) no existe sin él, y hacerlo opcional obliga a comprobarlo en
 *  cuarenta sitios para acabar inventándolo en el que se olvide. */
export interface Bar {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export type Series = Bar[];

/* ============================================================
   La decisión que evita el fallo más caro de un libro de análisis técnico.

   Un indicador con periodo 14 no tiene valor en las trece primeras velas. Hay
   tres formas de representarlo y dos son trampas:

     · devolver 0        → el gráfico pinta una línea plana en cero durante
                           trece velas y parece un dato, no un hueco;
     · devolver un array
       más corto (n-13)  → el índice deja de coincidir con el de las velas, y
                           entonces «el RSI de la vela 40» es en realidad el de
                           la 53. Nadie lo nota: la línea se dibuja preciosa,
                           solo que trece velas corrida.

   Aquí se devuelve SIEMPRE un array de la misma longitud que la serie, con
   `null` donde el indicador todavía no puede decir nada. Así `rsi[i]` es el
   RSI de `bars[i]` y no hay aritmética de desplazamientos en ningún sitio.
   ============================================================ */
export type Line = (number | null)[];

/** Un indicador que devuelve varias líneas alineadas (MACD, Bollinger,
 *  estocástico, Ichimoku). Las claves son las del libro: `macd`, `signal`,
 *  `hist`; `upper`, `mid`, `lower`. */
export type Lines = Record<string, Line>;

/** De dónde saca sus números un indicador. Lo que en TradingView es el campo
 *  «source», y que en la enciclopedia importa porque cambiar `close` por
 *  `hlc3` mueve las señales sin que el lector sepa por qué. */
export type Source = 'open' | 'high' | 'low' | 'close' | 'hl2' | 'hlc3' | 'ohlc4' | 'volume';

/* ---------- extractores ---------- */

export const opens = (s: Series): number[] => s.map((b) => b.o);
export const highs = (s: Series): number[] => s.map((b) => b.h);
export const lows = (s: Series): number[] => s.map((b) => b.l);
export const closes = (s: Series): number[] => s.map((b) => b.c);
export const volumes = (s: Series): number[] => s.map((b) => b.v);

/** Precio medio de la vela. */
export const hl2 = (s: Series): number[] => s.map((b) => (b.h + b.l) / 2);
/** Precio típico: el que usan CCI, MFI y el VWAP clásico. */
export const hlc3 = (s: Series): number[] => s.map((b) => (b.h + b.l + b.c) / 3);
/** Precio medio ponderado de la vela entera. */
export const ohlc4 = (s: Series): number[] => s.map((b) => (b.o + b.h + b.l + b.c) / 4);

export function src(s: Series, source: Source = 'close'): number[] {
  switch (source) {
    case 'open': return opens(s);
    case 'high': return highs(s);
    case 'low': return lows(s);
    case 'hl2': return hl2(s);
    case 'hlc3': return hlc3(s);
    case 'ohlc4': return ohlc4(s);
    case 'volume': return volumes(s);
    default: return closes(s);
  }
}

/* ---------- utilidades internas ---------- */

/** Un array de `n` huecos. El punto de partida de todo indicador. */
export const blank = (n: number): Line => new Array<number | null>(n).fill(null);

/** Lectura segura de un array de números.
 *
 *  `noUncheckedIndexedAccess` está activo en el repo, así que `a[i]` es
 *  `number | undefined` aunque el índice sea correcto. Sin esto, el motor se
 *  llenaría de `!` y bastaría uno mal puesto para propagar un `undefined` que
 *  acaba en un `NaN` silencioso en mitad de una figura. */
export function at(a: readonly number[], i: number): number {
  const v = a[i];
  if (v === undefined) throw new RangeError(`índice fuera de rango: ${i} de ${a.length}`);
  return v;
}

/** Lectura de una línea que puede tener huecos. */
export function lat(a: Line, i: number): number | null {
  return a[i] ?? null;
}

/** Redondeo a un número de decimales. Solo para PRESENTAR: el motor calcula
 *  siempre en doble precisión y redondea al final, porque redondear a mitad de
 *  una media exponencial arrastra el error hasta el final de la serie. */
export function round(v: number, dec = 2): number {
  const f = 10 ** dec;
  return Math.round(v * f) / f;
}

/** Redondea una línea entera, conservando los huecos. */
export function roundLine(line: Line, dec = 2): Line {
  return line.map((v) => (v === null ? null : round(v, dec)));
}

/** ¿Cuántos valores reales tiene esta línea? Lo usan las pruebas para
 *  comprobar que el periodo de calentamiento es exactamente el que dice la
 *  teoría, que es la clase de error que nadie ve en un gráfico. */
export function defined(line: Line): number {
  return line.reduce<number>((n, v) => (v === null ? n : n + 1), 0);
}

/** El primer índice con valor, o -1. */
export function firstDefined(line: Line): number {
  for (let i = 0; i < line.length; i++) if (line[i] !== null) return i;
  return -1;
}
