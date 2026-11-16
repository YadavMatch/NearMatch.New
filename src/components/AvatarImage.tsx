import { useEffect, useState } from 'react';
import { isValidImageSrc } from '../lib/format';

interface AvatarImageProps {
  src?: string;
  name: string;
  className?: string;
}

export function AvatarImage({ src, name, className = '' }: AvatarImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const valid = Boolean(src && isValidImageSrc(src) && !failed);
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  if (!valid) {
    return (
      <div
        className={`bg-gradient-to-br from-[#FDE4D8] to-[#F5C4A8] text-[#3D2817] flex items-center justify-center font-bold select-none ${className}`}
        aria-label={name}
      >
        <span>{initials || 'N'}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
      loading="lazy"
    />
  );
}
