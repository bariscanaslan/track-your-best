"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Props {
  lat: number;
  lon: number;
}

export default function AnomalyMiniMap({ lat, lon }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [lat, lon],
      zoom: 13,
      zoomControl: false,
      scrollWheelZoom: false,
      dragging: false,
      touchZoom: false,
      doubleClickZoom: false,
      keyboard: false,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    const icon = L.divIcon({
      className: "",
      html: `<div style="
        width:18px;height:18px;border-radius:50%;
        background:#ef4444;border:3px solid #fff;
        box-shadow:0 2px 8px rgba(0,0,0,0.35);
      "></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    L.marker([lat, lon], { icon }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [lat, lon]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", minHeight: 180 }}
    />
  );
}
