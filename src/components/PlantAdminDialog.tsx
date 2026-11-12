import { useEffect, useRef, useState } from "react";
import type { Plant } from "../services/fleet";
import { savePlant } from "../services/plantAdmin";
import type { PlantFormValues } from "../services/plantAdmin";

export default function PlantAdminDialog({ plant, onClose, onSaved }: {plant?: Plant; onClose: () => void; onSaved: (code: string) => void}) {
  const [form, setForm] = useState<PlantFormValues>(() => ({code: plant?.plant_code ?? "", name: plant?.plant_name ?? "",
    capacity: plant?.capacity_kwp == null ? "" : String(plant.capacity_kwp), country: plant?.country_code ?? "ID", region: plant?.region ?? "",
    city: plant?.city ?? "", address: plant?.address ?? "", zone: plant?.time_zone ?? "Asia/Jakarta",
    latitude: plant?.latitude == null ? "" : String(plant.latitude), longitude: plant?.longitude == null ? "" : String(plant.longitude)}));
  const [token, setToken] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null), controller = useRef<AbortController | null>(null);
  useEffect(() => {dialog.current?.showModal(); return () => controller.current?.abort();}, []);
  function field(key: keyof PlantFormValues, label: string, required = false, readOnly = false) {
    return <label>{label}<input required={required} readOnly={readOnly} disabled={busy} value={form[key]}
      onChange={(event) => setForm({...form, [key]: event.target.value})} /></label>;
  }
  async function submit() {
    const request = new AbortController(); controller.current = request;
    setBusy(true); setError("");
    try {
      await savePlant(form, token, plant?.plant_code, request.signal);
      if (!request.signal.aborted) { setToken(""); onSaved(plant?.plant_code ?? form.code.trim()); }
    } catch (error) { if (!request.signal.aborted) setError(error instanceof Error ? error.message : "Gagal menyimpan PLTS."); }
    finally {if (!request.signal.aborted) setBusy(false);}
  }
  return <dialog ref={dialog} className="layout-dialog plant-admin-dialog" aria-labelledby="plant-admin-title" onCancel={(event) => {if (busy) event.preventDefault(); else onClose();}}>
    <div className="layout-dialog-heading"><h2 id="plant-admin-title">{plant ? "Edit Plant Metadata" : "Add Plant"}</h2><button disabled={busy} aria-label="Tutup form PLTS" onClick={onClose}>×</button></div>
    <form onSubmit={(event) => {event.preventDefault(); void submit();}}>
      <p>{plant ? "Perbarui metadata PLTS." : "Daftarkan PLTS pada sistem monitoring lokal."} Penyimpanan memerlukan izin tulis dari administrator.</p>
      <div className="plant-admin-fields">
        {field("code", "Plant code", true, Boolean(plant))}{field("name", "Plant name", true, Boolean(plant))}
        {field("capacity", "Installed PV (kWp)", true)}{field("zone", "Time zone (IANA)", true)}
        {field("country", "Country code")}{field("region", "Region")}{field("city", "City")}{field("address", "Address", false, Boolean(plant))}
        {field("latitude", "Latitude")}{field("longitude", "Longitude")}
      </div>
      <label>Token izin tulis<input type="password" autoComplete="off" required value={token} disabled={busy} onChange={(event) => setToken(event.target.value)} /></label>
      <small>Token hanya digunakan selama form ini terbuka dan tidak disimpan di browser.</small>
      {error && <p className="report-error" role="alert">{error}</p>}
      <footer><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button className="layout-save" disabled={busy}>{busy ? "Saving…" : "Save"}</button></footer>
    </form>
  </dialog>;
}
