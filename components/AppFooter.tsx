"use client";

import { faClockRotateLeft, faCodeBranch, faFileCode } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState } from "react";
import { Modal } from "./Modal";

export type ChangelogEntry = {
  version?: string;
  date: string;
  title: string;
  hash?: string;
  fileCount: number;
  files: string[];
};

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

export function AppFooter({ version, changelog }: { version: string; changelog: ChangelogEntry[] }) {
  const [changelogOpen, setChangelogOpen] = useState(false);

  return (
    <>
      <footer className="app-footer mt-auto w-full bg-transparent py-3 text-xs text-[var(--muted)]">
        <div className="app-frame flex items-center justify-between gap-4">
          <span>© Schudi, based on CelduinX</span>
          <button type="button" className="focus-ring inline-flex items-center gap-2 rounded-lg px-2 py-1 font-bold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--primary)]" onClick={() => setChangelogOpen(true)} aria-label={`Version ${version} – Changelog öffnen`}>
            <FontAwesomeIcon icon={faCodeBranch} className="h-3.5 w-3.5" />
            Version {version}
          </button>
        </div>
      </footer>

      {changelogOpen ? (
        <Modal title="Changelog" description={`Version ${version} · Änderungen aus den Git-Commits`} onClose={() => setChangelogOpen(false)}>
          {(requestClose) => (
            <>
              <div className="max-h-[62dvh] space-y-3 overflow-y-auto px-5 py-5 sm:px-7">
                {changelog.map((entry) => (
                  <article key={`${entry.version ?? entry.hash}-${entry.date}-${entry.title}`} className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-4">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs font-bold">
                      {entry.version ? <span className="rounded-md bg-[var(--primary)] px-2 py-0.5 text-[var(--primary-contrast)]">Version {entry.version}</span> : null}
                      {entry.hash ? <code className="rounded-md bg-[var(--line)] px-2 py-0.5 text-[var(--text-secondary)]">{entry.hash}</code> : null}
                      <span className="inline-flex items-center gap-1.5 text-[var(--muted)]"><FontAwesomeIcon icon={faClockRotateLeft} className="h-3 w-3" /> {formatDate(entry.date)}</span>
                    </div>
                    <h3 className="font-extrabold text-[var(--ink-soft)]">{entry.title}</h3>
                    <details className="mt-3 text-xs text-[var(--muted)]">
                      <summary className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded-lg font-bold text-[var(--text-secondary)] hover:text-[var(--primary)]">
                        <FontAwesomeIcon icon={faFileCode} className="h-3.5 w-3.5" />
                        {entry.fileCount} geänderte {entry.fileCount === 1 ? "Datei" : "Dateien"}
                      </summary>
                      <ul className="mt-3 space-y-1.5 border-l-2 border-[var(--line)] pl-4 font-mono text-[11px] leading-4">
                        {entry.files.map((file) => <li key={file} className="break-all">{file}</li>)}
                        {entry.files.length < entry.fileCount ? <li className="font-sans font-bold text-[var(--muted)]">+ {entry.fileCount - entry.files.length} weitere Dateien</li> : null}
                      </ul>
                    </details>
                  </article>
                ))}
              </div>
              <footer className="flex justify-end border-t border-[var(--line)] bg-[var(--surface-muted)] px-5 py-4 sm:px-7">
                <button type="button" className="btn-primary focus-ring" onClick={requestClose}>Schließen</button>
              </footer>
            </>
          )}
        </Modal>
      ) : null}
    </>
  );
}
