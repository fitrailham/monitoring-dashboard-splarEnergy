import { request } from "./fleet.ts";
import type { Plant } from "./fleet.ts";
export interface PlantFormValues {
  code: string; name: string; capacity: string; country: string; region: string; city: string;
  address: string; zone: string; latitude: string; longitude: string;
}
export async function savePlant(values: PlantFormValues, token: string, existingCode?: string, signal?: AbortSignal) {
  if (!token.trim()) throw new Error("Masukkan token izin tulis.");
  const capacity = Number(values.capacity);
  if (!values.capacity.trim() || !Number.isFinite(capacity) || capacity <= 0) throw new Error("Kapasitas PV harus lebih besar dari nol.");
  try { new Intl.DateTimeFormat("en", {timeZone: values.zone}); } catch { throw new Error("Timezone PLTS tidak valid."); }
  const latitude = values.latitude.trim() ? Number(values.latitude) : null, longitude = values.longitude.trim() ? Number(values.longitude) : null;
  if ((latitude === null) !== (longitude === null) || latitude !== null && (!Number.isFinite(latitude) || Math.abs(latitude) > 90) ||
      longitude !== null && (!Number.isFinite(longitude) || Math.abs(longitude) > 180)) throw new Error("Isi pasangan koordinat yang valid atau kosongkan keduanya.");
  const body = {capacity_kwp: capacity, country_code: values.country.trim().toUpperCase() || null,
    region: values.region.trim() || null, city: values.city.trim() || null, time_zone: values.zone, latitude, longitude};
  if (!existingCode && (!values.code.trim() || !values.name.trim())) throw new Error("Kode dan nama PLTS wajib diisi.");
  return request<Partial<Plant>>(existingCode ? `/api/database/plants/${encodeURIComponent(existingCode)}` : "/api/database/plants", signal, {
    method: existingCode ? "PATCH" : "POST", token: token.trim(),
    body: existingCode ? body : {...body, plant_code: values.code.trim(), plant_name: values.name.trim(), address: values.address.trim() || null},
  });
}
