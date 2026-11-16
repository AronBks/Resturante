function getLocalBackendOrigin(): string {
  const host =
    typeof window !== 'undefined' && window.location?.hostname
      ? window.location.hostname
      : 'localhost';
  return `http://${host}:3000`;
}

export const LOCAL_DISHES_MAP: Record<string, string> = {
  pique: '/public/platos/pique.webp',
  charque: '/public/platos/charque.webp',
  matambre: '/public/platos/matambre.webp',
  planchita: '/public/platos/planchita.webp',
  lapping: '/public/platos/lapping.webp',
  pampa: '/public/platos/pampa.webp',
  picante: '/public/platos/picante.webp',
  caldocola: '/public/platos/caldocola.webp',
  chankapollo: '/public/platos/chankapollo.webp',
  kawi: '/public/platos/kawi.webp',
  mixto: '/public/platos/mixto.webp',
  pulpitos: '/public/platos/pulpitos.webp',
  rinon: '/public/platos/rinon.webp',
  rinonperol: '/public/platos/rinonperol.webp',
  cascada: '/public/platos/cascada.webp',
  cocacola: '/public/platos/cocacola.webp',
  fanta: '/public/platos/fanta.webp',
  simba: '/public/platos/simba.webp',
  sprite: '/public/platos/sprite.webp',
  acuarius: '/public/platos/acuarius.webp',
  delvalle: '/public/platos/delvalle.webp',
  puravida: '/public/platos/puravida.webp',
  hervido: '/public/platos/hervido.webp',
  huari: '/public/platos/huari.webp',
  pacena: '/public/platos/pacena.webp',
};

/**
 * Resuelve la imagen local del plato desde el servidor del restaurante (sin Internet)
 */
export function resolverImagenLocalAdmin(
  nombre: string,
  imagenOriginal?: string,
): string {
  const origin = getLocalBackendOrigin();

  if (imagenOriginal && imagenOriginal.startsWith('/public/')) {
    return `${origin}${imagenOriginal}`;
  }

  const n = (nombre || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['`’\s-]/g, '');

  const toUrl = (path: string) => `${origin}${path}`;

  if (n.includes('coca')) return toUrl(LOCAL_DISHES_MAP['cocacola']);
  if (n.includes('cascada')) return toUrl(LOCAL_DISHES_MAP['cascada']);
  if (n.includes('fanta')) return toUrl(LOCAL_DISHES_MAP['fanta']);
  if (n.includes('simba')) return toUrl(LOCAL_DISHES_MAP['simba']);
  if (n.includes('sprite')) return toUrl(LOCAL_DISHES_MAP['sprite']);
  if (n.includes('acuari') || n.includes('aquari')) return toUrl(LOCAL_DISHES_MAP['acuarius']);
  if (n.includes('valle')) return toUrl(LOCAL_DISHES_MAP['delvalle']);
  if (n.includes('puravida')) return toUrl(LOCAL_DISHES_MAP['puravida']);
  if (n.includes('hervido')) return toUrl(LOCAL_DISHES_MAP['hervido']);
  if (n.includes('huari')) return toUrl(LOCAL_DISHES_MAP['huari']);
  if (n.includes('pacen')) return toUrl(LOCAL_DISHES_MAP['pacena']);

  if (n.includes('perol')) return toUrl(LOCAL_DISHES_MAP['rinonperol']);
  if (n.includes('rinon')) return toUrl(LOCAL_DISHES_MAP['rinon']);
  if (n.includes('cola')) return toUrl(LOCAL_DISHES_MAP['caldocola']);
  if (n.includes('chanka')) return toUrl(LOCAL_DISHES_MAP['chankapollo']);
  if (n.includes('kawi')) return toUrl(LOCAL_DISHES_MAP['kawi']);
  if (n.includes('pulpito')) return toUrl(LOCAL_DISHES_MAP['pulpitos']);

  if (n.includes('pique')) return toUrl(LOCAL_DISHES_MAP['pique']);
  if (n.includes('charque')) return toUrl(LOCAL_DISHES_MAP['charque']);
  if (n.includes('matambre')) return toUrl(LOCAL_DISHES_MAP['matambre']);
  if (n.includes('planch')) return toUrl(LOCAL_DISHES_MAP['planchita']);
  if (n.includes('lapp')) return toUrl(LOCAL_DISHES_MAP['lapping']);
  if (n.includes('pamp')) return toUrl(LOCAL_DISHES_MAP['pampa']);
  if (n.includes('picant')) return toUrl(LOCAL_DISHES_MAP['picante']);
  if (n.includes('mixto')) return toUrl(LOCAL_DISHES_MAP['mixto']);

  if (
    imagenOriginal &&
    !imagenOriginal.includes('cloudinary.com') &&
    !imagenOriginal.includes('unsplash.com')
  ) {
    return imagenOriginal;
  }

  return toUrl(LOCAL_DISHES_MAP['pique']);
}
