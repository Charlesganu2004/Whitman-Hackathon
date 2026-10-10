import { Platform } from 'react-native';
import { readApiUrl, readToken, writeApiUrl } from './cache';

let baseUrl = process.env.EXPO_PUBLIC_API_URL || (Platform.OS === 'web' ? `http://${globalThis.location?.hostname || 'localhost'}:3001` : 'http://localhost:3001');
export async function initializeApi() { baseUrl = (await readApiUrl()) || baseUrl; return baseUrl; }
export function getApiUrl() { return baseUrl; }
export async function configureApi(url: string) {
  const parsed = new URL(url.trim());
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error('Enter a server URL such as http://192.168.1.100:3001.');
  baseUrl = parsed.origin;
  await writeApiUrl(baseUrl);
}
export async function request<T>(path: string, body?: unknown, method?: string, timeoutMs?: number): Promise<T> {
  const token = await readToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs ?? (body === undefined ? 5000 : 65000));
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: method || (body === undefined ? 'GET' : 'POST'),
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Server returned ${response.status}.`);
    return data as T;
  } catch (error) {
    if (error instanceof TypeError || (error instanceof Error && error.name === 'AbortError')) throw new Error(`Cannot reach ${baseUrl}. Start the server and use this computer's LAN address. Both devices must share Wi-Fi.`);
    throw error;
  } finally { clearTimeout(timer); }
}
