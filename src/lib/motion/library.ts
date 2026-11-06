import type { Demo } from './engine';

/**
 * Demo data per exercise, keyed by the name in exercises.ts.
 * Angles: 0 = forward, 90 = up, -90 = down (the figure faces right).
 */
export const DEMOS: Record<string, Demo> = {
  '백스쿼트': {
    view: 'side',
    anchor: { at: 'ankle', to: [0, 0] },
    keys: {
      top: { torso: 85, th: -92, sh: -90, ua: 250, fa: 75 },
      bottom: { torso: 50, th: -10, sh: -110, ua: 215, fa: 40 },
    },
    seq: [['top', 0.6], ['bottom', 1.6], ['bottom', 0.3], ['top', 1.2]],
    equip: [{ k: 'barbell', at: { seg: 'torso', u: 0.97, v: -7 } }],
    muscles: ['quad', 'glute'],
    focus: [
      {
        pose: 'bottom', at: { seg: 'th', u: 0.5 }, r: 58, muscles: ['quad', 'glute'],
        guides: [{ k: 'hline', at: 'knee' }],
        title: '깊이', text: '엉덩이를 뒤로 빼며 앉고, 허벅지가 바닥과 평행해질 때까지 내려가요.',
      },
      {
        pose: 'bottom', at: 'knee', r: 44,
        guides: [{ k: 'vline', at: 'toe' }],
        title: '무릎', text: '무릎은 발끝 방향으로 나가요. 발끝보다 조금 앞으로 나가는 건 자연스러워요.',
      },
      {
        pose: 'bottom', at: { seg: 'torso', u: 0.4 }, r: 78,
        guides: [{ k: 'vline', at: { seg: 'ft', u: 0.4 } }],
        title: '바 경로', text: '바는 발 중앙 위에서 수직으로 오르내려요. 상체는 그 균형에 맞춰 기울어져요.',
      },
    ],
  },

  '바벨 벤치프레스': {
    view: 'side',
    anchor: { at: 'hip', to: [0, 52] },
    keys: {
      top: { torso: 180, head: 180, th: -15, sh: -105, ua: 90, fa: 90, uaL: 1 },
      bottom: { torso: 180, head: 180, th: -15, sh: -105, ua: -63, fa: 90, uaL: 0.62 },
    },
    seq: [['top', 0.6], ['bottom', 1.8], ['bottom', 0.25], ['top', 1.1]],
    equip: [{ k: 'bench', x: -82, y: 41, w: 94 }, { k: 'barbell', at: 'wrist' }],
    muscles: ['chest', 'tri'],
    focus: [
      {
        pose: 'bottom', at: 'elbow', r: 49, muscles: ['chest', 'tri'],
        guides: [{ k: 'vline', at: 'wrist' }],
        title: '팔뚝 수직', text: '바닥 지점에서 팔뚝이 바닥과 수직. 바는 가슴 아래쪽, 명치 바로 위에 닿아요.',
      },
      {
        pose: 'bottom', at: 'shoulder', r: 44, muscles: ['chest'],
        guides: [{ k: 'arrow', at: 'shoulder', dir: -20 }],
        title: '어깨 고정', text: '날개뼈를 모아 아래로 눌러 벤치에 붙여요. 어깨가 들리면 가슴 대신 어깨가 버텨요.',
      },
    ],
  },

  '루마니안 데드리프트': {
    view: 'side',
    anchor: { at: 'ankle', to: [0, 0] },
    keys: {
      top: { torso: 88, th: -88, sh: -92, ua: -86, fa: -86 },
      bottom: { torso: 25, th: -60, sh: -90, ua: -107, fa: -107 },
    },
    seq: [['top', 0.6], ['bottom', 2.0], ['bottom', 0.3], ['top', 1.3]],
    equip: [{ k: 'barbell', at: 'wrist' }],
    muscles: ['ham', 'glute'],
    focus: [
      {
        pose: 'bottom', at: 'hip', r: 52, muscles: ['ham', 'glute'],
        guides: [{ k: 'arrow', at: 'hip', dir: 180 }],
        title: '힙 힌지', text: '무릎은 살짝만 굽히고 엉덩이를 뒤로 밀어요. 햄스트링이 당기는 지점까지만 내려가요.',
      },
      {
        pose: 'bottom', at: { seg: 'torso', u: 0.5 }, r: 64, muscles: ['back'],
        guides: [{ k: 'line', a: 'hip', b: 'shoulder' }],
        title: '등 중립', text: '허리를 말지 않고 일직선으로. 바는 다리에 붙여서 내려요.',
      },
    ],
  },

  '랫풀다운': {
    view: 'side',
    anchor: { at: 'hip', to: [0, 44] },
    keys: {
      top: { torso: 100, th: 0, sh: -92, ua: 100, fa: 95, uaL: 1 },
      bottom: { torso: 105, th: 0, sh: -92, ua: -100, fa: 50, uaL: 0.8 },
    },
    seq: [['top', 0.6], ['bottom', 1.2], ['bottom', 0.3], ['top', 1.6]],
    equip: [
      { k: 'seat', x: -14, y: 33, w: 32 },
      { k: 'pad', at: { seg: 'th', u: 0.85, v: 9 } },
      { k: 'cable', from: [-16, 205], to: 'wrist' },
      { k: 'handle', at: 'wrist' },
    ],
    muscles: ['back', 'bi'],
    focus: [
      {
        pose: 'bottom', at: 'elbow', r: 46, muscles: ['back'],
        guides: [{ k: 'arrow', at: 'elbow', dir: -100 }],
        title: '팔꿈치로 당기기', text: '손이 아니라 팔꿈치를 옆구리 쪽으로 끌어내린다고 생각해요.',
      },
      {
        pose: 'bottom', at: 'shoulder', r: 49, muscles: ['back'],
        guides: [{ k: 'line', a: 'hip', b: 'shoulder' }],
        title: '가슴 들기', text: '가슴을 바 쪽으로 내밀고 어깨는 귀에서 멀리. 상체를 크게 뒤로 젖히지 않아요.',
      },
    ],
  },

  '사이드 레터럴 레이즈': {
    view: 'front',
    anchor: { at: 'ankle', to: [11, 0] },
    keys: {
      bottom: { torso: 90, th: -88, sh: -90, ua: -78, fa: -82 },
      top: { torso: 90, th: -88, sh: -90, ua: -3, fa: -10 },
    },
    seq: [['bottom', 0.5], ['top', 1.1], ['top', 0.35], ['bottom', 1.5]],
    equip: [{ k: 'dumbbell', at: 'wrist' }],
    muscles: ['sideDelt'],
    focus: [
      {
        pose: 'top', at: 'shoulder', r: 49, muscles: ['sideDelt'],
        guides: [{ k: 'hline', at: 'shoulder' }],
        title: '어깨 높이까지', text: '팔이 바닥과 평행한 높이까지만 올려요. 그 위로는 승모근이 일을 가져가요.',
      },
      {
        pose: 'top', at: 'elbow', r: 41, muscles: ['sideDelt'],
        guides: [{ k: 'arrow', at: 'elbow', dir: 90 }],
        title: '팔꿈치 리드', text: '팔꿈치를 살짝 굽힌 채 고정하고, 팔꿈치가 손보다 먼저 올라가요.',
      },
    ],
  },

  '바벨 컬': {
    view: 'side',
    anchor: { at: 'ankle', to: [0, 0] },
    keys: {
      bottom: { torso: 90, th: -90, sh: -90, ua: -88, fa: -84 },
      top: { torso: 90, th: -90, sh: -90, ua: -86, fa: 72 },
    },
    seq: [['bottom', 0.5], ['top', 1.0], ['top', 0.3], ['bottom', 1.6]],
    equip: [{ k: 'barbell', at: 'wrist', plate: 16 }],
    muscles: ['bi'],
    focus: [
      {
        pose: 'top', at: 'elbow', r: 44, muscles: ['bi'],
        guides: [{ k: 'vline', at: 'shoulder' }],
        title: '팔꿈치 고정', text: '팔꿈치는 옆구리에 붙인 채로. 앞으로 나오면 어깨가 대신 들어 올려요.',
      },
      {
        pose: 'bottom', at: 'elbow', r: 44, muscles: ['bi'],
        guides: [{ k: 'angle', a: 'shoulder', b: 'elbow', c: 'wrist' }],
        title: '끝까지 내리기', text: '팔을 거의 다 펴서 이두가 늘어난 상태까지 내렸다가 다시 올려요.',
      },
    ],
  },
};

export function demoFor(name: string): Demo | undefined {
  return DEMOS[name];
}
