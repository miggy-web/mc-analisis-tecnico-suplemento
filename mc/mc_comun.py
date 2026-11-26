"""Biblioteca común del suplemento reproducible de MC Análisis Técnico, v1.0.0 (Miggy Labs).

Porta a Python, línea a línea, las funciones del motor @miggy/ta que usa el libro
(rma de Wilder, RSI, rango verdadero, ATR, pivotes y divergencias). La paridad con el
motor se comprueba en cada ejecución reproduciendo las cifras impresas del verificador.
Todo es determinista: el generador es el del libro (vía node) y los bootstraps usan
semillas fijas declaradas.
"""
from __future__ import annotations
import hashlib, json, math, os, subprocess
from pathlib import Path
import numpy as np

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
MOTOR = RAIZ / "motor"

# ---------------------------------------------------------------- generador del libro
def exportar_banco(cfg: dict) -> tuple[list[dict], str]:
    """Llama al generador del libro (motor @miggy/ta incluido en motor/) y devuelve las series y el SHA-256 del JSON."""
    r = subprocess.run(["node", "--experimental-strip-types", "--no-warnings", "exportar_banco.mts", json.dumps(cfg)],
                       cwd=MOTOR, capture_output=True, text=True, check=True)
    sha = hashlib.sha256(r.stdout.encode()).hexdigest()
    d = json.loads(r.stdout)
    for s in d["series"]:
        for k in "ohlcv":
            s[k] = np.asarray(s[k], dtype=float)
    return d["series"], sha

def sha256_archivo(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()

# ---------------------------------------------------------------- indicadores (port exacto)
def rma(vals, n):
    vals = np.asarray(vals, dtype=float)
    out = np.full(len(vals), np.nan)
    if len(vals) < n:
        return out
    acc = 0.0
    for i in range(n):
        acc += vals[i]
    prev = acc / n
    out[n - 1] = prev
    for i in range(n, len(vals)):
        prev = (prev * (n - 1) + vals[i]) / n
        out[i] = prev
    return out

def rsi(c, n=14):
    c = np.asarray(c, dtype=float)
    out = np.full(len(c), np.nan)
    if len(c) <= n:
        return out
    d = np.diff(c)
    g = rma(np.maximum(0.0, d), n)
    p = rma(np.maximum(0.0, -d), n)
    for i in range(len(g)):
        if np.isnan(g[i]) or np.isnan(p[i]):
            continue
        out[i + 1] = 100.0 if p[i] == 0 else 100 - 100 / (1 + g[i] / p[i])
    return out

def true_range(h, l, c):
    tr = np.empty(len(c))
    tr[0] = h[0] - l[0]
    for i in range(1, len(c)):
        tr[i] = max(h[i] - l[i], abs(h[i] - c[i - 1]), abs(l[i] - c[i - 1]))
    return tr

def atr(h, l, c, n=14):
    return rma(true_range(h, l, c), n)

def pivotes(vals, izq=3, der=3, tipo="alto"):
    out = []
    for i in range(izq, len(vals) - der):
        v = vals[i]; ok = True
        for j in range(i - izq, i + der + 1):
            if j == i:
                continue
            w = vals[j]
            if (w >= v) if tipo == "alto" else (w <= v):
                ok = False; break
        if ok:
            out.append(i)
    return out

def divergencias(h, l, osc, izq=3, der=3):
    """Mismo algoritmo que momentum.ts: pares de pivotes consecutivos; devuelve regulares Y ocultas con su clase."""
    out = []
    altos = pivotes(h, izq, der, "alto")
    for a, b in zip(altos, altos[1:]):
        oa, ob = osc[a], osc[b]
        if np.isnan(oa) or np.isnan(ob):
            continue
        if h[b] > h[a] and ob < oa: out.append(dict(clase="regular", dir="bajista", desde=a, hasta=b))
        if h[b] < h[a] and ob > oa: out.append(dict(clase="oculta", dir="bajista", desde=a, hasta=b))
    bajos = pivotes(l, izq, der, "bajo")
    for a, b in zip(bajos, bajos[1:]):
        oa, ob = osc[a], osc[b]
        if np.isnan(oa) or np.isnan(ob):
            continue
        if l[b] < l[a] and ob > oa: out.append(dict(clase="regular", dir="alcista", desde=a, hasta=b))
        if l[b] > l[a] and ob < oa: out.append(dict(clase="oculta", dir="alcista", desde=a, hasta=b))
    out.sort(key=lambda x: x["hasta"])  # orden estable como Array.sort de V8
    return out

def rank_causal(x, L):
    """rank_t = fracción de los L valores x[t-L+1..t] (incluido t) que son <= x[t]. NaN si falta historia."""
    out = np.full(len(x), np.nan)
    for t in range(len(x)):
        if t - L + 1 < 0:
            continue
        w = x[t - L + 1:t + 1]
        if np.isnan(w).any():
            continue
        out[t] = np.mean(w <= x[t])
    return out

# ---------------------------------------------------------------- estadística
def wilson(k, n, z=1.959963984540054):
    if n == 0:
        return (float("nan"), float("nan"))
    p = k / n; d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    hw = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (100 * (c - hw), 100 * (c + hw))

def p_bootstrap_centrado(est, boots):
    """p bilateral: proporción de |Δ* − Δ̂| >= |Δ̂| (bootstrap desplazado a la nula)."""
    boots = np.asarray(boots); boots = boots[~np.isnan(boots)]
    if len(boots) == 0 or np.isnan(est):
        return float("nan")
    return float((np.sum(np.abs(boots - est) >= abs(est)) + 1) / (len(boots) + 1))

def ic_percentil(boots, a=0.05):
    boots = np.asarray(boots); boots = boots[~np.isnan(boots)]
    return (float(np.quantile(boots, a / 2)), float(np.quantile(boots, 1 - a / 2)))

def fmt(x, d=2):
    if x is None or (isinstance(x, float) and math.isnan(x)):
        return "—"
    return f"{x:.{d}f}".replace(".", ",")

def tabla_md(cab, filas):
    s = "| " + " | ".join(cab) + " |\n|" + "|".join(["---"] * len(cab)) + "|\n"
    for f in filas:
        s += "| " + " | ".join(str(x) for x in f) + " |\n"
    return s

# ---------------------------------------------------------------- rutas del paquete
def dir_datos() -> Path:
    """Carpeta de las series descargadas (fuera del paquete publicado): MC_DATOS o .datos_locales/."""
    return Path(os.environ.get("MC_DATOS") or (RAIZ / ".datos_locales"))

def referencia_libro() -> dict:
    """Cifras que imprime el verificador del libro (salida del motor), para comprobar la paridad."""
    return json.loads((RAIZ / "referencia" / "cifras_verificador_libro.json").read_text())

def guardar_json(obj, p: Path):
    Path(p).write_text(json.dumps(obj, indent=1, ensure_ascii=False, default=float, sort_keys=False) + "\n")
