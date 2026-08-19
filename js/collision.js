export const colliders = [];

export function addBoxCollider(x, z, w, d, padding = 0) {
  colliders.push({
    minx: x - w / 2 - padding,
    maxx: x + w / 2 + padding,
    minz: z - d / 2 - padding,
    maxz: z + d / 2 + padding,
  });
}

export function resolveCircle(x, z, radius) {
  let nx = x;
  let nz = z;

  for (let i = 0; i < 3; i++) {
    for (const c of colliders) {
      const closestX = Math.max(c.minx, Math.min(nx, c.maxx));
      const closestZ = Math.max(c.minz, Math.min(nz, c.maxz));
      let dx = nx - closestX;
      let dz = nz - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq >= radius * radius) continue;

      if (distSq === 0) {
        const left = nx - c.minx;
        const right = c.maxx - nx;
        const top = nz - c.minz;
        const bottom = c.maxz - nz;
        const min = Math.min(left, right, top, bottom);
        if (min === left) nx = c.minx - radius;
        else if (min === right) nx = c.maxx + radius;
        else if (min === top) nz = c.minz - radius;
        else nz = c.maxz + radius;
        continue;
      }

      const dist = Math.sqrt(distSq);
      const push = (radius - dist) / dist;
      nx += dx * push;
      nz += dz * push;
    }
  }

  return { x: nx, z: nz };
}

export function losBlocked(ax, az, bx, bz, inflate = 0.15) {
  const dx = bx - ax;
  const dz = bz - az;
  const steps = Math.max(8, Math.ceil(Math.hypot(dx, dz) * 2));

  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = ax + dx * t;
    const z = az + dz * t;
    for (const c of colliders) {
      if (
        x >= c.minx - inflate &&
        x <= c.maxx + inflate &&
        z >= c.minz - inflate &&
        z <= c.maxz + inflate
      ) {
        return true;
      }
    }
  }
  return false;
}
