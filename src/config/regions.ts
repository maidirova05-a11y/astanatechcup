/**
 * Administrative regions of Kazakhstan, current as of the 2022 reorganisation
 * that created Abai, Jetisu and Ulytau oblasts.
 *
 * Stored as stable keys, never as display strings — the label is translated in
 * `messages/*.json` under `regions.*`, and the key is what goes in the
 * database and the Zod enum. Renaming a region in Kazakh does not invalidate
 * historical applications.
 */
export const REGIONS = [
  "astana",
  "almaty_city",
  "shymkent",
  "abai",
  "akmola",
  "aktobe",
  "almaty_region",
  "atyrau",
  "east_kazakhstan",
  "zhambyl",
  "zhetysu",
  "west_kazakhstan",
  "karaganda",
  "kostanay",
  "kyzylorda",
  "mangystau",
  "pavlodar",
  "north_kazakhstan",
  "turkistan",
  "ulytau",
  // The championship calls itself international and feeds RobotChallenge, so
  // a foreign team must be able to apply without picking a false region.
  "other",
] as const;

export type Region = (typeof REGIONS)[number];

export function isRegion(value: string): value is Region {
  return (REGIONS as readonly string[]).includes(value);
}
