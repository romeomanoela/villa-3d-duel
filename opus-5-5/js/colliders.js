// Registre des volumes infranchissables pour la visite à la 1re personne.
// Chaque boîte est un rectangle XZ associé à une plage de hauteur [y0, y1].
export const colliders = [];

export function addCollider(x0, x1, z0, z1, y0, y1, tag = '') {
  colliders.push({
    x0: Math.min(x0, x1), x1: Math.max(x0, x1),
    z0: Math.min(z0, z1), z1: Math.max(z0, z1),
    y0, y1, tag,
  });
}

// Empreinte d'un objet posé en (x, z), tourné de ry, de taille locale w × d.
export function addFootprint(x, z, ry, w, d, y0, y1, tag = '') {
  const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry));
  const hw = (w * c + d * s) / 2, hd = (w * s + d * c) / 2;
  addCollider(x - hw, x + hw, z - hd, z + hd, y0, y1, tag);
}
