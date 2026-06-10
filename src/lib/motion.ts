/**
 * Helpers para animaciones GSAP con respeto a prefers-reduced-motion.
 * GSAP y ScrollTrigger se importan dinámicamente donde se necesiten.
 */

/**
 * Detecta si el usuario prefiere animación reducida.
 * Solo callable en el cliente (browser).
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Configuración de animación estándar para reveals.
 * power3.out, 700ms — desactivado si reduced motion.
 */
export interface RevealConfig {
  duration?: number
  delay?: number
  y?: number
  opacity?: number
  stagger?: number
}

export function getRevealVars(config: RevealConfig = {}) {
  const { duration = 0.7, delay = 0, y = 30, opacity = 0 } = config
  if (prefersReducedMotion()) {
    return { duration: 0.01, delay: 0, y: 0, opacity: 1, ease: 'none' }
  }
  return {
    duration,
    delay,
    y,
    opacity,
    ease: 'power3.out',
  }
}

export function getRevealFromVars(config: RevealConfig = {}) {
  const { y = 30, opacity = 0 } = config
  if (prefersReducedMotion()) {
    return { y: 0, opacity: 1 }
  }
  return { y, opacity }
}

/**
 * Microinteracción estándar: 200ms power2.out
 */
export function getMicroVars() {
  if (prefersReducedMotion()) {
    return { duration: 0.01, ease: 'none' }
  }
  return { duration: 0.2, ease: 'power2.out' }
}

/**
 * Inicializa Lenis smooth scroll de forma dinámica.
 * Llama desde el layout (solo en cliente).
 * BLOQUEANTE_BACKEND: Si Lenis no está instalado, falla silenciosamente.
 */
export async function initLenis(): Promise<void> {
  if (prefersReducedMotion()) return
  if (typeof window === 'undefined') return
  try {
    const { default: Lenis } = await import('lenis')
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      smoothWheel: true,
    })
    function raf(time: number) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }
    requestAnimationFrame(raf)
    // Expose globally for ScrollTrigger integration
    ;(window as unknown as Record<string, unknown>)['lenis'] = lenis
  } catch (e) {
    // Lenis no disponible — scroll nativo
    console.warn('[motion] Lenis init failed, falling back to native scroll:', e)
  }
}
