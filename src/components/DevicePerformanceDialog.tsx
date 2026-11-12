import { useEffect, useRef, useState } from "react";
import { calendarDate } from "../services/calendar";
import { statisticsRange } from "../services/statistics";
import { getDeviceHistory, devicePerformanceRows } from "../services/analytics";
import type { InventoryDevice } from "../services/devices";
import { trendCsv } from "../services/monitoring";

export default function DevicePerformanceDialog({ code, device, zone, onClose }: {
  code: string; device: InventoryDevice; zone: string; onClose: () => void;
}) {
  const [today] = useState(() => calendarDate(Date.now(), zone));
  const [start, setStart] = useState(today), [end, setEnd] = useState(today);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const dialog = useRef<HTMLDialogElement>(null), request = useRef<AbortController | null>(null);
  useEffect(() => { dialog.current?.showModal(); return () => request.current?.abort(); }, []);
  async function download() {
    if (!device.sourceId) return;
    const controller = new AbortController();
    request.current?.abort(); request.current = controller;
    setBusy(true); setMessage("");
    try {
      const range = statisticsRange("Day", start, zone);
      range.to = statisticsRange("Day", end, zone).to;
      const result = await getDeviceHistory(code, device.sourceId, range, controller.signal);
      if (controller.signal.aborted) return;
      if (!result.samples.length) { setMessage("Belum ada riwayat perangkat untuk periode ini."); return; }
      const url = URL.createObjectURL(new Blob([trendCsv(devicePerformanceRows(code, device.sourceId, result.samples))], {type: "text/csv;charset=utf-8"}));
      const link = document.createElement("a"); link.href = url;
      link.download = `performance-${device.sourceId.replace(/[^a-zA-Z0-9_-]/g, "_")}-${start}-${end}.csv`;
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(`${result.samples.length} sampel diekspor. Nilai tanpa waktu/arah/kualitas terverifikasi tetap kosong. ${result.warnings.join(" ")}`);
    } catch (error) { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Ekspor gagal."); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <dialog ref={dialog} className="layout-dialog" aria-labelledby="performance-title" onCancel={onClose}>
    <div className="layout-dialog-heading"><h2 id="performance-title">Export Performance Data</h2><button aria-label="Tutup ekspor performa" onClick={onClose}>×</button></div>
    <form onSubmit={(event) => { event.preventDefault(); void download(); }}>
      <p>{device.name} · {zone} · Maksimum 31 hari. Ekspor mencakup seluruh halaman riwayat perangkat.</p>
      <label>Start date<input type="date" required value={start} max={end} disabled={busy} onChange={(event) => setStart(event.target.value)} /></label>
      <label>End date<input type="date" required value={end} min={start} disabled={busy} onChange={(event) => setEnd(event.target.value)} /></label>
      {message && <p role="status">{message}</p>}
      <footer><button type="button" onClick={onClose}>Close</button><button className="layout-save" disabled={busy}>{busy ? "Memuat seluruh halaman…" : "Export CSV"}</button></footer>
    </form>
  </dialog>;
}
