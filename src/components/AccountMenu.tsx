import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../i18n/useLanguage";
import Icon from "./Icon";
import "./AccountMenu.css";

export default function AccountMenu({ displayName, onLogout }: { displayName: string; onLogout: () => Promise<void> }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
  async function logout() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onLogout();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not log out. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return <div className="account-menu" ref={container} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button ref={trigger} className={`account-trigger ${open ? "active" : ""}`} aria-label={`${t("Account")}: ${displayName}`} title={displayName}
      aria-haspopup="menu" aria-expanded={open} aria-controls="account-options" onClick={() => setOpen(!open)} onKeyDown={(event) => {
        if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); }
      }}>
      <Icon name="user" size={20} /><span className="account-name">{displayName}</span>
    </button>
    {open && <div id="account-options" className="account-options" role="menu" aria-label={t("Account menu")}>
      <button type="button" role="menuitem" aria-disabled={busy} autoFocus onClick={() => void logout()}>{t(busy ? "Logging out…" : "Log Out")}</button>
      {error && <p className="account-error" role="alert">{t(error)}</p>}
    </div>}
  </div>;
}
