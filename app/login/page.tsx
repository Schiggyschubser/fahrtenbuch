import { redirect } from "next/navigation";
import Image from "next/image";
import { areDefaultCredentialsActive, getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  const defaultCredentialsActive = await areDefaultCredentialsActive();
  return (
    <main className="min-h-[calc(100dvh-60px)] bg-[var(--surface)] lg:grid lg:grid-cols-[1.05fr_.95fr]">
      <section className="login-hero page-enter relative hidden min-h-[calc(100dvh-60px)] flex-col justify-between overflow-hidden bg-[var(--hero)] p-14 text-[var(--hero-contrast)] lg:flex">
        <Image src="/brand/bg-login-v2.png" alt="" fill sizes="55vw" className="object-cover" priority />
        <div className="relative flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--logo-surface)] p-1.5 shadow-lg ring-1 ring-white/30">
            <Image src="/brand/logo.png" alt="" width={44} height={44} className="h-full w-full object-contain" loading="eager" />
          </span>
          <span className="text-lg font-extrabold">Fahrtenbuch</span>
        </div>

        <div className="relative max-w-[570px] pb-10">
          <p className="mb-5 text-sm font-bold uppercase tracking-[.18em] text-[var(--hero-kicker)]">Einfach dokumentiert</p>
          <h1 className="text-[52px] font-extrabold leading-[1.07] tracking-[-.045em]">Deine Dienstfahrten.<br />Monat für Monat.</h1>
          <p className="mt-6 max-w-[510px] text-lg leading-8 text-[var(--hero-muted)]">Schnell erfassen, sauber sortieren und jederzeit den Überblick über deine gefahrenen Kilometer behalten.</p>
        </div>
      </section>

      <section className="flex min-h-[calc(100dvh-60px)] items-center justify-center bg-[var(--surface-muted)] px-5 py-10 sm:px-12 lg:px-16">
        <div className="section-enter w-full max-w-[430px]">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--logo-surface)] p-1.5 shadow-sm ring-1 ring-[var(--line)]"><Image src="/brand/logo.png" alt="" width={44} height={44} className="h-full w-full object-contain" priority /></span>
            <div><p className="font-extrabold">Fahrtenbuch</p><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--muted)]">Dienstfahrten</p></div>
          </div>
          <div className="mb-8 sm:mb-9">
            <h2 className="text-[29px] font-extrabold tracking-[-.035em] sm:text-[32px]">Willkommen zurück</h2>
            <p className="mt-2 text-[var(--muted)]">Melde dich an, um dein Fahrtenbuch zu öffnen.</p>
          </div>
          <LoginForm />
          {defaultCredentialsActive ? (
            <div className="mt-8 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
              <span className="font-bold text-[var(--ink-soft)]">Erster Start?</span> Verwende <code className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 font-bold">admin</code> / <code className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 font-bold">admin</code>.
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
