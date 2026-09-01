const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function currentMonth() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
}

export function currentDate() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function validMonthOrCurrent(value?: string) {
  return value && MONTH_PATTERN.test(value) ? value : currentMonth();
}

export function monthBounds(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const next = monthNumber === 12 ? `${year + 1}-01` : `${year}-${String(monthNumber + 1).padStart(2, "0")}`;
  return { start: `${month}-01`, endExclusive: `${next}-01` };
}

export function defaultDateForMonth(month: string) {
  const today = currentDate();
  if (today.startsWith(month)) return today;
  const [year, monthNumber] = month.split("-").map(Number);
  const currentDay = Number(today.slice(-2));
  const maxDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return `${month}-${String(Math.min(currentDay, maxDay)).padStart(2, "0")}`;
}
