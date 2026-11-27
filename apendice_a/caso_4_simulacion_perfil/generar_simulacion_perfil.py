#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pieza visual nueva #4 · «Perfil con cifras» · SIMULACIÓN DIDÁCTICA CONTROLADA
MC Análisis Técnico (edición RF-452c, 452 págs.) · Miggy Trading · ronda final 27-11-2026

Las 24 barras de este archivo son SINTÉTICAS: se escriben a mano, sobre la malla
de ticks de 0,25 de un MES ilustrativo, para demostrar el cálculo completo de
POC, VAH y VAL. NO son datos de mercado, no proceden de ningún proveedor y no
tienen fecha real.

Cálculo del perfil: algoritmo 11.4 de MC, copia literal de la función _perfil()
del código que dibuja las figuras del libro
(40 niveles iguales sin redondear al tick, reparto uniforme del volumen de cada
barra entre los niveles que toca, fix `a = min(niv - 1, ...)`, POC con empate
al más bajo, área de valor de uno en uno con empate arriba, >= 70 %).
Se comprueba además con una réplica exacta en fracciones (sin coma flotante).

Ejecutar con:  PYTHONDONTWRITEBYTECODE=1 python3 generar_simulacion_perfil.py
"""
import sys
sys.dont_write_bytecode = True
import csv, json, hashlib, os
from decimal import Decimal as D, ROUND_HALF_UP, ROUND_FLOOR, ROUND_CEILING, getcontext
from fractions import Fraction as F

getcontext().prec = 50
AQUI = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------------------
# 0 · Contrato ilustrativo y convenciones (las del caso 4 del apéndice A)
# ---------------------------------------------------------------------------
TICK = D("0.25")            # puntos
USD_PUNTO = D("5")          # MES: 5 USD por punto
USD_TICK = TICK * USD_PUNTO # 1,25 USD
COSTE_TICKS = 2             # coste declarado por operación completa (deslizamiento y comisión)
PRESUPUESTO = D("1000")     # presupuesto máximo de riesgo por operación (1 % de 100.000)
CUENTA = D("100000")
NIV = 40
PCT = 0.7
ATR_N = 14

# ---------------------------------------------------------------------------
# 1 · Barras sintéticas (09:30-11:25 ET; la 23 es la última cerrada al corte de 11:30)
#     (apertura, máximo, mínimo, cierre, volumen en contratos)
# ---------------------------------------------------------------------------
BARRAS = [
    ("5004.00", "5012.00", "5000.00", "5010.50", 6000),   # 09:30
    ("5010.50", "5040.00", "5009.00", "5013.00", 2500),   # 09:35 máximo de sesión (impulso con poco volumen)
    ("5013.00", "5016.00", "5002.25", "5003.50", 5000),   # 09:40
    ("5003.50", "5005.00", "4980.00", "4993.25", 7000),   # 09:45 mínimo de sesión
    ("4993.25", "5000.50", "4991.50", "4999.00", 6500),   # 09:50
    ("4999.00", "5003.25", "4995.75", "4997.25", 6000),   # 09:55
    ("4997.25", "5001.50", "4994.00", "5000.75", 5600),   # 10:00
    ("5000.75", "5003.75", "4997.50", "4998.50", 5200),   # 10:05
    ("4998.50", "5001.00", "4995.25", "4999.75", 5000),   # 10:10
    ("4999.75", "5002.50", "4997.00", "5001.25", 4800),   # 10:15
    ("5001.25", "5003.00", "4998.25", "4998.75", 4600),   # 10:20
    ("4998.75", "5000.25", "4995.50", "4999.50", 4400),   # 10:25 fin del balance inicial
    ("4999.50", "5002.25", "4997.75", "5001.75", 4200),   # 10:30
    ("5001.75", "5003.00", "4998.50", "4999.00", 4000),   # 10:35
    ("4999.00", "5001.50", "4996.75", "5000.50", 3800),   # 10:40
    ("5000.50", "5002.75", "4998.75", "5002.25", 3600),   # 10:45
    ("5002.25", "5003.50", "4999.75", "5000.25", 3500),   # 10:50
    ("5000.25", "5002.00", "4998.50", "5001.50", 3400),   # 10:55
    ("5001.50", "5005.25", "5000.75", "5005.00", 3200),   # 11:00
    ("5005.00", "5008.75", "5004.25", "5008.25", 3100),   # 11:05
    ("5008.25", "5011.00", "5007.00", "5010.50", 3000),   # 11:10
    ("5010.50", "5013.25", "5009.25", "5012.00", 2900),   # 11:15
    ("5012.00", "5014.50", "5010.75", "5013.00", 2800),   # 11:20
    ("5013.00", "5015.00", "5011.75", "5014.25", 2700),   # 11:25 última barra cerrada
]
BARRAS = [(D(o), D(h), D(l), D(c), v) for o, h, l, c, v in BARRAS]


def hora(k):
    m = 9 * 60 + 30 + 5 * k
    return f"{m // 60:02d}:{m % 60:02d}"


def es(x, dec=2):
    """Número en formato español: 5.009,75"""
    q = D(x).quantize(D(1).scaleb(-dec), rounding=ROUND_HALF_UP)
    s = f"{q:,.{dec}f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


# ---------------------------------------------------------------------------
# 2 · Validaciones de la serie sintética
# ---------------------------------------------------------------------------
for k, (o, h, l, c, v) in enumerate(BARRAS):
    for x in (o, h, l, c):
        assert (x / TICK) == (x / TICK).to_integral_value(), (k, x)
    assert l <= min(o, c) and h >= max(o, c), k
    assert v > 0
    if k:
        assert o == BARRAS[k - 1][3], ("apertura = cierre anterior", k)

# ---------------------------------------------------------------------------
# 3 · Algoritmo 11.4 de MC · COPIA LITERAL de _perfil() (código de las figuras)
# ---------------------------------------------------------------------------
def _perfil(ohlc, vol, niv=40, pct=.7):
    lo = min(x[2] for x in ohlc); hi = max(x[1] for x in ohlc)
    paso = (hi - lo) / niv; bins = [0.0] * niv
    for (o, h, l, c), v in zip(ohlc, vol):
        a = min(niv - 1, int((l - lo) / paso)); z = min(niv - 1, int((h - lo) / paso))
        for k in range(a, z + 1):
            bins[k] += v / (z - a + 1)
    poc = max(range(niv), key=lambda k: bins[k])
    tot = sum(bins); area = {poc}; acc = bins[poc]; dn, up = poc - 1, poc + 1
    while acc < pct * tot:
        bd = bins[dn] if dn >= 0 else -1; bu = bins[up] if up < niv else -1
        if bu >= bd: area.add(up); acc += bu; up += 1
        else: area.add(dn); acc += bd; dn -= 1
    return lo, paso, bins, poc, area, acc / tot


# Réplica exacta en fracciones (misma lógica, sin coma flotante) para auditar empates
def _perfil_exacto(ohlc, vol, niv=40, pct=F(7, 10)):
    lo = min(F(str(x[2])) for x in ohlc); hi = max(F(str(x[1])) for x in ohlc)
    paso = (hi - lo) / niv; bins = [F(0)] * niv
    for (o, h, l, c), v in zip(ohlc, vol):
        l, h = F(str(l)), F(str(h))
        a = min(niv - 1, int((l - lo) / paso)); z = min(niv - 1, int((h - lo) / paso))
        for k in range(a, z + 1):
            bins[k] += F(v) / (z - a + 1)
    mx = max(bins); empatados_poc = [k for k in range(niv) if bins[k] == mx]
    poc = empatados_poc[0]                     # empate: el más bajo
    tot = sum(bins); area = {poc}; acc = bins[poc]; dn, up = poc - 1, poc + 1
    pasos = []; empates_area = 0
    while acc < pct * tot:
        bd = bins[dn] if dn >= 0 else F(-1); bu = bins[up] if up < niv else F(-1)
        if bu == bd and bu >= 0: empates_area += 1
        if bu >= bd:
            area.add(up); acc += bu; pasos.append(("arriba", up, bu, acc / tot)); up += 1
        else:
            area.add(dn); acc += bd; pasos.append(("abajo", dn, bd, acc / tot)); dn -= 1
    return lo, paso, bins, poc, area, acc / tot, empatados_poc, empates_area, pasos


ohlc_f = [(float(o), float(h), float(l), float(c)) for o, h, l, c, v in BARRAS]
vol = [v for *_, v in BARRAS]
lo_f, paso_f, bins_f, poc_f, area_f, cob_f = _perfil(ohlc_f, vol, NIV, PCT)
lo_x, paso_x, bins_x, poc_x, area_x, cob_x, emp_poc, emp_area, pasos = _perfil_exacto(
    [(o, h, l, c) for o, h, l, c, v in BARRAS], vol, NIV)

assert poc_f == poc_x and area_f == area_x, "la versión literal y la exacta difieren"
for bf, bx in zip(bins_f, bins_x):
    assert abs(bf - float(bx)) < 1e-6

LO = D(str(lo_x.numerator)) / D(str(lo_x.denominator))
PASO = D(paso_x.numerator) / D(paso_x.denominator)
HI = LO + NIV * PASO
POC = LO + (D(poc_x) + D("0.5")) * PASO          # centro del nivel (regla 4 de 11.4)
VAL = LO + min(area_x) * PASO                    # borde inferior del nivel más bajo
VAH = LO + (max(area_x) + 1) * PASO              # borde superior del nivel más alto
COB = D(cob_x.numerator) / D(cob_x.denominator)  # cobertura efectiva exacta
TOTAL_VOL = sum(vol)
VOL_AREA = sum(bins_x[k] for k in area_x)

# ---------------------------------------------------------------------------
# 4 · VWAP de sesión y bandas (convención del caso 4, §5.2)
# ---------------------------------------------------------------------------
tip = [(h + l + c) / 3 for o, h, l, c, v in BARRAS]
sv = sum(D(v) for v in vol)
VWAP = sum(t * v for t, v in zip(tip, vol)) / sv
VAR = sum(D(v) * (t - VWAP) ** 2 for t, v in zip(tip, vol)) / sv
SIGMA = VAR.sqrt()
BANDAS = {"-2σ": VWAP - 2 * SIGMA, "-1σ": VWAP - SIGMA, "+1σ": VWAP + SIGMA, "+2σ": VWAP + 2 * SIGMA}

# VWAP y bandas progresivos, barra a barra (para dibujar las líneas; el valor del corte es el de la barra 23)
VW_PROG = []
_sv = D(0); _stv = D(0); _st2v = D(0)
for t, v in zip(tip, vol):
    _sv += v; _stv += t * v; _st2v += t * t * v
    _vw = _stv / _sv; _sd = max(_st2v / _sv - _vw * _vw, D(0)).sqrt()
    VW_PROG.append((_vw, _sd))
assert abs(VW_PROG[-1][0] - VWAP) < D("1e-30") and abs(VW_PROG[-1][1] - SIGMA) < D("1e-20")

# ---------------------------------------------------------------------------
# 5 · ATR(14) de Wilder sobre las mismas barras (sin barras previas: declarado)
# ---------------------------------------------------------------------------
tr = []
for k, (o, h, l, c, v) in enumerate(BARRAS):
    if k == 0:
        tr.append(h - l)
    else:
        pc = BARRAS[k - 1][3]
        tr.append(max(h - l, abs(h - pc), abs(l - pc)))
atr = [None] * len(BARRAS)
atr[ATR_N - 1] = sum(tr[:ATR_N]) / ATR_N
for k in range(ATR_N, len(BARRAS)):
    atr[k] = (atr[k - 1] * (ATR_N - 1) + tr[k]) / ATR_N
ATR = atr[-1]
ATR2 = ATR.quantize(D("0.01"), rounding=ROUND_HALF_UP)   # cifra que se imprime (como una leyenda)

# ---------------------------------------------------------------------------
# 6 · Niveles escritos y posición al corte (§5.3 del caso 4)
# ---------------------------------------------------------------------------
CIERRE = BARRAS[-1][3]
IB = BARRAS[:12]
IB_MAX = max(b[1] for b in IB); IB_MIN = min(b[2] for b in IB)
SES_MAX = max(b[1] for b in BARRAS); SES_MIN = min(b[2] for b in BARRAS)

NIVELES = {
    "VWAP": VWAP, "VWAP +1σ": BANDAS["+1σ"], "VWAP −1σ": BANDAS["-1σ"],
    "VWAP +2σ": BANDAS["+2σ"], "VWAP −2σ": BANDAS["-2σ"],
    "POC": POC, "VAH": VAH, "VAL": VAL,
    "Máximo del balance inicial": IB_MAX, "Mínimo del balance inicial": IB_MIN,
    "Máximo de la sesión": SES_MAX, "Mínimo de la sesión": SES_MIN,
}
# Los niveles se comparan con su cifra impresa (dos decimales), como en el caso real.
NIV_IMPR = {k: D(v).quantize(D("0.01"), rounding=ROUND_HALF_UP) for k, v in NIVELES.items()}

fuera_arriba = CIERRE > VAH and CIERRE > NIV_IMPR["VWAP"]
fuera_abajo = CIERRE < VAL and CIERRE < NIV_IMPR["VWAP"]
dentro = VAL <= CIERRE <= VAH


def al_tick_lejos(precio, lado):
    """Lleva un precio al tick alejándose del cierre: hacia abajo si la invalidación
    queda por debajo ('abajo'), hacia arriba si queda por encima ('arriba')."""
    q = precio / TICK
    q = q.to_integral_value(rounding=ROUND_FLOOR if lado == "abajo" else ROUND_CEILING)
    return q * TICK


def ticks(d):
    t = d / TICK
    assert t == t.to_integral_value(), d
    return int(t)


resultado = {"aceptacion": None, "rotacion": None}

# --- Escenario de aceptación (solo si el precio está fuera de valor) ---
if fuera_arriba:
    cand_area = VAH - TICK                              # un tick dentro del extremo del área
    cand_atr = al_tick_lejos(CIERRE - ATR2, "abajo")    # un ATR desde el precio, al tick, sin acortar
    inval = min(cand_area, cand_atr)                    # el más alejado del precio
    dist_ticks = ticks(CIERRE - inval)
    riesgo_ticks = dist_ticks + COSTE_TICKS
    sobre = sorted([(v, k) for k, v in NIV_IMPR.items() if v > CIERRE])
    obst_precio, obst_nombre = sobre[0] if sobre else (None, None)
    obst_ticks_dec = (obst_precio - CIERRE) / TICK if sobre else None
    exigido = 2 * riesgo_ticks
    se_mantiene = (obst_precio is None) or (obst_ticks_dec >= exigido)
    riesgo_contrato = riesgo_ticks * USD_TICK
    contratos = int((PRESUPUESTO / riesgo_contrato).to_integral_value(rounding=ROUND_FLOOR))
    R1 = contratos * riesgo_contrato
    resultado["aceptacion"] = dict(
        evaluable=True, cand_un_tick_dentro=cand_area, cand_un_atr=cand_atr,
        cierre_menos_atr_sin_redondear=CIERRE - ATR2,
        invalidacion=inval, distancia_ticks=dist_ticks, distancia_puntos=CIERRE - inval,
        riesgo_ticks=riesgo_ticks, obstaculo=obst_nombre, obstaculo_precio=obst_precio,
        obstaculo_ticks=obst_ticks_dec, exigido_ticks=exigido,
        multiplo=(obst_ticks_dec / riesgo_ticks) if sobre else None,
        se_mantiene=se_mantiene, riesgo_por_contrato=riesgo_contrato,
        contratos=contratos, R1=R1, pct_presupuesto=R1 / PRESUPUESTO * 100,
        dist_usd_contrato=dist_ticks * USD_TICK, coste_usd_contrato=COSTE_TICKS * USD_TICK)

# --- Escenario de rotación (solo si el precio está a un ATR o más del POC) ---
dist_poc = abs(CIERRE - POC)
if dist_poc >= ATR2:
    lado_otro = [(v, k) for k, v in NIV_IMPR.items() if (v > CIERRE if CIERRE > POC else v < CIERRE)]
    lado_otro = [(v, k) for v, k in lado_otro if abs(v - CIERRE) >= ATR2]
    lado_otro.sort(key=lambda t: abs(t[0] - CIERRE))
    hacia_poc = [(v, k) for k, v in NIV_IMPR.items() if (POC <= v < CIERRE if CIERRE > POC else CIERRE < v <= POC)]
    hacia_poc.sort(key=lambda t: abs(t[0] - CIERRE))
    obst_precio, obst_nombre = hacia_poc[0]
    obst_ticks_dec = abs(obst_precio - CIERRE) / TICK
    if lado_otro:
        ref_precio, ref_nombre = lado_otro[0]
        if CIERRE > POC:
            inval = al_tick_lejos(ref_precio, "arriba") + TICK
        else:
            inval = al_tick_lejos(ref_precio, "abajo") - TICK
        dist_ticks = ticks(abs(inval - CIERRE))
        riesgo_ticks = dist_ticks + COSTE_TICKS
        exigido = 2 * riesgo_ticks
        se_mantiene = obst_ticks_dec >= exigido
    else:
        ref_precio = ref_nombre = inval = dist_ticks = riesgo_ticks = exigido = None
        se_mantiene = False
    resultado["rotacion"] = dict(
        evaluable=True, distancia_al_poc=dist_poc, ref_nivel=ref_nombre, ref_precio=ref_precio,
        invalidacion=inval, distancia_ticks=dist_ticks, riesgo_ticks=riesgo_ticks,
        obstaculo=obst_nombre, obstaculo_precio=obst_precio, obstaculo_ticks=obst_ticks_dec,
        exigido_ticks=exigido, multiplo=(obst_ticks_dec / riesgo_ticks) if riesgo_ticks else None,
        se_mantiene=se_mantiene)

# ---------------------------------------------------------------------------
# 7 · Nodos (convención declarada SOLO para esta simulación; descriptivos,
#     no entran en las reglas del §5.3)
#     HVN: nivel fuera del POC con más volumen que sus dos vecinos y al menos el
#          50 % del volumen del POC.  LVN: nivel con menos volumen que sus dos
#          vecinos y como mucho el 50 % del volumen del POC, entre dos niveles
#          de más volumen.
# ---------------------------------------------------------------------------
mxb = bins_x[poc_x]
def _zonas(cond):
    zs, cur = [], []
    for k in range(NIV):
        if cond(k): cur.append(k)
        elif cur: zs.append(cur); cur = []
    if cur: zs.append(cur)
    return zs
HVN_UMBRAL = F(4, 5)   # >= 80 % del volumen del POC
LVN_UMBRAL = F(1, 5)   # <= 20 % del volumen del POC
HVN_Z = _zonas(lambda k: bins_x[k] >= HVN_UMBRAL * mxb)
LVN_Z = _zonas(lambda k: bins_x[k] <= LVN_UMBRAL * mxb)
HVN = [k for z in HVN_Z for k in z]; LVN = [k for z in LVN_Z for k in z]


def centro(k):
    return LO + (D(k) + D("0.5")) * PASO


# ---------------------------------------------------------------------------
# 7b · CONTRASTE (solo para el arreglo de la pág. 378): la regla GENERAL de área
#      de valor que documenta TradingView («Volume profile indicators: basic
#      concepts», copia del 27-11-2026 en ../evidencias/), aplicada a ESTOS MISMOS
#      40 niveles. No es lo que dibujaría la plataforma (usa barras de temporalidad
#      inferior, filas redondeadas al tick y su propio reparto): solo aísla la
#      diferencia de regla de parada y desempate.
# ---------------------------------------------------------------------------
def area_regla_tv(bins, poc, pct=F(7, 10)):
    objetivo = pct * sum(bins); resto = objetivo - bins[poc]
    area = {poc}; up, dn = poc + 1, poc - 1
    while True:
        cu = bins[up] if up < len(bins) else None
        cd = bins[dn] if dn >= 0 else None
        if cu is None and cd is None: break
        if cd is None or (cu is not None and (cu > cd or (cu == cd and (up - poc) <= (poc - dn)))):
            lado, k, v = "arriba", up, cu
        else:
            lado, k, v = "abajo", dn, cd
        if v > resto: break          # «si lo excedería, se para»
        area.add(k); resto -= v
        if lado == "arriba": up += 1
        else: dn -= 1
    return area, sum(bins[k] for k in area) / sum(bins)

AREA_TV, COB_TV = area_regla_tv(bins_x, poc_x)
VAL_TV = LO + min(AREA_TV) * PASO; VAH_TV = LO + (max(AREA_TV) + 1) * PASO

# ---------------------------------------------------------------------------
# 8 · Exportación
# ---------------------------------------------------------------------------
with open(os.path.join(AQUI, "barras_simulacion.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["barra", "hora_ET", "apertura", "maximo", "minimo", "cierre", "volumen",
                "precio_tipico", "rango_verdadero", "atr14_wilder", "vwap_acum", "vwap_m2sd", "vwap_m1sd", "vwap_p1sd", "vwap_p2sd", "nota"])
    for k, (o, h, l, c, v) in enumerate(BARRAS):
        w.writerow([k, hora(k), f"{o:.2f}", f"{h:.2f}", f"{l:.2f}", f"{c:.2f}", v,
                    f"{tip[k]:.6f}", f"{tr[k]:.2f}", "" if atr[k] is None else f"{atr[k]:.6f}",
                    f"{VW_PROG[k][0]:.4f}", f"{VW_PROG[k][0] - 2 * VW_PROG[k][1]:.4f}", f"{VW_PROG[k][0] - VW_PROG[k][1]:.4f}",
                    f"{VW_PROG[k][0] + VW_PROG[k][1]:.4f}", f"{VW_PROG[k][0] + 2 * VW_PROG[k][1]:.4f}",
                    "SIMULACIÓN DIDÁCTICA CONTROLADA · barra sintética, no un dato de mercado"])

with open(os.path.join(AQUI, "perfil_40_niveles.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["nivel", "borde_inferior", "borde_superior", "centro", "volumen_exacto_fraccion",
                "volumen_decimal", "pct_del_total", "en_area_de_valor", "marca"])
    for k in range(NIV):
        marca = []
        if k == poc_x: marca.append("POC")
        if k == max(area_x): marca.append("nivel VAH")
        if k == min(area_x): marca.append("nivel VAL")
        if k in HVN: marca.append("HVN")
        if k in LVN: marca.append("LVN")
        b = bins_x[k]
        w.writerow([k, f"{LO + k * PASO:.2f}", f"{LO + (k + 1) * PASO:.2f}", f"{centro(k):.2f}",
                    str(b), f"{float(b):.4f}", f"{float(b / TOTAL_VOL * 100):.4f}",
                    "sí" if k in area_x else "no", " · ".join(marca)])

def j(x):
    if isinstance(x, D): return str(x)
    if isinstance(x, F): return str(x)
    if isinstance(x, dict): return {k: j(v) for k, v in x.items()}
    if isinstance(x, (list, tuple, set)): return [j(v) for v in (sorted(x) if isinstance(x, set) else x)]
    return x

resumen = {
    "_ROTULO": "SIMULACIÓN DIDÁCTICA CONTROLADA · barras sintéticas, no datos de mercado",
    "contrato": "MES ilustrativo (Micro E-mini S&P 500): 5 USD/punto, tick 0,25 = 1,25 USD; sin vencimiento ni fecha reales",
    "sesion": "RTH sintética 09:30-16:00 ET; corte a las 11:30 ET; última barra cerrada, 11:25 (barra 23)",
    "algoritmo": "11.4 de MC, copia literal de _perfil() del código de las figuras (fix a = min(niv-1, ...)); verificado con réplica exacta en fracciones",
    "n_barras": len(BARRAS), "volumen_total": TOTAL_VOL,
    "perfil": {"minimo_ventana": LO, "maximo_ventana": HI, "niveles": NIV, "alto_nivel_puntos": PASO,
               "alto_nivel_ticks": PASO / TICK, "poc_nivel": poc_x, "poc": POC, "vah": VAH, "val": VAL,
               "niveles_area": sorted(area_x), "n_niveles_area": len(area_x),
               "volumen_area_exacto": str(VOL_AREA), "cobertura_exacta": str(cob_x),
               "cobertura_pct": COB * 100, "umbral_pct": 70,
               "empates_poc": emp_poc, "empates_en_area": emp_area,
               "pasos_area": [(lado, k, str(v), float(c) * 100) for lado, k, v, c in pasos],
               "hvn_zonas": [(f"{LO + z[0] * PASO:.2f}", f"{LO + (z[-1] + 1) * PASO:.2f}") for z in HVN_Z],
               "lvn_zonas": [(f"{LO + z[0] * PASO:.2f}", f"{LO + (z[-1] + 1) * PASO:.2f}") for z in LVN_Z],
               "nodos_convencion": "HVN: niveles con >= 80 % del volumen del POC; LVN: niveles con <= 20 %; zonas contiguas; convención declarada solo para esta simulación, descriptiva, fuera de la regla 5.3"},
    "vwap": {"vwap": VWAP, "sigma": SIGMA, **{k: v for k, v in BANDAS.items()}},
    "atr14": {"valor": ATR, "impreso": ATR2, "nota": "Wilder; semilla = media simple de los 14 primeros rangos verdaderos; barra 0 sin cierre previo (rango)"},
    "niveles_escritos_impresos": NIV_IMPR,
    "balance_inicial": {"maximo": IB_MAX, "minimo": IB_MIN},
    "sesion_hasta_corte": {"maximo": SES_MAX, "minimo": SES_MIN},
    "cierre_corte": CIERRE,
    "posicion": {"fuera_por_arriba": fuera_arriba, "fuera_por_abajo": fuera_abajo, "dentro": dentro,
                 "distancia_vwap": CIERRE - NIV_IMPR["VWAP"], "distancia_vah": CIERRE - VAH,
                 "distancia_poc": CIERRE - POC},
    "escenarios": resultado,
    "contraste_regla_general_tradingview_mismos_40_niveles": {
        "vah": VAH_TV, "val": VAL_TV, "cobertura_exacta": str(COB_TV), "cobertura_pct": D(COB_TV.numerator) / D(COB_TV.denominator) * 100,
        "nota": "regla general publicada por TradingView (para al no exceder el objetivo; empate: el más cercano al POC y, a igual distancia, arriba) aplicada a la misma tabla; no es lo que dibujaría la plataforma"},
    "presupuesto_max_usd": PRESUPUESTO, "cuenta_ilustrativa_usd": CUENTA,
}
with open(os.path.join(AQUI, "resumen_simulacion.json"), "w", encoding="utf-8") as f:
    json.dump(j(resumen), f, ensure_ascii=False, indent=2)

# ---------------------------------------------------------------------------
# 9 · Informe en consola
# ---------------------------------------------------------------------------
print("SIMULACIÓN DIDÁCTICA CONTROLADA · MES ilustrativo")
print(f"Ventana {es(LO)} – {es(HI)}; 40 niveles de {es(PASO)} pt ({PASO / TICK} ticks)")
print(f"POC {es(POC)} (nivel {poc_x}) · VAH {es(VAH)} · VAL {es(VAL)} · área {len(area_x)} niveles · cobertura {es(COB*100, 4)} % (exacta {cob_x})")
print(f"Empates POC: {emp_poc} · empates en área: {emp_area}")
print(f"VWAP {es(VWAP)} · σ {es(SIGMA, 4)} · ±1σ {es(BANDAS['-1σ'])} – {es(BANDAS['+1σ'])} · ±2σ {es(BANDAS['-2σ'])} – {es(BANDAS['+2σ'])}")
print(f"ATR(14) {es(ATR, 6)} → impreso {es(ATR2)}")
print(f"IB {es(IB_MIN)} – {es(IB_MAX)} · sesión {es(SES_MIN)} – {es(SES_MAX)} · cierre {es(CIERRE)}")
print("HVN", [(es(LO+z[0]*PASO), es(LO+(z[-1]+1)*PASO)) for z in HVN_Z], "LVN", [(es(LO+z[0]*PASO), es(LO+(z[-1]+1)*PASO)) for z in LVN_Z])
print("Posición: fuera arriba" if fuera_arriba else ("fuera abajo" if fuera_abajo else "dentro/mixta"))
print(f"Contraste regla general TV (misma tabla): VAH {es(VAH_TV)} · VAL {es(VAL_TV)} · cobertura {es(D(COB_TV.numerator)/D(COB_TV.denominator)*100, 4)} %")
for k, v in resultado.items():
    print(k, json.dumps(j(v), ensure_ascii=False))
