import React from "react";

interface Props {
  size?: number;
  color?: string;
}

/** Indeterminate spinner. Relies on the `vs-spin` keyframes injected by ToastProvider. */
export function Spinner({ size = 16, color = "#fff" }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ animation: "vs-spin 0.7s linear infinite", display: "block" }}
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeOpacity={0.25} strokeWidth={3} />
      <path d="M12 3 a9 9 0 0 1 9 9" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" />
    </svg>
  );
}
