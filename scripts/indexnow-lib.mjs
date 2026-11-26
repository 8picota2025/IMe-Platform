/**
 * IndexNow: la clave es pública a propósito (el archivo vive en el docroot).
 * El ping a api.indexnow.org solo sale del CLI con INDEXNOW_SEND=1.
 * Esta lista no incluye borradores ni páginas noindex.
 */
export const INDEXNOW_HOST = 'i-me.com.co';
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

export const INDEXNOW_PRIORITY_PATHS = [
  '/llms.txt',
  '/es/',
  '/en/',
  '/es/catalogo/',
  '/en/catalog/',
  '/es/contacto/',
  '/en/knowledge/como-elegir-tensiometro-digital/',
  '/es/conocimiento/como-elegir-tensiometro-digital/',
  '/es/familias/mobiliario/',
  '/en/families/mobiliario/',
  '/es/productos/lampara-cielitica-ref-led-x36-ilumitec/',
  '/es/lampara-cialitica/',
  '/en/surgical-light/',
  '/es/camillas-medicas/',
  '/en/knowledge/central-monitoreo-multicama-o-monitores-independientes/',
  '/es/tensiometros-digitales/',
  '/es/esterilizacion/autoclaves-hospitalarios/',
  '/es/familias/ultrasonido/',
  '/es/caminadores-para-adultos/',
  '/es/nosotros/',
  '/es/conocimiento/registro-sanitario-invima-equipos-biomedicos/',
  '/es/conocimiento/tema/invima-regulacion/',
  '/es/productos/aspirador-de-secreciones-portatil-ads100-ref-gmr-sm181/',
  '/es/distribuidores-de-robots-e-ingenieria-robotica-en-colombia-y-latinoamerica/',
  '/es/familias/robots/',
  '/es/conocimiento/desfibrilador-bifasico-que-incluye/',
];

export function indexNowKeyLocation(key) {
  return `https://${INDEXNOW_HOST}/${key}.txt`;
}

export function assertIndexNowKey(key) {
  if (!/^[a-f0-9]{8,128}$/.test(key)) {
    throw new Error('Clave IndexNow inválida: se esperan 8 a 128 hexadecimales.');
  }
}

export function buildIndexNowPayload(key, paths) {
  assertIndexNowKey(key);
  const urlList = paths.map(path => {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `https://${INDEXNOW_HOST}${normalized}`;
  });
  return {
    host: INDEXNOW_HOST,
    key,
    keyLocation: indexNowKeyLocation(key),
    urlList,
  };
}
