#!/usr/bin/env python3
"""Experimento e04 · 8.3 Compresión del ATR% (figura 8.3.1) — banco largo de 96.000 velas.

Definiciones (todas causales: lo calculado en t usa solo datos <= t; los resultados usan (t, t+H]):
  ATR%_t   = 100 · ATR14_t / Close_t                          (ATR de Wilder del motor del libro)
  rank_t   = fracción de ATR%_{t-L+1..t} que es <= ATR%_t, L = 100 velas, por serie
  Evento de compresión: rank_t <= 0,10, primera vela tras >= H velas sin evento en la serie (enfriamiento = H = 20)
  Control emparejado: misma serie (mismo régimen), 0,40 <= rank_t <= 0,60, fuera de la ventana (t_e, t_e+H) de
                      cualquier evento previo, sin solape entre controles (enfriamiento H)
  E_rel     = ATR14_{t+H} / ATR14_t           (expansión relativa, medida principal)
  E_rel_TR  = media TR(t+1..t+H) / media TR(t-H+1..t)
  Recorrido absoluto = 100 · |Close_{t+H} / Close_t − 1|;  Rango futuro = 100 · (máx H − mín L en (t, t+H]) / Close_t
  Signo: % sube (Close_{t+H} > Close_t) y % baja (<)
Banco: generador del libro, 15 regímenes × 8 semillas × 800 velas (semillas 7000 + 100·i_régimen + k).
Contraste: Δ = media(eventos) − media(controles) ponderada por la mezcla de regímenes de los eventos;
           IC 95 % por bootstrap de series estratificado por régimen, B = 10 000, semilla 20261126; p bilateral centrado.
Uso: python3 experimentos/e04_compresion_8_3.py [--out DIR]
"""
import argparse, csv, json, sys
from pathlib import Path
import numpy as np

AQUI = Path(__file__).resolve().parent; RAIZ = AQUI.parent
sys.path.insert(0, str(RAIZ / "mc"))
import mc_comun as mc

H, L, UMBRAL, CTRL = 20, 100, 0.10, (0.40, 0.60)
B, SEMILLA = 10_000, 20261126
CFG_LARGO = {"tipo": "largo", "seeds": 8, "n": 800, "seedBase": 7000}
ap = argparse.ArgumentParser(); ap.add_argument("--out", default=str(RAIZ / "resultados" / "e04_compresion_8_3")); args = ap.parse_args()
OUT = Path(args.out); OUT.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------- 1) paridad con la fig. 8.3.1 impresa
libro, sha_libro = mc.exportar_banco({"tipo": "libro", "seeds": 4, "n": 200})
ref = mc.referencia_libro()["vol"]
filas = []
for s in libro:
    a = mc.atr(s["h"], s["l"], s["c"], 14); C = s["c"]
    for i in range(25, len(C) - H):
        if np.isnan(a[i]): continue
        ret = (C[i + H] - C[i]) / C[i] * 100
        filas.append((a[i], ret, abs(ret)))
filas.sort(key=lambda x: x[0])  # sort estable, igual que Array.sort
q = len(filas) // 4; bajo, alto = filas[:q], filas[3 * q:]
par = dict(n=len(filas), q1magnitud=float(np.mean([x[2] for x in bajo])), q4magnitud=float(np.mean([x[2] for x in alto])),
           q1subenpct=100 * float(np.mean([x[1] > 0 for x in bajo])), q4subenpct=100 * float(np.mean([x[1] > 0 for x in alto])))
for k in par:
    assert abs(par[k] - ref[k]) < 1e-9, f"paridad rota en {k}: {par[k]} vs {ref[k]}"

# ---------------------------------------------------------------- 2) banco largo y eventos
series, sha_largo = mc.exportar_banco(CFG_LARGO)
regs = sorted({s["regime"] for s in series}); S = len(series)
reg_de = np.array([regs.index(s["regime"]) for s in series])
MET = ["E_rel", "E_rel_TR", "recorrido_abs_pct", "rango_futuro_pct", "sube", "baja"]
registros = []
for si, s in enumerate(series):
    Hh, Ll, C = s["h"], s["l"], s["c"]; n = len(C)
    a = mc.atr(Hh, Ll, C, 14); tr = mc.true_range(Hh, Ll, C)
    ap_ = 100 * a / C; rk = mc.rank_causal(ap_, L)
    def medir(t):
        return dict(E_rel=a[t + H] / a[t], E_rel_TR=tr[t + 1:t + H + 1].mean() / tr[t - H + 1:t + 1].mean(),
                    recorrido_abs_pct=100 * abs(C[t + H] / C[t] - 1),
                    rango_futuro_pct=100 * (Hh[t + 1:t + H + 1].max() - Ll[t + 1:t + H + 1].min()) / C[t],
                    sube=float(C[t + H] > C[t]), baja=float(C[t + H] < C[t]))
    ev = []; ult = -10**9
    for t in range(n - H):
        if np.isnan(rk[t]) or t - H + 1 < 0: continue
        if rk[t] <= UMBRAL and t - ult >= H:
            ev.append(t); ult = t
    evset = np.array(ev)
    ultc = -10**9
    ctrls = []
    for t in range(n - H):
        if np.isnan(rk[t]) or t - H + 1 < 0: continue
        if not (CTRL[0] <= rk[t] <= CTRL[1]): continue
        prev = evset[evset <= t]
        if len(prev) and t - prev.max() < H: continue
        if t - ultc < H: continue
        ctrls.append(t); ultc = t
    for grupo, ts in (("compresion", ev), ("control", ctrls)):
        for t in ts:
            r = dict(grupo=grupo, serie=si, regimen=s["regime"], seed=s["seed"], t=t, atr_pct=ap_[t], rank=rk[t],
                     atr_pct_sube_1=float(ap_[t] > ap_[t - 1]), atr_pct_sube_5=float(ap_[t] > ap_[t - 5]))
            r.update(medir(t)); registros.append(r)

def sumas(grupo):
    n = np.zeros(S); sm = np.zeros((S, len(MET)))
    for r in registros:
        if r["grupo"] == grupo:
            n[r["serie"]] += 1; sm[r["serie"]] += [r[m] for m in MET]
    return n, sm
ne, se = sumas("compresion"); nc, sc = sumas("control")
grupos = [np.where(reg_de == r)[0] for r in range(len(regs))]

def estimar(idx_por_reg):
    """idx_por_reg: lista (por régimen) de arrays de índices de series. Devuelve medias eventos, control ponderado, Δ."""
    NE = sum(ne[ix].sum() for ix in idx_por_reg)
    me = sum(se[ix].sum(0) for ix in idx_por_reg) / NE
    mc_ = np.zeros(len(MET))
    for ix in idx_por_reg:
        ner = ne[ix].sum()
        if ner == 0: continue
        ncr = nc[ix].sum()
        if ncr == 0: return me, np.full(len(MET), np.nan), np.full(len(MET), np.nan)
        mc_ += (ner / NE) * sc[ix].sum(0) / ncr
    return me, mc_, me - mc_

me, mctrl, d = estimar(grupos)
rng = np.random.default_rng(SEMILLA)
boots = np.empty((B, len(MET)))
for b in range(B):
    boots[b] = estimar([rng.choice(g, size=len(g), replace=True) for g in grupos])[2]

ev_rows = [r for r in registros if r["grupo"] == "compresion"]; ct_rows = [r for r in registros if r["grupo"] == "control"]
med = {m: (float(np.median([r[m] for r in ev_rows])), float(np.median([r[m] for r in ct_rows]))) for m in MET[:4]}
res = {}
for j, m in enumerate(MET):
    lo, hi = mc.ic_percentil(boots[:, j]); p = mc.p_bootstrap_centrado(d[j], boots[:, j])
    res[m] = dict(media_eventos=float(me[j]), media_control_ponderada=float(mctrl[j]), delta=float(d[j]), ic95=(lo, hi), p=p)
    if m in med: res[m]["mediana_eventos"], res[m]["mediana_control"] = med[m]
for m in ("sube", "baja"):
    for k in ("media_eventos", "media_control_ponderada", "delta"):
        res[m][k] *= 100
    res[m]["ic95"] = (res[m]["ic95"][0] * 100, res[m]["ic95"][1] * 100)
NEv, NCt = len(ev_rows), len(ct_rows)
ev_por_reg = {r: sum(1 for x in ev_rows if x["regimen"] == r) for r in regs}
ct_por_reg = {r: sum(1 for x in ct_rows if x["regimen"] == r) for r in regs}

# ---------------------------------------------------------------- salidas
with open(OUT / "eventos_y_controles_compresion_8_3.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(registros[0].keys())); w.writeheader()
    for r in registros: w.writerow({k: (f"{v:.6f}" if isinstance(v, float) else v) for k, v in r.items()})
nombres = {"E_rel": "Expansión relativa E_rel = ATR14[t+20]/ATR14[t]", "E_rel_TR": "Expansión relativa E_rel_TR = TR medio (t,t+20] / TR medio [t−19,t]",
           "recorrido_abs_pct": "Desplazamiento absoluto del cierre a 20 velas |C[t+20]/C[t]−1| (%) («recorrido absoluto» en el libro)", "rango_futuro_pct": "Rango futuro (máx−mín)/C[t] en (t,t+20] (%)",
           "sube": "Sube a 20 velas (%)", "baja": "Baja a 20 velas (%)"}
with open(OUT / "tabla_compresion_atr_8_3.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["medida", "N_eventos", "N_controles", "media_eventos", "media_control_ponderada", "delta", "ic95_lo", "ic95_hi", "p_bilateral", "mediana_eventos", "mediana_control"])
    for m in MET:
        r = res[m]; w.writerow([m, NEv, NCt] + [f"{x:.6f}" for x in (r["media_eventos"], r["media_control_ponderada"], r["delta"], r["ic95"][0], r["ic95"][1], r["p"])] +
                               [f"{r[k]:.6f}" if k in r else "" for k in ("mediana_eventos", "mediana_control")])
dd = 3
filas_md = [[nombres[m], mc.fmt(res[m]["media_eventos"], dd), mc.fmt(res[m]["media_control_ponderada"], dd), mc.fmt(res[m]["delta"], dd),
             f"[{mc.fmt(res[m]['ic95'][0], dd)}; {mc.fmt(res[m]['ic95'][1], dd)}]", mc.fmt(res[m]["p"], 4),
             (f"{mc.fmt(res[m]['mediana_eventos'], dd)} / {mc.fmt(res[m]['mediana_control'], dd)}" if "mediana_eventos" in res[m] else "—")] for m in MET]
md = f"""# 8.3 Compresión / ATR — tabla exacta (generada por `experimentos/e04_compresion_8_3.py`)

**Paridad con el verificador del libro (cuartiles de ATR en el banco general):** OK. N = {par['n']}; recorrido medio Q1 = {mc.fmt(par['q1magnitud'],4)} %, Q4 = {mc.fmt(par['q4magnitud'],4)} %; sube Q1 = {mc.fmt(par['q1subenpct'],4)} %, Q4 = {mc.fmt(par['q4subenpct'],4)} %. SHA-256 del banco del libro: `{sha_libro}`.

**Banco del experimento:** generador del libro, {S} series = 15 regímenes × 8 semillas × 800 velas (semillas 7000 + 100·i + k). SHA-256 del export: `{sha_largo}`.
**Reglas:** ATR% = 100·ATR14/cierre; rank causal en L = {L} velas; compresión = rank ≤ {mc.fmt(UMBRAL,2)}; control = rank en [{mc.fmt(CTRL[0],2)}; {mc.fmt(CTRL[1],2)}]; H = {H}; enfriamiento = H; sin solapes.
**Muestra:** {NEv} eventos de compresión y {NCt} controles emparejados.

{mc.tabla_md(["Medida", "Media compresión", "Media control (ponderada por régimen)", "Δ", "IC 95 % Δ (bootstrap por series)", "p bilateral", "Mediana compresión / control"], filas_md)}
Bootstrap: B = {B}, semilla {SEMILLA}, remuestreo de series completas con reemplazo dentro de cada régimen.

## Eventos y controles por régimen
{mc.tabla_md(["Régimen", "Eventos", "Controles"], [[r, ev_por_reg[r], ct_por_reg[r]] for r in regs])}
"""
(OUT / "tabla_compresion_atr_8_3.md").write_text(md)

# diagnóstico (AT-09): ¿cuántas compresiones tienen el ATR% subiendo en ese momento?
diag = {g: dict(N=len(rows), atr_pct_sube_vs_t_1_pct=100 * float(np.mean([r["atr_pct_sube_1"] for r in rows])),
                atr_pct_sube_vs_t_5_pct=100 * float(np.mean([r["atr_pct_sube_5"] for r in rows])))
        for g, rows in (("compresion", ev_rows), ("control", ct_rows))}
(OUT / "diagnostico_estado_vs_contraccion_8_3.md").write_text(
    "# 8.3 · ¿Estado de baja volatilidad o contracción previa? (generado por `experimentos/e04_compresion_8_3.py`)\n\n"
    + mc.tabla_md(["Grupo", "N", "ATR% en t mayor que en t−1 (%)", "ATR% en t mayor que en t−5 (%)"],
                  [[g, d["N"], mc.fmt(d["atr_pct_sube_vs_t_1_pct"], 2), mc.fmt(d["atr_pct_sube_vs_t_5_pct"], 2)] for g, d in diag.items()])
    + "\nLa regla de compresión clasifica un NIVEL bajo de ATR% respecto de sus últimas 100 velas; no exige que el ATR% venga bajando.\n")
mc.guardar_json(dict(paridad=par, sha_libro=sha_libro, sha_largo=sha_largo, N_eventos=NEv, N_controles=NCt, eventos_por_regimen=ev_por_reg,
               controles_por_regimen=ct_por_reg, resultados=res, diagnostico_atr_pct_subiendo=diag), OUT / "resultados_8_3.json")
print("e04 compresión: ok")
