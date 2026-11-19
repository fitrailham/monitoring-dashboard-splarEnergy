import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { useLanguage } from "../i18n/useLanguage";
import LanguageSelector from "../components/LanguageSelector";
import Icon from "../components/Icon";
import "./LoginPage.css";

function SolarLandscape() {
  return <svg className="login-landscape" viewBox="0 0 900 470" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="login-ground" x1="450" y1="160" x2="450" y2="470" gradientUnits="userSpaceOnUse"><stop stopColor="#166367" stopOpacity=".3" /><stop offset="1" stopColor="#082c43" stopOpacity="0" /></linearGradient>
      <linearGradient id="login-panel" x1="0" y1="0" x2="0" y2="220" gradientUnits="userSpaceOnUse"><stop stopColor="#1e5b82" /><stop offset="1" stopColor="#0b3558" /></linearGradient>
      <radialGradient id="login-sun"><stop stopColor="#55d9bc" stopOpacity=".22" /><stop offset="1" stopColor="#55d9bc" stopOpacity="0" /></radialGradient>
    </defs>
    <circle cx="660" cy="108" r="150" fill="url(#login-sun)" /><circle cx="660" cy="108" r="33" stroke="#78e4c8" strokeOpacity=".5" /><circle cx="660" cy="108" r="19" fill="#80e8c8" fillOpacity=".8" />
    <path d="M0 237 136 171 273 219 441 152 628 213 783 164 900 217v253H0Z" fill="url(#login-ground)" />
    <path d="m0 259 141-36 147 22 203-41 181 38 228-29" stroke="#6be0c5" strokeOpacity=".15" />
    {[0, 1, 2].map((row) => <g key={row} transform={`translate(${78 - row * 27},${229 + row * 63}) scale(${.78 + row * .1})`}>
      {[0, 1, 2, 3].map((column) => <g key={column} transform={`translate(${column * 200},0)`}>
        <path d="m17 0 155 0 22 47H0L17 0Z" fill="url(#login-panel)" stroke="#96c8e3" strokeOpacity=".6" />
        <path d="M15 16h165M8 32h179M55 0l-8 47M94 0v47M133 0l8 47M21 49v15m152-15v15" stroke="#8fc0da" strokeOpacity=".35" />
      </g>)}
    </g>)}
    <path d="M60 420h760" stroke="#8bc6dc" strokeOpacity=".13" strokeDasharray="4 7" />
  </svg>;
}

export default function LoginPage({ onLogin, notice }: {
  onLogin: (username: string, password: string) => Promise<void>;
  notice: string;
}) {
  const { t } = useLanguage();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});
  const usernameInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setLoginError("");
    const next = { username: username.trim() ? undefined : "Username is required.", password: password ? undefined : "Password is required." };
    setErrors(next);
    if (next.username || next.password) { (next.username ? usernameInput : passwordInput).current?.focus(); return; }
    setBusy(true);
    try {
      await onLogin(username, password);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Sign-in failed. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return <main className="login-page">
    <header className="login-topbar">
      <a href="/login" className="login-brand" aria-label="IconGreen Solar Monitoring"><img src="/icongreen-logo.png" alt="IconGreen — Member of PLN Group" width="1600" height="642" /><span>Solar Monitoring</span></a>
      <LanguageSelector />
    </header>
    <section className="login-hero" aria-labelledby="login-hero-title">
      <div className="login-hero-copy"><span className="login-eyebrow"><i />{t("CONNECTED SOLAR INTELLIGENCE")}</span>
        <h1 id="login-hero-title">{t("Your solar energy.")}<br /><span>{t("One clear view.")}</span></h1>
        <p>{t("Monitor your plants, understand performance, and make every ray count.")}</p>
        <div className="login-features"><span><Icon name="panel" size={17} />{t("Plant monitoring")}</span><span><Icon name="chart" size={17} />{t("Performance insights")}</span></div>
      </div>
      <SolarLandscape />
      <footer className="login-hero-footer"><span>IconGreen</span><span>{t("Powering a greener tomorrow.")}</span></footer>
    </section>
    <section className="login-form-panel" aria-labelledby="login-title">
      <div className="login-card"><div className="login-welcome-icon"><Icon name="sun" size={27} /></div>
        <span className="login-form-eyebrow">{t("WELCOME BACK")}</span><h2 id="login-title">{t("Sign in")}</h2>
        <p className="login-description">{t("Access your solar monitoring workspace.")}</p>
        <form noValidate onSubmit={submit} className="login-form">
          <label htmlFor="login-username">{t("Username")}</label>
          <div className={`login-input-wrap ${errors.username ? "invalid" : ""}`}><Icon name="user" size={19} />
            <input id="login-username" ref={usernameInput} name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder={t("Enter your username")} required maxLength={128} value={username} disabled={busy}
              aria-invalid={Boolean(errors.username)} aria-describedby={errors.username ? "login-username-error" : undefined} onChange={(event) => { setUsername(event.target.value); setErrors((previous) => ({ ...previous, username: undefined })); }} />
          </div>{errors.username && <p id="login-username-error" className="login-field-error" role="alert">{t(errors.username)}</p>}
          <label htmlFor="login-password">{t("Password")}</label>
          <div className={`login-input-wrap ${errors.password ? "invalid" : ""}`}><Icon name="lock" size={19} />
            <input id="login-password" ref={passwordInput} name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder={t("Enter your password")} required maxLength={1024} value={password} disabled={busy}
              aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "login-password-error" : undefined} onChange={(event) => { setPassword(event.target.value); setErrors((previous) => ({ ...previous, password: undefined })); }} />
            <button className="login-password-toggle" type="button" aria-label={t(showPassword ? "Hide password" : "Show password")} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}><Icon name={showPassword ? "eye-off" : "eye"} size={19} /></button>
          </div>{errors.password && <p id="login-password-error" className="login-field-error" role="alert">{t(errors.password)}</p>}
          {loginError && <p className="login-field-error" role="alert">{t(loginError)}</p>}
          {!loginError && notice && <p className="login-session-notice" role="status">{t(notice)}</p>}
          <button type="submit" className="login-submit" disabled={busy}>{t(busy ? "Signing in…" : "Sign in")}<Icon name="arrow" size={18} /></button>
        </form>
        <div className="login-card-footer"><Icon name="panel" size={15} /><span>IconGreen Solar Monitoring</span></div>
      </div>
      <footer className="login-footer">{t("Clean energy. Connected insight.")}</footer>
    </section>
  </main>;
}
