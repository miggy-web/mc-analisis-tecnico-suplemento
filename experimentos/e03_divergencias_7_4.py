#!/usr/bin/env python3
"""Experimento e03 · 7.4 Divergencias (figura 7.4.1) — cálculo causal sobre el banco simulado general (12.000 velas).

Regla (la de la Definición MC de la pág. 172): solo divergencias REGULARES, RSI 14, swings n = 3.
Instante observable: t_obs = t_pivote + 3 (el pivote solo se confirma 3 velas después).
Horizonte: 20 velas completas desde t_obs (se descartan eventos sin 20 velas futuras).
Base emparejada: pivotes del mismo tipo confirmados (t_pivote + 3) SIN divergencia regular, mismo régimen.
Contraste: IC 95 % por bootstrap por series estratificado por régimen (B = 10 000, semilla 20261126) y p bilateral.
Uso: python3 experimentos/e03_divergencias_7_4.py [--out DIR]
"""
import argparse, csv, json, sys
from pathlib import Path
import numpy as np

AQUI = Path(__file__).resolve().parent; RAIZ = AQUI.parent
sys.path.insert(0, str(RAIZ / "mc"))
import mc_comun as mc

H, DER, B, SEMILLA = 20, 3, 10_000, 20261126
ap = argparse.ArgumentParser(); ap.add_argument("--out", default=str(RAIZ / "resultados" / "e03_divergencias_7_4")); args = ap.parse_args()
OUT = Path(args.out); OUT.mkdir(parents=True, exist_ok=True)

series, sha_banco = mc.exportar_banco({"tipo": "libro", "seeds": 4, "n": 200})
ref = mc.referencia_libro()["div"]

# ---------------------------------------------------------------- 1) paridad con el verificador del libro
c = {"alcista": [0, 0], "bajista": [0, 0]}; bA = bN = 0
clases = {"regular-alcista": 0, "oculta-alcista": 0, "regular-bajista": 0, "oculta-bajista": 0}
for s in series:
    R = mc.rsi(s["c"], 14)
    for d in mc.divergencias(s["h"], s["l"], R):
        clases[f'{d["clase"]}-{d["dir"]}'] += 1
        fin = min(len(s["c"]) - 1, d["hasta"] + H)
        mov = s["c"][fin] - s["c"][d["hasta"]]
        g = c[d["dir"]]; g[0] += 1
        if (mov < 0) if d["dir"] == "bajista" else (mov > 0): g[1] += 1
    for i in range(len(s["c"]) - H):
        bN += 1; bA += s["c"][i + H] > s["c"][i]
par = dict(alcistas=c["alcista"][0], bajistas=c["bajista"][0],
           aciertoalcista=100 * c["alcista"][1] / c["alcista"][0], aciertobajista=100 * c["bajista"][1] / c["bajista"][0],
           basealcista=100 * bA / bN)
for k in par:
    assert abs(par[k] - ref[k]) < 1e-9, f"paridad rota en {k}: {par[k]} vs {ref[k]}"

# ---------------------------------------------------------------- 2) eventos causales y base emparejada
eventos, base = [], []   # base: pivotes confirmados sin divergencia regular
for si, s in enumerate(series):
    C, Hh, L = s["c"], s["h"], s["l"]; n = len(C)
    R = mc.rsi(C, 14)
    divs = mc.divergencias(Hh, L, R)
    reg = [d for d in divs if d["clase"] == "regular"]
    con_div = {("alcista", d["hasta"]) for d in reg if d["dir"] == "alcista"} | {("bajista", d["hasta"]) for d in reg if d["dir"] == "bajista"}
    for d in reg:
        t = d["hasta"] + DER
        if t + H > n - 1: continue
        ret = 100 * (C[t + H] / C[t] - 1)
        ok = (C[t + H] > C[t]) if d["dir"] == "alcista" else (C[t + H] < C[t])
        eventos.append(dict(serie=si, regimen=s["regime"], seed=s["seed"], dir=d["dir"], clase="regular",
                            t_pivote_previo=d["desde"], t_pivote=d["hasta"], t_obs=t, t_fin=t + H,
                            cierre_obs=C[t], cierre_fin=C[t + H], ret_pct=ret, acierto=int(ok)))
    for dir_, tipo, serie_px in (("alcista", "bajo", L), ("bajista", "alto", Hh)):
        for p in mc.pivotes(serie_px, 3, 3, tipo):
            t = p + DER
            if t + H > n - 1 or (dir_, p) in con_div: continue
            ok = (C[t + H] > C[t]) if dir_ == "alcista" else (C[t + H] < C[t])
            base.append(dict(serie=si, regimen=s["regime"], dir=dir_, acierto=int(ok)))

S = len(series); regs = sorted({s["regime"] for s in series})
reg_de = np.array([regs.index(s["regime"]) for s in series])

def contar(lista, dir_):
    k = np.zeros(S); n = np.zeros(S)
    for e in lista:
        if e["dir"] == dir_: n[e["serie"]] += 1; k[e["serie"]] += e["acierto"]
    return k, n

def delta(idx, ke, ne, kb, nb):
    """Δ = acierto(eventos) − base emparejada ponderada por la mezcla de regímenes de los eventos."""
    KE, NE = ke[idx].sum(), ne[idx].sum()
    if NE == 0: return np.nan, np.nan, np.nan
    base_pond = 0.0
    for r in range(len(regs)):
        m = reg_de[idx] == r
        ner = ne[idx][m].sum()
        if ner == 0: continue
        nbr = nb[idx][m].sum()
        if nbr == 0: return np.nan, np.nan, np.nan
        base_pond += (ner / NE) * kb[idx][m].sum() / nbr
    return 100 * KE / NE, 100 * base_pond, 100 * (KE / NE - base_pond)

rng = np.random.default_rng(SEMILLA)
grupos = [np.where(reg_de == r)[0] for r in range(len(regs))]
IDX = np.empty((B, S), dtype=int)
for b in range(B):
    IDX[b] = np.concatenate([rng.choice(g, size=len(g), replace=True) for g in grupos])

resultados = {}
filas_csv, filas_md = [], []
for dir_ in ("alcista", "bajista"):
    ke, ne = contar(eventos, dir_); kb, nb = contar(base, dir_)
    todo = np.arange(S)
    acc, bpond, d = delta(todo, ke, ne, kb, nb)
    boots = np.array([delta(IDX[b], ke, ne, kb, nb)[2] for b in range(B)])
    lo, hi = mc.ic_percentil(boots); p = mc.p_bootstrap_centrado(d, boots)
    w = mc.wilson(ke.sum(), ne.sum())
    # base incondicional del régimen (todas las velas con 20 futuras), ponderada igual
    bi = 0.0
    for r in range(len(regs)):
        m = reg_de == r; ner = ne[m].sum()
        if ner == 0: continue
        kk = nn = 0
        for si in np.where(m)[0]:
            Cc = series[si]["c"]
            for i in range(len(Cc) - H):
                nn += 1; kk += (Cc[i + H] > Cc[i]) if dir_ == "alcista" else (Cc[i + H] < Cc[i])
        bi += (ner / ne.sum()) * kk / nn
    resultados[dir_] = dict(N=int(ne.sum()), aciertos=int(ke.sum()), acierto_pct=acc, wilson=w,
                            N_base=int(nb.sum()), base_emparejada_pct=bpond, base_todas_velas_regimen_pct=100 * bi,
                            delta_pp=d, ic95=(lo, hi), p=p, B=B, semilla=SEMILLA, boots_validos=int(np.sum(~np.isnan(boots))))
    filas_csv.append([dir_, int(ne.sum()), int(ke.sum()), acc, w[0], w[1], int(nb.sum()), bpond, 100 * bi, d, lo, hi, p])
    filas_md.append([dir_, int(ne.sum()), f"{mc.fmt(acc,1)} %", f"{mc.fmt(w[0],1)}–{mc.fmt(w[1],1)}", int(nb.sum()),
                     f"{mc.fmt(bpond,1)} %", f"{mc.fmt(100*bi,1)} %", mc.fmt(d, 1), f"[{mc.fmt(lo,1)}; {mc.fmt(hi,1)}]", mc.fmt(p, 3)])

# desglose por régimen
desg = []
for dir_ in ("alcista", "bajista"):
    for r in regs:
        E = [e for e in eventos if e["dir"] == dir_ and e["regimen"] == r]
        Bs = [e for e in base if e["dir"] == dir_ and e["regimen"] == r]
        if not E and not Bs: continue
        ae = 100 * np.mean([e["acierto"] for e in E]) if E else np.nan
        ab = 100 * np.mean([e["acierto"] for e in Bs]) if Bs else np.nan
        desg.append([dir_, r, len(E), ae, len(Bs), ab, ae - ab if E and Bs else np.nan])

# ---------------------------------------------------------------- salidas
with open(OUT / "eventos_divergencias_regulares.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(eventos[0].keys())); w.writeheader()
    for e in eventos: w.writerow({k: (f"{v:.6f}" if isinstance(v, float) else v) for k, v in e.items()})
cab = ["direccion", "N_eventos", "aciertos", "acierto_pct", "wilson_lo", "wilson_hi", "N_base_emparejada",
       "base_emparejada_pct", "base_todas_velas_regimen_pct", "delta_pp", "ic95_lo", "ic95_hi", "p_bilateral"]
with open(OUT / "tabla_divergencias_7_4.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(cab)
    for r in filas_csv: w.writerow([x if isinstance(x, (str, int)) else f"{x:.6f}" for x in r])
    w.writerow([]); w.writerow(["direccion", "regimen", "N_eventos", "acierto_pct", "N_base", "base_pct", "delta_pp"])
    for r in desg: w.writerow([x if isinstance(x, (str, int)) else f"{x:.6f}" for x in r])

trz = mc.tabla_md(["Clase y dirección (motor del libro)", "Recuento"], [[k, v] for k, v in clases.items()] +
                  [["Total alcistas impreso (regular + oculta)", clases["regular-alcista"] + clases["oculta-alcista"]],
                   ["Total bajistas impreso (regular + oculta)", clases["regular-bajista"] + clases["oculta-bajista"]]])
md = f"""# 7.4 Divergencias — tabla exacta (generada por `experimentos/e03_divergencias_7_4.py`)

Banco simulado del libro: `bancoDeSeries(4, 200)` = {S} series × 200 velas, 15 regímenes. SHA-256 del export del generador: `{sha_banco}`.
Paridad con el verificador del libro: OK (326 / 325; {mc.fmt(par['aciertoalcista'],4)} %; {mc.fmt(par['aciertobajista'],4)} %; base {mc.fmt(par['basealcista'],4)} %).

## Trazabilidad frente a las cifras impresas (326 / 325)
{trz}
## Resultado causal: solo regulares, entrada en t_pivote + 3, 20 velas completas
{mc.tabla_md(["Dirección", "N", "Acierto", "IC 95 % Wilson", "N base emparejada", "Base emparejada (régimen)", "Base todas las velas (régimen)", "Δ (pp) vs emparejada", "IC 95 % Δ (bootstrap por series)", "p bilateral"], filas_md)}
Acierto alcista: cierre a 20 velas > cierre en t_obs. Acierto bajista: cierre a 20 velas < cierre en t_obs (empates = no acierto).
Bootstrap: B = {B}, semilla {SEMILLA}, remuestreo de series completas con reemplazo dentro de cada régimen; p = (n.º de réplicas con |Δ* − Δ̂| ≥ |Δ̂| + 1) / (B + 1).

## Desglose por régimen (estimaciones puntuales; muestras pequeñas)
{mc.tabla_md(["Dirección", "Régimen", "N eventos", "Acierto", "N base", "Base emparejada", "Δ (pp)"], [[a, b, c_, mc.fmt(d_,1), e_, mc.fmt(f_,1), mc.fmt(g_,1)] for a, b, c_, d_, e_, f_, g_ in desg])}
"""
(OUT / "tabla_divergencias_7_4.md").write_text(md)

mc.guardar_json(dict(sha_banco=sha_banco, clases=clases, paridad=par, resultados=resultados), OUT / "resultados_7_4.json")
print("e03 divergencias: ok")
