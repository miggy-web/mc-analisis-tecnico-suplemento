#!/usr/bin/env python3
"""Auditoría del paquete publicable: falla si encuentra algo que no debe publicarse o que rompe la autocontención.

Prohibido: PDF; imágenes (capturas); código Pine (.pine, «//@version», «indicator(», «strategy(»); datos de mercado
(JSON crudos de Yahoo, CSV con columnas de precio, carpetas .datos_locales, archivos LOCAL_*); extractos del manuscrito
(marcas de página del libro); rutas absolutas o de repositorios internos; razones sociales retiradas; cachés de Python; CSV con columnas OHLC sin rótulo de simulación;
huellas de los SHA256SUMS.txt internos.
Uso: python3 auditar_paquete.py
"""
import re, sys
from pathlib import Path
RAIZ = Path(__file__).resolve().parent
EXT_PROHIBIDAS = {".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".tif", ".tiff", ".bmp", ".pine", ".pyc", ".docx", ".epub", ".idml", ".indd"}
MARCAS_LIBRO = ["Miggy dice", "Q U E DA", "PRÁCTICA · CAJA", "F U E N T E S Y L E C T U R AS", "MC ANÁLISIS TÉCNICO   ", "DATOS SIMULADOS CON FINES DIDÁCTICOS"]
PINE = [r"//@version\s*=", r"\bindicator\s*\(", r"\bstrategy\s*\(", r"\bplotshape\s*\("]
problemas, n = [], 0
for p in sorted(RAIZ.rglob("*")):
    rel = p.relative_to(RAIZ)
    if any(part in (".git",) for part in rel.parts): continue
    if p.is_dir():
        if p.name in ("__pycache__", ".datos_locales"): problemas.append(f"{rel}: carpeta prohibida")
        continue
    n += 1
    if p.suffix.lower() in EXT_PROHIBIDAS: problemas.append(f"{rel}: extensión prohibida"); continue
    if p.name.startswith("LOCAL_") or "crudo" in p.name: problemas.append(f"{rel}: archivo de datos local/crudo"); continue
    if p.name == "auditar_paquete.py": continue
    try: t = p.read_text(encoding="utf-8")
    except UnicodeDecodeError: problemas.append(f"{rel}: binario no esperado"); continue
    if re.search(r"/(workspace|home|Users|cursor)/", t): problemas.append(f"{rel}: ruta absoluta a la máquina de trabajo")
    if re.search(r"\b(books|apps|editorial|imprenta|miggy-indicator-registry)/[\w\[\]-]+", t): problemas.append(f"{rel}: ruta de un repositorio interno")
    if re.search(r"migr[a]ine", t, re.I): problemas.append(f"{rel}: mención a una razón social retirada")
    if p.suffix == ".json" and '"chart"' in t and '"timestamp"' in t: problemas.append(f"{rel}: JSON crudo de Yahoo")
    if p.suffix == ".csv":
        cab = t.split("\n", 1)[0].lower().split(",")
        if {"open", "high", "low", "close"} & set(cab) or any(c.endswith("_precio") for c in cab): problemas.append(f"{rel}: CSV con columnas de precio")
        if len({"apertura", "maximo", "máximo", "minimo", "mínimo", "cierre"} & set(cab)) >= 2 and "SIMULACIÓN DIDÁCTICA" not in t:
            problemas.append(f"{rel}: CSV con columnas OHLC sin el rótulo de simulación didáctica")
    if p.suffix in (".md", ".json", ".csv", ".txt"):
        for m in MARCAS_LIBRO:
            if m in t: problemas.append(f"{rel}: contiene una marca de página del libro («{m}»)")
    if p.suffix not in (".py",):
        for r_ in PINE:
            if re.search(r_, t) and p.suffix in (".ts", ".mts", ".md", ".txt", ".pine"): problemas.append(f"{rel}: posible código Pine ({r_})")
import hashlib
for sums in sorted(RAIZ.rglob("SHA256SUMS.txt")):
    for linea in sums.read_text().splitlines():
        if not linea.strip(): continue
        h, nombre = linea.split(None, 1)
        f = sums.parent / nombre.strip()
        if not f.exists() or hashlib.sha256(f.read_bytes()).hexdigest() != h:
            problemas.append(f"{sums.relative_to(RAIZ)}: {nombre.strip()} no coincide con su huella")
if problemas:
    print("AUDITORÍA DEL PAQUETE: FALLA"); [print("  -", x) for x in problemas]; sys.exit(1)
print(f"8. Auditoría del paquete: {n} archivos revisados; 0 prohibidos (sin PDF, imágenes, Pine, datos crudos, extractos ni rutas externas)")
