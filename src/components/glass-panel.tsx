import type { PropsWithChildren } from "react";

interface GlassPanelProps extends PropsWithChildren {
  title?: string;
  subtitle?: string;
  className?: string;
}

export function GlassPanel({
  title,
  subtitle,
  className,
  children,
}: GlassPanelProps) {
  return (
    <section
      className={[
        "rounded-[28px] border border-white/12 bg-slate-950/50 px-5 py-4 shadow-[0_24px_80px_rgba(3,8,20,0.45)] backdrop-blur-2xl",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {(title || subtitle) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title ? (
              <h2 className="text-sm font-semibold tracking-[0.22em] text-slate-100 uppercase">
                {title}
              </h2>
            ) : null}
            {subtitle ? (
              <p className="mt-1 max-w-sm text-sm leading-6 text-slate-400">{subtitle}</p>
            ) : null}
          </div>
        </header>
      )}
      {children}
    </section>
  );
}
