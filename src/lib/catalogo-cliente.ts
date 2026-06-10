/**
 * Lógica de cliente del catálogo: filtros, búsqueda, facetas, paginación,
 * sincronización con la URL y comparador. Opera sobre el DOM ya renderizado
 * por CatalogoExplorer.astro (progressive enhancement, sin SPA).
 */
import { t, type Locale } from '../i18n/utils'
import { normalizarTexto } from './catalogo'
import {
  getComparador,
  toggleComparador,
  clearComparador,
  MAX_COMPARADOR,
  COMPARADOR_EVENT,
} from './comparador'

const PAGE_SIZE = 12

interface CatalogoState {
  familia: string
  q: string
  comercial: Set<string>
  destacado: boolean
  nuevo: boolean
  facetas: Map<string, Set<string>>
  pagina: number
  todos: boolean
}

function parseStateFromUrl(): CatalogoState {
  const params = new URLSearchParams(window.location.search)
  const facetas = new Map<string, Set<string>>()
  const filtrosParam = params.get('filtros')
  if (filtrosParam) {
    for (const parte of filtrosParam.split(';')) {
      const [claveRaw, valoresRaw] = parte.split(':')
      if (!claveRaw || !valoresRaw) continue
      const clave = decodeURIComponent(claveRaw)
      const valores = new Set(valoresRaw.split(',').filter(Boolean).map(decodeURIComponent))
      if (valores.size > 0) facetas.set(clave, valores)
    }
  }
  const paginaRaw = Number.parseInt(params.get('pagina') ?? '1', 10)
  return {
    familia: params.get('familia') ?? '',
    q: params.get('q') ?? '',
    comercial: new Set((params.get('comercial') ?? '').split(',').filter(Boolean)),
    destacado: params.get('destacado') === '1',
    nuevo: params.get('nuevo') === '1',
    facetas,
    pagina: Number.isFinite(paginaRaw) && paginaRaw > 0 ? paginaRaw : 1,
    todos: params.get('todos') === '1',
  }
}

function serializeState(state: CatalogoState): string {
  const params = new URLSearchParams()
  if (state.familia) params.set('familia', state.familia)
  if (state.q) params.set('q', state.q)
  if (state.comercial.size > 0) params.set('comercial', [...state.comercial].join(','))
  if (state.destacado) params.set('destacado', '1')
  if (state.nuevo) params.set('nuevo', '1')
  if (state.facetas.size > 0) {
    const partes = [...state.facetas.entries()].map(
      ([clave, valores]) =>
        `${encodeURIComponent(clave)}:${[...valores].map(encodeURIComponent).join(',')}`
    )
    params.set('filtros', partes.join(';'))
  }
  if (state.pagina > 1) params.set('pagina', String(state.pagina))
  const sinOtrosFiltros =
    !state.familia &&
    !state.q &&
    state.comercial.size === 0 &&
    !state.destacado &&
    !state.nuevo &&
    state.facetas.size === 0
  if (state.todos && sinOtrosFiltros) params.set('todos', '1')
  return params.toString()
}

function shouldShowGrid(state: CatalogoState): boolean {
  return (
    state.todos ||
    state.familia !== '' ||
    state.q !== '' ||
    state.comercial.size > 0 ||
    state.destacado ||
    state.nuevo ||
    state.facetas.size > 0
  )
}

function parseSpecs(card: HTMLElement): Record<string, string> {
  try {
    const parsed = JSON.parse(card.dataset['specs'] ?? '{}') as unknown
    if (parsed && typeof parsed === 'object') return parsed as Record<string, string>
    return {}
  } catch {
    return {}
  }
}

function matchesBase(card: HTMLElement, state: CatalogoState): boolean {
  if (state.familia && card.dataset['familia'] !== state.familia) return false
  if (state.comercial.size > 0 && !state.comercial.has(card.dataset['comercial'] ?? '')) {
    return false
  }
  if (state.destacado && card.dataset['destacado'] !== '1') return false
  if (state.nuevo && card.dataset['nuevo'] !== '1') return false
  if (state.q) {
    const needle = normalizarTexto(state.q)
    const texto = card.dataset['busqueda'] ?? ''
    if (needle && !texto.includes(needle)) return false
  }
  return true
}

function computeFacetas(cards: HTMLElement[]): Map<string, string[]> {
  const acumulado = new Map<string, Set<string>>()
  for (const card of cards) {
    const specs = parseSpecs(card)
    for (const [clave, valor] of Object.entries(specs)) {
      if (!acumulado.has(clave)) acumulado.set(clave, new Set())
      acumulado.get(clave)?.add(valor)
    }
  }
  const resultado = new Map<string, string[]>()
  for (const [clave, valores] of acumulado) {
    if (valores.size >= 2) resultado.set(clave, [...valores].sort())
  }
  return resultado
}

/**
 * Envuelve la primera coincidencia (acento/mayúsculas insensible) en <mark>.
 * Si query está vacío, restaura el texto original.
 */
function resaltar(el: HTMLElement, queryNormalizado: string): void {
  const original = el.textContent ?? ''
  if (!queryNormalizado) {
    if (el.children.length > 0) el.textContent = original
    return
  }
  const normalizado = normalizarTexto(original)
  const idx = normalizado.indexOf(queryNormalizado)
  if (idx === -1) {
    if (el.children.length > 0) el.textContent = original
    return
  }
  el.textContent = ''
  const mark = document.createElement('mark')
  mark.textContent = original.slice(idx, idx + queryNormalizado.length)
  el.append(original.slice(0, idx), mark, original.slice(idx + queryNormalizado.length))
}

function matchesFacetas(card: HTMLElement, facetas: Map<string, Set<string>>): boolean {
  if (facetas.size === 0) return true
  const specs = parseSpecs(card)
  for (const [clave, valores] of facetas) {
    if (valores.size === 0) continue
    const valor = specs[clave]
    if (!valor || !valores.has(valor)) return false
  }
  return true
}

export function initCatalogo(locale: Locale): void {
  const root = document.getElementById('catalogo-root')
  if (!root) return

  const grid = document.getElementById('vista-productos')
  const familiasView = document.getElementById('vista-familias')
  const cards = Array.from(grid?.querySelectorAll<HTMLElement>('[data-producto-slug]') ?? [])
  const buscarInput = document.getElementById('catalogo-buscar') as HTMLInputElement | null
  const contador = document.getElementById('catalogo-contador')
  const anuncios = document.getElementById('catalogo-anuncios')
  const sinResultados = document.getElementById('catalogo-sin-resultados')
  const familiaLista = document.getElementById('catalogo-familia-lista')
  const comercialContenedor = document.getElementById('catalogo-comercial')
  const destacadoInput = document.getElementById(
    'catalogo-filtro-destacado'
  ) as HTMLInputElement | null
  const nuevoInput = document.getElementById('catalogo-filtro-nuevo') as HTMLInputElement | null
  const facetasContenedor = document.getElementById('catalogo-facetas')
  const resetBtns = Array.from(document.querySelectorAll('[data-reset-filtros]'))
  const mostrarTodosBtns = Array.from(document.querySelectorAll('[data-mostrar-todos]'))
  const paginacion = document.getElementById('catalogo-paginacion')
  const familiaActualEl = document.getElementById('catalogo-familia-actual')
  const familiaActualNombre = document.getElementById('catalogo-familia-actual-nombre')
  const familiaActualQuitar = document.getElementById('catalogo-familia-actual-quitar')
  const resultadosEl = document.getElementById('catalogo-resultados')
  const filtrosToggle = document.getElementById('catalogo-filtros-toggle')
  const filtrosPanel = document.getElementById('catalogo-filtros')
  const filtrosCerrar = document.getElementById('catalogo-filtros-cerrar')

  const state = parseStateFromUrl()

  const familiasMap = new Map<string, string>()
  familiasView?.querySelectorAll<HTMLElement>('[data-familia-link]').forEach((el) => {
    const slug = el.dataset['familiaLink']
    const nombre = el.dataset['familiaNombre']
    if (slug) familiasMap.set(slug, nombre ?? slug)
  })

  function announce(msg: string): void {
    if (!anuncios) return
    anuncios.textContent = ''
    window.requestAnimationFrame(() => {
      anuncios.textContent = msg
    })
  }

  function scrollToResultados(): void {
    if (!resultadosEl) return
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    resultadosEl.scrollIntoView({ behavior: reducido ? 'auto' : 'smooth', block: 'start' })
  }

  function syncFiltrosUI(): void {
    if (buscarInput) buscarInput.value = state.q
    familiaLista?.querySelectorAll<HTMLButtonElement>('[data-familia-filter]').forEach((btn) => {
      const valor = btn.dataset['familiaFilter'] ?? ''
      const activo = valor === state.familia
      btn.classList.toggle('catalogo-filtros__familia--activa', activo)
      if (activo) btn.setAttribute('aria-current', 'true')
      else btn.removeAttribute('aria-current')
    })
    comercialContenedor
      ?.querySelectorAll<HTMLInputElement>('[data-filtro-comercial]')
      .forEach((input) => {
        input.checked = state.comercial.has(input.dataset['filtroComercial'] ?? '')
      })
    if (destacadoInput) destacadoInput.checked = state.destacado
    if (nuevoInput) nuevoInput.checked = state.nuevo
  }

  function renderFacetas(facetas: Map<string, string[]>): void {
    if (!facetasContenedor) return
    // Descarta selecciones de facetas que ya no aplican al ámbito actual
    for (const clave of [...state.facetas.keys()]) {
      const disponibles = facetas.get(clave)
      if (!disponibles) {
        state.facetas.delete(clave)
        continue
      }
      const filtradas = new Set(
        [...state.facetas.get(clave)!].filter((v) => disponibles.includes(v))
      )
      if (filtradas.size === 0) state.facetas.delete(clave)
      else state.facetas.set(clave, filtradas)
    }

    facetasContenedor.innerHTML = ''
    facetasContenedor.hidden = facetas.size === 0
    if (facetas.size === 0) return

    const heading = document.createElement('p')
    heading.className = 'catalogo-filtros__heading'
    heading.textContent = t(locale, 'catalogo.facetas_titulo')
    facetasContenedor.appendChild(heading)

    let contador = 0
    for (const [clave, valores] of facetas) {
      const grupo = document.createElement('fieldset')
      grupo.className = 'catalogo-filtros__grupo'
      const legend = document.createElement('legend')
      legend.textContent = clave
      grupo.appendChild(legend)
      for (const valor of valores) {
        contador += 1
        const id = `catalogo-faceta-${contador}`
        const label = document.createElement('label')
        label.className = 'catalogo-filtros__opcion'
        label.htmlFor = id
        const input = document.createElement('input')
        input.type = 'checkbox'
        input.id = id
        input.checked = state.facetas.get(clave)?.has(valor) ?? false
        input.addEventListener('change', () => {
          if (input.checked) {
            if (!state.facetas.has(clave)) state.facetas.set(clave, new Set())
            state.facetas.get(clave)?.add(valor)
          } else {
            state.facetas.get(clave)?.delete(valor)
            if (state.facetas.get(clave)?.size === 0) state.facetas.delete(clave)
          }
          state.pagina = 1
          applyFiltros()
        })
        label.appendChild(input)
        label.append(` ${valor}`)
        grupo.appendChild(label)
      }
      facetasContenedor.appendChild(grupo)
    }
  }

  function renderPaginacion(totalPaginas: number, actual: number): void {
    if (!paginacion) return
    paginacion.innerHTML = ''
    if (totalPaginas <= 1) {
      paginacion.hidden = true
      return
    }
    paginacion.hidden = false

    const anterior = document.createElement('button')
    anterior.type = 'button'
    anterior.className = 'btn btn-secondary'
    anterior.textContent = t(locale, 'comun.anterior')
    anterior.disabled = actual <= 1
    anterior.addEventListener('click', () => {
      state.pagina = Math.max(1, state.pagina - 1)
      applyFiltros()
      scrollToResultados()
    })

    const info = document.createElement('p')
    info.className = 'catalogo-paginacion__info'
    info.textContent = `${t(locale, 'comun.pagina')} ${actual} ${t(locale, 'comun.de')} ${totalPaginas}`

    const siguiente = document.createElement('button')
    siguiente.type = 'button'
    siguiente.className = 'btn btn-secondary'
    siguiente.textContent = t(locale, 'comun.siguiente')
    siguiente.disabled = actual >= totalPaginas
    siguiente.addEventListener('click', () => {
      state.pagina = Math.min(totalPaginas, state.pagina + 1)
      applyFiltros()
      scrollToResultados()
    })

    paginacion.append(anterior, info, siguiente)
  }

  function updateFamiliaActual(): void {
    if (!familiaActualEl || !familiaActualNombre) return
    if (!state.familia) {
      familiaActualEl.hidden = true
      return
    }
    familiaActualEl.hidden = false
    familiaActualNombre.textContent = familiasMap.get(state.familia) ?? state.familia
  }

  function applyFiltros(): void {
    const mostrarGrid = shouldShowGrid(state)

    if (familiasView) familiasView.hidden = mostrarGrid
    if (grid) grid.hidden = !mostrarGrid

    if (!mostrarGrid) {
      if (sinResultados) sinResultados.hidden = true
      if (paginacion) paginacion.hidden = true
      if (facetasContenedor) facetasContenedor.hidden = true
      if (familiaActualEl) familiaActualEl.hidden = true
      if (contador) contador.textContent = ''
      history.replaceState(null, '', buildUrl())
      return
    }

    const baseCoincide = cards.filter((card) => matchesBase(card, state))
    const facetas = computeFacetas(baseCoincide)
    renderFacetas(facetas)

    const visibles = baseCoincide.filter((card) => matchesFacetas(card, state.facetas))

    const totalPaginas = Math.max(1, Math.ceil(visibles.length / PAGE_SIZE))
    if (state.pagina > totalPaginas) state.pagina = totalPaginas
    if (state.pagina < 1) state.pagina = 1
    const inicio = (state.pagina - 1) * PAGE_SIZE
    const visiblesPagina = new Set(visibles.slice(inicio, inicio + PAGE_SIZE))

    cards.forEach((card) => {
      card.hidden = !visiblesPagina.has(card)
    })

    const queryNormalizado = state.q ? normalizarTexto(state.q) : ''
    cards.forEach((card) => {
      const nombreEl = card.querySelector<HTMLElement>('.producto-card__nombre')
      const descEl = card.querySelector<HTMLElement>('.producto-card__desc')
      if (nombreEl) resaltar(nombreEl, queryNormalizado)
      if (descEl) resaltar(descEl, queryNormalizado)
    })

    if (contador) {
      const etiqueta =
        visibles.length === 1
          ? t(locale, 'catalogo.resultados_un')
          : t(locale, 'catalogo.resultados_otros')
      contador.textContent = `${visibles.length} ${etiqueta}`
    }

    if (sinResultados) sinResultados.hidden = visibles.length > 0

    renderPaginacion(totalPaginas, state.pagina)
    updateFamiliaActual()
    history.replaceState(null, '', buildUrl())
  }

  function buildUrl(): string {
    const qs = serializeState(state)
    return qs ? `${window.location.pathname}?${qs}` : window.location.pathname
  }

  function resetFiltros(): void {
    state.familia = ''
    state.q = ''
    state.comercial = new Set()
    state.destacado = false
    state.nuevo = false
    state.facetas = new Map()
    state.pagina = 1
    state.todos = false
    syncFiltrosUI()
    applyFiltros()
  }

  // Búsqueda con debounce
  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  buscarInput?.addEventListener('input', () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      state.q = buscarInput.value.trim()
      state.pagina = 1
      applyFiltros()
    }, 300)
  })

  // Navegación por familia (overview)
  familiasView?.querySelectorAll<HTMLAnchorElement>('[data-familia-link]').forEach((enlace) => {
    enlace.addEventListener('click', (evento) => {
      evento.preventDefault()
      state.familia = enlace.dataset['familiaLink'] ?? ''
      state.todos = false
      state.pagina = 1
      syncFiltrosUI()
      applyFiltros()
      scrollToResultados()
    })
  })

  // Filtro por familia (sidebar)
  familiaLista?.querySelectorAll<HTMLButtonElement>('[data-familia-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.familia = btn.dataset['familiaFilter'] ?? ''
      state.pagina = 1
      syncFiltrosUI()
      applyFiltros()
    })
  })

  familiaActualQuitar?.addEventListener('click', () => {
    state.familia = ''
    state.pagina = 1
    syncFiltrosUI()
    applyFiltros()
  })

  // Filtro tipo comercial
  comercialContenedor
    ?.querySelectorAll<HTMLInputElement>('[data-filtro-comercial]')
    .forEach((input) => {
      input.addEventListener('change', () => {
        const valor = input.dataset['filtroComercial'] ?? ''
        if (input.checked) state.comercial.add(valor)
        else state.comercial.delete(valor)
        state.pagina = 1
        applyFiltros()
      })
    })

  // Filtros destacado / nuevo
  destacadoInput?.addEventListener('change', () => {
    state.destacado = destacadoInput.checked
    state.pagina = 1
    applyFiltros()
  })
  nuevoInput?.addEventListener('change', () => {
    state.nuevo = nuevoInput.checked
    state.pagina = 1
    applyFiltros()
  })

  // Mostrar todos
  mostrarTodosBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.todos = true
      state.familia = ''
      state.pagina = 1
      syncFiltrosUI()
      applyFiltros()
      scrollToResultados()
    })
  })

  // Reset de filtros
  resetBtns.forEach((btn) => btn.addEventListener('click', resetFiltros))

  // Drawer de filtros (mobile)
  filtrosToggle?.addEventListener('click', () => {
    const abierto = filtrosPanel?.classList.toggle('catalogo-filtros--abierto') ?? false
    filtrosToggle.setAttribute('aria-expanded', abierto ? 'true' : 'false')
    if (abierto) filtrosPanel?.querySelector<HTMLElement>('input, button, a')?.focus()
  })
  filtrosCerrar?.addEventListener('click', () => {
    filtrosPanel?.classList.remove('catalogo-filtros--abierto')
    filtrosToggle?.setAttribute('aria-expanded', 'false')
    filtrosToggle?.focus()
  })
  filtrosPanel?.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && filtrosPanel.classList.contains('catalogo-filtros--abierto')) {
      filtrosPanel.classList.remove('catalogo-filtros--abierto')
      filtrosToggle?.setAttribute('aria-expanded', 'false')
      filtrosToggle?.focus()
    }
  })

  // --- Comparador ---
  function initComparador(): void {
    const compareInputs = Array.from(
      document.querySelectorAll<HTMLInputElement>('[data-compare-slug]')
    )
    const bar = document.getElementById('comparador-bar')
    const contadorEl = document.getElementById('comparador-contador')
    const verBtn = document.getElementById('comparador-ver')
    const vaciarBtn = document.getElementById('comparador-vaciar')
    const dialog = document.getElementById('comparador-dialog') as HTMLDialogElement | null
    const tabla = document.getElementById('comparador-tabla')
    const cerrarBtn = dialog?.querySelector('[data-comparador-close]')

    function syncCheckboxes(slugs: string[]): void {
      compareInputs.forEach((input) => {
        const slug = input.dataset['compareSlug'] ?? ''
        input.checked = slugs.includes(slug)
        input.disabled = !input.checked && slugs.length >= MAX_COMPARADOR
      })
    }

    function syncBar(slugs: string[]): void {
      if (bar) bar.hidden = slugs.length === 0
      if (contadorEl) contadorEl.textContent = `${slugs.length}/${MAX_COMPARADOR}`
    }

    function renderTabla(slugs: string[]): void {
      if (!tabla) return
      tabla.innerHTML = ''
      if (slugs.length === 0) {
        const vacio = document.createElement('p')
        vacio.className = 'comparador__vacio'
        vacio.textContent = t(locale, 'catalogo.comparar_vacio')
        tabla.appendChild(vacio)
        return
      }

      const productos = slugs
        .map((slug) => document.querySelector<HTMLElement>(`[data-producto-slug="${slug}"]`))
        .filter((el): el is HTMLElement => el !== null)

      const specsList = productos.map((el) => parseSpecs(el))
      const claves = new Set<string>()
      specsList.forEach((specs) => Object.keys(specs).forEach((clave) => claves.add(clave)))

      const table = document.createElement('table')
      table.className = 'comparador__table'

      const thead = document.createElement('thead')
      const filaCabecera = document.createElement('tr')
      const thVacio = document.createElement('th')
      thVacio.scope = 'col'
      thVacio.textContent = t(locale, 'catalogo.comparar_columna_producto')
      filaCabecera.appendChild(thVacio)
      productos.forEach((el) => {
        const th = document.createElement('th')
        th.scope = 'col'
        th.textContent = el.dataset['nombre'] ?? ''
        filaCabecera.appendChild(th)
      })
      thead.appendChild(filaCabecera)
      table.appendChild(thead)

      const tbody = document.createElement('tbody')

      function addRow(label: string, values: string[]): void {
        const fila = document.createElement('tr')
        const th = document.createElement('th')
        th.scope = 'row'
        th.textContent = label
        fila.appendChild(th)
        values.forEach((valor) => {
          const td = document.createElement('td')
          td.textContent = valor
          fila.appendChild(td)
        })
        tbody.appendChild(fila)
      }

      addRow(
        t(locale, 'catalogo.comparar_familia'),
        productos.map((el) => el.dataset['familiaNombre'] ?? '')
      )

      if (productos.some((el) => el.dataset['comercial'])) {
        addRow(
          t(locale, 'catalogo.filtro_comercial'),
          productos.map((el) => {
            const valor = el.dataset['comercial']
            if (valor === 'equipo') return t(locale, 'catalogo.filtro_comercial_equipo')
            if (valor === 'consumible') return t(locale, 'catalogo.filtro_comercial_consumible')
            return valor || '—'
          })
        )
      }

      if (productos.some((el) => el.dataset['destacado'] === '1')) {
        addRow(
          t(locale, 'producto.badge_destacado'),
          productos.map((el) =>
            el.dataset['destacado'] === '1' ? t(locale, 'comun.si') : t(locale, 'comun.no')
          )
        )
      }

      if (productos.some((el) => el.dataset['nuevo'] === '1')) {
        addRow(
          t(locale, 'producto.badge_nuevo'),
          productos.map((el) =>
            el.dataset['nuevo'] === '1' ? t(locale, 'comun.si') : t(locale, 'comun.no')
          )
        )
      }

      for (const clave of [...claves].sort()) {
        addRow(
          clave,
          specsList.map((specs) => specs[clave] ?? '—')
        )
      }

      table.appendChild(tbody)
      tabla.appendChild(table)
    }

    const inicial = getComparador()
    syncCheckboxes(inicial)
    syncBar(inicial)

    compareInputs.forEach((input) => {
      input.addEventListener('change', () => {
        const slug = input.dataset['compareSlug'] ?? ''
        const resultado = toggleComparador(slug)
        if (!resultado.ok) {
          input.checked = false
          announce(t(locale, 'catalogo.comparar_limite'))
        }
        syncCheckboxes(resultado.slugs)
        syncBar(resultado.slugs)
      })
    })

    window.addEventListener(COMPARADOR_EVENT, ((evento: CustomEvent<string[]>) => {
      syncCheckboxes(evento.detail)
      syncBar(evento.detail)
    }) as EventListener)

    vaciarBtn?.addEventListener('click', () => {
      clearComparador()
      if (dialog?.open) renderTabla([])
    })

    verBtn?.addEventListener('click', () => {
      renderTabla(getComparador())
      dialog?.showModal()
    })

    cerrarBtn?.addEventListener('click', () => dialog?.close())
    dialog?.addEventListener('click', (evento) => {
      if (evento.target === dialog) dialog.close()
    })
  }

  syncFiltrosUI()
  applyFiltros()
  initComparador()
}
