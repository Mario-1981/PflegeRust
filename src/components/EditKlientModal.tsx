import React, { useState, useEffect } from 'react';
import {
  User,
  Building,
  Stethoscope,
  ClipboardList,
  Plus,
  Trash2,
  X,
  Save,
  AlertTriangle,
} from 'lucide-react';
import { Klient, Pflegegrad, Tour } from '../types/pflege';
import { STANDARD_LEISTUNGEN } from '../data/mockData';

interface EditKlientModalProps {
  isOpen: boolean;
  klient: Klient | null;
  touren: Tour[];
  onClose: () => void;
  onSave: (updatedKlient: Klient) => void;
  onDelete: (klientId: string) => void;
}

type ModalTab = 'person' | 'kasse' | 'kontakte' | 'leistungen';

export const EditKlientModal: React.FC<EditKlientModalProps> = ({
  isOpen,
  klient,
  touren,
  onClose,
  onSave,
  onDelete,
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('person');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Form states
  const [nachname, setNachname] = useState('');
  const [vorname, setVorname] = useState('');
  const [geburtsdatum, setGeburtsdatum] = useState('');
  const [geschlecht, setGeschlecht] = useState<'w' | 'm' | 'd'>('w');
  const [strasse, setStrasse] = useState('');
  const [hausnummer, setHausnummer] = useState('');
  const [plz, setPlz] = useState('');
  const [ort, setOrt] = useState('');
  const [telefon, setTelefon] = useState('');
  const [schluesselDepot, setSchluesselDepot] = useState('');

  // Kasse & Pflegegrad
  const [pflegegrad, setPflegegrad] = useState<Pflegegrad>(2);
  const [pflegegradSeit, setPflegegradSeit] = useState('');
  const [krankenkasse, setKrankenkasse] = useState('');
  const [ikNummer, setIkNummer] = useState('');
  const [versichertennummer, setVersichertennummer] = useState('');
  const [zuzahlungsbefreit, setZuzahlungsbefreit] = useState(false);
  const [tourId, setTourId] = useState('');
  const [snapLegacyId, setSnapLegacyId] = useState('');

  // Arzt & Notfallkontakt
  const [arztName, setArztName] = useState('');
  const [arztPraxis, setArztPraxis] = useState('');
  const [arztTelefon, setArztTelefon] = useState('');
  const [notfallName, setNotfallName] = useState('');
  const [notfallBeziehung, setNotfallBeziehung] = useState('');
  const [notfallTelefon, setNotfallTelefon] = useState('');

  // Diagnosen & Leistungen
  const [diagnosen, setDiagnosen] = useState<{ icd: string; text: string }[]>([]);
  const [newIcd, setNewIcd] = useState('');
  const [newDiagText, setNewDiagText] = useState('');
  const [gebuchteLeistungen, setGebuchteLeistungen] = useState<string[]>([]);

  useEffect(() => {
    if (klient && isOpen) {
      setActiveTab('person');
      setConfirmDelete(false);
      setNachname(klient.nachname);
      setVorname(klient.vorname);
      setGeburtsdatum(klient.geburtsdatum);
      setGeschlecht(klient.geschlecht);
      setStrasse(klient.strasse);
      setHausnummer(klient.hausnummer);
      setPlz(klient.plz);
      setOrt(klient.ort);
      setTelefon(klient.telefon);
      setSchluesselDepot(klient.schluesselDepot);

      setPflegegrad(klient.pflegegrad);
      setPflegegradSeit(klient.pflegegradSeit);
      setKrankenkasse(klient.krankenkasse);
      setIkNummer(klient.ikNummer);
      setVersichertennummer(klient.versichertennummer);
      setZuzahlungsbefreit(klient.zuzahlungsbefreit);
      setTourId(klient.tourId);
      setSnapLegacyId(klient.snapLegacyId || '');

      setArztName(klient.hausarzt.name);
      setArztPraxis(klient.hausarzt.praxis);
      setArztTelefon(klient.hausarzt.telefon);
      setNotfallName(klient.notfallkontakt.name);
      setNotfallBeziehung(klient.notfallkontakt.beziehung);
      setNotfallTelefon(klient.notfallkontakt.telefon);

      setDiagnosen([...klient.diagnosen]);
      setGebuchteLeistungen([...klient.gebuchteLeistungen]);
      setNewIcd('');
      setNewDiagText('');
    }
  }, [klient, isOpen]);

  if (!isOpen || !klient) return null;

  const handleAddDiagnose = () => {
    if (!newIcd.trim() || !newDiagText.trim()) return;
    setDiagnosen((prev) => [
      ...prev,
      { icd: newIcd.trim().toUpperCase(), text: newDiagText.trim() },
    ]);
    setNewIcd('');
    setNewDiagText('');
  };

  const handleRemoveDiagnose = (index: number) => {
    setDiagnosen((prev) => prev.filter((_, i) => i !== index));
  };

  const handleToggleLeistung = (code: string) => {
    setGebuchteLeistungen((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nachname.trim() || !vorname.trim()) return;

    const updated: Klient = {
      ...klient,
      nachname: nachname.trim(),
      vorname: vorname.trim(),
      geburtsdatum,
      geschlecht,
      strasse: strasse.trim(),
      hausnummer: hausnummer.trim(),
      plz: plz.trim(),
      ort: ort.trim(),
      telefon: telefon.trim(),
      schluesselDepot: schluesselDepot.trim(),
      pflegegrad,
      pflegegradSeit,
      krankenkasse: krankenkasse.trim(),
      ikNummer: ikNummer.trim(),
      versichertennummer: versichertennummer.trim(),
      zuzahlungsbefreit,
      tourId,
      snapLegacyId: snapLegacyId.trim() || undefined,
      hausarzt: {
        name: arztName.trim(),
        praxis: arztPraxis.trim(),
        telefon: arztTelefon.trim(),
      },
      notfallkontakt: {
        name: notfallName.trim(),
        beziehung: notfallBeziehung.trim(),
        telefon: notfallTelefon.trim(),
      },
      diagnosen,
      gebuchteLeistungen,
    };

    onSave(updated);
    onClose();
  };

  const tabs: { id: ModalTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'person', label: 'Person & Adresse', icon: User },
    { id: 'kasse', label: 'Kasse & Pflegegrad', icon: Building },
    { id: 'kontakte', label: 'Arzt & Notfall', icon: Stethoscope },
    { id: 'leistungen', label: 'Diagnosen & Leistungen', icon: ClipboardList },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl border border-slate-200 max-w-2xl w-full flex flex-col max-h-[90vh] text-xs">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              Klient bearbeiten: {klient.nachname}, {klient.vorname}
            </h3>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
              ID: {klient.id}
              {klient.snapLegacyId ? ` · SNAP: ${klient.snapLegacyId}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 pt-3 border-b border-slate-200 bg-slate-50 flex items-center gap-1 overflow-x-auto shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'border-teal-700 text-teal-800 bg-white rounded-t-md font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 overflow-y-auto flex-1 space-y-4">
            {activeTab === 'person' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-700 font-medium block mb-1">Nachname *</label>
                    <input
                      type="text"
                      required
                      value={nachname}
                      onChange={(e) => setNachname(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-700 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-slate-700 font-medium block mb-1">Vorname *</label>
                    <input
                      type="text"
                      required
                      value={vorname}
                      onChange={(e) => setVorname(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-700 text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-slate-700 font-medium block mb-1">Geburtsdatum *</label>
                    <input
                      type="date"
                      required
                      value={geburtsdatum}
                      onChange={(e) => setGeburtsdatum(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-md font-mono focus:outline-none focus:ring-1 focus:ring-teal-700"
                    />
                  </div>
                  <div>
                    <label className="text-slate-700 font-medium block mb-1">Geschlecht</label>
                    <select
                      value={geschlecht}
                      onChange={(e) => setGeschlecht(e.target.value as 'w' | 'm' | 'd')}
                      className="w-full p-2 border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-teal-700"
                    >
                      <option value="w">Weiblich</option>
                      <option value="m">Männlich</option>
                      <option value="d">Divers</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-700 font-medium block mb-1">Telefon</label>
                    <input
                      type="text"
                      value={telefon}
                      onChange={(e) => setTelefon(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-md font-mono focus:outline-none focus:ring-1 focus:ring-teal-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-3">
                    <label className="text-slate-700 font-medium block mb-1">Straße</label>
                    <input
                      type="text"
                      value={strasse}
                      onChange={(e) => setStrasse(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-700"
                    />
                  </div>
                  <div>
                    <label className="text-slate-700 font-medium block mb-1">Hausnr.</label>
                    <input
                      type="text"
                      value={hausnummer}
                      onChange={(e) => setHausnummer(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-md font-mono focus:outline-none focus:ring-1 focus:ring-teal-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-slate-700 font-medium block mb-1">PLZ</label>
                    <input
                      type="text"
                      value={plz}
                      onChange={(e) => setPlz(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-md font-mono focus:outline-none focus:ring-1 focus:ring-teal-700"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-slate-700 font-medium block mb-1">Ort</label>
                    <input
                      type="text"
                      value={ort}
                      onChange={(e) => setOrt(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-700 font-medium block mb-1">
                    Schlüsselhinterlegung / Zugangshinweis
                  </label>
                  <input
                    type="text"
                    value={schluesselDepot}
                    onChange={(e) => setSchluesselDepot(e.target.value)}
                    placeholder="z.B. Schlüsselsafe neben Haustür (Code 2941)"
                    className="w-full p-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-700"
                  />
                </div>
              </div>
            )}

            {activeTab === 'kasse' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-700 font-medium block mb-1">
                      Pflegegrad (SGB XI)
                    </label>
                    <select
                      value={pflegegrad}
                      onChange={(e) => setPflegegrad(Number(e.target.value) as Pflegegrad)}
                      className="w-full p-2 border border-slate-300 rounded-md font-mono font-bold bg-white focus:outline-none focus:ring-1 focus:ring-teal-700"
                    >
                      <option value={1}>Pflegegrad 1</option>
                      <option value={2}>Pflegegrad 2</option>
                      <option value={3}>Pflegegrad 3</option>
                      <option value={4}>Pflegegrad 4</option>
                      <option value={5}>Pflegegrad 5</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-700 font-medium block mb-1">
                      Pflegegrad gültig seit
                    </label>
                    <input
                      type="date"
                      value={pflegegradSeit}
                      onChange={(e) => setPflegegradSeit(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-md font-mono focus:outline-none focus:ring-1 focus:ring-teal-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-slate-700 font-medium block mb-1">Krankenkasse</label>
                    <input
                      type="text"
                      value={krankenkasse}
                      onChange={(e) => setKrankenkasse(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-700"
                    />
                  </div>
                  <div>
                    <label className="text-slate-700 font-medium block mb-1">IK-Nummer</label>
                    <input
                      type="text"
                      value={ikNummer}
                      onChange={(e) => setIkNummer(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-md font-mono focus:outline-none focus:ring-1 focus:ring-teal-700"
                    />
                  </div>
                  <div>
                    <label className="text-slate-700 font-medium block mb-1">
                      Versichertennummer
                    </label>
                    <input
                      type="text"
                      value={versichertennummer}
                      onChange={(e) => setVersichertennummer(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-md font-mono focus:outline-none focus:ring-1 focus:ring-teal-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-700 font-medium block mb-1">
                      Zugeordnete Stammtour
                    </label>
                    <select
                      value={tourId}
                      onChange={(e) => setTourId(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-teal-700"
                    >
                      {touren.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.schicht})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-700 font-medium block mb-1">
                      SNAP Legacy-ID (optional)
                    </label>
                    <input
                      type="text"
                      value={snapLegacyId}
                      onChange={(e) => setSnapLegacyId(e.target.value)}
                      placeholder="z.B. SNAP-2023-0101"
                      className="w-full p-2 border border-slate-300 rounded-md font-mono focus:outline-none focus:ring-1 focus:ring-teal-700"
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={zuzahlungsbefreit}
                      onChange={(e) => setZuzahlungsbefreit(e.target.checked)}
                      className="w-4 h-4 rounded text-teal-700 accent-teal-700"
                    />
                    <div>
                      <span className="font-semibold text-slate-800 block">
                        Zuzahlungsbefreit (§ 62 SGB V)
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Befreiungsausweis liegt dem Pflegedienst vor
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'kontakte' && (
              <div className="space-y-5">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                  <div className="font-semibold text-slate-900">Behandelnder Hausarzt</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-700 font-medium block mb-1">Name des Arztes</label>
                      <input
                        type="text"
                        value={arztName}
                        onChange={(e) => setArztName(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-700"
                      />
                    </div>
                    <div>
                      <label className="text-slate-700 font-medium block mb-1">Telefonnummer</label>
                      <input
                        type="text"
                        value={arztTelefon}
                        onChange={(e) => setArztTelefon(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-300 rounded-md font-mono focus:outline-none focus:ring-1 focus:ring-teal-700"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-slate-700 font-medium block mb-1">Praxisbezeichnung</label>
                    <input
                      type="text"
                      value={arztPraxis}
                      onChange={(e) => setArztPraxis(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-700"
                    />
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                  <div className="font-semibold text-slate-900">Angehöriger / Notfallkontakt</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-700 font-medium block mb-1">Name</label>
                      <input
                        type="text"
                        value={notfallName}
                        onChange={(e) => setNotfallName(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-700"
                      />
                    </div>
                    <div>
                      <label className="text-slate-700 font-medium block mb-1">
                        Beziehung / Vollmacht
                      </label>
                      <input
                        type="text"
                        value={notfallBeziehung}
                        onChange={(e) => setNotfallBeziehung(e.target.value)}
                        placeholder="z.B. Sohn (Vorsorgevollmacht)"
                        className="w-full p-2 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-700"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-slate-700 font-medium block mb-1">Telefonnummer</label>
                    <input
                      type="text"
                      value={notfallTelefon}
                      onChange={(e) => setNotfallTelefon(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-md font-mono focus:outline-none focus:ring-1 focus:ring-teal-700"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'leistungen' && (
              <div className="space-y-5">
                {/* Diagnosen */}
                <div className="space-y-2.5">
                  <div className="font-semibold text-slate-900">Ärztliche Diagnosen (ICD-10)</div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newIcd}
                      onChange={(e) => setNewIcd(e.target.value)}
                      placeholder="ICD-10 (z.B. I10)"
                      className="w-32 p-2 border border-slate-300 rounded-md font-mono focus:outline-none focus:ring-1 focus:ring-teal-700"
                    />
                    <input
                      type="text"
                      value={newDiagText}
                      onChange={(e) => setNewDiagText(e.target.value)}
                      placeholder="Diagnosebezeichnung..."
                      className="flex-1 p-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-700"
                    />
                    <button
                      type="button"
                      onClick={handleAddDiagnose}
                      className="flex items-center gap-1 px-3 py-2 font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md transition-colors cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Hinzufügen</span>
                    </button>
                  </div>

                  {diagnosen.length === 0 ? (
                    <div className="p-3 text-slate-400 bg-slate-50 border border-slate-200 rounded-md text-center">
                      Noch keine Diagnosen hinterlegt.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-md">
                      {diagnosen.map((diag, idx) => (
                        <div
                          key={`${diag.icd}-${idx}`}
                          className="p-2.5 flex items-center justify-between gap-3 hover:bg-slate-50"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="font-mono font-bold text-slate-800 shrink-0">
                              {diag.icd}
                            </span>
                            <span className="text-slate-400">·</span>
                            <span className="text-slate-700 truncate">{diag.text}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveDiagnose(idx)}
                            title="Diagnose entfernen"
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Gebuchte Leistungen */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">
                      Vereinbarte Leistungsmodule (SGB XI / SGB V)
                    </span>
                    <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                      {gebuchteLeistungen.length} ausgewählt
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {STANDARD_LEISTUNGEN.map((lk) => {
                      const isChecked = gebuchteLeistungen.includes(lk.code);
                      return (
                        <label
                          key={lk.code}
                          className={`p-2.5 rounded-md border flex items-start gap-2.5 cursor-pointer transition-colors ${
                            isChecked
                              ? 'bg-teal-50/70 border-teal-300 text-slate-900'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleLeistung(lk.code)}
                            className="mt-0.5 rounded accent-teal-700"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-teal-800">{lk.code}</span>
                              <span className="text-slate-400">·</span>
                              <span className="text-[11px] text-slate-500">{lk.typ}</span>
                            </div>
                            <div className="text-[11px] text-slate-600 leading-snug mt-0.5">
                              {lk.bezeichnung}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
            <div>
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Klient entfernen</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-md">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span className="text-rose-900 font-medium">Wirklich löschen?</span>
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(klient.id);
                      onClose();
                    }}
                    className="px-2 py-0.5 text-[11px] font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded cursor-pointer"
                  >
                    Ja, löschen
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-2 py-0.5 text-[11px] font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 cursor-pointer"
                  >
                    Nein
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md transition-colors cursor-pointer shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Änderungen speichern</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
