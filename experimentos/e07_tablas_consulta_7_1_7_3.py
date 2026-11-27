#!/usr/bin/env python3
"""Experimento e07 · Tablas de consulta 7.1.a y 7.3.a, y los datos de la figura 7.3.1.

7.1.a: RSI 14 de Wilder paso a paso sobre los 17 cierres didácticos de la figura 7.1.1 (primera media simple de las
       variaciones 2 a 15; después media de Wilder, α = 1/14; cálculo a precisión completa y redondeo solo al escribir).
       Se regenera la tabla y se exige que sea idéntica byte a byte a tablas_consulta/tabla_7_1_a_*.
7.3.a: se ejecuta e02 en una carpeta temporal y se exige que tablas_consulta/tabla_7_3_a_* sea idéntica byte a byte.
Figura 7.3.1 (resumen): r de cada oscilador con el RSI (17 valores) y las parejas con |r| ≥ 0,80 de toda la matriz.
Uso: python3 experimentos/e07_tablas_consulta_7_1_7_3.py [--out DIR]
"""
import argparse, csv, io, json, subprocess, sys, tempfile
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
AQUI = Path(__file__).resolve().parent; RAIZ = AQUI.parent
TC = RAIZ / "tablas_consulta"
ap = argparse.ArgumentParser(); ap.add_argument("--out", default=str(RAIZ / "resultados" / "e07_tablas_consulta_7_1_7_3")); a = ap.parse_args()
OUT = Path(a.out); OUT.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------- 7.1.a
CIERRES = [100.00, 100.80, 101.20, 100.40, 99.70, 100.10, 101.50, 102.00, 101.10, 100.20, 99.40, 99.80, 100.90, 101.60, 102.40, 101.80, 102.10]
N = 14
def es(x, d):
    s = str(Decimal(repr(x)).quantize(Decimal(1).scaleb(-d), rounding=ROUND_HALF_UP)).replace(".", ",")
    return s.replace("-", "−")
filas, valores = [], []
mg = mp = None
for i, c in enumerate(CIERRES):
    if i == 0:
        filas.append([str(i + 1), es(c, 2)] + ["—"] * 7); continue
    v = round(CIERRES[i] - CIERRES[i - 1], 10); g, p = max(v, 0.0), max(-v, 0.0)
    fila = [str(i + 1), es(c, 2), es(v, 2), es(g, 2), es(p, 2)]
    if i < N:
        fila += ["—"] * 4
    else:
        if i == N:
            var = [round(CIERRES[k] - CIERRES[k - 1], 10) for k in range(1, N + 1)]
            mg = sum(max(x, 0) for x in var) / N; mp = sum(max(-x, 0) for x in var) / N
        else:
            mg = (mg * (N - 1) + g) / N; mp = (mp * (N - 1) + p) / N
        rs = mg / mp; rsi = 100 - 100 / (1 + rs)
        fila += [es(mg, 4), es(mp, 4), es(rs, 3), es(rsi, 2)]
        valores.append(dict(sesion=i + 1, media_g=mg, media_p=mp, rs=rs, rsi=rsi))
    filas.append(fila)
cab = ["Sesión", "Cierre", "Variación", "Ganancia", "Pérdida", "Media G", "Media P", "RS", "RSI"]
b = io.StringIO(); w = csv.writer(b, lineterminator="\n"); w.writerow(cab)
for f in filas: w.writerow([x if (j == 0 or x == "—") else x for j, x in enumerate(f)])
csv_txt = "\n".join([",".join(cab)] + [",".join([f[0]] + [x if x == "—" else f'"{x}"' for x in f[1:]]) for f in filas]) + "\n"
md = ["# Tabla 7.1.a (consulta) · RSI 14 de Wilder, las 17 sesiones de la fig. 7.1.1", "",
      "Serie didáctica simulada (17 cierres del libro). Medias con 4 decimales, RS con 3, RSI con 2. Primera media: simple, sesiones 2 a 15; después α = 1/14.", "",
      "| " + " | ".join(cab) + " |", "|" + "---:|" * len(cab)]
for f in filas:
    md.append("| " + " | ".join(f"**{x}**" for x in f) + " |" if f[0] == str(N + 1) else "| " + " | ".join(f) + " |")
md += ["", "La fila en negrita (sesión 15) es la semilla: el primer RSI. Ninguna sesión anterior tiene RSI."]
md_txt = "\n".join(md) + "\n"
ok71_csv = csv_txt == (TC / "tabla_7_1_a_rsi_17_sesiones.csv").read_text(encoding="utf-8")
ok71_md = md_txt == (TC / "tabla_7_1_a_rsi_17_sesiones.md").read_text(encoding="utf-8")
assert ok71_csv, "tabla 7.1.a (CSV) no coincide con la regenerada"
assert ok71_md, "tabla 7.1.a (MD) no coincide con la regenerada"

# ---------------------------------------------------------------- 7.3.a
with tempfile.TemporaryDirectory(prefix="mc_e07_") as tmp:
    subprocess.run([sys.executable, str(AQUI / "e02_matriz_osciladores_7_3.py"), "--out", tmp], check=True, capture_output=True)
    csv73 = (Path(tmp) / "matriz_osciladores_153_parejas.csv").read_bytes(); md73 = (Path(tmp) / "matriz_osciladores_7_3.md").read_bytes()
ok73_csv = csv73 == (TC / "tabla_7_3_a_matriz_osciladores_153_parejas.csv").read_bytes()
ok73_md = md73 == (TC / "tabla_7_3_a_matriz_osciladores_18x18.md").read_bytes()
assert ok73_csv and ok73_md, "tabla 7.3.a no coincide con la salida de e02"
pares = list(csv.DictReader(io.StringIO(csv73.decode())))
r = {(p["a"], p["b"]): float(p["r_media"]) for p in pares}
def rr(x, y): return r.get((x, y), r.get((y, x)))
osc = []
for p in pares:
    for k in (p["a"], p["b"]):
        if k not in osc: osc.append(k)
con_rsi = {o: rr("rsi", o) for o in osc if o != "rsi"}
altas = sorted([dict(a=p["a"], b=p["b"], r=float(p["r_media"])) for p in pares if abs(float(p["r_media"])) >= 0.80], key=lambda x: -abs(x["r"]))
dpo_neg = all(rr("dpo", o) < 0 for o in osc if o != "dpo")
solo_dpo_neg_con_rsi = [o for o, v in con_rsi.items() if v < 0] == ["dpo"]
res = dict(tabla_7_1_a=dict(cierres=CIERRES, valores=valores, csv_identico=ok71_csv, md_identico=ok71_md),
           tabla_7_3_a=dict(csv_identico=ok73_csv, md_identico=ok73_md),
           figura_7_3_1=dict(r_con_rsi=con_rsi, parejas_abs_r_ge_080=altas, n_parejas_abs_r_ge_080=len(altas),
                             dpo_negativo_con_los_otros_17=dpo_neg, solo_dpo_negativo_con_rsi=solo_dpo_neg_con_rsi))
(OUT / "resultados_tablas_consulta.json").write_text(json.dumps(res, indent=1, ensure_ascii=False) + "\n")
lin = ["# Tablas de consulta 7.1.a y 7.3.a, y figura 7.3.1 (generado por `experimentos/e07_tablas_consulta_7_1_7_3.py`)", "",
       f"- 7.1.a regenerada desde los 17 cierres: CSV idéntico = {ok71_csv}; MD idéntico = {ok71_md}.",
       f"- 7.3.a idéntica a la salida de e02: CSV = {ok73_csv}; MD = {ok73_md}.",
       f"- Parejas con |r| ≥ 0,80: {len(altas)}. DPO negativo frente a los otros 17: {dpo_neg}.", "",
       "| Oscilador | r con el RSI |", "|---|---|"] + [f"| {o} | {v:.2f} |".replace(".", ",") for o, v in sorted(con_rsi.items(), key=lambda x: -x[1])]
lin += ["", "| Pareja | r |", "|---|---|"] + [f"| {x['a']} – {x['b']} | {x['r']:.2f} |".replace(".", ",") for x in altas]
(OUT / "tablas_consulta_7_1_7_3.md").write_text("\n".join(lin) + "\n")
print("e07 ok")
