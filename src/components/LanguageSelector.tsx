import { useEffect, useRef, useState } from "react";
import { LANGUAGES } from "../i18n/language";
import { useLanguage } from "../i18n/useLanguage";
import Icon from "./Icon";
import "./LanguageSelector.css";

export default function LanguageSelector() {
  const { language, setLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    function closeOutside(event: PointerEvent) { if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false); }
    function closeOnEscape(event: KeyboardEvent) { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", closeOutside); document.removeEventListener("keydown", closeOnEscape); };
  }, [open]);
  return <div className="language-selector" ref={container} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={trigger} className="language-trigger" aria-label={t("Language settings")} aria-expanded={open} aria-controls="language-options" onClick={() => setOpen(!open)}>
      <Icon name="globe" size={20} /><span className="language-full-name">{LANGUAGES.find((item) => item.code === language)!.name}</span><span className="language-short-name">{language.toUpperCase()}</span>
    </button>
    {open && <div className="language-options" id="language-options" role="group" aria-label={t("Select language")}>
      <strong>{t("Language")}</strong>{LANGUAGES.map((item) => <button key={item.code} lang={item.code} aria-pressed={language === item.code} onClick={() => { setLanguage(item.code); setOpen(false); trigger.current?.focus(); }}>
        <span>{item.name}</span>{language === item.code && <Icon name="check" size={16} />}
      </button>)}
    </div>}
  </div>;
}
