import { useEffect, useState } from 'react';
import { HeartHandshake } from 'lucide-react';
import {
  formatPulseDateLabel,
  getDailyPulseQuote,
  getLocalDateKey,
} from '../lib/dailyPulse';

export function DailyNearMatchPulse() {
  const [dateKey, setDateKey] = useState(() => getLocalDateKey());

  useEffect(() => {
    const checkDateRollover = () => {
      const nextKey = getLocalDateKey();
      setDateKey((prev) => (prev === nextKey ? prev : nextKey));
    };

    const intervalId = window.setInterval(checkDateRollover, 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const [year, month, day] = dateKey.split('-').map(Number);
  const activeDate = new Date(year, month - 1, day);
  const pulse = getDailyPulseQuote(activeDate);
  const dateLabel = formatPulseDateLabel(activeDate);

  return (
    <section
      aria-label="Daily NearMatch Pulse"
      className="bg-gradient-to-br from-[#FFFDF9] via-[#FFF8EC] to-[#FDE4D8]/60 border border-[#F5C4A8] rounded-3xl p-6 space-y-3.5 shadow-[0_2px_8px_rgba(61,40,23,0.06)]"
    >
      <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#2E6B5C] font-semibold">
        <HeartHandshake className="w-4 h-4 text-[#E8603A] shrink-0" />
        <span>
          Daily NearMatch Pulse · {dateLabel}
        </span>
      </div>

      <blockquote className="text-[15px] sm:text-base font-semibold text-[#3D2817] leading-relaxed">
        “{pulse.quote}”
      </blockquote>

      <div className="pt-3 border-t border-[#F5C4A8]/70 flex flex-col gap-0.5">
        <span className="text-[11px] font-mono uppercase tracking-wider text-[#C44C29] font-semibold">
          {pulse.theme}
        </span>
        <p className="text-xs text-[#7A5234] leading-relaxed">
          {pulse.reflection}
        </p>
      </div>
    </section>
  );
}
