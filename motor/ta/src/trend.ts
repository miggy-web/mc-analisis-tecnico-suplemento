/* ============================================================
   MC Análisis Técnico™ — indicadores de tendencia · MIGGY CAPITAL

   Los que responden a «¿hay tendencia?» antes que a «¿hacia dónde?». La
   distinción no es académica: es la que decide si el resto del panel sirve.
   Un cruce de medias en un mercado sin tendencia no es una señal débil, es una
   señal que no significa nada, y el ADX está aquí precisamente para poder
   decirlo con un número antes de mirar el cruce.

   Aquí viven también los tres sistemas híbridos —Supertrend, SAR, Ichimoku—,
   que no son indicadores sino métodos completos comprimidos en un dibujo. El
   libro los trata como lo que son, y eso incluye decir qué decisiones toman
   por ti sin preguntarte.
   ============================================================ */
import type { Line, Lines, Series } from './types.ts';
import { at, blank, closes, highs, lows, src } from './types.ts';
import { ema, highest, lowest, rma, sma } from './ma.ts';
import { atr } from './volatility.ts';

/* ============================================================
   ADX y direccionales — Wilder

   El ADX mide la FUERZA de la tendencia, no su dirección: sube igual en una
   caída violenta que en una subida limpia. Es el error de lectura más repetido
   de este indicador, y la razón de que se publique siempre acompañado de +DI y
   −DI, que son los que sí llevan el signo.

   Convención: por debajo de 20–25 no hay tendencia que aprovechar. No es una
   ley — es el umbral que Wilder propuso y que el libro usa siempre igual para
   que las figuras sean comparables entre capítulos.
   ============================================================ */
export function adx(s: Series, n = 14): Lines {
  const len = s.length;
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const tr: number[] = [];

  for (let i = 1; i < len; i++) {
    const b = s[i];
    const p = s[i - 1];
    if (!b || !p) { plusDM.push(0); minusDM.push(0); tr.push(0); continue; }
    const up = b.h - p.h;
    const dn = p.l - b.l;
    // Solo cuenta el movimiento direccional MAYOR. Si los dos crecen, la vela
    // es un outside bar y no informa de dirección: los dos se anulan.
    plusDM.push(up > dn && up > 0 ? up : 0);
    minusDM.push(dn > up && dn > 0 ? dn : 0);
    tr.push(Math.max(b.h - b.l, Math.abs(b.h - p.c), Math.abs(b.l - p.c)));
  }

  const sp = rma(plusDM, n);
  const sm = rma(minusDM, n);
  const st = rma(tr, n);

  const pdi = blank(len);
  const mdi = blank(len);
  const dxVals: number[] = [];
  let offDx = -1;

  for (let i = 0; i < sp.length; i++) {
    const a = sp[i];
    const b = sm[i];
    const t = st[i];
    if (a === null || a === undefined || b === null || b === undefined || t === null || t === undefined || t === 0) continue;
    const p = (100 * a) / t;
    const m = (100 * b) / t;
    pdi[i + 1] = p;
    mdi[i + 1] = m;
    const suma = p + m;
    if (offDx < 0) offDx = i + 1;
    dxVals.push(suma === 0 ? 0 : (100 * Math.abs(p - m)) / suma);
  }

  const adxInner = rma(dxVals, n);
  const linea = blank(len);
  for (let i = 0; i < adxInner.length; i++) {
    const v = adxInner[i];
    if (v !== null && v !== undefined && offDx >= 0) linea[offDx + i] = v;
  }

  return { adx: linea, plusDI: pdi, minusDI: mdi };
}

/* ============================================================
   Aroon — Chande
   Cuántas velas hace del máximo y del mínimo de la ventana.

   Mide el TIEMPO desde el último extremo, no el precio. Es el único de esta
   familia que lo hace, y por eso aporta algo que ni el ADX ni las medias
   contienen: una tendencia sana renueva máximos a menudo, y eso se ve aquí
   antes que en un cruce.
   ============================================================ */
export function aroon(s: Series, n = 14): Lines {
  const h = highs(s);
  const l = lows(s);
  const up = blank(s.length);
  const dn = blank(s.length);
  const osc = blank(s.length);
  for (let i = n; i < s.length; i++) {
    let kh = i - n;
    let kl = i - n;
    for (let j = i - n; j <= i; j++) {
      if (at(h, j) >= at(h, kh)) kh = j;
      if (at(l, j) <= at(l, kl)) kl = j;
    }
    const u = (100 * (n - (i - kh))) / n;
    const d = (100 * (n - (i - kl))) / n;
    up[i] = u;
    dn[i] = d;
    osc[i] = u - d;
  }
  return { up, down: dn, osc };
}

/* ============================================================
   Vortex — Botes y Siepman
   Dos líneas que se cruzan cuando cambia la dirección dominante. Su valor
   frente al ADX es que lleva el signo dentro, sin necesitar dos indicadores.
   ============================================================ */
export function vortex(s: Series, n = 14): Lines {
  const vmP: number[] = [];
  const vmM: number[] = [];
  const tr: number[] = [];
  for (let i = 1; i < s.length; i++) {
    const b = s[i];
    const p = s[i - 1];
    if (!b || !p) { vmP.push(0); vmM.push(0); tr.push(0); continue; }
    vmP.push(Math.abs(b.h - p.l));
    vmM.push(Math.abs(b.l - p.h));
    tr.push(Math.max(b.h - b.l, Math.abs(b.h - p.c), Math.abs(b.l - p.c)));
  }
  const suma = (a: readonly number[], i: number) => {
    let acc = 0;
    for (let j = i - n + 1; j <= i; j++) acc += at(a, j);
    return acc;
  };
  const vip = blank(s.length);
  const vim = blank(s.length);
  for (let i = n - 1; i < vmP.length; i++) {
    const t = suma(tr, i);
    if (t === 0) continue;
    vip[i + 1] = suma(vmP, i) / t;
    vim[i + 1] = suma(vmM, i) / t;
  }
  return { plus: vip, minus: vim };
}

/* ============================================================
   Supertrend
   Bandas de ATR que se convierten en una sola línea que solo puede ir en una
   dirección hasta que el precio la cruza.

   El detalle que casi todas las implementaciones caseras se saltan —y que
   cambia el resultado— es el TRINQUETE: mientras la tendencia no cambie, la
   banda solo puede apretarse, nunca aflojarse. Sin eso, la línea se aleja
   cuando la volatilidad sube y deja de servir como stop, que es su único uso.
   ============================================================ */
export function supertrend(s: Series, n = 10, mult = 3): { line: Line; dir: (1 | -1 | null)[] } {
  const a = atr(s, n);
  const medio = src(s, 'hl2');
  const line = blank(s.length);
  const dir: (1 | -1 | null)[] = new Array(s.length).fill(null);

  let arriba = 0;
  let abajo = 0;
  let tendencia: 1 | -1 = 1;
  let iniciado = false;

  for (let i = 0; i < s.length; i++) {
    const v = a[i];
    const b = s[i];
    if (v === null || v === undefined || !b) continue;

    let sup = at(medio, i) + mult * v;
    let inf = at(medio, i) - mult * v;

    if (iniciado) {
      const prev = s[i - 1];
      // El trinquete: la banda se aprieta o se queda, nunca se afloja.
      if (prev && (sup < arriba || prev.c > arriba)) arriba = sup; else sup = arriba;
      if (prev && (inf > abajo || prev.c < abajo)) abajo = inf; else inf = abajo;
      arriba = sup;
      abajo = inf;
      if (tendencia === 1 && b.c < abajo) tendencia = -1;
      else if (tendencia === -1 && b.c > arriba) tendencia = 1;
    } else {
      arriba = sup;
      abajo = inf;
      tendencia = b.c >= at(medio, i) ? 1 : -1;
      iniciado = true;
    }

    dir[i] = tendencia;
    line[i] = tendencia === 1 ? abajo : arriba;
  }
  return { line, dir };
}

/* ============================================================
   Parabolic SAR — Wilder

   Un stop que se acelera. El factor de aceleración crece cada vez que la
   tendencia hace un extremo nuevo, así que el stop persigue al precio cada vez
   más deprisa.

   Lo que el libro tiene que decir de él es que SIEMPRE está en el mercado: no
   tiene estado neutro, así que en un lateral da la vuelta una y otra vez. No
   es un defecto de implementación — es lo que el indicador es.
   ============================================================ */
export function parabolicSar(s: Series, paso = 0.02, maximo = 0.2): { sar: Line; dir: (1 | -1 | null)[] } {
  const sar = blank(s.length);
  const dir: (1 | -1 | null)[] = new Array(s.length).fill(null);
  if (s.length < 2) return { sar, dir };

  const b0 = s[0];
  const b1 = s[1];
  if (!b0 || !b1) return { sar, dir };

  let alcista = b1.c >= b0.c;
  let af = paso;
  let ep = alcista ? Math.max(b0.h, b1.h) : Math.min(b0.l, b1.l);
  let valor = alcista ? Math.min(b0.l, b1.l) : Math.max(b0.h, b1.h);

  for (let i = 1; i < s.length; i++) {
    const b = s[i];
    const p = s[i - 1];
    if (!b || !p) continue;

    valor = valor + af * (ep - valor);

    /* El SAR no puede meterse dentro del rango de las dos velas anteriores. Sin
       este recorte se producen giros falsos en cuanto hay una vela grande: el
       stop queda tocado por una vela que ya había ocurrido. */
    if (alcista) valor = Math.min(valor, p.l, b.l);
    else valor = Math.max(valor, p.h, b.h);

    if (alcista && b.l < valor) {
      alcista = false;
      valor = ep;
      ep = b.l;
      af = paso;
    } else if (!alcista && b.h > valor) {
      alcista = true;
      valor = ep;
      ep = b.h;
      af = paso;
    } else if (alcista && b.h > ep) {
      ep = b.h;
      af = Math.min(maximo, af + paso);
    } else if (!alcista && b.l < ep) {
      ep = b.l;
      af = Math.min(maximo, af + paso);
    }

    sar[i] = valor;
    dir[i] = alcista ? 1 : -1;
  }
  return { sar, dir };
}

/* ============================================================
   Ichimoku Kinko Hyo — Hosoda

   «Gráfico de equilibrio de un vistazo». Cinco líneas que juntas dan
   tendencia, soporte, resistencia, momento y proyección. Merece capítulo
   propio porque no es un indicador: es un sistema entero, y sus cinco piezas
   se leen en relación, nunca sueltas.

   ---------------------------------------------------------------------------
   EL PROBLEMA DEL DESPLAZAMIENTO, Y CÓMO SE RESUELVE AQUÍ

   La nube se dibuja 26 velas HACIA DELANTE y la chikou 26 hacia atrás. Eso
   rompe la regla de este motor —una línea, un valor por vela— porque los
   últimos 26 valores de la nube caen fuera de la serie.

   La solución honesta, y la que un gráfico hace de verdad: cada línea se
   devuelve alineada con la vela sobre la que se PINTA, y lo que se sale por el
   futuro va aparte, en `futuro`. Así `spanA[i]` es la nube que se ve sobre la
   vela i —calculada con datos de 26 velas antes, como debe ser— y nadie tiene
   que hacer aritmética de desplazamientos al pintar.

   Si en vez de eso se devolviera la nube sin desplazar, cada figura del
   capítulo tendría la nube 26 velas fuera de sitio. Se vería perfecta.
   ============================================================ */
export interface Ichimoku {
  tenkan: Line;
  kijun: Line;
  /** Ya desplazadas: el valor en `i` es el que se ve sobre la vela `i`. */
  spanA: Line;
  spanB: Line;
  /** Desplazada hacia atrás: el valor en `i` es el cierre de `i + desp`. */
  chikou: Line;
  /** La parte de la nube que se proyecta más allá de la última vela. */
  futuro: { spanA: number[]; spanB: number[] };
}

export function ichimoku(s: Series, nTenkan = 9, nKijun = 26, nSpanB = 52, desp = 26): Ichimoku {
  const h = highs(s);
  const l = lows(s);
  const c = closes(s);

  /** Punto medio del rango de las últimas n velas — el «precio de equilibrio»
   *  de Hosoda. No es una media: es el centro entre el máximo y el mínimo, y
   *  por eso reacciona distinto que una SMA ante una mecha aislada. */
  const medio = (n: number): Line => {
    const hh = highest(h, n);
    const ll = lowest(l, n);
    return hh.map((v, i) => {
      const w = ll[i];
      return v === null || w === null || w === undefined ? null : (v + w) / 2;
    });
  };

  const tenkan = medio(nTenkan);
  const kijun = medio(nKijun);

  const baseA: Line = tenkan.map((v, i) => {
    const w = kijun[i];
    return v === null || w === null || w === undefined ? null : (v + w) / 2;
  });
  const baseB = medio(nSpanB);

  const spanA = blank(s.length);
  const spanB = blank(s.length);
  const futA: number[] = [];
  const futB: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const destino = i + desp;
    const a = baseA[i];
    const b = baseB[i];
    if (destino < s.length) {
      if (a !== null && a !== undefined) spanA[destino] = a;
      if (b !== null && b !== undefined) spanB[destino] = b;
    } else {
      futA.push(a ?? NaN);
      futB.push(b ?? NaN);
    }
  }

  const chikou = blank(s.length);
  for (let i = 0; i + desp < s.length; i++) chikou[i] = at(c, i + desp);

  return { tenkan, kijun, spanA, spanB, chikou, futuro: { spanA: futA, spanB: futB } };
}

/** Dónde está el precio respecto de la nube. Es la lectura de primer nivel del
 *  Ichimoku y la que decide si las demás señales cuentan. */
export function posicionNube(s: Series, ich: Ichimoku): ('encima' | 'dentro' | 'debajo' | null)[] {
  return s.map((b, i) => {
    const a = ich.spanA[i];
    const c = ich.spanB[i];
    if (a === null || a === undefined || c === null || c === undefined) return null;
    const techo = Math.max(a, c);
    const suelo = Math.min(a, c);
    if (b.c > techo) return 'encima';
    if (b.c < suelo) return 'debajo';
    return 'dentro';
  });
}

/* ============================================================
   Elder Ray y Elder Impulse

   El Ray separa la vela en dos preguntas: hasta dónde llegaron los compradores
   por encima de la media (bull power) y los vendedores por debajo (bear
   power). El Impulse combina tendencia y momento en un semáforo, y es el
   ejemplo que usa el libro para explicar por qué un sistema de dos condiciones
   ya es un sistema — con sus dos formas de fallar.
   ============================================================ */
export function elderRay(s: Series, n = 13): Lines {
  const m = ema(closes(s), n);
  const bull = blank(s.length);
  const bear = blank(s.length);
  for (let i = 0; i < s.length; i++) {
    const v = m[i];
    const b = s[i];
    if (v === null || v === undefined || !b) continue;
    bull[i] = b.h - v;
    bear[i] = b.l - v;
  }
  return { bull, bear };
}

/** Verde: media y MACD suben. Rojo: los dos bajan. Azul: discrepan.
 *  El azul es lo interesante — es el estado que dice «no hay acuerdo», y es
 *  el que la mayoría de los sistemas de dos condiciones no representa. */
export function elderImpulse(s: Series, nEma = 13, rapida = 12, lenta = 26, senal = 9): ('verde' | 'rojo' | 'azul' | null)[] {
  const m = ema(closes(s), nEma);
  const f = ema(closes(s), rapida);
  const l = ema(closes(s), lenta);
  const macdLinea: Line = f.map((v, i) => {
    const w = l[i];
    return v === null || w === null || w === undefined ? null : v - w;
  });
  const vals: number[] = [];
  let off = -1;
  for (let i = 0; i < macdLinea.length; i++) {
    const v = macdLinea[i];
    if (v === null || v === undefined) continue;
    if (off < 0) off = i;
    vals.push(v);
  }
  const sigInner = ema(vals, senal);
  const hist = blank(s.length);
  for (let i = 0; i < sigInner.length; i++) {
    const sv = sigInner[i];
    if (sv === null || sv === undefined) continue;
    hist[off + i] = at(vals, i) - sv;
  }

  return s.map((_, i) => {
    if (i === 0) return null;
    const a = m[i];
    const b = m[i - 1];
    const x = hist[i];
    const y = hist[i - 1];
    if (a === null || a === undefined || b === null || b === undefined ||
        x === null || x === undefined || y === null || y === undefined) return null;
    if (a > b && x > y) return 'verde';
    if (a < b && x < y) return 'rojo';
    return 'azul';
  });
}

/* ============================================================
   Guppy — múltiples medias
   Seis medias cortas (el grupo de los especuladores) y seis largas (el de los
   inversores). No añade cálculo: añade una FORMA de mirar: cuando los dos
   grupos se separan hay acuerdo, cuando se enredan no lo hay.
   ============================================================ */
export const GUPPY_CORTAS = [3, 5, 8, 10, 12, 15] as const;
export const GUPPY_LARGAS = [30, 35, 40, 45, 50, 60] as const;

export function guppy(s: Series): { cortas: Line[]; largas: Line[] } {
  const c = closes(s);
  return {
    cortas: GUPPY_CORTAS.map((n) => ema(c, n)),
    largas: GUPPY_LARGAS.map((n) => ema(c, n)),
  };
}

/* ---------- selector ---------- */
export type TrendKind = 'adx' | 'plusdi' | 'minusdi' | 'aroon' | 'vortex' | 'supertrend' | 'sar';

export function trendInd(s: Series, kind: TrendKind, n?: number): Line {
  switch (kind) {
    case 'adx': return adx(s, n ?? 14).adx ?? blank(s.length);
    case 'plusdi': return adx(s, n ?? 14).plusDI ?? blank(s.length);
    case 'minusdi': return adx(s, n ?? 14).minusDI ?? blank(s.length);
    case 'aroon': return aroon(s, n ?? 14).osc ?? blank(s.length);
    case 'vortex': {
      const v = vortex(s, n ?? 14);
      return (v.plus ?? blank(s.length)).map((a, i) => {
        const b = v.minus?.[i];
        return a === null || b === null || b === undefined ? null : a - b;
      });
    }
    case 'supertrend': return supertrend(s, n ?? 10).line;
    case 'sar': return parabolicSar(s).sar;
  }
}

export const TREND_LABEL: Record<TrendKind, { es: string; en: string }> = {
  adx: { es: 'ADX', en: 'ADX' },
  plusdi: { es: '+DI', en: '+DI' },
  minusdi: { es: '−DI', en: '−DI' },
  aroon: { es: 'Oscilador Aroon', en: 'Aroon Oscillator' },
  vortex: { es: 'Vortex', en: 'Vortex' },
  supertrend: { es: 'Supertrend', en: 'Supertrend' },
  sar: { es: 'SAR parabólico', en: 'Parabolic SAR' },
};
