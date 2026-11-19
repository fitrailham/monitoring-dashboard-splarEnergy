import { translate as t } from "../i18n/language";
import { useLanguage } from "../i18n/useLanguage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  CellStyleModule,
  ClientSideRowModelModule,
  ColumnApiModule,
  ColumnAutoSizeModule,
  CsvExportModule,
  EventApiModule,
  LocaleModule,
  ModuleRegistry,
  NumberFilterModule,
  PaginationModule,
  TextFilterModule,
  TooltipModule,
  ValidationModule,
  themeQuartz,
} from "ag-grid-community";
import type { ColDef, CsvExportParams, GridApi, ICellRendererParams } from "ag-grid-community";
import {
  ClipboardModule,
  ColumnMenuModule,
  ColumnsToolPanelModule,
  ContextMenuModule,
  ExcelExportModule,
  LicenseManager,
} from "ag-grid-enterprise";
import type { Plant, PlantStatus } from "../services/fleet";
import {
  format,
  number,
  specific,
  status,
  statusLabel,
} from "../services/fleet";
import { DEVICE_TYPES } from "../services/devices";
import Icon from "./Icon";
import CommunityColumnHeader from "./CommunityColumnHeader";
import { telemetryFreshness, telemetryLabel } from "../services/quality";

const licenseKey = import.meta.env.VITE_AG_GRID_LICENSE_KEY?.trim();
const licenseDetails: {
  valid: boolean; expired?: boolean; trialExpired?: boolean; incorrectLicenseType?: boolean;
} | null = licenseKey ? LicenseManager.getLicenseDetails(licenseKey) : null;
const enterpriseEnabled = Boolean(licenseDetails?.valid && !licenseDetails.expired &&
  !licenseDetails.trialExpired && !licenseDetails.incorrectLicenseType);
if (enterpriseEnabled && licenseKey) LicenseManager.setLicenseKey(licenseKey);

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  ColumnApiModule,
  ColumnAutoSizeModule,
  ...(enterpriseEnabled ? [ColumnMenuModule, ColumnsToolPanelModule, ContextMenuModule, ClipboardModule, ExcelExportModule] : []),
  CsvExportModule,
  EventApiModule,
  LocaleModule,
  TextFilterModule,
  NumberFilterModule,
  PaginationModule,
  CellStyleModule,
  TooltipModule,
  ...(import.meta.env.DEV ? [ValidationModule] : []),
]);
const csvExportParams: CsvExportParams = {
  fileName: "solar-plants.csv",
  exportedRows: "filteredAndSorted",
  columnKeys: [
    "plant_code", "plant_name", "address", "status", "telemetry",
    "capacity_kwp", "pv_power_kw", "specific", "yield_today_kwh", "total_yield_kwh",
  ],
  processCellCallback: ({ value }) => {
    const text = String(value ?? "");
    return /^[=+@\-\t\r]/.test(text) ? "'" + text : text;
  },
};

const gridTheme = themeQuartz.withParams({
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: 13,
  headerFontSize: 13,
  accentColor: "#1684ff",
  foregroundColor: "#16222e",
  backgroundColor: "#ffffff",
  headerBackgroundColor: "#f7f8fa",
  headerTextColor: "#121c29",
  headerFontWeight: 600,
  headerColumnBorder: { color: "#d5d9df", width: 1 },
  headerColumnBorderHeight: "35%",
  headerColumnResizeHandleColor: "#c8cdd5",
  headerColumnResizeHandleHeight: "35%",
  borderColor: "#dfe3e8",
  rowBorder: { color: "#e5e7eb", width: 1 },
  columnBorder: false,
  rowHoverColor: "#f8fbff",
  cellHorizontalPadding: 10,
  wrapperBorderRadius: 8,
  browserColorScheme: "light",
});
interface Filters {
  name: string;
  region: string;
  type: string;
  serial: string;
}
const emptyFilters: Filters = { name: "", region: "", type: "", serial: "" };
function compareValues<T extends string | number>(
  a: T | null,
  b: T | null,
  _a: unknown,
  _b: unknown,
  descending: boolean,
) {
  if (a === null || a === undefined)
    return b === null || b === undefined ? 0 : descending ? -1 : 1;
  if (b === null || b === undefined) return descending ? 1 : -1;
  return a < b ? -1 : a > b ? 1 : 0;
}
function matchesDeviceType(plant: Plant, type: string) {
  if (!type) return true;
  if (type === "pv") return plant.has_pv ?? (number(plant.capacity_kwp) !== null);
  if (type === "ess")
    return plant.has_ess ?? (plant.device_types?.includes("ess") || number(plant.battery_soc_percent) !== null);
  return plant.device_types?.includes(type) ?? false;
}
function PlantDataUnavailable() {
  return <div className="grid-empty"><strong>{t("Plant data is unavailable.")}</strong></div>;
}

export default function PlantTable({
  plants,
  loading,
  unavailable,
  onSelect,
  onRefresh,
  now,
  onAdd,
  statusFilter,
  onStatusFilterChange,
}: {
  plants: Plant[];
  loading: boolean;
  unavailable: boolean;
  onSelect: (plant: Plant) => void;
  onRefresh: () => void;
  now: number;
  onAdd?: () => void;
  statusFilter: PlantStatus | "";
  onStatusFilterChange: (status: PlantStatus | "") => void;
}) {
  const { language } = useLanguage();
  const grid = useRef<AgGridReact<Plant>>(null);
  useEffect(() => { grid.current?.api?.paginationGoToFirstPage(); }, [statusFilter]);
  const [draft, setDraft] = useState(emptyFilters),
    [filters, setFilters] = useState(emptyFilters);
  const [expanded, setExpanded] = useState(false),
    [size, setSize] = useState(10),
    [goTo, setGoTo] = useState("");
  const [columns, setColumns] = useState(false),
    [optionalColumns, setOptionalColumns] = useState({ address: false, telemetry: false });
  const [columnFiltersActive, setColumnFiltersActive] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const activePage = pagination.page,
    pages = pagination.pages;
  const filtered = useMemo(() => {
    const name = filters.name.trim().toLowerCase();
    const region = filters.region.trim().toLowerCase();
    const serial = filters.serial.trim().toLowerCase();
    const collator = new Intl.Collator(language, { numeric: true, sensitivity: "base" });
    return plants.filter((p) =>
      `${p.plant_name} ${p.plant_code}`.toLowerCase().includes(name) &&
      [p.address, p.country_name, p.country_code, p.region, p.city].filter(Boolean).join(" ").toLowerCase().includes(region) &&
      (!statusFilter || status(p) === statusFilter) &&
      matchesDeviceType(p, filters.type) &&
      (!serial || p.device_serial_numbers?.some((item) => item.toLowerCase().includes(serial))),
    ).sort((a, b) => collator.compare(a.plant_name, b.plant_name));
  }, [plants, filters, language, statusFilter]);
  const defaultColDef = useMemo<ColDef<Plant>>(
    () => ({
      sortable: true,
      resizable: true,
      minWidth: 88,
      filter: "agTextColumnFilter",
      floatingFilter: false,
      filterParams: { buttons: ["reset"], debounceMs: 200 },
      suppressHeaderMenuButton: false,
      suppressHeaderFilterButton: true,
      ...(!enterpriseEnabled ? { headerComponentParams: { innerHeaderComponent: CommunityColumnHeader } } : {}),
      wrapHeaderText: true,
      unSortIcon: true,
    }),
    [],
  );
  const columnDefs = useMemo<ColDef<Plant>[]>(() => {
    const label = (name: string) => t(name, language);
    const numeric = (
      key: keyof Plant,
      headerName: string,
      width = 116,
      digits = 2,
    ): ColDef<Plant> => ({
      colId: String(key),
      headerName: label(headerName),
      width,
      cellDataType: "number",
      filter: "agNumberColumnFilter",
      valueGetter: (p) =>
        p.data ? number(p.data[key] as number | string | null) : null,
      valueFormatter: (p) => format(p.value, digits),
      comparator: compareValues,
    });
    const definitions: ColDef<Plant>[] = [
      {
        colId: "status",
        headerName: label("Status"),
        width: 95,
        valueGetter: (p) => (p.data ? statusLabel[status(p.data)] : ""),
        cellRenderer: ({ data }: ICellRendererParams<Plant>) =>
          data ? (
            <span
              className={"status-dot " + status(data)}
              role="img"
              aria-label={t(statusLabel[status(data)])}
              title={t(statusLabel[status(data)])}
            />
          ) : null,
      },
      {
        colId: "image",
        headerName: label("Plant Image"),
        width: 98,
        sortable: false,
        filter: false,
        floatingFilter: false,
        suppressSizeToFit: true,
        cellClass: "plant-image-cell",
        cellRenderer: ({ data }: ICellRendererParams<Plant>) => (
          <img
            className="plant-thumbnail"
            src={data?.image_url || "/solar-plant.svg"}
            onError={(event) => { if (!event.currentTarget.src.endsWith("/solar-plant.svg")) event.currentTarget.src = "/solar-plant.svg"; }}
            alt={t(data?.image_url ? `Foto ${data.plant_name}` : "Ilustrasi panel surya")}
          />
        ),
      },
      {
        field: "plant_name",
        headerName: label("Plant Name"),
        minWidth: 151,
        flex: 1,
        cellRenderer: ({ data }: ICellRendererParams<Plant>) =>
          data ? (
            <button
              className="plant-link"
              title={data.plant_name}
              onClick={() => onSelect(data)}
            >
              {data.plant_name}
            </button>
          ) : null,
      },
      {
        colId: "country",
        headerName: label("Country/Region"),
        width: 121,
        valueGetter: ({ data }) => data?.country_name ?? data?.country_code ?? "--",
      },
      {
        field: "grid_connected_on",
        headerName: label("Grid Connection Date"),
        width: 121,
        initialSort: "desc",
        valueGetter: ({ data }) => data?.grid_connected_on || null,
        valueFormatter: ({ value }) => value ?? "--",
        comparator: compareValues,
      },
      numeric("capacity_kwp", "Installed PV (kWp)", 121, 3),
      {
        colId: "optimizers",
        headerName: label("Optimizer Quantity"),
        width: 121,
        sortable: false,
        cellDataType: "number",
        filter: "agNumberColumnFilter",
        valueGetter: ({ data }) => data?.optimizer_quantity ?? null,
        valueFormatter: ({ value }) => format(value, 0),
        tooltip: ({ data }) => data?.optimizer_quantity_complete === false ? "Jumlah optimizer masih parsial" : "Jumlah optimizer dari inventory",
      },
      {
        ...numeric("battery_soc_percent", "Battery SOC (%)", 112, 1),
        valueFormatter: (p) =>
          p.value === null || p.value === undefined
            ? "--"
            : format(p.value, 1) + "%",
      },
      numeric("pv_power_kw", "Current Power (kW)"),
      {
        colId: "specific",
        headerName: label("Specific Energy (kWh/kWp)"),
        width: 125,
        cellDataType: "number",
        filter: "agNumberColumnFilter",
        valueGetter: ({ data }) => !data ? null : data.specific_energy_kwh_per_kwp === undefined
          ? specific(data) : number(data.specific_energy_kwh_per_kwp),
        valueFormatter: (p) => format(p.value),
        comparator: compareValues,
      },
      numeric("yield_today_kwh", "Yield Today (kWh)"),
      numeric("total_yield_kwh", "Total Yield (kWh)", 122),
      numeric("performance_ratio_percent", "Performance Ratio (%)", 138),
      { field: "plant_code", headerName: label("Plant Code"), initialHide: true },
      {
        field: "address",
        headerName: label("Address"),
        width: 300,
        initialHide: true,
        tooltip: ({ data }) => data?.address ?? "",
      },
      {
        colId: "telemetry",
        headerName: label("Telemetry age"),
        width: 220,
        initialHide: true,
        valueGetter: ({ data }) => data ? telemetryLabel(telemetryFreshness(data, now)) : "--",
        cellRenderer: ({ data }: ICellRendererParams<Plant>) => {
          if (!data) return null;
          const freshness = telemetryFreshness(data, now);
          return <span className={`telemetry-badge ${freshness.state}`}
            title={freshness.measuredAt || label("Measurement time is unverified")}>
            {label(telemetryLabel(freshness))}
          </span>;
        },
      },
    ];
    return definitions.map((definition) => ({ ...definition, headerTooltip: definition.headerName }));
  }, [onSelect, now, language]);
  const syncPagination = useCallback(({ api }: { api: GridApi<Plant> }) => {
    if (api.isDestroyed()) return;
    setPagination({
      page: api.paginationGetCurrentPage() + 1,
      pages: Math.max(1, api.paginationGetTotalPages()),
      total: api.paginationGetRowCount(),
    });
  }, []);
  function setPage(page: number) {
    grid.current?.api.paginationGoToPage(page - 1);
  }
  function download() {
    grid.current?.api.exportDataAsCsv();
  }
  const firstPageInRange = Math.max(1, Math.min(activePage - 2, pages - 4));
  return (
    <section className="plant-table-card">
      <form
        className="filter-form"
        onSubmit={(e) => {
          e.preventDefault();
          setFilters({ ...draft });
          setPage(1);
        }}
      >
        <label>{t("Plant name")}<input
            id="home-plant-search"
            placeholder={t("Plant name / code")}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <label>{t("Country/Region")}<input
            placeholder={t("Country/Region")}
            value={draft.region}
            onChange={(e) => setDraft({ ...draft, region: e.target.value })}
          />
        </label>
        <label>{t("Device type")}<select
            aria-label={t("Device type")}
            value={draft.type}
            onChange={(e) => setDraft({ ...draft, type: e.target.value })}
          >
            <option value="">{t("All")}</option>
            <option value="pv">{t("PV")}</option>
            <option value="ess">{t("ESS installed")}</option>
            {Object.entries(DEVICE_TYPES).filter(([value]) => value !== "ess").map(([value, label]) =>
              <option key={value} value={value}>{t(label)}</option>
            )}
          </select>
        </label>
        <label>{t("Device SN")}<input
            placeholder={t("Device SN")}
            value={draft.serial}
            onChange={(e) => setDraft({ ...draft, serial: e.target.value })}
          />
        </label>
        <div className="plant-search-actions">
          <button
            type="button"
            className="text-button expand-button"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? t("Collapse") : t("Expand")}
            <Icon name="chevron" size={13} />
          </button>
          <button type="submit" className="primary">{t("Search")}</button>
          <button
            type="button"
            className="outline"
            onClick={() => {
              setDraft(emptyFilters);
              setFilters(emptyFilters);
              onStatusFilterChange("");
              grid.current?.api.setFilterModel(null);
              setColumnFiltersActive(false);
              setPage(1);
            }}
          >{t("Reset")}</button>
        </div>
        <div className="filter-actions">
          <div className="grid-column-controls">
            <button
              type="button"
              className="icon-button"
              aria-label={t("Pengaturan kolom tabel")}
              aria-expanded={columns}
              onClick={() => setColumns(!columns)}
            >
              <Icon name="settings" size={17} />
            </button>
            {columns && (
              <div className="column-menu">
                <label>
                  <input type="checkbox" checked={optionalColumns.address}
                    onChange={(e) => grid.current?.api.setColumnsVisible(["address"], e.target.checked)} />
                  {t("Show address")}
                </label>
                <label>
                  <input type="checkbox" checked={optionalColumns.telemetry}
                    onChange={(e) => grid.current?.api.setColumnsVisible(["telemetry"], e.target.checked)} />
                  {t("Show telemetry age")}
                </label>
              </div>
            )}
          </div>
          <button
            type="button"
            className="icon-button"
            title={t("Refresh data")}
            aria-label={t("Refresh data")}
            disabled={loading}
            onClick={onRefresh}
          >
            <Icon
              name="refresh"
              size={17}
              className={loading ? "spinning" : ""}
            />
          </button>
          <button
            type="button"
            className="outline export-button"
            onClick={download}
          >
            <Icon name="download" size={15} />{t("Export")}</button>
          <button
            type="button"
            className="primary"
            disabled={!onAdd}
            onClick={onAdd}
            title={t(onAdd ? "Daftarkan PLTS pada sistem monitoring lokal" : "Administrator access is required.")}
          >{t("Add Plant")}</button>
        </div>
        {expanded && (
          <div className="expanded-filters">
            <label>{t("Status")}<select
                aria-label={t("Status")}
                value={statusFilter}
                onChange={(e) => onStatusFilterChange(e.target.value as PlantStatus | "")}
              >
                <option value="">{t("All statuses")}</option>
                {(
                  [
                    "normal",
                    "faulty",
                    "disconnected",
                    "unknown",
                  ] as PlantStatus[]
                ).map((s) => (
                  <option key={s} value={s}>
                    {t(statusLabel[s])}
                  </option>
                ))}
              </select>
            </label>
            <span>
              <Icon name="info" size={15} />{t("Unknown berarti backend belum menyediakan status operasional.")}</span>
          </div>
        )}
      </form>

      {statusFilter && <div className="plant-status-filter">
        <span>{t("Plant Status")}</span>
        <strong>{t(statusLabel[statusFilter])}</strong>
        <button type="button" onClick={() => onStatusFilterChange("")}>{t("Clear status filter")}</button>
      </div>}
      <div
        className={`plant-ag-grid${enterpriseEnabled ? "" : " plant-grid-community"}`}
        role="region"
        aria-label={t("Tabel monitoring PLTS")}
      >
        <AgGridReact<Plant>
          getLocaleText={({ defaultValue }) => t(defaultValue)}
          ref={grid}
          theme={gridTheme}
          rowData={filtered}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          columnMenu="new"
          suppressMenuHide
          popupParent={document.body}
          getContextMenuItems={enterpriseEnabled ? () => ["copy", "copyWithHeaders", "separator", "export"] : undefined}
          defaultCsvExportParams={csvExportParams}
          defaultExcelExportParams={enterpriseEnabled ? { fileName: "solar-plants.xlsx" } : undefined}
          onColumnVisible={({ api }) => {
            setOptionalColumns({
              address: api.getColumn("address")?.isVisible() ?? false,
              telemetry: api.getColumn("telemetry")?.isVisible() ?? false,
            });
          }}
          getRowId={(p) => p.data.plant_code}
          headerHeight={59}
          rowHeight={53}
          pagination
          paginationPageSize={size}
          paginationPageSizeSelector={false}
          suppressPaginationPanel
          loading={loading && plants.length === 0}
          activeOverlay={unavailable ? PlantDataUnavailable : undefined}
          animateRows={false}
          ensureDomOrder
          onGridReady={syncPagination}
          onPaginationChanged={syncPagination}
          onModelUpdated={syncPagination}
          onFilterChanged={({ api }) => {
            api.paginationGoToFirstPage();
            setColumnFiltersActive(api.isAnyFilterPresent());
            syncPagination({ api });
          }}
          onCellKeyDown={(e) => {
            if (
              "colDef" in e &&
              e.colDef.field === "plant_name" &&
              e.event instanceof KeyboardEvent &&
              e.event.key === "Enter" &&
              e.data
            )
              onSelect(e.data);
          }}
          overlayNoRowsTemplate='<div class="grid-empty"><strong>Tidak ada PLTS yang ditemukan</strong><span>Coba ubah atau reset filter pencarian.</span></div>'
          overlayLoadingTemplate='<div class="grid-empty"><strong>Memuat data PLTS...</strong><span>Menghubungkan ke backend monitoring</span></div>'
        />
      </div>
      <footer className="table-footer">
        <span>{t("Total: ")}<strong>{unavailable || (loading && !plants.length) ? "—" : pagination.total}</strong>{" "}
          {!unavailable && (filters.name || filters.region || filters.type || filters.serial || statusFilter || columnFiltersActive)
            ? t(`dari ${plants.length} PLTS`)
            : ""}
        </span>
        <nav className="pagination" aria-label={t("Plant table pagination")}>
          <button
            className="page-arrow"
            aria-label={t("Halaman sebelumnya")}
            disabled={activePage === 1}
            onClick={() => setPage(activePage - 1)}
          >
            ‹
          </button>
          {Array.from({ length: pages }, (_, i) => i + 1)
            .filter(
              (p) =>
                pages <= 7 ||
                p === 1 ||
                p === pages ||
                (p >= firstPageInRange && p < firstPageInRange + 5),
            )
            .map((p, i, arr) => (
              <span key={p}>
                {i > 0 && p - arr[i - 1] > 1 && (
                  <span className="page-ellipsis">…</span>
                )}
                <button
                  aria-label={t(`Halaman ${p}`)}
                  aria-current={activePage === p ? "page" : undefined}
                  className={activePage === p ? "page active" : "page"}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              </span>
            ))}
          <button
            className="page-arrow"
            aria-label={t("Halaman berikutnya")}
            disabled={activePage === pages}
            onClick={() => setPage(activePage + 1)}
          >
            ›
          </button>
          <select
            aria-label={t("Jumlah baris per halaman")}
            value={size}
            onChange={(e) => {
              setSize(Number(e.target.value));
              setPage(1);
            }}
          >
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}{t(" / page")}</option>
            ))}
          </select>
          <form
            className="go-to"
            onSubmit={(e) => {
              e.preventDefault();
              const requested = Number(goTo);
              if (
                Number.isInteger(requested) &&
                requested >= 1 &&
                requested <= pages
              ) {
                setPage(requested);
                setGoTo("");
              }
            }}
          >
            <label>{t("Go to")}<input
                aria-label={t("Nomor halaman")}
                type="number"
                min="1"
                max={pages}
                value={goTo}
                onChange={(e) => setGoTo(e.target.value)}
              />
            </label>
            <button type="submit">{t("Page")}</button>
          </form>
        </nav>
      </footer>
    </section>
  );
}
