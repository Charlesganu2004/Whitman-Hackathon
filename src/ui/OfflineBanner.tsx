import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { OfflineGuidance } from '../core/connection';
import { Body, Button, Field } from './components';
import { Reveal } from './motion';
import { useTheme, type ThemePalette } from './theme';

interface Props {
  guidance: OfflineGuidance;
  /** True while a manual check is running. The quiet background checks never set it. */
  retrying: boolean;
  serverUrl: string;
  onServerUrlChange: (text: string) => void;
  onRetry: () => void;
  /** Saves the typed address and checks it. */
  onSaveServer: () => void;
}

/** Shown while the Unscroll server cannot be reached. The saved snapshot stays readable underneath it. */
export function OfflineBanner({ guidance, retrying, serverUrl, onServerUrlChange, onRetry, onSaveServer }: Props) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [editing, setEditing] = useState(false);
  return <Reveal>
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.banner}>
      <View style={s.heading}>
        <View accessible={false} style={s.dot} />
        <Text accessibilityRole="header" style={s.title}>{guidance.title}</Text>
      </View>
      <Text selectable style={s.address}>{guidance.tried}</Text>
      <Body>{guidance.fix}</Body>
      <Body muted>{guidance.saved}</Body>
      <Text style={s.quiet}>It also checks again by itself.</Text>
      <Button title="Try again" busy={retrying} onPress={onRetry} />
      <Button title={editing ? 'Hide server connection' : 'Server connection'} secondary onPress={() => setEditing(!editing)} />
      {editing && <View style={s.editor}>
        <Field label="Server URL" value={serverUrl} onChangeText={onServerUrlChange} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="http://192.168.1.100:3001" />
        <Button title="Save and try again" busy={retrying} disabled={!serverUrl.trim()} onPress={onSaveServer} />
      </View>}
    </View>
  </Reveal>;
}

function createStyles(colors: ThemePalette) {
  return StyleSheet.create({
    banner: { backgroundColor: colors.dangerSurface, borderWidth: 1, borderColor: colors.dangerLine, borderRadius: 20, padding: 20, gap: 12 },
    heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger },
    title: { flex: 1, color: colors.ink, fontSize: 18, lineHeight: 25, fontWeight: '700', letterSpacing: -0.3 },
    address: { alignSelf: 'flex-start', color: colors.ink, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.dangerLine, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, lineHeight: 20, overflow: 'hidden' },
    quiet: { color: colors.muted, fontSize: 13, lineHeight: 19 },
    editor: { gap: 12, borderTopWidth: 1, borderTopColor: colors.dangerLine, paddingTop: 16 },
  });
}
