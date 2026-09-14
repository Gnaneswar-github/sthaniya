"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { dayColor } from "@/lib/day-colors";
import type { Trip } from "@/lib/types";

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] ?? ch);

/**
 * The trip on a map: numbered stops per day in that day's colour, joined in visiting order.
 * Leaflet loads only on the client and only when the map is actually shown; tiles are
 * OpenStreetMap's, credited as its licence asks.
 */
export function TripMap({
  trip,
  focusDay,
  activeItem,
  onSelect,
}: {
  trip: Trip;
  focusDay: number | "all";
  activeItem: string | null;
  onSelect?: (itemId: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const lib = useRef<typeof Leaflet | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const layer = useRef<Leaflet.LayerGroup | null>(null);
  const lastFit = useRef("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((module) => {
      if (cancelled || !container.current || map.current) return;
      const L = ((module as unknown as { default?: typeof Leaflet }).default ?? module) as typeof Leaflet;
      lib.current = L;
      const instance = L.map(container.current, { scrollWheelZoom: false, zoomControl: true });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(instance);
      layer.current = L.layerGroup().addTo(instance);
      map.current = instance;
      setReady(true);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      layer.current = null;
      lastFit.current = "";
    };
  }, []);

  useEffect(() => {
    const L = lib.current;
    const instance = map.current;
    const group = layer.current;
    if (!ready || !L || !instance || !group) return;

    group.clearLayers();
    const bounds: [number, number][] = [];

    trip.days.forEach((day, dayIndex) => {
      if (focusDay !== "all" && focusDay !== dayIndex) return;
      const color = dayColor(dayIndex);
      const located = day.items.filter((item) => item.place.coords);
      const path = located.map((item) => [item.place.coords!.lat, item.place.coords!.lng] as [number, number]);
      if (path.length > 1) L.polyline(path, { color, weight: 3, opacity: 0.8, dashArray: "6 8" }).addTo(group);

      located.forEach((item) => {
        const stop = day.items.indexOf(item) + 1;
        const active = item.itemId === activeItem;
        const position: [number, number] = [item.place.coords!.lat, item.place.coords!.lng];
        const marker = L.marker(position, {
          icon: L.divIcon({
            className: "nv-marker-wrap",
            html: `<span class="nv-marker${active ? " is-active" : ""}" style="background:${color}">${stop}</span>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          }),
          title: item.place.name,
          keyboard: true,
          zIndexOffset: active ? 1000 : 0,
        });
        marker.bindTooltip(`Day ${dayIndex + 1} · ${escapeHtml(item.place.name)}`, { direction: "top", offset: [0, -14] });
        if (onSelect) marker.on("click", () => onSelect(item.itemId));
        marker.addTo(group);
        bounds.push(position);
      });
    });

    // Refit only when the set of stops changes, not on every hover.
    const fitKey = `${focusDay}|${bounds.map((b) => b.join(",")).join(";")}`;
    if (bounds.length > 0 && fitKey !== lastFit.current) {
      lastFit.current = fitKey;
      instance.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 16, animate: false });
    }
  }, [ready, trip, focusDay, activeItem, onSelect]);

  return (
    <div className="relative h-full w-full bg-paper-sunken">
      <div ref={container} className="h-full w-full" role="region" aria-label="Map of your trip" />
      {!ready && (
        <div className="shimmer absolute inset-0 grid place-items-center text-sm text-ink-faint">Loading map…</div>
      )}
    </div>
  );
}
