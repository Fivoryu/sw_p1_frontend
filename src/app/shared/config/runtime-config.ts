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

function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function detectDefaultApiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location && isLocalHost(window.location.hostname)) {
    return 'http://localhost:8080/api';
  }

  // In AWS, we serve the SPA via CloudFront and proxy /api/* back to the ALB.
  // Using same-origin avoids CORS and mixed-content problems.
  return `${window.location.origin}/api`;
}

function detectDefaultAiServiceBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location && isLocalHost(window.location.hostname)) {
    return 'http://localhost:8090';
  }

  // FastAPI is routed behind the same ALB via /api/fastapi/*
  return `${window.location.origin}/api/fastapi`;
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

const apiBaseUrl = normalizeBaseUrl(window.__APP_CONFIG__?.apiBaseUrl, detectDefaultApiBaseUrl());
const aiServiceBaseUrl = normalizeBaseUrl(window.__APP_CONFIG__?.aiServiceBaseUrl, detectDefaultAiServiceBaseUrl());

export const runtimeConfig = {
  apiBaseUrl,
  apiV1BaseUrl: `${apiBaseUrl}/v1`,
  aiServiceBaseUrl,
  wsBaseUrl: `${toWebSocketBaseUrl(apiBaseUrl)}/ws`
};
