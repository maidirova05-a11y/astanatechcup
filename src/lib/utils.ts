import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes so a later utility reliably beats an earlier one. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Month names for the two supported locales.
 *
 * Russian needs the *genitive* form ("15 мая", not "15 май"), which
 * `Intl.DateTimeFormat` with `month: "long"` does not reliably produce on its
 * own across runtimes — so the forms are stated explicitly. Kazakh months are
 * invariant, which makes the table trivial but keeps both locales on one code
 * path.
 */
const MONTHS: Record<string, { nominative: string[]; genitive: string[] }> = {
  ru: {
    nominative: [
      "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
      "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
    ],
    genitive: [
      "января", "февраля", "марта", "апреля", "мая", "июня",
      "июля", "августа", "сентября", "октября", "ноября", "декабря",
    ],
  },
  kk: {
    nominative: [
      "Қаңтар", "Ақпан", "Наурыз", "Сәуір", "Мамыр", "Маусым",
      "Шілде", "Тамыз", "Қыркүйек", "Қазан", "Қараша", "Желтоқсан",
    ],
    genitive: [
      "қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым",
      "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан",
    ],
  },
  // English has no case system, so both columns are identical. Keeping the
  // same shape means one code path formats all three locales.
  en: {
    nominative: [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ],
    genitive: [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ],
  },
};

function monthTable(locale: string) {
  return MONTHS[locale] ?? MONTHS.ru;
}

/** "Май" / "Мамыр" — for standalone use, e.g. "Финал — Август". */
export function monthName(locale: string, monthIndex1Based: number): string {
  return monthTable(locale).nominative[monthIndex1Based - 1] ?? "";
}

/** "мая" / "мамыр" — for use after a day number. */
export function monthGenitive(locale: string, monthIndex1Based: number): string {
  return monthTable(locale).genitive[monthIndex1Based - 1] ?? "";
}

/**
 * "30 апреля 2027" — deliberately not `Intl.DateTimeFormat`, so the rendered
 * string is byte-identical on the server and the client. A mismatch here is a
 * hydration error, and it only appears on machines in another timezone, which
 * is the worst possible way to find out.
 */
export function formatEventDate(date: Date, locale: string, timeZone = "Asia/Almaty"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const day = get("day");
  const month = get("month");
  const year = get("year");

  return `${day} ${monthGenitive(locale, month)} ${year}`;
}

/** Day-of-month in the event timezone, for "15–16 мая". */
export function eventDay(date: Date, timeZone = "Asia/Almaty"): number {
  return Number(
    new Intl.DateTimeFormat("en-CA", { timeZone, day: "numeric" }).format(date),
  );
}

export function eventMonth(date: Date, timeZone = "Asia/Almaty"): number {
  return Number(
    new Intl.DateTimeFormat("en-CA", { timeZone, month: "numeric" }).format(date),
  );
}
