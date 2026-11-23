import { XMarkIcon } from '@heroicons/react/24/outline';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Shared modal (TAD §11.2, Style Guide 7.1): portal into #modal-root, dark
 * blurred backdrop, bottom sheet with rounded top corners, close button
 * top-right, focus trap, Esc to close, role="dialog".
 */
export function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const reduce = useReducedMotion();
  const sheet = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const el = sheet.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    el?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
      if (e.key !== 'Tab' || !el) return;
      const focusable = [...el.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.();
    };
  }, []);

  const root = document.getElementById('modal-root') ?? document.body;
  const fade = reduce ? { duration: 0.12 } : { duration: 0.22 };

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <motion.div
        className="absolute inset-0 bg-black/55 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: reduce ? 0.12 : 0.18 } }}
        transition={fade}
        onClick={onClose}
        data-testid="modal-backdrop"
      />
      <motion.div
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative mx-auto flex w-full max-w-[520px] flex-col rounded-t-xl bg-modal text-text-primary outline-none"
        style={{ minHeight: '62dvh', maxHeight: 'calc(100dvh - env(safe-area-inset-top) - 24px)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
        initial={reduce ? { opacity: 0 } : { y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={reduce ? { opacity: 0, transition: { duration: 0.12 } } : { y: 40, opacity: 0, transition: { duration: 0.18 } }}
        transition={fade}
      >
        <div className="flex items-center gap-lg px-lg pt-xl">
          <span className="h-px flex-1 bg-divider" />
          <h2 className="text-title">{title}</h2>
          <span className="h-px flex-1 bg-divider" />
        </div>
        <div className="flex justify-end px-lg pt-sm">
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-11 items-center justify-center rounded-md text-text-primary active:scale-96 focus-visible:outline-2 focus-visible:outline-white"
          >
            <XMarkIcon className="size-7" strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto px-xl pb-sm">{children}</div>
      </motion.div>
    </div>,
    root,
  );
}
