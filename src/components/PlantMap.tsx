import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Plant } from "../services/fleet";
import { format, number, status } from "../services/fleet";
import Icon from "./Icon";

export default function PlantMap({
  plants,
  onSelect,
  overview = false,
}: {
  plants: Plant[];
  onSelect: (plant: Plant) => void;
  overview?: boolean;
}) {
  const element = useRef<HTMLDivElement>(null),
    mapRef = useRef<L.Map | null>(null),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [tilesFailed, setTilesFailed] = useState(false);
  const matches = useMemo(
    () =>
      plants.filter((p) =>
        `${p.plant_name} ${p.address ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [plants, query],
  );
  const located = useMemo(
    () =>
      matches.filter((p) => {
        const lat = number(p.latitude),
          lng = number(p.longitude);
        return (
          lat !== null &&
          lng !== null &&
          Math.abs(lat) <= 90 &&
          Math.abs(lng) <= 180
        );
      }),
    [matches],
  );
  useEffect(() => {
    if (!element.current) return;
    const map = L.map(element.current, {
      zoomControl: false,
      minZoom: 2,
      maxZoom: 18,
    }).setView(overview ? [-2.4, 118] : [8, 72], overview ? 5 : 3);
    mapRef.current = map;
    L.tileLayer(
      import.meta.env.VITE_MAP_TILE_URL ||
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      },
    )
      .on("tileerror", () => setTilesFailed(true))
      .addTo(map);
    L.control.zoom({ position: "bottomleft" }).addTo(map);
    L.control.scale({ position: "bottomleft", imperial: false }).addTo(map);
    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(element.current);
    return () => {
      resize.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [overview]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layer = L.layerGroup().addTo(map);
    for (const plant of located) {
      const button = document.createElement("button");
      button.className = "map-popup-link";
      button.textContent = plant.plant_name;
      button.addEventListener("click", () => onSelect(plant));
      const position: L.LatLngExpression = [number(plant.latitude)!, number(plant.longitude)!];
      const marker = overview ? L.marker(position, { icon: L.divIcon({
        className: `command-marker ${status(plant)}`,
        html: '<span><i></i></span>', iconSize: [32, 42], iconAnchor: [16, 42],
      }) }) : L.circleMarker(position, {
        radius: 10,
        color: "#bf56ff",
        fillColor: "#a62cff",
        fillOpacity: 0.85,
        weight: 5,
      });
      marker
        .bindPopup(button)
        .addTo(layer);
    }
    if (located.length)
      map.fitBounds(
        L.latLngBounds(
          located.map(
            (p) =>
              [number(p.latitude)!, number(p.longitude)!] as [number, number],
          ),
        ),
        overview && map.getSize().x > 1100
          ? { paddingTopLeft: [340, 100], paddingBottomRight: [340, 100], maxZoom: 8 }
          : { padding: [80, 80], maxZoom: overview ? 8 : 12 },
      );
    return () => {
      map.removeLayer(layer);
    };
  }, [located, onSelect, overview]);
  return (
    <section className="map-view">
      <div
        className="leaflet-map"
        ref={element}
        aria-label="Peta lokasi PLTS"
      />
      <form
        className="map-search"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search.trim());
        }}
      >
        <span>All plants</span>
        <input
          aria-label="Cari lokasi PLTS"
          placeholder="Enter a plant name or region"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button aria-label="Cari di peta" type="submit">
          <Icon name="search" />
        </button>
      </form>
      <aside className="map-plants">
        <div className="map-panel-heading">
          <div>
            <span className="eyebrow">PLANT LOCATIONS</span>
            <h2>{matches.length} plants in your portfolio</h2>
          </div>
          <Icon name="pin" />
        </div>
        <div className="map-location-note">
          <Icon name="info" size={17} />
          <span>
            {located.length
              ? `${located.length} PLTS memiliki koordinat lokasi.`
              : "Koordinat lokasi belum tersedia dari backend. Alamat PLTS tetap dapat dilihat di bawah."}
          </span>
        </div>
        <div className="map-plant-list">
          {matches.map((p) => (
            <button key={p.plant_code} onClick={() => onSelect(p)}>
              <img src="/solar-plant.svg" alt="" />
              <div>
                <strong>{p.plant_name}</strong>
                <span>{p.address || "Alamat belum tersedia"}</span>
                <small>{format(p.capacity_kwp)} kWp</small>
              </div>
              <Icon name="chevron" size={15} />
            </button>
          ))}
          {!matches.length && (
            <p className="empty-copy">
              Tidak ada PLTS yang cocok dengan pencarian.
            </p>
          )}
        </div>
        <div className="map-panel-footer">
          <span>{located.length} mapped</span>
          <span>{matches.length - located.length} without coordinates</span>
        </div>
      </aside>
      {tilesFailed && (
        <div className="map-tile-warning" role="status">
          Sebagian peta belum termuat. Periksa koneksi internet.
        </div>
      )}
      <div className="map-disclaimer">
        <Icon name="info" size={14} />
        Lokasi ditampilkan hanya jika koordinat tersedia.
      </div>
    </section>
  );
}
