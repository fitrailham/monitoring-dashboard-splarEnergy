import { useSyncExternalStore } from "react";
import { DEFAULT_LANGUAGE, getLanguage, setLanguage, subscribeLanguage, translate } from "./language";

export function useLanguage() {
  const language = useSyncExternalStore(subscribeLanguage, getLanguage, () => DEFAULT_LANGUAGE);
  return { language, setLanguage, t: translate };
}
