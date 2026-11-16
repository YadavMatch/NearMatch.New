import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

interface DoodleSquirrelProps {
  hasBottomNav?: boolean;
}

export function DoodleSquirrel({ hasBottomNav = false }: DoodleSquirrelProps) {
  const prefersReducedMotion = useReducedMotion();
  const [playBurstKey, setPlayBurstKey] = useState(0);

  const handlePlayTap = () => {
    setPlayBurstKey((k) => k + 1);
  };

  return (
    <div
      className={`pointer-events-none fixed left-3 sm:left-5 z-30 select-none ${
        hasBottomNav ? 'bottom-20 lg:bottom-5' : 'bottom-4 sm:bottom-5'
      }`}
    >
      <motion.button
        type="button"
        onClick={handlePlayTap}
        aria-label="Playful doodle squirrel tossing an acorn"
        title="Tap me!"
        whileHover={prefersReducedMotion ? undefined : { scale: 1.06 }}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
        animate={
          playBurstKey > 0 && !prefersReducedMotion
            ? { y: [0, -10, 0] }
            : undefined
        }
        transition={{ duration: 0.42, ease: 'easeOut' }}
        className="pointer-events-auto relative w-[78px] h-[78px] sm:w-[92px] sm:h-[92px] rounded-full focus:outline-none cursor-pointer group"
      >
        {/* Subtle warm doodle aura so ink strokes remain crisp on any section */}
        <span
          aria-hidden="true"
          className="absolute inset-2 rounded-full bg-[#FFF8EC]/85 backdrop-blur-[2px] border border-[#F5C4A8]/80 shadow-[0_6px_18px_rgba(61,40,23,0.12)] group-hover:border-[#E8603A]/70 transition-colors"
        />

        {/* Floating doodle heart burst on tap */}
        <AnimatePresence>
          {playBurstKey > 0 && !prefersReducedMotion ? (
            <motion.svg
              key={playBurstKey}
              viewBox="0 0 24 24"
              aria-hidden="true"
              initial={{ opacity: 0, y: 8, scale: 0.5 }}
              animate={{ opacity: [0, 1, 0], y: -22, scale: [0.6, 1.15, 0.9] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.85, ease: 'easeOut' }}
              className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 w-5 h-5"
            >
              <path
                d="M12 19.5C12 19.5 4.5 14.3 4.5 9.2C4.5 6.8 6.4 5 8.6 5C10.1 5 11.4 5.9 12 7.1C12.6 5.9 13.9 5 15.4 5C17.6 5 19.5 6.8 19.5 9.2C19.5 14.3 12 19.5 12 19.5Z"
                fill="#E8603A"
                stroke="#3D2817"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </motion.svg>
          ) : null}
        </AnimatePresence>

        {/* Hand-drawn doodle squirrel SVG playing with a tiny acorn */}
        <svg
          viewBox="0 0 110 110"
          fill="none"
          aria-hidden="true"
          className="relative z-10 w-full h-full drop-shadow-[0_1px_1px_rgba(61,40,23,0.08)]"
        >
          {/* Ground scribble shadow */}
          <motion.ellipse
            cx="54"
            cy="93"
            rx="24"
            ry="3.6"
            fill="#E8603A"
            fillOpacity="0.18"
            animate={
              prefersReducedMotion
                ? undefined
                : { rx: [24, 21, 24, 22, 24], opacity: [0.22, 0.14, 0.22, 0.16, 0.22] }
            }
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Fluffy curling doodle tail */}
          <motion.g
            style={{ originX: '67px', originY: '76px' }}
            animate={
              prefersReducedMotion
                ? undefined
                : { rotate: [0, 8, -4, 6, 0] }
            }
            transition={{ duration: 3.1, repeat: Infinity, ease: 'easeInOut' }}
          >
            <path
              d="M66 78 C84 78, 96 63, 92 43 C89 31, 77 27, 73 36 C70 43, 75 49, 80 46 C77 54, 70 61, 63 63 Z"
              fill="#E8603A"
              stroke="#3D2817"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Sketchy fur lines inside tail */}
            <path
              d="M84 44 C86 52, 82 62, 74 68"
              stroke="#FFF8EC"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeDasharray="3 3"
            />
          </motion.g>

          {/* Squirrel body + head bobbing gently */}
          <motion.g
            animate={
              prefersReducedMotion
                ? undefined
                : { y: [0, -2, 0, -1.5, 0] }
            }
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            {/* Torso */}
            <path
              d="M42 62 C39 74, 42 88, 55 88 C67 88, 70 76, 67 63 C65 55, 59 50, 52 50 C46 50, 43 55, 42 62 Z"
              fill="#E8603A"
              stroke="#3D2817"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Soft cream doodle belly */}
            <path
              d="M45 64 C44 74, 47 83, 54 83 C59 83, 61 75, 59 65 C57 60, 47 59, 45 64 Z"
              fill="#FFF8EC"
              stroke="#3D2817"
              strokeWidth="1.8"
              strokeLinecap="round"
            />

            {/* Little back feet */}
            <path
              d="M43 87 C38 87, 36 90, 40 91 L49 91"
              fill="#F5C4A8"
              stroke="#3D2817"
              strokeWidth="2.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M60 88 C60 91, 66 91, 68 89"
              stroke="#3D2817"
              strokeWidth="2.3"
              strokeLinecap="round"
            />

            {/* Head & ears watching the acorn */}
            <motion.g
              style={{ originX: '51px', originY: '52px' }}
              animate={
                prefersReducedMotion
                  ? undefined
                  : { rotate: [0, -5, 4, -2, 0] }
              }
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
            >
              {/* Back ear */}
              <path
                d="M55 34 L59 22 L64 33"
                fill="#E8603A"
                stroke="#3D2817"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Front ear */}
              <path
                d="M44 35 L46 21 L53 32"
                fill="#E8603A"
                stroke="#3D2817"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M47 32 L47.5 25.5 L51 31"
                fill="#F5C4A8"
              />

              {/* Round doodle head */}
              <path
                d="M36 44 C36 34, 45 30, 54 31 C63 32, 67 39, 66 47 C65 54, 57 57, 48 56 C40 55, 36 50, 36 44 Z"
                fill="#E8603A"
                stroke="#3D2817"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Rosy cream cheek */}
              <ellipse cx="42" cy="47" rx="4.2" ry="3" fill="#FDE4D8" />

              {/* Happy bright doodle eye */}
              <circle cx="44.5" cy="41.5" r="2.3" fill="#3D2817" />
              <circle cx="43.8" cy="40.7" r="0.8" fill="#FFF8EC" />

              {/* Tiny nose & cheerful smile */}
              <circle cx="35.5" cy="43.5" r="1.9" fill="#3D2817" />
              <path
                d="M37 47.5 C39 49.5, 42 49, 43.5 47.5"
                stroke="#3D2817"
                strokeWidth="1.9"
                strokeLinecap="round"
              />
            </motion.g>

            {/* Front paws batting/juggling */}
            <motion.g
              style={{ originX: '44px', originY: '66px' }}
              animate={
                prefersReducedMotion
                  ? undefined
                  : { rotate: [0, -12, 8, -8, 0], y: [0, -2.5, 1, -1.5, 0] }
              }
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
            >
              <path
                d="M44 63 C37 62, 32 65, 34 68 C36 70, 41 68, 45 67"
                fill="#E8603A"
                stroke="#3D2817"
                strokeWidth="2.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M52 64 C46 65, 40 67, 41 70 C43 72, 49 70, 53 68"
                fill="#F5C4A8"
                stroke="#3D2817"
                strokeWidth="2.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </motion.g>
          </motion.g>

          {/* Tiny acorn tossed playfully between its own paws */}
          <motion.g
            style={{ originX: '27px', originY: '58px' }}
            animate={
              prefersReducedMotion
                ? undefined
                : {
                    y: [0, -17, 1, -11, 0],
                    x: [0, 3, -2, 2, 0],
                    rotate: [0, 26, -18, 16, 0],
                  }
            }
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            {/* Tiny motion arcs when acorn pops up */}
            <path
              d="M19 52 C17 48, 19 45, 22 44"
              stroke="#3D8C7A"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeDasharray="2 2.5"
            />
            {/* Acorn nut */}
            <path
              d="M22 57 C21 63, 25 67, 28 67 C31 67, 34 62, 32 57 Z"
              fill="#FFC98B"
              stroke="#3D2817"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* Acorn cap */}
            <path
              d="M20.5 57 C20.5 53, 33.5 53, 33.5 57 Z"
              fill="#7A5234"
              stroke="#3D2817"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* Acorn stem */}
            <path
              d="M27 53.5 L27.5 50.5"
              stroke="#3D2817"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </motion.g>
        </svg>
      </motion.button>
    </div>
  );
}
