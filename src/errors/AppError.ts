import { tr } from '@/copy/tr';
import { en } from '@/copy/en';
import { useLocaleStore } from '@/store/useLocaleStore';

export type AppError =
  | { kind: 'network' }
  | { kind: 'service' }
  | { kind: 'quota' };

/**
 * Not a hook so this can be called outside components — reads the current
 * locale synchronously via Zustand's `getState()` (not tied to render, so
 * the error always comes out in the right language).
 */
function messages() {
  return useLocaleStore.getState().locale === 'en' ? en : tr;
}

/** Exactly one message per AppError variant — switch exhaustiveness turns a missing case into a compile error. */
export function messageFor(error: AppError): string {
  const dict = messages();
  switch (error.kind) {
    case 'network':
      return dict.errorNetwork;
    case 'service':
      return dict.errorService;
    case 'quota':
      return dict.errorQuota;
  }
}
