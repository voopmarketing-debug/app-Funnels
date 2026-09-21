import { prisma } from "@/lib/prisma";
import { getBusinessAnalytics, getActiveContactsThisMonth } from "@/lib/analytics";
import { PLAN_LIMITS, PLAN_LABELS } from "@/lib/plans";
import type { PlanTier } from "@prisma/client";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
// Below this many samples, a week-over-week swing is more likely noise
// (one slow reply, one lucky quick one) than a real trend — matches the
// same instinct as not showing a KPI at all when analytics.ts returns null,
// just applied to the comparison instead of a single value.
const MIN_SAMPLE_SIZE = 5;

type Status = "good" | "warning" | "critical";
const STATUS_RANK: Record<Status, number> = { good: 0, warning: 1, critical: 2 };
const STATUS_LABEL: Record<Status, string> = { good: "bien", warning: "en atención", critical: "en estado crítico" };

// Same thresholds as the compact KPI row on the business page and the full
// analytics page — kept in sync so an alert here always agrees with what
// the dashboard itself would show for the same numbers.
function automationStatus(rate: number | null): Status | null {
  if (rate === null) return null;
  if (rate >= 80) return "good";
  if (rate >= 50) return "warning";
  return "critical";
}

function responseTimeStatus(minutes: number | null): Status | null {
  if (minutes === null) return null;
  if (minutes <= 5) return "good";
  if (minutes <= 30) return "warning";
  return "critical";
}

function formatMinutes(value: number | null): string {
  if (value === null) return "sin datos";
  if (value < 1) return "menos de 1 min";
  return value < 10 ? `${value.toFixed(1)} min` : `${Math.round(value)} min`;
}

function formatPercent(value: number | null): string {
  return value === null ? "sin datos" : `${Math.round(value)}%`;
}

function startOfTodayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function startOfMonthUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Only creates the notification if one of the same type wasn't already logged for this business since `dedupeSince` — guards against re-alerting every single day a condition merely persists (e.g. plan usage staying over 80% all month), and against a re-run (manual trigger, cron retry) creating duplicates. */
async function createAlertOnce(params: {
  businessId: string;
  type: string;
  message: string;
  dedupeSince: Date;
}): Promise<boolean> {
  const existing = await prisma.notification.findFirst({
    where: { businessId: params.businessId, type: params.type, createdAt: { gte: params.dedupeSince } },
    select: { id: true },
  });
  if (existing) return false;

  await prisma.notification.create({
    data: { businessId: params.businessId, type: params.type, message: params.message },
  });
  return true;
}

async function checkAutomationRate(businessId: string, now: Date, weekAgo: Date): Promise<boolean> {
  const [thisWeek, lastWeek] = await Promise.all([
    getBusinessAnalytics(businessId, "7d", now),
    getBusinessAnalytics(businessId, "7d", weekAgo),
  ]);
  if (thisWeek.totalMessages < MIN_SAMPLE_SIZE || lastWeek.totalMessages < MIN_SAMPLE_SIZE) return false;

  const current = automationStatus(thisWeek.automationRate);
  const previous = automationStatus(lastWeek.automationRate);
  if (!current || !previous || current === previous) return false;

  const worse = STATUS_RANK[current] > STATUS_RANK[previous];
  const message = worse
    ? `La automatización de IA bajó de ${STATUS_LABEL[previous]} a ${STATUS_LABEL[current]} esta semana (${formatPercent(thisWeek.automationRate)} de respuestas sin humano, antes ${formatPercent(lastWeek.automationRate)}). Vale la pena revisar las conversaciones recientes.`
    : `Buena noticia: la automatización de IA mejoró de ${STATUS_LABEL[previous]} a ${STATUS_LABEL[current]} esta semana (${formatPercent(thisWeek.automationRate)} de respuestas sin humano, antes ${formatPercent(lastWeek.automationRate)}).`;

  return createAlertOnce({ businessId, type: "AUTOMATION_RATE_ALERT", message, dedupeSince: startOfTodayUtc() });
}

async function checkResponseTime(businessId: string, now: Date, weekAgo: Date): Promise<boolean> {
  const [thisWeek, lastWeek] = await Promise.all([
    getBusinessAnalytics(businessId, "7d", now),
    getBusinessAnalytics(businessId, "7d", weekAgo),
  ]);
  if (thisWeek.responseTime.sampleSize < MIN_SAMPLE_SIZE || lastWeek.responseTime.sampleSize < MIN_SAMPLE_SIZE) {
    return false;
  }

  const current = responseTimeStatus(thisWeek.responseTime.avgMinutes);
  const previous = responseTimeStatus(lastWeek.responseTime.avgMinutes);
  if (!current || !previous || current === previous) return false;

  const worse = STATUS_RANK[current] > STATUS_RANK[previous];
  const message = worse
    ? `El tiempo de respuesta empeoró de ${STATUS_LABEL[previous]} a ${STATUS_LABEL[current]} esta semana (ahora ${formatMinutes(thisWeek.responseTime.avgMinutes)} en promedio, antes ${formatMinutes(lastWeek.responseTime.avgMinutes)}).`
    : `Buena noticia: el tiempo de respuesta mejoró de ${STATUS_LABEL[previous]} a ${STATUS_LABEL[current]} esta semana (ahora ${formatMinutes(thisWeek.responseTime.avgMinutes)} en promedio, antes ${formatMinutes(lastWeek.responseTime.avgMinutes)}).`;

  return createAlertOnce({ businessId, type: "RESPONSE_TIME_ALERT", message, dedupeSince: startOfTodayUtc() });
}

async function checkPlanUsage(businessId: string, planTier: PlanTier): Promise<boolean> {
  const limit = PLAN_LIMITS[planTier];
  if (limit === null) return false; // Scale plan — no cap to warn about.

  const used = await getActiveContactsThisMonth(businessId);
  const ratio = used / limit;

  const dedupeSince = startOfMonthUtc();
  if (ratio >= 1) {
    return createAlertOnce({
      businessId,
      type: "PLAN_USAGE_CRITICAL",
      message: `Superaste el límite de contactos activos de tu plan ${PLAN_LABELS[planTier]} este mes (${used}/${limit}) — el agente puede dejar de responder a contactos nuevos hasta el próximo mes o hasta actualizar de plan.`,
      dedupeSince,
    });
  }
  if (ratio >= 0.8) {
    return createAlertOnce({
      businessId,
      type: "PLAN_USAGE_WARNING",
      message: `Este mes ya usaste el ${Math.round(ratio * 100)}% de tu límite de contactos activos del plan ${PLAN_LABELS[planTier]} (${used}/${limit}).`,
      dedupeSince,
    });
  }
  return false;
}

/**
 * Daily Google-Ads-style health check, one business at a time: automation
 * rate and response time are compared week-over-week and only alert on an
 * actual status change (good/warning/critical), not on every small
 * fluctuation — see STATUS_RANK. Plan usage alerts once it crosses 80% or
 * 100% of the monthly cap. Run from api/cron/metric-alerts (see vercel.json
 * for the schedule) across every business with WhatsApp connected.
 */
export async function runMetricAlerts(): Promise<{ businessesChecked: number; alertsCreated: number }> {
  const businesses = await prisma.business.findMany({
    where: { wabaPhoneNumberId: { not: null } },
    select: { id: true, planTier: true },
  });

  const now = new Date();
  const weekAgo = new Date(now.getTime() - WEEK_MS);

  let alertsCreated = 0;
  for (const business of businesses) {
    const results = await Promise.all([
      checkAutomationRate(business.id, now, weekAgo),
      checkResponseTime(business.id, now, weekAgo),
      checkPlanUsage(business.id, business.planTier),
    ]);
    alertsCreated += results.filter(Boolean).length;
  }

  return { businessesChecked: businesses.length, alertsCreated };
}
