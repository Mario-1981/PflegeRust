import { BenutzerRolle, Berechtigung, RollenDefinition } from '../types/pflege';

export interface BerechtigungMeta {
  id: Berechtigung;
  label: string;
  gruppe: 'Pflege & Klienten' | 'Organisation & Finanzen' | 'Administration & Technik';
  beschreibung: string;
}

export const ALLE_BERECHTIGUNGEN: BerechtigungMeta[] = [
  {
    id: 'dashboard',
    label: 'Übersicht / Dashboard',
    gruppe: 'Pflege & Klienten',
    beschreibung: 'Zugriff auf die Tagesübersicht (zeigt nur freigegebene Bereiche)',
  },
  {
    id: 'klienten_lesen',
    label: 'Klientenakten lesen',
    gruppe: 'Pflege & Klienten',
    beschreibung: 'Stammdaten, Diagnosen und Verläufe von Klienten einsehen',
  },
  {
    id: 'klienten_bearbeiten',
    label: 'Klienten anlegen & bearbeiten',
    gruppe: 'Pflege & Klienten',
    beschreibung: 'Neue Klienten anlegen, Stammdaten ändern und Klienten löschen',
  },
  {
    id: 'touren_lesen',
    label: 'Tourenplanung einsehen',
    gruppe: 'Pflege & Klienten',
    beschreibung: 'Ambulante Touren, Haltepunkte und Zeiten anzeigen',
  },
  {
    id: 'touren_quittieren',
    label: 'Tourenhalte quittieren',
    gruppe: 'Pflege & Klienten',
    beschreibung: 'Einsätze als erledigt markieren und Übergabenotizen erfassen',
  },
  {
    id: 'sis_lesen',
    label: 'SIS & Risikomatrix lesen',
    gruppe: 'Pflege & Klienten',
    beschreibung: 'SIS-Themenfelder und MDK-Risikomatrix einsehen',
  },
  {
    id: 'sis_bearbeiten',
    label: 'SIS & Risikomatrix bearbeiten',
    gruppe: 'Pflege & Klienten',
    beschreibung: 'SIS-Einschätzungen und Risikomatrix ändern',
  },
  {
    id: 'medikation_lesen',
    label: 'Medikationsplan einsehen',
    gruppe: 'Pflege & Klienten',
    beschreibung: 'Bundesmedikationsplan (BMP) und SGB V Verordnungen lesen',
  },
  {
    id: 'medikation_bearbeiten',
    label: 'Medikation verordnen & ändern',
    gruppe: 'Pflege & Klienten',
    beschreibung: 'Medikamente hinzufügen, Dosierungen ändern und absetzen',
  },
  {
    id: 'pflege_dokumentieren',
    label: 'Vitalwerte & Pflegeberichte',
    gruppe: 'Pflege & Klienten',
    beschreibung: 'Vitalwerte und Pflegebericht-Einträge erfassen und korrigieren',
  },
  {
    id: 'dienstplan',
    label: 'Dienstplan & Personal',
    gruppe: 'Organisation & Finanzen',
    beschreibung: 'Mitarbeiterübersicht, Qualifikationen und Schichtplanung einsehen',
  },
  {
    id: 'abrechnung',
    label: 'Abrechnung SGB XI / V',
    gruppe: 'Organisation & Finanzen',
    beschreibung: 'Leistungsabrechnung und DTA-Export (§ 105 / § 302) nutzen',
  },
  {
    id: 'migration',
    label: 'SNAP-Migrationstool',
    gruppe: 'Organisation & Finanzen',
    beschreibung: 'SNAP.Pflege Exporte analysieren und in MariaDB übernehmen',
  },
  {
    id: 'users_verwalten',
    label: 'Nutzer, Rollen & SSO verwalten',
    gruppe: 'Administration & Technik',
    beschreibung: 'Benutzer anlegen, sperren, Passwörter, Rollenrechte & SSO konfigurieren',
  },
  {
    id: 'audit_lesen',
    label: 'DSGVO Audit-Log einsehen',
    gruppe: 'Administration & Technik',
    beschreibung: 'Lückenloses Zugriffs- und Sicherheitsprotokoll (BSI) prüfen',
  },
  {
    id: 'system_technik',
    label: 'MariaDB, Rust-Code & Debian CLI',
    gruppe: 'Administration & Technik',
    beschreibung: 'Datenbank-Konfiguration, Rust-Quellcode, .deb-Export und Terminal nutzen',
  },
];

export const ALLE_ROLLEN: BenutzerRolle[] = [
  'Admin',
  'PDL',
  'Wohnbereichsleitung',
  'Pflegefachkraft',
  'Pflegehelfer',
  'Verwaltung_Abrechnung',
  'Datenschutz_QM',
];

export const INITIAL_ROLLEN_CONFIG: Record<BenutzerRolle, RollenDefinition> = {
  Admin: {
    rolle: 'Admin',
    bezeichnung: 'Administrator',
    beschreibung: 'Vollzugriff auf System, MariaDB, Nutzerverwaltung, Rollenrechte und SSO.',
    berechtigungen: ALLE_BERECHTIGUNGEN.map((b) => b.id),
  },
  PDL: {
    rolle: 'PDL',
    bezeichnung: 'Pflegedienstleitung (PDL)',
    beschreibung: 'Fachliche Gesamtverantwortung für Klienten, Touren, SIS, Medikation, Personal und Abrechnung.',
    berechtigungen: [
      'dashboard',
      'klienten_lesen',
      'klienten_bearbeiten',
      'touren_lesen',
      'touren_quittieren',
      'sis_lesen',
      'sis_bearbeiten',
      'medikation_lesen',
      'medikation_bearbeiten',
      'pflege_dokumentieren',
      'dienstplan',
      'abrechnung',
      'migration',
    ],
  },
  Wohnbereichsleitung: {
    rolle: 'Wohnbereichsleitung',
    bezeichnung: 'Wohnbereichsleitung',
    beschreibung: 'Steuerung der Pflegeprozesse, Klientenakten, SIS, Medikation und Dienstpläne.',
    berechtigungen: [
      'dashboard',
      'klienten_lesen',
      'klienten_bearbeiten',
      'touren_lesen',
      'touren_quittieren',
      'sis_lesen',
      'sis_bearbeiten',
      'medikation_lesen',
      'medikation_bearbeiten',
      'pflege_dokumentieren',
      'dienstplan',
    ],
  },
  Pflegefachkraft: {
    rolle: 'Pflegefachkraft',
    bezeichnung: 'Examinierte Pflegefachkraft',
    beschreibung: 'Durchführung & Dokumentation von Grund- und Behandlungspflege, SIS und Medikation.',
    berechtigungen: [
      'dashboard',
      'klienten_lesen',
      'touren_lesen',
      'touren_quittieren',
      'sis_lesen',
      'sis_bearbeiten',
      'medikation_lesen',
      'medikation_bearbeiten',
      'pflege_dokumentieren',
    ],
  },
  Pflegehelfer: {
    rolle: 'Pflegehelfer',
    bezeichnung: 'Pflegehelfer / Pflegeassistenz',
    beschreibung: 'Tourenquittierung, Vitalwerte und Pflegeberichte. Kein Zugriff auf SIS-Änderungen, Medikationsverordnung oder Abrechnung.',
    berechtigungen: [
      'dashboard',
      'klienten_lesen',
      'touren_lesen',
      'touren_quittieren',
      'pflege_dokumentieren',
    ],
  },
  Verwaltung_Abrechnung: {
    rolle: 'Verwaltung_Abrechnung',
    bezeichnung: 'Verwaltung & Abrechnung',
    beschreibung: 'Stammdatenpflege, SGB XI / V Abrechnung und Personalübersicht ohne medizinische Pflegedokumentation.',
    berechtigungen: [
      'dashboard',
      'klienten_lesen',
      'klienten_bearbeiten',
      'dienstplan',
      'abrechnung',
    ],
  },
  Datenschutz_QM: {
    rolle: 'Datenschutz_QM',
    bezeichnung: 'Datenschutz & Qualitätsmanagement',
    beschreibung: 'Reiner Lesezugriff auf DSGVO-Audit-Logs, Klientenakten und SIS zur MDK-/Qualitätsprüfung.',
    berechtigungen: [
      'dashboard',
      'klienten_lesen',
      'sis_lesen',
      'audit_lesen',
    ],
  },
};

export function hasPermission(
  rolle: BenutzerRolle,
  perm: Berechtigung,
  rollenConfig: Record<BenutzerRolle, RollenDefinition>
): boolean {
  const def = rollenConfig[rolle];
  if (!def) return false;
  return def.berechtigungen.includes(perm);
}

export function canAccessTab(
  rolle: BenutzerRolle,
  tabId: string,
  rollenConfig: Record<BenutzerRolle, RollenDefinition>
): boolean {
  const check = (p: Berechtigung) => hasPermission(rolle, p, rollenConfig);
  switch (tabId) {
    case 'dashboard':
      return check('dashboard');
    case 'klienten':
      return check('klienten_lesen');
    case 'touren':
      return check('touren_lesen');
    case 'sis':
      return check('sis_lesen');
    case 'medikation':
      return check('medikation_lesen');
    case 'dienstplan':
      return check('dienstplan');
    case 'abrechnung':
      return check('abrechnung');
    case 'users':
      return check('users_verwalten') || check('audit_lesen');
    case 'migration':
      return check('migration');
    case 'rust':
    case 'terminal':
    case 'systempflege':
      return check('system_technik');
    default:
      return false;
  }
}

export const ORDERED_TABS = [
  'dashboard',
  'klienten',
  'touren',
  'sis',
  'medikation',
  'dienstplan',
  'abrechnung',
  'users',
  'migration',
  'rust',
  'terminal',
  'systempflege',
] as const;

export function getFirstAllowedTab(
  rolle: BenutzerRolle,
  rollenConfig: Record<BenutzerRolle, RollenDefinition>
): string {
  for (const tab of ORDERED_TABS) {
    if (canAccessTab(rolle, tab, rollenConfig)) {
      return tab;
    }
  }
  return 'dashboard';
}
