/**
 * White panel with a heading row, as in design/home.html.
 * @param {{title: string, tech?: string, caption?: string, action?: React.ReactNode, children: React.ReactNode, className?: string}} props
 */
export function Panel({ title, tech, caption, action, children, className = '' }) {
  return (
    <section className={`min-w-0 rounded-[12px] border border-line bg-white shadow-panel ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pt-4 sm:px-5 sm:pt-[18px]">
        <h2 className="text-[17px] font-semibold">
          {title}
          {tech ? <span className="ml-2 text-[13px] font-normal text-ink-3">{tech}</span> : null}
          {caption ? <span className="ml-2 text-[13px] font-normal text-ink-3">{caption}</span> : null}
        </h2>
        {action}
      </div>
      <div className="px-4 pt-4 pb-4 sm:px-5 sm:pb-5">{children}</div>
    </section>
  )
}

/** @param {{children: React.ReactNode}} props */
export function EmptyState({ children }) {
  return <p className="rounded-lg bg-page px-4 py-6 text-center text-[15px] text-ink-2">{children}</p>
}
