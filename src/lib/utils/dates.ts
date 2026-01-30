export function getLastNDays(n: number) {
  const days: Date[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    days.push(date);
  }
  return days;
}

export function toISODate(value: Date) {
  return value.toISOString().slice(0, 10);
}
