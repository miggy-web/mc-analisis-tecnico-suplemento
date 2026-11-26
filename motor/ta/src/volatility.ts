/* ============================================================
   MC Análisis Técnico™ — volatilidad y bandas · MIGGY CAPITAL

   La Parte VIII del libro. Aquí se mide cuánto se mueve el precio, no hacia
   dónde — y esa distinción es la que casi todo el mundo se salta.

   ---------------------------------------------------------------------------
   LO QUE ESTA PARTE TIENE QUE DESMONTAR

   «El precio ha tocado la banda superior, luego está caro.» Es la
   interpretación más extendida de las bandas de Bollinger y es falsa por
   construcción: las bandas son la media más dos desviaciones típicas, así que
   tocar la banda significa exactamente «se ha movido más de lo habitual
   últimamente». En un rango eso suele agotarse; en una tendencia, el precio
   camina pegado a la banda durante semanas —el *walking the band*— y quien
   vende cada toque se pasa la tendencia entera vendiendo.

   La demostración no es retórica: las mismas bandas, sobre `rango` y sobre
   `parabolica`, dan las dos figuras. El motor las calcula igual; lo que cambia
   es el régimen.
   ============================================================ */
import type { Line, Lines, Series, Source } from './types.ts';
import { at, blank, closes, highs, lows, src } from './types.ts';
import { ema, highest, lowest, rma, sma, stdev } from './ma.ts';

/* ============================================================
   True Range y ATR — Wilder

   El rango verdadero incluye el hueco respecto al cierre anterior. Ese detalle
   es todo el invento: el rango simple (máximo menos mínimo) de una vela que
   abre con un hueco enorme puede ser pequeño, y describir esa sesión como
   «tranquila» es exactamente lo contrario de lo que pasó.
   ============================================================ */
export function trueRange(s: Series): Line {
  const out = blank(s.length);
  for (let i = 0; i < s.length; i++) {
    const b = s[i];
    if (!b) continue;
    if (i === 0) {
      // Sin cierre anterior no hay hueco que medir. El rango de la vela es lo
      // único conocido, y descartarla entera perdería un dato real.
      out[i] = b.h - b.l;
      continue;
    }
    const p = s[i - 1];
    if (!p) continue;
    out[i] = Math.max(b.h - b.l, Math.abs(b.h - p.c), Math.abs(b.l - p.c));
  }
  return out;
}

export function atr(s: Series, n = 14): Line {
  const tr = trueRange(s);
  const vals = tr.map((v) => v ?? 0);
  const r = rma(vals, n);
  // El primer TR se calcula sin cierre anterior, así que el ATR arranca donde
  // la media de Wilder tiene su primer valor: índice n-1.
  return r;
}

/** ATR en porcentaje del precio. Es la forma de comparar la volatilidad de dos
 *  activos con precios distintos, y la que permite dimensionar una posición
 *  igual en los dos. */
export function atrPct(s: Series, n = 14): Line {
  const a = atr(s, n);
  const c = closes(s);
  return a.map((v, i) => (v === null || v === undefined ? null : (100 * v) / at(c, i)));
}

/** Rango medio diario: la media del recorrido de las últimas n velas. Más
 *  simple que el ATR y sin corregir huecos — el libro los enseña juntos para
 *  que se vea qué añade exactamente el «verdadero» del rango verdadero. */
export function adr(s: Series, n = 20): Line {
  return sma(s.map((b) => b.h - b.l), n);
}

/* ============================================================
   Bandas de Bollinger

   Desviación típica POBLACIONAL, que es la del indicador original. Con la
   muestral las bandas salen algo más anchas y el %B nunca coincide con el de
   la plataforma del lector — un desajuste pequeño que destruye la confianza en
   todas las figuras del capítulo.
   ============================================================ */
export function bollinger(s: Series, n = 20, k = 2, source: Source = 'close'): Lines {
  const v = src(s, source);
  const mid = sma(v, n);
  const sd = stdev(v, n);
  const upper = blank(s.length);
  const lower = blank(s.length);
  for (let i = 0; i < s.length; i++) {
    const m = mid[i];
    const d = sd[i];
    if (m === null || m === undefined || d === null || d === undefined) continue;
    upper[i] = m + k * d;
    lower[i] = m - k * d;
  }
  return { upper, mid, lower };
}

/** %B — dónde está el precio dentro de las bandas.
 *  0 = banda inferior, 1 = superior. Fuera de [0,1] el precio está FUERA de
 *  las bandas, que es lo que el ojo no distingue bien en el gráfico. */
export function percentB(s: Series, n = 20, k = 2, source: Source = 'close'): Line {
  const { upper, lower } = bollinger(s, n, k, source);
  const c = src(s, source);
  const out = blank(s.length);
  for (let i = 0; i < s.length; i++) {
    const u = upper?.[i];
    const l = lower?.[i];
    if (u === null || u === undefined || l === null || l === undefined || u === l) continue;
    out[i] = (at(c, i) - l) / (u - l);
  }
  return out;
}

/** BandWidth — cuánto miden las bandas en relación con su media.
 *  Es el número que convierte «las bandas se ven estrechas» en un dato. El
 *  squeeze del capítulo se define sobre esta línea, no sobre la impresión. */
export function bandWidth(s: Series, n = 20, k = 2, source: Source = 'close'): Line {
  const { upper, mid, lower } = bollinger(s, n, k, source);
  const out = blank(s.length);
  for (let i = 0; i < s.length; i++) {
    const u = upper?.[i];
    const m = mid?.[i];
    const l = lower?.[i];
    if (u === null || u === undefined || m === null || m === undefined || l === null || l === undefined || m === 0) continue;
    out[i] = (100 * (u - l)) / m;
  }
  return out;
}

/* ============================================================
   Canales de Keltner
   Media exponencial ± un múltiplo del ATR.

   La diferencia con Bollinger no es cosmética y el libro la explota: Bollinger
   se ensancha con la DISPERSIÓN de los cierres, Keltner con el RECORRIDO real
   de las velas. Por eso una serie de cierres tranquilos con mechas enormes
   ensancha Keltner y no Bollinger — y esa discrepancia es información.
   ============================================================ */
export function keltner(s: Series, n = 20, mult = 2, nAtr = 10, source: Source = 'close'): Lines {
  const mid = ema(src(s, source), n);
  const a = atr(s, nAtr);
  const upper = blank(s.length);
  const lower = blank(s.length);
  for (let i = 0; i < s.length; i++) {
    const m = mid[i];
    const v = a[i];
    if (m === null || m === undefined || v === null || v === undefined) continue;
    upper[i] = m + mult * v;
    lower[i] = m - mult * v;
  }
  return { upper, mid, lower };
}

/* ============================================================
   Canales de Donchian
   El máximo y el mínimo de las últimas n velas. Nada más.

   Es el indicador más honesto del libro: no suaviza, no pondera y no tiene
   parámetros ocultos. Dice literalmente dónde estuvo el precio. Fue el motor
   del sistema de las Tortugas, y se incluye para que el lector vea que un
   sistema completo puede construirse sobre dos líneas sin fórmula.
   ============================================================ */
export function donchian(s: Series, n = 20): Lines {
  const upper = highest(highs(s), n);
  const lower = lowest(lows(s), n);
  const mid = upper.map((v, i) => {
    const w = lower[i];
    return v === null || w === null || w === undefined ? null : (v + w) / 2;
  });
  return { upper, mid, lower };
}

/* ============================================================
   Volatilidad histórica
   Desviación típica de los rendimientos logarítmicos, anualizada.

   Es la única de esta parte que produce un número comparable con la
   volatilidad IMPLÍCITA de las opciones, y por eso es la bisagra con MC
   Options: la histórica dice lo que el precio HIZO, la implícita lo que el
   mercado PAGA por lo que pueda hacer.
   ============================================================ */
export function historicalVolatility(s: Series, n = 20, periodosPorAno = 252): Line {
  const c = closes(s);
  const ret: number[] = [];
  for (let i = 1; i < c.length; i++) {
    const prev = at(c, i - 1);
    ret.push(prev > 0 ? Math.log(at(c, i) / prev) : 0);
  }
  const sd = stdev(ret, n);
  const out = blank(s.length);
  for (let i = 0; i < sd.length; i++) {
    const v = sd[i];
    if (v === null || v === undefined) continue;
    out[i + 1] = v * Math.sqrt(periodosPorAno) * 100;
  }
  return out;
}

/* ============================================================
   Volatilidad de Chaikin
   Variación porcentual del rango suavizado. Sube cuando el mercado se
   acelera, sin importar la dirección.
   ============================================================ */
export function chaikinVolatility(s: Series, n = 10, cambio = 10): Line {
  const rango = ema(s.map((b) => b.h - b.l), n);
  const out = blank(s.length);
  for (let i = cambio; i < s.length; i++) {
    const a = rango[i];
    const b = rango[i - cambio];
    if (a === null || a === undefined || b === null || b === undefined || b === 0) continue;
    out[i] = (100 * (a - b)) / b;
  }
  return out;
}

/* ============================================================
   Mass Index — Dorsey
   Detecta ensanchamientos del rango: busca el «bulto de inversión», un patrón
   de expansión que suele preceder a un giro. No dice la dirección — es de los
   pocos indicadores que avisan de que ALGO va a pasar sin pronunciarse sobre
   qué, y el libro lo usa para explicar esa categoría.
   ============================================================ */
export function massIndex(s: Series, n = 9, suma = 25): Line {
  const rango = s.map((b) => b.h - b.l);
  const e1 = ema(rango, n);
  const vals: number[] = [];
  let off = -1;
  for (let i = 0; i < e1.length; i++) {
    const v = e1[i];
    if (v === null || v === undefined) continue;
    if (off < 0) off = i;
    vals.push(v);
  }
  const e2i = ema(vals, n);
  const ratio = blank(s.length);
  for (let i = 0; i < vals.length; i++) {
    const b = e2i[i];
    if (b === null || b === undefined || b === 0) continue;
    ratio[off + i] = at(vals, i) / b;
  }
  const out = blank(s.length);
  for (let i = 0; i < s.length; i++) {
    let acc = 0;
    let ok = true;
    for (let j = i - suma + 1; j <= i; j++) {
      const v = j < 0 ? null : ratio[j];
      if (v === null || v === undefined) { ok = false; break; }
      acc += v;
    }
    if (ok) out[i] = acc;
  }
  return out;
}

/* ============================================================
   Ulcer Index — Martin
   Cuánto y cuánto tiempo se ha estado por debajo del máximo reciente.

   Es el indicador de riesgo más humano del libro: la desviación típica castiga
   igual una subida brusca que una caída, y a nadie le duele una subida. El
   Ulcer solo mide la caída — y por eso aparece otra vez en la Parte XIV, junto
   al drawdown.
   ============================================================ */
export function ulcerIndex(s: Series, n = 14): Line {
  const c = closes(s);
  const out = blank(s.length);
  for (let i = n - 1; i < s.length; i++) {
    let acc = 0;
    for (let j = i - n + 1; j <= i; j++) {
      let max = at(c, i - n + 1);
      for (let k = i - n + 1; k <= j; k++) max = Math.max(max, at(c, k));
      const dd = max === 0 ? 0 : (100 * (at(c, j) - max)) / max;
      acc += dd * dd;
    }
    out[i] = Math.sqrt(acc / n);
  }
  return out;
}

/* ============================================================
   TTM Squeeze — Carter

   Está encendido cuando las bandas de Bollinger caben DENTRO de los canales de
   Keltner. Traducido: la dispersión de los cierres se ha encogido más que el
   recorrido real de las velas.

   Es la mejor pieza del libro para enseñar a leer dos indicadores JUNTOS en
   vez de por separado, porque el squeeze no existe en ninguno de los dos: solo
   existe en su relación.
   ============================================================ */
export interface Squeeze {
  /** Comprimido: Bollinger dentro de Keltner. */
  on: boolean[];
  /** La vela en la que se suelta. Es la que interesa, no las cien anteriores. */
  disparo: number[];
}

export function ttmSqueeze(s: Series, n = 20, kBB = 2, multKC = 1.5): Squeeze {
  const bb = bollinger(s, n, kBB);
  const kc = keltner(s, n, multKC, n);
  const on: boolean[] = [];
  for (let i = 0; i < s.length; i++) {
    const bu = bb.upper?.[i];
    const bl = bb.lower?.[i];
    const ku = kc.upper?.[i];
    const kl = kc.lower?.[i];
    on.push(
      bu !== null && bu !== undefined && bl !== null && bl !== undefined &&
      ku !== null && ku !== undefined && kl !== null && kl !== undefined &&
      bu < ku && bl > kl,
    );
  }
  const disparo: number[] = [];
  for (let i = 1; i < on.length; i++) if (on[i - 1] && !on[i]) disparo.push(i);
  return { on, disparo };
}

/* ---------- selector ---------- */
export type VolKind = 'atr' | 'atrpct' | 'adr' | 'bbw' | 'percentb' | 'hv' | 'chaikinvol' | 'mass' | 'ulcer';

export function volInd(s: Series, kind: VolKind, n?: number): Line {
  switch (kind) {
    case 'atr': return atr(s, n ?? 14);
    case 'atrpct': return atrPct(s, n ?? 14);
    case 'adr': return adr(s, n ?? 20);
    case 'bbw': return bandWidth(s, n ?? 20);
    case 'percentb': return percentB(s, n ?? 20);
    case 'hv': return historicalVolatility(s, n ?? 20);
    case 'chaikinvol': return chaikinVolatility(s, n ?? 10);
    case 'mass': return massIndex(s, n ?? 9);
    case 'ulcer': return ulcerIndex(s, n ?? 14);
  }
}

export const VOL_LABEL: Record<VolKind, { es: string; en: string }> = {
  atr: { es: 'Rango verdadero medio', en: 'Average True Range' },
  atrpct: { es: 'ATR porcentual', en: 'ATR percent' },
  adr: { es: 'Rango medio', en: 'Average Daily Range' },
  bbw: { es: 'Anchura de Bollinger', en: 'Bollinger BandWidth' },
  percentb: { es: '%B de Bollinger', en: 'Bollinger %B' },
  hv: { es: 'Volatilidad histórica', en: 'Historical Volatility' },
  chaikinvol: { es: 'Volatilidad de Chaikin', en: 'Chaikin Volatility' },
  mass: { es: 'Mass Index', en: 'Mass Index' },
  ulcer: { es: 'Ulcer Index', en: 'Ulcer Index' },
};
