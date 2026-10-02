#!/usr/bin/env python3
"""Optimiza (recomprime imágenes, limpia objetos) los PDF de public/assets/productos/fichas.
Los originales del fabricante se conservan en '0 IME/Fabricantes'. Idempotente: solo reemplaza si el
resultado es al menos 5 % menor. Cada archivo se procesa en un subproceso porque PyMuPDF puede
terminar con segfault en PDFs defectuosos; en ese caso se conserva el original.
Uso: python3 scripts/optimize-fichas-pdf.py [directorio]"""
import sys, os, glob, subprocess

def optimize_one(path):
    import fitz
    d = fitz.open(path)
    try:
        grande = os.path.getsize(path) > 2_000_000
        d.rewrite_images(dpi_threshold=110 if grande else 130, dpi_target=80 if grande else 100, quality=50 if grande else 60)
    except Exception:
        pass
    tmp = path + '.tmp'
    d.save(tmp, garbage=4, deflate=True, clean=True)
    d.close()
    if os.path.getsize(tmp) < os.path.getsize(path) * 0.95:
        os.replace(tmp, path)
    else:
        os.remove(tmp)

if len(sys.argv) > 2 and sys.argv[1] == '--one':
    optimize_one(sys.argv[2]); sys.exit(0)

root = sys.argv[1] if len(sys.argv) > 1 else 'public/assets/productos/fichas'
tot0 = tot1 = 0; fallos = []
for f in sorted(glob.glob(root + '/**/*.pdf', recursive=True)):
    s0 = os.path.getsize(f)
    r = subprocess.run([sys.executable, __file__, '--one', f], capture_output=True, timeout=300)
    if r.returncode != 0:
        fallos.append(f)
        if os.path.exists(f + '.tmp'): os.remove(f + '.tmp')
    tot0 += s0; tot1 += os.path.getsize(f)
print(f'{tot0/1e6:.1f} MB -> {tot1/1e6:.1f} MB; sin optimizar por error: {len(fallos)}')
for f in fallos: print('  ', f)
