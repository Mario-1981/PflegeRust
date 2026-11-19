import React, { useState, useEffect } from 'react';
import { FileHeart, AlertTriangle, ShieldCheck, CheckCircle2, Pencil, Save } from 'lucide-react';
import { Klient, SisKategorie, SisRisikomatrix } from '../types/pflege';

interface SisViewProps {
  klienten: Klient[];
  canEditSis: boolean;
  onSelectKlient: (klientId: string) => void;
  onUpdateKlient: (updatedKlient: Klient, auditDetails?: string) => void;
}

const DEFAULT_SIS_TEMPLATE: SisKategorie[] = [
  {
    titel: 'Kognition und Kommunikation',
    kategorieId: 'kognition',
    beschreibung: '',
    einschaetzung: '',
    risikoVorhanden: false,
  },
  {
    titel: 'Mobilität und Beweglichkeit',
    kategorieId: 'mobilitaet',
    beschreibung: '',
    einschaetzung: '',
    risikoVorhanden: false,
  },
  {
    titel: 'Krankheitsbezogene Anforderungen',
    kategorieId: 'krankheit',
    beschreibung: '',
    einschaetzung: '',
    risikoVorhanden: false,
  },
  {
    titel: 'Selbstversorgung',
    kategorieId: 'selbstversorgung',
    beschreibung: '',
    einschaetzung: '',
    risikoVorhanden: false,
  },
  {
    titel: 'Leben in sozialen Beziehungen',
    kategorieId: 'soziales',
    beschreibung: '',
    einschaetzung: '',
    risikoVorhanden: false,
  },
  {
    titel: 'Haushaltsführung',
    kategorieId: 'haushalt',
    beschreibung: '',
    einschaetzung: '',
    risikoVorhanden: false,
  },
];

export const SisView: React.FC<SisViewProps> = ({
  klienten,
  canEditSis,
  onSelectKlient,
  onUpdateKlient,
}) => {
  const [selectedKlientId, setSelectedKlientId] = useState(klienten[0]?.id || '');
  const [isEditing, setIsEditing] = useState(false);
  const [sisDraft, setSisDraft] = useState<SisKategorie[]>([]);
  const [risikoDraft, setRisikoDraft] = useState<SisRisikomatrix | null>(null);

  const activeKlient = klienten.find((k) => k.id === selectedKlientId) || klienten[0];

  useEffect(() => {
    setIsEditing(false);
  }, [activeKlient?.id, canEditSis]);

  const handleStartEdit = () => {
    if (!activeKlient || !canEditSis) return;
    const merged = DEFAULT_SIS_TEMPLATE.map((tpl) => {
      const existing = activeKlient.sisKategorien.find(
        (k) => k.kategorieId === tpl.kategorieId
      );
      return existing ? { ...existing } : { ...tpl };
    });
    setSisDraft(merged);
    setRisikoDraft({ ...activeKlient.risikomatrix });
    setIsEditing(true);
  };

  const handleSave = () => {
    if (!activeKlient || !risikoDraft || !canEditSis) return;
    onUpdateKlient(
      {
        ...activeKlient,
        sisKategorien: sisDraft,
        risikomatrix: risikoDraft,
      },
      'SIS-Themenfelder und MDK Risikomatrix aktualisiert'
    );
    setIsEditing(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 border border-slate-200 rounded-lg shadow-xs">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-800 uppercase tracking-wider mb-1">
            <FileHeart className="w-3.5 h-3.5" />
            <span>MDK-Standard Pflegedokumentation</span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">
            Strukturierte Informationssammlung (SIS)
          </h1>
          <p className="text-xs text-slate-500">
            Entbürokratisierte Pflegedokumentation in 6 wissenschaftlichen Themenfeldern mit Risikomatrix
          </p>
        </div>

        {/* Klienten-Auswahl & Edit Action */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 font-medium whitespace-nowrap">Klient:</label>
          <select
            value={activeKlient?.id}
            onChange={(e) => {
              setSelectedKlientId(e.target.value);
              onSelectKlient(e.target.value);
            }}
            className="p-1.5 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
          >
            {klienten.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nachname}, {k.vorname} (PG {k.pflegegrad})
              </option>
            ))}
          </select>

          {activeKlient &&
            canEditSis &&
            (!isEditing ? (
              <button
                onClick={handleStartEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-900 bg-teal-50 border border-teal-300 hover:bg-teal-100 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Bearbeiten</span>
              </button>
            ) : (
              <>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer whitespace-nowrap shrink-0"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Speichern</span>
                </button>
              </>
            ))}
        </div>
      </div>

      {activeKlient && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* 6 SIS Categories (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <h2 className="text-sm font-bold text-slate-900 mb-3">
                Die 6 SIS-Themenfelder für {activeKlient.vorname} {activeKlient.nachname}
              </h2>

              <div className="space-y-3.5">
                {isEditing ? (
                  sisDraft.map((kat, idx) => (
                    <div
                      key={kat.kategorieId}
                      className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-2.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-teal-800 text-white flex items-center justify-center font-mono text-xs font-bold">
                            {idx + 1}
                          </span>
                          <span className="font-bold text-slate-900 text-xs">{kat.titel}</span>
                        </div>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={kat.risikoVorhanden}
                            onChange={(e) => {
                              const next = [...sisDraft];
                              next[idx] = { ...kat, risikoVorhanden: e.target.checked };
                              setSisDraft(next);
                            }}
                            className="rounded accent-rose-600"
                          />
                          <span className="text-rose-800 font-medium">Risiko vorhanden</span>
                        </label>
                      </div>

                      <div>
                        <label className="text-[11px] font-medium text-slate-600 block mb-1">
                          Sicht des Pflegebedürftigen:
                        </label>
                        <textarea
                          rows={2}
                          value={kat.beschreibung}
                          onChange={(e) => {
                            const next = [...sisDraft];
                            next[idx] = { ...kat, beschreibung: e.target.value };
                            setSisDraft(next);
                          }}
                          className="w-full p-2 bg-white border border-slate-300 rounded text-xs"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-medium text-teal-800 block mb-1">
                          Fachliche Beurteilung der Pflegefachkraft:
                        </label>
                        <input
                          type="text"
                          value={kat.einschaetzung}
                          onChange={(e) => {
                            const next = [...sisDraft];
                            next[idx] = { ...kat, einschaetzung: e.target.value };
                            setSisDraft(next);
                          }}
                          className="w-full p-2 bg-white border border-slate-300 rounded text-xs"
                        />
                      </div>
                    </div>
                  ))
                ) : activeKlient.sisKategorien.length > 0 ? (
                  activeKlient.sisKategorien.map((kat, idx) => (
                    <div
                      key={kat.kategorieId}
                      className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-teal-800 text-white flex items-center justify-center font-mono text-xs font-bold">
                            {idx + 1}
                          </span>
                          <span className="font-bold text-slate-900 text-xs">{kat.titel}</span>
                        </div>
                        {kat.risikoVorhanden ? (
                          <span className="text-[11px] font-mono text-rose-700 font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            Risiko erkannt
                          </span>
                        ) : (
                          <span className="text-[11px] font-mono text-emerald-700 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Stabil
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-700">
                        <span className="font-semibold text-slate-800">
                          Sicht des Pflegebedürftigen:{' '}
                        </span>
                        {kat.beschreibung || '—'}
                      </div>

                      <div className="text-xs text-slate-700 bg-white p-2 rounded border border-slate-200">
                        <span className="font-semibold text-teal-800">
                          Fachliche Beurteilung der Pflegefachkraft:{' '}
                        </span>
                        {kat.einschaetzung || '—'}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-slate-400 text-xs">
                    {canEditSis
                      ? 'Keine SIS-Einträge für diesen Klienten hinterlegt. Klicken Sie oben auf „Bearbeiten“, um die Themenfelder zu erfassen.'
                      : 'Keine SIS-Einträge für diesen Klienten hinterlegt.'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Risikomatrix (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-teal-700" />
                <span>MDK Risikomatrix</span>
              </h2>
              <p className="text-xs text-slate-500">
                Pflegerische Risikofaktoren nach nationalen Expertenstandards
              </p>

              <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                {(
                  [
                    { key: 'dekubitus', label: 'Dekubitusrisiko (Braden)' },
                    { key: 'sturz', label: 'Sturzrisiko' },
                    { key: 'inkontinenz', label: 'Inkontinenzförderung' },
                    { key: 'schmerz', label: 'Schmerzmanagement' },
                    { key: 'ernaehrung', label: 'Mangelernährung / Dehydration' },
                  ] as const
                ).map((item) => {
                  const active = isEditing && risikoDraft
                    ? risikoDraft[item.key]
                    : activeKlient.risikomatrix[item.key];

                  if (isEditing && risikoDraft) {
                    return (
                      <label
                        key={item.key}
                        className={`p-2.5 rounded border flex items-center justify-between cursor-pointer ${
                          active
                            ? 'bg-rose-50 border-rose-200 text-rose-900 font-semibold'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={(e) =>
                              setRisikoDraft({ ...risikoDraft, [item.key]: e.target.checked })
                            }
                            className="accent-rose-600"
                          />
                          <span>{item.label}</span>
                        </span>
                        <span className="font-mono text-xs">{active ? 'JA' : 'Nein'}</span>
                      </label>
                    );
                  }

                  return (
                    <div
                      key={item.key}
                      className={`p-2.5 rounded border flex items-center justify-between ${
                        active
                          ? 'bg-rose-50 border-rose-200 text-rose-900 font-semibold'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <span>{item.label}</span>
                      <span className="font-mono text-xs">{active ? 'JA (Aktiv)' : 'Nein'}</span>
                    </div>
                  );
                })}
              </div>

              {isEditing && risikoDraft ? (
                <div className="mt-3 space-y-1">
                  <label className="font-semibold text-slate-900 block text-xs">
                    Pflegerische Maßnahmen:
                  </label>
                  <textarea
                    rows={3}
                    value={risikoDraft.bemerkungen}
                    onChange={(e) =>
                      setRisikoDraft({ ...risikoDraft, bemerkungen: e.target.value })
                    }
                    className="w-full p-2 bg-white border border-slate-300 rounded text-xs"
                  />
                </div>
              ) : (
                activeKlient.risikomatrix.bemerkungen && (
                  <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700">
                    <span className="font-semibold text-slate-900 block mb-1">
                      Pflegerische Maßnahmen:
                    </span>
                    {activeKlient.risikomatrix.bemerkungen}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
