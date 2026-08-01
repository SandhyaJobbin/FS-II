import React, { useState } from 'react';
import {
  User, Star, Bed, HouseLine, DeviceMobile, WarningCircle, CheckCircle,
  XCircle, CalendarBlank, ArrowRight, Table as TableIcon, CaretDown,
} from '@phosphor-icons/react';
import { TableContent } from '../../types';
import { Entity, SectionData } from './parser';

function humanize(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()).trim();
}

/** Field keys where 2+ entities in the same tab share an identical value — the visual "flag" for comparison cases. */
function findMatches(entities: Entity[]): Set<string> {
  const byField: Record<string, Record<string, number[]>> = {};
  entities.forEach((e, i) => {
    Object.entries(e.fields).forEach(([k, v]) => {
      if (!v) return;
      byField[k] = byField[k] || {};
      byField[k][v] = byField[k][v] || [];
      byField[k][v].push(i);
    });
  });
  const matched = new Set<string>();
  Object.entries(byField).forEach(([field, values]) => {
    Object.values(values).forEach((idxs) => {
      if (idxs.length >= 2) idxs.forEach((i) => matched.add(`${i}:${field}`));
    });
  });
  return matched;
}

function SectionShell({ icon, iconBg, iconColor, title, sourceTabs, empty, emptyText, children, className = '' }: {
  icon: React.ReactNode; iconBg: string; iconColor: string; title: string;
  sourceTabs: string[]; empty: boolean; emptyText: string; children?: React.ReactNode;
  className?: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className={`bg-slate-50 border rounded-xl p-5 shadow-lg flex flex-col gap-3 h-full ${empty ? 'border-slate-200 border-dashed' : 'border-slate-200'} ${className}`}>
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        disabled={empty}
        className="flex items-start justify-between gap-2 text-left cursor-pointer disabled:cursor-default"
      >
        <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
          <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconBg} ${iconColor}`}>{icon}</span>
          {title}
        </h4>
        <div className="flex items-center gap-2 shrink-0">
          {sourceTabs.length > 0 && (
            <span className="text-xs text-slate-500 font-medium text-right max-w-[130px] truncate" title={sourceTabs.join(', ')}>
              {sourceTabs.join(' + ')}
            </span>
          )}
          {!empty && (
            <CaretDown weight="bold" className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${collapsed ? '-rotate-90' : ''}`} />
          )}
        </div>
      </button>
      {empty ? (
        <div className="flex-1 flex items-center justify-center py-6 text-center">
          <p className="text-sm text-slate-400 italic max-w-[220px]">{emptyText}</p>
        </div>
      ) : !collapsed && (
        <div className="max-h-[360px] overflow-y-auto pr-1">
          {children}
        </div>
      )}
    </div>
  );
}

function FieldRow({ label, value, matched }: { label: string; value?: string; matched?: boolean }) {
  const has = !!value && value.trim().length > 0;
  return (
    <div className={`flex flex-col xl:flex-row xl:items-baseline justify-between gap-1 xl:gap-3 py-1.5 border-b border-slate-200/50 last:border-b-0 ${matched ? 'bg-amber-500/10 -mx-2 px-2 rounded' : ''}`}>
      <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold shrink-0">{label}</span>
      <span className={`text-base xl:text-right font-medium break-words ${has ? 'text-slate-800' : 'text-slate-400 italic'}`}>
        {has ? value : 'Not available'}
      </span>
    </div>
  );
}

function Avatar({ label }: { label?: string | null }) {
  const initials = label ? label.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() : '?';
  return (
    <div className="w-10 h-10 rounded-full bg-linear-to-br from-[#4facfe] to-[#00f2fe] flex items-center justify-center text-slate-900 font-bold text-sm shrink-0 shadow-lg">
      {initials}
    </div>
  );
}

function StarRating({ rating }: { rating?: string }) {
  const match = rating?.match(/(\d+(\.\d+)?)/);
  const n = match ? Math.round(parseFloat(match[1])) : 0;
  return (
    <div className="flex items-center gap-1 shrink-0">
      {[...Array(5)].map((_, i) => (
        <Star key={i} weight={i < n ? 'fill' : 'regular'} className={`w-4 h-4 ${i < n ? 'text-amber-400' : 'text-slate-300'}`} />
      ))}
      <span className="text-xs text-slate-400 ml-1">{rating || 'Not rated'}</span>
    </div>
  );
}

function Chip({ label, tone }: { label: string; tone: 'positive' | 'negative' }) {
  const cls = tone === 'positive'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : 'bg-rose-50 text-rose-700 border-rose-200';
  const Icon = tone === 'positive' ? CheckCircle : XCircle;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold border ${cls}`}>
      <Icon weight="bold" className="w-3.5 h-3.5" />{label}
    </span>
  );
}

function StatusPill({ value }: { value?: string }) {
  if (!value) {
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200">Not available</span>;
  }
  const v = value.toLowerCase();
  const positive = ['verified', 'completed', 'confirmed', 'yes'].some((w) => v.includes(w));
  const negative = ['cancelled', 'unavailable', 'no'].some((w) => v.includes(w));
  const cls = positive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : negative ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200';
  const Icon = positive ? CheckCircle : negative ? XCircle : WarningCircle;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${cls}`}>
      <Icon weight="fill" className="w-4 h-4" />{value}
    </span>
  );
}

function NoteList({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null;
  return (
    <ul className="mt-1.5 flex flex-col gap-0.5">
      {notes.map((n, i) => <li key={i} className="text-xs text-slate-500">• {n}</li>)}
    </ul>
  );
}

const IDENTITY_KEYS = ['accountCreated', 'accountAge', 'reviewPosted', 'previousReviews', 'previousReports', 'deviceUsed'];
const IDENTITY_LABELS: Record<string, string> = {
  accountCreated: 'Account Created', accountAge: 'Account Age', reviewPosted: 'Review Posted',
  previousReviews: 'Previous Reviews', previousReports: 'Previous Reports', deviceUsed: 'Device Used',
};

function IdentityEntityBlock({ entity, index, matches, compact }: { entity: Entity; index: number; matches: Set<string>; compact: boolean }) {
  const extraKeys = Object.keys(entity.fields).filter((k) => !IDENTITY_KEYS.includes(k) && k !== 'comment');
  return (
    <div className={compact ? 'flex flex-col gap-2 bg-white border border-slate-200/80 rounded-lg p-3' : 'flex flex-col gap-2'}>
      <div className="flex items-center gap-3">
        <Avatar label={entity.label || entity.fields.name} />
        <span className="text-base font-bold text-slate-900">{entity.label || entity.fields.name || 'Account'}</span>
      </div>
      <div className="flex flex-col">
        {IDENTITY_KEYS.map((k) => (
          <FieldRow key={k} label={IDENTITY_LABELS[k]} value={entity.fields[k]} matched={matches.has(`${index}:${k}`)} />
        ))}
        {extraKeys.map((k) => (
          <FieldRow key={k} label={humanize(k)} value={entity.fields[k]} matched={matches.has(`${index}:${k}`)} />
        ))}
      </div>
      {entity.fields.comment && (
        <blockquote className="mt-1 text-sm text-slate-655 italic border-l-2 border-accent/30 pl-2">&ldquo;{entity.fields.comment}&rdquo;</blockquote>
      )}
      <NoteList notes={entity.notes} />
    </div>
  );
}

export function IdentityCard({ section }: { section: SectionData }) {
  const empty = section.entities.length === 0;
  const multi = section.entities.length > 1;
  const matches = multi ? findMatches(section.entities) : new Set<string>();
  return (
    <SectionShell icon={<User weight="duotone" className="w-4 h-4" />} iconBg="bg-sky-100" iconColor="text-sky-700"
      title="Reviewer / Account Profile" sourceTabs={section.tabNames} empty={empty}
      className={multi ? 'md:col-span-2' : ''}
      emptyText="No reviewer or account profile information was provided for this case.">
      {multi && (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Comparing {section.entities.length} accounts — matching attributes are highlighted.
        </div>
      )}
      <div className={multi ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4' : ''}>
        {section.entities.map((e, i) => (
          <IdentityEntityBlock key={i} entity={e} index={i} matches={matches} compact={multi} />
        ))}
      </div>
    </SectionShell>
  );
}

export function ReviewCard({ section }: { section: SectionData }) {
  const empty = section.entities.length === 0;
  return (
    <SectionShell icon={<Star weight="duotone" className="w-4 h-4" />} iconBg="bg-amber-100" iconColor="text-amber-700"
      title="Review Details" sourceTabs={section.tabNames} empty={empty}
      emptyText="No customer review was attached to this case.">
      <div className="flex flex-col gap-4">
        {section.entities.map((e, i) => (
          <div key={i} className={i > 0 ? 'pt-3 border-t border-slate-200' : ''}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Avatar label={e.label || e.fields.name} />
                <span className="text-base font-bold text-slate-900">{e.fields.name || e.label || 'Reviewer'}</span>
              </div>
              <StarRating rating={e.fields.rating} />
            </div>
            <FieldRow label="Review Date" value={e.fields.reviewDate || e.fields.reviewPosted} />
            <FieldRow label="Photos Attached" value={e.fields.photosAttached} />
            <blockquote className="mt-2 text-base text-slate-700 italic border-l-4 border-accent/40 bg-accent/5 p-3 rounded-r-lg">
              {e.fields.comment ? <>&ldquo;{e.fields.comment}&rdquo;</> : <span className="text-slate-400 not-italic">No written comment available.</span>}
            </blockquote>
            <NoteList notes={e.notes} />
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

export function BookingCard({ section }: { section: SectionData }) {
  const empty = section.entities.length === 0;
  return (
    <SectionShell icon={<Bed weight="duotone" className="w-4 h-4" />} iconBg="bg-emerald-100" iconColor="text-emerald-700"
      title="Booking Details" sourceTabs={section.tabNames} empty={empty}
      emptyText="No booking record was attached to this case.">
      <div className="flex flex-col gap-4">
        {section.entities.map((e, i) => (
          <div key={i} className={i > 0 ? 'pt-3 border-t border-slate-200' : ''}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-500 font-semibold">{e.label || 'Booking Status'}</span>
              <StatusPill value={e.fields.bookingStatus} />
            </div>
            {(e.fields.checkIn || e.fields.checkOut) ? (
              <div className="flex items-center gap-2 text-base text-slate-800 font-medium mb-2 bg-slate-100 rounded-lg px-3 py-2">
                <CalendarBlank className="w-5 h-5 text-accent shrink-0" />
                <span>{e.fields.checkIn || 'Not available'}</span>
                <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{e.fields.checkOut || 'Not available'}</span>
              </div>
            ) : (
              <FieldRow label="Stay Dates" value={e.fields.stayDates} />
            )}
            <FieldRow label="Room Booked" value={e.fields.roomBooked || e.fields.roomCategory} />
            <FieldRow label="Stay Duration" value={e.fields.stayDuration} />
            <FieldRow label="Stay Completed" value={e.fields.stayCompleted} />
            <FieldRow label="Reservation" value={e.fields.reservation} />
            <NoteList notes={e.notes} />
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

export function PropertyCard({ section }: { section: SectionData }) {
  const empty = section.entities.length === 0;
  return (
    <SectionShell icon={<HouseLine weight="duotone" className="w-4 h-4" />} iconBg="bg-indigo-100" iconColor="text-indigo-700"
      title="Property / Listing Information" sourceTabs={section.tabNames} empty={empty}
      emptyText="No property or listing information was attached to this case.">
      <div className="flex flex-col gap-4">
        {section.entities.map((e, i) => (
          <div key={i} className={i > 0 ? 'pt-3 border-t border-slate-200' : ''}>
            <div className="mb-2">
              <div className="text-lg font-bold text-slate-900">{e.fields.propertyName || 'Property name not available'}</div>
              <div className="text-sm text-slate-500">{e.fields.propertyType || 'Property type not specified'}</div>
            </div>
            <div className="mb-2">
              <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-1.5">Available Facilities</div>
              <div className="flex flex-wrap gap-1.5">
                {(e.lists.availableFacilities?.length ?? 0) > 0
                  ? e.lists.availableFacilities!.map((f) => <Chip key={f} label={f} tone="positive" />)
                  : <span className="text-sm text-slate-400 italic">Not available</span>}
              </div>
            </div>
            {(e.lists.notListed?.length ?? 0) > 0 && (
              <div className="mb-2">
                <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-1.5">Mentioned but Not Listed</div>
                <div className="flex flex-wrap gap-1.5">
                  {e.lists.notListed!.map((f) => <Chip key={f} label={f} tone="negative" />)}
                </div>
              </div>
            )}
            <NoteList notes={e.notes} />
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

export function ConnectedCard({ section }: { section: SectionData }) {
  const empty = section.entities.length === 0;
  return (
    <SectionShell icon={<DeviceMobile weight="duotone" className="w-4 h-4" />} iconBg="bg-purple-100" iconColor="text-purple-700"
      title="Connected & Device Information" sourceTabs={section.tabNames} empty={empty}
      emptyText="No device or connected-account information was attached to this case.">
      <div className="flex flex-col gap-3">
        {section.entities.map((e, i) => (
          <div key={i} className={i > 0 ? 'pt-3 border-t border-slate-200' : ''}>
            {e.label && <div className="text-sm font-bold text-slate-800 mb-1">{e.label}</div>}
            <FieldRow label="Device Used" value={e.fields.deviceUsed || e.fields.deviceInfo} />
            <NoteList notes={e.notes} />
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

export function ReportsCard({ section }: { section: SectionData }) {
  const empty = section.entities.length === 0;
  return (
    <SectionShell icon={<WarningCircle weight="duotone" className="w-4 h-4" />} iconBg="bg-rose-100" iconColor="text-rose-700"
      title="Reports & Flags" sourceTabs={section.tabNames} empty={empty}
      emptyText="No reports or complaints were filed on this case.">
      <div className="flex flex-col gap-3">
        {section.entities.map((e, i) => {
          const hasAny = !!(e.fields.reportReason || e.fields.comment || e.fields.customerFeedback || e.notes.length);
          return (
            <div key={i} className={i > 0 ? 'pt-3 border-t border-slate-200' : ''}>
              {e.fields.reportReason && (
                <div className="bg-rose-50 border border-rose-250 rounded-lg p-3 mb-2">
                  <div className="text-xs font-bold text-rose-700 uppercase tracking-wide mb-1">Property Report</div>
                  <p className="text-rose-800 text-base leading-relaxed">&ldquo;{e.fields.reportReason}&rdquo;</p>
                </div>
              )}
              {e.fields.comment && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-2">
                  <div className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Customer Report</div>
                  <p className="text-slate-700 text-base leading-relaxed">&ldquo;{e.fields.comment}&rdquo;</p>
                </div>
              )}
              <FieldRow label="Customer Feedback" value={e.fields.customerFeedback} />
              <NoteList notes={e.notes} />
              {!hasAny && <p className="text-sm text-slate-400 italic">Not available</p>}
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}

export function ReferenceDataCard({ tables }: { tables?: TableContent[] | null }) {
  const empty = !tables || tables.length === 0;
  return (
    <SectionShell icon={<TableIcon weight="duotone" className="w-4 h-4" />} iconBg="bg-cyan-100" iconColor="text-cyan-700"
      title="Reference Data" sourceTabs={[]} empty={empty}
      emptyText="No reference data tables were attached to this case.">
      <div className="flex flex-col gap-4">
        {tables?.map((t, i) => (
          <div key={i}>
            {t.caption && <div className="text-sm font-bold text-slate-500 mb-1.5">{t.caption}</div>}
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    {t.headers.map((h, hi) => (
                      <th key={hi} className="text-left px-4 py-3 font-bold text-slate-700 uppercase tracking-wide text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {t.rows.map((row, ri) => (
                    <tr key={ri} className="border-t border-slate-200">
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-4 py-3 text-slate-700">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}
