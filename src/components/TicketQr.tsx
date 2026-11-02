import { Download, QrCode } from 'lucide-react';
import { useEffect, useState } from 'react';
import { buttonClass } from '@/components/ui/Button';
import { useI18n } from '@/lib/i18n';

/**
 * The door ticket. `token` is signed by the server; never build one from booking data on the
 * client. Always black on white, even in dark mode, because scanners need the contrast.
 */
export function TicketQr({ token, code }: { token: string; code: string }) {
  const { t } = useI18n();
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Loaded on demand so the QR library only ships to people looking at a ticket.
    // 512 px so the saved image stays sharp when zoomed on a phone; shown at 256.
    import('qrcode')
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(token, {
          errorCorrectionLevel: 'M',
          margin: 2,
          width: 512,
          color: { dark: '#000000', light: '#ffffff' },
        }),
      )
      .then((url) => !cancelled && setSrc(url))
      .catch(() => !cancelled && setSrc(null));
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <section className="mx-6 mt-8 rounded-lg border-2 border-dashed border-wine-600 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-wine-700">
        <QrCode className="size-4" aria-hidden /> {t('ticket.title')}
      </h2>
      <div className="mt-4 flex flex-col items-center gap-3">
        {src ? (
          <img
            src={src}
            alt={t('ticket.alt', { code })}
            width={256}
            height={256}
            className="size-64 bg-white"
          />
        ) : (
          <div className="size-64 animate-pulse rounded bg-ink/10" aria-hidden />
        )}
        <p className="font-mono text-lg font-bold tracking-widest">{code}</p>
        {src && (
          <a href={src} download={`nhip-ticket-${code}.png`} className={buttonClass('primary')}>
            <Download className="size-4" aria-hidden /> {t('ticket.save')}
          </a>
        )}
      </div>
      <p className="mt-4 text-sm text-ink-muted">{t('ticket.hint')}</p>
    </section>
  );
}
