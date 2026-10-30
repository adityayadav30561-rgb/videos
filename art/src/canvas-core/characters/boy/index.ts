// THE BOY (PAARO), v1.0.0. The ONE source of truth for him: canon, rig, palette roles, features,
// toScene(pose). Every still, sheet and shot of the Paaro film imports this module and poses him;
// nothing anywhere else is allowed to draw him.
//
// Who: a young man of about twenty-two, slim, 1.76 m. Short dark hair, longer and untidy on top,
// falling forward over his brow (he has not combed it tonight). A mustard crew-neck sweater, the
// sleeves to the wrist; dark navy trousers; cream socks, no shoes (he is home).
//
// Canon: CANON.adult (7.5 heads), slim build. Nothing stylised below the neck: the mid-century look
// comes from the hand that paints him (render/gouache.ts), not from bent proportions.
//
// Built like Theo (the system's adult): the body is the 3D mannequin; the sweater and trousers are
// second skins cut along the bones (human/clothing.ts), so sleeves turn with the arms and trouser legs
// with the thighs, and they join the body at real seams instead of being drawn on separately.
import type { Blob, Camera } from "../../character/math3";
import { apply } from "../../character/math3";
import { blob } from "../../character/human/mannequin";
import type { Character, Pose, Scene } from "../../character/types";
import { CANON } from "../../character/human/canon";
import { ADULT_BODY } from "../../character/human/mannequin";
import { ADULT_HEAD, type Ell, hairCap } from "../../character/human/head";
import { type FigureSpec, assemble, build, checkPose } from "../../character/human/figure";
import { sleeve, trouserLeg } from "../../character/human/clothing";
import { SIDES } from "../../character/human/skeleton";
import { blouse } from "../theo/wardrobe";

export const BOY_VERSION = "1.0.0";
export const BOY_SPEC: FigureSpec = {
  canon: { ...CANON.adult, build: 0.38 }, height: 1.76, body: ADULT_BODY, head: ADULT_HEAD,
  roles: { skin: "skin", torso: "sweater", hips: "trousers", upperArm: "sweater", thigh: "trousers", shin: "trousers", foot: "sock" },
  inflate: { torso: 0.04, hips: 0.03, foot: 0.03 },
};

// palette ROLES: every hand maps them in its own medium
export const BOY_ROLES = {
  skin: { family: "warm brown skin", hue: [14, 34] as [number, number], note: "South Asian, warm; never grey" },
  hair: { family: "near-black", hue: [250, 320] as [number, number], note: "blue-black in the lamp" },
  sweater: { family: "mustard", hue: [32, 46] as [number, number], note: "THE identity colour: the warm thing in a cool room" },
  trousers: { family: "navy", hue: [220, 240] as [number, number], note: "dark cool blue" },
  sock: { family: "cream", hue: [38, 50] as [number, number], note: "" },
};
export const BOY_FEATURES = [
  { id: "hair", parts: ["hair"], note: "short dark hair, untidy on top, falling forward over the brow", visible: () => true },
  { id: "sweater", parts: ["torso", "sleeveL", "sleeveR"], note: "mustard crew-neck, sleeves to the wrist", visible: () => true },
  { id: "socks", parts: ["footL", "footR"], note: "cream socks, no shoes", visible: () => true },
];

// HIS HAIR: the cap cut short at the back and sides, and three masses on top that push forward, so
// the hair falls over his brow when his head bows
const MOP: Ell[] = [
  { c: [0.0, 0.98, 0.12], r: [0.34, 0.12, 0.3] },
  { c: [0.04, 0.9, 0.33], r: [0.28, 0.08, 0.13] },
  { c: [-0.1, 0.95, -0.12], r: [0.3, 0.1, 0.22] },
  // loose locks fallen forward over the brow, uneven
  { c: [0.12, 0.8, 0.4], r: [0.07, 0.11, 0.05] },
  { c: [-0.04, 0.78, 0.41], r: [0.06, 0.13, 0.05] },
  { c: [0.24, 0.82, 0.34], r: [0.05, 0.09, 0.05] },
  { c: [-0.2, 0.84, 0.36], r: [0.06, 0.08, 0.05] },
];
const FACE = { line: "line", pupil: "pupil", white: "white", blush: "blush", brow: "hair", mouth: "mouth", lip: "lip" };

export const boyScene = (p: Pose, cam: Camera): Scene => {
  const b = build(BOY_SPEC, p, cam), r = b.rig, B = BOY_SPEC.body;
  // the sweater hem blouses over the waistband of the trousers
  const bl = blouse(r, { role: "sweater", ease: 0.035 }), torso = b.parts.find((q) => q.id === "torso")!;
  torso.groups.push({ blobs: [bl.ring], mode: "each" }); torso.marksFn = bl.marksFn;
  // a ribbed crew collar round the base of the neck, closed
  const hh = r.dims.hh, ring: Blob[] = Array.from({ length: 13 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return blob(r, ["chest", [Math.sin(a) * 0.24, 1.2 + Math.cos(a) * 0.02, -0.07 + Math.cos(a) * 0.21], [0.07, 0.075, 0.07]], "L"); });
  b.parts.push({ id: "collar", role: "sweater", groups: [{ blobs: ring, mode: "chain" }], over: ["neck", "torso"], depthAt: apply(r.chest, [0, 1.2 * hh, 0.12 * hh]) });
  SIDES.forEach((s) => b.parts.push(
    sleeve(r, B, s, { role: "sweater", to: 1.94, inflate: 0.032, flare: 0.006 }),
    trouserLeg(r, B, s, { role: "trousers", to: 1.95, inflate: 0.03, flare: 0.012 }),
  ));
  return assemble(cam, b, p, FACE, { character: "boy", version: BOY_VERSION }, () => [hairCap(b.head, "hair", { front: 0.8, side: 0.56, back: 0.26, lift: 0.045, sideburn: 0.12, volume: MOP })]);
};

export const boy: Character = {
  id: "boy", name: "The boy", version: BOY_VERSION, canonId: "adult",
  description: "Young man, about 22, 7.5 heads, 1.76 m, slim: short untidy dark hair over the brow, mustard crew-neck sweater, navy trousers, cream socks.",
  roles: BOY_ROLES, features: BOY_FEATURES,
  pose: (p: Pose) => { checkPose(p, "boy"); return p; },
  toScene: (p: Pose, cam: Camera) => boyScene(p, cam),
};
