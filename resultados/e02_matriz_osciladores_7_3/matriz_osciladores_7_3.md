# 7.3 Matriz de 18 osciladores, 153 parejas (generado por `experimentos/e02_matriz_osciladores_7_3.py`)

Banco general: 60 series × 200 velas. Series con correlación válida por pareja: mínimo 60, máximo 60.

## Correlación media de Pearson sobre niveles (triángulo inferior)
| Oscilador | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1. RSI |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 2. MACD | 0,62 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 3. Estocástico | 0,68 | 0,54 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 4. RSI estocástico | 0,64 | 0,29 | 0,60 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 5. CCI | 0,58 | 0,35 | 0,57 | 0,59 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 6. Williams %R | 0,72 | 0,42 | 0,86 | 0,52 | 0,55 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 7. Tasa de cambio | 0,74 | 0,56 | 0,59 | 0,54 | 0,54 | 0,63 |  |  |  |  |  |  |  |  |  |  |  |  |
| 8. Momento | 0,76 | 0,66 | 0,61 | 0,54 | 0,54 | 0,64 | 0,87 |  |  |  |  |  |  |  |  |  |  |  |
| 9. Ultimate Oscillator | 0,56 | 0,40 | 0,72 | 0,46 | 0,39 | 0,69 | 0,51 | 0,49 |  |  |  |  |  |  |  |  |  |  |
| 10. Awesome Oscillator | 0,49 | 0,88 | 0,43 | 0,24 | 0,25 | 0,27 | 0,50 | 0,55 | 0,28 |  |  |  |  |  |  |  |  |  |
| 11. TRIX | 0,37 | 0,76 | 0,29 | 0,02 | 0,12 | 0,19 | 0,38 | 0,35 | 0,23 | 0,73 |  |  |  |  |  |  |  |  |
| 12. PPO | 0,60 | 0,86 | 0,52 | 0,28 | 0,34 | 0,41 | 0,64 | 0,60 | 0,40 | 0,82 | 0,89 |  |  |  |  |  |  |  |
| 13. DPO | -0,38 | -0,39 | -0,36 | -0,34 | -0,22 | -0,34 | -0,47 | -0,61 | -0,26 | -0,38 | -0,24 | -0,38 |  |  |  |  |  |  |
| 14. Oscilador de Chande | 0,81 | 0,46 | 0,62 | 0,67 | 0,56 | 0,66 | 0,84 | 0,76 | 0,51 | 0,41 | 0,22 | 0,45 | -0,42 |  |  |  |  |  |
| 15. Transformada de Fisher | 0,55 | 0,48 | 0,75 | 0,49 | 0,51 | 0,60 | 0,53 | 0,54 | 0,42 | 0,50 | 0,23 | 0,45 | -0,34 | 0,60 |  |  |  |  |
| 16. Curva de Coppock | 0,58 | 0,78 | 0,52 | 0,31 | 0,34 | 0,41 | 0,63 | 0,60 | 0,38 | 0,79 | 0,79 | 0,92 | -0,42 | 0,45 | 0,47 |  |  |  |
| 17. Know Sure Thing | 0,41 | 0,77 | 0,32 | 0,06 | 0,16 | 0,23 | 0,40 | 0,39 | 0,25 | 0,73 | 0,99 | 0,90 | -0,26 | 0,24 | 0,24 | 0,82 |  |  |
| 18. Relative Vigor Index | 0,57 | 0,56 | 0,67 | 0,47 | 0,40 | 0,53 | 0,56 | 0,62 | 0,55 | 0,55 | 0,36 | 0,55 | -0,55 | 0,53 | 0,57 | 0,60 | 0,39 |  |

## Parámetros de cada oscilador (periodo por defecto del motor)
| # | Id | Nombre | Parámetros | Primera vela con valor (máx. en el banco) |
|---|---|---|---|---|
| 1 | rsi | RSI | n = 14 (Wilder) | 14 |
| 2 | macd | MACD | EMA 12 − EMA 26 (línea MACD) | 25 |
| 3 | stoch | Estocástico | %K, n = 14, suavizado 3 | 15 |
| 4 | stochrsi | RSI estocástico | %K, RSI 14, estocástico 14, suavizado 3 | 29 |
| 5 | cci | CCI | n = 20, precio típico | 19 |
| 6 | williams | Williams %R | n = 14 | 13 |
| 7 | roc | Tasa de cambio | n = 9 | 9 |
| 8 | momentum | Momento | n = 10 | 10 |
| 9 | uo | Ultimate Oscillator | 7, 14, 28 | 28 |
| 10 | ao | Awesome Oscillator | SMA 5 − SMA 34 de (H+L)/2 | 33 |
| 11 | trix | TRIX | n = 15 | 43 |
| 12 | ppo | PPO | EMA 12, EMA 26 (línea PPO) | 25 |
| 13 | dpo | DPO | n = 20, desplazamiento 11 | 19 |
| 14 | cmo | Oscilador de Chande | n = 9 | 9 |
| 15 | fisher | Transformada de Fisher | n = 9, (H+L)/2 | 8 |
| 16 | coppock | Curva de Coppock | ROC 14 + ROC 11, WMA 10 | 23 |
| 17 | kst | Know Sure Thing | ROC 10/15/20/30, medias 10/10/10/15 | 44 |
| 18 | rvi | Relative Vigor Index | n = 10, media simétrica (1,2,2,1)/6 | 12 |

La tabla completa, con la concordancia de signo y la correlación por régimen, está en `matriz_osciladores_153_parejas.csv`.
