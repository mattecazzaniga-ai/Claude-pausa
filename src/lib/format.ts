export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric" }).format(new Date(date));
}

export function formatRelativeDate(date: string | Date): string {
  const d = new Date(date);
  const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "oggi";
  if (days === 1) return "ieri";
  if (days < 7) return `${days} giorni fa`;
  return formatDate(d);
}
