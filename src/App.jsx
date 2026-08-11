import React, { useState, useEffect, useRef } from "react";
import {
  MapPin, Plus, X, ChevronDown, ArrowLeft, Sunrise, Sun, Moon,
  Map as MapIcon, BookOpen, Tag, KeyRound, BedDouble, Utensils,
  Link2, Compass, Trash2, PenLine,
} from "lucide-react";

const STORAGE_KEY = "roadbook:trips";

const uid = () => Math.random().toString(36).slice(2, 10);

function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
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
    subtitle: "Pacific coast, 14 days",
    days,
    pins,
  };
}

const CATEGORY_META = {
  restaurant: { label: "Restaurants", icon: Utensils, ramp: "#B5542E" },
  spot: { label: "Spots", icon: MapPin, ramp: "#6B7A5E" },
  hotel: { label: "Hotels", icon: BedDouble, ramp: "#5C7A99" },
};

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

  function createTrip({ name, startDate, numDays }) {
    const n = Math.max(1, Math.min(60, numDays));
    const days = [];
    for (let i = 0; i < n; i++) {
      days.push(makeDay(addDays(startDate, i), "", ""));
    }
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
    <div className="rb-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&family=Space+Mono:wght@400;700&display=swap');

        .rb-root {
          --paper: #F2EDE1;
          --paper-dark: #E7DFC9;
          --ink: #26313C;
          --ink-soft: #57646F;
          --rust: #B5542E;
          --sage: #6B7A5E;
          --gold: #C9A24B;
          --denim: #5C7A99;
          --card-shadow: rgba(38,49,60,0.16);
          font-family: 'Source Serif 4', Georgia, serif;
          color: var(--ink);
          background:
            radial-gradient(ellipse at 15% 8%, rgba(197,162,75,0.10), transparent 40%),
            radial-gradient(ellipse at 90% 85%, rgba(91,122,153,0.08), transparent 45%),
            var(--paper);
          min-height: 100%;
          width: 100%;
          box-sizing: border-box;
          padding: 28px 20px 60px;
          border-radius: 14px;
        }
        .rb-root * { box-sizing: border-box; }
        .rb-display { font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.03em; }
        .rb-mono { font-family: 'Space Mono', monospace; }
        .rb-btn {
          font-family: 'Space Mono', monospace;
          font-size: 12px;
          letter-spacing: 0.02em;
          border: 1px solid var(--ink);
          background: transparent;
          color: var(--ink);
          padding: 8px 14px;
          border-radius: 3px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .rb-btn:hover { background: var(--ink); color: var(--paper); }
        .rb-btn-solid {
          background: var(--rust);
          border-color: var(--rust);
          color: var(--paper);
        }
        .rb-btn-solid:hover { background: #9c4526; border-color: #9c4526; color: var(--paper); }
        .rb-btn-ghost { border-color: rgba(38,49,60,0.3); }
        .rb-input, .rb-textarea, .rb-select {
          font-family: 'Source Serif 4', Georgia, serif;
          font-size: 14px;
          background: rgba(255,255,255,0.5);
          border: 1px solid rgba(38,49,60,0.25);
          border-radius: 4px;
          padding: 8px 10px;
          color: var(--ink);
          width: 100%;
        }
        .rb-input:focus, .rb-textarea:focus, .rb-select:focus {
          outline: none;
          border-color: var(--rust);
        }
        .rb-textarea { resize: vertical; min-height: 52px; font-size: 14px; line-height: 1.5; }
        .rb-label { font-family: 'Space Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-soft); display: block; margin-bottom: 4px; }
      `}</style>

      {trips === null ? (
        <div style={{ textAlign: "center", padding: "60px 0", fontFamily: "'Space Mono', monospace", fontSize: 13, color: "var(--ink-soft)" }}>
          unpacking the glovebox…
        </div>
      ) : activeTrip ? (
        <TripView
          trip={activeTrip}
          onBack={() => setActiveTripId(null)}
          updateTrip={(fn) => updateTrip(activeTrip.id, fn)}
        />
      ) : (
        <HomeView
          trips={trips}
          onOpen={setActiveTripId}
          onNew={() => setShowNewForm(true)}
          onDelete={deleteTrip}
        />
      )}

      {showNewForm && (
        <NewTripModal onCancel={() => setShowNewForm(false)} onCreate={createTrip} />
      )}
    </div>
  );
}

function HomeView({ trips, onOpen, onNew, onDelete }) {
  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div className="rb-display" style={{ fontSize: 44, lineHeight: 1 }}>Roadbook</div>
        <div className="rb-mono" style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 4 }}>
          a scrapbook for trips still taking shape
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 18 }}>
        {trips.map((trip) => (
          <div
            key={trip.id}
            onClick={() => onOpen(trip.id)}
            style={{
              position: "relative",
              background: "#FBF8F0",
              border: "1px solid rgba(38,49,60,0.15)",
              borderRadius: 6,
              padding: "18px 16px 16px",
              cursor: "pointer",
              boxShadow: "0 3px 10px var(--card-shadow)",
              transform: "rotate(-0.4deg)",
            }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(trip.id); }}
              style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", cursor: "pointer", color: "var(--ink-soft)", opacity: 0.6 }}
              aria-label="Delete trip"
            >
              <X size={14} />
            </button>
            <div style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 30, height: 30, borderRadius: "50%", border: "1.5px dashed var(--gold)",
              fontFamily: "'Space Mono', monospace", fontSize: 11, color: "var(--gold)", marginBottom: 10,
            }}>
              {trip.days.length}d
            </div>
            <div className="rb-display" style={{ fontSize: 24, lineHeight: 1.05 }}>{trip.name}</div>
            <div className="rb-mono" style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 6 }}>
              {tripDateRange(trip)}
            </div>
            {trip.subtitle && (
              <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 8, fontStyle: "italic" }}>{trip.subtitle}</div>
            )}
          </div>
        ))}

        <div
          onClick={onNew}
          style={{
            border: "2px dashed rgba(38,49,60,0.3)",
            borderRadius: 6,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            minHeight: 140,
            cursor: "pointer",
            color: "var(--ink-soft)",
          }}
        >
          <Plus size={22} />
          <span className="rb-mono" style={{ fontSize: 12 }}>start a new trip</span>
        </div>
      </div>
    </div>
  );
}

function NewTripModal({ onCancel, onCreate }) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [numDays, setNumDays] = useState(7);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(38,49,60,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
      <div style={{ background: "#FBF8F0", borderRadius: 8, padding: 24, width: "100%", maxWidth: 360, boxShadow: "0 10px 30px rgba(0,0,0,0.25)" }}>
        <div className="rb-display" style={{ fontSize: 26, marginBottom: 16 }}>New trip</div>
        <div style={{ marginBottom: 12 }}>
          <span className="rb-label">Name</span>
          <input className="rb-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Coast to coast" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <span className="rb-label">Start date</span>
          <input className="rb-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div style={{ marginBottom: 18 }}>
          <span className="rb-label">Number of days</span>
          <input className="rb-input" type="number" min="1" max="60" value={numDays} onChange={(e) => setNumDays(parseInt(e.target.value || "1", 10))} />
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="rb-btn rb-btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="rb-btn rb-btn-solid" onClick={() => onCreate({ name, startDate, numDays })}>Create trip</button>
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
      <button className="rb-btn rb-btn-ghost" onClick={onBack} style={{ marginBottom: 18 }}>
        <ArrowLeft size={13} /> all trips
      </button>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <div className="rb-display" style={{ fontSize: 38, lineHeight: 1 }}>{trip.name}</div>
          <div className="rb-mono" style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 4 }}>
            {tripDateRange(trip)} · {trip.days.length} days
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <TabPill active={tab === "itinerary"} onClick={() => setTab("itinerary")} icon={BookOpen} label="Itinerary" />
          <TabPill active={tab === "map"} onClick={() => setTab("map")} icon={MapIcon} label="Map" />
        </div>
      </div>

      {tab === "itinerary" ? (
        <ItineraryTab
          trip={trip}
          expandedDayId={expandedDayId}
          setExpandedDayId={setExpandedDayId}
          updateDay={updateDay}
        />
      ) : (
        <MapTab trip={trip} updateTrip={updateTrip} />
      )}
    </div>
  );
}

function TabPill({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className="rb-mono"
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        fontSize: 12, padding: "8px 14px", borderRadius: 20,
        border: `1px solid ${active ? "var(--rust)" : "rgba(38,49,60,0.25)"}`,
        background: active ? "var(--rust)" : "transparent",
        color: active ? "var(--paper)" : "var(--ink)",
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
      <div style={{ position: "absolute", left: 13, top: 6, bottom: 6, borderLeft: "2px dashed rgba(38,49,60,0.3)" }} />
      {trip.days.map((day, i) => (
        <DayRow
          key={day.id}
          day={day}
          index={i}
          expanded={expandedDayId === day.id}
          onToggle={() => setExpandedDayId(expandedDayId === day.id ? null : day.id)}
          updateDay={(fn) => updateDay(day.id, fn)}
        />
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
      <div
        className="rb-mono"
        style={{
          position: "absolute", left: -30, top: 14, width: 26, height: 26, borderRadius: "50%",
          background: "var(--paper)", border: "2px solid var(--ink)", color: "var(--ink)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11,
        }}
      >
        {index + 1}
      </div>

      <div style={{ background: "#FBF8F0", border: "1px solid rgba(38,49,60,0.15)", borderRadius: 6, boxShadow: "0 2px 6px var(--card-shadow)" }}>
        <div
          onClick={onToggle}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", cursor: "pointer", gap: 12 }}
        >
          <div style={{ minWidth: 0 }}>
            <div className="rb-mono" style={{ fontSize: 11, color: "var(--ink-soft)" }}>{formatDate(day.date)}</div>
            <div style={{ fontSize: 17, fontWeight: 600, marginTop: 2 }}>{day.city || "Untitled stop"}</div>
            {day.blurb && !expanded && (
              <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 2, fontStyle: "italic" }}>{day.blurb}</div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            {stashCount(day) > 0 && (
              <span className="rb-mono" style={{ fontSize: 10, color: "var(--gold)", border: "1px solid var(--gold)", borderRadius: 10, padding: "2px 7px" }}>
                {stashCount(day)} tucked away
              </span>
            )}
            <ChevronDown size={16} style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }} />
          </div>
        </div>

        {expanded && (
          <div style={{ padding: "0 16px 18px", borderTop: "1px dashed rgba(38,49,60,0.2)" }}>
            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 160px" }}>
                <span className="rb-label">Where</span>
                <input className="rb-input" value={day.city} onChange={(e) => updateDay((d) => ({ ...d, city: e.target.value }))} placeholder="City or stretch of road" />
              </div>
              <div style={{ flex: "2 1 220px" }}>
                <span className="rb-label">One line about the day</span>
                <input className="rb-input" value={day.blurb} onChange={(e) => updateDay((d) => ({ ...d, blurb: e.target.value }))} placeholder="What's this day about" />
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
    <div style={{ background: "rgba(255,255,255,0.5)", border: "1px solid rgba(38,49,60,0.15)", borderRadius: 5, padding: 10 }}>
      <div className="rb-mono" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-soft)", marginBottom: 6 }}>
        <Icon size={12} /> {label}
      </div>
      <textarea
        className="rb-textarea"
        style={{ background: "transparent", border: "none", padding: 0, minHeight: 60 }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="What's the plan"
      />
    </div>
  );
}

function StashPocket({ day, updateDay }) {
  const [open, setOpen] = useState(false);

  function addHotel(item) {
    updateDay((d) => ({ ...d, stash: { ...d.stash, hotels: [...d.stash.hotels, { id: uid(), ...item }] } }));
  }
  function addSpot(item) {
    updateDay((d) => ({ ...d, stash: { ...d.stash, spots: [...d.stash.spots, { id: uid(), ...item }] } }));
  }
  function addCode(item) {
    updateDay((d) => ({ ...d, stash: { ...d.stash, codes: [...d.stash.codes, { id: uid(), ...item }] } }));
  }
  function removeItem(kind, id) {
    updateDay((d) => ({ ...d, stash: { ...d.stash, [kind]: d.stash[kind].filter((x) => x.id !== id) } }));
  }

  return (
    <div style={{ marginTop: 16 }}>
      <button
        onClick={() => setOpen(!open)}
        className="rb-mono"
        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-soft)", fontSize: 11, display: "flex", alignItems: "center", gap: 6, padding: 0 }}
      >
        <PenLine size={12} /> {open ? "tuck the pocket away" : "tucked-away details"}
        <ChevronDown size={12} style={{ transform: open ? "rotate(180deg)" : "none" }} />
      </button>

      {open && (
        <div style={{ marginTop: 12, background: "rgba(201,162,75,0.08)", border: "1px dashed var(--gold)", borderRadius: 6, padding: 14, display: "grid", gap: 16 }}>
          <StashSection
            title="Hotels considered"
            icon={BedDouble}
            items={day.stash.hotels}
            renderItem={(item) => (
              <>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{item.name}</div>
                {item.note && <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{item.note}</div>}
                {item.link && <a href={item.link} target="_blank" rel="noreferrer" className="rb-mono" style={{ fontSize: 11, color: "var(--denim)" }}>{item.link}</a>}
              </>
            )}
            onAdd={addHotel}
            onRemove={(id) => removeItem("hotels", id)}
            fields={["name", "link", "note"]}
          />
          <StashSection
            title="Spots to maybe check out"
            icon={Tag}
            items={day.stash.spots}
            renderItem={(item) => (
              <>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{item.name}</div>
                {item.note && <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{item.note}</div>}
                {item.link && <a href={item.link} target="_blank" rel="noreferrer" className="rb-mono" style={{ fontSize: 11, color: "var(--denim)" }}>{item.link}</a>}
              </>
            )}
            onAdd={addSpot}
            onRemove={(id) => removeItem("spots", id)}
            fields={["name", "link", "note"]}
          />
          <StashSection
            title="Booking codes"
            icon={KeyRound}
            items={day.stash.codes}
            renderItem={(item) => (
              <>
                <span style={{ fontSize: 13 }}>{item.label}</span>
                <span className="rb-mono" style={{ fontSize: 12, marginLeft: 8, color: "var(--rust)" }}>{item.value}</span>
              </>
            )}
            onAdd={addCode}
            onRemove={(id) => removeItem("codes", id)}
            fields={["label", "value"]}
          />
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
        <div className="rb-mono" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-soft)" }}>
          <Icon size={13} /> {title}
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--rust)" }} aria-label={`Add to ${title}`}>
          <Plus size={14} />
        </button>
      </div>

      <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
        {items.map((item) => (
          <div key={item.id} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, background: "#FBF8F0", border: "1px solid rgba(38,49,60,0.12)", borderRadius: 4, padding: "8px 10px" }}>
            <div style={{ minWidth: 0 }}>{renderItem(item)}</div>
            <button onClick={() => onRemove(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-soft)", flexShrink: 0 }} aria-label="Remove">
              <X size={13} />
            </button>
          </div>
        ))}
        {items.length === 0 && !showForm && (
          <div style={{ fontSize: 12, color: "var(--ink-soft)", fontStyle: "italic" }}>Nothing tucked in yet.</div>
        )}
      </div>

      {showForm && (
        <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
          {fields.map((f) => (
            <input
              key={f}
              className="rb-input"
              style={{ fontSize: 13, padding: "6px 8px" }}
              placeholder={f === "link" ? "link (optional)" : f}
              value={draft[f] || ""}
              onChange={(e) => setDraft({ ...draft, [f]: e.target.value })}
            />
          ))}
          <div style={{ display: "flex", gap: 6 }}>
            <button className="rb-btn rb-btn-solid" style={{ fontSize: 11, padding: "5px 10px" }} onClick={submit}>Add</button>
            <button className="rb-btn rb-btn-ghost" style={{ fontSize: 11, padding: "5px 10px" }} onClick={() => { setShowForm(false); setDraft({}); }}>Cancel</button>
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

  function dayIndexOf(dayId) {
    return days.findIndex((d) => d.id === dayId);
  }

  function addPin(pin) {
    updateTrip((t) => ({ ...t, pins: [...t.pins, { id: uid(), ...pin }] }));
    setShowForm(false);
  }
  function removePin(id) {
    updateTrip((t) => ({ ...t, pins: t.pins.filter((p) => p.id !== id) }));
    setSelectedPinId(null);
  }

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
        <button className="rb-btn rb-btn-solid" onClick={() => setShowForm(!showForm)}>
          <Plus size={13} /> add a pin
        </button>
      </div>

      {showForm && (
        <PinForm days={days} onCancel={() => setShowForm(false)} onSubmit={addPin} />
      )}

      <div style={{ display: "flex", gap: 24 }}>
        <div style={{ position: "relative", width: 140, flexShrink: 0, height: trackHeight }}>
          <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 2, background: "repeating-linear-gradient(to bottom, var(--denim) 0 6px, transparent 6px 12px)", transform: "translateX(-50%)" }} />
          {days.map((day, i) => {
            const top = (i / Math.max(1, days.length - 1)) * (trackHeight - 20);
            const dayPins = pins.filter((p) => p.dayId === day.id);
            const side = i % 2 === 0 ? -1 : 1;
            return (
              <div key={day.id} style={{ position: "absolute", top, left: "50%", transform: "translate(-50%, -50%)" }}>
                <div className="rb-mono" style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--paper)", border: "2px solid var(--denim)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "var(--denim)" }}>
                  {i + 1}
                </div>
                {dayPins.map((pin, j) => {
                  const meta = CATEGORY_META[pin.category];
                  const Icon = meta.icon;
                  return (
                    <button
                      key={pin.id}
                      onClick={() => setSelectedPinId(pin.id)}
                      title={pin.name}
                      style={{
                        position: "absolute",
                        top: -2,
                        left: side * (34 + j * 22),
                        width: 22, height: 22, borderRadius: "50%",
                        background: selectedPinId === pin.id ? meta.ramp : "#FBF8F0",
                        border: `2px solid ${meta.ramp}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "pointer", padding: 0,
                        color: selectedPinId === pin.id ? "#FBF8F0" : meta.ramp,
                      }}
                    >
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
              {pins.length === 0 && (
                <div style={{ color: "var(--ink-soft)", fontSize: 13, fontStyle: "italic" }}>No pins here yet — add one, or pick a marker on the route.</div>
              )}
              {pins.map((pin) => {
                const meta = CATEGORY_META[pin.category];
                const Icon = meta.icon;
                const day = days.find((d) => d.id === pin.dayId);
                return (
                  <div
                    key={pin.id}
                    onClick={() => setSelectedPinId(pin.id)}
                    style={{ display: "flex", alignItems: "center", gap: 10, background: "#FBF8F0", border: "1px solid rgba(38,49,60,0.15)", borderRadius: 5, padding: "9px 12px", cursor: "pointer" }}
                  >
                    <span style={{ color: meta.ramp, display: "flex" }}><Icon size={15} /></span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{pin.name}</div>
                      <div className="rb-mono" style={{ fontSize: 10, color: "var(--ink-soft)" }}>
                        day {dayIndexOf(pin.dayId) + 1} · {day ? day.city : ""}
                      </div>
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
    <button
      onClick={onClick}
      className="rb-mono"
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11,
        padding: "6px 11px", borderRadius: 16,
        border: `1px solid ${active ? (color || "var(--ink)") : "rgba(38,49,60,0.25)"}`,
        background: active ? (color || "var(--ink)") : "transparent",
        color: active ? "#FBF8F0" : "var(--ink)",
        cursor: "pointer",
      }}
    >
      {Icon && <Icon size={12} />} {label}
    </button>
  );
}

function PinDetail({ pin, day, onClose, onRemove }) {
  const meta = CATEGORY_META[pin.category];
  const Icon = meta.icon;
  return (
    <div style={{ background: "#FBF8F0", border: `1px solid ${meta.ramp}`, borderRadius: 6, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: meta.ramp, display: "flex" }}><Icon size={18} /></span>
          <div>
            <div style={{ fontSize: 17, fontWeight: 600 }}>{pin.name}</div>
            <div className="rb-mono" style={{ fontSize: 10, color: "var(--ink-soft)" }}>{meta.label.slice(0, -1)} · day {day ? day.date && formatDateShort(day.date) : ""} · {day ? day.city : ""}</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-soft)" }} aria-label="Close"><X size={15} /></button>
      </div>
      {pin.note && <div style={{ marginTop: 10, fontSize: 14 }}>{pin.note}</div>}
      {pin.link && <a href={pin.link} target="_blank" rel="noreferrer" className="rb-mono" style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 8, fontSize: 12, color: "var(--denim)" }}><Link2 size={12} /> {pin.link}</a>}
      <button className="rb-btn rb-btn-ghost" style={{ marginTop: 14 }} onClick={onRemove}><Trash2 size={12} /> remove pin</button>
    </div>
  );
}

function PinForm({ days, onCancel, onSubmit }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("restaurant");
  const [dayId, setDayId] = useState(days[0] ? days[0].id : "");
  const [note, setNote] = useState("");
  const [link, setLink] = useState("");

  return (
    <div style={{ background: "rgba(201,162,75,0.08)", border: "1px dashed var(--gold)", borderRadius: 6, padding: 14, marginBottom: 16, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: "2 1 160px" }}>
          <span className="rb-label">Name</span>
          <input className="rb-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Place name" />
        </div>
        <div style={{ flex: "1 1 120px" }}>
          <span className="rb-label">Category</span>
          <select className="rb-select" value={category} onChange={(e) => setCategory(e.target.value)}>
            {Object.entries(CATEGORY_META).map(([key, meta]) => (
              <option key={key} value={key}>{meta.label.slice(0, -1)}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: "1 1 160px" }}>
          <span className="rb-label">Which day</span>
          <select className="rb-select" value={dayId} onChange={(e) => setDayId(e.target.value)}>
            {days.map((d, i) => (
              <option key={d.id} value={d.id}>{i + 1}. {d.city || formatDateShort(d.date)}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <span className="rb-label">Note</span>
        <input className="rb-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why it's on the list" />
      </div>
      <div>
        <span className="rb-label">Link (optional)</span>
        <input className="rb-input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="rb-btn rb-btn-solid" onClick={() => name && onSubmit({ name, category, dayId, note, link })}>Save pin</button>
        <button className="rb-btn rb-btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
