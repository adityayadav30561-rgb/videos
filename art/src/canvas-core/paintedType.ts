// PAINTED TYPE. Devanagari lettering laid with a brush, so the words carry a hand and not a typeface.
// The font is only a GUIDE: its glyphs are rasterised once, never shown, into a mask; a distance field
// over that mask says, at every point inside a letter, how far it is to the letter's edge (half the
// stroke's thickness at its middle) and which way the edge runs. Brush strokes are then laid along the
// letter's own strokes: each one runs parallel to the nearest edge, as wide as the letter is thick
// there, so the brush swells through the bowls and thins into the joins, and the letter's edge is
// where the bristles lift, never the font's outline. Nothing is clipped to the glyph.
import { Gfx, rng, type Env, type P } from "./core";
import { clamp, mix } from "./gallery";
import { oilStroke, type OStroke } from "./paintedOilKit";

export type GlyphField = { x0: number; y0: number; w: number; h: number; d: Float32Array; gx: Float32Array; gy: Float32Array; T: number; top: number; bot: number };
type Layer = { canvas: unknown; ctx: CanvasRenderingContext2D };

export const glyphField = (env: Env, text: string, fam: string, size: number, x: number, y: number, align: CanvasTextAlign = "center", tilt = 0): GlyphField => {
  // not cached: a field is needed only while its word is first painted (the painted word is cached as a sprite)
  const font = `${size}px "${fam}"`, M = env.canvas(8, 8) as unknown as Layer; M.ctx.font = font; const tw = M.ctx.measureText(text).width;
  const cxT = x + (align === "left" ? (tw / 2) * Math.cos(tilt) : align === "right" ? -(tw / 2) * Math.cos(tilt) : 0), cyT = y + (align === "left" ? (tw / 2) * Math.sin(tilt) : align === "right" ? -(tw / 2) * Math.sin(tilt) : 0);
  const R = Math.ceil(Math.hypot(tw / 2, size * 0.9) + size * 0.25), x0 = Math.floor(cxT - R), y0 = Math.floor(cyT - R), w = 2 * R, h = 2 * R;
  const L = env.canvas(w, h) as unknown as Layer, c = L.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h);
  c.translate(x - x0, y - y0); c.rotate(tilt); c.font = font; c.textAlign = align; c.textBaseline = "middle"; c.fillStyle = "#000"; c.fillText(text, 0, 0);
  const a = c.getImageData(0, 0, w, h).data; (L.canvas as { width: number }).width = 1; (M.canvas as { width: number }).width = 1;
  const n = w * h, d = new Float32Array(n), BIG = 1e6;
  for (let i = 0; i < n; i++) d[i] = a[i * 4 + 3] > 110 ? BIG : 0;
  // chamfer distance to the nearest outside pixel, two passes
  const D = 1.4142;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const k = j * w + i; if (!d[k]) continue; let v = d[k]; if (i > 0) v = Math.min(v, d[k - 1] + 1); if (j > 0) { v = Math.min(v, d[k - w] + 1); if (i > 0) v = Math.min(v, d[k - w - 1] + D); if (i < w - 1) v = Math.min(v, d[k - w + 1] + D); } d[k] = v; }
  for (let j = h - 1; j >= 0; j--) for (let i = w - 1; i >= 0; i--) { const k = j * w + i; if (!d[k]) continue; let v = d[k]; if (i < w - 1) v = Math.min(v, d[k + 1] + 1); if (j < h - 1) { v = Math.min(v, d[k + w] + 1); if (i < w - 1) v = Math.min(v, d[k + w + 1] + D); if (i > 0) v = Math.min(v, d[k + w - 1] + D); } d[k] = v; }
  // the field's slope, from a softened copy, gives the direction across the stroke at every point
  const s = new Float32Array(n); for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) { const k = j * w + i; s[k] = (d[k] * 4 + d[k - 1] + d[k + 1] + d[k - w] + d[k + w]) / 8; }
  const gx = new Float32Array(n), gy = new Float32Array(n); let T = 0, top = h, bot = 0;
  for (let j = 2; j < h - 2; j++) for (let i = 2; i < w - 2; i++) { const k = j * w + i; if (!d[k]) continue; gx[k] = (s[k + 1] - s[k - 1]) / 2; gy[k] = (s[k + w] - s[k - w]) / 2; if (d[k] > T) T = d[k]; if (j < top) top = j; if (j > bot) bot = j; }
  return { x0, y0, w, h, d, gx, gy, T, top: y0 + top, bot: y0 + bot };
};

export type Brush = { color: (x: number, y: number, t: number) => string; seed: number; widthK?: number; grow?: number; off?: P; alpha?: number; impasto?: number; dry?: number; step?: number; only?: (d: number, gx: number, gy: number, T: number) => boolean; lenK?: number };
// lay the brush along every letter: centres on a jittered grid inside the glyphs, each stroke parallel
// to the nearest edge and as wide as the letter is thick there
export const paintGlyphs = (g: Gfx, F: GlyphField, b: Brush) => {
  const r = rng(b.seed), st = b.step ?? Math.max(1.6, F.T * 0.42), out: { s: OStroke; k: number }[] = [], [ox, oy] = b.off ?? [0, 0];
  for (let j = 0; j < F.h; j += st) for (let i = 0; i < F.w; i += st) {
    const ii = Math.round(i + (r() - 0.5) * st * 0.9), jj = Math.round(j + (r() - 0.5) * st * 0.9), jr = r(), jb = r();
    if (ii < 2 || jj < 2 || ii >= F.w - 2 || jj >= F.h - 2) continue;
    const k = jj * F.w + ii, d = F.d[k]; if (d < 0.7) continue;
    const gx = F.gx[k], gy = F.gy[k], gl = Math.hypot(gx, gy); if (b.only && !b.only(d, gl > 1e-3 ? gx / gl : 0, gl > 1e-3 ? gy / gl : 0, F.T)) continue;
    const a = gl > 0.05 ? Math.atan2(gy, gx) + Math.PI / 2 : jr * Math.PI, ux = Math.cos(a), uy = Math.sin(a);
    const wv = Math.min(2 * d, F.T * 1.9) * (b.widthK ?? 1.05) + (b.grow ?? 0), len = Math.max(4, wv * (b.lenK ?? 1.7)), x = F.x0 + ii + ox, y = F.y0 + jj + oy, bend = (jb - 0.5) * 0.18 * len;
    const t = clamp((y - oy - F.top) / Math.max(1, F.bot - F.top)), p0: P = [x - (ux * len) / 2, y - (uy * len) / 2], p2: P = [x + (ux * len) / 2, y + (uy * len) / 2];
    out.push({ s: { ctrl: [p0, [x - uy * bend, y + ux * bend], p2], w: Math.max(1.2, wv), c0: b.color(p0[0], p0[1], t), c1: b.color(p2[0], p2[1], t), load: 1.2, dry: b.dry ?? 0.18, impasto: b.impasto ?? 0.18, jit: 0.03, soft: 0.15, alpha: b.alpha, seed: b.seed * 1000 + out.length }, k: x * 0.4 + y + (r() - 0.5) * st * 4 });
  }
  out.sort((p, q) => p.k - q.k).forEach(({ s }) => oilStroke(g, s, 1));
};

const ramp = (stops: string[], t: number) => { const f = clamp(t) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(f)); return mix(stops[i], stops[i + 1], f - i); };
// the hook words: 3D sticker lettering, every layer of it painted: a cast shadow, the extruded body in
// two passes going back, a dark outline (the brush a little wider than the letter), the face in its
// colour light at the top of each letter and deep at the foot, a rim of light along the upper edges
export type StickerSpec = { text: string; x: number; y: number; size: number; face: string[]; rim: string; body: string; outline: string; tilt?: number; seed: number };
export const paintedSticker = (g: Gfx, o: StickerSpec) => {
  const F = glyphField(g.env, o.text, "Yatra", o.size, o.x, o.y, "center", o.tilt ?? 0), dp = o.size * 0.07;
  paintGlyphs(g, F, { color: () => "#3a1030", seed: o.seed, off: [dp * 1.6, dp * 2.2], grow: 3, alpha: 0.35, impasto: 0, dry: 0.4 });
  paintGlyphs(g, F, { color: () => mix(o.body, "#100408", 0.45), seed: o.seed + 1, off: [dp * 0.8, dp * 1.1], grow: o.size * 0.04, impasto: 0.08, dry: 0.15 });
  paintGlyphs(g, F, { color: () => o.body, seed: o.seed + 2, off: [dp * 0.4, dp * 0.55], grow: o.size * 0.04, impasto: 0.1, dry: 0.15 });
  paintGlyphs(g, F, { color: () => o.outline, seed: o.seed + 3, grow: o.size * 0.045, impasto: 0.12, dry: 0.12 });
  paintGlyphs(g, F, { color: (_x, _y, t) => ramp(o.face, 1 - t * 0.9), seed: o.seed + 4, impasto: 0.28, dry: 0.2 });
  paintGlyphs(g, F, { color: () => o.rim, seed: o.seed + 5, widthK: 0.4, lenK: 3.2, step: F.T * 1.1, impasto: 0.5, dry: 0.45, alpha: 0.85, only: (d, gx, gy, T) => d > T * 0.18 && d < T * 0.42 && gx * 0.45 + gy * 0.9 > 0.72 });
};
// the lyric lines: one colour per phrase, a small round brush, a soft dark beneath
export const paintedLine = (g: Gfx, text: string, x: number, y: number, size: number, color: string, seed: number, align: CanvasTextAlign = "center", tilt = 0) => {
  const F = glyphField(g.env, text, "KalamB", size, x, y, align, tilt);
  // small letters want a finer brush: thinner, longer strokes, closer together, so the counters stay open
  paintGlyphs(g, F, { color: () => "#5a1a3a", seed, off: [2, 3], alpha: 0.22, impasto: 0, dry: 0.4, widthK: 0.8, lenK: 1.4, step: Math.max(1.4, F.T * 0.34) });
  paintGlyphs(g, F, { color: (_x, _y, t) => mix(color, "#ffffff", 0.12 * (1 - t)), seed: seed + 1, impasto: 0.2, dry: 0.12, widthK: 0.85, lenK: 1.35, step: Math.max(1.3, F.T * 0.3) });
};
