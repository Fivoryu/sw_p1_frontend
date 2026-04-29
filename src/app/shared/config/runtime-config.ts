declare global {
  interface Window {
    __APP_CONFIG__?: {
      apiBaseUrl?: string;
      aiServiceBaseUrl?: string;
    };
  }
}

function normalizeBaseUrl(value: string | undefined, fallback: string): string {
  const normalized = (value || fallback).trim();
  return normalized.replace(/\/+$/, '');
}

function toWebSocketBaseUrl(httpUrl: string): string {
  if (httpUrl.startsWith('https://')) {
    return `wss://${httpUrl.slice('https://'.length)}`;
  }
  if (httpUrl.startsWith('http://')) {
    return `ws://${httpUrl.slice('http://'.length)}`;
  }
  return httpUrl;
}

const apiBaseUrl = normalizeBaseUrl(window.__APP_CONFIG__?.apiBaseUrl, 'https://sw1-p1-backend.onrender.com/api');
const aiServiceBaseUrl = normalizeBaseUrl(window.__APP_CONFIG__?.aiServiceBaseUrl, 'https://sw1-p1-fastapi.onrender.com');

export const runtimeConfig = {
  apiBaseUrl,
  apiV1BaseUrl: `${apiBaseUrl}/v1`,
  aiServiceBaseUrl,
  wsBaseUrl: `${toWebSocketBaseUrl(apiBaseUrl)}/ws`
};
