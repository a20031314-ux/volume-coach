/**
 * Exercise demo engine: a 2D jointed figure posed by segment angles, played as
 * "full movement → zoom on what matters". Pure TS so the app (react-native-svg)
 * and any preview share the same geometry. Units are roughly centimetres, y up.
 */

export type View = 'side' | 'front';

/**
 * Absolute segment angles in degrees (0 = forward/+x, 90 = up). The figure faces +x.
 * Side view: the near limbs; far limbs copy them unless given. Front view: the
 * figure's left side (screen right) — the other side is mirrored.
 */
export interface Pose {
  torso: number;
  head?: number;
  ua: number; fa: number;
  th: number; sh: number; ft?: number;
  ua2?: number; fa2?: number; th2?: number; sh2?: number;
  /** Upper-arm length scale, for arms seen foreshortened (e.g. tucked on a bench). */
  uaL?: number;
}

export type Joint =
  | 'hip' | 'shoulder' | 'neck' | 'head' | 'elbow' | 'wrist' | 'knee' | 'ankle' | 'toe'
  | 'elbow2' | 'wrist2' | 'knee2' | 'ankle2' | 'toe2';
export type Seg = 'torso' | 'ua' | 'fa' | 'th' | 'sh' | 'ft';
/** A point on the figure: a joint, or a spot along a segment (u: 0→1 from its start, v: cm towards the front of the body). */
export type Ref = Joint | { seg: Seg; u: number; v?: number };
export type Vec = [number, number];

export type Muscle = 'chest' | 'back' | 'delt' | 'sideDelt' | 'quad' | 'ham' | 'glute' | 'bi' | 'tri' | 'calf' | 'abs';

export type Equip =
  | { k: 'bench'; x: number; y: number; w: number; tilt?: number }
  | { k: 'seat'; x: number; y: number; w: number }
  | { k: 'barbell'; at: Ref; plate?: number }
  | { k: 'dumbbell'; at: Ref }
  | { k: 'cable'; from: Vec; to: Ref }
  | { k: 'handle'; at: Ref }
  | { k: 'pad'; at: Ref; r?: number }
  | { k: 'post'; x: number; y0: number; y1: number };

export type Guide =
  | { k: 'vline'; at: Ref }
  | { k: 'hline'; at: Ref }
  | { k: 'line'; a: Ref; b: Ref }
  | { k: 'arrow'; at: Ref; dir: number }
  | { k: 'angle'; a: Ref; b: Ref; c: Ref };

export interface Focus {
  /** Key pose to freeze on. */
  pose: string;
  /** Where to zoom. */
  at: Ref;
  /** Half the height of the zoomed view, in cm. */
  r: number;
  title: string;
  text: string;
  muscles?: Muscle[];
  guides?: Guide[];
}

export interface Demo {
  view: View;
  keys: Record<string, Pose>;
  /** [pose, seconds to reach it from the previous step]. Loops back to the first. */
  seq: [string, number][];
  /** Which point stays put (feet on the floor, hips on a seat...). */
  anchor: { at: Joint; to: Vec };
  equip?: Equip[];
  /** Muscles lit during the full movement. */
  muscles?: Muscle[];
  focus: Focus[];
  reps?: number;
}

// ---------- body ----------

export const BODY = { torso: 50, neck: 6, headR: 9.5, ua: 29, fa: 26, th: 44, sh: 42, ft: 13, shoulderW: 17, hipW: 8.5 };
export const WIDTH = { torso: 15, frontTorso: 24, limb: 9, arm: 8 };

const rad = (d: number) => (d * Math.PI) / 180;
const dir = (d: number): Vec => [Math.cos(rad(d)), Math.sin(rad(d))];
const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1]];
const mul = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);

/** Which way is the front of each segment: rotate its direction by this many degrees. */
const FRONT_TURN: Record<Seg, number> = { torso: -90, ua: 90, fa: 90, th: 90, sh: 90, ft: 90 };

export interface Skeleton {
  view: View;
  pose: Pose;
  p: Record<Joint, Vec>;
  /** Front view only: the mirrored side. */
  m?: Partial<Record<Joint, Vec>>;
}

function limbs(pose: Pose) {
  return {
    ua: pose.ua, fa: pose.fa, th: pose.th, sh: pose.sh,
    ua2: pose.ua2 ?? pose.ua, fa2: pose.fa2 ?? pose.fa, th2: pose.th2 ?? pose.th, sh2: pose.sh2 ?? pose.sh,
    ft: pose.ft ?? 0,
  };
}

export function solve(view: View, pose: Pose, anchor: Demo['anchor']): Skeleton {
  const L = limbs(pose);
  const uaLen = BODY.ua * (pose.uaL ?? 1);
  const p = {} as Record<Joint, Vec>;
  let m: Partial<Record<Joint, Vec>> | undefined;

  if (view === 'side') {
    p.hip = [0, 0];
    p.shoulder = add(p.hip, mul(dir(pose.torso), BODY.torso));
    p.neck = add(p.shoulder, mul(dir(pose.torso), BODY.neck));
    p.head = add(p.neck, mul(dir(pose.head ?? pose.torso), BODY.headR));
    p.elbow = add(p.shoulder, mul(dir(L.ua), uaLen));
    p.wrist = add(p.elbow, mul(dir(L.fa), BODY.fa));
    p.knee = add(p.hip, mul(dir(L.th), BODY.th));
    p.ankle = add(p.knee, mul(dir(L.sh), BODY.sh));
    p.toe = add(p.ankle, mul(dir(L.ft), BODY.ft));
    p.elbow2 = add(p.shoulder, mul(dir(L.ua2), uaLen));
    p.wrist2 = add(p.elbow2, mul(dir(L.fa2), BODY.fa));
    p.knee2 = add(p.hip, mul(dir(L.th2), BODY.th));
    p.ankle2 = add(p.knee2, mul(dir(L.sh2), BODY.sh));
    p.toe2 = add(p.ankle2, mul(dir(L.ft), BODY.ft));
  } else {
    // Front view: the figure's left side is drawn at +x, the right side mirrored.
    const mirror = (d: number) => 180 - d;
    const mid: Vec = [0, 0];
    const top = add(mid, mul(dir(pose.torso), BODY.torso));
    p.hip = [BODY.hipW, 0];
    p.shoulder = add(top, [BODY.shoulderW, 0]);
    p.neck = add(top, mul(dir(pose.torso), BODY.neck));
    p.head = add(p.neck, mul(dir(pose.head ?? pose.torso), BODY.headR));
    p.elbow = add(p.shoulder, mul(dir(L.ua), uaLen));
    p.wrist = add(p.elbow, mul(dir(L.fa), BODY.fa));
    p.knee = add(p.hip, mul(dir(L.th), BODY.th));
    p.ankle = add(p.knee, mul(dir(L.sh), BODY.sh));
    p.toe = add(p.ankle, [3, 0]);
    const ms: Vec = add(top, [-BODY.shoulderW, 0]);
    const mh: Vec = [-BODY.hipW, 0];
    const me = add(ms, mul(dir(mirror(L.ua2)), uaLen));
    const mw = add(me, mul(dir(mirror(L.fa2)), BODY.fa));
    const mk = add(mh, mul(dir(mirror(L.th2)), BODY.th));
    const ma = add(mk, mul(dir(mirror(L.sh2)), BODY.sh));
    m = { shoulder: ms, hip: mh, elbow: me, wrist: mw, knee: mk, ankle: ma, toe: add(ma, [-3, 0]) };
    p.elbow2 = me; p.wrist2 = mw; p.knee2 = mk; p.ankle2 = ma; p.toe2 = m.toe!;
  }

  // Keep the anchor joint fixed.
  const shift = sub(anchor.to, p[anchor.at]);
  for (const k of Object.keys(p) as Joint[]) p[k] = add(p[k], shift);
  if (m) for (const k of Object.keys(m) as Joint[]) m[k] = add(m[k]!, shift);
  return { view, pose, p, m };
}

function segEnds(sk: Skeleton, seg: Seg): [Vec, Vec, number] {
  const { p, pose } = sk;
  const L = limbs(pose);
  switch (seg) {
    case 'torso': return sk.view === 'front'
      ? [[(p.hip[0] - BODY.hipW), p.hip[1]], add([(p.hip[0] - BODY.hipW), p.hip[1]], mul(dir(pose.torso), BODY.torso)), pose.torso]
      : [p.hip, p.shoulder, pose.torso];
    case 'ua': return [p.shoulder, p.elbow, L.ua];
    case 'fa': return [p.elbow, p.wrist, L.fa];
    case 'th': return [p.hip, p.knee, L.th];
    case 'sh': return [p.knee, p.ankle, L.sh];
    case 'ft': return [p.ankle, p.toe, L.ft];
  }
}

export function at(sk: Skeleton, r: Ref): Vec {
  if (typeof r === 'string') return sk.p[r];
  const [a, b, ang] = segEnds(sk, r.seg);
  const base = add(a, mul(sub(b, a), r.u));
  if (!r.v) return base;
  return add(base, mul(dir(ang + FRONT_TURN[r.seg]), r.v));
}

/** Mirror of a point for the front view's other side. */
function mirrorX(sk: Skeleton, v: Vec): Vec {
  const cx = sk.p.hip[0] - BODY.hipW;
  return [2 * cx - v[0], v[1]];
}

// ---------- motion ----------

function mixPose(a: Pose, b: Pose, t: number): Pose {
  const out: Record<string, number> = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof Pose>;
  const fallback = (p: Pose, k: keyof Pose): number => {
    const v = p[k];
    if (v !== undefined) return v;
    if (k === 'uaL') return 1;
    if (k === 'ft') return 0;
    if (k === 'head') return p.torso;
    return p[(k as string).replace('2', '') as keyof Pose] as number;
  };
  for (const k of keys) out[k] = lerp(fallback(a, k), fallback(b, k), t);
  return out as unknown as Pose;
}

export function cycleLength(d: Demo) {
  return d.seq.reduce((s, [, dur]) => s + dur, 0);
}

/** Pose at time t within one rep. Each step eases from the previous pose to its own. */
export function motionPose(d: Demo, t: number): Pose {
  const total = cycleLength(d);
  let x = ((t % total) + total) % total;
  for (let i = 0; i < d.seq.length; i++) {
    const [name, dur] = d.seq[i];
    const prev = d.seq[(i - 1 + d.seq.length) % d.seq.length][0];
    if (x <= dur || i === d.seq.length - 1) {
      const k = dur > 0 ? Math.min(1, x / dur) : 1;
      return mixPose(d.keys[prev], d.keys[name], ease(k));
    }
    x -= dur;
  }
  return d.keys[d.seq[0][0]];
}

// ---------- timeline ----------

const ZOOM_IN = 0.8;
const HOLD = 3.4;
const ZOOM_OUT = 0.7;

export interface Segment { kind: 'full' | 'focus'; index: number; start: number; dur: number; label: string }

export function timeline(d: Demo): { segments: Segment[]; total: number } {
  const segments: Segment[] = [];
  let t = 0;
  const full = cycleLength(d) * (d.reps ?? 2);
  segments.push({ kind: 'full', index: -1, start: t, dur: full, label: '전체 동작' });
  t += full;
  d.focus.forEach((f, i) => {
    const dur = ZOOM_IN + HOLD + ZOOM_OUT;
    segments.push({ kind: 'focus', index: i, start: t, dur, label: f.title });
    t += dur;
  });
  return { segments, total: t };
}

// ---------- framing ----------

export type Box = { x: number; y: number; w: number; h: number };
export const ASPECT = 4 / 3;

function fit(cx: number, cy: number, h: number): Box {
  const w = h * ASPECT;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

function boundsOf(d: Demo): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const grow = (v: Vec, r = 0) => {
    x0 = Math.min(x0, v[0] - r); x1 = Math.max(x1, v[0] + r);
    y0 = Math.min(y0, v[1] - r); y1 = Math.max(y1, v[1] + r);
  };
  for (const pose of Object.values(d.keys)) {
    const sk = solve(d.view, pose, d.anchor);
    for (const v of Object.values(sk.p)) grow(v, 8);
    if (sk.m) for (const v of Object.values(sk.m)) grow(v!, 8);
    grow(sk.p.head, BODY.headR + 4);
    for (const e of d.equip ?? []) {
      if (e.k === 'barbell') {
        const c = at(sk, e.at);
        if (d.view === 'side') grow(c, e.plate ?? 22);
        else { grow(add(c, [60, 0]), 22); grow(mirrorX(sk, add(c, [60, 0])), 22); }
      }
      if (e.k === 'dumbbell') grow(at(sk, e.at), 10);
      if (e.k === 'bench' || e.k === 'seat') { grow([e.x, e.y]); grow([e.x + e.w, e.y]); }
      if (e.k === 'cable') grow(e.from, 6);
      if (e.k === 'post') { grow([e.x, e.y0]); grow([e.x, e.y1]); }
    }
  }
  y0 = Math.min(y0, -4);
  const h = Math.max(y1 - y0, (x1 - x0) / ASPECT) * 1.12;
  return fit((x0 + x1) / 2, (y0 + y1) / 2, h);
}

function mixBox(a: Box, b: Box, t: number): Box {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t) };
}

// ---------- drawing ----------

/** Colour roles; the renderer maps them to the palette. */
export type Tone = 'ink' | 'far' | 'equip' | 'plate' | 'floor' | 'hi' | 'guide' | 'bg';

export type Prim =
  | { k: 'line'; a: Vec; b: Vec; w: number; tone: Tone; dash?: boolean; o?: number }
  | { k: 'circle'; c: Vec; r: number; tone: Tone; fill?: boolean; w?: number; o?: number }
  | { k: 'capsule'; a: Vec; b: Vec; w: number; tone: Tone; o?: number }
  | { k: 'arc'; c: Vec; r: number; from: number; to: number; tone: Tone; w: number }
  | { k: 'text'; at: Vec; s: string; tone: Tone; size: number };

export interface Frame {
  box: Box;
  prims: Prim[];
  segment: Segment;
  /** 0→1 visibility of the focus caption. */
  caption: number;
  focus?: Focus;
}

function musclePrims(sk: Skeleton, list: Muscle[], o: number): Prim[] {
  const out: Prim[] = [];
  const cap = (seg: Seg, u0: number, u1: number, v: number, w: number) => {
    const a = at(sk, { seg, u: u0, v });
    const b = at(sk, { seg, u: u1, v });
    out.push({ k: 'capsule', a, b, w, tone: 'hi', o });
    if (sk.view === 'front') out.push({ k: 'capsule', a: mirrorX(sk, a), b: mirrorX(sk, b), w, tone: 'hi', o });
  };
  const side = sk.view === 'side';
  for (const mu of list) {
    switch (mu) {
      case 'chest': if (side) cap('torso', 0.62, 0.9, 5.5, 7); break;
      case 'back': if (side) cap('torso', 0.45, 0.88, -5.5, 7); break;
      case 'abs': if (side) cap('torso', 0.12, 0.55, 5.5, 6); break;
      case 'delt': cap('ua', 0.02, 0.3, side ? 0 : 1.5, 10); break;
      case 'sideDelt': cap('ua', 0.0, 0.32, side ? 0 : 2.5, 10); break;
      case 'bi': cap('ua', 0.3, 0.85, side ? 3 : 0, 6); break;
      case 'tri': cap('ua', 0.25, 0.85, side ? -3 : 0, 6); break;
      case 'quad': cap('th', 0.2, 0.85, side ? 3.5 : 0, 8); break;
      case 'ham': cap('th', 0.2, 0.85, side ? -3.5 : 0, 7); break;
      case 'glute': if (side) out.push({ k: 'circle', c: at(sk, { seg: 'torso', u: 0.02, v: -5 }), r: 6.5, tone: 'hi', fill: true, o }); break;
      case 'calf': cap('sh', 0.12, 0.5, side ? -3.5 : 0, 7); break;
    }
  }
  return out;
}

function equipPrims(sk: Skeleton, list: Equip[], layer: 'back' | 'front'): Prim[] {
  const out: Prim[] = [];
  const side = sk.view === 'side';
  for (const e of list) {
    switch (e.k) {
      case 'bench': {
        if (layer !== 'back') break;
        const t = e.tilt ?? 0;
        const a: Vec = [e.x, e.y];
        const b = add(a, mul(dir(t), e.w));
        out.push({ k: 'line', a, b, w: 7, tone: 'equip' });
        const legX = [e.x + 8, e.x + e.w - 8];
        for (const lx of legX) out.push({ k: 'line', a: [lx, e.y - 3], b: [lx, 0], w: 4, tone: 'equip' });
        break;
      }
      case 'seat': {
        if (layer !== 'back') break;
        out.push({ k: 'line', a: [e.x, e.y], b: [e.x + e.w, e.y], w: 7, tone: 'equip' });
        out.push({ k: 'line', a: [e.x + e.w / 2, e.y - 3], b: [e.x + e.w / 2, 0], w: 4, tone: 'equip' });
        break;
      }
      case 'post':
        if (layer === 'back') out.push({ k: 'line', a: [e.x, e.y0], b: [e.x, e.y1], w: 5, tone: 'equip' });
        break;
      case 'barbell': {
        const c = at(sk, e.at);
        if (side) {
          if (layer === 'back') out.push({ k: 'circle', c, r: e.plate ?? 22, tone: 'plate', fill: true });
          else out.push({ k: 'circle', c, r: 3.2, tone: 'equip', fill: true });
        } else if (layer === 'front') {
          const l = mirrorX(sk, c);
          const x0 = Math.min(l[0], c[0]) - 38, x1 = Math.max(l[0], c[0]) + 38;
          out.push({ k: 'line', a: [x0 - 20, c[1]], b: [x1 + 20, c[1]], w: 3, tone: 'equip' });
          for (const x of [x0, x1]) out.push({ k: 'line', a: [x, c[1] - (e.plate ?? 22)], b: [x, c[1] + (e.plate ?? 22)], w: 6, tone: 'equip' });
        }
        break;
      }
      case 'dumbbell': {
        if (layer !== 'front') break;
        const pts = [at(sk, e.at)];
        if (!side) pts.push(mirrorX(sk, pts[0]));
        for (const c of pts) {
          if (side) out.push({ k: 'circle', c, r: 7, tone: 'equip', fill: true });
          else {
            out.push({ k: 'line', a: [c[0] - 7, c[1]], b: [c[0] + 7, c[1]], w: 3, tone: 'equip' });
            for (const dx of [-8, 8]) out.push({ k: 'line', a: [c[0] + dx, c[1] - 6], b: [c[0] + dx, c[1] + 6], w: 5, tone: 'equip' });
          }
        }
        break;
      }
      case 'cable':
        if (layer === 'back') {
          out.push({ k: 'line', a: e.from, b: at(sk, e.to), w: 1.6, tone: 'equip' });
          out.push({ k: 'circle', c: e.from, r: 5, tone: 'equip', w: 2.5 });
        }
        break;
      case 'handle':
        if (layer === 'front') out.push({ k: 'circle', c: at(sk, e.at), r: 3.2, tone: 'equip', fill: true });
        break;
      case 'pad':
        if (layer === 'back') out.push({ k: 'circle', c: at(sk, e.at), r: e.r ?? 6, tone: 'equip', fill: true });
        break;
    }
  }
  return out;
}

function bodyPrims(sk: Skeleton): Prim[] {
  const { p } = sk;
  const out: Prim[] = [];
  const limb = (a: Vec, b: Vec, w: number, tone: Tone) => out.push({ k: 'line', a, b, w, tone });
  /** Near limbs get a background-coloured edge so they read where they cross the body. */
  const near = (a: Vec, b: Vec, w: number) => {
    out.push({ k: 'line', a, b, w: w + 3.5, tone: 'bg' });
    out.push({ k: 'line', a, b, w, tone: 'ink' });
  };
  if (sk.view === 'side') {
    // Far side first, nudged so it reads as depth.
    const nudge = (v: Vec): Vec => [v[0] - 1.5, v[1] + 1];
    limb(nudge(p.hip), nudge(p.knee2), WIDTH.limb, 'far');
    limb(nudge(p.knee2), nudge(p.ankle2), WIDTH.limb, 'far');
    limb(nudge(p.ankle2), nudge(p.toe2), 5, 'far');
    limb(nudge(p.shoulder), nudge(p.elbow2), WIDTH.arm, 'far');
    limb(nudge(p.elbow2), nudge(p.wrist2), WIDTH.arm, 'far');
    limb(p.hip, p.shoulder, WIDTH.torso, 'ink');
    limb(p.shoulder, p.neck, 6, 'ink');
    out.push({ k: 'circle', c: p.head, r: BODY.headR, tone: 'ink', fill: true });
    near(p.hip, p.knee, WIDTH.limb);
    near(p.knee, p.ankle, WIDTH.limb);
    limb(p.ankle, p.toe, 5, 'ink');
    near(p.shoulder, p.elbow, WIDTH.arm);
    near(p.elbow, p.wrist, WIDTH.arm);
    // Re-cap the joints the halos cut into.
    out.push({ k: 'circle', c: p.knee, r: WIDTH.limb / 2, tone: 'ink', fill: true });
    out.push({ k: 'circle', c: p.elbow, r: WIDTH.arm / 2, tone: 'ink', fill: true });
  } else {
    const m = sk.m!;
    const cx = p.hip[0] - BODY.hipW;
    const top: Vec = [cx + (p.neck[0] - cx), p.shoulder[1]];
    limb([cx, p.hip[1] + 4], [top[0], top[1] - 4], WIDTH.frontTorso, 'ink');
    limb(m.shoulder!, p.shoulder, 9, 'ink');
    limb(m.hip!, p.hip, 9, 'ink');
    limb(top, p.neck, 7, 'ink');
    out.push({ k: 'circle', c: p.head, r: BODY.headR, tone: 'ink', fill: true });
    for (const s of [p, m] as Record<string, Vec>[]) {
      limb(s.hip, s.knee, WIDTH.limb, 'ink');
      limb(s.knee, s.ankle, WIDTH.limb, 'ink');
      limb(s.ankle, s.toe, 6, 'ink');
      near(s.shoulder, s.elbow, WIDTH.arm);
      near(s.elbow, s.wrist, WIDTH.arm);
      out.push({ k: 'circle', c: s.elbow, r: WIDTH.arm / 2, tone: 'ink', fill: true });
    }
  }
  return out;
}

function guidePrims(sk: Skeleton, list: Guide[], box: Box): Prim[] {
  const out: Prim[] = [];
  for (const g of list) {
    switch (g.k) {
      case 'vline': {
        const v = at(sk, g.at);
        out.push({ k: 'line', a: [v[0], box.y], b: [v[0], box.y + box.h], w: 1.4, tone: 'guide', dash: true });
        break;
      }
      case 'hline': {
        const v = at(sk, g.at);
        out.push({ k: 'line', a: [box.x, v[1]], b: [box.x + box.w, v[1]], w: 1.4, tone: 'guide', dash: true });
        break;
      }
      case 'line': {
        const a = at(sk, g.a), b = at(sk, g.b);
        const d = sub(b, a);
        out.push({ k: 'line', a: sub(a, mul(d, 0.35)), b: add(b, mul(d, 0.35)), w: 1.4, tone: 'guide', dash: true });
        break;
      }
      case 'arrow': {
        const a = at(sk, g.at);
        const len = box.h * 0.16;
        const tip = add(a, mul(dir(g.dir), len + 8));
        const tail = add(a, mul(dir(g.dir), 8));
        out.push({ k: 'line', a: tail, b: tip, w: 2.2, tone: 'guide' });
        const hl = len * 0.3;
        out.push({ k: 'line', a: tip, b: add(tip, mul(dir(g.dir + 150), hl)), w: 2.2, tone: 'guide' });
        out.push({ k: 'line', a: tip, b: add(tip, mul(dir(g.dir - 150), hl)), w: 2.2, tone: 'guide' });
        break;
      }
      case 'angle': {
        const a = at(sk, g.a), b = at(sk, g.b), c = at(sk, g.c);
        const a1 = Math.atan2(a[1] - b[1], a[0] - b[0]) * 180 / Math.PI;
        const a2 = Math.atan2(c[1] - b[1], c[0] - b[0]) * 180 / Math.PI;
        let span = a2 - a1;
        while (span > 180) span -= 360;
        while (span < -180) span += 360;
        const r = box.h * 0.1;
        out.push({ k: 'arc', c: b, r, from: a1, to: a1 + span, tone: 'guide', w: 1.8 });
        const mid = add(b, mul(dir(a1 + span / 2), r + box.h * 0.06));
        out.push({ k: 'text', at: mid, s: `${Math.round(Math.abs(span))}°`, tone: 'guide', size: box.h * 0.055 });
        break;
      }
    }
  }
  return out;
}

const baseBoxCache = new WeakMap<Demo, Box>();
export function baseBox(d: Demo): Box {
  let b = baseBoxCache.get(d);
  if (!b) { b = boundsOf(d); baseBoxCache.set(d, b); }
  return b;
}

/** Everything needed to draw the demo at time t (seconds, loops). */
export function frame(d: Demo, t: number): Frame {
  const { segments, total } = timeline(d);
  const x = ((t % total) + total) % total;
  const segment = segments.find((s) => x >= s.start && x < s.start + s.dur) ?? segments[0];
  const local = x - segment.start;
  const home = d.keys[d.seq[0][0]];
  const base = baseBox(d);

  let pose: Pose;
  let box = base;
  let caption = 0;
  let focus: Focus | undefined;
  let zoom = 0;

  if (segment.kind === 'full') {
    pose = motionPose(d, local);
  } else {
    focus = d.focus[segment.index];
    const target = d.keys[focus.pose];
    if (local < ZOOM_IN) zoom = ease(local / ZOOM_IN);
    else if (local < ZOOM_IN + HOLD) zoom = 1;
    else zoom = 1 - ease((local - ZOOM_IN - HOLD) / ZOOM_OUT);
    pose = mixPose(home, target, zoom);
    const sk = solve(d.view, target, d.anchor);
    const c = at(sk, focus.at);
    box = mixBox(base, fit(c[0], c[1], Math.min(focus.r * 2, base.h)), zoom);
    caption = local < ZOOM_IN ? 0 : local < ZOOM_IN + HOLD ? Math.min(1, (local - ZOOM_IN) / 0.35) : Math.max(0, 1 - (local - ZOOM_IN - HOLD) / 0.3);
  }

  const sk = solve(d.view, pose, d.anchor);
  const equip = d.equip ?? [];
  const prims: Prim[] = [];
  prims.push({ k: 'line', a: [base.x - 50, 0], b: [base.x + base.w + 50, 0], w: 1.5, tone: 'floor' });
  prims.push(...equipPrims(sk, equip, 'back'));
  prims.push(...bodyPrims(sk));
  const lit = focus ? focus.muscles ?? [] : d.muscles ?? [];
  if (lit.length) prims.push(...musclePrims(sk, lit, focus ? 0.55 + 0.4 * zoom : 0.75));
  prims.push(...equipPrims(sk, equip, 'front'));
  if (focus && zoom > 0.6) {
    const g = guidePrims(sk, focus.guides ?? [], box);
    const o = (zoom - 0.6) / 0.4;
    for (const pr of g) if (pr.k === 'line' || pr.k === 'circle') pr.o = o;
    prims.push(...g);
  }
  return { box, prims, segment, caption, focus };
}
