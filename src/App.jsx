import React, { useState, useEffect, useRef, useContext } from "react";
import {
  MapPin, Plus, X, ChevronDown, ChevronUp, ArrowLeft, Search, GripVertical, Flag, Settings,
  Map as MapIcon, BookOpen, Tag, KeyRound, BedDouble, Utensils,
  Link2, Compass, Trash2, PenLine, LayoutGrid, Camera,
  Coffee, ShoppingBag, Mountain, Waves, Ticket, Wine, Landmark, Bike, Music, Car, Fish, IceCreamCone,
} from "lucide-react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay, useDroppable, useDraggable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const STORAGE_KEY = "roadbook:trips";
const GMAPS_KEY_STORAGE = "postmark:gmaps-key";
const STYLE_STORAGE_KEY = "postmark:style-settings";

const DEFAULT_STYLE_SETTINGS = {
  saturate: 0.7,
  steps: 5,
  range: 0,
  titleFill: "#FFFFFF",
  titleStroke: "#2A1509",
  titleStrokeWidth: 3.5,
};

const StyleContext = React.createContext(DEFAULT_STYLE_SETTINGS);

function posterizeTable(steps, range) {
  const n = Math.max(2, Math.round(steps));
  const vals = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    vals.push((range + t * (1 - 2 * range)).toFixed(3));
  }
  return vals.join(" ");
}

const uid = () => Math.random().toString(36).slice(2, 10);

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function arrowify(v) {
  return v.replace(/-->/g, "→");
}
function daysBetween(startStr, endStr) {
  const a = new Date(startStr + "T00:00:00");
  const b = new Date(endStr + "T00:00:00");
  return Math.round((b - a) / 86400000) + 1;
}
function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
function formatDateShort(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Resizes the upload, then nudges it toward an illustrated poster look
// (boosted color + posterized bands) rather than a straight photo.
function resizeImageFile(file, maxWidth = 640, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        try { ctx.filter = "saturate(1.05) contrast(1.0) brightness(1.0)"; } catch (e) { /* ignore */ }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        try {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const d = imgData.data;
          const levels = 4;
          const step = 255 / (levels - 1);
          for (let i = 0; i < d.length; i += 4) {
            d[i] = Math.round(Math.round(d[i] / step) * step);
            d[i + 1] = Math.round(Math.round(d[i + 1] / step) * step);
            d[i + 2] = Math.round(Math.round(d[i + 2] / step) * step);
          }
          ctx.putImageData(imgData, 0, 0);
        } catch (e) { /* skip posterize if unavailable */ }
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function act(where, text) {
  return { id: uid(), kind: "activity", where: where || "", text: text || "" };
}
function pinRef(pinId) {
  return { id: uid(), kind: "pin", pinId };
}
function noteRef(noteId) {
  return { id: uid(), kind: "note", noteId };
}

function makeDay(date, city, blurb, activities, extras) {
  return {
    id: uid(),
    date,
    city,
    blurb,
    activities: activities && activities.length ? activities : [act("", "")],
    stash: {
      hotels: (extras && extras.hotels) || [],
      spots: (extras && extras.spots) || [],
      codes: (extras && extras.codes) || [],
    },
  };
}

// Converts days saved under the old morning/noon/eve/legs shape into the
// unified activities list, so trips already in someone's browser aren't lost.
function migrateDay(day) {
  if (day.activities) return day;
  const activities = [];
  if (day.morning) activities.push(act("Morning", day.morning));
  if (day.noon) activities.push(act("Noon", day.noon));
  if (day.eve) activities.push(act("Evening", day.eve));
  (day.legs || []).forEach((l) => activities.push(act(l.label, l.text)));
  if (activities.length === 0) activities.push(act("", ""));
  const { morning, noon, eve, legs, ...rest } = day;
  return { ...rest, activities };
}
function migrateTrip(trip) {
  let t = { ...trip, days: (trip.days || []).map(migrateDay) };
  if (!t.sections) t = { ...t, sections: [] };
  const hasDayStash = t.days.some((d) => d.stash.hotels.length || d.stash.spots.length || d.stash.codes.length);
  if (hasDayStash) {
    const merged = { hotels: [], spots: [], codes: [] };
    t.days.forEach((d) => {
      merged.hotels.push(...d.stash.hotels);
      merged.spots.push(...d.stash.spots);
      merged.codes.push(...d.stash.codes);
    });
    if (t.type === "single") {
      merged.hotels.unshift(...((t.stash && t.stash.hotels) || []));
      merged.spots.unshift(...((t.stash && t.stash.spots) || []));
      merged.codes.unshift(...((t.stash && t.stash.codes) || []));
      t = { ...t, stash: merged };
    } else {
      const defaultSection = { id: uid(), label: "Trip notes", beforeDayId: t.days[0].id, stash: merged };
      t = { ...t, sections: [defaultSection, ...t.sections] };
    }
    t = { ...t, days: t.days.map((d) => ({ ...d, stash: { hotels: [], spots: [], codes: [] } })) };
  }
  if (!t.stash) t = { ...t, stash: { hotels: [], spots: [], codes: [] } };
  if (!t.notes) t = { ...t, notes: [] };
  if (!t.categories || !t.categories.length) {
    t = { ...t, categories: defaultCategories() };
    const remap = { restaurant: "cat-restaurant", spot: "cat-spot", hotel: "cat-hotel" };
    t = { ...t, pins: (t.pins || []).map((p) => (remap[p.category] ? { ...p, category: remap[p.category] } : p)) };
  }
  t = {
    ...t,
    days: t.days.map((d) => {
      let activities = (d.activities || []).map((a) => (a.kind ? a : { ...a, kind: "activity" }));
      activities = activities.filter((a) => {
        if (a.kind === "pin") { const p = (t.pins || []).find((pp) => pp.id === a.pinId); return p && p.dayId === d.id; }
        if (a.kind === "note") { const n = (t.notes || []).find((nn) => nn.id === a.noteId); return n && n.dayId === d.id; }
        return true;
      });
      const referencedPinIds = new Set(activities.filter((a) => a.kind === "pin").map((a) => a.pinId));
      const referencedNoteIds = new Set(activities.filter((a) => a.kind === "note").map((a) => a.noteId));
      (t.pins || []).forEach((p) => { if (p.dayId === d.id && !referencedPinIds.has(p.id)) activities.push(pinRef(p.id)); });
      (t.notes || []).forEach((n) => { if (n.dayId === d.id && !referencedNoteIds.has(n.id)) activities.push(noteRef(n.id)); });
      return { ...d, activities };
    }),
  };
  return t;
}

function rebuildDays(oldDays, newStart, newCount, type, location) {
  const days = [];
  for (let i = 0; i < newCount; i++) {
    if (oldDays[i]) days.push({ ...oldDays[i], date: addDays(newStart, i) });
    else days.push(makeDay(addDays(newStart, i), type === "single" ? location : "", ""));
  }
  return days;
}

function buildSeedTrip() {
  const start = "2027-06-06";
  const days = [
    makeDay(start, "Vancouver, BC", "Start line — pick up the car and get a feel for the city before the road takes over.",
      [act("Trees Organic Coffee", "Pick up the rental downtown, coffee here first."),
       act("Granville Island Market", "Wander the market, browse the maker stalls."),
       act("Kitsilano Beach / Gastown", "Sunset at the beach, dinner in Gastown.")],
      { hotels: [{ id: uid(), name: "Sylvia Hotel", link: "", note: "Heritage building, ivy-covered, harbor-view rooms book fast." }],
        spots: [{ id: uid(), name: "Capilano Suspension Bridge", link: "", note: "Apparently touristy but the canopy walk looks incredible." }],
        codes: [] }),
    makeDay(addDays(start, 1), "Vancouver → Seattle", "Border day. Short drive, long lunch stop.",
      [act("Peace Arch border crossing", "Aim to leave by 9am to beat lines."),
       act("Fairhaven, Bellingham", "Lunch stop, walk around the historic district."),
       act("Pike Place Market", "Check into Seattle, catch it at golden hour.")],
      { hotels: [{ id: uid(), name: "Ace Hotel Seattle", link: "", note: "Industrial-chic, walkable to the market." }],
        codes: [{ id: uid(), label: "Rental car confirmation", value: "RC-88213" }] }),
    makeDay(addDays(start, 2), "Seattle", "A full day in the city — market, glass, and a rooftop to close it out.",
      [act("Pike Place Market", "First thing when the flower stalls open."),
       act("Chihuly Garden and Glass", "Mid-morning, before it gets busy."),
       act("Capitol Hill", "Dinner, then a rooftop bar after.")],
      { spots: [{ id: uid(), name: "Kerry Park", link: "", note: "Skyline + Space Needle view, apparently best at dusk." }] }),
    makeDay(addDays(start, 3), "Seattle → Portland", "South on the I-5, mountain permitting.",
      [act("Mount Rainier viewpoint", "Stop along I-5 if the weather's clear."),
       act("Olympia", "Lunch stop."),
       act("Powell's Books", "Arrive Portland, go before it closes.")],
      { codes: [{ id: uid(), label: "Portland hotel confirmation", value: "POR-4471" }] }),
    makeDay(addDays(start, 4), "Portland", "Doughnuts, forest, and food carts.",
      [act("Voodoo Doughnut", "Then a walk through Forest Park."),
       act("SW 5th food cart pod", "Lunch."),
       act("Alberta Arts District", "Dinner here.")],
      { hotels: [{ id: uid(), name: "Jupiter Hotel", link: "", note: "Funky courtyard motel, good bar on site." }] }),
    makeDay(addDays(start, 5), "Portland → Bend", "Over the Cascades to high desert brewery country.",
      [act("Mt. Hood", "Drive over the Cascades this way."),
       act("Sisters", "Lunch, browse the outdoor shops."),
       act("Bend", "Brewery crawl, Deschutes River walk.")],
      { spots: [{ id: uid(), name: "Smith Rock State Park", link: "", note: "Heard the Misery Ridge trail is worth the climb." }] }),
    makeDay(addDays(start, 6), "Bend → Crater Lake → Redwoods", "Long driving day — rim views to old growth.",
      [act("Crater Lake, Rim Village", "Sunrise overlook."),
       act("Klamath Falls", "Fuel + snacks, ~1pm — not much after this for a while."),
       act("Crescent City", "Arrive at dusk, first redwoods.")],
      {}),
    makeDay(addDays(start, 7), "Redwoods → Eureka", "Giants, then a Victorian old town.",
      [act("Fern Canyon", "Walk among the old growth."),
       act("Avenue of the Giants", "Scenic drive."),
       act("Eureka Old Town", "Dinner here.")],
      { hotels: [{ id: uid(), name: "Carter House Inn", link: "", note: "Victorian B&B, good reviews for the restaurant." }] }),
    makeDay(addDays(start, 8), "Eureka → Mendocino → Sonoma", "Coast village, wine detour, plaza dinner.",
      [act("Mendocino village", "Coastal stop."),
       act("Anderson Valley", "Wine tasting detour."),
       act("Sonoma Plaza", "Overnight here, dinner on the plaza.")],
      { spots: [{ id: uid(), name: "Point Arena Lighthouse", link: "", note: "Climb to the top for coast views, apparently few crowds." }] }),
    makeDay(addDays(start, 9), "Sonoma → San Francisco", "Into the city over the bridge.",
      [act("Golden Gate Bridge", "Walk it from the north side."),
       act("The Mission", "Lunch, taqueria crawl."),
       act("Twin Peaks", "Sunset up here.")],
      { codes: [{ id: uid(), label: "SF hotel confirmation", value: "SF-99042" }] }),
    makeDay(addDays(start, 10), "San Francisco", "A full city day — market, island, North Beach.",
      [act("Ferry Building", "Farmers market."),
       act("Alcatraz", "Tour, book ahead."),
       act("North Beach", "Dinner here.")],
      { hotels: [{ id: uid(), name: "Hotel Zeppelin", link: "", note: "Playful lobby, Union Square location." }] }),
    makeDay(addDays(start, 11), "San Francisco → Big Sur", "Highway 1 proper starts here.",
      [act("Half Moon Bay", "Drive Highway 1 through here."),
       act("Cannery Row, Monterey", "Lunch, walk."),
       act("McWay Falls", "Sunset.")],
      { spots: [{ id: uid(), name: "Nepenthe", link: "", note: "Cliffside views, heard sunset seating needs a wait." }] }),
    makeDay(addDays(start, 12), "Big Sur → Santa Barbara", "Castle photo stop, coastal town landing.",
      [act("Hearst Castle", "Photo stop continuing south on Highway 1."),
       act("Cambria", "Lunch."),
       act("Butterfly Beach", "Arrive Santa Barbara, sunset here.")],
      { hotels: [{ id: uid(), name: "El Encanto", link: "", note: "Hillside views — a splurge, but feels like the occasion for it." }] }),
    makeDay(addDays(start, 13), "Santa Barbara → LA → San Diego", "Finish line — beaches the whole way down.",
      [act("Venice Beach", "Quick stop driving through LA."),
       act("In-N-Out, LA", "If there's time, mid-afternoon detour."),
       act("Laguna Beach", "Lunch."),
       act("Sunset Cliffs", "Arrive San Diego, sunset here, trip-end dinner.")],
      { codes: [{ id: uid(), label: "Return car drop-off", value: "RC-DROP-2291" }] }),
  ];

  const pins = [
    { id: uid(), dayId: days[0].id, name: "Trees Organic Coffee", category: "cat-restaurant", note: "First stop before hitting the road.", link: "" },
    { id: uid(), dayId: days[2].id, name: "Kerry Park", category: "cat-spot", note: "Best skyline view in Seattle, go at dusk.", link: "" },
    { id: uid(), dayId: days[4].id, name: "Pok Pok", category: "cat-restaurant", note: "Thai, apparently worth the wait.", link: "" },
    { id: uid(), dayId: days[5].id, name: "Smith Rock State Park", category: "cat-spot", note: "Misery Ridge trail.", link: "" },
    { id: uid(), dayId: days[7].id, name: "Carter House Inn", category: "cat-hotel", note: "Victorian B&B with a well-reviewed restaurant.", link: "" },
    { id: uid(), dayId: days[8].id, name: "Point Arena Lighthouse", category: "cat-spot", note: "Climb to the top for coast views.", link: "" },
    { id: uid(), dayId: days[10].id, name: "Tartine Bakery", category: "cat-restaurant", note: "Morning bun, get there early.", link: "" },
    { id: uid(), dayId: days[11].id, name: "Nepenthe", category: "cat-restaurant", note: "Cliffside sunset dinner.", link: "" },
    { id: uid(), dayId: days[13].id, name: "Sunset Cliffs", category: "cat-spot", note: "Trip-end sunset.", link: "" },
  ];

  return {
    id: uid(),
    name: "Pacific Coast Roadtrip",
    type: "multi",
    location: "",
    subtitle: "Pacific coast road trip",
    days,
    pins,
    coverImage: null,
    sections: [],
    stash: { hotels: [], spots: [], codes: [] },
    notes: [],
    categories: defaultCategories(),
  };
}

const ICON_LIBRARY = {
  Utensils, MapPin, BedDouble, Coffee, Camera, ShoppingBag, Mountain, Waves, Ticket, Wine, Landmark, Bike, Music, Car, Fish, IceCreamCone,
};
const ICON_LIBRARY_KEYS = Object.keys(ICON_LIBRARY);
function iconFor(name) { return ICON_LIBRARY[name] || MapPin; }

const CATEGORY_COLORS = ["#D9421F", "#26422B", "#702722", "#CCE5FF"];

function defaultCategories() {
  return [
    { id: "cat-restaurant", name: "Restaurants", icon: "Utensils", color: "#D9421F" },
    { id: "cat-spot", name: "Spots", icon: "MapPin", color: "#26422B" },
    { id: "cat-hotel", name: "Hotels", icon: "BedDouble", color: "#702722" },
  ];
}
function catMeta(trip, categoryId) {
  const cats = (trip && trip.categories && trip.categories.length) ? trip.categories : defaultCategories();
  return cats.find((c) => c.id === categoryId) || cats[0];
}

const CARD_GRADIENTS = [
  "linear-gradient(135deg,#26422B,#16281C)",
  "linear-gradient(135deg,#D9421F,#A8341A)",
  "linear-gradient(135deg,#CCE5FF,#6FA3C7)",
  "linear-gradient(135deg,#702722,#4A1815)",
];

// Classic pushpin colors — the darker collar/disc tone is derived automatically.
const PIN_TONES = ["#D9421F", "#26422B", "#702722", "#CCE5FF"];

function shadeColor(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function tripDateRange(trip) {
  if (!trip.days.length) return "";
  return `${formatDateShort(trip.days[0].date)} – ${formatDateShort(trip.days[trip.days.length - 1].date)}`;
}

// ---- Shared Google Maps loader ----
// Reads the key from a Vercel env var (must be prefixed VITE_) or, as a
// fallback, a key pasted into the Live Map tab and stored in localStorage.
const ENV_KEY_NAMES = ["VITE_GOOGLE_MAPS_API_KEY", "VITE_GOOGLE_PLACES_API_KEY", "VITE_GOOGLE_API_KEY", "VITE_GMAPS_API_KEY"];
function getEnvApiKey() {
  for (const name of ENV_KEY_NAMES) {
    const v = import.meta.env[name];
    if (v) return v;
  }
  return "";
}
function getStoredApiKey() {
  const envKey = getEnvApiKey();
  if (envKey) return envKey;
  try { return localStorage.getItem(GMAPS_KEY_STORAGE) || ""; } catch (e) { return ""; }
}
let gmapsLoadPromise = null;
function loadGoogleMaps(apiKey) {
  if (window.google && window.google.maps && window.google.maps.places) return Promise.resolve();
  if (!apiKey) return Promise.reject(new Error("no key"));
  if (gmapsLoadPromise) return gmapsLoadPromise;
  gmapsLoadPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById("pm-gmaps-script");
    if (existing) { existing.addEventListener("load", resolve); existing.addEventListener("error", reject); return; }
    const script = document.createElement("script");
    script.id = "pm-gmaps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return gmapsLoadPromise;
}
// Quiet, optional enhancement hook — resolves true only if a key exists
// and the script loads; never throws or shows an error to the caller.
function useGoogleMapsReady() {
  const [ready, setReady] = useState(() => !!(window.google && window.google.maps && window.google.maps.places));
  useEffect(() => {
    if (ready) return;
    const key = getStoredApiKey();
    if (!key) return;
    loadGoogleMaps(key).then(() => setReady(true)).catch(() => {});
  }, [ready]);
  return ready;
}

function thumbtackIconUrl(main) {
  const outline = shadeColor(main, -55);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="34" viewBox="0 0 20 34">
    <ellipse cx="10" cy="31" rx="2.4" ry="1.1" fill="rgba(0,0,0,0.25)"/>
    <line x1="10" y1="20" x2="10" y2="29" stroke="${outline}" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="10" cy="13" r="6.5" fill="${main}" stroke="${outline}" stroke-width="1.2"/>
    <circle cx="8" cy="10.8" r="1.9" fill="#fff" opacity="0.35"/>
  </svg>`;
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

export default function App() {
  const [trips, setTrips] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [activeTripId, setActiveTripId] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [styleSettings, setStyleSettings] = useState(DEFAULT_STYLE_SETTINGS);
  const [styleLoaded, setStyleLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STYLE_STORAGE_KEY);
      if (raw) setStyleSettings({ ...DEFAULT_STYLE_SETTINGS, ...JSON.parse(raw) });
    } catch (e) { /* ignore */ }
    setStyleLoaded(true);
  }, []);

  useEffect(() => {
    if (!styleLoaded) return;
    try { localStorage.setItem(STYLE_STORAGE_KEY, JSON.stringify(styleSettings)); } catch (e) { /* ignore */ }
  }, [styleSettings, styleLoaded]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setTrips(raw ? JSON.parse(raw).map(migrateTrip) : [buildSeedTrip()]);
    } catch (e) {
      setTrips([buildSeedTrip()]);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded || trips === null) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(trips)); } catch (e) { /* ignore */ }
  }, [trips, loaded]);

  // Push a history entry when opening a trip so the browser back button
  // returns to the trip list instead of leaving the app entirely.
  useEffect(() => {
    function handlePop(e) {
      setActiveTripId(e.state && e.state.tripId ? e.state.tripId : null);
    }
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  function openTrip(id) {
    try { window.history.pushState({ tripId: id }, ""); } catch (e) { /* ignore */ }
    setActiveTripId(id);
  }
  function closeTrip() {
    try {
      if (window.history.state && window.history.state.tripId) { window.history.back(); return; }
    } catch (e) { /* ignore */ }
    setActiveTripId(null);
  }

  function updateTrip(tripId, fn) {
    setTrips((prev) => prev.map((t) => (t.id === tripId ? fn(t) : t)));
  }

  function createTrip({ name, type, location, startDate, endDate, legs }) {
    const n = Math.max(1, Math.min(90, daysBetween(startDate, endDate)));
    const days = [];
    for (let i = 0; i < n; i++) days.push(makeDay(addDays(startDate, i), type === "single" ? location : "", ""));

    let sections = [];
    if (type === "multi" && legs && legs.length > 1) {
      const base = Math.floor(n / legs.length);
      let remainder = n % legs.length;
      let idx = 0;
      legs.forEach((legName) => {
        const count = base + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder--;
        if (legName.trim() && days[idx]) {
          sections.push({ id: uid(), label: legName.trim(), beforeDayId: days[idx].id, stash: { hotels: [], spots: [], codes: [] } });
        }
        idx += count;
      });
    }

    const trip = {
      id: uid(),
      name: name || "Untitled trip",
      type,
      location: type === "single" ? location : "",
      subtitle: `${n} day${n === 1 ? "" : "s"}`,
      days,
      pins: [],
      coverImage: null,
      sections,
      stash: { hotels: [], spots: [], codes: [] },
      notes: [],
      categories: defaultCategories(),
    };
    setTrips((prev) => [...(prev || []), trip]);
    setShowNewForm(false);
    openTrip(trip.id);
  }

  function deleteTrip(tripId) {
    setTrips((prev) => prev.filter((t) => t.id !== tripId));
  }

  const activeTrip = trips ? trips.find((t) => t.id === activeTripId) : null;

  return (
    <StyleContext.Provider value={styleSettings}>
    <div className="pm-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bungee&family=Rye&family=Nunito:ital,wght@0,400;0,600;0,700;1,600&family=Caveat:wght@600;700&family=Space+Mono:wght@400;700&display=swap');

        .pm-root {
          --coffee: #702722;
          --icecube: #F0954B;
          --mango: #D9421F;
          --mango-light: #FDDBC5;
          --oatmilk: #F9F5E6;
          --cambodia: #26422B;
          --cambodia-light: #E3EBE4;
          --cambodia-wash: #C7D6C9;
          --cambodia-dark: #16281C;
          --forest: #26422B;
          --forest-light: #3E6B48;
          --forest-deep: #16281C;
          --forest-sky: #CCE5FF;
          --rust: #D9421F;
          --rust-light: #E8623F;
          --rust-deep: #A8341A;
          --rust-pink: #FDDBC5;
          --navy: #702722;
          --navy-light: #8F4436;
          --gold: #CCE5FF;
          --sky: #CCE5FF;
          --bg: #F9F5E6;
          --ink: #702722;
          --ink-soft: #8A5C52;
          --card-shadow: rgba(0,0,0,0.28);
          font-family: 'Nunito', sans-serif;
          color: var(--ink);
          min-height: 100vh;
          width: 100%;
          box-sizing: border-box;
          background: var(--bg);
        }
        .pm-root * { box-sizing: border-box; }
        .pm-display { font-family: 'Bungee', 'Rye', serif; }
        .pm-hand { font-family: 'Caveat', cursive; }
        .pm-mono { font-family: 'Space Mono', monospace; }
        .pm-btn {
          font-family: 'Nunito', sans-serif;
          font-weight: 700;
          font-size: 12px;
          letter-spacing: 0.01em;
          border: 1.5px solid var(--ink);
          background: transparent;
          color: var(--ink);
          padding: 8px 14px;
          border-radius: 20px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .pm-btn:hover { background: var(--forest); border-color: var(--forest); color: #fff; }
        .pm-btn-solid { background: var(--icecube); border-color: var(--icecube); color: var(--coffee); }
        .pm-btn-solid:hover { background: #E07A2E; border-color: #E07A2E; color: var(--coffee); }
        .pm-btn-ghost { border-color: rgba(42,32,25,0.35); }
        .pm-input, .pm-textarea, .pm-select {
          font-family: 'Nunito', sans-serif;
          font-size: 14px;
          background: #FAF8F4;
          border: 1.5px solid rgba(46,43,38,0.18);
          border-radius: 8px;
          padding: 8px 10px;
          color: var(--ink);
          width: 100%;
        }
        .pm-input:focus, .pm-textarea:focus, .pm-select:focus { outline: none; border-color: var(--forest); }
        .pm-textarea { resize: vertical; min-height: 52px; font-size: 14px; line-height: 1.5; }
        .pm-label { font-family: 'Space Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-soft); display: block; margin-bottom: 4px; }
        .pm-card-wrap { perspective: 1200px; }
        .pm-card {
          transition: transform 0.55s cubic-bezier(.4,.1,.2,1), box-shadow 0.2s ease;
          transform-style: preserve-3d;
          backface-visibility: hidden;
        }
        .pm-card.pm-flipping { transform: rotateY(150deg); }
        .pm-seg { display: inline-flex; border: 1.5px solid rgba(46,43,38,0.25); border-radius: 20px; overflow: hidden; }
        .pm-seg button { font-family: 'Nunito', sans-serif; font-weight: 700; font-size: 12px; border: none; padding: 8px 14px; cursor: pointer; background: #FAF8F4; color: var(--ink); }
        .pm-seg button.active { background: var(--forest); color: #fff; }
        .pm-content { padding: 0 20px 60px; }
        .pac-container { font-family: 'Nunito', sans-serif; z-index: 1000; }
      `}</style>

      {trips === null ? (
        <div style={{ textAlign: "center", padding: "60px 0", fontFamily: "'Space Mono', monospace", fontSize: 13 }}>
          sorting through the postcards…
        </div>
      ) : activeTrip ? (
        <>
          <Masthead onHome={closeTrip} />
          <div className="pm-content">
            <TripView trip={activeTrip} onBack={closeTrip} updateTrip={(fn) => updateTrip(activeTrip.id, fn)} />
          </div>
        </>
      ) : (
        <>
          <Masthead onHome={closeTrip} />
          <div className="pm-content">
            <HomeView trips={trips} onOpen={openTrip} onNew={() => setShowNewForm(true)} onDelete={deleteTrip} styleSettings={styleSettings} onUpdateStyle={setStyleSettings} />
          </div>
        </>
      )}

      {showNewForm && <NewTripModal onCancel={() => setShowNewForm(false)} onCreate={createTrip} />}
    </div>
    </StyleContext.Provider>
  );
}

function MastheadPlaneIcon({ cx, cy, s, color }) {
  const scale = s / 100;
  return (
    <g transform={`translate(${cx},${cy}) scale(${scale}) translate(-50,-50)`}>
      <path d="M50 15 L54 30 L82 42 L82 47 L54 42 L51 62 L60 70 L60 74 L50 70 L40 74 L40 70 L49 62 L46 42 L18 47 L18 42 L46 30 Z" fill={color} />
    </g>
  );
}
function MastheadScratchDefs({ id, seed }) {
  return (
    <>
      <filter id={`tex-${id}`} x="0%" y="0%" width="100%" height="100%">
        <feTurbulence type="turbulence" baseFrequency="0.06" numOctaves="1" seed={seed} stitchTiles="stitch" result="n" />
        <feColorMatrix in="n" type="matrix" values="0 0 0 9 -4.35  0 0 0 9 -4.35  0 0 0 9 -4.35  0 0 0 9 -4.35" />
      </filter>
      <mask id={`m-${id}`}><rect width="100%" height="100%" fill="white" filter={`url(#tex-${id})`} /></mask>
    </>
  );
}
function MastheadOvalMark({ w, h, color, base, seed, city, sub }) {
  const id = `oval-${seed}`;
  return (
    <svg width={w} height={h} viewBox="0 0 140 90" style={{ display: "block" }}>
      <defs><MastheadScratchDefs id={id} seed={seed} /></defs>
      <rect width="140" height="90" fill={base} mask={`url(#m-${id})`} opacity="0.5" />
      <ellipse cx="70" cy="45" rx="65" ry="39" fill="none" stroke={color} strokeWidth="5" />
      <ellipse cx="70" cy="45" rx="55" ry="30" fill="none" stroke={color} strokeWidth="1.8" />
      <text x="70" y="25" textAnchor="middle" fontSize="14" fontWeight="700" fill={color} letterSpacing="1">{city}</text>
      <MastheadPlaneIcon cx={70} cy={48} s={26} color={color} />
      <text x="70" y="72" textAnchor="middle" fontSize="11" fontWeight="700" fill={color} letterSpacing="1.5">{sub}</text>
    </svg>
  );
}
function MastheadDiamondMark({ size, color, base, seed, code }) {
  const id = `dia-${seed}`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block" }}>
      <defs><MastheadScratchDefs id={id} seed={seed} /></defs>
      <polygon points="50,5 95,50 50,95 5,50" fill={base} mask={`url(#m-${id})`} opacity="0.5" />
      <polygon points="50,5 95,50 50,95 5,50" fill="none" stroke={color} strokeWidth="5" />
      <MastheadPlaneIcon cx={50} cy={40} s={22} color={color} />
      <text x="50" y="68" textAnchor="middle" fontSize="14" fontWeight="700" fill={color} letterSpacing="0.5">{code}</text>
    </svg>
  );
}
function MastheadCircleMark({ size, color, base, seed, pathId, city, code }) {
  const id = `circ-${seed}`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block" }}>
      <defs>
        <MastheadScratchDefs id={id} seed={seed} />
        <path id={pathId} d="M 50,50 m -34,0 a 34,34 0 1,1 68,0 a 34,34 0 1,1 -68,0" />
      </defs>
      <circle cx="50" cy="50" r="42" fill={base} mask={`url(#m-${id})`} opacity="0.5" />
      <circle cx="50" cy="50" r="42" fill="none" stroke={color} strokeWidth="5" />
      <circle cx="50" cy="50" r="33" fill="none" stroke={color} strokeWidth="1.7" />
      <text fontSize="10.5" fontWeight="700" fill={color} letterSpacing="1">
        <textPath href={`#${pathId}`} startOffset="25%" textAnchor="middle">{city}</textPath>
      </text>
      <MastheadPlaneIcon cx={50} cy={50} s={22} color={color} />
      <text x="50" y="81" textAnchor="middle" fontSize="10" fontWeight="700" fill={color} letterSpacing="1">{code}</text>
    </svg>
  );
}
function MastheadRoundRectMark({ w, h, color, base, seed, city, sub }) {
  const id = `rr-${seed}`;
  return (
    <svg width={w} height={h} viewBox="0 0 130 80" style={{ display: "block" }}>
      <defs><MastheadScratchDefs id={id} seed={seed} /></defs>
      <rect x="6" y="6" width="118" height="68" rx="16" fill={base} mask={`url(#m-${id})`} opacity="0.5" />
      <rect x="6" y="6" width="118" height="68" rx="16" fill="none" stroke={color} strokeWidth="5" />
      <text x="65" y="25" textAnchor="middle" fontSize="14" fontWeight="700" fill={color} letterSpacing="1">{city}</text>
      <MastheadPlaneIcon cx={65} cy={44} s={24} color={color} />
      <text x="65" y="66" textAnchor="middle" fontSize="11" fontWeight="700" fill={color} letterSpacing="1">{sub}</text>
    </svg>
  );
}

function Masthead({ onHome }) {
  const COFFEE = "#702722", COFFEE_BASE = "#3D1512";
  const ICECUBE = "#6FA3C7", ICECUBE_BASE = "#345C77";
  const MANGO = "#D9421F", MANGO_BASE = "#7A2F16";
  const CAMBODIA = "#26422B", CAMBODIA_BASE = "#132316";
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "40px 20px 30px" }}>
      <div style={{ position: "relative", display: "inline-block", padding: "30px 48px" }}>
        <div style={{ position: "absolute", top: -12, left: 0, opacity: 0.95, transform: "rotate(-14deg)", zIndex: 0 }}>
          <MastheadOvalMark w={98} h={63} color={MANGO} base={MANGO_BASE} seed={1} city="PARIS" sub="ARRIVED" />
        </div>
        <div style={{ position: "absolute", top: -16, right: -8, opacity: 0.95, transform: "rotate(10deg)", zIndex: 0 }}>
          <MastheadDiamondMark size={70} color={CAMBODIA} base={CAMBODIA_BASE} seed={2} code="NYC" />
        </div>
        <div style={{ position: "absolute", bottom: -18, left: 14, opacity: 0.95, transform: "rotate(9deg)", zIndex: 0 }}>
          <MastheadCircleMark size={72} color={COFFEE} base={COFFEE_BASE} seed={3} pathId="pm-mast-circ-1" city="LONDON" code="LHR" />
        </div>
        <div style={{ position: "absolute", bottom: -16, right: 6, opacity: 0.95, transform: "rotate(-8deg)", zIndex: 0 }}>
          <MastheadRoundRectMark w={88} h={56} color={ICECUBE} base={ICECUBE_BASE} seed={4} city="TOKYO" sub="ARRIVED" />
        </div>
        <div style={{ position: "absolute", top: 24, left: -32, opacity: 0.95, transform: "rotate(-4deg)", zIndex: 0 }}>
          <MastheadCircleMark size={58} color={ICECUBE} base={ICECUBE_BASE} seed={5} pathId="pm-mast-circ-2" city="SYDNEY" code="SYD" />
        </div>
        <button
          className="pm-display"
          onClick={onHome}
          style={{ position: "relative", zIndex: 1, fontSize: 40, color: COFFEE, background: "none", border: "none", padding: 0, cursor: onHome ? "pointer" : "default" }}
        >
          Postmark
        </button>
      </div>
    </div>
  );
}

let texturedIdCounter = 0;
const PAIR_DUOTONE = { color: "#D9421F", base: "#A8341A", accentBg: "#FDDBC5", accentText: "#A8341A" };
const PAIR_ALPINE = { color: "#26422B", base: "#16281C", accentBg: "#CCE5FF", accentText: "#26422B" };
const PAIR_WASHED = { color: "#CBE1F0", textColor: "#1F5673" };
function Textured({ color, base, seed, style, className, children, radius, onClick, texture }) {
  const idRef = useRef(null);
  if (idRef.current === null) { idRef.current = `tex-${texturedIdCounter++}`; }
  const id = idRef.current;
  const s = typeof seed === "number" ? seed : 4;

  if (texture === "woven") {
    return (
      <div className={className} onClick={onClick} style={{ position: "relative", overflow: "hidden", borderRadius: radius, background: color, ...style }}>
        <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
      </div>
    );
  }

  const contrast = 9;
  const offset = -(contrast / 2 - 0.15);
  const tile = 70;
  return (
    <div className={className} onClick={onClick} style={{ position: "relative", overflow: "hidden", borderRadius: radius, ...style }}>
      <svg width="100%" height="100%" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}>
        <defs>
          <filter id={`f-${id}`} x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence type="turbulence" baseFrequency="0.09" numOctaves="1" seed={s} stitchTiles="stitch" result="n" />
            <feColorMatrix in="n" type="matrix" values={`0 0 0 ${contrast} ${offset}  0 0 0 ${contrast} ${offset}  0 0 0 ${contrast} ${offset}  0 0 0 ${contrast} ${offset}`} />
          </filter>
          <mask id={`m-${id}`}><rect width={tile} height={tile} fill="white" filter={`url(#f-${id})`} /></mask>
          <pattern id={`pat-${id}`} width={tile} height={tile} patternUnits="userSpaceOnUse">
            <rect width={tile} height={tile} fill={base} />
            <rect width={tile} height={tile} fill={color} mask={`url(#m-${id})`} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#pat-${id})`} />
      </svg>
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>

    </div>
  );
}

function Thumbtack({ color, style }) {
  const outline = shadeColor(color, -55);
  return (
    <svg width="20" height="34" viewBox="0 0 20 34" style={{ filter: "drop-shadow(0 4px 4px rgba(0,0,0,0.35))", ...style }}>
      <ellipse cx="10" cy="31" rx="2.4" ry="1.1" fill="rgba(0,0,0,0.25)" />
      <line x1="10" y1="20" x2="10" y2="29" stroke={outline} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="10" cy="13" r="6.5" fill={color} stroke={outline} strokeWidth="1.2" />
      <circle cx="8" cy="10.8" r="1.9" fill="#fff" opacity="0.35" />
    </svg>
  );
}

const STAMP_PLACEMENTS = [
  { top: 2, right: 3, rot: 6 },
  { top: 6, right: -1, rot: -8 },
  { top: 0, right: 8, rot: 9 },
  { top: 7, right: 2, rot: -5 },
];

function StampGraphic({ accent, index, topText, size }) {
  const pathId = `pm-stamp-path-${index}`;
  return (
    <svg width={size || 52} height={size || 52} viewBox="0 0 100 100">
      <defs>
        <path id={pathId} d="M 50,50 m -38,0 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0" />
      </defs>
      <circle cx="50" cy="50" r="38" fill="none" stroke={accent} strokeWidth="2.2" />
      <circle cx="50" cy="50" r="31" fill="none" stroke={accent} strokeWidth="1.2" />
      <text fontSize="8" fill={accent} letterSpacing="2">
        <textPath href={`#${pathId}`} startOffset="25%" textAnchor="middle">{topText}</textPath>
      </text>
      <line x1="20" y1="50" x2="80" y2="50" stroke={accent} strokeWidth="1.4" />
      <text x="50" y="44" textAnchor="middle" fontSize="15" fontWeight="700" fill={accent} style={{ fontFamily: "'Rye', serif" }}>POST</text>
      <text x="50" y="66" textAnchor="middle" fontSize="7" fill={accent} letterSpacing="1.5">MARK</text>
    </svg>
  );
}

function PostmarkStamp({ accent, index, topText }) {
  const placement = STAMP_PLACEMENTS[index % STAMP_PLACEMENTS.length];
  return (
    <div style={{ position: "absolute", top: placement.top, right: placement.right, transform: `rotate(${placement.rot}deg)`, zIndex: 2 }}>
      <StampGraphic accent={accent} index={index} topText={topText} />
    </div>
  );
}

function fontSizeForLen(len) {
  return len <= 9 ? 58 : len <= 14 ? 48 : len <= 20 ? 40 : len <= 28 ? 32 : 24;
}
function targetLengthForLen(len) {
  return Math.max(120, Math.min(285, len * 24 + 50));
}
function splitTwoLines(name) {
  if (name.length <= 15) return [name];
  const mid = Math.floor(name.length / 2);
  let bestIdx = -1, bestDist = Infinity;
  for (let i = 0; i < name.length; i++) {
    if (name[i] === " ") {
      const d = Math.abs(i - mid);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
  }
  if (bestIdx === -1) return [name];
  return [name.slice(0, bestIdx).trim(), name.slice(bestIdx + 1).trim()];
}

function ArchedTitle({ name, index }) {
  const style = useContext(StyleContext);
  const lines = splitTwoLines(name || "");
  const singlePath = "M 15,170 Q 160,115 305,95";
  const topPath = "M 20,130 Q 160,70 300,78";
  const bottomPath = "M 15,193 Q 160,143 305,127";

  if (lines.length === 1) {
    const fontSize = fontSizeForLen(name.length);
    const targetLength = targetLengthForLen(name.length);
    const pathId = `pm-title-arc-${index}`;
    return (
      <svg viewBox="0 0 320 220" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
        <defs><path id={pathId} d={singlePath} /></defs>
        <text fontSize={fontSize} textLength={targetLength} lengthAdjust="spacingAndGlyphs" fill={style.titleFill} stroke={style.titleStroke} strokeWidth={style.titleStrokeWidth} strokeLinejoin="round" paintOrder="stroke" className="pm-display">
          <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">{name}</textPath>
        </text>
      </svg>
    );
  }

  const [line1, line2] = lines;
  const fontSize = Math.min(fontSizeForLen(line1.length), fontSizeForLen(line2.length));
  const len1 = targetLengthForLen(line1.length);
  const len2 = targetLengthForLen(line2.length);
  const id1 = `pm-title-arc-top-${index}`;
  const id2 = `pm-title-arc-bottom-${index}`;
  const twoLineStrokeWidth = style.titleStrokeWidth * 0.857;
  return (
    <svg viewBox="0 0 320 220" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
      <defs>
        <path id={id1} d={topPath} />
        <path id={id2} d={bottomPath} />
      </defs>
      <text fontSize={fontSize} textLength={len1} lengthAdjust="spacingAndGlyphs" fill={style.titleFill} stroke={style.titleStroke} strokeWidth={twoLineStrokeWidth} strokeLinejoin="round" paintOrder="stroke" className="pm-display">
        <textPath href={`#${id1}`} startOffset="50%" textAnchor="middle">{line1}</textPath>
      </text>
      <text fontSize={fontSize} textLength={len2} lengthAdjust="spacingAndGlyphs" fill={style.titleFill} stroke={style.titleStroke} strokeWidth={twoLineStrokeWidth} strokeLinejoin="round" paintOrder="stroke" className="pm-display">
        <textPath href={`#${id2}`} startOffset="50%" textAnchor="middle">{line2}</textPath>
      </text>
    </svg>
  );
}

function TripCard({ trip, index, onOpen, onDelete, flipping, onStartFlip }) {
  const gradient = CARD_GRADIENTS[index % CARD_GRADIENTS.length];
  const tone = PIN_TONES[index % PIN_TONES.length];
  const pinRot = index % 2 === 0 ? -14 : 11;
  const cardRot = index % 3 === 0 ? -1.4 : (index % 3 === 1 ? 1 : -0.5);
  const stampAccent = PIN_TONES[(index + 1) % PIN_TONES.length];

  return (
    <div className="pm-card-wrap" style={{ position: "relative" }}>
      <Thumbtack
        color={tone}
        style={{ position: "absolute", top: -12, left: index % 2 === 0 ? 22 : "auto", right: index % 2 === 0 ? "auto" : 22, transform: `rotate(${pinRot}deg)`, transformOrigin: "top center", zIndex: 3 }}
      />
      <div
        onClick={() => onStartFlip(trip.id)}
        className={"pm-card" + (flipping ? " pm-flipping" : "")}
        style={{
          position: "relative",
          background: "#FFFFFF",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: "4px 10px 5px 9px",
          cursor: "pointer",
          padding: 7,
          boxShadow: "0 8px 16px var(--card-shadow)",
          transform: `rotate(${cardRot}deg)`,
        }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(trip.id); }}
          style={{ position: "absolute", top: 12, left: 12, background: "rgba(0,0,0,0.5)", borderRadius: "50%", border: "none", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 2 }}
          aria-label="Delete trip"
        >
          <X size={12} color="#fff" />
        </button>

        <div style={{ position: "relative", height: 150, borderRadius: "2px 7px 3px 6px", overflow: "hidden", border: "2px solid rgba(0,0,0,0.65)" }}>
          <div style={{ position: "absolute", inset: 0, background: trip.coverImage ? `center / cover no-repeat url(${trip.coverImage})` : gradient, filter: "url(#pm-cartoonize)" }} />
          <ArchedTitle name={trip.name} index={index} />
        </div>
        <PostmarkStamp accent={stampAccent} index={index} topText={`★ ${formatDateShort(trip.days[0] ? trip.days[0].date : "")} ★`} />
      </div>
      <div className="pm-mono" style={{ fontSize: 10, color: "var(--ink-soft)", marginTop: 6, paddingLeft: 3 }}>
        {trip.type === "single" && trip.location ? `based in ${trip.location} · ` : ""}{tripDateRange(trip)} · {trip.days.length}d
      </div>
    </div>
  );
}

function HomeView({ trips, onOpen, onNew, onDelete, styleSettings, onUpdateStyle }) {
  const [flippingId, setFlippingId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  function handleOpen(tripId) {
    if (flippingId) return;
    setFlippingId(tripId);
    setTimeout(() => onOpen(tripId), 480);
  }

  const tableValues = posterizeTable(styleSettings.steps, styleSettings.range);

  return (
    <div>
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <filter id="pm-cartoonize" colorInterpolationFilters="sRGB">
          <feColorMatrix type="saturate" values={styleSettings.saturate} />
          <feComponentTransfer>
            <feFuncR type="discrete" tableValues={tableValues} />
            <feFuncG type="discrete" tableValues={tableValues} />
            <feFuncB type="discrete" tableValues={tableValues} />
          </feComponentTransfer>
        </filter>
      </svg>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
        <button
          onClick={() => setShowSettings(true)}
          aria-label="Style settings"
          style={{ background: "none", border: "1.5px solid rgba(42,32,25,0.3)", borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--ink)" }}
        >
          <Settings size={16} />
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 32, paddingTop: 20 }}>
        {trips.map((trip, i) => (
          <TripCard key={trip.id} trip={trip} index={i} onOpen={onOpen} onDelete={onDelete} flipping={flippingId === trip.id} onStartFlip={handleOpen} />
        ))}

        <div
          onClick={onNew}
          style={{
            border: "2px dashed rgba(42,32,25,0.3)",
            borderRadius: 14,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            minHeight: 160,
            cursor: "pointer",
            color: "var(--ink-soft)",
          }}
        >
          <Plus size={22} />
          <span className="pm-mono" style={{ fontSize: 12 }}>start a new trip</span>
        </div>
      </div>

      {showSettings && <StyleSettingsPanel value={styleSettings} onChange={onUpdateStyle} onClose={() => setShowSettings(false)} />}
    </div>
  );
}

function StyleSettingsPanel({ value, onChange, onClose }) {
  function set(patch) { onChange((s) => ({ ...s, ...patch })); }

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(42,32,25,0.25)", zIndex: 50, display: "flex", justifyContent: "flex-end" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 300, maxWidth: "85vw", height: "100%", background: "#FFFDF9", boxShadow: "-8px 0 24px rgba(0,0,0,0.2)", padding: 20, overflowY: "auto" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <span className="pm-display" style={{ fontSize: 18 }}>Style</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-soft)" }} aria-label="Close"><X size={18} /></button>
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-soft)", marginBottom: 18 }}>Changes apply everywhere right away.</div>

        <div className="pm-label">Postcard filter</div>
        <SettingsSlider label="Saturation" min={0} max={1.5} step={0.05} value={value.saturate} onChange={(v) => set({ saturate: v })} />
        <SettingsSlider label="Posterize steps" min={2} max={8} step={1} value={value.steps} onChange={(v) => set({ steps: v })} />
        <SettingsSlider label="Tone range" min={0} max={0.4} step={0.02} value={value.range} onChange={(v) => set({ range: v })} />

        <div className="pm-label" style={{ marginTop: 18 }}>Title text</div>
        <SettingsColor label="Fill" value={value.titleFill} onChange={(v) => set({ titleFill: v })} />
        <SettingsColor label="Outline" value={value.titleStroke} onChange={(v) => set({ titleStroke: v })} />
        <SettingsSlider label="Outline width" min={0} max={8} step={0.5} value={value.titleStrokeWidth} onChange={(v) => set({ titleStrokeWidth: v })} />

        <button
          className="pm-btn pm-btn-ghost"
          style={{ marginTop: 20, width: "100%", justifyContent: "center", color: "var(--ink)" }}
          onClick={() => onChange(() => DEFAULT_STYLE_SETTINGS)}
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
}

function SettingsSlider({ label, min, max, step, value, onChange }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--ink)", marginBottom: 4 }}>
        <span>{label}</span>
        <span className="pm-mono" style={{ fontSize: 11, color: "var(--ink-soft)" }}>{value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} style={{ width: "100%" }} />
    </div>
  );
}

function SettingsColor({ label, value, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
      <span style={{ fontSize: 12, color: "var(--ink)" }}>{label}</span>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: 36, height: 24, border: "none", padding: 0, borderRadius: 4, cursor: "pointer" }} />
    </div>
  );
}

function TripTypeFields({ type, setType, location, setLocation }) {
  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <span className="pm-label">Trip style</span>
        <div className="pm-seg">
          <button className={type === "multi" ? "active" : ""} onClick={() => setType("multi")}>Multi-city</button>
          <button className={type === "single" ? "active" : ""} onClick={() => setType("single")}>One place</button>
        </div>
      </div>
      {type === "single" && (
        <div style={{ marginBottom: 12 }}>
          <span className="pm-label">Location</span>
          <input className="pm-input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Amsterdam" />
        </div>
      )}
    </>
  );
}

function NewTripModal({ onCancel, onCreate }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("multi");
  const [location, setLocation] = useState("");
  const today = todayStr();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [legs, setLegs] = useState(["", ""]);
  const invalid = endDate < startDate;
  const n = invalid ? 0 : daysBetween(startDate, endDate);

  function updateLeg(i, value) { setLegs((prev) => prev.map((l, idx) => (idx === i ? value : l))); }
  function addLegField() { setLegs((prev) => [...prev, ""]); }
  function removeLegField(i) { setLegs((prev) => prev.filter((_, idx) => idx !== i)); }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
      <div style={{ background: "#FFFDF9", borderRadius: 14, padding: 24, width: "100%", maxWidth: 380, boxShadow: "0 10px 30px rgba(0,0,0,0.4)", maxHeight: "90vh", overflowY: "auto" }}>
        <div className="pm-display" style={{ fontSize: 26, marginBottom: 16, color: "var(--ink)" }}>New trip</div>

        <TripTypeFields type={type} setType={setType} location={location} setLocation={setLocation} />

        <div style={{ marginBottom: 12 }}>
          <span className="pm-label">Name</span>
          <input className="pm-input" value={name} onChange={(e) => setName(arrowify(e.target.value))} placeholder={type === "single" ? "5 days in Amsterdam" : "Coast to coast"} />
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 6 }}>
          <div style={{ flex: 1 }}>
            <span className="pm-label">Start date</span>
            <input className="pm-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <span className="pm-label">End date</span>
            <input className="pm-input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="pm-mono" style={{ fontSize: 11, color: invalid ? "var(--rust)" : "var(--ink-soft)", marginBottom: 18 }}>
          {invalid ? "end date needs to be after the start date" : `${n} day${n === 1 ? "" : "s"}`}
        </div>

        {type === "multi" && (
          <div style={{ marginBottom: 18 }}>
            <span className="pm-label">Legs (optional)</span>
            <div className="pm-mono" style={{ fontSize: 11, color: "var(--ink-soft)", marginBottom: 8 }}>Days split evenly across legs — drag to fine-tune later.</div>
            <div style={{ display: "grid", gap: 6 }}>
              {legs.map((leg, i) => (
                <div key={i} style={{ display: "flex", gap: 6 }}>
                  <input className="pm-input" style={{ fontSize: 13 }} value={leg} onChange={(e) => updateLeg(i, e.target.value)} placeholder={`Leg ${i + 1}, e.g. Vancouver`} />
                  {legs.length > 1 && (
                    <button onClick={() => removeLegField(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-soft)" }} aria-label="Remove leg"><X size={14} /></button>
                  )}
                </div>
              ))}
            </div>
            <button className="pm-btn pm-btn-ghost" style={{ marginTop: 8, fontSize: 11, padding: "5px 10px", color: "var(--ink)", borderColor: "rgba(46,43,38,0.3)" }} onClick={addLegField}><Plus size={12} /> add a leg</button>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="pm-btn pm-btn-ghost" style={{ color: "var(--ink)", borderColor: "rgba(46,43,38,0.3)" }} onClick={onCancel}>Cancel</button>
          <button className="pm-btn pm-btn-solid" disabled={invalid} onClick={() => !invalid && onCreate({ name, type, location, startDate, endDate, legs: legs.filter((l) => l.trim()) })}>Create trip</button>
        </div>
      </div>
    </div>
  );
}

function EditTripModal({ trip, onCancel, onSave, onSetCover }) {
  const [name, setName] = useState(trip.name);
  const [type, setType] = useState(trip.type);
  const [location, setLocation] = useState(trip.location || "");
  const [startDate, setStartDate] = useState(trip.days[0] ? trip.days[0].date : todayStr());
  const [endDate, setEndDate] = useState(trip.days[trip.days.length - 1] ? trip.days[trip.days.length - 1].date : startDate);
  const fileInputRef = useRef(null);
  const invalid = endDate < startDate;
  const n = invalid ? 0 : daysBetween(startDate, endDate);
  const diff = n - trip.days.length;

  async function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageFile(file);
      onSetCover(dataUrl);
    } catch (err) { /* ignore */ }
    e.target.value = "";
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
      <div style={{ background: "#FFFDF9", borderRadius: 14, padding: 24, width: "100%", maxWidth: 380, boxShadow: "0 10px 30px rgba(0,0,0,0.4)", maxHeight: "90vh", overflowY: "auto" }}>
        <div className="pm-display" style={{ fontSize: 26, marginBottom: 16, color: "var(--ink)" }}>Edit trip</div>

        <TripTypeFields type={type} setType={setType} location={location} setLocation={setLocation} />

        <div style={{ marginBottom: 12 }}>
          <span className="pm-label">Name</span>
          <input className="pm-input" value={name} onChange={(e) => setName(arrowify(e.target.value))} />
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 6 }}>
          <div style={{ flex: 1 }}>
            <span className="pm-label">Start date</span>
            <input className="pm-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <span className="pm-label">End date</span>
            <input className="pm-input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="pm-mono" style={{ fontSize: 11, color: invalid ? "var(--rust)" : "var(--ink-soft)", marginBottom: 16 }}>
          {invalid ? "end date needs to be after the start date" : `${n} day${n === 1 ? "" : "s"}${diff < 0 ? ` — drops the last ${-diff} day(s), their notes will be lost` : diff > 0 ? ` — adds ${diff} blank day(s)` : ""}`}
        </div>

        <div style={{ marginBottom: 16 }}>
          <span className="pm-label">Cover photo</span>
          {trip.coverImage ? (
            <div style={{ position: "relative", width: "100%", height: 110, borderRadius: 8, overflow: "hidden", border: "1px solid rgba(46,43,38,0.2)" }}>
              <img src={trip.coverImage} alt="cover" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <button onClick={() => onSetCover(null)} style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%", width: 22, height: 22, color: "#fff", cursor: "pointer" }} aria-label="Remove photo"><X size={12} /></button>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "var(--ink-soft)", fontStyle: "italic" }}>No photo yet — the card uses a color block instead.</div>
          )}
          <button className="pm-btn pm-btn-ghost" style={{ marginTop: 8, fontSize: 11, color: "var(--ink)", borderColor: "rgba(46,43,38,0.3)" }} onClick={() => fileInputRef.current && fileInputRef.current.click()}>
            <Camera size={12} /> {trip.coverImage ? "replace photo" : "upload photo"}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="pm-btn pm-btn-ghost" style={{ color: "var(--ink)", borderColor: "rgba(46,43,38,0.3)" }} onClick={onCancel}>Cancel</button>
          <button className="pm-btn pm-btn-solid" disabled={invalid} onClick={() => !invalid && onSave({ name, type, location, startDate, endDate })}>Save changes</button>
        </div>
      </div>
    </div>
  );
}

function TripView({ trip, onBack, updateTrip }) {
  const [tab, setTab] = useState("itinerary");
  const [expandedDayIds, setExpandedDayIds] = useState(() => new Set());
  const [showEdit, setShowEdit] = useState(false);

  function updateDay(dayId, fn) {
    updateTrip((t) => ({ ...t, days: t.days.map((d) => (d.id === dayId ? fn(d) : d)) }));
  }

  function toggleDay(dayId) {
    setExpandedDayIds((prev) => {
      const next = new Set(prev);
      if (next.has(dayId)) next.delete(dayId); else next.add(dayId);
      return next;
    });
  }

  function reorderDays(fromIndex, toIndex) {
    if (fromIndex === toIndex || fromIndex == null || toIndex == null) return;
    updateTrip((t) => {
      const startDate = t.days[0].date;
      const days = [...t.days];
      const [moved] = days.splice(fromIndex, 1);
      days.splice(toIndex, 0, moved);
      return { ...t, days: days.map((d, i) => ({ ...d, date: addDays(startDate, i) })) };
    });
  }

  function moveActivity(fromDayId, activityId, toDayId, toIndex) {
    updateTrip((t) => {
      let moved = null;
      let days = t.days.map((d) => {
        if (d.id !== fromDayId) return d;
        const activities = d.activities.filter((a) => {
          if (a.id === activityId) { moved = a; return false; }
          return true;
        });
        return { ...d, activities };
      });
      if (!moved) return t;
      days = days.map((d) => {
        if (d.id !== toDayId) return d;
        const activities = [...d.activities];
        const insertAt = typeof toIndex === "number" ? Math.min(toIndex, activities.length) : activities.length;
        activities.splice(insertAt, 0, moved);
        return { ...d, activities };
      });
      let pins = t.pins, notes = t.notes;
      if (moved.kind === "pin") pins = t.pins.map((p) => (p.id === moved.pinId ? { ...p, dayId: toDayId } : p));
      if (moved.kind === "note") notes = (t.notes || []).map((n) => (n.id === moved.noteId ? { ...n, dayId: toDayId } : n));
      return { ...t, days, pins, notes };
    });
  }

  function addDay() {
    updateTrip((t) => {
      const last = t.days[t.days.length - 1];
      const newDate = last ? addDays(last.date, 1) : todayStr();
      const newDay = makeDay(newDate, t.type === "single" ? t.location : "", "");
      return { ...t, days: [...t.days, newDay] };
    });
  }

  function updateTripStash(fn) {
    updateTrip((t) => ({ ...t, stash: fn(t.stash) }));
  }
  function addSection(section) {
    updateTrip((t) => ({ ...t, sections: [...(t.sections || []), { id: uid(), stash: { hotels: [], spots: [], codes: [] }, ...section }] }));
  }
  function updateSection(id, fn) {
    updateTrip((t) => ({ ...t, sections: t.sections.map((s) => (s.id === id ? fn(s) : s)) }));
  }
  function removeSection(id) {
    updateTrip((t) => ({ ...t, sections: t.sections.filter((s) => s.id !== id) }));
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, marginBottom: 18 }}>
        <button className="pm-btn pm-btn-ghost" onClick={onBack}><ArrowLeft size={13} /> all trips</button>
        <button className="pm-btn pm-btn-ghost" onClick={() => setShowEdit(true)}><PenLine size={13} /> edit trip</button>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <div className="pm-display" style={{ fontSize: 34, lineHeight: 1.1, color: "var(--ink)" }}>{trip.name}</div>
          <div className="pm-mono" style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 6 }}>
            {trip.type === "single" && trip.location ? `based in ${trip.location} · ` : ""}{tripDateRange(trip)} · {trip.days.length} days
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <TabPill active={tab === "itinerary"} onClick={() => setTab("itinerary")} icon={BookOpen} label="Itinerary" />
          <TabPill active={tab === "overview"} onClick={() => setTab("overview")} icon={LayoutGrid} label="Overview" />
          <TabPill active={tab === "stops"} onClick={() => setTab("stops")} icon={MapIcon} label="Stops" />
        </div>
      </div>

      {tab === "itinerary" && (
        <ItineraryTab
          trip={trip}
          expandedDayIds={expandedDayIds}
          toggleDay={toggleDay}
          updateDay={updateDay}
          reorderDays={reorderDays}
          moveActivity={moveActivity}
          updateTripStash={updateTripStash}
          addSection={addSection}
          updateSection={updateSection}
          removeSection={removeSection}
          addDay={addDay}
          updateTrip={updateTrip}
        />
      )}
      {tab === "overview" && (
        <OverviewTab
          trip={trip}
          updateTrip={updateTrip}
          addSection={addSection}
          updateSection={updateSection}
          removeSection={removeSection}
        />
      )}
      {tab === "stops" && <StopsTab trip={trip} updateTrip={updateTrip} onPlan={() => setTab("overview")} />}

      {showEdit && (
        <EditTripModal
          trip={trip}
          onCancel={() => setShowEdit(false)}
          onSetCover={(url) => updateTrip((t) => ({ ...t, coverImage: url }))}
          onSave={(patch) => {
            updateTrip((t) => ({
              ...t,
              name: patch.name || "Untitled trip",
              type: patch.type,
              location: patch.type === "single" ? patch.location : "",
              days: rebuildDays(t.days, patch.startDate, daysBetween(patch.startDate, patch.endDate), patch.type, patch.location),
            }));
            setShowEdit(false);
          }}
        />
      )}
    </div>
  );
}

function TabPill({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className="pm-mono"
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        fontSize: 12, padding: "8px 14px", borderRadius: 20,
        border: `1.5px solid ${active ? "var(--forest)" : "rgba(42,32,25,0.3)"}`,
        background: active ? "var(--forest)" : "transparent",
        color: active ? "#fff" : "var(--ink)",
        cursor: "pointer",
      }}
    >
      <Icon size={13} /> {label}
    </button>
  );
}

function stashCount(day) {
  return day.stash.hotels.length + day.stash.spots.length + day.stash.codes.length;
}

function parseDragData(e) {
  try { return JSON.parse(e.dataTransfer.getData("text/plain")); } catch (err) { return null; }
}

function SortableDay({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({ id, data: { type: "day" }, transition: { duration: 150, easing: "cubic-bezier(0.2, 0, 0, 1)" } });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : "auto",
    position: "relative",
  };
  return <div ref={setNodeRef} style={style}>{children({ handleProps: { ...attributes, ...listeners }, isOver })}</div>;
}

function InsertLine() {
  return <div style={{ height: 3, background: "var(--forest)", borderRadius: 2, margin: "4px 0" }} />;
}

function DayDragPreview({ day, index }) {
  return (
    <div style={{ background: "#FFFDF9", border: "1.5px solid var(--forest)", borderRadius: 12, boxShadow: "0 10px 24px rgba(0,0,0,0.35)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, minWidth: 220, cursor: "grabbing" }}>
      <div className="pm-mono" style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--forest)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0 }}>{index + 1}</div>
      <div style={{ fontSize: 15, fontWeight: 700 }}>{day.city || day.blurb || "Untitled day"}</div>
    </div>
  );
}

function ItineraryTab({ trip, expandedDayIds, toggleDay, updateDay, reorderDays, moveActivity, updateTripStash, addSection, updateSection, removeSection, addDay, updateTrip }) {
  function updatePin(id, patch) { updateTrip((t) => ({ ...t, pins: t.pins.map((p) => (p.id === id ? { ...p, ...patch } : p)) })); }
  function unassignPin(id) {
    updateTrip((t) => ({
      ...t,
      pins: t.pins.map((p) => (p.id === id ? { ...p, dayId: null } : p)),
      days: t.days.map((d) => ({ ...d, activities: (d.activities || []).filter((a) => !(a.kind === "pin" && a.pinId === id)) })),
    }));
  }
  function updateNoteText(id, text) { updateTrip((t) => ({ ...t, notes: t.notes.map((n) => (n.id === id ? { ...n, text } : n)) })); }
  function unassignNote(id) {
    updateTrip((t) => ({
      ...t,
      notes: (t.notes || []).map((n) => (n.id === id ? { ...n, dayId: null } : n)),
      days: t.days.map((d) => ({ ...d, activities: (d.activities || []).filter((a) => !(a.kind === "note" && a.noteId === id)) })),
    }));
  }
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [activeDayId, setActiveDayId] = useState(null);
  const [overDayId, setOverDayId] = useState(null);
  const [activeAct, setActiveAct] = useState(null);
  const [overAct, setOverAct] = useState(null);

  const activeIndex = activeDayId ? trip.days.findIndex((d) => d.id === activeDayId) : -1;
  const overIndex = overDayId ? trip.days.findIndex((d) => d.id === overDayId) : -1;
  const activeDay = activeIndex !== -1 ? trip.days[activeIndex] : null;

  const activeActDay = activeAct ? trip.days.find((d) => d.id === activeAct.dayId) : null;
  const activeActivity = activeActDay ? (activeActDay.activities || []).find((a) => a.id === activeAct.id) : null;
  const activeActivityIndex = activeActDay ? (activeActDay.activities || []).findIndex((a) => a.id === activeAct.id) : -1;

  function handleDragStart(event) {
    const { active } = event;
    const type = active.data.current && active.data.current.type;
    if (type === "day") setActiveDayId(active.id);
    else if (type === "activity") setActiveAct({ id: active.id, dayId: active.data.current.dayId });
  }
  function handleDragOver(event) {
    const { active, over } = event;
    const type = active.data.current && active.data.current.type;
    if (type === "day") {
      setOverDayId(over ? over.id : null);
    } else if (type === "activity") {
      if (!over) { setOverAct(null); return; }
      const overType = over.data.current && over.data.current.type;
      if (overType === "activity") setOverAct({ id: over.id, dayId: over.data.current.dayId });
      else if (overType === "day") setOverAct({ id: over.id, dayId: over.id });
      else setOverAct(null);
    }
  }
  function handleDragCancel() { setActiveDayId(null); setOverDayId(null); setActiveAct(null); setOverAct(null); }
  function handleDragEnd(event) {
    const { active, over } = event;
    const type = active.data.current && active.data.current.type;
    setActiveDayId(null); setOverDayId(null); setActiveAct(null); setOverAct(null);
    if (!over) return;
    if (type === "day") {
      if (active.id === over.id) return;
      const oldIndex = trip.days.findIndex((d) => d.id === active.id);
      const newIndex = trip.days.findIndex((d) => d.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) reorderDays(oldIndex, newIndex);
    } else if (type === "activity") {
      const fromDayId = active.data.current.dayId;
      const overType = over.data.current && over.data.current.type;
      if (overType === "activity") {
        const toDayId = over.data.current.dayId;
        if (fromDayId === toDayId) {
          if (active.id === over.id) return;
          updateDay(fromDayId, (d) => {
            const oldIndex = d.activities.findIndex((a) => a.id === active.id);
            const newIndex = d.activities.findIndex((a) => a.id === over.id);
            if (oldIndex === -1 || newIndex === -1) return d;
            return { ...d, activities: arrayMove(d.activities, oldIndex, newIndex) };
          });
        } else {
          const toDay = trip.days.find((d) => d.id === toDayId);
          const rawIndex = toDay ? toDay.activities.findIndex((a) => a.id === over.id) : -1;
          moveActivity(fromDayId, active.id, toDayId, rawIndex === -1 ? undefined : rawIndex);
        }
      } else if (overType === "day") {
        const toDayId = over.id;
        if (fromDayId === toDayId) return;
        moveActivity(fromDayId, active.id, toDayId, undefined);
      }
    }
  }

  function handleSectionDrop(e, dayId) {
    e.preventDefault();
    const data = parseDragData(e);
    if (data && data.type === "section" && dayId) updateSection(data.sectionId, (s) => ({ ...s, beforeDayId: dayId }));
  }

  const dragOverlay = (
    <DragOverlay>
      {activeDay ? <DayDragPreview day={activeDay} index={activeIndex} /> : null}
      {activeActivity ? <ActivityDragPreview activity={activeActivity} index={activeActivityIndex} trip={trip} /> : null}
    </DragOverlay>
  );

  if (trip.type === "single") {
    return (
      <div>
        <div style={{ marginBottom: 22 }}>
          <StashPocket stash={trip.stash} updateStash={updateTripStash} defaultOpen label="Trip notes" />
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
          <SortableContext items={trip.days.map((d) => d.id)} strategy={verticalListSortingStrategy}>
            {trip.days.map((day, i) => (
              <React.Fragment key={day.id}>
                {overDayId === day.id && activeIndex > overIndex && <InsertLine />}
                <SortableDay id={day.id}>
                  {({ handleProps, isOver }) => {
                    const isCrossDayTarget = activeAct && activeAct.dayId !== day.id && overAct && overAct.dayId === day.id && !expandedDayIds.has(day.id);
                    return (
                      <div style={{ display: "flex", gap: 12, marginBottom: 14, alignItems: "flex-start" }}>
                        <div className="pm-mono" style={{ flexShrink: 0, marginTop: 14, width: 28, height: 28, borderRadius: "50%", background: "var(--forest)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>
                          {i + 1}
                        </div>
                        <div style={{ flex: 1, borderRadius: 12, overflow: "hidden", boxShadow: isCrossDayTarget ? "0 0 0 3px rgba(46,89,64,0.35)" : "0 2px 8px rgba(0,0,0,0.25)" }}>
                          <DayCardBody
                            day={day} expanded={expandedDayIds.has(day.id)} onToggle={() => toggleDay(day.id)} updateDay={(fn) => updateDay(day.id, fn)} hideCity
                            dragHandleProps={handleProps}
                            canMoveUp={i > 0} canMoveDown={i < trip.days.length - 1}
                            onMoveUp={() => reorderDays(i, i - 1)} onMoveDown={() => reorderDays(i, i + 1)}
                            activeAct={activeAct} overAct={overAct}
                            allPins={trip.pins}
                            allNotes={trip.notes}
                            categories={trip.categories}
                            onUnassignPin={unassignPin}
                            onUnassignNote={unassignNote}
                            onUpdateNoteText={updateNoteText}
                          />
                        </div>
                      </div>
                    );
                  }}
                </SortableDay>
                {overDayId === day.id && activeIndex < overIndex && <InsertLine />}
              </React.Fragment>
            ))}
          </SortableContext>
          {dragOverlay}
        </DndContext>
        <button className="pm-btn pm-btn-ghost" style={{ marginTop: 4, color: "var(--ink)", borderColor: "rgba(42,32,25,0.3)" }} onClick={addDay}><Plus size={12} /> add a day</button>
      </div>
    );
  }

  const dayIds = new Set(trip.days.map((d) => d.id));
  const trailingSections = (trip.sections || []).filter((s) => !s.beforeDayId || !dayIds.has(s.beforeDayId));

  return (
    <div>
      <AddSectionButton firstDayId={trip.days[0] ? trip.days[0].id : null} onAdd={addSection} />
      <div style={{ position: "relative", paddingLeft: 30, marginTop: 16 }}>
        <div style={{ position: "absolute", left: 13, top: 6, bottom: 6, borderLeft: "2px dashed rgba(42,32,25,0.25)" }} />
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
          <SortableContext items={trip.days.map((d) => d.id)} strategy={verticalListSortingStrategy}>
            {trip.days.map((day, i) => (
              <React.Fragment key={day.id}>
                {(trip.sections || []).filter((s) => s.beforeDayId === day.id).map((section) => (
                  <SectionHeader key={section.id} section={section} onUpdate={(fn) => updateSection(section.id, fn)} onRemove={() => removeSection(section.id)} />
                ))}
                {overDayId === day.id && activeIndex > overIndex && <div style={{ marginLeft: -30 }}><InsertLine /></div>}
                <SortableDay id={day.id}>
                  {({ handleProps }) => {
                    const isCrossDayTarget = activeAct && activeAct.dayId !== day.id && overAct && overAct.dayId === day.id && !expandedDayIds.has(day.id);
                    return (
                      <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleSectionDrop(e, day.id)}
                        style={{ marginBottom: 14 }}
                      >
                        <div className="pm-mono" style={{ position: "absolute", left: -30, top: 14, width: 26, height: 26, borderRadius: "50%", background: "#3C2A1A", border: "2px solid var(--bg)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>
                          {i + 1}
                        </div>
                        <div style={{ borderRadius: 12, overflow: "hidden", boxShadow: isCrossDayTarget ? "0 0 0 3px rgba(46,89,64,0.35)" : "0 2px 8px rgba(0,0,0,0.25)" }}>
                          <DayCardBody
                            day={day} expanded={expandedDayIds.has(day.id)} onToggle={() => toggleDay(day.id)} updateDay={(fn) => updateDay(day.id, fn)}
                            dragHandleProps={handleProps}
                            canMoveUp={i > 0} canMoveDown={i < trip.days.length - 1}
                            onMoveUp={() => reorderDays(i, i - 1)} onMoveDown={() => reorderDays(i, i + 1)}
                            activeAct={activeAct} overAct={overAct}
                            allPins={trip.pins}
                            allNotes={trip.notes}
                            categories={trip.categories}
                            onUnassignPin={unassignPin}
                            onUnassignNote={unassignNote}
                            onUpdateNoteText={updateNoteText}
                          />
                        </div>
                      </div>
                    );
                  }}
                </SortableDay>
                {overDayId === day.id && activeIndex < overIndex && <div style={{ marginLeft: -30 }}><InsertLine /></div>}
              </React.Fragment>
            ))}
          </SortableContext>
          {dragOverlay}
        </DndContext>
        {trailingSections.map((section) => (
          <SectionHeader key={section.id} section={section} onUpdate={(fn) => updateSection(section.id, fn)} onRemove={() => removeSection(section.id)} />
        ))}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const data = parseDragData(e);
            if (data && data.type === "section") updateSection(data.sectionId, (s) => ({ ...s, beforeDayId: null }));
          }}
          style={{ height: 28 }}
        />
        <button className="pm-btn pm-btn-ghost" style={{ marginTop: 4, color: "var(--ink)", borderColor: "rgba(42,32,25,0.3)" }} onClick={addDay}><Plus size={12} /> add a day</button>
      </div>
    </div>
  );
}

function AddSectionButton({ firstDayId, onAdd }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");

  if (!open) {
    return (
      <button className="pm-btn pm-btn-ghost" style={{ color: "var(--ink)", borderColor: "rgba(42,32,25,0.3)" }} onClick={() => setOpen(true)}>
        <Plus size={12} /> add a place group
      </button>
    );
  }
  return (
    <div style={{ background: "rgba(185,138,46,0.10)", border: "1px dashed var(--gold)", borderRadius: 10, padding: 12, display: "grid", gap: 8 }}>
      <input className="pm-input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Vancouver leg" autoFocus />
      <div className="pm-mono" style={{ fontSize: 11, color: "var(--ink-soft)" }}>Drag it into place once it's added.</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="pm-btn pm-btn-solid" onClick={() => { if (label.trim()) { onAdd({ label: label.trim(), beforeDayId: firstDayId }); setLabel(""); setOpen(false); } }}>Add group</button>
        <button className="pm-btn pm-btn-ghost" style={{ color: "var(--ink)", borderColor: "rgba(42,32,25,0.3)" }} onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}

function SectionHeader({ section, onUpdate, onRemove }) {
  const [dragging, setDragging] = useState(false);
  return (
    <div style={{ marginBottom: 10, marginTop: 4, opacity: dragging ? 0.4 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
          <span
            draggable
            onDragStart={(e) => { setDragging(true); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", JSON.stringify({ type: "section", sectionId: section.id })); }}
            onDragEnd={() => setDragging(false)}
            style={{ display: "flex", cursor: "grab", flexShrink: 0 }}
          >
            <GripVertical size={14} style={{ color: "var(--ink-soft)", opacity: 0.4 }} />
          </span>
          <Flag size={13} style={{ color: "var(--rust)", opacity: 0.7, flexShrink: 0 }} />
          <input
            value={section.label}
            onChange={(e) => onUpdate((s) => ({ ...s, label: arrowify(e.target.value) }))}
            style={{ background: "transparent", border: "none", fontSize: 15, fontWeight: 700, color: "var(--ink)", padding: 0, outline: "none", minWidth: 0, flex: 1, fontFamily: "inherit" }}
          />
        </div>
        <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-soft)" }} aria-label="Remove group"><X size={13} /></button>
      </div>
      <StashPocket stash={section.stash} updateStash={(fn) => onUpdate((s) => ({ ...s, stash: fn(s.stash) }))} label="Group notes" />
    </div>
  );
}

function DragHandleStack({ dragHandleProps, onUp, onDown, canUp, canDown, size, light }) {
  const s = size || 13;
  const col = light ? "#fff" : "var(--ink)";
  const gripCol = light ? "rgba(255,255,255,0.75)" : "var(--ink-soft)";
  const gripOpacity = light ? 1 : 0.4;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, gap: 1 }}>
      <button
        onClick={(e) => { e.stopPropagation(); canUp && onUp(); }}
        disabled={!canUp}
        style={{ background: "none", border: "none", cursor: canUp ? "pointer" : "default", opacity: canUp ? (light ? 0.85 : 0.6) : 0.25, padding: 0, lineHeight: 0, color: col }}
        aria-label="Move up"
      ><ChevronUp size={s} /></button>
      <span
        {...(dragHandleProps || {})}
        onClick={(e) => e.stopPropagation()}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", cursor: "grab", touchAction: "none", padding: "2px 0" }}
      >
        <GripVertical size={s} style={{ color: gripCol, opacity: gripOpacity }} />
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); canDown && onDown(); }}
        disabled={!canDown}
        style={{ background: "none", border: "none", cursor: canDown ? "pointer" : "default", opacity: canDown ? (light ? 0.85 : 0.6) : 0.25, padding: 0, lineHeight: 0, color: col }}
        aria-label="Move down"
      ><ChevronDown size={s} /></button>
    </div>
  );
}

function ActivityDragPreview({ activity, index, trip }) {
  let label = activity.where || "Untitled stop";
  if (activity.kind === "pin") {
    const pin = trip.pins.find((p) => p.id === activity.pinId);
    label = (pin && pin.name) || "Untitled stop";
  } else if (activity.kind === "note") {
    const note = (trip.notes || []).find((n) => n.id === activity.noteId);
    label = (note && note.text) || "Untitled note";
  }
  return (
    <div style={{ background: PAIR_WASHED.color, borderRadius: 8, padding: 10, boxShadow: "0 10px 24px rgba(0,0,0,0.3)", minWidth: 200, cursor: "grabbing" }}>
      <div className="pm-mono" style={{ fontSize: 9, color: "rgba(31,86,115,0.7)" }}>STOP {index + 1}</div>
      <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2, color: PAIR_WASHED.textColor }}>{label}</div>
    </div>
  );
}

function SortableActivity({ id, dayId, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, data: { type: "activity", dayId }, transition: { duration: 150, easing: "cubic-bezier(0.2, 0, 0, 1)" } });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : "auto",
    willChange: isDragging ? "transform" : "auto",
  };
  return <div ref={setNodeRef} style={style}>{children({ handleProps: { ...attributes, ...listeners } })}</div>;
}

function SimpleStopCard({ dragHandleProps, titleValue, onTitleChange, titleReadOnly, icon: Icon, expanded, onToggleExpand, expandedContent, onRemove }) {
  const p = PAIR_WASHED;
  return (
    <Textured color={p.color} texture="woven" radius={8} style={{ marginBottom: 8, padding: "8px 10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {dragHandleProps && (
          <span {...dragHandleProps} style={{ cursor: "grab", touchAction: "none", display: "flex", flexShrink: 0 }}>
            <GripVertical size={12} style={{ opacity: 0.6, color: p.textColor }} />
          </span>
        )}
        {Icon && <span style={{ color: p.textColor, display: "flex", flexShrink: 0 }}><Icon size={13} /></span>}
        {titleReadOnly ? (
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: p.textColor, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titleValue || "Untitled"}</span>
        ) : (
          <input
            className="pm-input"
            style={{ flex: 1, fontSize: 13, padding: "5px 8px", background: "rgba(255,255,255,0.7)", border: "none", color: "var(--ink)" }}
            value={titleValue}
            onChange={(e) => onTitleChange(arrowify(e.target.value))}
            placeholder=""
          />
        )}
        {expandedContent && (
          <button onClick={onToggleExpand} style={{ background: "none", border: "none", cursor: "pointer", color: p.textColor, opacity: 0.8, display: "flex", flexShrink: 0 }} aria-label="Expand">
            <ChevronDown size={13} style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }} />
          </button>
        )}
        {onRemove && <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", color: p.textColor, opacity: 0.8, flexShrink: 0 }} aria-label="Remove"><X size={13} /></button>}
      </div>
      {expanded && expandedContent && <div style={{ marginTop: 6, background: "rgba(255,255,255,0.92)", borderRadius: 6, padding: 8 }}>{expandedContent}</div>}
    </Textured>
  );
}


function DayCardBody({ day, expanded, onToggle, updateDay, hideCity, dragHandleProps, canMoveUp, canMoveDown, onMoveUp, onMoveDown, activeAct, overAct, allPins, allNotes, categories, onUnassignPin, onUnassignNote, onUpdateNoteText }) {
  const [expandedActIds, setExpandedActIds] = useState(() => new Set());

  function toggleSet(setter, id) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function addActivity() { updateDay((d) => ({ ...d, activities: [...(d.activities || []), act("", "")] })); }
  function updateActivity(id, patch) { updateDay((d) => ({ ...d, activities: d.activities.map((a) => (a.id === id ? { ...a, ...patch } : a)) })); }
  function removeActivity(id) { updateDay((d) => ({ ...d, activities: d.activities.filter((a) => a.id !== id) })); }

  const titleValue = hideCity ? day.blurb : day.city;
  const titleField = hideCity ? "blurb" : "city";
  const activities = day.activities || [];
  const activeIsMine = activeAct && activeAct.dayId === day.id;
  const overIsMine = overAct && overAct.dayId === day.id;
  const activeActivityIndex = activeIsMine ? activities.findIndex((a) => a.id === activeAct.id) : -1;
  const overActivityIndex = overIsMine ? activities.findIndex((a) => a.id === overAct.id) : -1;
  const p = PAIR_WASHED;

  return (
    <div>
      <Textured color={p.color} texture="woven" onClick={onToggle} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", cursor: "pointer", gap: 12, borderRadius: expanded ? "12px 12px 0 0" : 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <DragHandleStack dragHandleProps={dragHandleProps} onUp={onMoveUp} onDown={onMoveDown} canUp={canMoveUp} canDown={canMoveDown} />
          <div style={{ minWidth: 0 }}>
            <div className="pm-mono" style={{ fontSize: 11, color: "rgba(31,86,115,0.7)" }}>{formatDate(day.date)}</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginTop: 2, color: p.textColor }}>{hideCity ? (day.blurb || "Untitled day") : (day.city || "Untitled stop")}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <ChevronDown size={16} style={{ color: p.textColor, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }} />
        </div>
      </Textured>

      {expanded && (
        <div style={{ padding: "0 16px 18px", background: "#FFFDF9", border: "1.5px solid rgba(46,43,38,0.12)", borderTop: "none", borderRadius: "0 0 12px 12px" }}>
          <div style={{ marginTop: 14 }}>
            <input className="pm-input" value={titleValue} onChange={(e) => updateDay((d) => ({ ...d, [titleField]: arrowify(e.target.value) }))} placeholder="" />
          </div>

          <div style={{ marginTop: 16 }}>
            <div className="pm-mono" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-soft)", marginBottom: 8 }}>Activities</div>
            <SortableContext items={activities.map((a) => a.id)} strategy={verticalListSortingStrategy}>
              {activities.map((a, idx) => {
                const isExp = expandedActIds.has(a.id);

                let cardContent = null;
                if (a.kind === "pin") {
                  const pin = (allPins || []).find((p2) => p2.id === a.pinId);
                  if (!pin) return null;
                  const meta = catMeta({ categories }, pin.category);
                  const Icon = iconFor(meta.icon);
                  cardContent = (handleProps) => (
                    <SimpleStopCard
                      dragHandleProps={handleProps}
                      icon={Icon}
                      titleValue={pin.name}
                      titleReadOnly
                      expanded={isExp}
                      onToggleExpand={() => toggleSet(setExpandedActIds, a.id)}
                      expandedContent={
                        <div>
                          {pin.note && <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 6 }}>{pin.note}</div>}
                          {pin.link && <a href={pin.link} target="_blank" rel="noreferrer" className="pm-mono" style={{ fontSize: 11, color: "var(--navy)", display: "block", marginBottom: 6 }}>{pin.link}</a>}
                          <button className="pm-btn pm-btn-ghost" style={{ fontSize: 10, padding: "4px 9px", color: "var(--ink)", borderColor: "rgba(46,43,38,0.25)" }} onClick={() => onUnassignPin && onUnassignPin(pin.id)}>send back to unscheduled</button>
                        </div>
                      }
                      onRemove={() => onUnassignPin && onUnassignPin(pin.id)}
                    />
                  );
                } else if (a.kind === "note") {
                  const note = (allNotes || []).find((n) => n.id === a.noteId);
                  if (!note) return null;
                  cardContent = (handleProps) => (
                    <SimpleStopCard
                      dragHandleProps={handleProps}
                      titleValue={note.text}
                      onTitleChange={(v) => onUpdateNoteText && onUpdateNoteText(note.id, v)}
                      expanded={isExp}
                      onToggleExpand={() => toggleSet(setExpandedActIds, a.id)}
                      expandedContent={
                        <button className="pm-btn pm-btn-ghost" style={{ fontSize: 10, padding: "4px 9px", color: "var(--ink)", borderColor: "rgba(46,43,38,0.25)" }} onClick={() => onUnassignNote && onUnassignNote(note.id)}>send back to unscheduled</button>
                      }
                      onRemove={() => onUnassignNote && onUnassignNote(note.id)}
                    />
                  );
                } else {
                  cardContent = (handleProps) => (
                    <SimpleStopCard
                      dragHandleProps={handleProps}
                      titleValue={a.where}
                      onTitleChange={(v) => updateActivity(a.id, { where: v })}
                      expanded={isExp}
                      onToggleExpand={() => toggleSet(setExpandedActIds, a.id)}
                      expandedContent={
                        <textarea
                          className="pm-textarea"
                          style={{ fontSize: 13, minHeight: 50, background: "#FAF8F4", border: "1.5px solid rgba(46,43,38,0.15)" }}
                          value={a.text}
                          onChange={(e) => updateActivity(a.id, { text: arrowify(e.target.value) })}
                          placeholder=""
                        />
                      }
                      onRemove={() => removeActivity(a.id)}
                    />
                  );
                }

                return (
                  <React.Fragment key={a.id}>
                    {overIsMine && overAct.id === a.id && (activeIsMine ? activeActivityIndex > overActivityIndex : true) && <InsertLine />}
                    <SortableActivity id={a.id} dayId={day.id}>
                      {({ handleProps }) => cardContent(handleProps)}
                    </SortableActivity>
                    {overIsMine && overAct.id === a.id && activeIsMine && activeActivityIndex < overActivityIndex && <InsertLine />}
                  </React.Fragment>
                );
              })}
            </SortableContext>
            {activities.length === 0 && (
              <div style={{ fontSize: 12, color: "var(--ink-soft)", fontStyle: "italic", marginBottom: 8, padding: 10, border: overIsMine && overAct.id === day.id ? "1.5px dashed var(--forest)" : "1px dashed transparent", borderRadius: 8 }}>
                No activities yet — drop a stop here.
              </div>
            )}
            <button className="pm-btn pm-btn-ghost" style={{ fontSize: 11, padding: "5px 10px", color: "var(--ink)", borderColor: "rgba(46,43,38,0.3)" }} onClick={addActivity}><Plus size={12} /> add an activity</button>
          </div>
        </div>
      )}
    </div>
  );
}

function StashPocket({ stash, updateStash, defaultOpen, label }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const hasContent = !!(stash && stash.notes && stash.notes.trim());

  return (
    <div style={{ border: "2px solid rgba(31,86,115,0.35)", borderRadius: 10, padding: 10, minHeight: 46, background: "rgba(203,225,240,0.4)" }}>
      <button onClick={() => setOpen(!open)} className="pm-mono" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-soft)", fontSize: 11, display: "flex", alignItems: "center", gap: 6, padding: 0, width: "100%" }}>
        <PenLine size={12} /> {label || "Notes"}
        <ChevronDown size={12} style={{ marginLeft: "auto", transform: open ? "rotate(180deg)" : "none" }} />
      </button>

      {open ? (
        <textarea
          className="pm-input"
          value={stash.notes || ""}
          onChange={(e) => updateStash((s) => ({ ...s, notes: e.target.value }))}
          placeholder="Booking codes, confirmation numbers, anything worth keeping handy…"
          rows={4}
          style={{ width: "100%", resize: "vertical", fontFamily: "inherit", lineHeight: 1.5, marginTop: 8 }}
        />
      ) : (
        !hasContent && <div style={{ fontSize: 11, color: "var(--ink-soft)", opacity: 0.5, marginTop: 4 }}>drop notes here</div>
      )}
    </div>
  );
}

function DropZone({ id, children }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} style={{ border: `2px solid ${isOver ? "var(--rust)" : "rgba(31,86,115,0.35)"}`, borderRadius: 10, padding: 10, minHeight: 46, background: isOver ? "rgba(237,103,37,0.16)" : "rgba(203,225,240,0.4)", transition: "background 0.1s ease, border-color 0.1s ease" }}>
      {children}
    </div>
  );
}

function DraggablePin({ pin, categories, days, expanded, onToggle, onSave, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: pin.id, data: { type: "pin" } });
  const meta = catMeta({ categories }, pin.category);
  const Icon = iconFor(meta.icon);
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1, zIndex: isDragging ? 5 : "auto" };
  return (
    <div ref={setNodeRef} style={{ ...style, display: "inline-flex", flexDirection: "column", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ background: "var(--forest)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <span {...listeners} {...attributes} style={{ cursor: "grab", touchAction: "none", display: "flex", padding: "6px 0 6px 8px", flexShrink: 0 }}><GripVertical size={11} style={{ opacity: 0.7, color: "#fff" }} /></span>
          <button
            onClick={onToggle}
            className="pm-mono"
            style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, padding: "6px 10px 6px 4px", background: "none", border: "none", cursor: "pointer", color: "#fff" }}
          >
            <Icon size={11} style={{ color: "#fff" }} /> {pin.name}
          </button>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: 10, background: "#FFFDF9", borderTop: "1px solid rgba(46,43,38,0.12)", width: 230 }}>
          <PinForm days={days} categories={categories} initial={pin} hideDayField onCancel={onToggle} onSubmit={(patch) => onSave(pin.id, patch)} submitLabel="Save" />
          <button onClick={() => onRemove(pin.id)} style={{ marginTop: 4, background: "none", border: "none", color: "var(--ink-soft)", cursor: "pointer", fontSize: 11, padding: 0 }}>remove pin</button>
        </div>
      )}
    </div>
  );
}

function DraggableNote({ note, onChange, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: note.id, data: { type: "note" } });
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1, zIndex: isDragging ? 5 : "auto" };
  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 6px 4px 8px", borderRadius: 14, background: "var(--forest)" }}>
        <span {...listeners} {...attributes} style={{ cursor: "grab", touchAction: "none", display: "flex" }}><GripVertical size={11} style={{ opacity: 0.7, color: "#fff" }} /></span>
        <input value={note.text} onChange={(e) => onChange(e.target.value)} placeholder="Note…" className="pm-mono" style={{ border: "none", background: "transparent", fontSize: 11, outline: "none", width: 110, color: "#fff" }} />
        <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", color: "#fff", opacity: 0.85, display: "flex" }} aria-label="Remove note"><X size={11} /></button>
      </div>
    </div>
  );
}

function OverviewTab({ trip, updateTrip, addSection, updateSection, removeSection }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [filter, setFilter] = useState("all");
  const [expandedPinId, setExpandedPinId] = useState(null);
  const [activeItem, setActiveItem] = useState(null);

  const days = trip.days;
  const notes = trip.notes || [];
  const categories = trip.categories && trip.categories.length ? trip.categories : defaultCategories();
  const pins = trip.pins.filter((p) => filter === "all" || p.category === filter);

  function handleDragStart(e) { setActiveItem({ type: e.active.data.current && e.active.data.current.type, id: e.active.id }); }
  function handleDragEnd(e) {
    const { active, over } = e;
    setActiveItem(null);
    if (!over) return;
    const type = active.data.current && active.data.current.type;
    const toDayId = over.id === "unscheduled" ? null : over.id;
    if (type === "pin") {
      updateTrip((t) => {
        const pin = t.pins.find((p) => p.id === active.id);
        if (!pin) return t;
        const fromDayId = pin.dayId;
        let days = t.days;
        if (fromDayId) days = days.map((d) => (d.id === fromDayId ? { ...d, activities: (d.activities || []).filter((a) => !(a.kind === "pin" && a.pinId === active.id)) } : d));
        if (toDayId) days = days.map((d) => (d.id === toDayId ? { ...d, activities: [...(d.activities || []), pinRef(active.id)] } : d));
        return { ...t, pins: t.pins.map((p) => (p.id === active.id ? { ...p, dayId: toDayId } : p)), days };
      });
    } else if (type === "note") {
      updateTrip((t) => {
        const note = (t.notes || []).find((n) => n.id === active.id);
        if (!note) return t;
        const fromDayId = note.dayId;
        let days = t.days;
        if (fromDayId) days = days.map((d) => (d.id === fromDayId ? { ...d, activities: (d.activities || []).filter((a) => !(a.kind === "note" && a.noteId === active.id)) } : d));
        if (toDayId) days = days.map((d) => (d.id === toDayId ? { ...d, activities: [...(d.activities || []), noteRef(active.id)] } : d));
        return { ...t, notes: (t.notes || []).map((n) => (n.id === active.id ? { ...n, dayId: toDayId } : n)), days };
      });
    }
  }

  function addNote() { updateTrip((t) => ({ ...t, notes: [...(t.notes || []), { id: uid(), text: "", dayId: null }] })); }
  function updateNote(id, text) { updateTrip((t) => ({ ...t, notes: t.notes.map((n) => (n.id === id ? { ...n, text } : n)) })); }
  function removeNote(id) { updateTrip((t) => ({ ...t, notes: t.notes.filter((n) => n.id !== id) })); }
  function savePin(id, patch) { updateTrip((t) => ({ ...t, pins: t.pins.map((p) => (p.id === id ? { ...p, ...patch } : p)) })); setExpandedPinId(null); }
  function removePin(id) { updateTrip((t) => ({ ...t, pins: t.pins.filter((p) => p.id !== id) })); setExpandedPinId(null); }

  const [sectionDragOverId, setSectionDragOverId] = useState(null);

  function handleSectionDrop(e, dayId) {
    e.preventDefault();
    setSectionDragOverId(null);
    const data = parseDragData(e);
    if (data && data.type === "section" && dayId) updateSection(data.sectionId, (s) => ({ ...s, beforeDayId: dayId }));
  }
  function handleTrailingSectionDrop(e) {
    e.preventDefault();
    setSectionDragOverId(null);
    const data = parseDragData(e);
    if (data && data.type === "section") updateSection(data.sectionId, (s) => ({ ...s, beforeDayId: null }));
  }

  const showGroups = trip.type !== "single";
  const dayIds = new Set(days.map((d) => d.id));
  const trailingSections = showGroups ? (trip.sections || []).filter((s) => !s.beforeDayId || !dayIds.has(s.beforeDayId)) : [];

  const timelineRows = [];
  {
    let counter = 0;
    days.forEach((day) => {
      if (showGroups) {
        (trip.sections || []).filter((s) => s.beforeDayId === day.id).forEach((section) => {
          timelineRows.push({ type: "group", key: section.id, section });
        });
      }
      counter += 1;
      timelineRows.push({ type: "day", key: day.id, day, index: counter });
    });
    if (showGroups) trailingSections.forEach((section) => timelineRows.push({ type: "group", key: section.id, section }));
  }
  const ROW_GAP = 14;

  const unscheduledPins = pins.filter((p) => !p.dayId);
  const unscheduledNotes = notes.filter((n) => !n.dayId);
  const activePin = activeItem && activeItem.type === "pin" ? trip.pins.find((p) => p.id === activeItem.id) : null;
  const activeNote = activeItem && activeItem.type === "note" ? notes.find((n) => n.id === activeItem.id) : null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All" />
          {categories.map((c) => (
            <FilterChip key={c.id} active={filter === c.id} onClick={() => setFilter(c.id)} label={c.name} icon={iconFor(c.icon)} color={c.color} />
          ))}
        </div>
        <button className="pm-btn pm-btn-ghost" style={{ color: "var(--ink)", borderColor: "rgba(42,32,25,0.3)" }} onClick={addNote}><Plus size={12} /> add a note</button>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div style={{ marginBottom: 22 }}>
          <div className="pm-mono" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-soft)", marginBottom: 6 }}>Unscheduled</div>
          <DropZone id="unscheduled">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {unscheduledPins.map((pin) => (
                <DraggablePin key={pin.id} pin={pin} categories={categories} days={days} expanded={expandedPinId === pin.id} onToggle={() => setExpandedPinId(expandedPinId === pin.id ? null : pin.id)} onSave={savePin} onRemove={removePin} />
              ))}
              {unscheduledNotes.map((note) => (
                <DraggableNote key={note.id} note={note} onChange={(text) => updateNote(note.id, text)} onRemove={() => removeNote(note.id)} />
              ))}
              {unscheduledPins.length === 0 && unscheduledNotes.length === 0 && (
                <span style={{ fontSize: 12, color: "var(--ink-soft)", fontStyle: "italic" }}>Nothing unscheduled — nice. Save more in Stops, or drag things back here.</span>
              )}
            </div>
          </DropZone>
        </div>

        {showGroups && (
          <div style={{ marginBottom: 12 }}>
            <AddSectionButton firstDayId={days[0] ? days[0].id : null} onAdd={addSection} />
          </div>
        )}

        <div style={{ display: "grid", gap: ROW_GAP }}>
          {timelineRows.map((row, idx) => {
            const isLast = idx === timelineRows.length - 1;
            const connector = !isLast && (
              <div style={{ position: "absolute", left: 11, top: 24, bottom: -ROW_GAP, width: 2, background: "rgba(60,42,26,0.15)", zIndex: 0 }} />
            );
            const circleBase = { width: 24, height: 24, borderRadius: "50%", background: "#3C2A1A", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative", zIndex: 1 };

            if (row.type === "group") {
              const section = row.section;
              return (
                <div key={row.key} style={{ position: "relative" }}>
                  {connector}
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={circleBase}><Flag size={11} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span
                          draggable
                          onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", JSON.stringify({ type: "section", sectionId: section.id })); }}
                          style={{ cursor: "grab", display: "flex", flexShrink: 0, padding: 2 }}
                        >
                          <GripVertical size={14} style={{ color: "var(--ink-soft)", opacity: 0.4 }} />
                        </span>
                        <input
                          value={section.label}
                          onChange={(e) => updateSection(section.id, (s) => ({ ...s, label: arrowify(e.target.value) }))}
                          style={{ background: "transparent", border: "none", fontSize: 15, fontWeight: 700, color: "var(--ink)", padding: 0, outline: "none", minWidth: 0, flex: 1, fontFamily: "inherit" }}
                        />
                        <button onClick={() => removeSection(section.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-soft)", flexShrink: 0 }} aria-label="Remove group"><X size={13} /></button>
                      </div>
                      <StashPocket stash={section.stash} updateStash={(fn) => updateSection(section.id, (s) => ({ ...s, stash: fn(s.stash) }))} label="Group notes" />
                    </div>
                  </div>
                </div>
              );
            }

            const day = row.day, i = row.index;
            const dayPins = pins.filter((p) => p.dayId === day.id);
            const dayNotes = notes.filter((n) => n.dayId === day.id);
            const isDragOver = sectionDragOverId === day.id;
            return (
              <div key={row.key} style={{ position: "relative" }}>
                {connector}
                <div
                  onDragOver={showGroups ? (e) => e.preventDefault() : undefined}
                  onDragEnter={showGroups ? () => setSectionDragOverId(day.id) : undefined}
                  onDragLeave={showGroups ? () => setSectionDragOverId((cur) => (cur === day.id ? null : cur)) : undefined}
                  onDrop={showGroups ? (e) => handleSectionDrop(e, day.id) : undefined}
                  style={{ display: "flex", gap: 10, alignItems: "flex-start", borderRadius: 12, outline: isDragOver ? "2px dashed var(--rust)" : "none", outlineOffset: 4, transition: "outline 0.1s ease" }}
                >
                  <div className="pm-mono" style={{ ...circleBase, fontSize: 10 }}>{i}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="pm-mono" style={{ fontSize: 11, color: "var(--ink-soft)", marginBottom: 4 }}>{day.city || formatDateShort(day.date)}</div>
                    <DropZone id={day.id}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {dayPins.map((pin) => (
                          <DraggablePin key={pin.id} pin={pin} categories={categories} days={days} expanded={expandedPinId === pin.id} onToggle={() => setExpandedPinId(expandedPinId === pin.id ? null : pin.id)} onSave={savePin} onRemove={removePin} />
                        ))}
                        {dayNotes.map((note) => (
                          <DraggableNote key={note.id} note={note} onChange={(text) => updateNote(note.id, text)} onRemove={() => removeNote(note.id)} />
                        ))}
                        {dayPins.length === 0 && dayNotes.length === 0 && <span style={{ fontSize: 11, color: "var(--ink-soft)", opacity: 0.5 }}>drop here</span>}
                      </div>
                    </DropZone>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {showGroups && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={() => setSectionDragOverId("__trailing__")}
            onDragLeave={() => setSectionDragOverId((cur) => (cur === "__trailing__" ? null : cur))}
            onDrop={handleTrailingSectionDrop}
            style={{ height: 28, marginTop: 4, borderRadius: 8, border: sectionDragOverId === "__trailing__" ? "2px dashed var(--rust)" : "2px dashed transparent", transition: "border-color 0.1s ease" }}
          />
        )}

        <DragOverlay>
          {activePin && (
            <div className="pm-mono" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, padding: "5px 10px", borderRadius: 14, border: `1.5px solid ${catMeta({ categories }, activePin.category).color}`, background: "#FFFDF9", boxShadow: "0 8px 18px rgba(0,0,0,0.25)" }}>
              {activePin.name}
            </div>
          )}
          {activeNote && (
            <div style={{ background: "rgba(185,138,46,0.18)", border: "1.5px dashed var(--gold)", borderRadius: 14, padding: "5px 10px", fontSize: 11, boxShadow: "0 8px 18px rgba(0,0,0,0.25)" }}>
              {activeNote.text || "Note"}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function FilterChip({ active, onClick, label, icon: Icon, color }) {
  return (
    <button onClick={onClick} className="pm-mono" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, padding: "6px 11px", borderRadius: 16, border: `1.5px solid ${active ? (color || "var(--ink)") : "rgba(42,32,25,0.3)"}`, background: active ? (color || "var(--forest)") : "transparent", color: active ? "#fff" : "var(--ink)", cursor: "pointer" }}>
      {Icon && <Icon size={12} />} {label}
    </button>
  );
}


function PinForm({ days, categories, onCancel, onSubmit, initial, submitLabel, hideDayField, title }) {
  const [name, setName] = useState(initial ? initial.name : "");
  const [category, setCategory] = useState(initial && initial.category ? initial.category : (categories[0] ? categories[0].id : ""));
  const [dayId, setDayId] = useState(initial && initial.dayId ? initial.dayId : "");
  const [note, setNote] = useState(initial ? initial.note : "");
  const [link, setLink] = useState(initial ? initial.link : "");
  const [latLng, setLatLng] = useState(initial && typeof initial.lat === "number" ? { lat: initial.lat, lng: initial.lng } : null);
  const nameInputRef = useRef(null);
  const acRef = useRef(null);
  const placesReady = useGoogleMapsReady();

  useEffect(() => {
    if (!placesReady || !nameInputRef.current || acRef.current) return;
    acRef.current = new window.google.maps.places.Autocomplete(nameInputRef.current, { fields: ["name", "geometry"] });
    acRef.current.addListener("place_changed", () => {
      const place = acRef.current.getPlace();
      if (!place) return;
      if (place.name) setName(place.name);
      if (place.geometry && place.geometry.location) {
        setLatLng({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() });
      }
    });
  }, [placesReady]);

  function submit() {
    if (!name) return;
    onSubmit({ name, category, dayId: dayId || null, note, link, lat: latLng ? latLng.lat : undefined, lng: latLng ? latLng.lng : undefined });
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {title && <div className="pm-display" style={{ fontSize: 22, color: "var(--ink)" }}>{title}</div>}
      <div>
        <span className="pm-label">Name {placesReady && <span style={{ opacity: 0.6 }}>(search enabled)</span>}</span>
        <input ref={nameInputRef} className="pm-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Place name" />
      </div>
      <div>
        <span className="pm-label">Category</span>
        <select className="pm-select" value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
        </select>
      </div>
      {!hideDayField && (
        <div>
          <span className="pm-label">Which day</span>
          <select className="pm-select" value={dayId} onChange={(e) => setDayId(e.target.value)}>
            <option value="">Unscheduled</option>
            {days.map((d, i) => (<option key={d.id} value={d.id}>{i + 1}. {d.city || formatDateShort(d.date)}</option>))}
          </select>
        </div>
      )}
      <div>
        <span className="pm-label">Note</span>
        <input className="pm-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why it's on the list" />
      </div>
      <div>
        <span className="pm-label">Link (optional)</span>
        <input className="pm-input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="pm-btn pm-btn-solid" onClick={submit}>{submitLabel || "Save pin"}</button>
        <button className="pm-btn pm-btn-ghost" style={{ color: "var(--ink)", borderColor: "rgba(46,43,38,0.3)" }} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function Modal({ onCancel, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }} onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#FFFDF9", borderRadius: 14, padding: 24, width: "100%", maxWidth: 380, boxShadow: "0 10px 30px rgba(0,0,0,0.4)", maxHeight: "90vh", overflowY: "auto" }}>
        {children}
      </div>
    </div>
  );
}

function IconPicker({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", maxWidth: 260 }}>
      {ICON_LIBRARY_KEYS.map((k) => {
        const Icon = ICON_LIBRARY[k];
        const active = value === k;
        return (
          <button key={k} onClick={() => onChange(k)} style={{ width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", border: active ? "2px solid var(--forest)" : "1px solid rgba(46,43,38,0.2)", borderRadius: 6, background: active ? "rgba(46,89,64,0.12)" : "#FAF8F4", cursor: "pointer", padding: 0, color: "var(--ink)" }}>
            <Icon size={13} />
          </button>
        );
      })}
    </div>
  );
}

function CategoryManager({ categories, onChange }) {
  const [open, setOpen] = useState(false);
  const [pickerFor, setPickerFor] = useState(null);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState(ICON_LIBRARY_KEYS[0]);

  function addCategory() {
    if (!newName.trim()) return;
    const color = CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length];
    onChange([...categories, { id: uid(), name: newName.trim(), icon: newIcon, color }]);
    setNewName("");
  }
  function updateCat(id, patch) { onChange(categories.map((c) => (c.id === id ? { ...c, ...patch } : c))); }
  function removeCat(id) { if (categories.length > 1) onChange(categories.filter((c) => c.id !== id)); }

  if (!open) {
    return <button className="pm-btn pm-btn-ghost" style={{ color: "var(--ink)", borderColor: "rgba(42,32,25,0.3)" }} onClick={() => setOpen(true)}><PenLine size={12} /> manage categories</button>;
  }

  return (
    <div style={{ background: "rgba(185,138,46,0.10)", border: "1px dashed var(--gold)", borderRadius: 10, padding: 14, marginBottom: 16, display: "grid", gap: 10 }}>
      <div className="pm-display" style={{ fontSize: 16, color: "var(--ink)" }}>Categories</div>
      {categories.map((c) => {
        const Icon = iconFor(c.icon);
        return (
          <div key={c.id} style={{ display: "grid", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => setPickerFor(pickerFor === c.id ? null : c.id)} style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid rgba(46,43,38,0.2)", background: "#FAF8F4", color: c.color, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                <Icon size={15} />
              </button>
              <input className="pm-input" style={{ flex: 1, fontSize: 13 }} value={c.name} onChange={(e) => updateCat(c.id, { name: e.target.value })} />
              <button onClick={() => removeCat(c.id)} disabled={categories.length <= 1} style={{ background: "none", border: "none", cursor: categories.length <= 1 ? "default" : "pointer", opacity: categories.length <= 1 ? 0.3 : 1, color: "var(--ink-soft)", flexShrink: 0 }} aria-label="Remove category"><X size={14} /></button>
            </div>
            {pickerFor === c.id && <IconPicker value={c.icon} onChange={(icon) => { updateCat(c.id, { icon }); setPickerFor(null); }} />}
          </div>
        );
      })}
      <div style={{ borderTop: "1px dashed rgba(46,43,38,0.2)", paddingTop: 10, display: "grid", gap: 6 }}>
        <div className="pm-mono" style={{ fontSize: 10, color: "var(--ink-soft)" }}>ADD A CATEGORY</div>
        <IconPicker value={newIcon} onChange={setNewIcon} />
        <div style={{ display: "flex", gap: 8 }}>
          <input className="pm-input" style={{ flex: 1, fontSize: 13 }} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Category name" />
          <button className="pm-btn pm-btn-solid" style={{ fontSize: 11, padding: "6px 12px" }} onClick={addCategory}>Add</button>
        </div>
      </div>
      <button className="pm-btn pm-btn-ghost" style={{ color: "var(--ink)", borderColor: "rgba(46,43,38,0.3)" }} onClick={() => setOpen(false)}>Done</button>
    </div>
  );
}

function StopsTab({ trip, updateTrip, onPlan }) {
  const envKey = getEnvApiKey();
  const [apiKey, setApiKey] = useState(() => getStoredApiKey());
  const [keyInput, setKeyInput] = useState("");
  const [status, setStatus] = useState(apiKey ? "loading" : "needs-key");
  const [pendingLatLng, setPendingLatLng] = useState(null);
  const [editingPinId, setEditingPinId] = useState(null);
  const [filterCategory, setFilterCategory] = useState("all");
  const mapRef = useRef(null);
  const searchRef = useRef(null);
  const mapObjRef = useRef(null);
  const markersRef = useRef([]);

  const categories = trip.categories && trip.categories.length ? trip.categories : defaultCategories();
  function setCategories(cats) { updateTrip((t) => ({ ...t, categories: cats })); }

  function saveKey() {
    if (!keyInput.trim()) return;
    try { localStorage.setItem(GMAPS_KEY_STORAGE, keyInput.trim()); } catch (e) { /* ignore */ }
    setApiKey(keyInput.trim());
    setStatus("loading");
  }
  function forgetKey() {
    try { localStorage.removeItem(GMAPS_KEY_STORAGE); } catch (e) { /* ignore */ }
    setApiKey(""); setKeyInput(""); setStatus("needs-key");
  }

  useEffect(() => {
    if (!apiKey) return;
    loadGoogleMaps(apiKey).then(() => setStatus("ready")).catch(() => setStatus("error"));
  }, [apiKey]);

  useEffect(() => {
    if (status !== "ready" || !mapRef.current) return;
    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: 40, lng: -110 },
      zoom: 4,
      gestureHandling: "cooperative",
      zoomControl: true,
      zoomControlOptions: { style: window.google.maps.ZoomControlStyle.LARGE },
    });
    mapObjRef.current = map;
    map.addListener("click", (e) => { setPendingLatLng({ lat: e.latLng.lat(), lng: e.latLng.lng() }); setEditingPinId(null); });

    if (searchRef.current) {
      const ac = new window.google.maps.places.Autocomplete(searchRef.current, { fields: ["geometry", "name"] });
      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        if (!place || !place.geometry) return;
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        updateTrip((t) => ({ ...t, pins: [...t.pins, { id: uid(), dayId: null, name: place.name || "Saved place", category: (t.categories && t.categories[0] ? t.categories[0].id : "cat-spot"), note: "", link: "", lat, lng }] }));
        if (searchRef.current) searchRef.current.value = "";
      });
    }

    return () => { markersRef.current.forEach((m) => m.setMap(null)); markersRef.current = []; };
  }, [status]);

  useEffect(() => {
    if (status !== "ready" || !mapObjRef.current) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    const geocoded = trip.pins.filter((p) => typeof p.lat === "number" && typeof p.lng === "number");
    geocoded.forEach((pin) => {
      const meta = catMeta(trip, pin.category);
      const marker = new window.google.maps.Marker({
        position: { lat: pin.lat, lng: pin.lng },
        map: mapObjRef.current,
        title: pin.name,
        icon: {
          url: thumbtackIconUrl(meta.color),
          scaledSize: new window.google.maps.Size(14, 24),
          anchor: new window.google.maps.Point(7, 20),
        },
      });
      marker.addListener("click", () => { setEditingPinId(pin.id); setPendingLatLng(null); });
      markersRef.current.push(marker);
    });
    if (geocoded.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      geocoded.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
      mapObjRef.current.fitBounds(bounds, 60);
      if (geocoded.length === 1) {
        window.google.maps.event.addListenerOnce(mapObjRef.current, "bounds_changed", () => {
          if (mapObjRef.current.getZoom() > 15) mapObjRef.current.setZoom(15);
        });
      }
    }
  }, [status, trip.pins]);

  function addPin(pin) { updateTrip((t) => ({ ...t, pins: [...t.pins, { id: uid(), ...pin }] })); setPendingLatLng(null); }
  function savePin(id, patch) { updateTrip((t) => ({ ...t, pins: t.pins.map((p) => (p.id === id ? { ...p, ...patch } : p)) })); setEditingPinId(null); }
  function removePin(id) { updateTrip((t) => ({ ...t, pins: t.pins.filter((p) => p.id !== id) })); setEditingPinId(null); }

  const galleryPins = trip.pins.filter((p) => filterCategory === "all" || p.category === filterCategory);

  if (status === "needs-key") {
    return (
      <div style={{ background: "#FAF8F4", border: "1.5px dashed rgba(42,32,25,0.3)", borderRadius: 12, padding: 24, maxWidth: 460, color: "var(--ink)" }}>
        <div className="pm-display" style={{ fontSize: 20, marginBottom: 8 }}>No API key found</div>
        <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 14 }}>
          This looks for a Vercel environment variable named <code>VITE_GOOGLE_MAPS_API_KEY</code> (Project Settings → Environment Variables), then redeploy. It has to have the <code>VITE_</code> prefix or Vite won't include it in the site. You'll also want the <strong>Maps JavaScript API</strong> enabled on that key, alongside Places.
          <br /><br />
          Or paste a key here just for this browser, as a fallback:
        </div>
        <input className="pm-input" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder="AIza…" style={{ marginBottom: 10 }} />
        <button className="pm-btn pm-btn-solid" onClick={saveKey}>Connect</button>
      </div>
    );
  }
  if (status === "error") {
    return <div style={{ fontSize: 13, color: "var(--rust-light)" }}>Couldn't load Google Maps with that key. {!envKey && <button className="pm-btn pm-btn-ghost" onClick={forgetKey} style={{ marginLeft: 8 }}>try a different key</button>}</div>;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 10, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 240px", maxWidth: 340 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ink-soft)" }} />
          <input ref={searchRef} className="pm-input" style={{ paddingLeft: 30 }} placeholder="Search for a place — saves it automatically" />
        </div>
        {envKey ? (
          <span className="pm-mono" style={{ fontSize: 10, color: "var(--forest-light)" }}>connected via Vercel</span>
        ) : (
          <button className="pm-btn pm-btn-ghost" onClick={forgetKey} style={{ fontSize: 11 }}>disconnect</button>
        )}
      </div>
      <div className="pm-mono" style={{ fontSize: 11, opacity: 0.8, marginBottom: 8 }}>search to save a spot instantly, or click the map to drop a pin by hand — pinch to zoom, two-finger swipe to pan</div>
      <div ref={mapRef} style={{ width: "100%", height: 380, borderRadius: 12, border: "1.5px solid rgba(42,32,25,0.25)", background: "#FAF8F4" }} />
      {status === "loading" && <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>loading map…</div>}

      {pendingLatLng && (
        <Modal onCancel={() => setPendingLatLng(null)}>
          <PinForm title="New stop" days={trip.days} categories={categories} initial={{ lat: pendingLatLng.lat, lng: pendingLatLng.lng }} onCancel={() => setPendingLatLng(null)} onSubmit={addPin} />
        </Modal>
      )}

      <div style={{ marginTop: 28, borderTop: "1px solid rgba(42,32,25,0.15)", paddingTop: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
          <div className="pm-display" style={{ fontSize: 20, color: "var(--ink)" }}>Saved spots</div>
          <CategoryManager categories={categories} onChange={setCategories} />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <FilterChip active={filterCategory === "all"} onClick={() => setFilterCategory("all")} label="All" />
          {categories.map((c) => (
            <FilterChip key={c.id} active={filterCategory === c.id} onClick={() => setFilterCategory(c.id)} label={c.name} icon={iconFor(c.icon)} color={c.color} />
          ))}
        </div>

        {galleryPins.length === 0 && <div style={{ fontSize: 13, color: "var(--ink-soft)", fontStyle: "italic" }}>No saved spots yet — search above or click the map.</div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {galleryPins.map((pin) => {
            const meta = catMeta(trip, pin.category);
            const Icon = iconFor(meta.icon);
            const day = trip.days.find((d) => d.id === pin.dayId);
            return (
              <Textured key={pin.id} color={PAIR_WASHED.color} texture="woven" radius={10} onClick={() => setEditingPinId(pin.id)} style={{ padding: 12, cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    <span style={{ color: PAIR_WASHED.textColor, flexShrink: 0 }}><Icon size={15} /></span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: PAIR_WASHED.textColor }}>{pin.name}</span>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); removePin(pin.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: PAIR_WASHED.textColor, opacity: 0.75, flexShrink: 0 }} aria-label="Remove"><X size={13} /></button>
                </div>
                <div className="pm-mono" style={{ fontSize: 10, color: PAIR_WASHED.textColor, opacity: 0.75, marginTop: 4 }}>{day ? `day · ${day.city || formatDateShort(day.date)}` : "unscheduled"}</div>
                {pin.note && <div style={{ fontSize: 12, color: PAIR_WASHED.textColor, opacity: 0.8, marginTop: 6 }}>{pin.note}</div>}
                <button style={{ fontSize: 10, padding: "4px 9px", marginTop: 10, border: "none", borderRadius: 18, fontWeight: 700, cursor: "pointer", background: "var(--icecube)", color: "var(--coffee)" }} onClick={(e) => { e.stopPropagation(); onPlan(); }}>plan →</button>
              </Textured>
            );
          })}
        </div>
      </div>

      {editingPinId && (
        <Modal onCancel={() => setEditingPinId(null)}>
          <PinForm
            title="Edit stop"
            days={trip.days} categories={categories}
            initial={trip.pins.find((p) => p.id === editingPinId)}
            onCancel={() => setEditingPinId(null)}
            onSubmit={(patch) => savePin(editingPinId, patch)}
            submitLabel="Save changes"
          />
        </Modal>
      )}
    </div>
  );
}
