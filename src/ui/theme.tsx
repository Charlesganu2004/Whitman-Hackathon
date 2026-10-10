import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useColorScheme } from 'react-native';
import { readThemeAccent, readThemeMode, writeThemeAccent, writeThemeMode } from '../services/cache';

export type ThemeMode = 'light' | 'dark' | 'system';
export type Accent = 'pink' | 'red' | 'blue' | 'green';
export interface ThemePalette {
  background: string; surface: string; ink: string; muted: string; accent: string; accentBright: string;
  onAccent: string; forest: string; pale: string; line: string; danger: string; dangerSurface: string;
  dangerLine: string; subtle: string; ringTrack: string; hero: string; onHero: string; heroMuted: string; heroLine: string;
}
export const lightColors: ThemePalette = {
  background: '#FFF7FA', surface: '#FFFFFF', ink: '#241A22', muted: '#76636F', accent: '#B32968', accentBright: '#F38DBA',
  onAccent: '#FFFFFF', forest: '#211820', pale: '#F8DFEB', line: '#E8D9E1', danger: '#A32C42', dangerSurface: '#FFF0F2',
  dangerLine: '#EAC2CD', subtle: '#FCF3F7', ringTrack: '#EBDDE5', hero: '#211820', onHero: '#FFF1F8', heroMuted: '#DEC2D1', heroLine: '#624050',
};
export const darkColors: ThemePalette = {
  background: '#111014', surface: '#1D1A20', ink: '#FAEFF5', muted: '#B9A7B3', accent: '#F28DBB', accentBright: '#FFB0D4',
  onAccent: '#27121E', forest: '#211820', pale: '#35232F', line: '#3D303A', danger: '#FF9BB0', dangerSurface: '#3A202A',
  dangerLine: '#724252', subtle: '#252027', ringTrack: '#44303E', hero: '#211820', onHero: '#FFF1F8', heroMuted: '#DEC2D1', heroLine: '#624050',
};
const accents: Record<'light' | 'dark', Record<Accent, Pick<ThemePalette, 'accent' | 'accentBright' | 'onAccent' | 'pale' | 'ringTrack' | 'heroLine'>>> = {
  light: {
    pink: { accent: '#B32968', accentBright: '#F38DBA', onAccent: '#FFFFFF', pale: '#F8DFEB', ringTrack: '#EBDDE5', heroLine: '#624050' },
    red: { accent: '#B5263D', accentBright: '#FF93A4', onAccent: '#FFFFFF', pale: '#FBE0E5', ringTrack: '#EFDCE0', heroLine: '#653942' },
    blue: { accent: '#245DB8', accentBright: '#94BAFF', onAccent: '#FFFFFF', pale: '#E1EBFF', ringTrack: '#DCE5F3', heroLine: '#394D74' },
    green: { accent: '#256747', accentBright: '#8ED5AC', onAccent: '#FFFFFF', pale: '#DFF0E5', ringTrack: '#DCE8E0', heroLine: '#375F4A' },
  },
  dark: {
    pink: { accent: '#F28DBB', accentBright: '#FFB0D4', onAccent: '#27121E', pale: '#35232F', ringTrack: '#44303E', heroLine: '#624050' },
    red: { accent: '#F78B9B', accentBright: '#FFB5C0', onAccent: '#2F1118', pale: '#38212A', ringTrack: '#4A2F38', heroLine: '#653942' },
    blue: { accent: '#8FB4FC', accentBright: '#BCD2FF', onAccent: '#12213E', pale: '#222C41', ringTrack: '#303D55', heroLine: '#394D74' },
    green: { accent: '#8ED5AC', accentBright: '#B5F0CF', onAccent: '#10271A', pale: '#20372C', ringTrack: '#304A3D', heroLine: '#375F4A' },
  },
};
interface ThemeContextValue { colors: ThemePalette; mode: ThemeMode; setMode: (mode: ThemeMode) => void; accent: Accent; setAccent: (accent: Accent) => void; isDark: boolean; persistenceError: string | null }
const ThemeContext = createContext<ThemeContextValue | null>(null);
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, updateMode] = useState<ThemeMode>('system');
  const [accent, updateAccent] = useState<Accent>('pink');
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const changed = useRef(false);
  const accentChanged = useRef(false);
  useEffect(() => {
    let mounted = true;
    readThemeMode().then(value => { if (mounted && !changed.current && ['light', 'dark', 'system'].includes(value ?? '')) updateMode(value as ThemeMode); }).catch(() => { if (mounted) setPersistenceError('Appearance could not be loaded from this device.'); });
    readThemeAccent().then(value => { if (mounted && !accentChanged.current && ['pink', 'red', 'blue', 'green'].includes(value ?? '')) updateAccent(value as Accent); }).catch(() => { if (mounted) setPersistenceError('Accent color could not be loaded from this device.'); });
    return () => { mounted = false; };
  }, []);
  const setMode = useCallback((value: ThemeMode) => {
    changed.current = true;
    updateMode(value);
    setPersistenceError(null);
    writeThemeMode(value).catch(() => setPersistenceError('Appearance changed, but could not be saved on this device.'));
  }, []);
  const setAccent = useCallback((value: Accent) => {
    accentChanged.current = true;
    updateAccent(value);
    setPersistenceError(null);
    writeThemeAccent(value).catch(() => setPersistenceError('Accent changed, but could not be saved on this device.'));
  }, []);
  const isDark = mode === 'dark' || (mode === 'system' && system === 'dark');
  const colors = useMemo(() => ({ ...(isDark ? darkColors : lightColors), ...accents[isDark ? 'dark' : 'light'][accent] }), [isDark, accent]);
  const value = useMemo(() => ({ colors, mode, setMode, accent, setAccent, isDark, persistenceError }), [colors, mode, setMode, accent, setAccent, isDark, persistenceError]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('ThemeProvider must wrap the app before using themed UI.');
  return theme;
}
