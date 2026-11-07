/**
 * 식사 코스: a meal eaten in stages and shared — "삼겹살 구워 먹고 볶음밥까지". Amounts are what came
 * to the table; the user's share is that divided by how many ate. Stages not eaten are unchecked.
 */
import { FOOD_DB, macrosOf, type FoodDef, type Macros } from './foods';
import type { CourseItem, SavedCourse } from './types';

export type { CourseItem, SavedCourse };

const it = (n: string, amt: number, on = true): CourseItem => ({ n, amt, on });

/** Built-in courses, amounts for the whole table at `people`. */
export const COURSES: SavedCourse[] = [
  { name: '고깃집(삼겹살)', people: 2, items: [it('삼겹살', 400), it('쌈채소', 2), it('쌈장', 2), it('철판 볶음밥(고깃집)', 1), it('된장찌개', 1, false), it('물냉면', 1, false), it('소주', 1, false)] },
  { name: '고깃집(목살)', people: 2, items: [it('돼지 목살', 400), it('쌈채소', 2), it('쌈장', 2), it('철판 볶음밥(고깃집)', 1), it('된장찌개', 1, false), it('소주', 1, false)] },
  { name: '소고기 구이', people: 2, items: [it('소고기 등심', 300), it('쌈채소', 2), it('된장찌개', 1), it('흰쌀밥', 1, false), it('물냉면', 1, false)] },
  { name: '닭갈비 + 볶음밥', people: 2, items: [it('닭갈비', 2), it('우동사리', 1, false), it('철판 볶음밥(고깃집)', 1)] },
  { name: '곱창 + 볶음밥', people: 2, items: [it('곱창구이', 300), it('철판 볶음밥(고깃집)', 1), it('소주', 1, false)] },
  { name: '부대찌개 + 라면사리', people: 2, items: [it('부대찌개', 2), it('라면사리', 1), it('흰쌀밥', 2)] },
  { name: '샤브샤브', people: 2, items: [it('샤브샤브용 소고기', 300), it('쌈채소', 2), it('칼국수 사리', 1), it('죽(샤브샤브 마무리)', 1)] },
  { name: '횟집 + 매운탕', people: 2, items: [it('광어회', 400), it('매운탕', 1), it('흰쌀밥', 1, false), it('소주', 1, false)] },
  { name: '치킨 + 맥주', people: 2, items: [it('후라이드 치킨', 10), it('맥주', 1000)] },
  { name: '족발·보쌈 + 막국수', people: 2, items: [it('족발', 2), it('쌈채소', 1), it('막국수', 1, false)] },
  { name: '마라탕 + 꿔바로우', people: 2, items: [it('마라탕', 2), it('꿔바로우', 1)] },
];

const byName = (n: string): FoodDef | undefined => FOOD_DB.find((d) => d.n === n);

export interface ShareLine { food: FoodDef; amt: number; macros: Macros }

/** The user's share of the checked items (amount ÷ people), with each line's macros. */
export function myShare(c: SavedCourse): { lines: ShareLine[]; total: Macros } {
  const people = Math.max(1, c.people);
  const lines = c.items.filter((x) => x.on && x.amt > 0).flatMap((x) => {
    const food = byName(x.n);
    if (!food) return [];
    const amt = x.amt / people;
    return [{ food, amt, macros: macrosOf(food, amt) }];
  });
  const total = lines.reduce((a, l) => ({ k: a.k + l.macros.k, p: a.p + l.macros.p, c: a.c + l.macros.c, f: a.f + l.macros.f }), { k: 0, p: 0, c: 0, f: 0 });
  return { lines, total };
}

/** Every food a course can use exists in the food list (checked by tests). */
export const courseFoods = (c: SavedCourse) => c.items.map((x) => x.n);
