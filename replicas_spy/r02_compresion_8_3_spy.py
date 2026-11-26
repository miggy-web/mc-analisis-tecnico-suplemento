#!/usr/bin/env python3
"""Réplica real de 8.3: compresión del ATR% en SPY diario, 2005–2025.
Mismas reglas que el experimento sintético: ATR% = 100·ATR14/cierre; rank causal en L = 100 sesiones; compresión = rank <= 0,10
con enfriamiento H = 20; controles con rank en [0,40; 0,60], sin solapes, fuera de la ventana de un evento previo.
Emparejamiento por régimen de TENDENCIA (cierre frente a SMA200). No se empareja por régimen de volatilidad porque la
compresión es, por construcción, un estado de volatilidad. Los costes no aplican (no se mide una operación).
Inferencia: bootstrap por bloques de años (B = 10 000, semilla 20261126).
"""
import argparse, csv, json
from pathlib import Path
import numpy as np
import comun_real as cr
mc = cr.mc
H, L, UMB, CTRL = 20, 100, 0.10, (0.40, 0.60)
ap_ = argparse.ArgumentParser(); ap_.add_argument("--out", default=str(cr.RAIZ / "resultados" / "r02_compresion_8_3_spy")); a = ap_.parse_args()
OUT = Path(a.out); OUT.mkdir(parents=True, exist_ok=True)
F, O, Hh, Ll, C, sha = cr.cargar()
tend, _, atr, ap = cr.regimen_causal(Hh, Ll, C)
tr = mc.true_range(Hh, Ll, C); rk = mc.rank_causal(ap, L); n = len(C)
def valido(t): return t + H <= n - 1 and t - H + 1 >= 0 and cr.INICIO <= F[t] <= cr.FIN and not np.isnan(rk[t]) and tend[t] is not None
ev, ult = [], -10**9
for t in range(n):
    if valido(t) and rk[t] <= UMB and t - ult >= H: ev.append(t); ult = t
evs = np.array(ev); ct, ultc = [], -10**9
for t in range(n):
    if not valido(t) or not (CTRL[0] <= rk[t] <= CTRL[1]): continue
    pv = evs[evs <= t]
    if len(pv) and t - pv.max() < H: continue
    if t - ultc < H: continue
    ct.append(t); ultc = t
MET = ["E_rel", "E_rel_TR", "recorrido_abs_pct", "rango_futuro_pct", "sube", "baja"]
rows = []
for g, ts in (("compresion", ev), ("control", ct)):
    for t in ts:
        rows.append(dict(grupo=g, fecha=F[t], anio=F[t][:4], regimen=tend[t], atr_pct=ap[t], rank=rk[t],
                         E_rel=atr[t + H] / atr[t], E_rel_TR=tr[t + 1:t + H + 1].mean() / tr[t - H + 1:t + 1].mean(),
                         recorrido_abs_pct=100 * abs(C[t + H] / C[t] - 1),
                         rango_futuro_pct=100 * (Hh[t + 1:t + H + 1].max() - Ll[t + 1:t + H + 1].min()) / C[t],
                         sube=float(C[t + H] > C[t]), baja=float(C[t + H] < C[t])))
regs = sorted({r["regimen"] for r in rows}); anios = sorted({r["anio"] for r in rows})
ri = {r: i for i, r in enumerate(regs)}; ai = {y: i for i, y in enumerate(anios)}
def cube(g):
    N = np.zeros((len(anios), len(regs))); Sm = np.zeros((len(anios), len(regs), len(MET)))
    for r in rows:
        if r["grupo"] == g: i, j = ai[r["anio"]], ri[r["regimen"]]; N[i, j] += 1; Sm[i, j] += [r[m] for m in MET]
    return N, Sm
Ne, Se = cube("compresion"); Nc, Sc = cube("control")
def est(ix):
    ne, se, nc, sc = Ne[ix].sum(0), Se[ix].sum(0), Nc[ix].sum(0), Sc[ix].sum(0); NE = ne.sum()
    me = se.sum(0) / NE; mcn = np.zeros(len(MET))
    for j in range(len(regs)):
        if ne[j] == 0: continue
        if nc[j] == 0: return me, np.full(len(MET), np.nan)
        mcn += ne[j] / NE * sc[j] / nc[j]
    return me, mcn
me, mcn = est(np.arange(len(anios))); dl = me - mcn
IDX = cr.indices_bootstrap_anios(anios)
boots = np.array([np.subtract(*est(IDX[b])) for b in range(cr.B)])
res = {}
for k, m in enumerate(MET):
    lo, hi = mc.ic_percentil(boots[:, k]); p = mc.p_bootstrap_centrado(dl[k], boots[:, k]); f = 100 if m in ("sube", "baja") else 1
    res[m] = dict(eventos=me[k] * f, control=mcn[k] * f, delta=dl[k] * f, ic95=(lo * f, hi * f), p=p)
with open(cr.mc.dir_datos() / "LOCAL_eventos_y_controles_compresion_spy.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader()
    for r in rows: w.writerow({k: (f"{v:.6f}" if isinstance(v, float) else v) for k, v in r.items()})
nom = {"E_rel": "E_rel = ATR14[t+20]/ATR14[t]", "E_rel_TR": "E_rel_TR = TR medio (t,t+20] / [t−19,t]", "recorrido_abs_pct": "Recorrido absoluto (%)",
       "rango_futuro_pct": "Rango futuro (%)", "sube": "Sube (%)", "baja": "Baja (%)"}
md = f"""# Réplica real de 8.3 — compresión del ATR% en SPY diario ({cr.INICIO} → {cr.FIN})
Datos SHA-256 `{sha}`. Eventos de compresión: {len(ev)}; controles: {len(ct)}. Regímenes de tendencia: {', '.join(regs)}; años: {len(anios)}.
{mc.tabla_md(["Medida", "Compresión", "Control (ponderado por régimen)", "Δ", "IC 95 % (bootstrap por años)", "p"],
            [[nom[m], mc.fmt(res[m]['eventos'],3), mc.fmt(res[m]['control'],3), mc.fmt(res[m]['delta'],3), f"[{mc.fmt(res[m]['ic95'][0],3)}; {mc.fmt(res[m]['ic95'][1],3)}]", mc.fmt(res[m]['p'],4)] for m in MET])}
"""
(OUT / "tabla_replica_compresion_spy.md").write_text(md)
cr.mc.guardar_json(dict(sha_csv=sha, N_eventos=len(ev), N_controles=len(ct), regimenes=regs, resultados=res), OUT / "resultados_replica_compresion_spy.json")
print("r02_compresion_8_3_spy: ok")
