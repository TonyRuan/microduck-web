import {
  msg,
  translate,
  createLanguageSettings,
  type LanguagePreference,
} from "./core";
import { english, type MessageKey } from "./messages";

export const languageSettings = createLanguageSettings(
  () => localStorage,
  () =>
    navigator.languages.length ? navigator.languages : [navigator.language],
);
const texts = new Map<Node, string>();
const attributes = new Map<Element, Map<string, string>>();
export function text(node: Node, message: string) {
  texts.set(node, message);
  node.textContent = translate(message, languageSettings.language);
}
export function attribute(element: Element, name: string, message: string) {
  if (!attributes.has(element)) attributes.set(element, new Map());
  attributes.get(element)!.set(name, message);
  element.setAttribute(name, translate(message, languageSettings.language));
}
export function refreshLanguage() {
  document.documentElement.lang = languageSettings.language;
  for (const [node, message] of texts) {
    if (!node.isConnected) texts.delete(node);
    else node.textContent = translate(message, languageSettings.language);
  }
  for (const [element, entries] of attributes) {
    if (!element.isConnected) attributes.delete(element);
    else
      for (const [name, message] of entries)
        element.setAttribute(
          name,
          translate(message, languageSettings.language),
        );
  }
}
export function initLanguage() {
  for (const element of document.querySelectorAll<HTMLElement>("[data-i18n]")) {
    const key = element.dataset.i18n!;
    if (Object.hasOwn(english, key)) text(element, msg(key as MessageKey));
  }
  for (const name of ["aria-label", "title", "placeholder", "content"]) {
    for (const element of document.querySelectorAll<HTMLElement>(
      `[data-i18n-${name}]`,
    )) {
      const key = element.getAttribute(`data-i18n-${name}`)!;
      if (Object.hasOwn(english, key))
        attribute(element, name, msg(key as MessageKey));
    }
  }
  const select = document.getElementById("language") as HTMLSelectElement;
  select.value = languageSettings.preference;
  select.addEventListener("change", () => {
    languageSettings.setPreference(select.value as LanguagePreference);
    refreshLanguage();
  });
  addEventListener("languagechange", refreshLanguage);
  refreshLanguage();
}
