import { env } from "@/lib/env";
import {
  ENTRY_FEE,
  EVENT,
  EVENT_YEAR,
  QUALIFIER_START,
  QUALIFIER_END,
  REGISTRATION_DEADLINE,
  VENUE,
  DISCIPLINES,
} from "@/config/event";
import { CATEGORIES } from "@/config/categories";
import { routing, LOCALE_LABELS, type Locale } from "@/i18n/routing";

/**
 * /llms.txt — a plain-text summary of the site for AI crawlers and assistants
 * (the llmstxt.org convention: an H1, a blockquote summary, then sections of
 * links with one-line descriptions).
 *
 * Why it exists: an assistant asked "how do I register a team for a robotics
 * championship in Astana" reads this before it reads the HTML, and a landing
 * page that is mostly rendered sections and a scoreboard is a poor source. This
 * is the same information as the structured data, in prose, in one request.
 *
 * Two rules, inherited from `lib/seo/structured-data.ts`:
 *   · every fact comes from `src/config/event.ts` and `categories.ts` — there
 *     is no second copy of a date, a price or a discipline list here to drift;
 *   · nothing unconfirmed is stated. Contact channels are null in the config,
 *     so no contact section appears rather than an empty one.
 *
 * Rendered per request so a change to `EVENT_YEAR` or the deadline is live on
 * the next deploy, and so `APP_URL` is read from the running environment rather
 * than baked in at build time. The proxy skips `.txt` paths, and
 * `src/proxy.ts` also names this one explicitly, so it is never redirected to
 * `/ru/llms.txt`.
 */
export const dynamic = "force-dynamic";

const DISCIPLINE_NAMES: Record<string, string> = {
  robosumo: "RoboSumo (robot sumo, flagship discipline)",
  vex: "VEX Robotics",
  lego: "LEGO robotics",
  arduino: "Arduino",
  drones: "Drones (course racing, precision piloting, autonomous flight)",
  esports: "Esports",
};

const PAGE_NOTES: Record<Locale, { home: string; categories: string; results: string }> = {
  ru: {
    home: "Главная: дисциплины, этапы, призы, регистрация команд, FAQ",
    categories: "Категории и правила: габариты роботов, арены, форматы матчей, подсчёт очков",
    results: "Результаты: турнирные таблицы и протоколы в реальном времени",
  },
  kk: {
    home: "Басты бет: бағыттар, кезеңдер, жүлделер, команда тіркеу, сұрақ-жауап",
    categories: "Санаттар мен ережелер: робот өлшемдері, алаңдар, матч форматтары, ұпай санау",
    results: "Нәтижелер: турнирлік кестелер мен хаттамалар, тікелей",
  },
  en: {
    home: "Home: disciplines, stages, prizes, team registration, FAQ",
    categories: "Categories and rules: robot limits, arenas, match formats, scoring",
    results: "Results: live standings and match sheets",
  },
};

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function ageRange(): string {
  const confirmed = DISCIPLINES.filter((d) => !d.provisional);
  const min = Math.min(...confirmed.map((d) => d.ageMin));
  const max = Math.max(...confirmed.map((d) => d.ageMax));
  return `${min}–${max}`;
}

function build(appUrl: string): string {
  const lines: string[] = [];

  lines.push(`# ${EVENT.name} ${EVENT_YEAR}`);
  lines.push("");
  lines.push(
    `> ${EVENT.name} is the ${ordinal(EVENT.edition)} national (republican) technology ` +
      `championship of Kazakhstan: robotics, drones, programming and esports for school and ` +
      `university students, held ${EVENT.format} in ${VENUE.city} at ${VENUE.name}. ` +
      `Winners of the robotics disciplines qualify for the international RobotChallenge final.`,
  );
  lines.push("");
  lines.push("## Key facts");
  lines.push("");
  lines.push(`- Organiser: ${EVENT.organizer}; co-organiser: ${EVENT.coOrganizer}`);
  lines.push(`- Venue: ${VENUE.name}, ${VENUE.city}, ${VENUE.countryCode}`);
  lines.push(
    `- Republican qualifiers: ${isoDate(QUALIFIER_START)} to ${isoDate(QUALIFIER_END)} (Astana time)`,
  );
  lines.push(`- Team registration closes: ${isoDate(REGISTRATION_DEADLINE)} (end of day, Astana time)`);
  lines.push(
    `- Entry fee: ${ENTRY_FEE.amount} ${ENTRY_FEE.currency} per ${ENTRY_FEE.per}`,
  );
  lines.push(`- Participant ages: ${ageRange()} overall; the exact range and team size depend on the discipline (below)`);
  lines.push(`- Languages: ${routing.locales.map((l) => LOCALE_LABELS[l]).join(", ")}`);
  lines.push("");
  lines.push("## Disciplines (what a team registers into)");
  lines.push("");
  for (const d of DISCIPLINES) {
    const size = d.teamSizeMax === null ? "team size to be confirmed" : `up to ${d.teamSizeMax} per team`;
    const ages = d.provisional ? "ages to be confirmed" : `ages ${d.ageMin}–${d.ageMax}`;
    lines.push(`- ${DISCIPLINE_NAMES[d.id] ?? d.id}: ${ages}, ${size}`);
  }
  lines.push("");
  lines.push("## Competition categories (RobotChallenge rulebooks)");
  lines.push("");
  for (const c of CATEGORIES) {
    const classes = c.classes.map((cls) => `${cls.label} (${cls.code})`).join(", ");
    lines.push(`- ${appUrl}/${routing.defaultLocale}/categories#${c.id}: ${classes}`);
  }
  lines.push("");

  for (const locale of routing.locales) {
    const notes = PAGE_NOTES[locale];
    lines.push(`## ${LOCALE_LABELS[locale]} (${locale})`);
    lines.push("");
    lines.push(`- [${notes.home}](${appUrl}/${locale})`);
    lines.push(`- [${notes.categories}](${appUrl}/${locale}/categories)`);
    lines.push(`- [${notes.results}](${appUrl}/${locale}/results)`);
    lines.push("");
  }

  lines.push("## Machine-readable");
  lines.push("");
  lines.push(`- [Sitemap](${appUrl}/sitemap.xml)`);
  lines.push(`- [robots.txt](${appUrl}/robots.txt)`);
  lines.push("");
  lines.push("## Not for indexing");
  lines.push("");
  lines.push(
    "- /admin, /judge, /coach and /api are operator tools and endpoints; " +
      "/{locale}/payment/* pages carry an application reference and are excluded in robots.txt.",
  );
  lines.push("");

  return lines.join("\n");
}

/** 1 → "1st", 2 → "2nd", 3 → "3rd", 4 → "4th" … 11–13 → "th". */
function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th";
  return `${n}${suffix}`;
}

export async function GET(): Promise<Response> {
  return new Response(build(env.APP_URL), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // Public, cacheable for an hour: the content changes with a deploy, not
      // with a request, and this is the one path on the site crawlers may hit
      // in bursts. `s-maxage` lets a shared cache (Vercel's CDN, which purges
      // on every deploy; Cloudflare in front of Docker) answer those bursts
      // instead of the function — `max-age` alone only covers the browser.
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
