/** Typo de catálogo. El slug no cambia. */
const TYPO_PORTATIL = /Pórtatil/g;

export function corregirTypoPortatil(value: string): string {
  return value.replace(TYPO_PORTATIL, 'Portátil');
}

export function corregirTypoPortatilOpcional(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return value ?? null;
  return corregirTypoPortatil(value);
}
