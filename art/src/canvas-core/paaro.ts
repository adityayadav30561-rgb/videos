import { rng, sample, heart as heartPts, type Ctx, type Env, type P } from "./core";
import type { Film } from "./film";
import { registerFaces } from "./launchLook";
import lora from "../../assets/fonts/Lora-Bold.ttf";

// PAARO · a lyric film, 30.7 s. The animation language of the reference (a fixed scalloped stage,
// marker-comic drawing: one heavy ink contour, flat cel fills with a hard shade edge, white gel-pen
// highlights, little sparkles, every scene born out of the last one's shape) carried into a night
// palette: cool indigo and teal everywhere, one warm lamp. One world: the boy's room. Everything
// that happens (heart, moon, embrace, shadows, corridor) is that room thinking.
//
// Light: the table lamp, right of the boy, low. Every shade edge sits on the side away from it.

registerFaces([{ family: "PaaroHand", file: lora }]);

const FPS = 28, DURATION = Math.round(30.7 * FPS), W = 1920, H = 1080;
const S = (sec: number) => Math.round(sec * FPS);

// ---------------------------------------------------------------- palette
const INK = "#10112a", NAVY = "#0f1535", INDIGO = "#232a5e", INDIGO_L = "#3a4482";
const TEAL_D = "#122b33", TEAL = "#1d4148", TEAL_L = "#2b5960";
const LAMP = "#d9a441", LAMP_L = "#f4d384", MOON = "#f3dfa2", GOLD = "#c79a45";
const CURTAIN = "#6f88a6", CURTAIN_S = "#4a6180", CURTAIN_L = "#9db2c9";
const CRIMSON = "#9b2a37", CRIMSON_S = "#661a27", CRIMSON_L = "#c24a52", THREAD = "#d3313a";
const SKIN = "#bf8862", SKIN_S = "#8a5a43", HOODIE = "#3f5b70", HOODIE_S = "#283e52", PANTS = "#262b3d", PANTS_S = "#181c2b";
const WOOD = "#4a3227", WOOD_S = "#2f1f19", WOOD_L = "#6d4a35", SHEET = "#b9c0cc", SHEET_S = "#7d8799";
const BANDAGE = "#dcc6a2", BANDAGE_S = "#b39a76", GLASS = "#b8d3d8", PAPER = "#d8d2c2";

// ---------------------------------------------------------------- small maths
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => { t = clamp(t); return t * t * (3 - 2 * t); };
const easeOut = (t: number) => 1 - (1 - clamp(t)) ** 3;
const easeIn = (t: number) => clamp(t) ** 2.4;
const span = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const lp = (a: P, b: P, t: number): P => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const sm = (pts: P[], closed = false, per = 8) => sample(pts, closed, per);
const resamp = (s: P[], n: number, closed = false): P[] => {
  const pts = closed ? [...s, s[0]] : s, cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = cum[cum.length - 1], out: P[] = []; let j = 1;
  for (let k = 0; k < n; k++) { const d = (L * k) / (closed ? n : n - 1); while (j < pts.length - 1 && cum[j] < d) j++; out.push(lp(pts[j - 1], pts[j], clamp((d - cum[j - 1]) / (cum[j] - cum[j - 1] || 1)))); }
  return out;
};
const cutPath = (s: P[], q: number): P[] => { if (q >= 1) return s; const n = Math.max(2, Math.ceil(s.length * clamp(q))); return s.slice(0, n); };
const move = (s: P[], dx: number, dy: number): P[] => s.map(([x, y]) => [x + dx, y + dy]);
const rot = (s: P[], c: P, a: number): P[] => { const co = Math.cos(a), si = Math.sin(a); return s.map(([x, y]) => [c[0] + (x - c[0]) * co - (y - c[1]) * si, c[1] + (x - c[0]) * si + (y - c[1]) * co]); };
const scl = (s: P[], c: P, k: number, ky = k): P[] => s.map(([x, y]) => [c[0] + (x - c[0]) * k, c[1] + (y - c[1]) * ky]);
const circ = (c: P, rx: number, ry = rx, n = 48, a0 = 0): P[] => Array.from({ length: n }, (_, i) => { const a = a0 + (i / n) * Math.PI * 2; return [c[0] + Math.cos(a) * rx, c[1] + Math.sin(a) * ry] as P; });

// ---------------------------------------------------------------- the marks
const sub = (c: Ctx, s: P[], closed = true) => { s.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); if (closed) c.closePath(); };
const trace = (c: Ctx, s: P[], closed = true) => { c.beginPath(); s.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); if (closed) c.closePath(); };
const LIGHT: P = [0.85, -0.5]; // toward the lamp

// A brush-marker line: tapered ends, a little wobble, heavier on the side turned away from the light.
const stroke = (c: Ctx, pts: P[], w: number, color: string, o: { seed?: number; closed?: boolean; taper?: [number, number]; alpha?: number; q?: number; even?: boolean } = {}) => {
  const { seed = 1, closed = false, taper = [0.14, 0.2], alpha = 1, q = 1, even = false } = o;
  let s = closed ? sm([...pts, pts[0], pts[1]], false, 6) : sm(pts, false, 6);
  if (closed) s = s.slice(0, s.length - 5);
  s = cutPath(s, q); const n = s.length; if (n < 2) return;
  const r = rng(seed), ph = r() * 9, L: P[] = [], R: P[] = [];
  for (let i = 0; i < n; i++) {
    const a = s[Math.max(0, i - 1)], b = s[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, t = i / (n - 1);
    const tp = closed && q >= 1 ? 1 : Math.min(1, t / taper[0], (1 - t) / taper[1]);
    const away = even ? 1 : 1 + 0.55 * Math.max(0, -(nx * LIGHT[0] + ny * LIGHT[1]));
    const ww = (w / 2) * (0.22 + 0.78 * ease(tp)) * away * (1 + 0.12 * Math.sin(t * 17 + ph) + 0.06 * Math.sin(t * 43 + ph * 2));
    L.push([s[i][0] + nx * ww, s[i][1] + ny * ww]); R.push([s[i][0] - nx * ww, s[i][1] - ny * ww]);
  }
  c.globalAlpha = alpha; c.fillStyle = color; trace(c, [...L, ...R.reverse()]); c.fill(); c.globalAlpha = 1;
};

// A painted flat: the fill, a hard cel shade on the side away from the lamp, dry-brush texture, the contour.
type PaintOpts = { shade?: string; sd?: number; hi?: string; hd?: number; line?: number; lineColor?: string; seed?: number; tex?: number; alpha?: number };
const paint = (c: Ctx, shape: P[], fill: string, o: PaintOpts = {}) => {
  const { shade, sd = 14, hi, hd = 6, line = 5, lineColor = INK, seed = 3, tex = 1, alpha = 1 } = o;
  c.globalAlpha = alpha; c.fillStyle = fill; trace(c, shape); c.fill();
  c.save(); trace(c, shape); c.clip();
  if (shade) { c.fillStyle = shade; c.beginPath(); c.rect(-4000, -4000, 12000, 12000); sub(c, move(shape, sd * LIGHT[0] * 1.2, sd * LIGHT[1] * 1.2)); c.fill("evenodd"); }
  if (hi) { c.fillStyle = hi; c.beginPath(); c.rect(-4000, -4000, 12000, 12000); sub(c, move(shape, -hd * LIGHT[0], -hd * LIGHT[1])); c.globalAlpha = 0.55 * alpha; c.fill("evenodd"); c.globalAlpha = alpha; }
  if (tex > 0) dryBrush(c, shape, seed, tex);
  c.restore(); c.globalAlpha = 1;
  if (line > 0) stroke(c, shape, line, lineColor, { seed, closed: true, alpha });
};
// dry-brush drag: short parallel streaks lighter and darker than the flat, so no fill is dead flat
const dryBrush = (c: Ctx, shape: P[], seed: number, k = 1) => {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of shape) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const r = rng(seed * 7 + 1), n = Math.min(260, Math.round(((x1 - x0) * (y1 - y0)) / 900 * k));
  c.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0), len = 10 + r() * 34, a = -0.45 + (r() - 0.5) * 0.25;
    c.strokeStyle = r() < 0.5 ? "#ffffff" : "#000000"; c.globalAlpha = 0.035 + r() * 0.05; c.lineWidth = 1 + r() * 3.5;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); c.stroke();
  }
  c.globalAlpha = 1;
};
// the gel-pen highlight and the reference's four-point sparkle
const gel = (c: Ctx, pts: P[], w = 5, alpha = 0.85) => stroke(c, pts, w, "#fff8e8", { taper: [0.4, 0.4], alpha, even: true });
const sparkle = (c: Ctx, x: number, y: number, r: number, color = "#fff6dc", alpha = 1) => {
  c.globalAlpha = alpha; c.fillStyle = color; c.beginPath();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.18 : r; i ? c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath(); c.fill(); c.globalAlpha = 1;
};
const glow = (c: Ctx, x: number, y: number, r: number, color: string, a: number) => {
  const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color); g.addColorStop(1, "rgba(0,0,0,0)");
  c.globalAlpha = a; c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.globalAlpha = 1;
};

// ---------------------------------------------------------------- the stage (the reference's fixed frame, at night)
const g = (x: number, m: number, s: number) => Math.exp(-(((x - m) / s) ** 2));
const STAGE: P[] = (() => {
  const m = 52, cr = 64, out: P[] = [];
  const top = (x: number) => m + 14 - 30 * g(x, W / 2, 150) + 9 * g(x, W / 2 - 300, 90) + 9 * g(x, W / 2 + 300, 90);
  const side = (y: number) => m + 14 - 30 * g(y, H / 2, 110) + 8 * g(y, H / 2 - 220, 70) + 8 * g(y, H / 2 + 220, 70);
  const corner = (cx: number, cy: number, a0: number) => { for (let i = 0; i <= 10; i++) { const a = a0 - (i / 10) * (Math.PI / 2); out.push([cx + Math.cos(a) * cr, cy + Math.sin(a) * cr]); } };
  const steps = 60;
  for (let i = 0; i <= steps; i++) { const x = m + cr + ((W - 2 * m - 2 * cr) * i) / steps; out.push([x, top(x)]); }
  corner(W - m + 4, m - 4, Math.PI);
  for (let i = 0; i <= steps; i++) { const y = m + cr + ((H - 2 * m - 2 * cr) * i) / steps; out.push([W - side(y), y]); }
  corner(W - m + 4, H - m + 4, -Math.PI / 2);
  for (let i = 0; i <= steps; i++) { const x = W - m - cr - ((W - 2 * m - 2 * cr) * i) / steps; out.push([x, H - top(x)]); }
  corner(m - 4, H - m + 4, 0);
  for (let i = 0; i <= steps; i++) { const y = H - m - cr - ((H - 2 * m - 2 * cr) * i) / steps; out.push([side(y), y]); }
  corner(m - 4, m - 4, Math.PI / 2);
  return out;
})();
const border = (c: Ctx, t: number) => {
  c.fillStyle = NAVY; c.beginPath(); c.rect(0, 0, W, H); sub(c, STAGE); c.fill("evenodd");
  // halftone, as on the reference's teal border, here dusty blue on navy
  c.save(); c.beginPath(); c.rect(0, 0, W, H); sub(c, STAGE); c.clip("evenodd");
  c.fillStyle = CURTAIN; for (let y = 0; y < H; y += 11) for (let x = (y / 11) % 2 ? 5.5 : 0; x < W; x += 11) { const k = 0.5 + 0.5 * Math.sin(x * 0.004 + y * 0.006 + t * 0.4); c.globalAlpha = 0.16; c.beginPath(); c.arc(x, y, 1 + 1.6 * k, 0, 6.283); c.fill(); }
  c.restore(); c.globalAlpha = 1;
  c.strokeStyle = GOLD; c.lineWidth = 3.5; trace(c, STAGE); c.stroke();
  c.strokeStyle = GOLD; c.globalAlpha = 0.35; c.lineWidth = 1.5; trace(c, scl(STAGE, [W / 2, H / 2], 0.985, 0.975)); c.stroke(); c.globalAlpha = 1;
};

// the faint wall pattern: the reference's mandala ground, become a night wallpaper of small lamp-flowers
const wallpaper = (c: Ctx, x0: number, y0: number, x1: number, y1: number, color: string, a: number) => {
  c.globalAlpha = a; c.strokeStyle = color; c.lineWidth = 2;
  for (let y = y0, row = 0; y < y1; y += 92, row++) for (let x = x0 + (row % 2) * 60; x < x1; x += 120) {
    c.beginPath(); for (let k = 0; k < 4; k++) { const an = (k / 4) * Math.PI * 2; c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(an + 0.5) * 18, y + Math.sin(an + 0.5) * 18, x + Math.cos(an) * 22, y + Math.sin(an) * 22); c.quadraticCurveTo(x + Math.cos(an - 0.5) * 18, y + Math.sin(an - 0.5) * 18, x, y); }
    c.stroke(); c.beginPath(); c.arc(x, y, 3, 0, 6.283); c.stroke();
  }
  c.globalAlpha = 1;
};

// ---------------------------------------------------------------- lettering
const lyric = (c: Ctx, words: string[], t: number, at: number[], x: number, y: number, size: number, color = MOON, align: CanvasTextAlign = "center") => {
  c.font = `italic 700 ${size}px "PaaroHand", Georgia, serif`; c.textBaseline = "alphabetic";
  const full = words.join(" "), totalW = c.measureText(full).width;
  let cx = align === "center" ? x - totalW / 2 : x;
  words.forEach((w, i) => {
    const p = easeOut(span(t, at[i], at[i] + 0.35)), wW = c.measureText(w).width;
    if (p > 0) {
      const lift = (1 - p) * 18, sq = 1 + 0.08 * Math.sin(p * Math.PI); // a little squash-pop, as the reference's words land
      c.save(); c.translate(cx + wW / 2, y + lift); c.rotate(((i % 2 ? 1 : -1) * 0.025)); c.scale(sq, 2 - sq);
      c.globalAlpha = p; c.fillStyle = INK; c.fillText(w, -wW / 2 + 4, 5); c.fillStyle = color; c.fillText(w, -wW / 2, 0); c.restore();
      if (i === words.length - 1 && p > 0.6) sparkle(c, cx + wW + 22, y - size * 0.75, size * 0.22 * p, "#fff6dc", p);
    }
    cx += wW + c.measureText(" ").width;
  });
  c.globalAlpha = 1;
};

// ---------------------------------------------------------------- the room
type Room = { t: number; sip: number; tilt: number; bottle: number; moon: number; billow: number; lean: number; glassDown: number; slump: number; rain: number };
const BED_TOP = 560, FLOOR = 880, CLOCK: P = [990, 395];
const room = (c: Ctx, st: Room) => {
  const { t } = st;
  // wall, warmed around the lamp
  c.fillStyle = TEAL_D; c.fillRect(-200, -200, W + 400, H + 400);
  wallpaper(c, 0, 60, W, FLOOR, TEAL_L, 0.18);
  glow(c, 1170, 640, 820, "rgba(217,164,65,0.55)", 1);
  // clock
  clock(c, CLOCK, 62, t);
  // window and the night
  windowView(c, st);
  // floor
  const floor: P[] = [[-200, FLOOR], [W + 200, FLOOR], [W + 200, H + 200], [-200, H + 200]];
  paint(c, floor, "#13272d", { line: 0, tex: 0.5, seed: 21 });
  c.strokeStyle = "#0b1a1f"; c.lineWidth = 2; c.globalAlpha = 0.6;
  for (let i = -8; i < 20; i++) { c.beginPath(); c.moveTo(W / 2 + i * 70, FLOOR); c.lineTo(W / 2 + i * 190, H + 200); c.stroke(); }
  c.globalAlpha = 1;
  glow(c, 1170, 930, 560, "rgba(217,164,65,0.35)", 1);
  // papers on the floor, each with a few struck-out lines
  const papers: [number, number, number][] = [[330, 975, -0.3], [470, 1005, 0.25], [1240, 990, 0.12], [1420, 960, -0.5], [560, 940, 0.6]];
  papers.forEach(([x, y, a], i) => {
    const sh = rot([[x - 58, y - 30], [x + 58, y - 34], [x + 62, y + 30], [x - 54, y + 34]], [x, y], a);
    paint(c, sh, PAPER, { shade: "#9d998f", sd: 6, line: 3, seed: 40 + i, tex: 0.6 });
    for (let k = 0; k < 4; k++) stroke(c, rot([[x - 40, y - 16 + k * 11], [x + 30 - (k % 2) * 18, y - 16 + k * 11]], [x, y], a), 2.5, "#5d6273", { seed: 50 + i * 5 + k, alpha: 0.8 });
    if (i % 2 === 0) stroke(c, rot([[x - 44, y + 8], [x + 36, y - 22]], [x, y], a), 3, CRIMSON_S, { seed: 70 + i, alpha: 0.75 });
  });
  bed(c, st);
  table(c, st);
  boy(c, st);
};

const clock = (c: Ctx, o: P, r: number, t: number, spin = 0) => {
  paint(c, circ(o, r + 10), WOOD, { shade: WOOD_S, sd: 8, line: 5, seed: 11 });
  paint(c, circ(o, r), "#e9dfc7", { shade: "#b8ab8c", sd: 10, line: 3, seed: 12, tex: 0.5 });
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; stroke(c, [[o[0] + Math.cos(a) * r * 0.78, o[1] + Math.sin(a) * r * 0.78], [o[0] + Math.cos(a) * r * 0.9, o[1] + Math.sin(a) * r * 0.9]], i % 3 ? 3 : 6, INK, { seed: 13 + i, even: true }); }
  // 2:47 at night, and when the clock spins the minute hand races (with smear arcs behind it)
  const mA = -Math.PI / 2 + (47 / 60) * Math.PI * 2 + spin * Math.PI * 2 * 6, hA = -Math.PI / 2 + ((2 + 47 / 60) / 12) * Math.PI * 2 + spin * Math.PI * 2 * 0.5;
  if (spin > 0.01) for (let k = 1; k < 6; k++) { c.globalAlpha = 0.18 / k * 3; c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.arc(o[0], o[1], r * 0.7, mA - k * 0.22, mA - (k - 1) * 0.22); c.stroke(); }
  c.globalAlpha = 1;
  stroke(c, [o, [o[0] + Math.cos(hA) * r * 0.5, o[1] + Math.sin(hA) * r * 0.5]], 9, INK, { seed: 14, taper: [0.02, 0.5] });
  stroke(c, [o, [o[0] + Math.cos(mA) * r * 0.78, o[1] + Math.sin(mA) * r * 0.78]], 6, INK, { seed: 15, taper: [0.02, 0.6] });
  paint(c, circ(o, 6, 6, 12), CRIMSON, { line: 0, tex: 0 });
  gel(c, sm([[o[0] - r * 0.6, o[1] - r * 0.4], [o[0] - r * 0.35, o[1] - r * 0.68]]), 4, 0.6);
};

const WIN = { x0: 1330, y0: 170, x1: 1670, y1: 560 };
const windowView = (c: Ctx, st: Room) => {
  const { x0, y0, x1, y1 } = WIN, t = st.t;
  const sky = c.createLinearGradient(0, y0, 0, y1); sky.addColorStop(0, NAVY); sky.addColorStop(1, INDIGO);
  c.fillStyle = sky; c.fillRect(x0, y0, x1 - x0, y1 - y0);
  c.save(); c.beginPath(); c.rect(x0, y0, x1 - x0, y1 - y0); c.clip();
  nightSky(c, x0, y0, x1, y1, t, st.moon, st.rain);
  c.restore();
  // frame and mullions
  const fr = (pts: P[], s: number) => paint(c, pts, WOOD, { shade: WOOD_S, sd: 7, hi: WOOD_L, hd: 4, line: 4, seed: s, tex: 0.6 });
  fr([[x0 - 22, y0 - 22], [x1 + 22, y0 - 22], [x1 + 22, y0], [x0 - 22, y0]], 31);
  fr([[x0 - 22, y1], [x1 + 22, y1], [x1 + 34, y1 + 24], [x0 - 34, y1 + 24]], 32);
  fr([[x0 - 22, y0], [x0, y0], [x0, y1], [x0 - 22, y1]], 33);
  fr([[x1, y0], [x1 + 22, y0], [x1 + 22, y1], [x1, y1]], 34);
  fr([[(x0 + x1) / 2 - 8, y0], [(x0 + x1) / 2 + 8, y0], [(x0 + x1) / 2 + 8, y1], [(x0 + x1) / 2 - 8, y1]], 35);
  fr([[x0, (y0 + y1) / 2 - 7], [x1, (y0 + y1) / 2 - 7], [x1, (y0 + y1) / 2 + 7], [x0, (y0 + y1) / 2 + 7]], 36);
  // drops sliding on the glass
  const r = rng(91);
  for (let i = 0; i < 16; i++) { const x = x0 + 12 + r() * (x1 - x0 - 24), sp = 18 + r() * 30, y = y0 + 10 + ((r() * 400 + t * sp) % (y1 - y0 - 20)); c.globalAlpha = 0.55 * st.rain; c.fillStyle = CURTAIN_L; c.beginPath(); c.ellipse(x, y, 3, 4.5, 0, 0, 6.283); c.fill(); c.globalAlpha = 0.25 * st.rain; c.fillRect(x - 1, y - 26, 2, 22); }
  c.globalAlpha = 1;
  curtains(c, st);
};
const nightSky = (c: Ctx, x0: number, y0: number, x1: number, y1: number, t: number, moon: number, rain: number) => {
  const r = rng(77);
  for (let i = 0; i < 70; i++) { const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0) * 0.8, tw = 0.5 + 0.5 * Math.sin(t * 2.3 + i * 1.7); c.globalAlpha = 0.25 + 0.45 * tw; c.fillStyle = MOON; c.fillRect(x, y, 2.2, 2.2); }
  c.globalAlpha = 1;
  if (moon > 0) crescent(c, [x0 + (x1 - x0) * 0.68, y0 + (y1 - y0) * 0.3], Math.min(x1 - x0, 400) * 0.16, moon);
  // the far town: rooftops with a few lit windows
  const base = y1, rr = rng(5); let x = x0 - 20;
  c.fillStyle = "#0a0f26";
  while (x < x1 + 20) { const w = 40 + rr() * 70, h = 50 + rr() * 110; c.fillRect(x, base - h, w, h + 4); for (let k = 0; k < 4; k++) if (rr() < 0.35) { c.fillStyle = LAMP; c.globalAlpha = 0.7; c.fillRect(x + 8 + rr() * (w - 20), base - h + 12 + rr() * (h - 30), 6, 8); c.globalAlpha = 1; c.fillStyle = "#0a0f26"; } x += w + 4; }
  // rain
  if (rain > 0) { c.strokeStyle = CURTAIN_L; c.lineWidth = 1.6; const rn = rng(17); for (let i = 0; i < 90; i++) { const xx = x0 + rn() * (x1 - x0 + 80), sp = 900 + rn() * 300, yy = y0 + ((rn() * 1000 + t * sp) % (y1 - y0 + 60)) - 30; c.globalAlpha = (0.18 + rn() * 0.25) * rain; c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx - 9, yy + 26); c.stroke(); } c.globalAlpha = 1; }
};
const crescent = (c: Ctx, o: P, r: number, a = 1, line = 4) => {
  glow(c, o[0], o[1], r * 3.2, "rgba(243,223,162,0.35)", a);
  c.globalAlpha = a; c.save(); c.beginPath(); c.arc(o[0], o[1], r, 0, 6.283); c.arc(o[0] + r * 0.45, o[1] - r * 0.22, r * 0.86, 0, 6.283, true); c.clip("evenodd" as CanvasFillRule);
  c.fillStyle = MOON; c.fillRect(o[0] - r, o[1] - r, r * 2, r * 2); c.fillStyle = "#cdb575"; c.beginPath(); c.arc(o[0] + r * 0.2, o[1] + r * 0.12, r * 0.95, 0, 6.283); c.rect(o[0] - r * 2, o[1] - r * 2, r * 4, r * 4); c.fill("evenodd"); c.restore();
  if (line) stroke(c, sm([...circ(o, r, r, 40, 0.95).slice(0, 29)]), line, INK, { seed: 61, alpha: a });
  c.globalAlpha = 1;
};
const curtainShape = (side: -1 | 1, billow: number, t: number): P[] => {
  const { x0, x1, y0 } = WIN, top = y0 - 40, bot = 760, xin = side < 0 ? x0 + 40 : x1 - 40, xout = side < 0 ? x0 - 120 : x1 + 120;
  const pts: P[] = [], n = 14;
  for (let i = 0; i <= n; i++) { const f = i / n, wave = Math.sin(f * 5 + t * 1.6 + side) * 10 * (0.3 + billow), swing = -side * billow * 260 * f ** 1.6; pts.push([xin + wave + swing - side * f * 30 * (1 - billow), top + (bot - top) * f]); }
  for (let i = n; i >= 0; i--) { const f = i / n, wave = Math.sin(f * 4 + t * 1.3) * 6; pts.push([xout + wave - side * billow * 160 * f ** 2, top + (bot - top) * f]); }
  return pts;
};
const curtains = (c: Ctx, st: Room) => {
  for (const side of [-1, 1] as const) {
    if (st.billow > 0.02 && side < 0) continue; // the left curtain is the one that becomes arms (drawn by the embrace)
    const sh = sm(curtainShape(side, side < 0 ? 0 : st.billow * 0.3, st.t), true, 3);
    paint(c, sh, CURTAIN, { shade: CURTAIN_S, sd: 16, hi: CURTAIN_L, hd: 5, line: 5, seed: 81 + side });
    // fold lines
    c.save(); trace(c, sh); c.clip();
    const xs = side < 0 ? [WIN.x0 - 70, WIN.x0 - 20] : [WIN.x1 + 30, WIN.x1 + 80];
    xs.forEach((x, i) => stroke(c, sm([[x, WIN.y0 - 30], [x + 8, 300], [x - 4, 520], [x + 6, 750]]), 6, CURTAIN_S, { seed: 90 + i + side * 3, alpha: 0.9 }));
    c.restore();
  }
  paint(c, [[WIN.x0 - 150, WIN.y0 - 54], [WIN.x1 + 150, WIN.y0 - 54], [WIN.x1 + 150, WIN.y0 - 42], [WIN.x0 - 150, WIN.y0 - 42]], GOLD, { line: 3, tex: 0, seed: 99 });
};

const bed = (c: Ctx, st: Room) => {
  // headboard, side rail, mattress, crumpled sheet, pillow
  paint(c, [[70, 330], [190, 300], [190, FLOOR + 10], [70, FLOOR + 10]], WOOD, { shade: WOOD_S, sd: 12, hi: WOOD_L, line: 5, seed: 101 });
  paint(c, [[150, 610], [690, 610], [690, FLOOR + 6], [150, FLOOR + 6]], WOOD, { shade: WOOD_S, sd: 16, hi: WOOD_L, line: 5, seed: 102 });
  stroke(c, [[170, 650], [670, 650]], 3, WOOD_S, { seed: 103 });
  paint(c, [[150, BED_TOP + 6], [700, BED_TOP], [704, 616], [150, 616]], SHEET, { shade: SHEET_S, sd: 10, line: 4, seed: 104 });
  paint(c, sm([[200, 506], [330, 494], [372, 530], [340, 566], [210, 572], [184, 540]], true), "#d4d8e0", { shade: SHEET_S, sd: 12, line: 5, seed: 105 });
  // the blanket, kicked off and hanging over the rail
  const blanket = sm([[380, 548], [520, 532], [640, 556], [660, 600], [640, 700], [600, 760], [560, 700], [520, 740], [470, 690], [430, 612], [372, 586]], true);
  paint(c, blanket, "#5e6f8c", { shade: "#3d4a63", sd: 18, hi: CURTAIN_L, hd: 5, line: 5, seed: 106 });
  [[[470, 560], [520, 640], [540, 720]], [[580, 570], [600, 650], [600, 735]], [[420, 570], [470, 640]]].forEach((f, i) => stroke(c, sm(f as P[]), 4, "#2e3950", { seed: 107 + i }));
  // the other half of the bed: empty, its pillow untouched (the token that returns at the end)
  paint(c, sm([[90 + 0, 470], [175, 462], [196, 492], [178, 520], [96, 522], [80, 496]], true), "#c7ccd6", { shade: SHEET_S, sd: 10, line: 4, seed: 108 });
};

const table = (c: Ctx, st: Room) => {
  const tx0 = 1060, tx1 = 1300, ty = 740;
  paint(c, [[tx0 + 20, ty + 10], [tx0 + 40, ty + 10], [tx0 + 36, 960], [tx0 + 22, 960]], WOOD_S, { line: 4, seed: 111, tex: 0 });
  paint(c, [[tx1 - 40, ty + 10], [tx1 - 20, ty + 10], [tx1 - 22, 960], [tx1 - 36, 960]], WOOD_S, { line: 4, seed: 112, tex: 0 });
  paint(c, [[tx0, ty - 14], [tx1, ty - 14], [tx1 + 10, ty + 14], [tx0 - 10, ty + 14]], WOOD, { shade: WOOD_S, sd: 8, hi: WOOD_L, line: 5, seed: 113 });
  // lamp: brass stem, pleated shade, the bulb's pool
  const lx = 1170;
  paint(c, sm([[lx - 40, ty - 14], [lx + 40, ty - 14], [lx + 26, ty - 34], [lx - 26, ty - 34]], true), GOLD, { shade: "#8c6a2e", sd: 6, line: 4, seed: 114 });
  paint(c, [[lx - 6, ty - 34], [lx + 6, ty - 34], [lx + 6, ty - 150], [lx - 6, ty - 150]], GOLD, { shade: "#8c6a2e", sd: 4, line: 3, seed: 115, tex: 0 });
  glow(c, lx, ty - 175, 260, "rgba(244,211,132,0.8)", 1);
  const shade: P[] = [[lx - 52, ty - 225], [lx + 52, ty - 225], [lx + 88, ty - 145], [lx - 88, ty - 145]];
  paint(c, shade, LAMP, { shade: "#a87a2c", sd: 10, hi: "#fff0c0", hd: 6, line: 5, seed: 116 });
  c.save(); trace(c, shade); c.clip(); for (let i = -4; i <= 4; i++) stroke(c, [[lx + i * 12, ty - 225], [lx + i * 20, ty - 145]], 2.5, "#a87a2c", { seed: 117 + i, alpha: 0.6, even: true }); c.restore();
  // the bottle: green glass, a finger of whisky left (st.bottle 0..1)
  const bx = 1250, bb = ty - 14;
  const bottle = sm([[bx - 26, bb], [bx + 26, bb], [bx + 28, bb - 110], [bx + 12, bb - 140], [bx + 9, bb - 186], [bx - 9, bb - 186], [bx - 12, bb - 140], [bx - 28, bb - 110]], true, 4);
  paint(c, bottle, "#1f3b33", { line: 0, tex: 0.4, seed: 118, alpha: 0.95 });
  if (st.bottle > 0) { c.save(); trace(c, bottle); c.clip(); paint(c, [[bx - 40, bb - 110 * st.bottle], [bx + 40, bb - 110 * st.bottle - 4], [bx + 40, bb + 4], [bx - 40, bb + 4]], "#b4702a", { line: 0, tex: 0, seed: 119 }); c.restore(); }
  stroke(c, bottle, 5, INK, { closed: true, seed: 120 });
  paint(c, [[bx - 10, bb - 186], [bx + 10, bb - 186], [bx + 10, bb - 200], [bx - 10, bb - 200]], CRIMSON, { line: 3, tex: 0, seed: 121 });
  paint(c, [[bx - 24, bb - 92], [bx + 24, bb - 92], [bx + 24, bb - 52], [bx - 24, bb - 52]], "#d8c79e", { line: 3, seed: 122, tex: 0.4 });
  gel(c, [[bx - 16, bb - 100], [bx - 18, bb - 20]], 5, 0.7); sparkle(c, bx + 14, bb - 150, 9);
  if (st.glassDown > 0) glassAt(c, [1150, ty - 14], 0, 0);
};

// the tumbler: a short heavy glass, whisky inside (fill 0..1), tilted by `tilt` radians about its base
const glassAt = (c: Ctx, base: P, tilt: number, fill: number, k = 1) => {
  const w = 44 * k, h = 58 * k, shape: P[] = [[-w / 2, -h], [w / 2, -h], [w / 2 - 5 * k, 0], [-w / 2 + 5 * k, 0]];
  const pts = rot(shape.map(([x, y]) => [x + base[0], y + base[1]] as P), base, tilt);
  c.globalAlpha = 0.5; c.fillStyle = GLASS; trace(c, pts); c.fill(); c.globalAlpha = 1;
  if (fill > 0) { c.save(); trace(c, pts); c.clip(); const lvl: P[] = [[-w, -h * fill * 0.7], [w, -h * fill * 0.7], [w, 4 * k], [-w, 4 * k]]; c.fillStyle = "#c27a2c"; trace(c, rot(lvl.map(([x, y]) => [x + base[0], y + base[1]] as P), base, 0)); c.fill(); c.restore(); }
  stroke(c, [...pts, pts[0]], 4.5 * k, INK, { seed: 131, taper: [0.02, 0.02] });
  const thick = rot([[base[0] - w / 2 + 6 * k, base[1] - 8 * k], [base[0] + w / 2 - 6 * k, base[1] - 8 * k]], base, tilt);
  stroke(c, thick, 3 * k, INK, { seed: 132, alpha: 0.7 });
  gel(c, rot([[base[0] - w / 2 + 9 * k, base[1] - h + 8 * k], [base[0] - w / 2 + 12 * k, base[1] - 14 * k]], base, tilt), 4 * k, 0.8);
};

// THE BOY. Sitting on the floor, back against the bed rail, right knee up, facing the lamp.
// Proportions: about 6.5 heads sitting-tall; head 92 px; hood down and bunched at the nape.
const boy = (c: Ctx, st: Room) => {
  const lean = st.lean, sl = st.slump;
  c.save(); c.translate(690, FLOOR); c.rotate(-0.06 * lean + 0.03 * sl); c.translate(-690, -FLOOR);
  // far leg lying flat, near leg knee-up
  paint(c, sm([[700, 856], [860, 862], [1010, 880], [1018, 912], [870, 914], [700, 912]], true), PANTS, { shade: PANTS_S, sd: 12, line: 5, seed: 141 });
  paint(c, sm([[1004, 878], [1046, 884], [1058, 906], [1010, 914]], true), "#cfc8b8", { shade: "#8e8878", sd: 6, line: 4, seed: 142 });
  const knee: P = [892, 742];
  paint(c, sm([[690, 860], [760, 800], [870, 718], [915, 740], [905, 790], [800, 880]], true), PANTS, { shade: PANTS_S, sd: 14, hi: "#4a5168", hd: 5, line: 5, seed: 143 });
  paint(c, sm([[878, 750], [918, 744], [960, 872], [930, 884], [905, 840]], true), PANTS, { shade: PANTS_S, sd: 12, line: 5, seed: 144 });
  paint(c, sm([[928, 868], [966, 866], [1004, 884], [1000, 904], [934, 902]], true), "#cfc8b8", { shade: "#8e8878", sd: 6, line: 4, seed: 145 });
  // torso in the hoodie, leaning back on the rail
  const torso = sm([[668, 868], [646, 760], [662, 680], [700, 648], [752, 640], [790, 664], [806, 720], [800, 800], [790, 870]], true);
  paint(c, torso, HOODIE, { shade: HOODIE_S, sd: 22, hi: "#7e8f8a", hd: 7, line: 6, seed: 146 });
  stroke(c, sm([[704, 760], [760, 768], [792, 760]]), 4, HOODIE_S, { seed: 147 }); // pocket
  stroke(c, sm([[760, 668], [752, 720], [756, 760]]), 3, "#d9cfb8", { seed: 148, alpha: 0.9 }); // drawstring
  // the hood bunched at the nape
  paint(c, sm([[676, 640], [700, 610], [744, 612], [760, 640], [720, 664]], true), HOODIE, { shade: HOODIE_S, sd: 12, line: 5, seed: 149 });
  // head: bowed a little, more when slumped; drinking tips it back
  const hb = -0.22 * st.sip + 0.12 * sl;
  c.save(); c.translate(752, 630); c.rotate(hb); c.translate(-752, -630);
  paint(c, [[740, 642], [770, 640], [772, 610], [742, 612]], SKIN, { shade: SKIN_S, sd: 10, line: 4, seed: 150 });
  const head = sm([[716, 572], [722, 532], [752, 510], [790, 512], [814, 534], [820, 556], [834, 584], [820, 590], [822, 606], [812, 618], [804, 630], [778, 638], [752, 626], [728, 604]], true, 4);
  paint(c, head, SKIN, { shade: SKIN_S, sd: 16, hi: "#e6b88d", hd: 5, line: 5, seed: 151 });
  // ear, closed eye (lashes down), brow, the corner of the mouth, stubble shadow
  paint(c, sm([[748, 566], [762, 560], [766, 584], [752, 594]], true), SKIN, { shade: SKIN_S, sd: 6, line: 4, seed: 152, tex: 0 });
  stroke(c, sm([[790, 566], [800, 572], [810, 570]]), 4, INK, { seed: 153 });
  stroke(c, sm([[786, 552], [800, 548], [816, 552]]), 5, INK, { seed: 154 });
  stroke(c, [[808, 612], [818, 610]], 3, SKIN_S, { seed: 155 });
  c.globalAlpha = 0.25; c.fillStyle = "#3a3346"; trace(c, sm([[780, 610], [806, 618], [804, 632], [778, 638], [760, 620]], true)); c.fill(); c.globalAlpha = 1;
  // hair: messy, falling over the forehead
  const hair = sm([[708, 590], [704, 548], [716, 516], [744, 496], [786, 494], [818, 508], [836, 532], [826, 540], [832, 556], [812, 548], [804, 560], [794, 540], [776, 552], [764, 536], [748, 556], [740, 584], [726, 598]], true, 3);
  paint(c, hair, "#1b1830", { shade: "#0c0b1a", sd: 10, hi: "#4e5a7a", hd: 4, line: 5, seed: 156 });
  gel(c, sm([[742, 510], [770, 502], [796, 506]]), 4, 0.5);
  c.restore();
  // the arm and the glass: resting on the knee (sip 0), at the lips (sip 1)
  const sip = ease(st.sip), shoulder: P = [764, 672], elbow = lp([870, 746], [842, 690], sip), hand = lp([930, 690], [826, 616], sip);
  const tilt = lerp(0, -1.0, sip) + st.tilt * -1.6;
  paint(c, sm([...[shoulder, elbow, hand].map(([x, y]) => [x, y - 18] as P), ...[hand, elbow, shoulder].map(([x, y]) => [x, y + 18] as P)], true, 4), HOODIE, { shade: HOODIE_S, sd: 14, hi: "#7e8f8a", hd: 6, line: 6, seed: 157 });
  if (!st.glassDown) glassAt(c, [hand[0] + 8, hand[1] - 6], tilt, st.tilt > 0.4 ? 0 : 0.8 * (1 - st.sip * 0.4));
  paint(c, sm([[hand[0] - 14, hand[1] - 16], [hand[0] + 22, hand[1] - 22], [hand[0] + 30, hand[1] + 6], [hand[0] + 8, hand[1] + 20], [hand[0] - 14, hand[1] + 12]], true), SKIN, { shade: SKIN_S, sd: 8, line: 5, seed: 158 });
  stroke(c, sm([[hand[0] + 6, hand[1] - 18], [hand[0] + 14, hand[1] - 2], [hand[0] + 12, hand[1] + 12]]), 3, SKIN_S, { seed: 159 });
  c.restore();
};

// ---------------------------------------------------------------- the heart
const HEART_C: P = [960, 545];
const heartShape = (c0: P = HEART_C, s = 245): P[] => resamp(sm(heartPts(c0[0], c0[1], s), true, 10), 120, true);
const CRACKS: P[][] = [
  [[960, 460], [948, 520], [978, 560], [944, 620], [966, 680], [956, 740]],
  [[978, 560], [1040, 572], [1066, 610], [1120, 600]],
  [[944, 620], [884, 610], [850, 650]],
  [[948, 520], [890, 498], [860, 470]],
];
const drawHeart = (c: Ctx, o: { scale?: number; cracks?: number; beat?: number; c0?: P } = {}) => {
  const { scale = 1, cracks = 1, beat = 0, c0 = HEART_C } = o, k = scale * (1 + 0.04 * beat);
  c.save(); c.translate(c0[0], c0[1]); c.scale(k, k); c.translate(-HEART_C[0], -HEART_C[1]);
  glow(c, HEART_C[0], HEART_C[1], 360, "rgba(155,42,55,0.35)", 1);
  const hs = heartShape();
  paint(c, hs, CRIMSON, { shade: CRIMSON_S, sd: 26, hi: CRIMSON_L, hd: 10, line: 9, seed: 201 });
  gel(c, sm([[858, 446], [826, 480], [818, 530]]), 9, 0.85); gel(c, [[808, 562], [810, 578]], 8, 0.85);
  sparkle(c, 1074, 430, 20);
  if (cracks > 0) CRACKS.forEach((cr, i) => {
    const q = clamp(cracks * 1.6 - i * 0.25);
    stroke(c, cutPath(resamp(cr, 40), q), 12 - i * 2, INK, { seed: 210 + i, taper: [0.05, 0.6] });
    stroke(c, cutPath(move(resamp(cr, 40), 5, -3), q), 3, "#e06a6f", { seed: 220 + i, alpha: 0.7, taper: [0.1, 0.6] });
  });
  c.restore();
};
const heartBackdrop = (c: Ctx, t: number) => {
  c.fillStyle = TEAL_D; c.fillRect(-200, -200, W + 400, H + 400);
  wallpaper(c, 0, 40, W, H, TEAL_L, 0.16);
  glow(c, W * 0.78, H * 0.2, 900, "rgba(217,164,65,0.28)", 1);
  const v = c.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 1100); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(5,8,20,0.65)"); c.fillStyle = v; c.fillRect(0, 0, W, H);
};

// the bandage: strips wound diagonally across the heart (wrap 0..1), then peeling (unravel 0..1)
const BAND_PATHS: P[][] = [
  [[700, 620], [960, 520], [1230, 470]],
  [[720, 470], [960, 590], [1200, 690]],
  [[1180, 560], [980, 650], [760, 740]],
];
const bandStrip = (c: Ctx, path: P[], q: number, seed: number, w = 74) => {
  const s = cutPath(resamp(sm(path), 60), q); if (s.length < 2) return;
  const L: P[] = [], R: P[] = [];
  s.forEach((p, i) => { const a = s[Math.max(0, i - 1)], b = s[Math.min(s.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; L.push([p[0] - (dy / l) * w / 2, p[1] + (dx / l) * w / 2]); R.push([p[0] + (dy / l) * w / 2, p[1] - (dx / l) * w / 2]); });
  const sh = [...L, ...R.reverse()];
  paint(c, sh, BANDAGE, { shade: BANDAGE_S, sd: 10, hi: "#f5e8cf", hd: 5, line: 5, seed, alpha: 0.93 });
  c.save(); trace(c, sh); c.clip();
  const r = rng(seed); for (let i = 0; i < s.length; i += 2) { const p = s[i]; for (let k = -2; k <= 2; k++) { c.globalAlpha = 0.35; c.fillStyle = BANDAGE_S; c.beginPath(); c.arc(p[0] + (r() - 0.5) * 8, p[1] + k * 13 + (r() - 0.5) * 6, 2.2, 0, 6.283); c.fill(); } }
  c.restore(); c.globalAlpha = 1;
};

// a flowing brushstroke (the unravelled bandage, on its way to becoming the moon)
const brushRibbon = (c: Ctx, path: P[], q: number, w: number, color: string, seed: number, tail = 0) => {
  const s = resamp(sm(path, false, 10), 120), a = Math.floor(clamp(tail) * 119), part = cutPath(s, q).slice(a);
  if (part.length < 2) return;
  stroke(c, part, w + 8, INK, { seed, taper: [0.2, 0.3] });
  stroke(c, part, w, color, { seed: seed + 1, taper: [0.22, 0.32], even: true });
  // bristle streaks along it
  const r = rng(seed + 5);
  for (let k = 0; k < 5; k++) { const off = (r() - 0.5) * w * 0.6; stroke(c, part.map(([x, y], i) => { const b = part[Math.min(part.length - 1, i + 1)], p0 = part[Math.max(0, i - 1)], dx = b[0] - p0[0], dy = b[1] - p0[1], l = Math.hypot(dx, dy) || 1; return [x - (dy / l) * off, y + (dx / l) * off] as P; }), 2, k % 2 ? "#fff6dc" : "#8c6a2e", { seed: seed + 10 + k, alpha: 0.35, taper: [0.3, 0.3], even: true }); }
};

// ---------------------------------------------------------------- the camera
const camera = (c: Ctx, env: Env, z: number, f: P, s: P = [W / 2, H / 2]) => {
  const k = env.scale; c.setTransform(k * z, 0, 0, k * z, k * (s[0] - f[0] * z), k * (s[1] - f[1] * z));
};
const flat = (c: Ctx, env: Env) => c.setTransform(env.scale, 0, 0, env.scale, 0, 0);
const grainCache = (env: Env) => {
  const key = `paaro-grain:${env.scale}`; let L = env.cache.get(key) as ReturnType<Env["canvas"]> | undefined; if (L) return L;
  const w = Math.round(512 * env.scale), h = w; L = env.canvas(w, h); const img = L.ctx.createImageData(w, h), r = rng(424);
  for (let i = 0; i < w * h; i++) { const v = 128 + (r() - 0.5) * 70; img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
  L.ctx.putImageData(img, 0, 0); env.cache.set(key, L); return L;
};
const paperGrain = (c: Ctx, env: Env) => {
  const L = grainCache(env); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = "overlay"; c.globalAlpha = 0.22;
  const pat = c.createPattern(L.canvas as CanvasImageSource, "repeat"); if (pat) { c.fillStyle = pat; c.fillRect(0, 0, W * env.scale, H * env.scale); }
  c.globalCompositeOperation = "source-over"; c.globalAlpha = 1;
};

// ---------------------------------------------------------------- the scenes (t = seconds in the film)
// Bars from the track: 1.10, 4.52, 7.95, 11.38, 14.81, 18.23, 21.66, 25.09, 28.52 (70 bpm).
const ROOM0: Room = { t: 0, sip: 0, tilt: 0, bottle: 0.18, moon: 0, billow: 0, lean: 0, glassDown: 0, slump: 0, rain: 1 };

// 0 - 2.3  "Ke sharaabein khatam": he drinks; the camera creeps in; the glass is empty
const sceneDrink = (c: Ctx, env: Env, t: number) => {
  const sip = span(t, 0.25, 0.9) - span(t, 1.25, 1.7), tilt = ease(span(t, 1.75, 2.15));
  const z = lerp(1, 1.85, ease(span(t, 0, 2.3))), f = lp([W / 2, H / 2], [830, 640], ease(span(t, 0, 2.3)));
  camera(c, env, z, f); room(c, { ...ROOM0, t, sip: ease(sip), tilt });
  flat(c, env); lyric(c, ["Ke", "sharaabein", "khatam"], t, [0.15, 0.5, 1.2], 560, 190, 74);
};
// 2.3 - 4.8  "Diye saare zakham": the last drop; its ripple rises into a heart; the heart cracks
const sceneDrop = (c: Ctx, env: Env, t: number) => {
  const l = t - 2.3; flat(c, env);
  // the tabletop in close-up, lamp-lit
  c.fillStyle = TEAL_D; c.fillRect(0, 0, W, H); glow(c, 1500, 120, 1100, "rgba(217,164,65,0.45)", 1);
  const top: P[] = [[-100, 640], [W + 100, 600], [W + 100, H + 100], [-100, H + 100]];
  const rise = ease(span(l, 0.95, 1.7)); // the ripple stands up off the table into the heart
  c.globalAlpha = 1 - rise; paint(c, top, WOOD, { shade: WOOD_S, sd: 18, hi: WOOD_L, hd: 6, line: 6, seed: 301 });
  c.save(); trace(c, top); c.clip(); for (let i = 0; i < 9; i++) stroke(c, sm([[-100, 690 + i * 48], [600, 680 + i * 50], [W + 100, 650 + i * 52]]), 3, WOOD_S, { seed: 302 + i, alpha: 0.6 * (1 - rise) }); c.restore();
  c.globalAlpha = rise; heartBackdrop(c, t); c.globalAlpha = 1;
  // the glass above, tipped over, and the drop
  const gq = 1 - ease(span(l, 0.7, 1.2));
  if (gq > 0) { c.globalAlpha = gq; glassAt(c, [1060, 250], -2.35, 0, 3.2); c.globalAlpha = 1; }
  const fall = easeIn(span(l, 0.05, 0.6)), dropY = lerp(300, 760, fall), impact: P = [960, 770];
  if (l < 0.62) {
    const d = sm([[960, dropY - 34], [976, dropY + 4], [960, dropY + 22], [944, dropY + 4]], true);
    paint(c, d, "#d48a36", { shade: "#8c5420", sd: 6, line: 5, seed: 310, tex: 0 }); gel(c, [[952, dropY - 6], [952, dropY + 8]], 4); sparkle(c, 990, dropY - 30, 12);
  }
  // ripple rings on the table, then the first ring becomes the heart
  const rl = l - 0.62;
  if (rl > 0) {
    for (let i = 0; i < 3; i++) { const p = clamp((rl - i * 0.18) / 0.9); if (p <= 0 || p >= 1) continue; c.globalAlpha = (1 - p) * (1 - rise); stroke(c, circ(impact, 80 + p * 420, (80 + p * 420) * 0.22, 64), 6 - i, "#e7c27c", { closed: true, seed: 320 + i }); }
    c.globalAlpha = 1;
    const m = ease(span(l, 0.95, 1.85)), ring = circ(lp(impact, HEART_C, rise), 210 * lerp(1, 1.08, m), 210 * lerp(0.22, 1, rise), 120, -Math.PI / 2);
    const hs = heartShape(), mix = ring.map((p, i) => lp(p, hs[i], m));
    if (m < 0.98) { stroke(c, mix, 10, CRIMSON_L, { closed: true, seed: 330 }); c.globalAlpha = m; c.fillStyle = CRIMSON; trace(c, mix); c.fill(); c.globalAlpha = 1; }
    else drawHeart(c, { cracks: span(l, 1.9, 2.5), beat: Math.sin(l * 8) * 0.5 });
  }
  lyric(c, ["Diye", "saare", "zakham"], l, [0.1, 0.55, 1.1], W / 2, 170, 74);
};
// 4.8 - 7.5  "Tere bhar naa sake, soneyaa": the bandage tries; the cracks show; it unravels into a stroke
const STROKE_PATH: P[] = [[1180, 560], [1320, 470], [1300, 330], [1450, 260], [1620, 300], [1700, 220]];
const sceneBandage = (c: Ctx, env: Env, t: number) => {
  const l = t - 4.8; flat(c, env); heartBackdrop(c, t);
  drawHeart(c, { beat: Math.sin(l * 8) * 0.4 });
  const un = ease(span(l, 1.7, 2.7));
  BAND_PATHS.forEach((p, i) => { const wrap = ease(span(l, 0.05 + i * 0.35, 0.6 + i * 0.35)); const q = i === 2 ? wrap * (1 - un) : wrap * (1 - ease(span(l, 1.5 + i * 0.1, 2.2))); if (q > 0.02) bandStrip(c, p, q, 401 + i); });
  // the cracks keep showing through: drawn again faintly over the bandage
  c.globalAlpha = 0.55; CRACKS.forEach((cr, i) => stroke(c, resamp(cr, 40), 7 - i, CRIMSON_S, { seed: 430 + i, taper: [0.05, 0.6] })); c.globalAlpha = 1;
  // a red seep through the cloth
  glow(c, 960, 590, 90, "rgba(155,42,55,0.55)", ease(span(l, 1.0, 1.6)) * (1 - un));
  if (un > 0) brushRibbon(c, [[1180, 560], ...STROKE_PATH.slice(1)], un, 34, BANDAGE, 440);
  lyric(c, ["Tere", "bhar", "naa", "sake,"], l, [0.1, 0.4, 0.75, 1.0], W / 2, 160, 70);
  lyric(c, ["soneyaa"], l, [1.6], W / 2, 980, 84, LAMP_L);
};
// 7.5 - 10  "Ho naa raatein khatam": the stroke flies to the window, curls into a moon; the clock spins; the night opens
const sceneMoon = (c: Ctx, env: Env, t: number) => {
  const l = t - 7.5, open = ease(span(l, 1.5, 2.5));
  const z = lerp(1.7, 1.0, open), f = lp([1380, 380], [1500, 365], open);
  camera(c, env, z, f);
  room(c, { ...ROOM0, t, moon: 0, rain: 1 - open });
  // the clock races (redrawn over the room's own clock)
  clock(c, CLOCK, 62, t, ease(span(l, 0.4, 2.3)));
  // the stroke arrives in a curve and wraps into the crescent
  const mc: P = [WIN.x0 + (WIN.x1 - WIN.x0) * 0.68, WIN.y0 + (WIN.y1 - WIN.y0) * 0.3], mr = 54;
  const arcPts = circ(mc, mr, mr, 40, 0.95).slice(0, 29);
  const travel = ease(span(l, 0, 0.9)), curl = ease(span(l, 0.6, 1.3)), solid = ease(span(l, 1.1, 1.5));
  const path: P[] = [[900, 820], [1050, 700], [1180, 520], ...arcPts];
  if (solid < 1) brushRibbon(c, path, travel * 0.55 + curl * 0.45, lerp(30, 20, curl), lerp(0, 1, curl) > 0.5 ? MOON : BANDAGE, 460, curl * 0.62);
  if (solid > 0) crescent(c, mc, mr, solid, 3);
  // the night spills past the window: indigo floods the stage, stars and the moon stay
  if (open > 0) {
    flat(c, env); c.globalAlpha = open;
    const sky = c.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, NAVY); sky.addColorStop(1, INDIGO); c.fillStyle = sky; c.fillRect(0, 0, W, H);
    nightSky(c, 0, 0, W, H * 0.92, t, 0, 0); c.globalAlpha = 1;
    // clouds, drawn as long stacked strokes, drifting
    for (let i = 0; i < 3; i++) { const y = 260 + i * 170, x = 300 + i * 420 + l * 30 * (i % 2 ? 1 : -1); brushRibbon(c, [[x - 260, y], [x - 80, y - 30], [x + 120, y - 10], [x + 300, y - 34]], 1, 26 - i * 4, INDIGO_L, 470 + i); }
    crescent(c, lp([W * 0.62, H * 0.32], [W * 0.62, H * 0.32], 1), lerp(mr * z, 120, open), open, 5);
    // the town rooftops widen along the bottom
    c.fillStyle = "#0a0f26"; const rr = rng(6); let x = -20; while (x < W + 20) { const w = 60 + rr() * 120, h = 60 + rr() * 150; c.globalAlpha = open; c.fillRect(x, H - h, w, h); for (let k = 0; k < 5; k++) if (rr() < 0.35) { c.fillStyle = LAMP; c.fillRect(x + 10 + rr() * (w - 24), H - h + 14 + rr() * (h - 34), 8, 10); c.fillStyle = "#0a0f26"; } x += w + 6; }
    c.globalAlpha = 1;
  }
  flat(c, env); lyric(c, ["Ho", "naa", "raatein", "khatam"], l, [0.1, 0.4, 0.75, 1.25], W / 2, 170, 74);
};
// the left curtain, become two arms of dusty-blue cloth with hands at the ends (form 0..1, hold 0..1, sheet 0..1)
const ARM_A: P[] = [[1330, 210], [1180, 380], [1000, 520], [880, 600], [810, 660], [770, 720]];
const ARM_B: P[] = [[1300, 420], [1150, 560], [1000, 680], [880, 760], [800, 800], [740, 800]];
const armCloth = (c: Ctx, path: P[], q: number, w: number, seed: number, t: number, hand: boolean, alpha = 1) => {
  const s = cutPath(resamp(sm(path), 80), q); if (s.length < 3) return;
  const L: P[] = [], R: P[] = [];
  s.forEach((p, i) => { const a = s[Math.max(0, i - 1)], b = s[Math.min(s.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], ln = Math.hypot(dx, dy) || 1, f = i / (s.length - 1), ww = w * lerp(2.4, 1, ease(f * 1.4)) + Math.sin(f * 14 + t * 3 + seed) * 8 * (1 - f); L.push([p[0] - (dy / ln) * ww / 2, p[1] + (dx / ln) * ww / 2]); R.push([p[0] + (dy / ln) * ww / 2, p[1] - (dx / ln) * ww / 2]); });
  paint(c, [...L, ...R.reverse()], CURTAIN, { shade: CURTAIN_S, sd: 14, hi: CURTAIN_L, hd: 6, line: 5, seed, alpha });
  for (let k = 0; k < 3; k++) stroke(c, s.slice(2, Math.floor(s.length * 0.7)).map(([x, y], i) => [x + (k - 1) * 9, y + Math.sin(i * 0.4 + k) * 4] as P), 2.5, CURTAIN_S, { seed: seed + k, alpha: 0.7 * alpha });
  if (hand && q > 0.97) {
    const e = s[s.length - 1], p = s[s.length - 8], a = Math.atan2(e[1] - p[1], e[0] - p[0]);
    const at = (x: number, y: number): P => [e[0] + Math.cos(a) * x - Math.sin(a) * y, e[1] + Math.sin(a) * x + Math.cos(a) * y];
    const palm = sm([at(-14, -30), at(30, -34), at(52, -18), at(56, 14), at(36, 32), at(-10, 30)], true, 4);
    paint(c, palm, CURTAIN_L, { shade: CURTAIN, sd: 9, line: 5, seed: seed + 9, alpha });
    // four fingers curling over his far side, the thumb laid along the top
    [-22, -6, 10, 24].forEach((y, k) => { const f = sm([at(48, y), at(78, y - 4 + k), at(96, y + 8 + k * 2)]), L: P[] = [], R: P[] = []; f.forEach((q, i) => { const b = f[Math.min(f.length - 1, i + 1)], o = f[Math.max(0, i - 1)], dx = b[0] - o[0], dy = b[1] - o[1], l = Math.hypot(dx, dy) || 1, w = lerp(8, 6, i / f.length); L.push([q[0] - (dy / l) * w, q[1] + (dx / l) * w]); R.push([q[0] + (dy / l) * w, q[1] - (dx / l) * w]); }); paint(c, [...L, ...R.reverse()], CURTAIN_L, { shade: CURTAIN, sd: 5, line: 4, seed: seed + 30 + k, alpha, tex: 0 }); });
    const th = sm([at(20, -30), at(44, -46), at(66, -44)]); stroke(c, th, 14, INK, { seed: seed + 40, alpha }); stroke(c, th, 9, CURTAIN_L, { seed: seed + 41, alpha, even: true });
    gel(c, [at(4, -18), at(30, -22)], 4, 0.7 * alpha);
  }
};
// 10 - 15  "Ke sula de sanam, mujhe baahon mein": the curtain reaches, holds him, falls away as an empty sheet
const sceneEmbrace = (c: Ctx, env: Env, t: number) => {
  const l = t - 10, form = ease(span(l, 0.2, 2.2)), hold = ease(span(l, 2.0, 2.9)), fall = ease(span(l, 3.4, 4.8));
  const z = lerp(1.15, 1.45, ease(span(l, 0, 5))), f = lp([1150, 560], [880, 640], ease(span(l, 0, 5)));
  camera(c, env, z, f);
  room(c, { ...ROOM0, t, moon: 1, rain: 0.5, billow: 1, lean: hold * (1 - fall * 0.6) });
  glow(c, 980, 560, 600, "rgba(157,178,201,0.25)", form * (1 - fall));
  if (fall < 0.95) {
    const sag = (p: P[]) => p.map(([x, y], i) => [x - fall * 40 * (i / p.length), y + fall * 260 * (i / p.length) ** 1.3] as P);
    const A = ARM_A.map((p, i) => lp(p, [p[0] - 10 * hold, p[1] + (i > 3 ? 20 * hold : 0)], hold)), B = ARM_B.map((p, i) => lp(p, [p[0] - 30 * hold, p[1] - (i > 3 ? 40 * hold : 0)], hold));
    armCloth(c, sag(A), form, 54, 501, t, fall < 0.3, 1 - fall * 0.4);
    armCloth(c, sag(B), clamp(form * 1.1 - 0.1), 50, 511, t, fall < 0.3, 1 - fall * 0.4);
  }
  if (fall > 0.2) { // what is left: a sheet slumped on the floor beside him
    const sh = sm([[880, 880], [1000, 850], [1110, 870], [1180, 920], [1060, 940], [900, 936]], true);
    paint(c, sh, CURTAIN, { shade: CURTAIN_S, sd: 12, hi: CURTAIN_L, line: 5, seed: 520, alpha: ease((fall - 0.2) / 0.8) });
  }
  flat(c, env);
  lyric(c, ["Ke", "sula", "de", "sanam,"], l, [0.1, 0.45, 0.9, 1.3], W / 2, 160, 70);
  lyric(c, ["mujhe", "baahon", "mein"], l, [2.3, 2.8, 3.4], W / 2, 980, 70, LAMP_L);
};
// two lamp-cast silhouettes on the wall; one comes apart; the other stays, darker
const profileHead = (cx: number, cy: number, dir: 1 | -1, long: boolean): P[] => {
  const p: P[] = [[-70, 120], [-60, 30], [-80, -40], [-60, -110], [0, -140], [60, -118], [86, -70], [88, -40], [112, -6], [92, 4], [96, 22], [86, 32], [92, 50], [76, 64], [50, 74], [44, 120], [140, 150], [180, 260], [-200, 260], [-170, 160]];
  const q = long ? p.map(([x, y], i) => (i === 0 ? [-110, 160] : i === 1 ? [-100, 40] : i === 2 ? [-104, -50] : [x, y]) as P) : p;
  return sm(q.map(([x, y]) => [cx + x * dir, cy + y] as P), true, 4);
};
const sceneShadows = (c: Ctx, env: Env, t: number) => {
  const l = t - 15; flat(c, env);
  c.fillStyle = TEAL; c.fillRect(0, 0, W, H); wallpaper(c, 0, 40, W, H, TEAL_L, 0.22);
  glow(c, W / 2, H * 0.62, 900, "rgba(217,164,65,0.5)", 1);
  const go = ease(span(l, 1.2, 4.0)), dark = ease(span(l, 2.4, 4.6));
  const him = profileHead(820, 560, 1, false), her = profileHead(1120, 560, -1, true);
  // the outline is drawn first, then the shadow sinks into the wall
  const draw = ease(span(l, 0, 0.9));
  c.globalAlpha = 0.55 + 0.35 * dark; c.fillStyle = "#081420"; trace(c, him); c.fill(); c.globalAlpha = 1;
  stroke(c, him, 4, INK, { closed: true, seed: 601, q: draw });
  if (go < 1) {
    // she comes apart into flakes that drift up and away toward the window side
    c.save(); trace(c, her); c.clip(); c.globalAlpha = 0.55 * (1 - go); c.fillStyle = "#0d1a2a"; c.fillRect(0, 0, W, H); c.restore(); c.globalAlpha = 1;
    stroke(c, her, 4, INK, { closed: true, seed: 602, q: draw, alpha: 1 - go });
    const r = rng(611);
    for (let i = 0; i < 160; i++) {
      const p = her[Math.floor(r() * her.length)], d = clamp((go - r() * 0.6) / 0.4), x = p[0] + d * (120 + r() * 300), y = p[1] - d * (160 + r() * 260) + Math.sin(i + t * 2) * 8 * d;
      if (d <= 0) continue; const s = 6 + r() * 12;
      c.globalAlpha = (1 - d) * 0.85; c.fillStyle = r() < 0.3 ? LAMP_L : "#0d1a2a"; c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s * 0.7, y); c.lineTo(x, y + s * 0.6); c.lineTo(x - s * 0.6, y); c.closePath(); c.fill();
    }
    c.globalAlpha = 1;
  }
  lyric(c, ["Ek", "jaan", "gayi,"], l, [0.2, 0.6, 1.1], W / 2, 170, 74);
  lyric(c, ["ek", "jaati", "nahin"], l, [2.4, 2.9, 3.6], W / 2, 990, 74, LAMP_L);
};
// 20 - 22.5  "Ek aur sitam naa kar": a red thread winds round the heart, bites, snaps
const THREAD_LOOPS = (tight: number): P[] => {
  const pts: P[] = [];
  for (let i = 0; i <= 160; i++) { const a = (i / 160) * Math.PI * 2 * 3.2, rx = lerp(300, 230, tight) - i * 0.25, ry = lerp(110, 70, tight); pts.push([960 + Math.cos(a) * rx, 540 + (i - 80) * 1.4 + Math.sin(a) * ry * 0.5]); }
  return pts;
};
const sceneThread = (c: Ctx, env: Env, t: number) => {
  const l = t - 20; flat(c, env); heartBackdrop(c, t);
  const tight = ease(span(l, 0.8, 1.9)), snap = l > 2.05;
  drawHeart(c, { scale: lerp(1, 0.94, tight), beat: Math.sin(l * 12) * tight });
  const loops = THREAD_LOOPS(tight), wind = ease(span(l, 0, 0.9));
  if (!snap) {
    stroke(c, cutPath(loops, wind), 7, "#5a0f17", { seed: 701, taper: [0.02, 0.02], even: true });
    stroke(c, cutPath(move(loops, -1.5, -1.5), wind), 4, THREAD, { seed: 702, taper: [0.02, 0.02], even: true });
    // the loose end, pulled hard to the right
    const pull = lp([1260, 600], [1820, 520], tight); if (wind > 0.95) stroke(c, sm([loops[loops.length - 1], [1200, 620], pull]), 4, THREAD, { seed: 703, even: true });
    if (tight > 0.8) { for (let k = 0; k < 4; k++) stroke(c, [[1340 + k * 30, 560 - k * 8], [1360 + k * 30, 540 - k * 8]], 3, LAMP_L, { seed: 710 + k }); }
  } else {
    const fly = ease(span(l, 2.05, 2.5));
    stroke(c, cutPath(loops, 0.45), 4, THREAD, { seed: 704, even: true });
    stroke(c, sm([loops[72], [1200 + fly * 300, 520 - fly * 120], [1500 + fly * 500, 420]]), 4, THREAD, { seed: 705, even: true });
    sparkle(c, 1190, 560, 40 * (1 - fly), "#fff1c8");
  }
  lyric(c, ["Ek", "aur", "sitam", "naa", "kar"], l, [0.1, 0.4, 0.7, 1.1, 1.4], W / 2, 170, 74);
};
// 22.5 - 27  "Jise paanaa tha, use kho baithe": the thread draws her at the end of a corridor; his hand reaches; she scatters
const herOutline = (cx: number, base: number, k: number): P[] => sm([
  [0, -470], [30, -462], [46, -432], [44, -398], [34, -372], [22, -356], [24, -338], [70, -322], [96, -296], [104, -240], [100, -170], [112, -100], [120, -20], [140, 80], [158, 180], [150, 230], [40, 236], [32, 300], [44, 340], [10, 342], [8, 240], [-8, 240], [-10, 342], [-44, 340], [-32, 300], [-40, 236], [-150, 230], [-158, 180], [-140, 80], [-120, -20], [-112, -100], [-100, -170], [-104, -240], [-96, -296], [-70, -322], [-56, -340], [-50, -380], [-48, -420], [-34, -458],
].map(([x, y]) => [cx + x * k, base + (y - 342) * k] as P), true, 4);
const sceneCorridor = (c: Ctx, env: Env, t: number) => {
  const l = t - 22.5; flat(c, env);
  const vp: P = [960, 470], push = ease(span(l, 0, 4.5));
  c.fillStyle = TEAL_D; c.fillRect(0, 0, W, H);
  // one-point corridor: walls, ceiling, floor, and doors receding
  const end = { x0: 860, y0: 330, x1: 1060, y1: 640 };
  const quad = (pts: P[], fill: string, s: number) => paint(c, pts, fill, { line: 4, seed: s, tex: 0.7 });
  quad([[0, 0], [end.x0, end.y0], [end.x0, end.y1], [0, H]], TEAL, 801);
  quad([[W, 0], [end.x1, end.y0], [end.x1, end.y1], [W, H]], "#1a3940", 802);
  quad([[0, 0], [W, 0], [end.x1, end.y0], [end.x0, end.y0]], "#0e2228", 803);
  quad([[0, H], [W, H], [end.x1, end.y1], [end.x0, end.y1]], "#14262c", 804);
  for (let i = 1; i < 5; i++) { const f = 1 - i / 5.5, dx = lerp(end.x0, 0, f), dy0 = lerp(end.y0, 0, f), dy1 = lerp(end.y1, H, f); stroke(c, [[dx, dy0], [dx, dy1]], 3, INK, { seed: 810 + i, alpha: 0.5 }); const ex = lerp(end.x1, W, f); stroke(c, [[ex, dy0], [ex, dy1]], 3, INK, { seed: 820 + i, alpha: 0.5 }); }
  // the far end is open and warm
  c.fillStyle = LAMP; c.fillRect(end.x0, end.y0, end.x1 - end.x0, end.y1 - end.y0); glow(c, 960, 500, 520, "rgba(244,211,132,0.7)", 1);
  // her, drawn by the red thread that came in from the left edge
  const her = herOutline(960, end.y1 - 6, 0.36), drawQ = ease(span(l, 0.1, 1.6)), scatter = ease(span(l, 3.0, 4.4));
  const lead: P[] = [[-20, 900], [300, 820], [700, 700], her[0]];
  if (drawQ < 1) stroke(c, sm(lead), 4, THREAD, { seed: 830, even: true, q: 1 - drawQ * 0.999 });
  if (scatter < 1) {
    c.globalAlpha = 0.85 * (1 - scatter); c.fillStyle = "#3a1220"; trace(c, her); c.fill(); c.globalAlpha = 1;
    stroke(c, her, 5, THREAD, { closed: true, seed: 831, q: drawQ, alpha: 1 - scatter });
  }
  if (scatter > 0) { const r = rng(840); for (let i = 0; i < 200; i++) { const p = her[Math.floor(r() * her.length)], d = clamp((scatter - r() * 0.5) / 0.5), x = p[0] + d * (r() - 0.3) * 260, y = p[1] - d * (60 + r() * 240); if (d <= 0 || d >= 1) continue; const s = 3 + r() * 7; c.globalAlpha = 1 - d; c.fillStyle = r() < 0.5 ? THREAD : LAMP_L; c.fillRect(x - s / 2, y - s / 2, s, s * 0.6); } c.globalAlpha = 1; }
  // his hand, reaching in from the bottom right toward her
  const reach = ease(span(l, 1.2, 3.2)), hx = lerp(1500, 1120, reach), hy = lerp(1000, 740, reach);
  c.save(); c.translate(hx, hy); c.scale(1.7, 1.7); c.translate(-hx, -hy);
  const sleeve = sm([[W + 60, H + 40], [hx + 210, hy + 110], [hx + 120, hy + 40], [hx + 150, hy - 20], [hx + 290, hy + 30], [W + 80, H - 140]], true);
  paint(c, sleeve, HOODIE, { shade: HOODIE_S, sd: 22, hi: "#7e8f8a", hd: 8, line: 7, seed: 850 });
  const hand = sm([[hx + 140, hy - 10], [hx + 60, hy - 30], [hx - 10, hy - 54], [hx - 30, hy - 46], [hx - 6, hy - 26], [hx - 40, hy - 18], [hx - 46, hy - 4], [hx - 4, hy + 2], [hx - 30, hy + 18], [hx - 20, hy + 30], [hx + 30, hy + 26], [hx + 110, hy + 56]], true, 4);
  paint(c, hand, SKIN, { shade: SKIN_S, sd: 16, hi: "#e6b88d", hd: 6, line: 6, seed: 851 });
  stroke(c, sm([[hx + 40, hy - 12], [hx + 10, hy - 16]]), 3, SKIN_S, { seed: 852 });
  c.restore();
  lyric(c, ["Jise", "paanaa", "tha,"], l, [0.1, 0.5, 1.0], W / 2, 170, 74);
  lyric(c, ["use", "kho", "baithe"], l, [2.2, 2.7, 3.3], W / 2, 1000, 74, LAMP_L);
};
// 27 - 30.7  "Ye kaafi nahin hai kya?": back in the room; the bottle is empty; the other side is still empty
const sceneReturn = (c: Ctx, env: Env, t: number) => {
  const l = t - 27, z = lerp(1.9, 1.0, ease(span(l, 0, 2.4))), f = lp([830, 640], [W / 2, H / 2], ease(span(l, 0, 2.4)));
  camera(c, env, z, f);
  room(c, { ...ROOM0, t, bottle: 0, moon: 1, rain: 0.35, glassDown: 1, slump: 1 });
  flat(c, env);
  const v = c.createRadialGradient(W / 2, H / 2, 400, W / 2, H / 2, 1200); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, `rgba(5,8,20,${0.4 + 0.3 * span(l, 2.5, 3.7)})`); c.fillStyle = v; c.fillRect(0, 0, W, H);
  lyric(c, ["Ye", "kaafi", "nahin", "hai", "kya?"], l, [0.3, 0.7, 1.2, 1.6, 2.0], W / 2, 170, 78);
};

const SCENES: [number, number, (c: Ctx, env: Env, t: number) => void][] = [
  [0, 2.3, sceneDrink], [2.3, 4.8, sceneDrop], [4.8, 7.5, sceneBandage], [7.5, 10, sceneMoon], [10, 15, sceneEmbrace],
  [15, 20, sceneShadows], [20, 22.5, sceneThread], [22.5, 27, sceneCorridor], [27, 30.7, sceneReturn],
];

const draw = (ctx: Ctx, local: number, env: Env) => {
  const t = local / FPS, [, , fn] = SCENES.find(([a, b]) => t >= a && t < b) ?? SCENES[SCENES.length - 1];
  flat(ctx, env); ctx.fillStyle = NAVY; ctx.fillRect(0, 0, W, H);
  ctx.save(); flat(ctx, env); trace(ctx, STAGE); ctx.clip();
  fn(ctx, env, t);
  ctx.restore();
  flat(ctx, env); border(ctx, t);
  paperGrain(ctx, env);
};

export const paaro: Film = {
  meta: { title: "paaro", W, H, fps: FPS, bpm: 70, durationFrames: DURATION },
  assets: { images: {} },
  shots: [{ id: "paaro", start: 0, end: DURATION, draw }],
};
