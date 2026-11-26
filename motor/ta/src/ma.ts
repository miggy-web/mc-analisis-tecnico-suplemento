/* ============================================================
   MC Análisis Técnico™ — la familia de las medias · MIGGY CAPITAL

   Diez formas de calcular «el precio medio reciente». La Parte VI del libro
   existe para explicar que no son diez indicadores: son diez respuestas al
   mismo compromiso, y ese compromiso no se puede ganar.

     Menos retraso  ⇄  más ruido
     Más suavizado  ⇄  más tarde

   Todo lo que hace una media es elegir un punto de esa recta. Quien busca una
   media que reaccione rápido y no dé señales falsas está buscando una que no
   existe, y la mitad de los indicadores «avanzados» de esta familia se venden
   exactamente así.

   ---------------------------------------------------------------------------
   SOBRE EL CALENTAMIENTO

   Cada media dice explícitamente en qué índice empieza a tener valor, porque
   es la cifra que permite comprobar una implementación sin fiarse del dibujo:
   una EMA que empieza en la vela 0 en vez de en la 13 está sembrada mal, y en
   el gráfico se ve idéntica.
   ============================================================ */
import type { Line, Series, Source } from './types.ts';
import { at, blank, closes, src, volumes } from './types.ts';

/* ============================================================
   Media simple — SMA
   Primer valor en el índice n-1.
   ============================================================ */
export function sma(values: readonly number[], n: number): Line {
  if (n < 1) throw new RangeError('periodo mínimo 1');
  const out = blank(values.length);
  let suma = 0;
  for (let i = 0; i < values.length; i++) {
    suma += at(values, i);
    if (i >= n) suma -= at(values, i - n);
    if (i >= n - 1) out[i] = suma / n;
  }
  return out;
}

/* ============================================================
   Media exponencial — EMA

   Se siembra con la SMA de las primeras n velas, que es la convención de
   TradingView, MetaTrader y Wilder. Existe otra —empezar con el primer precio—
   y da valores distintos durante las primeras decenas de velas.

   Importa cuál se usa: un lector que replique la figura del libro en su
   plataforma y obtenga otro número concluye, con razón, que el libro está mal.
   Por eso el criterio se declara aquí y las pruebas lo fijan.
   ============================================================ */
export function ema(values: readonly number[], n: number): Line {
  if (n < 1) throw new RangeError('periodo mínimo 1');
  const out = blank(values.length);
  if (values.length < n) return out;
  const k = 2 / (n + 1);
  let acc = 0;
  for (let i = 0; i < n; i++) acc += at(values, i);
  let prev = acc / n;
  out[n - 1] = prev;
  for (let i = n; i < values.length; i++) {
    prev = (at(values, i) - prev) * k + prev;
    out[i] = prev;
  }
  return out;
}

/* ============================================================
   Media suavizada de Wilder — RMA / SMMA

   La que usan por dentro el RSI, el ATR y el ADX. Equivale a una EMA de
   periodo 2n-1, y esa equivalencia es la razón de que un RSI de 14 se sienta
   mucho más lento que una EMA de 14 — una confusión que el libro corrige con
   esta línea.
   ============================================================ */
export function rma(values: readonly number[], n: number): Line {
  if (n < 1) throw new RangeError('periodo mínimo 1');
  const out = blank(values.length);
  if (values.length < n) return out;
  let acc = 0;
  for (let i = 0; i < n; i++) acc += at(values, i);
  let prev = acc / n;
  out[n - 1] = prev;
  for (let i = n; i < values.length; i++) {
    prev = (prev * (n - 1) + at(values, i)) / n;
    out[i] = prev;
  }
  return out;
}

/* ============================================================
   Media ponderada lineal — WMA
   Pesos 1, 2, 3… n. El más reciente pesa n veces lo que el más antiguo.
   ============================================================ */
export function wma(values: readonly number[], n: number): Line {
  if (n < 1) throw new RangeError('periodo mínimo 1');
  const out = blank(values.length);
  const div = (n * (n + 1)) / 2;
  for (let i = n - 1; i < values.length; i++) {
    let acc = 0;
    for (let j = 0; j < n; j++) acc += at(values, i - n + 1 + j) * (j + 1);
    out[i] = acc / div;
  }
  return out;
}

/** Une los valores definidos de una línea para poder encadenar medias.
 *  Devuelve también el desplazamiento, para volver a alinear después. */
function compacta(line: Line): { vals: number[]; off: number } {
  const vals: number[] = [];
  let off = -1;
  for (let i = 0; i < line.length; i++) {
    const v = line[i];
    if (v === null || v === undefined) continue;
    if (off < 0) off = i;
    vals.push(v);
  }
  return { vals, off: off < 0 ? line.length : off };
}

/** Aplica una media sobre otra línea, conservando la alineación con la serie.
 *  Es lo que hace que HMA, DEMA, TEMA y la señal del MACD no se descoloquen. */
function sobre(line: Line, n: number, f: (v: readonly number[], n: number) => Line): Line {
  const { vals, off } = compacta(line);
  const inner = f(vals, n);
  const out = blank(line.length);
  for (let i = 0; i < inner.length; i++) {
    const v = inner[i];
    if (v !== null && v !== undefined) out[off + i] = v;
  }
  return out;
}

/* ============================================================
   Hull — HMA
   HMA(n) = WMA( 2·WMA(n/2) − WMA(n) , √n )

   Casi elimina el retraso, y el libro tiene que decir lo que cuesta: al
   restar dos medias puede salirse del rango de precios recientes y girar
   antes de que el precio gire. Rápida no es lo mismo que anticipada.
   ============================================================ */
export function hma(values: readonly number[], n: number): Line {
  const mitad = Math.max(1, Math.round(n / 2));
  const raiz = Math.max(1, Math.round(Math.sqrt(n)));
  const a = wma(values, mitad);
  const b = wma(values, n);
  const diff: Line = a.map((v, i) => {
    const w = b[i];
    return v === null || w === null || w === undefined ? null : 2 * v - w;
  });
  return sobre(diff, raiz, wma);
}

/* ============================================================
   Doble y triple exponencial — DEMA y TEMA
   Corrigen el retraso restando el retraso de la propia EMA.
   ============================================================ */
export function dema(values: readonly number[], n: number): Line {
  const e1 = ema(values, n);
  const e2 = sobre(e1, n, ema);
  return e1.map((v, i) => {
    const w = e2[i];
    return v === null || w === null || w === undefined ? null : 2 * v - w;
  });
}

export function tema(values: readonly number[], n: number): Line {
  const e1 = ema(values, n);
  const e2 = sobre(e1, n, ema);
  const e3 = sobre(e2, n, ema);
  return e1.map((v, i) => {
    const w = e2[i];
    const x = e3[i];
    if (v === null || w === null || w === undefined || x === null || x === undefined) return null;
    return 3 * v - 3 * w + x;
  });
}

/* ============================================================
   Kaufman adaptativa — KAMA

   Cambia de velocidad sola: acelera cuando el movimiento es eficiente —mucho
   recorrido neto por poco camino andado— y se para en cuanto el precio empieza
   a ir y venir. Es la respuesta más honesta de esta familia al problema del
   rango, y por eso el libro la usa para cerrar la Parte VI.
   ============================================================ */
export function kama(values: readonly number[], n = 10, rapida = 2, lenta = 30): Line {
  const out = blank(values.length);
  if (values.length <= n) return out;
  const kr = 2 / (rapida + 1);
  const kl = 2 / (lenta + 1);
  let prev = at(values, n - 1);
  out[n - 1] = prev;
  for (let i = n; i < values.length; i++) {
    const cambio = Math.abs(at(values, i) - at(values, i - n));
    let camino = 0;
    for (let j = i - n + 1; j <= i; j++) camino += Math.abs(at(values, j) - at(values, j - 1));
    // Eficiencia: 1 = línea recta, 0 = mucho movimiento y ningún avance.
    const er = camino === 0 ? 0 : cambio / camino;
    const sc = (er * (kr - kl) + kl) ** 2;
    prev = prev + sc * (at(values, i) - prev);
    out[i] = prev;
  }
  return out;
}

/* ============================================================
   Arnaud Legoux — ALMA
   Ventana gaussiana desplazada: se elige cuánto se suaviza (sigma) y cuánto
   se inclina hacia lo reciente (offset).
   ============================================================ */
export function alma(values: readonly number[], n = 9, offset = 0.85, sigma = 6): Line {
  const out = blank(values.length);
  const m = offset * (n - 1);
  const s = n / sigma;
  const pesos: number[] = [];
  let norm = 0;
  for (let j = 0; j < n; j++) {
    const w = Math.exp(-((j - m) ** 2) / (2 * s * s));
    pesos.push(w);
    norm += w;
  }
  for (let i = n - 1; i < values.length; i++) {
    let acc = 0;
    for (let j = 0; j < n; j++) acc += at(values, i - n + 1 + j) * at(pesos, j);
    out[i] = acc / norm;
  }
  return out;
}

/* ============================================================
   Ponderada por volumen — VWMA
   Donde más se negoció, más pesa. La diferencia con la SMA es exactamente el
   sesgo que introduce la participación, y verlas juntas es la mejor figura
   posible para explicar qué añade el volumen a un promedio.
   ============================================================ */
export function vwma(s: Series, n: number, source: Source = 'close'): Line {
  const p = src(s, source);
  const v = volumes(s);
  const out = blank(s.length);
  let sp = 0;
  let sv = 0;
  for (let i = 0; i < s.length; i++) {
    sp += at(p, i) * at(v, i);
    sv += at(v, i);
    if (i >= n) {
      sp -= at(p, i - n) * at(v, i - n);
      sv -= at(v, i - n);
    }
    if (i >= n - 1 && sv > 0) out[i] = sp / sv;
  }
  return out;
}

/* ============================================================
   Selector

   La app y el generador de figuras piden medias por nombre desde un spec
   JSON, así que el nombre tiene que resolverse en un solo sitio. Si cada
   superficie tuviera su propio `switch`, bastaría con que una escribiera
   'smma' y la otra 'rma' para que el libro y la app pintasen medias distintas
   con la misma etiqueta.
   ============================================================ */
export type MAKind = 'sma' | 'ema' | 'rma' | 'smma' | 'wma' | 'hma' | 'dema' | 'tema' | 'kama' | 'alma' | 'vwma';

export const MA_KINDS: readonly MAKind[] = [
  'sma', 'ema', 'rma', 'wma', 'hma', 'dema', 'tema', 'kama', 'alma', 'vwma',
] as const;

export function ma(s: Series, kind: MAKind, n: number, source: Source = 'close'): Line {
  const v = src(s, source);
  switch (kind) {
    case 'sma': return sma(v, n);
    case 'ema': return ema(v, n);
    case 'rma': case 'smma': return rma(v, n);
    case 'wma': return wma(v, n);
    case 'hma': return hma(v, n);
    case 'dema': return dema(v, n);
    case 'tema': return tema(v, n);
    case 'kama': return kama(v, n);
    case 'alma': return alma(v, n);
    case 'vwma': return vwma(s, n, source);
  }
}

/** Cómo se llama cada media en el libro, en los dos idiomas. Vive aquí para
 *  que una media nueva no pueda aparecer en una figura sin nombre. */
export const MA_LABEL: Record<MAKind, { es: string; en: string }> = {
  sma: { es: 'Media simple', en: 'Simple moving average' },
  ema: { es: 'Media exponencial', en: 'Exponential moving average' },
  rma: { es: 'Media de Wilder', en: 'Wilder moving average' },
  smma: { es: 'Media suavizada', en: 'Smoothed moving average' },
  wma: { es: 'Media ponderada', en: 'Weighted moving average' },
  hma: { es: 'Media de Hull', en: 'Hull moving average' },
  dema: { es: 'Doble exponencial', en: 'Double exponential' },
  tema: { es: 'Triple exponencial', en: 'Triple exponential' },
  kama: { es: 'Media adaptativa de Kaufman', en: 'Kaufman adaptive moving average' },
  alma: { es: 'Media de Arnaud Legoux', en: 'Arnaud Legoux moving average' },
  vwma: { es: 'Media ponderada por volumen', en: 'Volume weighted moving average' },
};

/* ============================================================
   Desviación típica poblacional.
   Vive aquí porque la usa Bollinger y porque la elección entre poblacional y
   muestral cambia el ancho de las bandas: Bollinger usa la POBLACIONAL, y
   quien la implementa con la muestral obtiene bandas ligeramente más anchas y
   un %B que nunca cuadra con el de su plataforma.
   ============================================================ */
export function stdev(values: readonly number[], n: number): Line {
  const out = blank(values.length);
  for (let i = n - 1; i < values.length; i++) {
    let media = 0;
    for (let j = i - n + 1; j <= i; j++) media += at(values, j);
    media /= n;
    let acc = 0;
    for (let j = i - n + 1; j <= i; j++) acc += (at(values, j) - media) ** 2;
    out[i] = Math.sqrt(acc / n);
  }
  return out;
}

/* ============================================================
   Máximo y mínimo móviles.

   Viven junto a las medias porque son la misma operación —recorrer una ventana
   que avanza— y porque los comparten media docena de indicadores de familias
   distintas: estocástico, Williams %R, Donchian, Ichimoku, Supertrend y el
   detector de swings. Duplicarlos por familia es garantizar que un día dos
   indicadores discrepen sobre cuál era el máximo de las últimas veinte velas.
   ============================================================ */
export function highest(values: readonly number[], n: number): Line {
  const out = blank(values.length);
  for (let i = n - 1; i < values.length; i++) {
    let m = at(values, i - n + 1);
    for (let j = i - n + 2; j <= i; j++) m = Math.max(m, at(values, j));
    out[i] = m;
  }
  return out;
}

export function lowest(values: readonly number[], n: number): Line {
  const out = blank(values.length);
  for (let i = n - 1; i < values.length; i++) {
    let m = at(values, i - n + 1);
    for (let j = i - n + 2; j <= i; j++) m = Math.min(m, at(values, j));
    out[i] = m;
  }
  return out;
}

/** Atajo cómodo: la SMA de los cierres de una serie. */
export const smaC = (s: Series, n: number): Line => sma(closes(s), n);
