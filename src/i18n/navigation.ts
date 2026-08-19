import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Locale-aware replacements for next/link and the router hooks. Using these
 * instead of the raw next/navigation exports means no component ever has to
 * hand-build a `/${locale}/...` string.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
