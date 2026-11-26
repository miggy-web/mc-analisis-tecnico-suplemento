# 7.4 Divergencias — tabla exacta (generada por `experimentos/e03_divergencias_7_4.py`)

Banco simulado del libro: `bancoDeSeries(4, 200)` = 60 series × 200 velas, 15 regímenes. SHA-256 del export del generador: `93d237ea0008cce149861fdcbef02250bde30a29c449229c6a93fe01b8cda33b`.
Paridad con el verificador del libro: OK (326 / 325; 72,0859 %; 44,6154 %; base 69,1389 %).

## Trazabilidad frente a las cifras impresas (326 / 325)
| Clase y dirección (motor del libro) | Recuento |
|---|---|
| regular-alcista | 127 |
| oculta-alcista | 199 |
| regular-bajista | 188 |
| oculta-bajista | 137 |
| Total alcistas impreso (regular + oculta) | 326 |
| Total bajistas impreso (regular + oculta) | 325 |

## Resultado causal: solo regulares, entrada en t_pivote + 3, 20 velas completas
| Dirección | N | Acierto | IC 95 % Wilson | N base emparejada | Base emparejada (régimen) | Base todas las velas (régimen) | Δ (pp) vs emparejada | IC 95 % Δ (bootstrap por series) | p bilateral |
|---|---|---|---|---|---|---|---|---|---|
| alcista | 117 | 42,7 % | 34,1–51,8 | 662 | 40,8 % | 46,3 % | 1,9 | [-4,8; 8,6] | 0,568 |
| bajista | 155 | 26,5 % | 20,1–33,9 | 597 | 20,1 % | 24,1 % | 6,4 | [-0,4; 12,5] | 0,054 |

Acierto alcista: cierre a 20 velas > cierre en t_obs. Acierto bajista: cierre a 20 velas < cierre en t_obs (empates = no acierto).
Bootstrap: B = 10000, semilla 20261126, remuestreo de series completas con reemplazo dentro de cada régimen; p = (n.º de réplicas con |Δ* − Δ̂| ≥ |Δ̂| + 1) / (B + 1).

## Desglose por régimen (estimaciones puntuales; muestras pequeñas)
| Dirección | Régimen | N eventos | Acierto | N base | Base emparejada | Δ (pp) |
|---|---|---|---|---|---|---|
| alcista | acumulacion | 12 | 66,7 | 70 | 42,9 | 23,8 |
| alcista | agotamiento | 8 | 100,0 | 60 | 100,0 | 0,0 |
| alcista | alcista | 0 | — | 55 | 100,0 | — |
| alcista | bajista | 23 | 0,0 | 30 | 0,0 | 0,0 |
| alcista | capitulacion | 0 | — | 25 | 76,0 | — |
| alcista | climax | 1 | 100,0 | 33 | 100,0 | 0,0 |
| alcista | deriva | 22 | 40,9 | 63 | 57,1 | -16,2 |
| alcista | distribucion | 15 | 46,7 | 58 | 43,1 | 3,6 |
| alcista | escalera | 0 | — | 39 | 100,0 | — |
| alcista | expansion | 0 | — | 19 | 100,0 | — |
| alcista | impulso | 0 | — | 14 | 100,0 | — |
| alcista | parabolica | 6 | 100,0 | 41 | 100,0 | 0,0 |
| alcista | rango | 6 | 66,7 | 23 | 56,5 | 10,1 |
| alcista | sierra | 16 | 18,8 | 71 | 11,3 | 7,5 |
| alcista | squeeze | 8 | 50,0 | 61 | 42,6 | 7,4 |
| bajista | acumulacion | 13 | 69,2 | 67 | 46,3 | 23,0 |
| bajista | agotamiento | 35 | 0,0 | 37 | 0,0 | 0,0 |
| bajista | alcista | 22 | 0,0 | 29 | 0,0 | 0,0 |
| bajista | bajista | 1 | 100,0 | 55 | 100,0 | 0,0 |
| bajista | capitulacion | 0 | — | 23 | 87,0 | — |
| bajista | climax | 0 | — | 21 | 0,0 | — |
| bajista | deriva | 18 | 55,6 | 63 | 42,9 | 12,7 |
| bajista | distribucion | 12 | 66,7 | 72 | 48,6 | 18,1 |
| bajista | escalera | 16 | 0,0 | 18 | 0,0 | 0,0 |
| bajista | expansion | 3 | 0,0 | 8 | 0,0 | 0,0 |
| bajista | impulso | 1 | 0,0 | 9 | 0,0 | 0,0 |
| bajista | parabolica | 4 | 0,0 | 26 | 0,0 | 0,0 |
| bajista | rango | 4 | 75,0 | 27 | 59,3 | 15,7 |
| bajista | sierra | 10 | 10,0 | 77 | 10,4 | -0,4 |
| bajista | squeeze | 16 | 56,2 | 65 | 44,6 | 11,6 |

