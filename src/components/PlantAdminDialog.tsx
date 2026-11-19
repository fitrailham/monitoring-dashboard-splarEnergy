import { translate as t } from "../i18n/language";
import { useLanguage } from "../i18n/useLanguage";
import { useEffect, useRef, useState } from "react";
import type { Plant } from "../services/fleet";
import { savePlant } from "../services/plantAdmin";
import type { PlantFormValues } from "../services/plantAdmin";

export default function PlantAdminDialog({ plant, csrfToken, onClose, onSaved }: {
  plant?: Plant; csrfToken: string; onClose: () => void; onSaved: (code: string) => void;
}) {
  useLanguage();
  const [form, setForm] = useState<PlantFormValues>(() => ({code: plant?.plant_code ?? "", name: plant?.plant_name ?? "",
    capacity: plant?.capacity_kwp == null ? "" : String(plant.capacity_kwp), country: plant?.country_code ?? "ID", region: plant?.region ?? "",
    city: plant?.city ?? "", address: plant?.address ?? "", zone: plant?.time_zone ?? "Asia/Jakarta",
    latitude: plant?.latitude == null ? "" : String(plant.latitude), longitude: plant?.longitude == null ? "" : String(plant.longitude)}));
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null), controller = useRef<AbortController | null>(null);
  useEffect(() => {dialog.current?.showModal(); return () => controller.current?.abort();}, []);
  function field(key: keyof PlantFormValues, label: string, required = false, readOnly = false) {
    return <label>{t(label)}<input required={required} readOnly={readOnly} disabled={busy} value={form[key]}
      onChange={(event) => setForm({...form, [key]: event.target.value})} /></label>;
  }
  async function submit() {
    if (busy) return;
    const request = new AbortController(); controller.current = request;
    setBusy(true); setError("");
    try {
      await savePlant(form, csrfToken, plant?.plant_code, request.signal);
      if (!request.signal.aborted) onSaved(plant?.plant_code ?? form.code.trim());
    } catch (error) { if (!request.signal.aborted) setError(error instanceof Error ? error.message : "Gagal menyimpan PLTS."); }
    finally {if (!request.signal.aborted) setBusy(false);}
  }
  return <dialog ref={dialog} className="layout-dialog plant-admin-dialog" aria-labelledby="plant-admin-title" onCancel={(event) => {if (busy) event.preventDefault(); else onClose();}}>
    <div className="layout-dialog-heading"><h2 id="plant-admin-title">{plant ? t("Edit Plant Metadata") : t("Add Plant")}</h2><button disabled={busy} aria-label={t("Tutup form PLTS")} onClick={onClose}>{t("×")}</button></div>
    <form onSubmit={(event) => {event.preventDefault(); void submit();}}>
      <p>{plant ? t("Perbarui metadata PLTS.") : t("Daftarkan PLTS pada sistem monitoring lokal.")}</p>
      <div className="plant-admin-fields">
        {field("code", "Plant code", true, Boolean(plant))}{field("name", "Plant name", true, Boolean(plant))}
        {field("capacity", "Installed PV (kWp)", true)}{field("zone", "Time zone (IANA)", true)}
        {field("country", "Country code")}{field("region", "Region")}{field("city", "City")}{field("address", "Address", false, Boolean(plant))}
        {field("latitude", "Latitude")}{field("longitude", "Longitude")}
      </div>
      {t(error) && <p className="report-error" role="alert">{t(error)}</p>}
      <footer><button type="button" disabled={busy} onClick={onClose}>{t("Cancel")}</button><button className="layout-save" disabled={busy}>{busy ? t("Saving…") : t("Save")}</button></footer>
    </form>
  </dialog>;
}
