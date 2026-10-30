// THE BOY'S POSES, built the way a figure-drawing teacher builds them (as Theo's are): the seat and
// feet placed, the legs solved onto them, the arms sent to targets. Nothing where contact matters
// (sit bones on the floor, back on the bed rail, forearm on the knee, the glass in the fingers) is a
// hand-typed pile of angles.
//
// Reference opened: sitting on the floor with the knees drawn up and the back against a wall:
// Loomis "Figure Drawing for All It's Worth" p. 113 (the pelvis rolls back onto the sacrum, the
// thighs rise steeply, the lumbar curve flattens and the back rounds); the forearm draped over the
// knee with the hand hanging: Hogarth "Dynamic Anatomy" p. 160 (the wrist relaxes, the fingers fall
// in a cascade). A tumbler held loosely at the rim from above: three fingers over the rim, the thumb
// down the outside.
import { Blob, Camera, DEG, I3, V3, add, apply, mv } from "../../character/math3";
import { order, toPart, type BlobPart } from "../../character/build";
import type { Pose, Scene } from "../../character/types";
import { dimsFromCanon, fk } from "../../character/human/skeleton";
import { reach, stand } from "../../character/human/balance";
import { BOY_SPEC } from "./index";

export const BOY_DIMS = dimsFromCanon(BOY_SPEC.canon, BOY_SPEC.height);
const D = BOY_DIMS, AH = D.ankleH;
const turnOf = (yaw: number) => (v: V3): V3 => mv([Math.cos(yaw * DEG), 0, Math.sin(yaw * DEG), 0, 1, 0, -Math.sin(yaw * DEG), 0, Math.cos(yaw * DEG)], v);
const base = (yaw = 0, j: Record<string, number> = {}, ex: Record<string, number> = {}): Pose => ({ root: [0, D.root, 0], yaw, joints: { shoulderRaiseL: 7, shoulderRaiseR: 7, shoulderSwingL: 12, shoulderSwingR: 12, elbowL: 10, elbowR: 10, ...j }, expression: ex, hands: { L: "relaxed", R: "relaxed" }, plant: true });

// the turnaround stance: weight even, shoulders a little down, eyes low
export const standing = (yaw: number): Pose => base(yaw, { neckBend: 6, headNod: 6, clavLiftL: -4, clavLiftR: -4 }, { lidUpper: 0.35, browSad: 0.4, lookY: -0.3 });

// SITTING ON THE FLOOR, back against the bed rail, knees drawn up. `sip` 0..1 brings the glass to
// his lips; `slump` 0..1 sinks him (head lower, shoulders forward); `eyes` 0 open .. 1 closed.
export type FloorOpts = { sip?: number; slump?: number; eyes?: number };
export const floorSit = (yaw: number, o: FloorOpts = {}): Pose => {
  const sip = o.sip ?? 0, sl = o.slump ?? 0, eyes = o.eyes ?? 0.75, turn = turnOf(yaw);
  let p: Pose = {
    ...base(yaw, { pelvisTilt: -18, spineBend: 20 + 10 * sl, neckBend: 12 + 8 * sl - 18 * sip, headNod: 14 + 8 * sl - 26 * sip, clavFwdL: 8, clavFwdR: 8 + 6 * sl }, { lidUpper: eyes, browSad: 0.7, lookY: -0.6, mouthOpen: 0.04 }),
    root: turn([0, 0.115, 0]), plant: false,
  };
  // feet flat on the floor, forward of the hips, a hip-width apart: the knees rise to meet them
  p = stand(D, p, { L: turn([0.15, AH, 0.56]), R: turn([-0.12, AH, 0.6]) }, null, {}, 1);
  const r = fk(D, p);
  // far arm (his left) wraps the left shin, the hand loosely round it below the knee
  p = reach(D, p, "L", add(r.joints.kneeL, turn([0.05, -0.12, 0.07])));
  // near arm (his right): the forearm laid over the right knee, the hand hanging past it; or at his lips
  const knee = r.joints.kneeR, lips = apply(r.head, [0, -0.02 * D.hh, 0.5 * D.hh]);
  const rest = add(knee, turn([-0.02, 0.0, 0.2])), atLips = add(lips, turn([-0.02, -0.11, 0.07]));
  p = reach(D, p, "R", [rest[0] + (atLips[0] - rest[0]) * sip, rest[1] + (atLips[1] - rest[1]) * sip, rest[2] + (atLips[2] - rest[2]) * sip]);
  p.joints.wristFlexR = 45 * (1 - sip) - 10 * sip;
  return { ...p, hands: { L: "grip", R: { relaxed: 0.5, pinch: 0.5 } } };
};

// THE TUMBLER: a short heavy glass, 8 cm tall, 7.5 cm across, hanging from the right hand's
// fingers (rim held from above) with a finger of whisky in it.
export const GLASS_R = 0.037, GLASS_H = 0.085;
export const tumbler = (p: Pose, fill = 0.3, tip = 0): BlobPart[] => {
  const r = fk(D, p), h = r.hand.R, Lh = D.hand;
  // the rim sits under the finger pads, about 0.7 hand-lengths down the hand
  const rim = apply(h, [0, -0.72 * Lh, 0.06 * Lh]), tiltR = (v: V3): V3 => [v[0], v[1] * Math.cos(tip) - v[2] * Math.sin(tip), v[1] * Math.sin(tip) + v[2] * Math.cos(tip)];
  const at = (dy: number): V3 => add(rim, tiltR([0, dy, 0]));
  const disc = (c: V3, rr: number): Blob => ({ c, R: I3, r: [rr, 0.004, rr] });
  const glass: BlobPart = { id: "glass", role: "glass", groups: [{ blobs: [disc(at(-0.004), GLASS_R), disc(at(-GLASS_H), GLASS_R * 0.88)], mode: "chain" }], depthBias: 0.012 };
  const parts = [glass];
  if (fill > 0) parts.push({ id: "whisky", role: "amber", groups: [{ blobs: [disc(at(-GLASS_H + 0.012 + fill * 0.05), GLASS_R * 0.86), disc(at(-GLASS_H + 0.01), GLASS_R * 0.82)], mode: "chain" }], depthBias: 0.006, outline: false });
  return parts;
};
export const withProps = (s: Scene, cam: Camera, props: BlobPart[]): Scene => ({ ...s, parts: order([...s.parts, ...props.map((b) => toPart(cam, b))]) });
