# 9.2 Fibonacci — los 28 tríos de 2022 (generado por `experimentos/e05_fibonacci_9_2.py`)

Swings n = 5 del S&P 500 (^GSPC, Yahoo) en 2022: 30 extremos. Huella de la lista (igual a la del libro): `c53c2eb720800da11a843cc839c6f026e7eff548b9e2d09e9ce6551000b43b69`.
Los precios de anclaje no se publican (licencia del proveedor). Se regeneran en local con `datos/descargar.py`.

**Recuento:** 28 tríos; 4 excluidos → **24 medibles**; **13 superan el 100 %**; **11 elegibles**; **toques: 2**.

| Trío | A | B | C | r (%) | Medible | > 100 % | Elegible | Distancia al nivel más cercano (pp) | Toque (±1 pp) | Estado |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 2022-01-04 H | 2022-01-24 L | 2022-02-02 H | 62,53 | sí | no | sí | 0,73 | sí (61,8 %) | elegible |
| 2 | 2022-01-24 L | 2022-02-02 H | 2022-02-24 L | 128,97 | sí | sí | no | — | no | medible, no elegible: supera el 100 % (rebasa el origen A) |
| 3 | 2022-02-02 H | 2022-02-24 L | 2022-03-03 H | 62,86 | sí | no | sí | 1,06 | no | elegible |
| 4 | 2022-02-24 L | 2022-03-03 H | 2022-03-08 L | 85,69 | sí | no | sí | 7,09 | no | elegible |
| 5 | 2022-03-03 H | 2022-03-08 L | 2022-03-29 H | 185,17 | sí | sí | no | — | no | medible, no elegible: supera el 100 % (rebasa el origen A) |
| 6 | 2022-03-08 L | 2022-03-29 H | 2022-04-21 H | — | no | no | no | — | no | excluido: dos extremos del mismo tipo seguidos (B-C) |
| 7 | 2022-03-29 H | 2022-04-21 H | 2022-05-12 L | — | no | no | no | — | no | excluido: dos extremos del mismo tipo seguidos (A-B) |
| 8 | 2022-04-21 H | 2022-05-12 L | 2022-05-17 H | 35,45 | sí | no | sí | 2,75 | no | elegible |
| 9 | 2022-05-12 L | 2022-05-17 H | 2022-05-20 L | 120,94 | sí | sí | no | — | no | medible, no elegible: supera el 100 % (rebasa el origen A) |
| 10 | 2022-05-17 H | 2022-05-20 L | 2022-06-02 H | 130,95 | sí | sí | no | — | no | medible, no elegible: supera el 100 % (rebasa el origen A) |
| 11 | 2022-05-20 L | 2022-06-02 H | 2022-06-17 L | 147,24 | sí | sí | no | — | no | medible, no elegible: supera el 100 % (rebasa el origen A) |
| 12 | 2022-06-02 H | 2022-06-17 L | 2022-06-28 H | 57,15 | sí | no | sí | 4,65 | no | elegible |
| 13 | 2022-06-17 L | 2022-06-28 H | 2022-06-30 L | 67,05 | sí | no | sí | 5,25 | no | elegible |
| 14 | 2022-06-28 H | 2022-06-30 L | 2022-07-08 H | 86,79 | sí | no | sí | 8,19 | no | elegible |
| 15 | 2022-06-30 L | 2022-07-08 H | 2022-07-14 L | 109,51 | sí | sí | no | — | no | medible, no elegible: supera el 100 % (rebasa el origen A) |
| 16 | 2022-07-08 H | 2022-07-14 L | 2022-08-16 H | 306,55 | sí | sí | no | — | no | medible, no elegible: supera el 100 % (rebasa el origen A) |
| 17 | 2022-07-14 L | 2022-08-16 H | 2022-09-06 L | 72,64 | sí | no | sí | 5,96 | no | elegible |
| 18 | 2022-08-16 H | 2022-09-06 L | 2022-09-12 H | 53,02 | sí | no | sí | 3,02 | no | elegible |
| 19 | 2022-09-06 L | 2022-09-12 H | 2022-09-30 L | 230,14 | sí | sí | no | — | no | medible, no elegible: supera el 100 % (rebasa el origen A) |
| 20 | 2022-09-12 H | 2022-09-30 L | 2022-10-05 H | 41,63 | sí | no | sí | 3,43 | no | elegible |
| 21 | 2022-09-30 L | 2022-10-05 H | 2022-10-13 L | 141,54 | sí | sí | no | — | no | medible, no elegible: supera el 100 % (rebasa el origen A) |
| 22 | 2022-10-05 H | 2022-10-13 L | 2022-11-01 H | 133,26 | sí | sí | no | — | no | medible, no elegible: supera el 100 % (rebasa el origen A) |
| 23 | 2022-10-13 L | 2022-11-01 H | 2022-11-03 L | 50,84 | sí | no | sí | 0,84 | sí (50,0 %) | elegible |
| 24 | 2022-11-01 H | 2022-11-03 L | 2022-11-15 H | 154,79 | sí | sí | no | — | no | medible, no elegible: supera el 100 % (rebasa el origen A) |
| 25 | 2022-11-03 L | 2022-11-15 H | 2022-12-01 H | — | no | no | no | — | no | excluido: dos extremos del mismo tipo seguidos (B-C) |
| 26 | 2022-11-15 H | 2022-12-01 H | 2022-12-06 L | — | no | no | no | — | no | excluido: dos extremos del mismo tipo seguidos (A-B) |
| 27 | 2022-12-01 H | 2022-12-06 L | 2022-12-13 H | 100,25 | sí | sí | no | — | no | medible, no elegible: supera el 100 % (rebasa el origen A) |
| 28 | 2022-12-06 L | 2022-12-13 H | 2022-12-22 L | 184,30 | sí | sí | no | — | no | medible, no elegible: supera el 100 % (rebasa el origen A) |

## Base geométrica y contraste
- Cobertura de 7 niveles a ±1 pp, recortada a [0, 100]: **12,00 %**.
- Toques esperados sobre 11 elegibles: **1,32**; observados **2**; binomial P(X ≥ 2 | n = 11, p = 0,12) = **0,3873** (supone r uniforme e independencia entre tramos consecutivos).
- Niveles aleatorios (100000 sorteos, semilla 20261126): media **1,052** toques; P(toques ≥ 2) = **0,2872**.
- El resultado es condicional: se cuenta sobre los 11 tramos que no rebasan su origen.
