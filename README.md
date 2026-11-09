# IconGreen Solar Monitoring

Frontend dashboard monitoring portofolio PLTS menggunakan React, TypeScript, dan
Vite. Tampilan mengikuti referensi FusionSolar: navigasi gelap, ringkasan KPI
berlatar biru, daftar PLTS, peta, dan statistik yield.

Project ini berisi frontend. Backend API dan PostgreSQL dijalankan terpisah.

## Teknologi

| Bagian | Library |
| --- | --- |
| UI | React 19 + TypeScript 7 |
| Development dan build | Vite 8 |
| Tabel monitoring | AG Grid Community 36.3 |
| Donut, grafik yield, dan ranking | AG Charts Community 14.3 |
| Peta interaktif | Leaflet 1.9 + OpenStreetMap |
| Lint | Oxlint |

AG Grid menangani pengurutan, pengubahan lebar kolom, pagination, dan ekspor CSV.
AG Charts menangani donut status/alarm, grafik batang yield, tooltip, serta ranking.
Implementasi memakai modul Community; fitur Integrated Charts dan Enterprise tidak
diaktifkan. Peta dimuat saat tampilan Map dibuka.

## Menjalankan project

Runtime terakhir yang diuji: **Node.js 24.22.1** dan **npm 11.19.1**.
Versi Vite yang terpasang menyatakan dukungan Node `^20.19.0 || >=22.12.0`.

Contoh langkah di PowerShell:

```powershell
git clone https://github.com/fitrailham/monitoring-dashboard-splarEnergy.git monitoring-dashboard-solarEnergy
cd monitoring-dashboard-solarEnergy
npm.cmd ci
Copy-Item .env.example .env
npm.cmd run dev
```

Untuk checkout yang sudah ada, mulai dari `npm.cmd ci`. Buat `.env` hanya jika
belum ada agar konfigurasi lokal tidak tertimpa. `npm.cmd` dapat diganti dengan
`npm` pada shell yang mengizinkannya.

Buka alamat Local yang dicetak Vite, biasanya `http://localhost:5173/`. Jika port
terpakai, Vite dapat memilih port lain; origin tersebut juga perlu diizinkan BE.

## Konfigurasi environment

```dotenv
VITE_API_URL=http://127.0.0.1:8000
```

- Default alamat API adalah `http://127.0.0.1:8000`.
- Ubah `.env`, lalu jalankan ulang Vite jika alamat backend berubah.
- `.env` dan `.env.*` diabaikan Git; `.env.example` tetap disimpan.
- Nilai `VITE_*` tersedia di browser. Jangan menyimpan password, token, atau
  kredensial database pada variabel tersebut.
- `127.0.0.1` merujuk ke komputer yang menjalankan browser. Untuk akses dari
  perangkat lain, gunakan alamat backend yang bisa dijangkau perangkat tersebut.
- Backend harus mengizinkan origin frontend melalui CORS. API dipanggil langsung
  dari browser; project ini tidak mengonfigurasi proxy API Vite.

Penyedia tile peta dapat diganti melalui `VITE_MAP_TILE_URL`. Sesuaikan attribution
pada `src/components/PlantMap.tsx` dengan penyedia yang dipakai. Peta default
menggunakan tile HTTPS OpenStreetMap dan membutuhkan koneksi internet.

## Tampilan dan fitur yang aktif

Gunakan tiga tombol di sisi kanan dashboard untuk beralih tampilan.

### Plant list

- Ringkasan portofolio: current power, yield today, installed PV capacity, total
  yield, status PLTS, dan cakupan alarm berdasarkan data yang tersedia.
- Tabel AG Grid dengan pencarian nama/kode PLTS dan wilayah.
- Filter PV/ESS serta status pada bagian Expand.
- Pengurutan numerik, pengubahan lebar kolom, pilihan 10/20/50 baris, dan pagination.
- Pengaturan untuk menampilkan kolom alamat.
- Ekspor CSV seluruh hasil filter/pengurutan, termasuk baris di halaman lain.
- Klik nama PLTS untuk membuka panel detail dan masuk ke statistiknya.

Filter dan pagination saat ini berjalan di frontend setelah seluruh overview
dimuat. Filter ESS sementara berarti **ESS with SOC data**; keberadaan ESS belum
disimpulkan dari inventory. Country/Region masih menampilkan Indonesia dan
pencarian wilayah memakai teks alamat.

### Map view

- Peta Leaflet/OpenStreetMap yang dapat digeser dan diperbesar.
- Pencarian nama/alamat serta daftar PLTS dan kapasitasnya.
- Klik PLTS pada daftar untuk membuka panel detail.
- Marker hanya dibuat dari `latitude` dan `longitude` yang diterima pada data PLTS.

Frontend membaca koordinat dari metadata PLTS/overview. Jika backend menyimpan
koordinat hanya di inventory perangkat, petakan field itu ke metadata PLTS agar
marker dapat ditampilkan. Selama field tersebut belum diterima, peta tetap
tersedia dengan daftar alamat dan penjelasan kondisi lokasi.

### Statistics

- Grafik batang AG Charts untuk PLTS pilihan.
- Periode Day, Month, Year, dan Lifetime serta navigasi tanggal.
- Ranking lima PLTS dengan specific energy tertinggi dari overview yang dimuat.
- Klik batang ranking atau pilih PLTS untuk mengganti riwayat yang ditampilkan.
- Loading, error, serta periode tanpa data ditampilkan secara terpisah.

Perhitungan saat ini memakai maksimum 500 rekaman history:

| Periode | Perhitungan yang diterapkan |
| --- | --- |
| Day | Pembacaan yield kumulatif terakhir setiap jam, dalam Asia/Jakarta |
| Month | Nilai yield harian tertinggi pada rekaman yang tersedia |
| Year | Penjumlahan nilai harian tersebut per bulan |
| Lifetime | Penjumlahan nilai harian tersebut per tahun dalam riwayat yang diterima |

Grafik Day masih **yield kumulatif**, bukan energi produksi tiap interval jam.
Month/Year/Lifetime belum menjamin laporan lengkap di luar riwayat yang diterima.
Periode yang tidak memiliki rekaman dibiarkan kosong. Specific energy dihitung
sebagai yield harian kWh dibagi kapasitas PV kWp; kapasitas 0/null tidak diranking.
Timezone statistik saat ini tetap Asia/Jakarta, belum mengikuti timezone tiap PLTS.

## API yang digunakan saat ini

Backend development: `http://127.0.0.1:8000`.
Dokumentasi Swagger: `http://127.0.0.1:8000/docs`.

| Endpoint | Pemakaian frontend |
| --- | --- |
| `GET /api/database/overview` | Baris monitoring, KPI portofolio, dan ranking |
| `GET /api/database/plants` | Metadata/alamat yang digabung berdasarkan plant_code |
| `GET /api/database/history/{plant_code}?limit=500` | Riwayat statistik PLTS pilihan |
| `GET /api/alarms/{plant_code}` | Alarm pada PLTS yang configured |

Format respons dasar yang dibaca layanan frontend adalah `success: true` dengan
`data` berupa array. Nomor dan metrik kosong dinormalisasi sebelum ditampilkan.
Satuan pada overview/history: daya kW, kapasitas PV kWp, yield/energi ESS kWh,
dan SOC persen. Format MW/MWh/GWh diterapkan pada kartu yang sesuai.

Overview dan metadata dimuat bersama. Portofolio diperbarui setiap lima menit;
refresh manual tersedia. Permintaan alarm dibatasi empat PLTS sekaligus. Jika
pembaruan portofolio gagal, data terakhir tetap ditampilkan bersama pesan error.
Label Last synced adalah waktu frontend berhasil mengambil data, bukan bukti
waktu pengukuran perangkat.

PLTS awal statistik mengikuti default pada source PortfolioDashboard jika kode
tersebut ditemukan, atau memakai PLTS pertama. KPI masih dijumlahkan di FE dari
nilai non-null, belum memakai summary BE dengan kualitas/cakupan per metrik.

## Kondisi data dan fitur yang belum lengkap

- Nilai telemetry yang tidak tersedia ditampilkan sebagai --. Status operasional
  yang tidak disediakan backend berlabel Unknown. Timestamp collector tidak
  dipakai untuk menyimpulkan perangkat online/offline.
- Alarm dengan configured false atau tanpa cakupan data ditampilkan --, bukan
  dianggap nol alarm yang sudah terverifikasi.
- Kapasitas PV 0/null tidak dipakai untuk pembagian specific energy dan ranking.
- Lokasi, jenis perangkat, serial, dan optimizer perlu dipetakan ke API/komponen
  frontend yang memerlukannya. Inventory perangkat belum dipakai untuk peta aktif.
- Revenue, kapasitas ESS terpasang, dan indikator lingkungan masih placeholder.
  Kolom optimizer belum dihubungkan dengan inventory.
- Kartu Installed PV capacity memakai kapasitas panel DC; belum sama dengan kartu
  Inverter rated power AC pada referensi. Kolom tanggal grid connection dan PR
  belum tersedia pada tabel aktif.
- Thumbnail panel surya adalah ilustrasi, bukan foto lokasi.
- Add Plant dinonaktifkan sampai BE menyediakan operasi penambahan PLTS.
  Business Operation/SmartDesign belum diimplementasikan; label akun hanya tampilan.

Data sumber tidak diganti dengan data simulasi. Hasil audit backend aktual dan
metadata operasional disimpan lokal, tidak disertakan dalam repository public.

## Analisis dan kontrak backend

- [Analisis kebutuhan FE–BE](docs/backend-api-analysis.md): temuan, kebutuhan field,
  kontrak endpoint, arti metrik, prioritas, dan kriteria penerimaan.
- [Contoh kontrak JSON](docs/backend-api-contract.examples.json): contoh method,
  path, parameter/body, status HTTP, dan response. Seluruh nilai adalah fixture
  ilustratif, bukan data produksi.
Endpoint summary portofolio, statistik energi interval, ranking server, alarm
fleet, dan POST Add Plant pada dokumen tersebut adalah **usulan**. Frontend aktif
masih menggunakan endpoint yang tercantum pada bagian API di atas. Pemakaian AG
Grid/AG Charts tidak mengharuskan BE mengirim konfigurasi chart; BE tetap mengirim
data JSON dan konfigurasi visual dikelola frontend.

## Struktur source

```text
src/
  App.tsx                          # Entry ke dashboard portofolio
  pages/
    PortfolioDashboard.tsx         # Navigasi, loading, refresh, detail PLTS
    Dashboard.tsx                  # Halaman awal dari source referensi
  components/
    PlantTable.tsx                 # Tabel AG Grid dan kontrolnya
    AgDashboardChart.tsx           # Wrapper dan modul AG Charts
    FleetSummary.tsx               # KPI serta donut status/alarm
    FleetStatistics.tsx            # Grafik yield dan ranking
    PlantMap.tsx                   # Leaflet, pencarian, dan daftar lokasi
    Icon.tsx                       # Ikon SVG
  services/
    fleet.ts                       # API aktif dan normalisasi data
    statistics.ts                  # Pengelompokan riwayat yang dipakai sekarang
    api.ts                         # Layanan halaman awal
  index.css                        # Tema dan layout responsif
public/
  icongreen-logo.png                # Logo IconGreen / Member of PLN Group
  solar-logo.svg
  solar-plant.svg
docs/
  backend-api-analysis.md
  backend-api-contract.examples.json
```

Halaman dan komponen awal tetap disimpan sebagai source referensi. Route aktif
menggunakan `PortfolioDashboard.tsx`.

## Build dan pemeriksaan

| Perintah | Fungsi |
| --- | --- |
| `npm.cmd run dev` | Development server dan hot reload |
| `npm.cmd run build` | Pemeriksaan TypeScript dan build produksi ke dist/ |
| `npm.cmd run preview` | Menjalankan preview hasil build produksi |
| `npm.cmd run lint` | Pemeriksaan source dengan Oxlint |

Build terakhir berhasil. Verifikasi browser desktop 1680x952 dan mobile 390x844
mencakup filter, sorting, pagination, jumlah baris, ekspor CSV AG Grid, visibilitas
kolom, panel detail, periode statistik, pilihan ranking, dan layout mobile.

Vite masih memberikan peringatan ukuran chunk karena library grid/chart membuat
bundle utama lebih besar dari batas peringatan default. Peringatan tersebut tidak
menggagalkan build; optimasi pemisahan bundle belum dikerjakan. `dist/`,
`node_modules/`, environment lokal, dan artefak preview lokal diabaikan Git.

## Asal dan rujukan

Frontend awal berasal dari [fitrailham/hello-world](https://github.com/fitrailham/hello-world),
branch `master`, commit `119b02aa2e5ce29c7d22e5c74e22913674905b56`, kemudian
dikembangkan menjadi dashboard portofolio pada repository ini.

- [AG Grid React](https://www.ag-grid.com/react-data-grid/getting-started/)
- [Aset logo IconGreen](https://icongreen.id/wp-content/uploads/2025/09/IconGreen-Website-1-1-scaled.png)
- [AG Charts React](https://www.ag-grid.com/charts/react/quick-start/)
- [Leaflet](https://leafletjs.com/reference-1.9.4.html)
- [Kebijakan tile OpenStreetMap](https://operations.osmfoundation.org/policies/tiles/)
