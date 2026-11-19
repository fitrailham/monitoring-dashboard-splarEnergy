# Handoff API Dashboard Home v1

Kontrak ini mencakup tiga endpoint yang dipanggil Home untuk Plant KPIs, Plant Status, dan Active Alarms. File [OpenAPI JSON](dashboard-v1.openapi.json) memuat skema, parameter, dan contoh respons yang bisa digunakan untuk pengujian. Semua angka dan identitas pada contoh bersifat ilustratif.

## Endpoint aktif

| Method dan rute v1 | Parameter yang dikirim FE |
| --- | --- |
| `GET /api/v1/dashboard/overview` | `date=2026-11-19&time_zone=Asia%2FJakarta` |
| `GET /api/v1/plants` | `page=1&page_size=100`, dengan `snapshot_id` untuk halaman berikutnya |
| `GET /api/v1/alarms/active` | `page=1&page_size=100`, dengan `snapshot_id` untuk halaman berikutnya |

Ketiga rute v1 tersedia di Swagger backend lokal. Proxy Vite meneruskannya langsung secara default. `API_PROXY_LEGACY_DASHBOARD=true` hanya diperlukan saat development memakai backend lama.

Ketiga GET memakai cookie sesi `icongreen_session` yang diperoleh dari login existing. BE menerapkan cakupan PLTS akun **sebelum** menghitung KPI, mengambil daftar alarm, atau melakukan pagination. Viewer mendapat data PLTS yang ditugaskan. Admin mendapat cakupan sesuai izin admin. Request GET dikirim tanpa body.

## 1. Plant KPIs

Kembalikan enam field berikut dalam objek `data.kpis`. Kirim nilai sebagai angka JSON dalam satuan dasar, sehingga FE dapat mengubah satuan sesuai besaran dan memformat angka berdasarkan bahasa.

| Field | Satuan dasar | Definisi dan sumber yang dibutuhkan |
| --- | --- | --- |
| `current_power_kw` | kW | Jumlah daya aktif pembangkitan inverter dari pengukuran terkini yang valid pada cakupan akun. |
| `revenue_today_idr` | IDR | Nilai manfaat ekonomi atau pendapatan untuk tanggal bisnis yang diminta, sesuai metode maupun tarif yang diterapkan BE. Jika perhitungan belum tersedia, kirim `null` dan gunakan `data.revenue.status = "unconfigured"`. |
| `ess_rated_capacity_kwh` | kWh | Jumlah kapasitas energi nominal ESS dari inventaris yang terverifikasi, dengan setiap unit ESS dihitung sekali. |
| `yield_today_kwh` | kWh | Jumlah produksi energi inverter pada hari kalender `date` di `time_zone`. Sertakan cakupan bila sebagian counter harian lokal tidak dapat dipetakan ke tanggal yang diminta. |
| `inverter_rated_power_kw` | kW | Jumlah rating daya aktif nominal AC inverter dari inventaris. |
| `total_yield_kwh` | kWh | Jumlah energi produksi kumulatif yang valid sepanjang periode pencatatan, dengan reset counter ditangani di BE. |

Kirim `0` jika nol terverifikasi dan `null` jika nilai belum terukur, tidak berlaku, atau belum dikonfigurasi. Timestamp sumber tersedia di `data.updated_at`. Jika nilainya `null`, FE menampilkan bahwa waktu pembaruan sumber belum tersedia. Respons lama yang tidak memuat field itu menggunakan `meta.generated_at`. Gunakan ISO 8601 dengan `Z` atau offset, misalnya `2026-11-19T08:35:00+07:00`.

Kirim `data.quality = "stale"` jika data KPI berasal dari snapshot lama. Untuk cakupan per KPI, gunakan `data.coverage.<field>` dengan `expected`, `valid`, `missing`, `stale`, `unverified`, `not_applicable`, dan `partial`. FE membaca hitungan `stale` pada cakupan tersebut dan menandai data lama saat refresh gagal atau timestamp sumber mencapai usia 10 menit.

## 2. Plant Status dan daftar PLTS

`data` berisi satu baris per PLTS yang boleh dilihat akun. Isi `plant_code` dengan ID stabil dan unik, `plant_name` dengan nama tampilan, serta `status` dengan `normal`, `faulty`, `disconnected`, atau `unknown`. Masukkan PLTS berstatus `unknown` ke daftar agar grafik dan filter menghitungnya secara terpisah. `null` pada status juga ditampilkan FE sebagai Unknown.

Pertahankan metadata dan telemetry yang sudah dikirim oleh `/api/database/overview`. Tabel Home memakai kapasitas, tanggal sambungan, lokasi, foto, produksi, daya, optimizer, SOC, dan performance ratio jika tersedia. Filter perangkat memakai `device_types` dan `device_serial_numbers`, dengan nomor seri berupa string agar nol di awal tetap utuh.

## 3. Active Alarms

Kembalikan alarm yang masih aktif di dalam cakupan yang sama. Satu `alarm_id` mewakili satu kejadian alarm. Alarm yang sudah diakui tetap aktif sampai statusnya berubah menjadi selesai.

| Kolom FE | Field v1 |
| --- | --- |
| Plant Name | `plant_name`, dengan `plant_code` untuk mencocokkan daftar PLTS |
| Device Name | `device_name` dari sumber alarm atau kecocokan inventaris yang terverifikasi |
| Alarm Name | `name` |
| Severity | `severity` dengan nilai `critical`, `major`, `minor`, `warning`, atau `unclassified` |
| Raised Time | `occurred_at` dengan format ISO 8601 dan offset |
| Repair Suggestion | `repair_suggestion` dari sumber resmi atau katalog alarm BE, atau `null` jika belum tersedia |

`collected_at` adalah waktu pengambilan snapshot alarm dan terpisah dari waktu setiap alarm muncul. Gunakan `coverage.complete=false` atau `meta.is_partial=true` jika BE hanya memiliki sebagian cakupan. FE menandai total tersebut sebagai batas bawah.

| Keadaan sumber | Respons yang diharapkan |
| --- | --- |
| Tidak ada alarm aktif, cakupan terverifikasi | HTTP 200, `configured=true`, `quality="fresh"`, `data=[]`, `total=0`, `coverage.complete=true` |
| Sumber alarm terkonfigurasi, akun tidak memiliki PLTS | HTTP 200, `configured=true`, `quality="missing"`, `data=[]`, `total=0`, `coverage.expected_plants=0`, `coverage.complete=true` |
| Sumber belum terhubung atau belum pernah memberi data valid | HTTP 200, `configured=false` untuk sumber yang belum dikonfigurasi atau `quality="missing"` untuk sumber tanpa data yang dapat dipastikan, `data=[]`, `total=null` |
| Sumber sementara gagal dan tidak ada snapshot yang dapat diberikan | HTTP 503 dengan `success=false` dan `data=null`. FE mempertahankan data terakhir yang valid selama sesi. |

## Pagination dan respons error

- Kedua endpoint daftar memakai `page` mulai dari 1 dan menerima `page_size=100`. `total` menghitung seluruh baris dalam cakupan respons sebelum dipotong menjadi halaman. Isi `meta.page`, `meta.page_size`, `meta.total_pages`, dan `meta.snapshot_id` pada setiap halaman.
- Gunakan urutan tetap dan ID sebagai pengurut terakhir jika nilainya sama. Untuk satu putaran pembacaan, `total`, `meta.total_pages`, dan `meta.snapshot_id` harus konsisten di setiap halaman. FE mengirim `snapshot_id` dari halaman pertama pada request berikutnya dan menolak halaman duplikat atau snapshot campuran. Jika BE mengembalikan HTTP `409` dengan `SNAPSHOT_CHANGED`, FE mencoba ulang sekali dari halaman pertama dan mempertahankan snapshot terakhir yang valid jika percobaan itu gagal.
- Gunakan HTTP 401 ketika sesi hilang atau kedaluwarsa, 403 untuk akses yang ditolak, 422 untuk parameter yang tidak valid, dan 503 saat sumber sementara gagal. Respons error memakai `success=false`, `data=null`, pesan `message`, dan `error.code` yang stabil. Contoh lengkap ada di OpenAPI JSON.

## Ketersediaan data

- Backend menandai pendapatan sebagai `unconfigured` sampai metode atau tarif tersedia. Home menampilkan `—` selama status ini aktif.
- BE menyediakan `device_name` dan `repair_suggestion` sebagai field pada respons alarm. Field tersebut dapat berisi `null` jika sumber atau inventaris belum menyediakan nilainya.

## Checklist penerimaan BE

- Ketiga rute v1 merespons langsung dari backend dengan sesi admin dan viewer yang valid.
- KPI menggunakan satuan dasar dan membedakan nol dari nilai yang belum tersedia.
- Daftar PLTS mencakup status Unknown dan mempertahankan seluruh baris yang diizinkan saat pagination.
- Alarm memuat identitas PLTS, nama perangkat, severity, waktu muncul, serta saran perbaikan jika sumber menyediakan.
- Total alarm kosong terverifikasi, sumber alarm belum tersedia, dan error sementara dapat dibedakan dari respons.
