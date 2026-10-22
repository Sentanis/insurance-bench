import { inject, type BeforeSendEvent } from '@vercel/analytics';

const routes = new Set(['/', '/index.html', '/research.html', '/benchmarks', '/benchmarks/', '/benchmarks/index.html', '/self-runs', '/self-runs/', '/self-runs/index.html']);

export function analyticsBeforeSend(event: BeforeSendEvent, referrer = ""): BeforeSendEvent | null {
  if (event.type !== 'pageview') return null;
  try {
    const url = new URL(event.url);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) return null;
    if (referrer) {
      const source = new URL(referrer);
      if (source.origin !== url.origin && (source.pathname !== '/' || source.search || source.hash || source.username || source.password)) return null;
    }
    return {type: 'pageview', url: url.origin + (routes.has(url.pathname) ? url.pathname : '/other')};
  } catch { return null; }
}

if (typeof window !== 'undefined') inject({ beforeSend: event => analyticsBeforeSend(event, document.referrer), debug: false, mode: 'production' });
