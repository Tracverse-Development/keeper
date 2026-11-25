/**
 * Frees the GPU side of an object tree: every geometry and material (and the textures
 * those materials hold) under `root`. Shared resources are disposed once (a Set dedupes).
 */
import { Material, Object3D, Texture } from 'three';

export function disposeTree(root: Object3D): void {
  const seen = new Set<{ dispose(): void }>();
  root.traverse((node) => {
    const holder = node as Object3D & { geometry?: { dispose(): void }; material?: Material | Material[] };
    if (holder.geometry) seen.add(holder.geometry);
    const materials = Array.isArray(holder.material) ? holder.material : holder.material ? [holder.material] : [];
    for (const material of materials) {
      seen.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof Texture) seen.add(value);
      }
    }
  });
  for (const resource of seen) resource.dispose();
  root.removeFromParent();
}
