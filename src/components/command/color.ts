'use client';

/*==============================================================================
Colour probe

Hull colours arrive as whatever the engine stores - `#fff`, `hsl(...)`, an
`hsla(...)` - and the bays need the same colour at many opacities. Rather than
parse every CSS notation by hand, paint one pixel and read it back. Results are
cached, so the cost is one 1x1 fill per distinct colour for the whole session.
==============================================================================*/

let probe: CanvasRenderingContext2D | null = null;
const cache = new Map<string, [number, number, number]>();

export function rgbParts(color: string): [number, number, number] {
  const hit = cache.get(color);
  if (hit) return hit;
  if (!probe) {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    probe = c.getContext('2d', { willReadFrequently: true });
  }
  if (!probe) return [120, 200, 235];
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = color;
  probe.fillRect(0, 0, 1, 1);
  const d = probe.getImageData(0, 0, 1, 1).data;
  const parts: [number, number, number] = [d[0], d[1], d[2]];
  cache.set(color, parts);
  return parts;
}

export function rgba(color: string, alpha: number): string {
  const [r, g, b] = rgbParts(color);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
