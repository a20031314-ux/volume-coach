/**
 * 온라인 음식 검색: the shared cache (food_cache, readable without login) and the AI lookup
 * (Edge Function `food-lookup`, login required). Results are kept on the phone so they work
 * offline and show up in the normal search next time.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { FoodDef } from './foods';
import { supabase } from './supabase';

export interface CacheRow {
  id: string; name: string; brand: string | null; unit: string; base: number; g_per: number | null;
  k: number; p: number; c: number; f: number; est_cf: boolean;
  source_kind: 'official' | 'public' | 'other' | 'estimate'; source_url: string | null; checked: string; shared: boolean;
}

export const SOURCE_NAME: Record<CacheRow['source_kind'], string> = {
  official: '업체 공개값', public: '공공 자료', other: '웹 자료(검증 전)', estimate: 'AI 추정',
};

const UNITS: FoodDef['unit'][] = ['g', 'ml', '개', '공기', '장', '큰술', '스쿱', '인분', '그릇', '줄', '봉', '팩', '조각', '캔', '병', '잔', '정', '캡슐', '포'];

export function toFoodDef(r: CacheRow): FoodDef {
  const unit = (UNITS as string[]).includes(r.unit) ? (r.unit as FoodDef['unit']) : '인분';
  const base = Number(r.base) || 1;
  return {
    n: r.name, unit, base, step: unit === 'g' || unit === 'ml' ? 10 : 0.5,
    k: Number(r.k), p: Number(r.p), c: Number(r.c), f: Number(r.f), g: 'brand',
    ...(r.g_per ? { gPer: Number(r.g_per) } : {}),
    brand: r.brand ?? undefined, estCF: r.est_cf,
    cloud: { id: r.id, kind: r.source_kind, url: r.source_url, checked: r.checked, shared: r.shared },
  };
}

/** foods found online, kept on this phone (newest first) */
interface CloudState { foods: FoodDef[] }
export const useCloudFoods = create<CloudState>()(
  persist((): CloudState => ({ foods: [] }), { name: 'volume-coach-cloud-foods', storage: createJSONStorage(() => AsyncStorage) }),
);
export function keepCloudFood(d: FoodDef) {
  const rest = useCloudFoods.getState().foods.filter((x) => x.n !== d.n);
  useCloudFoods.setState({ foods: [d, ...rest].slice(0, 300) });
}

/** Shared cache, by name. Empty when offline or the server isn't set up. */
export async function searchShared(q: string): Promise<FoodDef[]> {
  if (!supabase || q.trim().length < 2) return [];
  const term = q.trim().replace(/[%_,()]/g, '');
  const { data, error } = await supabase.from('food_cache')
    .select('id, name, brand, unit, base, g_per, k, p, c, f, est_cf, source_kind, source_url, checked, shared').ilike('name', `%${term}%`).limit(10);
  if (error || !data) return [];
  return (data as CacheRow[]).map(toFoodDef);
}

export type LookupResult =
  | { ok: true; food: FoodDef; cached: boolean }
  | { ok: false; reason: 'login' | 'daily' | 'cap' | 'notfound' | 'offline' | 'error' };

/** AI lookup (one web search per new menu; repeats come from the cache). */
export async function aiLookup(q: string): Promise<LookupResult> {
  if (!supabase) return { ok: false, reason: 'offline' };
  const { data: s } = await supabase.auth.getSession();
  if (!s.session) return { ok: false, reason: 'login' };
  const { data, error } = await supabase.functions.invoke('food-lookup', { body: { query: q.trim() } });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 401) return { ok: false, reason: 'login' };
    if (status === 429) return { ok: false, reason: 'daily' };
    if (status === 503) return { ok: false, reason: 'cap' };
    return { ok: false, reason: 'error' };
  }
  if (!data?.food) return { ok: false, reason: 'notfound' };
  return { ok: true, food: toFoodDef(data.food as CacheRow), cached: !!data.cached };
}

export async function reportFood(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('food_report').insert({ food_id: id });
  return !error;
}

export const LOOKUP_MESSAGE: Record<Exclude<LookupResult, { ok: true }>['reason'], string> = {
  login: '로그인하면 AI로 찾을 수 있어요',
  daily: '오늘 AI 검색을 모두 썼어요 (하루 30건)',
  cap: '이번 달 AI 검색이 많아 잠시 쉬어요. 직접 입력해 주세요',
  notfound: '공개된 영양정보를 찾지 못했어요. 직접 입력해 주세요',
  offline: '서버에 연결할 수 없어요',
  error: '검색 중 문제가 생겼어요. 잠시 후 다시 해 주세요',
};
