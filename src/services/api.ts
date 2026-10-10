import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { readApiUrl, readToken, writeApiUrl } from './cache';

const API_PORT = 3001;

// Expo Go loads the bundle from the development computer, so the API is on that host too. On a phone, localhost is the phone.
function developmentHost() {
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost ?? Constants.linkingUri?.replace(/^[a-z+]+:\/\//i, '');
  const host = hostUri?.split('/')[0].replace(/:\d+$/, '');
  // A tunnel host forwards only the bundler port, so the API is unreachable through it.
  return host && /^[\w.-]+$/.test(host) && !/exp\.direct$|ngrok/i.test(host) ? host : null;
}

const defaultUrl = process.env.EXPO_PUBLIC_API_URL
  || `http://${(Platform.OS === 'web' ? globalThis.location?.hostname : developmentHost()) || 'localhost'}:${API_PORT}`;
let baseUrl = defaultUrl;

/** The server answered with an error status. The message is the server's own wording. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.name = 'ApiError'; this.status = status; }
}
/** The server could not be reached at all: a refused, unreachable or timed out connection. */
export class NetworkError extends Error {
  address: string;
  constructor(address: string) { super('The Unscroll server cannot be reached right now.'); this.name = 'NetworkError'; this.address = address; }
}

// Every request reports whether the server answered, so one place can show the offline state and recover from it.
type ConnectionListener = (reachable: boolean) => void;
const listeners = new Set<ConnectionListener>();
export function subscribeConnection(listener: ConnectionListener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
const announce = (reachable: boolean) => listeners.forEach(listener => listener(reachable));

async function reachable(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try { return (await fetch(`${url}/health`, { signal: controller.signal })).ok; } catch { return false; } finally { clearTimeout(timer); }
}

// An address saved on another network must not strand the app while the computer running Expo is reachable.
export async function initializeApi() {
  const saved = await readApiUrl();
  baseUrl = saved && saved !== defaultUrl && !(await reachable(saved)) && await reachable(defaultUrl) ? defaultUrl : saved || defaultUrl;
  return baseUrl;
}
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
    announce(true);
    const data = await response.json();
    if (!response.ok) throw new ApiError(data.error || `Server returned ${response.status}.`, response.status);
    return data as T;
  } catch (error) {
    if (error instanceof TypeError || (error instanceof Error && error.name === 'AbortError')) { announce(false); throw new NetworkError(baseUrl); }
    throw error;
  } finally { clearTimeout(timer); }
}
