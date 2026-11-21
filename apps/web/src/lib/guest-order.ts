export const guestLookupPath = "/tra-cuu-don-hang";

export function guestOrderPath(number: string, confirmation = false) {
  const query = new URLSearchParams({ don: number });
  if (confirmation) query.set("xac-nhan", "1");
  return `${guestLookupPath}?${query}`;
}

export function normalizeOrderNumber(value: unknown) {
  if (typeof value !== "string") return "";
  const number = value.trim().toUpperCase();
  return /^GH-[A-Z0-9]{8}$/u.test(number) ? number : "";
}
