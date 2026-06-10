# VALIDACION VISUAL — F0

## Estado actual del sitio (i-me.com.co/77/)

| Elemento          | Estado                       | Notas                                                   |
| ----------------- | ---------------------------- | ------------------------------------------------------- |
| Paleta de colores | Extraído vía computed style  | Revisar CSS fuente en `public/assets/extraccion/css/`   |
| Tipografía        | Detectada por computed style | Verificar @font-face y weights exactos                  |
| Logo              | ✓ Descargado                 | `public/assets/extraccion/img/logo-ime.png`             |
| Video hero        | ✓ Descargado                 | `public/assets/extraccion/video/quirofano-completo.mp4` |
| Animaciones       | GSAP detectado               | Confirmar librerías exactas inspeccionando network      |
| Imágenes producto | ✓ 15 descargadas             | `public/assets/extraccion/img/ImgXX.jpg`                |

## Tokens extraídos

Ver `src/styles/tokens-extraidos.json` y `public/assets/extraccion/css/` para CSS fuente.

Los tokens CSS custom properties deben confirmarse en F1 antes de construir `globals.css`.

## Pendiente de validación visual (NO_EJECUTADO_ENTORNO)

- Comparar visualmente el sitio actual con el diseño extraído
- Confirmar paleta exacta (HEX/HSL) desde CSS fuente descargado
- Verificar pesos tipográficos y URLs de @font-face
- Confirmar breakpoints de responsive design
