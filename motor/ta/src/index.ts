/* ============================================================
   @miggy/ta — el motor de análisis técnico de MC Análisis Técnico™

   Un solo sitio donde se calculan las cosas: de aquí salen las figuras
   del libro, la comprobación de sus cifras y este suplemento reproducible.

   Que sea UNO importa más de lo que parece. MC Options acabó con dos
   Black-Scholes —uno en el libro y otro en la app— y con una fórmula se puede
   vivir; con ochenta indicadores, dos copias divergen y nadie lo nota, porque
   las dos compilan y las dos pintan una línea preciosa.

   Reglas del paquete: cero dependencias, todo puro, todo determinista por
   seed. Sin React, sin DOM y sin fechas del sistema — una figura tiene que
   salir idéntica hoy y en la reimpresión.
   ============================================================ */

/* ---------- tipos y utilidades ---------- */
export type { Bar, Series, Line, Lines, Source } from './types.ts';
export {
  opens, highs, lows, closes, volumes, hl2, hlc3, ohlc4, src,
  blank, at, lat, round, roundLine, defined, firstDefined,
} from './types.ts';

/* ---------- series sintéticas ---------- */
export type { Regime, Phase, SeriesSpec } from './series.ts';
export { rng, buildSeries, regimeSeries, bancoDeSeries, REGIMES } from './series.ts';

/* ---------- medias ---------- */
export type { MAKind } from './ma.ts';
export {
  sma, ema, rma, wma, hma, dema, tema, kama, alma, vwma,
  ma, stdev, highest, lowest, smaC, MA_KINDS, MA_LABEL,
} from './ma.ts';

/* ---------- osciladores y momentum ---------- */
export type { OscKind, Divergencia } from './momentum.ts';
export {
  rsi, macd, stoch, stochRsi, cci, williamsR, roc, momentum,
  ultimateOscillator, awesome, trix, ppo, dpo, cmo, fisher, coppock, kst, rvi,
  pivotes, divergencias, osc, OSC_KINDS, OSC_LABEL,
} from './momentum.ts';

/* ---------- volatilidad y bandas ---------- */
export type { VolKind, Squeeze } from './volatility.ts';
export {
  trueRange, atr, atrPct, adr, bollinger, percentB, bandWidth,
  keltner, donchian, historicalVolatility, chaikinVolatility,
  massIndex, ulcerIndex, ttmSqueeze, volInd, VOL_LABEL,
} from './volatility.ts';

/* ---------- volumen, VWAP y perfil ---------- */
export type { VolumenKind, Perfil, NivelPerfil } from './volume.ts';
export {
  obv, accumDist, cmf, mfi, forceIndex, easeOfMovement, nvi, pvi, vpt,
  relativeVolume, volumeROC, vwap, vwapBands, sessionVwap, volumeProfile,
  volumenInd, VOLUMEN_LABEL,
} from './volume.ts';

/* ---------- tendencia y sistemas híbridos ---------- */
export type { TrendKind, Ichimoku } from './trend.ts';
export {
  adx, aroon, vortex, supertrend, parabolicSar, ichimoku, posicionNube,
  elderRay, elderImpulse, guppy, trendInd,
  GUPPY_CORTAS, GUPPY_LARGAS, TREND_LABEL,
} from './trend.ts';

/* ---------- estructura y líneas ---------- */
export type { Swing, Evento, EventoTipo, Nivel, Linea, CoberturaFib, FVG, MedidaFVG } from './structure.ts';
export {
  swings, estructura, sensibilidadEstructura, niveles,
  lineasCandidatas, cuantasLineas, canalRegresion, retrocesos,
  coberturaFibonacci, FIBOS, fvgs, medirFVG, extremosIguales,
} from './structure.ts';

/* ---------- velas japonesas ---------- */
export type { PatronId, Deteccion, Anatomia, Umbrales, Frecuencia } from './patterns.ts';
export {
  anatomia, detectar, tendenciaPrevia, frecuencias, sensibilidad, solapamiento,
  UMBRALES, PATRON_LABEL,
} from './patterns.ts';

/* ---------- estadística de sistemas ---------- */
export type { Operacion, Metricas, Reglas, ResultadoOptimizacion } from './stats.ts';
export {
  backtest, metricas, optimizar, rejilla, monteCarlo, riesgoDeRuina,
} from './stats.ts';

/* ---------- redundancia medida ---------- */
export type { ParMedido, OpcionesMatriz } from './redundancy.ts';
export {
  pearson, pearsonDiff, concordanciaSigno, matrizDeRedundancia,
  matrizOsciladores, matrizMedias, masRedundantes, masComplementarios,
  veredicto, VEREDICTO_LABEL, etiqueta,
} from './redundancy.ts';
