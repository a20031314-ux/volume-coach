/**
 * Plays 가이드 모드: one timeline for the whole workout (lib/guide buildRun), speech (expo-speech) and short
 * vibrations, with 일시정지 / 이어서 / 이 세트 처음부터 / 다음으로. A 100ms clock walks the cues, so pausing
 * just stops the clock. Keeps the screen on while running (timers stop when the phone sleeps, iOS especially).
 */
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Speech from 'expo-speech';
import { Platform, Vibration } from 'react-native';
import { create } from 'zustand';

import { runSpans, type Cue, type ItemSpan, type RunAct, type RunCue, type RunItem } from '@/lib/guide';

export interface Output { voice: boolean; haptic: boolean }

export interface GuideState {
  status: 'idle' | 'running' | 'paused' | 'done';
  sessionId: string | null;
  /** timeline seconds played so far */
  at: number;
  length: number;
  label: string;
  mode: RunCue['mode'];
  until: number;
  rep: number;
  phase: string;
  /** when the phase started (timeline s) and the last moving phase before a 멈춰 */
  phaseAt: number;
  lastMove: string;
  item: number;
  target: number | null;
  timed: boolean;
  /** the planned items (only the ones in the run) and when each starts */
  items: RunItem[];
  spans: ItemSpan[];
  rhythm: boolean;
  /** set this screen is about ("key:setNo") and the sets checked to fix after the workout */
  ref: string;
  flags: string[];
}
const IDLE: GuideState = { status: 'idle', sessionId: null, at: 0, length: 0, label: '', mode: undefined, until: 0, rep: 0, phase: '', phaseAt: 0, lastMove: '', item: 0, target: null, timed: false, items: [], spans: [], rhythm: true, ref: '', flags: [] };
export const useGuide = create<GuideState>(() => IDLE);

let cues: RunCue[] = [];
let next = 0;
let out: Output = { voice: true, haptic: true };
let onAct: (a: RunAct) => void = () => undefined;
let clock: ReturnType<typeof setInterval> | null = null;
let base = 0; // timeline seconds when the clock (re)started
let since = 0; // Date.now() then
let awake = false;
let previewTimers: ReturnType<typeof setTimeout>[] = [];

function keepAwake(on: boolean) {
  if (Platform.OS === 'web' || on === awake) return;
  awake = on;
  if (on) void activateKeepAwakeAsync('guide').catch(() => undefined);
  else void deactivateKeepAwake('guide').catch(() => undefined);
}

function emit(c: Cue, o: Output) {
  if (c.say && o.voice) {
    Speech.stop();
    Speech.speak(c.say, { language: 'ko-KR', rate: 1.1 });
  }
  if (c.buzz && o.haptic && Platform.OS !== 'web') Vibration.vibrate(60);
}

const now = () => base + (Date.now() - since) / 1000;

/** apply a cue's screen fields */
function show(c: RunCue, patch: Partial<GuideState>) {
  if (c.label != null) patch.label = c.label;
  if (c.mode != null) patch.mode = c.mode;
  if (c.until != null) patch.until = c.until;
  if (c.rep != null) patch.rep = c.rep;
  if (c.phase != null) {
    if (c.phase !== '멈춰') patch.lastMove = c.phase;
    patch.phase = c.phase;
    patch.phaseAt = c.t;
  }
  if (c.item != null) patch.item = c.item;
  if (c.target !== undefined) patch.target = c.target;
  if (c.timed != null) patch.timed = c.timed;
  if (c.ref != null) patch.ref = c.ref;
}

function tick() {
  const t = now();
  const patch: Partial<GuideState> = { at: t };
  while (next < cues.length && cues[next].t <= t) {
    const c = cues[next++];
    // coming back after the app slept: run what was missed, but only speak what's on time
    if (t - c.t < 1.5) emit(c, out);
    show(c, patch);
    if (c.act) onAct(c.act);
  }
  if (next >= cues.length) {
    stopClock();
    patch.status = 'done';
    keepAwake(false);
  }
  useGuide.setState(patch);
}

function stopClock() {
  if (clock) clearInterval(clock);
  clock = null;
}

function startClock(from: number) {
  stopClock();
  base = from;
  since = Date.now();
  clock = setInterval(tick, 100);
  tick();
}

export function startRun(sessionId: string, timeline: { cues: RunCue[]; length: number }, o: Output, act: (a: RunAct) => void,
  meta: { items: RunItem[]; rhythm: boolean } = { items: [], rhythm: true }) {
  stopPreview();
  cues = timeline.cues;
  next = 0;
  out = o;
  onAct = act;
  const spans = runSpans(timeline.cues, meta.items.length);
  useGuide.setState({ ...IDLE, status: 'running', sessionId, length: timeline.length, items: meta.items, spans, rhythm: meta.rhythm });
  keepAwake(true);
  startClock(0);
}

export function pauseRun() {
  if (useGuide.getState().status !== 'running') return;
  const t = now();
  stopClock();
  Speech.stop();
  useGuide.setState({ status: 'paused', at: t });
}

/** jump to timeline second `t` (acts in between still run, so skipped sets are recorded) */
function seek(t: number) {
  const patch: Partial<GuideState> = {};
  if (t < useGuide.getState().at) {
    // going back: replay screen state up to t without acts
    next = 0;
    while (next < cues.length && cues[next].t < t) show(cues[next++], patch);
  } else {
    while (next < cues.length && cues[next].t < t) {
      const c = cues[next++];
      show(c, patch);
      if (c.act) onAct(c.act);
    }
  }
  useGuide.setState({ ...patch, at: t });
}

export function resumeRun() {
  const s = useGuide.getState();
  if (s.status !== 'paused') return;
  useGuide.setState({ status: 'running' });
  keepAwake(true);
  startClock(s.at);
}

/** back to this set's "준비" line (or the one before, if it just started) */
export function restartSet() {
  const at = useGuide.getState().at;
  const marks = cues.filter((c) => c.mark && c.t <= at);
  const m = marks.at(-1);
  if (!m) return;
  // a set that's already recorded isn't undone: only restart the set in progress
  const recorded = cues.some((c) => c.act?.k === 'set' && c.t > m.t && c.t <= at);
  if (recorded) return;
  seek(m.t);
}

/** 다음으로: in a set → end it now (recorded as planned) and go to the rest; in a rest / move → the next set's "준비" */
export function skipAhead() {
  const { at, mode } = useGuide.getState();
  const nextMark = cues.find((c) => c.mark && c.t > at + 0.05);
  const setEnd = mode === 'set' ? cues.find((c) => c.act?.k === 'set' && c.t > at && (!nextMark || c.t < nextMark.t)) : undefined;
  if (setEnd) seek(setEnd.t + 0.005);
  else seek(nextMark ? nextMark.t : cues.at(-1)?.t ?? at);
}

/** 체크: mark the set in progress (or the one just done, while resting) to fix after the workout */
export function toggleFlag() {
  const { ref, flags } = useGuide.getState();
  if (!ref) return;
  useGuide.setState({ flags: flags.includes(ref) ? flags.filter((f) => f !== ref) : [...flags, ref] });
}

/** 가이드 끝내기: stop here and go to 기록 확인 (what's recorded stays) */
export function endRun() {
  stopClock();
  Speech.stop();
  keepAwake(false);
  cues = [];
  next = 0;
  useGuide.setState({ status: 'done' });
}

export function stopRun() {
  stopClock();
  Speech.stop();
  keepAwake(false);
  cues = [];
  next = 0;
  useGuide.setState(IDLE);
}

/** can 이 세트 처음부터 work now (set in progress, not yet recorded) */
export function canRestart(at: number): boolean {
  const m = cues.filter((c) => c.mark && c.t <= at).at(-1);
  return !!m && !cues.some((c) => c.act?.k === 'set' && c.t > m.t && c.t <= at);
}

/* ---------- settings 들어보기 ---------- */

function stopPreview() {
  previewTimers.forEach(clearTimeout);
  previewTimers = [];
}

export function preview(list: Cue[], o: Output) {
  stopPreview();
  Speech.stop();
  for (const c of list) previewTimers.push(setTimeout(() => emit(c, o), c.t * 1000));
}

export function stopGuide() {
  stopPreview();
  Speech.stop();
}
