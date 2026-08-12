import React, { useState, useEffect, useRef } from "react";
import {
  MapPin, Plus, X, ChevronDown, ArrowLeft, Search,
  Map as MapIcon, BookOpen, Tag, KeyRound, BedDouble, Utensils,
  Link2, Compass, Trash2, PenLine, Globe, Camera,
} from "lucide-react";

const STORAGE_KEY = "roadbook:trips";
const GMAPS_KEY_STORAGE = "postmark:gmaps-key";

const uid = () => Math.random().toString(36).slice(2, 10);

function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
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
        try { ctx.filter = "saturate(1.6) contrast(1.18) brightness(1.04)"; } catch (e) { /* ignore */ }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        try {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const d = imgData.data;
          const levels = 7;
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
  return { id: uid(), where: where || "", text: text || "" };
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
  return { ...trip, days: (trip.days || []).map(migrateDay) };
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
    { id: uid(), dayId: days[0].id, name: "Trees Organic Coffee", category: "restaurant", note: "First stop before hitting the road.", link: "" },
    { id: uid(), dayId: days[2].id, name: "Kerry Park", category: "spot", note: "Best skyline view in Seattle, go at dusk.", link: "" },
    { id: uid(), dayId: days[4].id, name: "Pok Pok", category: "restaurant", note: "Thai, apparently worth the wait.", link: "" },
    { id: uid(), dayId: days[5].id, name: "Smith Rock State Park", category: "spot", note: "Misery Ridge trail.", link: "" },
    { id: uid(), dayId: days[7].id, name: "Carter House Inn", category: "hotel", note: "Victorian B&B with a well-reviewed restaurant.", link: "" },
    { id: uid(), dayId: days[8].id, name: "Point Arena Lighthouse", category: "spot", note: "Climb to the top for coast views.", link: "" },
    { id: uid(), dayId: days[10].id, name: "Tartine Bakery", category: "restaurant", note: "Morning bun, get there early.", link: "" },
    { id: uid(), dayId: days[11].id, name: "Nepenthe", category: "restaurant", note: "Cliffside sunset dinner.", link: "" },
    { id: uid(), dayId: days[13].id, name: "Sunset Cliffs", category: "spot", note: "Trip-end sunset.", link: "" },
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
  };
}

const CATEGORY_META = {
  restaurant: { label: "Restaurants", icon: Utensils, ramp: "#C1591F", dark: "#7A3811" },
  spot: { label: "Spots", icon: MapPin, ramp: "#3C7A54", dark: "#1F4A32" },
  hotel: { label: "Hotels", icon: BedDouble, ramp: "#2C5F9E", dark: "#1B3F6B" },
};

const CARD_GRADIENTS = [
  "linear-gradient(135deg,#3C7A54,#1F3B2C)",
  "linear-gradient(135deg,#D9622A,#8B3E15)",
  "linear-gradient(135deg,#3E6690,#1B2E44)",
  "linear-gradient(135deg,#B98A2E,#6B4E17)",
];

// Classic pushpin colors, each with a lighter cap tone and a darker collar tone.
const PIN_TONES = [
  { main: "#E8402E", dark: "#A82418" },
  { main: "#2F7A46", dark: "#1F5230" },
  { main: "#2C5F9E", dark: "#1B3F6B" },
  { main: "#E8A33D", dark: "#A8721F" },
];

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

function thumbtackIconUrl(main, dark) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="52" viewBox="0 0 36 52">
    <path d="M17 30 L27 47" stroke="#1a1a1a" stroke-width="5" stroke-linecap="round"/>
    <path d="M17 30 L27 47" stroke="#D2D2D2" stroke-width="2.4" stroke-linecap="round"/>
    <rect x="9" y="16" width="16" height="16" rx="2" fill="${dark}" stroke="#1a1a1a" stroke-width="2"/>
    <rect x="11" y="16" width="4" height="16" fill="#fff" opacity="0.22"/>
    <ellipse cx="17" cy="15" rx="16" ry="8" fill="${main}" stroke="#1a1a1a" stroke-width="2.2"/>
    <ellipse cx="11" cy="11" rx="4.6" ry="2.2" fill="#fff" opacity="0.55" transform="rotate(-12 11 11)"/>
  </svg>`;
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

export default function App() {
  const [trips, setTrips] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [activeTripId, setActiveTripId] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);

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

  function updateTrip(tripId, fn) {
    setTrips((prev) => prev.map((t) => (t.id === tripId ? fn(t) : t)));
  }

  function createTrip({ name, type, location, startDate, endDate }) {
    const n = Math.max(1, Math.min(90, daysBetween(startDate, endDate)));
    const days = [];
    for (let i = 0; i < n; i++) days.push(makeDay(addDays(startDate, i), type === "single" ? location : "", ""));
    const trip = {
      id: uid(),
      name: name || "Untitled trip",
      type,
      location: type === "single" ? location : "",
      subtitle: `${n} day${n === 1 ? "" : "s"}`,
      days,
      pins: [],
      coverImage: null,
    };
    setTrips((prev) => [...(prev || []), trip]);
    setShowNewForm(false);
    setActiveTripId(trip.id);
  }

  function deleteTrip(tripId) {
    setTrips((prev) => prev.filter((t) => t.id !== tripId));
  }

  const activeTrip = trips ? trips.find((t) => t.id === activeTripId) : null;

  return (
    <div className="pm-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rye&family=Nunito:ital,wght@0,400;0,600;0,700;1,600&family=Caveat:wght@600;700&family=Space+Mono:wght@400;700&display=swap');

        .pm-root {
          --forest: #2E5940;
          --forest-light: #47825E;
          --rust: #C1591F;
          --rust-light: #D9622A;
          --navy: #2C4F73;
          --navy-light: #3E6690;
          --gold: #B98A2E;
          --cream: #F3ECDD;
          --ink: #2A2019;
          --ink-soft: #5C4E3F;
          --wood: #5C4630;
          --card-shadow: rgba(0,0,0,0.4);
          font-family: 'Nunito', sans-serif;
          color: var(--cream);
          min-height: 100vh;
          width: 100%;
          box-sizing: border-box;
          background:
            repeating-linear-gradient(3deg, rgba(0,0,0,0.06) 0px, rgba(0,0,0,0.06) 2px, transparent 2px, transparent 7px),
            repeating-linear-gradient(3deg, rgba(255,255,255,0.035) 0px, transparent 3px, transparent 10px),
            linear-gradient(100deg, var(--wood), #4E3A26 50%, var(--wood));
        }
        .pm-root * { box-sizing: border-box; }
        .pm-display { font-family: 'Rye', serif; }
        .pm-hand { font-family: 'Caveat', cursive; }
        .pm-mono { font-family: 'Space Mono', monospace; }
        .pm-btn {
          font-family: 'Nunito', sans-serif;
          font-weight: 700;
          font-size: 12px;
          letter-spacing: 0.01em;
          border: 1.5px solid var(--cream);
          background: transparent;
          color: var(--cream);
          padding: 8px 14px;
          border-radius: 20px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .pm-btn:hover { background: var(--rust); border-color: var(--rust); color: #fff; }
        .pm-btn-solid { background: var(--rust); border-color: var(--rust); color: #fff; }
        .pm-btn-solid:hover { background: var(--rust-light); border-color: var(--rust-light); color: #fff; }
        .pm-btn-ghost { border-color: rgba(243,236,221,0.4); }
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
        .pm-input:focus, .pm-textarea:focus, .pm-select:focus { outline: none; border-color: var(--rust); }
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
          <Masthead />
          <div className="pm-content">
            <TripView trip={activeTrip} onBack={() => setActiveTripId(null)} updateTrip={(fn) => updateTrip(activeTrip.id, fn)} />
          </div>
        </>
      ) : (
        <>
          <Masthead />
          <div className="pm-content">
            <HomeView trips={trips} onOpen={setActiveTripId} onNew={() => setShowNewForm(true)} onDelete={deleteTrip} />
          </div>
        </>
      )}

      {showNewForm && <NewTripModal onCancel={() => setShowNewForm(false)} onCreate={createTrip} />}
    </div>
  );
}

function PineTree({ size = 40 }) {
  return (
    <svg width={size} height={size * 1.3} viewBox="0 0 46 60">
      <rect x="20" y="46" width="6" height="10" fill="#4A3210" />
      <polygon points="23,4 6,26 40,26" fill="#3C7A54" stroke="#1a2e21" strokeWidth="1.5" />
      <polygon points="23,16 4,36 42,36" fill="#336B49" stroke="#1a2e21" strokeWidth="1.5" />
      <polygon points="23,28 2,50 44,50" fill="#2A5B3E" stroke="#1a2e21" strokeWidth="1.5" />
    </svg>
  );
}

function SuitcaseIcon({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 46 40">
      <rect x="16" y="2" width="14" height="10" rx="3" fill="none" stroke="#1a1a1a" strokeWidth="2.2" />
      <rect x="4" y="10" width="38" height="26" rx="4" fill="#C1591F" stroke="#1a1a1a" strokeWidth="2.2" />
      <line x1="4" y1="20" x2="42" y2="20" stroke="#1a1a1a" strokeWidth="1.6" opacity="0.5" />
      <rect x="9" y="16" width="6" height="8" fill="#1a1a1a" opacity="0.22" />
      <rect x="31" y="16" width="6" height="8" fill="#1a1a1a" opacity="0.22" />
    </svg>
  );
}

function BicycleIcon({ size = 40 }) {
  return (
    <svg width={size} height={size * 0.72} viewBox="0 0 60 40">
      <circle cx="12" cy="28" r="9" fill="none" stroke="#1a1a1a" strokeWidth="2.4" />
      <circle cx="48" cy="28" r="9" fill="none" stroke="#1a1a1a" strokeWidth="2.4" />
      <path d="M12 28 L24 12 L36 28 M24 12 L30 12 M36 28 L48 28 M20 20 L30 20" stroke="#2C5F9E" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Masthead() {
  return (
    <div style={{ background: "#FFFFFF", padding: "18px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}>
      <div className="pm-display" style={{ fontSize: 38, color: "#1a1a1a" }}>Postmark</div>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <SuitcaseIcon size={34} />
        <PineTree size={30} />
        <BicycleIcon size={34} />
      </div>
    </div>
  );
}

function Thumbtack({ tone, style }) {
  return (
    <svg width="36" height="52" viewBox="0 0 36 52" style={{ filter: "drop-shadow(0 5px 5px rgba(0,0,0,0.45))", ...style }}>
      <ellipse cx="20" cy="46" rx="4.5" ry="1.6" fill="rgba(0,0,0,0.32)" />
      <path d="M17 30 L27 47" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round" />
      <path d="M17 30 L27 47" stroke="#D2D2D2" strokeWidth="2.4" strokeLinecap="round" />
      <rect x="9" y="16" width="16" height="16" rx="2" fill={tone.dark} stroke="#1a1a1a" strokeWidth="2" />
      <rect x="11" y="16" width="4" height="16" fill="#fff" opacity="0.22" />
      <ellipse cx="17" cy="15" rx="16" ry="8" fill={tone.main} stroke="#1a1a1a" strokeWidth="2.2" />
      <ellipse cx="11" cy="11" rx="4.6" ry="2.2" fill="#fff" opacity="0.55" transform="rotate(-12 11 11)" />
    </svg>
  );
}

function PostmarkStamp({ accent, index, topText }) {
  const pathId = `pm-stamp-path-${index}`;
  return (
    <svg width="86" height="86" viewBox="0 0 100 100" style={{ position: "absolute", top: 8, right: 8, transform: `rotate(${index % 2 === 0 ? 6 : -5}deg)`, opacity: 0.92 }}>
      <defs>
        <path id={pathId} d="M 50,50 m -38,0 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0" />
      </defs>
      <circle cx="50" cy="50" r="38" fill="none" stroke={accent} strokeWidth="2.2" />
      <circle cx="50" cy="50" r="31" fill="none" stroke={accent} strokeWidth="1.2" />
      <text fontSize="8" fill={accent} letterSpacing="2">
        <textPath href={`#${pathId}`} startOffset="25%" textAnchor="middle">{topText}</textPath>
      </text>
      <line x1="20" y1="50" x2="80" y2="50" stroke={accent} strokeWidth="1.4" />
      <text x="50" y="44" textAnchor="middle" fontSize="15" fontWeight="700" fill={accent} className="pm-display">POST</text>
      <text x="50" y="66" textAnchor="middle" fontSize="7" fill={accent} letterSpacing="1.5">MARK</text>
    </svg>
  );
}

function ArchedTitle({ name, index }) {
  const pathId = `pm-title-arc-${index}`;
  const fontSize = name.length > 18 ? 30 : name.length > 11 ? 38 : 46;
  return (
    <svg viewBox="0 0 320 220" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
      <defs>
        <path id={pathId} d="M 20,155 Q 160,45 300,155" />
      </defs>
      <text
        fontSize={fontSize}
        fill="#fff"
        stroke="#1a1a1a"
        strokeWidth="7"
        strokeLinejoin="round"
        paintOrder="stroke"
        className="pm-display"
      >
        <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">{name}</textPath>
      </text>
    </svg>
  );
}

function TripCard({ trip, index, onOpen, onDelete, flipping, onStartFlip }) {
  const gradient = CARD_GRADIENTS[index % CARD_GRADIENTS.length];
  const tone = PIN_TONES[index % PIN_TONES.length];
  const pinRot = index % 2 === 0 ? -14 : 11;
  const cardRot = index % 3 === 0 ? -1.4 : (index % 3 === 1 ? 1 : -0.5);
  const stampAccent = PIN_TONES[(index + 1) % PIN_TONES.length].main;

  return (
    <div className="pm-card-wrap" style={{ position: "relative" }}>
      <Thumbtack
        tone={tone}
        style={{ position: "absolute", top: -20, left: index % 2 === 0 ? 26 : "auto", right: index % 2 === 0 ? "auto" : 26, transform: `rotate(${pinRot}deg)`, zIndex: 3 }}
      />
      <div
        onClick={() => onStartFlip(trip.id)}
        className={"pm-card" + (flipping ? " pm-flipping" : "")}
        style={{
          position: "relative",
          background: "#FFFFFF",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: "4px 10px 5px 9px",
          overflow: "hidden",
          cursor: "pointer",
          padding: 9,
          boxShadow: "0 10px 20px var(--card-shadow)",
          transform: `rotate(${cardRot}deg)`,
        }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(trip.id); }}
          style={{ position: "absolute", top: 15, left: 15, background: "rgba(0,0,0,0.5)", borderRadius: "50%", border: "none", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 2 }}
          aria-label="Delete trip"
        >
          <X size={13} color="#fff" />
        </button>

        <div style={{ position: "relative", height: 220, borderRadius: "2px 7px 3px 6px", overflow: "hidden", background: trip.coverImage ? `center / cover no-repeat url(${trip.coverImage})` : gradient, border: "2px solid rgba(0,0,0,0.65)" }}>
          <PostmarkStamp accent={stampAccent} index={index} topText={`★ ${formatDateShort(trip.days[0] ? trip.days[0].date : "")} ★`} />
          <ArchedTitle name={trip.name} index={index} />
        </div>
      </div>
      <div className="pm-mono" style={{ fontSize: 11, color: "var(--cream)", opacity: 0.85, marginTop: 8, paddingLeft: 4 }}>
        {trip.type === "single" && trip.location ? `based in ${trip.location} · ` : ""}{tripDateRange(trip)} · {trip.days.length}d
      </div>
    </div>
  );
}

function HomeView({ trips, onOpen, onNew, onDelete }) {
  const [flippingId, setFlippingId] = useState(null);

  function handleOpen(tripId) {
    if (flippingId) return;
    setFlippingId(tripId);
    setTimeout(() => onOpen(tripId), 480);
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 44, paddingTop: 34 }}>
        {trips.map((trip, i) => (
          <TripCard key={trip.id} trip={trip} index={i} onOpen={onOpen} onDelete={onDelete} flipping={flippingId === trip.id} onStartFlip={handleOpen} />
        ))}

        <div
          onClick={onNew}
          style={{
            border: "2px dashed rgba(243,236,221,0.4)",
            borderRadius: 14,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            minHeight: 230,
            cursor: "pointer",
            color: "var(--cream)",
          }}
        >
          <Plus size={22} />
          <span className="pm-mono" style={{ fontSize: 12 }}>start a new trip</span>
        </div>
      </div>
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
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const invalid = endDate < startDate;
  const n = invalid ? 0 : daysBetween(startDate, endDate);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
      <div style={{ background: "#FFFDF9", borderRadius: 14, padding: 24, width: "100%", maxWidth: 380, boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}>
        <div className="pm-display" style={{ fontSize: 26, marginBottom: 16, color: "var(--ink)" }}>New trip</div>

        <TripTypeFields type={type} setType={setType} location={location} setLocation={setLocation} />

        <div style={{ marginBottom: 12 }}>
          <span className="pm-label">Name</span>
          <input className="pm-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={type === "single" ? "5 days in Amsterdam" : "Coast to coast"} />
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
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="pm-btn pm-btn-ghost" style={{ color: "var(--ink)", borderColor: "rgba(46,43,38,0.3)" }} onClick={onCancel}>Cancel</button>
          <button className="pm-btn pm-btn-solid" disabled={invalid} onClick={() => !invalid && onCreate({ name, type, location, startDate, endDate })}>Create trip</button>
        </div>
      </div>
    </div>
  );
}

function EditTripModal({ trip, onCancel, onSave, onSetCover }) {
  const [name, setName] = useState(trip.name);
  const [type, setType] = useState(trip.type);
  const [location, setLocation] = useState(trip.location || "");
  const [startDate, setStartDate] = useState(trip.days[0] ? trip.days[0].date : new Date().toISOString().slice(0, 10));
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
          <input className="pm-input" value={name} onChange={(e) => setName(e.target.value)} />
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
  const [expandedDayId, setExpandedDayId] = useState(null);
  const [showEdit, setShowEdit] = useState(false);

  function updateDay(dayId, fn) {
    updateTrip((t) => ({ ...t, days: t.days.map((d) => (d.id === dayId ? fn(d) : d)) }));
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, marginBottom: 18 }}>
        <button className="pm-btn pm-btn-ghost" onClick={onBack}><ArrowLeft size={13} /> all trips</button>
        <button className="pm-btn pm-btn-ghost" onClick={() => setShowEdit(true)}><PenLine size={13} /> edit trip</button>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <div className="pm-display" style={{ fontSize: 34, lineHeight: 1.1, color: "var(--cream)" }}>{trip.name}</div>
          <div className="pm-mono" style={{ fontSize: 12, color: "var(--cream)", opacity: 0.8, marginTop: 6 }}>
            {trip.type === "single" && trip.location ? `based in ${trip.location} · ` : ""}{tripDateRange(trip)} · {trip.days.length} days
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <TabPill active={tab === "itinerary"} onClick={() => setTab("itinerary")} icon={BookOpen} label="Itinerary" />
          <TabPill active={tab === "map"} onClick={() => setTab("map")} icon={MapIcon} label="Stops" />
          <TabPill active={tab === "gmap"} onClick={() => setTab("gmap")} icon={Globe} label="Live Map" />
        </div>
      </div>

      {tab === "itinerary" && (
        <ItineraryTab trip={trip} expandedDayId={expandedDayId} setExpandedDayId={setExpandedDayId} updateDay={updateDay} />
      )}
      {tab === "map" && <MapTab trip={trip} updateTrip={updateTrip} />}
      {tab === "gmap" && <GoogleMapTab trip={trip} updateTrip={updateTrip} />}

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
        border: `1.5px solid ${active ? "var(--rust)" : "rgba(243,236,221,0.4)"}`,
        background: active ? "var(--rust)" : "transparent",
        color: "#fff",
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

function ItineraryTab({ trip, expandedDayId, setExpandedDayId, updateDay }) {
  if (trip.type === "single") {
    return (
      <div>
        {trip.days.map((day, i) => (
          <div key={day.id} style={{ display: "flex", gap: 12, marginBottom: 14, alignItems: "flex-start" }}>
            <div className="pm-mono" style={{ flexShrink: 0, marginTop: 14, width: 28, height: 28, borderRadius: "50%", background: "var(--forest)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>
              {i + 1}
            </div>
            <div style={{ flex: 1, background: "#FFFDF9", border: "1.5px solid rgba(46,43,38,0.12)", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.25)" }}>
              <DayCardBody day={day} expanded={expandedDayId === day.id} onToggle={() => setExpandedDayId(expandedDayId === day.id ? null : day.id)} updateDay={(fn) => updateDay(day.id, fn)} hideCity />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div style={{ position: "relative", paddingLeft: 30 }}>
      <div style={{ position: "absolute", left: 13, top: 6, bottom: 6, borderLeft: "2px dashed rgba(243,236,221,0.35)" }} />
      {trip.days.map((day, i) => (
        <div key={day.id} style={{ position: "relative", marginBottom: 14 }}>
          <div className="pm-mono" style={{ position: "absolute", left: -30, top: 14, width: 26, height: 26, borderRadius: "50%", background: "var(--navy)", border: "2px solid var(--cream)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>
            {i + 1}
          </div>
          <div style={{ background: "#FFFDF9", border: "1.5px solid rgba(46,43,38,0.12)", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.25)" }}>
            <DayCardBody day={day} expanded={expandedDayId === day.id} onToggle={() => setExpandedDayId(expandedDayId === day.id ? null : day.id)} updateDay={(fn) => updateDay(day.id, fn)} />
          </div>
        </div>
      ))}
    </div>
  );
}

function DayCardBody({ day, expanded, onToggle, updateDay, hideCity }) {
  function addActivity() { updateDay((d) => ({ ...d, activities: [...(d.activities || []), act("", "")] })); }
  function updateActivity(id, patch) { updateDay((d) => ({ ...d, activities: d.activities.map((a) => (a.id === id ? { ...a, ...patch } : a)) })); }
  function removeActivity(id) { updateDay((d) => ({ ...d, activities: d.activities.filter((a) => a.id !== id) })); }

  const titleValue = hideCity ? day.blurb : day.city;
  const titleField = hideCity ? "blurb" : "city";

  return (
    <div>
      <div onClick={onToggle} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", cursor: "pointer", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div className="pm-mono" style={{ fontSize: 11, color: "var(--ink-soft)" }}>{formatDate(day.date)}</div>
          <div style={{ fontSize: 17, fontWeight: 700, marginTop: 2 }}>{hideCity ? (day.blurb || "Untitled day") : (day.city || "Untitled stop")}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {stashCount(day) > 0 && (
            <span className="pm-mono" style={{ fontSize: 10, color: "var(--gold)", border: "1px solid var(--gold)", borderRadius: 10, padding: "2px 7px" }}>
              {stashCount(day)} tucked away
            </span>
          )}
          <ChevronDown size={16} style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }} />
        </div>
      </div>

      {expanded && (
        <div style={{ padding: "0 16px 18px", borderTop: "1px dashed rgba(46,43,38,0.18)" }}>
          <div style={{ marginTop: 14 }}>
            <span className="pm-label">{hideCity ? "Day title" : "Where"}</span>
            <input className="pm-input" value={titleValue} onChange={(e) => updateDay((d) => ({ ...d, [titleField]: e.target.value }))} placeholder={hideCity ? "What's this day about" : "City or neighborhood"} />
          </div>

          <div style={{ marginTop: 16 }}>
            <div className="pm-mono" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-soft)", marginBottom: 8 }}>Activities</div>
            {(day.activities || []).map((a, idx) => (
              <div key={a.id} style={{ marginBottom: 10, background: "#FAF8F4", border: "1px solid rgba(46,43,38,0.14)", borderRadius: 8, padding: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span className="pm-mono" style={{ fontSize: 9, color: "var(--ink-soft)", opacity: 0.75 }}>STOP {idx + 1}</span>
                  <button onClick={() => removeActivity(a.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-soft)" }} aria-label="Remove activity"><X size={13} /></button>
                </div>
                <div style={{ marginBottom: 6 }}>
                  <span className="pm-label">Where</span>
                  <input className="pm-input" style={{ fontSize: 13, padding: "6px 8px" }} value={a.where} onChange={(e) => updateActivity(a.id, { where: e.target.value })} placeholder="Place or stop" />
                </div>
                <div>
                  <span className="pm-label">To do</span>
                  <textarea className="pm-textarea" style={{ fontSize: 13, minHeight: 50 }} value={a.text} onChange={(e) => updateActivity(a.id, { text: e.target.value })} placeholder="What's the plan here" />
                </div>
              </div>
            ))}
            {(day.activities || []).length === 0 && <div style={{ fontSize: 12, color: "var(--ink-soft)", fontStyle: "italic", marginBottom: 8 }}>No activities yet.</div>}
            <button className="pm-btn pm-btn-ghost" style={{ fontSize: 11, padding: "5px 10px", color: "var(--ink)", borderColor: "rgba(46,43,38,0.3)" }} onClick={addActivity}><Plus size={12} /> add an activity</button>
          </div>

          <StashPocket day={day} updateDay={updateDay} />
        </div>
      )}
    </div>
  );
}

function StashPocket({ day, updateDay }) {
  const [open, setOpen] = useState(false);

  function addHotel(item) { updateDay((d) => ({ ...d, stash: { ...d.stash, hotels: [...d.stash.hotels, { id: uid(), ...item }] } })); }
  function addSpot(item) { updateDay((d) => ({ ...d, stash: { ...d.stash, spots: [...d.stash.spots, { id: uid(), ...item }] } })); }
  function addCode(item) { updateDay((d) => ({ ...d, stash: { ...d.stash, codes: [...d.stash.codes, { id: uid(), ...item }] } })); }
  function removeItem(kind, id) { updateDay((d) => ({ ...d, stash: { ...d.stash, [kind]: d.stash[kind].filter((x) => x.id !== id) } })); }

  return (
    <div style={{ marginTop: 16 }}>
      <button onClick={() => setOpen(!open)} className="pm-mono" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-soft)", fontSize: 11, display: "flex", alignItems: "center", gap: 6, padding: 0 }}>
        <PenLine size={12} /> {open ? "tuck the pocket away" : "tucked-away details"}
        <ChevronDown size={12} style={{ transform: open ? "rotate(180deg)" : "none" }} />
      </button>

      {open && (
        <div style={{ marginTop: 12, background: "rgba(185,138,46,0.10)", border: "1px dashed var(--gold)", borderRadius: 10, padding: 14, display: "grid", gap: 16 }}>
          <StashSection title="Hotels considered" icon={BedDouble} items={day.stash.hotels}
            renderItem={(item) => (<>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{item.name}</div>
              {item.note && <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{item.note}</div>}
              {item.link && <a href={item.link} target="_blank" rel="noreferrer" className="pm-mono" style={{ fontSize: 11, color: "var(--navy)" }}>{item.link}</a>}
            </>)}
            onAdd={addHotel} onRemove={(id) => removeItem("hotels", id)} fields={["name", "link", "note"]} />
          <StashSection title="Spots to maybe check out" icon={Tag} items={day.stash.spots}
            renderItem={(item) => (<>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{item.name}</div>
              {item.note && <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{item.note}</div>}
              {item.link && <a href={item.link} target="_blank" rel="noreferrer" className="pm-mono" style={{ fontSize: 11, color: "var(--navy)" }}>{item.link}</a>}
            </>)}
            onAdd={addSpot} onRemove={(id) => removeItem("spots", id)} fields={["name", "link", "note"]} />
          <StashSection title="Booking codes" icon={KeyRound} items={day.stash.codes}
            renderItem={(item) => (<>
              <span style={{ fontSize: 13 }}>{item.label}</span>
              <span className="pm-mono" style={{ fontSize: 12, marginLeft: 8, color: "var(--rust)" }}>{item.value}</span>
            </>)}
            onAdd={addCode} onRemove={(id) => removeItem("codes", id)} fields={["label", "value"]} />
        </div>
      )}
    </div>
  );
}

function StashSection({ title, icon: Icon, items, renderItem, onAdd, onRemove, fields }) {
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({});

  function submit() {
    if (!draft[fields[0]]) return;
    onAdd(draft);
    setDraft({});
    setShowForm(false);
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="pm-mono" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-soft)" }}>
          <Icon size={13} /> {title}
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--rust)" }} aria-label={`Add to ${title}`}>
          <Plus size={14} />
        </button>
      </div>

      <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
        {items.map((item) => (
          <div key={item.id} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, background: "#FFFDF9", border: "1px solid rgba(46,43,38,0.1)", borderRadius: 6, padding: "8px 10px" }}>
            <div style={{ minWidth: 0 }}>{renderItem(item)}</div>
            <button onClick={() => onRemove(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-soft)", flexShrink: 0 }} aria-label="Remove"><X size={13} /></button>
          </div>
        ))}
        {items.length === 0 && !showForm && <div style={{ fontSize: 12, color: "var(--ink-soft)", fontStyle: "italic" }}>Nothing tucked in yet.</div>}
      </div>

      {showForm && (
        <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
          {fields.map((f) => (
            <input key={f} className="pm-input" style={{ fontSize: 13, padding: "6px 8px" }} placeholder={f === "link" ? "link (optional)" : f} value={draft[f] || ""} onChange={(e) => setDraft({ ...draft, [f]: e.target.value })} />
          ))}
          <div style={{ display: "flex", gap: 6 }}>
            <button className="pm-btn pm-btn-solid" style={{ fontSize: 11, padding: "5px 10px" }} onClick={submit}>Add</button>
            <button className="pm-btn pm-btn-ghost" style={{ fontSize: 11, padding: "5px 10px", color: "var(--ink)", borderColor: "rgba(46,43,38,0.3)" }} onClick={() => { setShowForm(false); setDraft({}); }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function MapTab({ trip, updateTrip }) {
  const [filter, setFilter] = useState("all");
  const [selectedPinId, setSelectedPinId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPin, setEditingPin] = useState(null);

  const days = trip.days;
  const pins = trip.pins.filter((p) => filter === "all" || p.category === filter);
  const selectedPin = trip.pins.find((p) => p.id === selectedPinId);

  function dayIndexOf(dayId) { return days.findIndex((d) => d.id === dayId); }
  function addPin(pin) { updateTrip((t) => ({ ...t, pins: [...t.pins, { id: uid(), ...pin }] })); setShowForm(false); }
  function savePin(id, patch) { updateTrip((t) => ({ ...t, pins: t.pins.map((p) => (p.id === id ? { ...p, ...patch } : p)) })); setEditingPin(null); }
  function removePin(id) { updateTrip((t) => ({ ...t, pins: t.pins.filter((p) => p.id !== id) })); setSelectedPinId(null); setEditingPin(null); }

  const trackHeight = Math.max(360, days.length * 46);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All" />
          {Object.entries(CATEGORY_META).map(([key, meta]) => (
            <FilterChip key={key} active={filter === key} onClick={() => setFilter(key)} label={meta.label} icon={meta.icon} color={meta.ramp} />
          ))}
        </div>
        <button className="pm-btn pm-btn-solid" onClick={() => { setShowForm(!showForm); setEditingPin(null); }}><Plus size={13} /> add a pin</button>
      </div>

      {showForm && <PinForm days={days} onCancel={() => setShowForm(false)} onSubmit={addPin} submitLabel="Save pin" />}
      {editingPin && <PinForm days={days} initial={editingPin} onCancel={() => setEditingPin(null)} onSubmit={(patch) => savePin(editingPin.id, patch)} submitLabel="Save changes" />}

      <div style={{ display: "flex", gap: 24 }}>
        <div style={{ position: "relative", width: 140, flexShrink: 0, height: trackHeight }}>
          <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 2, background: "repeating-linear-gradient(to bottom, var(--navy-light) 0 6px, transparent 6px 12px)", transform: "translateX(-50%)" }} />
          {days.map((day, i) => {
            const top = (i / Math.max(1, days.length - 1)) * (trackHeight - 20);
            const dayPins = pins.filter((p) => p.dayId === day.id);
            const side = i % 2 === 0 ? -1 : 1;
            return (
              <div key={day.id} style={{ position: "absolute", top, left: "50%", transform: "translate(-50%, -50%)" }}>
                <div className="pm-mono" style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", border: "2px solid var(--navy-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "var(--navy)" }}>
                  {i + 1}
                </div>
                {dayPins.map((pin, j) => {
                  const meta = CATEGORY_META[pin.category];
                  const Icon = meta.icon;
                  return (
                    <button key={pin.id} onClick={() => { setSelectedPinId(pin.id); setEditingPin(null); setShowForm(false); }} title={pin.name}
                      style={{ position: "absolute", top: -2, left: side * (34 + j * 22), width: 22, height: 22, borderRadius: "50%", background: selectedPinId === pin.id ? meta.ramp : "#FFFDF9", border: `2px solid ${meta.ramp}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0, color: selectedPinId === pin.id ? "#fff" : meta.ramp }}>
                      <Icon size={11} />
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {selectedPin && !editingPin ? (
            <PinDetail pin={selectedPin} day={days.find((d) => d.id === selectedPin.dayId)} onClose={() => setSelectedPinId(null)} onRemove={() => removePin(selectedPin.id)} onEdit={() => setEditingPin(selectedPin)} />
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {pins.length === 0 && <div style={{ color: "var(--cream)", opacity: 0.7, fontSize: 13, fontStyle: "italic" }}>No pins here yet — add one, or pick a marker on the route.</div>}
              {pins.map((pin) => {
                const meta = CATEGORY_META[pin.category];
                const Icon = meta.icon;
                const day = days.find((d) => d.id === pin.dayId);
                return (
                  <div key={pin.id} onClick={() => { setSelectedPinId(pin.id); setEditingPin(null); }} style={{ display: "flex", alignItems: "center", gap: 10, background: "#FFFDF9", border: "1px solid rgba(46,43,38,0.12)", borderRadius: 8, padding: "9px 12px", cursor: "pointer" }}>
                    <span style={{ color: meta.ramp, display: "flex" }}><Icon size={15} /></span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{pin.name}</div>
                      <div className="pm-mono" style={{ fontSize: 10, color: "var(--ink-soft)" }}>day {dayIndexOf(pin.dayId) + 1} · {day ? day.city : ""}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, label, icon: Icon, color }) {
  return (
    <button onClick={onClick} className="pm-mono" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, padding: "6px 11px", borderRadius: 16, border: `1.5px solid ${active ? (color || "var(--cream)") : "rgba(243,236,221,0.4)"}`, background: active ? (color || "var(--forest)") : "transparent", color: "#fff", cursor: "pointer" }}>
      {Icon && <Icon size={12} />} {label}
    </button>
  );
}

function PinDetail({ pin, day, onClose, onRemove, onEdit }) {
  const meta = CATEGORY_META[pin.category];
  const Icon = meta.icon;
  return (
    <div style={{ background: "#FFFDF9", border: `1.5px solid ${meta.ramp}`, borderRadius: 10, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: meta.ramp, display: "flex" }}><Icon size={18} /></span>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>{pin.name}</div>
            <div className="pm-mono" style={{ fontSize: 10, color: "var(--ink-soft)" }}>{meta.label.slice(0, -1)} · day {day ? formatDateShort(day.date) : ""} · {day ? day.city : ""}</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-soft)" }} aria-label="Close"><X size={15} /></button>
      </div>
      {pin.note && <div style={{ marginTop: 10, fontSize: 14, color: "var(--ink)" }}>{pin.note}</div>}
      {pin.link && <a href={pin.link} target="_blank" rel="noreferrer" className="pm-mono" style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 8, fontSize: 12, color: "var(--navy)" }}><Link2 size={12} /> {pin.link}</a>}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button className="pm-btn pm-btn-ghost" style={{ color: "var(--ink)", borderColor: "rgba(46,43,38,0.3)" }} onClick={onEdit}><PenLine size={12} /> edit</button>
        <button className="pm-btn pm-btn-ghost" style={{ color: "var(--ink)", borderColor: "rgba(46,43,38,0.3)" }} onClick={onRemove}><Trash2 size={12} /> remove pin</button>
      </div>
    </div>
  );
}

function PinForm({ days, onCancel, onSubmit, initial, submitLabel }) {
  const [name, setName] = useState(initial ? initial.name : "");
  const [category, setCategory] = useState(initial ? initial.category : "restaurant");
  const [dayId, setDayId] = useState(initial ? initial.dayId : (days[0] ? days[0].id : ""));
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

  return (
    <div style={{ background: "rgba(185,138,46,0.10)", border: "1px dashed var(--gold)", borderRadius: 10, padding: 14, marginBottom: 16, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: "2 1 160px" }}>
          <span className="pm-label">Name {placesReady && <span style={{ opacity: 0.6 }}>(search enabled)</span>}</span>
          <input ref={nameInputRef} className="pm-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Place name" />
        </div>
        <div style={{ flex: "1 1 120px" }}>
          <span className="pm-label">Category</span>
          <select className="pm-select" value={category} onChange={(e) => setCategory(e.target.value)}>
            {Object.entries(CATEGORY_META).map(([key, meta]) => (<option key={key} value={key}>{meta.label.slice(0, -1)}</option>))}
          </select>
        </div>
        <div style={{ flex: "1 1 160px" }}>
          <span className="pm-label">Which day</span>
          <select className="pm-select" value={dayId} onChange={(e) => setDayId(e.target.value)}>
            {days.map((d, i) => (<option key={d.id} value={d.id}>{i + 1}. {d.city || formatDateShort(d.date)}</option>))}
          </select>
        </div>
      </div>
      <div>
        <span className="pm-label">Note</span>
        <input className="pm-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why it's on the list" />
      </div>
      <div>
        <span className="pm-label">Link (optional)</span>
        <input className="pm-input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="pm-btn pm-btn-solid" onClick={() => name && onSubmit({ name, category, dayId, note, link, lat: latLng ? latLng.lat : undefined, lng: latLng ? latLng.lng : undefined })}>{submitLabel || "Save pin"}</button>
        <button className="pm-btn pm-btn-ghost" style={{ color: "var(--ink)", borderColor: "rgba(46,43,38,0.3)" }} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function GoogleMapTab({ trip, updateTrip }) {
  const envKey = getEnvApiKey();
  const [apiKey, setApiKey] = useState(() => getStoredApiKey());
  const [keyInput, setKeyInput] = useState("");
  const [status, setStatus] = useState(apiKey ? "loading" : "needs-key");
  const [pendingLatLng, setPendingLatLng] = useState(null);
  const [selectedPinId, setSelectedPinId] = useState(null);
  const [editingPin, setEditingPin] = useState(null);
  const mapRef = useRef(null);
  const searchRef = useRef(null);
  const mapObjRef = useRef(null);
  const markersRef = useRef([]);

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
    const geocoded = trip.pins.filter((p) => typeof p.lat === "number" && typeof p.lng === "number");
    const center = geocoded.length
      ? { lat: geocoded.reduce((s, p) => s + p.lat, 0) / geocoded.length, lng: geocoded.reduce((s, p) => s + p.lng, 0) / geocoded.length }
      : { lat: 40, lng: -110 };
    const map = new window.google.maps.Map(mapRef.current, {
      center,
      zoom: geocoded.length ? 6 : 4,
      gestureHandling: "cooperative",
      zoomControl: true,
      zoomControlOptions: { style: window.google.maps.ZoomControlStyle.LARGE },
    });
    mapObjRef.current = map;
    map.addListener("click", (e) => { setPendingLatLng({ lat: e.latLng.lat(), lng: e.latLng.lng() }); setSelectedPinId(null); setEditingPin(null); });

    if (searchRef.current) {
      const ac = new window.google.maps.places.Autocomplete(searchRef.current, { fields: ["geometry"] });
      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        if (!place || !place.geometry) return;
        if (place.geometry.viewport) map.fitBounds(place.geometry.viewport);
        else { map.panTo(place.geometry.location); map.setZoom(13); }
      });
    }

    return () => { markersRef.current.forEach((m) => m.setMap(null)); markersRef.current = []; };
  }, [status]);

  useEffect(() => {
    if (status !== "ready" || !mapObjRef.current) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    trip.pins.filter((p) => typeof p.lat === "number" && typeof p.lng === "number").forEach((pin) => {
      const meta = CATEGORY_META[pin.category] || CATEGORY_META.spot;
      const marker = new window.google.maps.Marker({
        position: { lat: pin.lat, lng: pin.lng },
        map: mapObjRef.current,
        title: pin.name,
        icon: {
          url: thumbtackIconUrl(meta.ramp, meta.dark),
          scaledSize: new window.google.maps.Size(30, 43),
          anchor: new window.google.maps.Point(22, 39),
        },
      });
      marker.addListener("click", () => { setSelectedPinId(pin.id); setEditingPin(null); setPendingLatLng(null); });
      markersRef.current.push(marker);
    });
  }, [status, trip.pins]);

  function savePin(id, patch) { updateTrip((t) => ({ ...t, pins: t.pins.map((p) => (p.id === id ? { ...p, ...patch } : p)) })); setEditingPin(null); }
  function removePin(id) { updateTrip((t) => ({ ...t, pins: t.pins.filter((p) => p.id !== id) })); setSelectedPinId(null); setEditingPin(null); }

  const selectedPin = trip.pins.find((p) => p.id === selectedPinId);

  if (status === "needs-key") {
    return (
      <div style={{ background: "#FAF8F4", border: "1.5px dashed rgba(243,236,221,0.4)", borderRadius: 12, padding: 24, maxWidth: 460, color: "var(--ink)" }}>
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
          <input ref={searchRef} className="pm-input" style={{ paddingLeft: 30 }} placeholder="Search for a place…" />
        </div>
        {envKey ? (
          <span className="pm-mono" style={{ fontSize: 10, color: "var(--forest-light)" }}>connected via Vercel</span>
        ) : (
          <button className="pm-btn pm-btn-ghost" onClick={forgetKey} style={{ fontSize: 11 }}>disconnect</button>
        )}
      </div>
      <div className="pm-mono" style={{ fontSize: 11, opacity: 0.8, marginBottom: 8 }}>click anywhere on the map to drop a pin — pinch to zoom, two-finger swipe to pan</div>
      <div ref={mapRef} style={{ width: "100%", height: 420, borderRadius: 12, border: "1.5px solid rgba(243,236,221,0.3)", background: "#FAF8F4" }} />
      {status === "loading" && <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>loading map…</div>}

      {pendingLatLng && (
        <div style={{ marginTop: 14 }}>
          <PinForm
            days={trip.days}
            initial={{ lat: pendingLatLng.lat, lng: pendingLatLng.lng }}
            onCancel={() => setPendingLatLng(null)}
            onSubmit={(pin) => { updateTrip((t) => ({ ...t, pins: [...t.pins, { id: uid(), ...pin }] })); setPendingLatLng(null); }}
          />
        </div>
      )}

      {selectedPin && !editingPin && (
        <div style={{ marginTop: 14 }}>
          <PinDetail pin={selectedPin} day={trip.days.find((d) => d.id === selectedPin.dayId)} onClose={() => setSelectedPinId(null)} onRemove={() => removePin(selectedPin.id)} onEdit={() => setEditingPin(selectedPin)} />
        </div>
      )}
      {editingPin && (
        <div style={{ marginTop: 14 }}>
          <PinForm days={trip.days} initial={editingPin} onCancel={() => setEditingPin(null)} onSubmit={(patch) => savePin(editingPin.id, patch)} submitLabel="Save changes" />
        </div>
      )}
    </div>
  );
}
