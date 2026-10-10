import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from './components';
import { AmbientBackground, Reveal } from './motion';
import { FocusOrbit } from './visuals';
import { useTheme, type ThemePalette } from './theme';

export function BrandIntro() {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  return <View style={s.intro}><AmbientBackground hero /><Reveal><Text style={s.introEyebrow}>MAKE ROOM FOR YOUR FUTURE</Text></Reveal><FocusOrbit /><Reveal delay={100}><Text style={s.introBrand}>Unscroll<Text style={s.brandDot}>.</Text></Text><Text style={s.introTagline}>Practice for what’s next.</Text></Reveal><Reveal delay={200}><View style={s.loadingDots}>{[0, 1, 2].map(dot => <View key={dot} style={[s.loadingDot, { opacity: 1 - dot * 0.25 }]} />)}</View><Text accessibilityLiveRegion="polite" aria-live="polite" style={s.loadingLabel}>Getting your plan ready</Text></Reveal></View>;
}
export function Welcome({ onSignup, onLogin }: { onSignup: () => void; onLogin: () => void }) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  return <View style={s.welcome}>
    <Reveal><View style={s.welcomeArtwork}><AmbientBackground hero /><Text style={s.welcomeEyebrow}>A BETTER KIND OF SCREEN TIME</Text><FocusOrbit /><View style={s.artworkCaption}><View style={s.captionDot} /><Text style={s.captionText}>Your next opportunity is worth the focus.</Text></View></View></Reveal>
    <Reveal delay={100}><Text style={s.welcomeTitle}>{'Less scrolling.\nMore possibility.'}</Text><Text style={s.welcomeBody}>Turn a few minutes of distraction into interview confidence. Practice, learn, and earn your break.</Text></Reveal>
    <Reveal delay={180}><View style={s.actions}><Button title="Create account" onPress={onSignup} /><Button title="Log in" secondary onPress={onLogin} /><Text style={s.footnote}>Technical skills. Better stories. One daily habit.</Text></View></Reveal>
  </View>;
}
function createStyles(colors: ThemePalette) { return StyleSheet.create({
  intro: { flex: 1, backgroundColor: colors.hero, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 26 }, introEyebrow: { color: colors.heroMuted, fontSize: 10, letterSpacing: 2.3, fontWeight: '600', textAlign: 'center' }, introBrand: { color: colors.onHero, fontSize: 54, lineHeight: 64, fontWeight: '700', letterSpacing: -2.2, textAlign: 'center' }, brandDot: { color: colors.accentBright }, introTagline: { color: colors.heroMuted, fontSize: 15, textAlign: 'center', lineHeight: 24 }, loadingDots: { flexDirection: 'row', alignSelf: 'center', gap: 7, marginTop: 6, marginBottom: 12 }, loadingDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accentBright }, loadingLabel: { color: colors.heroMuted, fontSize: 11, letterSpacing: 0.4, textAlign: 'center' },
  welcome: { gap: 27, paddingTop: 6 }, welcomeArtwork: { backgroundColor: colors.hero, borderRadius: 28, padding: 24, paddingTop: 28, minHeight: 304, alignItems: 'center', justifyContent: 'space-between', gap: 10, overflow: 'hidden' }, welcomeEyebrow: { color: colors.heroMuted, fontSize: 10, fontWeight: '600', letterSpacing: 1.8 }, artworkCaption: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }, captionDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accentBright }, captionText: { color: colors.heroMuted, fontSize: 11, lineHeight: 18, flexShrink: 1 }, welcomeTitle: { color: colors.ink, fontSize: 40, lineHeight: 46, fontWeight: '700', letterSpacing: -1.5 }, welcomeBody: { marginTop: 13, color: colors.muted, fontSize: 15, lineHeight: 24, maxWidth: 430 }, actions: { gap: 12 }, footnote: { color: colors.muted, fontSize: 11, lineHeight: 18, textAlign: 'center', paddingTop: 5 },
}); }
