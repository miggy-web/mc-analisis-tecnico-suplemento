# Metodología del suplemento v1.0.0

Este documento describe cómo se calcula cada cifra. El código es la referencia: cada apartado cita el script que la produce, y `run_all.py` la vuelve a calcular. Las cifras de este documento se han copiado de las salidas en `resultados/`. Ninguna es una señal de compra ni de venta, ni una promesa de resultado: las cifras describen bancos simulados y series pasadas bajo un diseño declarado.

## 1. Los tres bancos simulados (`experimentos/e00_bancos.py`, `motor/ta/src/series.ts`)

| Banco | Construcción | Velas | Semillas | Usos |
|---|---|---|---|---|
| General | `bancoDeSeries(4, 200)`: 15 regímenes × 4 series × 200 velas | 12.000 | 1000 + 100·i + k (i = régimen 0…14, k = 0…3) | 3.3, 3.6, 7.3, 7.4 |
| Sobreajuste | `bancoDeSeries(4, 250)`: 15 × 4 × 250 | 15.000 | Las mismas semillas que el general; cambia la longitud y con ella la serie entera | 14.2 |
| Largo | `regimeSeries(r, 800, {seed})`: 15 × 8 × 800 | 96.000 | 7000 + 100·i + k (k = 0…7) | 8.3 |

**Generador** (`series.ts`):
- Usa el generador pseudoaleatorio mulberry32 y una sola fase (un régimen) por serie.
- Precio inicial 100, tick 0,01, volatilidad base 1 y volumen base 1000.
- La apertura lleva un hueco con una probabilidad que depende del régimen (tabla `HUECOS`): 0,02 en deriva y en squeeze, y 0,14 en capitulación.
- `sanear` fuerza que el máximo sea ≥ max(apertura, cierre) y que el mínimo sea ≤ min(apertura, cierre). Si aparece un precio no positivo, **lanza un error** en lugar de recortarlo.

**Calentamiento y descartes del generador: ninguno.** No hay calentamiento ni burn-in, y no se descarta ninguna serie ni ninguna vela. La vela 0 es la primera generada.

**Calentamiento de cada indicador:**
- Lo impone el propio indicador. Por ejemplo, el RSI 14 no tiene valor en las primeras 14 velas y el ATR 14 de Wilder tampoco.
- Cada experimento descarta los instantes sin valor o sin horizonte futuro completo, como se indica en su apartado.

`e00` exige 12.000 / 15.000 / 96.000 velas, mínimos positivos y velas OHLC coherentes. También publica la huella SHA-256 del export de cada banco y la tabla completa de semillas por régimen.

## 2. Precisión frente a potencia (3.6; `e01_precision_3_6.py`)

**Fórmula de precisión.**
- n = z²·p(1−p)/e², con z = 1,96, p = 0,5 y aritmética exacta (fracciones).
- e = 0,05 da 384,16. El **mínimo entero** que garantiza el margen es ⌈384,16⌉ = **385**.
- e = 0,02 da 2401 y e = 0,10 da 96,04, que redondea a 97.
- Esta fórmula fija el margen de un intervalo (precisión). No es un cálculo de potencia.

**Potencia (ilustración).**
- Para distinguir una proporción de una base conocida p0 = 0,50 con α = 0,05 bilateral y potencia 0,80, hacen falta 4904 casos para una diferencia de 2 puntos y 783 para una de 5 puntos.

**Banco general.**
- Hay 49 martillos (k = 2) en 12.000 velas: uno cada 244,9 velas, que redondea a 1 de cada 245.
- Para 385 casos harían falta 94.286 velas con la frecuencia exacta o 94.325 con 1/245. El libro imprime 245 × 384 = 94.080.
- Es una **extrapolación ilustrativa**: supone casos independientes y una frecuencia estable.

## 3. Matriz de 18 osciladores (7.3; `e02_matriz_osciladores_7_3.py`, `motor/ta/src/redundancy.ts`)

**Cálculo de cada celda.**
- Se calcula la correlación de Pearson entre los **niveles** de dos osciladores, serie a serie. Solo cuentan las velas en que ambos tienen valor: no se rellenan las ventanas incompletas.
- Una serie no cuenta (nulo) si quedan menos de 30 valores comunes o si una de las dos líneas es constante.
- La celda es la media simple de las correlaciones válidas. En las 153 parejas son válidas las 60 series.
- La concordancia de signo compara los movimientos vela a vela e ignora los movimientos nulos.

**Parámetros por defecto.**
- RSI 14; MACD 12/26; estocástico %K 14 suavizado 3; StochRSI 14/14/3; CCI 20; Williams %R 14; ROC 9; Momentum 10.
- Último oscilador 7/14/28; AO 5/34; TRIX 15; PPO 12/26; DPO 20 (desplazamiento 11); CMO 9; Fisher 9.
- Coppock 14/11 con WMA 10; KST 10/15/20/30 con suavizados 10/10/10/15; RVI 10.

**Salidas.**
- El CSV de 153 parejas incluye r medio, concordancia de signo, series válidas y r por régimen.
- Se publica también la matriz triangular y la tabla de parámetros.
- Ejemplos con el RSI: estocástico 0,680, CMO 0,813 y MACD 0,624.

**Alcance.** La correlación de niveles describe el parecido entre líneas en este banco. No mide si añadir un segundo oscilador mejora una decisión.

## 4. Divergencias (7.4; `e03_divergencias_7_4.py`)

**Definiciones.**
- Pivotes estrictos de 3 velas a cada lado sobre máximos y mínimos. Un empate descalifica el pivote.
- Se comparan pares de pivotes consecutivos del mismo tipo con el RSI 14.
- **Regular bajista:** máximo más alto con un RSI más bajo.
- **Regular alcista:** mínimo más bajo con un RSI más alto.
- Las divergencias ocultas se cuentan aparte y no entran en el contraste.

**Instante observable.** t_obs = t_pivote + 3: el pivote solo se confirma tres velas después.

**Resultado.**
- Se mira el cierre a 20 velas completas desde t_obs.
- Hay acierto si cierra por encima (alcista) o por debajo (bajista). Un empate no es acierto.
- Los eventos sin 20 velas futuras se descartan.

**Base emparejada.**
- La forman los pivotes del mismo tipo confirmados en t_pivote + 3 **sin** divergencia regular, en la misma serie y por tanto en el mismo régimen.
- Se pondera por la mezcla de regímenes de los eventos: base = Σ_r (N_eventos,r / N_eventos) · acierto_base,r.
- Δ = acierto de los eventos − base ponderada, en puntos porcentuales.
- Se publica también la base de todas las velas del régimen, con la misma ponderación.

**Remuestreo.**
- La unidad es la **serie completa**, estratificada por régimen: en cada réplica se sacan con reemplazo 4 series de cada uno de los 15 regímenes.
- B = 10.000, semilla 20261126. IC 95 % por percentiles 2,5 y 97,5.
- p bilateral = (#{|Δ* − Δ̂| ≥ |Δ̂|} + 1) / (B + 1), con el bootstrap desplazado a la nula.

**Velas compartidas.**
- Un evento y los pivotes de base de la misma serie pueden compartir velas de su horizonte, y dos eventos seguidos también.
- No se eliminan solapes. Remuestrear series enteras conserva esa dependencia dentro del bloque.
- Los intervalos de Wilson que se publican junto a cada proporción suponen independencia y son descriptivos.

**Resultados.**

| | N | Acierto | Base ponderada | Δ (pp) | IC 95 % | p |
|---|---|---|---|---|---|---|
| Alcista | 117 | 42,74 % | 40,84 % | +1,89 | [−4,85; 8,56] | 0,568 |
| Bajista | 155 | 26,45 % | 20,07 % | +6,38 | [−0,37; 12,55] | 0,054 |

En ambos casos **el intervalo incluye cero con el método declarado**. El 0,054 de la bajista deja abierta una diferencia en este banco. No es una ventaja trasladable.

## 5. Compresión del ATR% (8.3; `e04_compresion_8_3.py`)

**Definiciones.** Son causales: lo que se calcula en t usa solo datos ≤ t, y los resultados usan (t, t+20].
- ATR%_t = 100·ATR14_t / cierre_t.
- rank_t = fracción de los últimos 100 valores de ATR% que son ≤ ATR%_t.
- **Compresión:** rank_t ≤ 0,10, con un enfriamiento de 20 velas desde el evento anterior de la serie.
- **Control:**
  - misma serie y 0,40 ≤ rank_t ≤ 0,60;
  - fuera de la ventana (t_e, t_e + 20) de cualquier compresión previa;
  - enfriamiento de 20 velas entre controles.
  - Un control sí puede preceder a una compresión a menos de 20 velas, y entonces sus ventanas se solapan.

**Medidas.**
- E_rel = ATR14_{t+20}/ATR14_t (principal).
- E_rel_TR = media del TR futuro / media del TR pasado.
- **Desplazamiento absoluto del cierre a 20 velas** = 100·|C_{t+20}/C_t − 1|. El libro lo llama «recorrido absoluto».
- Rango futuro = 100·(máximo − mínimo en (t, t+20]) / C_t.
- % que sube y % que baja.

**Contraste.** Δ = media de las compresiones − media de los controles, ponderada por la mezcla de regímenes de las compresiones. El bootstrap por series estratificado por régimen y la p son los mismos que en el apartado 4.

**Resultados.**
- Hay 1925 compresiones y 1822 controles.
- ATR: 1,052 frente a 0,991, Δ 0,060 [0,054; 0,066], p < 0,001.
- Desplazamiento: 2,609 % frente a 2,581 %, Δ 0,028 [−0,046; 0,093].
- Sube: 72,99 % frente a 76,61 %, Δ −3,62 pp [−5,90; −1,14], p = 0,003.

**Estado frente a contracción.**
- La regla clasifica un **nivel** bajo de ATR%. No exige que el ATR% venga bajando.
- En t, el ATR% supera al de t−1 en el 10,49 % de las compresiones y en el 29,47 % de los controles (`diagnostico_estado_vs_contraccion_8_3.md`).
- Que el ATR vuelva a crecer es coherente con una regresión a la media de la volatilidad. El diseño no aísla una causa única.

## 6. Fibonacci, 28 tríos (9.2; `e05_fibonacci_9_2.py`)

**Datos.**
- ^GSPC diario de Yahoo, que se descarga y no se redistribuye.
- Hay 30 swings estrictos de 5 velas a cada lado en 2022. Su lista canónica («fecha|H/L|precio con 2 decimales») tiene la huella `c53c2eb7…`, que coincide con la lista usada en el libro.

**Tríos.**
- Un trío son tres swings consecutivos A-B-C; hay 28.
- Retroceso r = (B − C)/(B − A)·100.
- **4 excluidos** (6 B-C, 7 A-B, 25 B-C y 26 A-B): son dos swings seguidos del mismo tipo, así que no hay recorrido que medir.
- **24 medibles**. De ellos, **13 superan el 100 %** porque C rebasa el origen A, y **11 son elegibles** (0 ≤ r ≤ 100).

**Toque.**
- Hay toque cuando el punto de giro C cae a **±1 punto porcentual** del recorrido de uno de los siete niveles: 0; 23,6; 38,2; 50; 61,8; 78,6 y 100 %.
- Haber cruzado niveles por el camino no cuenta.
- Hay 2 toques entre los 11 elegibles.

**Base geométrica.**
- La cobertura exacta de los siete intervalos, recortados a [0, 100], es 0,12. Los toques esperados son 11 × 0,12 = 1,32.
- P(X ≥ 2) = 0,3873 por binomial. Supone r uniforme en [0, 100] e independencia entre tramos, y **no la demuestra**.
- Contraste alternativo: 100.000 juegos de 5 niveles interiores al azar, más 0 y 100, con semilla 20261126. Dan una media de 1,052 toques y p = 0,2872.

**Alcance.** El resultado está condicionado a los tríos elegibles de un solo año de un índice.

**Publicación.** Las tablas publicadas no llevan precios: solo fechas, tipo, r y estado. La tabla con precios se escribe en la carpeta local de datos.

## 7. Las 464 variantes (14.2; `e06_sobreajuste_14_2.py`, `motor/experimento_14_2.mts`, `motor/ta/src/stats.ts`)

**Partición.**
- Banco de 15.000 velas. Los índices pares (semillas k = 0 y 2) van **dentro de muestra** y los impares (k = 1 y 3) **fuera**: 30 series y 7.500 velas en cada mitad.

**Rejilla.**
- Rápida {5, 8, 10, 12, 15, 20} × lenta {20, 30, 40, 50, 60} × stop {1; 1,5; 2; 3} ATR × objetivo {1; 1,5; 2; 3} R = 480 combinaciones.
- Se descartan las 16 en que la lenta no supera a la rápida, y quedan 464.

**Reglas de ejecución** (verificadas con una réplica instrumentada que reproduce el motor operación a operación):
1. **Señal y entrada.** Opera **en ambos sentidos**. Un cruce al alza de la media simple rápida sobre la lenta (rápida ≤ lenta en la vela anterior y rápida > lenta en la actual) abre un largo; un cruce a la baja (≥ y luego <) abre un corto. Se entra **al cierre de la vela del cruce**.
2. **Calentamiento.** Se necesita la media lenta en la vela anterior y el ATR 14 simple.
3. **Una sola posición.** Mientras está abierta se ignoran los cruces, y en la vela de salida no se abre otra.
4. **Stop y objetivo.**
   - Riesgo = stopATR × ATR14 simple de la vela de entrada. Stop = entrada ∓ riesgo y objetivo = entrada ± objetivoR × riesgo (el signo depende del sentido).
   - Ambos se comprueban desde la vela siguiente con el máximo y el mínimo.
5. **Las dos cosas en la misma vela.** Si una vela toca el stop y el objetivo, cuenta como **pérdida** (−1 R), una regla pesimista.
6. **Precio de salida.** Es el nivel exacto aunque la vela abra más allá: **los huecos no se modelan**, lo que es optimista en el stop.
7. **Final de la serie.** Una posición abierta al terminar la serie **se descarta** y no se cierra a mercado.
8. **Resultado en R.** Cada operación da −1 u objetivoR, sin costes en las cifras del libro.
   - Esperanza = media de R de todas las operaciones de la mitad, agrupando las series.
   - La caída máxima se calcula sobre la suma acumulada con las series concatenadas en orden.
9. **Selección.**
   - Se elige la mayor esperanza dentro de muestra con «>» estricto, así que un empate se queda con la primera en el orden de la rejilla.
   - Se exige un mínimo de operaciones de 0, 30 o 100. Si ninguna lo cumple, se toma la primera combinación.
10. La «media de las 464 fuera» es la media simple de las 464 esperanzas fuera de muestra. Ninguna variante tiene 0 operaciones.

**Diagnóstico** (suma de las 464 variantes, dentro / fuera):
- Operaciones: 40.686 / 41.547.
- Velas con stop y objetivo a la vez: 89 / 117.
- Salidas en stop con hueco más allá del stop: 1162 / 1517.
- Salidas en objetivo con hueco más allá: 507 / 577.
- Posiciones abiertas al final, descartadas: 3718 / 3408.

**Costes (complementario, no impreso).**
- Coste en R = (pb/10.000)·entrada/riesgo, descontado antes de seleccionar, con escenarios de 5 y 10 pb.
- Con 10 pb y mínimo 100 cambia la combinación elegida, que pasa a 5/40/1,5/1.

**Selección sin costes.**

| Mínimo | Elegida | R dentro (ops) | R fuera (ops) | Media de las 464 fuera | Percentil de la elegida fuera |
|---|---|---|---|---|---|
| 0 | 20/30/3/3 | 0,200 (10) | −0,556 (18) | −0,653 | 71,8 |
| 30 | 5/20/2/1 | 0,032 (93) | −0,228 (101) | −0,653 | 96,6 |
| 100 | 15/20/1/1 | −0,017 (242) | 0,004 (255) | −0,653 | 100,0 |

La mitad fuera de muestra también tiene variación muestral. La comparación ilustra el efecto de la selección bajo este diseño. El registro completo está en `registro_464_variantes.csv`: dentro y fuera, bruto y neto, con el diagnóstico por variante.

## 8. Réplicas en serie real (no impresas; `replicas_spy/`)

**Datos.**
- SPY diario de Yahoo con OHLC sin ajustar y dividendos con fecha ex ≤ 2025-12-31. La huella está en `MANIFEST_DATOS.json`.
- El retroajuste por dividendos se calcula en el código, anclado a 2025-12-31. Así la huella no cambia cuando Yahoo añade dividendos nuevos.

**Ventana y costes.** Del 2005-01-01 al 2025-12-31, con costes de 5 y 10 pb por operación de ida y vuelta.

**Réplicas.**
- r01: divergencias.
- r02: compresión.
- r03: walk-forward año a año (prueba 2010–2025) con las mismas 464 combinaciones y costes descontados antes de seleccionar.

**Remuestreo.** Bootstrap por años naturales, B = 10.000, semilla 20261126.

**Publicación.** Las tablas de eventos fechadas se escriben solo en la carpeta local de datos.

## 9. Fuera del alcance de v1.0.0

- Esquemas didácticos.
- Capturas de TradingView: no se publican por licencia.
- Simulaciones de Montecarlo de 14.4.
- La trazabilidad bibliográfica (AT-02, último punto) es un trabajo editorial aparte.
