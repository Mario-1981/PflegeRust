import React from 'react';
import {
  Users,
  Route,
  Activity,
  ArrowRightLeft,
  CalendarCheck,
  CheckCircle2,
  Clock,
  HeartPulse,
  Plus,
  Database,
} from 'lucide-react';
import { Klient, Tour } from '../types/pflege';

interface DashboardViewProps {
  klienten: Klient[];
  touren: Tour[];
  onSelectTab: (tab: string) => void;
  onSelectKlient: (klientId: string) => void;
  onOpenNewKlientModal: () => void;
  onToggleHaltStatus: (tourId: string, haltId: string) => void;
  onOpenMariaDbModal: () => void;
  canReadKlienten: boolean;
  canEditKlienten: boolean;
  canReadTouren: boolean;
  canPlanTouren: boolean;
  canConfirmTouren: boolean;
  canMigrate: boolean;
  canSystem: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  klienten,
  touren,
  onSelectTab,
  onSelectKlient,
  onOpenNewKlientModal,
  onToggleHaltStatus,
  onOpenMariaDbModal,
  canReadKlienten,
  canEditKlienten,
  canReadTouren,
  canPlanTouren,
  canConfirmTouren,
  canMigrate,
  canSystem,
}) => {
  // Aggregate statistics
  const totalClients = klienten.length;
  const pgCounts = [1, 2, 3, 4, 5].map(
    (pg) => klienten.filter((k) => k.pflegegrad === pg).length
  );

  let totalHalte = 0;
  let doneHalte = 0;
  touren.forEach((t) => {
    totalHalte += t.halte.length;
    doneHalte += t.halte.filter((h) => h.status === 'Erledigt').length;
  });

  const percentDone = totalHalte > 0 ? Math.round((doneHalte / totalHalte) * 100) : 0;

  // Active tour to display
  const activeTour = touren[0];

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-white border border-slate-200 rounded-lg shadow-xs">
        <div>
          <div className="text-xs font-semibold text-teal-800 uppercase tracking-wider mb-1">
            PflegeRust · Ambulanter Dienst
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Tagesdisposition &amp; Pflegemanagement
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Debian Linux Server · MariaDB 10.11 InnoDB (utf8mb4) · SNAP.Pflege Kompatibel
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {canSystem && (
            <button
              onClick={onOpenMariaDbModal}
              className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-teal-900 bg-teal-50 border border-teal-300 rounded-md hover:bg-teal-100 transition-colors cursor-pointer"
            >
              <Database className="w-3.5 h-3.5 text-teal-700" />
              <span>MariaDB Status</span>
            </button>
          )}
          {canMigrate && (
            <button
              onClick={() => onSelectTab('migration')}
              className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-slate-600" />
              <span>SNAP-Import</span>
            </button>
          )}
          {canEditKlienten && (
            <button
              onClick={onOpenNewKlientModal}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Neuer Klient</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Grid (only permitted KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {canReadKlienten && (
          <div className="p-4 bg-white border border-slate-200 rounded-lg">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
              <span>Klienten im Bestand</span>
              <Users className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {totalClients}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {klienten.filter((k) => k.snapLegacyId).length} aus SNAP in MariaDB migriert
            </div>
          </div>
        )}

        {canReadTouren && (
          <>
            <div className="p-4 bg-white border border-slate-200 rounded-lg">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
                <span>{canPlanTouren ? 'Heutige Einsätze' : 'Meine Einsätze heute'}</span>
                <Route className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                  {doneHalte}/{totalHalte}
                </span>
                <span className="text-xs text-teal-700 font-mono font-medium">
                  {percentDone}% quittiert
                </span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-teal-700 h-full rounded-full transition-all duration-300"
                  style={{ width: `${percentDone}%` }}
                />
              </div>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-lg">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
                <span>{canPlanTouren ? 'Touren im Dienst' : 'Meine zugewiesenen Touren'}</span>
                <CalendarCheck className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                {touren.length}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {canPlanTouren
                  ? 'Früh- & Spätschicht (PDL-Gesamtansicht)'
                  : touren.length > 0
                  ? 'Exklusiv durch PDL zugewiesen'
                  : 'Aktuell keine Tour zugewiesen'}
              </div>
            </div>
          </>
        )}

        {canSystem && (
          <div className="p-4 bg-white border border-slate-200 rounded-lg">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
              <span>MariaDB Engine</span>
              <Database className="w-4 h-4 text-teal-700" />
            </div>
            <div className="text-base font-semibold text-emerald-700 flex items-center gap-1.5 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              MariaDB 10.11 (InnoDB)
            </div>
            <div className="text-[11px] text-slate-500 mt-1 font-mono">
              Pool: 10 Conns · 1.4ms Ping
            </div>
          </div>
        )}
      </div>

      {/* 2-Column Split: Touren-Monitoring & Pflegegrad-Verteilung (only permitted widgets) */}
      {(canReadTouren || canReadKlienten) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Aktive Tour Einsätze (2 Cols) */}
          {canReadTouren && (
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    {activeTour
                      ? `Einsatzübersicht: ${activeTour.name}`
                      : canPlanTouren
                      ? 'Einsatzübersicht: Keine aktive Tour'
                      : 'Meine Einsatzübersicht: Keine Tour zugewiesen'}
                  </h2>
                  {activeTour && (
                    <div className="text-xs text-slate-500">
                      Mitarbeiter:{' '}
                      <span className="font-mono text-slate-700 font-semibold">
                        {activeTour.zugewiesenerMitarbeiterName || activeTour.fahrerKuerzel}
                      </span>{' '}
                      · Fahrzeug: {activeTour.fahrzeugKennzeichen}
                      {canPlanTouren && !activeTour.zugewiesenerBenutzerId && (
                        <span className="ml-2 text-[11px] text-amber-700 font-medium">
                          (Nicht zugewiesen)
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => onSelectTab('touren')}
                  className="text-xs text-teal-700 hover:text-teal-900 font-medium cursor-pointer"
                >
                  {canPlanTouren ? 'Alle Touren öffnen →' : 'Meine Tour öffnen →'}
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {activeTour?.halte.map((halt) => {
                  const k = klienten.find((c) => c.id === halt.klientId);
                  if (!k) return null;
                  const isErledigt = halt.status === 'Erledigt';
                  return (
                    <div
                      key={halt.id}
                      className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {canConfirmTouren ? (
                          <button
                            onClick={() => onToggleHaltStatus(activeTour.id, halt.id)}
                            title={isErledigt ? 'Als ausstehend markieren' : 'Einsatz quittieren'}
                            className="cursor-pointer"
                          >
                            {isErledigt ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            ) : (
                              <Clock className="w-5 h-5 text-amber-500" />
                            )}
                          </button>
                        ) : (
                          <span>
                            {isErledigt ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            ) : (
                              <Clock className="w-5 h-5 text-amber-500" />
                            )}
                          </span>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-slate-800">
                              {halt.geplanteUhrzeit} Uhr
                            </span>
                            <span className="text-slate-400">·</span>
                            {canReadKlienten ? (
                              <button
                                onClick={() => {
                                  onSelectKlient(k.id);
                                  onSelectTab('klienten');
                                }}
                                className="text-xs font-semibold text-slate-900 hover:text-teal-700 cursor-pointer"
                              >
                                {k.nachname}, {k.vorname}
                              </button>
                            ) : (
                              <span className="text-xs font-semibold text-slate-900">
                                {k.nachname}, {k.vorname}
                              </span>
                            )}
                            <span className="text-[11px] font-mono px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded border border-slate-200">
                              PG {k.pflegegrad}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {k.strasse} {k.hausnummer}, {k.ort}
                            <span className="mx-1.5 text-slate-300">|</span>
                            <span className="font-mono text-[11px] text-teal-800 font-medium">
                              {halt.leistungCodes.join(', ')}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-medium ${
                            isErledigt
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : halt.status === 'In Arbeit'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {halt.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {(!activeTour || activeTour.halte.length === 0) && (
                  <div className="p-6 text-center text-xs text-slate-400">
                    {!activeTour && !canPlanTouren
                      ? 'Ihnen ist aktuell keine Tour zugewiesen. Bitte wenden Sie sich an die Pflegedienstleitung (PDL).'
                      : 'Keine Einsätze für heute geplant.'}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Right Column: Pflegegrad Verteilung & Vitalwerte */}
          {canReadKlienten && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <h2 className="text-sm font-bold text-slate-900 mb-3">
                  Pflegegrad-Verteilung (SGB XI)
                </h2>
                <div className="space-y-2.5">
                  {[1, 2, 3, 4, 5].map((pg, idx) => {
                    const count = pgCounts[idx];
                    const pct = totalClients > 0 ? Math.round((count / totalClients) * 100) : 0;
                    return (
                      <div key={pg} className="space-y-1">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-slate-700 font-mono">Pflegegrad {pg}</span>
                          <span className="font-mono text-slate-900 tabular-nums">
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-teal-700 h-full rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-2">
                  <HeartPulse className="w-4 h-4 text-rose-600" />
                  <span>Letzte Vitalwerte</span>
                </div>
                <div className="space-y-2">
                  {klienten
                    .flatMap((k) =>
                      k.vitalwerte.map((vw) => ({
                        ...vw,
                        patientName: `${k.nachname}, ${k.vorname}`,
                        patientId: k.id,
                      }))
                    )
                    .slice(0, 3)
                    .map((vw) => (
                      <div
                        key={vw.id}
                        onClick={() => {
                          onSelectKlient(vw.patientId);
                          onSelectTab('klienten');
                        }}
                        className="p-2 rounded bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors cursor-pointer text-xs"
                      >
                        <div className="flex justify-between font-medium text-slate-800">
                          <span>{vw.patientName}</span>
                          <span className="text-slate-500 font-mono text-[11px]">
                            {vw.datum} {vw.uhrzeit}
                          </span>
                        </div>
                        <div className="flex gap-3 text-slate-600 mt-1 font-mono text-[11px] tabular-nums">
                          <span>
                            RR: {vw.blutdruckSystolisch}/{vw.blutdruckDiastolisch}
                          </span>
                          <span>Puls: {vw.puls}</span>
                          {vw.blutzucker && <span>BZ: {vw.blutzucker} mg/dl</span>}
                        </div>
                      </div>
                    ))}
                  {klienten.every((k) => k.vitalwerte.length === 0) && (
                    <div className="text-xs text-slate-400 py-2">
                      Noch keine Vitalwerte erfasst.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
