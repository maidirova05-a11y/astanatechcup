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
  "inline-flex items-center justify-center gap-2.5",
  // NOT `whitespace-nowrap`: Russian and Kazakh labels run far longer than
  // their English equivalents ("Подать заявку и перейти к оплате" is 402px at
  // one line), and a non-wrapping button overflows a 375px viewport. Labels
  // wrap and the height grows instead.
  "font-semibold text-center text-balance",
  "max-w-full min-h-11 py-2",
  "rounded-full",
  "transition-[transform,background-color,border-color,box-shadow,color]",
  "duration-200 ease-out-expo",
  // Hover lift is disabled by the global reduced-motion rule.
  "hover:-translate-y-0.5 active:translate-y-0",
  "disabled:pointer-events-none disabled:opacity-55 disabled:translate-y-0",
  // The global :focus-visible rule already draws the ring; this keeps it clear
  // of the button's own background on dark surfaces.
  "focus-visible:outline-offset-[3px]",
].join(" ");

const VARIANTS: Record<Variant, string> = {
  accent:
    "bg-accent text-on-accent shadow-signal hover:bg-accent-hover hover:shadow-lg",
  solid:
    "bg-brand-strong text-on-brand hover:bg-brand shadow-sm hover:shadow-md",
  outline:
    "border-2 border-line-strong text-content hover:border-brand hover:text-brand bg-transparent",
  ghost: "text-content hover:bg-surface-muted",
};

/**
 * Heights are all ≥44px: the WCAG 2.2 target-size minimum, and the audience is
 * children and parents on phones. `sm` is small in padding, never in hit area.
 */
/**
 * `min-h` rather than a fixed `h`, so a wrapped two-line label grows the
 * button instead of spilling out of it. All are ≥44px: the WCAG 2.2
 * target-size minimum, and the audience is children and parents on phones.
 */
const SIZES: Record<Size, string> = {
  sm: "min-h-11 px-4 text-sm",
  md: "min-h-12 px-6 text-base",
  lg: "min-h-14 px-8 text-lg",
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
