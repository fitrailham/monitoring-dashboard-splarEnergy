import { useCallback, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  CellStyleModule,
  ClientSideRowModelModule,
  CsvExportModule,
  ModuleRegistry,
  PaginationModule,
  TooltipModule,
  ValidationModule,
  themeQuartz,
} from "ag-grid-community";
import type { ColDef, GridApi, ICellRendererParams } from "ag-grid-community";
import type { Plant, PlantStatus } from "../services/fleet";
import {
  format,
  number,
  specific,
  status,
  statusLabel,
} from "../services/fleet";
import Icon from "./Icon";

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  CsvExportModule,
  PaginationModule,
  CellStyleModule,
  TooltipModule,
  ...(import.meta.env.DEV ? [ValidationModule] : []),
]);
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
}: {
  plants: Plant[];
  loading: boolean;
  onSelect: (plant: Plant) => void;
  onRefresh: () => void;
}) {
  const grid = useRef<AgGridReact<Plant>>(null);
  const [draft, setDraft] = useState(emptyFilters),
    [filters, setFilters] = useState(emptyFilters);
  const [expanded, setExpanded] = useState(false),
    [size, setSize] = useState(10),
    [goTo, setGoTo] = useState("");
  const [columns, setColumns] = useState(false),
    [showAddress, setShowAddress] = useState(false);
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
          ((p.address ?? "") + " Indonesia")
            .toLowerCase()
            .includes(filters.region.toLowerCase().trim()) &&
          (!filters.state || status(p) === filters.state) &&
          (!filters.type ||
            (filters.type === "pv"
              ? number(p.capacity_kwp) !== null
              : number(p.battery_soc_percent) !== null)),
      ),
    [plants, filters],
  );
  const defaultColDef = useMemo<ColDef<Plant>>(
    () => ({
      sortable: true,
      resizable: true,
      minWidth: 95,
      filter: false,
      suppressHeaderMenuButton: true,
      wrapHeaderText: true,
    }),
    [],
  );
  const columnDefs = useMemo<ColDef<Plant>[]>(() => {
    const numeric = (
      key: keyof Plant,
      headerName: string,
      width = 140,
      digits = 2,
    ): ColDef<Plant> => ({
      colId: String(key),
      headerName,
      width,
      cellDataType: "number",
      valueGetter: (p) =>
        p.data ? number(p.data[key] as number | string | null) : null,
      valueFormatter: (p) => format(p.value, digits),
      comparator: compareNumbers,
    });
    return [
      { field: "plant_code", headerName: "Plant Code", hide: true },
      {
        colId: "status",
        headerName: "Status",
        width: 100,
        minWidth: 85,
        valueGetter: (p) => (p.data ? statusLabel[status(p.data)] : ""),
        cellRenderer: ({ data }: ICellRendererParams<Plant>) =>
          data ? (
            <span
              className={"status-dot " + status(data)}
              role="img"
              aria-label={statusLabel[status(data)]}
              title={statusLabel[status(data)]}
            />
          ) : null,
      },
      {
        colId: "image",
        headerName: "Plant Image",
        width: 115,
        sortable: false,
        suppressSizeToFit: true,
        cellClass: "plant-image-cell",
        cellRenderer: () => (
          <img
            className="plant-thumbnail"
            src="/solar-plant.svg"
            alt="Ilustrasi panel surya"
          />
        ),
      },
      {
        field: "plant_name",
        headerName: "Plant Name",
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
        headerName: "Country/Region",
        width: 140,
        valueGetter: () => "Indonesia",
      },
      {
        field: "address",
        headerName: "Address",
        width: 300,
        hide: !showAddress,
        tooltip: ({ data }) => data?.address ?? "",
      },
      numeric("capacity_kwp", "Installed PV (kWp)", 145, 3),
      {
        colId: "optimizers",
        headerName: "Optimizer Quantity",
        width: 120,
        sortable: false,
        valueGetter: () => null,
        valueFormatter: () => "--",
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
        headerName: "Specific Energy (kWh/kWp)",
        width: 160,
        cellDataType: "number",
        valueGetter: (p) => (p.data ? specific(p.data) : null),
        valueFormatter: (p) => format(p.value),
        comparator: compareNumbers,
      },
      numeric("yield_today_kwh", "Yield Today (kWh)", 145),
      numeric("total_yield_kwh", "Total Yield (kWh)", 155),
    ];
  }, [onSelect, showAddress]);
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
    grid.current?.api.exportDataAsCsv({
      fileName: "solar-plants.csv",
      columnKeys: [
        "plant_code",
        "plant_name",
        "address",
        "status",
        "capacity_kwp",
        "pv_power_kw",
        "specific",
        "yield_today_kwh",
        "total_yield_kwh",
      ],
      processCellCallback: ({ value }) => {
        const text = String(value ?? "");
        return /^[=+@\-\t\r]/.test(text) ? "'" + text : text;
      },
    });
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
        <label>
          Plant name
          <input
            placeholder="Plant name / code"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <label>
          Country/Region
          <input
            placeholder="Country/Region"
            value={draft.region}
            onChange={(e) => setDraft({ ...draft, region: e.target.value })}
          />
        </label>
        <label>
          Device type
          <select
            aria-label="Device type"
            value={draft.type}
            onChange={(e) => setDraft({ ...draft, type: e.target.value })}
          >
            <option value="">All</option>
            <option value="pv">PV</option>
            <option value="ess">ESS with SOC data</option>
          </select>
        </label>
        <button
          type="button"
          className="text-button expand-button"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Collapse" : "Expand"}
          <Icon name="chevron" size={13} />
        </button>
        <button type="submit" className="primary">
          Search
        </button>
        <button
          type="button"
          className="outline"
          onClick={() => {
            setDraft(emptyFilters);
            setFilters(emptyFilters);
            setPage(1);
          }}
        >
          Reset
        </button>
        <div className="filter-actions">
          <div className="grid-column-controls">
            <button
              type="button"
              className="icon-button"
              aria-label="Pengaturan kolom tabel"
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
                    onChange={(e) => setShowAddress(e.target.checked)}
                  />
                  Show address
                </label>
              </div>
            )}
          </div>
          <button
            type="button"
            className="icon-button"
            title="Refresh data"
            aria-label="Refresh data"
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
            <Icon name="download" size={15} />
            Export
          </button>
          <button
            type="button"
            className="primary"
            disabled
            title="Endpoint penambahan PLTS belum tersedia pada backend"
          >
            Add Plant
          </button>
        </div>
        {expanded && (
          <div className="expanded-filters">
            <label>
              Status
              <select
                aria-label="Status"
                value={draft.state}
                onChange={(e) => setDraft({ ...draft, state: e.target.value })}
              >
                <option value="">All statuses</option>
                {(
                  [
                    "normal",
                    "faulty",
                    "disconnected",
                    "unknown",
                  ] as PlantStatus[]
                ).map((s) => (
                  <option key={s} value={s}>
                    {statusLabel[s]}
                  </option>
                ))}
              </select>
            </label>
            <span>
              <Icon name="info" size={15} />
              Unknown berarti backend belum menyediakan status operasional.
            </span>
          </div>
        )}
      </form>

      <div
        className="plant-ag-grid"
        role="region"
        aria-label="Tabel monitoring PLTS"
      >
        <AgGridReact<Plant>
          ref={grid}
          theme={gridTheme}
          rowData={filtered}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getRowId={(p) => p.data.plant_code}
          headerHeight={61}
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
        <span>
          Total: <strong>{pagination.total}</strong>{" "}
          {filters.name || filters.region || filters.type || filters.state
            ? `dari ${plants.length} PLTS`
            : ""}
        </span>
        <div className="pagination">
          <button
            className="page-arrow"
            aria-label="Halaman sebelumnya"
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
                  aria-label={`Halaman ${p}`}
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
            aria-label="Halaman berikutnya"
            disabled={activePage === pages}
            onClick={() => setPage(activePage + 1)}
          >
            ›
          </button>
          <select
            aria-label="Jumlah baris per halaman"
            value={size}
            onChange={(e) => {
              setSize(Number(e.target.value));
              setPage(1);
            }}
          >
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
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
            <label>
              Go to
              <input
                aria-label="Nomor halaman"
                type="number"
                min="1"
                max={pages}
                value={goTo}
                onChange={(e) => setGoTo(e.target.value)}
              />
            </label>
            <button type="submit">Page</button>
          </form>
        </div>
      </footer>
    </section>
  );
}
