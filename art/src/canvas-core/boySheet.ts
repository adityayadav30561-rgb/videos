// MODEL SHEET: the boy (Paaro), v1. Turnaround on a head-unit grid, and the three floor poses the
// film uses (resting with the glass, sipping, slumped), painted by the gouache hand. This sheet is
// the one approval for the character: it pins BOY_VERSION.
import { Gfx, PENCIL, type Ctx, type Env } from "./core";
import type { Film } from "./film";
import { Camera, camera, project } from "./character/math3";
import { letter } from "./drafting";
import { boy, BOY_VERSION } from "./characters/boy";
import { BOY_DIMS, floorSit, standing, tumbler, withProps } from "./characters/boy/poses";
import { renderGouache } from "./character/render/gouache";
import { BOY_GOUACHE } from "./characters/boy/palette";

const W = 2880, H = 2200, BOARD = "#efe2c2", MUTED = "#8a7a62", INK = "#1d1a2a";
const label = (g: Gfx, t: string, x: number, y: number, cap = 24, color = INK) => letter(g, t, x, y, { cap, color, seed: t.length * 7 + Math.round(x), w: cap / 11, opacity: 0.9 });
// a long lens from far off: near-orthographic, so the grid reads true
const fullCam = (cx: number, floorY: number, figPx: number, yawCam = 0, height = 1.76, elev = 0): Camera => { const d = 14, f = (figPx * d) / height, a = (yawCam * Math.PI) / 180; return camera([Math.sin(a) * d, height * 0.52 + elev, Math.cos(a) * d], [0, height * 0.52, 0], f, cx, floorY - figPx * 0.52); };

const drawSheet = (ctx: Ctx, frame: number, env: Env) => {
  const g = new Gfx(ctx, env, frame, PENCIL);
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.fillStyle = BOARD; ctx.fillRect(0, 0, W, H);
  label(g, `THE BOY  /  MODEL SHEET v${BOY_VERSION}  /  ADULT CANON 7.5 HEADS, 1.76 M, SLIM`, 80, 56, 40);
  label(g, "MUSTARD CREW-NECK, NAVY TROUSERS, CREAM SOCKS, UNTIDY DARK HAIR OVER THE BROW.  BUILT ON THE 3D RIG: EVERY JOINT INSIDE ITS RANGE OF MOTION", 80, 116, 18, MUTED);
  // ---- turnaround, on a head grid
  const figPx = 760, floor = 1000;
  const grid = fullCam(400, floor, figPx);
  g.group("ink", () => { for (let i = 0; i <= 8; i++) { const y = project(grid, [0, Math.min(i, 7.5) * BOY_DIMS.hh, 0]).y; g.pen([[150, y], [2780, y]], { w: 0.9, color: "#b3a58a", seed: 40 + i, wobble: 0.3, opacity: 0.6, retrace: false }); label(g, i === 8 ? "7.5" : String(i), 104, y - 9, 14, MUTED); } });
  [0, 45, 90, 180].forEach((yaw, i) => {
    const cx = 420 + i * 640, cam = fullCam(cx, floor, figPx);
    renderGouache(g, boy.toScene(standing(yaw), cam), BOY_GOUACHE);
    label(g, ["FRONT", "THREE-QUARTER", "PROFILE", "BACK"][i], cx - 80, floor + 40, 20, MUTED);
  });
  // ---- the floor poses, seen as the film sees him: from a little above, three-quarter, facing right
  label(g, "ON THE FLOOR, BACK TO THE BED RAIL, KNEES UP  (THE FILM'S POSES)", 80, 1150, 26);
  const poses: [string, number, number, number][] = [["RESTING, THE GLASS HANGING FROM HIS FINGERS", 0, 0, 0.75], ["THE SIP", 1, 0, 0.9], ["SLUMPED, AFTER", 0, 1, 1]];
  poses.forEach(([name, sip, slump, eyes], i) => {
    const cx = 520 + i * 920, cam = fullCam(cx, 2020, 1200, 0, 1.76, 0.9), p = floorSit(62, { sip, slump, eyes });
    const s = withProps(boy.toScene(p, cam), cam, tumbler(p, sip > 0.5 ? 0.15 : 0.3, sip * 1.1));
    renderGouache(g, s, BOY_GOUACHE);
    label(g, name, cx - 300, 2070, 18, MUTED);
  });
};

export const boySheet: Film = {
  meta: { title: "boySheet", W, H, fps: 28, bpm: 70, durationFrames: 1 },
  assets: { images: {} },
  shots: [{ id: "sheet", start: 0, end: 1, draw: drawSheet }],
};
