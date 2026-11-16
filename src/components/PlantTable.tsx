import { getLanguage, translate as t } from "../i18n/language";
import { useLanguage } from "../i18n/useLanguage";
import { useCallback, useMemo, useRef, useState } from "react";
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
  cellHorizontalPadding: 13,
  wrapperBorderRadius: 8,
  browserColorScheme: "light",
});
interface Filters {
  name: string;
  region: string;
  type: string;
  state: string;
}
const emptyFilters: Filters = { name: "", region: "", type: "", state: "" };
function compareNumbers(
  a: number | null,
  b: number | null,
  _a: unknown,
  _b: unknown,
  descending: boolean,
) {
  if (a === null || a === undefined)
    return b === null || b === undefined ? 0 : descending ? -1 : 1;
  if (b === null || b === undefined) return descending ? 1 : -1;
  return a - b;
}
export default function PlantTable({
  plants,
  loading,
  onSelect,
  onRefresh,
  now,
  onAdd,
}: {
  plants: Plant[];
  loading: boolean;
  onSelect: (plant: Plant) => void;
  onRefresh: () => void;
  now: number;
  onAdd?: () => void;
}) {
  useLanguage();
  const grid = useRef<AgGridReact<Plant>>(null);
  const [draft, setDraft] = useState(emptyFilters),
    [filters, setFilters] = useState(emptyFilters);
  const [expanded, setExpanded] = useState(false),
    [size, setSize] = useState(10),
    [goTo, setGoTo] = useState("");
  const [columns, setColumns] = useState(false),
    [showAddress, setShowAddress] = useState(false);
  const [columnFiltersActive, setColumnFiltersActive] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const activePage = pagination.page,
    pages = pagination.pages;
  const filtered = useMemo(
    () =>
      plants.filter(
        (p) =>
          (p.plant_name + " " + p.plant_code)
            .toLowerCase()
            .includes(filters.name.toLowerCase().trim()) &&
          ([p.address, p.country_name, p.country_code, p.region, p.city].filter(Boolean).join(" "))
            .toLowerCase()
            .includes(filters.region.toLowerCase().trim()) &&
          (!filters.state || status(p) === filters.state) &&
          (!filters.type ||
            (filters.type === "pv"
              ? p.has_pv ?? (number(p.capacity_kwp) !== null)
              : p.has_ess ?? (number(p.battery_soc_percent) !== null))),
      ),
    [plants, filters, getLanguage()],
  );
  const defaultColDef = useMemo<ColDef<Plant>>(
    () => ({
      sortable: true,
      resizable: true,
      minWidth: 95,
      filter: "agTextColumnFilter",
      floatingFilter: false,
      filterParams: { buttons: ["reset"], debounceMs: 200 },
      suppressHeaderMenuButton: false,
      suppressHeaderFilterButton: true,
      ...(!enterpriseEnabled ? { headerComponentParams: { innerHeaderComponent: CommunityColumnHeader } } : {}),
      wrapHeaderText: true,
      autoHeaderHeight: true,
    }),
    [getLanguage()],
  );
  const columnDefs = useMemo<ColDef<Plant>[]>(() => {
    const numeric = (
      key: keyof Plant,
      headerName: string,
      width = 140,
      digits = 2,
    ): ColDef<Plant> => ({
      colId: String(key),
      headerName: t(headerName),
      width,
      cellDataType: "number",
      filter: "agNumberColumnFilter",
      valueGetter: (p) =>
        p.data ? number(p.data[key] as number | string | null) : null,
      valueFormatter: (p) => format(p.value, digits),
      comparator: compareNumbers,
    });
    return [
      { field: "plant_code", headerName: t("Plant Code"), initialHide: true },
      {
        colId: "status",
        headerName: t("Status"),
        width: 125,
        minWidth: 110,
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
        headerName: t("Plant Image"),
        width: 115,
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
        headerName: t("Plant Name"),
        minWidth: 215,
        flex: 1,
        initialSort: "asc",
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
        headerName: t("Country/Region"),
        width: 175,
        minWidth: 165,
        valueGetter: ({ data }) => data?.country_name ?? data?.country_code ?? "--",
      },
      {
        field: "address",
        headerName: t("Address"),
        width: 300,
        initialHide: true,
        tooltip: ({ data }) => data?.address ?? "",
      },
      {
        colId: "telemetry",
        headerName: t("Umur Telemetry"),
        width: 220,
        valueGetter: ({ data }) => data ? telemetryLabel(telemetryFreshness(data, now)) : "--",
        cellRenderer: ({ data }: ICellRendererParams<Plant>) => {
          if (!data) return null;
          const freshness = telemetryFreshness(data, now);
          return <span className={`telemetry-badge ${freshness.state}`}
            title={t(freshness.measuredAt || "Waktu pengukuran perangkat belum terverifikasi")}>
            {t(telemetryLabel(freshness))}
          </span>;
        },
      },
      numeric("capacity_kwp", "Installed PV (kWp)", 145, 3),
      {
        colId: "optimizers",
        headerName: t("Optimizer Quantity"),
        width: 150,
        minWidth: 140,
        sortable: false,
        cellDataType: "number",
        filter: "agNumberColumnFilter",
        valueGetter: ({ data }) => data?.optimizer_quantity ?? null,
        valueFormatter: ({ value }) => format(value, 0),
        tooltip: ({ data }) => data?.optimizer_quantity_complete === false ? "Jumlah optimizer masih parsial" : "Jumlah optimizer dari inventory",
      },
      {
        ...numeric("battery_soc_percent", "Battery SOC (%)", 125, 1),
        valueFormatter: (p) =>
          p.value === null || p.value === undefined
            ? "--"
            : format(p.value, 1) + "%",
      },
      numeric("pv_power_kw", "Current Power (kW)", 145),
      {
        colId: "specific",
        headerName: t("Specific Energy (kWh/kWp)"),
        width: 185,
        minWidth: 165,
        cellDataType: "number",
        filter: "agNumberColumnFilter",
        valueGetter: (p) => (p.data ? specific(p.data) : null),
        valueFormatter: (p) => format(p.value),
        comparator: compareNumbers,
      },
      numeric("yield_today_kwh", "Yield Today (kWh)", 145),
      numeric("total_yield_kwh", "Total Yield (kWh)", 155),
    ];
  }, [onSelect, now, getLanguage()]);
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
          </select>
        </label>
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
            grid.current?.api.setFilterModel(null);
            setColumnFiltersActive(false);
            setPage(1);
          }}
        >{t("Reset")}</button>
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
                  <input
                    type="checkbox"
                    checked={showAddress}
                    onChange={(e) => {
                      grid.current?.api.setColumnsVisible(["address"], e.target.checked);
                    }}
                  />{t("Show address")}</label>
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
            title={t("Daftarkan PLTS pada sistem monitoring lokal")}
          >{t("Add Plant")}</button>
        </div>
        {expanded && (
          <div className="expanded-filters">
            <label>{t("Status")}<select
                aria-label={t("Status")}
                value={draft.state}
                onChange={(e) => setDraft({ ...draft, state: e.target.value })}
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
            setShowAddress(api.getColumn("address")?.isVisible() ?? false);
          }}
          getRowId={(p) => p.data.plant_code}
          headerHeight={52}
          rowHeight={53}
          pagination
          paginationPageSize={size}
          paginationPageSizeSelector={false}
          suppressPaginationPanel
          loading={loading && plants.length === 0}
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
        <span>{t("Total: ")}<strong>{pagination.total}</strong>{" "}
          {filters.name || filters.region || filters.type || filters.state || columnFiltersActive
            ? t(`dari ${plants.length} PLTS`)
            : ""}
        </span>
        <div className="pagination">
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
                Math.abs(p - activePage) <= 1,
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
        </div>
      </footer>
    </section>
  );
}
