# IconGreen Solar Monitoring

Frontend dashboard monitoring portofolio PLTS menggunakan React, TypeScript, dan
Vite. Tampilan mengikuti referensi FusionSolar: navigasi gelap, ringkasan KPI
berlatar biru, daftar PLTS, peta, dan statistik yield.

Project ini berisi frontend. Backend API dan PostgreSQL dijalankan terpisah.

Daftar endpoint yang sudah terdaftar/belum tersedia, kebutuhan perubahan DB, dan
informasi untuk koordinasi FE–BE ada pada
[checklist pengembangan backend](docs/backend-development-checklist.md).

## Teknologi

| Bagian | Library |
| --- | --- |
| UI | React 19 + TypeScript 7 |
| Development dan build | Vite 8 |
| Tabel monitoring | AG Grid Community + Enterprise 36.3 |
| Donut, grafik yield, dan ranking | AG Charts Community 14.3 |
| Peta interaktif | Leaflet 1.9 + OpenStreetMap |
| Lint | Oxlint |

AG Grid menangani pengurutan, pengubahan lebar kolom, pagination, dan ekspor CSV.
AG Charts menangani donut status/alarm, grafik batang yield, tooltip, serta ranking.
Menu kolom, menu klik kanan, clipboard, pemilih kolom, dan ekspor Excel native
memakai modul AG Grid Enterprise hanya jika license key valid untuk versi grid.
Tanpa lisensi valid, menu kolom custom Community menyediakan filter native,
sorting, pinning, autosize, pemilih kolom, dan reset kolom. AG Charts tetap memakai
Community; Integrated Charts tidak diaktifkan. Peta dimuat saat tampilan Map dibuka.

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
VITE_AG_GRID_LICENSE_KEY=
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

Isi `VITE_AG_GRID_LICENSE_KEY` dengan key Enterprise yang sesuai, lalu restart Vite
(atau build ulang untuk produksi). Key diperiksa memakai API lisensi AG Grid dan
disetel sebelum grid dibuat. Key kosong, tidak valid, kedaluwarsa untuk versi grid,
trial kedaluwarsa, atau tipe lisensi yang tidak sesuai memakai fallback Community;
modul Enterprise tidak diaktifkan. Menu klik kanan Enterprise, clipboard Enterprise,
dan ekspor Excel native tidak tersedia pada fallback; ekspor CSV tetap tersedia.
License key ini dipakai di browser; jangan mengisinya dengan token backend atau
kredensial akun.
Lihat [instalasi lisensi AG Grid](https://www.ag-grid.com/react-data-grid/license-install/).

Penyedia tile peta dapat diganti melalui `VITE_MAP_TILE_URL`. Sesuaikan attribution
pada `src/components/PlantMap.tsx` dengan penyedia yang dipakai. Peta default
menggunakan tile HTTPS OpenStreetMap dan membutuhkan koneksi internet.

## Tampilan dan fitur yang aktif

Menu **Home** membuka empat pilihan sesuai urutan berikut: **List View** (tabel
PLTS), **Map View** (peta), **KPI View** (ringkasan KPI dan statistik yield), dan
**Dashboard** (peta dengan panel monitoring gelap). Home aktif pada keempat tampilan
tersebut. Klik pilihan untuk berpindah; menu ditutup dengan klik di luar, Escape,
atau saat fokus keluar. Empat tombol di sisi kanan menyediakan pintasan yang sama.
Ikon Home dan logo membuka Dashboard; Plants membuka List View.

### Dashboard

- Peta Indonesia dengan marker status PLTS, pencarian, dan akses panel detail.
- Tampilan monitoring gelap dengan panel di sisi kiri/kanan dan ringkasan portofolio.
- Grafik daya harian dan energi bulanan mengikuti PLTS yang dipilih pada kontrol
  Grafik PLTS. Grafik daya memakai `power-statistics` berdasarkan tanggal dengan
  bucket lima menit, waktu/kualitas terverifikasi, dan gap yang tidak diinterpolasi.
- Grafik bulanan memakai statistik energi interval tanpa batas 500 rekaman.
- Ranking total yield memakai nilai overview terverifikasi; alarm menampilkan
  jumlah dan cakupan yang tersedia. Ringkasan KPI mengikuti aturan freshness/cakupan.
- KPI, alarm, revenue, kapasitas ESS, dan manfaat lingkungan memakai summary backend.
  Data unconfigured tetap --. Panel O&M menunggu sumber work order.
- Layout berubah menjadi peta di atas dan panel bertumpuk pada layar kecil.

### Monitoring

Halaman **Monitoring** tersedia melalui navigasi utama. Halaman ini memiliki daftar
PLTS yang dapat dicari/dipilih, ringkasan PLTS, diagram PV–beban–jaringan, alarm
per PLTS, Energy Trend, dan tempat grafik Revenue Trend. Daftar PLTS bisa diciutkan
dan workspace mendukung mode layar penuh. Tab Trend, Alarms, dan Report Management
masing-masing membuka halaman tersendiri di dalam Monitoring.

Grafik Day menampilkan pembacaan daya terakhir per jam dari API rentang tanggal,
dengan coverage per metrik serta verifikasi tanda grid/baterai. Total energi dan grafik Month/Year/Lifetime
tetap memakai endpoint agregasi energi berdasarkan rentang, dengan penanda parsial.
Pendapatan historis, cuaca, manfaat lingkungan, dan energi impor/pemakaian sendiri
tidak dihitung dari asumsi. Bagian terkait menampilkan keterangan belum tersedia.
Tab Coefficient of Variation Analysis tersedia dengan dua jenis analisis dan
adapter API opsional. Nilai analisis tetap -- sampai sumber data CV terhubung.

#### Coefficient of Variation Analysis

**Monitoring → Coefficient of Variation Analysis** menampilkan tab Inverter
Coefficient of Variation dan String Coefficient of Variation, filter inverter/SN,
rentang tanggal maksimum 366 hari, comparison group, trend harian, distribusi CV,
rincian deviation, kualitas data, pagination, dan Export CSV.

Batang tanggal memilih rincian hari tersebut; batang/legend distribusi menyaring
rentang CV. Group yang berbeda tidak digabung menjadi CV global. Rentang histogram
bersifat tampilan numerik, bukan penetapan status normal/rusak.

Aktifkan sumber analisis melalui `VITE_CV_ANALYSIS_PATH` setelah backend menyediakan
kontrak pada [CV analysis API](docs/cv-analysis-api.md), lalu restart Vite.
Default kosong: tidak ada request ke endpoint CV tebakan dan tidak ada hasil simulasi.
Inventory inverter tetap dibaca dari API perangkat. CV tidak dihitung dari variasi
yield antar-jam atau kapasitas terpasang sebagai pengganti data perbandingan perangkat.

Adapter memeriksa scope PLTS/periode/timezone, identitas string, group pembanding,
mean, standar deviasi, jumlah anggota, dan konsistensi CV (%). Mean nol, anggota
kurang dari dua, missing/invalid, dan statistik group yang berbeda diberi penanda
atau hasil --. Ekspor mempertahankan alasan serta kualitas data dan kelengkapan.

#### Alarms

**Monitoring → Alarms** menyediakan Active Alarms dan Historical Alarms. Backend
dipanggil dengan `state=active` atau `state=cleared`; acknowledgment tidak dianggap
sebagai status cleared. Record tanpa state yang sesuai tidak disisipkan ke tab
lain. Metadata perangkat diperkaya dari inventory melalui ID/SN yang konsisten.

Filter Device type, SN, Alarm name, Alarm ID (internal/vendor), dan Occurrence time
diterapkan lewat Search. Waktu filter mengikuti timezone PLTS dan menit akhir
bersifat inklusif. Timestamp tanpa offset tidak dianggap waktu kejadian terverifikasi.
Badge severity dapat diklik untuk menyaring hasil. Tabel mendukung sorting,
pilihan lintas halaman, detail, dan pagination 10/20/50 baris.

Auto Refresh opsional memuat ulang setiap 30 detik tanpa menumpuk request yang
masih berjalan. Data sumber unconfigured, stale, unverified, partial, atau gagal
dibedakan dari nol alarm yang telah terverifikasi. Hitungan parsial ditulis ≥N
untuk nilai positif dan -- bila jumlah belum diketahui. Filter yang membutuhkan
metadata/waktu yang hilang juga tidak dianggap memiliki cakupan lengkap.

Route per PLTS diminta tanpa pagination untuk kompatibilitas. Jika total menunjukkan
data terpotong, FE mencoba halaman berukuran 100 sampai maksimum 20 halaman;
batas pemuatan, perubahan jumlah sumber, record duplikat, dan pengulangan halaman
ditandai sebagai data parsial. Export CSV mencakup seluruh hasil yang dimuat setelah
filter/sorting, atau baris terpilih, dengan metadata kualitas/cakupan. Sumber kosong
yang sudah terverifikasi dapat diekspor sebagai header CSV tanpa record.

Clear dinonaktifkan karena API hanya menyediakan GET alarm. Tidak ada operasi
clear/acknowledge yang disimulasikan di frontend.

#### Device Management

**Monitoring → Device Management** menampilkan inventory aktual dari
`GET /api/devices/{plant_code}`. Filter Device type, Device name dan SN diterapkan
melalui Search. Expand menambahkan filter status dan model; Reset menghapus filter
serta pilihan baris. Tabel mendukung sorting, pagination 10/20/50 baris, pilihan
lintas halaman, kolom Operation tetap di kanan, serta detail perangkat.

Status hanya mengikuti field operasional backend; timestamp inventory tidak
dianggap bukti perangkat online. Jenis vendor numerik tidak ditebak. SN tetap
berupa teks, dan software/parent/metadata yang tidak tersedia ditampilkan --.
Superior equipment dan subperangkat hanya muncul dari relasi parent eksplisit;
jumlah optimizer tidak digunakan untuk membuat perangkat simulasi.

Export Basic Info mengunduh perangkat terpilih, atau seluruh hasil filter bila
tidak ada pilihan. Batch Rename dan ikon edit menyiapkan **draf CSV nama baru**
tanpa mengubah nama pada backend/perangkat. Set Parameters masih dinonaktifkan.
Export Performance Data aktif setelah satu perangkat dipilih; dialog menerima
tanggal awal/akhir maksimum 31 hari dalam timezone PLTS, mengikuti seluruh halaman
`GET /api/devices/{device_id}/history` dengan scope `plant_code`. ID yang dikirim
adalah ID vendor, bukan ID baris lokal. CSV menyertakan waktu, kualitas per field,
dan konvensi arah daya; nilai belum terverifikasi dikosongkan.

#### Report Management

**Monitoring → Report Management** memiliki tab Plant Report/Inverter Report,
Time granularity, Statistical period, dan Search. Pilihan periode baru diterapkan
saat Search ditekan. Plant Report memakai agregasi energi interval berdasarkan
rentang waktu; Statistical Period berasal dari batas bucket backend dalam timezone
PLTS. Interval pending tidak ditampilkan, missing tetap --, dan nol terukur tetap 0.

Kolom tabel dapat ditampilkan/disembunyikan, diurutkan, dan dipaginasi 10/20/50
baris. Export CSV mencakup seluruh halaman hasil pengurutan, scope PLTS, timezone,
kualitas bucket, dan kelengkapan periode. Inverter Yield memakai laporan perangkat,
terpisah dari PV Yield. Export energy dan Revenue tetap -- sampai sumbernya tersedia.

Inverter Report membaca inventory inverter yang dinormalisasi dari
`GET /api/devices/{plant_code}` dan data dari `GET /api/reports/inverters`. Seluruh
halaman dimuat sebelum sorting/export (maksimum 50000 baris), dengan identitas
inverter/SN, total sebelum pagination dan penanda parsial. Plant Report menggabungkan
yield inverter per interval tanpa mengganti energi PV. Subscribe membuka penjelasan ketersediaan
fitur; tidak membuat jadwal atau mengirim laporan karena backend belum menyediakan
endpoint langganan.

#### Trend

**Monitoring → Trend** membuka halaman grafik tersendiri dengan tab Energy Trend
dan Custom, Templates, pilihan Day/Month/Year/Lifecycle, tanggal, dan Export CSV.
Custom memilih seri PV output, Power from grid, dan Consumed by appliances.
Templates menyediakan konfigurasi Energy Overview, PV Performance, dan Grid & Load.

Day menampilkan pembacaan daya terakhir per lima menit dari `power-statistics`
untuk tanggal yang dipilih, mengikuti timezone PLTS. Nilai jaringan/baterai yang
arahnya belum terverifikasi tetap null. Coverage parsial diberi penanda dan gap
tidak diinterpolasi. Tidak ada fallback ke 500 rekaman terbaru.
Month/Year/Lifecycle memakai agregasi energi interval PV dari backend dan menandai
hasil parsial. Lifecycle memakai grain year sejak arsip 1970 hingga tahun berjalan.

Export mengunduh CSV untuk konfigurasi seri aktif, lengkap dengan scope PLTS,
timezone, periode dan kualitas data. Nilai kosong tidak diubah menjadi nol, dan
teks yang berpotensi menjadi formula spreadsheet diamankan. Tidak ada data simulasi.

#### Physical Layout

Buka **Monitoring → Layout** untuk tampilan Physical Layout. Daftar PLTS di sisi
kiri diciutkan saat tab dibuka dan dapat dibuka kembali lewat tombol di tepi layar.
Halaman menampilkan toolbar Expand Device Tree, pilihan layout, Create, Edit,
Rename, Delete, periode yield, Smart Module-level Diagnosis, dan panduan singkat.

Saat belum ada layout/modul, kanvas menampilkan No data. Create membuat draf lokal
untuk PLTS pilihan; Edit menyediakan Add module, Remove module, Save, dan Cancel.
Tree di dalam halaman menampilkan modul draf. Draf tersimpan di localStorage
secara terpisah per kode PLTS dan tetap tersedia setelah reload pada browser yang
sama. Rename mengubah nama draf, sedangkan Delete memerlukan konfirmasi dialog.

Penyimpanan backend, pemetaan perangkat fisik, yield modul, dan diagnosis belum
diintegrasikan. Modul draf diberi penanda dan nilai yield --; pilihan periode
belum mengambil telemetry modul. Data lokal yang rusak tidak dihapus otomatis,
dan kegagalan penyimpanan ditampilkan agar draf tidak dianggap sudah tersimpan.

### List View

- Ringkasan portofolio: current power, yield today, installed PV capacity, total
  yield, status PLTS, dan cakupan alarm berdasarkan data yang tersedia.
- Cakupan per KPI serta jumlah telemetry terbaru/lama/belum terverifikasi/tanpa waktu.
- Kolom umur telemetry dan timestamp pengukuran pada panel detail PLTS.
- Tabel AG Grid dengan pencarian nama/kode PLTS dan wilayah.
- Filter PV/ESS serta status pada bagian Expand.
- Filter melalui tombol **⋮ → Column Filter** pada header setiap kolom data: teks untuk nama, status,
  wilayah/alamat dan telemetry; angka untuk kapasitas, SOC, daya, serta energi.
  Tombol filter membuka pilihan kondisi seperti lebih besar/kecil dan rentang.
  Kolom gambar merupakan ilustrasi sehingga tidak memiliki filter.
- Header memakai satu tombol titik tiga tanpa tombol filter terpisah atau baris
  floating filter (`suppressHeaderFilterButton: true`, `suppressHeaderMenuButton: false`,
  `columnMenu: "new"`). Titik biru pada tombol menandakan filter aktif. Tabel tidak
  menampilkan area grouping atau kolom checkbox pemilihan baris. Tombol selalu
  terlihat dan diperbesar pada perangkat sentuh.
- Filter kolom dapat digabung dengan pencarian utama. Reset menghapus seluruh
  filter, dan ekspor CSV mengikuti hasil filter serta pengurutan yang aktif.
- Pengurutan numerik, pengubahan lebar kolom, pilihan 10/20/50 baris, dan pagination.
- Menu header: sorting, Column Filter, pin kolom, autosize satu/semua kolom,
  pemilih kolom, dan reset susunan kolom. Menu menyesuaikan kemampuan tiap kolom.
  Pada Community, menu custom memakai API Community dan mempertahankan header
  native untuk sorting/resize/drag serta indikator sort. Menu mendukung keyboard,
  ditutup dengan Escape/klik di luar, dan mengikuti batas viewport.
- Dengan lisensi Enterprise valid, klik kanan sel untuk Copy, Copy with Headers,
  serta Export CSV/Excel.
  Ekspor CSV dari menu memakai konfigurasi yang sama dengan tombol Export,
  termasuk hasil filter/pengurutan dan perlindungan teks formula.
- Pemilih kolom bawaan dapat menampilkan/menyembunyikan kolom; checkbox alamat
  pada pengaturan tetap mengikuti visibilitas kolom tersebut.
- Ekspor CSV seluruh hasil filter/pengurutan, termasuk baris di halaman lain.
- Klik nama PLTS untuk membuka panel detail dan masuk ke statistiknya.

Filter dan pagination saat ini berjalan di frontend setelah seluruh overview
dimuat. Filter ESS sementara berarti **ESS with SOC data**; keberadaan ESS belum
disimpulkan dari inventory. Country/Region masih menampilkan Indonesia dan
pencarian wilayah memakai teks alamat.

### Map View

- Peta Leaflet/OpenStreetMap yang dapat digeser dan diperbesar.
- Pencarian nama/alamat serta daftar PLTS dan kapasitasnya.
- Klik PLTS pada daftar untuk membuka panel detail.
- Marker hanya dibuat dari `latitude` dan `longitude` yang diterima pada data PLTS.

Frontend membaca koordinat dari metadata PLTS/overview. Jika backend menyimpan
koordinat hanya di inventory perangkat, petakan field itu ke metadata PLTS agar
marker dapat ditampilkan. Selama field tersebut belum diterima, peta tetap
tersedia dengan daftar alamat dan penjelasan kondisi lokasi.

### KPI View

- Grafik batang AG Charts untuk PLTS pilihan.
- Periode Day, Month, Year, dan Lifetime serta navigasi tanggal.
- Ranking lima PLTS dengan specific energy tertinggi dari overview yang dimuat.
- Klik batang ranking atau pilih PLTS untuk mengganti riwayat yang ditampilkan.
- Loading, error, serta periode tanpa data ditampilkan secara terpisah.

Statistik meminta agregasi energi dari backend untuk seluruh rentang yang dipilih,
tanpa memakai batas 500 rekaman history. Mengganti PLTS, tanggal, atau periode
mengambil statistik baru; refresh portofolio yang berhasil juga memperbarui grafik.

| Periode | Perhitungan yang diterapkan |
| --- | --- |
| Day | Energi interval per jam pada hari pilihan |
| Month | Energi per hari pada bulan pilihan |
| Year | Energi per bulan pada tahun pilihan |
| Lifetime | Energi per tahun untuk arsip sejak 1970 hingga akhir tahun berjalan |

Parameter `from` inklusif dan `to` eksklusif mengikuti `time_zone` PLTS,
dengan fallback Asia/Jakarta. Backend bertanggung jawab menghitung energi interval
dan menangani baseline, reset counter, serta gap pengukuran. Response harus
memakai `aggregation: interval_energy` dan `unit: kWh`.

Interval missing/pending dibiarkan kosong, sedangkan nol terukur tetap ditampilkan.
Badge menunjukkan interval lengkap dibanding interval yang telah berjalan.
Flag `complete`, `meta.is_partial`, `truncated`, dan kualitas bucket menentukan
peringatan kelengkapan. Response dengan rentang/unit/jenis agregasi yang salah
ditolak. Backend tanpa endpoint statistik menampilkan error, tanpa fallback
ke maksimum 500 rekaman yang bisa menyesatkan. Specific energy dihitung
sebagai yield harian kWh dibagi kapasitas PV kWp; kapasitas 0/null tidak diranking.
Ranking tetap memakai overview harian, terpisah dari periode grafik pilihan.

## API yang digunakan saat ini

Backend development: `http://127.0.0.1:8000`.
Dokumentasi Swagger: `http://127.0.0.1:8000/docs`.

| Endpoint | Pemakaian frontend |
| --- | --- |
| `GET /api/database/overview` | Baris monitoring, peta, dan fallback KPI jika summary gagal |
| `GET /api/database/plants` | Metadata/alamat yang digabung berdasarkan plant_code |
| `GET /api/database/yield-statistics?plant_code=...&from=...&to=...&grain=...&time_zone=...` | Statistik energi interval sesuai rentang pilihan |
| `GET /api/database/power-statistics` | Daya berdasarkan rentang/tanggal pada Home Dashboard, Monitoring Overview, dan Trend |
| `GET /api/portfolio/summary` | KPI, status/alarm portofolio, kapasitas ESS, revenue dan manfaat lingkungan, dengan coverage |
| `GET /api/database/rankings` | Ranking specific energy harian pada KPI View; ranking total yield Dashboard tetap dari overview karena endpoint ranking hanya menyediakan yield harian/specific energy |
| `GET /api/reports/inverters` | Inverter Report dan kolom Inverter Yield pada Plant Report |
| `GET /api/devices/{device_id}/history` | Export Performance Data dengan scope PLTS dan pagination |
| `POST /api/database/plants` | Add Plant; token izin tulis dimasukkan saat menyimpan form |
| `PATCH /api/database/plants/{plant_code}` | Edit Plant Metadata dari panel detail; hanya field master yang diizinkan BE |
| `GET /api/alarms/{plant_code}?state=active|cleared` | Alarm aktif/historis PLTS dan metadata configured/quality/cakupan |
| `GET /api/devices/{plant_code}` | Inventory Device Management dan pilihan inverter Report Management |

Format respons dasar yang dibaca layanan frontend adalah `success: true` dengan
`data` berupa array untuk overview/metadata/alarm, dan objek berisi `buckets`
untuk statistik. Nomor dan metrik kosong dinormalisasi sebelum ditampilkan.
Satuan pada overview/statistik: daya kW, kapasitas PV kWp, yield/energi ESS kWh,
dan SOC persen. Format MW/MWh/GWh diterapkan pada kartu yang sesuai.

Overview dan metadata dimuat bersama. Portofolio diperbarui setiap lima menit;
refresh manual tersedia. Alarm portofolio memakai summary sehingga tidak meminta
alarm satu per satu ke seluruh PLTS. Jika
pembaruan portofolio gagal, data terakhir tetap ditampilkan bersama pesan error.
Label API synced adalah waktu frontend berhasil mengambil data. Umur telemetry
dihitung terpisah dari timestamp pengukuran dan diperbarui setiap 30 detik.

PLTS awal statistik mengikuti default pada source PortfolioDashboard jika kode
tersebut ditemukan, atau memakai PLTS pertama. KPI memakai summary BE; jika gagal,
ringkasan overview ditampilkan dengan pesan fallback dan alarm tidak diklaim nol. Tiap KPI menunjukkan
jumlah PLTS valid dibanding PLTS relevan, dengan rincian kosong/lama/belum
terverifikasi melalui tooltip. PLTS demo dan metrik tidak relevan dikecualikan.

KPI telemetry hanya memasukkan nilai dengan waktu pengukuran terverifikasi dan
belum kedaluwarsa. Gunakan `data_quality.measured_at`/`measured_at`, flag
`measurement_time_verified`, kualitas per field, dan `stale_after_seconds`
(default 900 detik jika tidak diberikan). Timestamp collector saja, timestamp
tanpa offset, dan timestamp di masa depan tidak dianggap bukti freshness.
Yield today harus memiliki tanggal bisnis hari ini pada zona waktu PLTS.
Kapasitas PV merupakan metadata sehingga tidak disaring berdasarkan usia telemetry.
Nilai parsial diberi label; jika tidak ada nilai valid, KPI menampilkan --, bukan 0.

## Kondisi data dan fitur yang belum lengkap

- Nilai telemetry yang tidak tersedia ditampilkan sebagai --. Status operasional
  yang tidak disediakan backend berlabel Unknown. Timestamp collector tidak
  dipakai untuk menyimpulkan perangkat online/offline.
- Alarm dengan configured false atau tanpa cakupan data ditampilkan --, bukan
  dianggap nol alarm yang sudah terverifikasi.
- Kapasitas PV 0/null tidak dipakai untuk pembagian specific energy dan ranking.
- Lokasi/country/region, has_pv/has_ess, foto, dan jumlah optimizer memakai metadata
  backend; firmware dan superior equipment memakai inventory perangkat.
- Revenue, kapasitas ESS terpasang, dan indikator lingkungan mengikuti summary;
  backend yang mengembalikan unconfigured/null tetap ditampilkan --.
- Kartu Installed PV capacity memakai kapasitas panel DC; belum sama dengan kartu
  Inverter rated power AC pada referensi. Kolom tanggal grid connection dan PR
  belum tersedia pada tabel aktif.
- Thumbnail dan panel detail memakai image_url, dengan ilustrasi sebagai fallback.
- Add Plant dan Edit Plant Metadata sudah terhubung ke BE. Backend membutuhkan
  PLANT_WRITE_TOKEN yang dikonfigurasi administrator; masukkan token pada form,
  jangan dalam VITE_* atau localStorage. Token hanya disimpan di memori selama form terbuka.
  Business Operation/SmartDesign belum diimplementasikan; label akun hanya tampilan.

Data sumber tidak diganti dengan data simulasi. Hasil audit backend aktual dan
metadata operasional disimpan lokal, tidak disertakan dalam repository public.

## Analisis dan kontrak backend

- [Analisis kebutuhan FE–BE](docs/backend-api-analysis.md): temuan, kebutuhan field,
  kontrak endpoint, arti metrik, prioritas, dan kriteria penerimaan.
- [Contoh kontrak JSON](docs/backend-api-contract.examples.json): contoh method,
  path, parameter/body, status HTTP, dan response. Seluruh nilai adalah fixture
  ilustratif, bukan data produksi.
Beberapa status usulan pada dokumen awal sudah diterapkan. Lihat
[hasil integrasi Swagger](docs/backend-integration.md) dan daftar API aktif di atas.
Ketersediaan data tetap bergantung pada collector/backend/database. Pemakaian AG
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
    statistics.ts                  # Rentang kalender dan grain statistik
    yieldStatistics.ts             # API statistik interval dan validasi kelengkapan
    calendar.ts                    # Konversi kalender/timezone ke batas UTC
    quality.ts                     # Umur telemetry dan agregasi KPI dengan cakupan
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
| `npm.cmd test` | Pengujian rentang statistik, kontrak API, freshness, dan cakupan KPI |

Pengujian otomatis menggunakan test runner bawaan Node.js pada runtime Node 24.
Kasus mencakup batas kalender dan timezone, leap day/DST, kontrak statistik,
partial/truncation, cancellation, nol vs missing, dan pengecualian telemetry
lama/belum terverifikasi. Pengujian data langsung memerlukan backend dan database aktif.

Build terakhir berhasil. Verifikasi browser sebelumnya pada desktop 1680x952 dan mobile 390x844
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
