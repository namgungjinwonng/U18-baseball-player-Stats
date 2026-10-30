// 야구장 현황 지도 — Leaflet + OpenStreetMap 무료 타일. 목록의 야구장을 점으로 찍고, 고른 곳을 크게 표시해 그 위치로 옮긴다.
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Field } from "./types";

const KOREA: L.LatLngBoundsExpression = [[33.0, 124.6], [38.7, 131.0]];

interface Props {
  fields: Field[]; // 지금 목록에 보이는 야구장
  selected: Field | null;
  onSelect: (f: Field) => void;
}

export default function FieldsMap({ fields, selected, onSelect }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!box.current || map.current) return;
    const m = L.map(box.current, { zoomControl: true, attributionControl: true }).fitBounds(KOREA);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  // 목록이 바뀌면 점을 다시 찍고 목록 전체가 보이게 맞춘다(고른 곳이 있으면 그곳으로).
  useEffect(() => {
    const m = map.current, g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    for (const f of fields) {
      const on = selected?.id === f.id;
      const label = document.createElement("span");
      label.textContent = f.name; // 외부 시설명을 HTML로 해석하지 않는다.
      L.circleMarker([f.lat, f.lon], {
        radius: on ? 9 : 5, weight: on ? 3 : 1, color: on ? "#111111" : "#ffffff",
        fillColor: on ? "#d43f21" : f.approx ? "#9aa0a6" : "#1151ff", fillOpacity: on ? 1 : 0.85,
      }).bindTooltip(label).on("click", () => onSelect(f)).addTo(g);
    }
    if (selected) m.setView([selected.lat, selected.lon], Math.max(m.getZoom(), 15));
    else if (fields.length) m.fitBounds(L.latLngBounds(fields.map((f) => [f.lat, f.lon] as [number, number])).pad(0.15), { maxZoom: 14 });
  }, [fields, selected, onSelect]);

  return <div ref={box} className="fields-map" role="img" aria-label={selected ? `${selected.name} 위치 지도` : "야구장 위치 지도"} />;
}
