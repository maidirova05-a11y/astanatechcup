import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireScoringSession } from "./auth";
import { JudgeShell, Card } from "@/components/judge/JudgeShell";
import { CATEGORY_ROBOTS, type CategoryRobotName } from "@/components/ui/robots";
import { CATEGORIES } from "@/config/categories";
import { getScoringActivity } from "@/lib/scoring/store";

/** The console shows live state; there is nothing here worth caching. */
export const dynamic = "force-dynamic";

/**
 * The console's home screen: pick a category, then a lane.
 *
 * Category names come from the Russian catalog rather than a second hard-coded
 * list, so the console and the public rules page can never disagree about what
 * a category is called.
 */
export default async function JudgeHome() {
  const session = await requireScoringSession();
  const t = await getTranslations({ locale: "ru", namespace: "categories" });

  const activity = await getScoringActivity();

  return (
    <JudgeShell
      role={session.role}
      title="Категории"
      subtitle="Выберите категорию, чтобы внести результат"
    >
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((category) => {
          const Mascot = CATEGORY_ROBOTS[category.mascot as CategoryRobotName];
          const counts = activity.get(category.id);
          const filed =
            category.scoring.kind === "match"
              ? (counts?.completedMatches ?? 0)
              : (counts?.runs ?? 0);

          return (
            <li key={category.id}>
              <Link
                href={`/judge/${category.id}`}
                className="discipline-accent flex h-full flex-col gap-4 rounded-lg border border-line bg-surface p-5 transition-colors hover:border-line-strong hover:bg-surface-raised"
                style={
                  { "--discipline-hue": String(category.hue) } as React.CSSProperties
                }
              >
                <div className="flex items-center gap-3">
                  <span
                    className="flex size-12 shrink-0 items-center justify-center rounded-md bg-(--d-accent-soft) text-3xl"
                    aria-hidden="true"
                  >
                    <Mascot />
                  </span>
                  <div className="flex flex-col">
                    <span className="font-display text-lg font-bold">
                      {t(`items.${category.id}.name`)}
                    </span>
                    <span className="text-xs text-subtle">
                      {category.scoring.kind === "match" ? "Матчи" : "Заезды"} ·{" "}
                      {category.classes.length} кл.
                    </span>
                  </div>
                </div>

                <dl className="mt-auto flex gap-6 text-sm">
                  <div className="flex flex-col">
                    <dd className="tabular font-display text-2xl font-extrabold">
                      {counts?.teams ?? 0}
                    </dd>
                    <dt className="text-2xs uppercase tracking-wider text-subtle">
                      команд
                    </dt>
                  </div>
                  <div className="flex flex-col">
                    <dd className="tabular font-display text-2xl font-extrabold text-(--d-accent)">
                      {filed}
                    </dd>
                    <dt className="text-2xs uppercase tracking-wider text-subtle">
                      {category.scoring.kind === "match" ? "протоколов" : "попыток"}
                    </dt>
                  </div>
                </dl>
              </Link>
            </li>
          );
        })}
      </ul>

      <Card className="mt-6">
        <h2 className="text-lg">Как это работает</h2>
        <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-sm text-muted">
          <li>
            Заведите команды класса со стартовыми номерами — они же будут видны
            на публичном табло.
          </li>
          <li>
            Для матчевых категорий создайте пару, откройте протокол и вносите
            счёт по ходу боя. Пока протокол не завершён, он не идёт в таблицу.
          </li>
          <li>
            Для заездов откройте нужную попытку команды и внесите время или
            очки. Незавершённая попытка записывается по правилам категории, а не
            пустой строкой.
          </li>
          <li>
            Сохранённый результат сразу появляется на странице результатов сайта.
          </li>
        </ol>
      </Card>
    </JudgeShell>
  );
}
