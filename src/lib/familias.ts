const ICONOS_POR_SLUG: Record<string, string> = {
  monitores: 'activity',
  cardiologia: 'heart',
  'sala-cirugia': 'scissors',
  neonatologia: 'baby',
  ultrasonido: 'radio',
  'soluciones-iv': 'droplets',
  mobiliario: 'bed',
  anestesia: 'wind',
  radiologia: 'scan',
};

export function resolveFamiliaIcono(slug: string, icono?: string | null): string {
  if (icono && icono.trim()) return icono;
  return ICONOS_POR_SLUG[slug] ?? 'activity';
}
