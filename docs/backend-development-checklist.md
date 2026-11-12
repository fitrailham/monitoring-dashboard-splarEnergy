# Daftar pekerjaan backend dan database

Tanggal pemeriksaan: 12 November 2026.

Dokumen ini berdasarkan kode frontend saat ini dan pemeriksaan GET `/openapi.json`
pada backend yang dikonfigurasi melalui `VITE_API_URL`. Status **terdaftar** berarti
route dan model tercantum di Swagger; bukan jaminan data produksi sudah lengkap,
collector aktif, perhitungan benar, atau seluruh operasi telah diuji.

Skema SQL, migration, dan source backend tidak tersedia di repository frontend ini.
Nama tabel di bawah adalah rancangan logis untuk dibahas, bukan hasil audit tabel
aktual. Tidak ada perubahan database atau request tulis ke backend dalam pemeriksaan ini.

## 1. API yang sudah terdaftar: pakai atau lengkapi, tidak perlu dibuat ulang

| Endpoint | Penggunaan dan tindak lanjut |
| --- | --- |
| `GET /api/database/plants` | Master PLTS untuk Home dan pemilih PLTS Monitoring. Model sudah memuat koordinat, timezone, lokasi, foto, PV/ESS, kapasitas, optimizer, dan inventory. Verifikasi kelengkapan data sebenarnya. |
| `GET /api/database/plants/{plant_code}` | Detail master PLTS. |
| `POST /api/database/plants` | Pendaftaran PLTS sudah terdaftar. Tombol Add Plant frontend masih disabled; perlu integrasi form, izin, dan penanganan validasi. |
| `PATCH /api/database/plants/{plant_code}` | Perubahan master PLTS sudah terdaftar. Periksa field yang diizinkan sebelum membuat form. |
| `GET /api/database/overview` | Snapshot daya, energi, status, dan kualitas data. Query sudah mendukung search, lokasi, tipe perangkat/SN, status, pagination, serta sort. Frontend masih memakai seluruh daftar dan filtering lokal. |
| `GET /api/portfolio/summary` | KPI portofolio, status PLTS, alarm, coverage, revenue, dan environmental benefits. Frontend belum memakai endpoint ini untuk summary; sebagian masih menjumlahkan overview dan meminta alarm per PLTS. |
| `GET /api/database/history/{plant_code}` | Riwayat mentah. Parameter yang terdaftar hanya `plant_code` dan `limit` maksimum 500. Belum cukup untuk grafik tanggal lama atau seluruh periode. |
| `GET /api/database/yield-statistics` | Energi PV per interval. Query `plant_code`, `from`, `to`, `grain`, `time_zone`; dipakai grafik dan PV Yield pada Plant Report. Periksa counter reset, gap, dan coverage. |
| `GET /api/database/rankings` | Ranking server sudah terdaftar. Frontend masih menghitung ranking lokal. Pastikan metric mencakup kebutuhan KPI View dan Dashboard; ranking total yield dan specific energy berbeda. |
| `GET /api/devices/{plant_code}` | Inventory Device Management, pemilih inverter, dan metadata alarm. Perlu melengkapi `software_version`, `parent_device_id`, serta `parent_device_name` atau pemetaan parent; ketiganya belum tercantum dalam model Device yang diperiksa. |
| `GET /api/alarms` | Daftar alarm portofolio; query PLTS, severity, state, page, page_size sudah terdaftar. |
| `GET /api/alarms/{plant_code}` | Alarm per PLTS, dipakai frontend. Lengkapi data sumber dan coverage, bukan hanya array kosong. |

Route pendukung `GET /api/dashboard/{plant_code}`, `/api/database/sync-logs`,
`/api/database/test`, dan `/` juga terdaftar. Bukan kebutuhan endpoint baru untuk
empat tampilan Home atau tab Monitoring.

Dokumen lama [analisis API](backend-api-analysis.md) dan
[contoh JSON](backend-api-contract.examples.json) tetap berguna sebagai penjelasan
semantik, tetapi beberapa status "usulan/belum tersedia" di sana sudah tertinggal
dari Swagger saat pemeriksaan ini. Gunakan status di dokumen ini untuk perencanaan.

## 2. API yang belum terdaftar dan perlu dipertimbangkan

Semua path pada bagian ini adalah **usulan**. Sepakati nama final dengan tim BE.
P0 = fondasi monitoring; P1 = melengkapi halaman yang sudah dibuat; P2 = fitur
lanjutan, diaktifkan setelah cakupan bisnis dan sumber data disepakati.

| Prioritas | Endpoint usulan | Kebutuhan |
| --- | --- | --- |
| P0 | `GET /api/database/power-statistics` | Grafik daya Home Dashboard, Monitoring Overview, dan Trend untuk tanggal/rentang tertentu. |
| P1 | `GET /api/database/energy-statistics` | Energi PV, inverter, beban, impor, ekspor, serta pemakaian sendiri per interval dan total periode. Mengisi pembagian energi pada Overview. |
| P1 | `GET /api/reports/plants` | Plant Report lengkap: PV Yield, Inverter Yield, Export, Revenue, kualitas, dan total sebelum pagination. Dapat memakai agregasi energi/revenue yang sama; tidak perlu mesin perhitungan terpisah. |
| P1 | `GET /api/reports/inverters` | Inverter Report per perangkat, dengan filter PLTS, device_id, periode, dan grain. |
| P1 | `GET /api/database/revenue-statistics` | Revenue Trend dan pendapatan periode, dengan komponen ekspor/penghematan dan versi tarif. |
| P1 | `GET /api/database/cv-analysis` | Inverter/String Coefficient of Variation, cohort pembanding, mean, stddev, CV, deviation, dan coverage. Adapter frontend tersedia tetapi belum aktif tanpa konfigurasi path. |
| P1 | `GET, POST /api/plants/{plant_code}/layouts` | Membaca dan membuat layout tersimpan di server. Saat ini layout hanya draf di localStorage browser. |
| P1 | `GET, PATCH, DELETE /api/plants/{plant_code}/layouts/{layout_id}` | Detail, edit/rename, dan hapus layout dalam scope PLTS. Gunakan version/revision untuk mendeteksi edit bersamaan. |
| P1 | `GET /api/plants/{plant_code}/layouts/{layout_id}/module-metrics` | Yield/status per modul sesuai tanggal, hanya jika modul/optimizer benar-benar mempunyai sumber telemetry. |
| P1 | `GET /api/devices/{device_id}/history` | Riwayat performa inverter/perangkat dan Export Performance Data. |
| P1 | `PATCH /api/devices/{device_id}` | Ubah nama tampilan perangkat. Sepakati apakah hanya nama lokal atau disinkronkan ke vendor. |
| P1 | `POST /api/devices/batch-rename` | Batch Rename dengan daftar ID/nama baru dan hasil per perangkat. Saat ini frontend hanya mengekspor draf CSV. |
| P2 | `GET /api/devices/{device_id}/capabilities`, `GET, PUT /api/devices/{device_id}/parameters` | Daftar kemampuan, parameter yang diizinkan, unit/batas nilai, baca/tulis parameter untuk Set Parameters. Hanya bila vendor mendukung operasi tersebut. |
| P2 | `POST /api/alarms/{alarm_instance_id}/acknowledge` | Mencatat bahwa alarm telah ditinjau. Bukan menghilangkan fault fisik. |
| P2 | `POST /api/alarms/{alarm_instance_id}/clear` | Hanya bila sumber/vendor mengizinkan clear/reset. Jika state cleared hanya berasal dari perangkat, tombol Clear tetap disabled. Tentukan arti tombol sebelum implementasi. |
| P2 | `GET, POST /api/report-subscriptions`, `PATCH, DELETE /api/report-subscriptions/{id}` | Subscribe report: penerima, jadwal, timezone, filter, format, status, serta pembatalan. Memerlukan worker penjadwalan/pengiriman. |
| P2 | `GET /api/portfolio/om-summary` | Jumlah work order berdasarkan status untuk panel O&M Dashboard, jika sumber work order tersedia. Bukan jumlah alarm. |
| P2 | `GET /api/plants/{plant_code}/weather` | Cuaca Overview dengan waktu observasi/prakiraan dan penyedia data. Opsional sesuai kebutuhan produk. |

Jangan menambahkan semua endpoint hanya karena path diusulkan. Misalnya Plant
Report dapat memakai `energy-statistics` dan `revenue-statistics` langsung jika
kontraknya sudah mencakup kolom, pagination, dan total yang diperlukan. Environmental
benefits portofolio sudah mempunyai tempat di `portfolio/summary`; lengkapi sumber
dan metode di sana. Data per PLTS/periode dapat ditambahkan ke endpoint detail atau
agregasi yang disepakati.

Template Trend saat ini berupa preset di frontend. CRUD template hanya diperlukan
jika pengguna harus menyimpan/membagikan template antarperangkat. CSV/Excel lokal,
fullscreen, pilihan tampilan Home, dan filter AG Grid tidak memerlukan endpoint baru
untuk perilaku yang ada sekarang. Export besar di server dapat ditambahkan kemudian
sebagai job, tanpa membatasi hasil ke halaman tabel yang sedang terlihat.

### Kontrak minimum endpoint baru

- **Daya:** `plant_code`, `from`, `to`, `time_zone`, dan resolusi/bucket yang disepakati.
  Balikkan timestamp/batas bucket, `pv_power_kw`, `load_power_kw`, `grid_power_kw`,
  `battery_power_kw` jika tersedia, unit, metode agregasi (last/average), serta
  kualitas/coverage per metric. Tambahkan pagination atau batas titik yang eksplisit.
  Alternatifnya, perluas history lama dengan parameter range tanpa merusak consumer.
- **Energi/laporan:** batas bucket, `pv_yield_kwh`, `inverter_yield_kwh`,
  `grid_import_kwh`, `grid_export_kwh`, `load_energy_kwh`, `self_consumed_kwh`,
  charge/discharge ESS jika relevan, dan kualitas per field. Bedakan gross/net dan
  batas meter; hindari menghitung pemakaian sendiri dengan rumus yang mengabaikan ESS.
- **Revenue:** `revenue_idr`, `export_revenue_idr`, `self_consumption_savings_idr`,
  currency, energi eligible, `tariff_set_id`, versi/metode, periode dan quality.
  Nol, unknown, serta unconfigured harus dapat dibedakan.
- **CV:** ikuti [kontrak CV frontend](cv-analysis-api.md), termasuk `analysis_type`,
  identitas inverter/string, comparison_group, normalized metric, mean/stddev/count,
  CV%, deviation%, metode, dan quality. Minimal dua anggota pembanding yang layak;
  mean nol menghasilkan null. Jangan mengganti data string dengan yield PLTS.
- **Layout:** ID, plant_code, nama, revision, modul beserta posisi/rotasi, dimensi atau
  sistem koordinat, serta mapping ke inverter/MPPT/string/optimizer yang sebenarnya.
  Model draf frontend saat ini hanya menyimpan ID/label; perlu diperluas saat integrasi.
- **Perangkat:** ID stabil, kepemilikan PLTS, status, SN, firmware, parent, capability.
  ID perangkat harus tidak ambigu terhadap path inventory lama `/api/devices/{plant_code}`.
  Tambahkan scope/namespace atau versi route bila ID PLTS/perangkat bisa berbenturan.
- **Operasi tulis:** validasi scope/izin per PLTS, audit pelaku/waktu, revision untuk
  perubahan master, serta deduplikasi operasi yang dapat diulang. Jika perintah vendor
  asinkron, kembalikan job_id dan sediakan endpoint status job; jangan mengklaim sukses
  di perangkat ketika perintah baru masuk antrean. Batch mempunyai hasil per item.
- **Alarm:** ID instance/occurrence harus stabil dan berbeda dari kode jenis alarm
  vendor. Satu kode vendor bisa muncul berulang pada perangkat/tanggal berbeda.
- **Umum:** envelope `success`, `data`, metadata kualitas/total/pagination, dan error
  konsisten dengan frontend. GET tidak memakai body JSON. Respons tulis/file/job
  mungkin memerlukan perluasan helper frontend yang saat ini hanya menangani GET JSON.

## 3. Apakah perlu perubahan tabel database?

**Kemungkinan perlu untuk melengkapi seluruh fitur, tetapi belum bisa ditentukan
migration final tanpa skema DB aktual.** Endpoint baru tidak selalu berarti tabel
baru: summary, ranking, dan statistik dapat berupa query/agregasi data yang ada.
Field yang sudah ada pada Swagger juga belum membuktikan field tersebut disimpan
sebagai kolom; bisa berasal dari join, vendor, atau perhitungan.

| Entitas/tabel logis | Perubahan yang perlu diperiksa | Kapan diperlukan |
| --- | --- | --- |
| `plants` | Metadata lokasi/timezone, has_pv/has_ess, kapasitas, foto, commissioning, identitas sumber | Audit tabel lama; gunakan field/relasi yang sudah ada jika memadai. |
| `devices` | Stable ID/vendor ID, plant FK, SN, tipe/model, firmware, parent FK, kapasitas, capability, nama lokal | Lengkapi inventory dan rename. Pisahkan nama lokal dari nama vendor bila sinkronisasi dapat menimpa data. |
| `plant_telemetry` / history lama | Waktu measurement dan collection terpisah, verifikasi waktu, satuan, quality, counter energi, daya grid/load/battery | Periksa kolom yang ada dan kemampuan sumber. Mengisi kolom baru tidak menyelesaikan data yang tidak pernah dikumpulkan. |
| `device_telemetry` | Device FK, waktu, daya/energi, tegangan/arus, quality dan source | Laporan inverter, performa perangkat, serta CV inverter bila belum ada riwayat per perangkat. |
| `pv_strings` / mapping MPPT dan telemetry string | Inverter/MPPT/string ID, jumlah/rating modul, orientasi/kelompok, arus/tegangan/daya dan quality | String CV memerlukan identitas dan pengukuran string yang benar-benar didukung sumber. |
| Agregasi energi interval | Batas interval, entity, metrik/unit, energy value, metode dan coverage | Opsional sebagai tabel/materialisasi untuk kinerja; dapat dihitung dari counter/history lama jika lengkap dan terverifikasi. |
| `physical_layouts`, `layout_modules` | Plant FK, nama, revision, posisi/rotasi modul, mapping perangkat/string/optimizer | Diperlukan untuk penyimpanan layout bersama jika belum ada storage ekuivalen. |
| `alarms` / alarm events | Stable occurrence ID, device FK, severity/state, occurred/cleared_at, acknowledgment | Periksa persistensi historis. Simpan acknowledgment terpisah dari status fault sumber. |
| `tariff_sets` / tariff versions | Tarif impor/ekspor, komponen, masa berlaku, currency, sumber dan metode | Revenue/penghematan historis yang dapat ditelusuri. Hasil agregasi tidak wajib menjadi tabel tersendiri. |
| Environmental factor versions | Faktor, unit, sumber, metode, masa berlaku dan versi | Manfaat lingkungan dengan basis yang disepakati; jangan menebak faktor konversi. |
| `report_subscriptions`, delivery/jobs | Jadwal/timezone, pemilik/penerima, scope/filter, format, status/retry pengiriman | Subscribe report; memerlukan scheduler/worker di luar tabel. |
| `device_commands`, `audit_logs` | Request, aktor, target, nilai sebelum/sesudah, status vendor, request/job ID | Tulis parameter atau perubahan perangkat yang perlu ditelusuri. |
| Work orders / integrasi O&M | ID, plant, status, tanggal serta relasi sumber eksternal | Hanya jika panel O&M diaktifkan; integrasi sistem O&M yang sudah ada bisa menggantikan tabel baru. |

Hasil CV tidak wajib disimpan sebagai raw truth baru. Simpan raw telemetry dan
definisi cohort/metode; agregasi harian/cache CV dapat ditambahkan bila diperlukan,
dengan versi metode serta invalidasi saat data terlambat atau backfill masuk.

Untuk waktu pengukuran PostgreSQL, pertimbangkan `timestamptz` dan simpan timezone
IANA PLTS terpisah karena tipe tersebut tidak mempertahankan nama zona asal.
Jangan mengonversi timestamp lama sebelum mengetahui apakah nilainya UTC atau waktu
lokal. Lihat [tipe tanggal/waktu PostgreSQL](https://www.postgresql.org/docs/current/datatype-datetime.html).

Calon index mengikuti pola query nyata, misalnya `(plant_code, measured_at)` atau
`(device_id, measured_at)` untuk filter satu entitas dan rentang waktu, serta index
alarm menurut plant/state/waktu. Periksa index lama dan query plan sebelum menambah
index. Urutan kolom memengaruhi pemakaian index gabungan; lihat
[multicolumn indexes PostgreSQL](https://www.postgresql.org/docs/current/indexes-multicolumn.html).
Tentukan unique key ingest menurut identitas sumber/measurement agar retry tidak
menggandakan sampel. Partisi dan materialisasi bukan kewajiban awal; tentukan dari
volume, retensi, dan hasil pengukuran kinerja.

## 4. Informasi yang dibutuhkan dari tim backend dan pemilik sistem

| Informasi | Alasan |
| --- | --- |
| Repository/source BE, framework/versi, Swagger terbaru, ERD/DDL dan migration saat ini | Menentukan implementasi yang sudah ada, field yang perlu dipetakan, serta migration minimum. Dump struktur tanpa isi produksi cukup untuk tahap desain. |
| Contoh payload sumber yang disamarkan: plant, inverter, meter, ESS, string/optimizer, alarm | Membuktikan ketersediaan field sebelum menjanjikan grafik/diagnosis/operasi tulis. Jangan kirim token/password/vendor secret. |
| Dokumentasi API vendor, hak akses akun, model/firmware perangkat yang dipakai | Menentukan kemampuan telemetry string, clear/reset, rename dan set parameter; daftar perangkat saja tidak membuktikan kemampuan endpoint. |
| Pemetaan plant_code, ID vendor, device ID/SN, parent, MPPT, string, optimizer | Menghubungkan master, telemetry, layout, alarm, dan laporan tanpa salah perangkat. |
| Definisi metrik dan konvensi arah daya | Pastikan impor/ekspor dan charge/discharge bertanda konsisten; bedakan counter energi, energi interval, daya AC/DC, serta beban netto/gross. |
| Timezone setiap PLTS, arti timestamp lama, sumber measured_at, interval polling, batas stale | Menentukan hari laporan, freshness, coverage, dan migrasi waktu yang benar. |
| Tarif beserta masa berlaku, energi eligible, definisi revenue versus savings | Mengisi Revenue Trend/Report; jangan mengalikan seluruh yield dengan satu tarif asumsi. |
| Faktor lingkungan dan definisi PR/CV/cohort yang disetujui | Menetapkan metode, unit, normalisasi, threshold, versi, dan syarat data layak dibandingkan. CV tidak otomatis menjadi vonis kerusakan. PR memerlukan basis irradiation/energi yang sesuai. |
| Arti Clear alarm, sinkronisasi rename, ownership layout, dan workflow O&M | Memisahkan perubahan lokal, acknowledgment, perintah vendor, serta work order. |
| Identitas pengguna, autentikasi/SSO, role dan akses PLTS | Tentukan viewer/operator/admin dan hak baca/tulis setiap operasi. Swagger yang diperiksa belum membuktikan mekanisme identitas tersebut telah tersedia. |
| Jumlah PLTS/perangkat/string, sampel per hari, retensi/backfill dan target waktu respons | Menentukan pagination, batas query/export, index, agregasi dan kapasitas storage. |
| Format serta jadwal laporan, penerima, kanal pengiriman, penyedia layanan | Membuat subscription dan export dengan timezone, scope, status pengiriman yang jelas. |
| Lingkungan development/staging, origin FE yang diizinkan CORS, akses sandbox dan akun uji | Menguji integrasi dengan sumber yang benar tanpa mengubah perangkat produksi. |

Prioritas informasi pertama: **DDL/ERD aktual, contoh payload yang disamarkan,
dokumentasi kemampuan vendor, pemetaan ID, serta definisi waktu dan metrik**.
Setelah itu sepakati kontrak endpoint dan lakukan migration yang diperlukan.

## 5. Urutan pekerjaan dan kriteria selesai

1. **Validasi yang sudah tersedia:** cek data dan coverage pada overview, metadata,
   yield-statistics, summary, devices, serta alarms; jangan membuat route duplikat.
2. **Integrasi FE ke API yang ada:** summary/rankings, metadata asli dan field
   perangkat baru. Add Plant/PATCH memerlukan form dan izin yang sesuai.
3. **Lengkapi monitoring baca:** range daya, energi grid/load, laporan inverter,
   revenue bila sumber/tarif tersedia. Pertahankan kontrak statistik yield yang sudah dipakai.
4. **CV dan layout bersama:** lengkapi mapping/telemetry, implementasikan kontrak CV,
   aktifkan `VITE_CV_ANALYSIS_PATH`, lalu integrasikan penyimpanan layout server.
5. **Operasi lanjutan:** rename, parameters, alarm actions, subscription, O&M dan cuaca
   sesuai dukungan sumber serta prioritas produk. Endpoint baru memerlukan adapter FE;
   menyelesaikan BE saja tidak otomatis mengaktifkan tombol/kolom placeholder.

Kriteria penerimaan utama:

- `0` tetap nilai nol yang valid; unknown/tidak tersedia memakai null dan alasan.
- Timestamp measurement tidak diganti timestamp collector untuk membuat data tampak baru.
- Summary mencakup seluruh scope/filter, bukan satu halaman hasil tabel.
- Statistik memakai energi interval dan mengakui gap, reset counter, pending serta partial.
- Riwayat tanggal lama dapat diminta berdasarkan range, bukan diasumsikan tercakup 500 sampel.
- Firmware/parent/perangkat/string yang tidak diketahui tetap null; mapping tidak ditebak.
- CV dan revenue dapat ditelusuri ke input/metode/cohort atau tarif berversi.
- Mutasi diverifikasi terhadap kepemilikan PLTS dan hasil sumber; hasil antrean dan hasil perangkat dibedakan.
- Swagger memiliki schema dan contoh loading/empty/missing/partial/error yang konsisten;
  uji FE-BE mencakup timezone, pagination, permission, data tidak tersedia, dan retry.
