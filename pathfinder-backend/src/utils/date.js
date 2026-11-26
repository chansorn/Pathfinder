// YYYY-MM-DD in Bangkok time (UTC+7) - deadlines are Thai dates
export const bangkokDay = (ms = Date.now()) => new Date(ms + 7 * 3600 * 1000).toISOString().slice(0, 10);

export const addDays = (day, n) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
