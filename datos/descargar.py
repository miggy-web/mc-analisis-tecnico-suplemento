#!/usr/bin/env python3
"""Receta de descarga de las series reales del suplemento (no se redistribuyen: cada lector las descarga).

Series (Yahoo Finance, API pública de gráficos v8; condiciones de uso de Yahoo: uso personal, sin redistribución):
  spy_1d   SPY (SPDR S&P 500 ETF Trust, NYSE Arca), diario, 2004-01-02 → 2025-12-31. Se guardan los OHLC SIN ajustar por
           dividendos (campo quote de Yahoo) y los dividendos (events=div) con fecha ex <= 2025-12-31. El ajuste por
           dividendos se calcula en el suplemento (replicas_spy/comun_real.py), anclado a 2025-12-31, para que el
           archivo no cambie cuando Yahoo publique dividendos posteriores.
  gspc_1d  Índice S&P 500 (^GSPC), diario, 2021-12-01 → 2023-01-31: máximos y mínimos para los swings n = 5 de 2022 (9.2).
Destino: --dir DIR o variable de entorno MC_DATOS (por defecto, .datos_locales/ junto al paquete, excluida en .gitignore).
Comprobación: el SHA-256 de cada CSV derivado debe coincidir con MANIFEST_DATOS.json; si no coincide, termina con error.
Uso: python3 datos/descargar.py [--dir DIR] [--forzar]
"""
import argparse, csv, datetime as dt, hashlib, json, os, sys, time, urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

RAIZ = Path(__file__).resolve().parent.parent
MAN = json.loads((RAIZ / "MANIFEST_DATOS.json").read_text())
NY = ZoneInfo("America/New_York")

def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()

def bajar(url, destino):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (MC-Analisis-Tecnico suplemento reproducible)"})
    for intento in range(3):
        try:
            destino.write_bytes(urllib.request.urlopen(req, timeout=60).read()); return
        except Exception as e:  # reintento simple; si falla tres veces, error explícito
            if intento == 2: raise SystemExit(f"No se pudo descargar {url}: {e}")
            time.sleep(3)

def fecha(t): return dt.datetime.fromtimestamp(t, NY).date().isoformat()

def spy(crudo, csv_):
    d = json.loads(crudo.read_text())["chart"]["result"][0]
    q = d["indicators"]["quote"][0]; fin = MAN["spy_1d"]["ultima_fecha"]
    divs = {fecha(int(v["date"])): v["amount"] for v in d.get("events", {}).get("dividends", {}).values()}
    filas = []
    for i, t in enumerate(d["timestamp"]):
        vals = [q["open"][i], q["high"][i], q["low"][i], q["close"][i]]
        f = fecha(t)
        if any(v is None for v in vals) or f > fin: continue
        filas.append([f] + [f"{v:.6f}" for v in vals] + [f"{divs.get(f, 0.0):.6f}"])
    with open(csv_, "w", newline="") as fh:
        w = csv.writer(fh, lineterminator="\n"); w.writerow(["fecha", "open", "high", "low", "close", "dividendo"]); w.writerows(filas)

def gspc(crudo, csv_):
    d = json.loads(crudo.read_text())["chart"]["result"][0]; q = d["indicators"]["quote"][0]
    filas = [[fecha(t), f"{q['high'][i]:.6f}", f"{q['low'][i]:.6f}"] for i, t in enumerate(d["timestamp"])
             if q["high"][i] is not None and q["low"][i] is not None]
    with open(csv_, "w", newline="") as fh:
        w = csv.writer(fh, lineterminator="\n"); w.writerow(["fecha", "high", "low"]); w.writerows(filas)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--dir"); ap.add_argument("--forzar", action="store_true")
    ap.add_argument("--solo-calcular-sha", action="store_true", help="mantenimiento: imprime los SHA sin exigir coincidencia")
    a = ap.parse_args()
    D = Path(a.dir or os.environ.get("MC_DATOS") or RAIZ / ".datos_locales"); D.mkdir(parents=True, exist_ok=True)
    ok = True
    for clave, deriva in (("spy_1d", spy), ("gspc_1d", gspc)):
        m = MAN[clave]; crudo = D / m["archivo_crudo"]; csv_ = D / m["archivo_csv"]
        if a.forzar or not crudo.exists(): bajar(m["url"], crudo)
        deriva(crudo, csv_)
        h = sha(csv_)
        print(f"{clave}: {csv_.name} SHA-256 {h}")
        if not a.solo_calcular_sha and h != m["sha256_csv"]:
            print(f"  ERROR: no coincide con el manifiesto ({m['sha256_csv']}). Yahoo ha cambiado los datos o la receta.", file=sys.stderr); ok = False
    if not ok: sys.exit(2)

if __name__ == "__main__":
    main()
