import { create } from 'zustand';
import { settings } from '@/db/settings';

export type Locale = 'tr' | 'en';

const SETTINGS_KEY = 'locale';
const DEFAULT_LOCALE: Locale = 'tr';

interface LocaleState {
  locale: Locale;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setLocale: (locale: Locale) => void;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: DEFAULT_LOCALE,
  hydrated: false,

  async hydrate() {
    const saved = await settings.get(SETTINGS_KEY);
    set({ locale: saved === 'en' ? 'en' : DEFAULT_LOCALE, hydrated: true });
  },

  setLocale(locale) {
    // Optimistic: the UI switches immediately, persisting finishes in the background.
    set({ locale });
    settings.set(SETTINGS_KEY, locale).catch(() => {});
  },
}));
