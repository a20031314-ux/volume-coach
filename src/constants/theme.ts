import { useColorScheme } from 'react-native';

const light = {
  bg: '#f3f4f6', surface: '#ffffff', ink: '#15181e', muted: '#5d6472', line: '#dde0e6',
  accent: '#2f47c9', accentInk: '#ffffff', accentSoft: '#e3e7fb',
  ok: '#1f8a4c', okSoft: '#dcf1e4', warn: '#b26b00', warnSoft: '#fbecd2',
  bad: '#c23a2b', badSoft: '#f9dfdb', rest: '#6a7080', restSoft: '#e7e9ee', band: '#cfd6f5',
};
const dark: typeof light = {
  bg: '#0f1115', surface: '#181b22', ink: '#e9ebf0', muted: '#9aa1ae', line: '#2a2e38',
  accent: '#7d90ff', accentInk: '#0f1115', accentSoft: '#232a4d',
  ok: '#5cc98a', okSoft: '#173022', warn: '#f0a93a', warnSoft: '#352812',
  bad: '#ff7a6b', badSoft: '#3a1c18', rest: '#9aa1ae', restSoft: '#252932', band: '#2c3566',
};

export type Palette = typeof light;
export const Palettes = { light, dark };

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export const Space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const Radius = { sm: 8, md: 12, pill: 999 } as const;
