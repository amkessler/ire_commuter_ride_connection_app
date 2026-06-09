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
  Route,
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

function participantToForm(participant) {
  if (!participant) return blankForm;

  return {
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
  };
}

function ridePlanFromForm(formState) {
  if (formState.intent === "offer") return "offer-carpool";
  if (formState.intent === "split-rideshare") return "split-rideshare";
  if (formState.intent === "both") return "open";
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
  } else if (ridePlan === "open") {
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
  const needsCarpoolSeat = ridePlan === "need-carpool" || ridePlan === "open";
  const offersCarpool = ridePlan === "offer-carpool";
  const splitsRideshare = ridePlan === "split-rideshare" || ridePlan === "open";

  return {
    ...formState,
    seatsNeeded: needsCarpoolSeat ? formState.seatsNeeded : 0,
    seatsAvailable: offersCarpool ? formState.seatsAvailable : 0,
    maxPartySize: splitsRideshare || ridePlan === "open" ? formState.maxPartySize : 0,
    transportPreference: ridePlan === "open" ? "either" : needsCarpoolSeat ? "carpool" : formState.transportPreference,
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
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState("user");
  const [authEmail, setAuthEmail] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [appError, setAppError] = useState("");
  const [rideInfoMessage, setRideInfoMessage] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasAdminMfaAccess, setHasAdminMfaAccess] = useState(false);
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

    if (session && supabase) {
      setIsSyncing(true);
      setAppError("");
      try {
        await requestJoinRide(groupId, selectedParticipant.id);
        await loadRemoteBoard(session);
      } catch (error) {
        setAppError(error.message || "Unable to mark inquiry.");
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

  async function commit(groupId) {
    if (!selectedParticipant) return;
    const group = groups.find((item) => item.id === groupId);
    if (!group || group.hostId === selectedParticipant.id) return;

    if (session && supabase) {
      setIsSyncing(true);
      setAppError("");
      try {
        await commitToRide(groupId, selectedParticipant.id);
        await loadRemoteBoard(session);
      } catch (error) {
        setAppError(error.message || "Unable to commit rider.");
      } finally {
        setIsSyncing(false);
      }
      return;
    }

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
                  canManageStatus={!session || hasAdminAccess || group.hostId === ownParticipant?.id}
                />
              ))}
            </div>
          </section>

          <MatchSidebar
            isSignedIn={Boolean(session)}
            participants={participants}
            resetSamples={resetSamples}
            selectedMatches={selectedMatches}
            selectedParticipant={selectedParticipant}
            setSelectedParticipantId={setSelectedParticipantId}
            canUseAdminTools={hasAdminAccess}
          />
        </main>
      )}

      {activeView === "add" && (
        <main className="workspace add-workspace">
          <section className="tool-block form-panel">
            <div className="section-heading">
              <UserPlus size={18} aria-hidden="true" />
              <h2>{ownParticipant ? "Edit your ride info" : "Add your ride info"}</h2>
            </div>
            <EntryForm
              form={form}
              onSubmit={handleSubmit}
              onFieldChange={updateFormField}
              onAvailabilityChange={updateAvailability}
              isSaving={isSyncing}
              saveMessage={rideInfoMessage}
              submitLabel={ownParticipant ? "Save ride info" : "Add to board"}
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
            <PrototypeTools isSignedIn={Boolean(session)} resetSamples={resetSamples} />
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
                    canManageStatus={!session || hasAdminAccess || group.hostId === ownParticipant?.id}
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
            <PrototypeTools isSignedIn={Boolean(session)} resetSamples={resetSamples} />
          </aside>
        </main>
      )}
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
    <section className="auth-panel">
      <div>
        <strong>Sign in to save your ride profile</strong>
        <span>Use your email to get a one-time sign-in code. The sample board remains visible while signed out.</span>
      </div>
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
  canUseAdminTools,
  isSignedIn,
  participants,
  resetSamples,
  selectedMatches,
  selectedParticipant,
  setSelectedParticipantId,
}) {
  const canSwitchParticipant = !isSignedIn || canUseAdminTools;

  return (
    <aside className="side-panel">
      <section className="tool-block">
        <div className="section-heading">
          <Route size={18} aria-hidden="true" />
          <h2>{canSwitchParticipant ? "Match as" : "Your ride profile"}</h2>
        </div>
        {canSwitchParticipant ? (
          <>
            <p className="helper-text">Prototype/admin tool for previewing matches from another participant's view.</p>
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
          </>
        ) : (
          <p className="helper-text">Matches are shown from your signed-in ride profile.</p>
        )}
        {selectedParticipant ? (
          <ParticipantSummary participant={selectedParticipant} />
        ) : (
          <p className="empty-note">Add your ride info to see personalized matches.</p>
        )}
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

      <PrototypeTools isSignedIn={isSignedIn} resetSamples={resetSamples} />
    </aside>
  );
}

function PrototypeTools({ isSignedIn, resetSamples }) {
  return (
    <section className="tool-block">
      <div className="section-heading">
        <RotateCcw size={18} aria-hidden="true" />
        <h2>{isSignedIn ? "Data sync" : "Prototype data"}</h2>
      </div>
      <button className="secondary-button" type="button" onClick={resetSamples}>
        <RotateCcw size={16} aria-hidden="true" />
        {isSignedIn ? "Reload Supabase data" : "Reset sample board"}
      </button>
    </section>
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
  const carpoolSeatsNeededDisabled = ridePlan === "offer-carpool" || ridePlan === "split-rideshare";
  const carpoolSeatsOfferedDisabled = ridePlan === "need-carpool" || ridePlan === "split-rideshare" || ridePlan === "open";
  const rideshareCapDisabled = ridePlan === "need-carpool" || ridePlan === "offer-carpool";

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
          <option value="offer-carpool">I can offer carpool seats</option>
          <option value="split-rideshare">I want to split an Uber/Lyft</option>
          <option value="open">I am open to either carpool or Uber/Lyft</option>
        </select>
      </label>

      <div className="field-grid">
        <label className="field">
          <span>Carpool seats offered</span>
          <input
            disabled={carpoolSeatsOfferedDisabled}
            min="0"
            max="6"
            type="number"
            value={carpoolSeatsOfferedDisabled ? 0 : form.seatsAvailable}
            onChange={(event) => onFieldChange("seatsAvailable", event.target.value)}
          />
        </label>
        <label className="field">
          <span>Carpool seats needed</span>
          <input
            disabled={carpoolSeatsNeededDisabled}
            min="0"
            max="6"
            type="number"
            value={carpoolSeatsNeededDisabled ? 0 : form.seatsNeeded}
            onChange={(event) => onFieldChange("seatsNeeded", event.target.value)}
          />
        </label>
        <label className="field">
          <span>Rideshare party cap</span>
          <input
            disabled={rideshareCapDisabled}
            min="0"
            max="6"
            type="number"
            value={rideshareCapDisabled ? 0 : form.maxPartySize}
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
          {host?.email && (
            <a href={`mailto:${host.email}`}>
              <Mail size={14} aria-hidden="true" />
              Email
            </a>
          )}
          {host?.phone && (
            <a href={`tel:${host.phone}`}>
              <Phone size={14} aria-hidden="true" />
              Phone
            </a>
          )}
          {!host?.email && !host?.phone && <span className="private-contact">Contact hidden</span>}
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
        <select
          value={status}
          onChange={(event) => onStatusChange(event.target.value)}
          aria-label="Ride status"
          disabled={!canManageStatus}
        >
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
