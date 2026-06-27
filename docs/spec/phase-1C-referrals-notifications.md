# Context Pack: Phase 1C — Referrals + Notifications
Builds: referral creation (auto from pathway engine), referral update,
Africa's Talking SMS, WhatsApp integration, BullMQ notification workers,
notifications log.

Exit criteria: system sends an SMS when a baby is referred and logs the
send attempt.

---
## 7. Notifications module — same pattern as the school system, adapted

Channels: **SMS (Africa's Talking) primary, WhatsApp (Meta Cloud API)
secondary, Email (SMTP) tertiary** — same provider choices as the school
system build, reused for consistency and because they're already proven to
work in this context.

Differences from the school system:
- Every send attempt (not just outcome) is a row in `notifications_log` —
  this is itself a research variable (§4.8), not just an operational log.
- Messages should be sent in escalating frequency as a milestone approaches
  (e.g. at scheduling, 3 days before, day before, day-of-if-missed) per the
  ChatGPT brief — more aggressive cadence than the school system, because
  newborn follow-up windows are shorter and loss-to-follow-up is a named
  outcome you're publishing on.
- WhatsApp templates must still go through Meta's approval process before
  go-live — same caveat as before, plan for a day or two of lead time.

---

## 18. Notification Scheduling — Trigger Table

Every notification series is defined here. Background jobs (BullMQ) read this
table's logic to schedule sends. All sends are rows in `notifications_log`.

### 18.1 Trigger events and series

| Trigger event | Series name | Channels (in order) | Schedule |
|---|---|---|---|
| Screen 1 NOT_PASS saved | `screen2_reminder` | SMS → WhatsApp → Email | D+7, D+12, D+14 (day before window closes), D+15 (if no Screen 2 recorded) |
| Screen 2 NOT_PASS saved (HCP referral created) | `hcp_referral_reminder` | SMS → WhatsApp → Email | D+1, D+7, D+14, D+30 |
| HCP referral CLEARED → rescreen due | `rescreen_reminder` | SMS → WhatsApp | D+1, D+3, D+7 |
| Audiology referral created | `audiology_referral_reminder` | SMS → WhatsApp → Email | D+7, D+30, D+60, D+80 |
| Diagnosis confirmed with hearing loss | `intervention_reminder` | SMS → WhatsApp → Email | D+7, D+30, D+90, D+150 |
| Appointment missed (no-show detected) | `no_show_followup` | SMS → WhatsApp | D+1, D+3, D+7 |
| Parent survey: `delivery_channel_preference` = SMS or WHATSAPP, `status` = PENDING | `parent_survey_request` | The parent's chosen channel only — **no fallback to other channels**, unlike the clinical series above (§4.10.1) | D+0 (at discharge), D+5 (one follow-up only). **Hard stop after 2 attempts** — set `status = NO_RESPONSE`, do not re-enter the series. |

**D = day the trigger event is saved.** Scheduling is relative to `trigger_date`,
not `sent_at`.

### 18.2 Per-send logic

```
For each scheduled send in a series:
  1. Check if the series has been cancelled (pathway advanced past this stage)
  2. If cancelled: drop the send, log as CANCELLED
  3. If not cancelled: attempt primary channel (SMS)
     a. If DELIVERED: log success, stop this send (do not fall through to next channel)
     b. If FAILED or no DELIVERED confirmation within 24h: attempt next channel
     c. Log every attempt regardless of outcome
```

### 18.3 Cancellation rules

A notification series is cancelled when the patient's ear state machine
advances past the stage the series was tracking:

| Series | Cancelled when |
|---|---|
| `screen2_reminder` | Screen 2 result saved for that ear |
| `hcp_referral_reminder` | HCP referral status updated to CLEARED / TREATED / PE_TUBE |
| `rescreen_reminder` | Rescreen result saved for that ear |
| `audiology_referral_reminder` | Diagnostic evaluation saved for that ear |
| `intervention_reminder` | `early_intervention_enrolled = true` saved |
| `no_show_followup` | Next appointment attended (any event saved for that ear) |
| `parent_survey_request` | Survey `status` set to `COMPLETED` (parent responded). **Not cancelled by anything else** — unlike the clinical series, this one only ever ends in `COMPLETED` or the hard-stop `NO_RESPONSE` described in §4.10.1, never a silent cancellation. |

Cancelled sends must still be logged in `notifications_log` with
`delivery_status = CANCELLED` so the loss-to-follow-up paper can distinguish
"we stopped sending because the patient came in" from "we stopped sending
because all attempts failed."

### 18.4 LOST_TO_FOLLOWUP escalation

After all sends in a series are exhausted without a positive outcome:
1. Set patient ear state to `PENDING_LTFU` (§17.2)
2. Add patient to the supervisor's action-needed table (§8.1) with reason
   `NOTIFICATION_SERIES_EXHAUSTED`
3. Do NOT auto-set `LOST_TO_FOLLOWUP` — this requires a deliberate supervisor
   action, not an automatic state change, because a patient may still arrive
   without responding to any notification

---

## 19. Overdue Thresholds (Action-Needed Table)

The dashboard's action-needed table (§8.1) flags patients based on these
computed rules. Each rule should be a named, version-controlled function in
the codebase (not an ad-hoc query) so the exact definition can be cited in
the methods section.

| Flag label | Condition | Urgency |
|---|---|---|
| `Screen 2 overdue` | Ear in `SCREEN_1_FAILED` AND `days since Screen 1 > 18` | High |
| `HCP referral no response` | HCP referral in `PENDING` AND `days since referral > 14` | High |
| `Rescreen overdue after clearance` | Ear in `CLEARED_FOR_RESCREEN` AND `days since clearance > 14` | High |
| `Audiology referral overdue` | Ear in `RESCREEN_FAILED` AND `days since audiology referral > 30` | High |
| `Diagnosis delayed` | Ear in `RESCREEN_FAILED` AND `days since audiology referral > 75` | Critical |
| `Intervention not started` | `DIAGNOSED` with hearing loss AND `days since diagnosis > 90` | Critical |
| `All notifications exhausted` | `PENDING_LTFU` | Critical |

Thresholds above are conservative early-warning points, not the formal JCIH
benchmark cutoffs — they are designed to give the supervisor time to intervene
before a case breaches the 1-3-6 targets. The JCIH cutoff dates (30, 90, 180
days) are computed separately in `pathway_milestones` (§4.7) for the quality
indicator formulas (§8).

---

## 32. Webhook Security

> 🟡 **HIGH** — An unvalidated webhook endpoint is an unauthenticated POST
> endpoint that can inject fabricated delivery statuses.

### 32.1 Meta WhatsApp webhooks

Validate the `X-Hub-Signature-256` header on every incoming webhook:

```javascript
function validateWhatsAppWebhook(req, rawBody) {
  const signature = req.headers['x-hub-signature-256'];
  const expected = 'sha256=' + crypto
    .createHmac('sha256', process.env.META_WHATSAPP_VERIFY_TOKEN)
    .update(rawBody)
    .digest('hex');
  if (signature !== expected) {
    throw new Error('Invalid webhook signature');
  }
}
```

**Critical:** use the raw request body (before JSON parsing) for the HMAC
computation. Parse the body only after signature validation passes.

### 32.2 Africa's Talking delivery callbacks

Africa's Talking publishes the IP ranges their callback servers use. Add these
to an IP allowlist for the `/webhooks/africastalking` endpoint. Requests from
any other IP return HTTP 403 without processing. Check the Africa's Talking
documentation for the current IP list and add it to `APP_CONFIG` as a
version-controlled constant (not a secrets manager value — IP ranges are not
secret, just a configuration).

---

