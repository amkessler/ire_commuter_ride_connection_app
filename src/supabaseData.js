import { supabase } from "./supabaseClient";

export function toDbAvailability(availability) {
  return availability || {};
}

export function fromDbParticipant(row) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    email: row.email || "",
    phone: row.phone || "",
    neighborhood: row.neighborhood,
    corridor: row.corridor,
    intent: row.intent,
    transportPreference: row.transport_preference,
    seatsNeeded: row.seats_needed ?? 1,
    seatsAvailable: row.seats_available ?? 0,
    maxPartySize: row.max_party_size ?? 3,
    availability: row.availability || {},
    notes: row.notes || "",
    isDirectoryOnly: !row.email,
  };
}

export function toDbParticipant(participant, userId) {
  return {
    user_id: userId,
    name: participant.name,
    email: participant.email,
    phone: participant.phone || null,
    neighborhood: participant.neighborhood,
    corridor: participant.corridor,
    intent: participant.intent,
    transport_preference: participant.transportPreference,
    seats_needed: Number(participant.seatsNeeded || 0),
    seats_available: Number(participant.seatsAvailable || 0),
    max_party_size: Number(participant.maxPartySize || 3),
    availability: toDbAvailability(participant.availability),
    notes: participant.notes || null,
  };
}

export function fromDbGroup(row, memberships = [], inquiries = []) {
  return {
    id: row.id,
    hostId: row.host_participant_id,
    type: row.type,
    corridor: row.corridor,
    routeFlexibility: row.route_flexibility,
    capacity: row.capacity,
    riderIds: memberships
      .filter((membership) => membership.group_id === row.id)
      .map((membership) => membership.participant_id),
    inquiries: inquiries
      .filter((inquiry) => inquiry.group_id === row.id)
      .map((inquiry) => inquiry.participant_id),
    status: row.status,
    availability: row.availability || {},
  };
}

export function toDbGroup(group, options = {}) {
  const { includeStatus = true } = options;
  const dbGroup = {
    host_participant_id: group.hostId,
    type: group.type,
    corridor: group.corridor,
    route_flexibility: group.routeFlexibility,
    capacity: Number(group.capacity || 1),
    availability: toDbAvailability(group.availability),
  };

  if (includeStatus) {
    dbGroup.status = group.status || "open";
  }

  return dbGroup;
}

export async function fetchSupabaseBoard() {
  if (!supabase) throw new Error("Supabase is not configured.");

  const [directoryResult, ownParticipantsResult, groupsResult, membershipsResult, inquiriesResult, roleResult] =
    await Promise.all([
      supabase.from("participant_directory").select("*").order("created_at", { ascending: true }),
      supabase.from("participants").select("*").order("created_at", { ascending: true }),
      supabase.from("ride_groups").select("*").order("created_at", { ascending: true }),
      supabase.from("ride_memberships").select("*"),
      supabase.from("ride_inquiries").select("*"),
      supabase.rpc("get_my_role"),
    ]);

  const firstError = [
    directoryResult.error,
    ownParticipantsResult.error,
    groupsResult.error,
    membershipsResult.error,
    inquiriesResult.error,
    roleResult.error,
  ].find(Boolean);

  if (firstError) throw firstError;

  const participantMap = new Map();
  directoryResult.data.forEach((row) => {
    participantMap.set(row.id, fromDbParticipant(row));
  });
  ownParticipantsResult.data.forEach((row) => {
    participantMap.set(row.id, fromDbParticipant(row));
  });

  return {
    participants: Array.from(participantMap.values()),
    groups: groupsResult.data.map((row) =>
      fromDbGroup(row, membershipsResult.data, inquiriesResult.data),
    ),
    role: roleResult.data || "user",
  };
}

export async function saveParticipantWithGroups(participant, userId, groupsToCreate) {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data: savedParticipant, error: participantError } = await supabase
    .from("participants")
    .upsert(toDbParticipant(participant, userId), { onConflict: "user_id" })
    .select()
    .single();

  if (participantError) throw participantError;

  const rideGroups = groupsToCreate.map((group) =>
    toDbGroup({
      ...group,
      hostId: savedParticipant.id,
    }, { includeStatus: false }),
  );
  const activeGroupTypes = rideGroups.map((group) => group.type);

  let staleGroupDelete = supabase
    .from("ride_groups")
    .delete()
    .eq("host_participant_id", savedParticipant.id);

  if (activeGroupTypes.length) {
    staleGroupDelete = staleGroupDelete.not("type", "in", `(${activeGroupTypes.join(",")})`);
  }

  const { error: staleGroupError } = await staleGroupDelete;
  if (staleGroupError) throw staleGroupError;

  if (rideGroups.length) {
    const { error: groupError } = await supabase
      .from("ride_groups")
      .upsert(rideGroups, { onConflict: "host_participant_id,type" });
    if (groupError) throw groupError;
  }

  return fromDbParticipant(savedParticipant);
}

export async function saveGroupStatus(groupId, status) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("ride_groups").update({ status }).eq("id", groupId);
  if (error) throw error;
}

export async function requestJoinRide(groupId, participantId) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.rpc("request_join_ride", {
    p_group_id: groupId,
    p_participant_id: participantId,
  });
  if (error) throw error;
}

export async function sendRideNotification({ eventType, groupId, actorParticipantId, targetParticipantId }) {
  if (!supabase) return { sent: false, reason: "supabase_not_configured" };

  const { data, error } = await supabase.functions.invoke("send-ride-notification", {
    body: {
      eventType,
      groupId,
      actorParticipantId,
      targetParticipantId,
    },
  });

  if (error) {
    console.warn("Ride notification was not sent.", error.message);
    return { sent: false, reason: error.message };
  }

  return data;
}

export async function commitToRide(groupId, participantId) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.rpc("commit_to_ride", {
    p_group_id: groupId,
    p_participant_id: participantId,
  });
  if (error) throw error;
}
