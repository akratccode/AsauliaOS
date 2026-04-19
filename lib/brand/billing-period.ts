import 'server-only';

export type BillingPeriodWindow = {
  start: Date;
  end: Date;
  label: string;
  daysLeft: number;
  totalDays: number;
};

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatDayMonth(d: Date): string {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function resolveBillingWindow(
  billingCycleDay: number | null,
  now: Date = new Date(),
): BillingPeriodWindow {
  const day = billingCycleDay && billingCycleDay >= 1 && billingCycleDay <= 28 ? billingCycleDay : 1;
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const today = now.getUTCDate();
  const startMonth = today >= day ? month : month - 1;
  const start = new Date(Date.UTC(year, startMonth, day));
  const end = new Date(Date.UTC(year, startMonth + 1, day));
  const msPerDay = 24 * 60 * 60 * 1000;
  const totalDays = Math.round((end.getTime() - start.getTime()) / msPerDay);
  const daysLeft = Math.max(
    0,
    Math.ceil((end.getTime() - now.getTime()) / msPerDay),
  );
  const label = `${formatDayMonth(start)} – ${formatDayMonth(new Date(end.getTime() - msPerDay))}`;
  return { start, end, label, daysLeft, totalDays };
}

export function periodYmd(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function nextBillingCycleStart(
  billingCycleDay: number | null,
  now: Date = new Date(),
): Date {
  const window = resolveBillingWindow(billingCycleDay, now);
  return window.end;
}
