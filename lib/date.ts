export function currentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function parseMonthDate(monthYear: string, day: number) {
  return new Date(`${monthYear}-${String(day).padStart(2, "0")}T00:00:00.000Z`);
}
