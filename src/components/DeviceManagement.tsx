import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { Plant } from "../services/fleet";
import { statusLabel } from "../services/fleet";
import { validTimeZone } from "../services/calendar";
import { DEVICE_TYPES, EMPTY_DEVICE_FILTERS, filterDevices, getDevices, sortDevices } from "../services/devices";
import type { DeviceFilters, DeviceSortKey, InventoryDevice } from "../services/devices";
import { trendCsv } from "../services/monitoring";
import Icon from "./Icon";

const COLUMNS: { key: DeviceSortKey; label: string; className: string }[] = [
  { key: "status", label: "Device Status", className: "device-col-status" },
  { key: "name", label: "Device Name", className: "device-col-name" },
  { key: "plantName", label: "Plant Name", className: "device-col-plant" },
  { key: "type", label: "Device Type", className: "device-col-type" },
  { key: "software", label: "Software Version", className: "device-col-software" },
  { key: "sn", label: "SN", className: "device-col-sn" },
  { key: "parentName", label: "Superior Equipment", className: "device-col-parent" },
];
const EMPTY_INVENTORY: InventoryDevice[] = [];
function downloadCsv(name: string, rows: (string | number | null)[][]) {
  const url = URL.createObjectURL(new Blob([trendCsv(rows)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = name;
  document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function DeviceManagement({ plant, refreshKey, onOverview }: {
  plant?: Plant; refreshKey: number; onOverview: () => void;
}) {
  const code = plant?.plant_code ?? "", plantName = plant?.plant_name ?? "", zone = validTimeZone(plant?.time_zone);
  const [draft, setDraft] = useState<DeviceFilters>(EMPTY_DEVICE_FILTERS), [filters, setFilters] = useState<DeviceFilters>(EMPTY_DEVICE_FILTERS);
  const [expanded, setExpanded] = useState(false), [retry, setRetry] = useState(0);
  const [page, setPage] = useState(1), [size, setSize] = useState(10);
  const [selection, setSelection] = useState<Set<string>>(() => new Set()), [expandedRows, setExpandedRows] = useState<Set<string>>(() => new Set());
  const [sort, setSort] = useState<{ key: DeviceSortKey; direction: "asc" | "desc" }>({ key: "name", direction: "asc" });
  const [response, setResponse] = useState<{ key: string; devices: InventoryDevice[]; error: string; warning: string } | null>(null);
  const [mode, setMode] = useState<"detail" | "rename" | null>(null), [targets, setTargets] = useState<InventoryDevice[]>([]);
  const [newName, setNewName] = useState(""), [prefix, setPrefix] = useState("Device-"), [start, setStart] = useState("1");
  const dialog = useRef<HTMLDialogElement>(null), pageCheckbox = useRef<HTMLInputElement>(null);
  const key = JSON.stringify([code, plantName, refreshKey, retry]);
  const active = response?.key === key ? response : null;
  const loading = Boolean(code) && !active;
  useEffect(() => {
    if (!code) return;
    const controller = new AbortController();
    void getDevices(code, plantName, controller.signal)
      .then((result) => { if (!controller.signal.aborted) setResponse({ key, ...result, error: "" }); })
      .catch((error) => { if (!controller.signal.aborted) setResponse({ key, devices: [], warning: "", error: error instanceof Error ? error.message : "Gagal memuat inventory perangkat." }); });
    return () => controller.abort();
  }, [code, plantName, key]);
  useEffect(() => { if (mode) dialog.current?.showModal(); else dialog.current?.close(); }, [mode]);
  const devices = active?.devices ?? EMPTY_INVENTORY;
  const filtered = useMemo(() => sortDevices(filterDevices(devices, filters), sort.key, sort.direction), [devices, filters, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / size)), current = Math.min(page, pages);
  const displayed = filtered.slice((current - 1) * size, current * size);
  const selected = filtered.filter((device) => selection.has(device.id));
  const allPageSelected = displayed.length > 0 && displayed.every((device) => selection.has(device.id));
  const somePageSelected = displayed.some((device) => selection.has(device.id));
  useEffect(() => { if (pageCheckbox.current) pageCheckbox.current.indeterminate = somePageSelected && !allPageSelected; }, [somePageSelected, allPageSelected]);
  const proposals = targets.map((device, index) => ({ device, name: targets.length === 1 ? newName.trim() : `${prefix.trim()}${Number(start) + index}` }));
  const namesValid = targets.length > 0 && (targets.length === 1 ? Boolean(newName.trim()) : Boolean(prefix.trim()) && Number.isInteger(Number(start)) && Number(start) >= 1 && Number(start) <= 99999);
  function openDetail(device: InventoryDevice) { setTargets([device]); setMode("detail"); }
  function openRename(items: InventoryDevice[]) { if (!items.length) return; setTargets(items); setNewName(items[0].name); setPrefix("Device-"); setStart("1"); setMode("rename"); }
  function toggleSelection(id: string, checked: boolean) { setSelection((previous) => { const next = new Set(previous); if (checked) next.add(id); else next.delete(id); return next; }); }
  function exportBasic() {
    const items = selected.length ? selected : filtered;
    if (!items.length) return;
    downloadCsv(`devices-${code.replace(/[^a-zA-Z0-9_-]/g, "_")}.csv`, [
      ["Plant Code", "Device ID", "Device Name", "Plant Name", "Device Type", "Status", "Software Version", "SN", "Superior Equipment", "Model", "Last Seen", "Optimizer Quantity"],
      ...items.map((device) => [code, device.sourceId, device.name, device.plantName, DEVICE_TYPES[device.type], statusLabel[device.status], device.software, device.sn, device.parentName, device.model, device.lastSeen, device.optimizerQuantity]),
    ]);
  }
  function exportRenameDraft() {
    if (!namesValid) return;
    downloadCsv(`device-rename-draft-${code.replace(/[^a-zA-Z0-9_-]/g, "_")}.csv`, [
      ["Plant Code", "Device ID", "SN", "Current Name", "Proposed Name", "Draft Only"],
      ...proposals.map(({ device, name }) => [code, device.sourceId, device.sn, device.name, name, "true"]),
    ]);
  }
  const detail = targets[0];
  return <div className="device-management-page"><section className="device-management-panel" aria-label="Device Management">
    <form className="device-filter-form" onSubmit={(event) => { event.preventDefault(); setFilters({ ...draft }); setPage(1); setSelection(new Set()); }}>
      <label>Device type<select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}><option value="">All</option>{Object.entries(DEVICE_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Device name<input aria-label="Device name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
      <label>SN<input aria-label="SN" value={draft.sn} onChange={(event) => setDraft({ ...draft, sn: event.target.value })} /></label>
      <button type="button" className="device-expand" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? "Collapse" : "Expand"}<Icon name="chevron" size={12} /></button>
      <button className="device-search" type="submit">Search</button><button type="button" className="device-outline" onClick={() => { setDraft(EMPTY_DEVICE_FILTERS); setFilters(EMPTY_DEVICE_FILTERS); setPage(1); setSelection(new Set()); setExpandedRows(new Set()); }}>Reset</button>
      {expanded && <div className="device-extra-filters"><label>Device status<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}><option value="">All statuses</option>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Model<input value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })} /></label></div>}
    </form>
    <div className="device-action-bar"><div className="device-scope"><span>{plantName || "Pilih PLTS melalui daftar di sisi kiri"}</span>{selected.length > 0 && <><strong>{selected.length} selected</strong><button onClick={() => setSelection(new Set())}>Clear selection</button></>}</div><div className="device-action-buttons"><button disabled title="Backend belum menyediakan pengaturan parameter perangkat">Set Parameters</button><button disabled title="Riwayat performa per perangkat belum tersedia dari backend">Export Performance Data</button><button disabled={!selected.length} title={!selected.length ? "Pilih perangkat terlebih dahulu" : "Siapkan draf nama baru"} onClick={() => openRename(selected)}>Batch Rename</button><button disabled={!filtered.length || loading} onClick={exportBasic}>Export Basic Info</button></div></div>
    {(active?.error || active?.warning) && <div className="device-inventory-message" role={active.error ? "alert" : "status"}><span>{active.error || active.warning}</span>{active.error && <button onClick={() => setRetry((value) => value + 1)}>Coba lagi</button>}</div>}
    <div className="device-table-region"><div className="device-table-scroll"><table className="device-data-table"><thead><tr><th className="device-col-check"><input ref={pageCheckbox} type="checkbox" aria-label="Pilih semua perangkat pada halaman ini" checked={allPageSelected} disabled={!displayed.length} onChange={(event) => { const checked = event.target.checked; setSelection((previous) => { const next = new Set(previous); displayed.forEach((device) => { if (checked) next.add(device.id); else next.delete(device.id); }); return next; }); }} /></th>
      {COLUMNS.map((column) => <th key={column.key} className={column.className} scope="col" aria-sort={sort.key === column.key ? sort.direction === "asc" ? "ascending" : "descending" : "none"}><button onClick={() => { setSort({ key: column.key, direction: sort.key === column.key && sort.direction === "asc" ? "desc" : "asc" }); setPage(1); }}>{column.label}</button></th>)}<th className="device-col-operation" scope="col">Operation</th></tr></thead><tbody>
      {displayed.map((device) => {
        const children = devices.filter((child) => child.id !== device.id && child.parentId !== null && (child.parentId === device.sourceId || child.parentId === device.sn));
        const expandable = children.length > 0 || device.optimizerQuantity !== null;
        return <Fragment key={device.id}><tr className={selection.has(device.id) ? "device-row-selected" : ""}>
          <td><input type="checkbox" aria-label={`Pilih ${device.name}`} checked={selection.has(device.id)} onChange={(event) => toggleSelection(device.id, event.target.checked)} /></td>
          <td><div className="device-status-cell">{expandable && <button className="device-tree-toggle" aria-label={`${expandedRows.has(device.id) ? "Tutup" : "Buka"} detail ${device.name}`} aria-expanded={expandedRows.has(device.id)} onClick={() => setExpandedRows((previous) => { const next = new Set(previous); if (next.has(device.id)) next.delete(device.id); else next.add(device.id); return next; })}>{expandedRows.has(device.id) ? "−" : "+"}</button>}<span className={`device-status-dot ${device.status}`} role="img" aria-label={statusLabel[device.status]} title={statusLabel[device.status]} /></div></td>
          <td><button className="device-name-link" onClick={() => openDetail(device)}>{device.name}</button></td><td><button className="device-name-link" onClick={onOverview}>{device.plantName}</button></td><td>{DEVICE_TYPES[device.type]}</td><td>{device.software ?? "--"}</td><td>{device.sn ?? "--"}</td><td title={device.parentName ?? undefined}>{device.parentName ?? "--"}</td><td className="device-col-operation"><button className="device-edit-button" aria-label={`Siapkan perubahan nama ${device.name}`} onClick={() => openRename([device])}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="m4 16 12-12 4 4L8 20H4ZM13 7l4 4M4 23h17" /></svg></button></td></tr>
          {expandedRows.has(device.id) && <tr className="device-related-row"><td colSpan={9}><div><strong>Related equipment · {device.name}</strong>{device.optimizerQuantity !== null && <span>Optimizer quantity: {device.optimizerQuantity}</span>}{children.map((child) => <button key={child.id} onClick={() => openDetail(child)}><Icon name="panel" size={14} />{child.name}<small>{child.sn ?? "--"}</small></button>)}{!children.length && <span>Inventory subperangkat belum tersedia.</span>}</div></td></tr>}
        </Fragment>;
      })}
      {!displayed.length && <tr><td colSpan={9} className="device-empty" aria-label="Tidak ada baris perangkat">&nbsp;</td></tr>}
    </tbody></table></div>{!displayed.length && <div className="device-table-empty-overlay" role="status"><Icon name={loading ? "refresh" : "panel"} size={35} /><strong>{loading ? "Memuat inventory perangkat…" : !code ? "Pilih PLTS untuk melihat perangkat" : active?.error ? "Inventory perangkat belum dapat dimuat" : "No devices found"}</strong><span>{active?.error ? "Periksa koneksi backend lalu coba kembali." : "Gunakan filter lain atau klik Reset."}</span></div>}</div>
    <footer className="device-pagination"><span>Total: {loading || active?.error ? "--" : filtered.length}</span><div><button aria-label="Halaman perangkat sebelumnya" disabled={current === 1} onClick={() => setPage(current - 1)}>‹</button>{Array.from({ length: pages }, (_, index) => index + 1).filter((value) => pages <= 7 || value === 1 || value === pages || Math.abs(value - current) <= 1).map((value, index, list) => <span key={value}>{index > 0 && value - list[index - 1] > 1 && <span className="device-page-ellipsis">…</span>}<button className={current === value ? "active" : ""} aria-current={current === value ? "page" : undefined} aria-label={`Halaman perangkat ${value}`} onClick={() => setPage(value)}>{value}</button></span>)}<button aria-label="Halaman perangkat berikutnya" disabled={current === pages} onClick={() => setPage(current + 1)}>›</button><select aria-label="Jumlah perangkat per halaman" value={size} onChange={(event) => { setSize(Number(event.target.value)); setPage(1); }}>{[10, 20, 50].map((value) => <option key={value} value={value}>{value} / page</option>)}</select></div></footer>
    {active && !active.error && <p className="device-inventory-note">Status dan relasi perangkat mengikuti inventory backend. Nilai -- berarti belum tersedia. Export Basic Info mencakup perangkat terpilih; jika tidak ada pilihan, seluruh hasil filter diekspor.</p>}
  </section>
    <dialog ref={dialog} className="layout-dialog device-dialog" onCancel={() => setMode(null)} aria-labelledby="device-dialog-title"><div className="layout-dialog-heading"><h2 id="device-dialog-title">{mode === "detail" ? "Device Information" : targets.length > 1 ? "Batch Rename · Draft" : "Rename Device · Draft"}</h2><button aria-label="Tutup detail perangkat" onClick={() => setMode(null)}><Icon name="close" size={18} /></button></div>
      {mode === "detail" && detail ? <><dl className="device-detail-list">{[
        ["Device Name", detail.name], ["Device ID", detail.sourceId], ["Plant", detail.plantName], ["Device Type", DEVICE_TYPES[detail.type]], ["Device Status", statusLabel[detail.status]], ["Software Version", detail.software], ["SN", detail.sn], ["Superior Equipment", detail.parentName], ["Model", detail.model], ["Optimizer Quantity", detail.optimizerQuantity],
        ["Last seen", detail.lastSeen && /(?:Z|[+-]\d{2}:\d{2})$/i.test(detail.lastSeen) && Number.isFinite(Date.parse(detail.lastSeen)) ? `${new Date(detail.lastSeen).toLocaleString("id-ID", { timeZone: zone })} (${zone})` : null],
      ].map(([label, value]) => <div key={String(label)}><dt>{String(label)}</dt><dd>{value ?? "--"}</dd></div>)}</dl><footer><button onClick={() => setMode(null)}>Close</button><button className="layout-save" onClick={() => openRename([detail])}>Prepare rename draft</button></footer></> : <form onSubmit={(event) => { event.preventDefault(); exportRenameDraft(); }}><p className="device-rename-note">Backend belum menyediakan perubahan nama perangkat. Draf CSV ini hanya usulan dan tidak mengubah inventory atau nama pada perangkat.</p>{targets.length === 1 ? <label>Proposed device name<input required maxLength={80} value={newName} onChange={(event) => setNewName(event.target.value)} /></label> : <div className="device-rename-fields"><label>Name prefix<input required maxLength={60} value={prefix} onChange={(event) => setPrefix(event.target.value)} /></label><label>Start number<input type="number" required min="1" max="99999" value={start} onChange={(event) => setStart(event.target.value)} /></label></div>}
        <div className="device-rename-preview"><table><thead><tr><th>Current name</th><th>Proposed name</th></tr></thead><tbody>{proposals.map(({ device, name }) => <tr key={device.id}><td>{device.name}</td><td>{namesValid ? name : "--"}</td></tr>)}</tbody></table></div><footer><button type="button" onClick={() => setMode(null)}>Cancel</button><button className="layout-save" type="submit" disabled={!namesValid}>Export rename draft</button></footer></form>}
    </dialog>
  </div>;
}
