/* ============================================================
   MC Análisis Técnico™ — osciladores y momentum · MIGGY CAPITAL

   Diecisiete indicadores que la Parte VII tiene que enseñar y, sobre todo,
   COMPARAR. Casi todos responden a la misma pregunta —¿con cuánta fuerza se
   está moviendo el precio y en qué dirección?— y se diferencian en tres cosas:
   qué normalizan, con qué suavizan y en qué escala lo presentan.

   Esa frase es fácil de escribir y difícil de demostrar. Se demuestra en
   `redundancy.ts`, que los hace correr a todos sobre las mismas series y mide
   cuánto se parecen. El resultado de esa medición es lo que autoriza al libro
   a decir que poner tres de estos en el mismo panel no aporta tres opiniones,
   sino una repetida tres veces.

   ---------------------------------------------------------------------------
   EL ERROR QUE ESTA PARTE EXISTE PARA CORREGIR

   «Sobrecompra» no significa «vende». Significa que el precio ha subido mucho
   y deprisa, que es lo que hace una tendencia sana. En `parabolica`, el RSI se
   queda por encima de 75 durante veinte velas seguidas; en `rango`, un 75
   anticipa el giro. El mismo número y dos conclusiones opuestas — la lectura
   la da el régimen, no el oscilador, y ninguno de ellos sabe en cuál está.
   ============================================================ */
import type { Line, Lines, Series, Source } from './types.ts';
import { at, blank, closes, highs, lows, src } from './types.ts';
import { ema, highest, lowest, rma, sma, wma } from './ma.ts';

/* ---------- entrada flexible ----------
   Los osciladores que solo miran el cierre aceptan tanto una serie de velas
   como una lista de números. No es comodidad: es lo que permite encadenarlos
   —el RSI estocástico es un estocástico sobre la salida del RSI— y lo que hace
   que las pruebas puedan pasarles los vectores publicados, que son listas de
   cierres sin volumen ni mechas.

   El discriminador es un guarda de tipo de verdad y no un `as`: con una
   conversión forzada, pasar una serie de velas donde se espera una lista de
   números compilaría y devolvería NaN en silencio. */
function esNumeros(s: Series | readonly number[]): s is readonly number[] {
  return s.length === 0 || typeof s[0] === 'number';
}

/** Los cierres, venga como venga la entrada. */
function cierres(s: Series | readonly number[]): readonly number[] {
  return esNumeros(s) ? s : closes(s);
}

/** Une los valores definidos de una línea, con su desplazamiento. */
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

/** Aplica una media sobre una línea con huecos, sin descolocarla. */
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
   RSI — Wilder, 1978
   Primer valor en el índice n.

   Mide la proporción entre la subida media y la bajada media de las últimas n
   velas. Todo lo demás que se dice del RSI —divergencias, nivel 50, rangos
   alcistas— son lecturas de esa proporción, no propiedades añadidas.

   Se suaviza con RMA, no con SMA. Un RSI hecho con SMA (el «RSI de Cutler»)
   da valores parecidos pero distintos, y no es el que enseña ninguna
   plataforma: usarlo haría que la figura del libro no se pudiera replicar.
   ============================================================ */
export function rsi(s: Series | readonly number[], n = 14): Line {
  const c = cierres(s);
  const out = blank(c.length);
  if (c.length <= n) return out;

  const sube: number[] = [];
  const baja: number[] = [];
  for (let i = 1; i < c.length; i++) {
    const d = at(c, i) - at(c, i - 1);
    sube.push(Math.max(0, d));
    baja.push(Math.max(0, -d));
  }
  const g = rma(sube, n);
  const p = rma(baja, n);

  for (let i = 0; i < g.length; i++) {
    const gv = g[i];
    const pv = p[i];
    if (gv === null || gv === undefined || pv === null || pv === undefined) continue;
    // Sin pérdidas la fórmula se indetermina. El límite es 100: no hay ninguna
    // bajada que compense. Devolver 0 aquí —el fallo clásico— pinta el RSI en
    // el suelo justo en la subida más limpia de la serie.
    out[i + 1] = pv === 0 ? 100 : 100 - 100 / (1 + gv / pv);
  }
  return out;
}

/* ============================================================
   MACD — Appel
   Dos medias exponenciales restadas, y una tercera sobre el resultado.

   No mide «momentum» en abstracto: mide la SEPARACIÓN entre dos medias. Por
   eso crece cuando la tendencia se acelera y cae cuando se frena, y por eso
   en un rango cruza sin parar sin que pase nada — las dos medias están
   enredadas y su diferencia es ruido alrededor de cero.
   ============================================================ */
export function macd(s: Series | readonly number[], rapida = 12, lenta = 26, senal = 9): Lines {
  const c = cierres(s);
  const f = ema(c, rapida);
  const l = ema(c, lenta);
  const linea: Line = f.map((v, i) => {
    const w = l[i];
    return v === null || w === null || w === undefined ? null : v - w;
  });
  const sig = sobre(linea, senal, ema);
  const hist: Line = linea.map((v, i) => {
    const w = sig[i];
    return v === null || w === null || w === undefined ? null : v - w;
  });
  return { macd: linea, signal: sig, hist };
}

/* ============================================================
   Estocástico — Lane
   Dónde cierra el precio DENTRO de su rango reciente.

   Su punto ciego es estructural y hay que decirlo: en una tendencia fuerte el
   precio cierra siempre arriba de su rango, así que el estocástico se pega al
   techo y se queda ahí. No está fallando — está informando de algo que el
   lector interpreta al revés.

   `n=14, k=3, d=3` es el estocástico LENTO, el que traen las plataformas por
   defecto. El rápido es el mismo con k=1.
   ============================================================ */
export function stoch(s: Series, n = 14, suavizadoK = 3, suavizadoD = 3): Lines {
  const hh = highest(highs(s), n);
  const ll = lowest(lows(s), n);
  const c = closes(s);
  const bruto = blank(s.length);
  for (let i = 0; i < s.length; i++) {
    const a = hh[i];
    const b = ll[i];
    if (a === null || a === undefined || b === null || b === undefined) continue;
    // Rango nulo: n velas con el mismo máximo y mínimo. Ocurre en mercados
    // parados y en series muy planas. 50 es el centro, que es la única
    // respuesta neutra; 0 o 100 serían una señal inventada.
    bruto[i] = a === b ? 50 : (100 * (at(c, i) - b)) / (a - b);
  }
  const k = suavizadoK <= 1 ? bruto : sobre(bruto, suavizadoK, sma);
  const d = sobre(k, suavizadoD, sma);
  return { k, d, raw: bruto };
}

/** Estocástico aplicado al RSI. Un oscilador sobre otro oscilador: más señales
 *  y más ruido. El libro lo usa para enseñar qué se paga por la sensibilidad. */
export function stochRsi(s: Series, nRsi = 14, nStoch = 14, suavizadoK = 3, suavizadoD = 3): Lines {
  const r = rsi(s, nRsi);
  const { vals, off } = compacta(r);
  const hh = highest(vals, nStoch);
  const ll = lowest(vals, nStoch);
  const bruto = blank(s.length);
  for (let i = 0; i < vals.length; i++) {
    const a = hh[i];
    const b = ll[i];
    if (a === null || a === undefined || b === null || b === undefined) continue;
    bruto[off + i] = a === b ? 50 : (100 * (at(vals, i) - b)) / (a - b);
  }
  const k = sobre(bruto, suavizadoK, sma);
  const d = sobre(k, suavizadoD, sma);
  return { k, d, raw: bruto };
}

/* ============================================================
   CCI — Lambert
   A cuántas desviaciones medias está el precio típico de su media.

   El 0,015 no tiene teoría detrás: Lambert lo eligió para que ~70–80 % de las
   lecturas cayeran entre −100 y +100. Decirlo importa, porque explica que los
   niveles del CCI son una convención de escala y no una frontera del mercado.
   ============================================================ */
export function cci(s: Series, n = 20): Line {
  const tp = src(s, 'hlc3');
  const media = sma(tp, n);
  const out = blank(s.length);
  for (let i = n - 1; i < s.length; i++) {
    const m = media[i];
    if (m === null || m === undefined) continue;
    let dev = 0;
    for (let j = i - n + 1; j <= i; j++) dev += Math.abs(at(tp, j) - m);
    dev /= n;
    out[i] = dev === 0 ? 0 : (at(tp, i) - m) / (0.015 * dev);
  }
  return out;
}

/* ============================================================
   Williams %R
   El estocástico del revés y en escala −100…0. Se incluye para poder
   demostrarlo: su correlación con %K es prácticamente −1, y ese número es el
   mejor argumento del libro contra apilar osciladores.
   ============================================================ */
export function williamsR(s: Series, n = 14): Line {
  const hh = highest(highs(s), n);
  const ll = lowest(lows(s), n);
  const c = closes(s);
  const out = blank(s.length);
  for (let i = 0; i < s.length; i++) {
    const a = hh[i];
    const b = ll[i];
    if (a === null || a === undefined || b === null || b === undefined) continue;
    out[i] = a === b ? -50 : (-100 * (a - at(c, i))) / (a - b);
  }
  return out;
}

/* ============================================================
   Tasa de cambio y momento
   Los dos indicadores más simples de la familia, y la referencia contra la que
   se mide si los demás aportan algo.
   ============================================================ */
export function roc(s: Series | readonly number[], n = 9): Line {
  const c = cierres(s);
  const out = blank(c.length);
  for (let i = n; i < c.length; i++) {
    const base = at(c, i - n);
    out[i] = base === 0 ? 0 : (100 * (at(c, i) - base)) / base;
  }
  return out;
}

export function momentum(s: Series | readonly number[], n = 10): Line {
  const c = cierres(s);
  const out = blank(c.length);
  for (let i = n; i < c.length; i++) out[i] = at(c, i) - at(c, i - n);
  return out;
}

/* ============================================================
   Ultimate Oscillator — Williams
   Tres ventanas a la vez, para no depender de haber acertado el periodo. Es
   el reconocimiento explícito de un problema que el resto de la familia tiene
   y disimula.
   ============================================================ */
export function ultimateOscillator(s: Series, c1 = 7, c2 = 14, c3 = 28): Line {
  const out = blank(s.length);
  const bp: number[] = [];
  const tr: number[] = [];
  for (let i = 1; i < s.length; i++) {
    const b = s[i];
    const p = s[i - 1];
    if (!b || !p) continue;
    const min = Math.min(b.l, p.c);
    const max = Math.max(b.h, p.c);
    bp.push(b.c - min);
    tr.push(max - min);
  }
  const suma = (a: readonly number[], i: number, n: number) => {
    let acc = 0;
    for (let j = i - n + 1; j <= i; j++) acc += at(a, j);
    return acc;
  };
  const n = Math.max(c1, c2, c3);
  for (let i = n - 1; i < bp.length; i++) {
    const t1 = suma(tr, i, c1);
    const t2 = suma(tr, i, c2);
    const t3 = suma(tr, i, c3);
    if (t1 === 0 || t2 === 0 || t3 === 0) continue;
    const a1 = suma(bp, i, c1) / t1;
    const a2 = suma(bp, i, c2) / t2;
    const a3 = suma(bp, i, c3) / t3;
    out[i + 1] = (100 * (4 * a1 + 2 * a2 + a3)) / 7;
  }
  return out;
}

/* ============================================================
   Awesome Oscillator — Williams
   Diferencia entre dos medias del precio medio. Es un MACD sin exponenciales
   y sin línea de señal, y el libro lo enseña justo detrás del MACD para que
   se vea que son el mismo gesto.
   ============================================================ */
export function awesome(s: Series, rapida = 5, lenta = 34): Line {
  const m = src(s, 'hl2');
  const f = sma(m, rapida);
  const l = sma(m, lenta);
  return f.map((v, i) => {
    const w = l[i];
    return v === null || w === null || w === undefined ? null : v - w;
  });
}

/* ============================================================
   TRIX
   Variación porcentual de una triple exponencial. El triple suavizado quita
   casi todos los ciclos cortos: lo que queda es la tendencia de fondo, con el
   retraso que eso implica.
   ============================================================ */
export function trix(s: Series | readonly number[], n = 15): Line {
  const c = cierres(s);
  const e1 = ema(c, n);
  const e2 = sobre(e1, n, ema);
  const e3 = sobre(e2, n, ema);
  const out = blank(c.length);
  for (let i = 1; i < c.length; i++) {
    const a = e3[i];
    const b = e3[i - 1];
    if (a === null || a === undefined || b === null || b === undefined || b === 0) continue;
    out[i] = (100 * (a - b)) / b;
  }
  return out;
}

/* ============================================================
   PPO
   El MACD en porcentaje. Su motivo de existir es real y el libro lo dice: un
   MACD de 3 puntos significa una cosa en un valor de 20 y otra en uno de
   4.000, así que los valores del MACD no se pueden comparar entre activos ni
   entre épocas. Los del PPO sí.
   ============================================================ */
export function ppo(s: Series | readonly number[], rapida = 12, lenta = 26, senal = 9): Lines {
  const c = cierres(s);
  const f = ema(c, rapida);
  const l = ema(c, lenta);
  const linea: Line = f.map((v, i) => {
    const w = l[i];
    if (v === null || w === null || w === undefined || w === 0) return null;
    return (100 * (v - w)) / w;
  });
  const sig = sobre(linea, senal, ema);
  const hist: Line = linea.map((v, i) => {
    const w = sig[i];
    return v === null || w === null || w === undefined ? null : v - w;
  });
  return { ppo: linea, signal: sig, hist };
}

/* ============================================================
   DPO — oscilador de precio sin tendencia
   Quita la tendencia desplazando la media hacia atrás, para dejar solo el
   ciclo. Advertencia obligatoria del libro: está DESPLAZADO, así que su
   último tramo no existe en tiempo real. Es el indicador de esta parte que
   más se malinterpreta al mirarlo en un gráfico histórico.
   ============================================================ */
export function dpo(s: Series | readonly number[], n = 20): Line {
  const c = cierres(s);
  const m = sma(c, n);
  const desp = Math.floor(n / 2) + 1;
  const out = blank(c.length);
  for (let i = 0; i < c.length; i++) {
    const mv = m[i];
    if (mv === null || mv === undefined || i - desp < 0) continue;
    out[i] = at(c, i - desp) - mv;
  }
  return out;
}

/* ============================================================
   CMO — Chande
   Como el RSI pero sin suavizar y en escala −100…+100. Verlos juntos enseña
   exactamente qué hace el suavizado de Wilder.
   ============================================================ */
export function cmo(s: Series | readonly number[], n = 9): Line {
  const c = cierres(s);
  const out = blank(c.length);
  for (let i = n; i < c.length; i++) {
    let sube = 0;
    let baja = 0;
    for (let j = i - n + 1; j <= i; j++) {
      const d = at(c, j) - at(c, j - 1);
      if (d > 0) sube += d;
      else baja -= d;
    }
    const tot = sube + baja;
    out[i] = tot === 0 ? 0 : (100 * (sube - baja)) / tot;
  }
  return out;
}

/* ============================================================
   Fisher Transform — Ehlers
   Normaliza el precio a −1…1 y le aplica la transformada de Fisher, que
   estira los extremos. Los giros salen como picos afilados en vez de curvas.
   Lo que se gana en nitidez se paga en falsos extremos.
   ============================================================ */
export function fisher(s: Series, n = 9): Lines {
  const m = src(s, 'hl2');
  const hh = highest(m, n);
  const ll = lowest(m, n);
  const linea = blank(s.length);
  const sig = blank(s.length);
  let x = 0;
  let f = 0;
  for (let i = 0; i < s.length; i++) {
    const a = hh[i];
    const b = ll[i];
    if (a === null || a === undefined || b === null || b === undefined) continue;
    const bruto = a === b ? 0 : (2 * (at(m, i) - b)) / (a - b) - 1;
    x = 0.33 * 2 * bruto + 0.67 * x;
    // Sin el tope, un valor en ±1 exacto hace explotar el logaritmo a ±∞ y
    // arrastra el resto de la serie: un solo infinito y el indicador entero
    // deja de servir a partir de ahí.
    x = Math.max(-0.999, Math.min(0.999, x));
    const anterior = f;
    f = 0.5 * Math.log((1 + x) / (1 - x)) + 0.5 * f;
    linea[i] = f;
    sig[i] = anterior;
  }
  return { fisher: linea, signal: sig };
}

/* ============================================================
   Coppock — 1962
   WMA de 10 sobre la suma de dos tasas de cambio largas. Nació para señalar
   suelos de mercado en gráfico MENSUAL, y ahí sigue teniendo sentido. En
   intradía es un indicador larguísimo aplicado a datos que no le corresponden,
   y el libro lo dice donde toca decirlo.
   ============================================================ */
export function coppock(s: Series | readonly number[], roc1 = 14, roc2 = 11, wmaLen = 10): Line {
  const c = cierres(s);
  const a = roc(c, roc1);
  const b = roc(c, roc2);
  const suma: Line = a.map((v, i) => {
    const w = b[i];
    return v === null || w === null || w === undefined ? null : v + w;
  });
  return sobre(suma, wmaLen, wma);
}

/* ============================================================
   KST — Pring
   Cuatro tasas de cambio suavizadas y ponderadas. Es un intento razonable de
   mirar varios ciclos a la vez, con el coste de cuatro parámetros que casi
   nadie ajusta y casi todos heredan.
   ============================================================ */
export function kst(
  s: Series | readonly number[],
  rocs: [number, number, number, number] = [10, 15, 20, 30],
  suaves: [number, number, number, number] = [10, 10, 10, 15],
  senal = 9,
): Lines {
  const c = cierres(s);
  const partes = rocs.map((r, k) => sobre(roc(c, r), suaves[k] ?? 10, sma));
  const linea = blank(c.length);
  for (let i = 0; i < c.length; i++) {
    let acc = 0;
    let ok = true;
    for (let k = 0; k < partes.length; k++) {
      const p = partes[k];
      const v = p ? p[i] : null;
      if (v === null || v === undefined) { ok = false; break; }
      acc += v * (k + 1);
    }
    if (ok) linea[i] = acc;
  }
  return { kst: linea, signal: sobre(linea, senal, sma) };
}

/* ============================================================
   RVI — Relative Vigor Index
   Compara el recorrido del CUERPO con el recorrido total de la vela. La idea
   —en una tendencia sana el precio cierra lejos de donde abrió— es la misma
   que sostiene medio análisis de velas, aquí puesta en número.
   ============================================================ */
export function rvi(s: Series, n = 10): Lines {
  // Media simétrica ponderada (1,2,2,1)/6: la que usa el indicador original.
  const swma = (a: readonly number[]): Line => {
    const out = blank(a.length);
    for (let i = 3; i < a.length; i++) {
      out[i] = (at(a, i) + 2 * at(a, i - 1) + 2 * at(a, i - 2) + at(a, i - 3)) / 6;
    }
    return out;
  };
  const num = swma(s.map((b) => b.c - b.o));
  const den = swma(s.map((b) => b.h - b.l));
  const sn = sobre(num, n, sma);
  const sd = sobre(den, n, sma);
  const linea: Line = sn.map((v, i) => {
    const w = sd[i];
    if (v === null || w === null || w === undefined || w === 0) return null;
    return v / w;
  });
  const { vals, off } = compacta(linea);
  const sig = blank(linea.length);
  const ss = swma(vals);
  for (let i = 0; i < ss.length; i++) {
    const v = ss[i];
    if (v !== null && v !== undefined) sig[off + i] = v;
  }
  return { rvi: linea, signal: sig };
}

/* ============================================================
   Divergencias

   Se detectan sobre los PIVOTES, no vela a vela. Comparar el precio y el
   oscilador en dos velas cualesquiera produce divergencias por todas partes:
   siempre existen dos puntos que cumplen la condición. Una divergencia solo
   significa algo entre dos extremos reconocibles del precio, y por eso aquí
   hace falta primero encontrarlos.
   ============================================================ */
export interface Divergencia {
  /** 'regular' anuncia agotamiento; 'oculta' anuncia continuación. */
  clase: 'regular' | 'oculta';
  dir: 'alcista' | 'bajista';
  /** Índices de los dos pivotes que la forman. */
  desde: number;
  hasta: number;
}

/** Pivotes: velas cuyo extremo supera al de `izq` velas antes y `der` después.
 *
 *  El `der` es la razón de que una divergencia no se pueda operar en el
 *  momento en que se ve dibujada: para saber que una vela era un pivote hay
 *  que esperar `der` velas más. El libro insiste en esto porque es la
 *  diferencia entre el gráfico histórico y el gráfico en vivo. */
export function pivotes(values: readonly number[], izq = 3, der = 3, tipo: 'alto' | 'bajo' = 'alto'): number[] {
  const out: number[] = [];
  for (let i = izq; i < values.length - der; i++) {
    const v = at(values, i);
    let ok = true;
    for (let j = i - izq; j <= i + der; j++) {
      if (j === i) continue;
      const w = at(values, j);
      if (tipo === 'alto' ? w >= v : w <= v) { ok = false; break; }
    }
    if (ok) out.push(i);
  }
  return out;
}

/** Divergencias entre el precio y un oscilador, sobre pivotes consecutivos. */
export function divergencias(s: Series, osc: Line, izq = 3, der = 3): Divergencia[] {
  const out: Divergencia[] = [];
  const h = highs(s);
  const l = lows(s);

  const val = (i: number): number | null => osc[i] ?? null;

  const altos = pivotes(h, izq, der, 'alto');
  for (let k = 1; k < altos.length; k++) {
    const a = altos[k - 1];
    const b = altos[k];
    if (a === undefined || b === undefined) continue;
    const oa = val(a);
    const ob = val(b);
    if (oa === null || ob === null) continue;
    // Precio hace máximo más alto y el oscilador no lo acompaña.
    if (at(h, b) > at(h, a) && ob < oa) out.push({ clase: 'regular', dir: 'bajista', desde: a, hasta: b });
    // Precio hace máximo más bajo pero el oscilador sube: la tendencia bajista
    // sigue viva (divergencia oculta).
    if (at(h, b) < at(h, a) && ob > oa) out.push({ clase: 'oculta', dir: 'bajista', desde: a, hasta: b });
  }

  const bajos = pivotes(l, izq, der, 'bajo');
  for (let k = 1; k < bajos.length; k++) {
    const a = bajos[k - 1];
    const b = bajos[k];
    if (a === undefined || b === undefined) continue;
    const oa = val(a);
    const ob = val(b);
    if (oa === null || ob === null) continue;
    if (at(l, b) < at(l, a) && ob > oa) out.push({ clase: 'regular', dir: 'alcista', desde: a, hasta: b });
    if (at(l, b) > at(l, a) && ob < oa) out.push({ clase: 'oculta', dir: 'alcista', desde: a, hasta: b });
  }

  return out.sort((x, y) => x.hasta - y.hasta);
}

/* ---------- selector por nombre, para los specs ---------- */
export type OscKind =
  | 'rsi' | 'macd' | 'stoch' | 'stochrsi' | 'cci' | 'williams' | 'roc' | 'momentum'
  | 'uo' | 'ao' | 'trix' | 'ppo' | 'dpo' | 'cmo' | 'fisher' | 'coppock' | 'kst' | 'rvi';

export const OSC_KINDS: readonly OscKind[] = [
  'rsi', 'macd', 'stoch', 'stochrsi', 'cci', 'williams', 'roc', 'momentum',
  'uo', 'ao', 'trix', 'ppo', 'dpo', 'cmo', 'fisher', 'coppock', 'kst', 'rvi',
] as const;

/** La línea PRINCIPAL de cada oscilador — la que se compara en la matriz de
 *  redundancia y la que el spec pinta si no pide otra. */
export function osc(s: Series, kind: OscKind, n?: number, source: Source = 'close'): Line {
  void source;
  switch (kind) {
    case 'rsi': return rsi(s, n ?? 14);
    case 'macd': return macd(s).macd ?? blank(s.length);
    case 'stoch': return stoch(s, n ?? 14).k ?? blank(s.length);
    case 'stochrsi': return stochRsi(s, n ?? 14).k ?? blank(s.length);
    case 'cci': return cci(s, n ?? 20);
    case 'williams': return williamsR(s, n ?? 14);
    case 'roc': return roc(s, n ?? 9);
    case 'momentum': return momentum(s, n ?? 10);
    case 'uo': return ultimateOscillator(s);
    case 'ao': return awesome(s);
    case 'trix': return trix(s, n ?? 15);
    case 'ppo': return ppo(s).ppo ?? blank(s.length);
    case 'dpo': return dpo(s, n ?? 20);
    case 'cmo': return cmo(s, n ?? 9);
    case 'fisher': return fisher(s, n ?? 9).fisher ?? blank(s.length);
    case 'coppock': return coppock(s);
    case 'kst': return kst(s).kst ?? blank(s.length);
    case 'rvi': return rvi(s, n ?? 10).rvi ?? blank(s.length);
  }
}

export const OSC_LABEL: Record<OscKind, { es: string; en: string }> = {
  rsi: { es: 'RSI', en: 'RSI' },
  macd: { es: 'MACD', en: 'MACD' },
  stoch: { es: 'Estocástico', en: 'Stochastic' },
  stochrsi: { es: 'RSI estocástico', en: 'Stochastic RSI' },
  cci: { es: 'CCI', en: 'CCI' },
  williams: { es: 'Williams %R', en: 'Williams %R' },
  roc: { es: 'Tasa de cambio', en: 'Rate of change' },
  momentum: { es: 'Momento', en: 'Momentum' },
  uo: { es: 'Ultimate Oscillator', en: 'Ultimate Oscillator' },
  ao: { es: 'Awesome Oscillator', en: 'Awesome Oscillator' },
  trix: { es: 'TRIX', en: 'TRIX' },
  ppo: { es: 'PPO', en: 'PPO' },
  dpo: { es: 'DPO', en: 'DPO' },
  cmo: { es: 'Oscilador de Chande', en: 'Chande Momentum Oscillator' },
  fisher: { es: 'Transformada de Fisher', en: 'Fisher Transform' },
  coppock: { es: 'Curva de Coppock', en: 'Coppock Curve' },
  kst: { es: 'Know Sure Thing', en: 'Know Sure Thing' },
  rvi: { es: 'Relative Vigor Index', en: 'Relative Vigor Index' },
};
