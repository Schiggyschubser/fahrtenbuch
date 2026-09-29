"use client";

import { faCarSide, faGear, faPlus, faRightFromBracket, faTableCellsLarge } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function logout() {
    startTransition(async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    });
  }

  return (
    <header className="page-enter sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--surface-translucent)] backdrop-blur lg:static">
      <div data-testid="desktop-app-bar" className="app-frame flex h-16 items-center justify-between lg:h-[74px]">
        <Link href="/" className="focus-ring flex items-center gap-3 rounded-xl">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--logo-surface)] p-1 shadow-sm ring-1 ring-[var(--line)]">
            <Image src="/brand/logo.png" alt="" width={40} height={40} className="h-full w-full object-contain" priority />
          </span>
          <span className="hidden sm:block">
            <span className="block text-[16px] font-extrabold tracking-[-.02em] lg:text-[17px]">Fahrtenbuch</span>
            <span className="hidden text-[11px] font-medium uppercase tracking-[.14em] text-[var(--muted)] sm:block">Dienstfahrten</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-2 lg:flex" aria-label="Hauptnavigation">
          <Link href="/" className={`btn-ghost focus-ring gap-2 ${pathname === "/" ? "bg-[var(--primary-soft)] text-[var(--primary)]" : ""}`}>
            <FontAwesomeIcon icon={faTableCellsLarge} className="h-[18px] w-[18px]" />
            Dashboard
          </Link>
          <Link href="/trips" className={`btn-ghost focus-ring gap-2 ${pathname === "/trips" ? "bg-[var(--primary-soft)] text-[var(--primary)]" : ""}`}>
            <FontAwesomeIcon icon={faCarSide} className="h-[18px] w-[18px]" />
            Fahrten
          </Link>
          <Link href="/?addTrip=1" className="btn-primary focus-ring gap-2">
            <FontAwesomeIcon icon={faPlus} className="h-[18px] w-[18px]" />
            Fahrt hinzufügen
          </Link>
          <span className="mx-2 h-6 w-px bg-[var(--line)]" />
          <Link href="/settings" aria-label="Einstellungen" title="Einstellungen" className={`focus-ring grid h-10 w-10 place-items-center rounded-xl border shadow-sm transition-[background-color,border-color,color,transform] active:scale-95 ${pathname === "/settings" ? "border-[var(--primary-line)] bg-[var(--primary-soft)] text-[var(--primary)]" : "border-[var(--line-strong)] bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:border-[var(--primary-line)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]"}`}>
            <FontAwesomeIcon icon={faGear} className="h-5 w-5" />
          </Link>
          <button className="btn-secondary focus-ring gap-2" type="button" onClick={logout} disabled={isPending}>
            <FontAwesomeIcon icon={faRightFromBracket} className="h-[18px] w-[18px]" />
            {isPending ? "Abmelden …" : "Abmelden"}
          </button>
        </nav>

        <nav className="flex items-center gap-1 lg:hidden" aria-label="Mobile Hauptnavigation">
          <Link href="/" aria-label="Dashboard" className={`focus-ring grid h-11 w-11 place-items-center rounded-xl transition-[background-color,color,transform] active:scale-95 ${pathname === "/" ? "bg-[var(--primary-soft)] text-[var(--primary)]" : "text-[var(--muted)]"}`}>
            <FontAwesomeIcon icon={faTableCellsLarge} className="h-5 w-5" />
          </Link>
          <Link href="/trips" aria-label="Fahrten" className={`focus-ring grid h-11 w-11 place-items-center rounded-xl transition-[background-color,color,transform] active:scale-95 ${pathname === "/trips" ? "bg-[var(--primary-soft)] text-[var(--primary)]" : "text-[var(--muted)]"}`}>
            <FontAwesomeIcon icon={faCarSide} className="h-5 w-5" />
          </Link>
          <Link href="/?addTrip=1" aria-label="Fahrt hinzufügen" className="focus-ring grid h-11 w-11 place-items-center rounded-xl bg-[var(--primary)] text-xl text-[var(--primary-contrast)] shadow-sm active:scale-95"><FontAwesomeIcon icon={faPlus} className="h-5 w-5" /></Link>
          <Link href="/settings" aria-label="Einstellungen" className={`focus-ring grid h-11 w-11 place-items-center rounded-xl border shadow-sm transition-[background-color,border-color,color,transform] active:scale-95 ${pathname === "/settings" ? "border-[var(--primary-line)] bg-[var(--primary-soft)] text-[var(--primary)]" : "border-[var(--line-strong)] bg-[var(--surface-muted)] text-[var(--text-secondary)]"}`}>
            <FontAwesomeIcon icon={faGear} className="h-5 w-5" />
          </Link>
          <button className="focus-ring grid h-11 w-11 place-items-center rounded-xl text-[var(--muted)] hover:bg-[var(--surface-hover)]" type="button" onClick={logout} disabled={isPending} aria-label="Abmelden">
            <FontAwesomeIcon icon={faRightFromBracket} className="h-5 w-5" />
          </button>
        </nav>
      </div>
    </header>
  );
}
