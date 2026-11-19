import React, { useState } from 'react';
import { Pill, AlertTriangle, Plus, Search, ShieldCheck, Calendar } from 'lucide-react';
import { Klient, MedikationEintrag } from '../types/pflege';

interface MedikationViewProps {
  klienten: Klient[];
  canEditMedikation: boolean;
  canReadKlienten: boolean;
  onAddMedikation: (klientId: string, med: Omit<MedikationEintrag, 'id'>) => void;
  onSelectKlient: (klientId: string) => void;
  onSelectTab: (tab: string) => void;
}

export const MedikationView: React.FC<MedikationViewProps> = ({
  klienten,
  canEditMedikation,
  canReadKlienten,
  onAddMedikation,
  onSelectKlient,
  onSelectTab,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedKlientFilter, setSelectedKlientFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // New med form state
  const [targetKlientId, setTargetKlientId] = useState(klienten[0]?.id || '');
  const [handelsname, setHandelsname] = useState('');
  const [wirkstoff, setWirkstoff] = useState('');
  const [form, setForm] = useState('Tbl.');
  const [morgens, setMorgens] = useState(1);
  const [mittags, setMittags] = useState(0);
  const [abends, setAbends] = useState(0);
  const [nachts, setNachts] = useState(0);
  const [hinweis, setHinweis] = useState('');
  const [arzt, setArzt] = useState('');
  const [gueltigBis, setGueltigBis] = useState('2026-12-31');

  const allMeds = klienten.flatMap((k) =>
    k.medikamente.map((m) => ({
      ...m,
      patientName: `${k.nachname}, ${k.vorname}`,
      patientId: k.id,
      pflegegrad: k.pflegegrad,
    }))
  );

  const filteredMeds = allMeds.filter((m) => {
    const matchesSearch =
      `${m.handelsname} ${m.wirkstoff} ${m.patientName} ${m.verordnenderArzt}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    const matchesKlient = selectedKlientFilter === 'all' || m.patientId === selectedKlientFilter;
    return matchesSearch && matchesKlient;
  });

  const handleSaveMed = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditMedikation || !handelsname.trim() || !targetKlientId) return;

    onAddMedikation(targetKlientId, {
      handelsname: handelsname.trim(),
      wirkstoff: wirkstoff.trim() || handelsname.trim(),
      form,
      morgens: Number(morgens),
      mittags: Number(mittags),
      abends: Number(abends),
      nachts: Number(nachts),
      hinweis: hinweis.trim(),
      verordnenderArzt: arzt.trim() || 'Hausarzt',
      gueltigBis,
      sgbTyp: 'SGB V',
    });

    setShowAddModal(false);
    setHandelsname('');
    setWirkstoff('');
    setHinweis('');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 border border-slate-200 rounded-lg shadow-xs">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-800 uppercase tracking-wider mb-1">
            <Pill className="w-3.5 h-3.5" />
            <span>Bundesmedikationsplan (BMP) &amp; HKP</span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">
            Medikationsmanagement &amp; SGB V Verordnungen
          </h1>
          <p className="text-xs text-slate-500">
            Dosierschemata (M-M-A-N), Wechselwirkungsüberwachung und ärztliche Verordnungsfristen
          </p>
        </div>

        {canEditMedikation && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Medikament verordnen</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 border border-slate-200 rounded-lg text-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Präparat, Wirkstoff, Klient, Arzt..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-700 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-500">Nach Klient filtern:</span>
          <select
            value={selectedKlientFilter}
            onChange={(e) => setSelectedKlientFilter(e.target.value)}
            className="p-1.5 bg-slate-50 border border-slate-300 rounded-md font-medium text-slate-800 focus:outline-none"
          >
            <option value="all">Alle Klienten ({allMeds.length} Medikamente)</option>
            {klienten.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nachname}, {k.vorname}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Meds Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
            <tr>
              <th className="p-3">Klient</th>
              <th className="p-3">Handelsname &amp; Wirkstoff</th>
              <th className="p-3">Darreichung</th>
              <th className="p-3 font-mono text-center">Morgen - Mittag - Abend - Nacht</th>
              <th className="p-3">Hinweise zur Einnahme</th>
              <th className="p-3">Verordner / Gültigkeit</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredMeds.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400">
                  Keine Medikamente gefunden.
                </td>
              </tr>
            ) : (
              filteredMeds.map((med) => (
                <tr key={med.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3">
                    {canReadKlienten ? (
                      <button
                        onClick={() => {
                          onSelectKlient(med.patientId);
                          onSelectTab('klienten');
                        }}
                        className="font-semibold text-slate-900 hover:text-teal-700 cursor-pointer block"
                      >
                        {med.patientName}
                      </button>
                    ) : (
                      <span className="font-semibold text-slate-900 block">
                        {med.patientName}
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-slate-500">
                      PG {med.pflegegrad}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="font-bold text-slate-900">{med.handelsname}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{med.wirkstoff}</div>
                  </td>
                  <td className="p-3 text-slate-700">{med.form}</td>
                  <td className="p-3 font-mono text-center font-bold text-teal-800 text-sm">
                    {med.morgens} - {med.mittags} - {med.abends} - {med.nachts}
                  </td>
                  <td className="p-3 text-slate-700 max-w-xs">{med.hinweis || '-'}</td>
                  <td className="p-3 text-slate-600 text-[11px]">
                    <div>{med.verordnenderArzt}</div>
                    <div className="font-mono text-slate-400">bis {med.gueltigBis}</div>
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-teal-50 text-teal-800 border border-teal-200">
                      {med.sgbTyp} Genehmigt
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Medication Modal */}
      {canEditMedikation && showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 max-w-lg w-full p-5 space-y-4 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm">Neues Medikament erfassen</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveMed} className="space-y-3">
              <div>
                <label className="text-slate-700 font-medium block mb-1">Klient auswählen</label>
                <select
                  value={targetKlientId}
                  onChange={(e) => setTargetKlientId(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-medium text-slate-800"
                >
                  {klienten.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nachname}, {k.vorname} (PG {k.pflegegrad})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-medium block mb-1">Handelsname</label>
                  <input
                    type="text"
                    required
                    placeholder="z.B. Ramipril 5mg"
                    value={handelsname}
                    onChange={(e) => setHandelsname(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-medium block mb-1">Wirkstoff</label>
                  <input
                    type="text"
                    placeholder="z.B. Ramipril"
                    value={wirkstoff}
                    onChange={(e) => setWirkstoff(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded"
                  />
                </div>
              </div>

              <div className="grid grid-cols-5 gap-2">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Darreichung</label>
                  <select
                    value={form}
                    onChange={(e) => setForm(e.target.value)}
                    className="w-full p-1.5 border border-slate-300 rounded"
                  >
                    <option value="Tbl.">Tbl.</option>
                    <option value="Kps.">Kps.</option>
                    <option value="Tropfen">Tropfen</option>
                    <option value="Injektion s.c.">Injektion s.c.</option>
                    <option value="Salbe">Salbe</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Morgens</label>
                  <input
                    type="number"
                    step="0.5"
                    value={morgens}
                    onChange={(e) => setMorgens(Number(e.target.value))}
                    className="w-full p-1.5 border border-slate-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Mittags</label>
                  <input
                    type="number"
                    step="0.5"
                    value={mittags}
                    onChange={(e) => setMittags(Number(e.target.value))}
                    className="w-full p-1.5 border border-slate-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Abends</label>
                  <input
                    type="number"
                    step="0.5"
                    value={abends}
                    onChange={(e) => setAbends(Number(e.target.value))}
                    className="w-full p-1.5 border border-slate-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Nachts</label>
                  <input
                    type="number"
                    step="0.5"
                    value={nachts}
                    onChange={(e) => setNachts(Number(e.target.value))}
                    className="w-full p-1.5 border border-slate-300 rounded font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-medium block mb-1">Einnahmehinweis</label>
                <input
                  type="text"
                  placeholder="z.B. Nüchtern vor dem Frühstück mit Wasser"
                  value={hinweis}
                  onChange={(e) => setHinweis(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-medium block mb-1">Verordnender Arzt</label>
                  <input
                    type="text"
                    placeholder="z.B. Dr. med. Weber"
                    value={arzt}
                    onChange={(e) => setArzt(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-medium block mb-1">Gültig bis</label>
                  <input
                    type="date"
                    value={gueltigBis}
                    onChange={(e) => setGueltigBis(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-700 bg-slate-100 rounded hover:bg-slate-200 cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-teal-700 rounded hover:bg-teal-800 cursor-pointer shadow-xs"
                >
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
