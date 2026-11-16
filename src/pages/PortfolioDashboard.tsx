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
import type { Plant } from "../services/fleet";
import {
  format,
  getFleet,
  specific,
  status,
  statusLabel,
} from "../services/fleet";
import Icon from "../components/Icon";
import type { IconName } from "../components/Icon";
import FleetSummary from "../components/FleetSummary";
import type { AlarmSummary } from "../components/FleetSummary";
import PlantTable from "../components/PlantTable";
import PlantAdminDialog from "../components/PlantAdminDialog";
import LanguageSelector from "../components/LanguageSelector";
import AccountMenu from "../components/AccountMenu";
import FleetStatistics from "../components/FleetStatistics";
import { getPortfolioSummary, summaryAlarms } from "../services/portfolio";
import type { PortfolioSummary } from "../services/portfolio";
import { telemetryFreshness, telemetryLabel } from "../services/quality";
import { REPORT_TABS } from "../services/reportWorkspace";
import type { ReportType } from "../services/reportWorkspace";
const PlantMap = lazy(() => import("../components/PlantMap"));
const HomeOverview = lazy(() => import("../components/HomeOverview"));
const PlantMonitoring = lazy(() => import("../components/PlantMonitoring"));
const ReportsPage = lazy(() => import("../components/ReportsPage"));

type View = "overview" | "list" | "map" | "statistics" | "monitoring" | "reports";
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
  onEdit: () => void;
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
        <button className="outline detail-stats-button" onClick={onEdit}>{t("Edit Plant Metadata")}</button>
        <button className="primary detail-stats-button" onClick={onStatistics}>{t("View yield statistics")}<Icon name="arrow" size={17} />
        </button>
      </aside>
    </div>
  );
}

export default function PortfolioDashboard({ displayName, onLogout }: { displayName: string; onLogout: () => void }) {
  useLanguage();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const [plants, setPlants] = useState<Plant[]>([]),
    [view, setView] = useState<View>("overview");
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [warning, setWarning] = useState(""),
    [updated, setUpdated] = useState<Date | null>(null);
  const [selected, setSelected] = useState(""),
    [detail, setDetail] = useState<Plant | null>(null),
    [menu, setMenu] = useState<"home" | "reports" | "help" | "more" | null>(null),
    [alarms, setAlarms] = useState<AlarmSummary>(emptyAlarms);
  const [reportType, setReportType] = useState<ReportType>("plant");
  const homeNavigation = useRef<HTMLDivElement>(null);
  const reportsNavigation = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (menu !== "home" && menu !== "reports") return;
    const navigation = menu === "home" ? homeNavigation : reportsNavigation;
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
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [plantEditor, setPlantEditor] = useState<{plant?: Plant} | null>(null);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const [fleetResult, summaryResult] = await Promise.allSettled([getFleet(signal), getPortfolioSummary(signal)]);
      if (fleetResult.status === "rejected") throw fleetResult.reason;
      const result = fleetResult.value;
      if (signal?.aborted) return;
      setPlants(result.plants);
      const snapshot = summaryResult.status === "fulfilled" ? summaryResult.value : null;
      setSummary(snapshot);
      setAlarms(snapshot ? summaryAlarms(snapshot) : emptyAlarms);
      setWarning([result.warning, summaryResult.status === "rejected" ? "Summary portofolio belum dapat dimuat; ringkasan memakai overview dan alarm belum tersedia." : ""].filter(Boolean).join(" "));
      setError("");
      setUpdated(new Date());
      setNow(Date.now());
      setSelected((previous) =>
        result.plants.some((p) => p.plant_code === previous)
          ? previous
          : (result.plants.find((p) => p.plant_code === "NE=75907332")
              ?.plant_code ??
            result.plants[0]?.plant_code ??
            ""),
      );
    } catch (e) {
      if (!signal?.aborted)
        setError(
          e instanceof Error ? e.message : "Gagal memuat data monitoring.",
        );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const timer = setInterval(() => void load(controller.signal), 300000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [load]);
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
  return (
    <div className="portfolio-app">
      <header className="app-header">
        <a
          className="brand-logo"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            changeView("overview");
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
          onClick={() => changeView("overview")}
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
              className={view !== "monitoring" && view !== "reports" || menu === "home" ? "active" : ""}
              aria-expanded={menu === "home"}
              aria-controls="home-views"
              onClick={() => setMenu(menu === "home" ? null : "home")}
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
          <button onClick={() => changeView("list")}>{t("Plants")}</button>
          <button
            aria-expanded={menu === "more"}
            onClick={() => setMenu(menu === "more" ? null : "more")}
          >{t("More")}</button>
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
            onClick={() => void load()}
          >
            <Icon
              name="refresh"
              size={18}
              className={loading ? "spinning" : ""}
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
        {menu && menu !== "home" && menu !== "reports" && (
          <div className="header-dropdown">
            <button
              className="dropdown-close icon-button"
              aria-label={t("Tutup menu")}
              onClick={() => setMenu(null)}
            >
              <Icon name="close" size={15} />
            </button>
            {menu === "more" ? (
              <>
                <strong>{t("Workspace views")}</strong>
                {views.map((v) => (
                  <button
                    className="dropdown-item"
                    key={v.id}
                    onClick={() => changeView(v.id)}
                  >
                    <Icon name={v.icon} size={17} />
                    {t(v.label)}
                    <Icon name="chevron" size={14} />
                  </button>
                ))}
              </>
            ) : (
              <>
                <strong>{t("Monitoring help")}</strong>
                <p>{t("Buka menu Home untuk memilih List View, Map View, KPI View, atau Dashboard. Data diperbarui otomatis setiap 5 menit.")}</p>
                <p>{t("Nilai -- dan status Unknown menandakan data yang belum tersedia.")}</p>
              </>
            )}
          </div>
        )}
      </header>
      <div
        className={`view-switcher ${view === "map" ? "on-map" : ""} ${view === "overview" ? "on-overview" : ""} ${view === "monitoring" || view === "reports" ? "monitoring-hidden" : ""}`}
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
      </div>
      {view !== "map" && view !== "overview" && view !== "monitoring" && view !== "reports" && (
        <FleetSummary
          plants={plants}
          alarms={alarms}
          summary={summary}
          onStats={() => changeView("statistics")}
          onStatus={() => changeView("list")}
          now={now}
        />
      )}
      <main className={view === "reports" ? "main-reports" : view === "monitoring" ? "main-monitoring" : view === "overview" ? "main-overview" : view === "map" ? "main-map" : "main-content"}>
        {(t(error) || t(warning)) && (
          <div
            className={`connection-banner ${error ? "error-banner" : ""}`}
            role="alert"
          >
            <Icon name="info" size={18} />
            <span>
              {t(error) || t(warning)}
              {error && plants.length > 0
                ? t(" Menampilkan data terakhir yang berhasil dimuat.")
                : ""}
            </span>
            <button className="text-button" onClick={() => void load()}>{t("Coba lagi")}</button>
          </div>
        )}
        {view === "reports" && (
          <Suspense fallback={<div className="map-loading">{t("Memuat Reports…")}</div>}>
            <ReportsPage plants={plants} report={reportType} onReportChange={setReportType}
              now={now} refreshKey={updated?.getTime() ?? 0} plantsLoading={loading} />
          </Suspense>
        )}
        {view === "monitoring" && (
          <Suspense fallback={<div className="map-loading">{t("Memuat Monitoring…")}</div>}>
            <PlantMonitoring plants={plants} selected={selected} onChange={setSelected}
              now={now} refreshKey={updated?.getTime() ?? 0} />
          </Suspense>
        )}
        {view === "overview" && (
          <Suspense fallback={<div className="map-loading">{t("Memuat Dashboard…")}</div>}>
            <HomeOverview plants={plants} alarms={alarms} summary={summary} now={now} selected={selected}
              onChange={setSelected} onSelect={selectPlant} refreshKey={updated?.getTime() ?? 0} />
          </Suspense>
        )}
        {view === "list" && (
          <PlantTable
            onAdd={() => setPlantEditor({})}
            plants={plants}
            loading={loading}
            onSelect={selectPlant}
            onRefresh={() => void load()}
            now={now}
          />
        )}
        {view === "statistics" && (
          <FleetStatistics
            summary={summary}
            plants={plants}
            selected={selected}
            onChange={setSelected}
            refreshKey={updated?.getTime() ?? 0}
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
        {view !== "map" && view !== "overview" && view !== "monitoring" && view !== "reports" && (
          <footer className="app-footer">
            <span>
              <i
                className={`connection-dot ${error ? "offline" : updated ? "online" : ""}`}
              />
              {updated
                ? t(`API synced ${updated.toLocaleTimeString("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" })} WIB`)
                : t("Connecting to monitoring…")}
              <span className="footer-separator">·</span>{t("Auto-refresh 5 min")}</span>
            <span>{t("IconGreen Solar Monitoring")}<span className="footer-separator">·</span>
              {plants.length}{t(" plants")}</span>
          </footer>
        )}
      </main>
      {detail && (
        <PlantDrawer
          plant={
            plants.find((p) => p.plant_code === detail.plant_code) ?? detail
          }
          onClose={() => setDetail(null)}
          onEdit={() => {setDetail(null); setPlantEditor({plant: detail});}}
          now={now}
          onStatistics={() => {
            setDetail(null);
            changeView("statistics");
          }}
        />
      )}
      {plantEditor && <PlantAdminDialog plant={plantEditor.plant} onClose={() => setPlantEditor(null)} onSaved={(code) => {
        setPlantEditor(null); setSelected(code); void load();
      }} />}
    </div>
  );
}
