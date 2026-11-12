# Integrasi frontend dengan icongreen-backend-python

Kontrak diperiksa dari `http://127.0.0.1:8000/openapi.json` dan source backend
lokal. Perubahan ini hanya pada frontend; tidak menjalankan migration atau
menulis data produksi selama verifikasi.

| Bagian | Integrasi |
| --- | --- |
| Home List/Map | Overview dan metadata tetap mengambil seluruh scope tanpa pagination server agar peta/summary fallback tidak hanya mencakup satu halaman. Country/region, PV/ESS, foto dan optimizer kini memakai metadata asli. |
| Summary | Satu request `/api/portfolio/summary` menggantikan permintaan alarm per PLTS. KPI, status, alarm, kapasitas ESS, revenue dan manfaat lingkungan mengikuti nilai/coverage server. Jika summary gagal, ada pesan fallback overview dan alarm menjadi unavailable. |
| KPI ranking | `/api/database/rankings?metric=specific_energy` dengan tanggal/timezone eksplisit. Tidak mengisi ranking kosong dengan tebakan lokal. Ranking total yield pada Dashboard tetap dari seluruh overview, karena API ranking belum menyediakan metric lifetime. |
| Dashboard/Overview/Trend | `/api/database/power-statistics` memakai `from`, `to`, `time_zone`, `resolution_minutes`, `aggregation=last`. Dashboard/Trend memakai 5 menit; Overview 60 menit. Gap dan field unverified tetap null; tidak lagi mengambil 500 history terakhir. |
| Laporan | `/api/reports/inverters` memakai scope PLTS dan ID vendor opsional. Seluruh halaman dimuat sebelum sorting/CSV; duplikasi, perubahan total, dan respons di luar periode/scope ditolak. Batas 50000 baris mengikuti BE. |
| Plant Report | PV Yield tetap dari yield-statistics. Inverter Yield merupakan agregasi laporan inverter per interval dan mempunyai indikator kualitas sendiri. Nilai parsial tidak dianggap lengkap. Export dan Revenue historis tetap null. |
| Performa perangkat | Pilih satu perangkat pada Device Management, lalu Export Performance Data. Dialog menerima rentang inklusif tanggal lokal, maksimum 31 hari. Adapter mengirim vendor device_id dan plant_code, membaca seluruh pagination, memeriksa ID sampel, serta membatasi 100 halaman/100000 sampel per ekspor. Bila batas terlampaui, tidak mengunduh hasil parsial. |
| Administrasi PLTS | Add Plant memakai POST, Edit Plant Metadata memakai PATCH dengan allowlist field sesuai Swagger. Nama/alamat pada mode edit tidak bisa diubah karena bukan field PatchPlant. Token izin tulis diminta pada form, dikirim sebagai Bearer header, dan tidak disimpan di localStorage/env. Backend tetap menentukan 401/403/409/422. |

## Hasil verifikasi

- Adapter langsung ke backend lokal berhasil untuk overview/metadata 111 PLTS,
  summary, 288 bucket daya harian, laporan inverter, ranking, dan riwayat perangkat.
- Sampel yang diuji memiliki coverage daya/laporan parsial, alarm belum dikonfigurasi,
  ranking kosong, dan riwayat perangkat kosong. Ini kondisi sumber, bukan alasan
  untuk menampilkan nol atau membuat telemetry pengganti.
- Operasi POST/PATCH diuji memakai mock fetch: header Authorization, body allowlist,
  scope ID, validasi koordinat/kapasitas, serta larangan menyertakan telemetry.
  Tidak ada PLTS dibuat/diubah sebagai bagian pengujian live.
- Build TypeScript/Vite dan pengujian Node digunakan untuk validasi. Uji visual
  browser belum dapat dilakukan karena tool browser gagal diinisialisasi.

## Yang belum mempunyai endpoint pada Swagger yang diperiksa

CV inverter/string, penyimpanan layout server, module metrics, revenue historis,
energi impor/ekspor/pemakaian sendiri, rename/parameter perangkat, tindakan alarm,
langganan laporan, cuaca, dan work order O&M. Kontrol terkait tetap menyatakan
keterbatasan sebenarnya. `VITE_CV_ANALYSIS_PATH` tetap opsional/kosong sampai API CV
tersedia. Tidak ada token backend yang dimasukkan ke VITE_*.

Referensi kontrak sebelumnya: [checklist backend](backend-development-checklist.md)
dan [kontrak CV](cv-analysis-api.md). Status integrasi aktual pada dokumen ini
menggantikan keterangan "frontend belum memakai" pada audit awal.
