import { useEffect, useMemo, useRef, useState } from "react";
import { getLocale, translate as t } from "../i18n/language";
import { format, number } from "../services/fleet";
import type { Plant } from "../services/fleet";
import { trendCsv } from "../services/monitoring";
import Icon from "./Icon";

interface Props {
  plants: Plant[];
  loading: boolean;
  onAdd?: () => void;
  onEdit?: (plant: Plant) => void;
  onSelect: (plant: Plant) => void;
}

const HEADERS = ["Plant Name", "Installed PV (kWp)", "Plant Address", "Contact Method", "Share Plant", "Grid Connection Date"];
const METADATA_UNAVAILABLE = "This data is not available from the backend.";
const SHARING_UNAVAILABLE = "Plant sharing is not available from the backend.";
const EMPTY = "—";

function locationOf(plant: Plant) {
  return plant.region?.trim() || plant.city?.trim() || null;
}

export default function PlantManagement({ plants, loading, onAdd, onEdit, onSelect }: Props) {
  const locale = getLocale();
  const [locationSearch, setLocationSearch] = useState("");
  const [treeOpen, setTreeOpen] = useState(true);
  const [location, setLocation] = useState<string | null>();
  const [draftName, setDraftName] = useState("");
  const [name, setName] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [goTo, setGoTo] = useState("");
  const [selection, setSelection] = useState<Set<string>>(() => new Set());
  const pageCheckbox = useRef<HTMLInputElement>(null);
  const tableScroll = useRef<HTMLDivElement>(null);

  const locations = useMemo(() => {
    const values = [...new Set(plants.map(locationOf))];
    return values.sort((a, b) => a === null ? 1 : b === null ? -1 : a.localeCompare(b, locale));
  }, [plants, locale]);
  const locationLabel = (value: string | null) => value ?? t("Location not specified");
  const visibleLocations = locations.filter((item) => locationLabel(item).toLowerCase().includes(locationSearch.trim().toLowerCase()));
  const filtered = useMemo(() => plants.filter((plant) => (
    (location === undefined || location === locationOf(plant)) &&
    (plant.plant_name.toLowerCase().includes(name) || plant.plant_code.toLowerCase().includes(name))
  )).sort((a, b) => (b.grid_connected_on ?? "").localeCompare(a.grid_connected_on ?? "") ||
    a.plant_name.localeCompare(b.plant_name, locale)), [plants, location, name, locale]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / size));
  const currentPage = Math.min(page, pageCount);
  const rows = filtered.slice((currentPage - 1) * size, currentPage * size);
  const pageNumbers = Array.from(new Set([1, currentPage - 1, currentPage, currentPage + 1, pageCount]))
    .filter((value) => value >= 1 && value <= pageCount);
  const allChecked = rows.length > 0 && rows.every((plant) => selection.has(plant.plant_code));
  const someChecked = rows.some((plant) => selection.has(plant.plant_code));

  useEffect(() => {
    if (pageCheckbox.current) pageCheckbox.current.indeterminate = someChecked && !allChecked;
  }, [someChecked, allChecked]);
  useEffect(() => {
    if (tableScroll.current) tableScroll.current.scrollTop = 0;
  }, [currentPage, size, name, location]);

  function changeLocation(value: string | null | undefined) {
    setLocation(value);
    setPage(1);
    setSelection(new Set());
  }

  function applySearch(value: string) {
    setName(value.trim().toLowerCase());
    setPage(1);
    setSelection(new Set());
  }

  function toggleRows(targets: Plant[], checked: boolean) {
    setSelection((previous) => {
      const next = new Set(previous);
      for (const plant of targets) {
        if (checked) next.add(plant.plant_code);
        else next.delete(plant.plant_code);
      }
      return next;
    });
  }

  function exportPlants() {
    const selected = filtered.filter((plant) => selection.has(plant.plant_code));
    const items = selected.length ? selected : filtered;
    const csv = trendCsv([
      ["Plant Code", ...HEADERS],
      ...items.map((plant) => [
        plant.plant_code, plant.plant_name, number(plant.capacity_kwp), plant.address || null,
        null, null, plant.grid_connected_on || null,
      ]),
    ]);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "plant-management.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section className="plant-management-panel" aria-label={t("Plant Management")}>
      <aside className="plant-location-panel" aria-label={t("Filter plants by location")}>
        <label className="plant-location-search">
          <Icon name="search" size={15} />
          <input type="search" aria-label={t("Search locations")} placeholder={t("Search locations")}
            value={locationSearch} onChange={(event) => { setLocationSearch(event.target.value); setTreeOpen(true); }} />
        </label>
        <div className="plant-location-tree">
          <div className="plant-location-root">
            <button type="button" className="plant-tree-toggle" aria-expanded={treeOpen} aria-controls="plant-location-list"
              aria-label={t(treeOpen ? "Collapse locations" : "Expand locations")} onClick={() => setTreeOpen(!treeOpen)}>
              <Icon name="chevron" size={12} />
            </button>
            <button type="button" className="plant-location-option" aria-pressed={location === undefined} onClick={() => changeLocation(undefined)}>
              <Icon name="building" size={15} />{t("All plants")}
            </button>
          </div>
          <ul id="plant-location-list" hidden={!treeOpen}>
            {visibleLocations.map((item) => (
              <li key={item === null ? "unspecified" : `location-${item}`}>
                <button type="button" className="plant-location-option" aria-pressed={location === item} onClick={() => changeLocation(item)}
                  title={locationLabel(item)}>
                  <Icon name="pin" size={14} /><span>{locationLabel(item)}</span>
                </button>
              </li>
            ))}
            {locationSearch.trim() && visibleLocations.length === 0 && <li className="plant-location-empty">{t("No matching locations")}</li>}
          </ul>
        </div>
      </aside>

      <div className="plant-management-content">
        <form className="plant-management-filter" onSubmit={(event) => { event.preventDefault(); applySearch(draftName); }}>
          <label>{t("Plant name")}<input value={draftName} onChange={(event) => setDraftName(event.target.value)} /></label>
          <label title={t(METADATA_UNAVAILABLE)}>{t("Contact Method")}<input disabled /></label>
          <div>
            <button type="submit" className="primary">{t("Search")}</button>
            <button type="button" className="outline" onClick={() => { setDraftName(""); applySearch(""); }}>{t("Reset")}</button>
          </div>
        </form>
        <div className="plant-management-actions">
          {["Cancel Share", "Share", "Share EMI"].map((label) => <button key={label} type="button" className="outline" title={t(SHARING_UNAVAILABLE)} disabled>{t(label)}</button>)}
          <button type="button" className="outline" disabled={!filtered.length} onClick={exportPlants}>{t("Export")}</button>
          <button type="button" className="primary" disabled={!onAdd} onClick={onAdd}
            title={onAdd ? undefined : t("Administrator access is required.")}>{t("Add Plant")}</button>
        </div>
        <div className="plant-management-table-scroll" role="region" aria-label={t("Plant management table")} tabIndex={0} ref={tableScroll}>
          <table className="plant-management-table">
            <colgroup>
              {["select", "name", "capacity", "address", "contact", "share", "date", "operation"].map((column) => <col key={column} className={`plant-column-${column}`} />)}
            </colgroup>
            <thead>
              <tr>
                <th scope="col"><input ref={pageCheckbox} type="checkbox" aria-label={t("Select all plants on this page")}
                  checked={allChecked} disabled={!rows.length} onChange={(event) => toggleRows(rows, event.target.checked)} /></th>
                {HEADERS.map((header) => <th key={header} scope="col">{t(header)}</th>)}
                <th scope="col" className="plant-operation">{t("Operation")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((plant) => (
                <tr key={plant.plant_code} className={selection.has(plant.plant_code) ? "plant-row-selected" : undefined}>
                  <td><input type="checkbox" aria-label={t(`Select plant ${plant.plant_name}`)} checked={selection.has(plant.plant_code)}
                    onChange={(event) => toggleRows([plant], event.target.checked)} /></td>
                  <td><button type="button" className="plant-management-link" title={plant.plant_name} onClick={() => onSelect(plant)}>{plant.plant_name}</button></td>
                  <td>{format(plant.capacity_kwp, 3)}</td>
                  <td title={plant.address}>{plant.address || EMPTY}</td>
                  <td>{EMPTY}</td>
                  <td>{EMPTY}</td>
                  <td>{plant.grid_connected_on || EMPTY}</td>
                  <td className="plant-operation">
                    <button type="button" aria-label={t(`Edit plant ${plant.plant_name}`)} disabled={!onEdit}
                      title={t(onEdit ? "Edit Plant Metadata" : "Administrator access is required.")} onClick={() => onEdit?.(plant)}><Icon name="edit" size={15} /></button>
                    <button type="button" aria-label={t(`Delete plant ${plant.plant_name}`)} title={t("Plant deletion is not available from the backend.")} disabled><Icon name="trash" size={15} /></button>
                  </td>
                </tr>
              ))}
              {!rows.length && <tr><td className="plant-management-empty" colSpan={8}>
                <p role="status">{loading ? t("Loading plants…") : t(name || location !== undefined ? "No matching plants" : "No plants yet")}</p>
              </td></tr>}
            </tbody>
          </table>
        </div>
        <footer className="plant-management-pagination">
          <span>{t("Total: ")}{loading && !plants.length ? EMPTY : filtered.length}</span>
          <nav aria-label={t("Plant table pagination")}>
            <button type="button" className="plant-page-prev" aria-label={t("Previous page")} disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><Icon name="chevron" size={13} /></button>
            {pageNumbers.map((value, index) => (
              <span key={value} className="plant-page-number">
                {index > 0 && value - pageNumbers[index - 1] > 1 && <span aria-hidden="true">…</span>}
                <button type="button" aria-current={value === currentPage ? "page" : undefined} aria-label={t(`Page ${value}`)} onClick={() => setPage(value)}>{value}</button>
              </span>
            ))}
            <button type="button" aria-label={t("Next page")} disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}><Icon name="chevron" size={13} /></button>
            <select aria-label={t("Rows per page")} value={size} onChange={(event) => { setSize(Number(event.target.value)); setPage(1); }}>
              {[10, 20, 50].map((value) => <option key={value} value={value}>{value} {t("/ page")}</option>)}
            </select>
            <form onSubmit={(event) => { event.preventDefault(); if (!goTo) return; setPage(Number(goTo)); setGoTo(""); }}>
              <label>{t("Go to")}<input aria-label={t("Page number")} type="number" min={1} max={pageCount} value={goTo} onChange={(event) => setGoTo(event.target.value)} /></label>
              <button type="submit">{t("Page")}</button>
            </form>
          </nav>
        </footer>
      </div>
    </section>
  );
}
