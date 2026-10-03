"use client";

import { useLayoutEffect, useRef } from "react";
import { claimText, type ClaimTemplate } from "@/lib/claim-template";

function Field({ x, y, width, size = 9.5, children }: { x: number; y: number; width: number; size?: number; children: string }) {
  const ref = useRef<SVGTextElement>(null);
  useLayoutEffect(() => {
    const text = ref.current;
    if (!text) return;
    // Measure the uncompressed text, including wider capitals, before constraining it.
    text.removeAttribute("textLength");
    const measured = text.getComputedTextLength();
    if (measured > width) text.setAttribute("textLength", String(width));
  }, [children, size, width]);
  return <text ref={ref} x={x} y={y} fontSize={size} fontFamily="Arial, sans-serif" fill="#000"
    lengthAdjust="spacingAndGlyphs">{children}</text>;
}

export function ClaimPages({ template, month, outputDate, showSignature = false }: { template: ClaimTemplate; month: string; outputDate: string; showSignature?: boolean }) {
  const f = template.fields;
  return <>
    <article className="claim-page-frame" aria-label="Reisekostenantrag – Seite 1 von 2">
      <svg viewBox="0 0 595.32 842.04" role="img" aria-label="Auszahlungsanordnung mit den hinterlegten Antragsdaten">
        <image href="/forms/travel-claim/page-1.svg" width="595.32" height="842.04" />
        <Field x={27.4} y={79.5} width={198} size={10.5}>{f.recipient}</Field>
        <Field x={27.4} y={108} width={198}>{`Wohnort ${f.residence}`}</Field>
        <Field x={84.1} y={126} width={142} size={11}>{f.office}</Field>
        <Field x={151} y={141} width={74}>{f.approvedAt}</Field>
        <Field x={27.4} y={156} width={198}>{`durch ${f.approver}`}</Field>
        <Field x={139} y={171} width={86} size={8}>{f.approvalAuthority}</Field>
        <Field x={282.5} y={108} width={157}>{f.iban}</Field>
        <Field x={282.5} y={122} width={157}>{f.bic}</Field>
        <Field x={282.5} y={136} width={157}>{f.bank}</Field>
        <Field x={236.4} y={160} width={204}>{`${f.signaturePlace ? `${f.signaturePlace}, ` : ""}den ${outputDate}`}</Field>
        {showSignature && template.signature ? <image data-testid="claim-signature" aria-label="Eingefügte Unterschrift" href={template.signature} x={255} y={165} width={170} height={22} preserveAspectRatio="xMidYMid meet" /> : null}
        <Field x={495} y={265} width={37} size={14}>{claimText(f.fiscalYear, month)}</Field>
        <Field x={397.8} y={300} width={105} size={14}>{f.authorityNumber.split("").join(" ")}</Field>
        <Field x={378.7} y={265} width={13} size={14}>{f.documentType}</Field>
        {Array.from(f.bookingKey).map((digit, index) => <Field key={index} x={369.8 + index * 19} y={503} width={13} size={12}>{digit}</Field>)}
        {f.advance ? <><rect x={236} y={30} width={26} height={12} fill="white" /><Field x={236.6} y={40} width={25} size={8}>{f.advance}</Field></> : null}
      </svg>
    </article>
    <article className="claim-page-frame" aria-label="Reisekostenantrag – Seite 2 von 2">
      <svg viewBox="0 0 595.32 842.04" role="img" aria-label="Reiseerläuterungen – Originalformular">
        <image href="/forms/travel-claim/page-2.svg" width="595.32" height="842.04" />
        <Field x={63} y={180} width={178} size={8}>{f.notes.slice(0, 50)}</Field>
        <Field x={63} y={191} width={178} size={8}>{f.notes.slice(50)}</Field>
      </svg>
    </article>
  </>;
}
