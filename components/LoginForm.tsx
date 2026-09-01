"use client";

import { faArrowLeft, faShieldHalved } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type LoginChallenge = {
  challengeToken: string;
  expiresAt: string;
};

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [challenge, setChallenge] = useState<LoginChallenge | null>(null);
  const [isPending, startTransition] = useTransition();

  function finishLogin() {
    router.replace("/");
    router.refresh();
  }

  function submitCredentials(formData: FormData) {
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: formData.get("username"), password: formData.get("password") }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Anmeldung fehlgeschlagen.");
        return;
      }
      if (result.requiresTwoFactor) {
        setChallenge({
          challengeToken: result.challengeToken,
          expiresAt: result.expiresAt,
        });
        return;
      }
      finishLogin();
    });
  }

  function submitTwoFactor(formData: FormData) {
    if (!challenge) return;
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/auth/two-factor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeToken: challenge.challengeToken,
          code: formData.get("code"),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Der Bestätigungscode ist ungültig.");
        return;
      }
      finishLogin();
    });
  }

  if (challenge) {
    return (
      <form action={submitTwoFactor} className="space-y-5">
        <div className="flex items-start gap-3 rounded-2xl border border-[var(--primary-muted)] bg-[var(--primary-soft)] px-4 py-4 text-sm text-[var(--primary)]">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--surface)] text-[var(--primary)] shadow-sm">
            <FontAwesomeIcon icon={faShieldHalved} className="h-4 w-4" />
          </span>
          <div>
            <p className="font-extrabold">Zweiter Faktor erforderlich</p>
            <p className="mt-1 leading-6 text-[var(--text-secondary)]">
              Gib den sechsstelligen Code aus deiner Authenticator-App oder einen Backup-Code ein.
            </p>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="code">Bestätigungscode</label>
          <input
            className="field text-center font-mono text-lg tracking-[.25em]"
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            required
          />
        </div>
        {error ? <p role="alert" className="status-enter rounded-xl border border-[var(--danger-line)] bg-[var(--danger-soft)] px-4 py-3 text-sm font-medium text-[var(--danger)]">{error}</p> : null}
        <button className="btn-primary focus-ring w-full" type="submit" disabled={isPending}>
          {isPending ? "Code wird geprüft …" : "Anmeldung abschließen"}
        </button>
        <button
          className="focus-ring mx-auto flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
          type="button"
          onClick={() => {
            setChallenge(null);
            setError("");
          }}
          disabled={isPending}
        >
          <FontAwesomeIcon icon={faArrowLeft} className="h-3.5 w-3.5" />
          Zurück zur Anmeldung
        </button>
      </form>
    );
  }

  return (
    <form action={submitCredentials} className="space-y-5">
      <div>
        <label className="label" htmlFor="username">Benutzername</label>
        <input className="field" id="username" name="username" autoComplete="username" autoFocus required />
      </div>
      <div>
        <label className="label" htmlFor="password">Passwort</label>
        <input className="field" id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {error ? <p role="alert" className="status-enter rounded-xl border border-[var(--danger-line)] bg-[var(--danger-soft)] px-4 py-3 text-sm font-medium text-[var(--danger)]">{error}</p> : null}
      <button className="btn-primary focus-ring mt-2 w-full" type="submit" disabled={isPending}>
        {isPending ? "Wird angemeldet …" : "Anmelden"}
      </button>
    </form>
  );
}
