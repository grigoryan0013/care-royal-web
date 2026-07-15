"use client";
import Icon from "./Icon";

// Right-side slide-in panel used for detail/edit views (e.g. a booking).
export default function Drawer({
  open, onClose, title, children, footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-ink/40 animate-fade-in" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md animate-slide-in flex-col bg-white shadow-pop">
        <div className="flex items-center justify-between border-b border-rule px-6 py-4">
          <h3 className="font-serif text-xl text-ink">{title}</h3>
          <button onClick={onClose} className="text-ink-light hover:text-ink"><Icon name="close" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="border-t border-rule px-6 py-4">{footer}</div>}
      </aside>
    </div>
  );
}
