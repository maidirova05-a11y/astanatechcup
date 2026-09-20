#!/usr/bin/env node
/**
 * check:seo — проверка того, что увидит краулер.
 *
 * Смотрит ГОТОВУЮ выдачу, а не исходники: поднятый сайт, страница за страницей. Ловит то, что глазами не
 * видно и что ломает индексацию молча:
 *
 *   · пропавший или чужой canonical, утёкший в разметку localhost;
 *   · noindex там, где его быть не должно, и его отсутствие там, где должен;
 *   · <html lang> не по BCP-47;
 *   · JSON-LD, который не парсится, дублирующиеся @id, два WebPage на странице;
 *   · вопросы FAQ, которых нет в видимом тексте — за такую разметку Google
 *     снимает расширенные сниппеты, и заметить это иначе почти нельзя;
 *   · адреса в sitemap, которым ничего не соответствует.
 *
 * Скрипт самодостаточный: ни общих пакетов, ни зависимостей между
 * репозиториями. Копия живёт в каждом проекте и настроена под него — список
 * страниц и ожидания лежат сразу под этим комментарием.
 */

/* ── НАСТРОЙКИ ─────────────────────────────────────────────────────────── */

const PROJECT = 'astanatechcup';
const HOST = 'astanatechcup.kz';
const DEFAULT_BASE = 'http://localhost:3000';
const START_HINT = 'npm run build && npm start';

/** [путь, ожидания]. `indexable: false` — страница обязана нести noindex.
 *  Юридические страницы такие намеренно: шаблонный текст способен
 *  перебивать в выдаче настоящий контент. */
const PAGES = [
  ['/ru',                    { indexable: true,  lang: 'ru-KZ' }],
  ['/kk',                    { indexable: true,  lang: 'kk-KZ' }],
  ['/en',                    { indexable: true,  lang: 'en'    }],
  ['/ru/categories',         { indexable: true,  lang: 'ru-KZ' }],
  ['/ru/results',            { indexable: true,  lang: 'ru-KZ' }],
  ['/ru/results/sumo',       { indexable: true,  lang: 'ru-KZ' }],
  ['/ru/privacy',            { indexable: false, lang: 'ru-KZ' }],
  ['/ru/terms',              { indexable: false, lang: 'ru-KZ' }],
];
/* ─────────────────────────────────────────────────────────────────────────
 * Общая часть проверки. Ниже, под ── НАСТРОЙКИ ──, лежит всё, что отличает
 * этот проект от остальных.
 * ───────────────────────────────────────────────────────────────────────── */

const RED = '\x1b[31m', GREEN = '\x1b[32m', YELLOW = '\x1b[33m', DIM = '\x1b[2m', OFF = '\x1b[0m';

/** Полное декодирование сущностей, включая числовые.
 *
 * Без `&#x27;` английские вопросы «не находились» в тексте, которым они на
 * самом деле являются. Ложная тревога здесь опаснее пропуска: по ней чинят
 * то, что не сломано. */
function decodeEntities(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&laquo;/g, '«').replace(/&raquo;/g, '»')
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function visibleText(html) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  ).replace(/\s+/g, ' ');
}

export function checkPage(html, { url, host, indexable = true, lang = null }) {
  const problems = [];
  const notes = [];
  const pick = (re) => (html.match(re) || [])[1] ?? null;

  const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = pick(/<meta\s+name="description"\s+content="([^"]*)"/i);
  const canonical = pick(/<link\s+rel="canonical"\s+href="([^"]*)"/i);
  const robots = pick(/<meta\s+name="robots"\s+content="([^"]*)"/i);
  const htmlLang = pick(/<html[^>]*\slang="([^"]*)"/i);

  if (!title || !title.trim()) problems.push('нет <title>');
  if (!description || !description.trim()) problems.push('нет meta description');
  else if (description.length > 320) notes.push(`description ${description.length} симв. — выдача обрежет`);

  if (!canonical) problems.push('нет canonical');
  else {
    if (!canonical.startsWith('https://')) problems.push(`canonical не https: ${canonical}`);
    let canonicalHost = null;
    try { canonicalHost = new URL(canonical).host; } catch { /* разберётся ниже */ }
    if (canonicalHost !== host) problems.push(`canonical на чужом хосте: ${canonicalHost} (ждали ${host})`);
  }

  /* Самое опасное, что может утечь в прод-разметку. Канонические адреса,
   * sitemap и robots.txt собираются из одного origin, и localhost в нём
   * означает, что сайт рассказывает поисковику про машину посетителя. */
  const leak = html.match(/https?:\/\/(?:localhost|127\.0\.0\.1)[^"'<\s]*/);
  if (leak) problems.push(`localhost в разметке: ${leak[0]}`);

  if (indexable && robots && /noindex/i.test(robots)) problems.push(`noindex на индексируемой странице: ${robots}`);
  if (!indexable && !(robots && /noindex/i.test(robots))) problems.push('нужен noindex, а его нет');

  if (lang && htmlLang !== lang) problems.push(`<html lang>=${htmlLang}, ждали ${lang}`);
  if (htmlLang === 'kz') problems.push('<html lang="kz"> — не код BCP-47, у казахского это kk');

  /* ── schema.org ── */
  const blocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  // Разметку требуем только с индексируемых страниц: описывать сущность,
  // которую сам же просишь не индексировать, незачем.
  if (indexable && blocks.length === 0) problems.push('нет JSON-LD');

  const nodes = [];
  for (const [, raw] of blocks) {
    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/<\\\//g, '</').replace(/\\u003c/gi, '<'));
    } catch (error) {
      problems.push(`JSON-LD не парсится: ${String(error.message).slice(0, 70)}`);
      continue;
    }
    nodes.push(...(parsed['@graph'] ?? [parsed]));
  }

  const typeOf = (node) => [].concat(node['@type'] ?? []).join('+');

  const ids = nodes.map((n) => n['@id']).filter(Boolean);
  const duplicates = [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))];
  if (duplicates.length) problems.push(`дублирующиеся @id: ${duplicates.join(', ')}`);

  const webPages = nodes.filter((n) => typeOf(n) === 'WebPage');
  if (webPages.length > 1) problems.push(`${webPages.length} узлов WebPage на одной странице`);
  for (const page of webPages) {
    if (page.url && page.url.replace(/\/$/, '') !== url.replace(/\/$/, '')) {
      problems.push(`WebPage.url=${page.url} не совпадает с адресом страницы`);
    }
  }

  /* Разметка FAQ действительна только пока те же вопросы видны на странице.
   * Google расхождение игнорирует в лучшем случае, в худшем снимает
   * расширенные сниппеты со всего домена. */
  const faq = nodes.find((n) => typeOf(n) === 'FAQPage');
  if (faq) {
    const text = visibleText(html);
    const missing = faq.mainEntity.filter((q) => !text.includes(q.name.replace(/\s+/g, ' ')));
    if (missing.length) {
      problems.push(`${missing.length} из ${faq.mainEntity.length} вопросов FAQ нет в видимом тексте`);
      missing.slice(0, 2).forEach((q) => problems.push(`    · ${q.name.slice(0, 70)}`));
    }
  }

  const verification = (html.match(/<meta\s+name="(?:google-site-verification|yandex-verification)"/gi) || []).length;

  return {
    problems,
    notes,
    verification,
    types: [...new Set(nodes.map(typeOf))],
    faq: faq ? faq.mainEntity.length : 0,
  };
}

export function report(label, result) {
  if (result.problems.length) {
    console.log(`  ${RED}✗${OFF} ${label}`);
    result.problems.forEach((p) => console.log(`      ${RED}${p}${OFF}`));
  } else {
    const extra = [
      result.types.join(', '),
      result.faq ? `FAQ ${result.faq}` : null,
      result.verification ? `verification ${result.verification}` : null,
    ].filter(Boolean).join(', ');
    console.log(`  ${GREEN}✓${OFF} ${label.padEnd(30)} ${DIM}${extra}${OFF}`);
  }
  result.notes.forEach((n) => console.log(`      ${YELLOW}! ${n}${OFF}`));
  return result.problems.length;
}

export const colours = { RED, GREEN, YELLOW, DIM, OFF };

/* ── запуск: проверяем отданный сервером HTML ──────────────────────────────
 *
 * Страницы здесь рендерятся под запрос, поэтому проверять нечего, пока сайт
 * не запущен. Адрес можно передать аргументом:
 *     npm run check:seo -- https://ПРОД-ДОМЕН
 * ───────────────────────────────────────────────────────────────────────── */

const base = (process.argv[2] ?? DEFAULT_BASE).replace(/\/+$/, '');

async function get(path) {
  const response = await fetch(base + path, { redirect: 'follow' });
  return { status: response.status, html: await response.text() };
}

let failures = 0;

console.log(`${colours.DIM}${PROJECT} — проверка выдачи на ${base}${colours.OFF}`);

try {
  await fetch(base, { method: 'HEAD' });
} catch {
  console.error(
    `\n${colours.RED}Не достучаться до ${base}.${colours.OFF}\n` +
    `Запустите сайт и повторите:  ${START_HINT}\n` +
    `Или укажите другой адрес:    npm run check:seo -- https://ПРОД-ДОМЕН\n`,
  );
  process.exit(2);
}

for (const [path, options] of PAGES) {
  const { status, html } = await get(path);
  const result = checkPage(html, { url: `https://${HOST}${path}`, host: HOST, ...options });
  if (status !== 200) result.problems.unshift(`HTTP ${status}`);
  failures += report(path, result);
}

/* Каждый адрес из sitemap обязан отдавать 200. */
const sitemap = await get('/sitemap.xml');
if (sitemap.status !== 200) {
  console.log(`  ${colours.RED}✗ sitemap.xml — HTTP ${sitemap.status}${colours.OFF}`);
  failures += 1;
} else {
  const locs = [...sitemap.html.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const broken = [];
  for (const loc of locs) {
    if (!loc.startsWith(`https://${HOST}`)) { broken.push(`${loc} — чужой домен`); continue; }
    const path = loc.slice(`https://${HOST}`.length) || '/';
    const { status } = await get(path);
    if (status !== 200) broken.push(`${path} → HTTP ${status}`);
  }
  if (broken.length) {
    console.log(`  ${colours.RED}✗ sitemap${colours.OFF}`);
    broken.forEach((b) => console.log(`      ${colours.RED}${b}${colours.OFF}`));
    failures += broken.length;
  } else {
    console.log(`  ${colours.GREEN}✓${colours.OFF} ${'sitemap'.padEnd(30)} ${colours.DIM}${locs.length} адресов, все отдают 200${colours.OFF}`);
  }
}

console.log(failures
  ? `\n${colours.RED}check:seo — проблем: ${failures}${colours.OFF}`
  : `\n${colours.GREEN}check:seo — замечаний нет${colours.OFF}`);
process.exit(failures ? 1 : 0);
