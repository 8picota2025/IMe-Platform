/**
 * Helpers para animaciones GSAP con respeto a prefers-reduced-motion.
 * GSAP y ScrollTrigger se importan dinámicamente donde se necesiten.
 */

/**
 * Detecta si el usuario prefiere animación reducida.
 * Solo callable en el cliente (browser).
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Configuración de animación estándar para reveals.
 * power3.out, 700ms — desactivado si reduced motion.
 */
export interface RevealConfig {
  duration?: number;
  delay?: number;
  y?: number;
  opacity?: number;
  stagger?: number;
}

export function getRevealVars(config: RevealConfig = {}) {
  const { duration = 0.7, delay = 0, y = 30, opacity = 0 } = config;
  if (prefersReducedMotion()) {
    return { duration: 0.01, delay: 0, y: 0, opacity: 1, ease: 'none' };
  }
  return {
    duration,
    delay,
    y,
    opacity,
    ease: 'power3.out',
  };
}

export function getRevealFromVars(config: RevealConfig = {}) {
  const { y = 30, opacity = 0 } = config;
  if (prefersReducedMotion()) {
    return { y: 0, opacity: 1 };
  }
  return { y, opacity };
}

/**
 * Microinteracción estándar: 200ms power2.out
 */
export function getMicroVars() {
  if (prefersReducedMotion()) {
    return { duration: 0.01, ease: 'none' };
  }
  return { duration: 0.2, ease: 'power2.out' };
}

/**
 * Restablece bloqueos globales de scroll que pueden quedar activos tras un
 * drawer o una transición de Astro.
 */
export function resetTransientUiState(): void {
  if (typeof document === 'undefined') return;
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
}

type LenisInstance = {
  raf: (time: number) => void;
  destroy?: () => void;
};

let lenisInstance: LenisInstance | null = null;
let lenisRafId: number | null = null;
let lenisInitPromise: Promise<void> | null = null;

/**
 * Anima la apertura de un drawer lateral (carrito/cotización) con GSAP,
 * deslizándolo desde la derecha y desvaneciendo el backdrop.
 * Con prefers-reduced-motion: aplica el estado final sin animación.
 */
export async function abrirDrawer(panel: HTMLElement, backdrop: HTMLElement | null): Promise<void> {
  panel.style.transform = '';
  if (backdrop) backdrop.style.opacity = '';
  if (prefersReducedMotion()) return;
  try {
    const { gsap } = await import('gsap');
    gsap.fromTo(panel, { x: '100%' }, { x: '0%', duration: 0.4, ease: 'power3.out' });
    if (backdrop) gsap.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.3 });
  } catch (e) {
    console.warn('[motion] abrirDrawer: GSAP no disponible', e);
  }
}

/**
 * Anima el cierre de un drawer lateral con GSAP y ejecuta `onComplete`
 * (normalmente, ocultar el elemento con `hidden`) al finalizar.
 */
export async function cerrarDrawer(
  panel: HTMLElement,
  backdrop: HTMLElement | null,
  onComplete: () => void
): Promise<void> {
  if (prefersReducedMotion()) {
    onComplete();
    return;
  }
  try {
    const { gsap } = await import('gsap');
    gsap.to(panel, { x: '100%', duration: 0.3, ease: 'power2.in', onComplete });
    if (backdrop) gsap.to(backdrop, { opacity: 0, duration: 0.25 });
  } catch (e) {
    console.warn('[motion] cerrarDrawer: GSAP no disponible', e);
    onComplete();
  }
}

/**
 * Inicializa Lenis smooth scroll de forma dinámica.
 * Llama desde el layout (solo en cliente).
 * BLOQUEANTE_BACKEND: Si Lenis no está instalado, falla silenciosamente.
 */
export async function initLenis(): Promise<void> {
  if (prefersReducedMotion()) return;
  if (typeof window === 'undefined') return;
  if (lenisInstance || lenisInitPromise) return lenisInitPromise ?? Promise.resolve();

  lenisInitPromise = (async () => {
    try {
      const { default: Lenis } = await import('lenis');
      if (lenisInstance) return;
      lenisInstance = new Lenis({
        duration: 1.2,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: 'vertical',
        smoothWheel: true,
      });
      const raf = (time: number) => {
        if (!lenisInstance) return;
        lenisInstance.raf(time);
        lenisRafId = requestAnimationFrame(raf);
      };
      lenisRafId = requestAnimationFrame(raf);
      (window as unknown as Record<string, unknown>)['lenis'] = lenisInstance;
    } catch (e) {
      // Lenis no disponible — scroll nativo
      console.warn('[motion] Lenis init failed, falling back to native scroll:', e);
    } finally {
      lenisInitPromise = null;
    }
  })();

  return lenisInitPromise;
}

/**
 * Detiene Lenis y limpia la referencia global. Se usa antes de un swap de
 * Astro para evitar acumulación de RAFs en navegaciones sucesivas.
 */
export function destroyLenis(): void {
  if (lenisRafId !== null) {
    cancelAnimationFrame(lenisRafId);
    lenisRafId = null;
  }
  lenisInstance?.destroy?.();
  lenisInstance = null;
  lenisInitPromise = null;
  if (typeof window !== 'undefined' && 'lenis' in window) {
    delete (window as unknown as Record<string, unknown>)['lenis'];
  }
}
