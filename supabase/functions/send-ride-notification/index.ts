import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const appUrl = Deno.env.get("RIDE_APP_URL") || "https://ire-ride-connection-app.vercel.app";
const notificationFrom =
  Deno.env.get("RIDE_NOTIFICATION_FROM") ||
  "IRE Commuter Ride Connection <rides@send.aaronmkessler.com>";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function cleanErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error || "Unknown error");
}

function requireString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} is required`);
  }
  return value.trim();
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "Someone";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function groupLabel(type: string) {
  if (type === "carpool") return "driver carpool post";
  if (type === "carpool-request") return "carpool seat request";
  if (type === "rideshare") return "Uber/Lyft split post";
  return "ride post";
}

function buildEmailHtml(requesterName: string, rideType: string) {
  const requesterFirstName = escapeHtml(firstName(requesterName));
  const postLabel = escapeHtml(groupLabel(rideType));
  const safeAppUrl = escapeHtml(appUrl);
  return `
    <h2>Someone marked your ride post as a possible match</h2>
    <p>${requesterFirstName} marked your ${postLabel} as a possible fit in IRE Commuter Ride Connection.</p>
    <p>Sign in to the app to review their post and decide whether to contact them directly by email or phone.</p>
    <p><a href="${safeAppUrl}">Open IRE Commuter Ride Connection</a></p>
    <p style="color: #566575; font-size: 14px;">This message does not mean a ride is confirmed. Please coordinate directly before making plans.</p>
  `;
}

function buildEmailText(requesterName: string, rideType: string) {
  return `${firstName(requesterName)} marked your ${groupLabel(rideType)} as a possible fit in IRE Commuter Ride Connection.

Sign in to the app to review their post and decide whether to contact them directly by email or phone:
${appUrl}

This message does not mean a ride is confirmed. Please coordinate directly before making plans.`;
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse({ error: "Supabase function environment is incomplete" }, 500);
  }

  const authorization = request.headers.get("Authorization") || "";
  const accessToken = authorization.replace(/^Bearer\s+/i, "");
  if (!accessToken) {
    return jsonResponse({ error: "Missing authorization token" }, 401);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    const { groupId, participantId } = await request.json();
    const targetGroupId = requireString(groupId, "groupId");
    const requesterParticipantId = requireString(participantId, "participantId");

    const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
    if (userError || !userData.user) {
      return jsonResponse({ error: "Invalid authorization token" }, 401);
    }

    const { data: requester, error: requesterError } = await adminClient
      .from("participants")
      .select("id,user_id,name,email,neighborhood,corridor")
      .eq("id", requesterParticipantId)
      .single();
    if (requesterError || !requester) {
      return jsonResponse({ error: "Requester participant not found" }, 404);
    }
    if (requester.user_id !== userData.user.id) {
      return jsonResponse({ error: "Only the requester can send this notification" }, 403);
    }

    const { data: group, error: groupError } = await adminClient
      .from("ride_groups")
      .select("id,host_participant_id,type,corridor,status")
      .eq("id", targetGroupId)
      .single();
    if (groupError || !group) {
      return jsonResponse({ error: "Ride group not found" }, 404);
    }

    if (group.host_participant_id === requesterParticipantId) {
      return jsonResponse({ status: "skipped", reason: "self-notification" });
    }

    const { data: inquiry, error: inquiryError } = await adminClient
      .from("ride_inquiries")
      .select("group_id,participant_id")
      .eq("group_id", targetGroupId)
      .eq("participant_id", requesterParticipantId)
      .maybeSingle();
    if (inquiryError) throw inquiryError;
    if (!inquiry) {
      return jsonResponse({ error: "Notification requires an existing inquiry" }, 409);
    }

    const { data: recipient, error: recipientError } = await adminClient
      .from("participants")
      .select("id,user_id,name,email,neighborhood,corridor")
      .eq("id", group.host_participant_id)
      .single();
    if (recipientError || !recipient) {
      return jsonResponse({ error: "Ride post owner not found" }, 404);
    }

    const eventDetails = {
      group: {
        id: group.id,
        type: group.type,
        corridor: group.corridor,
        status: group.status,
      },
      requester: {
        id: requester.id,
        name: requester.name,
        neighborhood: requester.neighborhood,
        corridor: requester.corridor,
      },
      recipient: {
        id: recipient.id,
        name: recipient.name,
        neighborhood: recipient.neighborhood,
        corridor: recipient.corridor,
      },
    };

    let notificationId: string;

    const eventInsert = await adminClient
      .from("ride_notification_events")
      .insert({
        event_type: "ride_inquiry",
        group_id: targetGroupId,
        requester_participant_id: requesterParticipantId,
        recipient_participant_id: recipient.id,
        requester_user_id: requester.user_id,
        recipient_user_id: recipient.user_id,
        recipient_email: recipient.email,
        status: "pending",
        details: eventDetails,
      })
      .select("id,status,provider_message_id")
      .single();

    if (eventInsert.error) {
      if (eventInsert.error.code === "23505") {
        const { data: existingEvent, error: existingError } = await adminClient
          .from("ride_notification_events")
          .select("id,status,provider_message_id")
          .eq("event_type", "ride_inquiry")
          .eq("group_id", targetGroupId)
          .eq("requester_participant_id", requesterParticipantId)
          .eq("recipient_participant_id", recipient.id)
          .single();
        if (existingError) throw existingError;
        if (existingEvent.status !== "failed") {
          return jsonResponse({
            status: "skipped",
            reason: "duplicate",
            notificationId: existingEvent.id,
            priorStatus: existingEvent.status,
            providerMessageId: existingEvent.provider_message_id,
          });
        }

        notificationId = existingEvent.id;
        const { error: retryUpdateError } = await adminClient
          .from("ride_notification_events")
          .update({
            status: "pending",
            recipient_email: recipient.email,
            provider_message_id: null,
            error_message: null,
            details: eventDetails,
          })
          .eq("id", notificationId);
        if (retryUpdateError) throw retryUpdateError;
      } else {
        throw eventInsert.error;
      }
    } else {
      notificationId = eventInsert.data.id;
    }

    if (!recipient.email) {
      await adminClient
        .from("ride_notification_events")
        .update({ status: "skipped", error_message: "Recipient has no email address" })
        .eq("id", notificationId);
      return jsonResponse({ status: "skipped", reason: "missing-recipient-email", notificationId });
    }

    if (!resendApiKey) {
      await adminClient
        .from("ride_notification_events")
        .update({ status: "failed", error_message: "RESEND_API_KEY is not configured" })
        .eq("id", notificationId);
      return jsonResponse({ error: "RESEND_API_KEY is not configured", notificationId }, 500);
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: notificationFrom,
        to: [recipient.email],
        subject: "Someone marked your ride post as a possible match",
        html: buildEmailHtml(requester.name, group.type),
        text: buildEmailText(requester.name, group.type),
      }),
    });

    const resendBody = await resendResponse.json().catch(() => ({}));
    if (!resendResponse.ok) {
      const errorMessage =
        typeof resendBody.message === "string" ? resendBody.message : "Resend send failed";
      await adminClient
        .from("ride_notification_events")
        .update({ status: "failed", error_message: errorMessage })
        .eq("id", notificationId);
      return jsonResponse({ error: errorMessage, notificationId }, 502);
    }

    await adminClient
      .from("ride_notification_events")
      .update({
        status: "sent",
        provider_message_id: typeof resendBody.id === "string" ? resendBody.id : null,
        sent_at: new Date().toISOString(),
      })
      .eq("id", notificationId);

    return jsonResponse({
      status: "sent",
      notificationId,
      providerMessageId: resendBody.id || null,
    });
  } catch (error) {
    return jsonResponse({ error: cleanErrorMessage(error) }, 400);
  }
});
