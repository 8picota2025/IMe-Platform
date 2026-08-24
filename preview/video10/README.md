# Video10 IME — preview

Guion canónico: [`transcripcion.md`](./transcripcion.md). Shot list: [`shot-list.md`](./shot-list.md). EDL: [`montage.json`](./montage.json).

## Cut OpenMontage (actual)

- [`video10-openmontage.mp4`](./video10-openmontage.mp4) — 1 min 40 s, 1280×720, crossfade 0,4 s
- Descarga: https://d2ol7oe51mr4n9.cloudfront.net/user_3F8roacBthPxBnPzKbIAwYTMBvz/23de2d6e-e2a1-4932-8dda-7eae6d4d00cf.mp4
- Escenas sueltas (zip, 6 MP4): https://d2ol7oe51mr4n9.cloudfront.net/user_3F8roacBthPxBnPzKbIAwYTMBvz/0fc7e40a-b9f9-451e-b9b3-02c62f305bb7.zip
- Reproducción: [`index.html`](./index.html)

Escenas incluidas: 0 apertura, 1 compra, 2 IME, 3 líneas de producto, 5 financiación, 7 CTA+lockup.  
No incluidas (sin créditos Higgsfield): 4 acompañamiento, 6 aliado.

Cuando recargues crédito, generar 4 y 6 (Seedance 2.5, 16:9, 480p si el saldo es justo), copiar `s04.mp4` y `s06.mp4` en `scenes/`, insertarlas en `montage.json` y volver a renderizar:

```bash
open-montage render montage.json -o video10-openmontage.mp4 \
  --fps 24 --size 1280x720 --fit cover --transition 0.4
```

## Cut ffmpeg previo (hard cut, sin transiciones)

- [`video10-full.mp4`](./video10-full.mp4) — 1 min 42 s, 1280×720

## Preview low-res (validación previa)

- [`preview-480p.mp4`](./preview-480p.mp4) (5 s, 16:9, 480p)
