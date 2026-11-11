export function addCalendarMonths(start: Date, months: number) {
  const result = new Date(start);
  const day = result.getUTCDate();
  const targetMonth = result.getUTCMonth() + months;
  const year = result.getUTCFullYear() + Math.floor(targetMonth / 12);
  const month = targetMonth % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  result.setUTCDate(1);
  result.setUTCFullYear(year, month, Math.min(day, lastDay));
  return result;
}
