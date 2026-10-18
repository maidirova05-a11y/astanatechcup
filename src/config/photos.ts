/**
 * Event photography: AstanaTechCup, 7–8 February 2026, Astana.
 *
 * ── What these are ───────────────────────────────────────────────────────
 * Real photos of last season's championship, from the organizer's own
 * shoot. They replace the Unsplash stock the site launched with, so every
 * photo on the page is now the event itself. The Gallery section shows the
 * `GALLERY` set; the other sections each take one photo by key.
 *
 * ── How they were prepared ───────────────────────────────────────────────
 * Picked from ~900 frames, then gently corrected: the sports hall's warm
 * cast neutralised, levels stretched, a touch of contrast, colour and
 * sharpening. Resized to 2400px on the long edge, all metadata stripped
 * (no EXIF, no GPS). Files live in /public/gallery; next/image serves them
 * as AVIF/WebP at the size each slot needs.
 *
 * Alt text lives in the message catalogs under `photos.<key>`, so it is
 * translated with everything else.
 * ─────────────────────────────────────────────────────────────────────────
 */

export type Photo = {
  /** Path under /public. */
  src: string;
  width: number;
  height: number;
};

const photo = (name: string): Photo => ({
  src: `/gallery/${name}.jpg`,
  width: 2400,
  height: 1600,
});

export const PHOTOS = {
  /** Two players reaching across a VEX field full of orange scoring pieces. */
  vexField: photo("vex-field"),
  /** A team in blue shirts in front of the AstanaTechCup backdrop. */
  teamBanner: photo("team-banner"),
  /** A boy in glasses holding up his robot, smiling. */
  robotInHands: photo("robot-in-hands"),
  /** Winners on stage with diplomas behind the flag of Kazakhstan. */
  winnersFlag: photo("winners-flag"),
  /** A caged drone on the hall floor. */
  drone: photo("drone"),
  /** Two LEGO sumo robots on the ring. */
  sumoRing: photo("sumo-ring"),
  /** A line-follower robot taking a curve on the track. */
  lineFollower: photo("line-follower"),
  /** Two boys holding a second-place diploma (Lego Sumo). */
  diploma: photo("diploma"),
  /** Two boys holding their robot, looking at the camera. */
  teamRobot: photo("team-robot"),
  /** A girl building a model city at her team's table. */
  girlBuilding: photo("girl-building"),
  /** A boy in glasses programming his robot on a laptop. */
  coding: photo("coding"),
  /** A hand loading a cup into a VEX robot's gripper. Close-up. */
  gripper: photo("gripper"),
  /** Girls gathered around a team's project at the exhibition table. */
  projectTable: photo("project-table"),
} as const satisfies Record<string, Photo>;

export type PhotoKey = keyof typeof PHOTOS;

/** The Gallery mosaic, in order: the first is the wide lead tile. */
export const GALLERY: PhotoKey[] = [
  "vexField",
  "teamBanner",
  "robotInHands",
  "winnersFlag",
  "drone",
];
