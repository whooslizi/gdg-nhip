import { ImageOff } from 'lucide-react';
import { useState } from 'react';
import { imageCredits } from '@/data/image-credits';

export function Poster({
  src,
  alt,
  className = '',
  eager = false,
  showCredit = true,
}: {
  src: string | null;
  alt: string;
  className?: string;
  eager?: boolean;
  showCredit?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const credit = src && showCredit ? imageCredits[src] : undefined;
  return (
    <div className={`relative overflow-hidden bg-burgundy-900 ${className}`}>
      {src && !failed ? (
        <img
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        <div
          className="grid size-full place-items-center text-blush-300"
          role="img"
          aria-label={alt}
        >
          <ImageOff className="size-8" aria-hidden />
        </div>
      )}
      {credit && !failed && (
        // z-10 keeps the link clickable above a card's stretched link.
        <p className="absolute right-1.5 bottom-1.5 z-10 rounded bg-black/55 px-1.5 py-0.5 text-[10px] leading-tight text-white/90">
          Photo:{' '}
          <a href={credit.sourceUrl} target="_blank" rel="noreferrer" className="underline">
            {credit.author}
          </a>
          ,{' '}
          <a href={credit.licenseUrl} target="_blank" rel="noreferrer" className="underline">
            {credit.license}
          </a>
        </p>
      )}
    </div>
  );
}
