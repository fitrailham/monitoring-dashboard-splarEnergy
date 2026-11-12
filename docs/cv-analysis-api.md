# Kontrak integrasi halaman Coefficient of Variation Analysis

Dokumen ini adalah kontrak frontend yang disiapkan untuk integrasi. Endpoint ini
belum dinyatakan tersedia pada backend proyek. Jangan mengisi hasil dengan fixture
di produksi. Inventory perangkat bukan pengganti telemetry analisis.

## Mengaktifkan adapter

Isi `.env` setelah endpoint backend tersedia, kemudian restart Vite:

```dotenv
VITE_CV_ANALYSIS_PATH=/api/database/cv-analysis
```

Path di atas hanya contoh. Adapter menggunakan base URL `VITE_API_URL` dan path
relatif yang dikonfigurasi. Jika path kosong, halaman menampilkan Unavailable,
tanpa memanggil endpoint CV lain atau menghitung dari history agregat PLTS.

## Request

```text
GET {configured_path}?plant_code=P1&analysis_type=inverter&from=2026-11-11T17%3A00%3A00.000Z&to=2026-11-12T17%3A00%3A00.000Z&time_zone=Asia%2FJakarta
```

| Parameter | Ketentuan |
| --- | --- |
| `plant_code` | PLTS yang dipilih, dalam scope akses pengguna |
| `analysis_type` | `inverter` atau `string` |
| `from`, `to` | Batas timestamp offset-aware, inklusif/eksklusif |
| `time_zone` | Zona untuk bucket tanggal kalender |
| `device_id` | Opsional; membatasi detail perangkat, bukan membentuk cohort satu anggota |

Rentang tanggal UI maksimum 366 hari inklusif. Backend tetap perlu memvalidasi
otorisasi, batas rentang, pemetaan perangkat/string, dan jumlah data.

## Respons ilustratif

Semua nama dan angka berikut fixture dokumentasi, bukan hasil pengukuran.
Contoh ini menggambarkan dua anggota dalam satu group pada satu tanggal.

```json
{
  "success": true,
  "data": {
    "plant_code": "P1",
    "analysis_type": "inverter",
    "from": "2026-11-11T17:00:00.000Z",
    "to": "2026-11-12T17:00:00.000Z",
    "time_zone": "Asia/Jakarta",
    "metric": "normalized_power",
    "unit": "kW/kWp",
    "method": "population_stddev_over_mean_percent",
    "comparison_basis": "Example only: matched model, capacity normalization and operating window",
    "complete": true,
    "rows": [
      {
        "date": "2026-11-12",
        "device_id": "INV1",
        "device_name": "Example inverter 1",
        "device_sn": "EXAMPLE-001",
        "string_id": null,
        "comparison_group": "EXAMPLE-GROUP-A",
        "mean_value": 0.5,
        "stddev_value": 0.05,
        "comparable_count": 2,
        "cv_percent": 10,
        "deviation_percent": -10,
        "average_current_a": null,
        "average_voltage_v": null,
        "quality": "derived",
        "reason": null
      },
      {
        "date": "2026-11-12",
        "device_id": "INV2",
        "device_name": "Example inverter 2",
        "device_sn": "EXAMPLE-002",
        "string_id": null,
        "comparison_group": "EXAMPLE-GROUP-A",
        "mean_value": 0.5,
        "stddev_value": 0.05,
        "comparable_count": 2,
        "cv_percent": 10,
        "deviation_percent": 10,
        "average_current_a": null,
        "average_voltage_v": null,
        "quality": "derived",
        "reason": null
      }
    ]
  },
  "meta": { "is_partial": false }
}
```

## Makna dan validasi field

- Satu row adalah anggota cohort pada satu tanggal: inverter atau string yang
  diidentifikasi dengan `device_id` dan `string_id`. Untuk analisis string,
  `string_id` wajib. Identitas `[date, device_id, string_id, comparison_group]` unik.
- `comparison_group` mengidentifikasi cohort yang dinyatakan sebanding oleh backend.
  Statistik mean/stddev/count/CV untuk group dan tanggal yang sama harus konsisten.
  `comparable_count` menghitung anggota pembanding fisik yang valid, bukan jumlah
  rekaman telemetry atau jam dalam satu hari.
- `metric`, `unit`, `method`, dan `comparison_basis` wajib menjelaskan normalisasi,
  window, satuan, serta metode standar deviasi. Contoh dokumen bukan rekomendasi
  algoritma vendor atau bukti bahwa perangkat tertentu memiliki lingkungan identik.
- CV persentase diperiksa sebagai `100 × stddev_value / mean_value`, dengan mean
  positif, standar deviasi non-negatif, minimal dua anggota, dan nilai numerik finite.
  Toleransi konsistensi respons adalah 0,05 poin persentase untuk pembulatan.
- Mean nol, pembanding kurang dari dua, quality missing/unknown, nilai negatif CV,
  atau rasio statistik yang tidak konsisten menghasilkan CV -- dan coverage parsial.
  CV 0 dengan mean positif dan standar deviasi 0 tetap merupakan nilai valid.
- `deviation_percent` adalah nilai signed per anggota yang dihitung backend.
  Frontend tidak menghitungnya dari yield/kW portofolio.
- String mode dapat menyediakan `average_current_a` dan `average_voltage_v` dari
  pengukuran yang sesuai. Null tetap --, bukan nol atau bukti string terputus.
- `quality`: `measured`, `derived`, `partial`, atau `missing`. Alasan gap/invalid
  ditempatkan pada `reason`. Flag `complete` dan `meta.is_partial` harus jujur
  terhadap cakupan periode, anggota, missing data, dan pemotongan respons.
- Grafik trend memakai CV group per tanggal, bukan rata-rata CV beberapa group.
  Ketidakkonsistenan statistik anggota menyebabkan batang group/tanggal kosong.
- Histogram mengelompokkan jumlah row dalam 0–5%, >5–10%, >10–20%, >20%.
  Rentang ini adalah pilihan tampilan dan tidak memberi status kerusakan otomatis.

Backend sebaiknya menolak input tidak valid dengan 422 dan mengembalikan error
bermakna pada 404/503. Jangan mengirim data nol untuk menyembunyikan kegagalan.

## Referensi metode dan alur

- Struktur dua jenis analisis dan drilldown diinformasikan oleh
  [panduan monitoring Huawei, bagian 5.8](https://info.support.huawei.com/Energy/info/en_US/solar/docView/EDOC1100612098).
  Implementasi ini tidak meniru atau mengklaim algoritma diagnosis proprietary.
- Definisi rasio standar deviasi terhadap mean mengacu pada
  [NIST](https://www.itl.nist.gov/div898/software/dataplot/refman1/auxillar/coefvate.htm).
  Adapter memakai rasio tersebut dalam persen untuk metric PV dengan mean positif;
  pilihan population/sample serta eligibility tetap ditetapkan backend.
  Mean mendekati nol perlu kehati-hatian interpretasi.
