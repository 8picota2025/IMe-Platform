import type { APIRoute } from 'astro'
import { buildCatalogoIndex } from '../../lib/catalogo'

export const prerender = true

export const GET: APIRoute = async () => {
  const items = await buildCatalogoIndex('es')
  return new Response(JSON.stringify(items), {
    headers: { 'Content-Type': 'application/json' },
  })
}
