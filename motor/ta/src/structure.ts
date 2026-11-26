/* ============================================================
   MC Análisis Técnico™ — estructura y líneas · MIGGY CAPITAL

   Las Partes IV y V. Swings, estructura de mercado, niveles horizontales y
   líneas de tendencia — con lo que hace falta para MEDIRLAS.

   ---------------------------------------------------------------------------
   LAS DOS PREGUNTAS QUE ESTE MÓDULO EXISTE PARA CONTESTAR

   Todo el mundo dibuja líneas de tendencia y casi nadie se pregunta cuántas
   se podrían haber dibujado. La respuesta importa: si el mismo gráfico admite
   catorce líneas que cumplen el criterio, entonces «la línea de tendencia» no
   es algo que esté ahí — es algo que elegiste, y el mérito de que aguante es
   tuyo, no del mercado.

   Lo mismo con la estructura. «Máximos y mínimos crecientes» suena objetivo
   hasta que preguntas qué es un máximo. Con pivotes de 3 velas sale una
   historia; con pivotes de 8, otra distinta sobre el MISMO precio. Y las dos
   se cuentan con la misma seguridad.

   Este módulo permite contar las dos cosas. Es el mismo movimiento que en la
   Parte III con los umbrales de las velas: no se discute si la herramienta
   sirve, se enseña de qué depende.
   ============================================================ */
import type { Series } from './types.ts';
import { at, closes, highs, lows } from './types.ts';

/* ============================================================
   Swings
   ============================================================ */

export interface Swing {
  i: number;
  precio: number;
  tipo: 'alto' | 'bajo';
}

/** Los extremos locales de la serie.
 *
 *  `izq` y `der` son cuántas velas tienen que quedar por debajo (o por encima)
 *  a cada lado. El `der` es la razón de que un swing no se pueda usar en el
 *  momento en que se forma: hay que esperar `der` velas para saber que aquello
 *  era un extremo. En el gráfico histórico esa espera no se ve, y es la fuente
 *  del autoengaño más común al revisar operaciones pasadas. */
export function swings(s: Series, izq = 3, der = 3): Swing[] {
  const h = highs(s);
  const l = lows(s);
  const out: Swing[] = [];
  for (let i = izq; i < s.length - der; i++) {
    let esAlto = true;
    let esBajo = true;
    for (let j = i - izq; j <= i + der; j++) {
      if (j === i) continue;
      if (at(h, j) >= at(h, i)) esAlto = false;
      if (at(l, j) <= at(l, i)) esBajo = false;
      if (!esAlto && !esBajo) break;
    }
    if (esAlto) out.push({ i, precio: at(h, i), tipo: 'alto' });
    if (esBajo) out.push({ i, precio: at(l, i), tipo: 'bajo' });
  }
  return out.sort((a, b) => a.i - b.i);
}

/* ============================================================
   Estructura de mercado
   ============================================================ */

export type EventoTipo =
  /** Ruptura de estructura: sigue la tendencia que ya había. */
  | 'bos-alcista' | 'bos-bajista'
  /** Cambio de carácter: el primer indicio de que la tendencia se gira. */
  | 'choch-alcista' | 'choch-bajista';

export interface Evento {
  tipo: EventoTipo;
  /** Vela en la que se confirma, que es la del CIERRE que rompe. */
  at: number;
  /** El swing que se ha roto. */
  nivel: number;
}

/** Los eventos de estructura de una serie.
 *
 *  La ruptura se confirma con el CIERRE y no con la mecha. Es una convención y
 *  hay que declararla, porque cambia el resultado: con mechas hay muchos más
 *  eventos y casi todos son barridos. El libro usa cierre en todo momento, y
 *  la Parte IV enseña qué se ve con cada criterio. */
export function estructura(s: Series, izq = 3, der = 3): Evento[] {
  const sw = swings(s, izq, der);
  const c = closes(s);
  const out: Evento[] = [];

  let ultimoAlto: Swing | null = null;
  let ultimoBajo: Swing | null = null;
  let sesgo: 'alcista' | 'bajista' | null = null;

  for (let i = 0; i < s.length; i++) {
    // Solo cuentan los swings ya CONFIRMADOS: uno necesita `der` velas más
    // para existir. Sin esta espera, el detector usaría información que en
    // vivo todavía no estaba, que es la trampa de todo backtest de estructura.
    for (const p of sw) {
      if (p.i + der !== i) continue;
      if (p.tipo === 'alto') ultimoAlto = p;
      else ultimoBajo = p;
    }

    const cierre = at(c, i);
    if (ultimoAlto && cierre > ultimoAlto.precio) {
      out.push({ tipo: sesgo === 'bajista' ? 'choch-alcista' : 'bos-alcista', at: i, nivel: ultimoAlto.precio });
      sesgo = 'alcista';
      ultimoAlto = null;
    } else if (ultimoBajo && cierre < ultimoBajo.precio) {
      out.push({ tipo: sesgo === 'alcista' ? 'choch-bajista' : 'bos-bajista', at: i, nivel: ultimoBajo.precio });
      sesgo = 'bajista';
      ultimoBajo = null;
    }
  }
  return out;
}

/** Cuánto cambia el relato de la estructura al mover el tamaño del swing.
 *
 *  Es la medición de la Parte IV. «El mercado hace máximos crecientes» parece
 *  una observación; en cuanto se ve cómo cambia el recuento con el parámetro,
 *  se entiende que era una descripción a una escala concreta — y que quien la
 *  hace casi nunca dice a cuál. */
export function sensibilidadEstructura(s: Series, tamanos: number[]): { tam: number; eventos: number; bos: number; choch: number }[] {
  return tamanos.map((tam) => {
    const e = estructura(s, tam, tam);
    return {
      tam,
      eventos: e.length,
      bos: e.filter((x) => x.tipo.startsWith('bos')).length,
      choch: e.filter((x) => x.tipo.startsWith('choch')).length,
    };
  });
}

/* ============================================================
   Niveles horizontales
   ============================================================ */

export interface Nivel {
  precio: number;
  /** Cuántos swings distintos lo formaron. */
  toques: number;
  /** Primera y última vela en la que se tocó. */
  desde: number;
  hasta: number;
  /** Los dos extremos de precio del grupo: la ZONA, no la línea. */
  min: number;
  max: number;
}

/** Agrupa swings cercanos en niveles.
 *
 *  `tolerancia` va en múltiplos del rango medio de la vela, no en puntos: un
 *  nivel «a 3 puntos» significa cosas opuestas en dos activos distintos, y el
 *  libro tiene que poder hablar de niveles sin elegir instrumento.
 *
 *  Que un nivel sea una ZONA y no una línea no es una licencia del analista:
 *  es una consecuencia de que los swings nunca caen en el mismo tick. */
export function niveles(s: Series, izq = 3, der = 3, tolerancia = 0.6): Nivel[] {
  const sw = swings(s, izq, der);
  if (!sw.length) return [];

  let rango = 0;
  for (const b of s) rango += b.h - b.l;
  const tol = (rango / s.length) * tolerancia;

  const ordenados = [...sw].sort((a, b) => a.precio - b.precio);
  const grupos: Swing[][] = [];
  let actual: Swing[] = [];
  for (const p of ordenados) {
    if (!actual.length || p.precio - (actual[actual.length - 1] as Swing).precio <= tol) actual.push(p);
    else { grupos.push(actual); actual = [p]; }
  }
  if (actual.length) grupos.push(actual);

  return grupos
    .map((g) => ({
      precio: g.reduce((a, p) => a + p.precio, 0) / g.length,
      toques: g.length,
      desde: Math.min(...g.map((p) => p.i)),
      hasta: Math.max(...g.map((p) => p.i)),
      /* Los dos extremos de precio del grupo. Sin esto, «un nivel es una zona»
         era una afirmación que el propio módulo no podía respaldar: devolvía
         un precio medio y nada más, así que quien lo dibujara solo podía
         pintar una línea — justo lo que el capítulo dice que no es. La
         anchura de la zona no es una licencia gráfica: es la dispersión que
         había entre los swings que la formaron. */
      min: Math.min(...g.map((p) => p.precio)),
      max: Math.max(...g.map((p) => p.precio)),
    }))
    .filter((n) => n.toques >= 2)
    .sort((a, b) => b.toques - a.toques);
}

/* ============================================================
   Líneas de tendencia

   Aquí está la medición que da sentido a la Parte V.
   ============================================================ */

export interface Linea {
  /** Los dos swings de anclaje. */
  desde: number;
  hasta: number;
  /** Precio en la vela 0 y pendiente por vela. */
  base: number;
  pendiente: number;
  /** Cuántas velas la tocan sin romperla. */
  toques: number;
  /** Dónde se rompe por cierre, o null si aguanta hasta el final. */
  rotaEn: number | null;
  tipo: 'soporte' | 'resistencia';
}

const precioEn = (l: { base: number; pendiente: number }, i: number) => l.base + l.pendiente * i;

/** Velas mínimas entre dos contactos para que cuenten como contactos
 *  distintos. Cinco es lo que separa un apoyo de la vela siguiente rozando la
 *  misma línea; por debajo, un solo apoyo se contaría varias veces. */
const SEPARACION_TOQUE = 5;

/**
 * TODAS las líneas defendibles de un gráfico.
 *
 * Se enumeran todas las parejas de swings del mismo tipo, se traza la recta y
 * se cuenta cuántas velas la tocan y cuándo se rompe. Sobrevive la que cumpla
 * el criterio: al menos `minToques` contactos y ninguna violación ANTES de la
 * ruptura definitiva.
 *
 * El resultado no es «la línea»: es cuántas hay. Y esa cifra es todo el
 * argumento del capítulo — mientras el lector crea que la línea estaba en el
 * gráfico, culpará al mercado cuando falle. Cuando sepa que eligió una de
 * catorce, empezará a preguntarse por qué esa.
 */
export function lineasCandidatas(
  s: Series,
  opts: { izq?: number; der?: number; minToques?: number; tolerancia?: number } = {},
): Linea[] {
  const izq = opts.izq ?? 3;
  const der = opts.der ?? 3;
  const minToques = opts.minToques ?? 3;
  const sw = swings(s, izq, der);

  let rango = 0;
  for (const b of s) rango += b.h - b.l;
  const tol = (rango / s.length) * (opts.tolerancia ?? 0.5);

  const h = highs(s);
  const l = lows(s);
  const c = closes(s);
  const out: Linea[] = [];

  for (const tipo of ['soporte', 'resistencia'] as const) {
    const puntos = sw.filter((p) => (tipo === 'soporte' ? p.tipo === 'bajo' : p.tipo === 'alto'));
    for (let a = 0; a < puntos.length; a++) {
      for (let b = a + 1; b < puntos.length; b++) {
        const p1 = puntos[a] as Swing;
        const p2 = puntos[b] as Swing;
        if (p2.i - p1.i < 5) continue; // dos swings pegados no definen nada
        const pendiente = (p2.precio - p1.precio) / (p2.i - p1.i);
        const base = p1.precio - pendiente * p1.i;
        const linea = { base, pendiente };

        let toques = 0;
        let ultimoToque = -Infinity;
        let rotaEn: number | null = null;
        let invalida = false;

        for (let i = p1.i; i < s.length; i++) {
          const y = precioEn(linea, i);
          const extremo = tipo === 'soporte' ? at(l, i) : at(h, i);
          /* Un contacto tiene que estar SEPARADO del anterior.
             La primera versión contaba cada vela cercana a la línea, y sobre
             un gráfico de 140 velas salían líneas con «30 toques» — imposible.
             Lo que contaba era proximidad: una tendencia que camina pegada a su
             línea deja veinte velas seguidas dentro de la tolerancia, y eso es
             UN apoyo, no veinte. Con el número inflado, el criterio de calidad
             dejaba de discriminar: exigir seis contactos en vez de tres apenas
             quitaba líneas de la lista. */
          if (Math.abs(extremo - y) <= tol && i - ultimoToque >= SEPARACION_TOQUE) {
            toques++;
            ultimoToque = i;
          }

          const roto = tipo === 'soporte' ? at(c, i) < y - tol : at(c, i) > y + tol;
          if (roto) {
            if (rotaEn === null) rotaEn = i;
            // Una línea que ya se rompió y vuelve a romperse no invalida nada;
            // lo que la invalida es que estuviera rota ANTES de su segundo
            // anclaje, porque entonces nunca fue una línea.
            if (i < p2.i) { invalida = true; break; }
          }
        }
        if (invalida || toques < minToques) continue;
        out.push({ desde: p1.i, hasta: p2.i, base, pendiente, toques, rotaEn, tipo });
      }
    }
  }
  return out.sort((a, b) => b.toques - a.toques);
}

/** Cuántas líneas defendibles admite el gráfico, por criterio de contactos.
 *
 *  Exigir cuatro toques en vez de tres reduce mucho la lista — y el capítulo
 *  puede enseñar que «la línea buena» aparece al subir el listón, no al mirar
 *  mejor. */
export function cuantasLineas(s: Series, contactos: number[]): { minToques: number; cuantas: number }[] {
  return contactos.map((minToques) => ({ minToques, cuantas: lineasCandidatas(s, { minToques }).length }));
}

/** Canal de regresión: la recta de mínimos cuadrados sobre los cierres y su
 *  desviación típica.
 *
 *  Es la única línea de tendencia de este capítulo que NO depende de dónde
 *  pinches: la calcula el método, no el ojo. Por eso el libro la usa para
 *  cerrar la parte — no es mejor que una línea trazada a mano, pero es la
 *  misma para todo el mundo, y eso resuelve el problema que el capítulo
 *  entero ha estado describiendo. */
export function canalRegresion(s: Series, desde = 0, hasta?: number): { base: number; pendiente: number; sd: number } {
  const fin = hasta ?? s.length;
  const c = closes(s);
  const n = fin - desde;
  if (n < 2) return { base: at(c, desde), pendiente: 0, sd: 0 };

  let sx = 0;
  let sy = 0;
  let sxy = 0;
  let sxx = 0;
  for (let i = desde; i < fin; i++) {
    sx += i;
    sy += at(c, i);
    sxy += i * at(c, i);
    sxx += i * i;
  }
  const pendiente = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  const base = (sy - pendiente * sx) / n;

  let acc = 0;
  for (let i = desde; i < fin; i++) acc += (at(c, i) - (base + pendiente * i)) ** 2;
  return { base, pendiente, sd: Math.sqrt(acc / n) };
}

/* ============================================================
   Fibonacci — la medición de la Parte IX

   Aquí el problema de las líneas de tendencia llega a su forma extrema, y se
   puede poner en un número.

   Un retroceso de Fibonacci necesita DOS anclajes: un swing de partida y otro
   de llegada. En un gráfico con dieciséis swings hay decenas de parejas
   defendibles, y cada una proyecta siete niveles. La pregunta que este módulo
   contesta es la única que importa:

     ¿qué parte del recorrido del precio queda cubierta por ALGÚN nivel de
     Fibonacci de ALGUNA pareja razonable de swings?

   Si la respuesta es «casi todo», entonces «el precio respetó el 61,8 %» deja
   de ser una observación: es casi imposible que el precio NO toque algún nivel
   de alguien. Y eso no invalida la herramienta — invalida usarla como prueba a
   posteriori, que es como se usa casi siempre.
   ============================================================ */

/** Los retrocesos que enseña el libro. El 50 % no es de Fibonacci y se incluye
 *  igual, porque se usa universalmente y porque decirlo es parte de la
 *  honestidad del capítulo. */
export const FIBOS = [0.236, 0.382, 0.5, 0.618, 0.705, 0.786, 0.886] as const;

export interface CoberturaFib {
  /** Parejas de swings consideradas. */
  parejas: number;
  /** Niveles proyectados en total. */
  niveles: number;
  /** Fracción del rango del gráfico que queda a tiro de algún nivel. */
  cobertura: number;
  /** Cuántas velas cierran a menos de la tolerancia de algún nivel. */
  velasTocando: number;
  /** Fracción de velas que «respetan» algún Fibonacci. */
  fraccionVelas: number;
}

/**
 * Cuánto del gráfico cubre Fibonacci cuando se admiten todos los anclajes
 * razonables.
 *
 * `tolerancia` va en múltiplos del rango medio de la vela, igual que en el
 * resto del módulo: un nivel «a dos puntos» no significa nada sin saber cuánto
 * se mueve el activo.
 */
export function coberturaFibonacci(
  s: Series,
  opts: { izq?: number; der?: number; tolerancia?: number; minSeparacion?: number } = {},
): CoberturaFib {
  const izq = opts.izq ?? 3;
  const der = opts.der ?? 3;
  const sw = swings(s, izq, der);

  let rangoMed = 0;
  for (const b of s) rangoMed += b.h - b.l;
  rangoMed /= s.length;
  const tol = rangoMed * (opts.tolerancia ?? 0.5);
  const minSep = opts.minSeparacion ?? 8;

  const precios: number[] = [];
  let parejas = 0;
  for (let a = 0; a < sw.length; a++) {
    for (let b = a + 1; b < sw.length; b++) {
      const p1 = sw[a] as Swing;
      const p2 = sw[b] as Swing;
      // Solo tienen sentido las parejas alto→bajo o bajo→alto: un retroceso se
      // mide sobre un impulso, y dos máximos seguidos no son un impulso.
      if (p1.tipo === p2.tipo) continue;
      if (p2.i - p1.i < minSep) continue;
      parejas++;
      for (const f of FIBOS) precios.push(p1.precio + (p2.precio - p1.precio) * f);
    }
  }

  const alto = Math.max(...s.map((b) => b.h));
  const bajo = Math.min(...s.map((b) => b.l));

  /* La cobertura se mide uniendo los intervalos ±tolerancia de cada nivel. Sin
     unirlos, cien niveles solapados contarían cien veces el mismo tramo y la
     cifra pasaría del 100 % — que es exactamente el error que haría inútil la
     medición. */
  const intervalos = precios
    .map((p) => [p - tol, p + tol] as [number, number])
    .filter(([lo, hi]) => hi >= bajo && lo <= alto)
    .map(([lo, hi]) => [Math.max(lo, bajo), Math.min(hi, alto)] as [number, number])
    .sort((x, y) => x[0] - y[0]);

  let cubierto = 0;
  let finActual = -Infinity;
  let iniActual = -Infinity;
  for (const [lo, hi] of intervalos) {
    if (lo > finActual) {
      if (finActual > iniActual) cubierto += finActual - iniActual;
      iniActual = lo;
      finActual = hi;
    } else if (hi > finActual) finActual = hi;
  }
  if (finActual > iniActual) cubierto += finActual - iniActual;

  const c = closes(s);
  let velasTocando = 0;
  for (let i = 0; i < s.length; i++) {
    if (precios.some((p) => Math.abs(at(c, i) - p) <= tol)) velasTocando++;
  }

  const rango = alto - bajo;
  return {
    parejas,
    niveles: precios.length,
    cobertura: rango > 0 ? cubierto / rango : 0,
    velasTocando,
    fraccionVelas: s.length ? velasTocando / s.length : 0,
  };
}

/* ============================================================
   Ineficiencias y liquidez — la medición de la Parte XII

   El vocabulario moderno (FVG, order blocks, barridos) describe cosas reales,
   y su problema es el mismo de todo el libro: casi ninguna está definida sin un
   umbral, y varias son tan frecuentes que reconocerlas no informa de nada.

   Aquí se miden las dos que SÍ tienen definición cerrada y por tanto se pueden
   contar sin discutir: el desequilibrio de tres velas y los extremos iguales.
   ============================================================ */

export interface FVG {
  /** Vela central del trío. */
  at: number;
  dir: 'alcista' | 'bajista';
  /** Los dos bordes del hueco. */
  desde: number;
  hasta: number;
  /** Vela en la que el precio vuelve a cubrirlo entero, o null. */
  rellenoEn: number | null;
}

/**
 * Fair Value Gaps: tres velas donde la primera y la tercera no se solapan.
 *
 * Es de las pocas definiciones del vocabulario moderno que no necesita
 * umbrales — o hay hueco entre la mecha de la primera y la de la tercera, o no
 * lo hay. Por eso se puede contar honestamente, y por eso el capítulo la usa
 * para medir en lugar de a los order blocks, que sí dependen de qué llames
 * «última vela contraria antes del desplazamiento».
 */
export function fvgs(s: Series, minTam = 0): FVG[] {
  const out: FVG[] = [];
  for (let i = 1; i < s.length - 1; i++) {
    const a = s[i - 1];
    const c = s[i + 1];
    if (!a || !c) continue;

    // Alcista: el mínimo de la tercera queda por encima del máximo de la
    // primera. Queda una franja por la que el precio pasó sin negociar.
    if (c.l > a.h && c.l - a.h > minTam) {
      out.push({ at: i, dir: 'alcista', desde: a.h, hasta: c.l, rellenoEn: rellena(s, i + 2, a.h, c.l) });
    }
    if (a.l > c.h && a.l - c.h > minTam) {
      out.push({ at: i, dir: 'bajista', desde: c.h, hasta: a.l, rellenoEn: rellena(s, i + 2, c.h, a.l) });
    }
  }
  return out;
}

/** La primera vela que cubre el hueco entero. */
function rellena(s: Series, desdeI: number, lo: number, hi: number): number | null {
  for (let j = desdeI; j < s.length; j++) {
    const b = s[j];
    if (!b) continue;
    if (b.l <= lo && b.h >= hi) return j;
  }
  return null;
}

export interface MedidaFVG {
  cuantos: number;
  /** Una de cada cuántas velas deja uno. */
  unoDeCada: number | null;
  /** Cuántos se rellenan antes de que acabe la serie. */
  rellenados: number;
  fraccionRellenados: number;
  /** Qué parte del rango del gráfico queda dentro de algún FVG. */
  cobertura: number;
}

/** Cuenta y cobertura de los FVG sobre una serie.
 *
 *  La cobertura se calcula uniendo los huecos, igual que en Fibonacci: sumarlos
 *  daría más del 100 % en cuanto dos se solapen, y se solapan constantemente. */
export function medirFVG(s: Series, minTam = 0): MedidaFVG {
  const lista = fvgs(s, minTam);
  const alto = Math.max(...s.map((b) => b.h));
  const bajo = Math.min(...s.map((b) => b.l));

  const intervalos = lista
    .map((f) => [f.desde, f.hasta] as [number, number])
    .sort((x, y) => x[0] - y[0]);
  let cubierto = 0;
  let ini = -Infinity;
  let fin = -Infinity;
  for (const [lo, hi] of intervalos) {
    if (lo > fin) {
      if (fin > ini) cubierto += fin - ini;
      ini = lo;
      fin = hi;
    } else if (hi > fin) fin = hi;
  }
  if (fin > ini) cubierto += fin - ini;

  const rellenados = lista.filter((f) => f.rellenoEn !== null).length;
  return {
    cuantos: lista.length,
    unoDeCada: lista.length ? Math.round(s.length / lista.length) : null,
    rellenados,
    fraccionRellenados: lista.length ? rellenados / lista.length : 0,
    cobertura: alto > bajo ? cubierto / (alto - bajo) : 0,
  };
}

/** Extremos «iguales»: dos o más swings del mismo tipo a la misma altura.
 *
 *  Son los charcos de liquidez del vocabulario moderno. Necesitan un umbral
 *  —«a la misma altura» no es exacto nunca— y por eso el capítulo enseña cuánto
 *  cambia la cuenta al moverlo, igual que hizo la Parte III con el martillo. */
export function extremosIguales(s: Series, tolerancia = 0.3, izq = 3, der = 3): { tipo: 'alto' | 'bajo'; precio: number; cuantos: number }[] {
  const sw = swings(s, izq, der);
  let rangoMed = 0;
  for (const b of s) rangoMed += b.h - b.l;
  const tol = (rangoMed / s.length) * tolerancia;

  const out: { tipo: 'alto' | 'bajo'; precio: number; cuantos: number }[] = [];
  for (const tipo of ['alto', 'bajo'] as const) {
    const puntos = sw.filter((p) => p.tipo === tipo).sort((a, b) => a.precio - b.precio);
    let grupo: Swing[] = [];
    for (const p of puntos) {
      const ultimo = grupo[grupo.length - 1];
      if (!ultimo || p.precio - ultimo.precio <= tol) grupo.push(p);
      else {
        if (grupo.length >= 2) out.push({ tipo, precio: grupo.reduce((a, x) => a + x.precio, 0) / grupo.length, cuantos: grupo.length });
        grupo = [p];
      }
    }
    if (grupo.length >= 2) out.push({ tipo, precio: grupo.reduce((a, x) => a + x.precio, 0) / grupo.length, cuantos: grupo.length });
  }
  return out;
}

/** Profundidad de un retroceso, en tanto por uno del impulso previo.
 *
 *  El número que la Parte IV necesita para hablar de retrocesos sin recurrir a
 *  Fibonacci, que llega en la Parte IX y que conviene NO adelantar: un
 *  retroceso es profundo o superficial mucho antes de que exista un 61,8. */
export function retrocesos(s: Series, izq = 3, der = 3): { desde: number; hasta: number; profundidad: number }[] {
  const sw = swings(s, izq, der);
  const out: { desde: number; hasta: number; profundidad: number }[] = [];
  for (let k = 2; k < sw.length; k++) {
    const a = sw[k - 2] as Swing;
    const b = sw[k - 1] as Swing;
    const d = sw[k] as Swing;
    if (a.tipo === b.tipo || b.tipo === d.tipo) continue;
    /* Los tres puntos tienen que ser velas DISTINTAS.
       Una misma vela puede ser swing alto y swing bajo a la vez —una outside
       bar que supera a sus vecinas por los dos lados— y eso es correcto: el
       fenómeno existe. Lo que no existe es un retroceso que va de un punto a
       sí mismo, y sin esta comprobación salía uno con `desde === hasta`. */
    if (!(a.i < b.i && b.i < d.i)) continue;
    const impulso = Math.abs(b.precio - a.precio);
    if (impulso <= 0) continue;
    out.push({ desde: b.i, hasta: d.i, profundidad: Math.abs(d.precio - b.precio) / impulso });
  }
  return out;
}
