/** "destinationCountry" -> "Destination Country" — for rendering Lead.details JSON keys generically. */
export function humanizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}
