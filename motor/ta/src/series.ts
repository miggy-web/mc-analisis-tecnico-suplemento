/* ============================================================
   MC Análisis Técnico™ — series sintéticas por régimen · MIGGY CAPITAL

   De aquí salen TODAS las velas del libro y de la app. Ninguna figura es una
   captura de pantalla y ninguna se dibuja a mano, por la misma razón que en MC
   Finanzas ninguna cifra se escribe a mano: una figura dibujada no se puede
   recalcular. Si mañana se corrige la implementación del RSI, las doscientas
   figuras que llevan un RSI tienen que volver a salir bien solas.

   ---------------------------------------------------------------------------
   POR QUÉ RÉGIMEN Y NO «SUBE / BAJA»

   Un libro de análisis técnico se sostiene sobre una afirmación que hay que
   poder ENSEÑAR: cada herramienta funciona en unas condiciones y falla en
   otras. Para enseñarlo hacen falta series que tengan carácter de verdad —
   que una tendencia mantenga el RSI arriba sin girarse, que un rango lo haga
   oscilar limpio entre 30 y 70, y que una sierra rompa a todos.

   Si las series fueran ruido con deriva, el capítulo «cuándo falla» no tendría
   figura, que es exactamente lo que le pasa a la mayoría de los libros del
   género: enseñan el caso bonito porque es el único que encontraron.

   ---------------------------------------------------------------------------
   EL VOLUMEN NO ES DECORATIVO

   Se genera con dos propiedades reales del mercado, porque media enciclopedia
   (OBV, MFI, CMF, clímax, confirmación de rupturas, perfil, VWAP) se cae si el
   volumen es ruido:

     · reacciona al movimiento — una vela de rango grande trae más volumen;
     · tiene perfil de fase — muere en una compresión, estalla en un clímax y
       se apaga en un agotamiento.

   La segunda es la que permite que exista el capítulo de divergencia
   precio-volumen. Sin ella, esa divergencia habría que dibujarla.
   ============================================================ */
import type { Bar, Series } from './types.ts';
import { at } from './types.ts';

/* ---------- RNG determinista (mulberry32) ----------
   El mismo de MCI Futures, MC Options y MC Finanzas. Que sea el mismo importa:
   una seed reproduce la misma figura hoy, en la reimpresión y en el ejercicio
   de la app. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ruido centrado en cero, en [-1, 1]. */
const noise = (r: () => number) => r() * 2 - 1;

/** Suavizado de Hermite. Un impulso que arranca y frena se parece mucho más a
 *  un movimiento real que una rampa recta. */
const ease = (t: number) => t * t * (3 - 2 * t);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ============================================================
   Los quince regímenes.

   Cubren lo que el libro necesita demostrar. No son estilos gráficos: son las
   condiciones de mercado a las que se refiere cada ficha en «contexto
   favorable» y «contexto desfavorable».
   ============================================================ */
export type Regime =
  /* direccionales */
  | 'alcista'       // tendencia con retrocesos — el hábitat de las medias
  | 'bajista'
  | 'impulso'       // desplazamiento limpio y rápido, mechas cortas
  | 'escalera'      // impulso, pausa, impulso — la tendencia que no retrocede
  | 'parabolica'    // aceleración creciente — donde el RSI vive sobrecomprado
  /* laterales */
  | 'rango'         // reversión a la media — el hábitat de los osciladores
  | 'deriva'        // volatilidad muy baja, casi plano
  | 'squeeze'       // la volatilidad se comprime hacia el final
  | 'expansion'     // la volatilidad se abre tras comprimirse
  | 'sierra'        // vaivén de alta frecuencia — el asesino de indicadores
  /* de giro */
  | 'climax'        // aceleración y vela final de mecha larga y volumen enorme
  | 'agotamiento'   // el precio sigue pero el volumen y el rango se apagan
  | 'capitulacion'  // caída violenta con pánico y recuperación en V
  | 'acumulacion'   // rango con barrido del mínimo (spring de Wyckoff)
  | 'distribucion'; // rango con barrido del máximo (upthrust)

/** Una fase de la serie. Encadenándolas se construye cualquier escenario del
 *  libro: `squeeze` → `expansion` → `climax` es el capítulo de compresión y
 *  expansión entero. */
export interface Phase {
  regime: Regime;
  /** Cuántas velas dura. */
  n: number;
  /** A qué precio termina. Si falta, lo decide el régimen (un rango vuelve a
   *  donde empezó; una tendencia avanza lo que le toca por su volatilidad). */
  to?: number;
  /** Amplitud del movimiento vela a vela, en unidades de precio. Es la
   *  volatilidad de la fase. */
  vol?: number;
  /** Volumen base de la fase. Si falta, hereda el de la serie. */
  volume?: number;
}

export interface SeriesSpec {
  /** Precio de la primera apertura. */
  start: number;
  phases: Phase[];
  seed?: number;
  /** Tamaño de tick. 0.25 en ES, 0.01 en acciones, 1 en un índice. Redondear
   *  al tick es lo que hace que la figura parezca de un mercado y no de una
   *  hoja de cálculo. */
  tick?: number;
  /** Volumen base de la serie. */
  volume?: number;
}

/* ---------- lo que cada régimen decide, vela a vela ----------
   Cada régimen produce tres arrays de longitud n. Separarlos así permite que
   un clímax ponga su mecha larga y su volumen enorme SOLO en la última vela,
   en vez de repartir el carácter por igual, que es lo que delata a una serie
   generada. */
interface Shape {
  /** El cierre de cada vela. */
  path: number[];
  /** Multiplicador del tamaño de mecha de cada vela. */
  wick: number[];
  /** Multiplicador del volumen de cada vela. */
  vmul: number[];
}

type Builder = (from: number, p: Phase, r: () => number) => Shape;

/** Velas mínimas por tramo dentro de un rango.
 *
 *  El número está atado al periodo de los osciladores que el libro enseña,
 *  y esa relación es la razón de que exista la constante en vez de un literal.
 *  Un RSI de 14 promedia catorce velas: con tramos de cinco, cada lectura
 *  mezcla una subida y una bajada completas y el resultado se queda pegado a
 *  50 haga lo que haga el precio. Con tramos de doce a veinte, el oscilador
 *  llega a sus extremos como llega en un rango real.
 *
 *  Dicho de otro modo: lo que decide si un lateral sirve para enseñar un
 *  oscilador no es su amplitud, es la longitud de sus tramos frente al periodo
 *  del oscilador. */
const LARGO_TRAMO = 12;

/** Con qué frecuencia abre con hueco cada régimen.
 *
 *  No es un número por activo, es un número por CONDICIÓN: un mercado dormido
 *  abre donde cerró, y uno en pánico abre donde puede. Que la capitulación
 *  tenga cinco veces más huecos que la deriva es lo que hace que el capítulo
 *  de huecos de agotamiento tenga sobre qué medirse. */
const HUECOS: Partial<Record<Regime, number>> = {
  deriva: 0.02, rango: 0.035, squeeze: 0.02, acumulacion: 0.04, distribucion: 0.04,
  alcista: 0.05, bajista: 0.05, escalera: 0.05, impulso: 0.06, sierra: 0.06,
  expansion: 0.08, parabolica: 0.08, agotamiento: 0.07,
  climax: 0.12, capitulacion: 0.14,
};

/** Hasta dónde puede caer una fase, como fracción del precio de partida.
 *
 *  Un precio no puede ser negativo, y un generador que los produce está roto
 *  aunque las velas se vean bien. El fallo llegó a imprimirse en un MFI: la
 *  fórmula solo puede devolver entre 0 y 100 y devolvió −1,12, porque el
 *  precio típico de la vela era negativo.
 *
 *  La causa era que todas las caídas se calculaban en términos ABSOLUTOS
 *  —`volatilidad × número de velas`— así que bastaba alargar la serie para
 *  cruzar el cero. Con 150 velas la capitulación bajaba a 15; con 200, a −12.
 *  Nada avisaba: las velas seguían cumpliendo que el máximo contiene al cuerpo.
 *
 *  Un mercado puede caer un noventa por ciento y nunca por debajo de cero, así
 *  que el límite tiene que ser proporcional al precio, no a la duración. */
const SUELO = 0.35;

const caidaMaxima = (from: number, pedida: number) => Math.min(pedida, from * (1 - SUELO));

/** Objetivo por defecto de una fase, cuando el spec no lo fija. */
function defaultTo(from: number, p: Phase): number {
  const v = p.vol ?? 1;
  const avance = v * p.n * 0.35;
  switch (p.regime) {
    case 'alcista': case 'impulso': case 'escalera': case 'parabolica': case 'expansion':
      return from + avance;
    case 'bajista':
      return from - caidaMaxima(from, avance);
    case 'climax':
      return from + avance * 1.3;
    case 'capitulacion':
      return from - caidaMaxima(from, avance * 0.4);
    case 'agotamiento':
      return from + avance * 0.3;
    default:
      return from; // los laterales vuelven a casa
  }
}

const BUILDERS: Record<Regime, Builder> = {
  /* ---------- direccionales ---------- */

  /** Tendencia con retrocesos. Tres de cada cuatro velas avanzan; el resto
   *  corrige. Es el régimen que hace que una media funcione como soporte
   *  dinámico, y por eso es el que ilustra la Parte VI entera. */
  alcista: (from, p, r) => tendencia(from, p, r, +1),
  bajista: (from, p, r) => tendencia(from, p, r, -1),

  /** Desplazamiento: rápido, sin retroceso y con mechas cortas. La vela de
   *  cuerpo grande y mecha mínima del capítulo de expansión. */
  impulso: (from, p, r) => {
    const to = p.to ?? defaultTo(from, p);
    const vol = p.vol ?? 1;
    const path: number[] = [];
    for (let i = 0; i < p.n; i++) {
      const t = (i + 1) / p.n;
      path.push(lerp(from, to, ease(t)) + noise(r) * vol * 0.18);
    }
    return {
      path,
      wick: path.map(() => 0.15 + r() * 0.1),
      vmul: path.map((_, i) => 1.3 + 0.5 * ease((i + 1) / p.n)),
    };
  },

  /** Escalera: impulso, pausa, impulso. La tendencia que nunca da un retroceso
   *  decente — la que arruina a quien espera el pullback a la media. */
  escalera: (from, p, r) => {
    const to = p.to ?? defaultTo(from, p);
    const vol = p.vol ?? 1;
    const path: number[] = [];
    const tramos = Math.max(2, Math.round(p.n / 6));
    for (let i = 0; i < p.n; i++) {
      const t = (i + 1) / p.n;
      // Escalón: avanza a saltos, con mesetas entre ellos.
      const paso = Math.floor(t * tramos) / tramos;
      const dentro = (t * tramos) % 1;
      const salto = dentro < 0.45 ? ease(dentro / 0.45) / tramos : 1 / tramos;
      path.push(lerp(from, to, Math.min(1, paso + salto)) + noise(r) * vol * 0.3);
    }
    return {
      path,
      wick: path.map(() => 0.35 + r() * 0.3),
      vmul: path.map((_, i) => {
        const dentro = (((i + 1) / p.n) * tramos) % 1;
        return dentro < 0.45 ? 1.5 : 0.7; // el volumen aparece en el escalón
      }),
    };
  },

  /** Parabólica: cada tramo avanza más que el anterior. Donde el RSI se queda
   *  clavado por encima de 75 durante veinte velas y «sobrecompra» deja de
   *  significar «vende». */
  parabolica: (from, p, r) => {
    const to = p.to ?? defaultTo(from, p);
    const vol = p.vol ?? 1;
    const path: number[] = [];
    /* El ruido crece con la velocidad de la curva, y no es un adorno.

       Con ruido constante, la parábola salía como la gráfica de una función:
       velas minúsculas sobre una curva perfecta, sin un solo retroceso. En un
       libro que promete «gráficos imperfectos y realistas» eso es justo lo
       contrario, y además enseña a reconocer una forma que ningún mercado ha
       producido — una subida parabólica de verdad tiene sacudidas cada vez
       MÁS grandes, porque la volatilidad sube con el precio.

       Se mide la pendiente local y de ahí sale tanto el ruido como algún
       retroceso ocasional. */
    let anterior = from;
    for (let i = 0; i < p.n; i++) {
      const t = (i + 1) / p.n;
      const base = lerp(from, to, t ** 2.6);
      const velocidad = Math.max(vol * 0.35, Math.abs(base - anterior));
      // Un retroceso de vez en cuando, y más probable cuanto más madura va la
      // subida: es lo que hace que la curva tenga escalones y no sea una
      // rampa.
      const retrocede = r() < 0.16 + 0.14 * t;
      const empuje = retrocede ? -velocidad * (0.5 + r() * 0.9) : 0;
      path.push(base + empuje + noise(r) * velocidad * 0.75);
      anterior = base;
    }
    return {
      path,
      wick: path.map((_, i) => 0.3 + 0.7 * ((i + 1) / p.n)),
      vmul: path.map((_, i) => 0.8 + 2.2 * ((i + 1) / p.n) ** 2),
    };
  },

  /* ---------- laterales ---------- */

  /** Rango con tramos. El hábitat natural de los osciladores: aquí
   *  «sobreventa» sí anticipa un rebote, y el libro lo demuestra con la misma
   *  herramienta que falla en `parabolica`.
   *
   *  ---------------------------------------------------------------------
   *  POR QUÉ TRAMOS Y NO REVERSIÓN VELA A VELA
   *
   *  La primera versión era un Ornstein-Uhlenbeck puro: cada vela tiraba hacia
   *  el centro con fuerza proporcional a la distancia. Producía un lateral de
   *  aspecto impecable y era INSERVIBLE para enseñar, porque con la subida y
   *  la bajada repartidas vela a vela el RSI se quedaba entre 37 y 63 — nunca
   *  tocaba 70 ni 30.
   *
   *  Y la figura salía preciosa igual. Solo se descubrió al comprobar el pie
   *  contra los números: el texto prometía «cada vez que el RSI pasa de 70» en
   *  un gráfico donde el RSI jamás pasaba de 70.
   *
   *  Un rango real no revierte cada vela: sube varias, se gira, baja varias.
   *  Esos tramos son los que llevan al oscilador a sus extremos, los que crean
   *  swings reconocibles y los que hacen posible una divergencia. Sin ellos no
   *  hay Parte VII que enseñar. */
  rango: (from, p, r) => {
    const centro = p.to ?? from;
    const vol = p.vol ?? 1;
    /* La amplitud se deriva del largo del tramo, y no al revés.
     *
     * Con una amplitud fija pequeña, el precio llegaba al borde del rango en
     * cuatro velas y giraba ahí, así que los tramos duraban cuatro velas
     * hiciera lo que hiciera `LARGO_TRAMO`. Se comprobó barriendo el
     * parámetro de 12 a 28: el RSI daba EXACTAMENTE el mismo 33–67 en todos
     * los casos. El límite no era el que se estaba tocando.
     *
     * Atándola al tramo —media amplitud por vela de recorrido— el tramo dura
     * lo que dice durar. Medido sobre doce seeds, el RSI recorre 25–75 y
     * cruza los dos umbrales en las doce. */
    const amp = vol * LARGO_TRAMO * 0.5;
    const path: number[] = [];
    let x = from;
    let dir: 1 | -1 = x > centro ? -1 : 1;
    let quedan = LARGO_TRAMO + Math.floor(r() * 8);
    /* Cada tramo tiene su propio carácter. Sin esto, todos avanzaban al mismo
       ritmo y el rango salía como una sierra de dientes idénticos: un dibujo
       que ningún mercado ha producido nunca y que, puesto en un libro, enseña
       a reconocer una forma que no existe.

       Un rango real tiene tramos rápidos y tramos perezosos, y dentro de cada
       uno hay velas que no van a ninguna parte. */
    let ritmo = 0.7 + r() * 0.7;

    for (let i = 0; i < p.n; i++) {
      // Cerca del borde el giro deja de ser cuestión de suerte: es el techo o
      // el suelo del rango lo que lo provoca, y eso es lo que dibuja niveles
      // horizontales reconocibles en vez de una nube con bordes difusos.
      const posicion = (x - centro) / amp;
      const forzado = (dir === 1 && posicion > 0.82) || (dir === -1 && posicion < -0.82);
      if (quedan-- <= 0 || forzado) {
        dir = dir === 1 ? -1 : 1;
        quedan = LARGO_TRAMO + Math.floor(r() * 8);
        ritmo = 0.7 + r() * 0.7;
      }
      /* El avance se frena al acercarse al extremo: así los giros no son
         picos, sino techos y suelos con algo de anchura.

         El tope es 0,45 y no 0,75 por una razón medida: con el freno fuerte,
         las últimas velas de cada tramo avanzaban un cuarto de lo normal, y
         esas ganancias diminutas hundían la media del RSI justo donde tenía
         que marcar su máximo. El resultado era un rango que nunca pasaba de
         69 — un techo invisible puesto por el generador, no por el mercado. */
      const freno = 1 - Math.min(0.45, Math.abs(posicion) ** 2 * 0.45);
      // Una de cada seis velas es una pausa o un retroceso menor dentro del
      // tramo. Es lo que convierte una diagonal recta en un movimiento.
      const dado = r();
      const paso = dado < 0.11 ? -0.35 : dado < 0.17 ? 0.05 : 0.62 + r() * 0.5;
      x += dir * vol * paso * ritmo * freno + noise(r) * vol * 0.26;
      x = Math.max(centro - amp * 1.05, Math.min(centro + amp * 1.05, x));
      path.push(x);
    }
    return {
      path,
      wick: path.map(() => 0.6 + r() * 0.5),
      // El volumen baja según el rango madura: es la premisa del capítulo de
      // compresión y de la confirmación de rupturas.
      vmul: path.map((_, i) => 1.05 - 0.35 * ((i + 1) / p.n) + r() * 0.2),
    };
  },

  /** Deriva: casi plano. Sirve para enseñar que una media plana no dice nada y
   *  que un cruce en deriva es ruido con nombre. */
  deriva: (from, p, r) => {
    const to = p.to ?? from;
    const vol = (p.vol ?? 1) * 0.3;
    const path: number[] = [];
    let x = from;
    for (let i = 0; i < p.n; i++) {
      x += (lerp(from, to, (i + 1) / p.n) - x) * 0.25 + noise(r) * vol;
      path.push(x);
    }
    return { path, wick: path.map(() => 0.5 + r() * 0.4), vmul: path.map(() => 0.45 + r() * 0.2) };
  },

  /** Compresión: la volatilidad se estrecha hacia el final. El squeeze de
   *  Bollinger, el triángulo del chartismo y la premisa del TTM Squeeze son
   *  esta misma serie mirada con tres herramientas distintas. */
  squeeze: (from, p, r) => {
    const centro = p.to ?? from;
    const vol = p.vol ?? 1;
    const path: number[] = [];
    let x = from;
    for (let i = 0; i < p.n; i++) {
      const t = (i + 1) / p.n;
      const escala = lerp(1.25, 0.16, ease(t)); // se cierra de verdad
      x = x + (centro - x) * 0.2 + noise(r) * vol * escala;
      path.push(x);
    }
    return {
      path,
      wick: path.map((_, i) => lerp(0.9, 0.25, (i + 1) / p.n)),
      vmul: path.map((_, i) => lerp(1.0, 0.35, (i + 1) / p.n) + r() * 0.12),
    };
  },

  /** Expansión: sale de la compresión y se abre. Lo que hace que «las bandas
   *  estrechas no son una señal, son un aviso» tenga figura. */
  expansion: (from, p, r) => {
    const to = p.to ?? defaultTo(from, p);
    const vol = p.vol ?? 1;
    const path: number[] = [];
    for (let i = 0; i < p.n; i++) {
      const t = (i + 1) / p.n;
      path.push(lerp(from, to, ease(t)) + noise(r) * vol * lerp(0.25, 1.1, t));
    }
    return {
      path,
      wick: path.map((_, i) => lerp(0.25, 0.8, (i + 1) / p.n)),
      vmul: path.map((_, i) => lerp(1.6, 1.0, (i + 1) / p.n)),
    };
  },

  /** Sierra: giros frecuentes de amplitud media. El régimen que rompe cruces
   *  de medias, MACD y rupturas por igual, y sin el cual la sección «contexto
   *  desfavorable» de cada ficha sería una opinión sin gráfico. */
  sierra: (from, p, r) => {
    const centro = p.to ?? from;
    const vol = p.vol ?? 1;
    const path: number[] = [];
    let x = from;
    let dir = r() < 0.5 ? -1 : 1;
    let quedan = 2 + Math.floor(r() * 2);
    for (let i = 0; i < p.n; i++) {
      if (quedan-- <= 0) { dir = -dir; quedan = 2 + Math.floor(r() * 3); }
      x += dir * vol * (1.1 + r() * 0.7) + (centro - x) * 0.12;
      path.push(x);
    }
    return {
      path,
      wick: path.map(() => 0.9 + r() * 0.7), // mechas por todas partes
      vmul: path.map(() => 0.75 + r() * 0.5),
    };
  },

  /* ---------- de giro ---------- */

  /** Clímax: aceleración y una última vela de rango enorme, mecha larga y
   *  volumen que multiplica al de la fase. Es «esfuerzo sin resultado» de
   *  Wyckoff y el clímax de volumen de la Parte XI, en la misma serie. */
  climax: (from, p, r) => {
    const to = p.to ?? defaultTo(from, p);
    const vol = p.vol ?? 1;
    const path: number[] = [];
    for (let i = 0; i < p.n; i++) {
      const t = (i + 1) / p.n;
      path.push(lerp(from, to, t ** 2.2) + noise(r) * vol * 0.3);
    }
    // La última vela se pasa de largo y vuelve: el resultado no acompaña al
    // esfuerzo. La mecha la pone `wick`, el exceso lo pone aquí.
    const k = p.n - 1;
    if (k >= 0) path[k] = at(path, k) - vol * 0.8;
    return {
      path,
      wick: path.map((_, i) => (i === k ? 4.2 : 0.3 + 0.6 * ((i + 1) / p.n))),
      vmul: path.map((_, i) => (i === k ? 5.5 : 0.9 + 1.8 * ((i + 1) / p.n) ** 2)),
    };
  },

  /** Agotamiento: el precio todavía avanza pero cada vez menos, con el rango y
   *  el volumen cayendo. La divergencia precio-volumen del libro nace aquí, y
   *  nace CALCULADA, no dibujada. */
  agotamiento: (from, p, r) => {
    const to = p.to ?? defaultTo(from, p);
    const vol = p.vol ?? 1;
    const path: number[] = [];
    for (let i = 0; i < p.n; i++) {
      const t = (i + 1) / p.n;
      path.push(lerp(from, to, Math.sqrt(t)) + noise(r) * vol * lerp(0.7, 0.2, t));
    }
    return {
      path,
      wick: path.map((_, i) => lerp(0.5, 1.4, (i + 1) / p.n)), // mechas arriba
      vmul: path.map((_, i) => lerp(1.5, 0.4, (i + 1) / p.n)),
    };
  },

  /** Capitulación: desplome con pánico y vuelta en V. El suelo que no se
   *  construye, se hace de golpe. */
  capitulacion: (from, p, r) => {
    const vol = p.vol ?? 1;
    const fondo = from - caidaMaxima(from, vol * p.n * 0.55);
    const fin = p.to ?? from - caidaMaxima(from, vol * p.n * 0.15);
    const kf = Math.max(1, Math.round(p.n * 0.55));
    const path: number[] = [];
    for (let i = 0; i < p.n; i++) {
      if (i < kf) {
        const t = (i + 1) / kf;
        path.push(lerp(from, fondo, t ** 1.8) + noise(r) * vol * 0.45);
      } else {
        const t = (i - kf + 1) / (p.n - kf);
        path.push(lerp(fondo, fin, ease(t)) + noise(r) * vol * 0.4);
      }
    }
    return {
      path,
      wick: path.map((_, i) => (i === kf - 1 ? 3.5 : 0.8 + r() * 0.6)),
      vmul: path.map((_, i) => (i >= kf - 2 && i <= kf ? 4.5 : 1.1 + r() * 0.6)),
    };
  },

  /** Acumulación de Wyckoff: rango que barre su propio mínimo (spring) y
   *  vuelve dentro. Es, a la vez, el spring de la Parte XII, el barrido de
   *  liquidez de la Parte XII y la falsa ruptura de la Parte IV — tres
   *  capítulos distintos sobre la MISMA figura, que es justo lo que la
   *  enciclopedia quiere enseñar. */
  acumulacion: (from, p, r) => rangoConBarrido(from, p, r, 'low'),
  /** Distribución: el mismo rango, barriendo el máximo (upthrust). */
  distribucion: (from, p, r) => rangoConBarrido(from, p, r, 'high'),
};

/** Tendencia con retrocesos, en la dirección que se le pida. */
function tendencia(from: number, p: Phase, r: () => number, dir: 1 | -1): Shape {
  const to = p.to ?? defaultTo(from, p);
  const vol = p.vol ?? 1;
  const path: number[] = [];
  const wick: number[] = [];
  const vmul: number[] = [];
  let x = from;
  let corrigiendo = false;
  let quedan = 3 + Math.floor(r() * 3);
  const paso = ((to - from) / p.n) * 1.55; // avance medio por vela de impulso

  for (let i = 0; i < p.n; i++) {
    if (quedan-- <= 0) {
      corrigiendo = !corrigiendo;
      // Los retrocesos son más cortos que los impulsos: eso es lo que hace que
      // la serie avance y que los máximos y mínimos sean crecientes.
      quedan = corrigiendo ? 1 + Math.floor(r() * 3) : 3 + Math.floor(r() * 4);
    }
    const avance = corrigiendo ? -paso * (0.42 + r() * 0.3) : paso * (0.75 + r() * 0.5);
    x += avance + noise(r) * vol * 0.42;
    path.push(x);
    // En el impulso las mechas se acortan; en la corrección se alargan.
    wick.push(corrigiendo ? 0.85 + r() * 0.5 : 0.3 + r() * 0.3);
    vmul.push(corrigiendo ? 0.65 + r() * 0.25 : 1.25 + r() * 0.5);
  }
  // Que termine donde dice el spec: se corrige el sesgo acumulado repartiéndolo
  // linealmente, para no dejar un salto en la última vela.
  const desvio = to - at(path, p.n - 1);
  for (let i = 0; i < p.n; i++) path[i] = at(path, i) + (desvio * (i + 1)) / p.n;
  void dir;
  return { path, wick, vmul };
}

/** Rango que barre un extremo y vuelve dentro. El spring y el upthrust. */
function rangoConBarrido(from: number, p: Phase, r: () => number, lado: 'low' | 'high'): Shape {
  const centro = p.to ?? from;
  const vol = p.vol ?? 1;
  const amp = vol * 2.8;
  const kb = Math.max(2, Math.round(p.n * 0.72)); // dónde ocurre el barrido
  const path: number[] = [];
  const wick: number[] = [];
  const vmul: number[] = [];
  let x = from;

  for (let i = 0; i < p.n; i++) {
    if (i === kb) {
      // El barrido: se sale del rango y se cierra DENTRO. Que cierre dentro es
      // lo que lo convierte en spring y no en ruptura, y es la diferencia que
      // el lector tiene que aprender a ver.
      x = centro + (lado === 'low' ? -amp * 0.55 : amp * 0.55);
      path.push(x);
      wick.push(3.4);
      vmul.push(2.8);
      continue;
    }
    const pull = (centro - x) * 0.24;
    x = x + pull + noise(r) * vol * 0.9;
    x = Math.max(centro - amp, Math.min(centro + amp, x));
    path.push(x);
    wick.push(0.6 + r() * 0.45);
    // Tras el barrido el volumen sube: es la prueba de que ha entrado alguien.
    vmul.push(i > kb ? 1.35 + r() * 0.4 : 0.95 - 0.25 * (i / p.n) + r() * 0.2);
  }
  return { path, wick, vmul };
}

/* ============================================================
   El ensamblador
   ============================================================ */

/** Construye la serie completa a partir de sus fases. */
export function buildSeries(spec: SeriesSpec): Series {
  const r = rng(spec.seed ?? 42);
  const tick = spec.tick ?? 0.01;
  const vBase = spec.volume ?? 1000;
  const snap = (v: number) => Math.round(v / tick) * tick;

  const out: Series = [];
  let cursor = spec.start;

  for (const p of spec.phases) {
    const shape = BUILDERS[p.regime](cursor, p, r);
    const vol = p.vol ?? 1;
    const volFase = p.volume ?? vBase;

    const probHueco = HUECOS[p.regime] ?? 0.04;

    for (let i = 0; i < shape.path.length; i++) {
      const c = at(shape.path, i);
      /* ---------- huecos ----------
         La apertura NO es siempre el cierre anterior. Los mercados paran —de
         un día para otro, un fin de semana, una noticia— y al volver abren
         donde toque, que puede estar lejos.

         Faltaba, y no era un detalle estético. Sin huecos, la línea penetrante
         y la nube oscura son imposibles por construcción: las dos exigen abrir
         más allá del extremo de la vela anterior. El detector encontraba cero
         de cada una en doce mil velas, y no porque el umbral fuera estricto,
         sino porque el generador no podía dibujarlas.

         Y con ellas se caía media Parte X: los huecos de ruptura, de
         continuación y de agotamiento son capítulo propio. */
      const hueco = r() < probHueco ? noise(r) * vol * (1.1 + r() * 1.7) : 0;
      const o = cursor + hueco;
      const cuerpo = Math.abs(c - o);
      const w = at(shape.wick, i) * vol * 0.5;

      /* ---------- mechas ----------
         Las mechas no son simétricas: la del lado contrario al cuerpo tiende a
         ser más corta. Sin esto, todas las velas parecen dojis con cuerpo.

         Y de vez en cuando hay un RECHAZO: el precio se va a un lado, no le
         siguen, y vuelve. Deja una mecha larga de un lado y casi ninguna del
         otro — el martillo, la estrella fugaz, el pin bar.

         Esto último hubo que añadirlo, y el motivo merece quedar escrito. El
         primer modelo sacaba las dos mechas del mismo tamaño base con algo de
         ruido, y la asimetría máxima que llegaba a producir era de 3,4 a 1.
         Un martillo pide que la mecha larga mida dos cuerpos y la corta sea
         casi nada: con aquel modelo era ARITMÉTICAMENTE IMPOSIBLE. El detector
         encontraba cero martillos en doce mil velas con cuatro umbrales
         distintos.

         Las velas se veían perfectamente normales. Lo que no había era ninguna
         de las figuras de rechazo sobre las que se sostiene la Parte III
         entera, y eso no se ve mirando un gráfico: se ve contando. */
      const alcista = c >= o;
      const rechazo = r() < 0.1;
      let arriba;
      let abajo;
      if (rechazo) {
        // Cierra arriba ⇒ rechazó el mínimo, y la mecha larga va abajo.
        const larga = w * (2.6 + r() * 2.4);
        const corta = w * (0.02 + r() * 0.1);
        arriba = alcista ? corta : larga;
        abajo = alcista ? larga : corta;
      } else {
        arriba = w * (alcista ? 0.55 + r() * 0.7 : 0.35 + r() * 0.5);
        abajo = w * (alcista ? 0.35 + r() * 0.5 : 0.55 + r() * 0.7);
      }

      /* El volumen reacciona al recorrido de la vela. Es la propiedad que
         sostiene el capítulo de confirmación de rupturas: una ruptura con
         volumen plano tiene que poder distinguirse de una con volumen, y eso
         solo pasa si el volumen mira al precio. */
      const recorrido = (cuerpo + arriba + abajo) / Math.max(vol, 1e-9);
      const reaccion = 0.55 + 0.45 * Math.min(3, recorrido);
      const v = Math.max(1, Math.round(volFase * at(shape.vmul, i) * reaccion * (0.85 + r() * 0.3)));

      out.push({
        o: snap(o),
        h: snap(Math.max(o, c) + arriba),
        l: snap(Math.min(o, c) - abajo),
        c: snap(c),
        v,
      });
      cursor = snap(c);
    }
  }

  return sanear(out);
}

/** Arregla las incoherencias que la geometría puede dejar: el máximo tiene que
 *  contener a cuerpo y mechas, y el mínimo también.
 *
 *  No es cosmético. Un ATR, un estocástico o un perfil calculados sobre una
 *  vela con `h < c` devuelven números imposibles —y como devuelven un número y
 *  no un error, la figura sale y el fallo viaja hasta el libro impreso. */
function sanear(s: Series): Series {
  return s.map((b, i) => {
    const h = Math.max(b.h, b.o, b.c);
    const l = Math.min(b.l, b.o, b.c);
    /* Un precio no positivo no es un dato raro: es un error de programación.
       Se lanza en vez de recortarlo porque recortarlo lo esconde — y ya se
       escondió una vez, hasta salir por un MFI valiendo −1,12 sobre una escala
       que solo admite de 0 a 100. Un fallo que aparece a doscientas velas de
       distancia de su causa cuesta un día entero de encontrar; uno que salta
       aquí lleva el nombre de la vela puesto. */
    if (!(l > 0) || !Number.isFinite(h)) {
      throw new RangeError(
        `serie inválida en la vela ${i}: precio no positivo (o=${b.o}, h=${h}, l=${l}, c=${b.c}). `
        + 'Alguna fase cae más de lo que permite el precio de partida.',
      );
    }
    return { o: b.o, h, l, c: b.c, v: Math.max(1, Math.round(b.v)) };
  });
}

/* ---------- atajos ---------- */

/** Una serie de un solo régimen. Lo que usan la matriz de redundancia y los
 *  ejercicios generados: veinte series de veinte regímenes, misma longitud. */
export function regimeSeries(
  regime: Regime,
  n = 120,
  opts: { start?: number; seed?: number; vol?: number; tick?: number; volume?: number } = {},
): Series {
  return buildSeries({
    start: opts.start ?? 100,
    seed: opts.seed ?? 42,
    tick: opts.tick ?? 0.01,
    volume: opts.volume ?? 1000,
    phases: [{ regime, n, vol: opts.vol ?? 1 }],
  });
}

/** Los quince regímenes, en el orden en que los presenta el libro. */
export const REGIMES: readonly Regime[] = [
  'alcista', 'bajista', 'impulso', 'escalera', 'parabolica',
  'rango', 'deriva', 'squeeze', 'expansion', 'sierra',
  'climax', 'agotamiento', 'capitulacion', 'acumulacion', 'distribucion',
] as const;

/** El banco de series con el que se mide TODO en este libro: cada régimen con
 *  varias seeds, siempre las mismas.
 *
 *  Que sea siempre el mismo banco es lo que hace comparables las cifras de
 *  redundancia entre capítulos. Si cada capítulo midiera sobre sus propias
 *  series, decir «el RSI y el estocástico correlacionan 0,87» no significaría
 *  nada, porque el 0,87 dependería de la muestra que tocó ese día. */
export function bancoDeSeries(seedsPorRegimen = 4, n = 200): { regime: Regime; seed: number; bars: Series }[] {
  const out: { regime: Regime; seed: number; bars: Series }[] = [];
  for (const regime of REGIMES) {
    for (let k = 0; k < seedsPorRegimen; k++) {
      const seed = 1000 + REGIMES.indexOf(regime) * 100 + k;
      out.push({ regime, seed, bars: regimeSeries(regime, n, { seed }) });
    }
  }
  return out;
}
