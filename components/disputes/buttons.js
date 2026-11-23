// Button looks shared by the dispute case, the Decline form and the Accept confirmation.
// Decline = solid red; Accept = white with a blue outline and blue text (user's rule, 2026-11-23).

const base =
  'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[15px] font-semibold no-underline transition-colors duration-[140ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-nets-blue disabled:cursor-not-allowed disabled:opacity-60 max-sm:w-full'

export const declineBtn = `${base} border-nets-red bg-nets-red text-white shadow-[0_1px_2px_rgba(176,18,36,0.25)] hover:border-nets-red-hover hover:bg-nets-red-hover`
export const acceptBtn = `${base} border-nets-blue bg-white text-info shadow-panel hover:bg-nets-blue-soft`
export const quietBtn = `${base} border-transparent bg-transparent px-2.5 text-info hover:bg-nets-blue-soft`
export const secondaryBtn = `${base} border-line-strong bg-white text-ink shadow-panel hover:border-ink-3`
