#!/usr/bin/env python3
"""Experimento e08 · Apéndice A, caso 4: simulación didáctica controlada del perfil (figura A.4d).

Ejecuta apendice_a/caso_4_simulacion_perfil/generar_simulacion_perfil.py en una carpeta temporal (no escribe dentro
del paquete), copia sus tres salidas a --out y exige que coincidan con las publicadas (SHA256SUMS.txt de esa carpeta).
Las 24 barras son sintéticas, escritas sobre la malla de ticks de un MES ilustrativo: no son datos de mercado.
Uso: python3 experimentos/e08_caso_4_simulacion_perfil.py [--out DIR]
"""
import argparse, hashlib, json, os, shutil, subprocess, sys, tempfile
from pathlib import Path
AQUI = Path(__file__).resolve().parent; RAIZ = AQUI.parent
CASO = RAIZ / "apendice_a" / "caso_4_simulacion_perfil"
SALIDAS = ["barras_simulacion.csv", "perfil_40_niveles.csv", "resumen_simulacion.json"]
ap = argparse.ArgumentParser(); ap.add_argument("--out", default=str(RAIZ / "resultados" / "e08_caso_4_simulacion_perfil")); a = ap.parse_args()
OUT = Path(a.out); OUT.mkdir(parents=True, exist_ok=True)
esperado = dict(reversed(l.split()) for l in (CASO / "SHA256SUMS.txt").read_text().splitlines() if l.strip())
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
assert sha(CASO / "generar_simulacion_perfil.py") == esperado["generar_simulacion_perfil.py"], "el generador no coincide con SHA256SUMS.txt"
with tempfile.TemporaryDirectory(prefix="mc_e08_") as tmp:
    shutil.copy2(CASO / "generar_simulacion_perfil.py", tmp)
    subprocess.run([sys.executable, "generar_simulacion_perfil.py"], cwd=tmp, check=True, capture_output=True,
                   env=dict(os.environ, PYTHONDONTWRITEBYTECODE="1"))
    for s in SALIDAS:
        assert sha(Path(tmp) / s) == esperado[s], f"{s} regenerado no coincide con el publicado"
        shutil.copy2(Path(tmp) / s, OUT / s)
(OUT / "verificacion_caso_4.json").write_text(json.dumps({s: esperado[s] for s in SALIDAS}, indent=1) + "\n")
print("e08 ok")
