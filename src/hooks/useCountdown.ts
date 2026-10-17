import { useEffect, useState } from 'react';

/**
 * Milliseconds until `expiresAt`, corrected for client clock skew using the
 * server time returned alongside it. Display only — the server decides expiry.
 */
export function useCountdown(expiresAt: string | null, serverTime: string | null) {
  const [offset] = useState(() => (serverTime ? new Date(serverTime).getTime() - Date.now() : 0));
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!expiresAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (!expiresAt) return null;
  return Math.max(0, new Date(expiresAt).getTime() - (now + offset));
}
