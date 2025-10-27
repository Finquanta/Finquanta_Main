'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  getViewportType,
  type ViewportType,
} from '../lib/viewport';

/**
 * React hook that returns the current viewport type and convenience booleans.
 * - mobile: < 768
 * - tablet: 768–1023
 * - desktop: ≥ 1024
 *
 * Uses ResizeObserver when available; falls back to window resize event.
 * Safe for SSR: initializes to 'desktop' until hydrated on client.
 */
export function useViewportType() {
  const [type, setType] = useState<ViewportType>('desktop');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Mark as hydrated and set accurate viewport type
    setIsHydrated(true);
    
    const update = () => {
      setType(getViewportType(window.innerWidth));
    };

    // Prefer ResizeObserver for better responsiveness on zoom/UA changes
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(update);
      ro.observe(document.documentElement);
    } else {
      window.addEventListener('resize', update);
    }

    // Initial compute
    update();

    return () => {
      if (ro) {
        ro.disconnect();
      } else {
        window.removeEventListener('resize', update);
      }
    };
  }, []);

  return useMemo(() => {
    return {
      type,
      isMobile: isHydrated && type === 'mobile',
      isTablet: isHydrated && type === 'tablet',
      isDesktop: !isHydrated || type === 'desktop',
      isHydrated,
    };
  }, [type, isHydrated]);
}