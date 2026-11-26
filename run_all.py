#!/usr/bin/env python3
"""MC Análisis Técnico · suplemento reproducible v1.0.0 · orden única de reproducción.

    python3 run_all.py

1. Comprueba el entorno (Python ≥ 3.11, numpy con la versión exacta de requirements.txt, Node ≥ 22.6).
2. Borra todas las salidas (resultados/, TABLA_FIGURAS_SHA256.*).
3. Descarga las series reales en una carpeta temporal FUERA del paquete y verifica su SHA-256 (MANIFEST_DATOS.json).
4. Ejecuta todos los experimentos y réplicas DOS veces, en carpetas separadas, y exige SHA-256 idénticos archivo a archivo.
5. Comprueba que cada cifra impresa en el libro (referencia/cifras_impresas_428p.json) coincide con la calculada.
6. Compara las huellas con las de referencia (referencia/SHA256_ESPERADOS.json).
7. Escribe resultados/ y TABLA_FIGURAS_SHA256.md/.json, ejecuta auditar_paquete.py y borra la carpeta temporal de datos.
Cualquier fallo detiene el proceso con código distinto de 0.
Opciones: --datos DIR (usar y conservar esa carpeta de datos), --congelar (mantenimiento: escribe SHA256_ESPERADOS.json).
"""
import argparse, hashlib, json, os, re, shutil, subprocess, sys, tempfile, time
from pathlib import Path
sys.dont_write_bytecode = True
RAIZ = Path(__file__).resolve().parent
PY = sys.executable
PASOS = [("e00_bancos", "experimentos/e00_bancos.py"), ("e01_precision_3_6", "experimentos/e01_precision_3_6.py"),
         ("e02_matriz_osciladores_7_3", "experimentos/e02_matriz_osciladores_7_3.py"), ("e03_divergencias_7_4", "experimentos/e03_divergencias_7_4.py"),
         ("e04_compresion_8_3", "experimentos/e04_compresion_8_3.py"), ("e05_fibonacci_9_2", "experimentos/e05_fibonacci_9_2.py"),
         ("e06_sobreajuste_14_2", "experimentos/e06_sobreajuste_14_2.py"), ("r01_divergencias_7_4_spy", "replicas_spy/r01_divergencias_7_4_spy.py"),
         ("r02_compresion_8_3_spy", "replicas_spy/r02_compresion_8_3_spy.py"), ("r03_walkforward_14_2_spy", "replicas_spy/r03_walkforward_14_2_spy.py")]
FIGURAS = [("Bancos simulados", "9, 309–310", "e00_bancos"), ("3.6.3 · precisión y caja 16", "94–97", "e01_precision_3_6"),
           ("7.3.1 · matriz de 18 osciladores", "166–170", "e02_matriz_osciladores_7_3"), ("7.4.1 · divergencias", "171–173", "e03_divergencias_7_4"),
           ("8.3.1 · compresión del ATR%", "194–198", "e04_compresion_8_3"), ("9.2 y 9.2.2 · Fibonacci, 28 tríos", "209–213", "e05_fibonacci_9_2"),
           ("14.2.1 y 14.2.2 · 464 variantes", "312–317", "e06_sobreajuste_14_2"),
           ("Réplica SPY de 7.4 (no impresa)", "—", "r01_divergencias_7_4_spy"), ("Réplica SPY de 8.3 (no impresa)", "—", "r02_compresion_8_3_spy"),
           ("Réplica SPY de 14.2, walk-forward con costes (no impresa)", "—", "r03_walkforward_14_2_spy")]

def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def fallo(msg): print(f"\nERROR: {msg}", file=sys.stderr); sys.exit(1)

def entorno():
    if sys.version_info < (3, 11): fallo("hace falta Python ≥ 3.11")
    import numpy
    req = re.search(r"^numpy==([\d.]+)", (RAIZ / "requirements.txt").read_text(), re.M).group(1)
    if numpy.__version__ != req: fallo(f"numpy {numpy.__version__} instalado; el suplemento exige numpy=={req} (pip install -r requirements.txt)")
    try: v = subprocess.run(["node", "--version"], capture_output=True, text=True, check=True).stdout.strip()
    except Exception: fallo("no se encuentra Node.js (≥ 22.6)")
    mayor, menor = (int(x) for x in v.lstrip("v").split(".")[:2])
    if (mayor, menor) < (22, 6): fallo(f"Node {v}; hace falta ≥ 22.6 (--experimental-strip-types)")
    return dict(python=sys.version.split()[0], numpy=numpy.__version__, node=v)

def ejecutar_todo(destino: Path, env):
    for nombre, script in PASOS:
        t = time.time()
        r = subprocess.run([PY, str(RAIZ / script), "--out", str(destino / nombre)], cwd=RAIZ, env=env, capture_output=True, text=True)
        if r.returncode != 0: print(r.stdout[-2000:], r.stderr[-4000:]); fallo(f"falló {script}")
        print(f"   {nombre:<28} ok ({time.time() - t:4.1f} s)", flush=True)
    return {str(p.relative_to(destino)): sha(p) for p in sorted(destino.rglob("*")) if p.is_file()}

def valor(d, ruta):
    """Sigue una ruta con puntos; admite claves que contienen puntos (p. ej. «e=0.05»)."""
    t, i = ruta.split("."), 0
    while i < len(t):
        if isinstance(d, list): d, i = d[int(t[i])], i + 1; continue
        for j in range(len(t), i, -1):
            if ".".join(t[i:j]) in d: d, i = d[".".join(t[i:j])], j; break
        else: raise KeyError(ruta)
    return d

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--datos"); ap.add_argument("--congelar", action="store_true"); a = ap.parse_args()
    print("MC Análisis Técnico · suplemento reproducible", (RAIZ / "VERSION").read_text().split("\n")[0])
    ent = entorno(); print(f"1. Entorno: Python {ent['python']}, numpy {ent['numpy']}, Node {ent['node']}")
    for p in (RAIZ / "resultados", RAIZ / "TABLA_FIGURAS_SHA256.md", RAIZ / "TABLA_FIGURAS_SHA256.json"):
        shutil.rmtree(p) if p.is_dir() else (p.unlink() if p.exists() else None)
    print("2. Salidas anteriores borradas")
    datos_tmp = a.datos is None
    datos = Path(a.datos) if a.datos else Path(tempfile.mkdtemp(prefix="mc_suplemento_datos_"))
    env = dict(os.environ, MC_DATOS=str(datos), PYTHONDONTWRITEBYTECODE="1")
    try:
        r = subprocess.run([PY, str(RAIZ / "datos" / "descargar.py"), "--dir", str(datos)], env=env, capture_output=True, text=True)
        print(r.stdout.rstrip())
        if r.returncode != 0: print(r.stderr); fallo("las series descargadas no coinciden con MANIFEST_DATOS.json")
        print("3. Datos verificados por SHA-256 (carpeta temporal fuera del paquete)")
        trabajo = Path(tempfile.mkdtemp(prefix="mc_suplemento_ejecuciones_"))
        h = {}
        for e in (1, 2):
            print(f"4.{e} Ejecución {e}"); h[e] = ejecutar_todo(trabajo / f"ejecucion_{e}", env)
        if h[1] != h[2]: fallo("NO DETERMINISTA: " + ", ".join(k for k in h[1] if h[1][k] != h[2].get(k)))
        print(f"   Doble ejecución idéntica: {len(h[1])} archivos con el mismo SHA-256")
        shutil.copytree(trabajo / "ejecucion_1", RAIZ / "resultados"); shutil.rmtree(trabajo)
        ref = json.loads((RAIZ / "referencia" / "cifras_impresas_428p.json").read_text())["comprobaciones"]
        comp = []
        for fig, desc, archivo, ruta, impreso, dec in ref:
            v = valor(json.loads((RAIZ / "resultados" / archivo).read_text()), ruta)
            ok = (v < 0.001) if impreso == "<0.001" else (round(v, dec) == round(impreso, dec) if dec else round(v) == impreso)
            comp.append(dict(figura=fig, cifra=desc, archivo=archivo, impreso=impreso, calculado=v, ok=bool(ok)))
        malas = [c for c in comp if not c["ok"]]
        if malas: fallo("cifras impresas que no se reproducen: " + json.dumps(malas, ensure_ascii=False))
        print(f"5. Cifras impresas comprobadas: {len(comp)} de {len(comp)} coinciden")
        esp_p = RAIZ / "referencia" / "SHA256_ESPERADOS.json"
        if a.congelar:
            esp_p.write_text(json.dumps(h[1], indent=1, ensure_ascii=False) + "\n"); print("6. Huellas de referencia CONGELADAS (mantenimiento)")
        else:
            esp = json.loads(esp_p.read_text())
            dif = sorted(set(esp) ^ set(h[1])) + [k for k in esp if k in h[1] and esp[k] != h[1][k]]
            if dif: fallo("las salidas no coinciden con las huellas de referencia: " + ", ".join(dif))
            print(f"6. Las {len(h[1])} salidas coinciden con referencia/SHA256_ESPERADOS.json")
        filas, js = [], []
        for fig, pags, carpeta in FIGURAS:
            arch = {k: v for k, v in h[1].items() if k.startswith(carpeta + "/")}
            cc = [c for c in comp if c["archivo"].startswith(carpeta + "/")]
            js.append(dict(figura=fig, paginas_428p=pags, carpeta=f"resultados/{carpeta}", archivos=arch, cifras_impresas_comprobadas=cc))
            for k, v in arch.items():
                filas.append(f"| {fig} | {pags} | `resultados/{k}` | `{v}` | {sum(c['ok'] for c in cc)}/{len(cc)} |")
        (RAIZ / "TABLA_FIGURAS_SHA256.json").write_text(json.dumps(dict(version=(RAIZ / "VERSION").read_text().split("\n")[0], figuras=js), indent=1, ensure_ascii=False, default=float) + "\n")
        md = ["# Tabla por figura: salidas esperadas y huellas SHA-256 (generada por `run_all.py`)", "",
              "Cada fila es un archivo de salida. «Cifras impresas» = cifras del libro (edición auditada de 428 págs.) que coinciden con la calculada, redondeada a los decimales impresos.", "",
              "| Figura o experimento | Págs. | Archivo | SHA-256 | Cifras impresas |", "|---|---|---|---|---|"] + filas
        md += ["", "## Cifras impresas comprobadas", "", "| Figura | Cifra | Impreso | Calculado |", "|---|---|---|---|"]
        md += [f"| {c['figura']} | {c['cifra']} | {c['impreso']} | {c['calculado']} |" for c in comp]
        (RAIZ / "TABLA_FIGURAS_SHA256.md").write_text("\n".join(md) + "\n")
        print("7. TABLA_FIGURAS_SHA256.md/.json escritas")
    finally:
        if datos_tmp: shutil.rmtree(datos, ignore_errors=True)
    r = subprocess.run([PY, str(RAIZ / "auditar_paquete.py")], env=env, capture_output=True, text=True); print(r.stdout.rstrip())
    if r.returncode != 0: print(r.stderr); fallo("la auditoría del paquete encontró archivos prohibidos")
    print("\nTODO CORRECTO")

if __name__ == "__main__":
    main()
