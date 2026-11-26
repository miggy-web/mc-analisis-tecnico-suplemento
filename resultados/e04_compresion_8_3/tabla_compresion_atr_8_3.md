# 8.3 Compresión / ATR — tabla exacta (generada por `experimentos/e04_compresion_8_3.py`)

**Paridad con el verificador del libro (cuartiles de ATR en el banco general):** OK. N = 9300; recorrido medio Q1 = 3,7654 %, Q4 = 8,2693 %; sube Q1 = 81,6344 %, Q4 = 56,0000 %. SHA-256 del banco del libro: `93d237ea0008cce149861fdcbef02250bde30a29c449229c6a93fe01b8cda33b`.

**Banco del experimento:** generador del libro, 120 series = 15 regímenes × 8 semillas × 800 velas (semillas 7000 + 100·i + k). SHA-256 del export: `fee3cb36ce2a86928be9ef9c0e67e8f742840eb5a3c604efeae596e128c9ed4f`.
**Reglas:** ATR% = 100·ATR14/cierre; rank causal en L = 100 velas; compresión = rank ≤ 0,10; control = rank en [0,40; 0,60]; H = 20; enfriamiento = H; sin solapes.
**Muestra:** 1925 eventos de compresión y 1822 controles emparejados.

| Medida | Media compresión | Media control (ponderada por régimen) | Δ | IC 95 % Δ (bootstrap por series) | p bilateral | Mediana compresión / control |
|---|---|---|---|---|---|---|
| Expansión relativa E_rel = ATR14[t+20]/ATR14[t] | 1,052 | 0,991 | 0,060 | [0,054; 0,066] | 0,0001 | 1,045 / 0,998 |
| Expansión relativa E_rel_TR = TR medio (t,t+20] / TR medio [t−19,t] | 1,054 | 0,969 | 0,086 | [0,078; 0,092] | 0,0001 | 1,047 / 0,983 |
| Desplazamiento absoluto del cierre a 20 velas |C[t+20]/C[t]−1| (%) («recorrido absoluto» en el libro) | 2,609 | 2,581 | 0,028 | [-0,046; 0,093] | 0,4303 | 2,379 / 1,859 |
| Rango futuro (máx−mín)/C[t] en (t,t+20] (%) | 4,570 | 4,562 | 0,008 | [-0,070; 0,078] | 0,8323 | 3,976 / 4,446 |
| Sube a 20 velas (%) | 72,987 | 76,611 | -3,624 | [-5,904; -1,139] | 0,0029 | — |
| Baja a 20 velas (%) | 26,909 | 23,315 | 3,594 | [1,061; 5,895] | 0,0042 | — |

Bootstrap: B = 10000, semilla 20261126, remuestreo de series completas con reemplazo dentro de cada régimen.

## Eventos y controles por régimen
| Régimen | Eventos | Controles |
|---|---|---|
| acumulacion | 94 | 153 |
| agotamiento | 98 | 150 |
| alcista | 196 | 74 |
| bajista | 45 | 143 |
| capitulacion | 49 | 117 |
| climax | 145 | 122 |
| deriva | 103 | 139 |
| distribucion | 102 | 147 |
| escalera | 205 | 87 |
| expansion | 142 | 120 |
| impulso | 196 | 66 |
| parabolica | 121 | 127 |
| rango | 105 | 146 |
| sierra | 118 | 161 |
| squeeze | 206 | 70 |

