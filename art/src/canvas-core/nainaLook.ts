import { Gfx, rng, fractal, type Ctx, type Env, type Medium, type P } from "./core";
import type { Film } from "./film";
import { bounds, clamp, inside, mix, smooth } from "./gallery";
import { fill, oilStroke, weave, type OStroke } from "./paintedOilKit";
import { KALAMBOLD, YATRAONE } from "../../assets/fonts/devanagari";

// NAINA · LOOK FRAMES · oil on canvas, vertical 9:16.
//
// Six look stills for a Hindi lyric film, before the script arrives: they prove the hand on the
// reference's own images (the person's reference video: a saffron card on teal, lyrics in Devanagari,
// each word turned into a picture that morphs into the next). The pictures here are the reference's
// (title, wound, plaster with an eye, lily with dew, the world in an eye, blushing stars) and will be
// replaced by the script's.
// MEDIUM (paintedOil's recipe): oil on toned linen, hog-bristle flats, dark to light, impasto on the
// glints. The reference's flat cartoon objects become painted ones: every object is a "pillow" form
// (it rises from its outline to a soft crown), lit from one light, upper left, so it turns from a
// warm light through a half tone into a shadow; a dark contour painted with a small brush on its
// shadow side only (found on the light side, as a painter leaves it); thick white glints.
// THE STAGE: the reference's scalloped saffron card on a teal ground, kept as the film's one fixed
// place, painted: the teal in broad diagonal passes, the card in cadmium yellow and ochre warming to
// a glow at its middle, a faint mandala scumbled into it with lean paint.
// LETTERING: Yatra One (a chunky brush Devanagari) for the big glossy words: an extruded dark body,
// a dark outline, a face painted in oil strokes clipped to the letters, light along its top, sparkles.
// Kalam (handwritten) for lyric lines, laid in one colour with a small brush's soft shadow.

const OIL_M: Medium = { nib: 1, taper: 1, pressure: 1, retrace: false, wobble: 0, rough: 0 };
const W = 1080, H = 1920;
const L3 = (() => { const v = [-0.55, -0.7, 0.55], l = Math.hypot(...v); return v.map((x) => x / l) as [number, number, number]; })();

// ---------------------------------------------------------------- fonts (carried in the film, registered before the first frame)
const face = (family: string, b64: string) => {
  const g = globalThis as unknown as { FontFace?: new (f: string, s: ArrayBuffer) => { load(): Promise<unknown> }; document?: { fonts: { add(f: unknown): void } } };
  if (!g.FontFace || !g.document) return;
  const bin = atob(b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const f = new g.FontFace(family, u8.buffer); g.document.fonts.add(f); void f.load();
};
face("Yatra", YATRAONE); face("KalamB", KALAMBOLD);

// ---------------------------------------------------------------- colour
const ramp = (stops: string[], t: number) => { const f = clamp(t) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(f)); return mix(stops[i], stops[i + 1], f - i); };
const TEAL = ["#062624", "#0c403c", "#14625a", "#1d877b", "#33ab9a", "#6fcfbd"];
const SAFFRON = ["#6a3204", "#a5560a", "#d37c12", "#eb9c1e", "#f5b636", "#fbd170", "#fee9b0"];
const CRIMSON = ["#1e0204", "#45070b", "#760f14", "#a3191c", "#c8352c", "#e66a52", "#fbb8a0"];
const PLASTER = ["#5a3c22", "#8f6a46", "#bf986c", "#dcbb8e", "#efd6ac", "#fbefd4"];
const SCLERA = ["#9a8a7a", "#c8baa6", "#e6dccb", "#f5eee2", "#fffbf4"];
const IRIS = ["#120804", "#2e1408", "#5a2a10", "#8a4818", "#b8722e"];
const ORANGE = ["#4a1802", "#8a3606", "#c6600c", "#ea8a1a", "#f8ad3c", "#fdd88a"];
const OCEAN = ["#08182a", "#12304e", "#1f4e72", "#346f92", "#5f97b2", "#a6c8d6"];
const LAND = ["#1a2208", "#34420e", "#566a18", "#7c9028", "#a6b24a", "#d0d488"];
const MAGENTA = ["#2a0420", "#5a0a44", "#8e166a", "#c02a8c", "#e05cae", "#f8a6d6"];
const UMBER = "#2a1408";

// ---------------------------------------------------------------- geometry helpers
const signedArea = (p: P[]) => p.reduce((a, q, i) => { const r = p[(i + 1) % p.length]; return a + q[0] * r[1] - r[0] * q[1]; }, 0) / 2;
const edgeDist = (poly: P[], x: number, y: number) => { let d = 1e9; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [ax, ay] = poly[j], [bx, by] = poly[i], dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1, t = clamp(((x - ax) * dx + (y - ay) * dy) / L); d = Math.min(d, Math.hypot(x - ax - dx * t, y - ay - dy * t)); } return d; };
// a PILLOW form: height rises from 0 at the outline to 1 at R inside it, so the normal tilts out at
// the edges and faces us in the middle, the way a stuffed or turned form does
const pillowN = (poly: P[], R: number) => {
  const h = (x: number, y: number) => { if (!inside(poly, x, y)) return 0; const t = Math.min(1, edgeDist(poly, x, y) / R); return 1 - (1 - t) * (1 - t); };
  return (x: number, y: number): [number, number, number] => { const e = 2, hx = (h(x + e, y) - h(x - e, y)) / (2 * e), hy = (h(x, y + e) - h(x, y - e)) / (2 * e), k = R * 0.85, v = [-hx * k, -hy * k, 1], l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
};
const sphereN = (cx: number, cy: number, r: number) => (x: number, y: number): [number, number, number] => { const u = (x - cx) / r, v = (y - cy) / r, z = Math.sqrt(Math.max(0.02, 1 - u * u - v * v)), l = Math.hypot(u, v, z); return [u / l, v / l, z / l]; };
const lit = (n: [number, number, number]) => Math.max(0, n[0] * L3[0] + n[1] * L3[1] + n[2] * L3[2]);
// painters' planes: shadow, half tone, light, top light
const plane = (I: number) => (I < 0.38 ? 0.16 : I < 0.62 ? 0.38 : I < 0.84 ? 0.62 : 0.84);
const thin = (pts: P[], n: number): P[] => { const out: P[] = []; for (let i = 0; i < n; i++) out.push(pts[Math.round((i * (pts.length - 1)) / Math.max(1, n - 1))]); return out; };
const resampleClosed = (poly: P[], step: number): P[] => { const out: P[] = []; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / step)); for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]); } return out; };
const rot = (pts: P[], cx: number, cy: number, a: number): P[] => pts.map(([x, y]) => [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)]);
const ellipse = (cx: number, cy: number, rx: number, ry: number, n = 48, a0 = 0, a1 = Math.PI * 2): P[] => Array.from({ length: n }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as P; });

// ---------------------------------------------------------------- painting helpers
type Ctxs = { g: Gfx };
const withClip = (g: Gfx, keep: P[][] | null, fn: () => void) => { if (!keep) return fn(); const c = g.cur; c.save(); c.beginPath(); keep.forEach((p) => { c.moveTo(p[0][0], p[0][1]); p.forEach(([x, y]) => c.lineTo(x, y)); c.closePath(); }); c.clip("nonzero"); fn(); c.restore(); };
const lay = (g: Gfx, strokes: OStroke[], keep: P[][] | null = null) => withClip(g, keep, () => strokes.forEach((s) => oilStroke(g, s, 1)));
const st = (ctrl: P[], w: number, c0: string, seed: number, o: Partial<OStroke> = {}): OStroke => ({ ctrl, w, c0, c1: o.c1 ?? c0, load: 1.05, dry: 0.25, impasto: 0.3, jit: 0.05, seed, ...o });
// a form painted in its planes: a lean dark block-in, then the half tones and lights in fatter paint,
// the strokes following `dir`; colour from the light on the form's normal
const paintForm = (g: Gfx, poly: P[], col: (x: number, y: number) => string, w: number, dir: (x: number, y: number) => number, seed: number, gloss = false) => {
  const b = bounds(poly), pad = w;
  const region: P[] = [[b.x0 - pad, b.y0 - pad], [b.x1 + pad, b.y0 - pad], [b.x1 + pad, b.y1 + pad], [b.x0 - pad, b.y1 + pad]];
  const inn = (f: (x: number, y: number) => string | null) => (x: number, y: number) => (inside(poly, x, y) ? f(x, y) : null);
  lay(g, fill({ region, step: w * 0.55, len: w * 2.4, w: w * 1.2, dir, seed, load: 1.15, dry: 0.15, impasto: 0.05, jit: gloss ? 0.015 : 0.03, soft: 0.25, color: inn((x, y) => mix(col(x, y), UMBER, gloss ? 0.06 : 0.2)), sweep: 3.14 }), [poly]);
  lay(g, fill({ region, step: w * 0.42, len: w * 2, w, dir, seed: seed + 1, load: gloss ? 1.2 : 1.05, dry: gloss ? 0.12 : 0.3, impasto: 0.22, jit: gloss ? 0.018 : 0.035, soft: 0.25, bend: 0.25, color: inn(col), sweep: 3.14 }), [poly]);
};
// the painted contour: a small brush round the shadow side (outward normal turned from the light),
// thinning and lifting off where the edge turns to the light
const contour = (g: Gfx, poly: P[], color: string, w: number, seed: number) => {
  const pts = resampleClosed(poly, 6), ccw = signedArea(poly) > 0, n = pts.length, runs: P[][] = []; let run: P[] = [];
  for (let i = 0; i <= n; i++) {
    const p = pts[i % n], a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1, nx = (ccw ? ty : -ty) / l, ny = (ccw ? -tx : tx) / l, away = -(nx * L3[0] + ny * L3[1]);
    if (away > -0.25) run.push(p); else { if (run.length > 3) runs.push(run); run = []; }
  }
  if (run.length > 3) runs.push(run);
  lay(g, runs.map((r, i) => st(thin(r, Math.max(3, Math.round(r.length / 4))), w, color, seed + i, { impasto: 0.12, dry: 0.12, load: 1.1, jit: 0.02 })));
};
// impasto glints: short thick dabs of near-white where the form turns straight to the light
const glint = (g: Gfx, at: P, len: number, a: number, w: number, seed: number, col = "#fffaf0") => lay(g, [st([[at[0] - Math.cos(a) * len / 2, at[1] - Math.sin(a) * len / 2], at, [at[0] + Math.cos(a) * len / 2, at[1] + Math.sin(a) * len / 2]], w, col, seed, { impasto: 1, load: 1.4, dry: 0.05, jit: 0.02, soft: 0 })]);
// a four-pointed sparkle in thick paint, as the reference scatters round its glossy words
const sparkle = (g: Gfx, x: number, y: number, r0: number, seed: number) => { const r = r0 * 1.8; lay(g, [
  st([[x - r, y], [x, y], [x + r, y]], r * 0.2, "#fffbe8", seed, { impasto: 0.9, load: 1.3, dry: 0, jit: 0.02, soft: 0 }),
  st([[x, y - r * 1.25], [x, y], [x, y + r * 1.25]], r * 0.2, "#fffbe8", seed + 1, { impasto: 0.9, load: 1.3, dry: 0, jit: 0.02, soft: 0 }),
  st([[x - r * 0.12, y], [x, y], [x + r * 0.12, y]], r * 0.34, "#ffffff", seed + 2, { impasto: 1, load: 1.4, dry: 0, jit: 0.01, soft: 0 }),
]); };

// ---------------------------------------------------------------- lettering
// paint onto a layer, then keep only what lies inside the letters (destination-in), then lay the layer down
const onLayer = (g: Gfx, fn: (lg: Gfx) => void, mask: (c: CanvasRenderingContext2D) => void) => {
  const e = g.env, DW = Math.round(e.W * e.scale), DH = Math.round(e.H * e.scale), key = `nainaLook:layer:${DW}x${DH}`;
  let L = e.cache.get(key) as { canvas: unknown; ctx: CanvasRenderingContext2D } | undefined; if (!L) { L = e.canvas(DW, DH) as unknown as { canvas: unknown; ctx: CanvasRenderingContext2D }; e.cache.set(key, L); }
  const c = L.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = "source-over"; c.globalAlpha = 1; c.clearRect(0, 0, DW, DH); c.setTransform(e.scale, 0, 0, e.scale, 0, 0);
  const lg = new Gfx(c as unknown as Ctx, e, 0, OIL_M); fn(lg);
  c.setTransform(e.scale, 0, 0, e.scale, 0, 0); c.globalCompositeOperation = "destination-in"; c.globalAlpha = 1; mask(c); c.globalCompositeOperation = "source-over";
  const m = g.cur; m.save(); m.setTransform(1, 0, 0, 1, 0, 0); m.drawImage(L.canvas as CanvasImageSource, 0, 0); m.restore();
};
type Glossy = { text: string; x: number; y: number; size: number; face: string[]; rim: string; body: string; outline: string; tilt?: number; seed: number; sparkles?: [number, number, number][] };
const font = (fam: string, size: number) => `${size}px "${fam}"`;
const glossyWord = (g: Gfx, o: Glossy) => {
  const c = g.cur, f = font("Yatra", o.size), depth = Math.round(o.size * 0.07), tilt = o.tilt ?? 0;
  const tx = (cc: CanvasRenderingContext2D, fn: () => void) => { cc.save(); cc.translate(o.x, o.y); cc.rotate(tilt); fn(); cc.restore(); };
  // a soft cast shadow on the card, then the extruded body, darker as it goes back
  tx(c, () => { c.font = f; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = "#5a2a04"; c.globalAlpha = 0.35; c.fillText(o.text, depth * 1.6, depth * 2.2); c.globalAlpha = 1; for (let i = depth; i >= 1; i--) { c.fillStyle = mix(o.body, "#100408", (i / depth) * 0.5); c.fillText(o.text, i * 0.7, i); } c.lineJoin = "round"; c.strokeStyle = o.outline; c.lineWidth = o.size * 0.05; c.strokeText(o.text, 0, 0); });
  // the face: horizontal bristle strokes, light along the top of each letter, deep at the foot
  const m = (() => { const mc = c; mc.save(); mc.font = f; const w = mc.measureText(o.text).width; mc.restore(); return w; })();
  const x0 = o.x - m / 2 - 30, x1 = o.x + m / 2 + 30, y0 = o.y - o.size * 0.75, y1 = o.y + o.size * 0.55;
  onLayer(g, (lg) => {
    const r = rng(o.seed), out: OStroke[] = [];
    for (let y = y0; y < y1; y += o.size * 0.06) for (let x = x0; x < x1; x += o.size * 0.5) {
      const t = (y - y0) / (y1 - y0), c0 = ramp(o.face, 1 - t * 0.95 + (r() - 0.5) * 0.06), xx = x + (r() - 0.5) * 30;
      out.push(st([[xx - o.size * 0.4, y + (r() - 0.5) * 4], [xx, y + (r() - 0.5) * 4], [xx + o.size * 0.4, y + (r() - 0.5) * 4]], o.size * 0.1, c0, o.seed * 100 + out.length, { c1: ramp(o.face, 1 - t * 0.95 - 0.08), impasto: 0.25, dry: 0.3, soft: 0.2 }));
    }
    lg.cur.save(); lg.cur.translate(o.x, o.y); lg.cur.rotate(tilt); lg.cur.translate(-o.x, -o.y); out.forEach((s) => oilStroke(lg, s, 1)); lg.cur.restore();
  }, (mc) => tx(mc, () => { mc.font = f; mc.textAlign = "center"; mc.textBaseline = "middle"; mc.fillStyle = "#000"; mc.fillText(o.text, 0, 0); }));
  // the rim: the light caught on the upper-left edge of every stroke of every letter
  onLayer(g, (lg) => { const k = lg.cur; k.save(); k.translate(o.x, o.y); k.rotate(tilt); k.font = f; k.textAlign = "center"; k.textBaseline = "middle"; k.fillStyle = o.rim; k.fillText(o.text, 0, 0); k.restore(); },
    (mc) => tx(mc, () => { mc.font = f; mc.textAlign = "center"; mc.textBaseline = "middle"; mc.fillStyle = "#000"; mc.fillText(o.text, 0, 0); mc.globalCompositeOperation = "destination-out"; mc.fillText(o.text, o.size * 0.022, o.size * 0.03); mc.globalCompositeOperation = "destination-in"; }));
  (o.sparkles ?? []).forEach(([sx, sy, sr], i) => sparkle(g, sx, sy, sr, o.seed * 10 + i));
};
// a handwritten lyric line in one colour: a soft dark under it, the ink laid with a small round brush
const handLine = (g: Gfx, text: string, x: number, y: number, size: number, color: string, opts: { align?: CanvasTextAlign; tilt?: number } = {}) => {
  const c = g.cur; c.save(); c.translate(x, y); c.rotate(opts.tilt ?? 0); c.font = font("KalamB", size); c.textAlign = opts.align ?? "center"; c.textBaseline = "middle";
  c.fillStyle = "#6a3006"; c.globalAlpha = 0.3; c.fillText(text, 3, 4); c.globalAlpha = 1; c.fillStyle = color; c.fillText(text, 0, 0);
  c.globalAlpha = 0.35; c.fillStyle = mix(color, "#ffffff", 0.45); c.fillText(text, -1.2, -1.5); c.globalAlpha = 1; c.fillStyle = color; c.fillText(text, 0.6, 0.8); c.restore();
};

// ---------------------------------------------------------------- the stage
const CARD = (() => {
  const x0 = 64, y0 = 96, x1 = W - 64, y1 = H - 96, corners: P[] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], pts: P[] = [];
  const per = (t: number): [P, P] => { const w = x1 - x0, h = y1 - y0, L = 2 * (w + h); let d = t * L; if (d < w) return [[x0 + d, y0], [0, -1]]; d -= w; if (d < h) return [[x1, y0 + d], [1, 0]]; d -= h; if (d < w) return [[x1 - d, y1], [0, 1]]; d -= w; return [[x0, y1 - d], [-1, 0]]; };
  for (let i = 0; i < 1200; i++) {
    const [[x, y], [nx, ny]] = per(i / 1200); let off = 0;
    for (const [cx, cy] of corners) { const d = Math.hypot(x - cx, y - cy); off -= Math.max(0, 74 - d) * 1.0; off += 20 * Math.exp(-(((d - 150) / 34) ** 2)) - 12 * Math.exp(-(((d - 218) / 26) ** 2)) + 12 * Math.exp(-(((d - 280) / 30) ** 2)); }
    pts.push([x + nx * off, y + ny * off]);
  }
  return pts;
})();
const CX = W / 2, CY = H / 2;
const stage = (g: Gfx, seed: number) => {
  const c = g.cur; c.setTransform(g.env.scale, 0, 0, g.env.scale, 0, 0); c.fillStyle = "#efe8da"; c.fillRect(0, 0, W, H); weave(g, 0.55);
  // the teal ground, a big flat in steep passes
  const tealCol = (x: number, y: number) => ramp(TEAL, 0.5 + 0.18 * (fractal(seed + 3, x, y, 0.004, 0.004, 2) - 0.5) - 0.12 * Math.hypot((x - CX) / W, (y - CY) / H));
  lay(g, fill({ region: [[-60, -60], [W + 60, -60], [W + 60, H + 60], [-60, H + 60]], step: 56, len: 200, w: 76, dir: () => -1.1, seed: seed + 10, load: 1.1, dry: 0.4, impasto: 0.06, jit: 0.04, soft: 0.25, color: tealCol, sweep: 0 }));
  // the card: cadmium and ochre, a warm glow at its middle, its edges a shade deeper
  const cardCol = (x: number, y: number) => { const d = Math.hypot((x - CX) / (W * 0.5), (y - CY) / (H * 0.5)); return ramp(SAFFRON, 0.78 - 0.26 * d * d + 0.08 * (fractal(seed + 5, x, y, 0.006, 0.006, 2) - 0.5)); };
  lay(g, fill({ region: [[0, 0], [W, 0], [W, H], [0, H]], step: 44, len: 150, w: 62, dir: (x, y) => 0.6 + (fractal(seed + 7, x, y, 0.002, 0.002, 1) - 0.5) * 0.6, seed: seed + 20, load: 1.1, dry: 0.35, impasto: 0.08, jit: 0.035, soft: 0.25, color: (x, y) => (inside(CARD, x, y) ? cardCol(x, y) : null), sweep: 0 }), [CARD]);
  // the mandala, scumbled thin: three rings of petals and a lotus at the heart, barely there
  const mr = rng(seed + 30), md: OStroke[] = [];
  [[150, 12], [300, 18], [470, 24]].forEach(([R, n], ri) => { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + ri * 0.13, a0 = a - Math.PI / n * 0.9, a1 = a + Math.PI / n * 0.9, r0 = R - 70 - ri * 10; md.push(st([[CX + Math.cos(a0) * r0, CY + Math.sin(a0) * r0], [CX + Math.cos(a) * (R + 8), CY + Math.sin(a) * (R + 8)], [CX + Math.cos(a1) * r0, CY + Math.sin(a1) * r0]], 5, ramp(SAFFRON, 0.5 + mr() * 0.06), seed + 40 + md.length, { alpha: 0.4, impasto: 0, dry: 0.3 })); } });
  for (let i = 0; i < 3; i++) md.push(st(ellipse(CX, CY, 520 + i * 160, 520 + i * 160, 60), 4, ramp(SAFFRON, 0.52), seed + 90 + i, { alpha: 0.28, impasto: 0, dry: 0.5 }));
  lay(g, md, [CARD]);
  // the card's edge: a deep ochre line, and a light line just inside it where the bevel turns up
  const edge = (pts: P[], k: number, col: string, w: number, s: number, imp: number) => { const out: OStroke[] = []; for (let i = 0; i < pts.length; i += 60) out.push(st(pts.slice(i, Math.min(pts.length, i + 64)).filter((_, j) => j % 8 === 0).concat([pts[Math.min(pts.length - 1, i + 63)]]).map(([x, y]) => [CX + (x - CX) * k, CY + (y - CY) * k] as P), w, col, s + i, { impasto: imp, dry: 0.15, load: 1.1, jit: 0.03, soft: 0.1 })); return out; };
  lay(g, [...edge([...CARD, CARD[0]], 1, "#7a3a06", 6, seed + 200, 0.2), ...edge([...CARD, CARD[0]], 0.985, "#fde2a0", 3, seed + 400, 0.45)]);
};

// ---------------------------------------------------------------- the objects
const objCol = (rampS: string[], n: (x: number, y: number) => [number, number, number], k = 1) => (x: number, y: number) => ramp(rampS, plane(lit(n(x, y)) * k) + (fractal(77, x, y, 0.03, 0.03, 1) - 0.5) * 0.05);
const along = (a: number) => () => a;
const tangentDir = (cx: number, cy: number) => (x: number, y: number) => Math.atan2(y - cy, x - cx) + Math.PI / 2;
// the WOUND: a wavering slash, thick in the middle and torn to points at its ends
const woundPoly = (cx: number, cy: number, len: number, wid: number, a: number): P[] => {
  const top: P[] = [], bot: P[] = [];
  for (let i = 0; i <= 60; i++) { const t = i / 60, x = (t - 0.5) * len, y = Math.sin(t * Math.PI * 2.2) * len * 0.07, w = wid * Math.pow(Math.sin(Math.PI * t), 0.7) * (1 + 0.18 * Math.sin(t * 23)); top.push([x, y - w / 2]); bot.push([x, y + w / 2 + (i % 7 === 3 ? 3 : 0)]); }
  return rot([...top, ...bot.reverse()].map(([x, y]) => [cx + x, cy + y] as P), cx, cy, a);
};
const paintWound = (g: Gfx, poly: P[], seed: number) => {
  const n = pillowN(poly, 22); paintForm(g, poly, objCol(CRIMSON, n, 1.15), 14, along(-0.45), seed); contour(g, poly, "#1a0204", 4, seed + 50);
  const b = bounds(poly), r = rng(seed);
  for (let i = 0; i < 9; i++) { const x = b.x0 + (b.x1 - b.x0) * (0.12 + i * 0.09), ys: number[] = []; for (let y = b.y0; y < b.y1; y += 2) if (inside(poly, x, y)) ys.push(y); if (ys.length > 6) glint(g, [x + r() * 6, ys[Math.round(ys.length * 0.28)]], 18 + r() * 14, -0.42, 4, seed + 70 + i, "#ffd8c8"); }
};
const paintEye = (g: Gfx, cx: number, cy: number, w: number, open: number, irisFn: ((g: Gfx, cx: number, cy: number, r: number) => void) | null, seed: number) => {
  const hh = (w / 2) * 0.42 * open, upper: P[] = [], lower: P[] = [];
  for (let i = 0; i <= 40; i++) { const t = i / 40, x = cx - w / 2 + w * t, s = Math.sin(Math.PI * t); upper.push([x, cy - hh * Math.pow(s, 0.8) * (1 + 0.15 * (t - 0.5))]); lower.push([x, cy + hh * 0.75 * Math.pow(s, 1.1)]); }
  const almond = [...upper, ...lower.reverse()];
  paintForm(g, almond, objCol(SCLERA, pillowN(almond, w * 0.1), 1.3), 12, tangentDir(cx, cy), seed, true);
  const ir = hh * 0.95;
  withClip(g, [almond], () => {
    if (irisFn) irisFn(g, cx, cy + hh * 0.06, ir); else {
      const iris = ellipse(cx, cy + hh * 0.06, ir, ir, 48), n = sphereN(cx, cy, ir);
      paintForm(g, iris, (x, y) => ramp(IRIS, 0.2 + 0.75 * clamp(Math.hypot(x - cx, y - cy) / ir) * 0.6 + 0.3 * lit(n(x, y))), 7, tangentDir(cx, cy), seed + 5);
      lay(g, [st(ellipse(cx, cy + hh * 0.06, ir * 0.42, ir * 0.42, 24).concat([[cx + ir * 0.42, cy + hh * 0.06]]), ir * 0.36, "#080302", seed + 6, { impasto: 0.1, dry: 0.05 })]);
    }
    // the lid's shadow across the top of the eyeball
    lay(g, [st(thin(upper, 12).map(([x, y]) => [x, y + hh * 0.12] as P), hh * 0.28, "#6a5040", seed + 7, { alpha: 0.55, impasto: 0, dry: 0.4 })]);
  });
  glint(g, [cx - ir * 0.35, cy - ir * 0.25], ir * 0.22, -0.6, ir * 0.16, seed + 8);
  lay(g, [st(thin(upper, 16), 7, "#140806", seed + 9, { impasto: 0.2, dry: 0.08, load: 1.2 }), st(thin(lower, 12).reverse().slice(1, 11), 3, "#3a1a10", seed + 10, { impasto: 0.1, dry: 0.3 })]);
  // lashes: each one a flick from the lid, curving up and out, longer toward the outer corner
  const ls: OStroke[] = [], sc = w / 300; for (let i = 0; i < 13; i++) { const t = 0.3 + i * 0.052, p = upper[Math.round(t * 40)], L = (22 + i * 3.4) * sc, a = -Math.PI / 2 - 0.35 + i * 0.1; ls.push(st([p, [p[0] + Math.cos(a) * L * 0.55, p[1] + Math.sin(a) * L * 0.55], [p[0] + Math.cos(a + 0.75) * L, p[1] + Math.sin(a + 0.75) * L * 0.95]], 4.2 * Math.sqrt(sc), "#100604", seed + 20 + i, { impasto: 0.2, dry: 0.15, load: 1.2 })); }
  lay(g, ls);
  return almond;
};
const LILY_C: P = [CX, 990];
const petal = (a: number, len: number, wid: number, curl: number): P[] => { const L: P[] = [], R: P[] = []; for (let i = 0; i <= 24; i++) { const t = i / 24, w = wid * Math.sin(Math.PI * Math.pow(t, 0.75)) * (1 - 0.15 * t), bend = curl * t * t * len; L.push([t * len, -w / 2 + bend]); R.push([t * len, w / 2 + bend]); } return [...L, ...R.reverse()].map(([x, y]) => [LILY_C[0] + x * Math.cos(a) - y * Math.sin(a), LILY_C[1] + x * Math.sin(a) + y * Math.cos(a)] as P); };
const paintLily = (g: Gfx, seed: number) => {
  // a lily seen from the front: six tepals sixty degrees apart, the three outer ones (behind) broader,
  // the three inner ones laid over them; every tip recurves, curling the same way round
  const angles = Array.from({ length: 6 }, (_, i) => -Math.PI / 2 + (i * Math.PI) / 3 + 0.12), order = [1, 3, 5, 0, 2, 4];
  const pets = angles.map((a, i) => petal(a, i % 2 ? 330 : 360, i % 2 ? 210 : 170, 0.16));
  order.forEach((i) => { const p = pets[i], n = pillowN(p, 60), a = angles[i], back = i % 2 === 1 ? 0.8 : 1; paintForm(g, p, (x, y) => { const t = clamp(Math.hypot(x - LILY_C[0], y - LILY_C[1]) / 150); return mix("#e8b23a", objCol(CRIMSON, n, 1.25 * back)(x, y), 0.35 + 0.65 * t); }, 15, along(a), seed + i * 10, true); contour(g, p, "#1a0204", 4, seed + i * 10 + 5);
    // the vein down the middle of each petal, and the freckles near its base
    const v: P[] = [0.12, 0.45, 0.8].map((t) => [LILY_C[0] + Math.cos(a) * 360 * t, LILY_C[1] + Math.sin(a) * 360 * t] as P); lay(g, [st(v, 5, "#4a0408", seed + i * 10 + 7, { impasto: 0.1, dry: 0.4 })], [p]);
    const r = rng(seed + i); for (let k = 0; k < 5; k++) { const t = 0.15 + r() * 0.25, s = (r() - 0.5) * 40, x = LILY_C[0] + Math.cos(a) * 300 * t - Math.sin(a) * s, y = LILY_C[1] + Math.sin(a) * 300 * t + Math.cos(a) * s; lay(g, [st([[x, y], [x + 3, y + 2]], 6, "#2a0204", seed + 400 + i * 10 + k, { impasto: 0.3 })], [p]); }
    glint(g, [LILY_C[0] + Math.cos(a) * 220 - Math.sin(a) * -26, LILY_C[1] + Math.sin(a) * 220 + Math.cos(a) * -26], 60, a, 7, seed + i * 10 + 8, "#ffc8b4");
  });
  // stamens: pale filaments arching out of the throat, rust anthers
  const sr = rng(seed + 90), sts: OStroke[] = [];
  for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.3, L = 240 + sr() * 40, tip: P = [LILY_C[0] + Math.cos(a) * L, LILY_C[1] + Math.sin(a) * L]; sts.push(st([LILY_C, [LILY_C[0] + Math.cos(a - 0.15) * L * 0.55, LILY_C[1] + Math.sin(a - 0.15) * L * 0.55], tip], 4, "#f2d6a6", seed + 100 + i, { c1: "#d8a868", impasto: 0.3 }), st([[tip[0] - 9, tip[1]], tip, [tip[0] + 9, tip[1] + 2]], 9, "#6a2a08", seed + 120 + i, { c1: "#a85a1e", impasto: 0.6 })); }
  lay(g, sts);
};
const paintDrop = (g: Gfx, cx: number, cy: number, r: number, seed: number) => {
  const poly = ellipse(cx, cy, r, r * 1.08, 36), n = sphereN(cx, cy, r);
  paintForm(g, poly, (x, y) => mix(ramp(OCEAN, 0.35 + 0.55 * clamp(1 - lit(n(x, y))) * 0.6 + 0.3 * clamp((y - cy) / r)), "#a3191c", 0.25), 5, tangentDir(cx, cy), seed);
  contour(g, poly, "#0a1420", 2.6, seed + 3); glint(g, [cx - r * 0.38, cy - r * 0.42], r * 0.42, -0.7, r * 0.28, seed + 4); lay(g, [st(ellipse(cx + r * 0.1, cy + r * 0.2, r * 0.6, r * 0.55, 12, 0.2, 1.6), 3, "#c8e4ec", seed + 5, { impasto: 0.4 })]);
};
const globeIris = (g: Gfx, cx: number, cy: number, r: number) => {
  const disc = ellipse(cx, cy, r, r, 60), n = sphereN(cx, cy, r);
  paintForm(g, disc, (x, y) => ramp(OCEAN, plane(lit(n(x, y))) * 0.9 + 0.08), 9, tangentDir(cx, cy), 900);
  // continents: blobs wrapped onto the sphere, pressed toward the limb so they read as round
  const blob = (u: number, v: number, s: number, sd: number): P[] => Array.from({ length: 28 }, (_, i) => { const a = (i / 28) * Math.PI * 2, k = s * (0.7 + 0.5 * fractal(sd, Math.cos(a) * 2 + 5, Math.sin(a) * 2 + 5, 0.9, 0.9, 2)); let x = u + Math.cos(a) * k, y = v + Math.sin(a) * k * 1.2; const d = Math.hypot(x, y); if (d > 0.96) { x *= 0.96 / d; y *= 0.96 / d; } return [cx + x * r, cy + y * r] as P; });
  [blob(-0.25, -0.2, 0.32, 910), blob(0.32, 0.25, 0.28, 911), blob(0.05, 0.62, 0.18, 912), blob(0.55, -0.45, 0.16, 913)].forEach((b, i) => withClip(g, [disc], () => paintForm(g, b, (x, y) => ramp(LAND, plane(lit(n(x, y))) * 0.95 + 0.05), 7, tangentDir(cx, cy), 920 + i * 5)));
  lay(g, [st(ellipse(cx, cy, r - 3, r - 3, 40).concat([[cx + r - 3, cy]]), 7, "#0a1420", 950, { impasto: 0.15, dry: 0.05 })]);
  glint(g, [cx - r * 0.42, cy - r * 0.42], r * 0.3, -0.75, r * 0.12, 951);
  lay(g, [st(ellipse(cx, cy, r * 0.8, r * 0.8, 16, Math.PI * 1.05, Math.PI * 1.45), 4, "#e8f2f4", 952, { impasto: 0.6, dry: 0.2 })]);
};
// a five-pointed star with plump, slightly curling arms: ten points (tips and the notches between),
// smoothed into one rounded outline, the tips swept a little round like the reference's starfish stars
const star = (cx: number, cy: number, R: number, a0: number, curl: number): P[] => { const ctrl: P[] = []; for (let i = 0; i < 10; i++) { const a = a0 + (i * Math.PI) / 5 + (i % 2 ? 0 : curl * 0.12), r = i % 2 ? R * 0.46 : R; ctrl.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return smooth(ctrl, true, 14); };
const paintStar = (g: Gfx, cx: number, cy: number, R: number, seed: number, tilt: number) => {
  const p = star(cx, cy, R, -Math.PI / 2 + tilt, 1), n = pillowN(p, R * 0.22);
  paintForm(g, p, objCol(ORANGE, n, 1.2), 11, tangentDir(cx, cy), seed, true); contour(g, p, "#3a1002", 4.5, seed + 5);
  // shy: eyes squeezed shut in two little arcs, cheeks flushed red in thin glazes
  lay(g, [st([[cx - R * 0.28, cy - R * 0.02], [cx - R * 0.2, cy - R * 0.08], [cx - R * 0.12, cy - R * 0.02]], 4.5, "#3a1002", seed + 6, { impasto: 0.2, dry: 0.1 }), st([[cx + R * 0.12, cy - R * 0.02], [cx + R * 0.2, cy - R * 0.08], [cx + R * 0.28, cy - R * 0.02]], 4.5, "#3a1002", seed + 7, { impasto: 0.2, dry: 0.1 }),
    st([[cx - R * 0.36, cy + R * 0.12], [cx - R * 0.28, cy + R * 0.13], [cx - R * 0.2, cy + R * 0.12]], R * 0.14, "#e0283a", seed + 8, { alpha: 0.55, impasto: 0, dry: 0.5 }), st([[cx + R * 0.2, cy + R * 0.12], [cx + R * 0.28, cy + R * 0.13], [cx + R * 0.36, cy + R * 0.12]], R * 0.14, "#e0283a", seed + 9, { alpha: 0.55, impasto: 0, dry: 0.5 }),
    st([[cx - R * 0.08, cy + R * 0.16], [cx, cy + R * 0.2], [cx + R * 0.08, cy + R * 0.16]], 3.5, "#3a1002", seed + 10, { impasto: 0.15 })]);
  for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + tilt + (k * 2 * Math.PI) / 5, gx = cx + Math.cos(a) * R * 0.55 - Math.sin(a) * R * -0.07, gy = cy + Math.sin(a) * R * 0.55 + Math.cos(a) * R * -0.07; if (Math.cos(a) * L3[0] + Math.sin(a) * L3[1] > -0.3) glint(g, [gx, gy], R * 0.2, a, 6, seed + 11 + k, "#fff2d0"); }
};

// ---------------------------------------------------------------- the six frames
const NAINA: Omit<Glossy, "x" | "y" | "size" | "seed"> = { text: "तेरे नैना", face: MAGENTA, rim: "#ffd0ee", body: "#3a7a12", outline: "#1a0414" };
const FRAMES: ((g: Gfx) => void)[] = [
  // 1. the title, big and glossy, sparkling
  (g) => { stage(g, 1); glossyWord(g, { ...NAINA, x: CX, y: 900, size: 230, seed: 11, tilt: -0.04, sparkles: [[250, 760, 30], [840, 800, 22], [790, 1040, 26], [300, 1010, 18]] }); handLine(g, "एक प्रेम गीत", CX, 1180, 64, "#7a1010"); },
  // 2. "zakhm": the wound, torn across the card
  (g) => { stage(g, 2); handLine(g, "ज़ख़्म", CX, 520, 120, "#3a6a10"); paintWound(g, woundPoly(CX, 1000, 820, 70, -0.5), 200); },
  // 3. "marham": the plaster laid over it, and an eye opening in the plaster
  (g) => { stage(g, 3); handLine(g, "मरहम", CX, 470, 120, "#3a6a10"); paintWound(g, woundPoly(CX, 1000, 820, 70, -0.5), 200);
    const pl = rot([...ellipse(CX - 230, 880, 120, 120, 20, Math.PI / 2, Math.PI * 1.5), ...ellipse(CX + 230, 880, 120, 120, 20, -Math.PI / 2, Math.PI / 2)], CX, 880, -0.3);
    paintForm(g, pl, objCol(PLASTER, pillowN(pl, 36), 1.08), 14, along(-0.3), 300); contour(g, pl, "#5a3a1e", 3.5, 330);
    const r = rng(331); for (let i = 0; i < 26; i++) { const sx = i < 13 ? -1 : 1, x = CX + sx * (180 + r() * 120), y = 880 + (r() - 0.5) * 160, [px, py] = rot([[x, y]], CX, 880, -0.3)[0]; if (inside(pl, px, py) && edgeDist(pl, px, py) > 16) lay(g, [st([[px, py], [px + 2, py + 1]], 9, "#a87e54", 340 + i, { impasto: 0.15, dry: 0.1 })]); }
    paintEye(g, CX, 870, 300, 1, null, 360); glossyWord(g, { ...NAINA, x: CX, y: 1380, size: 170, seed: 31, tilt: -0.05, sparkles: [[300, 1290, 20], [800, 1440, 16]] }); },
  // 4. "phool pe shabnam": the red lily, a drop of dew on a petal
  (g) => { stage(g, 4); handLine(g, "फूल पे", CX, 470, 110, "#a0108a"); paintLily(g, 400); paintDrop(g, LILY_C[0] + 190, LILY_C[1] + 120, 30, 480); handLine(g, "शबनम", CX, 1500, 110, "#a0108a"); },
  // 5. "jag": the world, become the iris of a great eye
  (g) => { stage(g, 5); handLine(g, "जग भूले", CX, 560, 120, "#1a3a8a"); paintEye(g, CX, 990, 820, 1.05, globeIris, 500); glossyWord(g, { ...NAINA, x: CX, y: 1450, size: 170, seed: 51, tilt: 0.04, sparkles: [[260, 1360, 22], [830, 1510, 18]] }); },
  // 6. the stars, shy: two of them blushing under the lyric
  (g) => { stage(g, 6); handLine(g, "तेरे नैनों के आगे", CX, 520, 92, "#b0141e"); paintStar(g, CX - 200, 990, 230, 600, -0.12); paintStar(g, CX + 200, 1000, 230, 620, 0.1); handLine(g, "तारे भी शरमाएँ", CX, 1440, 92, "#b0141e"); },
];

export const nainaLook: Film = {
  meta: { title: "Naina · look frames · oil", W, H, fps: 12, bpm: 120, durationFrames: FRAMES.length * 6, raster: "cpu" }, // one beat (6 frames at 12 fps, 120 bpm) per look still
  assets: { images: {} },
  shots: FRAMES.map((fn, i) => ({ id: `look${i + 1}`, start: i * 6, end: i * 6 + 6, draw: (ctx: Ctx, _f: number, env: Env) => { const g = new Gfx(ctx, env, 0, OIL_M); fn(g); weave(g, 0.28); } })),
};
