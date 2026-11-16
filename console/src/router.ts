import { useEffect, useState } from 'react';

export function useRoute(): string[] {
  const get = () => (location.hash.replace(/^#\/?/, '').split('?')[0] || '').split('/').filter(Boolean).map(decodeURIComponent);
  const [route, setRoute] = useState(get);
  useEffect(() => {
    const on = () => { setRoute(get()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export const href = (...parts: string[]) => `#/${parts.map(encodeURIComponent).join('/')}`;
export const go = (...parts: string[]) => { location.hash = href(...parts); };

export function useQueryState(key: string, initial: string): [string, (v: string) => void] {
  const read = () => new URLSearchParams(location.hash.split('?')[1] || '').get(key) ?? initial;
  const [v, setV] = useState(read);
  const set = (nv: string) => {
    const [path, q] = location.hash.split('?');
    const p = new URLSearchParams(q || '');
    if (nv === initial) p.delete(key); else p.set(key, nv);
    const s = p.toString();
    history.replaceState(null, '', `${path || '#/'}${s ? `?${s}` : ''}`);
    setV(nv);
  };
  return [v, set];
}
