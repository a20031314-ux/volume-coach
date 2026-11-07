/**
 * Plays 가이드 모드 cues: speech (expo-speech) and short vibrations, on timers. Keeps the screen
 * on while a guided set or rest is running (timers stop when the phone sleeps, iOS especially).
 */
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Speech from 'expo-speech';
import { Platform, Vibration } from 'react-native';
import { create } from 'zustand';

import type { Cue } from '@/lib/guide';

export interface GuideState {
  mode: 'idle' | 'set' | 'rest';
  exKey: string | null;
  setNo: number;
  /** reps counted so far in this set */
  rep: number;
  phase: string;
}
export const useGuide = create<GuideState>(() => ({ mode: 'idle', exKey: null, setNo: 0, rep: 0, phase: '' }));

let timers: ReturnType<typeof setTimeout>[] = [];
let awake = false;

function clearTimers() {
  timers.forEach(clearTimeout);
  timers = [];
}

function keepAwake(on: boolean) {
  if (Platform.OS === 'web' || on === awake) return;
  awake = on;
  if (on) void activateKeepAwakeAsync('guide').catch(() => undefined);
  else void deactivateKeepAwake('guide').catch(() => undefined);
}

export interface Output { voice: boolean; haptic: boolean }

function emit(c: Cue, out: Output) {
  if (c.say && out.voice) {
    Speech.stop();
    Speech.speak(c.say, { language: 'ko-KR', rate: 1.1 });
  }
  if (c.buzz && out.haptic && Platform.OS !== 'web') Vibration.vibrate(60);
}

/** Play a cue timeline from now (offset = seconds to wait before t = 0). */
export function play(cues: Cue[], out: Output, opts: { offset?: number; onCue?: (c: Cue) => void; onEnd?: () => void; endAt?: number } = {}) {
  const base = (opts.offset ?? 0) * 1000;
  for (const c of cues) {
    timers.push(setTimeout(() => {
      emit(c, out);
      if (c.rep != null || c.phase != null) useGuide.setState((s) => ({ rep: c.rep ?? s.rep, phase: c.phase ?? s.phase }));
      opts.onCue?.(c);
      if (c.end) opts.onEnd?.();
    }, base + c.t * 1000));
  }
  if (opts.endAt != null && opts.onEnd) timers.push(setTimeout(opts.onEnd, base + opts.endAt * 1000));
}

export function beginSet(exKey: string, setNo: number) {
  clearTimers();
  keepAwake(true);
  useGuide.setState({ mode: 'set', exKey, setNo, rep: 0, phase: '' });
}

export function beginRest(exKey: string, nextSet: number) {
  clearTimers();
  keepAwake(true);
  useGuide.setState({ mode: 'rest', exKey, setNo: nextSet, rep: 0, phase: '휴식' });
}

export function stopGuide() {
  clearTimers();
  Speech.stop();
  keepAwake(false);
  useGuide.setState({ mode: 'idle', exKey: null, setNo: 0, rep: 0, phase: '' });
}

/** one-off line (e.g. "운동 끝, 다음은 랫풀다운") */
export function say(text: string, out: Output) {
  emit({ t: 0, say: text, buzz: true }, out);
}

/** settings screen 들어보기: play a timeline once */
export function preview(cues: Cue[], out: Output) {
  clearTimers();
  Speech.stop();
  play(cues, out);
}
