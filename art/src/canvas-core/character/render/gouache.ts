// GOUACHE HAND (mid-century, midCentury.ts) for any character Scene. Per part, in paint order: the
// role's shade colour laid flat, then its lit colour laid over it shifted TOWARD the light and cut
// to the form, so a hard band of shade survives on the far side (gouache is opaque: shade is a
// second flat, never a gradient). Edges are the flat brush's slight raggedness. Then, after every
// flat, the line plate: a thin loose brush line along each part's contour, printed off register,
// broken wherever a later part covers it and where a part grows out of its parent (the seams), so
// a sleeve runs into the sweater and a trouser leg into the hips as ONE mass, not glued-on pieces.
import { Gfx, P, displace, rng } from "../../core";
import { bbox, thin } from "../shape2d";
import type { Part, Scene } from "../types";
import { contourRuns, drawMarks, hashId, occlude, occluders } from "./storybook";

export type GSwatch = { base: string; shade: string; line?: string; alpha?: number };
export type GPalette = Record<string, GSwatch>;
export type GouacheOpts = { light?: P; reg?: P; ink?: string; weight?: number; shadeK?: number };

const pathPolys = (c: CanvasRenderingContext2D, polys: P[][], dx = 0, dy = 0) => { c.beginPath(); polys.forEach((s) => { s.forEach(([x, y], i) => (i ? c.lineTo(x + dx, y + dy) : c.moveTo(x + dx, y + dy))); c.closePath(); }); };
const lineW = (part: Part, k = 1) => Math.max(1, Math.min(3, 0.8 + part.size * 0.03)) * k;

export const renderGouache = (g: Gfx, scene: Scene, pal: GPalette, o: GouacheOpts = {}) => {
  const L = o.light ?? scene.light, REG = o.reg ?? [1.6, -1.2], ink = o.ink ?? "#1d1a2a", byId = new Map(scene.parts.map((p) => [p.id, p]));
  const sw = (r: string) => pal[r] ?? { base: "#ff00ff", shade: "#990099" };
  const col = (r: string) => (r === "line" ? ink : sw(r).base);
  const c = g.cur;
  // the flats
  scene.parts.forEach((part) => {
    if (part.fill === false || !part.polys.length) return;
    const s = sw(part.role), seed = hashId(part.id), k = part.size, rag = Math.min(1.6, 0.4 + k * 0.02);
    const polys = part.polys.map((q, i) => displace(q, rag, 0.08, 2, seed + i));
    const clip = part.clipTo ? byId.get(part.clipTo)?.polys : undefined, b = bbox(polys);
    g.touch(b.x0 - 6, b.y0 - 6, b.x1 + 6, b.y1 + 6);
    c.save(); if (clip?.length) { pathPolys(c, clip); c.clip("nonzero"); }
    c.globalAlpha = s.alpha ?? 1;
    c.fillStyle = s.shade; pathPolys(c, polys); c.fill("nonzero");
    const sh = k * (o.shadeK ?? 0.32);
    c.save(); pathPolys(c, polys); c.clip("nonzero"); c.fillStyle = s.base; pathPolys(c, polys, L[0] * sh, L[1] * sh); c.fill("nonzero"); c.restore();
    c.restore(); c.globalAlpha = 1;
  });
  // the line plate, off register, broken where later parts cover it
  const [rx, ry] = REG;
  scene.parts.forEach((part, idx) => {
    const seed = hashId(part.id), cover = occluders(scene, idx), s = sw(part.role), r = rng(seed);
    g.group("plain", () => {
      if (part.outline !== false) contourRuns(part, byId).forEach((run, i) => occlude(run, cover).forEach((seg, j) => {
        if (seg.length < 3) return;
        const every = Math.max(2, Math.round(seg.length / 22));
        g.pen(thin(seg, every).map(([x, y]) => [x + rx, y + ry] as P), { w: lineW(part, o.weight ?? 1), color: s.line ?? ink, seed: seed + i * 13 + j * 5 + Math.floor(r() * 9), wobble: 0.6, opacity: 0.9, retrace: false, taper: 0.8 });
      }));
      const marks = part.marks.map((m) => (m.kind === "line" ? { ...m, pts: m.pts.map(([x, y]) => [x + rx * 0.4, y + ry * 0.4] as P) } : m));
      drawMarks(g, marks, col, seed + 500, 0.9);
    });
  });
};
