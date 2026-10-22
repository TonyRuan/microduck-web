import { english, type MessageKey } from "./messages";

export type Language = "en" | "zh-CN";
export type LanguagePreference = "auto" | Language;
export const LANGUAGE_STORAGE_KEY = "microduck-language";
const PREFIX = "@microduck-message:";
type Argument = string | number;

// A string envelope survives Error.message, postMessage, and IndexedDB. Workers
// never need a locale or DOM; the current language is applied only at display time.
export function msg(key: MessageKey, ...args: Argument[]): string {
  return PREFIX + JSON.stringify([key, args]);
}

export function translate(value: string, language: Language): string {
  if (!value.startsWith(PREFIX)) return value;
  try {
    const [key, args] = JSON.parse(value.slice(PREFIX.length));
    if (!Object.hasOwn(english, key) || !Array.isArray(args)) return value;
    const template = language === "en" ? english[key as MessageKey] : key;
    return template.replace(/\{(\d+)\}/g, (_: string, index: string) => {
      const argument = args[Number(index)];
      return typeof argument === "string"
        ? translate(argument, language)
        : String(argument ?? "");
    });
  } catch {
    return value;
  }
}

export function resolveLanguage(
  preference: LanguagePreference,
  languages: readonly string[],
): Language {
  if (preference !== "auto") return preference;
  return /^zh(?:-|$)/i.test(languages[0] ?? "") ? "zh-CN" : "en";
}

export function validPreference(value: unknown): value is LanguagePreference {
  return value === "auto" || value === "en" || value === "zh-CN";
}

export function createLanguageSettings(
  storage: () => Pick<Storage, "getItem" | "setItem">,
  languages: () => readonly string[],
) {
  let preference: LanguagePreference = "auto";
  try {
    const saved = storage().getItem(LANGUAGE_STORAGE_KEY);
    if (validPreference(saved)) preference = saved;
  } catch {
    // Blocked storage must not prevent startup or in-session language changes.
  }
  return {
    get preference() {
      return preference;
    },
    get language() {
      return resolveLanguage(preference, languages());
    },
    setPreference(value: LanguagePreference) {
      preference = value;
      try {
        storage().setItem(LANGUAGE_STORAGE_KEY, value);
        return true;
      } catch {
        return false;
      }
    },
  };
}

export function errorMessage(error: unknown): string {
  const value = error instanceof Error ? error.message : String(error);
  if (value.startsWith(PREFIX)) return value;
  if (error instanceof SyntaxError) return msg("动作清单不是有效的 JSON。");
  if (error instanceof TypeError && /fetch|network/i.test(value))
    return msg("网络请求失败，请检查连接后重试。");
  // Third-party engine details remain available as technical diagnostics.
  return msg("操作失败：{0}", value);
}
