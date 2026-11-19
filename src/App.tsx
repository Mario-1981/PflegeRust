/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { KlientenView } from './components/KlientenView';
import { TourenView } from './components/TourenView';
import { SisView } from './components/SisView';
import { MedikationView } from './components/MedikationView';
import { DienstplanView } from './components/DienstplanView';
import { AbrechnungView } from './components/AbrechnungView';
import { UserManagementView } from './components/UserManagementView';
import { AddonsView } from './components/AddonsView';
import { MigrationView } from './components/MigrationView';
import { RustCodeView } from './components/RustCodeView';
import { DebianTerminalView } from './components/DebianTerminalView';
import { SystempflegeView } from './components/SystempflegeView';
import { NewKlientModal } from './components/NewKlientModal';
import { MariaDbConfigModal, MariaDbConfig } from './components/MariaDbConfigModal';
import { LoginView } from './components/LoginView';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { SecurityMfaModal } from './components/SecurityMfaModal';
import { SetupWizardView, SetupCompletionPayload } from './components/SetupWizardView';
import { MAX_LOGIN_ATTEMPTS } from './utils/authCrypto';
import { hasActiveSecondFactor } from './utils/mfaCrypto';
import {
  INITIAL_ROLLEN_CONFIG,
  hasPermission,
  canAccessTab,
  getFirstAllowedTab,
  isStandardRolle,
} from './data/rbacConfig';
import { INITIAL_ADDONS, INITIAL_TI_TRANSAKTIONEN } from './data/addonsData';

import {
  INITIAL_KLIENTEN,
  INITIAL_TOUREN,
  INITIAL_MITARBEITER,
  INITIAL_SSO_CONFIG,
} from './data/mockData';
import {
  Klient,
  Tour,
  Mitarbeiter,
  Vitalwert,
  PflegeberichtEintrag,
  MedikationEintrag,
  AppBenutzer,
  BenutzerRolle,
  Berechtigung,
  RollenDefinition,
  BenutzerZweiFaktorConfig,
  SsoKonfiguration,
  AuditLogEintrag,
  ActiveSessionUser,
  EinrichtungsProfil,
  PflegeAddon,
  TiTransaktion,
} from './types/pflege';

export default function App() {
  const [isSetupCompleted, setIsSetupCompleted] = useState<boolean>(false);
  const [einrichtung, setEinrichtung] = useState<EinrichtungsProfil>({
    name: 'Pflegedienst Berlin-Zentrum',
    ikNummer: '461102934',
    ort: 'Berlin',
    versorgungsform: 'Ambulanter Pflegedienst',
    bundesland: 'Berlin',
  });
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [klienten, setKlienten] = useState<Klient[]>(INITIAL_KLIENTEN);
  const [touren, setTouren] = useState<Tour[]>(INITIAL_TOUREN);
  const [mitarbeiter] = useState<Mitarbeiter[]>(INITIAL_MITARBEITER);
  const [benutzer, setBenutzer] = useState<AppBenutzer[]>([]);
  const [rollenConfig, setRollenConfig] = useState<Record<BenutzerRolle, RollenDefinition>>(
    INITIAL_ROLLEN_CONFIG
  );
  const [addons, setAddons] = useState<PflegeAddon[]>(INITIAL_ADDONS);
  const [tiTransaktionen, setTiTransaktionen] = useState<TiTransaktion[]>(INITIAL_TI_TRANSAKTIONEN);
  const [ssoConfig, setSsoConfig] = useState<SsoKonfiguration>(INITIAL_SSO_CONFIG);
  const [auditLogs, setAuditLogs] = useState<AuditLogEintrag[]>([]);
  const [activeUser, setActiveUser] = useState<ActiveSessionUser | null>(null);
  const [activeSessions, setActiveSessions] = useState<ActiveSessionUser[]>([]);
  const [switchTargetSessionId, setSwitchTargetSessionId] = useState<string | null>(null);
  const [logoutNotice, setLogoutNotice] = useState<string | null>(null);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isMfaModalOpen, setIsMfaModalOpen] = useState(false);

  const [selectedKlientId, setSelectedKlientId] = useState<string | null>(
    INITIAL_KLIENTEN[0]?.id || null
  );
  const [isNewKlientModalOpen, setIsNewKlientModalOpen] = useState(false);
  const [isMariaDbModalOpen, setIsMariaDbModalOpen] = useState(false);
  const [mariaDbConfig, setMariaDbConfig] = useState<MariaDbConfig>({
    host: '127.0.0.1',
    port: 3306,
    database: 'pflege_db',
    user: 'pfleged',
    poolSize: 10,
    ssl: false,
    galeraCluster: false,
  });
  const [notification, setNotification] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const addAuditLog = (
    aktion: AuditLogEintrag['aktion'],
    ressource: string,
    details: string,
    actorOverride?: { benutzer: string; rolle: BenutzerRolle }
  ) => {
    const actorName = actorOverride?.benutzer || activeUser?.benutzername || 'system';
    const actorRole = actorOverride?.rolle || activeUser?.role || 'Admin';
    const newLog: AuditLogEintrag = {
      id: `aud-${Date.now()}`,
      zeitstempel: new Date().toISOString().replace('T', ' ').slice(0, 19),
      benutzer: actorName,
      rolle: actorRole,
      aktion,
      ressource,
      details,
      ipAdresse: '192.168.10.12',
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  const can = (perm: Berechtigung): boolean =>
    activeUser ? hasPermission(activeUser.role, perm, rollenConfig) : false;

  const handleSelectTab = (tab: string) => {
    if (!activeUser) return;
    if (!canAccessTab(activeUser.role, tab, rollenConfig)) {
      showToast('Zugriff verweigert: Ihre Rolle besitzt keine Berechtigung für diesen Bereich.');
      return;
    }
    setCurrentTab(tab);
  };

  // SNAP Migration integration handler
  const handleImportComplete = (importedClients: Klient[], importedTours: Tour[]) => {
    if (!can('migration')) {
      showToast('Keine Berechtigung für die SNAP-Migration.');
      return;
    }
    setKlienten((prev) => {
      const existingIds = new Set(prev.map((c) => c.snapLegacyId || c.id));
      const fresh = importedClients.filter((c) => !existingIds.has(c.snapLegacyId || c.id));
      return [...prev, ...fresh];
    });

    setTouren((prev) => {
      const existingTourIds = new Set(prev.map((t) => t.id));
      const fresh = importedTours.filter((t) => !existingTourIds.has(t.id));
      return [...prev, ...fresh];
    });

    addAuditLog(
      'PATIENT_UPDATE',
      'SNAP Migration',
      `${importedClients.length} Klienten und ${importedTours.length} Touren importiert`
    );
    showToast(`Erfolgreich ${importedClients.length} Klienten und ${importedTours.length} Touren in MariaDB importiert!`);
  };

  // Toggle tour stop status (strictly enforced for assigned tour unless PDL+)
  const handleToggleHaltStatus = (tourId: string, haltId: string, notes?: string) => {
    if (!can('touren_quittieren')) {
      showToast('Keine Berechtigung zum Quittieren von Einsätzen.');
      return;
    }
    const targetTour = touren.find((t) => t.id === tourId);
    if (!targetTour) return;
    if (!can('touren_planen') && targetTour.zugewiesenerBenutzerId !== activeUser?.id) {
      showToast('Zugriff verweigert: Sie können nur Einsätze Ihrer eigenen zugewiesenen Tour quittieren.');
      return;
    }
    setTouren((prev) =>
      prev.map((t) => {
        if (t.id !== tourId) return t;
        return {
          ...t,
          halte: t.halte.map((h) => {
            if (h.id !== haltId) return h;
            const newStatus =
              h.status === 'Erledigt'
                ? 'Ausstehend'
                : h.status === 'Ausstehend'
                ? 'Erledigt'
                : 'Erledigt';
            const now = new Date().toTimeString().slice(0, 5);
            return {
              ...h,
              status: newStatus,
              tatsaechlichesEnde: newStatus === 'Erledigt' ? now : undefined,
              notizen: notes !== undefined ? notes : h.notizen,
            };
          }),
        };
      })
    );
  };

  // PDL+ Tour planning CRUD handlers
  const handleAddTour = (newTour: Tour) => {
    if (!can('touren_planen')) {
      showToast('Keine Berechtigung: Nur PDL und Administratoren dürfen Touren anlegen.');
      return;
    }
    setTouren((prev) => [...prev, newTour]);
    addAuditLog(
      'TOUR_PLAN_UPDATE',
      `Tour: ${newTour.name}`,
      `Neue Tour angelegt (${newTour.schicht}, Zuweisung: ${
        newTour.zugewiesenerMitarbeiterName || 'Nicht zugewiesen'
      })`
    );
    showToast(`Tour „${newTour.name}“ wurde angelegt.`);
  };

  const handleUpdateTour = (updatedTour: Tour, auditDetails?: string) => {
    if (!can('touren_planen')) {
      showToast('Keine Berechtigung: Nur PDL und Administratoren dürfen den Tourenplan anpassen.');
      return;
    }
    setTouren((prev) => prev.map((t) => (t.id === updatedTour.id ? updatedTour : t)));
    addAuditLog(
      'TOUR_PLAN_UPDATE',
      `Tour: ${updatedTour.name}`,
      auditDetails || `Tourenplan aktualisiert (${updatedTour.halte.length} Haltepunkte)`
    );
    showToast(`Tourenplan für „${updatedTour.name}“ gespeichert.`);
  };

  const handleDeleteTour = (tourId: string) => {
    if (!can('touren_planen')) {
      showToast('Keine Berechtigung: Nur PDL und Administratoren dürfen Touren löschen.');
      return;
    }
    const target = touren.find((t) => t.id === tourId);
    setTouren((prev) => prev.filter((t) => t.id !== tourId));
    addAuditLog(
      'TOUR_PLAN_UPDATE',
      `Tour gelöscht: ${target?.name || tourId}`,
      'Tour vollständig aus der Einsatzdisposition entfernt'
    );
    showToast(`Tour „${target?.name || tourId}“ wurde entfernt.`);
  };

  // Add vital sign
  const handleAddVitalwert = (klientId: string, vitalwert: Omit<Vitalwert, 'id'>) => {
    if (!can('pflege_dokumentieren')) {
      showToast('Keine Berechtigung zum Dokumentieren von Vitalwerten.');
      return;
    }
    const newEntry: Vitalwert = {
      ...vitalwert,
      id: `vw-${Date.now()}`,
    };
    setKlienten((prev) =>
      prev.map((k) => {
        if (k.id !== klientId) return k;
        return {
          ...k,
          vitalwerte: [newEntry, ...k.vitalwerte],
        };
      })
    );
    addAuditLog('PATIENT_UPDATE', `Klient: ${klientId}`, 'Vitalwerte erfasst');
    showToast('Vitalwert in MariaDB gespeichert.');
  };

  // Add care report
  const handleAddPflegebericht = (
    klientId: string,
    bericht: Omit<PflegeberichtEintrag, 'id'>
  ) => {
    if (!can('pflege_dokumentieren')) {
      showToast('Keine Berechtigung zum Erstellen von Pflegeberichten.');
      return;
    }
    const newEntry: PflegeberichtEintrag = {
      ...bericht,
      id: `pb-${Date.now()}`,
    };
    setKlienten((prev) =>
      prev.map((k) => {
        if (k.id !== klientId) return k;
        return {
          ...k,
          pflegeberichte: [newEntry, ...k.pflegeberichte],
        };
      })
    );
    addAuditLog('PATIENT_UPDATE', `Klient: ${klientId}`, `Pflegebericht erstellt: ${bericht.kategorie}`);
    showToast('Pflegebericht in MariaDB archiviert.');
  };

  // Add medication
  const handleAddMedikation = (
    klientId: string,
    med: Omit<MedikationEintrag, 'id'>
  ) => {
    if (!can('medikation_bearbeiten')) {
      showToast('Keine Berechtigung zum Verordnen von Medikamenten.');
      return;
    }
    const newEntry: MedikationEintrag = {
      ...med,
      id: `med-${Date.now()}`,
    };
    setKlienten((prev) =>
      prev.map((k) => {
        if (k.id !== klientId) return k;
        return {
          ...k,
          medikamente: [...k.medikamente, newEntry],
        };
      })
    );
    addAuditLog('MED_DISPENSE', `Klient: ${klientId}`, `Medikament verordnet: ${med.handelsname}`);
    showToast('Medikament in MariaDB verordnet.');
  };

  // Add new client
  const handleAddKlient = (newKlient: Klient) => {
    if (!can('klienten_bearbeiten')) {
      showToast('Keine Berechtigung zum Anlegen neuer Klienten.');
      return;
    }
    setKlienten((prev) => [newKlient, ...prev]);
    setSelectedKlientId(newKlient.id);
    setCurrentTab('klienten');
    addAuditLog('PATIENT_UPDATE', `Neuer Klient: ${newKlient.id}`, `${newKlient.vorname} ${newKlient.nachname} angelegt`);
    showToast(`Klient ${newKlient.vorname} ${newKlient.nachname} in MariaDB angelegt.`);
  };

  // Update existing client (stammdaten, SIS, medication, vitalwerte, pflegeberichte)
  const handleUpdateKlient = (updatedKlient: Klient, auditDetails?: string) => {
    if (
      !can('klienten_bearbeiten') &&
      !can('sis_bearbeiten') &&
      !can('medikation_bearbeiten') &&
      !can('pflege_dokumentieren')
    ) {
      showToast('Keine Berechtigung zum Ändern der Klientenakte.');
      return;
    }
    setKlienten((prev) =>
      prev.map((k) => (k.id === updatedKlient.id ? updatedKlient : k))
    );
    addAuditLog(
      'PATIENT_UPDATE',
      `Klient: ${updatedKlient.vorname} ${updatedKlient.nachname} (${updatedKlient.id})`,
      auditDetails || 'Klientenakte aktualisiert'
    );
    showToast(`Änderungen für ${updatedKlient.vorname} ${updatedKlient.nachname} in MariaDB gespeichert.`);
  };

  // Delete client and remove linked tour stops
  const handleDeleteKlient = (klientId: string) => {
    if (!can('klienten_bearbeiten')) {
      showToast('Keine Berechtigung zum Löschen von Klienten.');
      return;
    }
    const target = klienten.find((k) => k.id === klientId);
    const remaining = klienten.filter((k) => k.id !== klientId);
    setKlienten(remaining);
    setTouren((prev) =>
      prev.map((t) => ({
        ...t,
        halte: t.halte.filter((h) => h.klientId !== klientId),
      }))
    );
    if (selectedKlientId === klientId) {
      setSelectedKlientId(remaining[0]?.id || null);
    }
    const label = target ? `${target.vorname} ${target.nachname}` : klientId;
    addAuditLog('PATIENT_UPDATE', `Klient gelöscht: ${klientId}`, `${label} aus MariaDB entfernt`);
    showToast(`Klient ${label} wurde aus MariaDB entfernt.`);
  };

  const handleSaveMariaDbConfig = (cfg: MariaDbConfig) => {
    if (!can('system_technik')) {
      showToast('Keine Berechtigung für die MariaDB-Systemkonfiguration.');
      return;
    }
    setMariaDbConfig(cfg);
    showToast(`MariaDB Verbindungspool aktualisiert (${cfg.host}:${cfg.port}/${cfg.database}).`);
  };

  // User management & RBAC handlers
  const handleSaveSsoConfig = (config: SsoKonfiguration) => {
    if (!can('users_verwalten')) {
      showToast('Keine Berechtigung zum Ändern der SSO-Konfiguration.');
      return;
    }
    setSsoConfig(config);
    addAuditLog(
      'SSO_CONFIG_CHANGE',
      'MariaDB sso_configurations',
      `SSO-Provider ${config.providerTyp} konfiguriert (${config.issuerUrl})`
    );
    showToast(`SSO-Konfiguration für ${config.bezeichnung} erfolgreich in MariaDB gespeichert.`);
  };

  const handleAddBenutzer = (user: AppBenutzer) => {
    if (!can('users_verwalten')) {
      showToast('Keine Berechtigung zum Anlegen von Benutzern.');
      return;
    }
    setBenutzer((prev) => [user, ...prev]);
    addAuditLog(
      'PATIENT_UPDATE',
      `Benutzer: ${user.benutzername}`,
      `Rolle ${user.rolle} zugewiesen (${user.authMethode})`
    );
    showToast(`Benutzer ${user.vorname} ${user.name} (${user.rolle}) erfolgreich angelegt.`);
  };

  const handleToggleUserStatus = (userId: string) => {
    if (!can('users_verwalten')) {
      showToast('Keine Berechtigung zum Sperren oder Aktivieren von Benutzern.');
      return;
    }
    const target = benutzer.find((u) => u.id === userId);
    if (!target) return;

    // Protect an administrator / active user from locking their own account
    if (target.aktiv && activeUser && target.id === activeUser.id) {
      showToast(
        target.rolle === 'Admin'
          ? 'Schutz aktiv: Ein Administrator kann sich nicht selbst sperren.'
          : 'Schutz aktiv: Sie können Ihr eigenes Benutzerkonto nicht selbst sperren.'
      );
      return;
    }

    // Protect the last active Admin from being locked
    if (target.aktiv && target.rolle === 'Admin') {
      const activeAdmins = benutzer.filter((u) => u.aktiv && u.rolle === 'Admin');
      if (activeAdmins.length <= 1) {
        showToast('Schutz aktiv: Der letzte aktive Administrator kann nicht gesperrt werden.');
        return;
      }
    }

    const newStatus = !target.aktiv;
    if (!newStatus) {
      setActiveSessions((sessions) => sessions.filter((s) => s.id !== userId));
    }
    setBenutzer((prev) =>
      prev.map((u) =>
        u.id === userId
          ? {
              ...u,
              aktiv: newStatus,
              fehlversuche: newStatus ? 0 : u.fehlversuche || 0,
            }
          : u
      )
    );
    addAuditLog(
      'PATIENT_UPDATE',
      `Benutzer: ${target.benutzername}`,
      newStatus
        ? 'Benutzer reaktiviert & Fehlversuchszähler zurückgesetzt'
        : 'Benutzerkonto gesperrt'
    );
    showToast(`Benutzerkonto ${target.benutzername} ist nun ${newStatus ? 'aktiv' : 'gesperrt'}.`);
  };

  const handleUpdateUserRole = (userId: string, newRole: BenutzerRolle) => {
    if (!can('users_verwalten')) {
      showToast('Keine Berechtigung zum Ändern von Benutzerrollen.');
      return;
    }
    const target = benutzer.find((u) => u.id === userId);
    if (!target || target.rolle === newRole) return;

    // Protect the last active Admin from being demoted
    if (target.aktiv && target.rolle === 'Admin' && newRole !== 'Admin') {
      const activeAdmins = benutzer.filter((u) => u.aktiv && u.rolle === 'Admin');
      if (activeAdmins.length <= 1) {
        showToast('Schutz aktiv: Der letzte aktive Administrator kann nicht auf eine andere Rolle herabgestuft werden.');
        return;
      }
    }

    const prevRole = target.rolle;
    setBenutzer((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, rolle: newRole } : u))
    );
    // Keep active sessions & current session immediately synchronized
    setActiveSessions((prev) =>
      prev.map((s) => (s.id === userId ? { ...s, role: newRole } : s))
    );
    setActiveUser((prev) =>
      prev && prev.id === userId ? { ...prev, role: newRole } : prev
    );

    addAuditLog(
      'ROLE_CHANGE',
      `Benutzer: ${target.benutzername}`,
      `Rolle angepasst: ${prevRole} → ${newRole}`
    );
    showToast(
      `Rolle von ${target.vorname} ${target.name} auf ${
        rollenConfig[newRole]?.bezeichnung || newRole
      } geändert.`
    );
  };

  const handleUpdateRolePermissions = (
    rolle: BenutzerRolle,
    berechtigungen: Berechtigung[]
  ) => {
    if (!can('users_verwalten')) {
      showToast('Keine Berechtigung zum Anpassen von Rollenberechtigungen.');
      return;
    }
    const existing = rollenConfig[rolle];
    if (!existing) return;

    const sanitized =
      rolle === 'Admin' && !berechtigungen.includes('users_verwalten')
        ? (['users_verwalten', ...berechtigungen] as Berechtigung[])
        : berechtigungen;

    setRollenConfig((prev) => ({
      ...prev,
      [rolle]: {
        ...prev[rolle],
        berechtigungen: sanitized,
      },
    }));

    addAuditLog(
      'ROLE_CONFIG_CHANGE',
      `RBAC Rolle: ${rolle}`,
      `Berechtigungen aktualisiert (${sanitized.length} Module/Aktionen erlaubt)`
    );
    showToast(`Rollenrechte für ${existing.bezeichnung} sofort wirksam gespeichert.`);
  };

  const handleToggleRoleMfaRequired = (rolle: BenutzerRolle) => {
    if (!can('users_verwalten')) {
      showToast('Keine Berechtigung zum Ändern der Rollen-2FA-Pflicht.');
      return;
    }
    const existing = rollenConfig[rolle];
    if (!existing) return;
    const nextRequired = !existing.zweiFaktorPflicht;
    setRollenConfig((prev) => ({
      ...prev,
      [rolle]: {
        ...prev[rolle],
        zweiFaktorPflicht: nextRequired,
      },
    }));
    addAuditLog(
      'ROLE_CONFIG_CHANGE',
      `RBAC Rolle: ${rolle}`,
      nextRequired
        ? `2FA-Pflicht für alle lokalen Benutzer der Rolle „${existing.bezeichnung}“ aktiviert`
        : `2FA-Pflicht für Rolle „${existing.bezeichnung}“ aufgehoben`
    );
    showToast(
      `2FA-Pflicht für Rolle „${existing.bezeichnung}“ wurde ${
        nextRequired ? 'aktiviert' : 'deaktiviert'
      }.`
    );
  };

  const handleResetRoleToDefault = (rolle: BenutzerRolle) => {
    if (!can('users_verwalten')) {
      showToast('Keine Berechtigung zum Zurücksetzen von Rollenberechtigungen.');
      return;
    }
    if (!INITIAL_ROLLEN_CONFIG[rolle]) {
      showToast('Für benutzerdefinierte Rollen gibt es keine Standardrechte.');
      return;
    }
    setRollenConfig((prev) => ({
      ...prev,
      [rolle]: INITIAL_ROLLEN_CONFIG[rolle],
    }));
    addAuditLog(
      'ROLE_CONFIG_CHANGE',
      `RBAC Rolle: ${rolle}`,
      'Standardberechtigungen wiederhergestellt'
    );
    showToast(`Standardrechte für ${INITIAL_ROLLEN_CONFIG[rolle].bezeichnung} wiederhergestellt.`);
  };

  const handleCreateRole = (newRole: RollenDefinition): boolean => {
    if (!can('users_verwalten')) {
      showToast('Keine Berechtigung zum Erstellen neuer Rollen.');
      return false;
    }
    const key = newRole.rolle.trim();
    if (!key || rollenConfig[key]) {
      showToast(`Rollen-Schlüssel „${key}“ existiert bereits oder ist ungültig.`);
      return false;
    }
    const created: RollenDefinition = {
      ...newRole,
      rolle: key,
      bezeichnung: newRole.bezeichnung.trim(),
      beschreibung:
        newRole.beschreibung.trim() ||
        'Benutzerdefinierte Fachrolle (individuell durch Administrator konfiguriert).',
      istStandard: false,
    };
    setRollenConfig((prev) => ({
      ...prev,
      [key]: created,
    }));
    addAuditLog(
      'ROLE_CREATE',
      `RBAC Rolle: ${key}`,
      `Neue Rolle „${created.bezeichnung}“ mit ${created.berechtigungen.length} Berechtigungen angelegt`
    );
    showToast(`Neue Rolle „${created.bezeichnung}“ erfolgreich erstellt.`);
    return true;
  };

  const handleDeleteRole = (rolle: BenutzerRolle): boolean => {
    if (!can('users_verwalten')) {
      showToast('Keine Berechtigung zum Löschen von Rollen.');
      return false;
    }
    const target = rollenConfig[rolle];
    if (!target || target.istStandard || isStandardRolle(rolle)) {
      showToast('Standardrollen können nicht gelöscht werden.');
      return false;
    }
    const assignedUsers = benutzer.filter((u) => u.rolle === rolle);
    if (assignedUsers.length > 0) {
      showToast(
        `Rolle „${target.bezeichnung}“ ist noch ${assignedUsers.length} Benutzer(n) zugewiesen. Bitte weisen Sie diesen zuerst eine andere Rolle zu.`
      );
      return false;
    }
    if (ssoConfig.defaultRolle === rolle) {
      showToast(
        `Rolle „${target.bezeichnung}“ ist aktuell als SSO-Standardrolle konfiguriert und kann nicht gelöscht werden.`
      );
      return false;
    }
    setRollenConfig((prev) => {
      const next = { ...prev };
      delete next[rolle];
      return next;
    });
    setSsoConfig((prev) => ({
      ...prev,
      rollenMapping: prev.rollenMapping.filter((m) => m.zielRolle !== rolle),
    }));
    addAuditLog(
      'ROLE_DELETE',
      `RBAC Rolle: ${rolle}`,
      `Benutzerdefinierte Rolle „${target.bezeichnung}“ entfernt`
    );
    showToast(`Rolle „${target.bezeichnung}“ wurde entfernt.`);
    return true;
  };

  // Add-on & German Telematik (TI) Middleware handlers
  const handleToggleAddon = (addonId: string) => {
    if (!can('addons_verwalten')) {
      showToast('Keine Berechtigung zum Verwalten von Add-ons.');
      return;
    }
    const target = addons.find((a) => a.id === addonId);
    if (!target) return;
    const nextActive = !target.aktiv;
    const nowStamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    setAddons((prev) =>
      prev.map((a) =>
        a.id === addonId
          ? {
              ...a,
              aktiv: nextActive,
              status: nextActive ? 'verbunden' : 'inaktiv',
              letzterHeartbeat: nextActive ? nowStamp : 'Deaktiviert',
              latenzMs: nextActive ? a.latenzMs || 34 : undefined,
            }
          : a
      )
    );
    addAuditLog(
      'ADDON_UPDATE',
      `Add-on: ${target.name}`,
      nextActive ? 'Add-on aktiviert & Verbindung hergestellt' : 'Add-on deaktiviert'
    );
    showToast(`Add-on „${target.name}“ wurde ${nextActive ? 'aktiviert' : 'deaktiviert'}.`);
  };

  const handleUpdateAddon = (updated: PflegeAddon) => {
    if (!can('addons_verwalten')) {
      showToast('Keine Berechtigung zum Konfigurieren von Add-ons.');
      return;
    }
    setAddons((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    addAuditLog(
      'ADDON_UPDATE',
      `Add-on: ${updated.name}`,
      `Konfiguration aktualisiert (${updated.endpointUrl} · ${updated.scopes.length} Scopes)`
    );
    showToast(`Konfiguration für „${updated.name}“ in MariaDB gespeichert.`);
  };

  const handleInstallAddon = (addon: PflegeAddon): boolean => {
    if (!can('addons_verwalten')) {
      showToast('Keine Berechtigung zum Installieren von Add-ons.');
      return false;
    }
    if (addons.some((a) => a.id === addon.id)) {
      showToast(`Ein Add-on mit der ID „${addon.id}“ ist bereits installiert.`);
      return false;
    }
    setAddons((prev) => [addon, ...prev]);
    addAuditLog(
      'ADDON_INSTALL',
      `Add-on: ${addon.name} (${addon.id})`,
      `Anbieter: ${addon.anbieter} · Kategorie: ${addon.kategorie} · Endpoint: ${addon.endpointUrl}`
    );
    showToast(`Add-on „${addon.name}“ erfolgreich registriert und aktiviert.`);
    return true;
  };

  const handleRemoveAddon = (addonId: string) => {
    if (!can('addons_verwalten')) {
      showToast('Keine Berechtigung zum Entfernen von Add-ons.');
      return;
    }
    const target = addons.find((a) => a.id === addonId);
    if (!target) return;
    setAddons((prev) => prev.filter((a) => a.id !== addonId));
    addAuditLog(
      'ADDON_REMOVE',
      `Add-on: ${target.name} (${target.id})`,
      'Add-on und registrierte Hooks aus dem System entfernt'
    );
    showToast(`Add-on „${target.name}“ wurde deinstalliert.`);
  };

  const handleTestAddonHealth = (addonId: string) => {
    if (!can('addons_verwalten')) return;
    const target = addons.find((a) => a.id === addonId);
    if (!target || !target.aktiv) return;
    const nowStamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const latency = Math.floor(16 + Math.random() * 44);
    setAddons((prev) =>
      prev.map((a) =>
        a.id === addonId
          ? {
              ...a,
              status: 'verbunden',
              letzterHeartbeat: nowStamp,
              latenzMs: latency,
            }
          : a
      )
    );
    showToast(`Healthcheck erfolgreich: ${target.name} antwortet in ${latency} ms.`);
  };

  const handleDispatchTiAction = (tx: Omit<TiTransaktion, 'id' | 'zeitstempel'>) => {
    if (!can('telematik_nutzen')) {
      showToast('Keine Berechtigung zur Nutzung von Telematik-Diensten.');
      return;
    }
    const nowStamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const entry: TiTransaktion = {
      ...tx,
      id: `ti-tx-${Date.now()}`,
      zeitstempel: nowStamp,
    };
    setTiTransaktionen((prev) => [entry, ...prev]);
    addAuditLog(
      'TI_DISPATCH',
      `${tx.dienst} via ${tx.addonName}`,
      `${tx.dokumentTyp} für ${tx.klientName} → ${tx.empfaengerOderZiel} (Ref: ${tx.referenzId})`
    );
    showToast(`${tx.dienst} über ${tx.addonName} erfolgreich ausgeführt (${tx.referenzId}).`);
  };

  const handleResetUserPassword = (
    userId: string,
    salt: string,
    hash: string,
    forceChange: boolean
  ) => {
    if (!can('users_verwalten')) {
      showToast('Keine Berechtigung zum Zurücksetzen von Passwörtern.');
      return;
    }
    const target = benutzer.find((u) => u.id === userId);
    setBenutzer((prev) =>
      prev.map((u) =>
        u.id === userId
          ? {
              ...u,
              passwortSalt: salt,
              passwortHash: hash,
              mussPasswortAendern: forceChange,
              fehlversuche: 0,
            }
          : u
      )
    );
    addAuditLog(
      'PASSWORD_CHANGE',
      `Benutzer: ${target?.benutzername || userId}`,
      forceChange
        ? 'Passwort durch Admin zurückgesetzt (Änderung beim nächsten Login erzwungen)'
        : 'Passwort durch Admin zurückgesetzt'
    );
    showToast(`Neues Passwort für ${target?.benutzername || userId} sicher gespeichert.`);
  };

  const handleSelfPasswordChange = (userId: string, salt: string, hash: string) => {
    setBenutzer((prev) =>
      prev.map((u) =>
        u.id === userId
          ? {
              ...u,
              passwortSalt: salt,
              passwortHash: hash,
              mussPasswortAendern: false,
              fehlversuche: 0,
            }
          : u
      )
    );
    addAuditLog(
      'PASSWORD_CHANGE',
      `Benutzer: ${activeUser?.benutzername || userId}`,
      'Benutzer hat eigenes Passwort geändert (PBKDF2-SHA256)'
    );
    showToast('Ihr Passwort wurde sicher aktualisiert.');
  };

  const handleCompleteForcedPasswordChange = (
    userId: string,
    salt: string,
    hash: string
  ): AppBenutzer | null => {
    let updated: AppBenutzer | null = null;
    setBenutzer((prev) =>
      prev.map((u) => {
        if (u.id !== userId) return u;
        updated = {
          ...u,
          passwortSalt: salt,
          passwortHash: hash,
          mussPasswortAendern: false,
          fehlversuche: 0,
        };
        return updated;
      })
    );
    const target = benutzer.find((u) => u.id === userId);
    if (target) {
      addAuditLog(
        'PASSWORD_CHANGE',
        `Benutzer: ${target.benutzername}`,
        'Erzwungene Passwortänderung nach Reset erfolgreich abgeschlossen',
        { benutzer: target.benutzername, rolle: target.rolle }
      );
      return {
        ...target,
        passwortSalt: salt,
        passwortHash: hash,
        mussPasswortAendern: false,
        fehlversuche: 0,
      };
    }
    return updated;
  };

  const handleFailedLogin = (
    identifier: string,
    matchedUser?: AppBenutzer,
    viaSso?: boolean
  ) => {
    if (matchedUser) {
      const nextAttempts = (matchedUser.fehlversuche || 0) + 1;
      const isLastActiveAdmin =
        matchedUser.aktiv &&
        matchedUser.rolle === 'Admin' &&
        benutzer.filter((u) => u.aktiv && u.rolle === 'Admin').length <= 1;
      const shouldLock = nextAttempts >= MAX_LOGIN_ATTEMPTS && !isLastActiveAdmin;

      setBenutzer((prev) =>
        prev.map((u) =>
          u.id === matchedUser.id
            ? {
                ...u,
                fehlversuche: nextAttempts,
                aktiv: shouldLock ? false : u.aktiv,
              }
            : u
        )
      );
      addAuditLog(
        'LOGIN_FAILED',
        viaSso ? 'SSO Identity Provider' : 'MariaDB Auth',
        shouldLock
          ? `Fehlgeschlagener Login (${nextAttempts}/${MAX_LOGIN_ATTEMPTS}) – Konto automatisch gesperrt`
          : nextAttempts >= MAX_LOGIN_ATTEMPTS && isLastActiveAdmin
          ? `Fehlgeschlagener Login (${nextAttempts}/${MAX_LOGIN_ATTEMPTS}) – Automatische Sperrung verhindert (letzter aktiver Administrator)`
          : `Fehlgeschlagener Login-Versuch (${nextAttempts}/${MAX_LOGIN_ATTEMPTS})`,
        { benutzer: matchedUser.benutzername, rolle: matchedUser.rolle }
      );
    } else {
      addAuditLog(
        'LOGIN_FAILED',
        viaSso ? 'SSO Identity Provider' : 'MariaDB Auth',
        `Unbekannter Benutzername/E-Mail: ${identifier}`,
        { benutzer: identifier, rolle: 'Pflegehelfer' }
      );
    }
  };

  const handleUpdateUserMfa = (
    userId: string,
    nextConfig: BenutzerZweiFaktorConfig,
    auditAction: 'MFA_SETUP' | 'PASSKEY_REGISTER' | 'PASSKEY_REMOVE',
    auditDetails: string
  ) => {
    const target = benutzer.find((u) => u.id === userId);
    setBenutzer((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, zweiFaktor: nextConfig } : u))
    );
    addAuditLog(
      auditAction,
      `2FA / Passkey: ${target?.benutzername || userId}`,
      auditDetails
    );
    showToast('Sicherheitseinstellungen (2FA / Passkeys) in MariaDB gespeichert.');
  };

  const handleToggleUserMfaRequired = (userId: string) => {
    if (!can('users_verwalten')) {
      showToast('Keine Berechtigung zum Ändern der 2FA-Pflicht.');
      return;
    }
    const target = benutzer.find((u) => u.id === userId);
    if (!target || target.authMethode !== 'lokal') return;
    const nextRequired = !target.zweiFaktorPflicht;
    setBenutzer((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, zweiFaktorPflicht: nextRequired } : u))
    );
    addAuditLog(
      'MFA_SETUP',
      `Benutzer: ${target.benutzername}`,
      nextRequired
        ? '2FA-Pflicht für lokales Konto aktiviert'
        : '2FA-Pflicht für lokales Konto aufgehoben'
    );
    showToast(
      `2FA-Pflicht für ${target.benutzername} wurde ${nextRequired ? 'aktiviert' : 'deaktiviert'}.`
    );
  };

  const handleAdminResetUserMfa = (userId: string) => {
    if (!can('users_verwalten')) {
      showToast('Keine Berechtigung zum Zurücksetzen von 2FA.');
      return;
    }
    const target = benutzer.find((u) => u.id === userId);
    if (!target || target.authMethode !== 'lokal') return;
    setBenutzer((prev) =>
      prev.map((u) =>
        u.id === userId
          ? {
              ...u,
              zweiFaktor: {
                aktiviert: false,
                totpAktiviert: false,
                sicherheitsSchluessel: [],
                passkeys: [],
              },
            }
          : u
      )
    );
    addAuditLog(
      'MFA_SETUP',
      `Benutzer: ${target.benutzername}`,
      '2FA-Faktoren (TOTP, Sicherheitssticks) und Passkeys durch Administrator zurückgesetzt'
    );
    showToast(`2FA & Passkeys für ${target.benutzername} wurden zurückgesetzt.`);
  };

  const handleMfaVerified = (user: AppBenutzer, details: string, isPasskey = false) => {
    addAuditLog(
      isPasskey ? 'PASSKEY_LOGIN' : 'MFA_VERIFIED',
      isPasskey ? 'WebAuthn Passkey' : 'MariaDB 2FA (TOTP / FIDO2)',
      details,
      { benutzer: user.benutzername, rolle: user.rolle }
    );
  };

  const handleMfaFailed = (user: AppBenutzer, details: string) => {
    const nextAttempts = (user.fehlversuche || 0) + 1;
    const isLastActiveAdmin =
      user.aktiv &&
      user.rolle === 'Admin' &&
      benutzer.filter((u) => u.aktiv && u.rolle === 'Admin').length <= 1;
    const shouldLock = nextAttempts >= MAX_LOGIN_ATTEMPTS && !isLastActiveAdmin;

    setBenutzer((prev) =>
      prev.map((u) =>
        u.id === user.id
          ? {
              ...u,
              fehlversuche: nextAttempts,
              aktiv: shouldLock ? false : u.aktiv,
            }
          : u
      )
    );
    addAuditLog(
      'MFA_FAILED',
      'MariaDB 2FA / Passkey',
      shouldLock
        ? `${details} (${nextAttempts}/${MAX_LOGIN_ATTEMPTS}) – Konto automatisch gesperrt`
        : `${details} (Fehlversuch ${nextAttempts}/${MAX_LOGIN_ATTEMPTS})`,
      { benutzer: user.benutzername, rolle: user.rolle }
    );
  };

  const handleConsumeBackupCode = (userId: string, remainingHashes: string[]) => {
    setBenutzer((prev) =>
      prev.map((u) =>
        u.id === userId && u.zweiFaktor
          ? {
              ...u,
              zweiFaktor: {
                ...u.zweiFaktor,
                backupCodeHashes: remainingHashes,
              },
            }
          : u
      )
    );
  };

  const handleRecordCredentialUsage = (
    userId: string,
    kind: 'security_key' | 'passkey',
    credentialId: string
  ) => {
    const nowStamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
    setBenutzer((prev) =>
      prev.map((u) => {
        if (u.id !== userId || !u.zweiFaktor) return u;
        if (kind === 'security_key') {
          return {
            ...u,
            zweiFaktor: {
              ...u.zweiFaktor,
              sicherheitsSchluessel: u.zweiFaktor.sicherheitsSchluessel.map((k) =>
                k.credentialId === credentialId
                  ? { ...k, signCount: k.signCount + 1, zuletztVerwendet: nowStamp }
                  : k
              ),
            },
          };
        }
        return {
          ...u,
          zweiFaktor: {
            ...u.zweiFaktor,
            passkeys: u.zweiFaktor.passkeys.map((p) =>
              p.credentialId === credentialId
                ? { ...p, signCount: p.signCount + 1, zuletztVerwendet: nowStamp }
                : p
            ),
          },
        };
      })
    );
  };

  const handleSwitchUser = (targetSessionId?: string) => {
    setIsChangePasswordOpen(false);
    setIsMfaModalOpen(false);
    setSwitchTargetSessionId(targetSessionId || null);
    setActiveUser(null);
    setLogoutNotice(
      targetSessionId
        ? 'Bitte bestätigen Sie den Benutzerwechsel mit Passwort/2FA oder Ihrem Passkey.'
        : 'Aktive Sitzung pausiert. Melden Sie sich als weiterer Benutzer an oder entsperren Sie eine angemeldete Sitzung.'
    );
  };

  const handleEndSession = (userId: string) => {
    const target = activeSessions.find((s) => s.id === userId);
    setActiveSessions((prev) => prev.filter((s) => s.id !== userId));
    if (switchTargetSessionId === userId) {
      setSwitchTargetSessionId(null);
    }
    if (target) {
      addAuditLog(
        'LOGOUT',
        'PflegeRust Session',
        `Sitzung von ${target.name} (${target.auth}) vollständig beendet`,
        { benutzer: target.benutzername, rolle: target.role }
      );
      setLogoutNotice(`Sitzung von ${target.name} wurde vollständig abgemeldet.`);
    }
  };

  const handleLogout = () => {
    if (!activeUser) return;
    const prevName = activeUser.name;
    const prevId = activeUser.id;
    addAuditLog(
      'LOGOUT',
      'PflegeRust Session',
      `Benutzer ${activeUser.name} (${activeUser.auth}) hat sich regulär abgemeldet`,
      { benutzer: activeUser.benutzername, rolle: activeUser.role }
    );
    setActiveSessions((prev) => prev.filter((s) => s.id !== prevId));
    setSwitchTargetSessionId(null);
    setActiveUser(null);
    setIsChangePasswordOpen(false);
    setIsMfaModalOpen(false);
    setLogoutNotice(
      `Sie wurden als ${prevName} vollständig abgemeldet. Für eine erneute Anmeldung sind Passwort/2FA oder Ihr Passkey erforderlich.`
    );
  };

  const handleLogin = (user: AppBenutzer, authLabel: string) => {
    const nowStamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
    setBenutzer((prev) =>
      prev.map((u) =>
        u.id === user.id ? { ...u, letzterLogin: nowStamp, fehlversuche: 0 } : u
      )
    );
    const fullName = `${user.vorname} ${user.name}`;
    const sessionUser: ActiveSessionUser = {
      id: user.id,
      benutzername: user.benutzername,
      email: user.email,
      name: fullName,
      role: user.rolle,
      auth: authLabel,
      abteilung: user.abteilung,
    };
    setActiveSessions((prev) => {
      const withoutCurrent = prev.filter((s) => s.id !== sessionUser.id);
      return [sessionUser, ...withoutCurrent];
    });
    setActiveUser(sessionUser);
    setSwitchTargetSessionId(null);
    setLogoutNotice(null);
    setCurrentTab(getFirstAllowedTab(user.rolle, rollenConfig));
    addAuditLog(
      user.authMethode === 'lokal' ? 'LOGIN_SUCCESS' : 'LOGIN_SSO',
      user.authMethode === 'lokal' ? 'MariaDB Auth (PBKDF2/Argon2)' : authLabel,
      `Erfolgreiche verifizierte Anmeldung als ${fullName} (${user.rolle})`,
      { benutzer: user.benutzername, rolle: user.rolle }
    );
    showToast(`Willkommen, ${fullName} (${user.rolle}).`);
  };

  const handleCompleteSetup = (payload: SetupCompletionPayload) => {
    // Defense-in-depth: strictly enforce role 'Admin' for the very first user
    const firstAdmin: AppBenutzer = {
      ...payload.adminUser,
      rolle: 'Admin',
      aktiv: true,
      fehlversuche: 0,
      zweiFaktorPflicht: false,
      zweiFaktor: {
        aktiviert: false,
        totpAktiviert: false,
        sicherheitsSchluessel: [],
        passkeys: [],
      },
    };

    const fullName = `${firstAdmin.vorname} ${firstAdmin.name}`;
    const adminSession: ActiveSessionUser = {
      id: firstAdmin.id,
      benutzername: firstAdmin.benutzername,
      email: firstAdmin.email,
      name: fullName,
      role: 'Admin',
      auth: 'Lokal (MariaDB)',
      abteilung: firstAdmin.abteilung,
    };

    const nowTs = new Date().toISOString().replace('T', ' ').slice(0, 19);

    setEinrichtung(payload.einrichtung);
    setMariaDbConfig(payload.mariaDb);
    if (payload.ssoPatch) {
      setSsoConfig((prev) => ({
        ...prev,
        ...payload.ssoPatch,
      }));
    }

    if (payload.loadDemoCareData) {
      setKlienten(INITIAL_KLIENTEN);
      setTouren(INITIAL_TOUREN);
      setSelectedKlientId(INITIAL_KLIENTEN[0]?.id || null);
    } else {
      setKlienten([]);
      setTouren([]);
      setSelectedKlientId(null);
    }

    setBenutzer([firstAdmin]);
    setActiveUser(adminSession);
    setActiveSessions([adminSession]);
    setSwitchTargetSessionId(null);
    setLogoutNotice(null);
    setCurrentTab('dashboard');
    setAuditLogs([
      {
        id: `aud-setup-login-${Date.now()}`,
        zeitstempel: nowTs,
        benutzer: firstAdmin.benutzername,
        rolle: 'Admin',
        aktion: 'LOGIN_SUCCESS',
        ressource: 'MariaDB Auth (PBKDF2/Argon2)',
        details: `Erstanmeldung als Systemadministrator ${fullName} (Admin)`,
        ipAdresse: '127.0.0.1',
      },
      {
        id: `aud-setup-${Date.now() - 1}`,
        zeitstempel: nowTs,
        benutzer: firstAdmin.benutzername,
        rolle: 'Admin',
        aktion: 'SYSTEM_SETUP',
        ressource: `Einrichtung: ${payload.einrichtung.name} (IK ${payload.einrichtung.ikNummer})`,
        details: `Ersteinrichtung abgeschlossen; MariaDB ${payload.mariaDb.host}:${payload.mariaDb.port}/${payload.mariaDb.database} initialisiert; Erstbenutzer mit Rolle Admin erstellt`,
        ipAdresse: '127.0.0.1',
      },
    ]);
    setIsSetupCompleted(true);
    showToast(`Ersteinrichtung abgeschlossen. Angemeldet als ${fullName} (Admin).`);
  };

  // Fresh installation: run Initial Setup Wizard until first Admin user is created
  if (!isSetupCompleted || benutzer.length === 0) {
    return (
      <SetupWizardView
        initialMariaDb={mariaDbConfig}
        initialSsoConfig={ssoConfig}
        onCompleteSetup={handleCompleteSetup}
      />
    );
  }

  if (!activeUser) {
    return (
      <LoginView
        benutzer={benutzer}
        activeSessions={activeSessions}
        initialTargetSessionId={switchTargetSessionId}
        einrichtungName={einrichtung.name}
        ssoConfig={ssoConfig}
        logoutNotice={logoutNotice}
        credentialsReady={true}
        onLogin={handleLogin}
        onEndSession={handleEndSession}
        onFailedLogin={handleFailedLogin}
        onMfaVerified={handleMfaVerified}
        onMfaFailed={handleMfaFailed}
        onConsumeBackupCode={handleConsumeBackupCode}
        onRecordCredentialUsage={handleRecordCredentialUsage}
        onCompleteForcedPasswordChange={handleCompleteForcedPasswordChange}
      />
    );
  }

  const currentUserRecord = benutzer.find((u) => u.id === activeUser.id) || null;
  const currentHas2fa = Boolean(currentUserRecord && hasActiveSecondFactor(currentUserRecord));
  const currentPasskeyCount = currentUserRecord?.zweiFaktor?.passkeys.length || 0;
  const isRoleMfaRequired = Boolean(
    currentUserRecord && rollenConfig[currentUserRecord.rolle]?.zweiFaktorPflicht
  );
  const isUserMfaRequired = Boolean(currentUserRecord?.zweiFaktorPflicht);
  const mfaRequiredByPolicy = Boolean(
    currentUserRecord &&
      currentUserRecord.authMethode === 'lokal' &&
      (isRoleMfaRequired || isUserMfaRequired)
  );
  const mfaPolicyReason = isRoleMfaRequired
    ? `Rolle „${rollenConfig[activeUser.role]?.bezeichnung || activeUser.role}“`
    : isUserMfaRequired
    ? 'Benutzer-Richtlinie'
    : undefined;
  const mustEnrollMfa = Boolean(mfaRequiredByPolicy && !currentHas2fa);
  const effectiveTab = canAccessTab(activeUser.role, currentTab, rollenConfig)
    ? currentTab
    : getFirstAllowedTab(activeUser.role, rollenConfig);
  const hasEffectiveTabAccess = canAccessTab(activeUser.role, effectiveTab, rollenConfig);
  const canPlanTouren = can('touren_planen');
  const visibleTouren = canPlanTouren
    ? touren
    : touren.filter((t) => t.zugewiesenerBenutzerId === activeUser.id);

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 font-sans text-slate-900">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 bg-teal-900 text-white px-4 py-2.5 rounded-lg shadow-lg text-xs font-medium border border-teal-700 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>{notification}</span>
        </div>
      )}

      {/* Header */}
      <Header
        currentTab={effectiveTab}
        onSelectTab={handleSelectTab}
        clientCount={klienten.length}
        onOpenMariaDbModal={() => {
          if (can('system_technik')) setIsMariaDbModalOpen(true);
        }}
        activeUser={activeUser}
        activeSessions={activeSessions}
        rollenConfig={rollenConfig}
        hasActive2fa={currentHas2fa}
        passkeyCount={currentPasskeyCount}
        onSwitchUser={handleSwitchUser}
        onLogout={handleLogout}
        onOpenChangePassword={() => setIsChangePasswordOpen(true)}
        onOpenMfaModal={() => setIsMfaModalOpen(true)}
      />

      {/* Main Layout Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          currentTab={effectiveTab}
          onSelectTab={handleSelectTab}
          clientCount={klienten.length}
          tourCount={visibleTouren.length}
          userCount={benutzer.length}
          activeAddonCount={addons.filter((a) => a.aktiv).length}
          einrichtung={einrichtung}
          rollenConfig={rollenConfig}
          onOpenMariaDbModal={() => {
            if (can('system_technik')) setIsMariaDbModalOpen(true);
          }}
          activeUser={activeUser}
          hasActive2fa={currentHas2fa}
          passkeyCount={currentPasskeyCount}
          onOpenMfaModal={() => setIsMfaModalOpen(true)}
          onSwitchUser={() => handleSwitchUser()}
          onLogout={handleLogout}
        />

        {/* Viewport Canvas */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            {!hasEffectiveTabAccess && (
              <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-lg mx-auto mt-10 text-center space-y-3 shadow-xs">
                <div className="w-11 h-11 rounded-full bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <h2 className="text-base font-bold text-slate-900">
                  Keine Module für Ihre Rolle freigegeben
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Für Ihre aktuelle Rolle (<strong>{rollenConfig[activeUser.role]?.bezeichnung || activeUser.role}</strong>) sind derzeit keine Anwendungsbereiche aktiviert. Bitte wenden Sie sich an einen Administrator.
                </p>
              </div>
            )}

            {hasEffectiveTabAccess && effectiveTab === 'dashboard' && (
              <DashboardView
                klienten={klienten}
                touren={visibleTouren}
                onSelectTab={handleSelectTab}
                onSelectKlient={setSelectedKlientId}
                onOpenNewKlientModal={() => {
                  if (can('klienten_bearbeiten')) setIsNewKlientModalOpen(true);
                }}
                onToggleHaltStatus={handleToggleHaltStatus}
                onOpenMariaDbModal={() => {
                  if (can('system_technik')) setIsMariaDbModalOpen(true);
                }}
                canReadKlienten={can('klienten_lesen')}
                canEditKlienten={can('klienten_bearbeiten')}
                canReadTouren={can('touren_lesen')}
                canPlanTouren={canPlanTouren}
                canConfirmTouren={can('touren_quittieren')}
                canMigrate={can('migration')}
                canSystem={can('system_technik')}
              />
            )}

            {hasEffectiveTabAccess && effectiveTab === 'klienten' && (
              <KlientenView
                klienten={klienten}
                touren={visibleTouren}
                selectedKlientId={selectedKlientId}
                canEditKlienten={can('klienten_bearbeiten')}
                canDocumentCare={can('pflege_dokumentieren')}
                canReadSis={can('sis_lesen')}
                canEditSis={can('sis_bearbeiten')}
                canReadMedikation={can('medikation_lesen')}
                canEditMedikation={can('medikation_bearbeiten')}
                onSelectKlient={(id) => {
                  setSelectedKlientId(id);
                  addAuditLog('PATIENT_READ', `Klientenakte: ${id}`, 'Akte zur Einsicht aufgerufen');
                }}
                onOpenNewKlientModal={() => {
                  if (can('klienten_bearbeiten')) setIsNewKlientModalOpen(true);
                }}
                onAddVitalwert={handleAddVitalwert}
                onAddPflegebericht={handleAddPflegebericht}
                onUpdateKlient={handleUpdateKlient}
                onDeleteKlient={handleDeleteKlient}
              />
            )}

            {hasEffectiveTabAccess && effectiveTab === 'touren' && (
              <TourenView
                touren={visibleTouren}
                klienten={klienten}
                benutzer={benutzer}
                canPlanTouren={canPlanTouren}
                canConfirmTouren={can('touren_quittieren')}
                canReadKlienten={can('klienten_lesen')}
                onToggleHaltStatus={handleToggleHaltStatus}
                onAddTour={handleAddTour}
                onUpdateTour={handleUpdateTour}
                onDeleteTour={handleDeleteTour}
                onSelectKlient={setSelectedKlientId}
                onSelectTab={handleSelectTab}
              />
            )}

            {hasEffectiveTabAccess && effectiveTab === 'sis' && (
              <SisView
                klienten={klienten}
                canEditSis={can('sis_bearbeiten')}
                onSelectKlient={setSelectedKlientId}
                onUpdateKlient={handleUpdateKlient}
              />
            )}

            {hasEffectiveTabAccess && effectiveTab === 'medikation' && (
              <MedikationView
                klienten={klienten}
                canEditMedikation={can('medikation_bearbeiten')}
                canReadKlienten={can('klienten_lesen')}
                onAddMedikation={handleAddMedikation}
                onSelectKlient={setSelectedKlientId}
                onSelectTab={handleSelectTab}
              />
            )}

            {hasEffectiveTabAccess && effectiveTab === 'dienstplan' && (
              <DienstplanView mitarbeiter={mitarbeiter} />
            )}

            {hasEffectiveTabAccess && effectiveTab === 'abrechnung' && (
              <AbrechnungView klienten={klienten} />
            )}

            {hasEffectiveTabAccess && effectiveTab === 'addons' && (
              <AddonsView
                addons={addons}
                klienten={klienten}
                tiTransaktionen={tiTransaktionen}
                canManageAddons={can('addons_verwalten')}
                canUseTelematik={can('telematik_nutzen')}
                onToggleAddon={handleToggleAddon}
                onUpdateAddon={handleUpdateAddon}
                onInstallAddon={handleInstallAddon}
                onRemoveAddon={handleRemoveAddon}
                onTestAddonHealth={handleTestAddonHealth}
                onDispatchTiAction={handleDispatchTiAction}
              />
            )}

            {hasEffectiveTabAccess && effectiveTab === 'users' && (
              <UserManagementView
                benutzer={benutzer}
                activeUserId={activeUser.id}
                rollenConfig={rollenConfig}
                ssoConfig={ssoConfig}
                auditLogs={auditLogs}
                canManageUsers={can('users_verwalten')}
                canReadAudit={can('audit_lesen')}
                onSaveSsoConfig={handleSaveSsoConfig}
                onAddBenutzer={handleAddBenutzer}
                onToggleUserStatus={handleToggleUserStatus}
                onUpdateUserRole={handleUpdateUserRole}
                onUpdateRolePermissions={handleUpdateRolePermissions}
                onResetRoleToDefault={handleResetRoleToDefault}
                onCreateRole={handleCreateRole}
                onDeleteRole={handleDeleteRole}
                onResetUserPassword={handleResetUserPassword}
                onToggleUserMfaRequired={handleToggleUserMfaRequired}
                onAdminResetUserMfa={handleAdminResetUserMfa}
                onToggleRoleMfaRequired={handleToggleRoleMfaRequired}
                onOpenOwnMfaModal={() => setIsMfaModalOpen(true)}
              />
            )}

            {hasEffectiveTabAccess && effectiveTab === 'migration' && (
              <MigrationView
                onImportComplete={handleImportComplete}
                onSelectTab={handleSelectTab}
              />
            )}

            {hasEffectiveTabAccess && effectiveTab === 'rust' && <RustCodeView />}

            {hasEffectiveTabAccess && effectiveTab === 'terminal' && (
              <DebianTerminalView klientenCount={klienten.length} />
            )}

            {hasEffectiveTabAccess && effectiveTab === 'systempflege' && <SystempflegeView />}
          </div>
        </main>
      </div>

      {/* MariaDB Configuration Modal */}
      {can('system_technik') && (
        <MariaDbConfigModal
          isOpen={isMariaDbModalOpen}
          onClose={() => setIsMariaDbModalOpen(false)}
          onSave={handleSaveMariaDbConfig}
          currentConfig={mariaDbConfig}
        />
      )}

      {/* New Client Modal */}
      {can('klienten_bearbeiten') && (
        <NewKlientModal
          isOpen={isNewKlientModalOpen}
          onClose={() => setIsNewKlientModalOpen(false)}
          onAddKlient={handleAddKlient}
        />
      )}

      {/* Change Own Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        currentUser={currentUserRecord}
        onClose={() => setIsChangePasswordOpen(false)}
        onSavePassword={handleSelfPasswordChange}
      />

      {/* 2FA (TOTP / FIDO2 Security Key) & Passkey Management Modal */}
      <SecurityMfaModal
        isOpen={isMfaModalOpen || mustEnrollMfa}
        currentUser={currentUserRecord}
        einrichtungName={einrichtung.name}
        forceEnrollment={mustEnrollMfa}
        mfaRequiredByPolicy={mfaRequiredByPolicy}
        mfaPolicyReason={mfaPolicyReason}
        onClose={() => setIsMfaModalOpen(false)}
        onUpdateUserMfa={handleUpdateUserMfa}
      />
    </div>
  );
}
