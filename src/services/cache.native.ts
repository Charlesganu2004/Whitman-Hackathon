import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import type { Snapshot } from '../core/types';

const database = SQLite.openDatabaseAsync('interview-unlocked.db').then(async db => {
  await db.execAsync('PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT NOT NULL);');
  return db;
});
async function get(key: string) {
  return (await (await database).getFirstAsync<{ value: string }>('SELECT value FROM cache WHERE key = ?', key))?.value ?? null;
}
async function set(key: string, value: string) {
  await (await database).runAsync('INSERT INTO cache (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', key, value);
}
export async function readSnapshot(): Promise<Snapshot | null> {
  const value = await get('snapshot');
  return value ? JSON.parse(value) : null;
}
export async function writeSnapshot(snapshot: Snapshot) { await set('snapshot', JSON.stringify(snapshot)); }
export async function readToken() { return SecureStore.getItemAsync('interview-token'); }
export async function writeToken(token: string) { await SecureStore.setItemAsync('interview-token', token); }
export async function readApiUrl() { return get('api-url'); }
export async function writeApiUrl(url: string) { await set('api-url', url); }
export async function readThemeMode() { return get('theme-mode'); }
export async function writeThemeMode(mode: string) { await set('theme-mode', mode); }
export async function readThemeAccent() { return get('theme-accent'); }
export async function writeThemeAccent(accent: string) { await set('theme-accent', accent); }
export async function readAvatar(id: string) { return get('profile-avatar:' + id); }
export async function writeAvatar(id: string, image: string) { await set('profile-avatar:' + id, image); }
export async function clearAccount() {
  await SecureStore.deleteItemAsync('interview-token');
  await (await database).runAsync('DELETE FROM cache WHERE key = ?', 'snapshot');
}
