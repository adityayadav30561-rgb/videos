import { Gfx, rng, fractal, type Ctx, type Env, type Medium, type P } from "./core";
import type { Film } from "./film";
import { clamp, inside } from "./gallery";
import { brush, tone, JIAO, NONG, ZHONG, DAN, QING, type Brush } from "./sumiEKit";

// THE GLASS AT THE BEDSIDE · sumi-e (水墨, ink painting on xuan paper).
//
// IDEA: late at night a young man sits on the floor against the side of his bed, head hung over a
// half-full glass of something dark; the small lamp beside him is the only thing in the room the
// ink has not swallowed. FOCAL SUBJECT: the hand round the glass, and the bowed head above it.
// MEDIUM: one soft brush of real hairs (sumiEKit.brush), one ink at five dilutions, unsized xuan.
// No outline, no colour but the seal. Tone only by dilution and by a second stroke crossing a first.
// LIGHT: one bedside lamp on a nightstand, left. Sumi-e carries light by leaving paper: the room is
// laid in wet side-brush washes that stack darker with distance from the lamp, and everything the
// lamp reaches (the shade, the nightstand top, his crown, cheek, hand, the glass, the tops of his
// knees and the floor before him) is paper the brush went round. His back, the bed beyond him and
// his own shadow thrown on the mattress are the deepest ink.
// POSE (reference, from knowledge: Loomis's 7.5-head adult canon, Winter's segment lengths; Liang
// Kai's and Xu Beihong's ink figures for the economy of strokes): seated on the floor, back against
// the mattress, knees drawn up, near elbow resting on the near thigh, the forearm across the knee,
// the hand hanging past it with the glass held by the rim; the head bowed about 40 degrees, chin
// tucked, eyes shut. Head 88 px tall: upper arm 115, forearm 91, thigh 164, shin 154 (checked).
// The tumbler at life size against the head: about 13 cm to 23 cm, so 54 px tall.
// ORDER (figure painting): the room's washes first, wet into damp paper, light to dark; then the
// furniture; then the figure: the face and hand in fine line, the hair in one wet mass, the
// clothing in broad strokes, the contact shadows; then the glass and what is in it; the seal last.

const SUMI_M: Medium = { nib: 1, taper: 1, pressure: 1, retrace: false, wobble: 0, rough: 0 };
const PAPER = "#f3ede0";
const W = 1080, H = 1080;
const LAMP: P = [262, 522]; // the bulb, inside the shade

// ---------------------------------------------------------------- shapes the washes go round
// the figure's silhouette, a little generous: the room's ink stops at it and his own strokes take over
const FIG: P[] = [[590, 626], [612, 616], [636, 624], [656, 664], [702, 686], [724, 734], [728, 800], [714, 852], [708, 898], [450, 900], [456, 892], [504, 872], [516, 832], [526, 800], [518, 790], [510, 846], [478, 848], [472, 796], [490, 772], [530, 752], [548, 734], [566, 732], [612, 756], [628, 728], [606, 722], [588, 712], [578, 690], [578, 662]];
const SHADE: P[] = [[198, 454], [326, 454], [356, 548], [168, 548]];
// the nightstand's front, in the lamp's own shadow under its top
const NS_FRONT: P[] = [[118, 664], [338, 664], [338, 902], [118, 902]];
// his shadow, thrown right and down onto the blanket and the mattress side behind him
const CAST: P[] = [[640, 640], [700, 618], [752, 640], [790, 700], [818, 772], [826, 842], [830, 900], [712, 900], [728, 800], [730, 736], [706, 684]];

const ss = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const edgeY = (x: number) => 640 - (x - 352) * 0.0193; // the mattress edge, running gently up as it recedes
// how much ink the room holds at a point, 0 (bare paper) .. 1 (scorched): the wash is laid region by
// region the way a painter thinks of it (wall, bed top, blanket, under the bed, floor, nightstand),
// each darkening with distance from the lamp
const roomTone = (x: number, y: number) => {
  if (inside(FIG, x, y) || inside(SHADE, x, y)) return 0;
  const d = Math.hypot(x - LAMP[0], (y - LAMP[1]) * 0.92);
  let wall = 0.04 + 0.9 * ss(85, 500, d) + 0.22 * ss(330, 150, y) * ss(60, 260, d);
  if (y < 456) { const up = 456 - y, half = 70 + up * 0.42; wall *= 0.6 + 0.4 * ss(half * 0.5, half * 1.6, Math.abs(x - LAMP[0])); } // the shade throws its light up the wall
  let v = wall;
  if (x > 112 && x < 344 && y > 648 && y < 664) v = 0.02;                                  // the nightstand top, in the full light
  else if (x > 118 && x < 338 && y >= 664 && y < 902) v = 0.4 + 0.2 * ((y - 664) / 238);  // its face, under its own top
  else if (x > 352 && y < 902) {
    const e = edgeY(x);
    if (y > e - 24 && y <= e) v = wall * 0.5;                    // the mattress top, a lit plane seen from a little above
    else if (y > e && y <= 792) v = 0.08 + wall * 0.8;           // the blanket hanging down the side
    else if (y > 792 && y <= 808) v = 0.12 + wall * 0.85;        // the rail
    else if (y > 808) v = 0.62 + 0.3 * ss(250, 800, d);          // under the bed: no light goes there
  } else if (y >= 902) v = 0.04 + 0.62 * ss(150, 720, d);       // the floor
  if (inside(CAST, x, y)) v = Math.min(0.94, v + 0.36);           // his shadow, thrown on the bed
  return clamp(v);
};
// his clothes, each one wash laid flat and lighter toward the lamp: a dark T-shirt, grey track trousers.
// What is skin (face, neck, forearm, hand) stays paper, so the lamp lands there hardest.
const SHIRT: P[] = [[628, 718], [646, 706], [662, 690], [656, 668], [700, 686], [726, 734], [730, 800], [716, 852], [706, 898], [652, 898], [640, 850], [634, 818], [646, 790], [664, 762], [626, 760], [636, 734]];
const TROUSERS: P[] = [[548, 736], [566, 732], [612, 756], [636, 816], [660, 846], [690, 876], [706, 898], [558, 900], [540, 890], [512, 872], [522, 834], [534, 790], [544, 750]];
const clothes = (x: number, y: number) => inside(SHIRT, x, y) ? 0.3 + 0.32 * ss(600, 720, x) : inside(TROUSERS, x, y) ? 0.1 + 0.3 * ss(520, 650, x + (y - 760) * 0.4) : 0;
// the figure's own shadow side, laid as wet washes before his lines
const FIG_SHADOWS: [P[], number][] = [
  [[[656, 668], [700, 686], [726, 734], [730, 800], [716, 852], [706, 900], [654, 898], [644, 852], [668, 804], [680, 752], [672, 708]], 0.8],
  [[[680, 700], [674, 742], [656, 782], [632, 812], [626, 800], [646, 760], [660, 716]], 0.5],
  [[[628, 716], [656, 670], [664, 694], [646, 718]], 0.55],
  [[[582, 782], [596, 800], [640, 828], [690, 880], [706, 900], [560, 900], [568, 866], [584, 826]], 0.62],
  [[[632, 814], [600, 802], [570, 790], [542, 774], [546, 786], [576, 802], [612, 818]], 0.32],
  [[[542, 774], [528, 784], [514, 798], [520, 790], [534, 780]], 0.3],
];
// lay a wash: a field of ink tone over the sheet, wet into damp paper, so it blooms and mottles
// where the water carried more or less of it, and goes soft at every edge
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const wash = (g: Gfx, x0: number, y0: number, x1: number, y1: number, toneAt: (x: number, y: number) => number, seed: number, cell: number, blur: number) => g.group("plain", () => {
  // the field is sampled once per cell into a small sheet and laid down with smoothing on, so the
  // tone flows between samples the way water carries it, with no seams between cells
  const c = g.cur, nw = Math.ceil((x1 - x0) / cell), nh = Math.ceil((y1 - y0) / cell), L = g.env.canvas(nw, nh), id = L.ctx.createImageData(nw, nh);
  for (let j = 0; j < nh; j++) for (let i = 0; i < nw; i++) {
    const x = x0 + (i + 0.5) * cell, y = y0 + (j + 0.5) * cell;
    let v = toneAt(x, y); if (v <= 0.005) continue;
    v *= 0.86 + 0.22 * fractal(seed, x, y, 0.011, 0.011, 3) + 0.08 * (fractal(seed + 7, x, y, 0.05, 0.05, 2) - 0.5);
    const t = tone(clamp(v)), [r, gg, b] = rgb(t.color), o = (j * nw + i) * 4; id.data[o] = r; id.data[o + 1] = gg; id.data[o + 2] = b; id.data[o + 3] = Math.round(t.alpha * 255);
  }
  L.ctx.putImageData(id, 0, 0); g.touch(x0, y0, x1, y1);
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = "high"; c.drawImage(L.canvas as CanvasImageSource, x0, y0, nw * cell, nh * cell);
}, { blend: "multiply", blur });
// ---------------------------------------------------------------- the paper
const ground = (g: Gfx) => {
  const c = g.cur, e = g.env; c.setTransform(e.scale, 0, 0, e.scale, 0, 0); c.fillStyle = PAPER; c.fillRect(0, 0, e.W, e.H);
  g.group("plain", () => {
    const k = g.cur, r = rng(1501); k.lineCap = "round";
    for (let i = 0; i < 340; i++) {
      const x = r() * e.W, y = r() * e.H, a = (fractal(1502, x, y, 0.004, 0.004, 2) - 0.5) * 5, L = 18 + r() * 70, bend = (r() - 0.5) * 0.5;
      k.strokeStyle = r() < 0.5 ? "#d9cfbc" : "#fbf7ee"; k.globalAlpha = 0.35 + r() * 0.35; k.lineWidth = 0.4 + r() * 0.6;
      k.beginPath(); k.moveTo(x, y); k.quadraticCurveTo(x + Math.cos(a + bend) * L * 0.5, y + Math.sin(a + bend) * L * 0.5, x + Math.cos(a) * L, y + Math.sin(a) * L); k.stroke();
    }
    for (let i = 0; i < 26; i++) { const x = r() * e.W, y = r() * e.H, a = r() * 6.28, L = 1.5 + r() * 4; k.strokeStyle = "#8f806b"; k.globalAlpha = 0.25 + r() * 0.3; k.lineWidth = 0.6 + r() * 0.5; k.beginPath(); k.moveTo(x, y); k.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); k.stroke(); }
    k.globalAlpha = 1; g.touch(0, 0, e.W, e.H);
  });
};

// ---------------------------------------------------------------- brush helpers
// a fine line: the tip only, pressed a little in the middle, lifted to a point
const line = (ctrl: P[], w: number, ink: number, seed: number, o: Partial<Brush> = {}): Brush => ({ ctrl, w, ink, press: [[0, 0.35], [0.25, 1], [0.75, 0.85], [1, 0.15]], load: 1, dry: 0.12, edge: 0, split: 0.35, bleed: 0.3, slow: [[0.02, 0.35]], hairs: Math.max(6, Math.round(w * 2.4)), seed, ...o });
// a side-laid brush, pressed flat and dragged: clothing, furniture, masses
const side = (ctrl: P[], w: number, ink: number, seed: number, o: Partial<Brush> = {}): Brush => ({ ctrl, w, ink, press: [[0, 0.45], [0.18, 1], [0.8, 0.9], [1, 0.35]], load: 1, dry: 0.35, edge: 0.35, split: 0.8, bleed: 0.55, slow: [[0.03, 0.5]], streak: true, seed, ...o });

// ---------------------------------------------------------------- the room's visible brushwork


// ---------------------------------------------------------------- the room's visible brushwork
// over the wash, a few broad strokes of a loaded brush laid into the still-damp sheet, so the dark is
// MADE and not filled: the wall beyond the bed in long leaning strokes, the dark beyond the lamp's reach,
// under the bed one heavy horizontal
const wetStroke = (ctrl: P[], w: number, ink: number, seed: number): Brush => ({ ctrl, w, ink, press: [[0, 0.4], [0.15, 1], [0.85, 0.95], [1, 0.4]], load: 1.3, dry: 0.04, edge: 0.15, split: 0.2, bleed: 0.6, wet: 1, slow: [[0.03, 0.6], [0.97, 0.4]], hairs: 46, seed });
const ROOM_STROKES: Brush[] = [
  wetStroke([[700, 150], [760, 300], [800, 470], [820, 600]], 120, DAN, 2100),
  wetStroke([[830, 140], [880, 300], [910, 460], [930, 610]], 140, ZHONG, 2101),
  wetStroke([[560, 140], [610, 230], [650, 330]], 90, QING, 2102),
  wetStroke([[700, 860], [830, 856], [980, 862]], 70, ZHONG, 2104),
];

// ---------------------------------------------------------------- the furniture
const FURNITURE: Brush[] = [
  // the nightstand: its top edge in the light (a thin line, the plane above it left as paper), the
  // front's two sides (the face itself is the wash), the drawer's gap, a knob
  line([[112, 652], [220, 648], [344, 652]], 3.2, ZHONG, 101, { dry: 0.2 }),
  line([[118, 664], [230, 662], [340, 664]], 2.2, NONG, 102, { dry: 0.3 }),
  line([[120, 666], [118, 780], [120, 900]], 3, NONG, 103, { dry: 0.35 }),
  line([[336, 666], [338, 780], [336, 900]], 3.4, JIAO, 104, { dry: 0.35 }),
  line([[128, 740], [232, 738], [330, 741]], 2.6, NONG, 105, { dry: 0.3 }),
  line([[226, 704], [229, 707]], 6, JIAO, 106, { press: [[0, 1], [1, 1]], bleed: 0.7, slow: [[0.5, 0.6]] }),
  // the lamp: a pleated drum shade glowing from inside (paper, three faint lines), the rims, the
  // stem in scorched ink, a heavy round base sitting on the nightstand
  line([[200, 455], [262, 451], [324, 455]], 2.4, DAN, 110, { dry: 0.2 }),
  line([[198, 456], [184, 500], [168, 546]], 2.4, DAN, 111, { dry: 0.25 }),
  line([[326, 456], [340, 500], [356, 546]], 2.2, ZHONG, 112, { dry: 0.3 }),
  line([[168, 547], [262, 556], [357, 547]], 2.6, ZHONG, 113, { dry: 0.25 }),
  line([[232, 460], [226, 505], [220, 548]], 1.2, QING, 114, { dry: 0.3, bleed: 0.2 }),
  line([[296, 460], [302, 505], [308, 549]], 1.2, QING, 115, { dry: 0.3, bleed: 0.2 }),
  line([[262, 557], [263, 600], [262, 628]], 4.5, JIAO, 116, { dry: 0.15 }),
  side([[232, 638], [262, 632], [294, 638]], 20, NONG, 117, { dry: 0.2, edge: 0, split: 0.3, streak: false }),
  // the bed: the mattress edge running away into the dark, the blanket hanging over the side in
  // a few long folds, its hem, the bed rail, the floor line
  line([[352, 640], [520, 637], [700, 633], [900, 629], [1084, 626]], 3, ZHONG, 120, { dry: 0.45, press: [[0, 0.5], [0.15, 1], [1, 0.6]] }),
  line([[352, 640], [348, 700], [352, 788]], 3.4, NONG, 121, { dry: 0.3 }),
  line([[354, 786], [400, 792], [446, 787], [462, 790]], 3.2, ZHONG, 122, { dry: 0.35 }),
  line([[396, 646], [404, 700], [398, 760], [404, 788]], 2, DAN, 123, { dry: 0.4 }),
  line([[450, 652], [444, 716], [452, 786]], 1.8, DAN, 124, { dry: 0.45 }),
  line([[358, 806], [410, 808], [458, 806]], 5, NONG, 125, { dry: 0.4, press: [[0, 0.6], [0.2, 1], [0.85, 0.8], [1, 0.2]] }),
  line([[790, 790], [880, 796], [960, 788], [1084, 794]], 3, NONG, 126, { dry: 0.5 }),
  line([[870, 650], [878, 716], [870, 788]], 3, JIAO, 127, { dry: 0.5 }),
  line([[950, 648], [944, 716], [954, 790]], 3, JIAO, 128, { dry: 0.5 }),
  line([[0, 902], [60, 901], [118, 902]], 2.4, ZHONG, 129, { dry: 0.5 }),
];

// ---------------------------------------------------------------- the head
// authored upright in profile-three-quarter, facing LEFT, origin at the middle of the skull, then
// bowed forward 40 degrees about that origin and set on the neck
const HEAD_AT: P = [612, 668], BOW = (-40 * Math.PI) / 180;
const hd = (pts: [number, number][]): P[] => pts.map(([x, y]) => [HEAD_AT[0] + x * Math.cos(BOW) - y * Math.sin(BOW), HEAD_AT[1] + x * Math.sin(BOW) + y * Math.cos(BOW)]);
const HEAD: Brush[] = [
  // the face, one fine line of light ink: brow, the dip at the eye, the nose, the lips, the chin
  line(hd([[-35, -8], [-38, -1], [-36, 4], [-41, 10], [-46, 15], [-43, 18], [-38, 19]]), 2.2, ZHONG, 201, { dry: 0.15 }),
  line(hd([[-38, 23], [-40, 25.5], [-36, 27.5]]), 1.8, NONG, 202, { dry: 0.1, slow: [] }),
  line(hd([[-38, 31], [-36, 35], [-35, 39], [-30, 44], [-22, 46]]), 2, ZHONG, 203, { dry: 0.15 }),
  // the jaw, lost where it turns into his own shadow
  line(hd([[-22, 46], [-6, 44], [8, 36]]), 1.8, DAN, 204, { dry: 0.35 }),
  // the near eye, shut: the lid's curve and a few lashes pressed down; the brow drawn up at the
  // inner end, which is grief, and dropping away outward
  line(hd([[-31, 5], [-25, 8], [-18, 7]]), 2.2, NONG, 205, { press: [[0, 0.6], [0.4, 1], [1, 0.2]], dry: 0.05 }),
  line(hd([[-33, -6], [-27, -8.5], [-19, -7], [-12, -3]]), 3.2, NONG, 206, { press: [[0, 1], [0.4, 0.8], [1, 0.1]], dry: 0.3 }),
  // the ear, a single hooked stroke and its inner fold, half under the hair
  line(hd([[10, -2], [17, -6], [21, 2], [19, 12], [14, 20], [11, 22]]), 2.2, ZHONG, 207, { dry: 0.2 }),
  line(hd([[14, 4], [16, 10], [13, 15]]), 1.4, DAN, 208, { dry: 0.2, slow: [] }),
  // the hair: one wet mass of scorched ink, pressed from the nape up over the crown and dragged
  // forward, the brush running dry so the lit crown breaks into flying white; then a fringe falling
  // over the brow, and two loose strands
  side(hd([[36, 28], [42, 4], [34, -24], [14, -44], [-12, -46], [-32, -30]]), 26, JIAO, 210, { load: 0.95, dry: 0.75, edge: 0.3, split: 0.95, bleed: 0.6, slow: [[0.03, 0.8]] }),
  side(hd([[30, 18], [26, -6], [10, -30], [-14, -36], [-36, -20]]), 22, NONG, 211, { load: 1.05, dry: 0.5, split: 0.9 }),
  side(hd([[-20, -38], [-34, -26], [-40, -12], [-37, -2]]), 13, JIAO, 212, { dry: 0.45, press: [[0, 0.7], [0.3, 1], [1, 0.05]] }),
  line(hd([[-6, -42], [-22, -30], [-30, -14], [-28, -4]]), 3, JIAO, 213, { dry: 0.3 }),
  line(hd([[26, 22], [30, 34], [27, 42]]), 3.5, NONG, 214, { dry: 0.4 }),
];

// ---------------------------------------------------------------- the body
const BODY: Brush[] = [
  // the back, rounded over his knees: one long stroke of heavy ink from the nape to the floor, the
  // spine's curve; then the shirt's shadow side in broad wet strokes against it, darkest at the back
  side([[656, 670], [700, 688], [724, 732], [728, 790], [716, 846], [708, 896]], 10, JIAO, 301, { dry: 0.2, streak: false, split: 0.3, press: [[0, 0.6], [0.2, 1], [0.8, 0.9], [1, 0.5]] }),
  side([[690, 694], [706, 740], [708, 800], [698, 860]], 44, ZHONG, 302, { dry: 0.45, wet: 0.4 }),
  side([[664, 712], [682, 760], [686, 820], [682, 878]], 34, DAN, 303, { dry: 0.6, wet: 0.5 }),
  // the collar and shoulder, the near side, in the light: a thin line and the deltoid's turn
  line([[628, 718], [646, 706], [662, 698], [680, 698]], 2.4, ZHONG, 304, { dry: 0.3 }),
  // the near upper arm, hanging from the shoulder to the elbow on his thigh: sleeve line, the
  // underside in shadow, the hem round the arm
  line([[680, 700], [674, 742], [656, 782], [632, 812]], 2.6, NONG, 305, { dry: 0.3 }),
  line([[640, 722], [628, 756], [612, 786]], 2.2, ZHONG, 306, { dry: 0.3 }),
  line([[628, 760], [648, 768], [668, 760]], 2, ZHONG, 307, { dry: 0.3, slow: [] }),
  side([[668, 716], [662, 756], [648, 790]], 18, ZHONG, 308, { dry: 0.55, wet: 0.3 }),
  // the forearm across the knee, wrist toward the light: two lines that do not quite meet the elbow
  line([[612, 790], [586, 778], [560, 766], [536, 754]], 2.4, ZHONG, 309, { dry: 0.25 }),
  line([[632, 814], [600, 802], [570, 790], [542, 774]], 2.4, NONG, 310, { dry: 0.3 }),
  side([[628, 808], [596, 796], [566, 786]], 9, DAN, 311, { dry: 0.6 }),
  // the near leg: the knee's top in the light (one line), the shin straight to the ankle, the calf
  // pressed against the thigh; the underside of the thigh and the calf in shadow
  line([[612, 758], [588, 742], [566, 734], [550, 736], [544, 748]], 2.6, ZHONG, 320, { dry: 0.3 }),
  line([[544, 750], [541, 762], [538, 772]], 2.6, NONG, 321, { dry: 0.25, press: [[0, 0.6], [0.3, 1], [1, 0.4]] }),
  line([[524, 822], [518, 848], [512, 872]], 2.6, NONG, 327, { dry: 0.25 }),
  line([[580, 780], [582, 824], [566, 862], [542, 888]], 2.4, NONG, 322, { dry: 0.35 }),
  side([[590, 792], [592, 836], [576, 876]], 24, ZHONG, 323, { dry: 0.5, wet: 0.4 }),
  side([[640, 826], [668, 860], [696, 890]], 30, NONG, 324, { dry: 0.5, wet: 0.4 }),
  // the far knee, just over the near one, and the fold where the trouser bunches behind the knee
  line([[566, 730], [580, 724], [596, 728]], 2, DAN, 325, { dry: 0.3 }),
  line([[584, 806], [600, 818], [612, 836]], 1.8, ZHONG, 326, { dry: 0.4 }),
  // the near foot in a sock, flat on the floor, toes toward the light; the far foot's toes behind
  line([[512, 872], [494, 882], [472, 890], [452, 896]], 2.4, ZHONG, 330, { dry: 0.25 }),
  line([[452, 896], [446, 900], [490, 902], [540, 900]], 2.6, NONG, 331, { dry: 0.3 }),
  line([[540, 900], [546, 892], [542, 886]], 2.4, NONG, 332, { dry: 0.3 }),
  line([[560, 880], [574, 890], [580, 900]], 2.2, ZHONG, 333, { dry: 0.4 }),
  // contact shadows: the seat and the feet press on the floor, so the floor darkens hard under them
  side([[444, 904], [500, 906], [548, 904]], 9, JIAO, 340, { dry: 0.2, edge: 0, split: 0.3, streak: false }),
  side([[560, 904], [640, 907], [724, 904]], 14, JIAO, 341, { dry: 0.25, streak: false }),
];

// ---------------------------------------------------------------- the hand and the glass
// a plain heavy tumbler, half full of something dark, held loosely round its empty upper half: the
// back of the hand toward us, three fingers wrapped across the front of the glass, the little
// finger tucked under, the thumb behind. The lamp is to the left: the left wall of the glass and the
// left of the liquid's surface catch it, and stay paper.
const GL = { x: 489, top: 783, h: 64, rt: 20, rb: 16.5, tilt: 0.06 };
const gp = (u: number, v: number): P => { const y = GL.top + v * GL.h, r = GL.rt + (GL.rb - GL.rt) * v, x = GL.x + u * r + (y - GL.top) * GL.tilt; return [x, y]; };
const ell = (v: number, ry: number, from: number, to: number, n = 11): P[] => Array.from({ length: n }, (_, i) => { const a = from + ((to - from) * i) / (n - 1), [x, y] = gp(Math.cos(a), v); return [x, y + Math.sin(a) * ry]; });
const LIQ = 0.5; // half full
// the liquid as one wet wash of thick ink: the surface's front curve, down both walls, round the base
const LIQUID: P[] = [...ell(LIQ, 3.4, Math.PI, 0, 13), gp(1, 0.93), ...ell(0.93, 3, 0, Math.PI, 13)];
const LIQ_LIT: P[] = [gp(-0.92, LIQ + 0.07), gp(-0.62, LIQ + 0.09), gp(-0.66, 0.9), gp(-0.9, 0.9)]; // the lamp's reflection down the near wall
const liquidTone = (x: number, y: number) => (inside(LIQUID, x, y) ? (inside(LIQ_LIT, x, y) ? 0.3 : 0.9) : 0);
const GLASS: Brush[] = [
  // the far half of the rim, light; its near half, firmer; the liquid's surface; the walls; the heavy base
  line(ell(0, 4.6, Math.PI * 1.04, Math.PI * 1.96), 1.3, DAN, 410, { dry: 0.1, slow: [] }),
  line(ell(0, 4.6, Math.PI * 0.06, Math.PI * 0.6), 1.5, ZHONG, 414, { dry: 0.1, slow: [] }),
  line(ell(LIQ, 3.4, Math.PI * 0.04, Math.PI * 0.96), 1.6, JIAO, 403, { dry: 0.05, slow: [] }),
  line([gp(1, 0.5), gp(1, 0.75), gp(1, 1)], 2, NONG, 411, { dry: 0.1 }),
  line([gp(-1, 0.46), gp(-1, 0.72), gp(-1, 1)], 1.3, ZHONG, 412, { dry: 0.25, slow: [] }),
  side(ell(0.955, 3.4, Math.PI * 0.02, Math.PI * 0.98, 9), 3.6, JIAO, 413, { dry: 0.15, edge: 0, streak: false, split: 0.2 }),
];
// the hand as one form round the glass: its outline, the fingertips rounding off past the glass's
// left wall, the two gaps between the fingers drawn only as far as they show, the knuckles
const HANDSHAPE: P[] = [[536, 754], [522, 770], [510, 786], [496, 789.5], [480, 789.5], [469, 789], [466.5, 793], [468, 797], [466.5, 800.5], [468, 804.5], [467, 808], [470, 811], [482, 811.5], [494, 812], [500, 816.5], [512, 818], [522, 804], [532, 788], [542, 774]];
const handTone = (x: number, y: number) => (inside(HANDSHAPE, x, y) ? 0.06 + 0.2 * ss(796, 818, y) + 0.08 * ss(500, 540, x) : 0);
const HAND: Brush[] = [
  line([[538, 752], [524, 766], [512, 782], [506, 788], [492, 790], [478, 790], [469, 789]], 2.2, ZHONG, 501, { dry: 0.15, press: [[0, 0.7], [0.3, 1], [0.9, 0.8], [1, 0.4]] }),
  line([[469, 789], [466.5, 792.5], [468.5, 796.5]], 1.8, NONG, 502, { dry: 0.05, slow: [] }),
  line([[468.5, 797], [466.5, 800.5], [468.5, 804]], 1.8, NONG, 503, { dry: 0.05, slow: [] }),
  line([[468.5, 804.5], [467, 808], [471, 811], [484, 811.6], [494, 812]], 1.9, NONG, 504, { dry: 0.1, slow: [] }),
  line([[494, 812], [500, 816.5], [510, 818], [520, 806], [532, 790], [544, 774]], 2.4, NONG, 505, { dry: 0.2 }),
  line([[469, 797], [478, 798.4], [488, 798.6]], 1.3, ZHONG, 506, { dry: 0.2, slow: [], press: [[0, 1], [1, 0.1]] }),
  line([[469, 804.5], [480, 805.6], [491, 805.6]], 1.3, ZHONG, 507, { dry: 0.2, slow: [], press: [[0, 1], [1, 0.1]] }),
  line([[506, 790], [510, 794]], 1.4, DAN, 508, { dry: 0.2, slow: [] }), line([[509, 798], [513, 801]], 1.4, DAN, 509, { dry: 0.2, slow: [] }), line([[511, 806], [515, 808]], 1.3, DAN, 510, { dry: 0.2, slow: [] }),
];

// ---------------------------------------------------------------- the seal
const SEAL = { x: 42, y: 980, s: 58 }; // in sheet units, lower left, on the lamp-lit floor
const GLYPHS: [number, number][][][] = [
  [[[0.14, 0.18], [0.86, 0.18]], [[0.5, 0.18], [0.5, 0.86]], [[0.2, 0.5], [0.8, 0.5]], [[0.16, 0.86], [0.84, 0.86]]],
  [[[0.2, 0.12], [0.2, 0.88], [0.8, 0.88]], [[0.2, 0.42], [0.74, 0.42], [0.74, 0.12]], [[0.48, 0.42], [0.48, 0.7]]],
  [[[0.12, 0.3], [0.88, 0.3]], [[0.5, 0.1], [0.5, 0.9]], [[0.22, 0.62], [0.36, 0.78]], [[0.78, 0.62], [0.64, 0.78]]],
  [[[0.2, 0.16], [0.8, 0.16], [0.8, 0.84], [0.2, 0.84], [0.2, 0.16]], [[0.2, 0.5], [0.8, 0.5]]],
];
const seal = (g: Gfx) => {
  const { x, y, s } = SEAL, r = rng(1900);
  g.group("plain", () => {
    const k = g.cur; g.touch(x - 4, y - 4, x + s + 4, y + s + 4);
    k.fillStyle = "#b8352b"; k.globalAlpha = 0.92; k.beginPath();
    for (let i = 0; i < 40; i++) { const t = i / 10, sd = Math.floor(t), f = t - sd, j = (fractal(1901, i, 0, 0.7, 0.7, 2) - 0.5) * 2.2; const [a, b] = sd === 0 ? [x + s * f, y + j] : sd === 1 ? [x + s + j, y + s * f] : sd === 2 ? [x + s * (1 - f), y + s + j] : [x + j, y + s * (1 - f)]; i ? k.lineTo(a, b) : k.moveTo(a, b); }
    k.closePath(); k.fill();
    k.globalCompositeOperation = "destination-out"; k.globalAlpha = 1; k.lineCap = "square"; k.lineJoin = "miter";
    const cell = (s - 12) / 2, order = [[1, 0], [1, 1], [0, 0], [0, 1]];
    GLYPHS.forEach((gl, gi) => { const [cx, cy] = order[gi], ox = x + 6 + cx * cell, oy = y + 6 + cy * cell; gl.forEach((ln) => { k.lineWidth = cell * 0.13 * (0.9 + r() * 0.25); k.beginPath(); ln.forEach(([u, v], i) => { const px = ox + cell * (0.08 + u * 0.84) + (r() - 0.5) * 0.8, py = oy + cell * (0.08 + v * 0.84) + (r() - 0.5) * 0.8; i ? k.lineTo(px, py) : k.moveTo(px, py); }); k.stroke(); }); });
    k.lineWidth = 1.6; k.strokeRect(x + 3.2, y + 3.2, s - 6.4, s - 6.4);
    for (let i = 0; i < 90; i++) { const px = x + r() * s, py = y + r() * s, lighter = fractal(1902, px, py, 0.06, 0.06, 2); if (lighter < 0.52) continue; k.globalAlpha = (lighter - 0.5) * 1.4; k.beginPath(); k.arc(px, py, 0.5 + r() * 1.3, 0, 6.28); k.fill(); }
    k.globalCompositeOperation = "source-over"; k.globalAlpha = 1;
  }, { blend: "multiply", textures: ["risoSpeck"] });
};

// ---------------------------------------------------------------- the painting, in the hand's order
// the scene is authored at 1:1 and framed closer: 1.28x about the figure's knee, so the lamp's
// left edge and the bed's far end fall just outside the sheet
const VIEW = { s: 1.28, about: [500, 700] as P };
const draw = (ctx: Ctx, _f: number, env: Env) => {
  const g = new Gfx(ctx, env, 0, SUMI_M);
  ground(g);
  g.push(VIEW.about[0] * (1 - VIEW.s), VIEW.about[1] * (1 - VIEW.s), VIEW.s);
  wash(g, 100, 140, 980, 1010, roomTone, 1700, 3, 2.5);
  wash(g, 440, 600, 740, 910, clothes, 1790, 1.5, 2.5);
  FIG_SHADOWS.forEach(([poly, v], i) => wash(g, 440, 600, 740, 910, (x, y) => (inside(poly, x, y) ? v : 0), 1800 + i, 1.5, 2.5));
  [...ROOM_STROKES, ...FURNITURE, ...HEAD, ...BODY].forEach((b) => brush(g, b));
  wash(g, 460, 776, 520, 856, liquidTone, 1850, 1, 1);
  wash(g, 460, 745, 550, 825, handTone, 1860, 1, 1.2);
  [...GLASS, ...HAND].forEach((b) => brush(g, b));
  g.pop();
  seal(g);
  g.paper("paper", 0.1); g.paper("coldpress", 0.045);
};

export const bedsideGlass: Film = {
  meta: { title: "The glass at the bedside · sumi-e", W, H, fps: 30, bpm: 120, durationFrames: 1, raster: "cpu" },
  assets: { images: {} },
  shots: [{ id: "still", start: 0, end: 1, draw }],
};
