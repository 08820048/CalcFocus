import { AnimatePresence, motion } from "framer-motion";
import { Command, CornerDownLeft, Search } from "lucide-react";
import { useEffect, useRef } from "react";

export interface CommandPaletteItem {
  id: string;
  title: string;
  section: string;
  description: string;
  shortcut?: string;
}

interface CommandPaletteProps {
  open: boolean;
  query: string;
  items: CommandPaletteItem[];
  activeIndex: number;
  onClose: () => void;
  onQueryChange: (query: string) => void;
  onActiveIndexChange: (index: number) => void;
  onSelect: (item: CommandPaletteItem) => void;
}

export function CommandPalette({
  open,
  query,
  items,
  activeIndex,
  onClose,
  onQueryChange,
  onActiveIndexChange,
  onSelect,
}: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.18),transparent_24%),rgba(1,3,9,0.74)] px-4 pb-8 pt-[10vh] backdrop-blur-xl"
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, y: -18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="w-full max-w-3xl overflow-hidden rounded-[30px] border border-white/12 bg-slate-950/88 shadow-[0_30px_120px_rgba(2,8,23,0.6)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-white/8 px-5 py-4">
              <div className="rounded-2xl border border-white/10 bg-white/6 p-2 text-slate-200">
                <Search size={16} />
              </div>
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => onQueryChange(event.currentTarget.value)}
                placeholder="Search commands, markers, and layout actions"
                className="min-w-0 flex-1 bg-transparent text-base text-slate-50 outline-none placeholder:text-slate-500"
              />
              <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] tracking-[0.22em] text-slate-400 uppercase">
                Esc
              </span>
            </div>

            <div className="max-h-[58vh] overflow-y-auto p-3">
              {items.length > 0 ? (
                <div className="space-y-2">
                  {items.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => onActiveIndexChange(index)}
                      onClick={() => onSelect(item)}
                      className={[
                        "flex w-full items-center gap-4 rounded-[24px] border px-4 py-4 text-left transition",
                        index === activeIndex
                          ? "border-cyan-300/18 bg-cyan-400/10"
                          : "border-white/6 bg-white/4 hover:bg-white/8",
                      ].join(" ")}
                    >
                      <div className="rounded-2xl border border-white/10 bg-white/6 p-2 text-slate-200">
                        <Command size={15} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                          <span className="truncate text-sm font-medium text-slate-100">
                            {item.title}
                          </span>
                          <span className="rounded-full border border-white/8 bg-white/6 px-2 py-1 text-[11px] tracking-[0.2em] text-slate-400 uppercase">
                            {item.section}
                          </span>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-slate-400">
                          {item.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-slate-500">
                        {item.shortcut ? (
                          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] tracking-[0.18em] uppercase">
                            {item.shortcut}
                          </span>
                        ) : null}
                        <CornerDownLeft size={14} />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-[24px] border border-white/8 bg-white/4 px-5 py-10 text-center">
                  <p className="text-sm font-medium text-slate-100">No matching commands</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Try searching for recording, export, focus, or marker names.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
