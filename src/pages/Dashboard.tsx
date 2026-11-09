import {
  useEffect,
  useState,
} from "react";

import MetricCard
  from "../components/MetricCard";

import EnergyFlow
  from "../components/EnergyFlow";

import DeviceInfo
  from "../components/DeviceInfo";

import EnergyChart
  from "../components/EnergyChart";

import {
  getDashboardData,
  DashboardApiError,
} from "../services/api";


interface DashboardData {
  plantCode: string;
  plantName: string;

  pvCapacity: number | null;

  currentPvPower: number | null;

  yieldToday: number | null;
  totalYield: number | null;

  loadPower: number | null;
  gridPower: number | null;

  batteryPower: number | null;
  batterySoc: number | null;

  essChargeToday: number | null;
  essDischargeToday: number | null;
}


const PLANT_CODE =
  "NE=75907332";


function Dashboard() {

  const [
    data,
    setData,
  ] = useState<DashboardData | null>(
    null
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");


  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function refresh() {
      let delay = 5 * 60_000;
      try {
        const result = await getDashboardData(PLANT_CODE);
        if (cancelled) return;
        setData(result.data);
        setError(result.stale ? result.message || "Pembaruan tertunda." : "");
        delay = Math.max(delay, (result.retryAfterSeconds ?? 0) * 1000);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Gagal mengambil data FusionSolar");
        if (err instanceof DashboardApiError) {
          delay = Math.max(delay, err.retryAfterSeconds * 1000);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          timer = setTimeout(refresh, delay);
        }
      }
    }

    void refresh();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  if (loading) {
    return (
      <div className="center-screen">
        Loading FusionSolar...
      </div>
    );
  }


  if (error && !data) {
    return (
      <div className="center-screen error">
        {error}
      </div>
    );
  }


  if (!data) {
    return null;
  }


  return (
    <div className="dashboard">

      {/* HEADER */}

      <header className="topbar">

        <div>
          <div className="brand">
            IconGreen
          </div>

          <div className="plant-name">
            {data.plantName}
          </div>
        </div>


        <nav className="navigation">

          <button className="active">
            Overview
          </button>

          <button>
            PV
          </button>

          <button>
            ESS
          </button>

        </nav>


        <div className="clock">
          {error ? "PEMBARUAN TERTUNDA" : "UPDATE 5 MENIT"}
        </div>

      </header>


      {error && (
        <div role="status" className="update-warning">
          {error} Menampilkan data terakhir yang berhasil dimuat.
        </div>
      )}

      {/* MAIN */}

      <main className="dashboard-grid">


        {/* LEFT KPI */}

        <section className="kpi-section">

          <MetricCard
            title="Yield Today"
            value={
              data.yieldToday ??
              "--"
            }
            unit="MWh"
            icon="⚡"
          />

          <MetricCard
            title="Total Yield"
            value={
              data.totalYield ??
              "--"
            }
            unit="MWh"
            icon="⚡"
          />

          <MetricCard
            title="Energy Charged to ESS Today"
            value={
              data.essChargeToday ??
              "--"
            }
            unit="kWh"
            icon="🔋"
          />

          <MetricCard
            title="Energy Discharged from ESS Today"
            value={
              data.essDischargeToday ??
              "--"
            }
            unit="kWh"
            icon="🔋"
          />

        </section>


        {/* ENERGY FLOW */}

        <section className="flow-section">

          <EnergyFlow
            pvPower={
              data.currentPvPower
            }

            batteryPower={
              data.batteryPower
            }

            batterySoc={
              data.batterySoc
            }

            loadPower={
              data.loadPower
            }

            gridPower={
              data.gridPower
            }
          />

        </section>


        {/* RIGHT */}

        <aside className="right-section">

          <DeviceInfo
            pvCapacity={
              data.pvCapacity
            }
          />


          <div className="panel environmental-panel">

            <h3>
              Environmental Benefits
            </h3>

            <div className="environment-grid">

              <div>
                <span>⛏️</span>

                <small>
                  Standard Coal Saved
                </small>

                <strong>
                  43.679 ton
                </strong>
              </div>


              <div>
                <span>☁️</span>

                <small>
                  CO₂ Avoided
                </small>

                <strong>
                  51.869 ton
                </strong>
              </div>


              <div>
                <span>🌲</span>

                <small>
                  Equivalent Trees
                </small>

                <strong>
                  71
                </strong>
              </div>

            </div>

          </div>

        </aside>


        {/* CHART */}

        <section className="bottom-chart">

          <EnergyChart />

        </section>


        {/* REVENUE */}

        <section className="revenue-section">

          <div className="panel revenue-panel">

            <h3>
              Revenue
            </h3>

            <span>
              Total Revenue
            </span>

            <strong>
              Rp 0
            </strong>

          </div>

        </section>

      </main>

    </div>
  );
}

export default Dashboard;