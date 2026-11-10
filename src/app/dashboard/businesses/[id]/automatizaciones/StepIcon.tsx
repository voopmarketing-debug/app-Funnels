import type { StepType } from "@/lib/automations/flow";
import { GROUP_COLOR, STEP_META } from "./stepMeta";

// One small drawing per step, white on the colour of its group.

const PATHS: Record<StepType, React.ReactNode> = {
  message: <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6a2.5 2.5 0 0 1-2.5 2.5H11l-4 3.5V15h-.5A2.5 2.5 0 0 1 4 12.5" />,
  reaction: <path d="M12 19s-6.5-3.8-6.5-8.6A3.7 3.7 0 0 1 12 8.2a3.7 3.7 0 0 1 6.5 2.2C18.5 15.2 12 19 12 19Z" />,
  comment: <path d="M6 5h12v11H10l-4 3.5V5ZM9 9h6M9 12h4" />,
  internal: <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16ZM10 20a2 2 0 0 0 4 0" />,
  list: <path d="M8 7h10M8 12h10M8 17h10M5 7h.01M5 12h.01M5 17h.01" />,
  ai_condition: <path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4ZM18 15l.7 1.8L20.5 17.5l-1.8.7L18 20l-.7-1.8-1.8-.7 1.8-.7L18 15Z" />,
  pause: <path d="M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM12 8.5V12l2.5 1.5" />,
  actions: <path d="M13 4 6 13h5l-1 7 7-9h-5l1-7Z" />,
  condition: <path d="M5 6h14l-5.5 6.5V18l-3-1.5v-4L5 6Z" />,
  validation: <path d="M5.5 12.5 10 17l8.5-9.5" />,
  goto: <path d="M5 12h12M13 7l5 5-5 5" />,
  start_flow: <path d="M8 5.5v13l10-6.5-10-6.5Z" />,
  http: <path d="M9 8 5 12l4 4M15 8l4 4-4 4M13.5 6.5l-3 11" />,
  round_robin: <path d="M5 11a7 7 0 0 1 12-4l2 2M19 13a7 7 0 0 1-12 4l-2-2M19 5v4h-4M5 19v-4h4" />,
  stop: <path d="M8 6v12M16 6v12" />,
};

export function StepIcon({ type, size = 36 }: { type: StepType; size?: number }) {
  return (
    <span aria-hidden="true" className="flex flex-none items-center justify-center rounded-xl text-white shadow-sm" style={{ width: size, height: size, background: GROUP_COLOR[STEP_META[type].group] }}>
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {PATHS[type]}
      </svg>
    </span>
  );
}
