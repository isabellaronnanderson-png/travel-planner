import React, { useState, useEffect, useRef } from "react";
import {
  MapPin, Plus, X, ChevronDown, ArrowLeft, Sunrise, Sun, Moon,
  Map as MapIcon, BookOpen, Tag, KeyRound, BedDouble, Utensils,
  Link2, Compass, Trash2, PenLine, Globe,
} from "lucide-react";

// Kept the same storage key as the original build so trips already saved
// in your browser (like the Amsterdam one) carry over after this update.
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

function makeDay(date, city, blurb, morning, noon, eve, extras) {
  return {
    id: uid(),
    date,
    city,
    blurb,
    morning: morning || "",
    noon: noon || "",
    eve: eve || "",
    stash: {
      hotels: (extras && extras.hotels) || [],
      spots: (extras && extras.spots) || [],
      codes: (extras && extras.codes) || [],
    },
  };
}

function buildSeedTrip() {
  const start = "2027-06-06";
  const days = [
    makeDay(start, "Vancouver, BC", "Start line — pick up the car and get a feel for the city before the road takes over.",
      "Pick up the rental downtown, coffee at Trees Organic.",
      "Wander Granville Island market, browse the maker stalls.",
      "Sunset at Kitsilano Beach, dinner in Gastown.",
      { hotels: [{ id: uid(), name: "Sylvia Hotel", link: "", note: "Heritage building, ivy-covered, harbor-view rooms book fast." }],
        spots: [{ id: uid(), name: "Capilano Suspension Bridge", link: "", note: "Apparently touristy but the canopy walk looks incredible." }],
        codes: [] }),
    makeDay(addDays(start, 1), "Vancouver → Seattle", "Border day. Short drive, long lunch stop.",
      "Border crossing at Peace Arch — aim to leave by 9am to beat lines.",
      "Lunch stop in Bellingham, walk around Fairhaven.",
      "Check into Seattle, Pike Place at golden hour.",
      { hotels: [{ id: uid(), name: "Ace Hotel Seattle", link: "", note: "Industrial-chic, walkable to the market." }],
        spots: [],
        codes: [{ id: uid(), label: "Rental car confirmation", value: "RC-88213" }] }),
    makeDay(addDays(start, 2), "Seattle", "A full day in the city — market, glass, and a rooftop to close it out.",
      "Pike Place Market, first thing when the flower stalls open.",
      "Chihuly Garden and Glass.",
      "Dinner in Capitol Hill, rooftop bar after.",
      { spots: [{ id: uid(), name: "Kerry Park", link: "", note: "Skyline + Space Needle view, apparently best at dusk." }] }),
    makeDay(addDays(start, 3), "Seattle → Portland", "South on the I-5, mountain permitting.",
      "Drive down I-5, stop at the Mount Rainier viewpoint if clear.",
      "Lunch in Olympia.",
      "Arrive Portland, Powell's Books before it closes.",
      { codes: [{ id: uid(), label: "Portland hotel confirmation", value: "POR-4471" }] }),
    makeDay(addDays(start, 4), "Portland", "Doughnuts, forest, and food carts.",
      "Voodoo Doughnut, then a walk through Forest Park.",
      "Food cart pod lunch on SW 5th.",
      "Dinner in Alberta Arts District.",
      { hotels: [{ id: uid(), name: "Jupiter Hotel", link: "", note: "Funky courtyard motel, good bar on site." }] }),
    makeDay(addDays(start, 5), "Portland → Bend", "Over the Cascades to high desert brewery country.",
      "Drive over the Cascades via Mt. Hood.",
      "Lunch in Sisters, browse the outdoor shops.",
      "Bend brewery crawl, Deschutes River walk.",
      { spots: [{ id: uid(), name: "Smith Rock State Park", link: "", note: "Heard the Misery Ridge trail is worth the climb." }] }),
    makeDay(addDays(start, 6), "Bend → Crater Lake → Redwoods", "Long driving day — rim views to old growth.",
      "Sunrise at Crater Lake rim, Rim Village overlook.",
      "Drive south through the Umpqua forest.",
      "Arrive Crescent City, first redwoods at dusk.",
      {}),
    makeDay(addDays(start, 7), "Redwoods → Eureka", "Giants, then a Victorian old town.",
      "Walk among the old growth at Fern Canyon.",
      "Avenue of the Giants scenic drive.",
      "Dinner in Eureka's Old Town.",
      { hotels: [{ id: uid(), name: "Carter House Inn", link: "", note: "Victorian B&B, good reviews for the restaurant." }] }),
    makeDay(addDays(start, 8), "Eureka → Mendocino → Sonoma", "Coast village, wine detour, plaza dinner.",
      "Coastal stop in Mendocino village.",
      "Wine tasting detour through Anderson Valley.",
      "Overnight in Sonoma, dinner on the plaza.",
      { spots: [{ id: uid(), name: "Point Arena Lighthouse", link: "", note: "Climb to the top for coast views, apparently few crowds." }] }),
    makeDay(addDays(start, 9), "Sonoma → San Francisco", "Into the city over the bridge.",
      "Golden Gate Bridge walk from the north side.",
      "Lunch in the Mission, taqueria crawl.",
      "Sunset at Twin Peaks.",
      { codes: [{ id: uid(), label: "SF hotel confirmation", value: "SF-99042" }] }),
    makeDay(addDays(start, 10), "San Francisco", "A full city day — market, island, North Beach.",
      "Ferry Building farmers market.",
      "Alcatraz tour (book ahead).",
      "Dinner in North Beach.",
      { hotels: [{ id: uid(), name: "Hotel Zeppelin", link: "", note: "Playful lobby, Union Square location." }] }),
    makeDay(addDays(start, 11), "San Francisco → Big Sur", "Highway 1 proper starts here.",
      "Drive Highway 1 through Half Moon Bay.",
      "Lunch in Monterey, Cannery Row walk.",
      "Sunset at McWay Falls.",
      { spots: [{ id: uid(), name: "Nepenthe", link: "", note: "Cliffside views, heard sunset seating needs a wait." }] }),
    makeDay(addDays(start, 12), "Big Sur → Santa Barbara", "Castle photo stop, coastal town landing.",
      "Continue south on Highway 1, Hearst Castle photo stop.",
      "Lunch in Cambria.",
      "Arrive Santa Barbara, sunset at Butterfly Beach.",
      { hotels: [{ id: uid(), name: "El Encanto", link: "", note: "Hillside views — a splurge, but feels like the occasion for it." }] }),
    makeDay(addDays(start, 13), "Santa Barbara → LA → San Diego", "Finish line — beaches the whole way down.",
      "Drive through LA, quick stop in Venice Beach.",
      "Lunch in Laguna Beach.",
      "Arrive San Diego, sunset at Sunset Cliffs, trip-end dinner.",
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
    name: "Vancouver → San Diego",
    subtitle: "Pacific coast road trip",
    days,
    pins,
  };
}

const CATEGORY_META = {
  restaurant: { label: "Restaurants", icon: Utensils, ramp: "#D9694F" },
  spot: { label: "Spots", icon: MapPin, ramp: "#6B8F5E" },
  hotel: { label: "Hotels", icon: BedDouble, ramp: "#5B8AA6" },
};

const CARD_GRADIENTS = [
  "linear-gradient(135deg,#9FC7E8,#5B8AA6)",
  "linear-gradient(135deg,#B3D89A,#6B8F5E)",
  "linear-gradient(135deg,#F4CE8C,#E8A33D)",
  "linear-gradient(135deg,#F3B29B,#D9694F)",
];

function tripDateRange(trip) {
  if (!trip.days.length) return "";
  return `${formatDateShort(trip.days[0].date)} – ${formatDateShort(trip.days[trip.days.length - 1].date)}`;
}

export default function App() {
  const [trips, setTrips] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [activeTripId, setActiveTripId] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setTrips(raw ? JSON.parse(raw) : [buildSeedTrip()]);
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

  function createTrip({ name, startDate, endDate }) {
    const n = Math.max(1, Math.min(90, daysBetween(startDate, endDate)));
    const days = [];
    for (let i = 0; i < n; i++) days.push(makeDay(addDays(startDate, i), "", ""));
    const trip = { id: uid(), name: name || "Untitled trip", subtitle: `${n} day${n === 1 ? "" : "s"}`, days, pins: [] };
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
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:ital,wght@0,400;0,600;0,700;1,600&family=Caveat:wght@600;700&family=Space+Mono:wght@400;700&display=swap');

        .pm-root {
          --ink: #2E2B26;
          --ink-soft: #6B6459;
          --coral: #D9694F;
          --meadow: #6B8F5E;
          --sky: #5B8AA6;
          --gold: #E8A33D;
          --card-shadow: rgba(46,43,38,0.14);
          font-family: 'Nunito', sans-serif;
          color: var(--ink);
          background: #FFFFFF;
          min-height: 100%;
          width: 100%;
          box-sizing: border-box;
          padding: 0 20px 60px;
          border-radius: 14px;
        }
        .pm-root * { box-sizing: border-box; }
        .pm-display { font-family: 'Fredoka', sans-serif; }
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
        .pm-btn:hover { background: var(--ink); color: #fff; }
        .pm-btn-solid { background: var(--coral); border-color: var(--coral); color: #fff; }
        .pm-btn-solid:hover { background: #c1543c; border-color: #c1543c; color: #fff; }
        .pm-btn-ghost { border-color: rgba(46,43,38,0.25); }
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
        .pm-input:focus, .pm-textarea:focus, .pm-select:focus { outline: none; border-color: var(--coral); }
        .pm-textarea { resize: vertical; min-height: 52px; font-size: 14px; line-height: 1.5; }
        .pm-label { font-family: 'Space Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-soft); display: block; margin-bottom: 4px; }
        .pm-card-wrap { perspective: 1200px; }
        .pm-card {
          transition: transform 0.55s cubic-bezier(.4,.1,.2,1), box-shadow 0.2s ease;
          transform-style: preserve-3d;
          backface-visibility: hidden;
        }
        .pm-card.pm-flipping { transform: rotateY(150deg); }
      `}</style>

      {trips === null ? (
        <div style={{ textAlign: "center", padding: "60px 0", fontFamily: "'Space Mono', monospace", fontSize: 13, color: "var(--ink-soft)" }}>
          sorting through the postcards…
        </div>
      ) : activeTrip ? (
        <TripView trip={activeTrip} onBack={() => setActiveTripId(null)} updateTrip={(fn) => updateTrip(activeTrip.id, fn)} />
      ) : (
        <HomeView trips={trips} onOpen={setActiveTripId} onNew={() => setShowNewForm(true)} onDelete={deleteTrip} />
      )}

      {showNewForm && <NewTripModal onCancel={() => setShowNewForm(false)} onCreate={createTrip} />}
    </div>
  );
}

function NatureHeader() {
  return (
    <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", marginBottom: 26, marginTop: 20 }}>
      <svg viewBox="0 0 1000 260" width="100%" height="220" style={{ display: "block" }} preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="pmSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#CDEAF6" />
            <stop offset="100%" stopColor="#FDF6E9" />
          </linearGradient>
        </defs>
        <rect width="1000" height="260" fill="url(#pmSky)" />
        <circle cx="840" cy="66" r="42" fill="#F4C05B" />
        {[0, 30, 60, 90, 120, 150].map((a) => (
          <line
            key={a}
            x1={840 + Math.cos((a * Math.PI) / 180) * 56}
            y1={66 + Math.sin((a * Math.PI) / 180) * 56}
            x2={840 + Math.cos((a * Math.PI) / 180) * 70}
            y2={66 + Math.sin((a * Math.PI) / 180) * 70}
            stroke="#F4C05B" strokeWidth="4" strokeLinecap="round"
          />
        ))}
        <g opacity="0.85" fill="#FFFFFF">
          <circle cx="140" cy="58" r="24" />
          <circle cx="172" cy="50" r="19" />
          <circle cx="108" cy="52" r="16" />
        </g>
        <path d="M0,60 q10,-8 20,0 q10,-8 20,0" stroke="#5B8AA6" strokeWidth="3" fill="none" strokeLinecap="round" transform="translate(560,20)" />
        <path d="M0,60 q10,-8 20,0 q10,-8 20,0" stroke="#5B8AA6" strokeWidth="3" fill="none" strokeLinecap="round" transform="translate(620,45)" />
        <path d="M0,190 Q150,120 300,180 T600,170 T1000,190 V260 H0 Z" fill="#A9C98F" />
        <path d="M0,215 Q200,160 450,205 T1000,210 V260 H0 Z" fill="#7FAE68" />
        <path d="M0,240 Q250,205 500,235 T1000,235 V260 H0 Z" fill="#5C8F4C" />
      </svg>
      <div style={{ position: "absolute", left: 24, bottom: 20, textShadow: "0 2px 10px rgba(255,255,255,0.6)" }}>
        <div className="pm-display" style={{ fontSize: 44, fontWeight: 600, color: "var(--ink)", lineHeight: 1 }}>Postmark</div>
        <div className="pm-hand" style={{ fontSize: 20, color: "var(--ink-soft)", marginTop: 2 }}>a scrapbook for trips still taking shape</div>
      </div>
    </div>
  );
}

const RUSTIC_PIN_TONES = [
  { rim: "#7A4423", mid: "#C1793D" },  // brass
  { rim: "#5E2118", mid: "#9C3B2A" },  // old tin red
  { rim: "#2E4B41", mid: "#557E6F" },  // verdigris
  { rim: "#6B4E17", mid: "#B08B33" },  // tarnished gold
];

function PushpinIllustration({ toneIndex, style }) {
  const tone = RUSTIC_PIN_TONES[toneIndex % RUSTIC_PIN_TONES.length];
  return (
    <svg width="34" height="46" viewBox="0 0 34 46" style={{ filter: "drop-shadow(0 5px 4px rgba(0,0,0,0.35))", ...style }}>
      <ellipse cx="17" cy="41" rx="6" ry="2.2" fill="rgba(0,0,0,0.25)" />
      <path d="M15.3 27 L17 43 L18.7 27 Z" fill="#8a8580" stroke="#57534d" strokeWidth="0.6" />
      <circle cx="17" cy="15" r="13" fill={tone.rim} />
      <circle cx="15" cy="13" r="10.5" fill={tone.mid} />
      <ellipse cx="12" cy="9" rx="3.6" ry="5.4" fill="#FFFFFF" opacity="0.4" transform="rotate(-25 12 9)" />
      <circle cx="17" cy="15" r="13" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
    </svg>
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
      <NatureHeader />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 30, paddingTop: 6 }}>
        {trips.map((trip, i) => {
          const gradient = CARD_GRADIENTS[i % CARD_GRADIENTS.length];
          const pinRot = i % 2 === 0 ? -14 : 11;
          const cardRot = i % 3 === 0 ? -1.6 : (i % 3 === 1 ? 1.1 : -0.6);
          const flipping = flippingId === trip.id;
          return (
            <div key={trip.id} className="pm-card-wrap" style={{ position: "relative" }}>
              <PushpinIllustration
                toneIndex={i}
                style={{ position: "absolute", top: -20, left: i % 2 === 0 ? 22 : "auto", right: i % 2 === 0 ? "auto" : 22, transform: `rotate(${pinRot}deg)`, zIndex: 3 }}
              />
              <div
                onClick={() => handleOpen(trip.id)}
                className={"pm-card" + (flipping ? " pm-flipping" : "")}
                style={{
                  position: "relative",
                  background: "linear-gradient(135deg, #F8F1DE, #F1E7CC)",
                  border: "1px solid rgba(90,72,42,0.18)",
                  borderRadius: "4px 10px 5px 9px",
                  overflow: "hidden",
                  cursor: "pointer",
                  padding: 9,
                  boxShadow: "0 7px 14px var(--card-shadow), inset 0 0 0 1px rgba(255,255,255,0.4)",
                  transform: `rotate(${cardRot}deg)`,
                  backgroundImage:
                    "radial-gradient(circle at 12% 85%, rgba(120,95,55,0.10), transparent 22%), radial-gradient(circle at 90% 12%, rgba(120,95,55,0.08), transparent 20%), linear-gradient(135deg, #F8F1DE, #F1E7CC)",
                }}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(trip.id); }}
                  style={{ position: "absolute", top: 14, right: 14, background: "rgba(255,255,255,0.8)", borderRadius: "50%", border: "none", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 2 }}
                  aria-label="Delete trip"
                >
                  <X size={13} />
                </button>
                <div style={{ height: 104, borderRadius: "2px 7px 3px 6px", background: gradient, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid rgba(40,32,20,0.55)" }}>
                  <Compass size={36} color="#FFFFFF" style={{ opacity: 0.9 }} />
                </div>
                <div style={{ padding: "12px 6px 6px" }}>
                  <div className="pm-hand" style={{ fontSize: 27, fontWeight: 700, lineHeight: 1, color: "#3B2E1A" }}>{trip.name}</div>
                  <div className="pm-mono" style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 6 }}>
                    {tripDateRange(trip)} · {trip.days.length}d
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        <div
          onClick={onNew}
          style={{
            border: "2px dashed rgba(46,43,38,0.28)",
            borderRadius: 14,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            minHeight: 168,
            cursor: "pointer",
            color: "var(--ink-soft)",
          }}
        >
          <Plus size={22} />
          <span className="pm-mono" style={{ fontSize: 12 }}>start a new trip</span>
        </div>
      </div>
    </div>
  );
}

function NewTripModal({ onCancel, onCreate }) {
  const [name, setName] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const invalid = endDate < startDate;
  const n = invalid ? 0 : daysBetween(startDate, endDate);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(46,43,38,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
      <div style={{ background: "#FFFDF9", borderRadius: 14, padding: 24, width: "100%", maxWidth: 360, boxShadow: "0 10px 30px rgba(0,0,0,0.25)" }}>
        <div className="pm-display" style={{ fontSize: 26, marginBottom: 16 }}>New trip</div>
        <div style={{ marginBottom: 12 }}>
          <span className="pm-label">Name</span>
          <input className="pm-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="5 days in Amsterdam" />
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
        <div className="pm-mono" style={{ fontSize: 11, color: invalid ? "var(--coral)" : "var(--ink-soft)", marginBottom: 18 }}>
          {invalid ? "end date needs to be after the start date" : `${n} day${n === 1 ? "" : "s"}`}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="pm-btn pm-btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="pm-btn pm-btn-solid" disabled={invalid} onClick={() => !invalid && onCreate({ name, startDate, endDate })}>Create trip</button>
        </div>
      </div>
    </div>
  );
}

function TripView({ trip, onBack, updateTrip }) {
  const [tab, setTab] = useState("itinerary");
  const [expandedDayId, setExpandedDayId] = useState(null);

  function updateDay(dayId, fn) {
    updateTrip((t) => ({ ...t, days: t.days.map((d) => (d.id === dayId ? fn(d) : d)) }));
  }

  return (
    <div>
      <button className="pm-btn pm-btn-ghost" onClick={onBack} style={{ marginTop: 20, marginBottom: 18 }}>
        <ArrowLeft size={13} /> all trips
      </button>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <div className="pm-display" style={{ fontSize: 38, lineHeight: 1 }}>{trip.name}</div>
          <div className="pm-mono" style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 4 }}>
            {tripDateRange(trip)} · {trip.days.length} days
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <TabPill active={tab === "itinerary"} onClick={() => setTab("itinerary")} icon={BookOpen} label="Itinerary" />
          <TabPill active={tab === "map"} onClick={() => setTab("map")} icon={MapIcon} label="Map" />
          <TabPill active={tab === "gmap"} onClick={() => setTab("gmap")} icon={Globe} label="Live Map" />
        </div>
      </div>

      {tab === "itinerary" && (
        <ItineraryTab trip={trip} expandedDayId={expandedDayId} setExpandedDayId={setExpandedDayId} updateDay={updateDay} />
      )}
      {tab === "map" && <MapTab trip={trip} updateTrip={updateTrip} />}
      {tab === "gmap" && <GoogleMapTab trip={trip} updateTrip={updateTrip} />}
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
        border: `1.5px solid ${active ? "var(--coral)" : "rgba(46,43,38,0.2)"}`,
        background: active ? "var(--coral)" : "transparent",
        color: active ? "#fff" : "var(--ink)",
        cursor: "pointer",
      }}
    >
      <Icon size={13} /> {label}
    </button>
  );
}

function ItineraryTab({ trip, expandedDayId, setExpandedDayId, updateDay }) {
  return (
    <div style={{ position: "relative", paddingLeft: 30 }}>
      <div style={{ position: "absolute", left: 13, top: 6, bottom: 6, borderLeft: "2px dashed rgba(46,43,38,0.25)" }} />
      {trip.days.map((day, i) => (
        <DayRow key={day.id} day={day} index={i} expanded={expandedDayId === day.id} onToggle={() => setExpandedDayId(expandedDayId === day.id ? null : day.id)} updateDay={(fn) => updateDay(day.id, fn)} />
      ))}
    </div>
  );
}

function stashCount(day) {
  return day.stash.hotels.length + day.stash.spots.length + day.stash.codes.length;
}

function DayRow({ day, index, expanded, onToggle, updateDay }) {
  return (
    <div style={{ position: "relative", marginBottom: 14 }}>
      <div className="pm-mono" style={{ position: "absolute", left: -30, top: 14, width: 26, height: 26, borderRadius: "50%", background: "#fff", border: "2px solid var(--ink)", color: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>
        {index + 1}
      </div>

      <div style={{ background: "#FFFDF9", border: "1.5px solid rgba(46,43,38,0.12)", borderRadius: 12, boxShadow: "0 2px 8px var(--card-shadow)" }}>
        <div onClick={onToggle} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", cursor: "pointer", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div className="pm-mono" style={{ fontSize: 11, color: "var(--ink-soft)" }}>{formatDate(day.date)}</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginTop: 2 }}>{day.city || "Untitled stop"}</div>
            {day.blurb && !expanded && <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 2, fontStyle: "italic" }}>{day.blurb}</div>}
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
            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 160px" }}>
                <span className="pm-label">Where</span>
                <input className="pm-input" value={day.city} onChange={(e) => updateDay((d) => ({ ...d, city: e.target.value }))} placeholder="City or neighborhood" />
              </div>
              <div style={{ flex: "2 1 220px" }}>
                <span className="pm-label">One line about the day</span>
                <input className="pm-input" value={day.blurb} onChange={(e) => updateDay((d) => ({ ...d, blurb: e.target.value }))} placeholder="What's this day about" />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginTop: 14 }}>
              <DaySlot icon={Sunrise} label="Morning" value={day.morning} onChange={(v) => updateDay((d) => ({ ...d, morning: v }))} />
              <DaySlot icon={Sun} label="Noon" value={day.noon} onChange={(v) => updateDay((d) => ({ ...d, noon: v }))} />
              <DaySlot icon={Moon} label="Evening" value={day.eve} onChange={(v) => updateDay((d) => ({ ...d, eve: v }))} />
            </div>

            <StashPocket day={day} updateDay={updateDay} />
          </div>
        )}
      </div>
    </div>
  );
}

function DaySlot({ icon: Icon, label, value, onChange }) {
  return (
    <div style={{ background: "#FAF8F4", border: "1px solid rgba(46,43,38,0.14)", borderRadius: 8, padding: 10 }}>
      <div className="pm-mono" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-soft)", marginBottom: 6 }}>
        <Icon size={12} /> {label}
      </div>
      <textarea className="pm-textarea" style={{ background: "transparent", border: "none", padding: 0, minHeight: 60 }} value={value} onChange={(e) => onChange(e.target.value)} placeholder="What's the plan" />
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
        <div style={{ marginTop: 12, background: "rgba(232,163,61,0.09)", border: "1px dashed var(--gold)", borderRadius: 10, padding: 14, display: "grid", gap: 16 }}>
          <StashSection title="Hotels considered" icon={BedDouble} items={day.stash.hotels}
            renderItem={(item) => (<>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{item.name}</div>
              {item.note && <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{item.note}</div>}
              {item.link && <a href={item.link} target="_blank" rel="noreferrer" className="pm-mono" style={{ fontSize: 11, color: "var(--sky)" }}>{item.link}</a>}
            </>)}
            onAdd={addHotel} onRemove={(id) => removeItem("hotels", id)} fields={["name", "link", "note"]} />
          <StashSection title="Spots to maybe check out" icon={Tag} items={day.stash.spots}
            renderItem={(item) => (<>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{item.name}</div>
              {item.note && <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{item.note}</div>}
              {item.link && <a href={item.link} target="_blank" rel="noreferrer" className="pm-mono" style={{ fontSize: 11, color: "var(--sky)" }}>{item.link}</a>}
            </>)}
            onAdd={addSpot} onRemove={(id) => removeItem("spots", id)} fields={["name", "link", "note"]} />
          <StashSection title="Booking codes" icon={KeyRound} items={day.stash.codes}
            renderItem={(item) => (<>
              <span style={{ fontSize: 13 }}>{item.label}</span>
              <span className="pm-mono" style={{ fontSize: 12, marginLeft: 8, color: "var(--coral)" }}>{item.value}</span>
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
        <button onClick={() => setShowForm(!showForm)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--coral)" }} aria-label={`Add to ${title}`}>
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
            <button className="pm-btn pm-btn-ghost" style={{ fontSize: 11, padding: "5px 10px" }} onClick={() => { setShowForm(false); setDraft({}); }}>Cancel</button>
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

  const days = trip.days;
  const pins = trip.pins.filter((p) => filter === "all" || p.category === filter);
  const selectedPin = trip.pins.find((p) => p.id === selectedPinId);

  function dayIndexOf(dayId) { return days.findIndex((d) => d.id === dayId); }
  function addPin(pin) { updateTrip((t) => ({ ...t, pins: [...t.pins, { id: uid(), ...pin }] })); setShowForm(false); }
  function removePin(id) { updateTrip((t) => ({ ...t, pins: t.pins.filter((p) => p.id !== id) })); setSelectedPinId(null); }

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
        <button className="pm-btn pm-btn-solid" onClick={() => setShowForm(!showForm)}><Plus size={13} /> add a pin</button>
      </div>

      {showForm && <PinForm days={days} onCancel={() => setShowForm(false)} onSubmit={addPin} />}

      <div style={{ display: "flex", gap: 24 }}>
        <div style={{ position: "relative", width: 140, flexShrink: 0, height: trackHeight }}>
          <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 2, background: "repeating-linear-gradient(to bottom, var(--sky) 0 6px, transparent 6px 12px)", transform: "translateX(-50%)" }} />
          {days.map((day, i) => {
            const top = (i / Math.max(1, days.length - 1)) * (trackHeight - 20);
            const dayPins = pins.filter((p) => p.dayId === day.id);
            const side = i % 2 === 0 ? -1 : 1;
            return (
              <div key={day.id} style={{ position: "absolute", top, left: "50%", transform: "translate(-50%, -50%)" }}>
                <div className="pm-mono" style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", border: "2px solid var(--sky)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "var(--sky)" }}>
                  {i + 1}
                </div>
                {dayPins.map((pin, j) => {
                  const meta = CATEGORY_META[pin.category];
                  const Icon = meta.icon;
                  return (
                    <button key={pin.id} onClick={() => setSelectedPinId(pin.id)} title={pin.name}
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
          {selectedPin ? (
            <PinDetail pin={selectedPin} day={days.find((d) => d.id === selectedPin.dayId)} onClose={() => setSelectedPinId(null)} onRemove={() => removePin(selectedPin.id)} />
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {pins.length === 0 && <div style={{ color: "var(--ink-soft)", fontSize: 13, fontStyle: "italic" }}>No pins here yet — add one, or pick a marker on the route.</div>}
              {pins.map((pin) => {
                const meta = CATEGORY_META[pin.category];
                const Icon = meta.icon;
                const day = days.find((d) => d.id === pin.dayId);
                return (
                  <div key={pin.id} onClick={() => setSelectedPinId(pin.id)} style={{ display: "flex", alignItems: "center", gap: 10, background: "#FFFDF9", border: "1px solid rgba(46,43,38,0.12)", borderRadius: 8, padding: "9px 12px", cursor: "pointer" }}>
                    <span style={{ color: meta.ramp, display: "flex" }}><Icon size={15} /></span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{pin.name}</div>
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
    <button onClick={onClick} className="pm-mono" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, padding: "6px 11px", borderRadius: 16, border: `1.5px solid ${active ? (color || "var(--ink)") : "rgba(46,43,38,0.2)"}`, background: active ? (color || "var(--ink)") : "transparent", color: active ? "#fff" : "var(--ink)", cursor: "pointer" }}>
      {Icon && <Icon size={12} />} {label}
    </button>
  );
}

function PinDetail({ pin, day, onClose, onRemove }) {
  const meta = CATEGORY_META[pin.category];
  const Icon = meta.icon;
  return (
    <div style={{ background: "#FFFDF9", border: `1.5px solid ${meta.ramp}`, borderRadius: 10, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: meta.ramp, display: "flex" }}><Icon size={18} /></span>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{pin.name}</div>
            <div className="pm-mono" style={{ fontSize: 10, color: "var(--ink-soft)" }}>{meta.label.slice(0, -1)} · day {day ? formatDateShort(day.date) : ""} · {day ? day.city : ""}</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-soft)" }} aria-label="Close"><X size={15} /></button>
      </div>
      {pin.note && <div style={{ marginTop: 10, fontSize: 14 }}>{pin.note}</div>}
      {pin.link && <a href={pin.link} target="_blank" rel="noreferrer" className="pm-mono" style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 8, fontSize: 12, color: "var(--sky)" }}><Link2 size={12} /> {pin.link}</a>}
      <button className="pm-btn pm-btn-ghost" style={{ marginTop: 14 }} onClick={onRemove}><Trash2 size={12} /> remove pin</button>
    </div>
  );
}

function PinForm({ days, onCancel, onSubmit, initialLat, initialLng }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("restaurant");
  const [dayId, setDayId] = useState(days[0] ? days[0].id : "");
  const [note, setNote] = useState("");
  const [link, setLink] = useState("");

  return (
    <div style={{ background: "rgba(232,163,61,0.09)", border: "1px dashed var(--gold)", borderRadius: 10, padding: 14, marginBottom: 16, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: "2 1 160px" }}>
          <span className="pm-label">Name</span>
          <input className="pm-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Place name" />
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
        <button className="pm-btn pm-btn-solid" onClick={() => name && onSubmit({ name, category, dayId, note, link, lat: initialLat, lng: initialLng })}>Save pin</button>
        <button className="pm-btn pm-btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ---- Live Google Map tab ----
// The API key is entered by the user and stored only in their own browser
// (localStorage) — it is never written into the source code or the repo.
// Once deployed, remember to restrict the key in Google Cloud Console to
// your Vercel domain (HTTP referrer restriction), since any client-side
// Maps key is visible in the browser's network requests.
// Vite only exposes env vars to the browser bundle when they're prefixed
// with VITE_. If you named yours something else in Vercel, rename it to
// one of these (Project Settings -> Environment Variables) and redeploy.
const ENV_KEY_NAMES = ["VITE_GOOGLE_MAPS_API_KEY", "VITE_GOOGLE_PLACES_API_KEY", "VITE_GOOGLE_API_KEY", "VITE_GMAPS_API_KEY"];
function getEnvApiKey() {
  for (const name of ENV_KEY_NAMES) {
    const v = import.meta.env[name];
    if (v) return v;
  }
  return "";
}

function GoogleMapTab({ trip, updateTrip }) {
  const envKey = getEnvApiKey();
  const [apiKey, setApiKey] = useState(() => {
    if (envKey) return envKey;
    try { return localStorage.getItem(GMAPS_KEY_STORAGE) || ""; } catch (e) { return ""; }
  });
  const [keyInput, setKeyInput] = useState("");
  const [status, setStatus] = useState(apiKey ? "loading" : "needs-key");
  const [pendingLatLng, setPendingLatLng] = useState(null);
  const mapRef = useRef(null);
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
    if (window.google && window.google.maps) { setStatus("ready"); return; }
    const existing = document.getElementById("pm-gmaps-script");
    if (existing) { existing.addEventListener("load", () => setStatus("ready")); return; }
    const script = document.createElement("script");
    script.id = "pm-gmaps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
    script.async = true;
    script.onload = () => setStatus("ready");
    script.onerror = () => setStatus("error");
    document.head.appendChild(script);
  }, [apiKey]);

  useEffect(() => {
    if (status !== "ready" || !mapRef.current) return;
    const geocoded = trip.pins.filter((p) => typeof p.lat === "number" && typeof p.lng === "number");
    const center = geocoded.length
      ? { lat: geocoded.reduce((s, p) => s + p.lat, 0) / geocoded.length, lng: geocoded.reduce((s, p) => s + p.lng, 0) / geocoded.length }
      : { lat: 40, lng: -110 };
    const map = new window.google.maps.Map(mapRef.current, { center, zoom: geocoded.length ? 6 : 4 });
    mapObjRef.current = map;
    map.addListener("click", (e) => setPendingLatLng({ lat: e.latLng.lat(), lng: e.latLng.lng() }));
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
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: meta.ramp, fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
      });
      const info = new window.google.maps.InfoWindow();
      marker.addListener("click", () => {
        const el = document.createElement("div");
        const title = document.createElement("div");
        title.style.fontWeight = "700";
        title.textContent = pin.name;
        el.appendChild(title);
        if (pin.note) {
          const note = document.createElement("div");
          note.style.fontSize = "12px";
          note.textContent = pin.note;
          el.appendChild(note);
        }
        info.setContent(el);
        info.open(mapObjRef.current, marker);
      });
      markersRef.current.push(marker);
    });
  }, [status, trip.pins]);

  if (status === "needs-key") {
    return (
      <div style={{ background: "#FAF8F4", border: "1.5px dashed rgba(46,43,38,0.25)", borderRadius: 12, padding: 24, maxWidth: 460 }}>
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
    return <div style={{ fontSize: 13, color: "var(--coral)" }}>Couldn't load Google Maps with that key. {!envKey && <button className="pm-btn pm-btn-ghost" onClick={forgetKey} style={{ marginLeft: 8 }}>try a different key</button>}</div>;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div className="pm-mono" style={{ fontSize: 11, color: "var(--ink-soft)" }}>click anywhere on the map to drop a pin</div>
        {envKey ? (
          <span className="pm-mono" style={{ fontSize: 10, color: "var(--meadow)" }}>connected via Vercel</span>
        ) : (
          <button className="pm-btn pm-btn-ghost" onClick={forgetKey} style={{ fontSize: 11 }}>disconnect</button>
        )}
      </div>
      <div ref={mapRef} style={{ width: "100%", height: 420, borderRadius: 12, border: "1.5px solid rgba(46,43,38,0.15)", background: "#FAF8F4" }} />
      {status === "loading" && <div style={{ marginTop: 10, fontSize: 12, color: "var(--ink-soft)" }}>loading map…</div>}
      {pendingLatLng && (
        <div style={{ marginTop: 14 }}>
          <PinForm
            days={trip.days}
            initialLat={pendingLatLng.lat}
            initialLng={pendingLatLng.lng}
            onCancel={() => setPendingLatLng(null)}
            onSubmit={(pin) => { updateTrip((t) => ({ ...t, pins: [...t.pins, { id: uid(), ...pin }] })); setPendingLatLng(null); }}
          />
        </div>
      )}
    </div>
  );
}
