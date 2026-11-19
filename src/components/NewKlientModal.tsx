import React, { useState } from 'react';
import { Klient, Pflegegrad } from '../types/pflege';

interface NewKlientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddKlient: (klient: Klient) => void;
}

export const NewKlientModal: React.FC<NewKlientModalProps> = ({
  isOpen,
  onClose,
  onAddKlient,
}) => {
  const [nachname, setNachname] = useState('');
  const [vorname, setVorname] = useState('');
  const [geburtsdatum, setGeburtsdatum] = useState('1940-01-01');
  const [geschlecht, setGeschlecht] = useState<'w' | 'm' | 'd'>('w');
  const [strasse, setStrasse] = useState('');
  const [hausnummer, setHausnummer] = useState('');
  const [plz, setPlz] = useState('10115');
  const [ort, setOrt] = useState('Berlin');
  const [telefon, setTelefon] = useState('');
  const [pflegegrad, setPflegegrad] = useState<Pflegegrad>(2);
  const [kasse, setKasse] = useState('AOK Nordost');
  const [ik, setIk] = useState('108018007');
  const [versNr, setVersNr] = useState('');
  const [diagnoseText, setDiagnoseText] = useState('Essentielle Hypertonie');
  const [icdCode, setIcdCode] = useState('I10');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nachname.trim() || !vorname.trim()) return;

    const newId = `k-${Date.now()}`;
    const newKlient: Klient = {
      id: newId,
      nachname: nachname.trim(),
      vorname: vorname.trim(),
      geburtsdatum,
      geschlecht,
      strasse: strasse.trim() || 'Hauptstraße',
      hausnummer: hausnummer.trim() || '1',
      plz,
      ort,
      telefon: telefon.trim() || '030 1234567',
      pflegegrad,
      pflegegradSeit: new Date().toISOString().split('T')[0],
      krankenkasse: kasse,
      ikNummer: ik,
      versichertennummer: versNr.trim() || `X${Math.floor(Math.random() * 900000000 + 100000000)}`,
      zuzahlungsbefreit: false,
      diagnosen: [{ icd: icdCode, text: diagnoseText }],
      hausarzt: {
        name: 'Dr. med. Christian Braun',
        telefon: '030 2829001',
        praxis: 'Hausarztpraxis Zentrum',
      },
      notfallkontakt: {
        name: 'Familienangehöriger',
        beziehung: 'Angehöriger',
        telefon: '0170 1234567',
      },
      schluesselDepot: 'Haustürschlüssel beim Pflegedienst hinterlegt',
      tourId: 'tour-1',
      gebuchteLeistungen: ['LK 01', 'SGBV-04'],
      vitalwerte: [
        {
          id: `vw-${Date.now()}`,
          datum: new Date().toISOString().split('T')[0],
          uhrzeit: '08:00',
          blutdruckSystolisch: 130,
          blutdruckDiastolisch: 80,
          puls: 72,
          erfasstVon: 'PDL',
        },
      ],
      pflegeberichte: [
        {
          id: `pb-${Date.now()}`,
          datum: new Date().toISOString().split('T')[0],
          uhrzeit: '08:00',
          kategorie: 'Alltag',
          text: 'Erstaufnahme in den ambulanten Pflegedienst durchgeführt.',
          mitarbeiterKuerzel: 'PDL',
        },
      ],
      sisKategorien: [
        {
          titel: 'Kognition und Kommunikation',
          kategorieId: 'kognition',
          beschreibung: 'Orientiert zu Person und Ort.',
          einschaetzung: 'Selbstständig.',
          risikoVorhanden: false,
        },
        {
          titel: 'Mobilität und Beweglichkeit',
          kategorieId: 'mobilitaet',
          beschreibung: 'Rollatornutzung bei längeren Strecken.',
          einschaetzung: 'Teilweise selbstständig.',
          risikoVorhanden: true,
        },
      ],
      risikomatrix: {
        dekubitus: false,
        sturz: true,
        inkontinenz: false,
        schmerz: false,
        ernaehrung: false,
        bemerkungen: 'Erstanamnese abgeschlossen.',
      },
      medikamente: [],
    };

    onAddKlient(newKlient);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl border border-slate-200 max-w-xl w-full max-h-[90dvh] overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
        <div className="flex justify-between items-center pb-2 border-b border-slate-200">
          <h3 className="font-bold text-slate-900 text-sm">Neuen Klienten aufnehmen</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 cursor-pointer font-bold"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-700 font-medium block mb-1">Nachname *</label>
              <input
                type="text"
                required
                value={nachname}
                onChange={(e) => setNachname(e.target.value)}
                placeholder="z.B. Lehmann"
                className="w-full p-2 border border-slate-300 rounded font-medium"
              />
            </div>
            <div>
              <label className="text-slate-700 font-medium block mb-1">Vorname *</label>
              <input
                type="text"
                required
                value={vorname}
                onChange={(e) => setVorname(e.target.value)}
                placeholder="z.B. Erika"
                className="w-full p-2 border border-slate-300 rounded font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-slate-700 font-medium block mb-1">Geburtsdatum</label>
              <input
                type="date"
                value={geburtsdatum}
                onChange={(e) => setGeburtsdatum(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded font-mono"
              />
            </div>
            <div>
              <label className="text-slate-700 font-medium block mb-1">Geschlecht</label>
              <select
                value={geschlecht}
                onChange={(e) => setGeschlecht(e.target.value as any)}
                className="w-full p-2 border border-slate-300 rounded"
              >
                <option value="w">Weiblich</option>
                <option value="m">Männlich</option>
                <option value="d">Divers</option>
              </select>
            </div>
            <div>
              <label className="text-slate-700 font-medium block mb-1">Pflegegrad (SGB XI)</label>
              <select
                value={pflegegrad}
                onChange={(e) => setPflegegrad(Number(e.target.value) as Pflegegrad)}
                className="w-full p-2 border border-slate-300 rounded font-mono font-bold"
              >
                <option value={1}>Pflegegrad 1</option>
                <option value={2}>Pflegegrad 2</option>
                <option value={3}>Pflegegrad 3</option>
                <option value={4}>Pflegegrad 4</option>
                <option value={5}>Pflegegrad 5</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-slate-700 font-medium block mb-1">Straße &amp; Hausnummer</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Straße"
                  value={strasse}
                  onChange={(e) => setStrasse(e.target.value)}
                  className="flex-1 p-2 border border-slate-300 rounded"
                />
                <input
                  type="text"
                  placeholder="Nr."
                  value={hausnummer}
                  onChange={(e) => setHausnummer(e.target.value)}
                  className="w-16 p-2 border border-slate-300 rounded font-mono"
                />
              </div>
            </div>
            <div>
              <label className="text-slate-700 font-medium block mb-1">Telefon</label>
              <input
                type="text"
                placeholder="030..."
                value={telefon}
                onChange={(e) => setTelefon(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-slate-700 font-medium block mb-1">Krankenkasse</label>
              <input
                type="text"
                value={kasse}
                onChange={(e) => setKasse(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded"
              />
            </div>
            <div>
              <label className="text-slate-700 font-medium block mb-1">Kassen-IK</label>
              <input
                type="text"
                value={ik}
                onChange={(e) => setIk(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded font-mono"
              />
            </div>
            <div>
              <label className="text-slate-700 font-medium block mb-1">Versichertennummer</label>
              <input
                type="text"
                value={versNr}
                onChange={(e) => setVersNr(e.target.value)}
                placeholder="X..."
                className="w-full p-2 border border-slate-300 rounded font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-2">
              <label className="text-slate-700 font-medium block mb-1">Hauptdiagnose</label>
              <input
                type="text"
                value={diagnoseText}
                onChange={(e) => setDiagnoseText(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded"
              />
            </div>
            <div>
              <label className="text-slate-700 font-medium block mb-1">ICD-10 Code</label>
              <input
                type="text"
                value={icdCode}
                onChange={(e) => setIcdCode(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs text-slate-700 bg-slate-100 rounded hover:bg-slate-200 cursor-pointer"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-semibold text-white bg-teal-700 rounded hover:bg-teal-800 cursor-pointer shadow-xs"
            >
              Klient anlegen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
