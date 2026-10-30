import { Gfx, rng, fractal, type Ctx, type Env, type Medium, type P } from "./core";
import type { Film } from "./film";
import { bounds, clamp, inside, mix, smooth } from "./gallery";
import { fill, oilStroke, weave, type OStroke } from "./paintedOilKit";
import { KALAMBOLD, YATRAONE } from "../../assets/fonts/devanagari";

// NAINA · FRAMES · oil on canvas, vertical 9:16, rose and indigo.
//
// The second round of look stills for the Hindi lyric film, on the person's own flow (bulla, wound,
// balm, eyes, lily, dew, world, heart, stars, curtain, sargam) and in their palette, NOT the reference's
// colours: a blush-rose wedding card, its mandala a deeper rose, on an indigo ground printed with a
// halftone; the objects crimson, gold and turquoise. Most frames are caught MID-TRANSITION, because the
// film's idea is that one picture becomes the next: the hook word squashing into the wound, the
// plaster's centre line opening into an eye, the eye bleeding into the lily, the globe becoming an
// iris, one line closing into a heart, the curtain sweeping in.
// MEDIUM (paintedOil's recipe, as the first look round): oil on toned linen, bristle flats, dark to
// light, impasto glints; objects as pillow forms lit from the upper left, a dark contour on the shadow
// side, white streak highlights and thick-paint sparkles (four-pointed, concave: the ✦).
// LETTERING: Yatra One for the hook words (3D sticker lettering: extruded body, outline, a face painted
// in oil and clipped to the letters, a rim of light, sparkles); Kalam for the lyric lines, one colour
// per phrase.

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
const INDIGO = ["#07081e", "#10143a", "#1b2160", "#283184", "#3d48a6", "#6a74c8"];
const ROSE = ["#5a1a2a", "#8e3448", "#c05c6c", "#de8a92", "#efb2b2", "#f8d2cc", "#fdeae4"];
const CRIMSON = ["#1e0204", "#45070b", "#760f14", "#a3191c", "#c8352c", "#e66a52", "#fbb8a0"];
const PLASTER = ["#5a3c22", "#8f6a46", "#bf986c", "#dcbb8e", "#efd6ac", "#fbefd4"];
const SCLERA = ["#9a8a7a", "#c8baa6", "#e6dccb", "#f5eee2", "#fffbf4"];
const IRIS = ["#021416", "#04302f", "#0a5250", "#16807a", "#3eb0a4"];
const GOLD = ["#3a2204", "#704406", "#a8700e", "#d49c1e", "#efc443", "#fde69a"];
const TURQ = ["#032226", "#06424a", "#0b6670", "#138c94", "#33b2b2", "#8adcd4"];
const LAND = GOLD;
const PLUM = "#4a1238";
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
// a sparkle, the ✦: four concave-sided points laid as one shape of thick white, a dab at its heart
const sparkle = (g: Gfx, x: number, y: number, r0: number, seed: number) => {
  const r = r0 * 1.9, c = g.cur, pts: P[] = [];
  for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2 - Math.PI / 2, b = a + Math.PI / 4; pts.push([x + Math.cos(a) * r * (i % 2 ? 0.78 : 1.15), y + Math.sin(a) * r * (i % 2 ? 0.78 : 1.15)], [x + Math.cos(b) * r * 0.16, y + Math.sin(b) * r * 0.16]); }
  g.touch(x - r * 1.3, y - r * 1.3, x + r * 1.3, y + r * 1.3); c.save(); c.fillStyle = "#fffdf6"; c.beginPath(); pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.closePath(); c.fill(); c.restore();
  lay(g, [st([[x - r * 0.12, y], [x, y], [x + r * 0.12, y]], r * 0.3, "#ffffff", seed, { impasto: 1, load: 1.4, dry: 0, jit: 0.01, soft: 0 })]);
};

// ---------------------------------------------------------------- lettering
// paint onto a layer, then keep only what lies inside the letters (destination-in), then lay the layer down
const onLayer = (g: Gfx, fn: (lg: Gfx) => void, mask: (c: CanvasRenderingContext2D) => void) => {
  const e = g.env, DW = Math.round(e.W * e.scale), DH = Math.round(e.H * e.scale), key = `nainaFrames:layer:${DW}x${DH}`;
  let L = e.cache.get(key) as { canvas: unknown; ctx: CanvasRenderingContext2D } | undefined; if (!L) { L = e.canvas(DW, DH) as unknown as { canvas: unknown; ctx: CanvasRenderingContext2D }; e.cache.set(key, L); }
  const c = L.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = "source-over"; c.globalAlpha = 1; c.clearRect(0, 0, DW, DH); c.setTransform(e.scale, 0, 0, e.scale, 0, 0);
  const lg = new Gfx(c as unknown as Ctx, e, 0, OIL_M); fn(lg);
  c.setTransform(e.scale, 0, 0, e.scale, 0, 0); c.globalCompositeOperation = "destination-in"; c.globalAlpha = 1; mask(c); c.globalCompositeOperation = "source-over";
  const m = g.cur; m.save(); m.setTransform(1, 0, 0, 1, 0, 0); m.drawImage(L.canvas as CanvasImageSource, 0, 0); m.restore();
};
type Glossy = { text: string; x: number; y: number; size: number; face: string[]; rim: string; body: string; outline: string; tilt?: number; sy?: number; skew?: number; seed: number; sparkles?: [number, number, number][] };
const font = (fam: string, size: number) => `${size}px "${fam}"`;
const glossyWord = (g: Gfx, o: Glossy) => {
  const c = g.cur, f = font("Yatra", o.size), depth = Math.round(o.size * 0.07), tilt = o.tilt ?? 0;
  const tx = (cc: CanvasRenderingContext2D, fn: () => void) => { cc.save(); cc.translate(o.x, o.y); cc.rotate(tilt); cc.transform(1, 0, o.skew ?? 0, o.sy ?? 1, 0, 0); fn(); cc.restore(); };
  // a soft cast shadow on the card, then the extruded body, darker as it goes back
  tx(c, () => { c.font = f; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = "#3a1030"; c.globalAlpha = 0.35; c.fillText(o.text, depth * 1.6, depth * 2.2); c.globalAlpha = 1; for (let i = depth; i >= 1; i--) { c.fillStyle = mix(o.body, "#100408", (i / depth) * 0.5); c.fillText(o.text, i * 0.7, i); } c.lineJoin = "round"; c.strokeStyle = o.outline; c.lineWidth = o.size * 0.05; c.strokeText(o.text, 0, 0); });
  // the face: horizontal bristle strokes, light along the top of each letter, deep at the foot
  const m = (() => { const mc = c; mc.save(); mc.font = f; const w = mc.measureText(o.text).width; mc.restore(); return w; })();
  const x0 = o.x - m / 2 - 30, x1 = o.x + m / 2 + 30, y0 = o.y - o.size * 0.75, y1 = o.y + o.size * 0.55;
  onLayer(g, (lg) => {
    const r = rng(o.seed), out: OStroke[] = [];
    for (let y = y0; y < y1; y += o.size * 0.06) for (let x = x0; x < x1; x += o.size * 0.5) {
      const t = (y - y0) / (y1 - y0), c0 = ramp(o.face, 1 - t * 0.95 + (r() - 0.5) * 0.06), xx = x + (r() - 0.5) * 30;
      out.push(st([[xx - o.size * 0.4, y + (r() - 0.5) * 4], [xx, y + (r() - 0.5) * 4], [xx + o.size * 0.4, y + (r() - 0.5) * 4]], o.size * 0.1, c0, o.seed * 100 + out.length, { c1: ramp(o.face, 1 - t * 0.95 - 0.08), impasto: 0.25, dry: 0.3, soft: 0.2 }));
    }
    lg.cur.save(); lg.cur.translate(o.x, o.y); lg.cur.rotate(tilt); lg.cur.transform(1, 0, o.skew ?? 0, o.sy ?? 1, 0, 0); lg.cur.translate(-o.x, -o.y); out.forEach((s) => oilStroke(lg, s, 1)); lg.cur.restore();
  }, (mc) => tx(mc, () => { mc.font = f; mc.textAlign = "center"; mc.textBaseline = "middle"; mc.fillStyle = "#000"; mc.fillText(o.text, 0, 0); }));
  // the rim: the light caught on the upper-left edge of every stroke of every letter
  onLayer(g, (lg) => { const k = lg.cur; k.save(); k.translate(o.x, o.y); k.rotate(tilt); k.transform(1, 0, o.skew ?? 0, o.sy ?? 1, 0, 0); k.font = f; k.textAlign = "center"; k.textBaseline = "middle"; k.fillStyle = o.rim; k.fillText(o.text, 0, 0); k.restore(); },
    (mc) => tx(mc, () => { mc.font = f; mc.textAlign = "center"; mc.textBaseline = "middle"; mc.fillStyle = "#000"; mc.fillText(o.text, 0, 0); mc.globalCompositeOperation = "destination-out"; mc.fillText(o.text, o.size * 0.022, o.size * 0.03); mc.globalCompositeOperation = "destination-in"; }));
  (o.sparkles ?? []).forEach(([sx, sy, sr], i) => sparkle(g, sx, sy, sr, o.seed * 10 + i));
};
// a handwritten lyric line in one colour: a soft dark under it, the ink laid with a small round brush
const handLine = (g: Gfx, text: string, x: number, y: number, size: number, color: string, opts: { align?: CanvasTextAlign; tilt?: number } = {}) => {
  const c = g.cur; c.save(); c.translate(x, y); c.rotate(opts.tilt ?? 0); c.font = font("KalamB", size); c.textAlign = opts.align ?? "center"; c.textBaseline = "middle";
  c.fillStyle = "#5a1a3a"; c.globalAlpha = 0.28; c.fillText(text, 3, 4); c.globalAlpha = 1; c.fillStyle = color; c.fillText(text, 0, 0);
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
  // the indigo ground, a big flat in steep passes, then printed over with a halftone: a 45-degree
  // screen of paler dots, larger where a slow wave of light crosses the border
  const tealCol = (x: number, y: number) => ramp(INDIGO, 0.42 + 0.18 * (fractal(seed + 3, x, y, 0.004, 0.004, 2) - 0.5) - 0.12 * Math.hypot((x - CX) / W, (y - CY) / H));
  lay(g, fill({ region: [[-60, -60], [W + 60, -60], [W + 60, H + 60], [-60, H + 60]], step: 56, len: 200, w: 76, dir: () => -1.1, seed: seed + 10, load: 1.1, dry: 0.4, impasto: 0.06, jit: 0.04, soft: 0.25, color: tealCol, sweep: 0 }));
  { const k = g.cur, sp = 17, ca = Math.cos(Math.PI / 4), sa = Math.sin(Math.PI / 4); k.save(); k.beginPath(); k.rect(-10, -10, W + 20, H + 20); k.moveTo(CARD[0][0], CARD[0][1]); CARD.forEach(([x, y]) => k.lineTo(x, y)); k.closePath(); k.clip("evenodd"); g.touch(0, 0, W, H); k.fillStyle = ramp(INDIGO, 0.82); k.globalAlpha = 0.55;
    for (let u = -H; u < W + H; u += sp) for (let v = -H; v < W + H; v += sp) { const x = u * ca - v * sa + W / 2, y = u * sa + v * ca; if (x < -10 || y < -10 || x > W + 10 || y > H + 10) continue; const rr = sp * 0.5 * (0.25 + 0.55 * fractal(seed + 11, x, y, 0.004, 0.004, 2)); k.beginPath(); k.arc(x, y, rr, 0, Math.PI * 2); k.fill(); }
    k.globalAlpha = 1; k.restore(); }
  // the card: cadmium and ochre, a warm glow at its middle, its edges a shade deeper
  const cardCol = (x: number, y: number) => { const d = Math.hypot((x - CX) / (W * 0.5), (y - CY) / (H * 0.5)); return ramp(ROSE, 0.86 - 0.2 * d * d + 0.08 * (fractal(seed + 5, x, y, 0.006, 0.006, 2) - 0.5)); };
  lay(g, fill({ region: [[0, 0], [W, 0], [W, H], [0, H]], step: 44, len: 150, w: 62, dir: (x, y) => 0.6 + (fractal(seed + 7, x, y, 0.002, 0.002, 1) - 0.5) * 0.6, seed: seed + 20, load: 1.1, dry: 0.35, impasto: 0.08, jit: 0.035, soft: 0.25, color: (x, y) => (inside(CARD, x, y) ? cardCol(x, y) : null), sweep: 0 }), [CARD]);
  // the mandala, scumbled thin: three rings of petals and a lotus at the heart, barely there
  const mr = rng(seed + 30), md: OStroke[] = [];
  [[150, 12], [300, 18], [470, 24]].forEach(([R, n], ri) => { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + ri * 0.13, a0 = a - Math.PI / n * 0.9, a1 = a + Math.PI / n * 0.9, r0 = R - 70 - ri * 10; md.push(st([[CX + Math.cos(a0) * r0, CY + Math.sin(a0) * r0], [CX + Math.cos(a) * (R + 8), CY + Math.sin(a) * (R + 8)], [CX + Math.cos(a1) * r0, CY + Math.sin(a1) * r0]], 6, ramp(ROSE, 0.6 + mr() * 0.05), seed + 40 + md.length, { alpha: 0.55, impasto: 0, dry: 0.25 })); } });
  for (let i = 0; i < 3; i++) md.push(st(ellipse(CX, CY, 520 + i * 160, 520 + i * 160, 60), 5, ramp(ROSE, 0.62), seed + 90 + i, { alpha: 0.4, impasto: 0, dry: 0.4 }));
  lay(g, md, [CARD]);
  // the card's edge: a deep ochre line, and a light line just inside it where the bevel turns up
  const edge = (pts: P[], k: number, col: string, w: number, s: number, imp: number) => { const out: OStroke[] = []; for (let i = 0; i < pts.length; i += 60) out.push(st(pts.slice(i, Math.min(pts.length, i + 64)).filter((_, j) => j % 8 === 0).concat([pts[Math.min(pts.length - 1, i + 63)]]).map(([x, y]) => [CX + (x - CX) * k, CY + (y - CY) * k] as P), w, col, s + i, { impasto: imp, dry: 0.15, load: 1.1, jit: 0.03, soft: 0.1 })); return out; };
  lay(g, [...edge([...CARD, CARD[0]], 1, "#6a1e34", 7, seed + 200, 0.2), ...edge([...CARD, CARD[0]], 0.985, "#f6c86a", 3.5, seed + 400, 0.5), ...edge([...CARD, CARD[0]], 0.968, "#c05c6c", 2.5, seed + 600, 0.2)]);
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
const lilyPetals = () => { const angles = Array.from({ length: 6 }, (_, i) => -Math.PI / 2 + (i * Math.PI) / 3 + 0.12), order = [1, 3, 5, 0, 2, 4]; return { angles, order, pets: angles.map((a, i) => petal(a, i % 2 ? 330 : 360, i % 2 ? 210 : 170, 0.16)) }; };
const paintLily = (g: Gfx, seed: number) => {
  // a lily seen from the front: six tepals sixty degrees apart, the three outer ones (behind) broader,
  // the three inner ones laid over them; every tip recurves, curling the same way round
  const { angles, order, pets } = lilyPetals();
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
  paintForm(g, poly, (x, y) => mix(ramp(TURQ, 0.35 + 0.55 * clamp(1 - lit(n(x, y))) * 0.6 + 0.3 * clamp((y - cy) / r)), "#a3191c", 0.25), 5, tangentDir(cx, cy), seed);
  contour(g, poly, "#0a1420", 2.6, seed + 3); glint(g, [cx - r * 0.38, cy - r * 0.42], r * 0.42, -0.7, r * 0.28, seed + 4); lay(g, [st(ellipse(cx + r * 0.1, cy + r * 0.2, r * 0.6, r * 0.55, 12, 0.2, 1.6), 3, "#c8e4ec", seed + 5, { impasto: 0.4 })]);
};
const globeIris = (g: Gfx, cx: number, cy: number, r: number) => {
  const disc = ellipse(cx, cy, r, r, 60), n = sphereN(cx, cy, r);
  paintForm(g, disc, (x, y) => ramp(TURQ, plane(lit(n(x, y))) * 0.9 + 0.08), 9, tangentDir(cx, cy), 900);
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
  paintForm(g, p, objCol(GOLD, n, 1.2), 15, tangentDir(cx, cy), seed, true); contour(g, p, "#3a1002", 4.5, seed + 5);
  // shy: eyes squeezed shut in two little arcs, cheeks flushed red in thin glazes
  lay(g, [st([[cx - R * 0.28, cy - R * 0.02], [cx - R * 0.2, cy - R * 0.08], [cx - R * 0.12, cy - R * 0.02]], 4.5, "#3a1002", seed + 6, { impasto: 0.2, dry: 0.1 }), st([[cx + R * 0.12, cy - R * 0.02], [cx + R * 0.2, cy - R * 0.08], [cx + R * 0.28, cy - R * 0.02]], 4.5, "#3a1002", seed + 7, { impasto: 0.2, dry: 0.1 }),
    st([[cx - R * 0.36, cy + R * 0.12], [cx - R * 0.28, cy + R * 0.13], [cx - R * 0.2, cy + R * 0.12]], R * 0.14, "#e0283a", seed + 8, { alpha: 0.55, impasto: 0, dry: 0.5 }), st([[cx + R * 0.2, cy + R * 0.12], [cx + R * 0.28, cy + R * 0.13], [cx + R * 0.36, cy + R * 0.12]], R * 0.14, "#e0283a", seed + 9, { alpha: 0.55, impasto: 0, dry: 0.5 }),
    st([[cx - R * 0.08, cy + R * 0.16], [cx, cy + R * 0.2], [cx + R * 0.08, cy + R * 0.16]], 3.5, "#3a1002", seed + 10, { impasto: 0.15 })]);
  for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + tilt + (k * 2 * Math.PI) / 5, gx = cx + Math.cos(a) * R * 0.55 - Math.sin(a) * R * -0.07, gy = cy + Math.sin(a) * R * 0.55 + Math.cos(a) * R * -0.07; if (Math.cos(a) * L3[0] + Math.sin(a) * L3[1] > -0.3) glint(g, [gx, gy], R * 0.2, a, 6, seed + 11 + k, "#fff2d0"); }
};

// ---------------------------------------------------------------- transition states
// the lily as it is being DRAWN: each tepal's outline laid by a loaded small brush, the last ones only
// part-way round; the red bleeding out of the eye's tear into its heart and down the tepals' middles
const lilyDrawing = (g: Gfx, frac: number, bleed: number, seed: number) => {
  const { angles, order, pets } = lilyPetals();
  order.forEach((i, k) => { const p = pets[i], f = clamp(frac * 6 - k), n = Math.max(3, Math.round(p.length * f)); if (f <= 0) return; lay(g, [st(thin(p.slice(0, n), Math.max(3, Math.round(n / 4))), 7, "#5a0610", seed + i, { c1: "#8a0e18", impasto: 0.25, dry: 0.1, load: 1.2 })]); });
  const r = rng(seed + 50), blob: P[] = Array.from({ length: 40 }, (_, i) => { const a = (i / 40) * Math.PI * 2, k = 1 + 0.16 * Math.sin(a * 6 + 0.12 * 6) + 0.06 * (r() - 0.5); return [LILY_C[0] + Math.cos(a) * 150 * bleed * k, LILY_C[1] + Math.sin(a) * 150 * bleed * k] as P; });
  paintForm(g, blob, objCol(CRIMSON, pillowN(blob, 40), 1.2), 12, tangentDir(LILY_C[0], LILY_C[1]), seed + 60, true);
  angles.forEach((a, i) => { const L = 300 * bleed * (0.75 + 0.4 * r()); lay(g, [st([[LILY_C[0] + Math.cos(a) * 100 * bleed, LILY_C[1] + Math.sin(a) * 100 * bleed], [LILY_C[0] + Math.cos(a + 0.05) * L * 0.75, LILY_C[1] + Math.sin(a + 0.05) * L * 0.75], [LILY_C[0] + Math.cos(a) * L, LILY_C[1] + Math.sin(a) * L]], 22, "#a3191c", seed + 70 + i, { c1: "#6a0810", impasto: 0.3, dry: 0.5 })], [pets[i]]); });
  glint(g, [LILY_C[0] - 50 * bleed, LILY_C[1] - 60 * bleed], 40 * bleed, -0.7, 7, seed + 90, "#ffd0c4");
};
// the HEART as one line drawing itself round, from the bottom point up the left lobe, over, and down,
// nearly closed; then its fill landing from the middle out
const heartPt = (t: number, cx: number, cy: number, s: number): P => [cx + s * 16 * Math.pow(Math.sin(t), 3), cy - s * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))];
const heartDrawing = (g: Gfx, cx: number, cy: number, s: number, frac: number, fillR: number, seed: number) => {
  const outline = Array.from({ length: 120 }, (_, i) => heartPt(Math.PI * 2 * (i / 120), cx, cy, s));
  if (fillR > 0) { const disc = ellipse(cx, cy - s * 2, fillR, fillR * 1.1, 48); withClip(g, [outline], () => paintForm(g, disc, objCol(CRIMSON, pillowN(outline, s * 6), 1.2), 13, tangentDir(cx, cy), seed, true)); }
  const n = Math.round(120 * frac), line = Array.from({ length: n + 1 }, (_, i) => heartPt(Math.PI - Math.PI * 2 * (i / 120), cx, cy, s));
  lay(g, [st(thin(line, 18), 11, "#3a0408", seed + 5, { impasto: 0.3, dry: 0.06, load: 1.25, jit: 0.02 })]);
  const tip = line[line.length - 1]; lay(g, [st([[tip[0] - 3, tip[1] - 3], tip, [tip[0] + 2, tip[1] + 3]], 12, "#3a0408", seed + 6, { impasto: 0.6 })]); // the brush, still pressing where the line is being drawn
};
// the CURTAIN sweeping in from a corner: curved bands of crimson and gold round the corner, each band
// rounded like a fold of cloth, a thin cream piping between them, its leading edge a deep shadow
const curtain = (g: Gfx, corner: P, reach: number, seed: number) => {
  const band = 70, region: P[] = Array.from({ length: 40 }, (_, i) => { const a = (i / 39) * Math.PI * 2; return [corner[0] + Math.cos(a) * reach, corner[1] + Math.sin(a) * reach] as P; });
  const col = (x: number, y: number) => { const d = Math.hypot(x - corner[0], y - corner[1]), k = Math.floor(d / band), f = (d % band) / band, roll = Math.sin(Math.PI * f); const base = k % 2 ? GOLD : CRIMSON; return ramp(base, 0.25 + 0.6 * roll * (1 - 0.35 * d / reach)); };
  paintForm(g, region, col, 16, tangentDir(corner[0], corner[1]), seed, true);
  const lines: OStroke[] = []; for (let d = band; d < reach - 10; d += band) lines.push(st(ellipse(corner[0], corner[1], d, d, 40).filter(([x, y]) => x > -40 && x < W + 40 && y > -40 && y < H + 40), 4, "#fde8c0", seed + d, { impasto: 0.5, dry: 0.1 }));
  withClip(g, [region], () => lay(g, lines));
  lay(g, [st(ellipse(corner[0], corner[1], reach - 6, reach - 6, 60).filter(([x, y]) => x > -40 && x < W + 40 && y > -40 && y < H + 40), 14, "#1a0408", seed + 99, { impasto: 0.1, dry: 0.2 })]);
};
// a word laid along an arc, each word turned to the circle (Devanagari is shaped per word, never per letter)
const arcWords = (g: Gfx, words: string[], cx: number, cy: number, r: number, a0: number, a1: number, size: number, color: string) => words.forEach((w, i) => { const a = a0 + ((a1 - a0) * i) / Math.max(1, words.length - 1); handLine(g, w, cx + Math.cos(a) * r, cy + Math.sin(a) * r, size, color, { tilt: a + Math.PI / 2 }); });

// ---------------------------------------------------------------- the frames
const BULLA: Omit<Glossy, "x" | "y" | "size" | "seed"> = { text: "बल्लाह", face: GOLD, rim: "#fff6d0", body: "#8a0e22", outline: "#14081e" };
const NAINA: Omit<Glossy, "x" | "y" | "size" | "seed"> = { text: "तेरे नैना", face: TURQ, rim: "#e0fff8", body: "#1b2160", outline: "#07081e" };
const PLASTER_AT: P = [CX, 900];
const FRAMES: ((g: Gfx) => void)[] = [
  // 1. the hook word pops in: sticker lettering, sparkling
  (g) => { stage(g, 1); glossyWord(g, { ...BULLA, x: CX, y: 940, size: 250, seed: 11, tilt: -0.05, sparkles: [[230, 790, 30], [860, 820, 22], [820, 1080, 26], [270, 1060, 18]] }); },
  // 2. ...and squashes flat into a wound: the word tipped back in perspective and pressed thin, its
  //    red already running into the torn slash beneath
  (g) => { stage(g, 2); handLine(g, "ज़ख़्म", CX, 560, 120, "#1b2160"); paintWound(g, woundPoly(CX, 1010, 760, 54, -0.42), 200); glossyWord(g, { ...BULLA, x: CX - 10, y: 985, size: 220, seed: 21, tilt: -0.42, sy: 0.5, skew: -0.7 }); },
  // 3. the band-aid has slid over the wound; its centre line is opening into an eye
  (g) => { stage(g, 3); handLine(g, "मरहम", CX, 470, 120, "#1b2160"); paintWound(g, woundPoly(CX, 1000, 820, 70, -0.5), 200);
    const pl = rot([...ellipse(CX - 230, PLASTER_AT[1], 120, 120, 20, Math.PI / 2, Math.PI * 1.5), ...ellipse(CX + 230, PLASTER_AT[1], 120, 120, 20, -Math.PI / 2, Math.PI / 2)], CX, PLASTER_AT[1], -0.3);
    paintForm(g, pl, objCol(PLASTER, pillowN(pl, 36), 1.08), 14, along(-0.3), 300); contour(g, pl, "#5a3a1e", 3.5, 330);
    const r = rng(331); for (let i = 0; i < 26; i++) { const sx = i < 13 ? -1 : 1, x = CX + sx * (180 + r() * 120), y = PLASTER_AT[1] + (r() - 0.5) * 160, [px, py] = rot([[x, y]], CX, PLASTER_AT[1], -0.3)[0]; if (inside(pl, px, py) && edgeDist(pl, px, py) > 16) lay(g, [st([[px, py], [px + 2, py + 1]], 9, "#a87e54", 340 + i, { impasto: 0.15, dry: 0.1 })]); }
    paintEye(g, CX, PLASTER_AT[1] - 8, 300, 0.5, null, 360); },
  // 4. the eye bleeds into a lily: a tear of red runs down into a flower being drawn round it
  (g) => { stage(g, 4); handLine(g, "फूल पे", 250, 1420, 96, "#8a0e22", { tilt: -0.08 }); lilyDrawing(g, 0.78, 0.62, 400); paintEye(g, CX, 640, 300, 1, null, 460);
    lay(g, [st([[CX + 10, 700], [CX + 4, 780], [CX, 860]], 10, "#a3191c", 470, { c1: "#760f14", impasto: 0.4, dry: 0.3 })]); glossyWord(g, { ...NAINA, x: CX + 90, y: 1560, size: 160, seed: 41, tilt: -0.04, sparkles: [[420, 1480, 18], [880, 1620, 14]] }); },
  // 5. the world, the words wrapping round it, and an eye being drawn round the world to make it an iris
  (g) => { stage(g, 5); const gc: P = [CX, 1010], gr = 200; globeIris(g, gc[0], gc[1], gr); arcWords(g, ["जग", "भूले", "भूले"], gc[0], gc[1], gr + 52, -Math.PI * 0.78, -Math.PI * 0.22, 80, "#0b6670");
    const w = 900, hh = 360, up: P[] = [], lo: P[] = []; for (let i = 0; i <= 40; i++) { const t = i / 40, x = gc[0] - w / 2 + w * t, sn = Math.sin(Math.PI * t); up.push([x, gc[1] - hh * Math.pow(sn, 0.8)]); lo.push([x, gc[1] + hh * 0.72 * Math.pow(sn, 1.1)]); }
    lay(g, [st(thin(up.slice(0, 27), 14), 8, "#140806", 520, { impasto: 0.25, dry: 0.06, load: 1.25 }), st(thin(lo.slice(15).reverse(), 12), 5, "#3a1a10", 521, { impasto: 0.15, dry: 0.15 })]);
    const ls: OStroke[] = []; for (let i = 0; i < 9; i++) { const p = up[8 + i * 2], L = 40 + i * 5, a = -Math.PI / 2 - 0.4 + i * 0.1; ls.push(st([p, [p[0] + Math.cos(a) * L * 0.55, p[1] + Math.sin(a) * L * 0.55], [p[0] + Math.cos(a + 0.75) * L, p[1] + Math.sin(a + 0.75) * L * 0.95]], 5.5, "#100604", 530 + i, { impasto: 0.2, dry: 0.15, load: 1.2 })); } lay(g, ls);
    sparkle(g, gc[0] + gr * 0.85, gc[1] - gr * 0.95, 18, 540); },
  // 6. one line curls round into a heart; the red is landing in it
  (g) => { stage(g, 6); handLine(g, "दिल", 380, 520, 110, "#4a1238"); handLine(g, "छूलें", 640, 520, 110, "#4a1238"); handLine(g, "छूलें", CX, 650, 96, "#4a1238"); heartDrawing(g, CX, 1000, 21, 0.9, 300, 600); },
  // 7. two stars, blushing, under the lyric; and the curtain sweeping in from the top corners
  (g) => { stage(g, 7); handLine(g, "तेरे नैनों के आगे", CX, 640, 88, "#8a0e22"); paintStar(g, CX - 200, 1020, 220, 700, -0.12); paintStar(g, CX + 200, 1030, 220, 720, 0.1); handLine(g, "ते तारे भी शरमाएँ", CX, 1440, 84, "#8a0e22"); curtain(g, [-40, -40], 420, 760); curtain(g, [W + 40, -40], 380, 780); },
];

export const nainaFrames: Film = {
  meta: { title: "Naina · frames · oil, rose and indigo", W, H, fps: 12, bpm: 120, durationFrames: FRAMES.length * 6, raster: "cpu" }, // one beat (6 frames) per still
  assets: { images: {} },
  shots: FRAMES.map((fn, i) => ({ id: `frame${i + 1}`, start: i * 6, end: i * 6 + 6, draw: (ctx: Ctx, _f: number, env: Env) => { const g = new Gfx(ctx, env, 0, OIL_M); fn(g); weave(g, 0.28); } })),
};
