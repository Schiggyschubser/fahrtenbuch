"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ClaimPages } from "./ClaimPages";
import { claimOutputDate, type ClaimTemplate } from "@/lib/claim-template";
import type { MonthDataDto, TripDto } from "@/lib/types";
import type { TripColumnId } from "@/lib/trip-columns";
import { PrintToolbar } from "./PrintToolbar";
import { TripTable } from "./TripData";

type Props = { data: MonthDataDto; visibleColumns: TripColumnId[]; title: string; createdAt: string; licensePlate: string; claimTemplate: ClaimTemplate; claimMonth: string; outputDate: string };

function DocumentHeader({ data, title, createdAt, licensePlate }: Props) {
  return <header className="print-document-header mb-3 flex items-center justify-between gap-4 border-b-2 border-[#2563eb] pb-2">
    <div className="flex min-w-0 items-center gap-2.5">
      <Image src="/brand/logo.png" alt="" width={30} height={30} className="h-[30px] w-[30px] shrink-0 object-contain" loading="eager" />
      <div><h1 className="text-[18px] font-extrabold capitalize tracking-[-.025em]">Dienstfahrten · {title}</h1>
        <p className="mt-0.5 text-[10px] text-[#64748b]">Fahrtenbuch · {data.trips.length} {data.trips.length === 1 ? "Fahrt" : "Fahrten"}</p></div>
    </div>
    <div className="shrink-0 text-right text-[9px] text-[#64748b]"><p>Erstellt am {createdAt} Uhr</p>
      <p className="mt-0.5 font-semibold">KFZ-Kennzeichen: {licensePlate || "Noch nicht hinterlegt"}</p></div>
  </header>;
}

function DocumentFooter({ title, page, count }: { title: string; page: number; count: number }) {
  return <footer className="print-document-footer mt-2 flex justify-between border-t border-[#dbe3ee] pt-1 text-[8px] text-[#64748b]">
    <p>Fahrtenbuch · {title}</p><p>Seite {page} von {count}</p>
  </footer>;
}

// A single exceptionally long entry may need continuation rows. Split only
// text fields, preserving all text and repeating the identifying trip values.
function splitTrip(trip: TripDto): TripDto[] {
  const fields = ["routeLabel", "originFullName", "destinationFullName", "accompanyingStaff", "remark"] as const;
  const longest = Math.max(...fields.map((field) => trip[field].length));
  if (longest < 2) return [trip];
  const first = { ...trip }, second = { ...trip, printContinuation: true };
  for (const field of fields) {
    const text = trip[field];
    if (text.length < longest / 2) continue;
    let cut = Math.ceil(text.length / 2);
    const space = text.lastIndexOf(" ", cut);
    if (space > cut / 2) cut = space + 1;
    first[field] = text.slice(0, cut);
    second[field] = text.slice(cut);
  }
  return [first, second];
}

export function PrintPreview(props: Props) {
  const { data, visibleColumns, title } = props;
  const [includeClaim, setIncludeClaim] = useState(props.claimTemplate.includeByDefault);
  const [includeSignature, setIncludeSignature] = useState(false);
  const [outputDate, setOutputDate] = useState(props.outputDate);
  useEffect(() => {
    const updateDate = () => flushSync(() => setOutputDate(claimOutputDate()));
    window.addEventListener("beforeprint", updateDate);
    return () => window.removeEventListener("beforeprint", updateDate);
  }, []);
  const inputKey = JSON.stringify([data, visibleColumns, props.licensePlate, props.createdAt]);
  const measureRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState<{ key: string; trips: TripDto[] } | null>(null);
  const measuredTrips = rows?.key === inputKey ? rows.trips : data.trips;
  const [result, setResult] = useState<{ key: string; pages: TripDto[][] } | null>(null);
  const ready = result?.key === inputKey;
  const pages = ready ? result.pages : [data.trips];

  useEffect(() => {
    const measure = measureRef.current;
    const preview = pagesRef.current;
    if (!measure || !preview) return;
    let cancelled = false;
    let frame = 0;
    function scalePages() {
      if (!measure || !preview) return;
      preview.style.setProperty("--print-scale", String(Math.min(1, preview.clientWidth / measure.offsetWidth)));
    }
    function paginate() {
      if (cancelled || !measure) return;
      scalePages();
      const content = measure.querySelector<HTMLElement>(".print-page-content")!;
      const header = measure.querySelector<HTMLElement>("header")!;
      const footer = measure.querySelector<HTMLElement>("footer")!;
      const table = measure.querySelector<HTMLTableElement>("table")!;
      const height = (element: HTMLElement) => element.offsetHeight + parseFloat(getComputedStyle(element).marginTop) + parseFloat(getComputedStyle(element).marginBottom);
      // Reserve the total row on each page so the final page always fits.
      const capacity = content.clientHeight - height(header) - height(footer) - table.tHead!.offsetHeight - table.tFoot!.offsetHeight - 4;
      const rowHeights = Array.from(table.tBodies[0].rows, (row) => row.getBoundingClientRect().height);
      const oversized = measuredTrips.findIndex((_, index) => rowHeights[index] > capacity);
      if (oversized >= 0) {
        const parts = splitTrip(measuredTrips[oversized]);
        if (parts.length > 1) {
          setRows({ key: inputKey, trips: [...measuredTrips.slice(0, oversized), ...parts, ...measuredTrips.slice(oversized + 1)] });
          return;
        }
      }
      const nextPages: TripDto[][] = [[]];
      let used = 0;
      measuredTrips.forEach((trip, index) => {
        if (used + rowHeights[index] > capacity && nextPages.at(-1)!.length) { nextPages.push([]); used = 0; }
        nextPages.at(-1)!.push(trip);
        used += rowHeights[index];
      });
      setResult({ key: inputKey, pages: nextPages });
    }
    frame = requestAnimationFrame(paginate);
    void document.fonts.ready.then(() => { if (!cancelled) frame = requestAnimationFrame(paginate); });
    const observer = new ResizeObserver(scalePages);
    observer.observe(preview);
    return () => { cancelled = true; cancelAnimationFrame(frame); observer.disconnect(); };
  }, [inputKey, measuredTrips]);

  return <>
    <PrintToolbar initialVisibleColumns={visibleColumns} preparing={!ready} includeClaim={includeClaim} onIncludeClaim={setIncludeClaim} signatureAvailable={Boolean(props.claimTemplate.signature)} includeSignature={includeSignature} onIncludeSignature={setIncludeSignature} />
    <div ref={measureRef} className="print-measure print-sheet" aria-hidden="true" inert>
      <div className="print-page-content"><DocumentHeader {...props} /><TripTable data={{ ...data, trips: measuredTrips }} visibleColumns={visibleColumns} print /><DocumentFooter title={title} page={1} count={1} /></div>
    </div>
    <div ref={pagesRef} className="print-pages" data-testid="print-table-wrap" data-ready={ready} aria-busy={!ready}>
      {includeClaim ? <ClaimPages template={props.claimTemplate} month={props.claimMonth} outputDate={outputDate} showSignature={includeSignature} /> : null}
      {pages.map((trips, index) => <div key={index} className="print-page-frame">
        <article className="print-sheet text-[#172033]" aria-label={`A4 Querformat – Seite ${index + 1 + (includeClaim ? 2 : 0)} von ${pages.length + (includeClaim ? 2 : 0)}`}>
          <div className="print-page-content">
            <DocumentHeader {...props} />
            <TripTable data={{ ...data, trips }} visibleColumns={visibleColumns} print showTotals={index === pages.length - 1} />
            <DocumentFooter title={title} page={index + 1 + (includeClaim ? 2 : 0)} count={pages.length + (includeClaim ? 2 : 0)} />
          </div>
        </article>
      </div>)}
    </div>
  </>;
}
