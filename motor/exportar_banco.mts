// Exporta los bancos simulados del libro a JSON (stdout). Generador: ta/src/series.ts, sin modificar.
//   {"tipo":"libro","seeds":4,"n":200}                    → banco general, 15 regímenes × 4 semillas × 200 = 12.000 velas
//   {"tipo":"libro","seeds":4,"n":250}                    → banco de 14.2, 15 × 4 × 250 = 15.000 velas
//   {"tipo":"largo","seeds":8,"n":800,"seedBase":7000}    → banco de 8.3, 15 × 8 × 800 = 96.000 velas
// Semilla de cada serie: libro = 1000 + 100·índice_régimen + k ; largo = 7000 + 100·índice_régimen + k (k = 0..seeds−1).
import { bancoDeSeries, regimeSeries, REGIMES } from './ta/src/index.ts';
const cfg = JSON.parse(process.argv[2] ?? '{"tipo":"libro","seeds":4,"n":200}');
let banco: { regime: string; seed: number; bars: any[] }[];
if (cfg.tipo === 'libro') {
  banco = bancoDeSeries(cfg.seeds, cfg.n);
} else if (cfg.tipo === 'largo') {
  banco = [];
  for (const regime of REGIMES) for (let k = 0; k < cfg.seeds; k++) {
    const seed = cfg.seedBase + REGIMES.indexOf(regime) * 100 + k;
    banco.push({ regime, seed, bars: regimeSeries(regime, cfg.n, { seed }) });
  }
} else throw new Error('tipo desconocido');
const out = banco.map((b) => ({ regime: b.regime, seed: b.seed,
  o: b.bars.map((x) => x.o), h: b.bars.map((x) => x.h), l: b.bars.map((x) => x.l), c: b.bars.map((x) => x.c), v: b.bars.map((x) => x.v) }));
process.stdout.write(JSON.stringify({ cfg, series: out }));
