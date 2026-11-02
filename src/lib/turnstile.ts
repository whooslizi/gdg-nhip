import { API_URL } from '@/lib/api-client';

/** The mock API has no server to verify tokens, so the check only runs against the real backend. */
export const turnstileEnabled = () => Boolean(API_URL && import.meta.env.VITE_TURNSTILE_SITE_KEY);
