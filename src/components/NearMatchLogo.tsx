import { useState } from 'react';

export const CORE_LOGO_PATH =
  '/assets/aistudio/ChatGPT_Image_Jun_29__2026__07_26_24_AM_copy_9110dafc.png';

interface NearMatchLogoProps {
  height?: number;
  showWordmark?: boolean;
  wordmarkClassName?: string;
}

export function NearMatchLogo({
  height = 40,
  showWordmark = true,
  wordmarkClassName = 'text-2xl text-[#E8603A]',
}: NearMatchLogoProps) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <span className="inline-flex items-center gap-2.5 select-none whitespace-nowrap shrink-0">
      {!imgFailed ? (
        <img
          src={CORE_LOGO_PATH}
          alt="NearMatch logo"
          style={{ height: `${height}px` }}
          className="w-auto object-contain shrink-0"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span
          style={{ width: `${height}px`, height: `${height}px` }}
          className="rounded-xl bg-[#E8603A] text-white font-logo flex items-center justify-center shrink-0"
        >
          N
        </span>
      )}
      {showWordmark ? (
        <span className={`font-logo leading-none ${wordmarkClassName}`}>NearMatch</span>
      ) : null}
    </span>
  );
}
