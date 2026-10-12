/**
 * Illustrative photography, from Unsplash (free licence, no Unsplash+).
 *
 * ── What these are, and what they are not ───────────────────────────────
 * Stock photos of robots, workshops and students, used to break up the
 * page's long runs of text and tiles. They are NOT photos of AstanaTechCup,
 * and must never be presented as such: the Gallery section ("how it was",
 * last season) stays reserved for the real event photos and does not use
 * this file. Anything placed next to event facts is captioned generically.
 *
 * ── How they are served ──────────────────────────────────────────────────
 * Through `next/image`, whose optimizer fetches from images.unsplash.com
 * (allowed in next.config.ts) and serves AVIF/WebP from our own origin, so
 * the CSP keeps `img-src 'self'`. Pass `photoSrc(photo)` as the `src`.
 *
 * Alt text lives in the message catalogs under `photos.<key>`, so it is
 * translated with everything else. Credits are rendered in the footer.
 * ─────────────────────────────────────────────────────────────────────────
 */

export type Photo = {
  /** Path segment on images.unsplash.com, e.g. `photo-1775826476139-b5968f28ebdb`. */
  file: string;
  /** Unsplash photo page id, for the credit link. */
  id: string;
  author: string;
  width: number;
  height: number;
};

export const PHOTOS = {
  /** Team robot "16460", close-up of the build. Portrait. */
  teamRobot: {
    file: "photo-1775826476148-1e35e8a74f09",
    id: "RM4ui3eq_Hw",
    author: "Shivansh Upadhyay",
    width: 3456,
    height: 5184,
  },
  /** Wheeled robot with an arm on a white arena. Very wide. */
  armRobot: {
    file: "photo-1779309487417-6b44e5f4b036",
    id: "mUSk1NtyGOo",
    author: "Asif Al",
    width: 4000,
    height: 1868,
  },
  /** Young girl concentrating on assembling a construction kit. */
  girlAssembling: {
    file: "photo-1780006393664-142ed57a1593",
    id: "lM2ww7eebG4",
    author: "Anna Khromova",
    width: 4845,
    height: 3230,
  },
  /** Tracked robot against a purple-blue background — on-palette. */
  trackedRobot: {
    file: "photo-1558137623-ce933996c730",
    id: "l74VaCZon7I",
    author: "Marília Castelli",
    width: 5509,
    height: 3967,
  },
  /** Microcontroller board and parts on a blue surface. */
  circuitBoard: {
    file: "photo-1603732551658-5fabbafa84eb",
    id: "gavODTHG36Y",
    author: "Sahand Babali",
    width: 5472,
    height: 3648,
  },
  /** Robot car with a camera head, on a light floor. */
  cameraRobot: {
    file: "photo-1655088651367-f9f4e1328f08",
    id: "lsZbAa6FsyQ",
    author: "JUNXUAN BAO",
    width: 12000,
    height: 8000,
  },
  /** Line-follower robot on a printed track. */
  lineFollower: {
    file: "photo-1612338762643-298feee70520",
    id: "9BkycB5U9iQ",
    author: "Nandito F. Anggara",
    width: 4288,
    height: 2848,
  },
  /** Students coding together at a desk. */
  coding: {
    file: "photo-1531496681078-27dc2277e898",
    id: "t1bz9XpJ2-Y",
    author: "Mimi Thian",
    width: 5184,
    height: 3888,
  },
} as const satisfies Record<string, Photo>;

export type PhotoKey = keyof typeof PHOTOS;

/** The `src` to hand to next/image. The optimizer adds width and format. */
export function photoSrc(photo: Photo): string {
  return `https://images.unsplash.com/${photo.file}`;
}

/** The photo's page on Unsplash, for the credit link. */
export function photoPage(photo: Photo): string {
  return `https://unsplash.com/photos/${photo.id}`;
}
