import { translate as t } from "../i18n/language";
import { useLanguage } from "../i18n/useLanguage";
import { useEffect, useRef, useState } from "react";
import type { Plant } from "../services/fleet";
import { decodeLayouts, layoutStorageKey } from "../services/physicalLayout";
import type { PhysicalLayoutDraft } from "../services/physicalLayout";
import Icon from "./Icon";

type DialogMode = "create" | "rename" | "delete" | "guide" | "diagnosis" | null;
function newId() { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`; }

export default function PhysicalLayout({ plant }: { plant?: Plant }) {
  useLanguage();
  const [initial] = useState(() => {
    if (!plant) return { layouts: [] as PhysicalLayoutDraft[], error: "" };
    try { return { layouts: decodeLayouts(localStorage.getItem(layoutStorageKey(plant.plant_code))), error: "" }; }
    catch { return { layouts: [] as PhysicalLayoutDraft[], error: "Draf layout lokal tidak dapat dibaca. Data yang tersimpan belum diubah." }; }
  });
  const [layouts, setLayouts] = useState(initial.layouts), [selected, setSelected] = useState(initial.layouts[0]?.id ?? "");
  const [error, setError] = useState(initial.error), [treeOpen, setTreeOpen] = useState(false);
  const [period, setPeriod] = useState("Today"), [mode, setMode] = useState<DialogMode>(null);
  const [name, setName] = useState(""), [draft, setDraft] = useState<PhysicalLayoutDraft | null>(null);
  const [selectedModule, setSelectedModule] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const layout = layouts.find((item) => item.id === selected);
  const display = draft ?? layout;
  useEffect(() => {
    if (mode) dialog.current?.showModal();
    else dialog.current?.close();
  }, [mode]);
  function persist(next: PhysicalLayoutDraft[], nextSelected = selected) {
    if (!plant) return false;
    try {
      const raw = JSON.stringify(next);
      decodeLayouts(raw);
      localStorage.setItem(layoutStorageKey(plant.plant_code), raw);
      setLayouts(next); setSelected(nextSelected); setError("");
      return true;
    } catch { setError("Draf belum tersimpan. Periksa izin atau kapasitas penyimpanan browser."); return false; }
  }
  function open(mode: DialogMode) { setName(mode === "rename" ? layout?.name ?? "" : ""); setMode(mode); }
  function saveName() {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (layouts.some((item) => item.name.toLowerCase() === trimmed.toLowerCase() && (mode === "create" || item.id !== selected))) {
      setError("Nama layout sudah digunakan. Gunakan nama lain."); return;
    }
    if (mode === "create") {
      const item: PhysicalLayoutDraft = { id: newId(), name: trimmed, modules: [] };
      if (persist([...layouts, item], item.id)) setMode(null);
    } else if (persist(layouts.map((item) => item.id === selected ? { ...item, name: trimmed } : item))) setMode(null);
  }
  function removeLayout() {
    const next = layouts.filter((item) => item.id !== selected);
    if (persist(next, next[0]?.id ?? "")) { setMode(null); setSelectedModule(""); }
  }
  return <div className="physical-layout-page">
    <section className="physical-layout-panel" aria-label={t("Physical Layout")}>
      <header className="physical-layout-heading"><h1>{t("Physical Layout")}</h1><div><span>{t("Yield (kWh)")}</span><select aria-label={t("Periode yield modul")} value={period} onChange={(event) => setPeriod(event.target.value)}><option>{t("Today")}</option><option>{t("Yesterday")}</option><option>{t("This month")}</option></select><button className="layout-outline" onClick={() => open("diagnosis")}>{t("Smart Module-level Diagnosis")}</button></div></header>
      <div className="physical-layout-toolbar"><div className="layout-toolbar-primary">
        <button aria-expanded={treeOpen} aria-controls="physical-device-tree" onClick={() => setTreeOpen(!treeOpen)}><Icon name="list" size={14} />{treeOpen ? t("Collapse Device Tree") : t("Expand Device Tree")}</button><i className="layout-divider" />
        <label><Icon name="panel" size={14} /><select aria-label={t("Physical layout yang dipilih")} disabled={layouts.length === 0 || Boolean(draft)} value={selected} onChange={(event) => { setSelected(event.target.value); setSelectedModule(""); }}>{!layouts.length && <option value="">{t("Physical Layout")}</option>}{layouts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><i className="layout-divider" />
        <button className="layout-create" disabled={!plant || layouts.length >= 100 || Boolean(draft) || Boolean(initial.error)} title={t(!plant ? "Pilih PLTS dari daftar di sisi kiri" : "Buat draf layout lokal")} onClick={() => open("create")}><span>＋</span>{t("Create")}</button>
      </div><div className="layout-toolbar-actions"><button disabled={!layout || Boolean(draft)} onClick={() => { setDraft({ ...layout!, modules: layout!.modules.map((item) => ({ ...item })) }); setSelectedModule(""); }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m4 16 12-12 4 4L8 20H4ZM13 7l4 4M4 23h17" /></svg>{t("Edit")}</button><button disabled={!layout || Boolean(draft)} onClick={() => open("rename")}><span className="layout-rename-icon">{t("T")}</span>{t("Rename")}</button><button disabled={!layout || Boolean(draft)} onClick={() => open("delete")}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7" /></svg>{t("Delete")}</button></div></div>
      {t(error) && <p className="layout-error" role="alert">{t(error)}</p>}
      {layout && <div className="layout-draft-banner"><span>{t("Draf lokal")}</span><strong>{layout.name}</strong><small>{plant?.plant_name}{t(" · Tersimpan hanya di browser ini. Yield modul belum tersedia.")}</small></div>}
      {draft && <div className="layout-editor-toolbar"><span>{t("Mode edit · Modul draf belum terhubung ke perangkat.")}</span><button disabled={draft.modules.length >= 500} onClick={() => { const id = newId(); setDraft({ ...draft, modules: [...draft.modules, { id, label: `Module ${draft.modules.length + 1}` }] }); setSelectedModule(id); }}>{t("＋ Add module")}</button><button disabled={!selectedModule} onClick={() => { setDraft({ ...draft, modules: draft.modules.filter((item) => item.id !== selectedModule) }); setSelectedModule(""); }}>{t("Remove module")}</button><button className="layout-save" onClick={() => { if (persist(layouts.map((item) => item.id === selected ? draft : item))) { setDraft(null); setSelectedModule(""); } }}>{t("Save")}</button><button onClick={() => { setDraft(null); setSelectedModule(""); }}>{t("Cancel")}</button></div>}
      <div className="physical-layout-body">
        {treeOpen && <aside id="physical-device-tree" className="physical-device-tree"><h2><Icon name="home" size={16} />{plant?.plant_name ?? t("Pilih PLTS")}</h2><p>{t("Physical Layout · draf lokal")}</p>{display?.modules.map((item) => <button key={item.id} className={selectedModule === item.id ? "selected" : ""} onClick={() => setSelectedModule(item.id)}><Icon name="panel" size={15} />{t(item.label)}<small>{t("-- kWh")}</small></button>)}{!display?.modules.length && <span>{t("Belum ada modul pada layout.")}</span>}</aside>}
        <div className={`physical-layout-canvas ${draft ? "editing" : ""}`} aria-label={t(`Kanvas physical layout · ${period}`)}>
          {display?.modules.length ? <div className="layout-module-grid">{display.modules.map((item) => <button key={item.id} className={`layout-module ${selectedModule === item.id ? "selected" : ""}`} aria-pressed={selectedModule === item.id} onClick={() => setSelectedModule(item.id)} title={t(`${item.label} · Modul draf · Yield belum tersedia`)}><span className="layout-module-cells" aria-hidden="true" /><strong>-- <small>{t("kWh")}</small></strong><span>{t(item.label)}</span></button>)}</div> : <div className="physical-layout-empty"><svg width="68" height="49" viewBox="0 0 80 56" fill="none" aria-hidden="true"><ellipse cx="40" cy="46" rx="34" ry="6" fill="#f7f7f7" /><path d="M15 25 27 11h25l13 14v20a4 4 0 0 1-4 4H19a4 4 0 0 1-4-4Z" fill="#fff" stroke="#d8dadd" /><path d="M15 25h16l3 7h15l3-7h13" stroke="#d8dadd" /></svg><span>{t("No data")}</span><button onClick={() => open("guide")}>{t("Quick guide on physical layout")}</button></div>}
        </div>
      </div>
    </section>
    <dialog ref={dialog} className="layout-dialog" onCancel={() => setMode(null)} aria-labelledby="layout-dialog-title">
      <div className="layout-dialog-heading"><h2 id="layout-dialog-title">{mode === "create" ? t("Create Physical Layout") : mode === "rename" ? t("Rename Physical Layout") : mode === "delete" ? t("Delete Physical Layout") : mode === "guide" ? t("Quick guide on physical layout") : t("Smart Module-level Diagnosis")}</h2><button aria-label={t("Tutup dialog layout")} onClick={() => setMode(null)}><Icon name="close" size={18} /></button></div>
      {mode === "create" || mode === "rename" ? <form onSubmit={(event) => { event.preventDefault(); saveName(); }}><label>{t("Layout name")}<input autoFocus required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder={t("Physical Layout 1")} /></label><p>{t("Layout disimpan sebagai draf lokal untuk ")}{plant?.plant_name}{t(". Posisi modul draf belum menjadi pemetaan perangkat terverifikasi.")}</p>{t(error) && <p className="layout-error" role="alert">{t(error)}</p>}<footer><button type="button" onClick={() => setMode(null)}>{t("Cancel")}</button><button className="layout-save" type="submit" disabled={!name.trim()}>{mode === "create" ? t("Create") : t("Save")}</button></footer></form> : mode === "delete" ? <><p>{t("Hapus draf ")}<strong>{layout?.name}</strong>{t(" beserta modulnya dari browser ini?")}</p><footer><button onClick={() => setMode(null)}>{t("Cancel")}</button><button className="layout-delete-confirm" onClick={removeLayout}>{t("Delete")}</button></footer></> : mode === "guide" ? <><ol><li>{t("Pilih PLTS melalui daftar di sisi kiri.")}</li><li>{t("Klik Create dan beri nama physical layout.")}</li><li>{t("Klik Edit, lalu Add module untuk membuat susunan modul draf.")}</li><li>{t("Pilih modul untuk menyorotnya atau menghapusnya, lalu klik Save.")}</li><li>{t("Gunakan Rename atau Delete untuk mengelola draf layout.")}</li></ol><p>{t("Draf disimpan di browser ini. Yield dan diagnosis modul memerlukan pemetaan perangkat serta data pengukuran yang terverifikasi.")}</p><footer><button className="layout-save" onClick={() => setMode(null)}>{t("Mengerti")}</button></footer></> : <><p>{t("Diagnosis modul belum tersedia. Hubungkan pemetaan modul dan data pengukuran yang terverifikasi sebelum menjalankan diagnosis.")}</p><footer><button className="layout-save" onClick={() => setMode(null)}>{t("Tutup")}</button></footer></>}
    </dialog>
  </div>;
}
