import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const slotLabels: Record<string, string> = {
  thuAm: "Thu AM",
  thuPm: "Thu PM",
  friAm: "Fri AM",
  friPm: "Fri PM",
  satAm: "Sat AM",
  satPm: "Sat PM",
  sunAm: "Sun AM",
  sunPm: "Sun PM",
};

const corridorLabels: Record<string, string> = {
  "dc-nw": "DC Northwest",
  "dc-ne": "DC Northeast / Capitol Hill",
  "arlington-alexandria": "Arlington / Alexandria",
  "fairfax-falls-church": "Fairfax / Falls Church",
  "silver-spring-takoma": "Silver Spring / Takoma Park",
  "bethesda-rockville": "Bethesda / Rockville",
  "pg-county": "Prince George's County",
};

type NotificationEventType = "inquiry_created" | "match_marked";

type NotificationPayload = {
  eventType: NotificationEventType;
  groupId: string;
  actorParticipantId: string;
  targetParticipantId?: string;
};

type Participant = {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  neighborhood: string;
  corridor: string;
};

type RideGroup = {
  id: string;
  host_participant_id: string;
  type: "carpool" | "carpool-request" | "rideshare";
  corridor: string;
  availability: Record<string, boolean>;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function formatSlots(availability: Record<string, boolean> | null | undefined) {
  const labels = Object.entries(slotLabels)
    .filter(([slotId]) => Boolean(availability?.[slotId]))
    .map(([, label]) => label);

  return labels.length ? labels.join(", ") : "No slots listed";
}

function rideTypeLabel(type: RideGroup["type"]) {
  if (type === "carpool") return "driver carpool";
  if (type === "carpool-request") return "carpool request";
  return "Uber/Lyft split";
}

function inquirySubject(group: RideGroup, actor: Participant) {
  if (group.type === "carpool-request") {
    return `${actor.name} offered help with your carpool request`;
  }

  return `${actor.name} asked about your ${rideTypeLabel(group.type)}`;
}

function matchSubject(group: RideGroup, actor: Participant) {
  return `${actor.name} marked a ride match for ${rideTypeLabel(group.type)}`;
}

function buildMessage({
  eventType,
  group,
  actor,
  recipient,
}: {
  eventType: NotificationEventType;
  group: RideGroup;
  actor: Participant;
  recipient: Participant;
}) {
  const rideType = rideTypeLabel(group.type);
  const corridor = corridorLabels[group.corridor] || group.corridor;
  const tripSlots = formatSlots(group.availability);
  const appUrl = Deno.env.get("APP_PUBLIC_URL") || "";
  const headline =
    eventType === "inquiry_created"
      ? inquirySubject(group, actor)
      : matchSubject(group, actor);
  const actionLine =
    eventType === "inquiry_created"
      ? "Please contact them directly before marking anyone as matched."
      : "This match was marked after an inquiry. You can open the app to review the status.";

  const contactLines = [
    actor.email ? `Email: ${actor.email}` : "",
    actor.phone ? `Phone: ${actor.phone}` : "",
  ].filter(Boolean);

  const text = [
    `Hi ${recipient.name},`,
    "",
    headline,
    "",
    `Ride type: ${rideType}`,
    `Area: ${actor.neighborhood} (${corridor})`,
    `Trip slots: ${tripSlots}`,
    ...contactLines,
    "",
    actionLine,
    appUrl ? `Open the app: ${appUrl}` : "",
  ]
    .filter((line, index, lines) => line || lines[index - 1])
    .join("\n");

  const html = `
    <p>Hi ${recipient.name},</p>
    <p><strong>${headline}</strong></p>
    <ul>
      <li><strong>Ride type:</strong> ${rideType}</li>
      <li><strong>Area:</strong> ${actor.neighborhood} (${corridor})</li>
      <li><strong>Trip slots:</strong> ${tripSlots}</li>
      ${actor.email ? `<li><strong>Email:</strong> <a href="mailto:${actor.email}">${actor.email}</a></li>` : ""}
      ${actor.phone ? `<li><strong>Phone:</strong> ${actor.phone}</li>` : ""}
    </ul>
    <p>${actionLine}</p>
    ${appUrl ? `<p><a href="${appUrl}">Open IRE Ride Connection</a></p>` : ""}
  `;

  return { subject: headline, text, html };
}

async function sendEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("NOTIFICATION_FROM_EMAIL");

  if (!resendApiKey || !from) {
    return { sent: false, reason: "email_provider_not_configured" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend failed with ${response.status}: ${body}`);
  }

  return { sent: true };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: "supabase_env_missing" }, 500);
  }

  if (!authorization) {
    return jsonResponse({ error: "missing_authorization" }, 401);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();

  if (userError || !user) {
    return jsonResponse({ error: "not_authenticated" }, 401);
  }

  const payload = (await request.json()) as Partial<NotificationPayload>;
  if (!payload.eventType || !payload.groupId || !payload.actorParticipantId) {
    return jsonResponse({ error: "missing_required_fields" }, 400);
  }

  const { data: group, error: groupError } = await serviceClient
    .from("ride_groups")
    .select("id, host_participant_id, type, corridor, availability")
    .eq("id", payload.groupId)
    .single<RideGroup>();

  if (groupError || !group) {
    return jsonResponse({ error: "ride_group_not_found" }, 404);
  }

  const participantIds = Array.from(
    new Set([
      group.host_participant_id,
      payload.actorParticipantId,
      payload.targetParticipantId,
    ].filter(Boolean) as string[]),
  );

  const { data: participants, error: participantsError } = await serviceClient
    .from("participants")
    .select("id, user_id, name, email, phone, neighborhood, corridor")
    .in("id", participantIds)
    .returns<Participant[]>();

  if (participantsError || !participants) {
    return jsonResponse({ error: "participants_not_found" }, 404);
  }

  const participantMap = new Map(participants.map((participant) => [participant.id, participant]));
  const actor = participantMap.get(payload.actorParticipantId);
  const host = participantMap.get(group.host_participant_id);
  const target = payload.targetParticipantId ? participantMap.get(payload.targetParticipantId) : undefined;

  if (!actor || !host) {
    return jsonResponse({ error: "notification_participants_missing" }, 404);
  }

  if (actor.user_id !== user.id) {
    return jsonResponse({ error: "actor_not_owned_by_user" }, 403);
  }

  const recipient =
    payload.eventType === "inquiry_created"
      ? host
      : actor.id === host.id
        ? target
        : host;

  if (!recipient) {
    return jsonResponse({ error: "recipient_not_found" }, 404);
  }

  if (recipient.id === actor.id || !recipient.email) {
    return jsonResponse({ sent: false, reason: "no_external_recipient_email" });
  }

  const message = buildMessage({
    eventType: payload.eventType,
    group,
    actor,
    recipient,
  });
  const result = await sendEmail({
    to: recipient.email,
    ...message,
  });

  return jsonResponse(result);
});
