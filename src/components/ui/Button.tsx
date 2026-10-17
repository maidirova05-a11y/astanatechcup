import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The one button in the system.
 *
 * `accent` is reserved for the single primary action on a screen — that is the
 * whole reason the signal colour exists as its own token. If two accent
 * buttons are visible at once, one of them is wrong.
 */

type Variant = "accent" | "solid" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

const BASE = [
  "inline-flex items-center justify-center gap-2",
  // NOT `whitespace-nowrap`: Russian and Kazakh labels run far longer than
  // their English equivalents ("Подать заявку и перейти к оплате" is 402px at
  // one line), and a non-wrapping button overflows a 375px viewport. Labels
  // wrap and the height grows instead.
  // Heavier weight than a typical UI button: at this scale and radius, 600
  // reads as timid next to the mascots.
  // Display face: button labels are UI chrome, and chrome speaks Manrope —
  // an Inter label under a Manrope headline was the most visible place the
  // two faces met at the same weight and size.
  "font-display font-bold text-center text-balance",
  "max-w-full min-h-11 py-2",
  "rounded-full",
  "transition-[transform,background-color,border-color,box-shadow,color]",
  "duration-200 ease-out-expo",
  // Press physics: the button rises on hover and sinks INTO its own shadow on
  // press, which is what makes a solid bottom edge read as a physical key
  // rather than a drawing of one. Both are disabled by the global
  // reduced-motion rule.
  "hover:-translate-y-0.5",
  "disabled:pointer-events-none disabled:opacity-55 disabled:translate-y-0 disabled:shadow-none",
  // The global :focus-visible rule already draws the ring; this keeps it clear
  // of the button's own background on dark surfaces.
  "focus-visible:outline-offset-[3px]",
].join(" ");

const VARIANTS: Record<Variant, string> = {
  // The one primary action. The solid edge is a darker shade of the button's
  // own hue, so it looks moulded rather than shadowed.
  accent: [
    "bg-accent text-on-accent border-2 border-accent-edge",
    "shadow-[0_5px_0_0_var(--accent-edge)]",
    "hover:bg-accent-hover hover:shadow-[0_7px_0_0_var(--accent-edge)]",
    "active:translate-y-[4px] active:shadow-[0_1px_0_0_var(--accent-edge)]",
  ].join(" "),
  solid: [
    "bg-brand-strong text-on-brand border-2 border-ink",
    "shadow-[0_5px_0_0_var(--ink)]",
    "hover:shadow-[0_7px_0_0_var(--ink)]",
    "active:translate-y-[4px] active:shadow-[0_1px_0_0_var(--ink)]",
  ].join(" "),
  outline: [
    "bg-surface-raised text-content border-2 border-ink",
    "shadow-[0_4px_0_0_var(--ink)]",
    "hover:shadow-[0_6px_0_0_var(--ink)]",
    "active:translate-y-[3px] active:shadow-[0_1px_0_0_var(--ink)]",
  ].join(" "),
  ghost: "text-content hover:bg-surface-muted",
};

/**
 * `min-h` rather than a fixed `h`, so a wrapped two-line label grows the
 * button instead of spilling out of it. All are ≥44px: the WCAG 2.2
 * target-size minimum, and the audience is children and parents on phones.
 *
 * `lg` is 52px with a 16px label rather than 56px at 18px: the 2px outline
 * and the 5px edge already make it the heaviest object in any row, so the
 * label does not need to shout as well. It steps up to 17–18px from `md`,
 * where the button sits beside display type.
 */
const SIZES: Record<Size, string> = {
  // `leading-tight` after the size, not in BASE: tailwind-merge drops a
  // leading class that precedes a text-size class. A wrapped two-line label
  // at the body's 1.6 leading read as two separate buttons.
  sm: "min-h-11 px-4 text-sm leading-tight",
  md: "min-h-12 px-6 text-base leading-tight",
  lg: "min-h-13 px-7 text-base md:text-lg leading-tight",
};

type ButtonOwnProps = {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  children: ReactNode;
  className?: string;
};

export function buttonClasses({
  variant = "accent",
  size = "md",
  fullWidth = false,
  className,
}: Omit<ButtonOwnProps, "children">): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], fullWidth && "w-full", className);
}

export function Button({
  variant,
  size,
  fullWidth,
  className,
  children,
  ...props
}: ButtonOwnProps & ComponentPropsWithoutRef<"button">) {
  return (
    <button
      // Buttons inside a <form> default to type="submit", which is a classic
      // source of accidental submits. Callers must opt in explicitly.
      type="button"
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Anchor styled as a button. Kept separate from `Button` rather than done with
 * an `as` prop, because a link and a button are different things to a keyboard
 * and a screen reader and blurring them is how you end up with a "button" that
 * cannot be opened in a new tab.
 */
export function ButtonLink<T extends ElementType = "a">({
  as,
  variant,
  size,
  fullWidth,
  className,
  children,
  ...props
}: ButtonOwnProps & { as?: T } & Omit<
    ComponentPropsWithoutRef<T>,
    keyof ButtonOwnProps | "as"
  >) {
  const Component = (as ?? "a") as ElementType;
  return (
    <Component
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...props}
    >
      {children}
    </Component>
  );
}

/**
 * External links get `rel="noopener noreferrer"` unconditionally. `noopener`
 * stops the destination from reaching back through `window.opener`;
 * `noreferrer` stops our URL — which can carry an application reference — from
 * being sent in the Referer header.
 */
export const EXTERNAL_LINK_PROPS = {
  target: "_blank",
  rel: "noopener noreferrer",
} as const;
