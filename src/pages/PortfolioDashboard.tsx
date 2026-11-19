import { getLocale, translate as t } from "../i18n/language";
import { useLanguage } from "../i18n/useLanguage";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Plant, PlantStatus } from "../services/fleet";
import type { AlarmSeverity } from "../services/alarms";
import type { Session } from "../services/auth";
import {
  format,
  specific,
  status,
  statusLabel,
} from "../services/fleet";
import Icon from "../components/Icon";
import type { IconName } from "../components/Icon";
import FleetSummary from "../components/FleetSummary";
import type { AlarmSummary } from "../components/FleetSummary";
import DashboardAlarmsDialog from "../components/DashboardAlarmsDialog";
import PlantTable from "../components/PlantTable";
import PlantAdminDialog from "../components/PlantAdminDialog";
import LanguageSelector from "../components/LanguageSelector";
import AccountMenu from "../components/AccountMenu";
import FleetStatistics from "../components/FleetStatistics";
import MoreNavigation from "../components/MoreNavigation";
import type { MoreSection } from "../components/moreSections";
import { ALARM_LEVELS, countAlarmSeverities } from "../services/dashboard";
import { useDashboardData } from "../services/useDashboardData";
import { telemetryFreshness, telemetryLabel } from "../services/quality";
import { REPORT_TABS } from "../services/reportWorkspace";
import type { ReportType } from "../services/reportWorkspace";
import { PLANT_WORKSPACE_GROUPS } from "../components/plantWorkspaceSections";
import type { PlantWorkspaceSection } from "../components/plantWorkspaceSections";
import "../components/PlantWorkspace.css";
const PlantMap = lazy(() => import("../components/PlantMap"));
const HomeOverview = lazy(() => import("../components/HomeOverview"));
const PlantMonitoring = lazy(() => import("../components/PlantMonitoring"));
const ReportsPage = lazy(() => import("../components/ReportsPage"));
const PlantWorkspace = lazy(() => import("../components/PlantWorkspace"));
const MoreWorkspace = lazy(() => import("../components/MoreWorkspace"));

type View = "overview" | "list" | "map" | "statistics" | "monitoring" | "reports" | "plants" | "more";
const views: { id: View; icon: IconName; label: string }[] = [
  { id: "list", icon: "list", label: "List View" },
  { id: "map", icon: "globe", label: "Map View" },
  { id: "statistics", icon: "chart", label: "KPI View" },
  { id: "overview", icon: "home", label: "Dashboard" },
];
const emptyAlarms: AlarmSummary = {
  available: false,
  counts: [0, 0, 0, 0, 0],
  coverage: 0,
  totalPlants: 0,
};
const emptyPlants: Plant[] = [];

function PlantDrawer({
  plant,
  onClose,
  onStatistics,
  now,
  onEdit,
}: {
  plant: Plant;
  onClose: () => void;
  onStatistics: () => void;
  now: number;
  onEdit?: () => void;
}) {
  useLanguage();
  const freshness = telemetryFreshness(plant, now);
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        className="plant-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="plant-detail-title"
        ref={dialog}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Tab") {
            const focusable =
              dialog.current?.querySelectorAll<HTMLElement>("button, a[href]");
            if (!focusable?.length) return;
            const first = focusable[0],
              last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <div className="drawer-header">
          <span className="eyebrow">{t("PLANT OVERVIEW")}</span>
          <button
            className="icon-button"
            aria-label={t("Tutup detail PLTS")}
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>
        <img
          className="drawer-photo"
          src={plant.image_url || "/solar-plant.svg"}
          onError={(event) => {if (!event.currentTarget.src.endsWith("/solar-plant.svg")) event.currentTarget.src = "/solar-plant.svg";}}
          alt={t(plant.image_url ? `Foto ${plant.plant_name}` : "Ilustrasi instalasi panel surya")}
        />
        <div className="drawer-title">
          <h2 id="plant-detail-title">{plant.plant_name}</h2>
          <span className={`status-label ${status(plant)}`}>
            <i className={`status-dot ${status(plant)}`} />
            {t(statusLabel[status(plant)])}
          </span>
        </div>
        <p className="plant-code">{plant.plant_code}</p>
        <p className="drawer-address">
          <Icon name="pin" size={17} />
          {plant.address || t("Alamat belum tersedia")}
        </p>
        <div className={`telemetry-detail ${freshness.state}`}>
          <strong>{t(telemetryLabel(freshness))}</strong>
          <span>{freshness.measuredAt
            ? t(`${freshness.state === "unverified" ? "Timestamp belum terverifikasi" : "Waktu pengukuran"}: ${new Date(freshness.measuredAt).toLocaleString(getLocale(), { timeZone: "Asia/Jakarta" })} WIB`)
            : t("Waktu collector belum membuktikan waktu pengukuran perangkat.")}</span>
        </div>
        <div className="detail-metrics">
          {[
            {
              label: "Installed PV capacity",
              value: plant.capacity_kwp,
              unit: "kWp",
            },
            { label: "Current power", value: plant.pv_power_kw, unit: "kW" },
            { label: "Yield today", value: plant.yield_today_kwh, unit: "kWh" },
            { label: "Total yield", value: plant.total_yield_kwh, unit: "kWh" },
            {
              label: "Specific energy",
              value: specific(plant),
              unit: "kWh/kWp",
            },
            {
              label: "Battery SOC",
              value: plant.battery_soc_percent,
              unit: "%",
            },
            {
              label: "ESS charged today",
              value: plant.ess_charge_today_kwh,
              unit: "kWh",
            },
            {
              label: "ESS discharged today",
              value: plant.ess_discharge_today_kwh,
              unit: "kWh",
            },
          ].map((m) => (
            <div key={m.label}>
              <span>{t(m.label)}</span>
              <strong>
                {format(m.value)} <small>{m.unit}</small>
              </strong>
            </div>
          ))}
        </div>
        <div className="detail-note">
          <Icon name="info" size={17} />
          <p>{t("Nilai -- berarti data belum tersedia.")}{plant.timestamp_source === "collector" &&
              t(" Waktu pengukuran belum terverifikasi; timestamp berasal dari collector.")}
          </p>
        </div>
        <button className="outline detail-stats-button" disabled={!onEdit} onClick={onEdit}
          title={onEdit ? undefined : t("Administrator access is required.")}>{t("Edit Plant Metadata")}</button>
        <button className="primary detail-stats-button" onClick={onStatistics}>{t("View yield statistics")}<Icon name="arrow" size={17} />
        </button>
      </aside>
    </div>
  );
}

export default function PortfolioDashboard({ session, onLogout }: { session: Session; onLogout: () => Promise<void> }) {
  useLanguage();
  const { displayName, role, csrfToken } = session;
  const canManagePlants = role === "admin";
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const feeds = useDashboardData(now);
  const plants = feeds.plants.data ?? emptyPlants;
  const summary = feeds.overview.data ?? null;
  const alarmsData = feeds.alarms.data;
  const severityCounts = alarmsData && countAlarmSeverities(alarmsData.alarms);
  const alarms: AlarmSummary = alarmsData && severityCounts ? {
    available: true, counts: ALARM_LEVELS.map((level) => severityCounts[level]),
    coverage: alarmsData.coverage ?? 0, totalPlants: alarmsData.totalPlants ?? plants.length,
    complete: alarmsData.complete,
  } : emptyAlarms;
  const loading = feeds.plants.pending;
  const refreshKey = feeds.plants.receivedAt;
  const updated = feeds.plants.updatedAt ?? (refreshKey || null);
  const error = feeds.plants.error;
  const [view, setView] = useState<View>("list");
  const [statusFilter, setStatusFilter] = useState<PlantStatus | "">("");
  const [alarmSeverity, setAlarmSeverity] = useState<AlarmSeverity | "">();
  const [selectedCode, setSelected] = useState(""),
    [detail, setDetail] = useState<Plant | null>(null),
    [menu, setMenu] = useState<"home" | "reports" | "plants" | "help" | "more" | null>(null);
  const selected = plants.some((plant) => plant.plant_code === selectedCode) ? selectedCode :
    (plants.find((plant) => plant.plant_code === "NE=75907332") ?? plants[0])?.plant_code ?? "";
  const [reportType, setReportType] = useState<ReportType>("plant");
  const [plantSection, setPlantSection] = useState<PlantWorkspaceSection>("plant-management");
  const [moreSection, setMoreSection] = useState<MoreSection>("status");
  const homeNavigation = useRef<HTMLDivElement>(null);
  const reportsNavigation = useRef<HTMLDivElement>(null);
  const plantsNavigation = useRef<HTMLDivElement>(null);
  const closeMoreMenu = useCallback(() => setMenu((current) => current === "more" ? null : current), []);
  useEffect(() => {
    if (menu !== "home" && menu !== "reports" && menu !== "plants") return;
    const navigation = menu === "home" ? homeNavigation : menu === "reports" ? reportsNavigation : plantsNavigation;
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !navigation.current?.contains(event.target))
        setMenu(null);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setMenu(null);
      navigation.current?.querySelector<HTMLButtonElement>("button")?.focus();
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menu]);
  const [plantEditor, setPlantEditor] = useState<{plant?: Plant} | null>(null);
  const selectPlant = useCallback((plant: Plant) => {
    setDetail(plant);
    setSelected(plant.plant_code);
  }, []);
  function changeView(next: View) {
    setView(next);
    setMenu(null);
  }
  function openReport(next: ReportType) {
    setReportType(next);
    changeView("reports");
  }
  function openPlantSection(next: PlantWorkspaceSection) {
    setPlantSection(next);
    changeView("plants");
  }
  function openMoreSection(next: MoreSection) {
    setMoreSection(next);
    changeView("more");
  }
  function renderPlantMenuGroup(group: (typeof PLANT_WORKSPACE_GROUPS)[number]) {
    return (
      <section className="plants-dropdown-group" key={group.label}>
        <strong><Icon name={group.icon} size={18} />{t(group.label)}</strong>
        {group.items.map((item) => (
          <button key={item.id} type="button" aria-current={plantSection === item.id ? "page" : undefined}
            onClick={() => {
              openPlantSection(item.id);
              plantsNavigation.current?.querySelector("button")?.focus();
            }}>
            {t(item.label)}
          </button>
        ))}
      </section>
    );
  }
  const homeView = views.some((item) => item.id === view);
  const fleetView = view === "list" || view === "statistics";
  const needsFleet = view !== "more" || moreSection === "status" || moreSection === "alarms";
  const refresh = () => void feeds.refresh();
  return (
    <div className="portfolio-app">
      <header className="app-header">
        <a
          className="brand-logo"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            changeView("list");
          }}
          aria-label={t("IconGreen home")}
        >
          <img
            className="brand-logo-image"
            src="/icongreen-logo.png"
            alt={t("IconGreen — Member of PLN Group")}
            width="1600"
            height="642"
          />
        </a>
        <span className="header-divider" />
        {/* <span className="product-name">FusionSolar</span> */}
        <button
          className="header-home"
          aria-label={t("Home")}
          onClick={() => changeView("list")}
        >
          <Icon name="home" size={23} />
        </button>
        <nav className="main-nav" aria-label={t("Main navigation")}>
          <div
            className="home-navigation"
            ref={homeNavigation}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget))
                setMenu((current) => current === "home" ? null : current);
            }}
          >
            <button
              className={homeView || menu === "home" ? "active" : ""}
              aria-expanded={menu === "home"}
              aria-controls="home-views"
              onClick={() => {
                if (!homeView) setView("list");
                setMenu(menu === "home" ? null : "home");
              }}
            >{t("Home")}</button>
            {menu === "home" && (
              <div id="home-views" className="home-dropdown" role="group" aria-label={t("Tampilan Home")}>
                <strong><Icon name="home" size={18} />{t("Home")}</strong>
                {views.map((item) => (
                  <button
                    key={item.id}
                    aria-current={view === item.id ? "page" : undefined}
                    onClick={() => changeView(item.id)}
                  >
                    {t(item.label)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            className={view === "monitoring" ? "active" : ""}
            onClick={() => changeView("monitoring")}
          >{t("Monitoring")}</button>
          <div className="home-navigation reports-navigation" ref={reportsNavigation} onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setMenu((current) => current === "reports" ? null : current);
          }}>
            <button className={view === "reports" || menu === "reports" ? "active" : ""}
              aria-expanded={menu === "reports"} aria-controls="reports-menu" onClick={() => { setView("reports"); setMenu(menu === "reports" ? null : "reports"); }}>{t("Reports")}</button>
            {menu === "reports" && <div id="reports-menu" className="home-dropdown reports-dropdown" role="group" aria-label={t("Reports")}>
              <strong><Icon name="chart" size={18} />{t("Reports")}</strong>
              {REPORT_TABS.map((item) => <button key={item.id} aria-current={view === "reports" && reportType === item.id ? "page" : undefined} onClick={() => openReport(item.id)}>{t(item.label)}</button>)}
            </div>}
          </div>
          <button className="business-operation-disabled" disabled aria-disabled="true" title={t("Fitur operasi bisnis belum tersedia")}>{t("Business Operation")}</button>
          <div className="home-navigation plants-navigation" ref={plantsNavigation} onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setMenu((current) => current === "plants" ? null : current);
          }}>
            <button type="button" className={view === "plants" ? "active" : ""} aria-expanded={menu === "plants"}
              aria-controls="plants-menu" onClick={() => { setView("plants"); setMenu(menu === "plants" ? null : "plants"); }}>
              {t("Plants")}
            </button>
            {menu === "plants" && (
              <div id="plants-menu" className="home-dropdown plants-dropdown" role="group" aria-label={t("Plants")}>
                <div>{PLANT_WORKSPACE_GROUPS.slice(0, 2).map(renderPlantMenuGroup)}</div>
                <div>{renderPlantMenuGroup(PLANT_WORKSPACE_GROUPS[2])}</div>
              </div>
            )}
          </div>
          <MoreNavigation open={menu === "more"} section={view === "more" ? moreSection : undefined}
            onToggle={() => setMenu(menu === "more" ? null : "more")} onClose={closeMoreMenu} onSelect={openMoreSection} />
        </nav>
        <div className="header-utilities">
          <button
            className="smart-design"
            disabled
            title={t("SmartDesign belum tersedia")}
          >{t("SmartDesign")}</button>
          <button
            aria-label={t("Refresh monitoring")}
            title={t("Refresh monitoring")}
            onClick={refresh}
          >
            <Icon
              name="refresh"
              size={18}
              className={feeds.refreshing ? "spinning" : ""}
            />
          </button>
          <button
            aria-label={t("Buka laporan yield")}
            title={t("Reports")}
            onClick={() => openReport("plant")}
          >
            <Icon name="calendar" size={19} />
          </button>
          <LanguageSelector />
          <button
            className="header-help"
            aria-label={t("Bantuan dashboard")}
            aria-expanded={menu === "help"}
            onClick={() => setMenu(menu === "help" ? null : "help")}
          >
            <Icon name="help" size={21} />
          </button>
          <AccountMenu displayName={displayName} onLogout={onLogout} />
        </div>
        {menu === "help" && (
          <div className="header-dropdown">
            <button
              className="dropdown-close icon-button"
              aria-label={t("Tutup menu")}
              onClick={() => setMenu(null)}
            >
              <Icon name="close" size={15} />
            </button>
            <strong>{t("Monitoring help")}</strong>
            <p>{t("Buka menu Home untuk memilih List View, Map View, KPI View, atau Dashboard. Data diperbarui otomatis setiap 5 menit.")}</p>
            <p>{t("Nilai -- dan status Unknown menandakan data yang belum tersedia.")}</p>
          </div>
        )}
      </header>
      {homeView && <div
        className={`view-switcher ${view === "map" ? "on-map" : ""} ${view === "overview" ? "on-overview" : ""}`}
        role="group"
        aria-label={t("Dashboard view")}
      >
        {views.map((v) => (
          <button
            key={v.id}
            title={t(v.label)}
            aria-label={t(v.label)}
            aria-pressed={view === v.id}
            className={view === v.id ? "active" : ""}
            onClick={() => changeView(v.id)}
          >
            <Icon name={v.icon} size={17} />
          </button>
        ))}
      </div>}
      {fleetView && (
        <FleetSummary
          plants={plants}
          alarms={alarms}
          feeds={feeds}
          statusFilter={statusFilter}
          onStats={() => changeView("statistics")}
          onStatus={(status) => {
            setStatusFilter(status);
            changeView("list");
            requestAnimationFrame(() => document.getElementById("home-plant-search")?.focus());
          }}
          onAlarms={setAlarmSeverity}
          now={now}
        />
      )}
      <main className={view === "more" ? "main-more" : view === "plants" ? "plant-workspace-main" : view === "reports" ? "main-reports" : view === "monitoring" ? "main-monitoring" : view === "overview" ? "main-overview" : view === "map" ? "main-map" : "main-content"}>
        {!fleetView && needsFleet && error && (
          <div
            className={`connection-banner ${error ? "error-banner" : ""}`}
            role="alert"
          >
            <Icon name="info" size={18} />
            <span>
              {t(error)}
              {error && plants.length > 0
                ? t(" Menampilkan data terakhir yang berhasil dimuat.")
                : ""}
            </span>
            <button className="text-button" onClick={refresh}>{t("Coba lagi")}</button>
          </div>
        )}
        {view === "more" && (
          <Suspense fallback={<div className="map-loading">{t("Loading…")}</div>}>
            <MoreWorkspace section={moreSection} onSectionChange={setMoreSection} plants={plants} loading={loading}
              selected={selected} onPlantChange={setSelected} onPlantSelect={selectPlant}
              onOpenPlantSection={openPlantSection} now={now} refreshKey={refreshKey}
              alarms={alarms} summary={summary} displayName={displayName} />
          </Suspense>
        )}
        {view === "plants" && (
          <Suspense fallback={<div className="map-loading">{t("Loading plants…")}</div>}>
            <PlantWorkspace section={plantSection} onSectionChange={setPlantSection} plants={plants}
              loading={loading} selected={selected} onPlantChange={setSelected} onPlantSelect={selectPlant}
              onPlantAdd={canManagePlants ? () => setPlantEditor({}) : undefined}
              onPlantEdit={canManagePlants ? (plant) => setPlantEditor({ plant }) : undefined}
              onMonitoring={() => changeView("monitoring")} refreshKey={refreshKey} />
          </Suspense>
        )}
        {view === "reports" && (
          <Suspense fallback={<div className="map-loading">{t("Memuat Reports…")}</div>}>
            <ReportsPage plants={plants} report={reportType} onReportChange={setReportType}
              now={now} refreshKey={refreshKey} plantsLoading={loading} />
          </Suspense>
        )}
        {view === "monitoring" && (
          <Suspense fallback={<div className="map-loading">{t("Memuat Monitoring…")}</div>}>
            <PlantMonitoring plants={plants} selected={selected} onChange={setSelected}
              now={now} refreshKey={refreshKey} />
          </Suspense>
        )}
        {view === "overview" && (
          <Suspense fallback={<div className="map-loading">{t("Memuat Dashboard…")}</div>}>
            <HomeOverview plants={plants} alarms={alarms} summary={summary} now={now} selected={selected}
              onChange={setSelected} onSelect={selectPlant} refreshKey={refreshKey} />
          </Suspense>
        )}
        {view === "list" && (
          <PlantTable
            onAdd={canManagePlants ? () => setPlantEditor({}) : undefined}
            plants={plants}
            loading={loading}
            unavailable={feeds.plants.data === undefined && Boolean(error)}
            onSelect={selectPlant}
            onRefresh={refresh}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            now={now}
          />
        )}
        {view === "statistics" && (
          <FleetStatistics
            summary={summary}
            plants={plants}
            selected={selected}
            onChange={setSelected}
            refreshKey={refreshKey}
          />
        )}
        {view === "map" && (
          <Suspense
            fallback={
              <div className="map-loading">
                <Icon name="globe" size={30} />
                <span>{t("Loading map…")}</span>
              </div>
            }
          >
            <PlantMap plants={plants} onSelect={selectPlant} />
          </Suspense>
        )}
        {fleetView && (
          <footer className="app-footer">
            <span>
              <i
                className={`connection-dot ${error || feeds.plants.stale ? "offline" : updated !== null ? "online" : ""}`}
              />
              {updated !== null
                ? t(`API synced ${new Date(updated).toLocaleTimeString("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" })} WIB`)
                : t(error ? "Data unavailable" : "Connecting to monitoring…")}
              <span className="footer-separator">·</span>{t("Auto-refresh 5 min")}</span>
            <span>{t("IconGreen Solar Monitoring")}<span className="footer-separator">·</span>
              {plants.length}{t(" plants")}</span>
          </footer>
        )}
      </main>
      {alarmSeverity !== undefined && <DashboardAlarmsDialog initialSeverity={alarmSeverity} feed={feeds.alarms}
        plants={plants} onRetry={refresh} onClose={() => setAlarmSeverity(undefined)} />}
      {detail && (
        <PlantDrawer
          plant={
            plants.find((p) => p.plant_code === detail.plant_code) ?? detail
          }
          onClose={() => setDetail(null)}
          onEdit={canManagePlants ? () => {setDetail(null); setPlantEditor({plant: detail});} : undefined}
          now={now}
          onStatistics={() => {
            setDetail(null);
            changeView("statistics");
          }}
        />
      )}
      {canManagePlants && plantEditor && <PlantAdminDialog plant={plantEditor.plant} csrfToken={csrfToken} onClose={() => setPlantEditor(null)} onSaved={(code) => {
        setPlantEditor(null); setSelected(code); refresh();
      }} />}
    </div>
  );
}
