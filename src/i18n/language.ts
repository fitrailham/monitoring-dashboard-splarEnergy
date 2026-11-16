import { translations } from "./translations.ts";

export type Language = "id" | "en";
export const LANGUAGE_STORAGE_KEY = "icongreen.ui.language";
export const DEFAULT_LANGUAGE: Language = "en";
export const LANGUAGES = [{ code: "id", name: "Bahasa Indonesia" }, { code: "en", name: "English" }] as const;

export function isLanguage(value: unknown): value is Language { return value === "id" || value === "en"; }
export function readLanguage(storage?: Pick<Storage, "getItem">): Language {
  try {
    const value = (storage ?? (typeof localStorage !== "undefined" ? localStorage : undefined))?.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguage(value) ? value : DEFAULT_LANGUAGE;
  } catch { return DEFAULT_LANGUAGE; }
}
let language = readLanguage();
const listeners = new Set<() => void>();
export const getLanguage = () => language;
export const getLocale = () => language === "id" ? "id-ID" : "en-US";
export function subscribeLanguage(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function setLanguage(value: Language) {
  if (!isLanguage(value)) return;
  const changed = language !== value;
  language = value;
  try { localStorage.setItem(LANGUAGE_STORAGE_KEY, value); } catch { /* The selection still works without browser storage. */ }
  if (typeof document !== "undefined") document.documentElement.lang = value;
  if (changed) listeners.forEach((listener) => listener());
}
export function syncLanguageFromStorage() {
  const value = readLanguage();
  if (value !== language) {
    language = value;
    listeners.forEach((listener) => listener());
  }
  if (typeof document !== "undefined") document.documentElement.lang = value;
}

const dictionaries: Record<Language, Map<string, string>> = { id: new Map(), en: new Map() };
const patterns: { source: RegExp; target: string; language: Language; names: string[] }[] = [];
const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
for (const [english, indonesian] of translations) {
  const en = normalize(english), id = normalize(indonesian);
  dictionaries.en.set(en, en); dictionaries.en.set(id, en);
  dictionaries.id.set(en, id); dictionaries.id.set(id, id);
  if (en.includes("{")) {
    for (const [source, target, targetLanguage] of [[en, id, "id"], [id, en, "en"]] as const) {
      const names: string[] = [];
      const escaped = source.split(/(\{\w+\})/g).map((part) => {
        if (/^\{\w+\}$/.test(part)) {
          const name = part.slice(1, -1);
          names.push(name);
          return ["value", "count", "page", "valid", "total", "missing", "stale", "unverified", "irrelevant", "demo"].includes(name) ? "([\\d.,≥≤+\\-]+)" : "(.+?)";
        }
        return part.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
      }).join("");
      patterns.push({ source: new RegExp(`^${escaped}$`), target: target.replace(/\{(\w+)\}/g, (_, name) => `$${names.indexOf(name) + 1}`), language: targetLanguage, names });
    }
  }
}

// Only known UI phrases are translated. Plant names, identifiers, values and
// unrecognized backend diagnostics pass through unchanged.
export function translate<T>(value: T, targetLanguage: Language = language): T {
  if (typeof value !== "string" || !value.trim()) return value;
  const key = normalize(value);
  let result = dictionaries[targetLanguage].get(key);
  if (result === undefined) {
    for (const pattern of patterns) {
      if (pattern.language === targetLanguage && pattern.source.test(key)) {
        const matches = key.match(pattern.source)!;
        result = pattern.target.replace(/\$(\d+)/g, (_, index) => {
          const capture = matches[Number(index)];
          return ["quality", "age", "state"].includes(pattern.names[Number(index) - 1]) ? translate(capture, targetLanguage) : capture;
        });
        break;
      }
    }
  }
  if (result === undefined) return value;
  return ((/^\s/.test(value) ? " " : "") + result + (/\s$/.test(value) ? " " : "")) as T;
}
