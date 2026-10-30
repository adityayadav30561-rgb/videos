import { Gfx, type Ctx, type Env, type P } from "./core";
import type { Film } from "./film";
import { clamp, inside } from "./gallery";
import { weave } from "./paintedOilKit";
import {
  W, H, CX, OIL_M, LILY_C, GOLD, CRIMSON, TURQ, ROSE, INDIGO, BULLA, NAINA, ramp, rng, st, lay, stage, glossyWord, handLine, sparkle, paintForm,
  contour, objCol, pillowN, sphereN, tangentDir, along, rot, ellipse, thin, edgeDist, woundPoly, paintWound, paintEye, lilyPetals, paintLily,
  lilyDrawing, paintDrop, globeIris, paintStar, heartPt, heartDrawing, PLASTER_AT, PLASTER, type Glossy,
} from "./nainaFrames";

// NAINA · the lyric film · oil on canvas, vertical 9:16, rose and indigo, 12 fps.
//
// THE STORY, in the person's own flow: one picture becomes the next, almost never a cut. बल्लाह pops in,
// holds, squashes flat into a wound; a band-aid slides over the wound and its centre line opens into an
// eye; the band-aid falls away, the wound's line curls round into the outline of a lily while the eye
// rises, the eye bleeds a tear of red that floods the lily; the eye closes and leaves one drop of dew,
// which falls onto a petal; the drop swells into a dark disc that eclipses the lily and lands its
// continents to become the world; an eye is drawn round the world so it becomes an iris; the eye
// blinks shut and its lower lid is left as a smile, which curls on round into a heart that fills red;
// the heart splits into two eyes; their irises drop out, the eyes close and pop open as two blushing
// stars; the camera dives into the stars, whose arms sweep out as a striped curtain from the corners;
// on the empty stage the sargam syllables pop one to a beat, ending on सा.
// THE TOKEN that returns: तेरे नैना, the glossy sticker, popping in three times.
// TIMING: every cue is a frame number taken from the person's reference video, whose pictures are
// already cut to this song (its own audio is the soundtrack); the song's onsets were measured and
// match them (zakhm 39, band-aid 45, the eye 55-57, phool pe 68, shabnam 76, jag 99, the eye 113,
// dil 130, the two eyes 144, taare 174-179, the curtain 189, the sargam from 194).
// MOTION GRAMMAR (the person's): 12 fps and steppy, like hand animation; something changes about every
// half second; lines draw themselves on, fills land as solid colour, hook lettering pops with a
// squash-and-stretch bounce and stays; lyric lines arrive word by word with the singing. Held things
// "boil" on twos (a hand-redrawn jitter), so no frame is ever a dead hold.
// HOW IT IS MADE: every finished picture (the stage, each sticker, the wound, the band-aid, the eye,
// the lily, the globe, the heart, the eyes, the stars, the curtain, each sargam syllable) is painted
// once in oil onto its own layer and cached; a frame lays those layers down moved, popped, squashed or
// scaled, and paints only the in-between states live (a line morphing, a lid opening, red bleeding in).
// The cache is keyed only by what is painted, so a frame is the same pixels in any render order.

const N = 229; // the song: 19.18 s at 12 fps

// ---------------------------------------------------------------- sprites: a picture painted once, laid down many times
const SPRITES_KEPT = 8;
type M = { px?: number; py?: number; sx?: number; sy?: number; rot?: number; skew?: number; dx?: number; dy?: number; alpha?: number; clip?: [number, number, number, number]; circle?: [number, number, number] };
const sprite = (g: Gfx, key: string, paint: (lg: Gfx) => void, m: M = {}) => {
  const e = g.env, DW = Math.round(e.W * e.scale), DH = Math.round(e.H * e.scale), k = `naina:sprite:${key}:${DW}x${DH}`;
  let L = e.cache.get(k) as { canvas: unknown; ctx: CanvasRenderingContext2D } | undefined;
  // full-frame layers are heavy: keep only the most recently used few. An evicted sprite is simply
  // painted again when it is next needed, the same pixels, so eviction never changes a frame
  const lru = (e.cache.get("naina:lru") as string[] | undefined) ?? []; e.cache.set("naina:lru", lru);
  const at = lru.indexOf(k); if (at >= 0) lru.splice(at, 1); lru.push(k);
  if (!L) {
    while (lru.length > SPRITES_KEPT) { const old = lru.shift()!, o = e.cache.get(old) as { canvas: { width: number; height: number } } | undefined; if (o) { o.canvas.width = 1; o.canvas.height = 1; } e.cache.delete(old); }
    L = e.canvas(DW, DH) as unknown as { canvas: unknown; ctx: CanvasRenderingContext2D }; L.ctx.setTransform(e.scale, 0, 0, e.scale, 0, 0); paint(new Gfx(L.ctx as unknown as Ctx, e, 0, OIL_M)); e.cache.set(k, L);
  }
  if ((m.alpha ?? 1) <= 0.001) return;
  const c = g.cur, px = m.px ?? CX, py = m.py ?? H / 2; c.save(); c.setTransform(e.scale, 0, 0, e.scale, 0, 0); c.globalAlpha = m.alpha ?? 1;
  c.translate(px + (m.dx ?? 0), py + (m.dy ?? 0)); c.rotate(m.rot ?? 0); c.transform(1, 0, m.skew ?? 0, 1, 0, 0); c.scale(m.sx ?? 1, m.sy ?? 1); c.translate(-px, -py);
  if (m.clip) { c.beginPath(); c.rect(m.clip[0], m.clip[1], m.clip[2] - m.clip[0], m.clip[3] - m.clip[1]); c.clip(); }
  if (m.circle) { c.beginPath(); c.arc(m.circle[0], m.circle[1], m.circle[2], 0, Math.PI * 2); c.clip(); }
  c.drawImage(L.canvas as CanvasImageSource, 0, 0, W, H); c.restore();
};
// the pop: in squashed small, stretched up past full, squashed down, a little over, settled (one drawing a frame)
const POP: [number, number][] = [[0.3, 0.26], [1.1, 1.3], [1.14, 0.86], [0.97, 1.05], [1, 1]];
const pop = (f: number, f0: number): [number, number] | null => (f < f0 ? null : POP[Math.min(POP.length - 1, f - f0)]);
const PULSE: [number, number][] = [[1.1, 1.14], [1.06, 0.92], [0.99, 1.03], [1, 1]];
// boil on twos: a held picture redrawn by hand every other frame never sits in exactly the same place
const boil = (f: number, s: number) => { const r = rng(s * 97 + Math.floor(f / 2) * 13); return { dx: (r() - 0.5) * 3.2, dy: (r() - 0.5) * 3.2, rot: (r() - 0.5) * 0.012 }; };
const step = (f: number, f0: number, vals: number[]) => vals[clamp(f - f0, 0, vals.length - 1)];

// ---------------------------------------------------------------- the pictures
const STAGE = (lg: Gfx) => stage(lg, 1);
const sticker = (o: Omit<Glossy, "x" | "y" | "size" | "seed">, x: number, y: number, size: number, seed: number, tilt = 0) => (lg: Gfx) => glossyWord(lg, { ...o, x, y, size, seed, tilt });
const WOUND_C: P = [CX, 1000], WOUND = woundPoly(WOUND_C[0], WOUND_C[1], 820, 70, -0.5);
const woundLine = (frac = 1): P[] => rot(Array.from({ length: 120 }, (_, i) => { const t = 0.5 + (i / 119 - 0.5) * frac; return [WOUND_C[0] + (t - 0.5) * 820, WOUND_C[1] + Math.sin(t * Math.PI * 2.2) * 820 * 0.07] as P; }), WOUND_C[0], WOUND_C[1], -0.5);
const PLASTER_POLY = rot([...ellipse(CX - 230, PLASTER_AT[1], 120, 120, 20, Math.PI / 2, Math.PI * 1.5), ...ellipse(CX + 230, PLASTER_AT[1], 120, 120, 20, -Math.PI / 2, Math.PI / 2)], CX, PLASTER_AT[1], -0.3);
const PLASTER_S = (lg: Gfx) => {
  paintForm(lg, PLASTER_POLY, objCol(PLASTER, pillowN(PLASTER_POLY, 36), 1.08), 14, along(-0.3), 300); contour(lg, PLASTER_POLY, "#5a3a1e", 3.5, 330);
  const r = rng(331); for (let i = 0; i < 26; i++) { const sx = i < 13 ? -1 : 1, x = CX + sx * (180 + r() * 120), y = PLASTER_AT[1] + (r() - 0.5) * 160, [px, py] = rot([[x, y]], CX, PLASTER_AT[1], -0.3)[0]; if (inside(PLASTER_POLY, px, py) && edgeDist(PLASTER_POLY, px, py) > 16) lay(lg, [st([[px, py], [px + 2, py + 1]], 9, "#a87e54", 340 + i, { impasto: 0.15, dry: 0.1 })]); }
};
const EYE_A: P = [CX, PLASTER_AT[1] - 8], EYE_UP = 640 - EYE_A[1]; // the eye in the band-aid, and how far it rises over the lily
// the lily's outline as ONE closed line (the envelope of its six tepals), so the wound's line can curl into it
const LILY_LOOP: P[] = (() => { const { pets } = lilyPetals(), out: P[] = []; for (let i = 0; i < 120; i++) { const a = 2.62 + (i / 119) * Math.PI * 2; let r = 440; while (r > 10 && !pets.some((p) => inside(p, LILY_C[0] + Math.cos(a) * r, LILY_C[1] + Math.sin(a) * r))) r -= 3; out.push([LILY_C[0] + Math.cos(a) * r, LILY_C[1] + Math.sin(a) * r]); } return out; })();
const morphLine = (g: Gfx, A: P[], B: P[], t: number, w: number, seed: number) => { const pts = A.map((p, i) => [p[0] + (B[i][0] - p[0]) * t, p[1] + (B[i][1] - p[1]) * t] as P); lay(g, [st(thin(pts, 44), w, "#6a0812", seed, { c1: "#3a0408", impasto: 0.3, dry: 0.04, load: 1.3, jit: 0.02 })]); };
const DROP_R = 52, DROP_ON: P = [LILY_C[0] + 175, LILY_C[1] + 110], GLOBE_C: P = [CX, 1010], GLOBE_R = 200;
// light on a normal, from the upper left (the frames' one light)
const litN = (n: [number, number, number]) => Math.max(0, (-0.55 * n[0] - 0.7 * n[1] + 0.55 * n[2]) / 1.046);
const DISC = (lg: Gfx) => { const p = ellipse(GLOBE_C[0], GLOBE_C[1], GLOBE_R, GLOBE_R, 60), n = sphereN(GLOBE_C[0], GLOBE_C[1], GLOBE_R); paintForm(lg, p, (x, y) => ramp(INDIGO, 0.12 + 0.55 * litN(n(x, y))), 12, tangentDir(GLOBE_C[0], GLOBE_C[1]), 860, true); contour(lg, p, "#05061a", 5, 865); };
const EYE_W = 900, EYE_HH = (EYE_W / 2) * 0.42;
const lidPts = (lower: boolean): P[] => Array.from({ length: 120 }, (_, i) => { const t = i / 119, x = GLOBE_C[0] - EYE_W / 2 + EYE_W * t, s = Math.sin(Math.PI * t); return [x, lower ? GLOBE_C[1] + EYE_HH * 0.75 * Math.pow(s, 1.1) : GLOBE_C[1] - EYE_HH * Math.pow(s, 0.8) * (1 + 0.15 * (t - 0.5))] as P; });
const UPPER = lidPts(false), LOWER = lidPts(true);
// the world turns only while it sits still: from when its land starts landing until the blink ends
const spinAt = (f: number) => (f < 98 ? 0 : (f - 98) * 0.12);
const globeEye = (g: Gfx, f: number, open: number) => paintEye(g, GLOBE_C[0], GLOBE_C[1], EYE_W, open, (gg, cx, cy, r) => globeIris(gg, cx, cy, r, 4, spinAt(f)), 500);
const HEART_C: P = [CX, 1000], HEART_S = 21;
const heartLine = (frac: number): P[] => Array.from({ length: 120 }, (_, i) => heartPt(Math.PI - Math.PI * 2 * frac * (i / 119), HEART_C[0], HEART_C[1], HEART_S));
const EYES: [P, P] = [[330, 1000], [750, 1000]], EYES_W = 360;
const noIris = () => undefined;
const IRIS_R = (EYES_W / 2) * 0.42 * 0.95;
const STARS: [P, P] = [[CX - 200, 1020], [CX + 200, 1030]];
// the curtain from one corner, painted big enough to cover the whole card, laid down smaller as it sweeps back
const CURTAIN_R = 1260;
const CURTAIN = (corner: P, seed: number) => (lg: Gfx) => {
  const band = 84, col = (x: number, y: number) => { const d = Math.hypot(x - corner[0], y - corner[1]), k = Math.floor(d / band), f = (d % band) / band; return ramp(k % 2 ? GOLD : CRIMSON, 0.22 + 0.62 * Math.sin(Math.PI * f) * (1 - 0.3 * d / CURTAIN_R)); };
  // the quarter of the circle that lies over the sheet: its arc points pulled onto the sheet's edges
  const region: P[] = [corner, ...ellipse(corner[0], corner[1], CURTAIN_R, CURTAIN_R, 160).map(([x, y]) => [clamp(x, -30, W + 30), clamp(y, -30, H + 30)] as P)];
  paintForm(lg, region, col, 30, tangentDir(corner[0], corner[1]), seed, true);
  const lines = []; for (let d = band; d < CURTAIN_R - 10; d += band) lines.push(st(ellipse(corner[0], corner[1], d, d, 90).filter(([x, y]) => x > -60 && x < W + 60 && y > -60 && y < H + 60), 5, "#fde8c0", seed + d, { impasto: 0.5, dry: 0.1 }));
  lay(lg, lines, [region]);
  lay(lg, [st(ellipse(corner[0], corner[1], CURTAIN_R - 8, CURTAIN_R - 8, 120).filter(([x, y]) => x > -60 && x < W + 60 && y > -60 && y < H + 60), 18, "#1a0408", seed + 99, { impasto: 0.1, dry: 0.2 })]);
};
const CORNERS: P[] = [[-40, -40], [W + 40, -40], [-40, H + 40], [W + 40, H + 40]];
// sargam: each syllable a sticker of its own colour, the way the reference changes colour on every note
const SARGAM: [number, string, string[], string][] = [
  [193, "पा", INDIGO, "#c8ccf4"], [195, "नी", CRIMSON, "#ffd8d0"], [197, "सा", GOLD, "#fff6d0"], [199, "नी", TURQ, "#e0fff8"], [201, "सा", ROSE, "#fff0ee"], [202, "नी", CRIMSON, "#ffd8d0"],
  [204, "धा", GOLD, "#fff6d0"], [206, "पा", TURQ, "#e0fff8"], [208, "नी", ROSE, "#fff0ee"], [209, "धा", INDIGO, "#c8ccf4"], [211, "पा", CRIMSON, "#ffd8d0"], [213, "मा", TURQ, "#e0fff8"],
  [215, "गा", GOLD, "#fff6d0"], [217, "रे", INDIGO, "#c8ccf4"], [219, "सा", CRIMSON, "#ffd8d0"],
];
const sargamSprite = (i: number) => { const [, text, face, rim] = SARGAM[i]; return sticker({ text, face, rim, body: "#14081e", outline: "#07081e" }, CX, 980, 330, 900 + i * 7); };

// ---------------------------------------------------------------- lyric lines: word by word, each word written on over two frames
const KALAM = (size: number) => `${size}px "KalamB"`;
const textW = (g: Gfx, t: string, size: number) => { const c = g.cur; c.save(); c.font = KALAM(size); const w = c.measureText(t).width; c.restore(); return w; };
const writeWords = (g: Gfx, f: number, words: [number, string][], x: number, y: number, size: number, color: string) => {
  const shown = words.filter(([f0]) => f >= f0); if (!shown.length) return;
  const full = words.map(([, w]) => w).join(" "), left = x - textW(g, full, size) / 2, now = shown.map(([, w]) => w).join(" "), before = shown.slice(0, -1).map(([, w]) => w).join(" ");
  const frac = Math.min(1, (f - shown[shown.length - 1][0] + 1) / 2), wb = before ? textW(g, before + " ", size) : 0, wn = textW(g, now, size), c = g.cur;
  c.save(); c.beginPath(); c.rect(left - 30, y - size * 1.2, wb + (wn - wb) * frac + 40, size * 2.4); c.clip(); handLine(g, now, left, y, size, color, { align: "left" }); c.restore();
};
const word = (g: Gfx, f: number, f0: number, f1: number, text: string, x: number, y: number, size: number, color: string) => { if (f >= f0 && f < f1) writeWords(g, f, [[f0, text]], x, y, size, color); };

// ---------------------------------------------------------------- the frame
const frame = (g: Gfx, f: number) => {
  sprite(g, "stage", STAGE);

  // 1. बल्लाह: zooms in from a speck, overshoots, settles, holds (boiling, sparkles winking), then
  //    squashes flat and tips back into the wound
  if (f >= 2 && f <= 40) {
    let sx = 1, sy = 1, rotA = 0, skew = 0;
    if (f <= 16) sx = sy = 0.04 * Math.pow(1.1 / 0.04, (f - 2) / 14); else if (f === 17) sx = sy = 0.96;
    else if (f >= 38) { const k = f - 38; sx = [1.08, 1.15, 1.2][k]; sy = [0.78, 0.5, 0.28][k]; rotA = [-0.12, -0.33, -0.42][k]; skew = [0, -0.6, -0.85][k]; }
    const b = f >= 18 && f < 38 ? boil(f, 1) : { dx: 0, dy: 0, rot: 0 };
    if (f >= 39) paintWound(g, woundPoly(WOUND_C[0], WOUND_C[1], 820 * (f === 39 ? 0.45 : 0.8), 70 * (f === 39 ? 0.6 : 0.9), -0.5), 200);
    sprite(g, "bulla", sticker(BULLA, CX, 940, 250, 11, -0.05), { px: CX, py: 940, sx, sy, rot: rotA + b.rot, skew, dx: b.dx, dy: b.dy + (f >= 38 ? [10, 40, 60][f - 38] : 0) });
    if (f >= 18 && f < 38) [[230, 790, 30], [860, 820, 22], [820, 1080, 26], [270, 1060, 18]].forEach(([x, y, r], i) => { if ((Math.floor(f / 2) + i) % 3 !== 0) sparkle(g, x, y, r * (0.8 + 0.25 * ((f + i) % 2)), 30 + i); });
  }
  // 2. the wound, and "ज़ख़्म पे मरहम" one word at a time
  if (f >= 41 && f <= 60) sprite(g, "wound", (lg) => paintWound(lg, WOUND, 200));
  word(g, f, 39, 42, "ज़ख़्म", CX, 470, 120, "#1b2160"); word(g, f, 42, 44, "पे", CX, 470, 120, "#1b2160"); word(g, f, 44, 61, "मरहम", CX, 470, 120, "#1b2160");
  // 3. the band-aid slides in from the right and lands; its centre line draws across; the line opens into an eye
  if (f >= 45 && f <= 63) {
    const dx = f <= 49 ? [700, 300, 60, -20, 0][f - 45] : 0, r0 = f <= 49 ? [0.14, 0.06, 0.01, -0.01, 0][f - 45] : 0;
    const fall = f >= 60 ? { dy: [60, 220, 520, 1100][f - 60], rot: [-0.08, -0.26, -0.55, -0.9][f - 60] } : { dy: 0, rot: 0 }, b = f > 49 && f < 60 ? boil(f, 3) : { dx: 0, dy: 0, rot: 0 };
    sprite(g, "plaster", PLASTER_S, { px: CX, py: PLASTER_AT[1], dx: dx + b.dx, dy: fall.dy + b.dy, rot: r0 + fall.rot + b.rot });
    if (f >= 47 && f <= 52) { const k = step(f, 47, [0.4, 0.8, 1]); lay(g, [st([[EYE_A[0] - 150 * k, EYE_A[1]], [EYE_A[0], EYE_A[1] + 1], [EYE_A[0] + 150 * k, EYE_A[1]]], 6, "#3a1a10", 450, { impasto: 0.2, dry: 0.05, load: 1.2 })]); }
    if (f >= 53 && f <= 55) paintEye(g, EYE_A[0], EYE_A[1], 300, [0.15, 0.4, 0.7][f - 53], null, 360);
  }
  // 4. the eye: opened in the band-aid, it rises as the band-aid falls away, then closes over the lily
  if (f >= 56 && f <= 73) { const up = f < 60 ? 0 : step(f, 60, [-20, -70, -130, -180, -220, -245, -252]), b = f >= 66 ? boil(f, 5) : { dx: 0, dy: 0, rot: 0 }; sprite(g, "eyeA", (lg) => paintEye(lg, EYE_A[0], EYE_A[1], 300, 1, null, 360), { dy: up + b.dy, dx: b.dx }); }
  // 5. the wound's line curls round into the lily's outline; the tepals are drawn; red bleeds out of the
  //    eye's tear into the flower and the fill lands
  if (f === 60) sprite(g, "wound", (lg) => paintWound(lg, WOUND, 200));
  if (f >= 61 && f <= 66) morphLine(g, woundLine(), LILY_LOOP, [0.12, 0.3, 0.5, 0.7, 0.88, 1][f - 61], 9, 470 + f);
  if (f >= 67 && f <= 69) {
    sprite(g, "lily", (lg) => paintLily(lg, 400), { circle: [LILY_C[0], LILY_C[1], [110, 220, 320][f - 67]] });
    const { pets } = lilyPetals(); lay(g, pets.map((pt, i) => st(thin([...pt, pt[0]], 20), 7, "#5a0610", 410 + i, { c1: "#8a0e18", impasto: 0.25, dry: 0.1, load: 1.2 })));
  }
  if (f >= 66 && f <= 69) { const k = step(f, 66, [0.4, 0.8, 1, 1]); lay(g, [st([[CX + 6, 700], [CX + 2, 700 + 140 * k], [CX, 700 + 290 * k]], 11, "#a3191c", 471, { c1: "#760f14", impasto: 0.4, dry: 0.3 })]); }
  if (f >= 70 && f <= 97) { const b = boil(f, 7); sprite(g, "lily", (lg) => paintLily(lg, 400), { px: LILY_C[0], py: LILY_C[1], dx: b.dx, dy: b.dy, rot: b.rot, alpha: f < 92 ? 1 : step(f, 92, [0.8, 0.6, 0.4, 0.22, 0.08, 0]) }); }
  // the eye over the lily closes; a single drop of dew is left, and falls onto a petal
  if (f >= 74 && f <= 76) paintEye(g, CX, 640, 300, [0.6, 0.3, 0.08][f - 74], null, 360);
  if (f >= 77 && f <= 87) { const t = step(f, 77, [0, 0, 0.12, 0.35, 0.65, 0.92, 1.04, 1]); const x = CX + (DROP_ON[0] - CX) * t, y = 650 + (DROP_ON[1] - 650) * t - Math.sin(Math.PI * clamp(t)) * 60; paintDrop(g, x, y, f === 77 ? 30 : DROP_R, 480); }
  word(g, f, 68, 96, "फूल पे", 270, 1460, 92, "#8a0e22"); word(g, f, 76, 96, "शबनम", 800, 1460, 92, "#8a0e22");
  // 6. the drop swells into a dark disc that eclipses the lily, and becomes the world, its land landing piece by piece
  if (f >= 88 && f <= 95) { const t = (f - 88) / 7, r = DROP_R + (GLOBE_R - DROP_R) * Math.pow(t, 1.4), x = DROP_ON[0] + (GLOBE_C[0] - DROP_ON[0]) * t, y = DROP_ON[1] + (GLOBE_C[1] - DROP_ON[1]) * t; sprite(g, "disc", DISC, { px: GLOBE_C[0], py: GLOBE_C[1], sx: r / GLOBE_R, sy: r / GLOBE_R, dx: x - GLOBE_C[0], dy: y - GLOBE_C[1] }); }
  if (f >= 96 && f <= 111) { const n = f < 98 ? 0 : f < 99 ? 1 : f < 101 ? 2 : f < 103 ? 3 : 4, s = f < 108 ? 1 : step(f, 108, [0.97, 0.94, 0.92, 0.9]), b = boil(f, 9); void b; globeIris(g, GLOBE_C[0], GLOBE_C[1] + (f >= 108 ? 11 * (1 - (s - 0.9) * 10) : 0), GLOBE_R * s, n, spinAt(f)); }
  if (f >= 97 && f <= 111) { const ws: [number, string][] = [[97, "जग"], [100, "भूले"], [103, "भूले"]]; ws.forEach(([f0, w], i) => { if (f >= f0) { const a = -Math.PI * 0.78 + (Math.PI * 0.56 * i) / 2; handLine(g, w, GLOBE_C[0] + Math.cos(a) * (GLOBE_R + 52), GLOBE_C[1] + Math.sin(a) * (GLOBE_R + 52), 80, "#0b6670", { tilt: a + Math.PI / 2 }); } }); }
  // 7. an eye is drawn round the world: the upper lid, the lashes, the lower lid; the white lands; the world is its iris
  if (f >= 104 && f <= 111) {
    const ku = step(f, 104, [0.2, 0.4, 0.6, 0.8, 1]), kl = f < 106 ? 0 : step(f, 106, [0.3, 0.6, 0.85, 1]);
    lay(g, [st(thin(UPPER.slice(0, Math.max(3, Math.round(119 * ku))), 16), 8, "#140806", 520, { impasto: 0.25, dry: 0.06, load: 1.25 })]);
    if (kl > 0) lay(g, [st(thin(LOWER.slice(Math.round(119 * (1 - kl))).reverse(), 14), 5, "#3a1a10", 521, { impasto: 0.15, dry: 0.15 })]);
    const nl = f < 109 ? 0 : (f - 108) * 4; for (let i = 0; i < Math.min(13, nl); i++) { const p = UPPER[Math.round((0.3 + i * 0.052) * 119)], L = 34 + i * 4.5, a = -Math.PI / 2 - 0.35 + i * 0.1; lay(g, [st([p, [p[0] + Math.cos(a) * L * 0.55, p[1] + Math.sin(a) * L * 0.55], [p[0] + Math.cos(a + 0.75) * L, p[1] + Math.sin(a + 0.75) * L * 0.95]], 6, "#100604", 530 + i, { impasto: 0.2, dry: 0.15, load: 1.2 })]); }
  }
  if (f >= 112 && f <= 119) globeEye(g, f, 1);
  // 8. the eye blinks shut; its lower lid is left as a smile; the smile curls on round into a heart
  if (f >= 120 && f <= 125) globeEye(g, f, [0.7, 0.7, 0.4, 0.4, 0.15, 0.15][f - 120]);
  if (f >= 126 && f <= 127) { const smile = LOWER.map(([x, y]) => [x, y - 10] as P); morphLine(g, smile, heartLine(0.35), f === 126 ? 0.3 : 0.65, 10, 560 + f); }
  if (f >= 128 && f <= 134) heartDrawing(g, HEART_C[0], HEART_C[1], HEART_S, step(f, 128, [0.35, 0.55, 0.75, 0.9, 1, 1, 1]), step(f, 128, [0, 0, 0, 0, 0, 150, 270]), 600);
  if (f >= 135 && f <= 139) { const b = boil(f, 13); sprite(g, "heart", (lg) => heartDrawing(lg, HEART_C[0], HEART_C[1], HEART_S, 1, 420, 600), { px: HEART_C[0], py: HEART_C[1], dx: b.dx, dy: b.dy, rot: b.rot }); }
  word(g, f, 128, 144, "दिल", 380, 520, 110, "#4a1238"); word(g, f, 130, 144, "छूलें", 640, 520, 110, "#4a1238"); word(g, f, 136, 144, "छूलें", CX, 650, 96, "#4a1238");
  // 9. the heart splits down the middle into two halves that fly apart and flatten into two almond eyes
  if (f >= 140 && f <= 143) { const k = [0.25, 0.5, 0.8, 1][f - 140]; [-1, 1].forEach((s) => sprite(g, "heart", (lg) => heartDrawing(lg, HEART_C[0], HEART_C[1], HEART_S, 1, 420, 600), { px: HEART_C[0], py: HEART_C[1], dx: s * 200 * k, rot: s * 0.5 * k, sy: 1 - 0.55 * k, clip: s < 0 ? [0, 0, HEART_C[0], H] : [HEART_C[0], 0, W, H] })); }
  if (f >= 144 && f <= 175) {
    const open = f < 146 ? [0.4, 0.75][f - 144] : f >= 172 ? [0.6, 0.3, 0.1, 0.02][f - 172] : 1, b = f >= 146 && f < 172 ? boil(f, 15) : { dx: 0, dy: 0, rot: 0 };
    sprite(g, f >= 146 && f < 172 ? "twoEyes" : "almonds", (lg) => EYES.forEach(([x, y], i) => paintEye(lg, x, y, EYES_W, 1, f >= 146 && f < 172 ? null : noIris, 700 + i * 40)), { px: CX, py: EYES[0][1], sy: open, dx: b.dx, dy: b.dy });
    // the irises drop out of the closing eyes and fall away
    if (f >= 172) EYES.forEach(([x, y], i) => { const dy = [20, 120, 300, 560][f - 172], cy = y + 8 + dy, d = ellipse(x, cy, IRIS_R, IRIS_R, 28), n = sphereN(x, cy, IRIS_R); paintForm(g, d, (px, py) => ramp(TURQ, 0.1 + 0.6 * litN(n(px, py))), 6, tangentDir(x, cy), 750 + i + f * 3, true); lay(g, [st(ellipse(x, cy, IRIS_R * 0.42, IRIS_R * 0.42, 14).concat([[x + IRIS_R * 0.42, cy]]), IRIS_R * 0.36, "#080302", 760 + i + f * 3, { impasto: 0.1, dry: 0.05 })]); });
  }
  // 10. two stars pop where the eyes were, and blush
  if (f >= 176 && f <= 190) STARS.forEach(([x, y], i) => {
    const p = pop(f, 176) ?? [1, 1], dive = f >= 189 ? [1.7, 3.3][f - 189] : 1, b = f > 180 && f < 189 ? boil(f, 17 + i) : { dx: 0, dy: 0, rot: 0 }, blush = f < 182 ? 0 : step(f, 182, [0.35, 0.35, 0.7, 0.7, 1]);
    const m = f >= 189 ? { px: CX, py: 1025, sx: dive, sy: dive } : { px: x, py: y, sx: p[0], sy: p[1], dx: b.dx, dy: b.dy, rot: b.rot };
    sprite(g, `star${i}`, (lg) => paintStar(lg, x, y, 220, 700 + i * 20, i ? 0.1 : -0.12, 0), m);
    if (blush > 0) sprite(g, `star${i}b`, (lg) => paintStar(lg, x, y, 220, 700 + i * 20, i ? 0.1 : -0.12, 1), { ...m, alpha: blush });
  });
  if (f < 189) { writeWords(g, f, [[152, "तेरे"], [156, "नैनों"], [160, "के"], [164, "आगे"]], CX, 640, 88, "#8a0e22"); writeWords(g, f, [[172, "ते"], [176, "तारे"], [178, "भी"], [180, "शरमाएँ"]], CX, 1440, 84, "#8a0e22"); }
  // 11. the dive: the stars' arms sweep back to the corners as a striped curtain, leaving the stage empty
  if (f >= 191 && f <= 194) { const s = [1, 0.62, 0.38, 0.2][f - 191]; CORNERS.forEach((c, i) => sprite(g, `curtain${i}`, CURTAIN(c, 800 + i * 50), { px: c[0], py: c[1], sx: s, sy: s })); }

  // the token: तेरे नैना pops in three times and stays
  const naina = (f0: number, f1: number, dy: number, pulse = -1) => {
    if (f < f0 || f > f1) return; let [sx, sy] = pop(f, f0) ?? [1, 1]; if (pulse > 0 && f >= pulse && f < pulse + PULSE.length) [sx, sy] = PULSE[f - pulse];
    if (f >= f1 - 1) { const k = f - (f1 - 1); sx = sy = [0.6, 0.18][k]; }
    const b = f >= f0 + 5 ? boil(f, 19) : { dx: 0, dy: 0, rot: 0 }; sprite(g, "naina", sticker(NAINA, CX, 1600, 170, 41, -0.04), { px: CX, py: 1600, sx, sy, dx: b.dx, dy: dy + b.dy, rot: b.rot });
    if (f >= f0 + 4 && Math.floor(f / 3) % 2 === 0) { sparkle(g, 300, 1520 + dy, 18, 50); sparkle(g, 800, 1660 + dy, 14, 51); }
  };
  naina(56, 97, 0, 84); naina(114, 127, -40); naina(148, 171, -140);

  // 12. the sargam, one syllable to a beat, popping on the empty stage; the last सा stays and sparkles
  SARGAM.forEach(([f0], i) => {
    const last = i === SARGAM.length - 1, on = last ? f >= f0 : f === f0;
    if (!on) return; const p = last ? pop(f, f0) ?? [1, 1] : [1.08, 1.08]; const b = last && f > f0 + 4 ? boil(f, 23) : { dx: 0, dy: 0, rot: 0 };
    sprite(g, `sargam${i}`, sargamSprite(i), { px: CX, py: 980, sx: p[0], sy: p[1], dx: b.dx, dy: b.dy, rot: b.rot });
    if (last && f > f0 + 3) [[370, 820, 22], [740, 1150, 18], [760, 840, 14]].forEach(([x, y, r], k) => { if ((Math.floor(f / 2) + k) % 2 === 0) sparkle(g, x, y, r, 60 + k); });
  });
};

export const naina: Film = {
  meta: { title: "Naina · a lyric film in oil", W, H, fps: 12, bpm: 120, durationFrames: N, raster: "cpu" },
  assets: { images: {} },
  shots: [{ id: "film", start: 0, end: N, draw: (ctx: Ctx, f: number, env: Env) => { const g = new Gfx(ctx, env, f, OIL_M); frame(g, f); weave(g, 0.28); } }],
};
