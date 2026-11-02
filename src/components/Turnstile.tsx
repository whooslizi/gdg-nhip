import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { useI18n } from '@/lib/i18n';
import { turnstileEnabled } from '@/lib/turnstile';

declare global {
  interface Window {
    turnstile?: {
      render(el: HTMLElement, options: Record<string, unknown>): string;
      reset(widgetId: string): void;
      remove(widgetId: string): void;
    };
  }
}

export type TurnstileAction = 'hold' | 'lookup' | 'cancel';
export interface TurnstileHandle {
  reset(): void;
}

let scriptLoad: Promise<void> | undefined;

function loadScript() {
  if (window.turnstile) return Promise.resolve();
  scriptLoad ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoad = undefined; // let a remount retry
      reject(new Error('Turnstile failed to load'));
    };
    document.head.appendChild(script);
  });
  return scriptLoad;
}

/** Tokens are single-use: call `ref.reset()` after every submit, success or failure. */
export function Turnstile({
  action,
  onToken,
  ref,
}: {
  action: TurnstileAction;
  onToken: (token: string | null) => void;
  ref?: Ref<TurnstileHandle>;
}) {
  const { locale } = useI18n();
  const el = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);
  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  });
  const enabled = turnstileEnabled();

  useImperativeHandle(ref, () => ({
    reset() {
      onTokenRef.current(null);
      if (widgetId.current) window.turnstile?.reset(widgetId.current);
    },
  }));

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !el.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(el.current, {
          sitekey: import.meta.env.VITE_TURNSTILE_SITE_KEY,
          action,
          theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
          language: locale,
          callback: (token: string) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => onTokenRef.current(null),
        });
      })
      .catch(() => onTokenRef.current(null));
    return () => {
      cancelled = true;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = undefined;
    };
  }, [enabled, action, locale]);

  return enabled ? <div ref={el} /> : null;
}
