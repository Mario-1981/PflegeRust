import React, { useState } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Key,
  Car,
  User,
  Plus,
  Calendar,
} from 'lucide-react';
import { Tour, Klient, TourHalt } from '../types/pflege';

interface TourenViewProps {
  touren: Tour[];
  klienten: Klient[];
  canConfirmTouren: boolean;
  canReadKlienten: boolean;
  onToggleHaltStatus: (tourId: string, haltId: string, notes?: string) => void;
  onSelectKlient: (klientId: string) => void;
  onSelectTab: (tab: string) => void;
}

export const TourenView: React.FC<TourenViewProps> = ({
  touren,
  klienten,
  canConfirmTouren,
  canReadKlienten,
  onToggleHaltStatus,
  onSelectKlient,
  onSelectTab,
}) => {
  const [selectedTourId, setSelectedTourId] = useState(touren[0]?.id || '');
  const [editingHaltId, setEditingHaltId] = useState<string | null>(null);
  const [haltNote, setHaltNote] = useState('');

  const activeTour = touren.find((t) => t.id === selectedTourId) || touren[0];

  const handleSaveNote = (haltId: string) => {
    if (!canConfirmTouren) return;
    onToggleHaltStatus(activeTour.id, haltId, haltNote);
    setEditingHaltId(null);
    setHaltNote('');
  };

  return (
    <div className="space-y-5">
      {/* Tour Selector Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 border border-slate-200 rounded-lg shadow-xs">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">
            Tourenplanung &amp; Einsatzdisposition
          </h1>
          <p className="text-xs text-slate-500">
            Ambulante Touren, Echtzeit-Quittierung und Übergabedokumentation
          </p>
        </div>

        {/* Tour Segmented Buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200 overflow-x-auto">
          {touren.map((t) => {
            const isSelected = t.id === activeTour?.id;
            const erledigtCount = t.halte.filter((h) => h.status === 'Erledigt').length;
            return (
              <button
                key={t.id}
                onClick={() => setSelectedTourId(t.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-teal-700 text-white font-semibold shadow-xs'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <span>{t.name}</span>
                <span className={`ml-2 font-mono text-[11px] ${isSelected ? 'text-teal-200' : 'text-slate-500'}`}>
                  {erledigtCount}/{t.halte.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {activeTour ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Tour Meta Panel (3 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
              <div className="text-xs uppercase font-semibold text-slate-400">
                Tour Details
              </div>
              <h2 className="text-base font-bold text-slate-900">
                {activeTour.name}
              </h2>

              <div className="space-y-2 text-xs pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    Zugeordnete Pflegekraft:
                  </span>
                  <span className="font-mono font-bold text-slate-800">
                    {activeTour.fahrerKuerzel}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Car className="w-3.5 h-3.5 text-slate-400" />
                    Dienstfahrzeug:
                  </span>
                  <span className="font-mono text-slate-800">
                    {activeTour.fahrzeugKennzeichen}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Schichtart:
                  </span>
                  <span className="font-medium text-slate-800">
                    {activeTour.schicht}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    Tourengebiet:
                  </span>
                  <span className="text-slate-800 truncate max-w-[160px]">
                    {activeTour.bereich}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Helper / Instructions */}
            <div className="bg-teal-50/60 border border-teal-200/80 rounded-lg p-4 text-xs text-teal-900 space-y-2">
              <div className="font-semibold text-teal-950">Mobile Vor-Ort-Quittierung</div>
              <p className="text-teal-800 leading-relaxed">
                Pflegekräfte können Einsätze direkt vor Ort abhaken. Nach Abschluss wird die Einsatzzeit minutengenau für die Leistungsabrechnung nach SGB XI (§ 105) und SGB V (§ 302) dokumentiert.
              </p>
            </div>
          </div>

          {/* Stops List (8 cols) */}
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-medium text-slate-700">
              <span>Geplante Haltepunkte ({activeTour.halte.length} Klienten)</span>
              <span>Reihenfolge zeitoptimiert</span>
            </div>

            <div className="divide-y divide-slate-100">
              {activeTour.halte.map((halt, idx) => {
                const k = klienten.find((c) => c.id === halt.klientId);
                if (!k) return null;
                const isErledigt = halt.status === 'Erledigt';
                const isEditingThis = editingHaltId === halt.id;

                return (
                  <div
                    key={halt.id}
                    className={`p-4 transition-colors ${
                      isErledigt ? 'bg-slate-50/50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Left: Check button & Stop Order */}
                      <div className="flex items-start gap-3.5">
                        <div className="flex flex-col items-center">
                          {canConfirmTouren ? (
                            <button
                              onClick={() => onToggleHaltStatus(activeTour.id, halt.id)}
                              className="mt-0.5 cursor-pointer text-slate-400 hover:text-teal-700 transition-colors"
                              title={isErledigt ? 'Als ausstehend markieren' : 'Einsatz als erledigt quittieren'}
                            >
                              {isErledigt ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                              ) : (
                                <div className="w-5 h-5 rounded-full border-2 border-slate-300 hover:border-teal-700 flex items-center justify-center text-[10px] font-mono text-slate-500 font-bold">
                                  {idx + 1}
                                </div>
                              )}
                            </button>
                          ) : (
                            <span
                              className="mt-0.5 text-slate-400"
                              title="Nur Lesezugriff (Quittierung nicht in Rolle erlaubt)"
                            >
                              {isErledigt ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                              ) : (
                                <div className="w-5 h-5 rounded-full border-2 border-slate-200 flex items-center justify-center text-[10px] font-mono text-slate-400 font-bold">
                                  {idx + 1}
                                </div>
                              )}
                            </span>
                          )}
                        </div>

                        {/* Middle: Client Info & Services */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-900">
                              {halt.geplanteUhrzeit} Uhr
                            </span>
                            <span className="text-slate-400">·</span>
                            {canReadKlienten ? (
                              <button
                                onClick={() => {
                                  onSelectKlient(k.id);
                                  onSelectTab('klienten');
                                }}
                                className="text-sm font-semibold text-slate-900 hover:text-teal-700 cursor-pointer"
                              >
                                {k.nachname}, {k.vorname}
                              </button>
                            ) : (
                              <span className="text-sm font-semibold text-slate-900">
                                {k.nachname}, {k.vorname}
                              </span>
                            )}
                            <span className="font-mono text-[11px] px-1.5 py-0.2 bg-teal-100 text-teal-800 rounded font-bold">
                              PG {k.pflegegrad}
                            </span>
                          </div>

                          <div className="text-xs text-slate-600 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span>{k.strasse} {k.hausnummer}, {k.ort}</span>
                          </div>

                          {k.schluesselDepot && (
                            <div className="text-[11px] text-amber-800 flex items-center gap-1.5 mt-0.5">
                              <Key className="w-3 h-3 text-amber-600" />
                              <span>{k.schluesselDepot}</span>
                            </div>
                          )}

                          {/* Service Pills / Tags */}
                          <div className="flex flex-wrap gap-1.5 pt-1.5">
                            {halt.leistungCodes.map((code) => (
                              <span
                                key={code}
                                className="font-mono text-[11px] px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded"
                              >
                                {code}
                              </span>
                            ))}
                            <span className="text-[11px] text-slate-400 self-center">
                              (~{halt.geschaetzteDauerMinuten} Min)
                            </span>
                          </div>

                          {/* Notes if present */}
                          {halt.notizen && (
                            <div className="mt-2 text-xs bg-slate-100 p-2 rounded text-slate-700 border-l-2 border-teal-700">
                              <span className="font-semibold text-slate-800">Übergabenotiz: </span>
                              {halt.notizen}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span
                          className={`text-xs px-2.5 py-1 rounded font-medium ${
                            isErledigt
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {halt.status}
                        </span>

                        {canConfirmTouren && (
                          <button
                            onClick={() => {
                              setEditingHaltId(isEditingThis ? null : halt.id);
                              setHaltNote(halt.notizen || '');
                            }}
                            className="text-[11px] text-slate-500 hover:text-slate-800 cursor-pointer underline"
                          >
                            {isEditingThis ? 'Schließen' : 'Notiz hinzufügen'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Inline note editor */}
                    {canConfirmTouren && isEditingThis && (
                      <div className="mt-3 pl-8 flex gap-2">
                        <input
                          type="text"
                          value={haltNote}
                          onChange={(e) => setHaltNote(e.target.value)}
                          placeholder="Besonderheiten beim Einsatz eintragen..."
                          className="flex-1 p-1.5 text-xs bg-white border border-slate-300 rounded"
                        />
                        <button
                          onClick={() => handleSaveNote(halt.id)}
                          className="px-3 py-1 text-xs font-semibold text-white bg-teal-700 rounded hover:bg-teal-800 cursor-pointer"
                        >
                          Speichern
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-slate-400 text-xs">
          Keine Touren konfiguriert.
        </div>
      )}
    </div>
  );
};
