// Recuento del martillo en el banco general (12.000 velas) para tres umbrales de mecha larga. Función del motor: sensibilidad.
import { bancoDeSeries, sensibilidad } from './ta/src/index.ts';
const b = bancoDeSeries(4, 200).map((x) => x.bars);
const velas = b.reduce((a, s) => a + s.length, 0);
process.stdout.write(JSON.stringify({ velas, martillo: sensibilidad(b, 'martillo', 'mechaLarga', [1.5, 2, 3]) }));
