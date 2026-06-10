import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  RotateCcw,
  Search,
  UserPlus,
  Users,
} from "lucide-react";
import { hasSupabaseConfig, supabase } from "./supabaseClient";
import {
  commitToRide,
  fetchSupabaseBoard,
  requestJoinRide,
  saveGroupStatus,
  saveParticipantWithGroups,
} from "./supabaseData";

const storageKey = "ire-ride-connection-state-v1";

const slots = [
  { id: "thuAm", label: "Thu AM", direction: "To conference" },
  { id: "thuPm", label: "Thu PM", direction: "Return trip" },
  { id: "friAm", label: "Fri AM", direction: "To conference" },
  { id: "friPm", label: "Fri PM", direction: "Return trip" },
  { id: "satAm", label: "Sat AM", direction: "To conference" },
  { id: "satPm", label: "Sat PM", direction: "Return trip" },
  { id: "sunAm", label: "Sun AM", direction: "To conference" },
  { id: "sunPm", label: "Sun PM", direction: "Return trip" },
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
    seatsNeeded: 0,
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
    seatsNeeded: 1,
    seatsAvailable: 0,
    maxPartySize: 0,
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
    seatsNeeded: 0,
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
    seatsNeeded: 0,
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
    seatsNeeded: 1,
    seatsAvailable: 0,
    maxPartySize: 0,
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
    seatsNeeded: 0,
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
    seatsNeeded: 0,
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
    seatsNeeded: 0,
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
  {
    id: "g6",
    hostId: "p5",
    type: "carpool-request",
    corridor: "pg-county",
    routeFlexibility: "moderate",
    capacity: 1,
    riderIds: [],
    inquiries: [],
    status: "open",
    availability: makeAvailability(["friAm", "friPm", "satAm"]),
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
  seatsNeeded: 1,
  seatsAvailable: 1,
  maxPartySize: 0,
  availability: makeAvailability(["thuAm", "friAm"]),
  notes: "",
};

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

function participantToForm(participant) {
  if (!participant) return blankForm;

  return normalizeRideModeFields({
    name: participant.name || "",
    email: participant.email || "",
    phone: participant.phone || "",
    neighborhood: participant.neighborhood || "",
    corridor: participant.corridor || "dc-nw",
    intent: participant.intent || "need-seat",
    transportPreference: participant.transportPreference || "either",
    seatsNeeded: participant.seatsNeeded ?? 1,
    seatsAvailable: participant.seatsAvailable ?? 1,
    maxPartySize: participant.maxPartySize ?? 3,
    availability: participant.availability || makeAvailability(["thuAm", "friAm"]),
    notes: participant.notes || "",
  });
}

function ridePlanFromForm(formState) {
  if (formState.intent === "offer") return "offer-carpool";
  if (formState.intent === "split-rideshare") return "split-rideshare";
  if (formState.intent === "both") {
    return Number(formState.seatsAvailable) > 0 ? "open-offer" : "open-seek";
  }
  return "need-carpool";
}

function formFieldsFromRidePlan(ridePlan, currentForm) {
  const nextForm = { ...currentForm };

  if (ridePlan === "offer-carpool") {
    nextForm.intent = "offer";
    nextForm.transportPreference = "carpool";
    nextForm.seatsNeeded = 0;
    nextForm.seatsAvailable = Number(nextForm.seatsAvailable) > 0 ? nextForm.seatsAvailable : 1;
  } else if (ridePlan === "split-rideshare") {
    nextForm.intent = "split-rideshare";
    nextForm.transportPreference = "rideshare";
    nextForm.seatsNeeded = 0;
    nextForm.seatsAvailable = 0;
    nextForm.maxPartySize = Number(nextForm.maxPartySize) > 0 ? nextForm.maxPartySize : 2;
  } else if (ridePlan === "open-offer") {
    nextForm.intent = "both";
    nextForm.transportPreference = "either";
    nextForm.seatsNeeded = 0;
    nextForm.seatsAvailable = Number(nextForm.seatsAvailable) > 0 ? nextForm.seatsAvailable : 1;
    nextForm.maxPartySize = Number(nextForm.maxPartySize) > 0 ? nextForm.maxPartySize : 2;
  } else if (ridePlan === "open-seek") {
    nextForm.intent = "both";
    nextForm.transportPreference = "either";
    nextForm.seatsNeeded = Number(nextForm.seatsNeeded) > 0 ? nextForm.seatsNeeded : 1;
    nextForm.seatsAvailable = 0;
    nextForm.maxPartySize = Number(nextForm.maxPartySize) > 0 ? nextForm.maxPartySize : 2;
  } else {
    nextForm.intent = "need-seat";
    nextForm.transportPreference = "carpool";
    nextForm.seatsNeeded = Number(nextForm.seatsNeeded) > 0 ? nextForm.seatsNeeded : 1;
    nextForm.seatsAvailable = 0;
    nextForm.maxPartySize = 0;
  }

  return normalizeRideModeFields(nextForm);
}

function normalizeRideModeFields(formState) {
  const ridePlan = ridePlanFromForm(formState);
  const isOpenPlan = ridePlan === "open-offer" || ridePlan === "open-seek";
  const needsCarpoolSeat = ridePlan === "need-carpool" || ridePlan === "open-seek";
  const offersCarpool = ridePlan === "offer-carpool" || ridePlan === "open-offer";
  const splitsRideshare = ridePlan === "split-rideshare" || isOpenPlan;

  return {
    ...formState,
    seatsNeeded: needsCarpoolSeat ? formState.seatsNeeded : 0,
    seatsAvailable: offersCarpool ? formState.seatsAvailable : 0,
    maxPartySize: splitsRideshare ? formState.maxPartySize : 0,
    transportPreference: isOpenPlan ? "either" : needsCarpoolSeat ? "carpool" : formState.transportPreference,
  };
}

function getRidePlanHelp(ridePlan) {
  if (ridePlan === "offer-carpool") return "You will appear as a driver with open carpool seats.";
  if (ridePlan === "split-rideshare") return "You will appear as an Uber/Lyft split organizer.";
  if (ridePlan === "open-offer") return "You will appear as a driver and as an Uber/Lyft split organizer.";
  if (ridePlan === "open-seek") return "You will appear as someone seeking a carpool seat and as an Uber/Lyft split organizer.";
  return "You will appear as someone seeking a carpool seat.";
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

function pluralize(count, singular, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

function getGroupTypeMeta(type) {
  if (type === "carpool") {
    return {
      Icon: Car,
      title: "Driver carpool",
      contactName: "Driver",
      committedLabel: "Matched riders:",
      emptyCommitted: "No riders committed yet",
      inquiriesLabel: "Contacted by:",
      emptyInquiries: "No contact noted",
      inquireLabel: "Record contact",
      inquiredLabel: "Contact noted",
      commitLabel: "Driver confirms",
      committedButtonLabel: "Matched",
      statusLabel: "Ride status",
    };
  }

  if (type === "carpool-request") {
    return {
      Icon: UserPlus,
      title: "Carpool request",
      contactName: "Requester",
      committedLabel: "Matched offers:",
      emptyCommitted: "No matched offers yet",
      inquiriesLabel: "Help offered by:",
      emptyInquiries: "No help offers noted",
      inquireLabel: "Record help offer",
      inquiredLabel: "Help offer noted",
      commitLabel: "Mark matched",
      committedButtonLabel: "Matched",
      statusLabel: "Request status",
    };
  }

  return {
    Icon: Users,
    title: "Uber/Lyft split",
    contactName: "Organizer",
    committedLabel: "Matched:",
    emptyCommitted: "No riders committed yet",
    inquiriesLabel: "Contacted by:",
    emptyInquiries: "No contact noted",
    inquireLabel: "Record contact",
    inquiredLabel: "Contact noted",
    commitLabel: "Mark matched",
    committedButtonLabel: "Matched",
    statusLabel: "Ride status",
  };
}

function getGroupCounts(group) {
  if (group.type === "carpool") {
    const committed = group.riderIds.length;
    const openSpots = Math.max(group.capacity - committed, 0);
    return {
      committed,
      openSpots,
      used: committed,
      total: group.capacity,
      label: `${committed}/${group.capacity} carpool seats committed`,
      openLabel: `${openSpots} open`,
    };
  }

  if (group.type === "carpool-request") {
    const matchedOffers = group.riderIds.length;
    const stillNeeded = Math.max(group.capacity - matchedOffers, 0);
    return {
      committed: matchedOffers,
      openSpots: stillNeeded,
      used: matchedOffers,
      total: group.capacity,
      label: `${group.capacity} carpool ${pluralize(group.capacity, "seat")} needed`,
      openLabel: `${stillNeeded} still needed`,
    };
  }

  const committed = group.riderIds.length + 1;
  const openSpots = Math.max(group.capacity - committed, 0);
  return {
    committed,
    openSpots,
    used: committed,
    total: group.capacity,
    label: `${committed}/${group.capacity} riders in pool`,
    openLabel: `${openSpots} open`,
  };
}

function effectiveStatus(group) {
  const counts = getGroupCounts(group);
  if (counts.openSpots === 0) return "full";
  return group.status;
}

function getParticipantRideCapabilities(participant) {
  if (!participant) {
    return {
      wantsCarpoolSeat: false,
      wantsRideshare: false,
      offersCarpool: false,
    };
  }

  return {
    wantsCarpoolSeat:
      participant.intent === "need-seat" ||
      (participant.intent === "both" && participant.seatsNeeded > 0) ||
      ((participant.transportPreference === "carpool" || participant.transportPreference === "either") &&
        participant.seatsNeeded > 0),
    wantsRideshare:
      participant.intent === "split-rideshare" ||
      participant.intent === "both" ||
      participant.transportPreference === "rideshare" ||
      participant.transportPreference === "either",
    offersCarpool:
      (participant.intent === "offer" || participant.intent === "both") &&
      participant.transportPreference !== "rideshare" &&
      participant.seatsAvailable > 0,
  };
}

function canParticipantActOnGroup(participant, group) {
  const capabilities = getParticipantRideCapabilities(participant);
  if (group.type === "carpool") return capabilities.wantsCarpoolSeat;
  if (group.type === "carpool-request") return capabilities.offersCarpool;
  return capabilities.wantsRideshare;
}

function scoreGroupForParticipant(group, participant) {
  const sharedSlots = overlapSlots(group.availability, participant.availability);
  const routeFit = routeFitLabel(participant.corridor, group.corridor, group.type);
  const status = effectiveStatus(group);
  const { wantsCarpoolSeat, wantsRideshare, offersCarpool } = getParticipantRideCapabilities(participant);
  const compatibleGroup = canParticipantActOnGroup(participant, group);

  let score = sharedSlots.length * 12;
  if (routeFit.level === "strong") score += 38;
  if (routeFit.level === "good") score += 22;
  if (routeFit.level === "possible") score += 8;
  if (routeFit.level === "weak") score -= 20;
  if (group.type === "carpool" && wantsCarpoolSeat) score += 14;
  if (group.type === "carpool-request" && offersCarpool) score += 18;
  if (group.type === "carpool-request" && wantsCarpoolSeat) score -= 10;
  if (group.type === "rideshare" && wantsRideshare) score += 14;
  if (group.type === "carpool" && !wantsCarpoolSeat) score -= 24;
  if (group.type === "carpool-request" && !offersCarpool && !wantsCarpoolSeat) score -= 16;
  if (group.type === "rideshare" && !wantsRideshare) score -= 12;
  if (status === "open") score += 12;
  if (status === "pending") score += 4;
  if (status === "committed") score += 2;
  if (status === "full") score -= 34;
  if (!compatibleGroup) score -= 60;
  if (group.routeFlexibility === "tight" && routeFit.level !== "strong") score -= 18;
  if (group.routeFlexibility === "flexible" && routeFit.level !== "weak") score += 5;

  return {
    score,
    sharedSlots,
    routeFit,
    status,
  };
}

function matchCategory(score) {
  if (score >= 80) return { label: "Strong match", level: "high" };
  if (score >= 55) return { label: "Good match", level: "medium" };
  if (score >= 30) return { label: "Possible match", level: "low" };
  return { label: "Weak match", level: "weak" };
}

function App() {
  const [state, setState] = useState(loadInitialState);
  const [form, setForm] = useState(blankForm);
  const [selectedParticipantId, setSelectedParticipantId] = useState("p2");
  const [corridorFilter, setCorridorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [query, setQuery] = useState("");
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState("user");
  const [authEmail, setAuthEmail] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [appError, setAppError] = useState("");
  const [rideInfoMessage, setRideInfoMessage] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasAdminMfaAccess, setHasAdminMfaAccess] = useState(false);
  const [isPlanEditorOpen, setIsPlanEditorOpen] = useState(false);
  const boardRequestId = useRef(0);

  const { participants, groups } = state;
  const hasAdminAccess = userRole === "admin" && hasAdminMfaAccess;
  const ownParticipant = session
    ? participants.find((participant) => participant.userId === session.user.id)
    : null;
  const selectedParticipant =
    (session && !hasAdminAccess
      ? ownParticipant
      : participants.find((participant) => participant.id === selectedParticipantId)) ||
    ownParticipant ||
    participants[0];

  useEffect(() => {
    if (session && ownParticipant) {
      setForm(participantToForm(ownParticipant));
    }
  }, [ownParticipant, session]);

  const refreshAdminMfaAccess = useCallback(async () => {
    if (!supabase) {
      setHasAdminMfaAccess(false);
      return false;
    }

    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) {
      setHasAdminMfaAccess(false);
      return false;
    }

    const isVerified = data?.currentLevel === "aal2";
    setHasAdminMfaAccess(isVerified);
    return isVerified;
  }, []);

  const loadRemoteBoard = useCallback(
    async (activeSession) => {
      if (!activeSession || !supabase) return;
      const requestId = boardRequestId.current + 1;
      boardRequestId.current = requestId;
      setIsSyncing(true);
      setAppError("");
      try {
        const board = await fetchSupabaseBoard();
        if (requestId !== boardRequestId.current) return;
        setState({
          participants: board.participants,
          groups: board.groups,
        });
        setUserRole(board.role);
        if (board.role === "admin") {
          await refreshAdminMfaAccess();
        } else {
          setHasAdminMfaAccess(false);
        }

        const currentOwnParticipant = board.participants.find(
          (participant) => participant.userId === activeSession.user.id,
        );
        if (board.role !== "admin" && currentOwnParticipant) {
          setSelectedParticipantId(currentOwnParticipant.id);
        } else if (board.participants.length) {
          setSelectedParticipantId((currentId) =>
            board.participants.some((participant) => participant.id === currentId)
              ? currentId
              : board.participants[0].id,
          );
        }
      } catch (error) {
        setAppError(error.message || "Unable to load Supabase data.");
      } finally {
        if (requestId === boardRequestId.current) {
          setIsSyncing(false);
        }
      }
    },
    [refreshAdminMfaAccess],
  );

  const handleAdminMfaVerified = useCallback(async () => {
    await refreshAdminMfaAccess();
    await loadRemoteBoard(session);
  }, [loadRemoteBoard, refreshAdminMfaAccess, session]);

  useEffect(() => {
    if (!supabase) return undefined;

    let isMounted = true;

    async function hydrateAuth() {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;
      setSession(data.session);
      if (data.session) {
        await loadRemoteBoard(data.session);
      }
    }

    hydrateAuth();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        loadRemoteBoard(nextSession);
      } else {
        setUserRole("user");
        setHasAdminMfaAccess(false);
        setState(loadInitialState());
        setSelectedParticipantId("p2");
      }
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadRemoteBoard]);

  async function sendLoginCode(event) {
    event.preventDefault();
    if (!supabase) return;
    setAppError("");
    setAuthMessage("");
    const { error } = await supabase.auth.signInWithOtp({
      email: authEmail,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      setAppError(error.message);
      return;
    }
    setAuthMessage("Check your email for a one-time sign-in code.");
  }

  async function verifyLoginCode(event) {
    event.preventDefault();
    if (!supabase) return;
    setAppError("");
    const { error } = await supabase.auth.verifyOtp({
      email: authEmail,
      token: authCode,
      type: "email",
    });
    if (error) {
      setAppError(error.message);
      return;
    }
    setAuthCode("");
    setAuthMessage("Signed in.");
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setAuthMessage("");
  }

  function persist(nextState) {
    setState(nextState);
    window.localStorage.setItem(storageKey, JSON.stringify(nextState));
  }

  function resetSamples() {
    if (session) {
      loadRemoteBoard(session);
      return;
    }

    const nextState = {
      participants: sampleParticipants,
      groups: sampleGroups,
    };
    setSelectedParticipantId("p2");
    persist(nextState);
  }

  function updateFormField(field, value) {
    setRideInfoMessage("");
    setForm((current) => {
      if (field === "ridePlan") {
        return formFieldsFromRidePlan(value, current);
      }

      return normalizeRideModeFields({
        ...current,
        [field]: value,
      });
    });
  }

  function updateAvailability(slotId) {
    setRideInfoMessage("");
    setForm((current) => ({
      ...current,
      availability: {
        ...current.availability,
        [slotId]: !current.availability[slotId],
      },
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setRideInfoMessage("");

    const participantId = `p${Date.now()}`;
    const normalizedForm = normalizeRideModeFields(form);
    const participant = {
      ...normalizedForm,
      id: participantId,
      seatsNeeded: Number(normalizedForm.seatsNeeded),
      seatsAvailable: Number(normalizedForm.seatsAvailable),
      maxPartySize: Number(normalizedForm.maxPartySize),
    };

    const nextGroups = [...groups];
    const groupsToCreate = [];
    const offersCarpool =
      (participant.intent === "offer" || participant.intent === "both") &&
      participant.transportPreference !== "rideshare" &&
      participant.seatsAvailable > 0;
    const requestsCarpool =
      (participant.intent === "need-seat" || participant.intent === "both") &&
      participant.transportPreference !== "rideshare" &&
      participant.seatsNeeded > 0;
    const startsRideshare =
      participant.intent === "split-rideshare" ||
      (participant.intent === "both" && participant.transportPreference !== "carpool");

    if (offersCarpool) {
      const carpoolGroup = {
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
      };
      nextGroups.push(carpoolGroup);
      groupsToCreate.push(carpoolGroup);
    }

    if (requestsCarpool) {
      const carpoolRequestGroup = {
        id: `g${Date.now()}q`,
        hostId: participantId,
        type: "carpool-request",
        corridor: participant.corridor,
        routeFlexibility: "moderate",
        capacity: participant.seatsNeeded,
        riderIds: [],
        inquiries: [],
        status: "open",
        availability: participant.availability,
      };
      nextGroups.push(carpoolRequestGroup);
      groupsToCreate.push(carpoolRequestGroup);
    }

    if (startsRideshare) {
      const rideshareGroup = {
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
      };
      nextGroups.push(rideshareGroup);
      groupsToCreate.push(rideshareGroup);
    }

    if (session && supabase) {
      setIsSyncing(true);
      setAppError("");
      try {
        const savedParticipant = await saveParticipantWithGroups(
          participant,
          session.user.id,
          groupsToCreate,
        );
        setSelectedParticipantId(savedParticipant.id);
        setForm(participantToForm(savedParticipant));
        await loadRemoteBoard(session);
        setRideInfoMessage("Ride info saved.");
        setIsPlanEditorOpen(false);
      } catch (error) {
        setAppError(error.message || "Unable to save your ride info.");
      } finally {
        setIsSyncing(false);
      }
      return;
    }

    persist({
      participants: [...participants, participant],
      groups: nextGroups,
    });
    setSelectedParticipantId(participantId);
    setForm(blankForm);
    setRideInfoMessage("Ride info added to the sample board.");
    setIsPlanEditorOpen(false);
  }

  async function updateGroup(groupId, patch) {
    if (session && supabase && patch.status) {
      setIsSyncing(true);
      setAppError("");
      try {
        await saveGroupStatus(groupId, patch.status);
        await loadRemoteBoard(session);
      } catch (error) {
        setAppError(error.message || "Unable to update ride status.");
      } finally {
        setIsSyncing(false);
      }
      return;
    }

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

  async function inquire(groupId) {
    if (!selectedParticipant) return;
    const group = groups.find((item) => item.id === groupId);
    if (!group || group.hostId === selectedParticipant.id) return;
    if (!canParticipantActOnGroup(selectedParticipant, group)) return;

    if (session && supabase) {
      setIsSyncing(true);
      setAppError("");
      try {
        await requestJoinRide(groupId, selectedParticipant.id);
        await loadRemoteBoard(session);
      } catch (error) {
        setAppError(error.message || "Unable to mark contact.");
      } finally {
        setIsSyncing(false);
      }
      return;
    }

    const inquiries = new Set(group.inquiries);
    inquiries.add(selectedParticipant.id);
    updateGroup(groupId, {
      inquiries: Array.from(inquiries),
      status: group.status === "open" ? "pending" : group.status,
    });
  }

  async function commit(groupId, participantIdToMatch = selectedParticipant?.id) {
    if (!selectedParticipant) return;
    const group = groups.find((item) => item.id === groupId);
    const participantToMatch = participants.find((participant) => participant.id === participantIdToMatch);
    if (!group || !participantToMatch) return;

    const isHost = group.hostId === selectedParticipant.id;
    const isSelfMatch = participantIdToMatch === selectedParticipant.id;
    const hasInquiry = group.inquiries.includes(participantIdToMatch);
    const actorCanMarkMatch =
      hasAdminAccess ||
      (group.type === "carpool" && isHost) ||
      (group.type === "rideshare" && (isHost || isSelfMatch)) ||
      (group.type === "carpool-request" &&
        isSelfMatch &&
        canParticipantActOnGroup(selectedParticipant, group));

    if (!hasInquiry || !actorCanMarkMatch) return;

    if (session && supabase) {
      setIsSyncing(true);
      setAppError("");
      try {
        await commitToRide(groupId, participantIdToMatch);
        await loadRemoteBoard(session);
      } catch (error) {
        setAppError(error.message || "Unable to mark match.");
      } finally {
        setIsSyncing(false);
      }
      return;
    }

    const riders = new Set(group.riderIds);
    riders.add(participantIdToMatch);
    const inquiries = group.inquiries.filter((id) => id !== participantIdToMatch);
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
      .filter((group) => group.hostId !== selectedParticipant.id && canParticipantActOnGroup(selectedParticipant, group))
      .map((group) => ({
        group,
        match: scoreGroupForParticipant(group, selectedParticipant),
      }))
      .sort((a, b) => b.match.score - a.match.score)
      .slice(0, 5);
  }, [groups, selectedParticipant]);

  const activeStats = useMemo(() => {
    const openGroups = groups.filter((group) => effectiveStatus(group) !== "full");
    const openSeats = groups.reduce((total, group) => {
      if (group.type === "carpool-request") return total;
      return total + getGroupCounts(group).openSpots;
    }, 0);
    const seekers = participants.filter(
      (participant) =>
        participant.intent === "need-seat" ||
        participant.intent === "split-rideshare" ||
        participant.intent === "both",
    );
    return {
      participants: participants.length,
      openGroups: openGroups.length,
      openSeats,
      seekers: seekers.length,
    };
  }, [groups, participants]);

  const canSwitchParticipant = !session || hasAdminAccess;
  const planSummaryParticipant = ownParticipant || (!session ? selectedParticipant : null);
  const showPlanEditor = isPlanEditorOpen || !planSummaryParticipant;

  function openPlanEditor() {
    setRideInfoMessage("");
    if (ownParticipant) {
      setForm(participantToForm(ownParticipant));
    } else {
      setForm(blankForm);
    }
    setIsPlanEditorOpen(true);
  }

  return (
    <div className="app simple-app">
      <header className="simple-hero">
        <div>
          <p className="eyebrow">National Harbor commute board</p>
          <h1>IRE Ride Connection</h1>
          <p>
            Post one ride profile, then contact people whose route and conference slots line up.
          </p>
        </div>
        <div className="simple-stats" aria-label="Current board summary">
          <Stat label="People" value={activeStats.participants} />
          <Stat label="Active posts" value={activeStats.openGroups} />
          <Stat label="Open spots" value={activeStats.openSeats} />
        </div>
      </header>

      <AuthPanel
        appError={appError}
        authCode={authCode}
        authEmail={authEmail}
        authMessage={authMessage}
        hasSupabaseConfig={hasSupabaseConfig}
        isSyncing={isSyncing}
        onSendCode={sendLoginCode}
        onSignOut={signOut}
        onVerifyCode={verifyLoginCode}
        session={session}
        setAuthCode={setAuthCode}
        setAuthEmail={setAuthEmail}
        hasAdminMfaAccess={hasAdminMfaAccess}
        onAdminMfaVerified={handleAdminMfaVerified}
        userRole={userRole}
      />

      <main className="simple-shell">
        <section className="simple-panel simple-profile">
          <div className="simple-section-heading">
            <span className="step-badge">1</span>
            <div>
              <p className="eyebrow">Your plan</p>
              <h2>
                {showPlanEditor
                  ? ownParticipant
                    ? "Update your ride info"
                    : "Add your ride info"
                  : session
                    ? "Your saved ride info"
                    : "Previewed ride plan"}
              </h2>
            </div>
          </div>
          {showPlanEditor ? (
            <EntryForm
              form={form}
              onSubmit={handleSubmit}
              onFieldChange={updateFormField}
              onAvailabilityChange={updateAvailability}
              isSaving={isSyncing}
              saveMessage={rideInfoMessage}
              submitLabel={ownParticipant ? "Save ride info" : "Post ride info"}
            />
          ) : (
            <PlanSummary
              participant={planSummaryParticipant}
              onEdit={openPlanEditor}
              editLabel={session ? "Edit ride info" : "Add a sample profile"}
            />
          )}
        </section>

        <section className="simple-panel simple-board">
          <div className="simple-board-top">
            <div className="simple-section-heading">
              <span className="step-badge">2</span>
              <div>
                <p className="eyebrow">Connection board</p>
                <h2>Likely matches</h2>
              </div>
            </div>
          </div>

          {canSwitchParticipant && (
            <PrototypePreviewTools
              isSignedIn={Boolean(session)}
              participants={participants}
              resetSamples={resetSamples}
              selectedParticipant={selectedParticipant}
              setSelectedParticipantId={setSelectedParticipantId}
            />
          )}

          {selectedParticipant && (
            <div className="simple-current-person">
              <strong>{selectedParticipant.name}</strong>
              <span>
                {selectedParticipant.neighborhood} · {getCorridor(selectedParticipant.corridor).label}
              </span>
            </div>
          )}

          <BoardControls
            corridorFilter={corridorFilter}
            query={query}
            setCorridorFilter={setCorridorFilter}
            setQuery={setQuery}
            setStatusFilter={setStatusFilter}
            statusFilter={statusFilter}
          />

          <FitLegend />

          {selectedMatches.length > 0 && (
            <div className="simple-best-strip">
              {selectedMatches.slice(0, 3).map(({ group, match }) => {
                const host = participants.find((participant) => participant.id === group.hostId);
                const groupMeta = getGroupTypeMeta(group.type);
                return (
                  <span key={group.id}>
                    {groupMeta.title}: {host?.neighborhood || "neighborhood pending"} · {matchCategory(match.score).label}
                  </span>
                );
              })}
            </div>
          )}

          <div className="ride-grid simple-ride-grid">
            {filteredGroups.length ? (
              filteredGroups.map((group) => (
                <RideCard
                  key={group.id}
                  group={group}
                  participants={participants}
                  selectedParticipant={selectedParticipant}
                  match={selectedParticipant ? scoreGroupForParticipant(group, selectedParticipant) : null}
                  onInquire={inquire}
                  onCommit={commit}
                  onStatusChange={(status) => updateGroup(group.id, { status })}
                  canManageStatus={
                    hasAdminAccess ||
                    group.hostId === (session ? ownParticipant?.id : selectedParticipant?.id)
                  }
                />
              ))
            ) : (
              <p className="empty-note">No matching posts yet. Try clearing search or selecting all corridors.</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function AuthPanel({
  appError,
  authCode,
  authEmail,
  authMessage,
  hasAdminMfaAccess,
  hasSupabaseConfig,
  isSyncing,
  onAdminMfaVerified,
  onSendCode,
  onSignOut,
  onVerifyCode,
  session,
  setAuthCode,
  setAuthEmail,
  userRole,
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!hasSupabaseConfig) {
    return (
      <section className="auth-panel">
        <div>
          <strong>Sample mode</strong>
          <span>Supabase env vars are not configured, so this browser is using local prototype data.</span>
        </div>
      </section>
    );
  }

  if (session) {
    return (
      <section className="auth-panel signed-in">
        <div>
          <strong>{session.user.email}</strong>
          <span>
            Signed in with Supabase. Role: <b>{userRole}</b>
            {userRole === "admin" ? ` · MFA ${hasAdminMfaAccess ? "verified" : "needed"}` : ""}
            {isSyncing ? " · syncing..." : ""}
          </span>
        </div>
        {userRole === "admin" && (
          <AdminMfaPanel
            hasAdminMfaAccess={hasAdminMfaAccess}
            onVerified={onAdminMfaVerified}
          />
        )}
        <button className="secondary-button" type="button" onClick={onSignOut}>
          Sign out
        </button>
        {appError && <p className="error-text">{appError}</p>}
      </section>
    );
  }

  return (
    <section className={`auth-panel${isExpanded ? " expanded" : " collapsed"}`}>
      <div>
        <strong>Sign in to save your ride profile</strong>
        <span>
          {isExpanded
            ? "Use your email to get a one-time sign-in code. The sample board remains visible while signed out."
            : "Optional. The sample board remains visible while signed out."}
        </span>
      </div>
      {!isExpanded && (
        <button className="secondary-button" type="button" onClick={() => setIsExpanded(true)}>
          Sign in
        </button>
      )}
      {isExpanded && (
        <>
          <form className="auth-form" onSubmit={onSendCode}>
            <label className="field">
              <span>Account email</span>
              <input
                required
                type="email"
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <button className="primary-button" type="submit">
              Send code
            </button>
          </form>
          <form className="auth-form" onSubmit={onVerifyCode}>
            <label className="field">
              <span>One-time code</span>
              <input
                inputMode="numeric"
                value={authCode}
                onChange={(event) => setAuthCode(event.target.value)}
                placeholder="123456"
              />
            </label>
            <button className="secondary-button" disabled={!authCode} type="submit">
              Verify code
            </button>
          </form>
        </>
      )}
      {authMessage && <p className="success-text">{authMessage}</p>}
      {appError && <p className="error-text">{appError}</p>}
    </section>
  );
}

function AdminMfaPanel({ hasAdminMfaAccess, onVerified }) {
  const [verifiedFactors, setVerifiedFactors] = useState([]);
  const [selectedFactorId, setSelectedFactorId] = useState("");
  const [enrollment, setEnrollment] = useState(null);
  const [enrollCode, setEnrollCode] = useState("");
  const [challengeCode, setChallengeCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refreshMfaState = useCallback(async () => {
    if (!supabase) return;

    const { data, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) {
      setError(factorsError.message);
      return;
    }

    const totpFactors = data?.totp || [];
    setVerifiedFactors(totpFactors);
    setSelectedFactorId((currentFactorId) =>
      totpFactors.some((factor) => factor.id === currentFactorId)
        ? currentFactorId
        : totpFactors[0]?.id || "",
    );
  }, []);

  useEffect(() => {
    refreshMfaState();
  }, [refreshMfaState]);

  async function startMfaEnrollment() {
    if (!supabase) return;
    setError("");
    setMessage("");
    setIsLoading(true);

    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "IRE Ride Admin",
    });

    if (enrollError) {
      setError(enrollError.message);
      setIsLoading(false);
      return;
    }

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: data.id,
    });

    if (challengeError) {
      setError(challengeError.message);
      setIsLoading(false);
      return;
    }

    setEnrollment({
      factorId: data.id,
      challengeId: challenge.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    });
    setEnrollCode("");
    setMessage("Scan the QR code in an authenticator app, then enter the code.");
    setIsLoading(false);
  }

  async function verifyEnrollment(event) {
    event.preventDefault();
    if (!supabase || !enrollment) return;
    setError("");
    setIsLoading(true);

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: enrollment.factorId,
      challengeId: enrollment.challengeId,
      code: enrollCode,
    });

    if (verifyError) {
      setError(verifyError.message);
      setIsLoading(false);
      return;
    }

    setMessage("Admin MFA is verified for this session.");
    setEnrollment(null);
    setEnrollCode("");
    await refreshMfaState();
    await onVerified?.();
    setIsLoading(false);
  }

  async function verifyExistingFactor(event) {
    event.preventDefault();
    if (!supabase || !selectedFactorId) return;
    setError("");
    setMessage("");
    setIsLoading(true);

    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: selectedFactorId,
      code: challengeCode,
    });

    if (verifyError) {
      setError(verifyError.message);
      setIsLoading(false);
      return;
    }

    setChallengeCode("");
    setMessage("Admin MFA is verified for this session.");
    await refreshMfaState();
    await onVerified?.();
    setIsLoading(false);
  }

  const qrCodeSrc = enrollment?.qrCode?.startsWith("data:")
    ? enrollment.qrCode
    : `data:image/svg+xml;utf8,${encodeURIComponent(enrollment?.qrCode || "")}`;

  return (
    <div className="mfa-panel">
      <p className="mfa-status">
        {hasAdminMfaAccess
          ? "Admin troubleshooting tools are available for this session."
          : "Verify admin MFA before using troubleshooting tools."}
      </p>

      {!hasAdminMfaAccess && verifiedFactors.length > 0 && !enrollment && (
        <form className="mfa-enroll" onSubmit={verifyExistingFactor}>
          {verifiedFactors.length > 1 && (
            <label className="field">
              <span>Authenticator</span>
              <select
                value={selectedFactorId}
                onChange={(event) => setSelectedFactorId(event.target.value)}
              >
                {verifiedFactors.map((factor) => (
                  <option key={factor.id} value={factor.id}>
                    {factor.friendly_name || "Authenticator app"}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="field">
            <span>Admin MFA code</span>
            <input
              inputMode="numeric"
              value={challengeCode}
              onChange={(event) => setChallengeCode(event.target.value)}
              placeholder="123456"
            />
          </label>
          <button className="primary-button" disabled={isLoading || !challengeCode} type="submit">
            Verify admin MFA
          </button>
        </form>
      )}

      {!verifiedFactors.length && !enrollment && (
        <button className="secondary-button" disabled={isLoading} type="button" onClick={startMfaEnrollment}>
          Set up admin MFA
        </button>
      )}

      {enrollment && (
        <form className="mfa-enroll" onSubmit={verifyEnrollment}>
          <img alt="Authenticator QR code" src={qrCodeSrc} />
          <p>Secret: {enrollment.secret}</p>
          <label className="field">
            <span>Authenticator code</span>
            <input
              inputMode="numeric"
              value={enrollCode}
              onChange={(event) => setEnrollCode(event.target.value)}
              placeholder="123456"
            />
          </label>
          <button className="primary-button" disabled={isLoading || !enrollCode} type="submit">
            Verify MFA
          </button>
        </form>
      )}
      {message && <p className="success-text">{message}</p>}
      {error && <p className="error-text">{error}</p>}
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
        <span>Show</span>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="active">Available posts</option>
          <option value="all">All posts</option>
        </select>
      </label>
    </div>
  );
}

function PrototypePreviewTools({
  isSignedIn,
  participants,
  resetSamples,
  selectedParticipant,
  setSelectedParticipantId,
}) {
  return (
    <details className="prototype-drawer">
      <summary>{isSignedIn ? "Admin preview tools" : "Prototype preview tools"}</summary>
      <div>
        <label className="field preview-field">
          <span>Preview as</span>
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
        <button className="secondary-button" type="button" onClick={resetSamples}>
          <RotateCcw size={16} aria-hidden="true" />
          {isSignedIn ? "Reload Supabase data" : "Reset sample board"}
        </button>
      </div>
    </details>
  );
}

function FitLegend() {
  return (
    <div className="fit-legend" aria-label="Route fit scale">
      <span>Route fit</span>
      <span className="fit-tag fit-strong">Same corridor</span>
      <span className="fit-tag fit-good">Nearby route</span>
      <span className="fit-tag fit-possible">Flexible stretch</span>
      <span className="fit-tag fit-weak">Likely detour</span>
    </div>
  );
}

function PlanSummary({ editLabel, onEdit, participant }) {
  if (!participant) return null;
  const ridePlan = ridePlanFromForm(participant);
  const ridePlanHelp = getRidePlanHelp(ridePlan);
  const normalizedParticipant = normalizeRideModeFields(participant);

  return (
    <div className="plan-summary">
      <div>
        <strong>{participant.name}</strong>
        <span>
          {participant.neighborhood} · {getCorridor(participant.corridor).label}
        </span>
      </div>
      <p>{ridePlanHelp}</p>
      <div className="summary-chip-row">
        <span>{formatSlots(normalizedParticipant.availability)}</span>
        {normalizedParticipant.seatsAvailable > 0 && (
          <span>
            {normalizedParticipant.seatsAvailable}{" "}
            {pluralize(normalizedParticipant.seatsAvailable, "carpool seat")} offered
          </span>
        )}
        {normalizedParticipant.seatsNeeded > 0 && (
          <span>
            {normalizedParticipant.seatsNeeded}{" "}
            {pluralize(normalizedParticipant.seatsNeeded, "carpool seat")} needed
          </span>
        )}
        {normalizedParticipant.maxPartySize > 0 && (
          <span>Uber/Lyft group up to {normalizedParticipant.maxPartySize}</span>
        )}
      </div>
      {participant.notes && <p className="plan-summary-note">{participant.notes}</p>}
      <button className="secondary-button" type="button" onClick={onEdit}>
        {editLabel}
      </button>
    </div>
  );
}

function EntryForm({
  form,
  isSaving,
  onSubmit,
  onFieldChange,
  onAvailabilityChange,
  saveMessage,
  submitLabel,
}) {
  const ridePlan = ridePlanFromForm(form);
  const carpoolSeatsNeededDisabled =
    ridePlan === "offer-carpool" || ridePlan === "split-rideshare" || ridePlan === "open-offer";
  const carpoolSeatsOfferedDisabled =
    ridePlan === "need-carpool" || ridePlan === "split-rideshare" || ridePlan === "open-seek";
  const rideshareCapDisabled = ridePlan === "need-carpool" || ridePlan === "offer-carpool";
  const ridePlanHelp = getRidePlanHelp(ridePlan);

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

      <label className="field">
        <span>Ride plan</span>
        <select value={ridePlan} onChange={(event) => onFieldChange("ridePlan", event.target.value)}>
          <option value="need-carpool">I need a carpool seat</option>
          <option value="offer-carpool">I can drive and offer seats</option>
          <option value="split-rideshare">I want to split an Uber/Lyft</option>
          <option value="open-offer">I can drive or split Uber/Lyft</option>
          <option value="open-seek">I need a seat or can split Uber/Lyft</option>
        </select>
      </label>
      <p className="plan-note">{ridePlanHelp}</p>

      <div className="field-grid simple-number-grid">
        {!carpoolSeatsOfferedDisabled && (
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
        )}
        {!carpoolSeatsNeededDisabled && (
          <label className="field">
            <span>Carpool seats needed</span>
            <input
              min="0"
              max="6"
              type="number"
              value={form.seatsNeeded}
              onChange={(event) => onFieldChange("seatsNeeded", event.target.value)}
            />
          </label>
        )}
        {!rideshareCapDisabled && (
          <label className="field">
            <span>Uber/Lyft group size</span>
            <input
              min="0"
              max="6"
              type="number"
              value={form.maxPartySize}
              onChange={(event) => onFieldChange("maxPartySize", event.target.value)}
            />
          </label>
        )}
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
              <span className="slot-label">
                <strong>{slot.label}</strong>
                <small>{slot.direction}</small>
              </span>
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

      <button className="primary-button" disabled={isSaving} type="submit">
        <Plus size={16} aria-hidden="true" />
        {isSaving ? "Saving..." : submitLabel}
      </button>
      {saveMessage && <p className="success-text form-message">{saveMessage}</p>}
    </form>
  );
}

function RideCard({
  canManageStatus = true,
  group,
  participants,
  selectedParticipant,
  match,
  onInquire,
  onCommit,
  onStatusChange,
}) {
  const [revealedContacts, setRevealedContacts] = useState({ email: false, phone: false });
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
  const groupMeta = getGroupTypeMeta(group.type);
  const GroupIcon = groupMeta.Icon;
  const alreadyRiding = selectedParticipant && group.riderIds.includes(selectedParticipant.id);
  const alreadyInquired = selectedParticipant && group.inquiries.includes(selectedParticipant.id);
  const isHost = selectedParticipant && selectedParticipant.id === group.hostId;
  const canInquire =
    selectedParticipant &&
    !isHost &&
    !alreadyRiding &&
    !alreadyInquired &&
    status !== "full" &&
    canParticipantActOnGroup(selectedParticipant, group);
  const hasContactMethod = Boolean(host?.email || host?.phone);
  const hasRevealedContact = revealedContacts.email || revealedContacts.phone;
  const canRecordContact = canInquire && hasRevealedContact;
  const canSelfMarkMatch =
    selectedParticipant &&
    !isHost &&
    alreadyInquired &&
    !alreadyRiding &&
    status !== "full" &&
    (group.type === "rideshare" || group.type === "carpool-request") &&
    canParticipantActOnGroup(selectedParticipant, group);
  const hostCanMarkInquiries =
    isHost &&
    canManageStatus &&
    status !== "full" &&
    group.type !== "carpool-request" &&
    inquiries.length > 0;
  const footerHostMatch = hostCanMarkInquiries && inquiries.length === 1 ? inquiries[0] : null;
  const canMarkMatchFromFooter = canSelfMarkMatch || Boolean(footerHostMatch);
  const footerMatchParticipantId = footerHostMatch?.id;
  const hasActivity = riders.length > 0 || inquiries.length > 0;
  const hasDetails = Boolean(host?.notes || hasActivity);
  let contactStatusText = "Not a fit";
  if (alreadyRiding) {
    contactStatusText = groupMeta.committedButtonLabel;
  } else if (alreadyInquired || footerHostMatch) {
    contactStatusText = groupMeta.inquiredLabel;
  } else if (isHost) {
    contactStatusText = "Your post";
  } else if (canInquire) {
    contactStatusText = hasContactMethod ? "Reveal first" : "Contact unavailable";
  } else if (status === "committed") {
    contactStatusText = "Already matched";
  } else if (status === "full") {
    contactStatusText = "Full";
  }

  let actionGuidance = "This does not match your current ride plan.";
  if (alreadyRiding || status === "committed") {
    actionGuidance = "This match is recorded.";
  } else if (canMarkMatchFromFooter) {
    actionGuidance = "Record the match after everyone agrees.";
  } else if (alreadyInquired && group.type === "carpool") {
    actionGuidance = "Contact noted. The driver can mark the match.";
  } else if (alreadyInquired) {
    actionGuidance = "Contact noted. Mark matched after agreement.";
  } else if (canInquire && !hasRevealedContact && group.type === "carpool-request") {
    actionGuidance = "Reveal email or phone to offer help, then note it here.";
  } else if (canInquire && !hasRevealedContact) {
    actionGuidance = "Reveal email or phone first, then note that contact happened.";
  } else if (canInquire && group.type === "carpool-request") {
    actionGuidance = "After you offer help, record it here.";
  } else if (canInquire) {
    actionGuidance = "After you email or call, record contact here.";
  } else if (isHost && hostCanMarkInquiries) {
    actionGuidance = "Review contacted people above and mark matched after agreement.";
  } else if (isHost) {
    actionGuidance = "This is your post.";
  } else if (status === "full") {
    actionGuidance = "This post is full.";
  }

  return (
    <article className={`ride-card status-${status}`}>
      <div className="ride-card-header">
        <div className="ride-type">
          <GroupIcon size={18} aria-hidden="true" />
          <div>
            <h3>{groupMeta.title}</h3>
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

      <div className="simple-capacity" aria-label={counts.label}>
        <strong>{counts.label}</strong>
        <span>{counts.openLabel}</span>
      </div>

      <div className="host-block">
        <span className="host-role">{groupMeta.contactName}</span>
        <strong>{host?.name || "Unknown host"}</strong>
        <div className="contact-row">
          {host?.email && (
            <button
              className="contact-reveal-button"
              type="button"
              onClick={() => setRevealedContacts((current) => ({ ...current, email: !current.email }))}
              aria-expanded={revealedContacts.email}
            >
              <Mail size={14} aria-hidden="true" />
              {revealedContacts.email ? host.email : "Reveal email"}
            </button>
          )}
          {host?.phone && (
            <button
              className="contact-reveal-button"
              type="button"
              onClick={() => setRevealedContacts((current) => ({ ...current, phone: !current.phone }))}
              aria-expanded={revealedContacts.phone}
            >
              <Phone size={14} aria-hidden="true" />
              {revealedContacts.phone ? host.phone : "Reveal phone"}
            </button>
          )}
          {!host?.email && !host?.phone && <span className="private-contact">Contact hidden</span>}
        </div>
      </div>

      {hasDetails && (
        <details className="ride-details">
          <summary>Details and history</summary>
          <div className="ride-details-body">
            {host?.notes && <p>{host.notes}</p>}
            {hasActivity && (
              <div className="simple-activity">
                {riders.length > 0 && (
                  <span>
                    <strong>{groupMeta.committedLabel}</strong> {riders.map((rider) => rider.name).join(", ")}
                  </span>
                )}
                {inquiries.length > 0 && (
                  <div className="inquiry-list">
                    <strong>{groupMeta.inquiriesLabel}</strong>
                    {inquiries.map((rider) => (
                      <span className="inquiry-item" key={rider.id}>
                        {rider.name}
                        {hostCanMarkInquiries && !footerHostMatch && (
                          <button className="text-button" type="button" onClick={() => onCommit(group.id, rider.id)}>
                            Mark matched
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </details>
      )}

      <div className={`card-actions${canManageStatus ? "" : " no-status-control"}`}>
        {canRecordContact ? (
          <button className="secondary-button" type="button" onClick={() => onInquire(group.id)}>
            <CircleAlert size={15} aria-hidden="true" />
            {groupMeta.inquireLabel}
          </button>
        ) : (
          <span className={`action-status${alreadyRiding ? " is-matched" : ""}`}>
            {(alreadyRiding || alreadyInquired) && <CheckCircle2 size={15} aria-hidden="true" />}
            {contactStatusText}
          </span>
        )}
        {canMarkMatchFromFooter ? (
          <button className="primary-button small" type="button" onClick={() => onCommit(group.id, footerMatchParticipantId)}>
            <CheckCircle2 size={15} aria-hidden="true" />
            {footerHostMatch ? "Mark matched" : groupMeta.commitLabel}
          </button>
        ) : (
          <p className="action-note">{actionGuidance}</p>
        )}
        {canManageStatus && (
          <select
            value={status}
            onChange={(event) => onStatusChange(event.target.value)}
            aria-label={groupMeta.statusLabel}
          >
            <option value="open">Open</option>
            <option value="pending">Pending</option>
            {status === "committed" && (
              <option value="committed" disabled>
                Matched
              </option>
            )}
            <option value="full">Full</option>
          </select>
        )}
      </div>
    </article>
  );
}

function ScorePill({ match }) {
  const category = matchCategory(match.score);
  return <span className={`score-pill score-${category.level}`}>{category.label}</span>;
}

function StatusBadge({ status }) {
  const label = status === "committed" ? "matched" : status;
  return <span className={`status-badge status-${status}`}>{label}</span>;
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
