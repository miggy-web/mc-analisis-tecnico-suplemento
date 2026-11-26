#!/usr/bin/env python3
"""Réplica real de 7.4: divergencias REGULARES del RSI 14 (swings n = 3) en SPY diario, 2005–2025.
Entrada en t_obs = t_pivote + 3 (cierre); horizonte 20 sesiones completas; base emparejada = pivotes del mismo tipo
confirmados sin divergencia, mismo régimen causal (tendencia SMA200 × volatilidad ATR% frente a su mediana de 252 sesiones).
Costes: 5 pb ida y vuelta (base) y 10 pb (adverso) sobre el rendimiento firmado (largo tras alcista, corto tras bajista).
Inferencia: bootstrap por bloques de años naturales (B = 10 000, semilla 20261126), p bilateral centrado.
"""
import argparse, csv, json
from pathlib import Path
import numpy as np
import comun_real as cr
mc = cr.mc
H, DER = 20, 3
ap_ = argparse.ArgumentParser(); ap_.add_argument("--out", default=str(cr.RAIZ / "resultados" / "r01_divergencias_7_4_spy")); a = ap_.parse_args()
OUT = Path(a.out); OUT.mkdir(parents=True, exist_ok=True)
F, O, Hh, L, C, sha = cr.cargar()
tend, vol, _, _ = cr.regimen_causal(Hh, L, C)
R = mc.rsi(C, 14); n = len(C)
divs = mc.divergencias(Hh, L, R); reg = [d for d in divs if d["clase"] == "regular"]
con = {(d["dir"], d["hasta"]) for d in reg}
def valido(t): return t + H <= n - 1 and cr.INICIO <= F[t] <= cr.FIN and tend[t] is not None and vol[t] is not None
filas = []
for d in reg:
    t = d["hasta"] + DER
    if not valido(t): continue
    filas.append(("evento", d["dir"], t))
for dir_, tipo, px in (("alcista", "bajo", L), ("bajista", "alto", Hh)):
    for p in mc.pivotes(px, 3, 3, tipo):
        t = p + DER
        if valido(t) and (dir_, p) not in con: filas.append(("base", dir_, t))
regs = sorted({f"{tend[t]}|{vol[t]}" for _, _, t in filas}); anios = sorted({F[t][:4] for _, _, t in filas})
reg_ix = {r: i for i, r in enumerate(regs)}; an_ix = {y: i for i, y in enumerate(anios)}
rows = []
for g, dir_, t in filas:
    ret = 100 * (C[t + H] / C[t] - 1); firm = ret if dir_ == "alcista" else -ret
    ok = (C[t + H] > C[t]) if dir_ == "alcista" else (C[t + H] < C[t])
    rows.append(dict(grupo=g, dir=dir_, fecha_obs=F[t], fecha_fin=F[t + H], regimen=f"{tend[t]}|{vol[t]}", anio=F[t][:4],
                     ret_pct=ret, ret_firmado_bruto_pct=firm, ret_firmado_neto5_pct=firm - cr.COSTE_BPS_IDA_VUELTA / 100,
                     ret_firmado_neto10_pct=firm - cr.COSTE_BPS_ADVERSO / 100, acierto=int(ok)))
MET = ["acierto", "ret_firmado_bruto_pct", "ret_firmado_neto5_pct", "ret_firmado_neto10_pct"]
IDX = cr.indices_bootstrap_anios(anios)
res = {}
for dir_ in ("alcista", "bajista"):
    def cube(g):
        N = np.zeros((len(anios), len(regs))); Sm = np.zeros((len(anios), len(regs), len(MET)))
        for r in rows:
            if r["grupo"] == g and r["dir"] == dir_:
                i, j = an_ix[r["anio"]], reg_ix[r["regimen"]]; N[i, j] += 1; Sm[i, j] += [r[m] for m in MET]
        return N, Sm
    Ne, Se = cube("evento"); Nb, Sb = cube("base")
    def est(ix):
        ne = Ne[ix].sum(0); se = Se[ix].sum(0); nb = Nb[ix].sum(0); sb = Sb[ix].sum(0)
        NE = ne.sum()
        if NE == 0: return np.full(len(MET), np.nan), np.full(len(MET), np.nan)
        me = se.sum(0) / NE; mb = np.zeros(len(MET))
        for j in range(len(regs)):
            if ne[j] == 0: continue
            if nb[j] == 0: return me, np.full(len(MET), np.nan)
            mb += ne[j] / NE * sb[j] / nb[j]
        return me, mb
    me, mb = est(np.arange(len(anios))); dl = me - mb
    boots = np.array([np.subtract(*est(IDX[b])) for b in range(cr.B)])
    out = dict(N_eventos=int(Ne.sum()), N_base=int(Nb.sum()))
    for k, m in enumerate(MET):
        lo, hi = mc.ic_percentil(boots[:, k]); p = mc.p_bootstrap_centrado(dl[k], boots[:, k]); f = 100 if m == "acierto" else 1
        out[m] = dict(eventos=me[k] * f, base_emparejada=mb[k] * f, delta=dl[k] * f, ic95=(lo * f, hi * f), p=p)
    res[dir_] = out
with open(cr.mc.dir_datos() / "LOCAL_eventos_divergencias_spy.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader()
    for r in rows: w.writerow({k: (f"{v:.6f}" if isinstance(v, float) else v) for k, v in r.items()})
nom = {"acierto": "Acierto de signo a 20 sesiones (%)", "ret_firmado_bruto_pct": "Rendimiento firmado bruto a 20 sesiones (%)",
       "ret_firmado_neto5_pct": "Ídem, neto de 5 pb ida y vuelta (%)", "ret_firmado_neto10_pct": "Ídem, neto de 10 pb (%)"}
filas_md = []
for dir_ in res:
    for m in MET:
        x = res[dir_][m]
        filas_md.append([dir_, res[dir_]["N_eventos"], res[dir_]["N_base"], nom[m], mc.fmt(x["eventos"], 3), mc.fmt(x["base_emparejada"], 3),
                         mc.fmt(x["delta"], 3), f"[{mc.fmt(x['ic95'][0],3)}; {mc.fmt(x['ic95'][1],3)}]", mc.fmt(x["p"], 4)])
md = f"""# Réplica real de 7.4 — divergencias regulares RSI 14 en SPY diario ({cr.INICIO} → {cr.FIN})
Datos: `{cr.MAN["archivo_csv"]}`, SHA-256 `{sha}` (ver MANIFEST_DATOS). Regímenes: {', '.join(regs)}. Años en el bootstrap: {len(anios)}.
{mc.tabla_md(["Dirección", "N eventos", "N base", "Medida", "Eventos", "Base emparejada", "Δ", "IC 95 % (bootstrap por años)", "p"], filas_md)}
Rendimiento firmado: largo tras divergencia alcista, corto tras bajista. No es una regla de trading: es la comparación de una lectura contra su base.
"""
(OUT / "tabla_replica_divergencias_spy.md").write_text(md)
cr.mc.guardar_json(dict(sha_csv=sha, regimenes=regs, anios=anios, resultados=res), OUT / "resultados_replica_divergencias_spy.json")
print("r01_divergencias_7_4_spy: ok")
