const API_URL = (
  import.meta.env.VITE_API_URL?.trim() || "http://127.0.0.1:8000"
).replace(/\/+$/, "");

interface PlantRow {
  plant_code: string;
  plant_name: string;
  capacity_kwp: number | string | null;
  recorded_at: string | null;
  pv_power_kw: number | string | null;
  load_power_kw: number | string | null;
  grid_power_kw: number | string | null;
  yield_today_kwh: number | string | null;
  total_yield_kwh: number | string | null;
  battery_power_kw: number | string | null;
  battery_soc_percent: number | string | null;
  ess_charge_today_kwh: number | string | null;
  ess_discharge_today_kwh: number | string | null;
}

export class DashboardApiError extends Error {
  retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds = 0) {
    super(message);
    this.name = "DashboardApiError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function toNumber(value: number | string | null): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function getDashboardData(plantCode: string) {
  console.log("[API 1/4] Connecting to PostgreSQL backend...");

  const response = await fetch(`${API_URL}/api/database/overview`).catch(() => {
    throw new DashboardApiError(
      `Backend tidak dapat dihubungi di ${API_URL}. Jalankan backend atau atur VITE_API_URL di .env.`
    );
  });

  console.log("[API 2/4] HTTP Status:", response.status);

  if (!response.ok) {
    throw new DashboardApiError(
      `Database API HTTP ${response.status}`
    );
  }

  const result = await response.json();

  if (!result.success || !Array.isArray(result.data)) {
    throw new DashboardApiError(
      result.message || "Invalid database response"
    );
  }

  console.log("[API 3/4] Total plants:", result.data.length);

  const plant: PlantRow | undefined = result.data.find(
    (item: PlantRow) => item.plant_code === plantCode
  );

  if (!plant) {
    throw new DashboardApiError(
      `Plant ${plantCode} tidak ditemukan di database`
    );
  }

  // Yield disimpan dalam kWh, dashboard menggunakan MWh.
  const yieldToday = toNumber(plant.yield_today_kwh);
  const totalYield = toNumber(plant.total_yield_kwh);

  const data = {
    plantCode: plant.plant_code,
    plantName: plant.plant_name,

    pvCapacity: toNumber(plant.capacity_kwp),
    currentPvPower: toNumber(plant.pv_power_kw),

    yieldToday: yieldToday === null ? null : yieldToday / 1000,
    totalYield: totalYield === null ? null : totalYield / 1000,

    loadPower: toNumber(plant.load_power_kw),
    gridPower: toNumber(plant.grid_power_kw),

    batteryPower: toNumber(plant.battery_power_kw),
    batterySoc: toNumber(plant.battery_soc_percent),

    essChargeToday: toNumber(plant.ess_charge_today_kwh),
    essDischargeToday: toNumber(plant.ess_discharge_today_kwh),
  };

  console.log("[API 4/4] ✅ Dashboard data ready:", data);

  return {
    data,
    stale: false,
    message: "",
    retryAfterSeconds: 0,
  };
}
