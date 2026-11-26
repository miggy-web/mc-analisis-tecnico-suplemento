#!/usr/bin/env python3
"""Experimento e02 · 7.3 Matriz de redundancia de 18 osciladores (figura 7.3.1): las 153 parejas completas.

Cálculo del motor (redundancy.ts::matrizOsciladores sobre bancoDeSeries(4, 200)):
  · cada oscilador con su periodo por defecto (tabla de parámetros abajo; fuente: motor/ta/src/momentum.ts);
  · por serie y pareja, correlación de Pearson sobre los NIVELES, solo en las velas en que las dos líneas tienen valor
    (las ventanas de calentamiento incompletas quedan fuera); la serie no cuenta si hay < 30 valores comunes o si una
    línea es constante (correlación no definida);
  · la celda es la media simple de las correlaciones válidas de las 60 series (sin ponderar);
  · concordancia de signo: fracción de velas en que las dos líneas cambian en el mismo sentido (se ignoran cambios nulos).
Es una descripción del banco: una correlación alta entre niveles no mide cuánto cambia una decisión al añadir el segundo oscilador.
Uso: python3 experimentos/e02_matriz_osciladores_7_3.py [--out DIR]
"""
import argparse, csv, json, subprocess, sys
from pathlib import Path
AQUI = Path(__file__).resolve().parent; RAIZ = AQUI.parent
sys.path.insert(0, str(RAIZ / "mc"))
import mc_comun as mc
ap = argparse.ArgumentParser(); ap.add_argument("--out", default=str(RAIZ / "resultados" / "e02_matriz_osciladores_7_3")); a = ap.parse_args()
OUT = Path(a.out); OUT.mkdir(parents=True, exist_ok=True)
d = json.loads(subprocess.run(["node", "--experimental-strip-types", "--no-warnings", "matriz_7_3.mts"], cwd=RAIZ / "motor",
                              capture_output=True, text=True, check=True).stdout)
PARAM = {"rsi": "n = 14 (Wilder)", "macd": "EMA 12 − EMA 26 (línea MACD)", "stoch": "%K, n = 14, suavizado 3", "stochrsi": "%K, RSI 14, estocástico 14, suavizado 3",
         "cci": "n = 20, precio típico", "williams": "n = 14", "roc": "n = 9", "momentum": "n = 10", "uo": "7, 14, 28", "ao": "SMA 5 − SMA 34 de (H+L)/2",
         "trix": "n = 15", "ppo": "EMA 12, EMA 26 (línea PPO)", "dpo": "n = 20, desplazamiento 11", "cmo": "n = 9", "fisher": "n = 9, (H+L)/2",
         "coppock": "ROC 14 + ROC 11, WMA 10", "kst": "ROC 10/15/20/30, medias 10/10/10/15", "rvi": "n = 10, media simétrica (1,2,2,1)/6"}
osc = [o["id"] for o in d["osciladores"]]; nombre = {o["id"]: o["es"] for o in d["osciladores"]}
assert len(osc) == 18 and len(d["pares"]) == 153
regs = [x["regime"] for x in d["pares"][0]["porRegimen"]]
with open(OUT / "matriz_osciladores_153_parejas.csv", "w", newline="") as f:
    w = csv.writer(f, lineterminator="\n")
    w.writerow(["a", "b", "r_media", "concordancia_signo", "series_validas_r", "series_validas_signo"] + [f"r_{r}" for r in regs])
    for p in d["pares"]:
        w.writerow([p["a"], p["b"], f"{p['r']:.6f}", f"{p['signo']:.6f}", p["series_validas_r"], p["series_validas_signo"]] +
                   [("" if x["r"] is None else f"{x['r']:.6f}") for x in p["porRegimen"]])
R = {(p["a"], p["b"]): p["r"] for p in d["pares"]}
filas = []
for i, x in enumerate(osc):
    filas.append([f"{i + 1}. {nombre[x]}"] + [mc.fmt(R.get((osc[j], x), R.get((x, osc[j]))), 2) for j in range(i)] + [""] * (len(osc) - i))
md = f"""# 7.3 Matriz de 18 osciladores, 153 parejas (generado por `experimentos/e02_matriz_osciladores_7_3.py`)

Banco general: {d['series']} series × 200 velas. Series con correlación válida por pareja: mínimo {min(p['series_validas_r'] for p in d['pares'])}, máximo {max(p['series_validas_r'] for p in d['pares'])}.

## Correlación media de Pearson sobre niveles (triángulo inferior)
{mc.tabla_md(["Oscilador"] + [str(j + 1) for j in range(len(osc))], filas)}
## Parámetros de cada oscilador (periodo por defecto del motor)
{mc.tabla_md(["#", "Id", "Nombre", "Parámetros", "Primera vela con valor (máx. en el banco)"], [[i + 1, o["id"], o["es"], PARAM[o["id"]], o["primera_vela_con_valor_max"]] for i, o in enumerate(d["osciladores"])])}
La tabla completa, con la concordancia de signo y la correlación por régimen, está en `matriz_osciladores_153_parejas.csv`.
"""
(OUT / "matriz_osciladores_7_3.md").write_text(md)
sel = {k: R[("rsi", k)] for k in ("stoch", "cmo", "macd")}
mc.guardar_json(dict(n_osciladores=len(osc), n_parejas=len(d["pares"]), rsi_con=sel,
                     series_validas_min=min(p["series_validas_r"] for p in d["pares"]), series_validas_max=max(p["series_validas_r"] for p in d["pares"])),
                OUT / "resultados_7_3.json")
print("e02 matriz: ok")
