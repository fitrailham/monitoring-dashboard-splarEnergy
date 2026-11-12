# Kebutuhan API backend untuk IconGreen Solar Monitoring

> Pembaruan 12 November 2026: beberapa endpoint yang disebut sebagai usulan dalam
> dokumen ini sudah terdaftar pada Swagger backend aktif. Lihat
> [checklist pengembangan backend](backend-development-checklist.md) untuk status
> terbaru, kebutuhan tab Monitoring, pertimbangan database, dan informasi development.
> Contoh kontrak dalam dokumen ini tetap harus dicocokkan dengan implementasi aktual.

Dokumen ini menjelaskan kebutuhan data frontend, usulan kontrak endpoint, arti
metrik, prioritas integrasi, dan kriteria penerimaan FE-BE. Rincian hasil audit
backend aktual serta metadata operasional disimpan lokal dan tidak dipublikasikan.

[Contoh request dan response JSON](backend-api-contract.examples.json) berisi
11 skenario endpoint dan 4 respons error. Semua nilainya merupakan fixture
ilustratif, bukan data produksi. Kontrak usulan belum diterapkan otomatis pada
backend maupun frontend.

Kebutuhan integrasi dibagi menjadi pemetaan metadata yang tersedia, kelengkapan
telemetry dan kualitas waktu, serta endpoint agregasi/statistik dan administrasi.
Peta memerlukan koordinat pada metadata PLTS yang dibacanya. Jika koordinat hanya
tersedia pada inventory perangkat, BE dapat menormalisasikannya di tingkat PLTS
setelah memverifikasi sumber dan konsistensi lokasinya.

## 1. Kebutuhan per komponen tampilan

| Komponen | Field/hasil yang diperlukan | Pekerjaan BE | Pekerjaan FE setelah kontrak disepakati |
|---|---|---|---|
| Current power | `pv_power_kw`, waktu pengukuran, freshness/coverage | Ambil daya aktual dari sumber yang benar | Format kW menjadi MW dan tampilkan cakupan |
| Yield today/total | `yield_today_kwh`, `total_yield_kwh`, tanggal bisnis | Tegaskan timezone dan arti counter | Format MWh/GWh, tanpa mengubah raw precision |
| Inverter rated power pada referensi | `inverter_rated_power_kw` | Sediakan daya nominal AC dari inventory resmi | Ganti kartu Installed PV capacity jika ingin sama persis referensi |
| Rated ESS capacity | `ess_rated_capacity_kwh`, `has_ess` | Pemetaan inventory dan kapasitas nameplate | Tampilkan kWh/MWh; jangan menyimpulkan keberadaan ESS dari SOC |
| Revenue today | `revenue_today_idr`, basis/metode/tarif | Hitung sesuai kontrak bisnis; pisahkan pendapatan dan penghematan | Format mata uang dan jelaskan basis nilai |
| Plant status | `status`, `status_source`, `status_reason`, `last_seen_at` | Definisikan status dari kesehatan/komunikasi sumber | Warna dan donut berdasarkan status BE |
| Active alarms | severity, state active/cleared, configured, coverage | Aktifkan kolektor alarm dan agregasi portofolio | Gunakan total dan severity yang dinormalisasi |
| Plant image | `image_url` | Sediakan URL foto, atau null | Gunakan foto jika tersedia, ilustrasi sebagai fallback |
| Country/region | `country_code`, `country_name`, `region`, `city` | Pisahkan metadata lokasi dari address bebas | Hapus teks Indonesia yang saat ini tetap; filter berdasarkan metadata |
| Grid connection | `grid_connected_on` | Sediakan tanggal koneksi jaringan/commissioning yang tepat | Tampilkan tanggal; jangan memakai tanggal pertama collector |
| Total String... pada referensi | Definisi kolom perlu dipastikan | Sepakati apakah kapasitas string kWp atau jumlah string | Label dan unit mengikuti arti yang disepakati |
| Optimizer quantity | `optimizer_quantity` integer/null | Agregasi inverter yang relevan; bedakan 0 dan unknown | Ganti placeholder tabel |
| Battery pada tabel | `has_ess`, jumlah ESS, kapasitas; SOC sebagai field terpisah | Definisikan arti kolom Battery | Jangan otomatis menyamakan Battery dengan SOC |
| Device type/SN filter | `device_types`, normalized inventory, filter server | Normalisasi tipe dan serial | Tambahkan filter SN dan gunakan has_ess, bukan SOC non-null |
| Specific energy | `specific_energy_kwh_per_kwp` atau yield/capacity valid | Validasi pembagi dan kelengkapan periode | Ranking dan nilai tabel konsisten |
| Performance ratio | `performance_ratio_percent`, energi AC, irradiation POA, periode/coverage | Hitung PR dengan basis pengukuran yang disepakati | Tambahkan kolom PR; nilai unknown tetap -- |
| Peta | `latitude`, `longitude`, `location_source`, `location_verified` | Petakan kandidat koordinat perangkat menjadi lokasi PLTS | Marker dan pengelompokan marker, tanpa request inventory tambahan per PLTS |
| Yield statistics | Energi per interval + batas waktu + kelengkapan | Agregasi di server, bukan hanya 500 rekaman terakhir | Grafik per jam/hari/bulan/tahun sesuai response |
| Ranking | Yield dan kapasitas valid pada tanggal/lingkup yang sama | Urutkan di server, laporkan exclusions | Tampilkan ranking tanpa bias kapasitas atau data hilang |
| Environmental benefits | Energi eligible, nilai hasil, faktor dan metode berversi | Konfigurasi faktor yang disetujui | Tampilkan hasil beserta satuan/metode |
| Add Plant | POST, validasi, response 201 dan error konflik | Registrasi konfigurasi PLTS lokal | Aktifkan form dan tombol setelah endpoint siap |

## 2. Aturan kontrak data bersama

- Base URL development tetap `http://127.0.0.1:8000`; GET menggunakan query/path,
  **tanpa JSON request body**. POST/PATCH menggunakan `Content-Type: application/json`.
- Usulan memakai `snake_case` dan satuan di nama field. API saat ini bercampur
  snake_case pada overview dan camelCase pada dashboard/devices. Hindari rename
  mendadak: tambahkan field normalisasi atau buat versi API baru lalu migrasikan FE.
- Nilai numerik berupa JSON number atau null; jangan kirim `"--"`, angka berformat
  ribuan, `"NaN"`, atau `"974,68"`. Nomor seri/kode/ID perangkat sebaiknya string.
- `0` = nilai yang benar-benar diketahui nol. `null` = belum diketahui/tidak tersedia.
  `has_ess: false` membedakan tidak terpasang dari perangkat terpasang tetapi telemetry kosong.
  Field null yang wajib dalam kontrak tetap dikirim sebagai null, bukan hilang acak.
- Satuan dasar: daya kW, kapasitas PV DC kWp, nominal inverter AC kW, energi/kapasitas ESS
  kWh, SOC/PR persen 0–100 untuk SOC; PR jangan dipaksa menjadi 100 jika hasil perlu investigasi.
  Tampilan MW/MWh/GWh adalah format FE, bukan perubahan unit diam-diam pada API.
- Simpan raw precision; pembulatan untuk tampilan dilakukan FE. Pastikan setiap endpoint
  menjelaskan unitnya dan tidak membulatkan data sebelum dikirim ke FE.
- Timestamp harus RFC 3339 dengan offset atau Z. `measured_at` = waktu pengukuran sumber;
  `collected_at` = waktu collector menerima/mengambil data; `generated_at` = response dibuat.
  `recorded_at` lama boleh dipertahankan sebagai alias terdokumentasi untuk kompatibilitas.
- `measurement_time_verified: false` bila waktu sumber belum dapat dibuktikan. Jangan
  mengisi measured_at dari waktu collector agar data tampak baru.
- Metadata `time_zone` PLTS memakai zona IANA yang benar. Tanggal yield harian harus
  punya definisi eksplisit. Bali dan PLTS lain jangan otomatis disamakan dengan WIB.
  Untuk laporan portofolio lintas zona, BE harus menyediakan agregasi pada timezone
  permintaan atau menjelaskan bahwa nilainya menjumlahkan hari lokal masing-masing PLTS.
- Summary dan tabel memakai scope akses, filter, dan snapshot yang jelas. Total portofolio
  tidak dihitung dari satu halaman hasil pagination. Jangan mencampur snapshot tanpa penanda.
- Cakupan agregasi harus tersedia per KPI: jumlah expected, valid, missing, stale,
  unverified, dan not_applicable. Sebuah angka total parsial harus ditandai partial.
  Jika tidak ada nilai valid, hasil agregat null; jangan berubah menjadi 0.
- Frontend melakukan refresh 5 menit. Usulan expected interval 300 detik dan stale
  threshold 900 detik pada contoh hanya ilustrasi; BE menentukan nilai per sumber/metric.
- Respons error harus memakai status HTTP yang tepat dan kode error stabil. Jika
  cache valid/parsial masih dikembalikan, boleh HTTP 200 success true dengan quality
  stale/partial. HTTP 503 dipakai bila permintaan tidak dapat dilayani dan tidak ada
  data fallback yang dapat digunakan.

### Status operasional dan kualitas data adalah dua hal berbeda

Enum status: `normal | faulty | disconnected | unknown`.

Usulan prioritas: komunikasi benar-benar diketahui terputus -> disconnected;
komunikasi ada tetapi health/fault aktif -> faulty; health dan komunikasi diketahui
normal -> normal; bukti belum cukup -> unknown. Dasar fault dan prioritas akhir
harus disepakati BE sesuai status sumber yang tersedia.

Daya PV 0 pada malam hari bukan bukti disconnected. Collector baru berjalan bukan
bukti perangkat baru mengirim measurement. Alarm configured false bukan bukti tidak
ada fault. `data_quality.state` terpisah: `fresh | stale | partial | missing | unverified`.
`field_quality`/`missing_fields` dapat menjelaskan masalah per metrik, termasuk
`NOT_INSTALLED`, `SOURCE_UNSUPPORTED`, `SOURCE_UNAVAILABLE`, `TIME_UNVERIFIED`.

## 3. Endpoint yang perlu disediakan/dilengkapi

### A. GET /api/database/plants dan GET /api/database/plants/{plant_code}

**Status:** sudah ada; perlu penambahan metadata.

Tambahkan country/region/city/time_zone, latitude/longitude, sumber dan verifikasi lokasi,
foto, tanggal grid connection, has_pv/has_ess, kapasitas ESS, nominal inverter, jumlah optimizer,
jenis/jumlah perangkat. Contoh lengkap: `endpoints.plants` dan `endpoints.plant_detail`
pada file JSON pendamping.

Aturan pemetaan koordinat:

1. Gunakan lokasi PLTS terverifikasi jika ada.
2. Jika belum ada, gunakan kandidat koordinat perangkat yang terkait plant_code.
3. Jangan mengambil perangkat pertama secara sembarang bila koordinat berbeda. Tandai
   konflik dan pilih aturan/calon yang dapat diverifikasi. Koordinat (0,0) harus diperiksa
   jika sumber memakainya sebagai sentinel, bukan otomatis dianggap lokasi terverifikasi.
4. Expose `location_source` dan `location_verified`. Metadata inventory yang lama
   tidak boleh digunakan sebagai bukti freshness telemetry.

### B. GET /api/database/overview

**Status:** sudah ada; menjadi sumber baris tabel yang telah digabung dengan metadata.

Usulan query opt-in:

| Parameter | Tipe | Arti |
|---|---|---|
| `search` | string | Nama atau kode PLTS |
| `country_code`, `region` | string | Filter lokasi metadata |
| `device_type` | enum | Contoh inverter, ess, meter |
| `device_sn` | string | Cari SN perangkat dan kembalikan PLTS pemiliknya |
| `status` | enum | normal/faulty/disconnected/unknown |
| `page` | integer >= 1 | Default pada mode paginated: 1 |
| `page_size` | integer 1–100 | Contoh 10; batas maksimum usulan 100 |
| `sort` | enum | plant_name, capacity_kwp, pv_power_kw, yield_today_kwh, total_yield_kwh, specific_energy_kwh_per_kwp |
| `order` | asc/desc | Sorting server yang stabil, plant_code sebagai tie-breaker |

GET contoh:

```text
/api/database/overview?page=1&page_size=10&search=Contoh&country_code=ID&device_type=ess&sort=yield_today_kwh&order=desc
```

Response ringkas **ilustratif**:

```json
{
  "success": true,
  "total": 1,
  "data": [
    {
      "plant_code": "PLANT-DEMO-001",
      "plant_name": "PLTS Contoh",
      "capacity_kwp": 100,
      "status": "normal",
      "pv_power_kw": 75,
      "yield_today_kwh": 500,
      "total_yield_kwh": 123456.7,
      "battery_soc_percent": 65,
      "specific_energy_kwh_per_kwp": 5,
      "data_quality": {
        "state": "fresh",
        "measured_at": "2026-11-09T08:55:00Z",
        "collected_at": "2026-11-09T08:56:00Z",
        "measurement_time_verified": true,
        "age_seconds": 300,
        "stale_after_seconds": 900
      }
    }
  ],
  "meta": {
    "page": 1,
    "page_size": 10,
    "total_pages": 1,
    "snapshot_id": "snapshot-example-001",
    "is_partial": false
  }
}
```

Field lengkap termasuk metadata, arah daya, PR, dan coverage ada pada `endpoints.overview`.
`total` adalah seluruh hasil filter sebelum pagination; `data.length` adalah jumlah
baris halaman tersebut. Filter perangkat memakai inventory, bukan menguji SOC non-null.

**Kompatibilitas:** frontend sekarang meminta overview tanpa pagination dan menghitung
portofolio dari seluruh baris. Jangan mengganti default menjadi 10 baris sebelum FE
beralih ke server pagination dan endpoint summary. Pertahankan perilaku lama untuk
request tanpa page/page_size, atau gunakan versi API baru untuk kontrak paginated.

### C. GET /api/portfolio/summary

**Status:** usulan endpoint baru, prioritas tinggi.

Query: `date=YYYY-MM-DD`, `time_zone=Asia/Jakarta`, dan filter scope lokasi/status bila
memang summary harus mengikuti filter tabel. GET tidak memiliki body.

Response `data`:

- `total_plants`.
- `kpis`: current_power_kw, yield_today_kwh, total_yield_kwh,
  installed_pv_capacity_kwp, inverter_rated_power_kw, ess_rated_capacity_kwh,
  revenue_today_idr, currency.
- `plant_status`: jumlah normal, faulty, disconnected, unknown; jumlahnya sama
  dengan total_plants untuk scope yang sama.
- `active_alarms`: total dan jumlah setiap severity, configured/unconfigured/failed
  plants, complete. Hitung semua alarm aktif; acknowledgment bukan cleared.
- `coverage`: cakupan per metric; total parsial diberi meta.is_partial.
- `environmental_benefits` dan `revenue`: hasil serta metadata metodologi.

Contoh lengkap ada pada `endpoints.portfolio_summary`. Endpoint ini menghindari FE
memanggil alarm satu per satu ke seluruh PLTS dan menjumlahkan data yang mungkin
berbeda waktu atau sudah dipagination.

### D. GET /api/database/yield-statistics

**Status:** usulan baru. Riwayat mentah lama tetap dapat dipakai untuk troubleshooting.

```text
/api/database/yield-statistics?plant_code=PLANT-DEMO-001&from=2026-11-07T17%3A00%3A00Z&to=2026-11-08T17%3A00%3A00Z&grain=hour&time_zone=Asia%2FJakarta
```

| Parameter | Arti |
|---|---|
| `plant_code` | Opsional; kosong berarti semua PLTS dalam scope akses, bukan plant default tersembunyi |
| `from`, `to` | Timestamp batas interval; from inklusif, to eksklusif; to harus lebih besar |
| `grain` | hour/day/month/year |
| `time_zone` | Zona untuk menentukan batas bucket kalender; timestamp response tetap offset-aware |

Response memakai `aggregation: interval_energy`, unit kWh, dan array `buckets`:

```json
{
  "start_at": "2026-11-08T05:00:00Z",
  "end_at": "2026-11-08T06:00:00Z",
  "label": "12:00",
  "yield_kwh": 200,
  "quality": "measured",
  "received_samples": 12,
  "expected_samples": 12,
  "reason": null
}
```

Itu contoh satu bucket; response lengkap 24 bucket berada pada
`endpoints.yield_statistics.response`. Bucket hilang memiliki yield_kwh null dan
quality missing, bukan 0. Bucket mendatang dapat diberi quality pending dan tidak
dihitung sebagai kehilangan telemetry pada coverage interval yang belum berlalu.

**Perbedaan penting:** yield_today adalah counter kumulatif harian. Grafik frontend
saat ini menampilkan pembacaan kumulatif terakhir setiap jam dan menuliskan label itu
secara eksplisit. Grafik produksi per jam seperti referensi harus memakai **energi
pada interval jam tersebut**, bukan counter kumulatif yang langsung diplot.

BE sebaiknya memakai energi interval native jika tersedia. Jika dihitung dari
selisih counter, tangani baseline sebelum interval, reset harian/counter reset,
perubahan counter, pembacaan ganda, timezone, dan interval yang bolong. Jangan
menginterpolasi tanpa penanda estimasi. Maksimum counter harian dari sebagian sampel
adalah batas data yang tersedia, bukan jaminan total produksi hari lengkap.

Day -> hour; Month -> day; Year -> month; Lifetime -> year atau rentang tahun
tertentu. Metadata complete/coverage diperlukan agar 500 rekaman terakhir tidak
dianggap sebagai seluruh lifetime. Batas rentang per grain dapat divalidasi 422;
respons harus mengakui truncation jika ada pembatasan, bukan diam-diam memotong data.

### E. GET /api/database/rankings

**Status:** usulan baru untuk ranking server konsisten.

```text
/api/database/rankings?date=2026-11-09&metric=specific_energy&limit=5&time_zone=Asia/Jakarta
```

Balikan: rank, plant_code, plant_name, yield_kwh, capacity_kwp,
specific_energy_kwh_per_kwp, quality; metadata eligible_plants, excluded_plants,
dan alasan eksklusi. Contoh: `endpoints.rankings`.

Rumus specific energy = yield kWh / kapasitas PV kWp. Kapasitas harus > 0 dan yield
harus tersedia pada periode yang sama. Kualitas stale/unverified ditangani dengan
kebijakan eksplisit, bukan dianggap fresh. Ranking hanya membandingkan periode dan
coverage yang layak dibandingkan; tie-breaker stabil memakai plant_code.

### F. GET /api/devices/{plant_code}

**Status:** sudah ada dan bermanfaat; perlu adapter normalisasi jika dipakai FE baru.

| Field sekarang | Field usulan | Catatan |
|---|---|---|
| `devDn`/`id` | `device_id` string | Tentukan satu ID stabil untuk lookup |
| `esnCode` | `device_sn` | Pertahankan string dan leading zero |
| `devName` | `device_name` | Nama tampilan |
| `devTypeId` | `vendor_device_type_id` + `device_type` | Mapping vendor diverifikasi di BE |
| `optimizerNumber` | `optimizer_quantity` | 0 valid; null unknown/tidak relevan |
| `stationCode` | `plant_code` | Kode pemilik perangkat |
| latitude/longitude | latitude/longitude | Sumber kandidat lokasi PLTS |
| belum ada | `rated_ac_power_kw`, `rated_energy_kwh`, status/last_seen_at | Dari inventory/telemetry resmi, jangan parsing nama model |

Contoh: `endpoints.devices`. Normalisasi field bukan berarti kontrak lama boleh
dihapus mendadak; gunakan alias atau versi baru selama migrasi. Untuk optimizer
PLTS, jumlahkan hanya perangkat yang relevan dan laporkan data parsial jika
sebagian inverter yang seharusnya punya field itu belum diketahui.

### G. GET /api/alarms/{plant_code} dan GET /api/alarms

**Status:** route per PLTS sudah ada tetapi perlu mendefinisikan configured/coverage secara eksplisit; route fleet usulan.

Kontrak alarm minimal: alarm_id, vendor_alarm_id, plant_code, device_id/device_sn,
severity `critical | major | minor | warning | unclassified`, state `active | cleared`,
acknowledged boolean, name/description, occurred_at, cleared_at.

Query fleet: plant_code opsional, severity, state, page, page_size. `total`
menunjukkan total hasil filter, bukan panjang array halaman. Summary menghitung
**seluruh alarm active** terlepas dari halaman daftar alarm.

Pembedaan yang wajib:

- configured true + total 0 + data []: kolektor sudah aktif dan tidak ada alarm sesuai filter.
- configured false + total null + data []: belum dikonfigurasi, jumlah belum diketahui.
- kolektor gagal atau hasil stale: tampilkan konfigurasi, collected_at, quality dan
  coverage; jangan mereset angka menjadi 0 agar terlihat sehat.

Contoh ketiganya sebagian direpresentasikan pada `endpoints.alarms_configured`,
`endpoints.alarms_unconfigured`, dan `endpoints.fleet_alarms`. Perubahan total menjadi
nullable perlu masuk response_model dan diuji terhadap consumer lama. FE saat ini
mengabaikan jumlah jika configured false, jadi perilaku unknown tetap konsisten.

### H. POST /api/database/plants — opsional sampai Add Plant diaktifkan

**Status:** belum tersedia. Fungsinya mendaftarkan konfigurasi PLTS ke monitoring
lokal; jangan mengartikan endpoint ini otomatis membuat PLTS baru pada FusionSolar.

Request JSON pada `endpoints.register_plant.request_body`: plant_code, plant_name,
country_code, region/city/address, time_zone, capacity_kwp, latitude/longitude,
grid_connected_on. Hanya field master yang boleh ditulis; telemetry dan alarm
bukan input form Add Plant.

Balikan sukses HTTP 201 dengan data master yang tersimpan. Validasi: plant_code
unik dan valid untuk sumber yang dipilih; capacity_kwp positif untuk PV terpasang;
latitude -90..90; longitude -180..180; pasangan koordinat harus bersama-sama terisi
atau null; timezone valid; tanggal sesuai format. Gunakan 409 untuk duplikasi dan
422 untuk input tidak valid. Operasi ini membutuhkan izin tulis yang eksplisit
pada sistem backend. Contoh error ada pada JSON pendamping.

## 4. Semantik metrik yang perlu disepakati

### Arah daya

Tetapkan konvensi. Usulan: grid_power_kw positif = impor dari jaringan, negatif =
ekspor; battery_power_kw positif = discharge, negatif = charge. BE boleh memilih
konvensi lain, tetapi harus didokumentasikan dan konsisten di history/overview.
Jika sumber hanya menyediakan import/export terpisah, simpan keduanya dan gunakan
net hanya jika pemetaan tanda sudah disetujui.

### Performance ratio

PR berbeda dari specific energy. Untuk basis energi PV AC yang disepakati:

```text
Yf = E_ac_kwh / P_dc_kwp
Yr = H_poa_kwh_m2 / G_ref_kw_m2
PR_percent = (Yf / Yr) * 100
G_ref = 1 kW/m²
```

Butuh energi, daya nameplate PV, dan irradiation pada bidang panel untuk periode
identik. `irradiance_w_m2` sesaat bukan pengganti `irradiation_kwh_m2` terintegrasi.
Untuk sistem dengan self-consumption/storage, batas energi yang dipakai harus jelas;
jangan otomatis menyamakan ekspor jaringan dengan seluruh energi PV. Sensor EMI
ada pada inventory contoh, tetapi inventory saja belum menyediakan deret pengukuran
irradiance. Jika data belum ada, PR null. Portofolio PR jangan memakai rata-rata
sederhana persentase tiap PLTS tanpa metode pembobotan yang benar.
Rujukan definisi dan variasi batas sistem: [PVsyst](https://www.pvsyst.com/help/project-design/results/performance-ratio-pr.html).

### Pendapatan dan penghematan

Sepakati label bisnis: pendapatan ekspor, penghematan pemakaian sendiri, atau manfaat
energi gabungan. Data perlu mencakup energi eligible dan tarif berversi beserta masa
berlaku. Hitung di BE; jangan menggunakan tarif asumsi FE atau mengalikan seluruh
yield dengan satu tarif tanpa mengetahui energi eligible. Pisahkan komponen seperti
self_consumption_savings_idr dan export_revenue_idr. Contoh angka tarif pada file
JSON hanya fixture (`EXAMPLE_ONLY`), bukan tarif yang direkomendasikan.

### Environmental benefits

Expose energi eligible, CO2 avoided kg, coal saved kg, dan equivalent_tree_years,
beserta factor_set_id/source/version, periode, dan status measured/estimated/unconfigured.
Rumus generik menggunakan faktor yang **disetujui**: energi eligible * faktor emisi;
konversi setara pohon memakai basis penyerapan per tree-year yang terdokumentasi.
Jangan menampilkan angka setara pohon sebagai pohon yang benar-benar telah ditanam.
Jangan menebak faktor emisi Indonesia atau faktor batu bara. Contoh response sekarang
memakai nilai null dan status unconfigured sampai faktor resmi project ditentukan.

## 5. Error response dan dokumentasi Swagger

Usulan bentuk yang konsisten:

```json
{
  "success": false,
  "message": "PLTS tidak ditemukan.",
  "data": null,
  "error": {
    "code": "PLANT_NOT_FOUND",
    "retryable": false,
    "retry_after_seconds": null,
    "fields": []
  },
  "request_id": "req-example-001"
}
```

| HTTP | Kegunaan |
|---|---|
| 200 | GET berhasil; boleh berisi data stale/partial dengan metadata yang eksplisit |
| 201 | Konfigurasi PLTS baru berhasil dibuat |
| 400/422 | Query/request tidak valid; pilih kebijakan validasi konsisten |
| 404 | Kode PLTS tidak ditemukan |
| 409 | Konflik seperti kode PLTS duplikat |
| 429 | Batas request; sertakan Retry-After bila diketahui |
| 503 | Data/sumber tidak tersedia dan tidak ada fallback yang dapat dilayani |

HTTP 200 tidak boleh menyembunyikan kegagalan sebagai data sehat berisi 0.
Pesan ke client harus menjelaskan tindakan yang bisa dilakukan, bukan traceback,
credential, atau seluruh payload vendor.

Untuk FastAPI, buat Pydantic response_model per endpoint agar Swagger memuat schema
nyata, field nullable, enum, unit, dan contoh 200/201/404/409/422/503. Pastikan dokumentasi menampilkan schema yang lengkap, bukan hanya {}. Daftar model yang disarankan: PlantMetadata,
PlantOverview, DataQuality, MetricCoverage, PortfolioSummary, YieldBucket,
YieldStatisticsResponse, RankingRow, Device, Alarm, PaginationMeta, dan ApiError.
Lihat [dokumentasi resmi response_model FastAPI](https://fastapi.tiangolo.com/tutorial/response-model/).
Format timestamp mengikuti [RFC 3339](https://www.rfc-editor.org/rfc/rfc3339.html),
dan semantik status mengikuti [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html).

## 6. Urutan implementasi yang disarankan

### P0 — data benar dan peta dapat dipakai

1. Petakan koordinat perangkat ke metadata PLTS; expose has_ess/device_types,
   optimizer_quantity dan metadata country/timezone. Ini memanfaatkan data yang sudah ada.
2. Investigasi field telemetry null dan kegagalan pengambilan data: cek payload mentah
   secukupnya di BE, kemampuan endpoint sumber, hak akses, mapping field, dan perangkat
   meter yang relevan. Kode kegagalan sumber perlu dicocokkan dengan dokumentasi vendor;
   tentukan root cause berdasarkan bukti yang disimpan di lingkungan backend.
3. Pisahkan waktu measurement dan collector, status operasional dan quality per metric.
4. Validasi kapasitas PV agar PLTS yang memiliki yield positif juga memiliki kapasitas valid.
5. Definisikan response_model dan unit tanpa pembulatan prematur.

### P1 — statistik dan portofolio lengkap

1. Sediakan portfolio/summary dengan cakupan dan snapshot.
2. Sediakan yield-statistics dengan rentang waktu dan interval energy.
3. Aktifkan kolektor alarm, agregasi fleet, normalisasi severity dan status active/cleared.
4. Tambahkan overview pagination/filter server serta ranking. Migrasikan FE bersamaan,
   agar total portofolio tidak berubah menjadi total satu halaman.

### P2 — kelengkapan referensi dan fungsi administrasi

1. Revenue dengan tarif dan metode yang disepakati.
2. Faktor indikator lingkungan, sensor/aggregasi irradiation untuk PR.
3. Foto PLTS, grid connection date, dan definisi kolom string/battery.
4. POST Add Plant dan pengaturan master yang memerlukan izin tulis.

## 7. Kriteria penerimaan FE–BE

- Koordinat valid tersedia langsung pada PLTS; peta dapat menampilkan marker/cluster
  sesuai lokasi yang diverifikasi tanpa mengambil inventory satu per satu dari browser.
- PLTS dengan BESS dikenali walaupun SOC null. Optimizer 0 tetap tampil 0 jika diketahui.
- Nol pada malam hari dibedakan dari telemetry gagal. Timestamp collector baru tidak
  otomatis membuat pengukuran yang tidak terverifikasi berstatus fresh.
- Jumlah kategori status sama dengan total scope PLTS. Cakupan tiap KPI dapat ditelusuri.
- Alarm unconfigured tidak ditampilkan sebagai 0 alarm yang terverifikasi.
- Periode hilang menghasilkan null; grafik tidak menggandakan counter kumulatif harian.
  Batas tanggal, reset counter, dan timezone diuji, termasuk akhir bulan/tahun.
- Kapasitas 0 tidak menghasilkan Infinity/NaN; ranking menjelaskan PLTS yang dikecualikan.
- Summary tetap mencakup seluruh portofolio/filter meskipun tabel hanya memuat 10 baris.
- Error HTTP dan contoh Swagger bisa dipakai FE untuk menguji loading, empty, partial,
  stale, missing, dan failure state.

## 8. Langkah integrasi frontend setelah BE siap

Tambahkan tipe dan mapping pada `src/services/fleet.ts`; gunakan summary baru untuk
kartu dan alarm; ubah PlantTable menjadi server pagination/filter; gunakan has_ess,
metadata country dan field foto asli. Gunakan endpoint statistik untuk energi interval,
ganti pengelompokan 500 rekaman pada `src/services/statistics.ts`, dan pakai time_zone
PLTS/permintaan alih-alih memaksa seluruh PLTS ke WIB. Tambahkan PR serta inverter
rated power jika target harus sama dengan referensi. Aktifkan Add Plant setelah POST
tersedia. Kontrak usulan ini memerlukan perubahan FE tersebut, bukan otomatis dibaca
semua oleh frontend saat ini.
