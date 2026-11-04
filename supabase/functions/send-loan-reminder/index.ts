import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ReminderPayload {
  loanId: string;
  loanName: string;
  lender: string;
  email?: string;
  mobileNumber?: string;
  instalmentNumber: number;
  emiAmount: number;
  dueDate: string;
  reminderDays: number;
  channel: 'email' | 'sms';
}

function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

function buildEmailSubject(loanName: string): string {
  return `Upcoming Loan Payment Reminder — ${loanName} — RupeeFlow`;
}

function buildEmailBody(p: ReminderPayload): string {
  const due = new Date(p.dueDate);
  const today = new Date();
  const daysRemaining = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const daysText = daysRemaining > 0 ? `${daysRemaining} day(s)` : daysRemaining === 0 ? "today" : `${Math.abs(daysRemaining)} day(s) overdue`;

  return `Dear User,

This is a friendly payment reminder from RupeeFlow.

Loan Details:
- Loan Name: ${p.loanName}
- Lender: ${p.lender || "N/A"}
- Instalment Number: #${p.instalmentNumber}
- Scheduled EMI Amount: ${formatINR(p.emiAmount)}
- Payment Due Date: ${p.dueDate}
- Days Remaining: ${daysText}

Please complete your payment through your bank or lender's official channel before the due date to avoid late fees.

Note: RupeeFlow does not directly execute loan payments. This is an automated reminder to help you stay on track with your payment schedule.

— RupeeFlow Banking Intelligence`;
}

function buildSmsMessage(p: ReminderPayload): string {
  const due = new Date(p.dueDate);
  const today = new Date();
  const daysRemaining = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const daysText = daysRemaining > 0 ? `in ${daysRemaining} day(s)` : daysRemaining === 0 ? "today" : `${Math.abs(daysRemaining)} day(s) ago`;
  return `RupeeFlow Reminder: ${p.loanName} EMI ${formatINR(p.emiAmount)} due ${daysText} (${p.dueDate}). Pay via your bank/lender. -RupeeFlow`;
}

async function sendViaResend(apiKey: string, to: string, subject: string, body: string): Promise<{ success: boolean; response: string; statusCode: number; providerMessage: string | null }> {
  const sender = Deno.env.get("RESEND_FROM_ADDRESS") || "RupeeFlow <noreply@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: sender,
      to: [to],
      subject,
      text: body,
    }),
  });
  const responseText = await res.text();
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(responseText); } catch { data = { raw: responseText }; }

  const providerMessage = (typeof data.message === "string" ? data.message : null)
    ?? (typeof data.error === "string" ? data.error : null)
    ?? (typeof data.name === "string" ? data.name : null)
    ?? responseText.slice(0, 300);

  if (!res.ok) {
    return { success: false, response: responseText.slice(0, 1000), statusCode: res.status, providerMessage };
  }
  return { success: true, response: responseText.slice(0, 1000), statusCode: res.status, providerMessage };
}

async function sendViaFast2Sms(apiKey: string, mobileNumber: string, message: string): Promise<{ success: boolean; response: string; statusCode: number; providerMessage: string | null }> {
  const cleanNumber = mobileNumber.replace(/[^0-9]/g, "");
  const res = await fetch("https://www.fast2sms.com/dev/bulkV2", {
    method: "POST",
    headers: {
      "authorization": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      route: "q",
      message: message,
      numbers: cleanNumber,
    }),
  });
  const responseText = await res.text();
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(responseText); } catch { data = { raw: responseText }; }

  const returnVal = data.return;
  const apiMessage = Array.isArray(data.message) ? data.message.join("; ") : (typeof data.message === "string" ? data.message : null);
  const providerMessage = apiMessage ?? (typeof data.error === "string" ? data.error : null) ?? responseText.slice(0, 300);

  if (!res.ok || returnVal === false) {
    return { success: false, response: responseText.slice(0, 1000), statusCode: res.status, providerMessage };
  }
  return { success: true, response: responseText.slice(0, 1000), statusCode: res.status, providerMessage };
}

function validateMobile(num: string): boolean {
  const clean = num.replace(/[^0-9]/g, "");
  return clean.length >= 10 && clean.length <= 13;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const isConfigCheck = url.pathname.endsWith("/check-config") || url.searchParams.get("action") === "check-config";

    if (isConfigCheck || req.method === "GET") {
      const fast2smsKey = Deno.env.get("FAST2SMS_API_KEY");
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      return new Response(
        JSON.stringify({
          sms: fast2smsKey ? "Configured" : "Not Configured",
          email: resendApiKey ? "Configured" : "Not Configured",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const payload: ReminderPayload = await req.json();
    const channel = payload.channel || "email";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    if (channel === "sms") {
      if (!payload.mobileNumber || !payload.loanName || !payload.dueDate) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: mobileNumber, loanName, dueDate" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (!validateMobile(payload.mobileNumber)) {
        return new Response(
          JSON.stringify({ error: "Invalid mobile number. Must be 10-13 digits." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const fast2smsKey = Deno.env.get("FAST2SMS_API_KEY");

      if (!fast2smsKey) {
        await supabase.from("loan_notification_logs").insert({
          loan_id: payload.loanId,
          loan_name: payload.loanName,
          lender: payload.lender,
          mobile_number: payload.mobileNumber,
          instalment_number: payload.instalmentNumber,
          emi_amount: payload.emiAmount,
          due_date: payload.dueDate,
          reminder_days: payload.reminderDays,
          channel: "sms",
          status: "Not Configured",
          provider_response: "No FAST2SMS_API_KEY secret set",
        });

        return new Response(
          JSON.stringify({ status: "Not Configured", message: "SMS delivery not configured. Set FAST2SMS_API_KEY secret in Supabase." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const message = buildSmsMessage(payload);
      const result = await sendViaFast2Sms(fast2smsKey, payload.mobileNumber, message);

      if (result.success) {
        await supabase.from("loan_notification_logs").insert({
          loan_id: payload.loanId,
          loan_name: payload.loanName,
          lender: payload.lender,
          mobile_number: payload.mobileNumber,
          instalment_number: payload.instalmentNumber,
          emi_amount: payload.emiAmount,
          due_date: payload.dueDate,
          reminder_days: payload.reminderDays,
          channel: "sms",
          status: "Sent",
          provider_response: result.response,
          sent_at: new Date().toISOString(),
        });

        return new Response(
          JSON.stringify({ status: "Sent", message: "SMS accepted by Fast2SMS", providerResponse: result.response }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } else {
        const diag = result.providerMessage ?? "Fast2SMS rejected the request with no message";
        await supabase.from("loan_notification_logs").insert({
          loan_id: payload.loanId,
          loan_name: payload.loanName,
          lender: payload.lender,
          mobile_number: payload.mobileNumber,
          instalment_number: payload.instalmentNumber,
          emi_amount: payload.emiAmount,
          due_date: payload.dueDate,
          reminder_days: payload.reminderDays,
          channel: "sms",
          status: "Failed",
          provider_response: result.response,
        });

        return new Response(
          JSON.stringify({ status: "Failed", error: "Fast2SMS rejected the request", message: diag, detail: result.response, httpStatus: result.statusCode }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Email channel (existing logic)
    if (!payload.email || !payload.loanName || !payload.dueDate) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, loanName, dueDate" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(payload.email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      await supabase.from("loan_notification_logs").insert({
        loan_id: payload.loanId,
        loan_name: payload.loanName,
        lender: payload.lender,
        email: payload.email,
        instalment_number: payload.instalmentNumber,
        emi_amount: payload.emiAmount,
        due_date: payload.dueDate,
        reminder_days: payload.reminderDays,
        channel: "email",
        status: "Not Configured",
        provider_response: "No RESEND_API_KEY secret set",
      });

      return new Response(
        JSON.stringify({ status: "Not Configured", message: "Email delivery not configured. Set RESEND_API_KEY secret in Supabase." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const subject = buildEmailSubject(payload.loanName);
    const body = buildEmailBody(payload);
    const result = await sendViaResend(resendApiKey, payload.email, subject, body);

    const isTestRecipient = payload.instalmentNumber === 0;

    if (result.success) {
      await supabase.from("loan_notification_logs").insert({
        loan_id: payload.loanId,
        loan_name: payload.loanName,
        lender: payload.lender,
        email: payload.email,
        instalment_number: payload.instalmentNumber,
        emi_amount: payload.emiAmount,
        due_date: payload.dueDate,
        reminder_days: payload.reminderDays,
        channel: "email",
        status: "Sent",
        provider_response: result.response,
        sent_at: new Date().toISOString(),
      });

      const message = isTestRecipient
        ? `Email accepted by Resend for delivery to ${payload.email}. Note: without a verified sending domain, Resend may only deliver to the account owner's email. Check your Resend dashboard for delivery status.`
        : `Email accepted by Resend for delivery to ${payload.email}`;

      return new Response(
        JSON.stringify({ status: "Sent", message, recipient: payload.email, providerAccepted: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } else {
      const diag = result.providerMessage ?? "Resend rejected the request with no message";
      const isUnverifiedDomain = result.statusCode === 403 || diag.toLowerCase().includes("domain") || diag.toLowerCase().includes("verify") || diag.toLowerCase().includes("not allowed");

      await supabase.from("loan_notification_logs").insert({
        loan_id: payload.loanId,
        loan_name: payload.loanName,
        lender: payload.lender,
        email: payload.email,
        instalment_number: payload.instalmentNumber,
        emi_amount: payload.emiAmount,
        due_date: payload.dueDate,
        reminder_days: payload.reminderDays,
        channel: "email",
        status: "Failed",
        provider_response: result.response,
      });

      const hint = isUnverifiedDomain
        ? " Resend requires a verified sending domain to deliver to arbitrary recipients. Without verification, emails can only be sent to the email address associated with your Resend account. To enable production email delivery, verify your domain in the Resend dashboard (DNS records: SPF, DKIM, DMARC) and set RESEND_FROM_ADDRESS to an address on that domain."
        : "";

      return new Response(
        JSON.stringify({
          status: "Failed",
          error: "Email provider rejected the request",
          message: diag + hint,
          detail: result.response,
          httpStatus: result.statusCode,
          recipient: payload.email,
          requiresDomainVerification: isUnverifiedDomain,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

