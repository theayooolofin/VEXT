'use client';

import { useEffect } from 'react';
import { track } from '@/client/api';

/** Records a page_view (and optionally one more event) once per mount. */
export function Track({ event, props }: { event?: string; props?: Record<string, string | number | boolean | null> }) {
  useEffect(() => {
    track('page_view');
    if (event) track(event, props);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
