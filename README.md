# MC Análisis Técnico · Suplemento reproducible v1.0.0

Este repositorio contiene el código, las semillas y las huellas que permiten volver a calcular las cifras de los experimentos del libro *MC Análisis Técnico* (MIGGY CAPITAL). No contiene páginas del libro, ni datos de mercado de terceros, ni indicadores propietarios.

> Las cifras describen bancos simulados con fines didácticos y series pasadas, bajo un diseño declarado. No son señales de compra ni de venta, ni una promesa de resultado.

## Reproducir todo con una orden

```bash
pip install -r requirements.txt     # numpy==2.5.5 (versión exacta)
python3 run_all.py
```

**Requisitos**
- Python ≥ 3.11 (probado con 3.13.5).
- Node.js ≥ 22.6 (probado con v24.22.1).
- Conexión a internet para descargar las dos series de Yahoo Finance.
- Tarda alrededor de un minuto.

`run_all.py` hace siete cosas, en este orden:
1. Comprueba el entorno.
2. Borra todas las salidas.
3. Descarga las series en una carpeta temporal fuera del repositorio y verifica su SHA-256.
4. Ejecuta todo **dos veces** y exige que los archivos de las dos ejecuciones sean idénticos byte a byte.
5. Comprueba las **170 cifras impresas** del libro (edición definitiva RF-452c, 452 págs.).
6. Compara las huellas con `referencia/SHA256_ESPERADOS.json`.
7. Escribe `resultados/` y `TABLA_FIGURAS_SHA256.md/.json`, audita el paquete con `auditar_paquete.py` y borra los datos descargados.

Si algo no coincide, se detiene con un error.

## Qué reproduce

| Figura del libro | Págs. | Script | Salidas principales | Cifras clave |
|---|---|---|---|---|
| Bancos simulados | 9, 318–319 | `experimentos/e00_bancos.py` | `bancos.json/.md` (semillas por régimen, SHA-256 de cada banco) | 12.000, 15.000 y 96.000 velas |
| 3.6.3 y caja 16 | 98–101 | `e01_precision_3_6.py` | `resultados_3_6.json`, `precision_3_6.md` | 384,16 → mínimo entero 385; 49 martillos; 1 de cada 245; 245 × 385 = 94.325 |
| 7.1.1 y tabla de consulta 7.1.a | 165–169 | `e07_tablas_consulta_7_1_7_3.py` | Regenera la tabla 7.1.a desde los 17 cierres y exige que sea idéntica byte a byte | RSI 61,32 / 57,80 / 59,06 |
| 7.3.1 y tabla de consulta 7.3.a | 174–178 | `e02_matriz_osciladores_7_3.py`, `e07_…` | 153 parejas con r por régimen; matriz 18 × 18; parámetros; resumen de la figura | RSI–CMO 0,81; RSI–estocástico 0,68; RSI–MACD 0,62; 12 parejas con \|r\| ≥ 0,80 |
| 7.4.1 (casos A y B) | 181 | `e09_casos_figuras_7_4_1_14_2_2.py` | Los dos casos dibujados, recalculados desde el banco | P1 99,67 / P2 98,33; 2,08 % a 20 velas; candidato 64,27 anulado por 63,67 |
| 7.4.2 | 179–183 | `e03_divergencias_7_4.py` | Eventos, tabla, IC y p | Alcista 42,74 % frente a 40,84 % (p = 0,568); bajista 26,45 % frente a 20,07 % (p = 0,054) |
| 8.3.1 | 201–205 | `e04_compresion_8_3.py` | Eventos y controles, tabla, diagnóstico de estado frente a contracción | ATR 1,052 frente a 0,991; desplazamiento 2,609 % frente a 2,581 %; sube 72,99 % frente a 76,61 % |
| 9.2 y 9.2.2 (fig. 9.2.2, pág. 219) | 215–221 | `e05_fibonacci_9_2.py` | Los 28 tríos sin precios; exclusiones | 4 excluidos, 24 medibles, 13 > 100 %, 11 elegibles, 2 toques, 1,32 esperados, p = 0,3873 |
| 14.2.1, 14.2.2 y 14.2.3 | 320–326 | `e06_sobreajuste_14_2.py`, `e09_…` | Registro de las 464 variantes, bruto y neto de costes, con diagnóstico de ejecución; la operación del panel B de 14.2.2 | +0,200 / −0,556; +0,032 / −0,228; −0,017 / +0,004 R; con 5 pb, +0,187 / −0,565 R |
| Apéndice A, caso 4 · fig. A.4d | 393–395 | `e08_caso_4_simulacion_perfil.py` | Regenera la simulación del perfil y exige las huellas publicadas | POC 5.000,25; VAH 5.005,50; VAL 4.993,50; área 72,03 %; ATR 6,89 |
| Réplicas en SPY (no impresas) | — | `replicas_spy/r01…r03` | Divergencias, compresión y walk-forward con costes en SPY diario | Ver `resultados/r0*` |

La huella SHA-256 de cada archivo de salida está en **`TABLA_FIGURAS_SHA256.md`** y `TABLA_FIGURAS_SHA256.json`, que genera `run_all.py`. Los métodos completos están en **`METODOLOGIA.md`**: generador, semillas, calentamientos y descartes; remuestreo, estratificación, ponderación y p; reglas de ejecución de las 464 variantes; definición de «toque».

## Datos: qué se publica y qué no

| Fuente | En el repositorio | Cómo se obtiene |
|---|---|---|
| Bancos simulados | Generador, semillas y huellas | Se regeneran con `motor/` |
| SPY diario, Yahoo Finance | Solo URL, receta y SHA-256 (`MANIFEST_DATOS.json`) | `datos/descargar.py`, en tu máquina |
| ^GSPC diario 2021–2023, Yahoo Finance | Solo URL, receta, SHA-256 y huella de la lista de swings de 2022 | `datos/descargar.py`, en tu máquina |
| TradingView | Nada (ni datos ni capturas) | — |
| Tablas de consulta 7.1.a y 7.3.a (`tablas_consulta/`) | Sí: sintéticas (17 cierres didácticos; banco simulado) | Se regeneran con `e07` y se comparan byte a byte |
| Apéndice A, caso 4 (`apendice_a/caso_4_simulacion_perfil/`) | Sí: 24 barras sintéticas de un MES ilustrativo, generador y salidas, con `SHA256SUMS.txt` | Se regeneran con `e08` en una carpeta temporal |

**Ajuste por dividendos.**
- El CSV que se verifica lleva el OHLC sin ajustar y los dividendos con fecha ex hasta el 2025-12-31.
- El retroajuste se hace en el código. Así la huella no cambia cuando Yahoo añade dividendos nuevos.
- Si Yahoo corrige el histórico y la huella deja de coincidir, `datos/descargar.py` lo dice y se detiene. Las cifras publicadas siguen ligadas a la huella del manifiesto.

**Carpeta de datos persistente.** Para conservar los datos descargados: `python3 run_all.py --datos /ruta/fuera/del/repo`.

## Estructura

```
run_all.py               orden única
auditar_paquete.py       comprueba que no hay PDF, imágenes, Pine, datos crudos, extractos del libro ni rutas internas, y verifica los SHA256SUMS.txt internos
motor/ta/src/*.ts        motor de cálculo del libro (TypeScript, sin dependencias)
motor/*.mts              exportadores y experimento 14.2 instrumentado
mc/mc_comun.py           funciones comunes en Python (paridad comprobada con el motor)
experimentos/e00…e09     figuras, tablas de consulta y caso 4 del apéndice A
tablas_consulta/         tablas 7.1.a y 7.3.a (sintéticas)
apendice_a/caso_4_simulacion_perfil/   simulación didáctica del perfil (fig. A.4d), con su SHA256SUMS.txt
replicas_spy/r01…r03     réplicas en serie real (complementarias)
datos/descargar.py       descarga y verificación de las series de Yahoo
referencia/              cifras impresas a comprobar, cifras del verificador del libro, huellas esperadas
MANIFEST_DATOS.json      URL, receta y SHA-256 de los datos de terceros
```

## Versión, licencia y cita

**Versión.** `VERSION` = 1.0.0, ligada al interior del libro (ver `VERSION`). Un cambio en cualquier cifra o huella abre una versión nueva.

**Licencia.** MIT para el código y la documentación (`LICENSE`). El libro y los datos de terceros no se incluyen ni se licencian aquí.

**Dirección pública.**
- Web: https://miggycapital.com/libros/analisis-tecnico
- GitHub: https://github.com/miggy-web/mc-analisis-tecnico-suplemento
- Las mismas direcciones figuran en el recuadro «Comprueba tú mismo», pág. 318 del libro (edición definitiva RF-452c, 452 págs.).

**Cita.** MIGGY CAPITAL (2026). *MC Análisis Técnico · suplemento reproducible*, v1.0.0.
