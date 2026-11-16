# Kebutuhan API — Reports

Tanggal analisis: 16 November 2026.

Halaman Reports mengikuti referensi UI: menu Reports, sidebar pencarian/pemilihan
PLTS, Plant Report, Inverter Report, PCS Report, Battery Report, dan PV&ESS Report.
Filter periode diterapkan melalui Search; tabel mempunyai sorting, pengaturan
kolom, pagination 10/20/50, Subscribe dan Export CSV.

Status di bawah mengacu pada adapter FE dan audit Swagger 12 November di
[catatan integrasi](backend-integration.md). Pemeriksaan ulang ke
`http://127.0.0.1:8000/openapi.json` pada sesi ini tidak berhasil karena server
tidak dapat dihubungi. **Endpoint usulan belum dinyatakan tersedia.**

## Tabel API yang perlu disiapkan BE

| Prioritas | Fitur | Method dan endpoint | Status berdasarkan repo | Parameter/filter yang dibutuhkan | Data minimum yang dikembalikan |
| --- | --- | --- | --- | --- | --- |
| P0 | Daftar dan pilihan PLTS | `GET /api/database/plants` | Sudah digunakan FE | `search`, `page`, `page_size`; scope izin pengguna | `plant_code`, `plant_name`, `time_zone`, `region`, `has_pv`, `has_ess`; `total`, kelengkapan inventory. FE saat ini memakai daftar PLTS yang telah dimuat portofolio. |
| P1 | Hierarki organisasi pada sidebar | `GET /api/report-scopes` | Usulan opsional jika tree harus sama seperti referensi | `parent_id`, `search`, `page`, `page_size` | `id`, `parent_id`, `type` (`organization`, `group`, `plant`), `name`, `plant_code`, `has_children`, `total`. Hierarki harus berasal dari relasi master; nama grup tidak ditebak dari nama PLTS. |
| P0 | Pilihan perangkat | `GET /api/devices/{plant_code}` | Sudah digunakan untuk inventory inverter | PLTS; perlu dukungan filter `device_type=inverter\|pcs\|battery\|pv_ess`, pagination bila diperlukan | ID stabil/vendor ID, `device_name`, `device_sn`, tipe eksplisit, `plant_code`, parent/mapping. Normalizer FE saat ini belum mengenali tipe PCS/Battery/PV&ESS; perlu diperluas setelah kontrak disepakati. |
| P0 | Plant Report | `GET /api/reports/plants` | Usulan; FE sekarang menggabungkan yield-statistics dan laporan inverter per PLTS | `plant_code` atau scope portofolio, `dimension=time\|plant`, `from`, `to`, `grain`, `time_zone`, `sort_by`, `sort_order`, `page`, `page_size` | Identitas PLTS, batas bucket/periode, `pv_yield_kwh`, `inverter_yield_kwh`, `grid_export_kwh`, `revenue_idr`, kualitas per metrik, coverage, `total` sebelum pagination. |
| P0 | Inverter Report | `GET /api/reports/inverters` | Sudah digunakan, tetapi format saat ini adalah energi **per interval perangkat** | Pertahankan kontrak existing. Tambahkan mode eksplisit, misalnya `dimension=device`, filter PLTS/portofolio, `device_id`, periode, sorting dan pagination | Mode device: satu baris per inverter untuk periode pilihan; `plant_name`, `device_id`, `device_name`, `device_sn`, `total_string_capacity_kwp`, `yield_kwh`, `total_yield_kwh`, `specific_energy_kwh_per_kwp`, `peak_ac_power_kw`, kualitas tiap field. Jangan mengganti arti response interval tanpa versi/mode baru. |
| P0 | PCS Report | `GET /api/reports/pcs` | Usulan | Scope PLTS/portofolio, `device_id`, periode, timezone, sorting dan pagination | Satu baris per PCS: identitas PLTS/perangkat, `discharge_kwh`, `total_yield_kwh`, `peak_ac_power_kw`, `charge_kwh`; batas pengukuran AC/DC, arah energi, arti counter lifetime, kualitas/coverage. |
| P0 | Battery Report | `GET /api/reports/batteries` | Usulan | Scope PLTS/portofolio, `dimension=site\|device`, `device_id` opsional, periode, timezone, sorting dan pagination | Site: `plant_code`, `plant_name`, `charge_kwh`, `discharge_kwh`. Device: tambah ID/nama/SN baterai. Sertakan kualitas dan kelengkapan agregasi; jangan menghitung PCS dan baterai dua kali. |
| P0 | PV&ESS Report | `GET /api/reports/pv-ess` | Usulan | Scope PLTS/portofolio, `device_id`, periode, timezone, sorting dan pagination | Identitas perangkat hybrid yang eksplisit; kolom sesuai referensi: `total_string_capacity_kwp`, `yield_kwh`, `total_yield_kwh`, `specific_energy_kwh_per_kwp`, `peak_ac_power_kw`. BE perlu mendefinisikan yield sebagai produksi PV atau output AC perangkat hybrid agar discharge ESS tidak dihitung sebagai produksi PV baru. |
| P1 | Subscribe laporan | `GET, POST /api/report-subscriptions`; `PATCH, DELETE /api/report-subscriptions/{id}` | Usulan; tombol FE sekarang membuka informasi ketersediaan | Jenis report, scope/filter, penerima, format, cadence, jam kirim, timezone, status aktif | ID langganan, konfigurasi tersimpan, `next_run_at`, status serta hasil pengiriman. Memerlukan worker scheduler, izin penerima, retry, dan pencatatan pengiriman. |
| P1 | Ekspor laporan besar | `POST /api/report-exports`; `GET /api/report-exports/{job_id}` | Usulan opsional; CSV FE tersedia untuk laporan yang sudah dimuat | Filter/scope/sorting yang sama dengan Search, kolom aktif, `format=csv\|xlsx`, identitas snapshot | `job_id`, `status`, `row_count`, masa berlaku dan URL unduhan berizin saat selesai, error bila gagal. Ekspor seluruh hasil filter, bukan hanya satu halaman tabel. |

P0 adalah kebutuhan untuk mengisi kelima report dengan data nyata. P1 melengkapi
hierarki, otomatisasi, dan skala besar. Tidak semua usulan harus menjadi endpoint
terpisah: satu endpoint report berjenis dapat dipakai jika kontrak dan validasi
scope/metrik tetap jelas.

## Kolom dan arti metrik per report

| Report / kolom UI | Field API | Arti dan aturan |
| --- | --- | --- |
| Plant — Statistical Period | `start_at`, `end_at`, `time_zone` | Batas bucket dari BE; tampilkan waktu lokal laporan. Dimension By plant menghasilkan satu baris per PLTS untuk seluruh periode. |
| Plant — PV Yield | `pv_yield_kwh` | Energi PV interval; counter reset, baseline dan gap ditangani BE. |
| Plant — Inverter Yield | `inverter_yield_kwh` | Energi output inverter pada periode yang sama; tidak menggantikan PV Yield. |
| Plant — Export | `grid_export_kwh` | Energi terukur yang dikirim ke jaringan; bukan nilai absolut dari daya jaringan sesaat. |
| Plant — Revenue | `revenue_idr` | Nilai periode dari energi eligible dan tarif/metode berversi. Sertakan `currency`, komponen pendapatan/penghematan, serta `tariff_version`. |
| Inverter / PV&ESS — Total String Capacity | `total_string_capacity_kwp` | Kapasitas panel DC yang benar-benar dipetakan ke perangkat; bukan kapasitas seluruh PLTS atau rating inverter AC. |
| Inverter / PV&ESS — Yield | `yield_kwh` | Jumlah energi interval yang layak untuk periode pilihan. Ada penanda partial jika cakupan belum lengkap. |
| Inverter / PCS / PV&ESS — Total Yield | `total_yield_kwh`, `counter_at` | Counter lifetime pada batas/as-of yang dijelaskan kontrak; bukan jumlah counter harian dan bukan jumlah Yield periode yang diberi label lifetime. |
| Inverter / PV&ESS — Specific Energy | `specific_energy_kwh_per_kwp` | Yield periode dibagi kapasitas string perangkat yang valid. Kapasitas nol/tidak diketahui menghasilkan null. |
| Inverter / PCS / PV&ESS — Peak AC Power | `peak_ac_power_kw`, `peak_at` | Maksimum daya aktif AC terverifikasi dalam periode; tidak diturunkan dari kWh, rating perangkat, atau rata-rata daya. Jelaskan resolusi sampling. |
| PCS / Battery — Charge dan Discharge | `charge_kwh`, `discharge_kwh` | Energi dua arah dipisah, bernilai nonnegatif, dengan batas meter AC/DC dan aturan arah eksplisit. Charge/discharge tidak disimpulkan dari SOC. |

## Kontrak umum untuk Search, tabel, dan Export

| Bagian | Persyaratan |
| --- | --- |
| Waktu | `from` inklusif, `to` eksklusif, keduanya ISO 8601 dengan offset/UTC. `time_zone` adalah IANA timezone. Default per PLTS mengikuti master; laporan lintas PLTS harus menyatakan timezone laporan yang digunakan. |
| Granularitas | By day memilih satu tanggal dengan bucket jam untuk Plant By time; By month memilih bulan dengan bucket hari; By year memilih tahun dengan bucket bulan; By lifecycle memakai bucket tahun. Report perangkat/site menghasilkan agregat seluruh periode, satu baris per entitas. |
| Scope All | Hilangnya `plant_code` hanya boleh berarti semua PLTS yang diizinkan pengguna dalam scope eksplisit. Backend mengerjakan agregasi/sorting/pagination untuk scope itu; FE tidak mengirim ratusan request per PLTS untuk meniru laporan portofolio. |
| Metadata response | `success`, `data`, `configured`, `from`, `to`, `time_zone`, `dimension`, `grain`, `units`, `total`, `page`, `page_size`, `complete`, `truncated`, `meta.is_partial`, `meta.warnings`; `snapshot_id` untuk kestabilan pagination/export. |
| Kualitas per field | `quality`, `reason`, `valid_samples`, `expected_samples` atau coverage ekuivalen. Bedakan `measured`, `derived`, `partial`, `missing`, `pending`, `unconfigured`, `not_applicable`. Sertakan cakupan perangkat untuk agregat site/plant. |
| Nol vs tidak tersedia | Nol terukur tetap `0`. Unknown/tidak dikonfigurasi memakai `null` dan alasan. `data: []` dengan `configured: true` dan scope terverifikasi berarti tidak ada hasil; sumber unconfigured bukan bukti total nol. |
| Sorting/pagination | `total` dihitung sebelum pagination sesudah filter. Sorting stabil dengan ID sebagai tie-breaker; unknown selalu terakhir. UI menampilkan 10/20/50 baris. Batas server, truncation dan perubahan snapshot harus eksplisit. |
| Format angka | Angka JSON tidak memakai pemisah ribuan; FE menampilkan energi/kapasitas/daya 3 desimal dan Rupiah 2 desimal sesuai referensi. |
| Error | `400/422` untuk filter tidak valid, `401/403` untuk akses, `404` entitas tidak ada, `409` konflik snapshot/subscription, `503` sumber sementara gagal; body error konsisten. |
| Export | Scope, periode, timezone, urutan, kolom, null dan kualitas sama dengan tabel. File tidak boleh diam-diam hanya berisi halaman aktif. |

## Perilaku FE yang sudah dibuat

- Reports pada navigasi utama membuka halaman terpisah; dropdown dan tab memilih
  lima jenis report. Menu ditutup lewat klik di luar, Escape, atau perpindahan fokus.
- Sidebar memakai PLTS aktual dan grup region jika tersedia; pencarian dan
  pemilihan scope tidak membuat organisasi/perangkat fiktif.
- Plant Report memakai `yield-statistics` dan `reports/inverters` untuk PLTS
  pilihan. By plant menjumlahkan energi periode PLTS tersebut.
- Inverter Report menjumlahkan **energi interval per inverter** untuk periode
  pilihan. Kolom kapasitas, lifetime yield, specific energy dan peak power tetap
  `--` sampai sumber kontraknya tersedia.
- Scope All menampilkan tampilan awal dan petunjuk memilih PLTS; agregat
  portofolio belum tersedia di adapter ini. Total yang belum diketahui memakai `--`.
- PCS, Battery dan PV&ESS mempunyai filter/kolom/empty state sesuai referensi;
  tidak ada request ke path usulan sebelum integrasi disepakati.
- Subscribe hanya membuka dialog informasi. Tidak membuat jadwal atau
  mengirim pesan. Export diaktifkan untuk hasil Plant/Inverter yang telah dimuat.

## Urutan integrasi berikutnya

| Urutan | Pekerjaan BE | Pekerjaan FE setelah kontrak siap |
| --- | --- | --- |
| 1 | Sepakati scope All, mode interval vs device, waktu, kualitas dan skema report | Tambah adapter tervalidasi tanpa merusak adapter interval existing. |
| 2 | Lengkapi Plant/Inverter Report, terutama export energy, revenue dan metrik perangkat | Hubungkan seluruh kolom serta filtering/sorting/pagination portofolio. |
| 3 | Sediakan PCS/Battery/PV&ESS beserta tipe dan mapping inventory | Aktifkan pemilih perangkat dan data ketiga tab. |
| 4 | Sediakan subscription, hierarki organisasi dan export job bila dibutuhkan | Aktifkan alur berlangganan, tree organisasi dan unduhan server. |

Penerimaan integrasi mencakup pergantian report/PLTS saat request masih berjalan,
timezone dan batas tanggal, nol vs null, data parsial, scope izin, semua halaman
export, identitas perangkat stabil, serta agregasi yang tidak menggandakan energi.
