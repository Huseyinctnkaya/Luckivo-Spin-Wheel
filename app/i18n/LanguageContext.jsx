import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { translations, defaultLang, supportedLangs } from "./translations";

const LanguageContext = createContext(null);

const STORAGE_KEY = "luckivo_lang";

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(defaultLang);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && supportedLangs.includes(stored)) {
        setLangState(stored);
      }
    } catch {
      // localStorage may not be available
    }
  }, []);

  const setLang = useCallback((newLang) => {
    if (!supportedLangs.includes(newLang)) return;
    setLangState(newLang);
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
    } catch {
      // ignore
    }
  }, []);

  const t = useCallback(
    (key, ...args) => {
      const dict = translations[lang] || translations[defaultLang];
      const value = dict[key] ?? translations[defaultLang][key] ?? key;
      if (typeof value === "function") return value(...args);
      return value;
    },
    [lang],
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
