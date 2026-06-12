import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark,
  CalendarClock,
  Car,
  CheckCircle2,
  CircleAlert,
  CircleHelp,
  Filter,
  Mail,
  MapPin,
  Phone,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { hasSupabaseConfig, supabase } from "./supabaseClient";
import {
  adminRemoveParticipantPost,
  adminUpdateGroupStatus,
  commitToRide,
  deleteHostedRidePosts,
  fetchSupabaseBoard,
  requestJoinRide,
  saveRideForLater,
  saveGroupStatus,
  saveParticipantWithGroups,
  sendRideNotification,
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
    id: "woodbridge-springfield",
    label: "Woodbridge / Springfield",
    short: "Wood/Spring",
    region: "VA",
    route: "I-95 / I-395 / Springfield interchange",
    x: 26,
    y: 76,
    tone: "cyan",
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
  "arlington-alexandria": ["fairfax-falls-church", "woodbridge-springfield", "dc-nw", "pg-county"],
  "fairfax-falls-church": ["arlington-alexandria", "woodbridge-springfield", "bethesda-rockville"],
  "woodbridge-springfield": ["arlington-alexandria", "fairfax-falls-church"],
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

function activeSlotIds(availability) {
  return slots.filter((slot) => availability?.[slot.id]).map((slot) => slot.id);
}

function formatSlotIds(slotIds) {
  const slotLabels = slots
    .filter((slot) => slotIds.includes(slot.id))
    .map((slot) => slot.label);
  return slotLabels.length ? slotLabels.join(", ") : "";
}

function formatSlotSummary(slotIds) {
  if (slotIds.length <= 2) return formatSlotIds(slotIds);
  return `${slotIds.length} ${pluralize(slotIds.length, "slot")}`;
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
  const groupSlotIds = activeSlotIds(group.availability);
  const slotOpenSpots = groupSlotIds.map((slotId) => getGroupOpenSpotsForSlot(group, slotId));
  const openSpots = slotOpenSpots.length ? Math.max(...slotOpenSpots) : 0;

  if (group.type === "carpool") {
    const committed = Math.max(
      0,
      ...groupSlotIds.map((slotId) =>
        group.riderIds.filter((riderId) => getMatchedSlotIds(group, riderId).includes(slotId)).length,
      ),
    );
    return {
      committed,
      openSpots,
      used: committed,
      total: group.capacity,
      label: `${committed}/${group.capacity} carpool seats committed by slot`,
      openLabel: `${openSpots} open by slot`,
    };
  }

  if (group.type === "carpool-request") {
    const matchedOffers = Math.max(
      0,
      ...groupSlotIds.map((slotId) =>
        group.riderIds.filter((riderId) => getMatchedSlotIds(group, riderId).includes(slotId)).length,
      ),
    );
    const stillNeeded = openSpots;
    return {
      committed: matchedOffers,
      openSpots: stillNeeded,
      used: matchedOffers,
      total: group.capacity,
      label: `${group.capacity} carpool ${pluralize(group.capacity, "seat")} needed by slot`,
      openLabel: `${stillNeeded} still needed by slot`,
    };
  }

  const committed = Math.max(
    1,
    ...groupSlotIds.map(
      (slotId) => group.riderIds.filter((riderId) => getMatchedSlotIds(group, riderId).includes(slotId)).length + 1,
    ),
  );
  return {
    committed,
    openSpots,
    used: committed,
    total: group.capacity,
    label: `${committed}/${group.capacity} riders in pool by slot`,
    openLabel: `${openSpots} open by slot`,
  };
}

function effectiveStatus(group) {
  const counts = getGroupCounts(group);
  if (group.status === "full") return "full";
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

function getMatchedSlotIds(group, participantId) {
  const storedSlotIds = group.matchedSlotsByParticipant?.[participantId] || [];
  if (storedSlotIds.length) return storedSlotIds;
  return group.riderIds.includes(participantId) ? activeSlotIds(group.availability) : [];
}

function getInquirySlotIds(group, participantId) {
  const storedSlotIds = group.inquirySlotsByParticipant?.[participantId] || [];
  if (storedSlotIds.length) return storedSlotIds;
  return group.inquiries.includes(participantId) ? activeSlotIds(group.availability) : [];
}

function getSavedSlotIds(group, participantId) {
  const storedSlotIds = group.savedSlotsByParticipant?.[participantId] || [];
  if (storedSlotIds.length) return storedSlotIds;
  return group.savedByParticipant?.includes(participantId) ? activeSlotIds(group.availability) : [];
}

function getGroupOpenSpotsForSlot(group, slotId) {
  const matchedCount = group.riderIds.filter((riderId) => getMatchedSlotIds(group, riderId).includes(slotId)).length;
  const organizerCount = group.type === "rideshare" ? 1 : 0;
  return Math.max(group.capacity - matchedCount - organizerCount, 0);
}

function getGroupOpenSlotIds(group) {
  return activeSlotIds(group.availability).filter((slotId) => getGroupOpenSpotsForSlot(group, slotId) > 0);
}

function getSavableSlotIds(group, participant, host, groups) {
  if (!participant || !host) return [];
  const openSlotIds = getGroupOpenSlotIds(group);
  const directMatchedSlotIds = getMatchedSlotIds(group, participant.id);
  const pairMatchedSlotIds = getParticipantPairMatchedSlotIds(participant.id, host.id, groups);
  const pendingSlotIds = getInquirySlotIds(group, participant.id);
  const unavailableSlotIds = new Set([...directMatchedSlotIds, ...pairMatchedSlotIds, ...pendingSlotIds]);
  return openSlotIds.filter((slotId) => !unavailableSlotIds.has(slotId));
}

function getParticipantPairMatchedSlotIds(firstParticipantId, secondParticipantId, groups) {
  const matchedSlotIds = new Set();

  if (!firstParticipantId || !secondParticipantId || firstParticipantId === secondParticipantId) {
    return [];
  }

  groups.forEach((group) => {
    if (group.hostId === firstParticipantId && group.riderIds.includes(secondParticipantId)) {
      getMatchedSlotIds(group, secondParticipantId).forEach((slotId) => matchedSlotIds.add(slotId));
    }

    if (group.hostId === secondParticipantId && group.riderIds.includes(firstParticipantId)) {
      getMatchedSlotIds(group, firstParticipantId).forEach((slotId) => matchedSlotIds.add(slotId));
    }
  });

  return slots.map((slot) => slot.id).filter((slotId) => matchedSlotIds.has(slotId));
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

function getFriendlyAuthErrorMessage(error) {
  const message = error?.message || "Unable to complete sign-in.";
  if (/rate limit/i.test(message)) {
    return "Email send limit reached. Please wait before requesting another code.";
  }
  return message;
}

const stalePostAgeMs = 48 * 60 * 60 * 1000;

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value) {
  const date = parseDate(value);
  if (!date) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getPostUpdatedAt(group, host) {
  const groupUpdatedAt = parseDate(group?.updatedAt);
  const hostUpdatedAt = parseDate(host?.updatedAt);
  if (!groupUpdatedAt) return hostUpdatedAt;
  if (!hostUpdatedAt) return groupUpdatedAt;
  return groupUpdatedAt > hostUpdatedAt ? groupUpdatedAt : hostUpdatedAt;
}

function isStalePost(group, host) {
  const updatedAt = getPostUpdatedAt(group, host);
  if (!updatedAt || effectiveStatus(group) === "full") return false;
  return Date.now() - updatedAt.getTime() >= stalePostAgeMs;
}

function hasNoPostActivity(group) {
  return group.riderIds.length === 0 && group.inquiries.length === 0;
}

function escapeCsvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getRideCardElementId(groupId) {
  return `ride-card-${groupId}`;
}

function buildRideActivity(participant, groups, participants) {
  const participantMap = new Map(participants.map((item) => [item.id, item]));
  const incoming = [];
  const saved = [];
  const outgoing = [];
  const matched = [];

  if (!participant) {
    return { incoming, saved, outgoing, matched };
  }

  groups.forEach((group) => {
    const host = participantMap.get(group.hostId);
    const groupMeta = getGroupTypeMeta(group.type);
    const status = effectiveStatus(group);
    const statusLabel = status === "committed" ? "matched" : status;
    const subtitle = `${groupMeta.title} · ${statusLabel}`;

    if (group.hostId === participant.id) {
      group.inquiries.forEach((inquiryId) => {
        const person = participantMap.get(inquiryId);
        if (!person) return;
        const interestSlotIds = getInquirySlotIds(group, person.id);
        if (!interestSlotIds.length) return;
        incoming.push({
          id: `incoming-${group.id}-${person.id}`,
          groupId: group.id,
          participantId: person.id,
          title: `${person.name} ${group.type === "carpool-request" ? "offered help" : "recorded contact"}`,
          subtitle: `${subtitle}${interestSlotIds.length ? ` · ${formatSlotIds(interestSlotIds)}` : ""}`,
          tag: "Pending",
          canMarkMatch: group.type !== "carpool-request" && status !== "full",
        });
      });

      group.riderIds.forEach((riderId) => {
        const person = participantMap.get(riderId);
        if (!person) return;
        const matchedSlotIds = getMatchedSlotIds(group, person.id);
        matched.push({
          id: `hosted-match-${group.id}-${person.id}`,
          groupId: group.id,
          participantId: person.id,
          title: `Matched with ${person.name}`,
          subtitle: `${groupMeta.title}${matchedSlotIds.length ? ` · ${formatSlotIds(matchedSlotIds)}` : ""}`,
          tag: "Matched",
        });
      });
      return;
    }

    if (
      host &&
      group.inquiries.includes(participant.id)
    ) {
      const interestSlotIds = getInquirySlotIds(group, participant.id);
      if (interestSlotIds.length) {
        outgoing.push({
          id: `outgoing-${group.id}-${participant.id}`,
          groupId: group.id,
          participantId: participant.id,
          title: `You contacted ${host?.name || "Unknown post"}`,
          subtitle: `${groupMeta.title} · ${groupMeta.inquiredLabel} · ${formatSlotIds(interestSlotIds)}`,
          tag: "Pending",
          canMarkMatch: status !== "full" && (group.type === "rideshare" || group.type === "carpool-request"),
        });
      }
    }

    if (host && group.savedByParticipant?.includes(participant.id)) {
      const savableSlotIds = getSavableSlotIds(group, participant, host, groups);
      const savedSlotIds = getSavedSlotIds(group, participant.id).filter((slotId) => savableSlotIds.includes(slotId));

      if (savedSlotIds.length) {
        saved.push({
          id: `saved-${group.id}-${participant.id}`,
          groupId: group.id,
          participantId: participant.id,
          title: `Saved ${host?.name || "Unknown post"}`,
          subtitle: `${groupMeta.title} · ${formatSlotIds(savedSlotIds)}`,
          tag: "Saved",
        });
      }
    }

    if (group.riderIds.includes(participant.id)) {
      const matchedSlotIds = getMatchedSlotIds(group, participant.id);
      matched.push({
        id: `joined-match-${group.id}-${participant.id}`,
        groupId: group.id,
        participantId: participant.id,
        title: `Matched with ${host?.name || "Unknown post"}`,
        subtitle: `${groupMeta.title}${matchedSlotIds.length ? ` · ${formatSlotIds(matchedSlotIds)}` : ""}`,
        tag: "Matched",
      });
    }
  });

  return { incoming, saved, outgoing, matched };
}

function App() {
  const [state, setState] = useState(loadInitialState);
  const [form, setForm] = useState(blankForm);
  const [selectedParticipantId, setSelectedParticipantId] = useState("p2");
  const [corridorFilter, setCorridorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [adminPostFilter, setAdminPostFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState("user");
  const [authEmail, setAuthEmail] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [authCodeSent, setAuthCodeSent] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [appError, setAppError] = useState("");
  const [rideInfoMessage, setRideInfoMessage] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasAdminMfaAccess, setHasAdminMfaAccess] = useState(false);
  const [isPlanEditorOpen, setIsPlanEditorOpen] = useState(false);
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const [adminActivity, setAdminActivity] = useState([]);
  const [highlightedGroupId, setHighlightedGroupId] = useState("");
  const [slotAction, setSlotAction] = useState(null);
  const boardRequestId = useRef(0);

  const { participants, groups } = state;
  const hasAdminAccess = userRole === "admin" && hasAdminMfaAccess;
  const ownParticipant = session
    ? participants.find((participant) => participant.userId === session.user.id)
    : null;
  const selectedParticipant =
    session && !hasAdminAccess
      ? ownParticipant || null
      : participants.find((participant) => participant.id === selectedParticipantId) ||
        ownParticipant ||
        participants[0] ||
        null;

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
        setAdminActivity(board.adminActivity || []);
        setUserRole(board.role);
        if (board.role === "admin") {
          await refreshAdminMfaAccess();
        } else {
          setHasAdminMfaAccess(false);
        }

        const currentOwnParticipant = board.participants.find(
          (participant) => participant.userId === activeSession.user.id,
        );
        if (board.role !== "admin") {
          setSelectedParticipantId(currentOwnParticipant?.id || "");
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
        setAuthCodeSent(false);
        await loadRemoteBoard(data.session);
      }
    }

    hydrateAuth();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        setAuthCodeSent(false);
        loadRemoteBoard(nextSession);
      } else {
        setAuthCodeSent(false);
        setUserRole("user");
        setHasAdminMfaAccess(false);
        setAdminActivity([]);
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
    const normalizedEmail = authEmail.trim().toLowerCase();
    setAppError("");
    setAuthMessage("");
    setAuthCode("");
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      setAppError(getFriendlyAuthErrorMessage(error));
      return;
    }
    setAuthEmail(normalizedEmail);
    setAuthCodeSent(true);
    setAuthMessage("Check your email for a one-time sign-in code.");
  }

  async function verifyLoginCode(event) {
    event.preventDefault();
    if (!supabase) return;
    const normalizedEmail = authEmail.trim().toLowerCase();
    setAppError("");
    const { error } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: authCode.trim(),
      type: "email",
    });
    if (error) {
      setAppError(getFriendlyAuthErrorMessage(error));
      return;
    }
    setAuthEmail(normalizedEmail);
    setAuthCode("");
    setAuthCodeSent(false);
    setAuthMessage("Signed in.");
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setAuthCodeSent(false);
    setAuthMessage("");
  }

  function useSampleMode() {
    setAuthEmail("");
    setAuthCode("");
    setAuthCodeSent(false);
    setAuthMessage("");
    setAppError("");
  }

  function updateAuthEmail(value) {
    setAuthEmail(value);
    setAuthCode("");
    setAuthCodeSent(false);
    setAuthMessage("");
  }

  function editAuthEmail() {
    setAuthCode("");
    setAuthCodeSent(false);
    setAuthMessage("");
  }

  const openInstructions = useCallback(() => {
    setIsInstructionsOpen(true);
  }, []);

  const closeInstructions = useCallback(() => {
    setIsInstructionsOpen(false);
  }, []);

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
        if (hasAdminAccess) {
          await adminUpdateGroupStatus(groupId, patch.status, "Status changed from admin tools.");
        } else {
          await saveGroupStatus(groupId, patch.status);
        }
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

  function openInterestSlotAction(groupId) {
    if (!selectedParticipant) return;
    if (!canUseSelectedParticipantForRideActions) {
      setAppError("Admin preview is view-only for ride actions. Switch to your own ride profile before recording contact.");
      return;
    }
    const group = groups.find((item) => item.id === groupId);
    const host = participants.find((participant) => participant.id === group?.hostId);
    if (!group || !host) return;
    const openSlotIds = getGroupOpenSlotIds(group);
    const directMatchedSlotIds = getMatchedSlotIds(group, selectedParticipant.id);
    const pairMatchedSlotIds = getParticipantPairMatchedSlotIds(selectedParticipant.id, host.id, groups);
    const alreadyMatchedSlotIds = new Set([...directMatchedSlotIds, ...pairMatchedSlotIds]);
    const eligibleSlotIds = openSlotIds.filter(
      (slotId) => !alreadyMatchedSlotIds.has(slotId),
    );
    const currentInterestSlotIds = getInquirySlotIds(group, selectedParticipant.id).filter((slotId) =>
      eligibleSlotIds.includes(slotId),
    );

    if (!openSlotIds.length) {
      setAppError("No open conference slots are available for this post.");
      return;
    }

    if (!eligibleSlotIds.length) {
      setAppError("All open conference slots are already matched with this person.");
      return;
    }

    setSlotAction({
      mode: "interest",
      groupId,
      participantId: selectedParticipant.id,
      title: `Record interest in ${host.name}'s ${getGroupTypeMeta(group.type).title.toLowerCase()}`,
      description: currentInterestSlotIds.length
        ? "Update only the pending conference trip slots you still want to discuss."
        : "Choose only the conference trip slots you actually want to discuss.",
      slotIds: eligibleSlotIds,
      selectedSlotIds: currentInterestSlotIds.length ? currentInterestSlotIds : eligibleSlotIds,
      submitLabel: currentInterestSlotIds.length ? "Update interest" : "Record interest",
    });
  }

  function openSaveSlotAction(groupId) {
    if (!selectedParticipant) return;
    if (!canUseSelectedParticipantForRideActions) {
      setAppError("Admin preview is view-only for ride actions. Switch to your own ride profile before saving a ride.");
      return;
    }
    const group = groups.find((item) => item.id === groupId);
    const host = participants.find((participant) => participant.id === group?.hostId);
    if (!group || !host) return;
    const openSlotIds = getGroupOpenSlotIds(group);
    const eligibleSlotIds = getSavableSlotIds(group, selectedParticipant, host, groups);
    const currentSavedSlotIds = getSavedSlotIds(group, selectedParticipant.id).filter((slotId) =>
      eligibleSlotIds.includes(slotId),
    );

    if (!openSlotIds.length) {
      setAppError("No open conference slots are available for this post.");
      return;
    }

    if (!eligibleSlotIds.length) {
      setAppError("All open conference slots are already pending or matched.");
      return;
    }

    setSlotAction({
      mode: "save",
      groupId,
      participantId: selectedParticipant.id,
      title: currentSavedSlotIds.length
        ? `Update saved slots for ${host.name}`
        : `Save ${host.name}'s ${getGroupTypeMeta(group.type).title.toLowerCase()}`,
      description: currentSavedSlotIds.length
        ? "Change which slots stay in your private saved list. Deselect every slot to remove this save."
        : "Choose the slots you may want to revisit. Saving is private and will not alert the post owner.",
      slotIds: eligibleSlotIds,
      selectedSlotIds: currentSavedSlotIds,
      submitLabel: currentSavedSlotIds.length ? "Update saved slots" : "Save selected slots",
      allowEmptySelection: currentSavedSlotIds.length > 0,
    });
  }

  function openMatchSlotAction(groupId, participantIdToMatch = selectedParticipant?.id) {
    const group = groups.find((item) => item.id === groupId);
    const participantToMatch = participants.find((participant) => participant.id === participantIdToMatch);
    if (!group || !participantToMatch) return;
    const pendingSlotIds = getInquirySlotIds(group, participantIdToMatch).filter(
      (slotId) => getGroupOpenSpotsForSlot(group, slotId) > 0,
    );

    if (!pendingSlotIds.length) {
      setAppError("No pending open conference slots are available to mark as matched.");
      return;
    }

    setSlotAction({
      mode: "match",
      groupId,
      participantId: participantIdToMatch,
      title: `Mark matched with ${participantToMatch.name}`,
      description: "Choose only the slots everyone has agreed to. Other pending slots stay pending.",
      slotIds: pendingSlotIds,
      selectedSlotIds: pendingSlotIds,
      submitLabel: "Mark selected matched",
    });
  }

  function closeSlotAction() {
    setSlotAction(null);
  }

  function toggleSlotActionSelection(slotId) {
    setSlotAction((current) => {
      if (!current) return current;
      const selected = new Set(current.selectedSlotIds);
      if (selected.has(slotId)) {
        selected.delete(slotId);
      } else {
        selected.add(slotId);
      }
      return {
        ...current,
        selectedSlotIds: current.slotIds.filter((candidateSlotId) => selected.has(candidateSlotId)),
      };
    });
  }

  async function submitSlotAction() {
    if (!slotAction) return;
    if (slotAction.mode !== "save" && !slotAction.selectedSlotIds.length) return;
    const action = slotAction;
    if (action.mode === "save") {
      await saveRide(action.groupId, action.selectedSlotIds);
    } else if (action.mode === "interest") {
      await inquire(action.groupId, action.selectedSlotIds);
    } else {
      await commit(action.groupId, action.participantId, action.selectedSlotIds);
    }
    closeSlotAction();
  }

  async function saveRide(groupId, slotIds = []) {
    if (!selectedParticipant) return;
    if (!canUseSelectedParticipantForRideActions) {
      setAppError("Admin preview is view-only for ride actions. Switch to your own ride profile before saving a ride.");
      return;
    }
    const group = groups.find((item) => item.id === groupId);
    if (!group || group.hostId === selectedParticipant.id) return;

    if (session && supabase) {
      setIsSyncing(true);
      setAppError("");
      try {
        await saveRideForLater(groupId, selectedParticipant.id, slotIds);
        await loadRemoteBoard(session);
      } catch (error) {
        setAppError(error.message || "Unable to save this ride.");
      } finally {
        setIsSyncing(false);
      }
      return;
    }

    const savedByParticipant = new Set(group.savedByParticipant || []);
    const nextSavedSlotsByParticipant = {
      ...(group.savedSlotsByParticipant || {}),
    };

    if (slotIds.length) {
      savedByParticipant.add(selectedParticipant.id);
      nextSavedSlotsByParticipant[selectedParticipant.id] = slotIds;
    } else {
      savedByParticipant.delete(selectedParticipant.id);
      delete nextSavedSlotsByParticipant[selectedParticipant.id];
    }

    updateGroup(groupId, {
      savedByParticipant: Array.from(savedByParticipant),
      savedSlotsByParticipant: nextSavedSlotsByParticipant,
    });
  }

  async function inquire(groupId, slotIds = []) {
    if (!selectedParticipant) return;
    if (!canUseSelectedParticipantForRideActions) {
      setAppError("Admin preview is view-only for ride actions. Switch to your own ride profile before recording contact.");
      return;
    }
    const group = groups.find((item) => item.id === groupId);
    if (!group || group.hostId === selectedParticipant.id) return;
    if (!slotIds.length) return;

    if (session && supabase) {
      setIsSyncing(true);
      setAppError("");
      try {
        await requestJoinRide(groupId, selectedParticipant.id, slotIds);
        try {
          await sendRideNotification(groupId, selectedParticipant.id);
        } catch (notificationError) {
          console.warn("Ride notification was not sent.", notificationError);
        }
        const savedSlotIds = getSavedSlotIds(group, selectedParticipant.id);
        const remainingSavedSlotIds = savedSlotIds.filter((slotId) => !slotIds.includes(slotId));
        if (remainingSavedSlotIds.length !== savedSlotIds.length) {
          try {
            await saveRideForLater(groupId, selectedParticipant.id, remainingSavedSlotIds);
          } catch (saveCleanupError) {
            console.warn("Saved ride cleanup was not completed.", saveCleanupError);
          }
        }
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
    const remainingSavedSlotIds = getSavedSlotIds(group, selectedParticipant.id).filter(
      (slotId) => !slotIds.includes(slotId),
    );
    const nextSavedByParticipant = new Set(group.savedByParticipant || []);
    const nextSavedSlotsByParticipant = {
      ...(group.savedSlotsByParticipant || {}),
    };
    if (remainingSavedSlotIds.length) {
      nextSavedSlotsByParticipant[selectedParticipant.id] = remainingSavedSlotIds;
    } else {
      nextSavedByParticipant.delete(selectedParticipant.id);
      delete nextSavedSlotsByParticipant[selectedParticipant.id];
    }
    updateGroup(groupId, {
      inquiries: Array.from(inquiries),
      inquirySlotsByParticipant: {
        ...(group.inquirySlotsByParticipant || {}),
        [selectedParticipant.id]: slotIds,
      },
      savedByParticipant: Array.from(nextSavedByParticipant),
      savedSlotsByParticipant: nextSavedSlotsByParticipant,
      status: group.status === "open" ? "pending" : group.status,
    });
  }

  async function commit(groupId, participantIdToMatch = selectedParticipant?.id, slotIds = []) {
    if (!selectedParticipant) return;
    if (!canUseSelectedParticipantForRideActions) {
      setAppError("Admin preview is view-only for ride actions. Switch to your own ride profile before marking a match.");
      return;
    }
    const group = groups.find((item) => item.id === groupId);
    const participantToMatch = participants.find((participant) => participant.id === participantIdToMatch);
    if (!group || !participantToMatch) return;
    if (!slotIds.length) return;

    const isHost = group.hostId === selectedParticipant.id;
    const isSelfMatch = participantIdToMatch === selectedParticipant.id;
    const hasInquiry = group.inquiries.includes(participantIdToMatch);
    const actorCanMarkMatch =
      (group.type === "carpool" && isHost) ||
      (group.type === "rideshare" && (isHost || isSelfMatch)) ||
      (group.type === "carpool-request" && isSelfMatch);

    if (!hasInquiry || !actorCanMarkMatch) return;

    if (session && supabase) {
      setIsSyncing(true);
      setAppError("");
      try {
        await commitToRide(groupId, participantIdToMatch, slotIds);
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
    const pendingSlotIds = getInquirySlotIds(group, participantIdToMatch);
    const remainingInterestSlotIds = pendingSlotIds.filter((slotId) => !slotIds.includes(slotId));
    const inquiries =
      remainingInterestSlotIds.length > 0
        ? group.inquiries
        : group.inquiries.filter((id) => id !== participantIdToMatch);
    const existingMatchedSlotIds = group.matchedSlotsByParticipant?.[participantIdToMatch] || [];
    const matchedSlotIds = Array.from(new Set([...existingMatchedSlotIds, ...slotIds]));
    const nextInquirySlotsByParticipant = {
      ...(group.inquirySlotsByParticipant || {}),
    };
    if (remainingInterestSlotIds.length > 0) {
      nextInquirySlotsByParticipant[participantIdToMatch] = remainingInterestSlotIds;
    } else {
      delete nextInquirySlotsByParticipant[participantIdToMatch];
    }
    const nextGroup = {
      ...group,
      riderIds: Array.from(riders),
      inquiries,
      inquirySlotsByParticipant: nextInquirySlotsByParticipant,
      matchedSlotsByParticipant: {
        ...(group.matchedSlotsByParticipant || {}),
        [participantIdToMatch]: matchedSlotIds,
      },
    };
    const nextStatus = getGroupCounts(nextGroup).openSpots === 0 ? "full" : "committed";
    updateGroup(groupId, {
      riderIds: nextGroup.riderIds,
      inquiries,
      inquirySlotsByParticipant: nextGroup.inquirySlotsByParticipant,
      matchedSlotsByParticipant: nextGroup.matchedSlotsByParticipant,
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
        const matchesAdminFilter =
          !hasAdminAccess ||
          adminPostFilter === "all" ||
          (adminPostFilter === "stale" && isStalePost(group, host)) ||
          (adminPostFilter === "no-activity" && hasNoPostActivity(group));
        return matchesQuery && matchesCorridor && matchesStatus && matchesAdminFilter;
      })
      .sort((a, b) => {
        if (!selectedParticipant) return 0;
        return (
          scoreGroupForParticipant(b, selectedParticipant).score -
          scoreGroupForParticipant(a, selectedParticipant).score
        );
      });
  }, [adminPostFilter, corridorFilter, groups, hasAdminAccess, participants, query, selectedParticipant, statusFilter]);

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
    const activeHostIds = new Set(groups.map((group) => group.hostId));
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
      participants: activeHostIds.size,
      openGroups: openGroups.length,
      openSeats,
      seekers: seekers.length,
    };
  }, [groups, participants]);

  const adminStats = useMemo(() => {
    return groups.reduce(
      (totals, group) => {
        const host = participants.find((participant) => participant.id === group.hostId);
        if (isStalePost(group, host)) totals.stale += 1;
        if (hasNoPostActivity(group)) totals.noActivity += 1;
        return totals;
      },
      { stale: 0, noActivity: 0 },
    );
  }, [groups, participants]);

  const rideActivity = useMemo(
    () => buildRideActivity(ownParticipant, groups, participants),
    [groups, ownParticipant, participants],
  );

  const canSwitchParticipant = !session || hasAdminAccess;
  const canUseSelectedParticipantForRideActions =
    !session || !hasAdminAccess || Boolean(ownParticipant && selectedParticipant?.id === ownParticipant.id);
  const ownHostedGroups = useMemo(
    () => (ownParticipant ? groups.filter((group) => group.hostId === ownParticipant.id) : []),
    [groups, ownParticipant],
  );
  const hasOwnHostedRidePost = ownHostedGroups.length > 0;
  const planSummaryParticipant = ownParticipant || (!session ? selectedParticipant : null);
  const showPlanEditor =
    isPlanEditorOpen ||
    !planSummaryParticipant ||
    Boolean(session && ownParticipant && !hasOwnHostedRidePost);

  function openPlanEditor() {
    setRideInfoMessage("");
    if (ownParticipant) {
      setForm(participantToForm(ownParticipant));
    } else {
      setForm(blankForm);
    }
    setIsPlanEditorOpen(true);
  }

  async function removeRidePost() {
    if (!session || !supabase || !ownParticipant) return;
    const confirmed = window.confirm(
      "Remove your ride post? Your name and contact details will stay saved so your next post is prefilled.",
    );
    if (!confirmed) return;

    setIsSyncing(true);
    setAppError("");
    setRideInfoMessage("");
    try {
      await deleteHostedRidePosts(ownParticipant.id);
      setForm(participantToForm(ownParticipant));
      setSelectedParticipantId(ownParticipant.id);
      await loadRemoteBoard(session);
      setRideInfoMessage("Your ride post was removed. Your profile details are still saved.");
      setIsPlanEditorOpen(true);
    } catch (error) {
      setAppError(error.message || "Unable to remove your ride post.");
    } finally {
      setIsSyncing(false);
    }
  }

  async function adminRemovePost(participantId) {
    if (!session || !supabase || !hasAdminAccess) return;
    const participant = participants.find((item) => item.id === participantId);
    if (!participant) return;

    const reason = window.prompt(
      `Remove ${participant.name}'s full ride post from the board? Add a short reason for the admin log.`,
      "Stale, duplicate, or invalid post",
    );
    if (reason === null) return;

    setIsSyncing(true);
    setAppError("");
    try {
      await adminRemoveParticipantPost(participantId, reason);
      await loadRemoteBoard(session);
    } catch (error) {
      setAppError(error.message || "Unable to remove post.");
    } finally {
      setIsSyncing(false);
    }
  }

  function exportBoardCsv() {
    const rows = [
      [
        "post_id",
        "group_id",
        "name",
        "email",
        "phone",
        "neighborhood",
        "corridor",
        "ride_type",
        "status",
        "open_spots",
        "inquiries",
        "matched_riders",
        "created_at",
        "updated_at",
        "notes",
      ],
      ...groups.map((group) => {
        const host = participants.find((participant) => participant.id === group.hostId);
        const counts = getGroupCounts(group);
        return [
          host?.id,
          group.id,
          host?.name,
          host?.email,
          host?.phone,
          host?.neighborhood,
          getCorridor(group.corridor).label,
          getGroupTypeMeta(group.type).title,
          effectiveStatus(group),
          counts.openSpots,
          group.inquiries.length,
          group.riderIds.length,
          host?.createdAt,
          getPostUpdatedAt(group, host)?.toISOString(),
          host?.notes,
        ];
      }),
    ];
    const dateSlug = new Date().toISOString().slice(0, 10);
    downloadCsv(`ire-ride-posts-${dateSlug}.csv`, rows);
  }

  function focusRideCard(groupId) {
    setQuery("");
    setCorridorFilter("all");
    setStatusFilter("all");
    setAdminPostFilter("all");
    setHighlightedGroupId(groupId);

    window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        const card = document.getElementById(getRideCardElementId(groupId));
        if (!card) return;
        card.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        card.focus({ preventScroll: true });
      });
    }, 80);

    window.setTimeout(() => {
      setHighlightedGroupId((currentGroupId) => (currentGroupId === groupId ? "" : currentGroupId));
    }, 2200);
  }

  return (
    <div className="app simple-app">
      <header className="simple-hero">
        <div>
          <p className="eyebrow">National Harbor commute board</p>
          <h1>IRE Commuter Ride Connection</h1>
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
        authCodeSent={authCodeSent}
        authEmail={authEmail}
        authMessage={authMessage}
        hasSupabaseConfig={hasSupabaseConfig}
        isSyncing={isSyncing}
        onEditAuthEmail={editAuthEmail}
        onSendCode={sendLoginCode}
        onOpenInstructions={openInstructions}
        onSignOut={signOut}
        onUseSampleMode={useSampleMode}
        onVerifyCode={verifyLoginCode}
        session={session}
        setAuthCode={setAuthCode}
        setAuthEmail={updateAuthEmail}
        hasAdminMfaAccess={hasAdminMfaAccess}
        onAdminMfaVerified={handleAdminMfaVerified}
        userRole={userRole}
      />

      <main className="simple-shell">
        <div className="simple-left-column">
          <section className="simple-panel simple-profile">
            <div className="simple-section-heading">
              <span className="step-badge">1</span>
              <div>
                <p className="eyebrow">Your plan</p>
                <h2>
                  {showPlanEditor
                    ? hasOwnHostedRidePost
                      ? "Update your ride info"
                      : "Add your ride info"
                    : session
                      ? "Your saved ride info"
                      : "Previewed ride plan (sample)"}
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
                submitLabel={hasOwnHostedRidePost ? "Save ride info" : "Post ride info"}
              />
            ) : (
              <PlanSummary
                participant={planSummaryParticipant}
                onEdit={session ? openPlanEditor : null}
                onRemove={session && ownParticipant ? removeRidePost : null}
                isRemoving={isSyncing}
                editLabel={session ? "Edit ride info" : ""}
              />
            )}
          </section>

          {session && ownParticipant && !showPlanEditor && (
            <RideActivityPanel
              activity={rideActivity}
              isSyncing={isSyncing}
              onMarkMatched={openMatchSlotAction}
              onViewGroup={focusRideCard}
            />
          )}
        </div>

        <section className="simple-panel simple-board">
          <div className="simple-board-top">
            <div className="simple-section-heading">
              <span className="step-badge">2</span>
              <div>
                <p className="eyebrow">Connection board</p>
                <h2>{session ? "Likely matches" : "Likely matches (sample)"}</h2>
              </div>
            </div>
          </div>

          {hasAdminAccess && (
            <AdminToolsPanel
              activity={adminActivity}
              adminPostFilter={adminPostFilter}
              adminStats={adminStats}
              filteredCount={filteredGroups.length}
              onExportCsv={exportBoardCsv}
              setAdminPostFilter={setAdminPostFilter}
              totalCount={groups.length}
            />
          )}

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
                  allGroups={groups}
                  group={group}
                  participants={participants}
                  selectedParticipant={selectedParticipant}
                  match={selectedParticipant ? scoreGroupForParticipant(group, selectedParticipant) : null}
                  onInquire={openInterestSlotAction}
                  onSave={openSaveSlotAction}
                  onCommit={openMatchSlotAction}
                  onAdminRemovePost={adminRemovePost}
                  onStatusChange={(status) => updateGroup(group.id, { status })}
                  isAdmin={hasAdminAccess}
                  isSyncing={isSyncing}
                  isHighlighted={highlightedGroupId === group.id}
                  canUseSelectedParticipantForRideActions={canUseSelectedParticipantForRideActions}
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

      {isInstructionsOpen && (
        <InstructionsModal onClose={closeInstructions} />
      )}
      {slotAction && (
        <SlotActionModal
          action={slotAction}
          isSyncing={isSyncing}
          onClose={closeSlotAction}
          onSubmit={submitSlotAction}
          onToggleSlot={toggleSlotActionSelection}
        />
      )}
    </div>
  );
}

function SlotActionModal({ action, isSyncing, onClose, onSubmit, onToggleSlot }) {
  const modalRef = useRef(null);
  const submitButtonRef = useRef(null);
  const previousFocusRef = useRef(null);
  const selectedCount = action.selectedSlotIds.length;
  const actionEyebrow = action.mode === "match" ? "Confirm match" : action.mode === "save" ? "Save ride" : "Record interest";
  const canSubmitEmpty = Boolean(action.allowEmptySelection);
  const submitLabel =
    action.mode === "save" && selectedCount === 0 && canSubmitEmpty
      ? "Remove saved ride"
      : action.submitLabel;

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    submitButtonRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        aria-labelledby="slot-action-title"
        aria-modal="true"
        className="instructions-modal slot-action-modal"
        ref={modalRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="instructions-modal-header">
          <div>
            <p className="eyebrow">{actionEyebrow}</p>
            <h2 id="slot-action-title">{action.title}</h2>
          </div>
          <button aria-label="Close slot chooser" className="icon-button" type="button" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <p className="slot-action-copy">{action.description}</p>

        <div className="slot-action-grid">
          {action.slotIds.map((slotId) => {
            const slot = slots.find((item) => item.id === slotId);
            const checked = action.selectedSlotIds.includes(slotId);
            return (
              <label className="slot-toggle" key={slotId}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleSlot(slotId)}
                />
                <span className="slot-label">
                  <strong>{slot?.label || slotId}</strong>
                  <small>{slot?.direction || "Conference trip"}</small>
                </span>
              </label>
            );
          })}
        </div>

        <div className="slot-action-footer">
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="primary-button"
            disabled={isSyncing || (selectedCount === 0 && !canSubmitEmpty)}
            ref={submitButtonRef}
            type="button"
            onClick={onSubmit}
          >
            <CheckCircle2 size={16} aria-hidden="true" />
            {isSyncing ? "Saving..." : submitLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

function InstructionsModal({ onClose }) {
  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    closeButtonRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !modalRef.current) return;

      const focusableElements = Array.from(
        modalRef.current.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element instanceof HTMLElement && element.offsetParent !== null);

      if (!focusableElements.length) {
        event.preventDefault();
        modalRef.current.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        aria-labelledby="instructions-title"
        aria-modal="true"
        className="instructions-modal"
        ref={modalRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="instructions-modal-header">
          <div>
            <p className="eyebrow">Quick guide</p>
            <h2 id="instructions-title">How to use IRE Commuter Ride Connection</h2>
          </div>
          <button
            aria-label="Close instructions"
            className="icon-button"
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <ol className="instructions-list">
          <li>
            <strong>Add your ride info.</strong>
            <span>
              Enter where you are coming from, when you need rides, and whether you can drive,
              need a seat, or want to split a rideshare.
            </span>
          </li>
          <li>
            <strong>Review likely matches.</strong>
            <span>
              The board highlights people and groups with similar routes, compatible time slots,
              and open seats or shared rideshare interest.
            </span>
          </li>
          <li>
            <strong>Contact people directly.</strong>
            <span>
              Use the email or phone buttons on a card when you are ready to coordinate pickup
              details. Contact details stay hidden until you choose to reveal them.
            </span>
          </li>
          <li>
            <strong>Signal interest before matching.</strong>
            <span>
              Reveal email or phone, then record contact or a help offer. Once everyone agrees, the
              allowed person can mark the match.
            </span>
          </li>
          <li>
            <strong>Keep your post current.</strong>
            <span>
              Update your plan if your schedule changes, your car fills up, or you no longer need
              a ride. Your information is saved with your email address, and you do not need a
              password. Use the one-time code sent to your email when you want to sign back in.
            </span>
          </li>
        </ol>

        <div className="instructions-note">
          <strong>Signed-out preview mode</strong>
          <span>
            If you are not signed in, the app shows sample data so you can see how matching works.
            Sign in with your email code to save real ride information.
          </span>
        </div>
      </section>
    </div>
  );
}

function AuthPanel({
  appError,
  authCode,
  authCodeSent,
  authEmail,
  authMessage,
  hasAdminMfaAccess,
  hasSupabaseConfig,
  isSyncing,
  onAdminMfaVerified,
  onEditAuthEmail,
  onOpenInstructions,
  onSendCode,
  onSignOut,
  onUseSampleMode,
  onVerifyCode,
  session,
  setAuthCode,
  setAuthEmail,
  userRole,
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  function returnToSampleMode() {
    onUseSampleMode();
    setIsExpanded(false);
  }

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
        <button className="secondary-button help-trigger" type="button" onClick={onOpenInstructions}>
          <CircleHelp size={16} aria-hidden="true" />
          How to use this app
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
            ? "Use your email to get a one-time sign-in code. Sign in to create a real profile and see live postings."
            : "Sign in to create a real profile and see live postings. Sample data is shown while signed out."}
        </span>
      </div>
      {!isExpanded && (
        <>
          <div className="auth-center-action">
            <button className="secondary-button" type="button" onClick={() => setIsExpanded(true)}>
              Sign in
            </button>
          </div>
          <div className="auth-help-action">
            <button className="secondary-button help-trigger" type="button" onClick={onOpenInstructions}>
              <CircleHelp size={16} aria-hidden="true" />
              How to use this app
            </button>
          </div>
        </>
      )}
      {isExpanded && (
        <>
          {!authCodeSent ? (
            <form className="auth-form auth-email-form" onSubmit={onSendCode}>
              <label className="field">
                <span>Account email</span>
                <input
                  autoComplete="email"
                  id="account-email"
                  name="email"
                  required
                  type="email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  placeholder="you@example.com"
                />
              </label>
              <button className="primary-button auth-send-button" type="submit">
                Send code
              </button>
            </form>
          ) : (
            <form className="auth-form auth-code-form" onSubmit={onVerifyCode}>
              <label className="field">
                <span>One-time code</span>
                <input
                  autoComplete="one-time-code"
                  id="one-time-code"
                  inputMode="numeric"
                  name="one-time-code"
                  pattern="[0-9]*"
                  required
                  value={authCode}
                  onChange={(event) => setAuthCode(event.target.value)}
                  placeholder="12345678"
                />
              </label>
              <button className="secondary-button auth-verify-button" disabled={!authCode.trim()} type="submit">
                Verify code
              </button>
              <button className="text-button auth-edit-email" type="button" onClick={onEditAuthEmail}>
                Use a different email
              </button>
            </form>
          )}
          <div className="auth-expanded-actions">
            <button className="secondary-button sample-return-button" type="button" onClick={returnToSampleMode}>
              Stay in sample mode
            </button>
            <button className="secondary-button help-trigger" type="button" onClick={onOpenInstructions}>
              <CircleHelp size={16} aria-hidden="true" />
              How to use this app
            </button>
          </div>
        </>
      )}
      {authMessage && <p className="success-text" aria-live="polite">{authMessage}</p>}
      {appError && <p className="error-text" aria-live="assertive">{appError}</p>}
    </section>
  );
}

function AdminToolsPanel({
  activity,
  adminPostFilter,
  adminStats,
  filteredCount,
  onExportCsv,
  setAdminPostFilter,
  totalCount,
}) {
  return (
    <section className="admin-tools" aria-label="Admin tools">
      <div className="admin-tools-header">
        <div>
          <p className="eyebrow">Admin tools</p>
          <h3>Board oversight</h3>
        </div>
        <button className="secondary-button" type="button" onClick={onExportCsv}>
          Export CSV
        </button>
      </div>

      <div className="admin-tool-grid">
        <label className="field">
          <span>Admin filter</span>
          <select value={adminPostFilter} onChange={(event) => setAdminPostFilter(event.target.value)}>
            <option value="all">All posts</option>
            <option value="stale">Stale posts, 48+ hours</option>
            <option value="no-activity">No contact or matches</option>
          </select>
        </label>
        <div className="admin-stat-list" aria-label="Admin board counts">
          <span>
            <strong>{filteredCount}</strong> shown
          </span>
          <span>
            <strong>{totalCount}</strong> total
          </span>
          <span>
            <strong>{adminStats.stale}</strong> stale
          </span>
          <span>
            <strong>{adminStats.noActivity}</strong> no activity
          </span>
        </div>
      </div>

      <details className="admin-activity">
        <summary>Recent admin activity</summary>
        {activity.length ? (
          <ul>
            {activity.slice(0, 8).map((item) => (
              <li key={item.id}>
                <strong>{formatAdminAction(item)}</strong>
                <span>{formatDateTime(item.createdAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No admin actions recorded yet.</p>
        )}
      </details>
    </section>
  );
}

function formatAdminAction(item) {
  const details = item.details || {};
  if (item.action === "remove_post") {
    const name = details.participant?.name || "Unknown post";
    return `Removed ${name}`;
  }
  if (item.action === "update_group_status") {
    const hostName = details.host_name || "Unknown post";
    return `${hostName}: ${details.old_status || "unknown"} to ${details.new_status || "unknown"}`;
  }
  return item.action;
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
      <summary>{isSignedIn ? "Admin preview tools" : "Sample preview tools"}</summary>
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

function PlanSummary({ editLabel, isRemoving = false, onEdit, onRemove, participant }) {
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
      {(onEdit || onRemove) && (
        <div className="plan-summary-actions">
          {onEdit && editLabel && (
            <button className="secondary-button" type="button" onClick={onEdit}>
              {editLabel}
            </button>
          )}
          {onRemove && (
            <button
              className="secondary-button sample-return-button"
              disabled={isRemoving}
              type="button"
              onClick={onRemove}
            >
              <Trash2 size={15} aria-hidden="true" />
              {isRemoving ? "Removing..." : "Remove my post"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function RideActivityPanel({ activity, isSyncing, onMarkMatched, onViewGroup }) {
  const totalCount = activity.saved.length + activity.incoming.length + activity.outgoing.length + activity.matched.length;

  return (
    <section className="simple-panel ride-activity-panel" aria-label="Your ride activity">
      <div className="ride-activity-header">
        <div>
          <p className="eyebrow">Your activity</p>
          <h2>Your ride activity</h2>
          <p>Track saved rides, contacts, and matches without scanning every post.</p>
        </div>
        <span className="activity-count">
          {totalCount} {pluralize(totalCount, "item")}
        </span>
      </div>

      <div className="ride-activity-sections">
        <RideActivitySection
          emptyText="No saved rides yet."
          isSyncing={isSyncing}
          items={activity.saved}
          onMarkMatched={onMarkMatched}
          onViewGroup={onViewGroup}
          title="Saved rides"
        />
        <RideActivitySection
          emptyText="No one has recorded contact with your posts yet."
          isSyncing={isSyncing}
          items={activity.incoming}
          onMarkMatched={onMarkMatched}
          onViewGroup={onViewGroup}
          title="Needs attention"
        />
        <RideActivitySection
          emptyText="No outgoing contact recorded yet."
          isSyncing={isSyncing}
          items={activity.outgoing}
          onMarkMatched={onMarkMatched}
          onViewGroup={onViewGroup}
          title="People you contacted"
        />
        <RideActivitySection
          emptyText="No confirmed matches yet."
          isSyncing={isSyncing}
          items={activity.matched}
          onMarkMatched={onMarkMatched}
          onViewGroup={onViewGroup}
          title="Confirmed matches"
        />
      </div>
    </section>
  );
}

function RideActivitySection({ emptyText, isSyncing, items, onMarkMatched, onViewGroup, title }) {
  return (
    <div className="ride-activity-section">
      <div className="activity-section-heading">
        <h3>{title}</h3>
        <span>{items.length}</span>
      </div>

      {items.length ? (
        <div className="activity-list">
          {items.map((item) => (
            <div className="activity-row" key={item.id}>
              <div className="activity-row-main">
                <strong>{item.title}</strong>
                <span>{item.subtitle}</span>
              </div>
              <span
                className={`activity-tag ${
                  item.tag === "Matched" ? "matched" : item.tag === "Saved" ? "saved" : "pending"
                }`}
              >
                {item.tag}
              </span>
              <div className="activity-actions">
                <button className="text-button" type="button" onClick={() => onViewGroup(item.groupId)}>
                  View
                </button>
                {item.canMarkMatch && (
                  <button
                    className="secondary-button activity-match-button"
                    disabled={isSyncing}
                    type="button"
                    onClick={() => onMarkMatched(item.groupId, item.participantId)}
                  >
                    <CheckCircle2 size={14} aria-hidden="true" />
                    Mark matched
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="activity-empty">{emptyText}</p>
      )}
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
          autoComplete="tel"
          type="tel"
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
      <p className="plan-note">
        Notes are visible to signed-in users on matching ride cards. Keep anything private out of
        this field.
      </p>

      <button className="primary-button" disabled={isSaving} type="submit">
        <Plus size={16} aria-hidden="true" />
        {isSaving ? "Saving..." : submitLabel}
      </button>
      {saveMessage && <p className="success-text form-message">{saveMessage}</p>}
    </form>
  );
}

function RideCard({
  allGroups = [],
  canManageStatus = true,
  canUseSelectedParticipantForRideActions = true,
  group,
  isAdmin = false,
  isHighlighted = false,
  isSyncing = false,
  participants,
  selectedParticipant,
  match,
  onAdminRemovePost,
  onInquire,
  onSave,
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
  const alreadyInquired = selectedParticipant && group.inquiries.includes(selectedParticipant.id);
  const isHost = selectedParticipant && selectedParticipant.id === group.hostId;
  const directMatch = Boolean(selectedParticipant && group.riderIds.includes(selectedParticipant.id));
  const sharedSlotIds = selectedParticipant
    ? overlapSlots(group.availability, selectedParticipant.availability).map((slot) => slot.id)
    : [];
  const groupOpenSlotIds = getGroupOpenSlotIds(group);
  const directMatchedSlotIds = selectedParticipant ? getMatchedSlotIds(group, selectedParticipant.id) : [];
  const pendingSlotIds = selectedParticipant ? getInquirySlotIds(group, selectedParticipant.id) : [];
  const pendingSlotsText = formatSlotIds(pendingSlotIds);
  const pairMatchedSlotIds =
    selectedParticipant && host
      ? getParticipantPairMatchedSlotIds(selectedParticipant.id, host.id, allGroups)
      : [];
  const visibleMatchedSlotIds = sharedSlotIds.filter(
    (slotId) => directMatchedSlotIds.includes(slotId) || pairMatchedSlotIds.includes(slotId),
  );
  const visibleMatchedSlotsText = formatSlotIds(visibleMatchedSlotIds);
  const visibleMatchedSlotsSummary = formatSlotSummary(visibleMatchedSlotIds);
  const hasMatchedSlotContext = visibleMatchedSlotIds.length > 0;
  const showsMatchedState = directMatch || hasMatchedSlotContext;
  const groupSlotIds = activeSlotIds(group.availability);
  const unmatchedInquiries = inquiries.filter((rider) =>
    getInquirySlotIds(group, rider.id).some((slotId) => getGroupOpenSpotsForSlot(group, slotId) > 0),
  );
  const unmatchedSharedSlotIds = sharedSlotIds.filter((slotId) => !visibleMatchedSlotIds.includes(slotId));
  const unmatchedSharedSlotsText = formatSlotIds(unmatchedSharedSlotIds);
  const pendingSlotsSummary = formatSlotSummary(pendingSlotIds);
  const matchedOrPairedSlotIds = new Set([...directMatchedSlotIds, ...pairMatchedSlotIds]);
  const interestEligibleSlotIds = groupOpenSlotIds.filter((slotId) => !matchedOrPairedSlotIds.has(slotId));
  const savableSlotIds = selectedParticipant && host
    ? getSavableSlotIds(group, selectedParticipant, host, allGroups)
    : [];
  const savedSlotIds = selectedParticipant ? getSavedSlotIds(group, selectedParticipant.id) : [];
  const visibleSavedSlotIds = savedSlotIds.filter((slotId) => savableSlotIds.includes(slotId));
  const visibleSavedSlotsText = formatSlotIds(visibleSavedSlotIds);
  const visibleSavedSlotsSummary = formatSlotSummary(visibleSavedSlotIds);
  const hasVisibleSavedSlots = visibleSavedSlotIds.length > 0;
  const matchedStatusText = visibleMatchedSlotsText
    ? `Matched for ${visibleMatchedSlotsSummary}`
    : groupMeta.committedButtonLabel;
  const inquiryMatchedSlotsByParticipant = Object.fromEntries(
    inquiries.map((rider) => [
      rider.id,
      host
        ? getParticipantPairMatchedSlotIds(host.id, rider.id, allGroups).filter((slotId) =>
            groupSlotIds.includes(slotId),
          )
        : [],
    ]),
  );
  const canActOnGroup = selectedParticipant && canParticipantActOnGroup(selectedParticipant, group);
  const isAdminPreviewRideAction = Boolean(selectedParticipant && !canUseSelectedParticipantForRideActions);
  const canStartInterest =
    selectedParticipant &&
    canUseSelectedParticipantForRideActions &&
    !isHost &&
    !alreadyInquired &&
    status !== "full" &&
    savableSlotIds.length > 0;
  const canUpdateInterest =
    selectedParticipant &&
    canUseSelectedParticipantForRideActions &&
    !isHost &&
    alreadyInquired &&
    pendingSlotIds.length > 0 &&
    status !== "full" &&
    interestEligibleSlotIds.length > 0;
  const canInquire = canStartInterest;
  const canManageSavedRide =
    selectedParticipant &&
    canUseSelectedParticipantForRideActions &&
    !isHost &&
    !alreadyInquired &&
    status !== "full" &&
    savableSlotIds.length > 0;
  const hasContactMethod = Boolean(host?.email || host?.phone);
  const hasRevealedContact = revealedContacts.email || revealedContacts.phone;
  const canRecordContact = canInquire && hasRevealedContact;
  const canSelfMarkMatch =
    selectedParticipant &&
    canUseSelectedParticipantForRideActions &&
    !isHost &&
    alreadyInquired &&
    pendingSlotIds.length > 0 &&
    status !== "full" &&
    (group.type === "rideshare" || group.type === "carpool-request");
  const hostCanMarkInquiries =
    isHost &&
    canUseSelectedParticipantForRideActions &&
    canManageStatus &&
    status !== "full" &&
    group.type !== "carpool-request" &&
    unmatchedInquiries.length > 0;
  const footerHostMatch = hostCanMarkInquiries && unmatchedInquiries.length === 1 ? unmatchedInquiries[0] : null;
  const canMarkMatchFromFooter = canSelfMarkMatch || Boolean(footerHostMatch);
  const footerMatchParticipantId = footerHostMatch?.id;
  const hasActivity = riders.length > 0 || inquiries.length > 0;
  const hasDetails = Boolean(host?.notes || hasActivity);
  const hasRideModeMismatch = Boolean(selectedParticipant && !isHost && !canActOnGroup);
  const hasSlotMismatch = Boolean(
    selectedParticipant && !isHost && groupOpenSlotIds.length > 0 && sharedSlotIds.length === 0,
  );
  const showFitWarning = hasRideModeMismatch || hasSlotMismatch;
  let contactStatusText = "Unavailable";
  if (!selectedParticipant) {
    contactStatusText = "Add ride info first";
  } else if (isAdminPreviewRideAction) {
    contactStatusText = "Preview only";
  } else if (pendingSlotIds.length && showsMatchedState) {
    contactStatusText = `Matched: ${visibleMatchedSlotsSummary}; pending: ${pendingSlotsSummary}`;
  } else if (pendingSlotIds.length) {
    contactStatusText = `${groupMeta.inquiredLabel} for ${pendingSlotsSummary}`;
  } else if (showsMatchedState) {
    contactStatusText = matchedStatusText;
  } else if (alreadyInquired || footerHostMatch) {
    contactStatusText = groupMeta.inquiredLabel;
  } else if (isHost) {
    contactStatusText = "Your post";
  } else if (hasVisibleSavedSlots) {
    contactStatusText = `Saved for ${visibleSavedSlotsSummary}`;
  } else if (canInquire) {
    contactStatusText = hasContactMethod ? "Reveal first" : "Contact unavailable";
  } else if (status === "committed") {
    contactStatusText = "Already matched";
  } else if (status === "full") {
    contactStatusText = "Full";
  } else if (!groupOpenSlotIds.length) {
    contactStatusText = "No open slots";
  }

  let actionGuidance = "No action available for this post.";
  if (!selectedParticipant) {
    actionGuidance = "Post your ride info to compare routes and contact matches.";
  } else if (isAdminPreviewRideAction) {
    actionGuidance = "Admin preview is view-only for ride actions.";
  } else if (pendingSlotIds.length && showsMatchedState) {
    actionGuidance = `Matched for ${visibleMatchedSlotsText}. Still pending: ${pendingSlotsText}.`;
  } else if (canMarkMatchFromFooter) {
    actionGuidance = "Choose only the slots everyone has agreed to match.";
  } else if (pendingSlotIds.length && group.type === "carpool") {
    actionGuidance = `Contact noted for ${pendingSlotsText}. The driver can mark agreed slots.`;
  } else if (pendingSlotIds.length) {
    actionGuidance = `Contact noted for ${pendingSlotsText}. Mark agreed slots after everyone confirms.`;
  } else if (showsMatchedState && unmatchedSharedSlotsText) {
    actionGuidance = `Matched for ${visibleMatchedSlotsText}. Coordinate separately for ${unmatchedSharedSlotsText}.`;
  } else if (showsMatchedState) {
    actionGuidance = "This match is recorded.";
  } else if (alreadyInquired && group.type === "carpool") {
    actionGuidance = "Contact noted. The driver can mark the match.";
  } else if (alreadyInquired) {
    actionGuidance = "Contact noted. Mark matched after agreement.";
  } else if (canManageSavedRide && hasRevealedContact && hasVisibleSavedSlots) {
    actionGuidance = "Saved privately. Record contact after you email or call.";
  } else if (canManageSavedRide && hasRevealedContact) {
    actionGuidance = "Save privately, or record contact after you email or call.";
  } else if (canManageSavedRide && hasVisibleSavedSlots) {
    actionGuidance = `Saved for ${visibleSavedSlotsText}. Reveal contact details when you're ready.`;
  } else if (canManageSavedRide) {
    actionGuidance = "Save this privately now, or reveal contact details when you're ready.";
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
  } else if (!groupOpenSlotIds.length) {
    actionGuidance = "No open conference slots are available.";
  }

  return (
    <article
      id={getRideCardElementId(group.id)}
      className={`ride-card status-${status}${isHighlighted ? " is-highlighted" : ""}`}
      tabIndex={-1}
    >
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

      {isAdmin && host && (
        <div className="admin-card-meta">
          <div>
            <span>Owner</span>
            <strong>{host.email || "No email"}</strong>
          </div>
          <div>
            <span>Created</span>
            <strong>{formatDateTime(host.createdAt)}</strong>
          </div>
          <div>
            <span>Updated</span>
            <strong>{formatDateTime(getPostUpdatedAt(group, host)?.toISOString())}</strong>
          </div>
          <div>
            <span>Status</span>
            <strong>{effectiveStatus(group)}</strong>
          </div>
          <button
            className="secondary-button admin-remove-button"
            disabled={isSyncing}
            type="button"
            onClick={() => onAdminRemovePost?.(host.id)}
          >
            <Trash2 size={15} aria-hidden="true" />
            Remove post
          </button>
        </div>
      )}

      {hasDetails && (
        <details className="ride-details">
          <summary>Details and history</summary>
          <div className="ride-details-body">
            {host?.notes && <p>{host.notes}</p>}
            {hasActivity && (
              <div className="simple-activity">
                {riders.length > 0 && (
                  <div className="inquiry-list">
                    <strong>{groupMeta.committedLabel}</strong>
                    {riders.map((rider) => (
                      <span className="inquiry-item" key={rider.id}>
                        {rider.name}
                        <span className="activity-tag matched">
                          {formatSlotIds(getMatchedSlotIds(group, rider.id))}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
                {inquiries.length > 0 && (
                  <div className="inquiry-list">
                    <strong>{groupMeta.inquiriesLabel}</strong>
                    {inquiries.map((rider) => {
                      const riderPendingSlotIds = getInquirySlotIds(group, rider.id);
                      return (
                        <span className="inquiry-item" key={rider.id}>
                          {rider.name}
                          {riderPendingSlotIds.length > 0 && (
                            <span className="activity-tag pending">
                              Pending for {formatSlotIds(riderPendingSlotIds)}
                            </span>
                          )}
                          {inquiryMatchedSlotsByParticipant[rider.id]?.length > 0 && (
                            <span className="activity-tag matched">
                              Matched for {formatSlotIds(inquiryMatchedSlotsByParticipant[rider.id])}
                            </span>
                          )}
                          {hostCanMarkInquiries &&
                            !footerHostMatch &&
                            riderPendingSlotIds.some((slotId) => getGroupOpenSpotsForSlot(group, slotId) > 0) && (
                            <button className="text-button" type="button" onClick={() => onCommit(group.id, rider.id)}>
                              Mark matched
                            </button>
                          )}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </details>
      )}

      {showFitWarning && (
        <div className="fit-warning" role="note">
          <CircleAlert size={16} aria-hidden="true" />
          <div>
            <strong>Not a fit</strong>
            <span>This does not match your current ride plan, but you can still save or contact them.</span>
          </div>
        </div>
      )}

      <div className={`card-actions${canManageStatus ? "" : " no-status-control"}`}>
        {canManageSavedRide ? (
          <button className="secondary-button" type="button" onClick={() => onSave(group.id)}>
            <Bookmark size={15} aria-hidden="true" />
            {hasVisibleSavedSlots ? "Update saved" : "Save"}
          </button>
        ) : canUpdateInterest ? (
          <button className="secondary-button" type="button" onClick={() => onInquire(group.id)}>
            <CircleAlert size={15} aria-hidden="true" />
            Update interest
          </button>
        ) : (
          <span className={`action-status${showsMatchedState ? " is-matched" : hasVisibleSavedSlots ? " is-saved" : ""}`}>
            {(showsMatchedState || alreadyInquired) && <CheckCircle2 size={15} aria-hidden="true" />}
            {hasVisibleSavedSlots && !showsMatchedState && !alreadyInquired && <Bookmark size={15} aria-hidden="true" />}
            {contactStatusText}
          </span>
        )}
        {canRecordContact ? (
          <button className="primary-button small" type="button" onClick={() => onInquire(group.id)}>
            <CircleAlert size={15} aria-hidden="true" />
            {groupMeta.inquireLabel}
          </button>
        ) : canMarkMatchFromFooter ? (
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
        {canRecordContact && (
          <p className="action-note action-note-full">
            Record contact after you email or call. This alerts the post owner.
          </p>
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
