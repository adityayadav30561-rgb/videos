import { Gfx, PENCIL, line, oval, type Ctx, type Env, type P } from "./core";
import { Film } from "./film";

// ONE light for the whole picture, upper left. Every form is lit from it and every shadow falls
// away from it: this one decision is most of what makes a drawing read as solid.
const LIGHT: P = [-7, -9];

// Hand-placed control points round a pear: a narrow shoulder, a waist, a heavy seat. Placed by
// eye over the real fruit, never built from ellipses; that is the difference between a pear and
// the icon of one.
const PEAR: P[] = [[536, 318], [566, 330], [584, 372], [590, 430], [616, 482], [660, 540], [684, 612], [674, 690], [630, 748], [556, 776], [478, 766], [420, 722], [396, 652], [410, 574], [452, 510], [484, 452], [494, 384], [508, 336]];
const STEM: P[] = [[532, 324], [528, 286], [540, 246], [556, 228]];
const LEAF: P[] = [[532, 272], [566, 236], [620, 218], [666, 226], [636, 258], [586, 276]];
const SHADE: P[] = [[586, 420], [612, 480], [656, 540], [680, 612], [670, 688], [628, 744], [572, 766], [604, 716], [628, 650], [622, 574], [596, 500]]; // the core shadow, hugging the side away from the light

export const drawHero = (ctx: Ctx, _frame: number, env: Env) => {
  // A still has no line boil across frames: its only randomness is the seeded geometry below.
  const g = new Gfx(ctx, env, 0, PENCIL);
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0);
  ctx.fillStyle = "#fbf6ec"; ctx.fillRect(0, 0, env.W, env.H);
  const fit = Math.min(env.W, env.H) / 1080;
  g.push((env.W - 1080 * fit) / 2, (env.H - 1080 * fit) / 2, fit);

  // 1. the cast shadow first, so the fruit sits ON the table and never floats over it
  g.group("paint", () => g.wash(oval(600, 772, 190, 34, 16), "#a79db8", { seed: 3, alpha: 0.42, dx: 0, dy: 0, shrink: 1 }));
  // 2. the form: a shadow colour under, the lit colour pushed toward the light, one lifted highlight
  g.group("paint", () => {
    g.form(PEAR, "#e2c15c", "#8f8a3c", { seed: 5, light: LIGHT, hi: [486, 590, 12, 30, -24] });
    g.wash(SHADE, "#7d6a2e", { seed: 6, alpha: 0.26, dx: 0, dy: 0, shrink: 1, rim: false });
    g.wash(oval(492, 668, 74, 96, 12), "#d9804f", { seed: 8, alpha: 0.09, dx: 0, dy: 0, shrink: 1, rim: false }); // a blush, lost at every edge
    g.form(LEAF, "#98ad6f", "#5d7454", { seed: 7, light: LIGHT, alpha: 0.95 });
  });
  // 3. the pencil, over the paint: a contour that swells and lifts, then the few lines that matter
  g.group("ink", () => {
    g.pen(PEAR, { seed: 11, closed: true, w: 1.3, opacity: 0.78, wobble: 0.8, boil: 0 });
    g.pen(STEM, { seed: 12, w: 2.6, opacity: 0.9, boil: 0, taper: 0.6 });
    g.pen(LEAF, { seed: 13, closed: true, w: 0.9, opacity: 0.55, boil: 0 });
    g.pen(line([536, 270], [660, 230], -6), { seed: 14, w: 0.6, opacity: 0.45, boil: 0, retrace: false });
  });
  g.pop();
  // 4. the sheet itself, over everything
  g.paper("paper", 0.12);
  g.paper("coldpress", 0.18);
};

export const hero: Film = {
  meta: { title: "hero", W: 1920, H: 1080, fps: 30, bpm: 60, durationFrames: 1 },
  assets: { images: {} },
  shots: [{ id: "hero", start: 0, end: 1, draw: drawHero }],
};
