#!/usr/bin/env python3
"""Experimento e01 · 3.6 Precisión de una proporción frente a potencia de una comparación (figura 3.6.3, caja 16).

Precisión: n = ⌈z² · p(1 − p) / e²⌉ con z = 1,96 y p = 0,50, en aritmética exacta (fracciones), para e = 0,05, 0,02 y 0,10.
Supone observaciones independientes. No es un cálculo de potencia.
Potencia (ilustración que el libro no imprime): contraste bilateral de una proporción frente a una base conocida p0 = 0,50,
α = 0,05, potencia 0,80, diferencia de 2 y 5 puntos: n = ⌈((z_{1−α/2}·√(p0 q0) + z_{1−β}·√(p1 q1)) / (p1 − p0))²⌉.
Frecuencia del martillo (k = 2, mechaLarga = 2) en el banco general: función `sensibilidad` del motor.
Uso: python3 experimentos/e01_precision_3_6.py [--out DIR]
"""
import argparse, json, math, subprocess, sys
from fractions import Fraction as Fr
from pathlib import Path
from statistics import NormalDist
AQUI = Path(__file__).resolve().parent; RAIZ = AQUI.parent
sys.path.insert(0, str(RAIZ / "mc"))
import mc_comun as mc
ap = argparse.ArgumentParser(); ap.add_argument("--out", default=str(RAIZ / "resultados" / "e01_precision_3_6")); a = ap.parse_args()
OUT = Path(a.out); OUT.mkdir(parents=True, exist_ok=True)
z = Fr(196, 100); p = Fr(1, 2)
prec = {}
for e in (Fr(5, 100), Fr(2, 100), Fr(10, 100)):
    x = z * z * p * (1 - p) / (e * e)
    prec[f"e={float(e):.2f}"] = dict(n_exacto=str(x), n_decimal=float(x), n_minimo_entero=math.ceil(x))
m = json.loads(subprocess.run(["node", "--experimental-strip-types", "--no-warnings", "martillo_3_3.mts"], cwd=RAIZ / "motor",
                              capture_output=True, text=True, check=True).stdout)
k2 = next(x["veces"] for x in m["martillo"] if x["valor"] == 2); velas = m["velas"]
n385 = prec["e=0.05"]["n_minimo_entero"]
mart = dict(velas_banco=velas, martillos_k2=k2, velas_por_martillo=velas / k2, una_de_cada_redondeado=round(velas / k2),
            velas_para_385_frecuencia_exacta=math.ceil(n385 * velas / k2), velas_para_385_con_1_de_245=245 * n385,
            velas_para_384_con_1_de_245=245 * 384, margen_con_49=float(z) * math.sqrt(0.25 / k2))
nd = NormalDist(); za, zb = nd.inv_cdf(0.975), nd.inv_cdf(0.80)
pot = {}
for d in (0.02, 0.05):
    p0, p1 = 0.5, 0.5 + d
    pot[f"diferencia_{int(round(d * 100))}_puntos"] = dict(p0=p0, p1=p1, alfa=0.05, potencia=0.80,
        n_minimo_entero=math.ceil(((za * math.sqrt(p0 * (1 - p0)) + zb * math.sqrt(p1 * (1 - p1))) / d) ** 2))
mc.guardar_json(dict(precision=prec, martillo=mart, potencia_ilustrativa=pot, z_975=za, z_80=zb), OUT / "resultados_3_6.json")
md = "# 3.6 Precisión frente a potencia (generado por `experimentos/e01_precision_3_6.py`)\n\n" + mc.tabla_md(
    ["Margen e", "z²·p(1−p)/e² (exacto)", "Mínimo entero n"], [[k[2:].replace(".", ","), mc.fmt(v["n_decimal"], 2), v["n_minimo_entero"]] for k, v in prec.items()])
md += "\n" + mc.tabla_md(["Martillo (k = 2) en el banco general", "Valor"], [[k, mc.fmt(v, 4) if isinstance(v, float) else v] for k, v in mart.items()])
md += "\n## Potencia (ilustración): proporción frente a una base conocida p0 = 0,50, α = 0,05 bilateral, potencia 0,80\n" + mc.tabla_md(
    ["Diferencia de interés", "n mínimo"], [[k.replace("_", " "), v["n_minimo_entero"]] for k, v in pot.items()])
(OUT / "precision_3_6.md").write_text(md)
print("e01 precisión: ok")
