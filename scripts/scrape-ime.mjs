/**
 * F0 — Scraping fiel de i-me.com.co/77/
 * Extrae catálogo, contenido institucional, tokens y assets.
 * REGLA: capturar, no crear. Cero invención.
 */

import { chromium } from 'playwright'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DATA_DIR = join(ROOT, 'src', 'data')
const STYLES_DIR = join(ROOT, 'src', 'styles')
const ASSETS_DIR = join(ROOT, 'public', 'assets', 'extraccion')

const BASE_URL = 'https://i-me.com.co/77'
const OLD_URL = 'https://i-me.com.co/1old'

const FAMILIAS_ESPERADAS = [
  'monitores',
  'cardiologia',
  'sala-cirugia',
  'neonatologia',
  'ultrasonido',
  'soluciones-iv',
  'mobiliario',
  'anestesia',
]

function guardar(ruta, dato) {
  const dir = dirname(ruta)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(ruta, JSON.stringify(dato, null, 2), 'utf8')
  console.log(`✓ Guardado: ${ruta.replace(ROOT, '.')}`)
}

function slugify(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function descargarAsset(url, destino, page) {
  try {
    const response = await page.request.get(url)
    if (response.ok()) {
      const buffer = await response.body()
      const dir = dirname(destino)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      writeFileSync(destino, buffer)
      return { estado: 'ok', bytes: buffer.length }
    }
    return { estado: '404', bytes: 0 }
  } catch {
    return { estado: 'error', bytes: 0 }
  }
}

async function main() {
  console.log('\n=== F0 — SCRAPING I-ME ===\n')

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })
  const page = await context.newPage()

  // ──────────────────────────────────────
  // 1. DETECTAR FUENTE DE DATOS DEL CATÁLOGO
  // ──────────────────────────────────────
  console.log('1. Buscando fuente de datos del catálogo...')

  let fuenteDatos = null
  const interceptados = []

  page.on('response', async (response) => {
    const url = response.url()
    const ct = response.headers()['content-type'] || ''
    if ((ct.includes('json') || url.endsWith('.json')) && url.includes('i-me.com.co')) {
      try {
        const texto = await response.text()
        interceptados.push({ url, texto: texto.slice(0, 500) })
      } catch {
        // ignorar
      }
    }
  })

  await page.goto(`${BASE_URL}/catalogo.html`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(3000)

  // Intentar encontrar datos JS embebidos
  const datosJS = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script:not([src])'))
    const encontrados = []
    for (const s of scripts) {
      const t = s.textContent || ''
      if (
        t.includes('productos') ||
        t.includes('catalogo') ||
        t.includes('familias') ||
        t.includes('data')
      ) {
        encontrados.push(t.slice(0, 2000))
      }
    }
    return encontrados
  })

  if (datosJS.length > 0) {
    writeFileSync(
      join(DATA_DIR, 'raw_scripts_catalogo.txt'),
      datosJS.join('\n\n---\n\n'),
      'utf8'
    )
    console.log(`  → ${datosJS.length} script(s) con posibles datos encontrados`)
    fuenteDatos = 'dom-scripts'
  }

  if (interceptados.length > 0) {
    guardar(join(DATA_DIR, 'raw_requests_interceptados.json'), interceptados)
    fuenteDatos = 'fetch-intercept'
  }

  // ──────────────────────────────────────
  // 2. EXTRAER CATÁLOGO VÍA DOM RENDER
  // ──────────────────────────────────────
  console.log('\n2. Extrayendo catálogo por render DOM...')

  const productos = []

  // Extraer catálogo de CADA familia
  for (const familia of FAMILIAS_ESPERADAS) {
    console.log(`  → Familia: ${familia}`)
    await page.goto(`${BASE_URL}/catalogo.html?cat=${familia}`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    })
    await page.waitForTimeout(2000)

    // Esperar que cargue contenido dinámico
    try {
      await page.waitForSelector(
        '.producto-card, .product-card, .card, [class*="product"], [class*="producto"]',
        { timeout: 5000 }
      )
    } catch {
      // No apareció selector específico, continuar con lo que hay
    }

    const productosDOM = await page.evaluate(
      (familiaSlug) => {
        const selectores = [
          '.producto-card',
          '.product-card',
          '.card',
          '[class*="product-item"]',
          '[class*="producto-item"]',
          'article',
          '.item',
        ]

        let cards = []
        for (const sel of selectores) {
          const encontrados = Array.from(document.querySelectorAll(sel))
          if (encontrados.length > 0) {
            cards = encontrados
            break
          }
        }

        return cards.map((card) => {
          const nombre =
            card.querySelector('h2, h3, h4, .titulo, .nombre, .product-title')?.textContent?.trim() ||
            ''
          const descripcion =
            card
              .querySelector('p, .descripcion, .description, .resumen')
              ?.textContent?.trim() || ''
          const imagen =
            card.querySelector('img')?.getAttribute('src') ||
            card.querySelector('img')?.getAttribute('data-src') ||
            ''
          const enlace = card.querySelector('a')?.getAttribute('href') || ''
          const badge =
            card.querySelector('.badge, .tag, .destacado, .nuevo')?.textContent?.trim() || ''

          return {
            nombre,
            descripcion_corta: descripcion.slice(0, 300),
            imagen_principal: imagen,
            url_origen: enlace,
            familia: familiaSlug,
            badge_raw: badge,
            destacado: badge.toLowerCase().includes('destac'),
            nuevo: badge.toLowerCase().includes('nuevo'),
            slug: '',
            slug_generado: true,
            tipo: null,
            notas_extraccion: `Extraído de catálogo?cat=${familiaSlug}`,
          }
        })
      },
      familia
    )

    // Filtrar vacíos y generar slugs
    const validos = productosDOM.filter((p) => p.nombre && p.nombre.length > 2)
    for (const p of validos) {
      p.slug = slugify(p.nombre)
      productos.push(p)
    }

    console.log(`     ${validos.length} producto(s) encontrado(s)`)
  }

  // ──────────────────────────────────────
  // 3. EXTRAER PRODUCTOS DESTACADOS DE HOME
  // ──────────────────────────────────────
  console.log('\n3. Extrayendo destacados de Home...')
  await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(2000)

  const destacadosHome = await page.evaluate(() => {
    const secciones = Array.from(
      document.querySelectorAll(
        '.productos-destacados, .featured-products, .equipos-destacados, .destacados, [class*="destac"]'
      )
    )
    const items = []
    for (const sec of secciones) {
      const cards = Array.from(
        sec.querySelectorAll('.card, .producto-card, article, .item, [class*="product"]')
      )
      for (const card of cards) {
        const nombre =
          card.querySelector('h2, h3, h4, .titulo, .nombre')?.textContent?.trim() || ''
        const img =
          card.querySelector('img')?.getAttribute('src') ||
          card.querySelector('img')?.getAttribute('data-src') ||
          ''
        const link = card.querySelector('a')?.getAttribute('href') || ''
        if (nombre) items.push({ nombre, imagen_principal: img, url_origen: link, destacado: true })
      }
    }
    return items
  })

  // Merge destacados: si ya existe el producto, marcar como destacado
  for (const d of destacadosHome) {
    const existente = productos.find(
      (p) => p.nombre.toLowerCase() === d.nombre.toLowerCase()
    )
    if (existente) {
      existente.destacado = true
    } else if (d.nombre.length > 2) {
      productos.push({
        ...d,
        descripcion_corta: '',
        familia: 'sin-clasificar',
        tipo: null,
        slug: slugify(d.nombre),
        slug_generado: true,
        badge_raw: 'destacado',
        notas_extraccion: 'Extraído de Home destacados',
      })
    }
  }

  // ──────────────────────────────────────
  // 4. EXTRAER CONTENIDO INSTITUCIONAL
  // ──────────────────────────────────────
  console.log('\n4. Extrayendo contenido institucional...')

  await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(1000)

  const contenidoHome = await page.evaluate(() => {
    const getAll = (sel) =>
      Array.from(document.querySelectorAll(sel))
        .map((el) => el.textContent?.trim())
        .filter(Boolean)

    return {
      claim_hero: getText('.hero h1, .hero-titulo, [class*="hero"] h1') || getText('h1'),
      subclaim_hero:
        getText('.hero p, .hero-subtitulo, [class*="hero"] p') || getText('header p'),
      ctas_hero: getAll('.hero a, [class*="hero"] a').slice(0, 3),
      slogan: getText('.slogan, [class*="slogan"]'),
      metricas: getAll('.metrica, .metric, .stat, [class*="metric"], [class*="stat"]').slice(
        0,
        10
      ),
      servicios: getAll('.servicio, .service, [class*="servicio"], [class*="service"]').slice(
        0,
        10
      ),
      valores: getAll('.valor, .value, [class*="valor"]').slice(0, 10),
      faq_preguntas: getAll('.faq .pregunta, .faq h3, .faq dt, .accordion .title').slice(0, 20),
      faq_respuestas: getAll('.faq .respuesta, .faq p, .faq dd, .accordion .content').slice(
        0,
        20
      ),
      quienes_somos: getText('.quienes-somos, [class*="about"], [class*="quienes"]'),
      vision: getText('.vision, [class*="vision"]'),
      mision: getText('.mision, [class*="mision"]'),
      whatsapp:
        document.querySelector('[href*="wa.me"], [href*="whatsapp"]')?.getAttribute('href') ||
        null,
      email:
        document.querySelector('[href*="mailto"]')?.getAttribute('href')?.replace('mailto:', '') ||
        null,
      copyright: getText('footer .copyright, footer small, footer p:last-child'),
    }
  })

  // Contacto
  await page.goto(`${BASE_URL}/contacto.html`, { waitUntil: 'networkidle', timeout: 30000 })
  const contenidoContacto = await page.evaluate(() => {
    const getText = (sel) => document.querySelector(sel)?.textContent?.trim() || null
    return {
      whatsapp:
        document.querySelector('[href*="wa.me"], [href*="whatsapp"]')?.getAttribute('href') || null,
      email:
        document.querySelector('[href*="mailto"]')?.getAttribute('href')?.replace('mailto:', '') ||
        null,
      telefono: getText('.telefono, [class*="phone"], [href^="tel"]'),
      direccion: getText('.direccion, .address, [class*="address"]'),
      campos_formulario: Array.from(
        document.querySelectorAll('form input, form textarea, form select')
      )
        .map((el) => ({
          tipo: el.tagName.toLowerCase(),
          name: el.getAttribute('name') || '',
          placeholder: el.getAttribute('placeholder') || '',
          requerido: el.hasAttribute('required'),
        }))
        .filter((f) => f.name),
    }
  })

  // Servicios
  await page.goto(`${BASE_URL}/servicios.html`, { waitUntil: 'networkidle', timeout: 30000 })
  const contenidoServicios = await page.evaluate(() => {
    const getText = (sel) => document.querySelector(sel)?.textContent?.trim() || null
    const getAll = (sel) =>
      Array.from(document.querySelectorAll(sel))
        .map((el) => el.textContent?.trim())
        .filter(Boolean)
    return {
      titulo: getText('h1, .titulo-principal'),
      servicios: getAll('.servicio, .service-item, article, .card').slice(0, 10),
    }
  })

  // Footer
  const footer = await page.evaluate(() => {
    const footer = document.querySelector('footer')
    if (!footer) return null
    return {
      html_reducido: footer.innerText?.slice(0, 2000) || null,
      links: Array.from(footer.querySelectorAll('a'))
        .map((a) => ({ texto: a.textContent?.trim(), href: a.getAttribute('href') }))
        .filter((l) => l.texto),
    }
  })

  // ──────────────────────────────────────
  // 5. FINANCIACIÓN DESDE /1old
  // ──────────────────────────────────────
  console.log('\n5. Extrayendo financiación de /1old...')
  let financiacion = {
    fuente: OLD_URL,
    copy: [],
    plazos_mencionados: [],
    condiciones_mencionadas: [],
    tasas: null,
    tabla: null,
    simulador_fuente: null,
    advertencias: ['No hay tasas reales publicadas'],
  }

  try {
    await page.goto(OLD_URL, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(1500)

    financiacion = await page.evaluate((baseFinanciacion) => {
      const getAll = (sel) =>
        Array.from(document.querySelectorAll(sel))
          .map((el) => el.textContent?.trim())
          .filter(Boolean)

      const textoCompleto = document.body?.innerText || ''
      const plazos = []
      const meses = textoCompleto.match(/\d+\s*meses?/gi) || []
      plazos.push(...new Set(meses))

      const copy = getAll(
        '.financiacion p, .financing p, [class*="financ"] p, .contenido-financiacion p'
      ).slice(0, 20)
      if (copy.length === 0) {
        const parrafos = getAll('p').slice(0, 30)
        copy.push(...parrafos)
      }

      return {
        fuente: baseFinanciacion.fuente,
        copy: copy.filter((t) => t.length > 20).slice(0, 15),
        plazos_mencionados: plazos,
        condiciones_mencionadas: [],
        tasas: null,
        tabla: null,
        simulador_fuente: null,
        advertencias: [
          'No hay tasas reales publicadas',
          'Solo copy extraído — revisión humana obligatoria antes de publicar',
        ],
      }
    }, financiacion)
  } catch (e) {
    console.warn(`  ⚠ No se pudo acceder a /1old: ${e.message}`)
  }

  // ──────────────────────────────────────
  // 6. TOKENS VISUALES (CSS)
  // ──────────────────────────────────────
  console.log('\n6. Extrayendo tokens visuales...')

  await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'networkidle', timeout: 30000 })

  const tokensCSS = await page.evaluate(() => {
    const colores = new Set()
    const fuentes = new Set()
    const customProps = {}

    // CSS custom properties desde :root
    const rootStyle = getComputedStyle(document.documentElement)
    const rootProps = Array.from(document.styleSheets)
      .flatMap((sheet) => {
        try {
          return Array.from(sheet.cssRules || [])
        } catch {
          return []
        }
      })
      .filter((rule) => rule.selectorText === ':root')
      .flatMap((rule) => Array.from(rule.style))

    for (const prop of rootProps) {
      if (prop.startsWith('--')) {
        customProps[prop] = rootStyle.getPropertyValue(prop).trim()
      }
    }

    // Font families detectadas
    const todoTexto = document.querySelectorAll('h1, h2, h3, p, .titulo, nav a, button')
    for (const el of todoTexto) {
      const ff = getComputedStyle(el).fontFamily
      if (ff) fuentes.add(ff)
    }

    // Colores principales
    const elementos = document.querySelectorAll(
      'header, nav, footer, .btn, button, .cta, h1, h2, .hero, .banner'
    )
    for (const el of elementos) {
      const s = getComputedStyle(el)
      if (s.color && s.color !== 'rgba(0, 0, 0, 0)') colores.add(s.color)
      if (s.backgroundColor && s.backgroundColor !== 'rgba(0, 0, 0, 0)')
        colores.add(s.backgroundColor)
    }

    // Links de hojas de estilo
    const cssLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(
      (l) => l.href
    )

    return {
      css_links: cssLinks,
      custom_properties: customProps,
      colores_detectados: Array.from(colores).slice(0, 30),
      fuentes_detectadas: Array.from(fuentes).slice(0, 10),
      nota: 'Tokens aproximados por computed style — revisar CSS fuente para valores exactos',
    }
  })

  // Descargar CSS fuente para análisis offline
  const cssUrls = tokensCSS.css_links || []
  const cssDescargados = []
  for (const cssUrl of cssUrls.slice(0, 5)) {
    try {
      const resp = await page.request.get(cssUrl)
      if (resp.ok()) {
        const contenido = await resp.text()
        const nombre = cssUrl.split('/').pop()?.split('?')[0] || 'styles.css'
        const ruta = join(ASSETS_DIR, 'css', nombre)
        const dir = dirname(ruta)
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
        writeFileSync(ruta, contenido, 'utf8')
        cssDescargados.push({ url: cssUrl, local: `public/assets/extraccion/css/${nombre}` })
      }
    } catch {
      // ignorar
    }
  }

  // ──────────────────────────────────────
  // 7. MANIFEST DE ASSETS
  // ──────────────────────────────────────
  console.log('\n7. Descargando assets...')

  const assetsManifest = []

  // Logo
  const logoUrl = `${BASE_URL}/assets/img/logo-ime.png`
  const logoPath = join(ASSETS_DIR, 'img', 'logo-ime.png')
  const logoResult = await descargarAsset(logoUrl, logoPath, page)
  assetsManifest.push({
    nombre: 'logo-ime.png',
    url_origen: logoUrl,
    ruta_local: 'public/assets/extraccion/img/logo-ime.png',
    tipo: 'img',
    uso: 'logo principal',
    ...logoResult,
  })

  // Video hero
  const videoUrl = `${BASE_URL}/assets/video/quirofano-completo.mp4`
  const videoPath = join(ASSETS_DIR, 'video', 'quirofano-completo.mp4')
  const videoResult = await descargarAsset(videoUrl, videoPath, page)
  assetsManifest.push({
    nombre: 'quirofano-completo.mp4',
    url_origen: videoUrl,
    ruta_local: 'public/assets/extraccion/video/quirofano-completo.mp4',
    tipo: 'video',
    uso: 'video hero home',
    ...videoResult,
  })

  // Imágenes de portfolio detectadas en los productos
  const imagenesProductos = [
    ...new Set(
      productos
        .map((p) => p.imagen_principal)
        .filter((img) => img && img.includes('i-me.com.co'))
    ),
  ]

  for (const imgUrl of imagenesProductos.slice(0, 20)) {
    const nombre = imgUrl.split('/').pop()?.split('?')[0] || 'img.jpg'
    const destino = join(ASSETS_DIR, 'img', nombre)
    const resultado = await descargarAsset(imgUrl, destino, page)
    assetsManifest.push({
      nombre,
      url_origen: imgUrl,
      ruta_local: `public/assets/extraccion/img/${nombre}`,
      tipo: 'img',
      uso: 'imagen de producto',
      ...resultado,
    })
  }

  // ──────────────────────────────────────
  // 8. GUARDAR TODOS LOS ARTEFACTOS
  // ──────────────────────────────────────
  console.log('\n8. Guardando artefactos...')

  const fechaExtraccion = new Date().toISOString()
  const metodo =
    productos.length > 0 ? fuenteDatos || 'dom-render' : 'fallback-home'

  // extraccion_ime.json
  const familiasSlugs = [
    ...new Set(productos.filter((p) => p.familia !== 'sin-clasificar').map((p) => p.familia)),
  ]
  const familiasFinales = [
    ...familiasSlugs.map((slug) => ({
      slug,
      nombre: slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      descripcion: '',
      url_origen: `${BASE_URL}/catalogo.html?cat=${slug}`,
    })),
  ]

  // Deduplicar productos por slug
  const productosUnicos = []
  const slugsVistos = new Set()
  for (const p of productos) {
    if (!slugsVistos.has(p.slug) && p.nombre.length > 2) {
      slugsVistos.add(p.slug)
      productosUnicos.push({
        slug: p.slug,
        slug_generado: p.slug_generado,
        nombre: p.nombre,
        familia: p.familia,
        tipo: p.tipo,
        descripcion_corta: p.descripcion_corta || '',
        descripcion_larga: '',
        especificaciones: [],
        specs_raw: '',
        imagen_principal: p.imagen_principal || '',
        galeria: [],
        ficha_pdf: null,
        badges: p.badge_raw ? [p.badge_raw] : [],
        destacado: p.destacado || false,
        nuevo: p.nuevo || false,
        url_origen: p.url_origen || '',
        notas_extraccion: p.notas_extraccion || '',
      })
    }
  }

  guardar(join(DATA_DIR, 'extraccion_ime.json'), {
    fuente: `${BASE_URL}/`,
    fecha_extraccion: fechaExtraccion,
    metodo_extraccion: metodo,
    familias: familiasFinales,
    productos: productosUnicos,
    conteo: { familias: familiasFinales.length, productos: productosUnicos.length },
  })

  // contenido_ime.json
  guardar(join(DATA_DIR, 'contenido_ime.json'), {
    fuente: `${BASE_URL}/`,
    fecha_extraccion: fechaExtraccion,
    home: contenidoHome,
    servicios: contenidoServicios,
    contacto: contenidoContacto,
    footer,
  })

  // financiacion_referencia.json
  guardar(join(DATA_DIR, 'financiacion_referencia.json'), financiacion)

  // tokens-extraidos.json
  guardar(join(STYLES_DIR, 'tokens-extraidos.json'), {
    fuente: `${BASE_URL}/`,
    fecha_extraccion: fechaExtraccion,
    ...tokensCSS,
    css_descargados: cssDescargados,
    nota_uso:
      'Revisar CSS fuente en public/assets/extraccion/css/ para extraer variables exactas',
  })

  // assets_manifest.json
  guardar(join(DATA_DIR, 'assets_manifest.json'), assetsManifest)

  await browser.close()

  // ──────────────────────────────────────
  // REPORTE FINAL
  // ──────────────────────────────────────
  console.log('\n=== REPORTE F0 ===')
  console.log(`Familias extraídas: ${familiasFinales.length}`)
  console.log(`Productos únicos: ${productosUnicos.length}`)
  console.log(`Destacados: ${productosUnicos.filter((p) => p.destacado).length}`)
  console.log(`Assets: ${assetsManifest.length} (ok: ${assetsManifest.filter((a) => a.estado === 'ok').length})`)
  console.log(
    `\nPENDIENTES a revisar en extraccion_ime.json:`
  )
  console.log(
    `  - Tipos/subcategorías de productos → TODO_CLIENTE`
  )
  console.log(
    `  - Specs estructuradas → vacías, revisar fichas PDF → TODO_CLIENTE`
  )
  console.log(
    `  - Traducción EN → COPY_CLIENTE_REVISAR`
  )
  console.log(
    `  - Tasas de financiación → BLOQUEANTE_LEGAL`
  )
  console.log('\n✓ F0 completado. Revisar src/data/ y src/styles/ antes de F1.\n')
}

main().catch((e) => {
  console.error('Error en scraping:', e)
  process.exit(1)
})
