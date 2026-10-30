/**
 * B41: RFC 5545 (iCalendar) yazımı için küçük yardımcılar. Satırlar CRLF ile biter; 75 bayttan
 * uzun satırlar katlanır (devam satırı tek boşlukla başlar) ve çok baytlı harfler bölünmez.
 */

/** TEXT değerinde `\`, `;`, `,` ve satır sonu kaçışlanır. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

const encoder = new TextEncoder();
const bytes = (s: string) => encoder.encode(s).length;

/** Mantıksal satırı en çok 75 baytlık fiziksel satırlara böler (CRLF + boşluk ile). */
export function foldIcsLine(line: string): string {
  const parts: string[] = [];
  let current = "";
  let limit = 75;
  for (const ch of line) {
    if (bytes(current) + bytes(ch) > limit) {
      parts.push(current);
      current = "";
      limit = 74; // devam satırının başındaki boşluk da sayılır
    }
    current += ch;
  }
  parts.push(current);
  return parts.map((p, i) => (i === 0 ? p : ` ${p}`)).join("\r\n");
}

/** Satır listesinden takvim metni (her satır katlanır, sonda CRLF). */
export function serializeIcs(lines: string[]): string {
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

/** Date → `YYYYMMDDTHHMMSSZ` (UTC; DTSTAMP için). */
export function icsUtcStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
