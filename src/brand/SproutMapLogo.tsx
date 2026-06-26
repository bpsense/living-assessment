import React, { useId } from "react";

/**
 * SproutMap brand mark + logo lockups.
 * Single source of truth — replaces the GraduationCap placeholder.
 *
 * <SproutMapMark variant="tile" size={32} />        // app icon / sidebar
 * <SproutMapLogo />                                  // horizontal lockup
 * <SproutMapLogo orientation="stacked" />            // centered stack
 */

const BLOB =
  "M46.51 11.15 C59.46 11.35 62.98 15.11 73.62 26.54 C84.26 37.98 83.60 39.62 85.91 53.51 C88.22 67.40 91.52 68.69 82.17 78.00 C72.83 87.30 66.17 88.86 51.29 87.98 C36.41 87.10 38.49 85.11 27.08 74.74 C15.66 64.37 9.40 62.78 9.02 49.57 C8.65 36.36 15.56 36.20 25.69 25.82 C35.81 15.45 33.57 10.96 46.51 11.15 Z";
const STEM = "M49.5 70 C48 60 49 54 49.4 43 C49.8 54 50.8 60 49.5 70 Z";
const LEAFL = "M48.6 57 C38.5 60 30 55.5 25.5 45.5 C35 43 44.5 49 48.6 57 Z";
const LEAFR = "M50 48 C58 50 64.5 46.5 68.5 39 C60.5 37 53.5 41.5 50 48 Z";

const TEAL = "#0D7377";
const INK = "#2D3436";
const AMBER = "#D4943A";

export type MarkVariant = "color" | "reverse" | "mono-teal" | "mono-ink" | "tile";

export interface SproutMapMarkProps {
  variant?: MarkVariant;
  size?: number;
  className?: string;
  title?: string;
}

export function SproutMapMark({
  variant = "color",
  size = 32,
  className,
  title = "SproutMap",
}: SproutMapMarkProps) {
  const uid = useId().replace(/:/g, "");
  const knock = "knock-" + uid;
  const grad = "grad-" + uid;

  const knockout = (
    <mask id={knock}>
      <rect width="100" height="100" fill="#fff" />
      <path d={STEM} fill="#000" />
      <path d={LEAFL} fill="#000" />
      <path d={LEAFR} fill="#000" />
    </mask>
  );

  const sproutWhite = (
    <g fill="#fff">
      <path d={STEM} />
      <path d={LEAFL} />
      <path d={LEAFR} />
    </g>
  );

  let body: React.ReactNode;

  if (variant === "color") {
    body = (
      <>
        <path d={BLOB} fill={TEAL} />
        {sproutWhite}
        <circle cx="50" cy="37" r="3.2" fill={AMBER} />
      </>
    );
  } else if (variant === "reverse") {
    body = (
      <>
        <defs>{knockout}</defs>
        <path d={BLOB} fill="#fff" mask={"url(#" + knock + ")"} />
        <circle cx="50" cy="37" r="3.2" fill={AMBER} />
      </>
    );
  } else if (variant === "mono-teal" || variant === "mono-ink") {
    body = (
      <>
        <defs>{knockout}</defs>
        <path
          d={BLOB}
          fill={variant === "mono-teal" ? TEAL : INK}
          mask={"url(#" + knock + ")"}
        />
      </>
    );
  } else {
    // tile — gradient rounded square, white mark with teal sprout knockout
    body = (
      <>
        <defs>
          {knockout}
          <linearGradient id={grad} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#0F8488" />
            <stop offset="1" stopColor="#0B5F62" />
          </linearGradient>
        </defs>
        <rect width="100" height="100" rx="22" fill={"url(#" + grad + ")"} />
        <g transform="translate(20,20) scale(0.6)">
          <path d={BLOB} fill="#fff" mask={"url(#" + knock + ")"} />
          <circle cx="50" cy="37" r="3.2" fill={AMBER} />
        </g>
      </>
    );
  }

  return (
    <svg
      role="img"
      aria-label={title}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      {body}
    </svg>
  );
}

export interface SproutMapLogoProps {
  orientation?: "horizontal" | "stacked";
  /** height of the mark in px (wordmark scales with it) */
  size?: number;
  reverse?: boolean;
  className?: string;
}

/** Mark + "SproutMap" wordmark. Wordmark is live Inter text. */
export function SproutMapLogo({
  orientation = "horizontal",
  size = 36,
  reverse = false,
  className,
}: SproutMapLogoProps) {
  const sprout = reverse ? "#fff" : INK;
  const map = reverse ? "#A7DAD9" : TEAL;

  if (orientation === "stacked") {
    return (
      <div
        className={className}
        style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: size * 0.34 }}
      >
        <SproutMapMark variant={reverse ? "reverse" : "color"} size={size * 1.6} />
        <span
          style={{
            fontFamily:
              "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
            fontWeight: 700,
            fontSize: size * 0.82,
            letterSpacing: "-0.03em",
            lineHeight: 1,
          }}
        >
          <span style={{ color: sprout }}>Sprout</span>
          <span style={{ color: map }}>Map</span>
        </span>
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: size * 0.4 }}
    >
      <SproutMapMark variant={reverse ? "reverse" : "color"} size={size} />
      <span
        style={{
          fontFamily:
            "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
          fontWeight: 700,
          fontSize: size * 0.92,
          letterSpacing: "-0.03em",
          lineHeight: 1,
        }}
      >
        <span style={{ color: sprout }}>Sprout</span>
        <span style={{ color: map }}>Map</span>
      </span>
    </div>
  );
}

export default SproutMapLogo;
