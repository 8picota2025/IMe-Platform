/* ================================================================
   I-ME CMS v2 — localStorage catalog management
   ================================================================ */

'use strict'

const CMS_KEY = 'ime_products_v2'
const CMS_PASS = 'imecms2024'

const DEFAULT_PRODUCTS = [
  {
    id: 1,
    name: 'Monitor Multiparamétrico UCI Avanzado',
    cat: 'monitores',
    img: 'assets/img/portfolio/Img11.jpg',
    desc: 'Monitor táctil 15" para UCI. SpO2, NIBP, ECG 5 deriv., temperatura, capnografía. Alarmas inteligentes, conectividad DICOM.',
  },
  {
    id: 2,
    name: 'Monitor Multiparamétrico Básico',
    cat: 'monitores',
    img: 'assets/img/portfolio/Img1.jpg',
    desc: 'Monitor de signos vitales para hospitalización general. SpO2, NIBP, ECG 3 derivaciones, temperatura. Pantalla 10".',
  },
  {
    id: 3,
    name: 'Monitor de Transporte Prehospitalario',
    cat: 'monitores',
    img: 'assets/img/portfolio/Img19.jpg',
    desc: 'Monitor compacto para ambulancias y traslados. Batería 4 horas, resistente a golpes, todas las variables vitales.',
  },
  {
    id: 4,
    name: 'Monitor Central UCI Multicama',
    cat: 'monitores',
    img: 'assets/img/portfolio/Img18.jpg',
    desc: 'Estación central de monitoreo para gestión de camas en UCI. Hasta 32 monitores por central, alertas inteligentes.',
  },
  {
    id: 5,
    name: 'Electrocardiógrafo 12 Derivaciones Digital',
    cat: 'cardiologia',
    img: 'assets/img/portfolio/Img6.jpg',
    desc: 'ECG de 12 derivaciones con interpretación automática. Impresión térmica integrada, conectividad USB y red.',
  },
  {
    id: 6,
    name: 'Desfibrilador Bifásico con Monitor',
    cat: 'cardiologia',
    img: 'assets/img/portfolio/Img6.jpg',
    desc: 'Desfibrilador bifásico con monitoreo ECG, marcapasos externo y capnografía. Carga en menos de 7 segundos.',
  },
  {
    id: 7,
    name: 'Holter 24 Horas Ritmo Cardíaco',
    cat: 'cardiologia',
    img: 'assets/img/portfolio/Img21.jpg',
    desc: 'Sistema Holter ambulatorio de 24 horas. Análisis automático de arritmias, taquicardias y bloqueos cardíacos.',
  },
  {
    id: 8,
    name: 'Mesa Quirúrgica Motorizada Multiposición',
    cat: 'sala-cirugia',
    img: 'assets/img/portfolio/Img4.jpg',
    desc: 'Mesa quirúrgica eléctrica con 6 posiciones motorizadas. Control por pedal y mando remoto. Altura ajustable 650–950mm.',
  },
  {
    id: 9,
    name: 'Lámpara Cialítica LED Doble para Quirófano',
    cat: 'sala-cirugia',
    img: 'assets/img/portfolio/Img22.jpg',
    desc: 'Doble lámpara LED de 120.000 lux para quirófano. Sin sombras, temperatura de color 4500K, brazo de montaje en techo.',
  },
  {
    id: 10,
    name: 'Máquina de Anestesia con Ventilador',
    cat: 'anestesia',
    img: 'assets/img/portfolio/Img4.jpg',
    desc: 'Máquina de anestesia con ventilador integrado. Vaporizadores intercambiables para sevoflurano e isoflurano. Monitor de agente.',
  },
  {
    id: 11,
    name: 'Incubadora Neonatal de Transporte',
    cat: 'neonatologia',
    img: 'assets/img/portfolio/Img25.jpg',
    desc: 'Incubadora neonatal de transporte con servo-temperatura, SpO2 integrado y batería de larga duración para traslados UCI.',
  },
  {
    id: 12,
    name: 'Cuna de Calor Radiante Neonatal Servo',
    cat: 'neonatologia',
    img: 'assets/img/portfolio/Img14.jpg',
    desc: 'Cuna de calor radiante con control servo-temperatura, fototerapia integrada y monitoreo de temperatura cutánea continuo.',
  },
  {
    id: 13,
    name: 'Ecógrafo Color Doppler Diagnóstico Vascular',
    cat: 'ultrasonido',
    img: 'assets/img/portfolio/Img27.jpg',
    desc: 'Ecógrafo con Color Doppler y Power Doppler. Sondas multifrecuencia para aplicaciones abdominales, obstétricas y vasculares. DICOM WiFi.',
  },
  {
    id: 14,
    name: 'Ecógrafo Portátil con WiFi y DICOM',
    cat: 'ultrasonido',
    img: 'assets/img/portfolio/Img26.jpg',
    desc: 'Ecógrafo portátil inalámbrico con conectividad WiFi y soporte DICOM. Ideal para urgencias y uso en consultorio.',
  },
  {
    id: 15,
    name: 'Ultrasonido Point-of-Care Pocket',
    cat: 'ultrasonido',
    img: 'assets/img/portfolio/Img28.jpg',
    desc: 'Ecógrafo de bolsillo para smartphone. Sonda lineal y convexa, conectividad WiFi, batería 1 hora de uso continuo.',
  },
  {
    id: 16,
    name: 'Bomba de Infusión Volumétrica UCI',
    cat: 'soluciones-iv',
    img: 'assets/img/portfolio/Img2.jpg',
    desc: 'Bomba de infusión volumétrica de alta precisión. Control 0.1–1200 ml/h, alarmas de oclusión y aire, antibolus. Sets universales.',
  },
  {
    id: 17,
    name: 'Bomba de Jeringa Precisión Microdosis',
    cat: 'soluciones-iv',
    img: 'assets/img/portfolio/Img2.jpg',
    desc: 'Bomba de jeringa para microdosis en UCI. Exactitud ±2%, rango 0.1–1500 ml/h, compatible jeringas 10–60 ml.',
  },
  {
    id: 18,
    name: 'Camilla Hospitalaria Eléctrica Articulable',
    cat: 'mobiliario',
    img: 'assets/img/portfolio/Img7.jpg',
    desc: 'Camilla hospitalaria eléctrica de 4 secciones. Control por botonera, barandas abatibles, capacidad 250 kg.',
  },
  {
    id: 19,
    name: 'Carro de Paro para Reanimación',
    cat: 'mobiliario',
    img: 'assets/img/portfolio/Img7.jpg',
    desc: 'Carro de paro con candado central, bandeja de desfibrilador, cajones numerados y porta-monitor. Acero inoxidable.',
  },
  {
    id: 20,
    name: 'Monitor Fetal CTG con Impresora',
    cat: 'neonatologia',
    img: 'assets/img/portfolio/Img14.jpg',
    desc: 'Monitor de bienestar fetal con cardiotocografía. Pantalla táctil a color, impresión térmica integrada, STAN opcional.',
  },
  {
    id: 21,
    name: 'Electrocardiógrafo Inalámbrico Portátil',
    cat: 'cardiologia',
    img: 'assets/img/portfolio/Img21.jpg',
    desc: 'ECG de 12 derivaciones inalámbrico con transmisión a tablet o PC. Interpretación automática, almacenamiento de 100 ECGs.',
  },
  {
    id: 22,
    name: 'Sistema CPAP Neonatal para UCI',
    cat: 'neonatologia',
    img: 'assets/img/portfolio/Img25.jpg',
    desc: 'Sistema CPAP neonatal de flujo variable con generador de burbujas. Presión ajustable 2–10 cmH2O. Circuito desechable.',
  },
  {
    id: 23,
    name: 'Mesa Quirúrgica Ortopédica Radiolúcida',
    cat: 'sala-cirugia',
    img: 'assets/img/portfolio/Img22.jpg',
    desc: 'Mesa quirúrgica ortopédica con accesorios para cirugía de cadera y columna. Radiolúcida, superficie de carbono.',
  },
  {
    id: 24,
    name: 'Ventilador Mecánico UCI Adulto-Pediátrico',
    cat: 'anestesia',
    img: 'assets/img/portfolio/Img4.jpg',
    desc: 'Ventilador mecánico para UCI adultos y pediatría. Modos AC, SIMV, CPAP, APRV, NAVA. Módulo de monitoreo integrado.',
  },
]

const CATEGORIES = {
  monitores: 'Monitores',
  cardiologia: 'Cardiología',
  'sala-cirugia': 'Sala de Cirugía',
  neonatologia: 'Neonatología',
  ultrasonido: 'Ultrasonido',
  'soluciones-iv': 'Soluciones IV',
  mobiliario: 'Mobiliario',
  anestesia: 'Anestesia',
}

const CMS = {
  load() {
    try {
      const d = localStorage.getItem(CMS_KEY)
      return d ? JSON.parse(d) : [...DEFAULT_PRODUCTS]
    } catch {
      return [...DEFAULT_PRODUCTS]
    }
  },
  save(products) {
    try {
      localStorage.setItem(CMS_KEY, JSON.stringify(products))
    } catch {}
  },
  add(product) {
    const products = this.load()
    product.id = Date.now()
    products.push(product)
    this.save(products)
    return product
  },
  update(id, data) {
    const products = this.load()
    const idx = products.findIndex((p) => p.id == id)
    if (idx !== -1) {
      products[idx] = { ...products[idx], ...data }
      this.save(products)
    }
  },
  delete(id) {
    const products = this.load().filter((p) => p.id != id)
    this.save(products)
  },
  isLoggedIn() {
    return sessionStorage.getItem('ime_cms_auth') === '1'
  },
  login(pass) {
    if (pass === CMS_PASS) {
      sessionStorage.setItem('ime_cms_auth', '1')
      return true
    }
    return false
  },
  logout() {
    sessionStorage.removeItem('ime_cms_auth')
  },
}

/* ── Render catálogo desde CMS ─────────────────────────── */
function renderCatalogFromCMS() {
  const grid = document.getElementById('productsGrid')
  if (!grid) return
  const products = CMS.load()
  grid.innerHTML = ''
  products.forEach((p, i) => {
    const catLabel = CATEGORIES[p.cat] || p.cat
    const delay = (i % 3) * 0.1
    const card = document.createElement('article')
    card.className = 'product-card fade-in'
    card.setAttribute('data-category', p.cat)
    card.setAttribute('role', 'listitem')
    card.style.transitionDelay = delay + 's'
    card.innerHTML = `
      <div class="product-img-wrap" onclick="openProductModal(${JSON.stringify(p.name)},${JSON.stringify(p.desc)},${JSON.stringify(p.img)},${JSON.stringify(catLabel)})">
        <img src="${p.img}" alt="${p.name} — equipo biomédico Colombia" width="400" height="280" loading="lazy" />
        <div class="product-cat-badge">${catLabel}</div>
      </div>
      <div class="product-body">
        <h3 class="product-name">${p.name}</h3>
        <p class="product-desc">${p.desc}</p>
        <div class="product-footer">
          <button class="btn btn-primary btn-sm" onclick="openProductModal(${JSON.stringify(p.name)},${JSON.stringify(p.desc)},${JSON.stringify(p.img)},${JSON.stringify(catLabel)})">Ver detalles</button>
          <button class="btn btn-outline btn-sm" onclick="openWhatsApp(${JSON.stringify(p.name)})"><i class="fab fa-whatsapp"></i> Cotizar</button>
        </div>
      </div>`
    grid.appendChild(card)
  })

  // re-trigger IntersectionObserver
  if (window.io) {
    grid.querySelectorAll('.fade-in').forEach((el) => {
      if (window.io) window.io.observe(el)
    })
  } else {
    setTimeout(() => {
      grid.querySelectorAll('.fade-in').forEach((el) => el.classList.add('visible'))
    }, 100)
  }
}

/* ── Admin Panel ────────────────────────────────────────── */
function initAdmin() {
  const loginWrap = document.getElementById('loginWrap')
  const adminWrap = document.getElementById('adminWrap')
  if (!loginWrap || !adminWrap) return

  function showAdmin() {
    loginWrap.style.display = 'none'
    adminWrap.style.display = 'block'
    renderTable()
  }

  if (CMS.isLoggedIn()) showAdmin()

  document.getElementById('loginForm')?.addEventListener('submit', (e) => {
    e.preventDefault()
    const pass = document.getElementById('cmsPass').value
    const errEl = document.getElementById('loginErr')
    if (CMS.login(pass)) {
      errEl?.classList.remove('show')
      showAdmin()
    } else {
      if (errEl) {
        errEl.textContent = 'Contraseña incorrecta.'
        errEl.classList.add('show')
      }
    }
  })

  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    CMS.logout()
    location.reload()
  })

  // Tabs
  document.querySelectorAll('.admin-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach((b) => b.classList.remove('active'))
      document.querySelectorAll('.admin-panel').forEach((p) => p.classList.remove('active'))
      btn.classList.add('active')
      const panel = document.getElementById(btn.dataset.panel)
      if (panel) panel.classList.add('active')
    })
  })

  // Table render
  function renderTable() {
    const tbody = document.getElementById('productsTbody')
    if (!tbody) return
    tbody.innerHTML = ''
    CMS.load().forEach((p) => {
      const tr = document.createElement('tr')
      const catLabel = CATEGORIES[p.cat] || p.cat
      tr.innerHTML = `
        <td><img src="${p.img}" alt="${p.name}" /></td>
        <td><strong>${p.name}</strong></td>
        <td>${catLabel}</td>
        <td style="max-width:280px;color:var(--text-muted);font-size:12px">${p.desc.slice(0, 80)}…</td>
        <td>
          <button class="act-btn act-edit" data-id="${p.id}"><i class="fas fa-pen"></i> Editar</button>
          <button class="act-btn act-del"  data-id="${p.id}"><i class="fas fa-trash"></i> Eliminar</button>
        </td>`
      tbody.appendChild(tr)
    })
    tbody
      .querySelectorAll('.act-edit')
      .forEach((btn) => btn.addEventListener('click', () => editProduct(btn.dataset.id)))
    tbody
      .querySelectorAll('.act-del')
      .forEach((btn) => btn.addEventListener('click', () => deleteProduct(btn.dataset.id)))
  }

  function editProduct(id) {
    const p = CMS.load().find((x) => x.id == id)
    if (!p) return
    document.getElementById('productId').value = p.id
    document.getElementById('pName').value = p.name
    document.getElementById('pCat').value = p.cat
    document.getElementById('pImg').value = p.img
    document.getElementById('pDesc').value = p.desc
    document.getElementById('formHeading').textContent = 'Editar Producto'
    // show preview
    const preview = document.getElementById('imgPreview')
    const wrap = document.getElementById('imgPreviewWrap')
    if (preview && wrap) {
      preview.src = p.img
      wrap.style.display = 'block'
    }
    // switch tab
    document.getElementById('tabAdd')?.click()
  }

  function deleteProduct(id) {
    if (!confirm('¿Eliminar este producto del catálogo?')) return
    CMS.delete(id)
    renderTable()
  }

  // Product form
  document.getElementById('productForm')?.addEventListener('submit', (e) => {
    e.preventDefault()
    const id = document.getElementById('productId').value
    const data = {
      name: document.getElementById('pName').value.trim(),
      cat: document.getElementById('pCat').value,
      img: document.getElementById('pImg').value.trim(),
      desc: document.getElementById('pDesc').value.trim(),
    }
    if (!data.name || !data.cat || !data.img || !data.desc) {
      alert('Todos los campos son requeridos.')
      return
    }
    if (id) {
      CMS.update(id, data)
    } else {
      CMS.add(data)
    }
    document.getElementById('productForm').reset()
    document.getElementById('productId').value = ''
    document.getElementById('formHeading').textContent = 'Agregar Nuevo Producto'
    const wrap = document.getElementById('imgPreviewWrap')
    if (wrap) wrap.style.display = 'none'
    renderTable()
    document.getElementById('tabList')?.click()
  })

  document.getElementById('resetFormBtn')?.addEventListener('click', () => {
    document.getElementById('productForm').reset()
    document.getElementById('productId').value = ''
    document.getElementById('formHeading').textContent = 'Agregar Nuevo Producto'
    const wrap = document.getElementById('imgPreviewWrap')
    if (wrap) wrap.style.display = 'none'
  })

  // Export
  document.getElementById('exportBtn')?.addEventListener('click', () => {
    const json = JSON.stringify(CMS.load(), null, 2)
    const a = document.createElement('a')
    a.href = 'data:application/json,' + encodeURIComponent(json)
    a.download = 'ime-productos.json'
    a.click()
  })

  // Import
  document.getElementById('importFile')?.addEventListener('change', function () {
    const file = this.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        if (Array.isArray(data)) {
          CMS.save(data)
          renderTable()
          alert('Importación exitosa: ' + data.length + ' productos.')
        } else alert('Formato JSON inválido.')
      } catch {
        alert('Error al leer el archivo JSON.')
      }
    }
    reader.readAsText(file)
  })

  // Reset
  document.getElementById('resetDefaultBtn')?.addEventListener('click', () => {
    if (
      !confirm(
        '¿Restaurar el catálogo a los productos por defecto? Esta acción no se puede deshacer.'
      )
    )
      return
    CMS.save([...DEFAULT_PRODUCTS])
    renderTable()
    alert('Catálogo restaurado.')
  })
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  renderCatalogFromCMS()
  initAdmin()

  // Aplica filtro URL (?cat=) después de renderizar
  const _p = new URLSearchParams(location.search)
  const _cat = _p.get('cat')
  if (_cat) {
    const btn = document.querySelector(`.filter-btn[data-cat="${_cat}"]`)
    if (btn) setTimeout(() => btn.click(), 80)
  }
})
