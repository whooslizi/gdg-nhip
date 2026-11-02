import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Turnstile, type TurnstileHandle } from '@/components/Turnstile';
import { Button, buttonClass } from '@/components/ui/Button';
import { ApiError, isCaptchaError } from '@/lib/api-client';
import { useI18n } from '@/lib/i18n';
import { turnstileEnabled } from '@/lib/turnstile';
import type { QueueStatus } from '@/types/api';

const READ_SECONDS = 10;

/** Seconds of reading time left once it's this tab's turn. */
function useReadingTime(active: boolean) {
  const [left, setLeft] = useState(READ_SECONDS);
  useEffect(() => {
    if (!active) return;
    const started = Date.now();
    const id = setInterval(() => {
      const next = Math.max(0, READ_SECONDS - Math.floor((Date.now() - started) / 1000));
      setLeft(next);
      if (next === 0) clearInterval(id);
    }, 250);
    return () => clearInterval(id);
  }, [active]);
  return left;
}

/**
 * Queue in front of the seat map. The horse is the progress bar: it starts where the guest
 * joined and reaches the seat map when it's their turn.
 */
export function WaitingRoom({
  slug,
  title,
  status,
  joining,
  joinError,
  timedOut,
  onJoin,
  gatePassed,
  gating,
  gateError,
  onPassGate,
  onEnter,
}: {
  slug: string;
  title?: string;
  status?: QueueStatus;
  joining: boolean;
  joinError: Error | null;
  timedOut: boolean;
  onJoin: (turnstileToken: string | null) => void;
  /** The human check at the gate; the seat map only opens once it passed. */
  gatePassed: boolean;
  gating: boolean;
  gateError: Error | null;
  onPassGate: (turnstileToken: string | null) => void;
  onEnter: () => void;
}) {
  const { t } = useI18n();
  const [token, setToken] = useState<string | null>(null);
  const captcha = useRef<TurnstileHandle>(null);
  const needsCaptcha = turnstileEnabled();
  const queued = !!status && status.result !== 'not_in_queue';
  const admitted = status?.result === 'admitted' && !timedOut;
  const ahead = status?.result === 'waiting' ? status.ahead : 0;

  // Progress is measured against the longest line this tab has seen.
  const [longest, setLongest] = useState(ahead);
  if (ahead > longest) setLongest(ahead);
  const progress = admitted ? 1 : longest === 0 ? 0 : 1 - ahead / longest;

  const join = () => {
    onJoin(token);
    captcha.current?.reset();
  };
  // Join on arrival without a click; after a timeout the guest rejoins on purpose.
  const autoJoin = !queued && !timedOut && !joining && !joinError && (!needsCaptcha || !!token);
  useEffect(() => {
    if (autoJoin) join();
  });

  const checkGate = () => {
    onPassGate(token);
    captcha.current?.reset();
  };
  const atGate = admitted && !gatePassed;
  const autoGate = atGate && !gating && !gateError && (!needsCaptcha || !!token);
  useEffect(() => {
    if (autoGate) checkGate();
  });

  // The map opens once both the reading time is over and the human check passed.
  const secondsLeft = useReadingTime(admitted);
  const ready = admitted && gatePassed && secondsLeft === 0;
  useEffect(() => {
    if (ready) onEnter();
  }, [ready, onEnter]);

  const error = joinError ?? gateError;

  const heading = timedOut ? t('room.timedOut') : admitted ? t('room.yourTurn') : t('room.joining');
  const errorText = !error
    ? null
    : isCaptchaError(error)
      ? t('captcha.failed')
      : error instanceof ApiError && error.code === 'QUEUE_NOT_SET_UP'
        ? t('room.notSetUp')
        : error.message;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-10 lg:py-16">
      <p className="text-sm font-semibold tracking-wide text-wine-700 uppercase">
        {t('room.eyebrow')}
      </p>
      {title && <p className="mt-1 text-ink-muted">{title}</p>}
      <h1 className="mt-4 font-display text-4xl font-bold sm:text-5xl" aria-live="polite">
        {heading}
      </h1>
      {!admitted && !timedOut && (
        <p className="mt-6 flex items-baseline gap-4" aria-live="polite">
          <span className="font-display text-7xl font-bold text-wine-700 tabular-nums">
            {status?.result === 'waiting' ? ahead : '–'}
          </span>
          <span className="text-ink-muted">{t('room.aheadLabel')}</span>
        </p>
      )}
      <p className="mt-3 text-ink-muted">
        {timedOut
          ? t('room.timedOutBody')
          : admitted
            ? t('room.opensIn', { seconds: secondsLeft })
            : t('room.keepOpen')}
      </p>
      {atGate && !gateError && (
        <p className="mt-1 text-sm font-medium text-wine-700" aria-live="polite">
          {t('room.checking')}
        </p>
      )}

      <div className="mt-10" aria-hidden>
        <div className="relative h-24">
          <img
            src="/media/horse-in-motion.gif"
            alt=""
            width={150}
            height={100}
            className="absolute bottom-0 h-24 w-36 rounded-sm motion-safe:transition-[left] motion-safe:duration-1000 motion-reduce:hidden"
            style={{ left: `calc(${progress} * (100% - 9rem))` }}
          />
        </div>
        <div className="h-px bg-ink/30" />
        <div className="mt-2 flex justify-between text-xs text-ink-muted">
          <span>{t('room.trackStart')}</span>
          <span>{t('room.trackEnd')}</span>
        </div>
      </div>

      <ol className="mt-10 divide-y divide-line border-y border-line">
        {(['room.rule1', 'room.rule2', 'room.rule3'] as const).map((rule, i) => (
          <li key={rule} className="flex gap-4 py-4 text-sm">
            <span className="font-display text-lg font-bold text-wine-700 tabular-nums">
              {i + 1}
            </span>
            <span className="pt-0.5">{t(rule)}</span>
          </li>
        ))}
      </ol>

      {error && (
        <p role="alert" className="mt-6 text-sm text-wine-700">
          {errorText}
        </p>
      )}
      {(timedOut || joinError || !queued || atGate) && (
        <div className="mt-6">
          <Turnstile action={atGate ? 'gate' : 'queue'} onToken={setToken} ref={captcha} />
        </div>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        {admitted ? (
          gateError ? (
            <Button size="lg" onClick={checkGate} disabled={gating || (needsCaptcha && !token)}>
              {t('room.checkAgain')}
            </Button>
          ) : (
            <Button size="lg" onClick={onEnter} disabled={!gatePassed}>
              {t('room.openNow')}
            </Button>
          )
        ) : (
          (timedOut || joinError) && (
            <Button size="lg" onClick={join} disabled={joining || (needsCaptcha && !token)}>
              {t('room.rejoin')}
            </Button>
          )
        )}
        <Link to={`/events/${slug}`} className={buttonClass('secondary', 'lg')}>
          {t('room.back')}
        </Link>
      </div>

      <p className="mt-10 text-xs text-ink-muted">
        <a
          href="https://commons.wikimedia.org/wiki/File:Muybridge_race_horse_animated.gif"
          target="_blank"
          rel="noreferrer"
          className="hover:underline"
        >
          {t('room.credit')}
        </a>
      </p>
    </div>
  );
}
