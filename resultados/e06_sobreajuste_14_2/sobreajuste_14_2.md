# 14.2 Sobreajuste — 464 variantes (generado por `experimentos/e06_sobreajuste_14_2.py`)

Banco: 60 series × 250 velas. Dentro (pares): semillas 1000, 1002, 1100, 1102, 1200, 1202, 1300, 1302, 1400, 1402, 1500, 1502, 1600, 1602, 1700, 1702, 1800, 1802, 1900, 1902, 2000, 2002, 2100, 2102, 2200, 2202, 2300, 2302, 2400, 2402. Fuera (impares): 1001, 1003, 1101, 1103, 1201, 1203, 1301, 1303, 1401, 1403, 1501, 1503, 1601, 1603, 1701, 1703, 1801, 1803, 1901, 1903, 2001, 2003, 2101, 2103, 2201, 2203, 2301, 2303, 2401, 2403.
Rejilla: rápida [5, 8, 10, 12, 15, 20] × lenta [20, 30, 40, 50, 60] × stop [1, 1.5, 2, 3] ATR × objetivo [1, 1.5, 2, 3] R = 480; válidas (lenta > rápida) = 464.
Paridad con el verificador del libro (mínimo 0, 30 y 100): OK.

## Selección (la mejor esperanza dentro; empate → la primera en el orden de la rejilla)
| Escenario | Mejor (rápida/lenta/stop/objetivo) | R dentro | Ops dentro | R fuera | Ops fuera | Dentro − fuera | Media de las 464 fuera | Percentil del elegido fuera |
|---|---|---|---|---|---|---|---|---|
| sin costes, mínimo 0 | 20/30/3,0/3,0 | 0,200 | 10 | -0,556 | 18 | 0,756 | -0,653 | 71,8 |
| 5 pb, mínimo 0 | 20/30/3,0/3,0 | 0,187 | 10 | -0,565 | 18 | 0,752 | -0,678 | — |
| 10 pb, mínimo 0 | 20/30/3,0/3,0 | 0,174 | 10 | -0,575 | 18 | 0,749 | -0,703 | — |
| sin costes, mínimo 30 | 5/20/2,0/1,0 | 0,032 | 93 | -0,228 | 101 | 0,260 | -0,653 | 96,6 |
| 5 pb, mínimo 30 | 5/20/2,0/1,0 | 0,014 | 93 | -0,246 | 101 | 0,260 | -0,678 | — |
| 10 pb, mínimo 30 | 5/20/2,0/1,0 | -0,005 | 93 | -0,265 | 101 | 0,260 | -0,703 | — |
| sin costes, mínimo 100 | 15/20/1,0/1,0 | -0,017 | 242 | 0,004 | 255 | -0,020 | -0,653 | 100,0 |
| 5 pb, mínimo 100 | 15/20/1,0/1,0 | -0,059 | 242 | -0,037 | 255 | -0,021 | -0,678 | — |
| 10 pb, mínimo 100 | 5/40/1,5/1,0 | -0,097 | 136 | -0,475 | 167 | 0,378 | -0,703 | — |

Coste en R = (pb / 10.000) · precio de entrada / riesgo; se descuenta en cada operación antes de seleccionar. Las cifras del libro son sin costes.

## Diagnóstico de ejecución sobre las 464 variantes
| Conjunto | Operaciones (suma de las 464) | Velas con stop y objetivo a la vez (→ pérdida) | Salidas en stop con hueco de apertura más allá del stop | Salidas en objetivo con hueco más allá del objetivo | Posiciones abiertas al final de serie (descartadas) | Variantes con 0 operaciones |
|---|---|---|---|---|---|---|
| dentro | 40686 | 89 | 1162 | 507 | 3718 | 0 |
| fuera | 41547 | 117 | 1517 | 577 | 3408 | 0 |

El registro completo (464 filas, dentro y fuera, bruto y neto, con diagnóstico) está en `registro_464_variantes.csv`.
