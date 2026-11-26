#!/usr/bin/env python3
"""Réplica real de 14.2: sobreajuste con walk-forward año a año en SPY diario.
Regla: la del motor del libro (`backtest` de stats.ts, portada línea a línea): cruce de SMA rápida/lenta, entrada al cierre
de la vela del cruce, largo o corto, stop a k·ATR simple 14, objetivo a m·R; stop y objetivo en la misma vela = pérdida.
Rejilla del libro: rápida {5,8,10,12,15,20} × lenta {20,30,40,50,60} × stop {1; 1,5; 2; 3} ATR × objetivo {1; 1,5; 2; 3} R,
lenta > rápida → 464 combinaciones.
Costes: 5 pb ida y vuelta sobre el precio de entrada (base) y 10 pb (adverso), convertidos a R (coste / riesgo) y
DESCONTADOS ANTES de seleccionar.
Walk-forward: entrenamiento = 5 años naturales previos (operaciones con entrada y salida dentro de ese tramo);
prueba = año siguiente (operaciones con entrada en ese año). Años de prueba 2010–2025. Mínimo de operaciones en
entrenamiento: 1 (equivale al «sin filtro» de 14.2: sin operaciones la esperanza no está definida) y 30.
"""
import argparse, json
from pathlib import Path
import numpy as np
import comun_real as cr
mc = cr.mc
ap_ = argparse.ArgumentParser(); ap_.add_argument("--out", default=str(cr.RAIZ / "resultados" / "r03_walkforward_14_2_spy")); a = ap_.parse_args()
OUT = Path(a.out); OUT.mkdir(parents=True, exist_ok=True)
F, O, Hh, Ll, C, sha = cr.cargar(); n = len(C); anio = np.array([int(x[:4]) for x in F])
RAP, LEN, STP, OBJ = [5, 8, 10, 12, 15, 20], [20, 30, 40, 50, 60], [1, 1.5, 2, 3], [1, 1.5, 2, 3]
REJ = [(r, l, s, o) for r in RAP for l in LEN if l > r for s in STP for o in OBJ]
assert len(REJ) == 464
SMA = {k: cr.sma(C, k) for k in set(RAP) | set(LEN)}
tr = mc.true_range(Hh, Ll, C); atrS = np.full(n, np.nan)
for i in range(14, n): atrS[i] = tr[i - 13:i + 1].mean()   # atrSimple: TR con cierre previo, i >= 14
def backtest(rap, len_, stp, obj):
    fa, la = SMA[rap], SMA[len_]; ops = []; ab = None
    for i in range(1, n):
        if ab is not None:
            e_i, px, stop, objp, d, ries = ab
            toca_s = Ll[i] <= stop if d == 1 else Hh[i] >= stop
            toca_o = Hh[i] >= objp if d == 1 else Ll[i] <= objp
            if toca_s or toca_o:
                ops.append((e_i, i, px, ries, -1.0 if toca_s else obj)); ab = None; continue
            continue
        if np.isnan(fa[i]) or np.isnan(fa[i - 1]) or np.isnan(la[i]) or np.isnan(la[i - 1]) or np.isnan(atrS[i]) or atrS[i] <= 0: continue
        up = fa[i - 1] <= la[i - 1] and fa[i] > la[i]; dn = fa[i - 1] >= la[i - 1] and fa[i] < la[i]
        if not up and not dn: continue
        d = 1 if up else -1; ries = atrS[i] * stp
        ab = (i, C[i], C[i] - d * ries, C[i] + d * ries * obj, d, ries)
    return ops
TODAS = [backtest(*r) for r in REJ]
def metr(ops, coste_bps):
    if not ops: return float('nan'), 0
    rr = [r - (coste_bps / 1e4) * px / ries for (_, _, px, ries, r) in ops]
    return float(np.mean(rr)), len(rr)
res = {}
for coste in (cr.COSTE_BPS_IDA_VUELTA, cr.COSTE_BPS_ADVERSO):
    for minops in (1, 30):
        anual = []; oos_r_todas = []
        for y in range(2010, 2026):
            tr0, tr1 = y - 5, y - 1
            def en_train(op): return tr0 <= anio[op[0]] <= tr1 and anio[op[1]] <= tr1
            def en_test(op): return anio[op[0]] == y
            ins = [metr([op for op in ops if en_train(op)], coste) for ops in TODAS]
            oos = [metr([op for op in ops if en_test(op)], coste) for ops in TODAS]
            cand = [k for k in range(len(REJ)) if ins[k][1] >= minops] or [0]
            best = max(cand, key=lambda k: ins[k][0])  # primer máximo, como el motor (> estricto)
            oos_vals = np.array([o[0] for o in oos])
            ops_best = [op for op in TODAS[best] if en_test(op)]
            oos_r_todas += [(y, r - (coste / 1e4) * px / ries) for (_, _, px, ries, r) in ops_best]
            anual.append(dict(anio_prueba=y, combinacion=dict(rapida=REJ[best][0], lenta=REJ[best][1], stopATR=REJ[best][2], objetivoR=REJ[best][3]),
                              R_dentro=ins[best][0], ops_dentro=ins[best][1], R_fuera=oos[best][0], ops_fuera=oos[best][1],
                              media_fuera_464=float(np.nanmean(oos_vals)), percentil_fuera=(float(np.mean(oos_vals[~np.isnan(oos_vals)] <= oos[best][0]) * 100) if not np.isnan(oos[best][0]) else float('nan'))))
        r_out = np.array([r for _, r in oos_r_todas]); ys = np.array([y for y, _ in oos_r_todas]); uy = sorted(set(ys.tolist()))
        IDX = cr.indices_bootstrap_anios(uy)
        sums = np.array([r_out[ys == y].sum() for y in uy]); cnts = np.array([np.sum(ys == y) for y in uy])
        bm = np.array([sums[ix].sum() / cnts[ix].sum() for ix in IDX])
        lo, hi = mc.ic_percentil(bm)
        res[f"coste{int(coste)}pb_min{minops}"] = dict(
            coste_bps_ida_vuelta=coste, min_ops_train=minops, anios=anual,
            R_dentro_medio=float(np.mean([x["R_dentro"] for x in anual])),
            R_fuera_agregado=float(r_out.mean()) if len(r_out) else float("nan"), ops_fuera=int(len(r_out)),
            ic95_R_fuera=(lo, hi), media_464_fuera_media=float(np.mean([x["media_fuera_464"] for x in anual])),
            percentil_fuera_medio=float(np.nanmean([x["percentil_fuera"] for x in anual])), anios_sin_operaciones_fuera=[x["anio_prueba"] for x in anual if x["ops_fuera"] == 0])
md = f"# Réplica real de 14.2 — walk-forward año a año en SPY diario (prueba 2010–2025)\nDatos SHA-256 `{sha}`. 464 combinaciones; costes descontados antes de seleccionar.\n\n"
md += mc.tabla_md(["Escenario", "R medio dentro (mejor de cada ventana)", "R medio fuera (agregado)", "Operaciones fuera", "IC 95 % R fuera (bootstrap por años)", "Media de las 464 fuera", "Percentil medio del elegido fuera"],
                  [[k, mc.fmt(v["R_dentro_medio"],3), mc.fmt(v["R_fuera_agregado"],3), v["ops_fuera"], f"[{mc.fmt(v['ic95_R_fuera'][0],3)}; {mc.fmt(v['ic95_R_fuera'][1],3)}]", mc.fmt(v["media_464_fuera_media"],3), mc.fmt(v["percentil_fuera_medio"],1)] for k, v in res.items()])
k0 = f"coste{int(cr.COSTE_BPS_IDA_VUELTA)}pb_min1"
md += f"\n## Detalle anual ({k0})\n" + mc.tabla_md(["Año de prueba", "Combinación (rápida/lenta/stop ATR/objetivo R)", "R dentro", "Ops dentro", "R fuera", "Ops fuera", "Media 464 fuera", "Percentil fuera"],
    [[x["anio_prueba"], f"{x['combinacion']['rapida']}/{x['combinacion']['lenta']}/{mc.fmt(x['combinacion']['stopATR'],1)}/{mc.fmt(x['combinacion']['objetivoR'],1)}", mc.fmt(x["R_dentro"],3), x["ops_dentro"], mc.fmt(x["R_fuera"],3), x["ops_fuera"], mc.fmt(x["media_fuera_464"],3), mc.fmt(x["percentil_fuera"],1)] for x in res[k0]["anios"]])
(OUT / "tabla_replica_sobreajuste_spy.md").write_text(md)
cr.mc.guardar_json(dict(sha_csv=sha, resultados=res), OUT / "resultados_replica_sobreajuste_spy.json")
print("r03_walkforward_14_2_spy: ok")
