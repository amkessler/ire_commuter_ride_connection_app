import { useMemo, useState } from "react";
import {
  CalendarClock,
  Car,
  CheckCircle2,
  CircleAlert,
  Filter,
  Mail,
  MapPin,
  Phone,
  Plus,
  Route,
  RotateCcw,
  Search,
  UserPlus,
  Users,
} from "lucide-react";

const storageKey = "ire-ride-connection-state-v1";

const slots = [
  { id: "thuAm", label: "Thu AM" },
  { id: "thuPm", label: "Thu PM" },
  { id: "friAm", label: "Fri AM" },
  { id: "friPm", label: "Fri PM" },
  { id: "satAm", label: "Sat AM" },
  { id: "satPm", label: "Sat PM" },
  { id: "sunAm", label: "Sun AM" },
];

const corridors = [
  {
    id: "dc-nw",
    label: "DC Northwest",
    short: "NW DC",
    region: "DC",
    route: "Connecticut / Rock Creek / I-395",
    x: 38,
    y: 22,
    tone: "blue",
  },
  {
    id: "dc-ne",
    label: "DC Northeast / Capitol Hill",
    short: "NE DC",
    region: "DC",
    route: "I-295 / South Capitol approach",
    x: 58,
    y: 25,
    tone: "green",
  },
  {
    id: "arlington-alexandria",
    label: "Arlington / Alexandria",
    short: "Arl/Alex",
    region: "VA",
    route: "GW Parkway / I-395 / Wilson Bridge",
    x: 34,
    y: 55,
    tone: "orange",
  },
  {
    id: "fairfax-falls-church",
    label: "Fairfax / Falls Church",
    short: "Fairfax",
    region: "VA",
    route: "I-66 / I-495 / Wilson Bridge",
    x: 18,
    y: 47,
    tone: "violet",
  },
  {
    id: "silver-spring-takoma",
    label: "Silver Spring / Takoma Park",
    short: "SS/Takoma",
    region: "MD",
    route: "DC north-south approach",
    x: 50,
    y: 9,
    tone: "teal",
  },
  {
    id: "bethesda-rockville",
    label: "Bethesda / Rockville",
    short: "Bethesda",
    region: "MD",
    route: "I-270 / I-495 / Wilson Bridge",
    x: 24,
    y: 14,
    tone: "red",
  },
  {
    id: "pg-county",
    label: "Prince George's County",
    short: "PG County",
    region: "MD",
    route: "I-495 / Oxon Hill approach",
    x: 73,
    y: 43,
    tone: "gold",
  },
];

const corridorAdjacency = {
  "dc-nw": ["silver-spring-takoma", "bethesda-rockville", "dc-ne", "arlington-alexandria"],
  "dc-ne": ["silver-spring-takoma", "dc-nw", "pg-county"],
  "arlington-alexandria": ["fairfax-falls-church", "dc-nw", "pg-county"],
  "fairfax-falls-church": ["arlington-alexandria", "bethesda-rockville"],
  "silver-spring-takoma": ["dc-nw", "dc-ne", "bethesda-rockville"],
  "bethesda-rockville": ["dc-nw", "silver-spring-takoma", "fairfax-falls-church"],
  "pg-county": ["dc-ne", "arlington-alexandria"],
};

const nationalHarbor = {
  label: "National Harbor",
  x: 62,
  y: 70,
};

const sampleParticipants = [
  {
    id: "p1",
    name: "Maya Rodriguez",
    email: "maya@example.com",
    phone: "202-555-0116",
    neighborhood: "Columbia Heights",
    corridor: "dc-nw",
    intent: "offer",
    transportPreference: "carpool",
    seatsAvailable: 2,
    maxPartySize: 3,
    availability: makeAvailability(["thuAm", "thuPm", "friAm", "friPm", "satAm", "satPm", "sunAm"]),
    notes: "Can pick up near Columbia Heights or along 16th/14th before heading south.",
  },
  {
    id: "p2",
    name: "Jon Lee",
    email: "jon@example.com",
    phone: "202-555-0198",
    neighborhood: "Capitol Hill",
    corridor: "dc-ne",
    intent: "need-seat",
    transportPreference: "either",
    seatsAvailable: 0,
    maxPartySize: 1,
    availability: makeAvailability(["thuAm", "thuPm", "friAm", "friPm", "sunAm"]),
    notes: "Flexible pickup near Eastern Market or Union Station.",
  },
  {
    id: "p3",
    name: "Priya Shah",
    email: "priya@example.com",
    phone: "703-555-0131",
    neighborhood: "Old Town Alexandria",
    corridor: "arlington-alexandria",
    intent: "offer",
    transportPreference: "carpool",
    seatsAvailable: 3,
    maxPartySize: 4,
    availability: makeAvailability(["friAm", "friPm", "satAm", "satPm"]),
    notes: "Best for Alexandria, Crystal City, or Pentagon City riders.",
  },
  {
    id: "p4",
    name: "Sam Nguyen",
    email: "sam@example.com",
    phone: "301-555-0172",
    neighborhood: "Silver Spring",
    corridor: "silver-spring-takoma",
    intent: "split-rideshare",
    transportPreference: "rideshare",
    seatsAvailable: 0,
    maxPartySize: 3,
    availability: makeAvailability(["thuAm", "friAm", "satAm", "sunAm"]),
    notes: "Looking for a morning Uber/Lyft split from the Silver Spring/Takoma side.",
  },
  {
    id: "p5",
    name: "Leah Brooks",
    email: "leah@example.com",
    phone: "240-555-0104",
    neighborhood: "Hyattsville",
    corridor: "pg-county",
    intent: "need-seat",
    transportPreference: "carpool",
    seatsAvailable: 0,
    maxPartySize: 1,
    availability: makeAvailability(["friAm", "friPm", "satAm"]),
    notes: "Hoping to join someone coming down the east side.",
  },
  {
    id: "p6",
    name: "Owen Carter",
    email: "owen@example.com",
    phone: "571-555-0109",
    neighborhood: "Falls Church",
    corridor: "fairfax-falls-church",
    intent: "split-rideshare",
    transportPreference: "rideshare",
    seatsAvailable: 0,
    maxPartySize: 4,
    availability: makeAvailability(["thuAm", "thuPm", "friAm", "sunAm"]),
    notes: "Open to a pickup cluster near East Falls Church or Ballston.",
  },
  {
    id: "p7",
    name: "Nadia Patel",
    email: "nadia@example.com",
    phone: "301-555-0199",
    neighborhood: "Bethesda",
    corridor: "bethesda-rockville",
    intent: "offer",
    transportPreference: "carpool",
    seatsAvailable: 1,
    maxPartySize: 2,
    availability: makeAvailability(["thuAm", "thuPm", "friAm", "friPm", "sunAm"]),
    notes: "Route is tight; Bethesda or Friendship Heights pickup preferred.",
  },
  {
    id: "p8",
    name: "Avery Kim",
    email: "avery@example.com",
    phone: "202-555-0127",
    neighborhood: "Navy Yard",
    corridor: "dc-ne",
    intent: "split-rideshare",
    transportPreference: "rideshare",
    seatsAvailable: 0,
    maxPartySize: 3,
    availability: makeAvailability(["thuAm", "friAm", "satAm"]),
    notes: "Could meet at Navy Yard or Waterfront for a shared ride.",
  },
];

const sampleGroups = [
  {
    id: "g1",
    hostId: "p1",
    type: "carpool",
    corridor: "dc-nw",
    routeFlexibility: "moderate",
    capacity: 2,
    riderIds: ["p2"],
    inquiries: [],
    status: "committed",
    availability: makeAvailability(["thuAm", "thuPm", "friAm", "friPm", "satAm", "satPm", "sunAm"]),
  },
  {
    id: "g2",
    hostId: "p3",
    type: "carpool",
    corridor: "arlington-alexandria",
    routeFlexibility: "moderate",
    capacity: 3,
    riderIds: [],
    inquiries: [],
    status: "open",
    availability: makeAvailability(["friAm", "friPm", "satAm", "satPm"]),
  },
  {
    id: "g3",
    hostId: "p4",
    type: "rideshare",
    corridor: "silver-spring-takoma",
    routeFlexibility: "flexible",
    capacity: 4,
    riderIds: ["p8"],
    inquiries: ["p2"],
    status: "pending",
    availability: makeAvailability(["thuAm", "friAm", "satAm", "sunAm"]),
  },
  {
    id: "g4",
    hostId: "p7",
    type: "carpool",
    corridor: "bethesda-rockville",
    routeFlexibility: "tight",
    capacity: 1,
    riderIds: ["p6"],
    inquiries: [],
    status: "full",
    availability: makeAvailability(["thuAm", "thuPm", "friAm", "friPm", "sunAm"]),
  },
  {
    id: "g5",
    hostId: "p6",
    type: "rideshare",
    corridor: "fairfax-falls-church",
    routeFlexibility: "flexible",
    capacity: 4,
    riderIds: [],
    inquiries: [],
    status: "open",
    availability: makeAvailability(["thuAm", "thuPm", "friAm", "sunAm"]),
  },
];

const blankForm = {
  name: "",
  email: "",
  phone: "",
  neighborhood: "",
  corridor: "dc-nw",
  intent: "need-seat",
  transportPreference: "either",
  seatsAvailable: 1,
  maxPartySize: 3,
  availability: makeAvailability(["thuAm", "friAm"]),
  notes: "",
};

const viewTabs = [
  { id: "rides", label: "Find rides", Icon: Search },
  { id: "add", label: "Add info", Icon: Plus },
  { id: "routes", label: "Route map", Icon: Route },
  { id: "status", label: "Status", Icon: CheckCircle2 },
];

function makeAvailability(activeSlots) {
  return slots.reduce((acc, slot) => {
    acc[slot.id] = activeSlots.includes(slot.id);
    return acc;
  }, {});
}

function loadInitialState() {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.participants?.length && parsed?.groups?.length) {
        return parsed;
      }
    }
  } catch {
    return null;
  }

  return {
    participants: sampleParticipants,
    groups: sampleGroups,
  };
}

function getCorridor(corridorId) {
  return corridors.find((corridor) => corridor.id === corridorId) || corridors[0];
}

function overlapSlots(a, b) {
  return slots.filter((slot) => a?.[slot.id] && b?.[slot.id]);
}

function formatSlots(availability) {
  const active = slots.filter((slot) => availability?.[slot.id]);
  if (!active.length) return "No slots listed";
  return active.map((slot) => slot.label).join(", ");
}

function routeFitLabel(personCorridor, groupCorridor, groupType) {
  if (personCorridor === groupCorridor) {
    return { label: "Same corridor", level: "strong" };
  }
  if (corridorAdjacency[groupCorridor]?.includes(personCorridor)) {
    return { label: "Nearby route", level: "good" };
  }
  if (groupType === "rideshare") {
    return { label: "Flexible stretch", level: "possible" };
  }
  return { label: "Likely detour", level: "weak" };
}

function getGroupCounts(group) {
  if (group.type === "carpool") {
    const committed = group.riderIds.length;
    return {
      committed,
      openSpots: Math.max(group.capacity - committed, 0),
      used: committed,
      total: group.capacity,
      label: `${committed}/${group.capacity} carpool seats committed`,
    };
  }

  const committed = group.riderIds.length + 1;
  return {
    committed,
    openSpots: Math.max(group.capacity - committed, 0),
    used: committed,
    total: group.capacity,
    label: `${committed}/${group.capacity} riders in pool`,
  };
}

function effectiveStatus(group) {
  const counts = getGroupCounts(group);
  if (counts.openSpots === 0) return "full";
  return group.status;
}

function scoreGroupForParticipant(group, participant) {
  const sharedSlots = overlapSlots(group.availability, participant.availability);
  const routeFit = routeFitLabel(participant.corridor, group.corridor, group.type);
  const status = effectiveStatus(group);
  const wantsCarpool =
    participant.intent === "need-seat" ||
    participant.intent === "both" ||
    participant.transportPreference === "carpool" ||
    participant.transportPreference === "either";
  const wantsRideshare =
    participant.intent === "split-rideshare" ||
    participant.intent === "both" ||
    participant.transportPreference === "rideshare" ||
    participant.transportPreference === "either";

  let score = sharedSlots.length * 12;
  if (routeFit.level === "strong") score += 38;
  if (routeFit.level === "good") score += 22;
  if (routeFit.level === "possible") score += 8;
  if (routeFit.level === "weak") score -= 20;
  if (group.type === "carpool" && wantsCarpool) score += 14;
  if (group.type === "rideshare" && wantsRideshare) score += 14;
  if (group.type === "carpool" && !wantsCarpool) score -= 24;
  if (group.type === "rideshare" && !wantsRideshare) score -= 12;
  if (status === "open") score += 12;
  if (status === "pending") score += 4;
  if (status === "committed") score += 2;
  if (status === "full") score -= 34;
  if (group.routeFlexibility === "tight" && routeFit.level !== "strong") score -= 18;
  if (group.routeFlexibility === "flexible" && routeFit.level !== "weak") score += 5;

  return {
    score,
    sharedSlots,
    routeFit,
    status,
  };
}

function App() {
  const [state, setState] = useState(loadInitialState);
  const [form, setForm] = useState(blankForm);
  const [selectedParticipantId, setSelectedParticipantId] = useState("p2");
  const [corridorFilter, setCorridorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [query, setQuery] = useState("");
  const [activeView, setActiveView] = useState("rides");

  const { participants, groups } = state;
  const selectedParticipant =
    participants.find((participant) => participant.id === selectedParticipantId) ||
    participants[0];

  function persist(nextState) {
    setState(nextState);
    window.localStorage.setItem(storageKey, JSON.stringify(nextState));
  }

  function resetSamples() {
    const nextState = {
      participants: sampleParticipants,
      groups: sampleGroups,
    };
    setSelectedParticipantId("p2");
    persist(nextState);
  }

  function updateFormField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateAvailability(slotId) {
    setForm((current) => ({
      ...current,
      availability: {
        ...current.availability,
        [slotId]: !current.availability[slotId],
      },
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    const participantId = `p${Date.now()}`;
    const participant = {
      ...form,
      id: participantId,
      seatsAvailable: Number(form.seatsAvailable),
      maxPartySize: Number(form.maxPartySize),
    };

    const nextGroups = [...groups];
    const offersCarpool =
      (participant.intent === "offer" || participant.intent === "both") &&
      participant.transportPreference !== "rideshare" &&
      participant.seatsAvailable > 0;
    const startsRideshare =
      participant.intent === "split-rideshare" ||
      (participant.intent === "both" && participant.transportPreference !== "carpool");

    if (offersCarpool) {
      nextGroups.push({
        id: `g${Date.now()}c`,
        hostId: participantId,
        type: "carpool",
        corridor: participant.corridor,
        routeFlexibility: "moderate",
        capacity: participant.seatsAvailable,
        riderIds: [],
        inquiries: [],
        status: "open",
        availability: participant.availability,
      });
    }

    if (startsRideshare) {
      nextGroups.push({
        id: `g${Date.now()}r`,
        hostId: participantId,
        type: "rideshare",
        corridor: participant.corridor,
        routeFlexibility: "flexible",
        capacity: participant.maxPartySize,
        riderIds: [],
        inquiries: [],
        status: "open",
        availability: participant.availability,
      });
    }

    persist({
      participants: [...participants, participant],
      groups: nextGroups,
    });
    setSelectedParticipantId(participantId);
    setForm(blankForm);
  }

  function updateGroup(groupId, patch) {
    persist({
      participants,
      groups: groups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              ...patch,
            }
          : group,
      ),
    });
  }

  function inquire(groupId) {
    if (!selectedParticipant) return;
    const group = groups.find((item) => item.id === groupId);
    if (!group || group.hostId === selectedParticipant.id) return;
    const inquiries = new Set(group.inquiries);
    inquiries.add(selectedParticipant.id);
    updateGroup(groupId, {
      inquiries: Array.from(inquiries),
      status: group.status === "open" ? "pending" : group.status,
    });
  }

  function commit(groupId) {
    if (!selectedParticipant) return;
    const group = groups.find((item) => item.id === groupId);
    if (!group || group.hostId === selectedParticipant.id) return;
    const riders = new Set(group.riderIds);
    riders.add(selectedParticipant.id);
    const inquiries = group.inquiries.filter((id) => id !== selectedParticipant.id);
    const nextGroup = {
      ...group,
      riderIds: Array.from(riders),
      inquiries,
    };
    const nextStatus = getGroupCounts(nextGroup).openSpots === 0 ? "full" : "committed";
    updateGroup(groupId, {
      riderIds: nextGroup.riderIds,
      inquiries,
      status: nextStatus,
    });
  }

  const filteredGroups = useMemo(() => {
    return groups
      .filter((group) => {
        const host = participants.find((participant) => participant.id === group.hostId);
        const text = `${host?.name || ""} ${host?.neighborhood || ""} ${getCorridor(group.corridor).label}`.toLowerCase();
        const matchesQuery = text.includes(query.toLowerCase());
        const matchesCorridor = corridorFilter === "all" || group.corridor === corridorFilter;
        const status = effectiveStatus(group);
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "active" && status !== "full") ||
          status === statusFilter;
        return matchesQuery && matchesCorridor && matchesStatus;
      })
      .sort((a, b) => {
        if (!selectedParticipant) return 0;
        return (
          scoreGroupForParticipant(b, selectedParticipant).score -
          scoreGroupForParticipant(a, selectedParticipant).score
        );
      });
  }, [corridorFilter, groups, participants, query, selectedParticipant, statusFilter]);

  const selectedMatches = useMemo(() => {
    if (!selectedParticipant) return [];
    return groups
      .filter((group) => group.hostId !== selectedParticipant.id)
      .map((group) => ({
        group,
        match: scoreGroupForParticipant(group, selectedParticipant),
      }))
      .sort((a, b) => b.match.score - a.match.score)
      .slice(0, 5);
  }, [groups, selectedParticipant]);

  const activeStats = useMemo(() => {
    const openGroups = groups.filter((group) => effectiveStatus(group) !== "full");
    const openSeats = groups.reduce((total, group) => total + getGroupCounts(group).openSpots, 0);
    const seekers = participants.filter(
      (participant) => participant.intent === "need-seat" || participant.intent === "split-rideshare",
    );
    return {
      participants: participants.length,
      openGroups: openGroups.length,
      openSeats,
      seekers: seekers.length,
    };
  }, [groups, participants]);

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">National Harbor commute board</p>
          <h1>IRE Ride Connection</h1>
        </div>
        <div className="topbar-actions">
          <Stat label="People" value={activeStats.participants} />
          <Stat label="Open groups" value={activeStats.openGroups} />
          <Stat label="Open spots" value={activeStats.openSeats} />
          <Stat label="Seeking" value={activeStats.seekers} />
        </div>
      </header>

      <nav className="view-tabs" aria-label="App sections">
        {viewTabs.map((tab) => {
          const TabIcon = tab.Icon;
          return (
            <button
              aria-current={activeView === tab.id ? "page" : undefined}
              className={activeView === tab.id ? "active" : ""}
              key={tab.id}
              type="button"
              onClick={() => setActiveView(tab.id)}
            >
              <TabIcon size={16} aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {activeView === "rides" && (
        <main className="workspace board-workspace">
          <section className="main-panel">
            <div className="board-header">
              <div>
                <p className="eyebrow">Route alignment</p>
                <h2>Open rides and shared ride pools</h2>
              </div>
              <BoardControls
                corridorFilter={corridorFilter}
                query={query}
                setCorridorFilter={setCorridorFilter}
                setQuery={setQuery}
                setStatusFilter={setStatusFilter}
                statusFilter={statusFilter}
              />
            </div>

            <div className="ride-grid">
              {filteredGroups.map((group) => (
                <RideCard
                  key={group.id}
                  group={group}
                  participants={participants}
                  selectedParticipant={selectedParticipant}
                  match={selectedParticipant ? scoreGroupForParticipant(group, selectedParticipant) : null}
                  onInquire={inquire}
                  onCommit={commit}
                  onStatusChange={(status) => updateGroup(group.id, { status })}
                />
              ))}
            </div>
          </section>

          <MatchSidebar
            participants={participants}
            resetSamples={resetSamples}
            selectedMatches={selectedMatches}
            selectedParticipant={selectedParticipant}
            setSelectedParticipantId={setSelectedParticipantId}
          />
        </main>
      )}

      {activeView === "add" && (
        <main className="workspace add-workspace">
          <section className="tool-block form-panel">
            <div className="section-heading">
              <UserPlus size={18} aria-hidden="true" />
              <h2>Add your ride info</h2>
            </div>
            <EntryForm
              form={form}
              onSubmit={handleSubmit}
              onFieldChange={updateFormField}
              onAvailabilityChange={updateAvailability}
            />
          </section>

          <aside className="side-panel">
            <section className="tool-block">
              <div className="section-heading">
                <CheckCircle2 size={18} aria-hidden="true" />
                <h2>Current board</h2>
              </div>
              <div className="summary-grid">
                <Stat label="People" value={activeStats.participants} />
                <Stat label="Open groups" value={activeStats.openGroups} />
                <Stat label="Open spots" value={activeStats.openSeats} />
                <Stat label="Seeking" value={activeStats.seekers} />
              </div>
            </section>
            <PrototypeTools resetSamples={resetSamples} />
          </aside>
        </main>
      )}

      {activeView === "routes" && (
        <main className="workspace routes-workspace">
          <section className="main-panel">
            <div className="board-header">
              <div>
                <p className="eyebrow">Regional corridors</p>
                <h2>Route map</h2>
              </div>
            </div>
            <RouteMap groups={groups} selectedParticipant={selectedParticipant} />
          </section>
        </main>
      )}

      {activeView === "status" && (
        <main className="workspace status-workspace">
          <section className="main-panel">
            <div className="board-header">
              <div>
                <p className="eyebrow">Ride status</p>
                <h2>Capacity and commitments</h2>
              </div>
              <BoardControls
                corridorFilter={corridorFilter}
                query={query}
                setCorridorFilter={setCorridorFilter}
                setQuery={setQuery}
                setStatusFilter={setStatusFilter}
                statusFilter={statusFilter}
              />
            </div>

            <div className="ride-grid compact-ride-grid">
              {filteredGroups.map((group) => (
                <RideCard
                  key={group.id}
                  group={group}
                  participants={participants}
                  selectedParticipant={selectedParticipant}
                  match={selectedParticipant ? scoreGroupForParticipant(group, selectedParticipant) : null}
                  onInquire={inquire}
                  onCommit={commit}
                  onStatusChange={(status) => updateGroup(group.id, { status })}
                />
              ))}
            </div>
          </section>

          <aside className="side-panel">
            <section className="tool-block">
              <div className="section-heading">
                <Users size={18} aria-hidden="true" />
                <h2>Open capacity</h2>
              </div>
              <div className="summary-grid">
                <Stat label="Open groups" value={activeStats.openGroups} />
                <Stat label="Open spots" value={activeStats.openSeats} />
              </div>
            </section>
            <PrototypeTools resetSamples={resetSamples} />
          </aside>
        </main>
      )}
    </div>
  );
}

function BoardControls({
  corridorFilter,
  query,
  setCorridorFilter,
  setQuery,
  setStatusFilter,
  statusFilter,
}) {
  return (
    <div className="board-controls">
      <label className="field compact">
        <span>
          <Search size={14} aria-hidden="true" />
          Search
        </span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name, neighborhood, corridor"
        />
      </label>
      <label className="field compact">
        <span>
          <Filter size={14} aria-hidden="true" />
          Corridor
        </span>
        <select value={corridorFilter} onChange={(event) => setCorridorFilter(event.target.value)}>
          <option value="all">All corridors</option>
          {corridors.map((corridor) => (
            <option key={corridor.id} value={corridor.id}>
              {corridor.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field compact">
        <span>Status</span>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="active">Open or pending</option>
          <option value="open">Open</option>
          <option value="pending">Pending</option>
          <option value="committed">Committed</option>
          <option value="full">Full</option>
          <option value="all">All statuses</option>
        </select>
      </label>
    </div>
  );
}

function MatchSidebar({
  participants,
  resetSamples,
  selectedMatches,
  selectedParticipant,
  setSelectedParticipantId,
}) {
  return (
    <aside className="side-panel">
      <section className="tool-block">
        <div className="section-heading">
          <Route size={18} aria-hidden="true" />
          <h2>Match as</h2>
        </div>
        <label className="field">
          <span>Participant view</span>
          <select
            value={selectedParticipant?.id || ""}
            onChange={(event) => setSelectedParticipantId(event.target.value)}
          >
            {participants.map((participant) => (
              <option key={participant.id} value={participant.id}>
                {participant.name} - {participant.neighborhood}
              </option>
            ))}
          </select>
        </label>
        {selectedParticipant && <ParticipantSummary participant={selectedParticipant} />}
      </section>

      <section className="tool-block">
        <div className="section-heading">
          <CheckCircle2 size={18} aria-hidden="true" />
          <h2>Best current fits</h2>
        </div>
        <div className="match-list">
          {selectedMatches.map(({ group, match }) => {
            const host = participants.find((participant) => participant.id === group.hostId);
            return (
              <article className="match-row" key={group.id}>
                <div>
                  <strong>{host?.name || "Unknown host"}</strong>
                  <span>{getCorridor(group.corridor).short}</span>
                </div>
                <ScorePill match={match} />
              </article>
            );
          })}
        </div>
      </section>

      <PrototypeTools resetSamples={resetSamples} />
    </aside>
  );
}

function PrototypeTools({ resetSamples }) {
  return (
    <section className="tool-block">
      <div className="section-heading">
        <RotateCcw size={18} aria-hidden="true" />
        <h2>Prototype data</h2>
      </div>
      <button className="secondary-button" type="button" onClick={resetSamples}>
        <RotateCcw size={16} aria-hidden="true" />
        Reset sample board
      </button>
    </section>
  );
}

function EntryForm({ form, onSubmit, onFieldChange, onAvailabilityChange }) {
  return (
    <form className="entry-form" onSubmit={onSubmit}>
      <div className="field-grid">
        <label className="field">
          <span>Name</span>
          <input
            required
            value={form.name}
            onChange={(event) => onFieldChange("name", event.target.value)}
            placeholder="Your name"
          />
        </label>
        <label className="field">
          <span>Email</span>
          <input
            required
            type="email"
            value={form.email}
            onChange={(event) => onFieldChange("email", event.target.value)}
            placeholder="name@example.com"
          />
        </label>
      </div>

      <label className="field">
        <span>Phone</span>
        <input
          value={form.phone}
          onChange={(event) => onFieldChange("phone", event.target.value)}
          placeholder="Optional"
        />
      </label>

      <label className="field">
        <span>Neighborhood</span>
        <input
          required
          value={form.neighborhood}
          onChange={(event) => onFieldChange("neighborhood", event.target.value)}
          placeholder="Columbia Heights, Old Town, Bethesda..."
        />
      </label>

      <label className="field">
        <span>Regional corridor</span>
        <select value={form.corridor} onChange={(event) => onFieldChange("corridor", event.target.value)}>
          {corridors.map((corridor) => (
            <option key={corridor.id} value={corridor.id}>
              {corridor.label}
            </option>
          ))}
        </select>
      </label>

      <div className="field-grid">
        <label className="field">
          <span>Need or offer</span>
          <select value={form.intent} onChange={(event) => onFieldChange("intent", event.target.value)}>
            <option value="need-seat">Looking for a carpool seat</option>
            <option value="offer">Offering carpool seats</option>
            <option value="split-rideshare">Split Uber/Lyft</option>
            <option value="both">Open to multiple options</option>
          </select>
        </label>
        <label className="field">
          <span>Preference</span>
          <select
            value={form.transportPreference}
            onChange={(event) => onFieldChange("transportPreference", event.target.value)}
          >
            <option value="either">Either</option>
            <option value="carpool">Carpool</option>
            <option value="rideshare">Uber/Lyft split</option>
          </select>
        </label>
      </div>

      <div className="field-grid">
        <label className="field">
          <span>Carpool seats offered</span>
          <input
            min="0"
            max="6"
            type="number"
            value={form.seatsAvailable}
            onChange={(event) => onFieldChange("seatsAvailable", event.target.value)}
          />
        </label>
        <label className="field">
          <span>Rideshare party cap</span>
          <input
            min="2"
            max="6"
            type="number"
            value={form.maxPartySize}
            onChange={(event) => onFieldChange("maxPartySize", event.target.value)}
          />
        </label>
      </div>

      <fieldset className="slot-fieldset">
        <legend>Conference trip slots</legend>
        <div className="slot-grid">
          {slots.map((slot) => (
            <label className="slot-toggle" key={slot.id}>
              <input
                type="checkbox"
                checked={form.availability[slot.id]}
                onChange={() => onAvailabilityChange(slot.id)}
              />
              <span>{slot.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="field">
        <span>Notes</span>
        <textarea
          value={form.notes}
          onChange={(event) => onFieldChange("notes", event.target.value)}
          placeholder="Pickup constraints, preferred meetups, timing, accessibility notes..."
        />
      </label>

      <button className="primary-button" type="submit">
        <Plus size={16} aria-hidden="true" />
        Add to board
      </button>
    </form>
  );
}

function RouteMap({ groups, selectedParticipant }) {
  return (
    <section className="route-map" aria-label="Regional route alignment map">
      <div className="map-canvas">
        {corridors.map((corridor) => {
          const openGroups = groups.filter(
            (group) => group.corridor === corridor.id && effectiveStatus(group) !== "full",
          );
          const isSelected = selectedParticipant?.corridor === corridor.id;
          return (
            <div
              className={`map-node tone-${corridor.tone} ${isSelected ? "selected" : ""}`}
              key={corridor.id}
              style={{ left: `${corridor.x}%`, top: `${corridor.y}%` }}
            >
              <span>{corridor.short}</span>
              <small>{openGroups.length} active</small>
            </div>
          );
        })}
        <div className="harbor-node" style={{ left: `${nationalHarbor.x}%`, top: `${nationalHarbor.y}%` }}>
          <MapPin size={18} aria-hidden="true" />
          <span>{nationalHarbor.label}</span>
        </div>
      </div>
      <div className="map-notes">
        {corridors.map((corridor) => (
          <div className="route-note" key={corridor.id}>
            <strong>{corridor.short}</strong>
            <span>{corridor.route}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function RideCard({ group, participants, selectedParticipant, match, onInquire, onCommit, onStatusChange }) {
  const host = participants.find((participant) => participant.id === group.hostId);
  const riders = group.riderIds
    .map((id) => participants.find((participant) => participant.id === id))
    .filter(Boolean);
  const inquiries = group.inquiries
    .map((id) => participants.find((participant) => participant.id === id))
    .filter(Boolean);
  const corridor = getCorridor(group.corridor);
  const counts = getGroupCounts(group);
  const status = effectiveStatus(group);
  const alreadyRiding = selectedParticipant && group.riderIds.includes(selectedParticipant.id);
  const alreadyInquired = selectedParticipant && group.inquiries.includes(selectedParticipant.id);
  const isHost = selectedParticipant && selectedParticipant.id === group.hostId;
  const canAct = selectedParticipant && !isHost && !alreadyRiding && status !== "full";

  return (
    <article className={`ride-card status-${status}`}>
      <div className="ride-card-header">
        <div className="ride-type">
          {group.type === "carpool" ? <Car size={18} aria-hidden="true" /> : <Users size={18} aria-hidden="true" />}
          <div>
            <h3>{group.type === "carpool" ? "Driver carpool" : "Uber/Lyft split"}</h3>
            <p>{corridor.label}</p>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="ride-meta">
        <span>
          <MapPin size={14} aria-hidden="true" />
          {host?.neighborhood || "Neighborhood pending"}
        </span>
        <span>
          <CalendarClock size={14} aria-hidden="true" />
          {formatSlots(group.availability)}
        </span>
      </div>

      {match && (
        <div className="match-strip">
          <ScorePill match={match} />
          <span className={`fit-tag fit-${match.routeFit.level}`}>{match.routeFit.label}</span>
          <span>{match.sharedSlots.length} shared slots</span>
        </div>
      )}

      <div className="capacity-meter" aria-label={counts.label}>
        <div>
          <strong>{counts.label}</strong>
          <span>{counts.openSpots} open</span>
        </div>
        <div className="meter-track">
          <span style={{ width: `${Math.min((counts.used / counts.total) * 100, 100)}%` }} />
        </div>
      </div>

      <div className="host-block">
        <strong>{host?.name || "Unknown host"}</strong>
        <span>{host?.notes}</span>
        <div className="contact-row">
          <a href={`mailto:${host?.email}`}>
            <Mail size={14} aria-hidden="true" />
            Email
          </a>
          {host?.phone && (
            <a href={`tel:${host.phone}`}>
              <Phone size={14} aria-hidden="true" />
              Phone
            </a>
          )}
        </div>
      </div>

      <div className="people-line">
        <strong>Committed:</strong>
        <span>{riders.length ? riders.map((rider) => rider.name).join(", ") : "No riders committed yet"}</span>
      </div>
      <div className="people-line">
        <strong>Inquiries:</strong>
        <span>{inquiries.length ? inquiries.map((rider) => rider.name).join(", ") : "No open inquiries"}</span>
      </div>

      <div className="card-actions">
        <button className="secondary-button" type="button" disabled={!canAct || alreadyInquired} onClick={() => onInquire(group.id)}>
          <CircleAlert size={15} aria-hidden="true" />
          {alreadyInquired ? "Inquiry sent" : "Inquire"}
        </button>
        <button className="primary-button small" type="button" disabled={!canAct} onClick={() => onCommit(group.id)}>
          <CheckCircle2 size={15} aria-hidden="true" />
          {alreadyRiding ? "Committed" : "Commit"}
        </button>
        <select value={status} onChange={(event) => onStatusChange(event.target.value)} aria-label="Ride status">
          <option value="open">Open</option>
          <option value="pending">Pending</option>
          <option value="committed">Committed</option>
          <option value="full">Full</option>
        </select>
      </div>
    </article>
  );
}

function ParticipantSummary({ participant }) {
  const corridor = getCorridor(participant.corridor);
  return (
    <article className="participant-summary">
      <div>
        <strong>{participant.name}</strong>
        <span>{participant.neighborhood}</span>
      </div>
      <p>{corridor.label}</p>
      <p>{formatSlots(participant.availability)}</p>
      <p>{participant.notes}</p>
    </article>
  );
}

function ScorePill({ match }) {
  const level = match.score >= 80 ? "high" : match.score >= 55 ? "medium" : "low";
  return <span className={`score-pill score-${level}`}>{Math.max(match.score, 0)} fit</span>;
}

function StatusBadge({ status }) {
  return <span className={`status-badge status-${status}`}>{status}</span>;
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export default App;
