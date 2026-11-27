#!/usr/bin/env python3
"""Experimento e09 · Los casos dibujados en las figuras 7.4.1 y 14.2.2 (panel B), recalculados desde los bancos.

7.4.1 A: banco general, régimen parabólico, semilla 1400: divergencia alcista regular con P1 en la vela 24 y P2 en la 36
         (RSI 14, pivotes estrictos n = 3); reloj desde t + 3 = 39 hasta t + 23 = 59.
7.4.1 B: banco general, régimen bajista, semilla 1103: candidato a pivote bajo en la vela 112 que la vela 115 anula.
14.2.2 B: banco de 15.000 velas, serie par 54 (régimen acumulación, semilla 2302), combinación 15/20, stop 1 ATR,
          objetivo 1 R: cruce al alza en la vela t, entrada al cierre, y una vela t + 2 que toca stop y objetivo (→ −1 R).
Uso: python3 experimentos/e09_casos_figuras_7_4_1_14_2_2.py [--out DIR]
"""
import argparse, json, sys
from pathlib import Path
AQUI = Path(__file__).resolve().parent; RAIZ = AQUI.parent
sys.path.insert(0, str(RAIZ / "mc"))
import mc_comun as mc
ap = argparse.ArgumentParser(); ap.add_argument("--out", default=str(RAIZ / "resultados" / "e09_casos_figuras_7_4_1_14_2_2")); a = ap.parse_args()
OUT = Path(a.out); OUT.mkdir(parents=True, exist_ok=True)
f = float
gen, _ = mc.exportar_banco({"tipo": "libro", "seeds": 4, "n": 200})
def serie(banco, regimen, semilla):
    (s,) = [x for x in banco if x["regime"] == regimen and x["seed"] == semilla]; return s
# ---- 7.4.1 A
s = serie(gen, "parabolica", 1400); R = mc.rsi(s["c"], 14)
(d,) = [x for x in mc.divergencias(s["h"], s["l"], R) if x["clase"] == "regular" and x["dir"] == "alcista" and x["desde"] == 24 and x["hasta"] == 36]
t = 36
A = dict(p1_vela=24, p1_min=f(s["l"][24]), p1_rsi=f(R[24]), p2_vela=t, p2_min=f(s["l"][t]), p2_rsi=f(R[t]),
         cierre_t3=f(s["c"][t + 3]), cierre_t23=f(s["c"][t + 23]), ret_20_pct=f(100 * (s["c"][t + 23] / s["c"][t + 3] - 1)))
# ---- 7.4.1 B
s = serie(gen, "bajista", 1103); R = mc.rsi(s["c"], 14); piv = set(mc.pivotes(s["l"], 3, 3, "bajo"))
assert 104 in piv and 112 not in piv and s["l"][115] <= s["l"][112]
B = dict(p1_vela=104, p1_min=f(s["l"][104]), p1_rsi=f(R[104]), cand_vela=112, cand_min=f(s["l"][112]), cand_rsi=f(R[112]),
         min_t3=f(s["l"][115]), candidato_anulado=True)
# ---- 14.2.2 B
ban, _ = mc.exportar_banco({"tipo": "libro", "seeds": 4, "n": 250})
s = ban[54]; assert s["regime"] == "acumulacion" and s["seed"] == 2302
c = s["c"]; sma = lambda n, i: sum(c[i - n + 1:i + 1]) / n
t = 178
assert sma(15, t - 1) <= sma(20, t - 1) and sma(15, t) > sma(20, t), "no hay cruce al alza en t"
atr = sum(max(s["h"][j] - s["l"][j], abs(s["h"][j] - c[j - 1]), abs(s["l"][j] - c[j - 1])) for j in range(t - 13, t + 1)) / 14
ent = c[t]; stop = ent - atr; obj = ent + atr
assert not (s["l"][t + 1] <= stop or s["h"][t + 1] >= obj) and s["l"][t + 2] <= stop and s["h"][t + 2] >= obj
C = dict(vela_t=t, entrada=f(ent), atr14_simple=f(atr), stop=f(stop), objetivo=f(obj),
         t2_o=f(s["o"][t + 2]), t2_h=f(s["h"][t + 2]), t2_l=f(s["l"][t + 2]), t2_c=f(c[t + 2]),
         resultado_R=-1.0, coste_5pb_R=f(5 / 1e4 * ent / atr), neto_5pb_R=f(-1 - 5 / 1e4 * ent / atr))
res = {"7.4.1_A": A, "7.4.1_B": B, "14.2.2_B": C}
(OUT / "resultados_casos_figuras.json").write_text(json.dumps(res, indent=1, ensure_ascii=False) + "\n")
print("e09 ok")
