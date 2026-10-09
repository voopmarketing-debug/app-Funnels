export function FunnelsLogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className}>
      <rect x="6" y="6" width="52" height="9" rx="4.5" fill="none" stroke="#b5ff2b" strokeWidth="3" />
      <rect x="17" y="26" width="30" height="9" rx="4.5" fill="none" stroke="#b5ff2b" strokeWidth="3" />
      <circle cx="32" cy="50" r="7.5" fill="#b5ff2b" />
    </svg>
  );
}

/**
 * The mark on its dark app-icon tile, the same as the Meta app's icon. The
 * lime alone almost disappears on the light theme's white.
 */
export function FunnelsLogoBadge({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <span
      className={`flex flex-none items-center justify-center rounded-xl bg-[#111214] shadow-[0_0_0_1px_rgba(181,255,43,0.25),0_4px_14px_-4px_rgba(181,255,43,0.45)] ${
        size === "sm" ? "h-8 w-8" : "h-10 w-10"
      }`}
    >
      <FunnelsLogoMark className={size === "sm" ? "h-5 w-5" : "h-6 w-6"} />
    </span>
  );
}
