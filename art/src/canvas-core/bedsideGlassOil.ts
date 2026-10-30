import { Gfx, rng, fractal, type Ctx, type Env, type Medium, type P } from "./core";
import type { Film } from "./film";
import { clamp, inside, mix } from "./gallery";
import { fill, oilStroke, weave, type OStroke } from "./paintedOilKit";

// THE GLASS AT THE BEDSIDE · oil on canvas.
//
// IDEA: late at night a young man (about twenty) sits on the floor against the side of his bed, head
// hung over a half-full glass of something dark; one small lamp on the nightstand is the only light
// in the room. FOCAL SUBJECT: the bowed head and the hand round the glass, the two places the lamp
// lands hardest. One light, warm, low, left: a point light, so everything falls off with distance
// from it and every form turns from warm light through a half tone into an umber shadow.
// MEDIUM (paintedOil's recipe): oil on linen toned with a sienna-umber rub; hog-bristle flats; dark
// masses blocked in lean with a big brush, then mid tones, then the lights in fatter paint with a
// smaller brush, impasto on the brightest things (the shade, the glints on the glass), the last dark
// accents. Edges found on the lit side, lost into the dark on the shadow side.
// REFERENCE (from knowledge): Georges de La Tour's candlelit figures (the Magdalene with the smoking
// flame: one light, a bowed head, a white shirt catching it, the room swallowed); Rembrandt's warm
// umber darks; for the figure Loomis's adult canon (7.5 heads, head here 132 px) and Winter's segment
// lengths: upper arm 172, forearm 131, thigh 247, shin 222 (foreshortened, the knee comes toward us).
// POSE: seated on the floor, back rounded against the mattress, knees drawn up; the near forearm
// laid across the near knee, the hand hanging past it with the glass held loosely round its empty
// upper half; the head bowed about 40 degrees, eyes shut, the inner ends of the brows lifted.
// CLOTHES: a worn off-white T-shirt (it takes the lamp the way de La Tour's linen does), dark jeans,
// grey socks. The blanket a deep wine red, the only strong colour, warm where the lamp reaches it.

const OIL_M: Medium = { nib: 1, taper: 1, pressure: 1, retrace: false, wobble: 0, rough: 0 };
const W = 1080, H = 1080;

// ---------------------------------------------------------------- colour
const ramp = (stops: string[], t: number) => { const f = clamp(t) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(f)); return mix(stops[i], stops[i + 1], f - i); };
const WALL = ["#0b0806", "#17100b", "#2a1c11", "#4a311b", "#7a5228", "#b47f3e", "#e2b46a", "#f6dc9e"];
const WOOD = ["#0a0705", "#1a110a", "#311f11", "#55361b", "#8a5a2c", "#bd8a4c"];
const BLANKET = ["#0b0505", "#200b0a", "#3b1411", "#5e211a", "#8a3626", "#b45a3c", "#d88a5c"];
const LINEN = ["#14100c", "#3a2c1e", "#7a6146", "#b89a72", "#e2c89c", "#f6e6c2"];
const SKIN = ["#1c0f0a", "#3a2116", "#643d29", "#8f603f", "#ba8a64", "#dab08a", "#f2d8b8"];
const SHIRT = ["#17120e", "#342a20", "#5e4e3e", "#8e7a62", "#c2ab88", "#e6d4b2", "#f9efd6"];
const JEANS = ["#07080b", "#10131a", "#1c2230", "#2c3446", "#454c5e", "#6c6c74"];
const HAIR = ["#070504", "#120c08", "#22160e", "#3a2716", "#5e4024", "#8a6038"];
const SOCK = ["#0e0d0c", "#22201d", "#3c3833", "#615a52", "#8c8276"];
const LIQ = ["#060302", "#140805", "#2a1206", "#4a220a", "#7e3e10", "#c0701e", "#eaa848"];
const TONE = "#8a5a36", UMBER = "#3a2414";

// ---------------------------------------------------------------- the light
const LAMP: [number, number, number] = [165, 405, 240];   // the bulb inside the shade; the nightstand stands a little nearer us than he sits
const FLOOR = 962, BED_TOP = (x: number) => 590 - (x - 330) * 0.02;
// light falling on a surface with normal n at (x, y, z): Lambert to the bulb, softened by distance
const lampAt = (x: number, y: number, z: number, n: [number, number, number]) => {
  const lx = LAMP[0] - x, ly = LAMP[1] - y, lz = LAMP[2] - z, d = Math.hypot(lx, ly, lz), k = (n[0] * lx + n[1] * ly + n[2] * lz) / d;
  return Math.max(0, k) * Math.pow(1 / (1 + (d / 700) ** 2), 1.1);
};
// a wall facing us lit by the bulb: a glow round the shade, falling to nothing at the far wall
const wallI = (x: number, y: number) => {
  const d = Math.hypot(x - LAMP[0], (y - LAMP[1]) * 0.95);
  let I = 0.06 + 0.86 * Math.exp(-((d / 330) ** 2)) + 0.12 * Math.exp(-((d / 120) ** 2));
  if (y < 330) { const half = 80 + (330 - y) * 0.5; I += 0.16 * Math.exp(-(((x - LAMP[0]) / half) ** 2)) * clamp((330 - y) / 80); } // the shade throws its light up the wall
  return clamp(I);
};

// ---------------------------------------------------------------- room geometry
const SHADE: P[] = [[112, 330], [218, 330], [262, 468], [68, 468]];
const STAND_TOP: P[] = [[10, 596], [300, 596], [312, 614], [0, 614]];
const STAND_FRONT: P[] = [[0, 614], [312, 614], [312, 962], [0, 962]];
const WALL_R: P[] = [[-40, -40], [W + 40, -40], [W + 40, 600], [-40, 600]];
const BED_R: P[] = [[322, 560], [W + 40, 540], [W + 40, 820], [322, 820]];
const UNDER_R: P[] = [[322, 812], [W + 40, 812], [W + 40, FLOOR + 4], [322, FLOOR + 4]];
const FLOOR_R: P[] = [[-40, FLOOR - 4], [W + 40, FLOOR - 4], [W + 40, H + 40], [-40, H + 40]];

// ---------------------------------------------------------------- the figure
// Each part is an authored outline (where the paint goes) and an axis with radii (how it turns to
// the light): the normal at a point is taken round the nearest point of the axis, so a limb lights
// as a rounded form, brightest on the side toward the lamp, turning into shadow away from it.
type Part = { name: string; out: P[]; axis: P[]; r: number[]; ramp: string[]; w: number; gain?: number; zk?: number };
const near = (axis: P[], x: number, y: number) => {
  let best = { d: 1e9, s: 0, fx: 0, fy: 0, tx: 1, ty: 0 }, acc = 0;
  for (let i = 1; i < axis.length; i++) {
    const [ax, ay] = axis[i - 1], [bx, by] = axis[i], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, t = clamp(((x - ax) * dx + (y - ay) * dy) / (L * L)), fx = ax + dx * t, fy = ay + dy * t, d = Math.hypot(x - fx, y - fy);
    if (d < best.d) best = { d, s: (i - 1 + t) / (axis.length - 1), fx, fy, tx: dx / L, ty: dy / L };
    acc += L;
  }
  return best;
};
const radius = (p: Part, s: number) => { const f = s * (p.r.length - 1), i = Math.min(p.r.length - 2, Math.floor(f)); return p.r[i] + (p.r[i + 1] - p.r[i]) * (f - i); };
const partI = (p: Part, x: number, y: number) => {
  const b = near(p.axis, x, y), r = radius(p, b.s), u = clamp(b.d / r, 0, 0.995), nx = b.d > 0.01 ? (x - b.fx) / b.d : 0, ny = b.d > 0.01 ? (y - b.fy) / b.d : 0, nz = Math.sqrt(1 - u * u);
  const I = lampAt(x, y, nz * r * (p.zk ?? 1), [nx * u, ny * u, nz]) * (p.gain ?? 1.6);
  // warm light thrown back up into the shadow side by the wine blanket behind him
  const bounce = nx > 0.4 ? 0.07 * nx * u : 0;
  return { I: clamp(I), bounce };
};
// Paint in PLANES, as a figure painter does: core shadow, half tone, light, and the top light; each
// plane a mixed colour, joined by strokes that carry one into the next
const PLANES = [0.12, 0.3, 0.52, 0.74, 0.9];
const planeK = (I: number) => (I < 0.1 ? 0 : I < 0.26 ? 1 : I < 0.46 ? 2 : I < 0.7 ? 3 : 4);
const partCol = (p: Part) => (x: number, y: number) => {
  const { I, bounce } = partI(p, x, y), k = planeK(I);
  let c = ramp(p.ramp, PLANES[k] + (fractal(91, x, y, 0.03, 0.03, 1) - 0.5) * 0.05);
  if (bounce > 0.02 && k <= 1) c = mix(c, "#6a2418", Math.min(0.35, bounce * 4));
  return c;
};

// THE HEAD: authored upright, facing left, in a profile three-quarter view, origin at the middle of
// the skull; then bowed forward 40 degrees and set on the neck
const HEAD_AT: P = [640, 620], BOW = (-40 * Math.PI) / 180, HS = 1.5;
const hd = (pts: [number, number][]): P[] => pts.map(([x, y]) => [HEAD_AT[0] + HS * (x * Math.cos(BOW) - y * Math.sin(BOW)), HEAD_AT[1] + HS * (x * Math.sin(BOW) + y * Math.cos(BOW))]);
const HEAD_OUT = hd([[6, -49], [26, -42], [40, -24], [43, -4], [38, 16], [31, 30], [20, 38], [8, 40], [-6, 45], [-20, 47.5], [-30, 45], [-34.5, 40], [-35, 35], [-38, 31.5], [-36.5, 28], [-39.5, 25], [-38.5, 21], [-43, 18.5], [-46.5, 15.5], [-43, 10], [-38, 3.5], [-38.5, -2], [-35.5, -8], [-35, -20], [-27, -36], [-12, -46]]);
const HAIR_OUT = hd([[8, -52], [30, -44], [44, -24], [47, -2], [41, 18], [34, 30], [28, 22], [24, 6], [14, -2], [2, -10], [-10, -14], [-24, -10], [-34, -4], [-41, -6], [-40, -20], [-32, -36], [-14, -50]]);
const EAR = hd([[11, -2], [16, -7], [21.5, -3], [22, 6], [19, 15], [14.5, 21], [10.5, 20], [12, 10]]);
const head: Part = { name: "head", out: HEAD_OUT, axis: hd([[-6, -20], [-6, 24]]), r: [64, 60], ramp: SKIN, w: 13, gain: 1.75, zk: 0.9 };
const hair: Part = { name: "hair", out: HAIR_OUT, axis: hd([[4, -30], [10, 4]]), r: [58, 50], ramp: HAIR, w: 12, gain: 2.2 };
const neck: Part = { name: "neck", out: [[652, 692], [662, 650], [700, 606], [724, 620], [730, 650], [712, 676], [686, 692]], axis: [[690, 616], [688, 684]], r: [40, 40], ramp: SKIN, w: 12, gain: 0.55 }; // under the bowed head, in its shadow
const torso: Part = { name: "torso", out: [[674, 662], [704, 624], [744, 624], [772, 632], [796, 650], [812, 676], [822, 712], [826, 750], [824, 812], [812, 872], [798, 930], [788, 966], [716, 966], [700, 930], [690, 870], [668, 812], [656, 750], [660, 700]], axis: [[724, 660], [770, 760], [768, 880], [752, 950]], r: [70, 84, 80, 70], ramp: SHIRT, w: 26, gain: 1.9 };
const farKnee: Part = { name: "far knee", out: [[552, 712], [576, 690], [612, 690], [646, 712], [632, 736], [590, 728]], axis: [[574, 706], [640, 724]], r: [26, 26], ramp: JEANS, w: 16, gain: 1.4 };
const thigh: Part = { name: "thigh", out: [[540, 724], [552, 702], [586, 698], [628, 714], [682, 756], [734, 808], [780, 860], [800, 912], [790, 966], [700, 966], [650, 912], [612, 860], [588, 812], [570, 770]], axis: [[572, 728], [660, 800], [752, 900]], r: [42, 50, 54], ramp: JEANS, w: 20, gain: 1.9 };
const shin: Part = { name: "shin", out: [[540, 726], [570, 716], [598, 738], [612, 790], [604, 848], [580, 900], [548, 940], [520, 950], [494, 938], [488, 914], [500, 862], [516, 806], [528, 758]], axis: [[570, 742], [540, 840], [500, 930]], r: [44, 38, 26], ramp: JEANS, w: 18, gain: 1.9 };
const foot: Part = { name: "foot", out: [[488, 914], [520, 922], [544, 940], [550, 964], [392, 966], [386, 950], [410, 938], [450, 928]], axis: [[530, 944], [400, 954]], r: [22, 13], ramp: SOCK, w: 12, gain: 1.7 };
const upperArm: Part = { name: "upper arm", out: [[674, 650], [712, 638], [742, 656], [740, 704], [722, 752], [696, 796], [668, 830], [640, 822], [638, 790], [652, 742], [662, 694]], axis: [[712, 668], [690, 740], [654, 808]], r: [34, 30, 25], ramp: SHIRT, w: 16, gain: 1.8 };
const forearm: Part = { name: "forearm", out: [[676, 806], [668, 798], [640, 782], [610, 769], [580, 761], [552, 752], [532, 744], [524, 758], [528, 772], [550, 782], [585, 797], [620, 815], [646, 832], [662, 838], [676, 828]], axis: [[660, 816], [600, 788], [532, 758]], r: [26, 22, 15], ramp: SKIN, w: 11, gain: 1.8 };
// the hand round the glass: back of the hand toward us, three fingers across the front of the
// glass, the little finger tucked under, fingertips rounding off past the glass's left wall
const HAND_OUT: P[] = [[534, 738], [514, 760], [496, 782], [474, 786], [452, 787], [432, 786], [426, 792], [428, 800], [425, 806], [428, 813], [426, 819], [430, 827], [448, 830], [468, 830], [480, 836], [500, 838], [516, 820], [530, 798], [544, 776], [538, 756]];
const hand: Part = { name: "hand", out: HAND_OUT, axis: [[530, 760], [496, 798], [440, 806]], r: [20, 22, 16], ramp: SKIN, w: 8, gain: 1.9 };
const PARTS = [torso, farKnee, thigh, shin, foot, upperArm, forearm, neck, head, hair]; // the hand is painted after the glass it holds

// ---------------------------------------------------------------- the glass
const GL = { x: 452, top: 778, h: 98, rt: 31, rb: 26, tilt: 0.05 };
const gp = (u: number, v: number): P => { const y = GL.top + v * GL.h, r = GL.rt + (GL.rb - GL.rt) * v; return [GL.x + u * r + (y - GL.top) * GL.tilt, y]; };
const gell = (v: number, ry: number, a0: number, a1: number, n = 16): P[] => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n, [x, y] = gp(Math.cos(a), v); return [x, y + Math.sin(a) * ry] as P; });
const LIQ_V = 0.5;
const GLASS_OUT: P[] = [...gell(0, 6, Math.PI, 2 * Math.PI), ...gell(1, 5.5, 0, Math.PI)];
const LIQUID: P[] = [...gell(LIQ_V, 5, Math.PI, 0), ...gell(0.96, 5, 0, Math.PI)];
// the liquid lit from behind its own left wall: the lamp's light passes through and glows amber in
// the far (right, lower) side, the near side dark; its surface a dull mirror of the warm room
const liqCol = (x: number, y: number) => {
  const [l] = gp(-1, LIQ_V), [r] = gp(1, LIQ_V), u = clamp((x - l) / (r - l)), v = clamp((y - gp(0, LIQ_V)[1]) / (GL.h * (0.96 - LIQ_V)));
  const glow = Math.exp(-(((u - 0.74) / 0.2) ** 2) - (((v - 0.62) / 0.32) ** 2));
  return ramp(LIQ, 0.08 + 0.55 * glow + 0.06 * (1 - v));
};

// ---------------------------------------------------------------- shadows
// his shadow thrown right onto the blanket and the floor; the forearm's on the thigh; the hand's on
// the glass's far side; the contact dark under the seat and the foot
const CAST_BED: P[] = [[720, 600], [790, 590], [856, 616], [902, 680], [930, 760], [940, 820], [830, 820], [820, 720], [790, 650]];
const CAST_FLOOR: P[] = [[780, 958], [960, 956], [1084, 962], [1084, 1000], [900, 994], [790, 978]];
const castI = (x: number, y: number) => (inside(CAST_BED, x, y) ? 0.32 : inside(CAST_FLOOR, x, y) ? 0.45 : 1);

// ---------------------------------------------------------------- strokes
type Clip = { keep?: P[][]; out?: P[][] };
type Stage = { clip?: Clip; strokes: OStroke[] };
const shift = (pts: P[], dx: number, dy: number): P[] => pts.map(([x, y]) => [x + dx, y + dy] as P);
const lost = (pts: P[], dx = 8, dy = 2): Clip => ({ keep: [pts, shift(pts, dx, dy)] }); // spills past the shadow side, away from the lamp
const st = (ctrl: P[], w: number, c0: string, seed: number, o: Partial<OStroke> = {}): OStroke => ({ ctrl, w, c0, c1: o.c1 ?? c0, load: 1.05, dry: 0.25, impasto: 0.3, jit: 0.05, seed, ...o });
const axisDir = (p: Part, wrap: boolean) => (x: number, y: number) => { const b = near(p.axis, x, y); return Math.atan2(b.ty, b.tx) + (wrap ? Math.PI / 2 : 0); };
// a figure painter lays each stroke ALONG the line of equal light (across the light's gradient), so a
// stroke never carries a lit colour into the shadow; where the light is flat it follows the form
const isoDir = (p: Part, wrap: boolean) => { const ax = axisDir(p, wrap); return (x: number, y: number) => {
  const gx = partI(p, x + 3, y).I - partI(p, x - 3, y).I, gy = partI(p, x, y + 3).I - partI(p, x, y - 3).I;
  return Math.hypot(gx, gy) < 0.004 ? ax(x, y) : Math.atan2(gy, gx) + Math.PI / 2;
}; };

const roomColor = (x: number, y: number): string => {
  const shadow = castI(x, y);
  if (inside(STAND_TOP, x, y)) return ramp(WOOD, 0.62 + 0.3 * clamp(1 - Math.abs(x - LAMP[0]) / 200));
  if (inside(STAND_FRONT, x, y)) return ramp(WOOD, 0.08 + 0.3 * wallI(x, y) * clamp(1 - (y - 614) / 420));
  if (x >= 322 && y >= BED_TOP(x) - 20 && y < BED_TOP(x)) return ramp(LINEN, 0.02 + 0.85 * wallI(x, y) ** 1.8 * shadow);   // the sheet's edge on the mattress top
  if (x >= 322 && y >= BED_TOP(x) && y < 812) {
    // the blanket hanging down the side in long folds: each fold turns a lit flank to the lamp
    const fold = Math.sin((x - 330) / 46 + Math.sin(y / 90) * 0.6), I = wallI(x, y) * (0.8 + 0.28 * fold) * (1 - 0.25 * clamp((y - 700) / 110));
    return ramp(BLANKET, clamp(I * 1.15) * shadow);
  }
  if (x >= 322 && y >= 812 && y < FLOOR) return ramp(WOOD, 0.02 + 0.08 * wallI(x, y));                                    // under the bed
  if (y >= FLOOR) return ramp(WOOD, clamp(0.1 + 0.85 * wallI(x, y * 0.9 + 40)) * shadow);
  return ramp(WALL, wallI(x, y));
};

const block = (p: Part, seed: number, wrap: boolean) => { const col = partCol(p); return fill({ region: p.out, step: p.w * 0.5, len: p.w * 2, w: p.w * 1.2, dir: isoDir(p, wrap), seed, load: 1.15, dry: 0.15, impasto: 0.06, jit: 0.03, soft: 0.2, color: (x, y) => mix(col(x, y), "#1a120c", 0.25), sweep: 3.14 }); };
const plane = (p: Part, ks: number[], seed: number, wrap: boolean, imp: number) => { const col = partCol(p); return fill({ region: p.out, step: p.w * 0.45, len: p.w * 2, w: p.w, dir: isoDir(p, wrap), seed, load: 1.05, dry: 0.28, impasto: imp, jit: 0.03, soft: 0.25, bend: 0.25, color: (x, y) => (ks.includes(planeK(partI(p, x, y).I)) ? col(x, y) : null), sweep: 3.14 }); };
const WRAP: Record<string, boolean> = { torso: true, thigh: false, shin: false, foot: false, "upper arm": true, forearm: false, neck: false, head: true, hair: false, hand: true, "far knee": true };

const stages = (): Stage[] => {
  const S: Stage[] = [];
  // 1. the toned ground: a thin sienna-umber rub over the white priming
  const tr = rng(3), toning: OStroke[] = [];
  for (let i = 0; i < 16; i++) { const y = -40 + i * 76 + tr() * 30, a = (i % 2 ? 0.12 : -0.1) + (tr() - 0.5) * 0.1; toning.push({ ctrl: [[-80, y - a * 600], [W / 2, y + (tr() - 0.5) * 40], [W + 80, y + a * 600]], w: 150, c0: mix(TONE, "#6e4628", tr() * 0.5), c1: mix(TONE, "#a07048", tr() * 0.5), load: 1.1, dry: 0.5, impasto: 0, alpha: 0.85, seed: 10 + i }); }
  S.push({ strokes: toning });
  // 2. the drawing, in thin umber with a small round brush
  const ln = (ctrl: P[], seed: number, w = 3): OStroke => ({ ctrl, w, c0: UMBER, load: 1, dry: 0.15, impasto: 0, alpha: 0.7, seed });
  S.push({ strokes: [ln([[0, 596], [300, 596]], 40), ln([[322, 590], [W, 575]], 41), ln([[322, 812], [W, 812]], 42), ln([[0, FLOOR], [W, FLOOR]], 43), ln(SHADE, 44), ...PARTS.map((p, i) => ln([...p.out, p.out[0]], 50 + i, 2.6))] });
  // 3. the dark masses with the big flat, lean: wall, bed, under it, the floor, the nightstand
  const big = (region: P[], step: number, len: number, w: number, dir: (x: number, y: number) => number, seed: number, o: Partial<Parameters<typeof fill>[0]> = {}) => fill({ region, step, len, w, dir, seed, load: 1.1, dry: 0.4, impasto: 0.04, bend: 0.12, jit: 0.035, soft: 0.25, color: roomColor, sweep: 0, ...o });
  const steep = (x: number, y: number) => -1.15 + (fractal(91, x, y, 0.002, 0.002, 1) - 0.5) * 0.35;
  S.push({ strokes: big(WALL_R, 52, 150, 90, steep, 100) });
  S.push({ strokes: big(BED_R, 40, 150, 52, (x) => 1.52 + Math.sin(x / 46) * 0.08, 110, { bend: 0.06 }) });
  S.push({ strokes: big(UNDER_R, 56, 320, 70, () => 0.01, 120) });
  S.push({ strokes: big(FLOOR_R, 34, 300, 40, () => 0.01, 130, { bend: 0.03 }) });
  S.push({ strokes: big(STAND_FRONT, 44, 200, 56, () => 1.57, 140, { bend: 0.03 }) });
  // 4. mid tones and lights in the room, smaller and fatter: the wall's glow, the blanket's lit folds,
  //    the floor's boards near the lamp, the nightstand's lit top, the sheet edge
  S.push({ strokes: big([[-40, -40], [560, -40], [520, 600], [-40, 600]], 54, 200, 76, steep, 150, { color: (x, y) => (wallI(x, y) > 0.35 ? roomColor(x, y) : null), impasto: 0.1, dry: 0.5, len: 120 }) });
  S.push({ strokes: big(BED_R, 22, 110, 26, (x) => 1.52 + Math.sin(x / 46) * 0.1, 160, { color: (x, y) => (wallI(x, y) > 0.25 && y > BED_TOP(x) ? roomColor(x, y) : null), impasto: 0.14, dry: 0.4, bend: 0.08 }) });
  S.push({ strokes: big([[322, 540], [W + 40, 520], [W + 40, 600], [322, 600]], 12, 140, 16, () => -0.02, 165, { color: (x, y) => (y < BED_TOP(x) && y > BED_TOP(x) - 20 ? roomColor(x, y) : null), impasto: 0.04, dry: 0.3, bend: 0.02, jit: 0.02 }) });
  S.push({ strokes: big(FLOOR_R, 18, 220, 22, () => 0.01, 170, { color: (x, y) => (wallI(x, y * 0.9 + 40) > 0.3 ? roomColor(x, y) : null), impasto: 0.14, dry: 0.45, bend: 0.02 }) });
  S.push({ strokes: big(STAND_TOP, 9, 160, 12, () => 0, 175, { impasto: 0.2, dry: 0.3, bend: 0.01 }) });
  // the nightstand's edges and its drawer
  S.push({ strokes: [st([[0, 615], [160, 616], [312, 615]], 4, "#120b06", 180, { impasto: 0.1 }), st([[312, 614], [313, 780], [312, 962]], 5, "#0c0805", 181, { impasto: 0.05 }), st([[10, 720], [160, 722], [300, 720]], 3.5, "#0d0805", 182, { impasto: 0.05 }), st([[150, 668], [158, 669]], 7, "#7a5a32", 183, { c1: "#2a1a0e", impasto: 0.6 })] });

  // 5. THE LAMP. Stem and base first in dark bronze, the lit side catching the bulb below the shade;
  //    then the shade, glowing: the paint brightest at its lower rim, where the light spills out
  S.push({ strokes: [
    st([[163, 470], [164, 530], [163, 588]], 9, "#2a1a0c", 200, { c1: "#140c06" }), st([[160, 476], [161, 530], [160, 584]], 3, "#c99050", 201, { c1: "#6a4422", impasto: 0.5 }),
    st([[118, 590], [164, 582], [212, 590]], 22, "#24160a", 202, { c1: "#120a05" }), st([[124, 584], [150, 578], [176, 578]], 5, "#d8a060", 203, { c1: "#7a4e26", impasto: 0.6 }),
  ] });
  const shadeCol = (x: number, y: number) => ramp(["#c08a44", "#e6b46a", "#f6d792", "#fdedc0", "#fffaea"], clamp(0.3 + 0.6 * ((y - 330) / 138) + 0.3 * (1 - Math.abs(x - 165) / 110)));
  S.push({ clip: { keep: [SHADE] }, strokes: fill({ region: [[100, 322], [230, 322], [272, 476], [58, 476]], step: 13, len: 90, w: 18, dir: (x) => -1.57 + (x - 165) / 300, seed: 210, load: 1.15, dry: 0.15, impasto: 0.45, jit: 0.04, soft: 0.2, color: shadeCol, sweep: 0 }) });
  S.push({ strokes: [
    st([[110, 331], [165, 336], [220, 331]], 5, "#7a5228", 220, { c1: "#5a3a1c", impasto: 0.3 }),                       // the top rim, in shadow from above
    st([[70, 468], [165, 478], [260, 468]], 8, "#fffcf0", 221, { c1: "#ffeab8", impasto: 1, dry: 0.05, load: 1.4 }),    // the lower rim, where the light pours out: thick
    st([[214, 334], [240, 400], [261, 466]], 4, "#a8743a", 222, { c1: "#c8904a", impasto: 0.3 }),
  ] });

  // 6. THE FIGURE, back to front, each part in its planes: dark first (lean, the shadow side spilling
  //    into the dark around it), then half tones, then the lights in fatter paint, then the top light
  PARTS.forEach((p, i) => { if (p === hair) return; S.push({ clip: lost(p.out), strokes: block(p, 300 + i * 10, WRAP[p.name]) }); });
  PARTS.forEach((p, i) => { if (p === hair) return; S.push({ clip: { keep: [p.out] }, strokes: [...plane(p, [1, 2], 301 + i * 10, WRAP[p.name], 0.12), ...plane(p, [3], 302 + i * 10, WRAP[p.name], 0.22), ...plane(p, [4], 303 + i * 10, WRAP[p.name], 0.35)] }); });
  return S;
};

// the figure's drawing: folds, features, the edges where one form overlaps another. Each a small
// brush stroke of the colour the form has THERE, darkened in the fold or lightened on the ridge
const DARK_SKIN = "#2a140a", DARK_SHIRT = "#2e241a", DARK_JEANS = "#05060a";
const details = (): Stage[] => {
  const S: Stage[] = [];
  // the shirt: the deep fold where it bunches over the bent belly, the drag lines across the rounded
  // back from the shoulder blade, the sleeve's hem and its fold in the armpit; lit ridges beside them
  const fold = (p: Part, ctrl: P[], w: number, k: number, seed: number) => { const col = partCol(p), [x, y] = ctrl[1]; return st(ctrl, w, k < 0 ? mix(col(x, y), "#120c08", -k) : mix(col(x, y), "#fff2d8", k), seed, { impasto: k > 0 ? 0.3 : 0.08, dry: 0.45, soft: 0.35, jit: 0.03 }); };
  S.push({ clip: { keep: [torso.out, upperArm.out] }, strokes: [
    fold(torso, [[706, 646], [742, 668], [770, 710]], 10, 0.22, 400),
    fold(torso, [[764, 704], [788, 762], [796, 830]], 14, -0.35, 401),
    fold(torso, [[700, 836], [732, 870], [772, 892]], 12, -0.4, 403),
    fold(torso, [[704, 902], [744, 924], [784, 936]], 12, -0.4, 404),
    fold(torso, [[692, 852], [714, 870], [740, 880]], 7, 0.25, 405),
    fold(upperArm, [[736, 708], [726, 726], [712, 746], [698, 766]], 7, -0.45, 406),
    fold(upperArm, [[728, 698], [716, 716], [702, 734]], 5, 0.3, 407),
  ] });
  // the jeans: folds bunched behind the knee, the seam down the shin, the lit top of the knee
  S.push({ clip: { keep: [thigh.out, shin.out, farKnee.out] }, strokes: [
    fold(thigh, [[590, 790], [606, 812], [630, 822]], 9, -0.5, 410), fold(thigh, [[598, 832], [620, 848], [648, 856]], 9, -0.5, 411),
    fold(thigh, [[600, 812], [618, 826], [640, 834]], 5, 0.2, 412),
    st([[552, 712], [566, 704], [586, 706]], 6, "#7a7c86", 413, { c1: "#4a5060", impasto: 0.45 }),
    fold(shin, [[524, 806], [512, 852], [500, 900]], 7, 0.22, 415),
    fold(farKnee, [[640, 722], [620, 732], [596, 732]], 7, -0.5, 416),
  ] });
  // the forearm over the knee: its shadow lying on the jeans under it, the lit ridge along its top,
  // the round of the elbow
  S.push({ strokes: [
    st([[664, 842], [624, 824], [586, 806], [548, 790]], 7, "#06070b", 420, { impasto: 0.05, soft: 0.3 }),
  ] });
  S.push({ clip: { keep: [forearm.out] }, strokes: [
    st([[664, 800], [630, 784], [596, 772], [560, 760], [536, 750]], 5, "#f0cfa6", 421, { c1: "#d0a07a", impasto: 0.45, soft: 0.3 }),
    st([[646, 830], [612, 813], [578, 797], [548, 784]], 6, "#4a2a1a", 422, { c1: "#6a4430", impasto: 0.08, soft: 0.3 }),
    st([[672, 808], [676, 820], [666, 834]], 6, "#7a5038", 423, { impasto: 0.2 }),
  ] });
  // the head. Face first: the eye socket's shadow under the brow, the shut lid, the lashes, the
  // brow lifted at its inner end; the nose's lit bridge and the shadow under it; the parted line of
  // the lips and a light on the lower lip; the jaw's edge turning into shadow; the ear, the light
  // through its rim warm red
  const eyeLid = hd([[-32, 4], [-26, 7.5], [-18, 7]]), brow = hd([[-34, -7], [-27, -10], [-19, -8.5], [-12, -4]]);
  S.push({ clip: { keep: [HEAD_OUT] }, strokes: [
    st(hd([[-34, -2], [-26, 2], [-16, 3]]), 8, "#a8774f", 430, { c1: "#8f603f", impasto: 0.08, dry: 0.5, soft: 0.4 }),
    st(eyeLid, 2.6, "#2a120a", 431, { impasto: 0.1 }),
    st(hd([[-30, 6], [-29, 9.5]]), 1.4, "#2a120a", 432, { impasto: 0 }), st(hd([[-26, 7.8], [-25, 11]]), 1.4, "#2a120a", 433, { impasto: 0 }), st(hd([[-22, 7.6], [-21.5, 10.5]]), 1.3, "#2a120a", 434, { impasto: 0 }),
    st(brow, 4.6, "#1a0f08", 435, { c1: "#3a2416", impasto: 0.15, dry: 0.4 }),
    st(hd([[-38, -1], [-41, 8], [-45, 14.5]]), 4, "#fae2bc", 436, { c1: "#e8b688", impasto: 0.55 }),
    st(hd([[-42, 18.5], [-37, 20], [-33, 19]]), 4, "#3a1a0e", 437, { impasto: 0.1 }),
    st(hd([[-39, 17], [-37.5, 18]]), 2.6, "#1a0905", 438, { impasto: 0 }),
    st(hd([[-38.5, 27.5], [-35, 28.5], [-30, 28]]), 2.6, "#3a140c", 439, { impasto: 0.05 }),
    st(hd([[-37.5, 31], [-34, 32.5]]), 3, "#e8a68a", 440, { c1: "#c87e62", impasto: 0.45 }),
    st(hd([[-37, 23], [-34, 24.5]]), 2.4, "#a85a44", 441, { impasto: 0.2 }),
    st(hd([[-22, 47], [-8, 45], [6, 40], [16, 35]]), 5, "#5a3424", 442, { c1: "#3a2116", impasto: 0.06, dry: 0.5, soft: 0.4 }),
    st(hd([[-36, 36], [-33, 41], [-26, 44.5]]), 3, "#f0c49a", 443, { impasto: 0.4 }),
    st(hd([[-24, 18], [-16, 22], [-9, 29]]), 7, "#b07a58", 444, { c1: "#9a6644", impasto: 0.1, dry: 0.65, soft: 0.4 }),   // warm cheek turning out of the light
    st(hd([[-14, 32], [-2, 36], [10, 33]]), 7, "#6a4a3a", 445, { c1: "#5a3e30", impasto: 0.05, dry: 0.7, alpha: 0.4 }), // a young man's shaved jaw, a shade cooler
  ] });
  S.push({ strokes: [
    st(hd([[12, -2], [17, -6], [21.5, -2], [22, 6], [19, 14], [14, 20]]), 4, "#9a5a3c", 450, { c1: "#5a3020", impasto: 0.2 }),
    st(hd([[13, -1], [17, -4.5], [20.5, -1.5]]), 2.6, "#d0845a", 451, { c1: "#b06a46", impasto: 0.45 }),
    st(hd([[15, 3], [17, 9], [15, 14]]), 2.4, "#4a2416", 452, { impasto: 0.05 }),
  ] });
  // the hair: dark, a little long on top, falling forward off the bowed head; painted in locks along
  // their growth from the crown, the lamp catching the lit edges warm, a few strands loose over the brow
  const r = rng(460), locks: OStroke[] = [];
  const crown: [number, number] = [6, -38];
  for (let i = 0; i < 46; i++) {
    const a = -Math.PI * 0.95 + (i / 45) * Math.PI * 1.35 + (r() - 0.5) * 0.12, L = 22 + r() * 22, bend = (r() - 0.5) * 12;
    const p0: [number, number] = [crown[0] + Math.cos(a) * 4, crown[1] + Math.sin(a) * 4], p2: [number, number] = [crown[0] + Math.cos(a) * L * 1.4, crown[1] + Math.sin(a) * L * 1.4 + 6];
    const pm: [number, number] = [(p0[0] + p2[0]) / 2 - Math.sin(a) * bend, (p0[1] + p2[1]) / 2 + Math.cos(a) * bend];
    const [x, y] = hd([pm])[0], I = partI(hair, x, y).I;
    locks.push(st(hd([p0, pm, p2]), 7 + r() * 5, ramp(HAIR, 0.08 + I * 0.6), 461 + i, { c1: ramp(HAIR, 0.04 + I * 0.4), impasto: 0.2, dry: 0.45, soft: 0.3 }));
  }
  S.push({ clip: lost(HAIR_OUT, 6, 2), strokes: [st(hd([[0, -42], [28, -30], [38, -6], [32, 20]]), 34, HAIR[1], 455, { c1: HAIR[0], impasto: 0.05, load: 1.2, dry: 0.1 }), st(hd([[-30, -30], [-6, -44], [20, -40]]), 28, HAIR[2], 456, { c1: HAIR[1], impasto: 0.05, load: 1.2, dry: 0.1 }), ...locks] });
  S.push({ strokes: [
    st(hd([[-28, -26], [-38, -14], [-40, -4]]), 5, "#2a1c10", 520, { c1: "#140c06", impasto: 0.2 }),
    st(hd([[-12, -44], [-24, -36], [-31, -26]]), 3, "#5e4024", 522, { c1: "#2a1c10", impasto: 0.4 }),
    st(hd([[2, -49], [-12, -47], [-22, -41]]), 2.6, "#6a4a2a", 523, { c1: "#3a2614", impasto: 0.45 }),
  ] });
  // the neck under the bowed head: the jaw's cast shadow across it, the tendon, the collar
  S.push({ clip: { keep: [neck.out, torso.out] }, strokes: [st([[670, 652], [692, 662], [714, 662]], 9, "#3a2116", 470, { impasto: 0.05, soft: 0.4, dry: 0.5 })] });
  // the glass and what is in it: the far wall seen through the empty top (the jeans behind,
  // dimmed), the liquid with the lamp glowing through it, the surface's line, the walls' edges, the
  // rim's light, the lamp's reflection down the near wall, the heavy base, glints in thick paint
  S.push({ clip: { keep: [GLASS_OUT] }, strokes: fill({ region: GLASS_OUT, step: 7, len: 30, w: 9, dir: () => 1.57, seed: 500, load: 1.05, dry: 0.25, impasto: 0.12, jit: 0.04, color: (x, y) => mix(roomColor(x, y), "#3a3028", 0.2), sweep: 0 }) });
  S.push({ clip: { keep: [LIQUID] }, strokes: fill({ region: LIQUID, step: 5, len: 24, w: 8, dir: () => 0.1, seed: 510, load: 1.1, dry: 0.15, impasto: 0.15, jit: 0.04, color: liqCol, sweep: 0 }) });
  S.push({ strokes: [
    st(gell(LIQ_V, 5, Math.PI * 1.02, Math.PI * 1.98), 2.6, "#7a4818", 520 + 10, { impasto: 0.3 }),           // the surface's far edge, catching the room
    st(gell(LIQ_V, 5, Math.PI * 0.04, Math.PI * 0.96), 2.6, "#0a0402", 531, { impasto: 0.1 }),
    st(gell(0, 6, Math.PI * 1.02, Math.PI * 1.98), 2, "#c8a878", 532, { impasto: 0.4 }),
    st(gell(0, 6, Math.PI * 0.62, Math.PI * 0.98), 2.6, "#fff0d0", 533, { impasto: 0.7 }),
    st([gp(1, 0.52), gp(1, 0.76), gp(1, 1)], 2.4, "#1a0c06", 534, { impasto: 0.1 }),
    st([gp(-1, 0.55), gp(-1, 0.78), gp(-1, 0.99)], 2.2, "#3a2414", 535, { impasto: 0.1 }),
    st([gp(-0.72, 0.56), gp(-0.74, 0.76), gp(-0.72, 0.92)], 4, "#ffe6b0", 536, { c1: "#d8904a", impasto: 0.9, load: 1.3, dry: 0.15 }),   // the lamp, reflected down the near wall
    st([gp(-0.75, 0.58), gp(-0.73, 0.64)], 3.4, "#fffcf2", 537, { impasto: 1, load: 1.4, dry: 0 }),
    st(gell(0.955, 5, Math.PI * 0.05, Math.PI * 0.95, 10), 6, "#1e0c04", 538, { c1: "#3a1a08", impasto: 0.2 }),
    st(gell(0.995, 5.5, Math.PI * 0.55, Math.PI * 0.9, 8), 2.6, "#e8b878", 539, { impasto: 0.6 }),
  ] });
  S.push({ clip: { keep: [HAND_OUT] }, strokes: [...block(hand, 390, true), ...plane(hand, [1, 2], 391, true, 0.12), ...plane(hand, [3], 392, true, 0.25), ...plane(hand, [4], 393, true, 0.4)] });
  // the hand: the knuckles' ridge catching the lamp, the gaps between the fingers, the tips rounded
  // over the glass's near wall, the tucked little finger, the tendons on the back of the hand
  S.push({ clip: { keep: [HAND_OUT] }, strokes: [
    st([[430, 806], [448, 808], [468, 808]], 2.4, "#4a2414", 480, { impasto: 0.05 }),
    st([[430, 819], [450, 821], [470, 821]], 2.4, "#4a2414", 481, { impasto: 0.05 }),
    st([[452, 830], [476, 832], [496, 836]], 3, "#3a1a0e", 482, { impasto: 0.05 }),
    st([[480, 790], [484, 798]], 4, "#fbdcb2", 483, { impasto: 0.6 }), st([[486, 804], [490, 812]], 3.6, "#f2cc9e", 484, { impasto: 0.55 }), st([[490, 818], [494, 825]], 3.2, "#e0b084", 485, { impasto: 0.5 }),
    st([[440, 790], [458, 790], [474, 791]], 3, "#fbe0b8", 486, { impasto: 0.5 }),
    st([[428, 795], [430, 801]], 3, "#f6d4a8", 487, { impasto: 0.5 }), st([[428, 808], [430, 814]], 3, "#e8c094", 488, { impasto: 0.5 }), st([[429, 821], [432, 826]], 3, "#d8ac80", 489, { impasto: 0.45 }),
    st([[530, 752], [512, 770], [496, 786]], 2.4, "#d89a6c", 490, { impasto: 0.35 }), st([[534, 766], [518, 786], [504, 802]], 2, "#b8744a", 491, { impasto: 0.3 }),
  ] });
  S.push({ strokes: [st([[536, 738], [516, 760], [496, 782], [470, 786], [440, 786], [428, 790]], 2.2, "#2a140a", 492, { impasto: 0.05, dry: 0.4 }), st([[500, 838], [518, 820], [532, 798], [546, 776]], 2.6, "#1a0b06", 493, { impasto: 0.05 })] });
  // contact and cast darks: where he sits, where the sock presses the floor, the glass's shadow
  S.push({ strokes: [
    st([[700, 966], [760, 970], [820, 966]], 12, "#050302", 540, { impasto: 0.05, dry: 0.5 }),
    st([[392, 966], [470, 970], [552, 966]], 8, "#060402", 541, { impasto: 0.05, dry: 0.5 }),
    st([[460, 984], [520, 988], [580, 986]], 16, "#1a1008", 542, { impasto: 0.05, dry: 0.7, alpha: 0.6 }),
  ] });
  return S;
};

// ---------------------------------------------------------------- the painting
const ground = (g: Gfx) => { const c = g.cur, e = g.env; c.setTransform(e.scale, 0, 0, e.scale, 0, 0); c.fillStyle = "#efe8da"; c.fillRect(0, 0, e.W, e.H); weave(g, 0.55); };
const withClip = (g: Gfx, clip: Clip | undefined, fn: () => void) => {
  if (!clip) return fn();
  const c = g.cur; c.save(); c.beginPath();
  if (clip.keep) { clip.keep.forEach((p) => { c.moveTo(p[0][0], p[0][1]); p.forEach(([x, y]) => c.lineTo(x, y)); c.closePath(); }); c.clip("nonzero"); }
  else { c.rect(-50, -50, W + 100, H + 100); (clip.out ?? []).forEach((p) => { c.moveTo(p[0][0], p[0][1]); p.forEach(([x, y]) => c.lineTo(x, y)); c.closePath(); }); c.clip("evenodd"); }
  fn(); c.restore();
};
const ALL = [...stages(), ...details()];
const draw = (ctx: Ctx, _f: number, env: Env) => {
  const g = new Gfx(ctx, env, 0, OIL_M);
  ground(g);
  ALL.forEach((s) => withClip(g, s.clip, () => s.strokes.forEach((o) => oilStroke(g, o, 1))));
  weave(g, 0.3);
};

export const bedsideGlassOil: Film = {
  meta: { title: "The glass at the bedside · oil", W, H, fps: 30, bpm: 120, durationFrames: 1, raster: "cpu" },
  assets: { images: {} },
  shots: [{ id: "still", start: 0, end: 1, draw }],
};
