import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export function DefaultCredentialsNotice() {
  return (
    <div className="status-enter mb-5 flex flex-col gap-3 rounded-2xl border border-[var(--warning-line)] bg-[var(--warning-soft)] px-4 py-3.5 text-sm text-[var(--warning-strong)] sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex items-start gap-3 sm:items-center">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--warning-soft)]">
          <FontAwesomeIcon icon={faTriangleExclamation} className="h-3.5 w-3.5" />
        </span>
        <span><strong>Standard-Zugang aktiv.</strong> Ändere Benutzername und Passwort in den Einstellungen.</span>
      </div>
      <a href="/settings?tab=credentials" className="self-end font-bold underline decoration-[var(--warning-line)] underline-offset-4 sm:self-auto">Jetzt ändern</a>
    </div>
  );
}
