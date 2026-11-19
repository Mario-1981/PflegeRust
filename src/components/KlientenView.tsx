import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Phone,
  MapPin,
  Calendar,
  Key,
  Building,
  Pencil,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import {
  Klient,
  Tour,
  Vitalwert,
  PflegeberichtEintrag,
  SisKategorie,
  SisRisikomatrix,
  MedikationEintrag,
} from '../types/pflege';
import { EditKlientModal } from './EditKlientModal';

interface KlientenViewProps {
  klienten: Klient[];
  touren: Tour[];
  selectedKlientId: string | null;
  canEditKlienten: boolean;
  canDocumentCare: boolean;
  canReadSis: boolean;
  canEditSis: boolean;
  canReadMedikation: boolean;
  canEditMedikation: boolean;
  onSelectKlient: (id: string) => void;
  onOpenNewKlientModal: () => void;
  onUpdateKlient: (updatedKlient: Klient, auditDetails?: string) => void;
  onDeleteKlient: (klientId: string) => void;
  onAddVitalwert: (klientId: string, vitalwert: Omit<Vitalwert, 'id'>) => void;
  onAddPflegebericht: (klientId: string, bericht: Omit<PflegeberichtEintrag, 'id'>) => void;
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

export const KlientenView: React.FC<KlientenViewProps> = ({
  klienten,
  touren,
  selectedKlientId,
  canEditKlienten,
  canDocumentCare,
  canReadSis,
  canEditSis,
  canReadMedikation,
  canEditMedikation,
  onSelectKlient,
  onOpenNewKlientModal,
  onUpdateKlient,
  onDeleteKlient,
  onAddVitalwert,
  onAddPflegebericht,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPgFilter, setSelectedPgFilter] = useState<number | 'all'>('all');
  const [activeSubTab, setActiveSubTab] = useState<
    'stammdaten' | 'vitalwerte' | 'berichte' | 'sis' | 'medikation'
  >('stammdaten');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Form states for adding vital sign
  const [showVitalForm, setShowVitalForm] = useState(false);
  const [sys, setSys] = useState(130);
  const [dia, setDia] = useState(80);
  const [puls, setPuls] = useState(72);
  const [bz, setBz] = useState('');
  const [temp, setTemp] = useState('');

  // Form states for adding care report
  const [showBerichtForm, setShowBerichtForm] = useState(false);
  const [berichtKategorie, setBerichtKategorie] = useState<
    'Alltag' | 'Besonderheit' | 'Arztkontakt' | 'Vitalabweichung'
  >('Alltag');
  const [berichtText, setBerichtText] = useState('');

  // Inline SIS editing state
  const [isEditingSis, setIsEditingSis] = useState(false);
  const [sisDraft, setSisDraft] = useState<SisKategorie[]>([]);
  const [risikoDraft, setRisikoDraft] = useState<SisRisikomatrix | null>(null);

  // Inline Medikation editing / adding state
  const [showMedForm, setShowMedForm] = useState(false);
  const [editingMedId, setEditingMedId] = useState<string | null>(null);
  const [medName, setMedName] = useState('');
  const [medWirkstoff, setMedWirkstoff] = useState('');
  const [medForm, setMedForm] = useState('Tbl.');
  const [medMorgens, setMedMorgens] = useState(1);
  const [medMittags, setMedMittags] = useState(0);
  const [medAbends, setMedAbends] = useState(0);
  const [medNachts, setMedNachts] = useState(0);
  const [medHinweis, setMedHinweis] = useState('');
  const [medArzt, setMedArzt] = useState('');
  const [medGueltigBis, setMedGueltigBis] = useState('2026-12-31');

  const filteredKlienten = klienten.filter((k) => {
    const matchesSearch =
      `${k.nachname} ${k.vorname} ${k.ort} ${k.versichertennummer} ${k.snapLegacyId || ''}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    const matchesPg = selectedPgFilter === 'all' || k.pflegegrad === selectedPgFilter;
    return matchesSearch && matchesPg;
  });

  const activeKlient =
    klienten.find((k) => k.id === selectedKlientId) || filteredKlienten[0] || null;

  // Reset inline edit modes when switching client or when permissions change
  useEffect(() => {
    setIsEditingSis(false);
    setShowMedForm(false);
    setEditingMedId(null);
    setShowVitalForm(false);
    setShowBerichtForm(false);
  }, [activeKlient?.id]);

  useEffect(() => {
    if (!canEditKlienten) setIsEditModalOpen(false);
    if (!canDocumentCare) {
      setShowVitalForm(false);
      setShowBerichtForm(false);
    }
    if (!canEditSis) setIsEditingSis(false);
    if (!canEditMedikation) {
      setShowMedForm(false);
      setEditingMedId(null);
    }
    if (activeSubTab === 'sis' && !canReadSis) {
      setActiveSubTab('stammdaten');
    } else if (activeSubTab === 'medikation' && !canReadMedikation) {
      setActiveSubTab('stammdaten');
    }
  }, [
    canEditKlienten,
    canDocumentCare,
    canReadSis,
    canEditSis,
    canReadMedikation,
    canEditMedikation,
    activeSubTab,
  ]);

  const handleSaveVital = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeKlient || !canDocumentCare) return;
    const now = new Date();
    const datum = now.toISOString().split('T')[0];
    const uhrzeit = now.toTimeString().slice(0, 5);

    onAddVitalwert(activeKlient.id, {
      datum,
      uhrzeit,
      blutdruckSystolisch: Number(sys),
      blutdruckDiastolisch: Number(dia),
      puls: Number(puls),
      blutzucker: bz ? Number(bz) : undefined,
      temperatur: temp ? Number(temp) : undefined,
      erfasstVon: 'PDL',
    });
    setShowVitalForm(false);
    setBz('');
    setTemp('');
  };

  const handleDeleteVital = (vitalId: string) => {
    if (!activeKlient || !canDocumentCare) return;
    onUpdateKlient(
      {
        ...activeKlient,
        vitalwerte: activeKlient.vitalwerte.filter((vw) => vw.id !== vitalId),
      },
      'Vitalwert-Eintrag entfernt'
    );
  };

  const handleSaveBericht = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeKlient || !canDocumentCare || !berichtText.trim()) return;
    const now = new Date();
    const datum = now.toISOString().split('T')[0];
    const uhrzeit = now.toTimeString().slice(0, 5);

    onAddPflegebericht(activeKlient.id, {
      datum,
      uhrzeit,
      kategorie: berichtKategorie,
      text: berichtText.trim(),
      mitarbeiterKuerzel: 'PDL',
    });
    setBerichtText('');
    setShowBerichtForm(false);
  };

  const handleDeleteBericht = (berichtId: string) => {
    if (!activeKlient || !canDocumentCare) return;
    onUpdateKlient(
      {
        ...activeKlient,
        pflegeberichte: activeKlient.pflegeberichte.filter((pb) => pb.id !== berichtId),
      },
      'Pflegebericht-Eintrag entfernt'
    );
  };

  const handleStartEditSis = () => {
    if (!activeKlient || !canEditSis) return;
    const mergedSis = DEFAULT_SIS_TEMPLATE.map((tpl) => {
      const existing = activeKlient.sisKategorien.find(
        (k) => k.kategorieId === tpl.kategorieId
      );
      return existing ? { ...existing } : { ...tpl };
    });
    setSisDraft(mergedSis);
    setRisikoDraft({ ...activeKlient.risikomatrix });
    setIsEditingSis(true);
  };

  const handleSaveSis = () => {
    if (!activeKlient || !risikoDraft || !canEditSis) return;
    onUpdateKlient(
      {
        ...activeKlient,
        sisKategorien: sisDraft,
        risikomatrix: risikoDraft,
      },
      'SIS-Struktur & Risikomatrix aktualisiert'
    );
    setIsEditingSis(false);
  };

  const openMedEditor = (med?: MedikationEintrag) => {
    if (!canEditMedikation) return;
    if (med) {
      setEditingMedId(med.id);
      setMedName(med.handelsname);
      setMedWirkstoff(med.wirkstoff);
      setMedForm(med.form);
      setMedMorgens(med.morgens);
      setMedMittags(med.mittags);
      setMedAbends(med.abends);
      setMedNachts(med.nachts);
      setMedHinweis(med.hinweis);
      setMedArzt(med.verordnenderArzt);
      setMedGueltigBis(med.gueltigBis);
    } else {
      setEditingMedId(null);
      setMedName('');
      setMedWirkstoff('');
      setMedForm('Tbl.');
      setMedMorgens(1);
      setMedMittags(0);
      setMedAbends(0);
      setMedNachts(0);
      setMedHinweis('');
      setMedArzt(activeKlient?.hausarzt.name || '');
      setMedGueltigBis('2026-12-31');
    }
    setShowMedForm(true);
  };

  const handleSaveMedikation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeKlient || !canEditMedikation || !medName.trim()) return;

    const medEntry: MedikationEintrag = {
      id: editingMedId || `med-${Date.now()}`,
      handelsname: medName.trim(),
      wirkstoff: medWirkstoff.trim() || medName.trim(),
      form: medForm,
      morgens: Number(medMorgens),
      mittags: Number(medMittags),
      abends: Number(medAbends),
      nachts: Number(medNachts),
      hinweis: medHinweis.trim(),
      verordnenderArzt: medArzt.trim() || activeKlient.hausarzt.name,
      gueltigBis: medGueltigBis,
      sgbTyp: 'SGB V',
    };

    const nextMeds = editingMedId
      ? activeKlient.medikamente.map((m) => (m.id === editingMedId ? medEntry : m))
      : [...activeKlient.medikamente, medEntry];

    onUpdateKlient(
      { ...activeKlient, medikamente: nextMeds },
      editingMedId
        ? `Medikation angepasst: ${medEntry.handelsname}`
        : `Medikation ergänzt: ${medEntry.handelsname}`
    );
    setShowMedForm(false);
    setEditingMedId(null);
  };

  const handleDeleteMedikation = (medId: string) => {
    if (!activeKlient || !canEditMedikation) return;
    const med = activeKlient.medikamente.find((m) => m.id === medId);
    onUpdateKlient(
      {
        ...activeKlient,
        medikamente: activeKlient.medikamente.filter((m) => m.id !== medId),
      },
      `Medikation entfernt: ${med?.handelsname || medId}`
    );
  };

  const activeTourName = activeKlient
    ? touren.find((t) => t.id === activeKlient.tourId)?.name || activeKlient.tourId
    : '';

  return (
    <div className="space-y-4">
      {/* Search & Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 border border-slate-200 rounded-lg">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Name, Ort, Versichertennummer, SNAP-ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-700 focus:bg-white text-slate-900 placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Segmented Filter for Pflegegrad */}
          <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-md border border-slate-200">
            <button
              onClick={() => setSelectedPgFilter('all')}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                selectedPgFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Alle PG
            </button>
            {[1, 2, 3, 4, 5].map((pg) => (
              <button
                key={pg}
                onClick={() => setSelectedPgFilter(pg)}
                className={`px-2 py-1 text-xs font-mono font-medium rounded transition-colors cursor-pointer ${
                  selectedPgFilter === pg
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                PG {pg}
              </button>
            ))}
          </div>

          {canEditKlienten && (
            <button
              onClick={onOpenNewKlientModal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md transition-colors shadow-xs cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Neuer Klient</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Master-Detail Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left List (4 Cols) */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col h-[750px]">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs text-slate-600 font-medium">
            <span>Klientenliste ({filteredKlienten.length})</span>
            <span className="text-[11px] text-slate-400">Klicken zur Auswahl</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredKlienten.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Keine Klienten gefunden.
              </div>
            ) : (
              filteredKlienten.map((k) => {
                const isSelected = activeKlient?.id === k.id;
                return (
                  <div
                    key={k.id}
                    onClick={() => onSelectKlient(k.id)}
                    className={`p-3 cursor-pointer transition-colors text-xs ${
                      isSelected ? 'bg-teal-50/80 ring-1 ring-inset ring-teal-200' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-slate-900 text-sm">
                          {k.nachname}, {k.vorname}
                        </div>
                        <div className="text-slate-500 text-[11px] mt-0.5">
                          {k.strasse} {k.hausnummer}, {k.ort}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="font-mono text-[11px] font-bold text-teal-800 tabular-nums">
                          PG {k.pflegegrad}
                        </span>
                        {k.snapLegacyId && (
                          <span className="font-mono text-[10px] text-slate-400">SNAP</span>
                        )}
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{k.krankenkasse}</span>
                      <span className="font-mono tabular-nums">{k.versichertennummer}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Detail Pane (8 Cols) */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col h-[750px]">
          {activeKlient ? (
            <>
              {/* Client Header */}
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="text-lg font-bold text-slate-900">
                        {activeKlient.nachname}, {activeKlient.vorname}
                      </h2>
                      <span className="text-xs text-slate-400" aria-hidden="true">
                        ·
                      </span>
                      <span className="font-mono text-xs font-semibold text-teal-800 tabular-nums">
                        Pflegegrad {activeKlient.pflegegrad}
                      </span>
                      {activeKlient.snapLegacyId && (
                        <>
                          <span className="text-xs text-slate-400" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-xs font-mono text-slate-500">
                            {activeKlient.snapLegacyId}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 mt-1.5">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Geb. {activeKlient.geburtsdatum} ({calculateAge(activeKlient.geburtsdatum)} Jahre)
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {activeKlient.strasse} {activeKlient.hausnummer}, {activeKlient.plz}{' '}
                        {activeKlient.ort}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-mono">{activeKlient.telefon}</span>
                      </span>
                    </div>
                  </div>

                  {canEditKlienten && (
                    <button
                      onClick={() => setIsEditModalOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-900 bg-white border border-teal-300 hover:bg-teal-50 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 self-start"
                    >
                      <Pencil className="w-3.5 h-3.5 text-teal-700" />
                      <span>Klient bearbeiten</span>
                    </button>
                  )}
                </div>

                {/* Sub Tab Navigation */}
                <div className="flex items-center gap-1 mt-4 border-t border-slate-200 pt-3 overflow-x-auto">
                  {[
                    { id: 'stammdaten', label: 'Stammdaten & Kasse', allowed: true },
                    { id: 'vitalwerte', label: `Vitalwerte (${activeKlient.vitalwerte.length})`, allowed: true },
                    { id: 'berichte', label: `Pflegeberichte (${activeKlient.pflegeberichte.length})`, allowed: true },
                    { id: 'sis', label: 'SIS Struktur', allowed: canReadSis },
                    { id: 'medikation', label: `Medikation (${activeKlient.medikamente.length})`, allowed: canReadMedikation },
                  ]
                    .filter((tab) => tab.allowed)
                    .map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveSubTab(tab.id as any)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          activeSubTab === tab.id
                            ? 'bg-teal-700 text-white font-semibold shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                </div>
              </div>

              {/* Sub Tab Content */}
              <div className="flex-1 overflow-y-auto p-5 text-xs">
                {activeSubTab === 'stammdaten' && (
                  <div className="space-y-5">
                    {/* Krankenkasse & Abrechnung */}
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-slate-900 flex items-center gap-2 text-sm">
                          <Building className="w-4 h-4 text-teal-700" />
                          <span>Krankenkasse &amp; Kostenträger (SGB XI &amp; SGB V)</span>
                        </div>
                        {canEditKlienten && (
                          <button
                            onClick={() => setIsEditModalOpen(true)}
                            className="text-[11px] font-medium text-teal-700 hover:text-teal-900 hover:underline cursor-pointer"
                          >
                            Anpassen
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div>
                          <span className="text-slate-500 block">Kasse:</span>
                          <span className="font-medium text-slate-800">{activeKlient.krankenkasse}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">IK-Nummer:</span>
                          <span className="font-mono text-slate-800 tabular-nums">
                            {activeKlient.ikNummer}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Versichertennummer:</span>
                          <span className="font-mono text-slate-800 tabular-nums">
                            {activeKlient.versichertennummer}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Zuzahlungsstatus:</span>
                          <span className="font-medium text-slate-800">
                            {activeKlient.zuzahlungsbefreit
                              ? 'Befreit (§ 62 SGB V)'
                              : 'Zuzahlungspflichtig'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Pflegegrad gültig seit:</span>
                          <span className="font-mono text-slate-800 tabular-nums">
                            {activeKlient.pflegegradSeit}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Stammtour:</span>
                          <span className="font-medium text-slate-800">{activeTourName}</span>
                        </div>
                      </div>
                    </div>

                    {/* Ärzte & Notfall */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                        <div className="font-semibold text-slate-900">Behandelnder Hausarzt</div>
                        <div className="text-slate-800 font-medium">{activeKlient.hausarzt.name}</div>
                        <div className="text-slate-500">{activeKlient.hausarzt.praxis}</div>
                        <div className="text-slate-600 font-mono">
                          Tel: {activeKlient.hausarzt.telefon}
                        </div>
                      </div>

                      <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                        <div className="font-semibold text-slate-900">
                          Angehöriger / Notfallkontakt
                        </div>
                        <div className="text-slate-800 font-medium">
                          {activeKlient.notfallkontakt.name}
                        </div>
                        <div className="text-slate-500">{activeKlient.notfallkontakt.beziehung}</div>
                        <div className="text-slate-600 font-mono">
                          Tel: {activeKlient.notfallkontakt.telefon}
                        </div>
                      </div>
                    </div>

                    {/* Schlüssel & Depot */}
                    <div className="p-3.5 rounded-lg bg-amber-50/70 border border-amber-200 flex items-start gap-3">
                      <Key className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-amber-900">
                          Schlüsselhinterlegung / Zugang
                        </div>
                        <div className="text-amber-800 mt-0.5">
                          {activeKlient.schluesselDepot || 'Kein Zugangshinweis hinterlegt'}
                        </div>
                      </div>
                    </div>

                    {/* Diagnosen (ICD-10) */}
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-2">
                        Ärztliche Diagnosen (ICD-10)
                      </h3>
                      {activeKlient.diagnosen.length === 0 ? (
                        <div className="p-3 text-slate-400 border border-slate-200 rounded-md">
                          Keine Diagnosen hinterlegt.
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100 border border-slate-200 rounded-md">
                          {activeKlient.diagnosen.map((diag, idx) => (
                            <div
                              key={`${diag.icd}-${idx}`}
                              className="p-2.5 flex items-center justify-between"
                            >
                              <span className="text-slate-800">{diag.text}</span>
                              <span className="font-mono font-semibold text-slate-700 text-xs">
                                {diag.icd}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Gebuchte Leistungen */}
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-2">
                        Vereinbarte Leistungsmodule
                      </h3>
                      {activeKlient.gebuchteLeistungen.length === 0 ? (
                        <div className="text-slate-400">Keine Leistungsmodule vereinbart.</div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-teal-800 font-medium">
                          {activeKlient.gebuchteLeistungen.map((lk, i) => (
                            <React.Fragment key={lk}>
                              {i > 0 && (
                                <span className="text-slate-300" aria-hidden="true">
                                  ·
                                </span>
                              )}
                              <span>{lk}</span>
                            </React.Fragment>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeSubTab === 'vitalwerte' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold text-slate-900">Vitalwert-Verlauf</h3>
                      {canDocumentCare && (
                        <button
                          onClick={() => setShowVitalForm(!showVitalForm)}
                          className="px-2.5 py-1 text-xs font-medium text-white bg-teal-700 rounded hover:bg-teal-800 transition-colors cursor-pointer"
                        >
                          {showVitalForm ? 'Abbrechen' : '+ Vitalwert erfassen'}
                        </button>
                      )}
                    </div>

                    {canDocumentCare && showVitalForm && (
                      <form
                        onSubmit={handleSaveVital}
                        className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3"
                      >
                        <div className="font-semibold text-slate-900 text-xs">
                          Neue Vitalwerte eingeben
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-0.5">
                              RR Systolisch
                            </label>
                            <input
                              type="number"
                              value={sys}
                              onChange={(e) => setSys(Number(e.target.value))}
                              required
                              className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-0.5">
                              RR Diastolisch
                            </label>
                            <input
                              type="number"
                              value={dia}
                              onChange={(e) => setDia(Number(e.target.value))}
                              required
                              className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-0.5">
                              Puls (BPM)
                            </label>
                            <input
                              type="number"
                              value={puls}
                              onChange={(e) => setPuls(Number(e.target.value))}
                              required
                              className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-0.5">
                              BZ (mg/dl)
                            </label>
                            <input
                              type="number"
                              value={bz}
                              onChange={(e) => setBz(e.target.value)}
                              placeholder="opt."
                              className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-0.5">
                              Temp (°C)
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              value={temp}
                              onChange={(e) => setTemp(e.target.value)}
                              placeholder="opt."
                              className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs font-mono"
                            />
                          </div>
                        </div>
                        <button
                          type="submit"
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 rounded hover:bg-teal-800 transition-colors cursor-pointer"
                        >
                          Speichern
                        </button>
                      </form>
                    )}

                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="p-2.5">Datum &amp; Uhrzeit</th>
                            <th className="p-2.5">Blutdruck (mmHg)</th>
                            <th className="p-2.5">Puls</th>
                            <th className="p-2.5">Blutzucker</th>
                            <th className="p-2.5">Temperatur</th>
                            <th className="p-2.5">Erfasst von</th>
                            {canDocumentCare && <th className="p-2.5 text-right">Aktion</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono text-[11px] tabular-nums">
                          {activeKlient.vitalwerte.length === 0 ? (
                            <tr>
                              <td colSpan={canDocumentCare ? 7 : 6} className="p-6 text-center text-slate-400 font-sans">
                                Noch keine Vitalwerte dokumentiert.
                              </td>
                            </tr>
                          ) : (
                            activeKlient.vitalwerte.map((vw) => (
                              <tr key={vw.id} className="hover:bg-slate-50">
                                <td className="p-2.5 text-slate-800">
                                  {vw.datum} {vw.uhrzeit}
                                </td>
                                <td className="p-2.5 font-bold text-slate-900">
                                  {vw.blutdruckSystolisch}/{vw.blutdruckDiastolisch}
                                </td>
                                <td className="p-2.5 text-slate-700">{vw.puls} bpm</td>
                                <td className="p-2.5 text-slate-700">
                                  {vw.blutzucker ? `${vw.blutzucker} mg/dl` : '-'}
                                </td>
                                <td className="p-2.5 text-slate-700">
                                  {vw.temperatur ? `${vw.temperatur} °C` : '-'}
                                </td>
                                <td className="p-2.5 text-teal-800 font-bold">{vw.erfasstVon}</td>
                                {canDocumentCare && (
                                  <td className="p-2.5 text-right">
                                    <button
                                      onClick={() => handleDeleteVital(vw.id)}
                                      title="Eintrag entfernen"
                                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeSubTab === 'berichte' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold text-slate-900">Chronologischer Pflegebericht</h3>
                      {canDocumentCare && (
                        <button
                          onClick={() => setShowBerichtForm(!showBerichtForm)}
                          className="px-2.5 py-1 text-xs font-medium text-white bg-teal-700 rounded hover:bg-teal-800 transition-colors cursor-pointer"
                        >
                          {showBerichtForm ? 'Abbrechen' : '+ Neuer Eintrag'}
                        </button>
                      )}
                    </div>

                    {canDocumentCare && showBerichtForm && (
                      <form
                        onSubmit={handleSaveBericht}
                        className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3"
                      >
                        <div className="flex flex-wrap gap-4">
                          <label className="text-xs font-medium text-slate-700">Kategorie:</label>
                          {(['Alltag', 'Besonderheit', 'Arztkontakt', 'Vitalabweichung'] as const).map(
                            (kat) => (
                              <label key={kat} className="flex items-center gap-1 cursor-pointer">
                                <input
                                  type="radio"
                                  name="kat"
                                  checked={berichtKategorie === kat}
                                  onChange={() => setBerichtKategorie(kat)}
                                />
                                <span className="text-xs text-slate-800">{kat}</span>
                              </label>
                            )
                          )}
                        </div>
                        <textarea
                          rows={3}
                          value={berichtText}
                          onChange={(e) => setBerichtText(e.target.value)}
                          placeholder="Pflegeverlauf, Besonderheiten, Anmerkungen..."
                          required
                          className="w-full p-2 bg-white border border-slate-300 rounded text-xs"
                        />
                        <button
                          type="submit"
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 rounded hover:bg-teal-800 transition-colors cursor-pointer"
                        >
                          Eintrag speichern
                        </button>
                      </form>
                    )}

                    <div className="space-y-2.5">
                      {activeKlient.pflegeberichte.length === 0 ? (
                        <div className="p-6 text-center text-slate-400 border border-slate-200 rounded-lg">
                          Noch keine Pflegeberichte vorhanden.
                        </div>
                      ) : (
                        activeKlient.pflegeberichte.map((pb) => (
                          <div
                            key={pb.id}
                            className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1"
                          >
                            <div className="flex justify-between items-center text-[11px] text-slate-500">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-800">{pb.kategorie}</span>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono">
                                  {pb.datum} {pb.uhrzeit} Uhr
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono text-teal-800 font-semibold">
                                  {pb.mitarbeiterKuerzel}
                                </span>
                              </div>
                              {canDocumentCare && (
                                <button
                                  onClick={() => handleDeleteBericht(pb.id)}
                                  title="Eintrag entfernen"
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                            <p className="text-slate-800 text-xs leading-relaxed pt-1">{pb.text}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {activeSubTab === 'sis' && canReadSis && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3 p-3 bg-teal-50 border border-teal-200 rounded-lg text-teal-900 text-xs">
                      <div>
                        <strong>Strukturierte Informationssammlung (SIS):</strong> Dokumentation der
                        Sicht des Pflegebedürftigen und fachliche Einschätzung nach MDK-Vorgaben.
                      </div>
                      {canEditSis &&
                        (!isEditingSis ? (
                          <button
                            onClick={handleStartEditSis}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-900 bg-white border border-teal-300 hover:bg-teal-100 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>SIS bearbeiten</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => setIsEditingSis(false)}
                              className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
                            >
                              Abbrechen
                            </button>
                            <button
                              onClick={handleSaveSis}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md cursor-pointer"
                            >
                              <Save className="w-3.5 h-3.5" />
                              <span>Speichern</span>
                            </button>
                          </div>
                        ))}
                    </div>

                    {isEditingSis && risikoDraft ? (
                      <div className="space-y-4">
                        <div className="space-y-3">
                          {sisDraft.map((kat, idx) => (
                            <div
                              key={kat.kategorieId}
                              className="p-3.5 border border-slate-200 rounded-lg bg-slate-50 space-y-2.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-slate-900 text-xs">
                                  {idx + 1}. {kat.titel}
                                </span>
                                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
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
                                <label className="text-[11px] text-slate-500 block mb-1">
                                  Situation / Sicht des Pflegebedürftigen
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
                                <label className="text-[11px] text-slate-500 block mb-1">
                                  Fachliche Einschätzung
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
                          ))}
                        </div>

                        {/* Risikomatrix editor */}
                        <div className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-3">
                          <div className="font-semibold text-slate-900">MDK Risikomatrix</div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {(
                              [
                                { key: 'dekubitus', label: 'Dekubitus' },
                                { key: 'sturz', label: 'Sturz' },
                                { key: 'inkontinenz', label: 'Inkontinenz' },
                                { key: 'schmerz', label: 'Schmerz' },
                                { key: 'ernaehrung', label: 'Ernährung' },
                              ] as const
                            ).map((item) => (
                              <label
                                key={item.key}
                                className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={risikoDraft[item.key]}
                                  onChange={(e) =>
                                    setRisikoDraft({
                                      ...risikoDraft,
                                      [item.key]: e.target.checked,
                                    })
                                  }
                                  className="accent-rose-600"
                                />
                                <span className="text-slate-800 font-medium">{item.label}</span>
                              </label>
                            ))}
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-1">
                              Pflegerische Maßnahmen / Bemerkungen
                            </label>
                            <textarea
                              rows={2}
                              value={risikoDraft.bemerkungen}
                              onChange={(e) =>
                                setRisikoDraft({ ...risikoDraft, bemerkungen: e.target.value })
                              }
                              className="w-full p-2 bg-white border border-slate-300 rounded text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {activeKlient.sisKategorien.length === 0 ? (
                          <div className="p-6 text-center text-slate-400 border border-slate-200 rounded-lg">
                            Keine SIS-Einträge hinterlegt. Klicken Sie auf „SIS bearbeiten“, um die
                            6 Themenfelder zu erfassen.
                          </div>
                        ) : (
                          activeKlient.sisKategorien.map((kat) => (
                            <div
                              key={kat.kategorieId}
                              className="p-3.5 border border-slate-200 rounded-lg bg-slate-50"
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-semibold text-slate-900 text-xs">
                                  {kat.titel}
                                </span>
                                {kat.risikoVorhanden && (
                                  <span className="text-[11px] font-mono text-rose-700 font-semibold">
                                    Risiko erkannt
                                  </span>
                                )}
                              </div>
                              <div className="text-slate-700 mb-1">
                                <span className="text-slate-500 font-medium">Situation: </span>
                                {kat.beschreibung || '—'}
                              </div>
                              <div className="text-slate-700">
                                <span className="text-slate-500 font-medium">Einschätzung: </span>
                                {kat.einschaetzung || '—'}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeSubTab === 'medikation' && canReadMedikation && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold text-slate-900">
                        Aktueller Medikationsplan (BMP-kompatibel)
                      </h3>
                      {canEditMedikation && (
                        <button
                          onClick={() => (showMedForm ? setShowMedForm(false) : openMedEditor())}
                          className="px-2.5 py-1 text-xs font-medium text-white bg-teal-700 rounded hover:bg-teal-800 transition-colors cursor-pointer"
                        >
                          {showMedForm ? 'Abbrechen' : '+ Medikament hinzufügen'}
                        </button>
                      )}
                    </div>

                    {canEditMedikation && showMedForm && (
                      <form
                        onSubmit={handleSaveMedikation}
                        className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900 text-xs">
                            {editingMedId ? 'Medikament bearbeiten' : 'Neues Medikament verordnen'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setShowMedForm(false);
                              setEditingMedId(null);
                            }}
                            className="text-slate-400 hover:text-slate-700 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-0.5">
                              Handelsname *
                            </label>
                            <input
                              type="text"
                              required
                              value={medName}
                              onChange={(e) => setMedName(e.target.value)}
                              placeholder="z.B. Ramipril 5mg"
                              className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-0.5">
                              Wirkstoff
                            </label>
                            <input
                              type="text"
                              value={medWirkstoff}
                              onChange={(e) => setMedWirkstoff(e.target.value)}
                              className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-0.5">
                              Darreichung
                            </label>
                            <select
                              value={medForm}
                              onChange={(e) => setMedForm(e.target.value)}
                              className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs"
                            >
                              <option value="Tbl.">Tbl.</option>
                              <option value="Filmtbl.">Filmtbl.</option>
                              <option value="Kapsel">Kapsel</option>
                              <option value="Tropfen">Tropfen</option>
                              <option value="Injektion s.c.">Injektion s.c.</option>
                              <option value="Salbe">Salbe</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-2">
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-0.5">Morgens</label>
                            <input
                              type="number"
                              step="0.5"
                              value={medMorgens}
                              onChange={(e) => setMedMorgens(Number(e.target.value))}
                              className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-0.5">Mittags</label>
                            <input
                              type="number"
                              step="0.5"
                              value={medMittags}
                              onChange={(e) => setMedMittags(Number(e.target.value))}
                              className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-0.5">Abends</label>
                            <input
                              type="number"
                              step="0.5"
                              value={medAbends}
                              onChange={(e) => setMedAbends(Number(e.target.value))}
                              className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-0.5">Nachts</label>
                            <input
                              type="number"
                              step="0.5"
                              value={medNachts}
                              onChange={(e) => setMedNachts(Number(e.target.value))}
                              className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs font-mono"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div className="sm:col-span-1">
                            <label className="text-[11px] text-slate-500 block mb-0.5">
                              Verordnender Arzt
                            </label>
                            <input
                              type="text"
                              value={medArzt}
                              onChange={(e) => setMedArzt(e.target.value)}
                              className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-0.5">
                              Gültig bis
                            </label>
                            <input
                              type="date"
                              value={medGueltigBis}
                              onChange={(e) => setMedGueltigBis(e.target.value)}
                              className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-0.5">
                              Einnahmehinweis
                            </label>
                            <input
                              type="text"
                              value={medHinweis}
                              onChange={(e) => setMedHinweis(e.target.value)}
                              className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          className="px-3.5 py-1.5 text-xs font-semibold text-white bg-teal-700 rounded hover:bg-teal-800 transition-colors cursor-pointer"
                        >
                          {editingMedId ? 'Änderungen speichern' : 'Medikament speichern'}
                        </button>
                      </form>
                    )}

                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="p-2.5">Medikament &amp; Wirkstoff</th>
                            <th className="p-2.5">Form</th>
                            <th className="p-2.5 font-mono text-center">M - M - A - N</th>
                            <th className="p-2.5">Hinweise / Einnahme</th>
                            <th className="p-2.5">Verordnet von</th>
                            {canEditMedikation && <th className="p-2.5 text-right">Aktionen</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {activeKlient.medikamente.length === 0 ? (
                            <tr>
                              <td colSpan={canEditMedikation ? 6 : 5} className="p-6 text-center text-slate-400">
                                Keine Medikamente für diesen Klienten eingetragen.
                              </td>
                            </tr>
                          ) : (
                            activeKlient.medikamente.map((med) => (
                              <tr key={med.id} className="hover:bg-slate-50">
                                <td className="p-2.5">
                                  <div className="font-semibold text-slate-900">
                                    {med.handelsname}
                                  </div>
                                  <div className="text-[11px] text-slate-500">{med.wirkstoff}</div>
                                </td>
                                <td className="p-2.5 text-slate-600">{med.form}</td>
                                <td className="p-2.5 font-mono text-center font-bold text-teal-800 tabular-nums">
                                  {med.morgens} - {med.mittags} - {med.abends} - {med.nachts}
                                </td>
                                <td className="p-2.5 text-slate-700 text-[11px]">{med.hinweis}</td>
                                <td className="p-2.5 text-slate-600 text-[11px]">
                                  {med.verordnenderArzt}
                                </td>
                                {canEditMedikation && (
                                  <td className="p-2.5 text-right whitespace-nowrap">
                                    <button
                                      onClick={() => openMedEditor(med)}
                                      title="Medikament bearbeiten"
                                      className="p-1 text-slate-400 hover:text-teal-700 rounded transition-colors cursor-pointer mr-1"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteMedikation(med.id)}
                                      title="Medikament entfernen"
                                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
              Wählen Sie einen Klienten aus der Liste aus.
            </div>
          )}
        </div>
      </div>

      {/* Edit Client Modal */}
      {canEditKlienten && (
        <EditKlientModal
          isOpen={isEditModalOpen}
          klient={activeKlient}
          touren={touren}
          onClose={() => setIsEditModalOpen(false)}
          onSave={(updated) => onUpdateKlient(updated, 'Stammdaten & Leistungen aktualisiert')}
          onDelete={onDeleteKlient}
        />
      )}
    </div>
  );
};

function calculateAge(birthDateString: string): number {
  const birth = new Date(birthDateString);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}
