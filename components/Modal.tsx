"use client";

import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function Modal({ title, description, size = "default", onClose, children }: {
  title: string;
  description?: string;
  size?: "default" | "wide";
  onClose: () => void;
  children: ReactNode | ((requestClose: () => void) => ReactNode);
}) {
  const [closing, setClosing] = useState(false);
  const requestClose = useCallback(() => {
    setClosing(true);
  }, []);

  useEffect(() => {
    if (!closing) return;
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 210;
    const closeTimer = window.setTimeout(onClose, delay);
    return () => window.clearTimeout(closeTimer);
  }, [closing, onClose]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") requestClose();
    }
    window.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [requestClose]);

  return createPortal(
    <div data-state={closing ? "closed" : "open"} className="modal-backdrop fixed inset-0 z-50 flex items-end bg-[var(--backdrop)] p-0 backdrop-blur-[2px] sm:grid sm:place-items-center sm:p-6 lg:p-8" onMouseDown={(event) => event.target === event.currentTarget && requestClose()}>
      <section data-state={closing ? "closed" : "open"} role="dialog" aria-modal="true" aria-labelledby="modal-title" className={`modal-panel max-h-[92dvh] w-full overflow-auto rounded-t-[24px] border border-[var(--modal-border)] bg-[var(--surface)] shadow-[0_28px_80px_rgba(15,23,42,.22)] sm:max-h-[calc(100vh-48px)] sm:rounded-[22px] lg:max-h-[calc(100vh-64px)] ${size === "wide" ? "max-w-[820px]" : "max-w-[650px]"}`}>
        <header className="flex items-start justify-between border-b border-[var(--line)] px-5 py-4 sm:px-7 sm:py-5">
          <div>
            <h2 id="modal-title" className="text-xl font-extrabold tracking-[-.025em]">{title}</h2>
            {description ? <p className="mt-1 text-sm text-[var(--muted)]">{description}</p> : null}
          </div>
          <button type="button" className="focus-ring grid h-11 w-11 place-items-center rounded-xl text-xl text-[var(--muted)] hover:bg-[var(--surface-hover)] sm:h-9 sm:w-9" onClick={requestClose} aria-label="Schließen"><FontAwesomeIcon icon={faXmark} className="h-5 w-5" /></button>
        </header>
        {typeof children === "function" ? children(requestClose) : children}
      </section>
    </div>,
    document.body,
  );
}
