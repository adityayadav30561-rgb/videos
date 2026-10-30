import { displace, fractal, Gfx, rng, type Ctx, type Env, type Medium, type P } from "./core";
import { clamp, smooth } from "./gallery";
import { streakClip, streaks } from "./koiDrawKit";

// PAARO's hand: mid-century gouache (midCentury.ts) carried to night. The same three passes as the
// plate: opaque matte flats laid big to small with a flat brush (ragged at the edge, corners kept),
// a nearly dry brush dragged over them, and a loose thin ink line on its own plate, off register.
// What is new for night: light is painted, not lit. A lamp is concentric flat discs of warmer and
// warmer wall colour; a shade side is a second flat laid over the first, never a gradient.

export const BRUSH: Medium = { nib: 1.15, taper: 1, pressure: 0.85, retrace: false, wobble: 1.4, rough: 0.35 };
export const REG: P = [5, -4]; // the line plate's misregistration against the colour

// a flat: points, colour, the brush angle it was laid at; `shade` lays a second flat over it on the
// side away from the light (the shape minus itself shifted toward the light), `q` paints it in part
export type Sh = { pts: P[]; col: string; ang?: number; shade?: string; sd?: P; alpha?: number; q?: number; rag?: number };
export type Dry = { path: P[]; w: number; col: string; seed: number; alpha?: number; q?: number };
export type Ln = { pts: P[]; w: number; seed: number; q?: number; color?: string; wobble?: number };

export const sm = (a: P[], closed = true, per = 6) => smooth(a, closed, per);
export const area = (s: P[]) => Math.abs(s.reduce((a, p, i) => { const q = s[(i + 1) % s.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);
export const ell = (cx: number, cy: number, rx: number, ry: number, rot = 0, n = 22): P[] => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry; return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)] as P; });
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
// a limb on a jointed centreline: radius per joint, a soft bulge between (as the plate's girl)
export const limb = (c: P[], r: number[], bulge = 0): { poly: P[]; a: P[]; b: P[] } => {
  const s = sm(c, false, 10), n = s.length, A: P[] = [], B: P[] = [];
  s.forEach((p, i) => { const t = i / (n - 1), seg = Math.min(r.length - 2, Math.floor(t * (r.length - 1))), f = t * (r.length - 1) - seg, rr = lerp(r[seg], r[seg + 1], f) + bulge * Math.sin(Math.PI * clamp((t - 0.5) * 2)), q = s[Math.min(n - 1, i + 1)], o = s[Math.max(0, i - 1)], dx = q[0] - o[0], dy = q[1] - o[1], l = Math.hypot(dx, dy) || 1; A.push([p[0] - (dy / l) * rr, p[1] + (dx / l) * rr]); B.push([p[0] + (dy / l) * rr, p[1] - (dx / l) * rr]); });
  return { poly: [...A, ...[...B].reverse()], a: A, b: B };
};
// a shape in a local frame: origin, rotation, scale; authored facing right
export const place = (pts: P[], o: P, rot = 0, k = 1, flip = 1): P[] => pts.map(([x, y]) => { const X = x * k * flip, Y = y * k; return [o[0] + X * Math.cos(rot) - Y * Math.sin(rot), o[1] + X * Math.sin(rot) + Y * Math.cos(rot)] as P; });

// ---------------------------------------------------------------- the marks
const dens = (s: P[]): P[] => s.flatMap((a, i) => { const b = s[(i + 1) % s.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4)); return Array.from({ length: n }, (_, k) => [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n] as P); });
// gouache edge: a slightly ragged boundary sized to the shape
export const edgeOf = (pts: P[], seed: number, rag = 1): P[] => { const a = Math.sqrt(area(pts)), amp = clamp(a * 0.011, 0.3, 2.8) * rag; return displace(dens(pts), amp, 0.11, 2, 40 + seed); };
const trace = (c: Ctx, pts: P[]) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };
const sub = (c: Ctx, pts: P[]) => { pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };

export const flatShape = (c: Ctx, s: Sh, i: number) => {
  const q = s.q ?? 1; if (q <= 0) return;
  const e = edgeOf(s.pts, i, s.rag ?? 1), a = Math.sqrt(area(s.pts));
  c.save(); c.globalAlpha = s.alpha ?? 1;
  if (q < 1) streakClip(c, streaks([e], clamp(a / 5, 5, 58), s.ang ?? 0, 60 + i, clamp(a * 0.9, 60, 340)), q);
  c.fillStyle = s.col; trace(c, e); c.fill();
  if (s.shade) { const [dx, dy] = s.sd ?? [16, -6]; c.save(); trace(c, e); c.clip(); c.fillStyle = s.shade; c.beginPath(); c.rect(-4000, -4000, 12000, 12000); sub(c, edgeOf(s.pts.map(([x, y]) => [x + dx, y + dy] as P), i + 500, s.rag ?? 1)); c.fill("evenodd"); c.restore(); }
  c.restore();
};
// dry brush: bristles side by side, each broken where it skips the board's tooth, more and more as
// the brush runs out toward the end of the stroke
export const dryBrush = (c: Ctx, d: Dry) => {
  const q = d.q ?? 1; if (q <= 0) return;
  const path = d.path.length > 2 ? d.path : d.path, [a, b] = [path[0], path[path.length - 1]], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, nb = Math.max(5, Math.round(d.w / 2.2)), steps = Math.max(6, Math.round(l / 3)), r = rng(d.seed);
  c.strokeStyle = d.col; c.lineWidth = 1.7; c.lineCap = "round"; c.globalAlpha = d.alpha ?? 0.85; c.beginPath();
  for (let k = 0; k < nb; k++) {
    const v = (k / (nb - 1) - 0.5) * d.w + (r() - 0.5) * 1.2, start = r() * 0.08, dn = 0.2 + r() * 0.14; let on = false;
    for (let j = 0; j <= steps * q; j++) {
      const t = j / steps; if (t < start) continue;
      const skip = fractal(d.seed + k, t * l * 0.35, k * 3.1, 1, 1, 2) < dn + t * 0.35, x = a[0] + dx * t + nx * v, y = a[1] + dy * t + ny * v;
      if (skip) { on = false; continue; } if (!on) { c.moveTo(x, y); on = true; } else c.lineTo(x, y);
    }
  }
  c.stroke(); c.globalAlpha = 1;
};

// one painting: flats in stacking order, then the dry brush, then the line plate off register
export type Painting = { shapes: Sh[]; dry: Dry[]; lines: Ln[] };
export const paint = (ctx: Ctx, env: Env, p: Painting, ink = "#1d1a2a") => {
  p.shapes.forEach((s, i) => flatShape(ctx, s, i));
  p.dry.forEach((d) => dryBrush(ctx, d));
  const g = new Gfx(ctx, env, 0, BRUSH), m = ctx.getTransform(), k = env.scale, z = m.a / k;
  g.push(m.e / k + REG[0], m.f / k + REG[1], z);
  g.group("plain", () => p.lines.forEach((l) => { const q = l.q ?? 1; if (q > 0) g.pen(l.pts, { w: l.w, color: l.color ?? ink, seed: l.seed, wobble: l.wobble ?? 0.9, opacity: 0.92, progress: q }); }));
  g.pop(); ctx.setTransform(m);
};
export const tooth = (ctx: Ctx, env: Env, a = 0.16) => { const g = new Gfx(ctx, env, 0, BRUSH); g.paper("coldpress", a); };

export const inside = (p: P, poly: P[]) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c; } return c; };
// a painting under construction: helpers that append in stacking order
export const easel = () => {
  const p: Painting = { shapes: [], dry: [], lines: [] };
  return {
    p,
    S: (pts: P[], col: string, o: Partial<Sh> = {}) => { p.shapes.push({ pts, col, ...o }); },
    D: (path: P[], w: number, col: string, o: Partial<Dry> = {}) => { p.dry.push({ path, w, col, seed: 700 + p.dry.length, ...o }); },
    L: (pts: P[], w = 2, o: Partial<Ln> = {}) => { p.lines.push({ pts, w, seed: 300 + p.lines.length, ...o }); },
  };
};
