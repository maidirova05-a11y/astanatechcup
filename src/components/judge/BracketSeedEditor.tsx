"use client";

import { useState } from "react";

export type SeedRow = { teamId: string; label: string };

/**
 * The playoff seed order, editable before generating the bracket.
 *
 * Up/down buttons rather than drag-and-drop: this is used on a phone, and a
 * 44px button a thumb can hit reliably beats a drag target it can miss. The
 * list starts in the order the page computed (group standings when they
 * exist, otherwise the roster order) — this is a correction tool, not a
 * from-scratch seeding exercise.
 */
export function BracketSeedEditor({
  initial,
  fieldName,
}: {
  initial: SeedRow[];
  fieldName: string;
}) {
  const [rows, setRows] = useState(initial);

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    setRows((current) => {
      const next = current.slice();
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <input type="hidden" name={fieldName} value={rows.map((r) => r.teamId).join("\n")} />

      <ol className="flex flex-col gap-1.5">
        {rows.map((row, index) => (
          <li
            key={row.teamId}
            className="flex items-center gap-3 rounded-md border border-line bg-surface-muted px-3 py-2"
          >
            <span className="tabular w-7 shrink-0 text-sm font-semibold text-subtle">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm">{row.label}</span>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => move(index, -1)}
                aria-label="Выше"
                className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-line text-lg disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={index === rows.length - 1}
                onClick={() => move(index, 1)}
                aria-label="Ниже"
                className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-line text-lg disabled:opacity-30"
              >
                ↓
              </button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
