"""Utilidades de las réplicas en serie real (SPY diario, Yahoo): carga con ajuste por dividendos, régimen causal y bootstrap por años."""
import csv, json, sys
from pathlib import Path
import numpy as np
AQUI = Path(__file__).resolve().parent; RAIZ = AQUI.parent
sys.path.insert(0, str(RAIZ / "mc"))
import mc_comun as mc

MAN = json.loads((RAIZ / "MANIFEST_DATOS.json").read_text())["spy_1d"]
INICIO, FIN = "2005-01-01", "2025-12-31"
COSTE_BPS_IDA_VUELTA = 5.0        # escenario base: 2,5 pb por lado (horquilla + deslizamiento; comisión 0)
COSTE_BPS_ADVERSO = 10.0          # escenario adverso
B, SEMILLA = 10_000, 20261126

def cargar():
    """Devuelve fechas y O, H, L, C retroajustados por dividendos (anclados a 2025-12-31) y el SHA-256 del CSV."""
    p = mc.dir_datos() / MAN["archivo_csv"]
    if not p.exists(): raise SystemExit(f"Falta {p}: ejecuta antes python3 datos/descargar.py")
    sha = mc.sha256_archivo(p)
    if sha != MAN["sha256_csv"]: raise SystemExit(f"SHA-256 del CSV ({sha}) no coincide con el manifiesto ({MAN['sha256_csv']})")
    rows = list(csv.DictReader(open(p)))
    f = np.array([r["fecha"] for r in rows]); o, h, l, c, dv = (np.array([float(r[k]) for r in rows]) for k in ("open", "high", "low", "close", "dividendo"))
    fac = np.ones(len(c))
    for j in np.where(dv > 0)[0]:
        if j == 0: continue
        fac[:j] *= 1 - dv[j] / c[j - 1]
    return f, o * fac, h * fac, l * fac, c * fac, sha

def sma(x, n):
    out = np.full(len(x), np.nan); cs = np.cumsum(np.insert(x, 0, 0.0))
    out[n - 1:] = (cs[n:] - cs[:-n]) / n
    return out

def regimen_causal(h, l, c):
    """Tendencia: cierre > SMA200 ('alcista') o no ('bajista'). Volatilidad: ATR% > mediana de sus 252 velas previas ('alta') o no."""
    s200 = sma(c, 200); a = mc.atr(h, l, c, 14); ap = 100 * a / c
    med = np.full(len(c), np.nan)
    for t in range(252, len(c)):
        w = ap[t - 252:t]
        if not np.isnan(w).any(): med[t] = np.median(w)
    tend = np.where(np.isnan(s200), None, np.where(c > s200, "alcista", "bajista"))
    vol = np.where(np.isnan(med), None, np.where(ap > med, "vol_alta", "vol_baja"))
    return tend, vol, a, ap

def indices_bootstrap_anios(anios_unicos, B=B, semilla=SEMILLA):
    rng = np.random.default_rng(semilla)
    return rng.integers(0, len(anios_unicos), size=(B, len(anios_unicos)))
