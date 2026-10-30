import type { Ctx, Env } from "./core";
import type { Film } from "./film";
import { tooth } from "./paaroGouache";
import { drawRoomShot, lyric, ROOM_START, stageFrame } from "./paaroRoom";

// The look still for PAARO: the hardest frame, the boy in his lamp-lit room, in mid-century gouache.
const look = (ctx: Ctx, local: number, env: Env) => {
  drawRoomShot(ctx, env, { ...ROOM_START, t: 0.6 });
  lyric(ctx, env, ["Ke", "sharaabein", "khatam"], 9, [0, 0, 0], 600, 200, 72);
  tooth(ctx, env, 0.18);
  stageFrame(ctx, env);
};

export const paaroLook: Film = {
  meta: { title: "paaroLook", W: 1920, H: 1080, fps: 28, bpm: 70, durationFrames: 1 },
  assets: { images: {} },
  shots: [{ id: "look", start: 0, end: 1, draw: look }],
};
