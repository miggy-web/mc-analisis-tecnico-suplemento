/* ============================================================
   MC Análisis Técnico™ — velas japonesas · MIGGY CAPITAL

   La Parte III. Detecta las formaciones clásicas y, sobre todo, permite
   MEDIRLAS — que es lo que separa este capítulo de la lista de recetas que
   trae cualquier otro libro.

   ---------------------------------------------------------------------------
   LO QUE AQUÍ NO SE MIDE, Y POR QUÉ

   La tentación evidente es publicar un porcentaje de acierto: «el martillo
   funciona el 58 % de las veces». Se puede calcular sobre el banco de series
   en diez minutos y quedaría muy bien en una tabla.

   Sería deshonesto. Ese número no mediría el mercado: mediría el generador de
   series de este libro. Un martillo aparece en `rango` y le sigue un rebote
   porque el régimen `rango` está construido para revertir, no porque los
   martillos anticipen rebotes. Publicarlo con una nota al pie tampoco arregla
   nada — el lector se queda con la cifra y olvida la nota.

   Así que aquí se mide lo que SÍ se puede medir sin salirse de lo que los
   datos permiten afirmar, y que además es más útil:

     1. FRECUENCIA. Cuántas veces aparece cada formación. Si un patrón sale en
        una de cada quince velas, reconocerlo no es información: es ruido con
        nombre propio. Ese dato no depende de que el generador acierte con el
        mercado, porque es una propiedad de la DEFINICIÓN del patrón.

     2. SENSIBILIDAD AL UMBRAL. Cuánto cambia esa cuenta al mover la regla —si
        el martillo pide mecha ≥ 2 cuerpos o ≥ 2,5—. Un patrón cuya población
        se duplica al tocar un decimal no es un objeto que esté en el gráfico:
        es un convenio, y conviene saberlo antes de construir nada encima.

     3. SOLAPAMIENTO. Cuántas velas cumplen dos definiciones a la vez. Es la
        prueba de que «martillo» y «martillo invertido» no son categorías
        disjuntas del mundo, sino recortes que hicimos nosotros.

   Las tres son afirmaciones sobre las definiciones, no sobre el futuro, y las
   tres se sostienen sobre datos sintéticos sin engañar a nadie.
   ============================================================ */
import type { Bar, Series } from './types.ts';
import { at } from './types.ts';

/* ---------- anatomía de una vela ----------
   Todo lo demás se construye sobre estas cinco medidas. Vive aquí, en un solo
   sitio, porque media docena de patrones se definen como proporciones entre
   ellas y basta con que dos las calculen distinto para que dos capítulos del
   libro discrepen sobre la misma vela. */
export interface Anatomia {
  /** Recorrido total, de mínimo a máximo. */
  rango: number;
  /** Tamaño del cuerpo, sin signo. */
  cuerpo: number;
  /** Mecha de arriba. */
  superior: number;
  /** Mecha de abajo. */
  inferior: number;
  alcista: boolean;
  /** Dónde cierra dentro del rango: 0 = en el mínimo, 1 = en el máximo.
   *  Es el número que resume una vela mejor que ningún otro, y el que está
   *  detrás del estocástico, del A/D y de media lectura de velas. */
  cierreRelativo: number;
}

export function anatomia(b: Bar): Anatomia {
  const rango = b.h - b.l;
  const cuerpo = Math.abs(b.c - b.o);
  return {
    rango,
    cuerpo,
    superior: b.h - Math.max(b.o, b.c),
    inferior: Math.min(b.o, b.c) - b.l,
    alcista: b.c >= b.o,
    // Rango nulo: la vela no tiene «dentro». 0,5 es el centro, que es la única
    // respuesta neutra; 0 o 1 afirmarían un extremo que no existe.
    cierreRelativo: rango === 0 ? 0.5 : (b.c - b.l) / rango,
  };
}

/* ---------- los umbrales, en un solo sitio ----------
   Están agrupados a propósito y son un PARÁMETRO, no una constante de la
   naturaleza. El capítulo 3.4 los mueve delante del lector para enseñar cuánto
   cambia la población de cada patrón — que es la lección de toda la parte. */
export interface Umbrales {
  /** Cuerpo pequeño: fracción del rango por debajo de la cual la vela es indecisa. */
  cuerpoPequeno: number;
  /** Doji: cuerpo casi inexistente. */
  doji: number;
  /** Marubozu: mechas casi inexistentes. */
  marubozu: number;
  /** Martillo y estrella fugaz: cuántos cuerpos mide la mecha larga. */
  mechaLarga: number;
  /** La mecha corta del martillo, como fracción del rango. */
  mechaCorta: number;
  /** Vela de rango amplio: veces el rango medio reciente. */
  rangoAmplio: number;
  /** Ventana para el rango medio. */
  ventanaRango: number;
}

export const UMBRALES: Umbrales = {
  cuerpoPequeno: 0.3,
  doji: 0.05,
  marubozu: 0.05,
  mechaLarga: 2,
  mechaCorta: 0.15,
  rangoAmplio: 1.8,
  ventanaRango: 20,
};

export type PatronId =
  /* una vela */
  | 'marubozu-alcista' | 'marubozu-bajista' | 'doji' | 'peonza'
  | 'martillo' | 'hombre-colgado' | 'martillo-invertido' | 'estrella-fugaz'
  | 'rango-amplio' | 'rango-estrecho'
  /* dos velas */
  | 'envolvente-alcista' | 'envolvente-bajista' | 'harami-alcista' | 'harami-bajista'
  | 'piercing' | 'nube-oscura' | 'pinzas-techo' | 'pinzas-suelo'
  | 'inside-bar' | 'outside-bar'
  /* tres velas */
  | 'estrella-manana' | 'estrella-tarde'
  | 'tres-soldados' | 'tres-cuervos';

export interface Deteccion {
  patron: PatronId;
  /** Índice de la vela que CIERRA la formación. Es la única elección
   *  defendible: un patrón de tres velas no existe hasta que cierra la
   *  tercera, y fecharlo en la primera haría que el libro enseñara a verlo
   *  antes de que se pueda ver. */
  at: number;
  /** Lo que la tradición le atribuye. NO es una predicción: es la etiqueta con
   *  la que el patrón se enseña, y el libro la usa para poder contrastarla. */
  sesgo: 'alcista' | 'bajista' | 'indeciso';
  /** Cuántas velas ocupa. */
  velas: number;
}

/** Rango medio reciente, para poder decir si una vela es «grande». Sin esta
 *  referencia, «vela de rango amplio» no significa nada: cinco puntos son
 *  enormes en un activo y despreciables en otro. */
function rangoMedio(s: Series, i: number, n: number): number {
  const desde = Math.max(0, i - n);
  let acc = 0;
  let cuantas = 0;
  for (let j = desde; j < i; j++) {
    const b = s[j];
    if (!b) continue;
    acc += b.h - b.l;
    cuantas++;
  }
  return cuantas ? acc / cuantas : 0;
}

/* ============================================================
   Detección
   ============================================================ */

/** Todas las formaciones de una serie.
 *
 *  Una vela puede producir VARIAS detecciones y no se filtran: es
 *  intencionado. Que un martillo sea a la vez una peonza, o que una envolvente
 *  contenga un marubozu, es exactamente el dato del apartado de solapamiento —
 *  filtrarlo aquí escondería la lección. */
export function detectar(s: Series, u: Umbrales = UMBRALES): Deteccion[] {
  const out: Deteccion[] = [];
  const anot = (patron: PatronId, at: number, sesgo: Deteccion['sesgo'], velas = 1) =>
    out.push({ patron, at, sesgo, velas });

  for (let i = 0; i < s.length; i++) {
    const b = s[i];
    if (!b) continue;
    const a = anatomia(b);
    if (a.rango === 0) continue;

    const cuerpoRel = a.cuerpo / a.rango;
    const medio = rangoMedio(s, i, u.ventanaRango);

    /* ---- una vela ---- */
    if (cuerpoRel <= u.doji) anot('doji', i, 'indeciso');
    else if (cuerpoRel <= u.cuerpoPequeno) anot('peonza', i, 'indeciso');

    if (cuerpoRel >= 1 - u.marubozu * 2) {
      anot(a.alcista ? 'marubozu-alcista' : 'marubozu-bajista', i, a.alcista ? 'alcista' : 'bajista');
    }

    // Martillo y hombre colgado son LA MISMA vela. Solo las distingue lo que
    // vino antes, y el libro lo usa para explicar que el contexto no es un
    // adorno del patrón: es parte de su definición.
    const mechaAbajo = a.cuerpo > 0 && a.inferior >= u.mechaLarga * a.cuerpo && a.superior <= u.mechaCorta * a.rango;
    const mechaArriba = a.cuerpo > 0 && a.superior >= u.mechaLarga * a.cuerpo && a.inferior <= u.mechaCorta * a.rango;
    if (mechaAbajo) anot(tendenciaPrevia(s, i) === 'baja' ? 'martillo' : 'hombre-colgado', i, tendenciaPrevia(s, i) === 'baja' ? 'alcista' : 'bajista');
    if (mechaArriba) anot(tendenciaPrevia(s, i) === 'baja' ? 'martillo-invertido' : 'estrella-fugaz', i, tendenciaPrevia(s, i) === 'baja' ? 'alcista' : 'bajista');

    if (medio > 0 && a.rango >= u.rangoAmplio * medio) anot('rango-amplio', i, a.alcista ? 'alcista' : 'bajista');
    if (medio > 0 && a.rango <= medio / u.rangoAmplio) anot('rango-estrecho', i, 'indeciso');

    /* ---- dos velas ---- */
    const p = s[i - 1];
    if (p) {
      const ap = anatomia(p);
      const cuerpoAlto = Math.max(b.o, b.c);
      const cuerpoBajo = Math.min(b.o, b.c);
      const pAlto = Math.max(p.o, p.c);
      const pBajo = Math.min(p.o, p.c);

      if (!ap.alcista && a.alcista && cuerpoBajo <= pBajo && cuerpoAlto >= pAlto && a.cuerpo > ap.cuerpo) {
        anot('envolvente-alcista', i, 'alcista', 2);
      }
      if (ap.alcista && !a.alcista && cuerpoBajo <= pBajo && cuerpoAlto >= pAlto && a.cuerpo > ap.cuerpo) {
        anot('envolvente-bajista', i, 'bajista', 2);
      }
      if (cuerpoAlto <= pAlto && cuerpoBajo >= pBajo && ap.cuerpo > a.cuerpo * 1.5) {
        anot(ap.alcista ? 'harami-bajista' : 'harami-alcista', i, ap.alcista ? 'bajista' : 'alcista', 2);
      }
      // Penetración: abre por debajo del mínimo anterior y cierra por encima
      // de la mitad del cuerpo anterior.
      const mitadPrev = (p.o + p.c) / 2;
      if (!ap.alcista && a.alcista && b.o < p.l && b.c > mitadPrev && b.c < p.o) anot('piercing', i, 'alcista', 2);
      if (ap.alcista && !a.alcista && b.o > p.h && b.c < mitadPrev && b.c > p.o) anot('nube-oscura', i, 'bajista', 2);

      const tolPinza = a.rango * 0.05;
      if (Math.abs(b.h - p.h) <= tolPinza && ap.alcista && !a.alcista) anot('pinzas-techo', i, 'bajista', 2);
      if (Math.abs(b.l - p.l) <= tolPinza && !ap.alcista && a.alcista) anot('pinzas-suelo', i, 'alcista', 2);

      if (b.h <= p.h && b.l >= p.l) anot('inside-bar', i, 'indeciso', 2);
      if (b.h >= p.h && b.l <= p.l && a.rango > ap.rango) anot('outside-bar', i, a.alcista ? 'alcista' : 'bajista', 2);
    }

    /* ---- tres velas ---- */
    const p2 = s[i - 2];
    if (p && p2) {
      const a1 = anatomia(p2);
      const a2 = anatomia(p);
      const mitad1 = (p2.o + p2.c) / 2;

      if (!a1.alcista && a2.cuerpo / Math.max(a2.rango, 1e-9) <= u.cuerpoPequeno && a.alcista && b.c > mitad1) {
        anot('estrella-manana', i, 'alcista', 3);
      }
      if (a1.alcista && a2.cuerpo / Math.max(a2.rango, 1e-9) <= u.cuerpoPequeno && !a.alcista && b.c < mitad1) {
        anot('estrella-tarde', i, 'bajista', 3);
      }
      const tresSubiendo = a1.alcista && a2.alcista && a.alcista && p.c > p2.c && b.c > p.c;
      const tresBajando = !a1.alcista && !a2.alcista && !a.alcista && p.c < p2.c && b.c < p.c;
      const cuerposDecentes = [a1, a2, a].every((x) => x.cuerpo / Math.max(x.rango, 1e-9) >= 0.5);
      if (tresSubiendo && cuerposDecentes) anot('tres-soldados', i, 'alcista', 3);
      if (tresBajando && cuerposDecentes) anot('tres-cuervos', i, 'bajista', 3);
    }
  }
  return out;
}

/** Si venía subiendo o bajando antes de esta vela.
 *
 *  Hace falta porque hay parejas de patrones que son la MISMA figura y solo se
 *  distinguen por lo anterior: martillo y hombre colgado, martillo invertido y
 *  estrella fugaz. Es la mejor demostración del libro de que un patrón sin
 *  contexto no está definido — ni siquiera se puede nombrar. */
export function tendenciaPrevia(s: Series, i: number, n = 5): 'sube' | 'baja' | 'plano' {
  const desde = Math.max(0, i - n);
  const a = s[desde];
  const b = s[i - 1] ?? s[i];
  if (!a || !b || i === 0) return 'plano';
  const dif = b.c - a.c;
  const escala = rangoMedio(s, i, 10) || Math.abs(a.c) * 0.001;
  if (dif > escala * 0.6) return 'sube';
  if (dif < -escala * 0.6) return 'baja';
  return 'plano';
}

/* ============================================================
   Las tres mediciones honestas
   ============================================================ */

export interface Frecuencia {
  patron: PatronId;
  /** Cuántas veces aparece. */
  veces: number;
  /** Una de cada cuántas velas. Es la cifra que se imprime: «uno de cada 15»
   *  se entiende y un 6,7 % no. */
  unaDeCada: number | null;
}

/** Con qué frecuencia aparece cada formación en un conjunto de series.
 *
 *  Es una propiedad de la DEFINICIÓN, no del mercado: si el doji sale en una
 *  de cada nueve velas, reconocerlo aporta poquísimo, y eso es cierto aquí y
 *  en cualquier gráfico real, porque depende de dónde pusimos el umbral. */
export function frecuencias(series: Series[], u: Umbrales = UMBRALES): Frecuencia[] {
  const cuenta = new Map<PatronId, number>();
  let velas = 0;
  for (const s of series) {
    velas += s.length;
    for (const d of detectar(s, u)) cuenta.set(d.patron, (cuenta.get(d.patron) ?? 0) + 1);
  }
  return [...cuenta.entries()]
    .map(([patron, veces]) => ({
      patron,
      veces,
      unaDeCada: veces ? Math.round(velas / veces) : null,
    }))
    .sort((a, b) => b.veces - a.veces);
}

/** Cuánto cambia la población de un patrón al mover su umbral.
 *
 *  El apartado más incómodo de la Parte III y el que más falta hace. Si al
 *  pasar la mecha del martillo de 2 a 2,5 cuerpos desaparecen la mitad de los
 *  martillos, entonces «esto es un martillo» no es una observación sobre el
 *  gráfico: es una decisión nuestra que nadie ha acordado. */
export function sensibilidad(
  series: Series[],
  patron: PatronId,
  clave: keyof Umbrales,
  valores: number[],
): { valor: number; veces: number }[] {
  return valores.map((valor) => {
    const u = { ...UMBRALES, [clave]: valor };
    let veces = 0;
    for (const s of series) veces += detectar(s, u).filter((d) => d.patron === patron).length;
    return { valor, veces };
  });
}

/** Cuántas velas cumplen a la vez dos definiciones distintas.
 *
 *  Prueba de que las categorías no son disjuntas. Un lector que aprende
 *  veintitantos nombres suele creer que cada vela es exactamente uno de ellos;
 *  no lo es, y saberlo cambia cómo se lee un gráfico. */
export function solapamiento(series: Series[], u: Umbrales = UMBRALES): { a: PatronId; b: PatronId; veces: number }[] {
  const pares = new Map<string, number>();
  for (const s of series) {
    const porVela = new Map<number, PatronId[]>();
    for (const d of detectar(s, u)) {
      const lista = porVela.get(d.at) ?? [];
      lista.push(d.patron);
      porVela.set(d.at, lista);
    }
    for (const lista of porVela.values()) {
      const unicos = [...new Set(lista)].sort();
      for (let i = 0; i < unicos.length; i++) {
        for (let j = i + 1; j < unicos.length; j++) {
          const k = `${unicos[i]}|${unicos[j]}`;
          pares.set(k, (pares.get(k) ?? 0) + 1);
        }
      }
    }
  }
  return [...pares.entries()]
    .map(([k, veces]) => {
      const [a, b] = k.split('|') as [PatronId, PatronId];
      return { a, b, veces };
    })
    .sort((x, y) => y.veces - x.veces);
}

export const PATRON_LABEL: Record<PatronId, { es: string; en: string }> = {
  'marubozu-alcista': { es: 'Marubozu alcista', en: 'Bullish marubozu' },
  'marubozu-bajista': { es: 'Marubozu bajista', en: 'Bearish marubozu' },
  doji: { es: 'Doji', en: 'Doji' },
  peonza: { es: 'Peonza', en: 'Spinning top' },
  martillo: { es: 'Martillo', en: 'Hammer' },
  'hombre-colgado': { es: 'Hombre colgado', en: 'Hanging man' },
  'martillo-invertido': { es: 'Martillo invertido', en: 'Inverted hammer' },
  'estrella-fugaz': { es: 'Estrella fugaz', en: 'Shooting star' },
  'rango-amplio': { es: 'Vela de rango amplio', en: 'Wide range candle' },
  'rango-estrecho': { es: 'Vela de rango estrecho', en: 'Narrow range candle' },
  'envolvente-alcista': { es: 'Envolvente alcista', en: 'Bullish engulfing' },
  'envolvente-bajista': { es: 'Envolvente bajista', en: 'Bearish engulfing' },
  'harami-alcista': { es: 'Harami alcista', en: 'Bullish harami' },
  'harami-bajista': { es: 'Harami bajista', en: 'Bearish harami' },
  piercing: { es: 'Línea penetrante', en: 'Piercing line' },
  'nube-oscura': { es: 'Nube oscura', en: 'Dark cloud cover' },
  'pinzas-techo': { es: 'Pinzas de techo', en: 'Tweezer top' },
  'pinzas-suelo': { es: 'Pinzas de suelo', en: 'Tweezer bottom' },
  'inside-bar': { es: 'Inside bar', en: 'Inside bar' },
  'outside-bar': { es: 'Outside bar', en: 'Outside bar' },
  'estrella-manana': { es: 'Estrella del amanecer', en: 'Morning star' },
  'estrella-tarde': { es: 'Estrella del atardecer', en: 'Evening star' },
  'tres-soldados': { es: 'Tres soldados blancos', en: 'Three white soldiers' },
  'tres-cuervos': { es: 'Tres cuervos negros', en: 'Three black crows' },
};
