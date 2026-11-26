#!/usr/bin/env python3
"""Experimento e05 · 9.2 Fibonacci — los 28 tríos de swings n = 5 del S&P 500 en 2022, la base geométrica y la nula aleatoria.

Datos: índice S&P 500 (^GSPC), diario, descargado de Yahoo con `datos/descargar.py` (no se redistribuye). Los 30 swings
n = 5 de 2022 (5 velas a cada lado, estrictos) se calculan aquí y se comprueba que su huella coincide con la del libro
(MANIFEST_DATOS.json → gspc_1d.sha256_lista_swings_2022_n5).
Regla (9.1): siete niveles 0; 23,6; 38,2; 50; 61,8; 78,6; 100 %. Tolerancia ±1 punto porcentual del recorrido.
Trío A-B-C de swings consecutivos; retroceso r = (B − C) / (B − A) · 100.
  · excluido si A-B o B-C son del mismo tipo (dos máximos o dos mínimos seguidos): no hay recorrido que medir;
  · medible si alterna; supera el 100 % si r > 100 (el precio rebasa el origen A);
  · elegible si 0 ≤ r ≤ 100; «toque» = el punto de giro C cae a ±1 pp de un nivel (no cuenta haber cruzado niveles por el camino).
Base geométrica: cobertura exacta de los 7 intervalos recortados a [0, 100] → p; binomial P(X ≥ toques | n elegibles, p),
que supone r uniforme en [0, 100] e independencia entre tramos. Nula aleatoria: 100.000 juegos de 5 niveles interiores
uniformes + 0 y 100 (semilla 20261126), sobre los mismos retrocesos elegibles.
Salida publicada: sin precios (fechas, tipo, r y estado). La tabla con precios se escribe solo en la carpeta de datos local.
Uso: python3 experimentos/e05_fibonacci_9_2.py [--out DIR]
"""
import argparse, csv, hashlib, json, math, sys
from pathlib import Path
import numpy as np
AQUI = Path(__file__).resolve().parent; RAIZ = AQUI.parent
sys.path.insert(0, str(RAIZ / "mc"))
import mc_comun as mc

NIV = [0, 23.6, 38.2, 50, 61.8, 78.6, 100]; TOL = 1.0; NSW = 5
SEMILLA, NSIM = 20261126, 100_000
ap = argparse.ArgumentParser(); ap.add_argument("--out", default=str(RAIZ / "resultados" / "e05_fibonacci_9_2")); args = ap.parse_args()
OUT = Path(args.out); OUT.mkdir(parents=True, exist_ok=True)
MAN = json.loads((RAIZ / "MANIFEST_DATOS.json").read_text())["gspc_1d"]
CSV_ = mc.dir_datos() / MAN["archivo_csv"]
if not CSV_.exists(): raise SystemExit(f"Falta {CSV_}: ejecuta antes python3 datos/descargar.py")
if mc.sha256_archivo(CSV_) != MAN["sha256_csv"]: raise SystemExit("El CSV de ^GSPC no coincide con el manifiesto")
r_ = list(csv.DictReader(open(CSV_))); F = [x["fecha"] for x in r_]; Hh = [float(x["high"]) for x in r_]; Ll = [float(x["low"]) for x in r_]

def piv(v, n, alto):
    return [i for i in range(n, len(v) - n) if all((v[j] < v[i]) if alto else (v[j] > v[i]) for j in range(i - n, i + n + 1) if j != i)]
sw = sorted([(F[i], Hh[i], "H") for i in piv(Hh, NSW, True)] + [(F[i], Ll[i], "L") for i in piv(Ll, NSW, False)])
sw = [s for s in sw if s[0].startswith("2022")]
canon = "".join(f"{d}|{t}|{p:.2f}\n" for d, p, t in sw)
sha_sw = hashlib.sha256(canon.encode()).hexdigest()
if sha_sw != MAN["sha256_lista_swings_2022_n5"]: raise SystemExit("La lista de swings no coincide con la del libro")
sw = [(d, round(p, 2), t) for d, p, t in sw]   # precios a 2 decimales, como en el libro

filas = []
for k, (a, b, c) in enumerate(zip(sw, sw[1:], sw[2:]), start=1):
    alterno = a[2] != b[2] and b[2] != c[2]
    r = (b[1] - c[1]) / (b[1] - a[1]) * 100
    if not alterno: motivo = "excluido: dos extremos del mismo tipo seguidos (" + ("A-B" if a[2] == b[2] else "B-C") + ")"
    elif r > 100: motivo = "medible, no elegible: supera el 100 % (rebasa el origen A)"
    elif r < 0: motivo = "medible, no elegible: r < 0"
    else: motivo = "elegible"
    toques = [n for n in NIV if alterno and 0 <= r <= 100 and abs(r - n) <= TOL]
    dist = min(abs(r - n) for n in NIV) if alterno and 0 <= r <= 100 else None
    filas.append(dict(trio=k, A_fecha=a[0], A_tipo=a[2], B_fecha=b[0], B_tipo=b[2], C_fecha=c[0], C_tipo=c[2],
                      A_precio=a[1], B_precio=b[1], C_precio=c[1], retroceso_pct=(r if alterno else None),
                      medible=int(alterno), supera_100=int(alterno and r > 100), elegible=int(alterno and 0 <= r <= 100),
                      dist_nivel_mas_cercano_pp=dist, toque=int(bool(toques)), nivel_tocado=(toques[0] if toques else ""), estado=motivo))
med = [f for f in filas if f["medible"]]; eleg = [f for f in filas if f["elegible"]]
n_trios, n_med, n_eleg = len(filas), len(med), len(eleg); n_sup = sum(f["supera_100"] for f in filas); obs = sum(f["toque"] for f in filas)

def cobertura(niveles, tol):
    iv = sorted((max(0.0, n - tol), min(100.0, n + tol)) for n in niveles)
    tot, (s0, e0) = 0.0, iv[0]
    for s1, e1 in iv[1:]:
        if s1 <= e0: e0 = max(e0, e1)
        else: tot += e0 - s0; s0, e0 = s1, e1
    return (tot + e0 - s0) / 100.0
p7 = cobertura(NIV, TOL)
def binom_sf(k, n, p): return sum(math.comb(n, j) * p**j * (1 - p)**(n - j) for j in range(k, n + 1))
esperado = n_eleg * p7; p_binom = binom_sf(obs, n_eleg, p7)
rng = np.random.default_rng(SEMILLA); rs = np.array([f["retroceso_pct"] for f in eleg])
inter = rng.uniform(0, 100, size=(NSIM, 5)); niv = np.concatenate([np.zeros((NSIM, 1)), inter, np.full((NSIM, 1), 100.0)], 1)
tocan = (np.abs(rs[None, :, None] - niv[:, None, :]) <= TOL).any(2).sum(1)
p_aleat = float(np.mean(tocan >= obs)); media_aleat = float(tocan.mean())

# ---- salida publicada (sin precios)
pub = ["trio", "A_fecha", "A_tipo", "B_fecha", "B_tipo", "C_fecha", "C_tipo", "retroceso_pct", "medible", "supera_100", "elegible",
       "dist_nivel_mas_cercano_pp", "toque", "nivel_tocado", "estado"]
fx = lambda v: (f"{v:.4f}" if isinstance(v, float) else ("" if v is None else v))
with open(OUT / "tabla_fibonacci_28_trios.csv", "w", newline="") as f:
    w = csv.writer(f, lineterminator="\n"); w.writerow(pub)
    for r in filas: w.writerow([fx(r[k]) for k in pub])
md_f = [[r["trio"], f"{r['A_fecha']} {r['A_tipo']}", f"{r['B_fecha']} {r['B_tipo']}", f"{r['C_fecha']} {r['C_tipo']}",
         mc.fmt(r["retroceso_pct"]), "sí" if r["medible"] else "no", "sí" if r["supera_100"] else "no", "sí" if r["elegible"] else "no",
         mc.fmt(r["dist_nivel_mas_cercano_pp"]), (f"sí ({mc.fmt(r['nivel_tocado'], 1)} %)" if r["toque"] else "no"), r["estado"]] for r in filas]
md = f"""# 9.2 Fibonacci — los {n_trios} tríos de 2022 (generado por `experimentos/e05_fibonacci_9_2.py`)

Swings n = {NSW} del S&P 500 (^GSPC, Yahoo) en 2022: {len(sw)} extremos. Huella de la lista (igual a la del libro): `{sha_sw}`.
Los precios de anclaje no se publican (licencia del proveedor). Se regeneran en local con `datos/descargar.py`.

**Recuento:** {n_trios} tríos; {n_trios - n_med} excluidos → **{n_med} medibles**; **{n_sup} superan el 100 %**; **{n_eleg} elegibles**; **toques: {obs}**.

{mc.tabla_md(["Trío", "A", "B", "C", "r (%)", "Medible", "> 100 %", "Elegible", "Distancia al nivel más cercano (pp)", "Toque (±1 pp)", "Estado"], md_f)}
## Base geométrica y contraste
- Cobertura de 7 niveles a ±1 pp, recortada a [0, 100]: **{mc.fmt(100 * p7, 2)} %**.
- Toques esperados sobre {n_eleg} elegibles: **{mc.fmt(esperado, 2)}**; observados **{obs}**; binomial P(X ≥ {obs} | n = {n_eleg}, p = {mc.fmt(p7, 2)}) = **{mc.fmt(p_binom, 4)}** (supone r uniforme e independencia entre tramos consecutivos).
- Niveles aleatorios ({NSIM} sorteos, semilla {SEMILLA}): media **{mc.fmt(media_aleat, 3)}** toques; P(toques ≥ {obs}) = **{mc.fmt(p_aleat, 4)}**.
- El resultado es condicional: se cuenta sobre los {n_eleg} tramos que no rebasan su origen.
"""
(OUT / "tabla_fibonacci_28_trios.md").write_text(md)
mc.guardar_json(dict(sha_lista_swings=sha_sw, n_swings=len(sw), n_trios=n_trios, n_excluidos=n_trios - n_med, n_medibles=n_med,
                     n_supera_100=n_sup, n_elegibles=n_eleg, toques=obs, cobertura_7niv=p7, esperado=esperado, p_binomial=p_binom,
                     media_toques_aleatorios=media_aleat, p_niveles_aleatorios=p_aleat, NSIM=NSIM, semilla=SEMILLA,
                     excluidos=[dict(trio=f["trio"], motivo=f["estado"]) for f in filas if not f["medible"]]), OUT / "resultados_9_2.json")
# ---- tabla completa con precios: solo en la carpeta de datos local (no se publica)
with open(mc.dir_datos() / "LOCAL_tabla_fibonacci_con_precios.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(filas[0].keys()), lineterminator="\n"); w.writeheader()
    for r in filas: w.writerow({k: fx(v) for k, v in r.items()})
print("e05 Fibonacci: ok")
