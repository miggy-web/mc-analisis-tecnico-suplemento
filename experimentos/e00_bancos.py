#!/usr/bin/env python3
"""Experimento e00 · Los tres bancos simulados del libro: tamaño, semillas, parámetros del generador y huella.

  general     bancoDeSeries(4, 200): 15 regímenes × 4 semillas × 200 velas = 12.000 velas (3.3, 3.6, 7.3, 7.4, verificador)
  sobreajuste bancoDeSeries(4, 250): 15 × 4 × 250 = 15.000 velas (14.2; series pares = dentro, impares = fuera)
  largo       regimeSeries(régimen, 800, semilla 7000 + 100·i + k), k = 0..7: 15 × 8 × 800 = 96.000 velas (8.3)
Generador (motor/ta/src/series.ts): RNG mulberry32 sembrado por serie; cada serie es UNA fase del régimen, que empieza
en 100 con tick 0,01, volatilidad 1 y volumen base 1000. No hay calentamiento ni velas descartadas en el generador:
la vela 0 es la primera de la serie. Si una vela saliera con precio no positivo, el generador lanza un error (no
recorta ni descarta); este script comprueba que no ocurre. Los calentamientos de cada indicador se declaran en cada
experimento (METODOLOGIA.md).
Uso: python3 experimentos/e00_bancos.py [--out DIR]
"""
import argparse, sys
from pathlib import Path
import numpy as np
AQUI = Path(__file__).resolve().parent; RAIZ = AQUI.parent
sys.path.insert(0, str(RAIZ / "mc"))
import mc_comun as mc
ap = argparse.ArgumentParser(); ap.add_argument("--out", default=str(RAIZ / "resultados" / "e00_bancos")); a = ap.parse_args()
OUT = Path(a.out); OUT.mkdir(parents=True, exist_ok=True)
BANCOS = [("general_12000", {"tipo": "libro", "seeds": 4, "n": 200}, 12000, "3.3, 3.6, 7.3, 7.4"),
          ("sobreajuste_15000", {"tipo": "libro", "seeds": 4, "n": 250}, 15000, "14.2"),
          ("largo_96000", {"tipo": "largo", "seeds": 8, "n": 800, "seedBase": 7000}, 96000, "8.3")]
res, filas = {}, []
for nombre, cfg, esperado, uso in BANCOS:
    series, sha = mc.exportar_banco(cfg)
    velas = int(sum(len(s["c"]) for s in series))
    assert velas == esperado, f"{nombre}: {velas} velas, se esperaban {esperado}"
    minimo = float(min(s["l"].min() for s in series)); assert minimo > 0
    coherente = all(bool(np.all(s["h"] >= np.maximum(s["o"], s["c"])) and np.all(s["l"] <= np.minimum(s["o"], s["c"]))) for s in series)
    assert coherente
    semillas = {}
    for s in series: semillas.setdefault(s["regime"], []).append(int(s["seed"]))
    res[nombre] = dict(cfg=cfg, series=len(series), velas_por_serie=len(series[0]["c"]), velas=velas, sha256_export=sha,
                       minimo_low=minimo, semillas_por_regimen=semillas, uso=uso)
    filas.append([nombre, len(series), len(series[0]["c"]), velas, uso, f"`{sha}`"])
mc.guardar_json(res, OUT / "bancos.json")
reg = list(res["general_12000"]["semillas_por_regimen"])
md = "# Los tres bancos simulados (generado por `experimentos/e00_bancos.py`)\n\n" + mc.tabla_md(
    ["Banco", "Series", "Velas por serie", "Velas", "Capítulos", "SHA-256 del export JSON"], filas)
md += "\n## Semillas por régimen\n" + mc.tabla_md(["Régimen", "General (12.000)", "Sobreajuste (15.000)", "Largo (96.000)"],
    [[r, ", ".join(map(str, res["general_12000"]["semillas_por_regimen"][r])), ", ".join(map(str, res["sobreajuste_15000"]["semillas_por_regimen"][r])),
      ", ".join(map(str, res["largo_96000"]["semillas_por_regimen"][r]))] for r in reg])
md += "\nEl banco general y el de sobreajuste comparten semillas (1000 + 100·i + k); cambia la longitud (200 frente a 250 velas), y con ella la serie entera.\n"
(OUT / "bancos.md").write_text(md)
print("e00 bancos: ok")
