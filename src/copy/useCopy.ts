import { useLocaleStore } from '@/store/useLocaleStore';
import { tr } from '@/copy/tr';
import { en } from '@/copy/en';

/**
 * Returns the dictionary for the active locale. Called as `const tr = useCopy();`
 * in components — the variable name stays `tr` on purpose, so switching from
 * the static import to this hook didn't require renaming every `tr.xxx` call
 * site. When English is selected, this variable simply holds the English dictionary.
 */
export function useCopy() {
  const locale = useLocaleStore((s) => s.locale);
  return locale === 'en' ? en : tr;
}
