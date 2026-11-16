import { useEffect, useRef, useState } from 'react';
import cafePoster from '../assets/images/hero_indian_cafe_1794747620276.jpg';
import bookstorePoster from '../assets/images/hero_indian_bookstore_1794747610569.jpg';
import walkPoster from '../assets/images/hero_indian_walk_1794747608396.jpg';
import terracePoster from '../assets/images/hero_indian_terrace_1794747612936.jpg';

interface BackdropScene {
  id: string;
  src: string;
  poster: string;
}

const SCROLL_SCENES: BackdropScene[] = [
  {
    id: 'cafe',
    src: '/videos/cafe.mp4',
    poster: cafePoster,
  },
  {
    id: 'bookstore',
    src: '/videos/bookstore.mp4',
    poster: bookstorePoster,
  },
  {
    id: 'walk',
    src: '/videos/walk.mp4',
    poster: walkPoster,
  },
  {
    id: 'terrace',
    src: '/videos/terrace.mp4',
    poster: terracePoster,
  },
];

function sceneIndexForScroll(): number {
  const maxScroll = Math.max(
    1,
    document.documentElement.scrollHeight - window.innerHeight
  );
  const progress = Math.min(1, Math.max(0, window.scrollY / maxScroll));

  if (progress < 0.22) return 0;
  if (progress < 0.5) return 1;
  if (progress < 0.76) return 2;
  return 3;
}

export function ScrollPageBackdrop() {
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedIds, setFailedIds] = useState<Record<string, boolean>>({});
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    let rafId: number | null = null;

    const updateScene = () => {
      rafId = null;
      const next = sceneIndexForScroll();
      setActiveIndex((prev) => (prev === next ? prev : next));
    };

    const onScrollOrResize = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(updateScene);
    };

    updateScene();
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    videoRefs.current.forEach((video, idx) => {
      if (!video) return;
      if (reducedMotion) {
        video.pause();
        return;
      }
      if (idx === activeIndex) {
        void video.play().catch(() => {
          // Autoplay blocked by browser policy; poster remains visible
        });
      } else {
        video.pause();
      }
    });
  }, [activeIndex, reducedMotion]);

  return (
    <div
      aria-hidden="true"
      className="hero-video-container pointer-events-none fixed inset-0 z-0 overflow-hidden select-none bg-[#2B1A10]"
    >
      {SCROLL_SCENES.map((scene, idx) => {
        const isActive = idx === activeIndex;
        const videoFailed = Boolean(failedIds[scene.id]);

        return (
          <div
            key={scene.id}
            className={`hero-video-layer absolute inset-0 overflow-hidden transition-opacity duration-[900ms] ease-in-out ${
              isActive ? 'opacity-100 z-[2]' : 'opacity-0 z-[1]'
            }`}
          >
            {videoFailed || reducedMotion ? (
              <img
                src={scene.poster}
                alt=""
                className="hero-video-media"
                loading={idx === 0 ? 'eager' : 'lazy'}
              />
            ) : (
              <video
                ref={(el) => {
                  videoRefs.current[idx] = el;
                }}
                src={scene.src}
                poster={scene.poster}
                muted
                loop
                playsInline
                autoPlay={idx === 0}
                preload={idx <= 1 ? 'auto' : 'metadata'}
                onError={() =>
                  setFailedIds((prev) => ({
                    ...prev,
                    [scene.id]: true,
                  }))
                }
                className="hero-video-media"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
