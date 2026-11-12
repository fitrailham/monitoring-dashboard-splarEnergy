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
  request,
  specific,
  status,
  statusLabel,
} from "../services/fleet";
import Icon from "../components/Icon";
import type { IconName } from "../components/Icon";
import FleetSummary from "../components/FleetSummary";
import type { AlarmSummary } from "../components/FleetSummary";
import PlantTable from "../components/PlantTable";
import FleetStatistics from "../components/FleetStatistics";
import { telemetryFreshness, telemetryLabel } from "../services/quality";
const PlantMap = lazy(() => import("../components/PlantMap"));
const HomeOverview = lazy(() => import("../components/HomeOverview"));
const PlantMonitoring = lazy(() => import("../components/PlantMonitoring"));

type View = "overview" | "list" | "map" | "statistics" | "monitoring";
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
}: {
  plant: Plant;
  onClose: () => void;
  onStatistics: () => void;
  now: number;
}) {
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
          <span className="eyebrow">PLANT OVERVIEW</span>
          <button
            className="icon-button"
            aria-label="Tutup detail PLTS"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>
        <img
          className="drawer-photo"
          src="/solar-plant.svg"
          alt="Ilustrasi instalasi panel surya"
        />
        <div className="drawer-title">
          <h2 id="plant-detail-title">{plant.plant_name}</h2>
          <span className={`status-label ${status(plant)}`}>
            <i className={`status-dot ${status(plant)}`} />
            {statusLabel[status(plant)]}
          </span>
        </div>
        <p className="plant-code">{plant.plant_code}</p>
        <p className="drawer-address">
          <Icon name="pin" size={17} />
          {plant.address || "Alamat belum tersedia"}
        </p>
        <div className={`telemetry-detail ${freshness.state}`}>
          <strong>{telemetryLabel(freshness)}</strong>
          <span>{freshness.measuredAt
            ? `${freshness.state === "unverified" ? "Timestamp belum terverifikasi" : "Waktu pengukuran"}: ${new Date(freshness.measuredAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`
            : "Waktu collector belum membuktikan waktu pengukuran perangkat."}</span>
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
              <span>{m.label}</span>
              <strong>
                {format(m.value)} <small>{m.unit}</small>
              </strong>
            </div>
          ))}
        </div>
        <div className="detail-note">
          <Icon name="info" size={17} />
          <p>
            Nilai -- berarti data belum tersedia.
            {plant.timestamp_source === "collector" &&
              " Waktu pengukuran belum terverifikasi; timestamp berasal dari collector."}
          </p>
        </div>
        <button className="primary detail-stats-button" onClick={onStatistics}>
          View yield statistics
          <Icon name="arrow" size={17} />
        </button>
      </aside>
    </div>
  );
}

export default function PortfolioDashboard() {
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
    [menu, setMenu] = useState<"home" | "help" | "more" | "user" | null>(null),
    [alarms, setAlarms] = useState<AlarmSummary>(emptyAlarms);
  const homeNavigation = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (menu !== "home") return;
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !homeNavigation.current?.contains(event.target))
        setMenu(null);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setMenu(null);
      homeNavigation.current?.querySelector<HTMLButtonElement>("button")?.focus();
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menu]);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const result = await getFleet(signal);
      if (signal?.aborted) return;
      setPlants(result.plants);
      setWarning(result.warning);
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
  useEffect(() => {
    const controller = new AbortController();
    if (!plants.length) return () => controller.abort();
    void (async () => {
      const counts = [0, 0, 0, 0, 0];
      let coverage = 0;
      for (let index = 0; index < plants.length; index += 4) {
        if (controller.signal.aborted) return;
        await Promise.all(
          plants.slice(index, index + 4).map(async (p) => {
            try {
              const result = await request<
                { severity?: string; level?: string }[]
              >(
                `/api/alarms/${encodeURIComponent(p.plant_code)}`,
                controller.signal,
              );
              if (!result.configured || !Array.isArray(result.data)) return;
              coverage++;
              for (const alarm of result.data) {
                const severity = String(
                  alarm.severity ?? alarm.level ?? "",
                ).toLowerCase();
                const slot = ["critical", "major", "minor", "warning"].indexOf(
                  severity,
                );
                counts[slot < 0 ? 4 : slot]++;
              }
            } catch {
              /* Missing alarm coverage stays explicitly unavailable. */
            }
          }),
        );
      }
      if (!controller.signal.aborted)
        setAlarms({
          available: coverage > 0,
          counts,
          coverage,
          totalPlants: plants.length,
        });
    })();
    return () => controller.abort();
  }, [plants]);
  const selectPlant = useCallback((plant: Plant) => {
    setDetail(plant);
    setSelected(plant.plant_code);
  }, []);
  function changeView(next: View) {
    setView(next);
    setMenu(null);
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
          aria-label="IconGreen home"
        >
          <img
            className="brand-logo-image"
            src="/icongreen-logo.png"
            alt="IconGreen — Member of PLN Group"
            width="1600"
            height="642"
          />
        </a>
        <span className="header-divider" />
        {/* <span className="product-name">FusionSolar</span> */}
        <button
          className="header-home"
          aria-label="Home"
          onClick={() => changeView("overview")}
        >
          <Icon name="home" size={23} />
        </button>
        <nav className="main-nav" aria-label="Main navigation">
          <div
            className="home-navigation"
            ref={homeNavigation}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget))
                setMenu((current) => current === "home" ? null : current);
            }}
          >
            <button
              className={view !== "monitoring" || menu === "home" ? "active" : ""}
              aria-expanded={menu === "home"}
              aria-controls="home-views"
              onClick={() => setMenu(menu === "home" ? null : "home")}
            >
              Home
            </button>
            {menu === "home" && (
              <div id="home-views" className="home-dropdown" role="group" aria-label="Tampilan Home">
                <strong><Icon name="home" size={18} />Home</strong>
                {views.map((item) => (
                  <button
                    key={item.id}
                    aria-current={view === item.id ? "page" : undefined}
                    onClick={() => changeView(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            className={view === "monitoring" ? "active" : ""}
            onClick={() => changeView("monitoring")}
          >
            Monitoring
          </button>
          <button onClick={() => changeView("statistics")}>Reports</button>
          <button disabled title="Fitur operasi bisnis belum tersedia">
            Business Operation
          </button>
          <button onClick={() => changeView("list")}>Plants</button>
          <button
            aria-expanded={menu === "more"}
            onClick={() => setMenu(menu === "more" ? null : "more")}
          >
            More
          </button>
        </nav>
        <div className="header-utilities">
          <button
            className="smart-design"
            disabled
            title="SmartDesign belum tersedia"
          >
            SmartDesign
          </button>
          <button
            aria-label="Refresh monitoring"
            title="Refresh monitoring"
            onClick={() => void load()}
          >
            <Icon
              name="refresh"
              size={18}
              className={loading ? "spinning" : ""}
            />
          </button>
          <button
            aria-label="Buka laporan yield"
            title="Yield reports"
            onClick={() => changeView("statistics")}
          >
            <Icon name="calendar" size={19} />
          </button>
          <span className="language">
            <Icon name="globe" size={21} />
            English
          </span>
          <button
            className="account-button"
            aria-expanded={menu === "user"}
            onClick={() => setMenu(menu === "user" ? null : "user")}
          >
            <Icon name="user" size={19} />
            <span>IconGreenTWH</span>
          </button>
          <button
            aria-label="Bantuan dashboard"
            aria-expanded={menu === "help"}
            onClick={() => setMenu(menu === "help" ? null : "help")}
          >
            <Icon name="help" size={21} />
          </button>
        </div>
        {menu && menu !== "home" && (
          <div className="header-dropdown">
            <button
              className="dropdown-close icon-button"
              aria-label="Tutup menu"
              onClick={() => setMenu(null)}
            >
              <Icon name="close" size={15} />
            </button>
            {menu === "more" ? (
              <>
                <strong>Workspace views</strong>
                {views.map((v) => (
                  <button
                    className="dropdown-item"
                    key={v.id}
                    onClick={() => changeView(v.id)}
                  >
                    <Icon name={v.icon} size={17} />
                    {v.label}
                    <Icon name="chevron" size={14} />
                  </button>
                ))}
              </>
            ) : menu === "help" ? (
              <>
                <strong>Monitoring help</strong>
                <p>
                  Buka menu Home untuk memilih List View, Map View, KPI View,
                  atau Dashboard. Data diperbarui otomatis setiap 5 menit.
                </p>
                <p>
                  Nilai -- dan status Unknown menandakan data yang belum
                  tersedia.
                </p>
              </>
            ) : (
              <>
                <strong>IconGreenTWH</strong>
                <p>Solar monitoring workspace</p>
                <span className="read-only-badge">Monitoring access</span>
              </>
            )}
          </div>
        )}
      </header>
      <div
        className={`view-switcher ${view === "map" ? "on-map" : ""} ${view === "overview" ? "on-overview" : ""} ${view === "monitoring" ? "monitoring-hidden" : ""}`}
        role="group"
        aria-label="Dashboard view"
      >
        {views.map((v) => (
          <button
            key={v.id}
            title={v.label}
            aria-label={v.label}
            aria-pressed={view === v.id}
            className={view === v.id ? "active" : ""}
            onClick={() => changeView(v.id)}
          >
            <Icon name={v.icon} size={17} />
          </button>
        ))}
      </div>
      {view !== "map" && view !== "overview" && view !== "monitoring" && (
        <FleetSummary
          plants={plants}
          alarms={alarms}
          onStats={() => changeView("statistics")}
          onStatus={() => changeView("list")}
          now={now}
        />
      )}
      <main className={view === "monitoring" ? "main-monitoring" : view === "overview" ? "main-overview" : view === "map" ? "main-map" : "main-content"}>
        {(error || warning) && (
          <div
            className={`connection-banner ${error ? "error-banner" : ""}`}
            role="alert"
          >
            <Icon name="info" size={18} />
            <span>
              {error || warning}
              {error && plants.length > 0
                ? " Menampilkan data terakhir yang berhasil dimuat."
                : ""}
            </span>
            <button className="text-button" onClick={() => void load()}>
              Coba lagi
            </button>
          </div>
        )}
        {view === "monitoring" && (
          <Suspense fallback={<div className="map-loading">Memuat Monitoring…</div>}>
            <PlantMonitoring plants={plants} selected={selected} onChange={setSelected}
              now={now} refreshKey={updated?.getTime() ?? 0} />
          </Suspense>
        )}
        {view === "overview" && (
          <Suspense fallback={<div className="map-loading">Memuat Dashboard…</div>}>
            <HomeOverview plants={plants} alarms={alarms} now={now} selected={selected}
              onChange={setSelected} onSelect={selectPlant} refreshKey={updated?.getTime() ?? 0} />
          </Suspense>
        )}
        {view === "list" && (
          <PlantTable
            plants={plants}
            loading={loading}
            onSelect={selectPlant}
            onRefresh={() => void load()}
            now={now}
          />
        )}
        {view === "statistics" && (
          <FleetStatistics
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
                <span>Loading map…</span>
              </div>
            }
          >
            <PlantMap plants={plants} onSelect={selectPlant} />
          </Suspense>
        )}
        {view !== "map" && view !== "overview" && view !== "monitoring" && (
          <footer className="app-footer">
            <span>
              <i
                className={`connection-dot ${error ? "offline" : updated ? "online" : ""}`}
              />
              {updated
                ? `API synced ${updated.toLocaleTimeString("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" })} WIB`
                : "Connecting to monitoring…"}
              <span className="footer-separator">·</span>Auto-refresh 5 min
            </span>
            <span>
              IconGreen Solar Monitoring
              <span className="footer-separator">·</span>
              {plants.length} plants
            </span>
          </footer>
        )}
      </main>
      {detail && (
        <PlantDrawer
          plant={
            plants.find((p) => p.plant_code === detail.plant_code) ?? detail
          }
          onClose={() => setDetail(null)}
          now={now}
          onStatistics={() => {
            setDetail(null);
            changeView("statistics");
          }}
        />
      )}
    </div>
  );
}
