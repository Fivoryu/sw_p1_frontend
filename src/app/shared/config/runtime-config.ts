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

const apiBaseUrl = normalizeBaseUrl(window.__APP_CONFIG__?.apiBaseUrl, 'http://localhost:8080/api');
const aiServiceBaseUrl = normalizeBaseUrl(window.__APP_CONFIG__?.aiServiceBaseUrl, 'http://localhost:8090');

export const runtimeConfig = {
  apiBaseUrl,
  apiV1BaseUrl: `${apiBaseUrl}/v1`,
  aiServiceBaseUrl
};
