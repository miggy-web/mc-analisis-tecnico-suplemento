#!/usr/bin/env python3
"""Experimento e06 · 14.2 Sobreajuste: registro completo de las 464 variantes y selección dentro / fuera de muestra.

Todo el cálculo lo hace el motor del libro (motor/experimento_14_2.mts → stats.ts: rejilla, backtest, metricas, optimizar).
Reglas de ejecución de backtest (verificadas en el código, ver METODOLOGIA.md §6):
  señal y entrada al CIERRE de la vela del cruce de SMA; una sola posición a la vez; stop = k·ATR simple de 14 desde la
  entrada, objetivo = m·riesgo; se revisan desde la vela siguiente con su máximo y su mínimo; si stop y objetivo caben
  en la misma vela, cuenta como pérdida (−1 R); la salida se anota al precio exacto del nivel aunque la vela abra más
  allá (no se modelan los huecos); en la vela de salida no se abre otra posición; la posición abierta al final de una
  serie se descarta (no se cierra ni se cuenta); resultado bruto en R (−1 o +m), sin costes en las cifras del libro.
Salidas: registro de las 464 variantes (dentro y fuera, con diagnóstico de ejecución), selección con mínimo 0/30/100
operaciones (paridad con optimizar) y sensibilidad con costes de 5 y 10 pb ida y vuelta descontados ANTES de seleccionar.
Uso: python3 experimentos/e06_sobreajuste_14_2.py [--out DIR]
"""
import argparse, csv, json, subprocess, sys
from pathlib import Path
AQUI = Path(__file__).resolve().parent; RAIZ = AQUI.parent
sys.path.insert(0, str(RAIZ / "mc"))
import mc_comun as mc
ap = argparse.ArgumentParser(); ap.add_argument("--out", default=str(RAIZ / "resultados" / "e06_sobreajuste_14_2")); a = ap.parse_args()
OUT = Path(a.out); OUT.mkdir(parents=True, exist_ok=True)
d = json.loads(subprocess.run(["node", "--experimental-strip-types", "--no-warnings", "experimento_14_2.mts"], cwd=RAIZ / "motor",
                              capture_output=True, text=True, check=True).stdout)
assert d["combinaciones_brutas"] == 480 and d["combinaciones_validas"] == 464
ref = mc.referencia_libro()["sistema"]
for mn in ("0", "30", "100"):
    s = d["seleccion"][f"bruto_min{mn}"]
    for q, v in (("dentro", s["dentro"]["esperanza"]), ("fuera", s["fuera"]["esperanza"]), ("opsdentro", s["dentro"]["operaciones"]),
                 ("opsfuera", s["fuera"]["operaciones"]), ("rapida", s["mejor"]["rapida"]), ("lenta", s["mejor"]["lenta"])):
        assert abs(v - ref[mn][q]) < 1e-12, f"paridad rota en sistema {mn} {q}"
cab = ["idx", "rapida", "lenta", "stopATR", "objetivoR"]
met = ["operaciones", "aciertos", "tasaAcierto", "esperanza", "profitFactor", "drawdown", "total"]
dia = ["ambos", "huecoStop", "huecoObj", "abiertaFinal", "primeraEntradaMin"]
with open(OUT / "registro_464_variantes.csv", "w", newline="") as f:
    w = csv.writer(f, lineterminator="\n")
    w.writerow(cab + [f"{g}_{m}" for g in ("dentro", "fuera") for m in met + ["neto5pb_R", "neto10pb_R"] + [f"diag_{x}" for x in dia]])
    for v in d["registro"]:
        fila = [v[k] for k in cab]
        for g in ("dentro", "fuera"):
            x = v[g]
            fila += [(f"{x['m'][m]:.6f}" if isinstance(x["m"][m], float) else x["m"][m]) for m in met] + [f"{x['neto5']:.6f}", f"{x['neto10']:.6f}"] + \
                    [("" if x["d"][k] is None else x["d"][k]) for k in dia]
        w.writerow(fila)
tot = {g: {k: sum(v[g]["d"][k] for v in d["registro"]) for k in ("ambos", "huecoStop", "huecoObj", "abiertaFinal")} for g in ("dentro", "fuera")}
ops = {g: sum(v[g]["m"]["operaciones"] for v in d["registro"]) for g in ("dentro", "fuera")}
cero = {g: sum(1 for v in d["registro"] if v[g]["m"]["operaciones"] == 0) for g in ("dentro", "fuera")}
filas = []
for mn in ("0", "30", "100"):
    s = d["seleccion"][f"bruto_min{mn}"]; m = s["mejor"]
    filas.append([f"sin costes, mínimo {mn}", f"{m['rapida']}/{m['lenta']}/{mc.fmt(m['stopATR'], 1)}/{mc.fmt(m['objetivoR'], 1)}",
                  mc.fmt(s["dentro"]["esperanza"], 3), s["dentro"]["operaciones"], mc.fmt(s["fuera"]["esperanza"], 3), s["fuera"]["operaciones"],
                  mc.fmt(s["dentro"]["esperanza"] - s["fuera"]["esperanza"], 3), mc.fmt(s["mediaFuera"], 3), mc.fmt(s["percentil_fuera_entre_464"], 1)])
    for bps in (5, 10):
        c = d["seleccion"][f"coste{bps}pb_min{mn}"]; m = c["mejor"]
        filas.append([f"{bps} pb, mínimo {mn}", f"{m['rapida']}/{m['lenta']}/{mc.fmt(m['stopATR'], 1)}/{mc.fmt(m['objetivoR'], 1)}",
                      mc.fmt(c["dentro_R"], 3), c["dentro_ops"], mc.fmt(c["fuera_R"], 3), c["fuera_ops"], mc.fmt(c["dentro_R"] - c["fuera_R"], 3), mc.fmt(c["mediaFuera"], 3), "—"])
md = f"""# 14.2 Sobreajuste — 464 variantes (generado por `experimentos/e06_sobreajuste_14_2.py`)

Banco: {d['banco']['series']} series × {d['banco']['velas_por_serie']} velas. Dentro (pares): semillas {', '.join(map(str, d['banco']['semillas_dentro']))}. Fuera (impares): {', '.join(map(str, d['banco']['semillas_fuera']))}.
Rejilla: rápida {d['rejilla']['rapidas']} × lenta {d['rejilla']['lentas']} × stop {d['rejilla']['stops']} ATR × objetivo {d['rejilla']['objetivos']} R = {d['combinaciones_brutas']}; válidas (lenta > rápida) = {d['combinaciones_validas']}.
Paridad con el verificador del libro (mínimo 0, 30 y 100): OK.

## Selección (la mejor esperanza dentro; empate → la primera en el orden de la rejilla)
{mc.tabla_md(["Escenario", "Mejor (rápida/lenta/stop/objetivo)", "R dentro", "Ops dentro", "R fuera", "Ops fuera", "Dentro − fuera", "Media de las 464 fuera", "Percentil del elegido fuera"], filas)}
Coste en R = (pb / 10.000) · precio de entrada / riesgo; se descuenta en cada operación antes de seleccionar. Las cifras del libro son sin costes.

## Diagnóstico de ejecución sobre las 464 variantes
{mc.tabla_md(["Conjunto", "Operaciones (suma de las 464)", "Velas con stop y objetivo a la vez (→ pérdida)", "Salidas en stop con hueco de apertura más allá del stop", "Salidas en objetivo con hueco más allá del objetivo", "Posiciones abiertas al final de serie (descartadas)", "Variantes con 0 operaciones"],
 [[g, ops[g], tot[g]['ambos'], tot[g]['huecoStop'], tot[g]['huecoObj'], tot[g]['abiertaFinal'], cero[g]] for g in ("dentro", "fuera")])}
El registro completo (464 filas, dentro y fuera, bruto y neto, con diagnóstico) está en `registro_464_variantes.csv`.
"""
(OUT / "sobreajuste_14_2.md").write_text(md)
mc.guardar_json(dict(banco=d["banco"], rejilla=d["rejilla"], combinaciones_brutas=d["combinaciones_brutas"], combinaciones_validas=d["combinaciones_validas"],
                     seleccion=d["seleccion"], diagnostico_total=tot, operaciones_total=ops, variantes_con_cero_operaciones=cero), OUT / "resultados_14_2.json")
print("e06 sobreajuste: ok")
