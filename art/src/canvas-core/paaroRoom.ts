import { rng, type Ctx, type Env, type P } from "./core";
import type { Film } from "./film";
import { mix } from "./gallery";
import { easel, ell, inside, limb, place, paint, sm, lerp, type Painting } from "./paaroGouache";
import { registerFaces } from "./launchLook";
import lora from "../../assets/fonts/Lora-Bold.ttf";

// PAARO · the room. Mid-century gouache at night (paaroGouache.ts is the hand).
//
// SUBJECT & REFERENCE (from knowledge): a young man of about twenty, sitting on the floor of his
// room with his back against the side rail of his bed, both knees drawn up, the near forearm laid
// over the near knee and a short whisky tumbler hanging loose from his fingers. Stylised mid-century
// canon, the way Provensen/Blair draw adults: head 104 px, seated height (crown to floor) about
// 3.4 heads; shoulder width 1.6 heads; upper arm 1.2 heads, forearm 1.0, hand 0.7; thigh 1.6, shin
// 1.5. Three-quarter profile facing right toward the lamp, head bowed 14 degrees, eyes closed.
// A crew-neck sweater, dark trousers, cream socks.
// The room: a single bed with a wooden headboard (left), a round three-legged side table with a
// drum-shaded lamp and a whisky bottle (right of him), a starburst wall clock, a sash window on a
// rainy night with the town's rooftops, dusty-blue curtains, papers on the floor. The other pillow
// is untouched: the token that returns in the last shot.
// LIGHT: the lamp, low, right of him. Painted as concentric flat discs on the wall and floor; every
// shade flat sits on the left of its form, away from the lamp.

registerFaces([{ family: "PaaroHand", file: lora }]);

const W = 1920, H = 1080;
export const C = {
  wall: "#283458", wall2: "#33405f", wall3: "#4a4b62", wall4: "#6a5b58", wallD: "#1f2949",
  floor: "#1d2543", floor2: "#2c3150", floor3: "#463f4c", plank: "#151b35",
  navy: "#121735", night: "#1a2050", night2: "#262e66", roof: "#0e1230",
  cream: "#efe2c2", creamD: "#c9b994", mustard: "#e3a63a", mustardD: "#b07a24", lampGlow: "#f5d58a",
  curtain: "#7189a8", curtainD: "#556d8e", curtainL: "#93a8c2",
  wood: "#6e4634", woodD: "#4c2f25", woodL: "#8a5d43",
  sheet: "#d6d2c6", sheetD: "#a6abb7", blanket: "#3f7477", blanketD: "#2d5659",
  sweater: "#c98f3a", sweaterD: "#94652a", trousers: "#2a3156", trousersD: "#1c2140",
  skin: "#e0a681", skinD: "#b9805f", blush: "#d98878", hair: "#211b25", hairL: "#3d3446",
  bottle: "#2e5649", amber: "#c98031", glass: "#a9c3cf", paper: "#e8dcc0", crimson: "#a33a3f",
  ink: "#1b1828", gold: "#c9a24a",
};

// ---------------------------------------------------------------- the boy
// pose: sip 0..1 lifts the glass to his lips; bow -1..1 tips the head; slump 0..1 sinks him into himself
export type BoyPose = { sip: number; bow: number; slump: number; tilt: number; glass: boolean; fill: number };
export const REST: BoyPose = { sip: 0, bow: 0, slump: 0, tilt: 0, glass: true, fill: 0.35 };

export const boyPainting = (pose: BoyPose): Painting => {
  const e = easel(), { S, D, L } = e, sl = pose.slump, sip = pose.sip;
  const hip: P = [770, 930], neck: P = [lerp(742, 752, sl), lerp(702, 716, sl)];
  // far leg first (in his own shadow), then the torso, then the near leg over it
  const farThigh = limb([[748, 924], [812, 862], [866, 800]], [30, 27, 23]), farShin = limb([[866, 800], [884, 866], [898, 926]], [22, 18, 14]);
  S(farThigh.poly, C.trousersD); S(farShin.poly, C.trousersD);
  S(sm([[884, 918], [940, 922], [950, 940], [886, 944]]), C.creamD);
  // torso: crew-neck sweater, leaning back on the rail
  const torso: P[] = sm([[702, 938], [686, 842], [690, 770], [706, 728], [730, 708], [neck[0] + 10, neck[1] - 4], [neck[0] + 46, neck[1] + 4], [808, 732], [826, 790], [842, 870], [846, 936]]);
  S(torso, C.sweater, { shade: C.sweaterD, sd: [24, -8], ang: 1.4 });
  D([[712, 800], [716, 900]], 18, C.sweaterD, { alpha: 0.55 }); D([[800, 760], [826, 850]], 12, mix(C.sweater, C.lampGlow, 0.5), { alpha: 0.6 });
  // ribbed hem and the collar
  S(sm([[702, 930], [846, 930], [848, 944], [700, 944]], true, 2), C.sweaterD);
  // near leg, knee up
  const thigh = limb([[786, 924], [850, 852], [912, 786]], [36, 32, 27]), shin = limb([[912, 786], [936, 858], [954, 924]], [26, 21, 16]);
  S(thigh.poly, C.trousers, { shade: C.trousersD, sd: [14, -10], ang: -0.8 }); S(shin.poly, C.trousers, { shade: C.trousersD, sd: [12, -2], ang: 1.2 });
  S(sm([[938, 912], [1004, 920], [1014, 940], [942, 946]]), C.cream, { shade: C.creamD, sd: [8, -2] });
  // neck and head: three-quarter profile facing right, bowed
  const bow = 0.24 + 0.1 * pose.bow + 0.12 * sl - 0.42 * sip, head: P = [neck[0] + 22 + 10 * sip, neck[1] - 66 + 6 * sl];
  S(place([[-14, 0], [14, -2], [16, 40], [-16, 42]], [neck[0] + 20, neck[1] - 26], bow * 0.5), C.skin, { shade: C.skinD, sd: [10, 0] });
  S(sm([[neck[0] - 4, neck[1] + 4], [neck[0] + 16, neck[1] - 8], [neck[0] + 44, neck[1] - 6], [neck[0] + 58, neck[1] + 8], [neck[0] + 30, neck[1] + 16]]), C.sweaterD);
  const H = (pts: P[]) => place(pts, head, bow);
  const face = sm(H([[-46, -8], [-36, -44], [0, -60], [36, -48], [50, -24], [52, -8], [60, 8], [66, 18], [55, 24], [57, 34], [51, 40], [48, 54], [30, 66], [2, 62], [-26, 40]]), true, 5);
  S(face, C.skin, { shade: C.skinD, sd: [16, -4] });
  S(ell(...H([[22, 24]])[0], 10, 6, bow), C.blush, { alpha: 0.4 });
  S(sm(H([[18, 48], [46, 46], [44, 58], [28, 64], [10, 58]])), C.skinD, { alpha: 0.45, rag: 0.6 }); // a night's stubble along the jaw
  S(sm(H([[-8, -2], [6, -8], [8, 10], [-4, 16]])), C.skin, { shade: C.skinD, sd: [5, 0] }); // ear
  const hair = sm(H([[-52, 10], [-58, -18], [-52, -44], [-30, -66], [0, -76], [30, -70], [52, -56], [64, -38], [66, -20], [54, -24], [50, -10], [40, -24], [26, -16], [12, -28], [-2, -16], [-14, -8], [-12, 4], [-28, 16], [-42, 24]]), true, 4);
  S(hair, C.hair, { shade: "#15111a", sd: [8, -2] });
  D(H([[-30, -50], [30, -60]]), 10, C.hairL, { alpha: 0.6 });
  L(H([[-40, -40], [-10, -62], [26, -60]]), 1.4); L(H([[-46, -6], [-30, -30], [-6, -46]]), 1.3); L(H([[40, -46], [58, -30], [66, -14]]), 1.4);
  S(sm(H([[46, -30], [62, -22], [70, -4], [58, -14], [50, -18]])), C.hair); // a lock fallen forward
  // the line: face contour with the nose, closed eye with lashes, sad brow, mouth, ear, the fringe
  L(H([[52, -8], [60, 8], [66, 18], [55, 24], [57, 34], [51, 40], [48, 54], [30, 66]]), 2.2);
  L(H([[22, 2], [30, 7], [40, 5]]), 2); L(H([[26, 6], [24, 12]]), 1.2); L(H([[33, 7], [33, 13]]), 1.2);
  L(H([[18, -14], [30, -18], [42, -14]]), 2);
  L(H([[44, 37], [52, 36]]), 1.6);
  L(H([[-4, -4], [4, -6], [6, 8], [-2, 14]]), 1.5);
  L(H([[60, -20], [48, -26], [44, -12]]), 1.6); L(H([[34, -30], [26, -18]]), 1.4);
  // near arm: shoulder to elbow on the knee to a loose hand; sipping lifts the hand to the lips
  const sh: P = [neck[0] + 30, neck[1] + 34], el: P = [lerp(884, 860, sip), lerp(778 + 6 * sl, 720, sip)], wr: P = [lerp(962, head[0] + 40, sip), lerp(772 + 8 * sl, head[1] + 44, sip)];
  const upper = limb([sh, [(sh[0] + el[0]) / 2, (sh[1] + el[1]) / 2 + 6], el], [24, 22, 20]), fore = limb([el, [(el[0] + wr[0]) / 2, (el[1] + wr[1]) / 2 + 4], wr], [19, 17, 14]);
  S(upper.poly, C.sweater, { shade: C.sweaterD, sd: [8, -10] }); S(fore.poly, C.sweater, { shade: C.sweaterD, sd: [4, -10] });
  D([el, wr], 8, C.sweaterD, { alpha: 0.5 });
  // the tumbler, hanging from three fingers (or at the lips, tipped)
  const ang = Math.atan2(wr[1] - el[1], wr[0] - el[0]), tip = -1.15 * sip - 1.5 * pose.tilt;
  const gO: P = [wr[0] + Math.cos(ang) * 30, wr[1] + Math.sin(ang) * 30 + 36 * (1 - sip)];
  const glassPts = place([[-22, -30], [22, -30], [19, 28], [-19, 28]], gO, tip);
  if (pose.glass) {
    S(glassPts, C.glass, { alpha: 0.55 });
    if (pose.fill > 0) S(place([[-19, 28 - 50 * pose.fill], [19, 28 - 50 * pose.fill], [19, 28], [-19, 28]], gO, tip * 0.4), C.amber, { alpha: 0.95 });
    S(place([[-16, -24], [-11, -24], [-11, 20], [-16, 20]], gO, tip), C.cream, { alpha: 0.7 });
    [0, 1, 2, 3].forEach((i) => L([glassPts[i], glassPts[(i + 1) % 4]], 1.6)); L(place([[-17, 18], [17, 18]], gO, tip), 1.2);
  }
  // the hand: back of the hand, knuckles, three fingers curled over the rim, thumb along the side
  const F = (u: number, v: number): P => [wr[0] + Math.cos(ang) * u - Math.sin(ang) * v, wr[1] + Math.sin(ang) * u + Math.cos(ang) * v];
  const hand = sm([F(-4, -15), F(26, -17), F(44, -6), F(52, 14), F(48, 30), F(36, 34), F(30, 20), F(18, 16), F(4, 14), F(-4, 12)], true, 4);
  S(hand, C.skin, { shade: C.skinD, sd: [8, -6] });
  L(sm([F(26, -17), F(44, -6), F(52, 14), F(48, 30), F(36, 34)], false, 4), 1.8);
  L([F(36, 4), F(46, 12)], 1.3); L([F(30, 12), F(40, 22)], 1.3); L([F(4, 14), F(18, 16), F(30, 20)], 1.5);
  // body line: back, collar, the near knee, sweater sleeve end
  L(sm([[706, 728], [690, 770], [686, 842], [700, 936]], false), 2);
  L(thigh.a.filter((_, i) => i % 2 === 0).slice(2), 1.8); L(shin.b.filter((_, i) => i % 2 === 0).slice(1), 1.8);
  L([[904, 772], [914, 768], [922, 776]], 1.4);
  L(upper.a.filter((_, i) => i % 2 === 0), 1.6); L(fore.a.filter((_, i) => i % 2 === 0), 1.6);
  L(sm([[938, 912], [1004, 920], [1014, 940], [942, 946]], false), 1.5);
  return e.p;
};

// ---------------------------------------------------------------- the room
export type RoomState = { t: number; rain: number; moon: number; bottle: number; boy: BoyPose; pillowKept: boolean };
export const ROOM_START: RoomState = { t: 0, rain: 1, moon: 0, bottle: 0.2, boy: REST, pillowKept: true };
const FLOOR = 880, LAMP: P = [1180, 548];
export const WIN = { x0: 1380, y0: 172, x1: 1690, y1: 556 };

export const roomPainting = (st: RoomState): Painting => {
  const e = easel(), { S, D, L } = e, r = rng(1961), t = st.t;
  // WALL, and the lamp painted as flat warm discs on it
  S([[0, 0], [W, 0], [W, FLOOR + 6], [0, FLOOR + 6]], C.wall, { ang: 0.1 });
  [[560, C.wall2], [380, C.wall3], [210, C.wall4]].forEach(([rad, col], i) => S(ell(LAMP[0], LAMP[1] + 20, rad as number, (rad as number) * 0.86), col as string, { rag: 2.4, ang: 0.3 + i }));
  // FLOOR, with the lamp's pool
  S([[0, FLOOR], [W, FLOOR], [W, H], [0, H]], C.floor, { ang: -0.05 });
  S(ell(1150, 960, 560, 110), C.floor2, { rag: 2 }); S(ell(1150, 950, 330, 66), C.floor3, { rag: 2 });
  // wallpaper: a small four-petal motif, half painted out by the dark
  for (let y = 120, row = 0; y < FLOOR - 30; y += 104, row++) for (let x = 60 + (row % 2) * 70; x < W - 40; x += 140) {
    const d = Math.hypot(x - LAMP[0], y - LAMP[1]); const col = d < 210 ? C.wall3 : d < 380 ? C.wall2 : C.wallD;
    if (x > WIN.x0 - 140 && x < WIN.x1 + 120 && y < WIN.y1 + 220) continue;
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + 0.4; S(ell(x + Math.cos(a) * 9, y + Math.sin(a) * 9, 7, 4, a), col, { rag: 0.4 }); }
  }
  // WINDOW: the night, the town, the frame
  S([[WIN.x0, WIN.y0], [WIN.x1, WIN.y0], [WIN.x1, WIN.y1], [WIN.x0, WIN.y1]], C.night);
  S([[WIN.x0, WIN.y0 + 200], [WIN.x1, WIN.y0 + 170], [WIN.x1, WIN.y1], [WIN.x0, WIN.y1]], C.night2, { rag: 2 });
  let x = WIN.x0; while (x < WIN.x1) { const w = 34 + r() * 46, h = 40 + r() * 96; S([[x, WIN.y1 - h], [Math.min(WIN.x1, x + w), WIN.y1 - h], [Math.min(WIN.x1, x + w), WIN.y1], [x, WIN.y1]], C.roof, { rag: 0.3 }); for (let k = 0; k < 3; k++) if (r() < 0.45) { const wx = x + 6 + r() * Math.max(4, w - 16); const wy = WIN.y1 - h + 12 + r() * (h - 28); if (wx + 6 < WIN.x1) S([[wx, wy], [wx + 6, wy], [wx + 6, wy + 8], [wx, wy + 8]], C.mustard, { rag: 0.1 }); } x += w + 3; }
  for (let i = 0; i < 26; i++) { const sx = WIN.x0 + 10 + r() * (WIN.x1 - WIN.x0 - 20), sy = WIN.y0 + 10 + r() * 190, tw = 0.5 + 0.5 * Math.sin(t * 2.1 + i); S(ell(sx, sy, 2 + tw, 2 + tw, 0, 8), C.cream, { alpha: 0.5 + 0.4 * tw, rag: 0 }); }
  if (st.moon > 0) { const mc: P = [WIN.x0 + 220, WIN.y0 + 92]; S(ell(mc[0], mc[1], 70, 70), "#2c3570", { alpha: st.moon, rag: 1.5 }); S(ell(mc[0], mc[1], 38, 38), C.cream, { alpha: st.moon }); S(ell(mc[0] + 18, mc[1] - 10, 34, 34), C.night, { alpha: st.moon }); }
  // rain: dry-brush streaks falling on a slant, moving with time
  if (st.rain > 0) for (let i = 0; i < 26; i++) { const rx = WIN.x0 + r() * (WIN.x1 - WIN.x0 + 40), ry = WIN.y0 + ((r() * 900 + t * 620) % (WIN.y1 - WIN.y0 - 40)); D([[rx, ry], [rx - 12, ry + 34]], 3, C.curtainL, { alpha: 0.6 * st.rain }); }
  const fr = (pts: P[]) => S(pts, C.cream, { shade: C.creamD, sd: [5, -3], rag: 0.4 });
  fr([[WIN.x0 - 18, WIN.y0 - 18], [WIN.x1 + 18, WIN.y0 - 18], [WIN.x1 + 18, WIN.y0], [WIN.x0 - 18, WIN.y0]]);
  fr([[WIN.x0 - 18, WIN.y0], [WIN.x0, WIN.y0], [WIN.x0, WIN.y1], [WIN.x0 - 18, WIN.y1]]);
  fr([[WIN.x1, WIN.y0], [WIN.x1 + 18, WIN.y0], [WIN.x1 + 18, WIN.y1], [WIN.x1, WIN.y1]]);
  fr([[(WIN.x0 + WIN.x1) / 2 - 6, WIN.y0], [(WIN.x0 + WIN.x1) / 2 + 6, WIN.y0], [(WIN.x0 + WIN.x1) / 2 + 6, WIN.y1], [(WIN.x0 + WIN.x1) / 2 - 6, WIN.y1]]);
  fr([[WIN.x0, 360], [WIN.x1, 360], [WIN.x1, 372], [WIN.x0, 372]]);
  fr([[WIN.x0 - 34, WIN.y1], [WIN.x1 + 34, WIN.y1], [WIN.x1 + 40, WIN.y1 + 20], [WIN.x0 - 40, WIN.y1 + 20]]);
  L([[WIN.x0 - 18, WIN.y0 - 18], [WIN.x1 + 18, WIN.y0 - 18]], 1.6); L([[WIN.x1 + 18, WIN.y0 - 18], [WIN.x1 + 18, WIN.y1]], 1.6); L([[WIN.x0 - 40, WIN.y1 + 20], [WIN.x1 + 40, WIN.y1 + 20]], 1.6);
  // CURTAINS: two dusty-blue panels hanging in long folds, a brass rod
  S([[WIN.x0 - 130, WIN.y0 - 44], [WIN.x1 + 130, WIN.y0 - 44], [WIN.x1 + 130, WIN.y0 - 36], [WIN.x0 - 130, WIN.y0 - 36]], C.gold, { rag: 0.2 });
  for (const side of [-1, 1]) {
    const xin = side < 0 ? WIN.x0 + 26 : WIN.x1 - 26, xout = side < 0 ? WIN.x0 - 112 : WIN.x1 + 112, top = WIN.y0 - 40, bot = 760, sway = Math.sin(t * 1.1 + side) * 6;
    const inner = sm([[xin, top], [xin + side * 16 + sway, 400], [xin - side * 30 + sway * 1.5, 620], [xin - side * 50 + sway * 2, bot]], false, 8), outer = sm([[xout + side * 4, bot], [xout - side * 6, 500], [xout, top]], false, 8);
    const pts: P[] = [...inner, ...outer];
    S(pts, C.curtain, { shade: C.curtainD, sd: side < 0 ? [18, -4] : [18, -4], ang: 1.57 });
    for (let k = 0; k < 3; k++) { const fx = lerp(xout, xin, 0.25 + k * 0.25); D([[fx, top + 30], [fx - side * 18 * k + sway, bot - 30]], 10, k % 2 ? C.curtainL : C.curtainD, { alpha: 0.7 }); }
    L(sm([[xin, top], [xin + side * 16 + sway, 400], [xin - side * 30 + sway * 1.5, 620], [xin - side * 50 + sway * 2, bot]], false), 1.5);
  }
  // CLOCK: a starburst, 2:47
  const ck: P = [1000, 330];
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, l = i % 3 === 0 ? 112 : 88; S(place([[40, -4], [l, -1.5], [l, 1.5], [40, 4]], ck, a), C.gold, { rag: 0.2 }); S(ell(ck[0] + Math.cos(a) * l, ck[1] + Math.sin(a) * l, 5, 5, 0, 8), C.gold, { rag: 0.1 }); }
  S(ell(ck[0], ck[1], 46, 46), C.cream, { shade: C.creamD, sd: [8, -4] });
  const mA = -Math.PI / 2 + (47 / 60) * Math.PI * 2, hA = -Math.PI / 2 + ((2 + 47 / 60) / 12) * Math.PI * 2;
  L([ck, [ck[0] + Math.cos(hA) * 24, ck[1] + Math.sin(hA) * 24]], 3.2); L([ck, [ck[0] + Math.cos(mA) * 36, ck[1] + Math.sin(mA) * 36]], 2.2);
  L(sm(ell(ck[0], ck[1], 46, 46), true, 2).slice(0, 30), 1.5);
  // BED: headboard, rail, mattress, pillows, the blanket kicked over the side
  S([[80, 380], [180, 360], [184, 905], [80, 905]], C.wood, { shade: C.woodD, sd: [14, -4] });
  S([[150, 640], [728, 640], [728, 905], [150, 905]], C.wood, { shade: C.woodD, sd: [16, -6], ang: 0.05 });
  D([[170, 700], [700, 696]], 10, C.woodL, { alpha: 0.5 }); D([[170, 820], [700, 826]], 10, C.woodD, { alpha: 0.6 });
  S([[150, 596], [734, 590], [740, 646], [150, 650]], C.sheet, { shade: C.sheetD, sd: [12, -4] });
  S(sm([[196, 540], [330, 528], [372, 560], [344, 596], [210, 600], [184, 572]]), C.cream, { shade: C.creamD, sd: [10, -2] });
  if (st.pillowKept) S(sm([[96, 506], [168, 498], [186, 526], [170, 552], [100, 556], [88, 530]]), mix(C.cream, C.sheetD, 0.25), { shade: C.creamD, sd: [8, -2] });
  const blanket = sm([[380, 580], [520, 566], [640, 584], [690, 622], [672, 720], [636, 790], [596, 736], [556, 776], [508, 720], [460, 640], [380, 610]]);
  S(blanket, C.blanket, { shade: C.blanketD, sd: [16, -6], ang: 1.2 });
  for (let i = 0; i < 40; i++) { const bx = 400 + r() * 280, by = 590 + r() * 190; if (!inside([bx, by], blanket)) continue; S(ell(bx, by, 4, 4, 0, 8), C.cream, { alpha: 0.75, rag: 0 }); }
  L(sm([[690, 622], [672, 720], [636, 790], [596, 736], [556, 776], [508, 720]], false), 1.6);
  L([[150, 640], [376, 640]], 1.6); L([[728, 640], [728, 905]], 1.6); L([[80, 380], [180, 360]], 1.6); L([[180, 360], [182, 594]], 1.6);
  // PAPERS on the floor, each with its crossed-out lines
  ([[340, 990, -0.3], [480, 1028, 0.2], [1300, 1010, 0.12], [1480, 975, -0.45], [580, 960, 0.5]] as [number, number, number][]).forEach(([px, py, a], i) => {
    const pts = place([[-58, -32], [58, -36], [62, 30], [-54, 34]], [px, py], a);
    S(pts, C.paper, { shade: C.creamD, sd: [6, -2], rag: 0.3 });
    for (let k = 0; k < 4; k++) L(place([[-40, -16 + k * 11], [30 - (k % 2) * 16, -16 + k * 11]], [px, py], a), 1.1);
    if (i % 2 === 0) L(place([[-44, 10], [36, -20]], [px, py], a), 1.8, { color: C.crimson });
  });
  // TABLE: round top, three tapered legs; the lamp; the bottle
  const tc: P = [1210, 772];
  [[-86, 1], [70, 1], [-6, 1]].forEach(([dx], i) => S([[tc[0] + dx - 7, tc[1] + 8], [tc[0] + dx + 7, tc[1] + 8], [tc[0] + dx * 1.35 + 3, 968 - i * 18], [tc[0] + dx * 1.35 - 3, 968 - i * 18]], C.woodD, { rag: 0.2 }));
  S(ell(tc[0], tc[1], 128, 22), C.wood, { shade: C.woodD, sd: [10, -6] }); S([[tc[0] - 128, tc[1]], [tc[0] + 128, tc[1]], [tc[0] + 126, tc[1] + 12], [tc[0] - 126, tc[1] + 12]], C.woodD, { rag: 0.2 });
  L(sm(ell(tc[0], tc[1], 128, 22), false, 2).slice(0, 14), 1.6);
  S(ell(LAMP[0], 762, 38, 9), C.gold, { shade: C.mustardD, sd: [6, -2] });
  S([[LAMP[0] - 4, 762], [LAMP[0] + 4, 762], [LAMP[0] + 4, 600], [LAMP[0] - 4, 600]], C.gold, { rag: 0.2 });
  S(ell(LAMP[0], LAMP[1] + 52, 60, 14), C.lampGlow, { rag: 0.4 });
  S([[LAMP[0] - 46, LAMP[1] - 64], [LAMP[0] + 46, LAMP[1] - 64], [LAMP[0] + 70, LAMP[1] + 50], [LAMP[0] - 70, LAMP[1] + 50]], C.cream, { shade: "#d8bf86", sd: [14, -2], ang: 1.57 });
  D([[LAMP[0] + 30, LAMP[1] - 56], [LAMP[0] + 50, LAMP[1] + 44]], 14, C.lampGlow, { alpha: 0.8 });
  L([[LAMP[0] - 46, LAMP[1] - 64], [LAMP[0] + 46, LAMP[1] - 64]], 1.6); L([[LAMP[0] + 46, LAMP[1] - 64], [LAMP[0] + 70, LAMP[1] + 50]], 1.6); L([[LAMP[0] - 70, LAMP[1] + 50], [LAMP[0] + 70, LAMP[1] + 50]], 1.6); L([[LAMP[0] - 46, LAMP[1] - 64], [LAMP[0] - 70, LAMP[1] + 50]], 1.6);
  const bx = 1275, bb = 770;
  const bottle = sm([[bx - 24, bb], [bx + 24, bb], [bx + 26, bb - 108], [bx + 10, bb - 140], [bx + 8, bb - 186], [bx - 8, bb - 186], [bx - 10, bb - 140], [bx - 26, bb - 108]], true, 3);
  S(bottle, C.bottle, { shade: "#1e3a31", sd: [8, -2] });
  if (st.bottle > 0) S([[bx - 24, bb - 106 * st.bottle], [bx + 24, bb - 106 * st.bottle], [bx + 24, bb - 2], [bx - 24, bb - 2]], C.amber, { rag: 0.3 });
  S([[bx - 22, bb - 92], [bx + 22, bb - 92], [bx + 22, bb - 54], [bx - 22, bb - 54]], C.cream, { rag: 0.3 });
  S([[bx - 9, bb - 186], [bx + 9, bb - 186], [bx + 9, bb - 200], [bx - 9, bb - 200]], C.crimson, { rag: 0.1 });
  D([[bx - 14, bb - 130], [bx - 16, bb - 20]], 6, C.curtainL, { alpha: 0.6 });
  L([...bottle.slice(0, Math.floor(bottle.length * 0.6))], 1.6); L([[bx - 14, bb - 78], [bx + 12, bb - 78]], 1.2); L([[bx - 14, bb - 68], [bx + 6, bb - 68]], 1.2);
  if (!st.boy.glass) { const g: P = [1150, 748]; S([[g[0] - 20, g[1] - 50], [g[0] + 20, g[1] - 50], [g[0] + 17, g[1]], [g[0] - 17, g[1]]], C.glass, { alpha: 0.55 }); L([[g[0] - 20, g[1] - 50], [g[0] - 17, g[1]]], 1.6); L([[g[0] - 17, g[1]], [g[0] + 17, g[1]]], 1.6); L([[g[0] + 17, g[1]], [g[0] + 20, g[1] - 50]], 1.6); }
  // floor planks and the wall's weather, dry brush
  for (let i = 0; i < 7; i++) D([[60 + i * 260, 910 + (i % 3) * 50], [260 + i * 260, 912 + (i % 3) * 50]], 10, C.plank, { alpha: 0.6 });
  for (let i = 0; i < 6; i++) D([[100 + i * 300, 80 + (i % 2) * 380], [300 + i * 300, 84 + (i % 2) * 380]], 16, C.wallD, { alpha: 0.5 });
  return e.p;
};

// ---------------------------------------------------------------- the stage (the reference's scalloped frame)
const g = (x: number, m: number, s: number) => Math.exp(-(((x - m) / s) ** 2));
export const STAGE: P[] = (() => {
  const m = 50, cr = 62, out: P[] = [];
  const top = (x: number) => m + 14 - 30 * g(x, W / 2, 150) + 9 * g(x, W / 2 - 300, 90) + 9 * g(x, W / 2 + 300, 90);
  const side = (y: number) => m + 14 - 30 * g(y, H / 2, 110) + 8 * g(y, H / 2 - 220, 70) + 8 * g(y, H / 2 + 220, 70);
  const corner = (cx: number, cy: number, a0: number) => { for (let i = 0; i <= 10; i++) { const a = a0 - (i / 10) * (Math.PI / 2); out.push([cx + Math.cos(a) * cr, cy + Math.sin(a) * cr]); } };
  const n = 60;
  for (let i = 0; i <= n; i++) { const x = m + cr + ((W - 2 * m - 2 * cr) * i) / n; out.push([x, top(x)]); }
  corner(W - m + 4, m - 4, Math.PI);
  for (let i = 0; i <= n; i++) { const y = m + cr + ((H - 2 * m - 2 * cr) * i) / n; out.push([W - side(y), y]); }
  corner(W - m + 4, H - m + 4, -Math.PI / 2);
  for (let i = 0; i <= n; i++) { const x = W - m - cr - ((W - 2 * m - 2 * cr) * i) / n; out.push([x, H - top(x)]); }
  corner(m - 4, H - m + 4, 0);
  for (let i = 0; i <= n; i++) { const y = H - m - cr - ((H - 2 * m - 2 * cr) * i) / n; out.push([side(y), y]); }
  corner(m - 4, m - 4, Math.PI / 2);
  return out;
})();
const trace = (c: Ctx, s: P[]) => { c.beginPath(); s.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };
export const stageFrame = (c: Ctx, env: Env) => {
  c.setTransform(env.scale, 0, 0, env.scale, 0, 0);
  c.fillStyle = C.navy; c.beginPath(); c.rect(0, 0, W, H); STAGE.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill("evenodd");
  // a printed pattern on the border: small cream dots, as the reference's halftone
  c.save(); c.beginPath(); c.rect(0, 0, W, H); STAGE.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.clip("evenodd");
  c.fillStyle = C.curtainD; for (let y = 6; y < H; y += 14) for (let x = (y / 14) % 2 ? 7 : 0; x < W; x += 14) { c.beginPath(); c.arc(x, y, 1.8, 0, 6.283); c.fill(); }
  c.restore();
  c.strokeStyle = C.gold; c.lineWidth = 3; c.lineJoin = "round"; trace(c, STAGE); c.stroke();
  c.globalAlpha = 0.45; c.lineWidth = 1.5; trace(c, STAGE.map(([x, y]) => [W / 2 + (x - W / 2) * 0.988, H / 2 + (y - H / 2) * 0.978] as P)); c.stroke(); c.globalAlpha = 1;
};

// ---------------------------------------------------------------- lettering (brush cream, ink plate off register)
export const lyric = (c: Ctx, env: Env, words: string[], t: number, at: number[], x: number, y: number, size: number, color = C.cream) => {
  c.setTransform(env.scale, 0, 0, env.scale, 0, 0);
  c.font = `italic 700 ${size}px "PaaroHand", Georgia, serif`; c.textBaseline = "alphabetic";
  const sp = c.measureText(" ").width, total = words.reduce((a, w) => a + c.measureText(w).width, 0) + sp * (words.length - 1);
  let cx = x - total / 2;
  words.forEach((w, i) => {
    const p = Math.min(1, Math.max(0, (t - at[i]) / 0.3)), ww = c.measureText(w).width;
    if (p > 0) { const k = 1 + 0.07 * Math.sin(p * Math.PI); c.save(); c.translate(cx + ww / 2, y + (1 - p) * 14); c.scale(k, 2 - k); c.globalAlpha = p; c.fillStyle = C.ink; c.fillText(w, -ww / 2 + 3, 3); c.fillStyle = color; c.fillText(w, -ww / 2, 0); c.restore(); }
    cx += ww + sp;
  });
  c.globalAlpha = 1;
};

// ---------------------------------------------------------------- the look still
export const drawRoomShot = (ctx: Ctx, env: Env, st: RoomState, z = 1, f: P = [W / 2, H / 2]) => {
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.fillStyle = C.navy; ctx.fillRect(0, 0, W, H);
  ctx.save(); trace(ctx, STAGE); ctx.clip();
  const k = env.scale; ctx.setTransform(k * z, 0, 0, k * z, k * (W / 2 - f[0] * z), k * (H / 2 - f[1] * z));
  paint(ctx, env, roomPainting(st), C.ink);
  paint(ctx, env, boyPainting(st.boy), C.ink);
  ctx.restore();
};
