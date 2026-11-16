import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../i18n/useLanguage";
import Icon from "./Icon";
import "./AccountMenu.css";

export default function AccountMenu({ displayName, onLogout }: { displayName: string; onLogout: () => void }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) { if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false); }
    function escape(event: KeyboardEvent) { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <div className="account-menu" ref={container} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button ref={trigger} className={`account-trigger ${open ? "active" : ""}`} aria-label={`${t("Account")}: ${displayName}`} title={displayName}
      aria-haspopup="menu" aria-expanded={open} aria-controls="account-options" onClick={() => setOpen(!open)} onKeyDown={(event) => {
        if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); }
      }}>
      <Icon name="user" size={20} /><span className="account-name">{displayName}</span>
    </button>
    {open && <div id="account-options" className="account-options" role="menu" aria-label={t("Account menu")}>
      <button type="button" role="menuitem" autoFocus onClick={() => { setOpen(false); onLogout(); }}>{t("Log Out")}</button>
    </div>}
  </div>;
}
