import React, { useState } from 'react';
import {
  Clock,
  CheckCircle2,
  MapPin,
  Key,
  Car,
  User,
  Plus,
  Calendar,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  ShieldCheck,
  UserCheck,
  AlertTriangle,
  X,
  Save,
  Route,
  Lock,
} from 'lucide-react';
import { Tour, Klient, TourHalt, AppBenutzer } from '../types/pflege';
import { STANDARD_LEISTUNGEN } from '../data/mockData';

interface TourenViewProps {
  touren: Tour[];
  klienten: Klient[];
  benutzer: AppBenutzer[];
  canPlanTouren: boolean;
  canConfirmTouren: boolean;
  canReadKlienten: boolean;
  onToggleHaltStatus: (tourId: string, haltId: string, notes?: string) => void;
  onAddTour: (tour: Tour) => void;
  onUpdateTour: (tour: Tour, auditDetails?: string) => void;
  onDeleteTour: (tourId: string) => void;
  onSelectKlient: (klientId: string) => void;
  onSelectTab: (tab: string) => void;
}

const getInitials = (vorname: string, name: string): string => {
  const first = vorname.trim().charAt(0).toUpperCase();
  const last = name.trim().charAt(0).toUpperCase();
  return `${first}${last}` || 'PF';
};

export const TourenView: React.FC<TourenViewProps> = ({
  touren,
  klienten,
  benutzer,
  canPlanTouren,
  canConfirmTouren,
  canReadKlienten,
  onToggleHaltStatus,
  onAddTour,
  onUpdateTour,
  onDeleteTour,
  onSelectKlient,
  onSelectTab,
}) => {
  const [selectedTourId, setSelectedTourId] = useState(touren[0]?.id || '');
  const [editingHaltId, setEditingHaltId] = useState<string | null>(null);
  const [haltNote, setHaltNote] = useState('');

  // Inline 2-step delete confirmations (no window.confirm)
  const [confirmDeleteTourId, setConfirmDeleteTourId] = useState<string | null>(null);
  const [confirmDeleteHaltId, setConfirmDeleteHaltId] = useState<string | null>(null);

  // Tour Create / Edit Modal state (PDL+)
  const [tourModalMode, setTourModalMode] = useState<'create' | 'edit' | null>(null);
  const [tourFormName, setTourFormName] = useState('');
  const [tourFormSchicht, setTourFormSchicht] = useState<Tour['schicht']>('Frühdienst');
  const [tourFormUserId, setTourFormUserId] = useState('');
  const [tourFormKuerzel, setTourFormKuerzel] = useState('');
  const [tourFormFahrzeug, setTourFormFahrzeug] = useState('');
  const [tourFormBereich, setTourFormBereich] = useState('');
  const [tourFormError, setTourFormError] = useState<string | null>(null);

  // Stop Create / Edit Modal state (PDL+)
  const [stopModalMode, setStopModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingStopId, setEditingStopId] = useState<string | null>(null);
  const [stopFormKlientId, setStopFormKlientId] = useState('');
  const [stopFormTime, setStopFormTime] = useState('08:00');
  const [stopFormDuration, setStopFormDuration] = useState(30);
  const [stopFormCodes, setStopFormCodes] = useState<string[]>(['LK 01']);
  const [stopFormNotes, setStopFormNotes] = useState('');
  const [stopFormError, setStopFormError] = useState<string | null>(null);

  const activeTour = touren.find((t) => t.id === selectedTourId) || touren[0];
  const activeUsers = benutzer.filter((u) => u.aktiv);

  const getAssignedUser = (tour: Tour): AppBenutzer | undefined =>
    tour.zugewiesenerBenutzerId
      ? benutzer.find((u) => u.id === tour.zugewiesenerBenutzerId)
      : undefined;

  const handleSaveNote = (haltId: string) => {
    if (!canConfirmTouren || !activeTour) return;
    onToggleHaltStatus(activeTour.id, haltId, haltNote);
    setEditingHaltId(null);
    setHaltNote('');
  };

  // --- PDL+ Tour CRUD ---
  const openCreateTourModal = () => {
    if (!canPlanTouren) return;
    setTourModalMode('create');
    setTourFormName('');
    setTourFormSchicht('Frühdienst');
    setTourFormUserId('');
    setTourFormKuerzel('');
    setTourFormFahrzeug('B-PF 2045');
    setTourFormBereich('');
    setTourFormError(null);
  };

  const openEditTourModal = () => {
    if (!canPlanTouren || !activeTour) return;
    setTourModalMode('edit');
    setTourFormName(activeTour.name);
    setTourFormSchicht(activeTour.schicht);
    setTourFormUserId(activeTour.zugewiesenerBenutzerId || '');
    setTourFormKuerzel(activeTour.fahrerKuerzel);
    setTourFormFahrzeug(activeTour.fahrzeugKennzeichen);
    setTourFormBereich(activeTour.bereich);
    setTourFormError(null);
  };

  const handleTourUserSelectChange = (userId: string) => {
    setTourFormUserId(userId);
    const matched = benutzer.find((u) => u.id === userId);
    if (matched) {
      setTourFormKuerzel(getInitials(matched.vorname, matched.name));
    } else if (!tourFormKuerzel) {
      setTourFormKuerzel('--');
    }
  };

  const handleSaveTourModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPlanTouren) return;
    const trimmedName = tourFormName.trim();
    const trimmedBereich = tourFormBereich.trim();
    if (!trimmedName) {
      setTourFormError('Bitte geben Sie eine Bezeichnung für die Tour an.');
      return;
    }
    if (!trimmedBereich) {
      setTourFormError('Bitte geben Sie das Tourengebiet / den Bereich an.');
      return;
    }

    const assignedUser = benutzer.find((u) => u.id === tourFormUserId);
    const resolvedKuerzel =
      tourFormKuerzel.trim().toUpperCase() ||
      (assignedUser ? getInitials(assignedUser.vorname, assignedUser.name) : '--');

    if (tourModalMode === 'create') {
      const newTour: Tour = {
        id: `tour-${Date.now()}`,
        name: trimmedName,
        schicht: tourFormSchicht,
        zugewiesenerBenutzerId: assignedUser?.id,
        zugewiesenerMitarbeiterName: assignedUser
          ? `${assignedUser.vorname} ${assignedUser.name}`
          : undefined,
        fahrerKuerzel: resolvedKuerzel,
        fahrzeugKennzeichen: tourFormFahrzeug.trim() || 'Ohne Fahrzeug',
        bereich: trimmedBereich,
        halte: [],
      };
      onAddTour(newTour);
      setSelectedTourId(newTour.id);
    } else if (tourModalMode === 'edit' && activeTour) {
      const updatedTour: Tour = {
        ...activeTour,
        name: trimmedName,
        schicht: tourFormSchicht,
        zugewiesenerBenutzerId: assignedUser?.id,
        zugewiesenerMitarbeiterName: assignedUser
          ? `${assignedUser.vorname} ${assignedUser.name}`
          : undefined,
        fahrerKuerzel: resolvedKuerzel,
        fahrzeugKennzeichen: tourFormFahrzeug.trim() || 'Ohne Fahrzeug',
        bereich: trimmedBereich,
      };
      onUpdateTour(
        updatedTour,
        `Tour-Stammdaten bearbeitet (${updatedTour.name}, ${updatedTour.schicht}, Zuweisung: ${
          updatedTour.zugewiesenerMitarbeiterName || 'Nicht zugewiesen'
        })`
      );
    }

    setTourModalMode(null);
  };

  const handleQuickAssignEmployee = (userId: string) => {
    if (!canPlanTouren || !activeTour) return;
    const matched = benutzer.find((u) => u.id === userId);
    const updatedTour: Tour = {
      ...activeTour,
      zugewiesenerBenutzerId: matched?.id,
      zugewiesenerMitarbeiterName: matched ? `${matched.vorname} ${matched.name}` : undefined,
      fahrerKuerzel: matched ? getInitials(matched.vorname, matched.name) : '--',
    };
    onUpdateTour(
      updatedTour,
      matched
        ? `Tour „${activeTour.name}“ Mitarbeiter ${matched.vorname} ${matched.name} (${matched.benutzername}) zugewiesen`
        : `Mitarbeiterzuweisung für Tour „${activeTour.name}“ entfernt`
    );
  };

  const handleConfirmDeleteTour = (tourId: string) => {
    if (!canPlanTouren) return;
    onDeleteTour(tourId);
    setConfirmDeleteTourId(null);
    const nextRemaining = touren.filter((t) => t.id !== tourId);
    setSelectedTourId(nextRemaining[0]?.id || '');
  };

  // --- PDL+ Stop CRUD & Reordering ---
  const openCreateStopModal = () => {
    if (!canPlanTouren || !activeTour) return;
    setStopModalMode('create');
    setEditingStopId(null);
    setStopFormKlientId(klienten[0]?.id || '');
    const lastStop = activeTour.halte[activeTour.halte.length - 1];
    setStopFormTime(lastStop ? lastStop.geplanteUhrzeit : activeTour.schicht === 'Spätdienst' ? '18:00' : '07:30');
    setStopFormDuration(30);
    setStopFormCodes(['LK 01']);
    setStopFormNotes('');
    setStopFormError(null);
  };

  const openEditStopModal = (halt: TourHalt) => {
    if (!canPlanTouren) return;
    setStopModalMode('edit');
    setEditingStopId(halt.id);
    setStopFormKlientId(halt.klientId);
    setStopFormTime(halt.geplanteUhrzeit);
    setStopFormDuration(halt.geschaetzteDauerMinuten);
    setStopFormCodes([...halt.leistungCodes]);
    setStopFormNotes(halt.notizen || '');
    setStopFormError(null);
  };

  const toggleStopServiceCode = (code: string) => {
    setStopFormCodes((prev) => {
      const exists = prev.includes(code);
      const next = exists ? prev.filter((c) => c !== code) : [...prev, code];
      // Suggest duration based on STANDARD_LEISTUNGEN when adding/removing
      const suggested = next.reduce((sum, c) => {
        const found = STANDARD_LEISTUNGEN.find((s) => s.code === c);
        return sum + (found?.dauerMinuten || 10);
      }, 0);
      if (suggested > 0) {
        setStopFormDuration(suggested);
      }
      return next;
    });
  };

  const handleSaveStopModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPlanTouren || !activeTour) return;
    if (!stopFormKlientId) {
      setStopFormError('Bitte wählen Sie einen Klienten aus.');
      return;
    }
    if (!stopFormTime) {
      setStopFormError('Bitte geben Sie eine geplante Uhrzeit an.');
      return;
    }
    if (stopFormCodes.length === 0) {
      setStopFormError('Bitte wählen Sie mindestens einen Leistungskomplex (SGB XI / SGB V) aus.');
      return;
    }

    const klient = klienten.find((k) => k.id === stopFormKlientId);
    const klientLabel = klient ? `${klient.nachname}, ${klient.vorname}` : stopFormKlientId;

    if (stopModalMode === 'create') {
      const newStop: TourHalt = {
        id: `th-${Date.now()}`,
        klientId: stopFormKlientId,
        geplanteUhrzeit: stopFormTime,
        geschaetzteDauerMinuten: Math.max(5, Number(stopFormDuration) || 15),
        leistungCodes: stopFormCodes,
        status: 'Ausstehend',
        notizen: stopFormNotes.trim() || undefined,
      };
      const nextHalte = [...activeTour.halte, newStop].sort((a, b) =>
        a.geplanteUhrzeit.localeCompare(b.geplanteUhrzeit)
      );
      onUpdateTour(
        { ...activeTour, halte: nextHalte },
        `Haltepunkt hinzugefügt: ${klientLabel} um ${stopFormTime} Uhr in „${activeTour.name}“`
      );
    } else if (stopModalMode === 'edit' && editingStopId) {
      const nextHalte = activeTour.halte.map((h) =>
        h.id === editingStopId
          ? {
              ...h,
              klientId: stopFormKlientId,
              geplanteUhrzeit: stopFormTime,
              geschaetzteDauerMinuten: Math.max(5, Number(stopFormDuration) || 15),
              leistungCodes: stopFormCodes,
              notizen: stopFormNotes.trim() || undefined,
            }
          : h
      );
      onUpdateTour(
        { ...activeTour, halte: nextHalte },
        `Haltepunkt bearbeitet: ${klientLabel} (${stopFormTime} Uhr) in „${activeTour.name}“`
      );
    }

    setStopModalMode(null);
    setEditingStopId(null);
  };

  const handleMoveStop = (index: number, direction: -1 | 1) => {
    if (!canPlanTouren || !activeTour) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= activeTour.halte.length) return;
    const nextHalte = [...activeTour.halte];
    const [moved] = nextHalte.splice(index, 1);
    nextHalte.splice(targetIndex, 0, moved);
    onUpdateTour(
      { ...activeTour, halte: nextHalte },
      `Haltepunkt-Reihenfolge in „${activeTour.name}“ angepasst`
    );
  };

  const handleDeleteStop = (haltId: string) => {
    if (!canPlanTouren || !activeTour) return;
    const targetHalt = activeTour.halte.find((h) => h.id === haltId);
    const klient = targetHalt ? klienten.find((k) => k.id === targetHalt.klientId) : null;
    const nextHalte = activeTour.halte.filter((h) => h.id !== haltId);
    onUpdateTour(
      { ...activeTour, halte: nextHalte },
      `Haltepunkt entfernt (${klient ? `${klient.nachname}, ${klient.vorname}` : haltId}) aus „${activeTour.name}“`
    );
    setConfirmDeleteHaltId(null);
  };

  const totalMinutes = activeTour
    ? activeTour.halte.reduce((sum, h) => sum + h.geschaetzteDauerMinuten, 0)
    : 0;
  const doneStops = activeTour
    ? activeTour.halte.filter((h) => h.status === 'Erledigt').length
    : 0;
  const assignedUserRecord = activeTour ? getAssignedUser(activeTour) : undefined;

  return (
    <div className="space-y-5">
      {/* Tour Selector Header */}
      <div className="flex flex-col gap-3 bg-white p-4 border border-slate-200 rounded-lg shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                {canPlanTouren ? 'Tourenplanung & Einsatzdisposition' : 'Mein persönlicher Tourenplan'}
              </h1>
              {canPlanTouren ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-teal-50 text-teal-800 border border-teal-200 rounded">
                  <ShieldCheck className="w-3 h-3" />
                  Dispositionsmodus (PDL+)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 rounded">
                  <Lock className="w-3 h-3" />
                  Nur eigene zugewiesene Touren
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {canPlanTouren
                ? 'Alle Touren verwalten, Haltepunkte disponieren und Mitarbeitern exklusiv zuweisen'
                : 'Ihre durch die Pflegedienstleitung (PDL) zugewiesenen Einsätze & Echtzeit-Quittierung'}
            </p>
          </div>

          {canPlanTouren && (
            <button
              onClick={openCreateTourModal}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md transition-colors cursor-pointer shadow-xs shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Neue Tour anlegen</span>
            </button>
          )}
        </div>

        {/* Tour Segmented Buttons */}
        {touren.length > 0 && (
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200 overflow-x-auto">
            {touren.map((t) => {
              const isSelected = t.id === activeTour?.id;
              const erledigtCount = t.halte.filter((h) => h.status === 'Erledigt').length;
              const isUnassigned = !t.zugewiesenerBenutzerId;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedTourId(t.id);
                    setConfirmDeleteTourId(null);
                    setConfirmDeleteHaltId(null);
                    setEditingHaltId(null);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                    isSelected
                      ? 'bg-teal-700 text-white font-semibold shadow-xs'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  {canPlanTouren && isUnassigned && (
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isSelected ? 'bg-amber-300' : 'bg-amber-500'
                      }`}
                      title="Noch keinem Mitarbeiter zugewiesen"
                    />
                  )}
                  <span>{t.name}</span>
                  <span
                    className={`font-mono text-[11px] ${
                      isSelected ? 'text-teal-200' : 'text-slate-500'
                    }`}
                  >
                    {erledigtCount}/{t.halte.length}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Privacy / Scope Banner for non-PDL staff */}
      {!canPlanTouren && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 flex items-center gap-2.5 text-xs text-slate-700">
          <UserCheck className="w-4 h-4 text-teal-700 shrink-0" />
          <span>
            <strong>Datenschutz &amp; Einsatzfokus:</strong> Es werden ausschließlich Touren angezeigt, die Ihrem Benutzerkonto durch die Pflegedienstleitung (PDL) zugewiesen wurden. Anpassungen am Tourenplan sind nur durch die PDL und Administratoren möglich.
          </span>
        </div>
      )}

      {activeTour ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Tour Meta Panel (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs uppercase font-semibold text-slate-400">
                  Tour Details
                </div>
                {canPlanTouren && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={openEditTourModal}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors cursor-pointer"
                      title="Tour bearbeiten"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>Bearbeiten</span>
                    </button>
                    {confirmDeleteTourId === activeTour.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleConfirmDeleteTour(activeTour.id)}
                          className="px-2 py-1 text-[11px] font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded cursor-pointer"
                        >
                          Löschen
                        </button>
                        <button
                          onClick={() => setConfirmDeleteTourId(null)}
                          className="px-1.5 py-1 text-[11px] text-slate-600 hover:text-slate-900 cursor-pointer"
                        >
                          Abbruch
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteTourId(activeTour.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                        title="Tour löschen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <h2 className="text-base font-bold text-slate-900">
                {activeTour.name}
              </h2>

              {/* Employee Assignment Section */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    Zugewiesener Mitarbeiter
                  </span>
                  <span className="font-mono text-[11px] px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded font-bold">
                    {activeTour.fahrerKuerzel}
                  </span>
                </div>

                {canPlanTouren ? (
                  <div className="space-y-1.5">
                    <select
                      value={activeTour.zugewiesenerBenutzerId || ''}
                      onChange={(e) => handleQuickAssignEmployee(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
                    >
                      <option value="">— Nicht zugewiesen (für Mitarbeiter unsichtbar) —</option>
                      {activeUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.vorname} {u.name} ({u.rolle} · @{u.benutzername})
                        </option>
                      ))}
                      {assignedUserRecord && !assignedUserRecord.aktiv && (
                        <option value={assignedUserRecord.id}>
                          {assignedUserRecord.vorname} {assignedUserRecord.name} (gesperrt · @{assignedUserRecord.benutzername})
                        </option>
                      )}
                    </select>
                    {!activeTour.zugewiesenerBenutzerId ? (
                      <div className="flex items-start gap-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <span>
                          Kein Mitarbeiter zugewiesen. Diese Tour ist aktuell nur für PDL/Admin sichtbar.
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-start gap-1.5 text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-2.5 py-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>
                          Sichtbar für{' '}
                          <strong>
                            {assignedUserRecord
                              ? `${assignedUserRecord.vorname} ${assignedUserRecord.name}`
                              : activeTour.zugewiesenerMitarbeiterName}
                          </strong>{' '}
                          sowie PDL &amp; Admin.
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5">
                    {assignedUserRecord
                      ? `${assignedUserRecord.vorname} ${assignedUserRecord.name} (${assignedUserRecord.rolle})`
                      : activeTour.zugewiesenerMitarbeiterName || activeTour.fahrerKuerzel}
                  </div>
                )}
              </div>

              <div className="space-y-2 text-xs pt-2 border-t border-slate-100">
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
                  <span className="text-slate-800 truncate max-w-[170px]" title={activeTour.bereich}>
                    {activeTour.bereich}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Geplante Einsatzzeit:
                  </span>
                  <span className="font-mono font-semibold text-slate-800">
                    {totalMinutes} Min ({doneStops}/{activeTour.halte.length} quittiert)
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Helper / Instructions */}
            <div className="bg-teal-50/60 border border-teal-200/80 rounded-lg p-4 text-xs text-teal-900 space-y-2">
              <div className="font-semibold text-teal-950">
                {canPlanTouren ? 'PDL-Disposition & Sichtbarkeitssteuerung' : 'Mobile Vor-Ort-Quittierung'}
              </div>
              <p className="text-teal-800 leading-relaxed">
                {canPlanTouren
                  ? 'Jede Tour wird automatisch nur dem oben zugewiesenen Mitarbeiter angezeigt. Änderungen an Haltepunkten, Reihenfolge oder Zuweisung werden revisionssicher im DSGVO-Audit-Log protokolliert.'
                  : 'Sie können Ihre zugewiesenen Einsätze direkt vor Ort quittieren und Übergabenotizen ergänzen. Nach Abschluss wird die Einsatzzeit für die Abrechnung nach SGB XI (§ 105) und SGB V (§ 302) dokumentiert.'}
              </p>
            </div>
          </div>

          {/* Stops List (8 cols) */}
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-slate-700">
              <span>
                Geplante Haltepunkte ({activeTour.halte.length} Klienten · {totalMinutes} Min)
              </span>
              {canPlanTouren ? (
                <button
                  onClick={openCreateStopModal}
                  disabled={klienten.length === 0}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-md transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Haltepunkt hinzufügen</span>
                </button>
              ) : (
                <span className="text-slate-500">Reihenfolge durch PDL vorgegeben</span>
              )}
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
                        <div className="flex flex-col items-center gap-1">
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

                          {canPlanTouren && activeTour.halte.length > 1 && (
                            <div className="flex flex-col items-center mt-1">
                              <button
                                onClick={() => handleMoveStop(idx, -1)}
                                disabled={idx === 0}
                                className="p-0.5 text-slate-400 hover:text-slate-800 disabled:opacity-30 cursor-pointer disabled:cursor-default"
                                title="Nach oben verschieben"
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleMoveStop(idx, 1)}
                                disabled={idx === activeTour.halte.length - 1}
                                className="p-0.5 text-slate-400 hover:text-slate-800 disabled:opacity-30 cursor-pointer disabled:cursor-default"
                                title="Nach unten verschieben"
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Middle: Client Info & Services */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
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
                            <span>
                              {k.strasse} {k.hausnummer}, {k.ort}
                            </span>
                          </div>

                          {k.schluesselDepot && (
                            <div className="text-[11px] text-amber-800 flex items-center gap-1.5 mt-0.5">
                              <Key className="w-3 h-3 text-amber-600" />
                              <span>{k.schluesselDepot}</span>
                            </div>
                          )}

                          {/* Service Tags */}
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

                      {/* Right: Status & Actions */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span
                          className={`text-xs px-2.5 py-1 rounded font-medium ${
                            isErledigt
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : halt.status === 'In Arbeit'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {halt.status}
                        </span>

                        {canPlanTouren && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditStopModal(halt)}
                              className="p-1 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded transition-colors cursor-pointer"
                              title="Haltepunkt bearbeiten"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {confirmDeleteHaltId === halt.id ? (
                              <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 rounded px-1.5 py-0.5">
                                <button
                                  onClick={() => handleDeleteStop(halt.id)}
                                  className="text-[11px] font-semibold text-rose-700 hover:underline cursor-pointer"
                                >
                                  Entfernen
                                </button>
                                <span className="text-slate-300">|</span>
                                <button
                                  onClick={() => setConfirmDeleteHaltId(null)}
                                  className="text-[11px] text-slate-600 hover:text-slate-900 cursor-pointer"
                                >
                                  Nein
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteHaltId(halt.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                title="Haltepunkt aus Tour entfernen"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}

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

              {activeTour.halte.length === 0 && (
                <div className="p-8 text-center space-y-2">
                  <div className="text-xs font-semibold text-slate-700">
                    Noch keine Haltepunkte in dieser Tour geplant.
                  </div>
                  {canPlanTouren && (
                    <button
                      onClick={openCreateStopModal}
                      disabled={klienten.length === 0}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-md transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Ersten Haltepunkt planen</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg p-10 text-center space-y-3">
          <div className="w-11 h-11 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
            <Route className="w-5 h-5" />
          </div>
          {canPlanTouren ? (
            <>
              <h2 className="text-sm font-bold text-slate-900">Noch keine Touren angelegt</h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Legen Sie eine neue ambulante Tour an und weisen Sie diese direkt einer Pflegekraft zu.
              </p>
              <button
                onClick={openCreateTourModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Erste Tour anlegen</span>
              </button>
            </>
          ) : (
            <>
              <h2 className="text-sm font-bold text-slate-900">
                Ihnen ist aktuell keine Tour zugewiesen
              </h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Aus Datenschutz- und Organisationsgründen sehen Sie hier ausschließlich Touren, die Ihrem Benutzerkonto zugeordnet sind. Bitte wenden Sie sich bei Bedarf an die Pflegedienstleitung (PDL).
              </p>
            </>
          )}
        </div>
      )}

      {/* PDL+ Tour Create / Edit Modal */}
      {canPlanTouren && tourModalMode && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {tourModalMode === 'create' ? 'Neue Tour anlegen (PDL+)' : 'Tour bearbeiten (PDL+)'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Zuweisung steuert exklusiv, welcher Mitarbeiter diese Tour sieht.
                </p>
              </div>
              <button
                onClick={() => setTourModalMode(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTourModal} className="p-5 space-y-4">
              {tourFormError && (
                <div className="p-2.5 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded">
                  {tourFormError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tourbezeichnung *
                </label>
                <input
                  type="text"
                  value={tourFormName}
                  onChange={(e) => setTourFormName(e.target.value)}
                  placeholder="z.B. Tour 4 - Pankow Frühdienst"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Schichtart
                  </label>
                  <select
                    value={tourFormSchicht}
                    onChange={(e) => setTourFormSchicht(e.target.value as Tour['schicht'])}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600"
                  >
                    <option value="Frühdienst">Frühdienst</option>
                    <option value="Spätdienst">Spätdienst</option>
                    <option value="Nachtdienst">Nachtdienst</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Dienstfahrzeug
                  </label>
                  <input
                    type="text"
                    value={tourFormFahrzeug}
                    onChange={(e) => setTourFormFahrzeug(e.target.value)}
                    placeholder="z.B. B-PF 2045"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Zugewiesener Mitarbeiter (exklusive Sichtbarkeit)
                </label>
                <select
                  value={tourFormUserId}
                  onChange={(e) => handleTourUserSelectChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  <option value="">— Nicht zugewiesen (nur PDL/Admin sichtbar) —</option>
                  {activeUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.vorname} {u.name} ({u.rolle} · @{u.benutzername})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Fahrerkürzel
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={tourFormKuerzel}
                    onChange={(e) => setTourFormKuerzel(e.target.value)}
                    placeholder="z.B. TB"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md font-mono uppercase focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tourengebiet / Bereich *
                  </label>
                  <input
                    type="text"
                    value={tourFormBereich}
                    onChange={(e) => setTourFormBereich(e.target.value)}
                    placeholder="z.B. Berlin-Mitte / Chausseestr."
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTourModalMode(null)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{tourModalMode === 'create' ? 'Tour erstellen' : 'Änderungen speichern'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDL+ Stop Create / Edit Modal */}
      {canPlanTouren && stopModalMode && activeTour && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-xl overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {stopModalMode === 'create'
                    ? `Haltepunkt zu „${activeTour.name}“ hinzufügen`
                    : `Haltepunkt in „${activeTour.name}“ bearbeiten`}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Klient, Einsatzzeit und SGB XI / SGB V Leistungskomplexe festlegen.
                </p>
              </div>
              <button
                onClick={() => setStopModalMode(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStopModal} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {stopFormError && (
                <div className="p-2.5 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded">
                  {stopFormError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Klient *
                </label>
                <select
                  value={stopFormKlientId}
                  onChange={(e) => setStopFormKlientId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  {klienten.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nachname}, {k.vorname} (PG {k.pflegegrad} · {k.strasse} {k.hausnummer}, {k.ort})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Geplante Uhrzeit *
                  </label>
                  <input
                    type="time"
                    value={stopFormTime}
                    onChange={(e) => setStopFormTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Geplante Dauer (Minuten) *
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={240}
                    step={5}
                    value={stopFormDuration}
                    onChange={(e) => setStopFormDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Leistungskomplexe (SGB XI / SGB V) *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-md">
                  {STANDARD_LEISTUNGEN.map((lk) => {
                    const selected = stopFormCodes.includes(lk.code);
                    return (
                      <button
                        key={lk.code}
                        type="button"
                        onClick={() => toggleStopServiceCode(lk.code)}
                        className={`text-left px-2.5 py-1.5 rounded border text-xs transition-colors cursor-pointer ${
                          selected
                            ? 'bg-teal-50 border-teal-600 text-teal-950 font-medium'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono font-bold text-[11px]">{lk.code}</span>
                          <span className="text-[10px] text-slate-500">
                            {lk.typ} · {lk.dauerMinuten}m
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 truncate">{lk.bezeichnung}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Übergabe- / Einsatzhinweis (optional)
                </label>
                <input
                  type="text"
                  value={stopFormNotes}
                  onChange={(e) => setStopFormNotes(e.target.value)}
                  placeholder="z.B. Schlüsselcode beachten, Insulin vor Frühstück"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setStopModalMode(null)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>
                    {stopModalMode === 'create' ? 'Haltepunkt speichern' : 'Änderungen speichern'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
