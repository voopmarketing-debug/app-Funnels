// Builds a minimal, standards-compliant iCalendar (.ics) VEVENT — attached
// to booking-confirmation emails (see lib/agendaBooking.ts) so an
// appointment lands directly on the recipient's own calendar app (Google
// Calendar, Outlook, Apple Calendar — any of them read this same format)
// without them ever opening Funnels Labs. UTC timestamps (the "Z" suffix)
// are used throughout instead of a VTIMEZONE block — every calendar app
// converts a UTC time to the viewer's own timezone automatically, and it's
// far simpler than embedding IANA timezone rules by hand.

function escapeIcsText(text: string): string {
  // Per RFC 5545 §3.3.11 — backslash, semicolon and comma are structural
  // characters in ICS text values and must be escaped; newlines become
  // literal "\n" sequences (not real line breaks, which would corrupt the
  // file's own line-folding).
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

export function buildIcsEvent(params: {
  uid: string;
  summary: string;
  description?: string;
  startsAt: Date;
  endsAt: Date;
}): string {
  const now = formatIcsDate(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Funnels Labs//Agenda//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${params.uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${formatIcsDate(params.startsAt)}`,
    `DTEND:${formatIcsDate(params.endsAt)}`,
    `SUMMARY:${escapeIcsText(params.summary)}`,
    ...(params.description ? [`DESCRIPTION:${escapeIcsText(params.description)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}
