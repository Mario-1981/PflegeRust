export type Pflegegrad = 1 | 2 | 3 | 4 | 5;

export interface Vitalwert {
  id: string;
  datum: string;
  uhrzeit: string;
  blutdruckSystolisch: number;
  blutdruckDiastolisch: number;
  puls: number;
  blutzucker?: number; // mg/dl
  temperatur?: number; // °C
  gewicht?: number; // kg
  erfasstVon: string;
}

export interface SisKategorie {
  titel: string;
  kategorieId: 'kognition' | 'mobilitaet' | 'krankheit' | 'selbstversorgung' | 'soziales' | 'haushalt';
  beschreibung: string;
  einschaetzung: string;
  risikoVorhanden: boolean;
}

export interface SisRisikomatrix {
  dekubitus: boolean;
  sturz: boolean;
  inkontinenz: boolean;
  schmerz: boolean;
  ernaehrung: boolean;
  bemerkungen: string;
}

export interface PflegeberichtEintrag {
  id: string;
  datum: string;
  uhrzeit: string;
  kategorie: 'Alltag' | 'Besonderheit' | 'Arztkontakt' | 'Vitalabweichung';
  text: string;
  mitarbeiterKuerzel: string;
}

export interface MedikationEintrag {
  id: string;
  handelsname: string;
  wirkstoff: string;
  form: string; // z.B. Tbl., Tropfen, Injektion
  morgens: number;
  mittags: number;
  abends: number;
  nachts: number;
  hinweis: string;
  verordnenderArzt: string;
  gueltigBis: string;
  sgbTyp: 'SGB V' | 'Selbstzahler';
}

export interface Leistungskomplex {
  code: string; // z.B. "LK 01"
  bezeichnung: string;
  typ: 'SGB XI' | 'SGB V';
  punkte: number;
  dauerMinuten: number;
  standardPreis: number; // EUR
}

export interface Klient {
  id: string;
  snapLegacyId?: string;
  nachname: string;
  vorname: string;
  geburtsdatum: string;
  geschlecht: 'w' | 'm' | 'd';
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
  telefon: string;
  pflegegrad: Pflegegrad;
  pflegegradSeit: string;
  krankenkasse: string;
  ikNummer: string;
  versichertennummer: string;
  zuzahlungsbefreit: boolean;
  diagnosen: { icd: string; text: string }[];
  hausarzt: { name: string; telefon: string; praxis: string };
  notfallkontakt: { name: string; beziehung: string; telefon: string };
  schluesselDepot: string; // z.B. "Code 4821 an Haustür"
  tourId: string;
  gebuchteLeistungen: string[]; // LK Codes
  vitalwerte: Vitalwert[];
  pflegeberichte: PflegeberichtEintrag[];
  sisKategorien: SisKategorie[];
  risikomatrix: SisRisikomatrix;
  medikamente: MedikationEintrag[];
}

export interface TourHalt {
  id: string;
  klientId: string;
  geplanteUhrzeit: string;
  geschaetzteDauerMinuten: number;
  leistungCodes: string[];
  status: 'Ausstehend' | 'In Arbeit' | 'Erledigt' | 'Abgebrochen';
  tatsaechlicherStart?: string;
  tatsaechlichesEnde?: string;
  notizen?: string;
}

export interface Tour {
  id: string;
  name: string;
  schicht: 'Frühdienst' | 'Spätdienst' | 'Nachtdienst';
  fahrerKuerzel: string;
  zugewiesenerBenutzerId?: string;
  zugewiesenerMitarbeiterName?: string;
  fahrzeugKennzeichen: string;
  bereich: string;
  halte: TourHalt[];
}

export interface Mitarbeiter {
  id: string;
  kuerzel: string;
  nachname: string;
  vorname: string;
  rolle: 'PDL' | 'Pflegefachkraft' | 'Pflegehelfer' | 'Auszubildende/r';
  qualifikation: string;
  wochenstunden: number;
  telefon: string;
  aktiv: boolean;
}

export interface SnapImportData {
  fileName: string;
  exportDatum: string;
  version: string;
  klienten: Array<{
    snapId: string;
    name: string;
    geburt: string;
    pflegestufeAlt?: number; // legacy 1, 2, 3
    pflegegradNeu?: Pflegegrad;
    kasse: string;
    adresse: string;
    telefon: string;
    tourAlt: string;
    leistungen: string[];
    arzt: string;
  }>;
  touren: Array<{
    tourId: string;
    bezeichnung: string;
    schicht: string;
  }>;
  personal: Array<{
    persNr: string;
    name: string;
    funktion: string;
    kuerzel: string;
  }>;
}

export type StandardBenutzerRolle =
  | 'Admin'
  | 'PDL'
  | 'Wohnbereichsleitung'
  | 'Pflegefachkraft'
  | 'Pflegehelfer'
  | 'Verwaltung_Abrechnung'
  | 'Datenschutz_QM';

export type BenutzerRolle = StandardBenutzerRolle | (string & {});

export type Berechtigung =
  | 'dashboard'
  | 'klienten_lesen'
  | 'klienten_bearbeiten'
  | 'touren_lesen'
  | 'touren_quittieren'
  | 'touren_planen'
  | 'sis_lesen'
  | 'sis_bearbeiten'
  | 'medikation_lesen'
  | 'medikation_bearbeiten'
  | 'pflege_dokumentieren'
  | 'dienstplan'
  | 'abrechnung'
  | 'users_verwalten'
  | 'audit_lesen'
  | 'migration'
  | 'addons_verwalten'
  | 'telematik_nutzen'
  | 'system_technik';

export interface RollenDefinition {
  rolle: BenutzerRolle;
  bezeichnung: string;
  beschreibung: string;
  berechtigungen: Berechtigung[];
  istStandard?: boolean;
  zweiFaktorPflicht?: boolean;
}

export interface SicherheitsSchluessel {
  id: string;
  credentialId: string;
  bezeichnung: string;
  transport: 'usb' | 'nfc' | 'ble' | 'hybrid';
  modus: 'webauthn' | 'ecdsa_sandbox';
  publicKeyJwk?: JsonWebKey;
  erstelltAm: string;
  zuletztVerwendet?: string;
  signCount: number;
}

export interface PasskeyEintrag {
  id: string;
  credentialId: string;
  bezeichnung: string;
  geraeteTyp: 'platform' | 'roaming';
  modus: 'webauthn' | 'ecdsa_sandbox';
  publicKeyJwk?: JsonWebKey;
  erstelltAm: string;
  zuletztVerwendet?: string;
  signCount: number;
}

export interface BenutzerZweiFaktorConfig {
  aktiviert: boolean;
  totpAktiviert: boolean;
  totpSecret?: string;
  totpEingerichtetAm?: string;
  backupCodeHashes?: string[];
  sicherheitsSchluessel: SicherheitsSchluessel[];
  passkeys: PasskeyEintrag[];
}

export interface AppBenutzer {
  id: string;
  benutzername: string;
  email: string;
  name: string;
  vorname: string;
  rolle: BenutzerRolle;
  authMethode: 'lokal' | 'oidc_keycloak' | 'entra_id' | 'google_sso';
  ssoSubjectId?: string;
  abteilung: string;
  aktiv: boolean;
  letzterLogin: string;
  erstelltAm: string;
  passwortSalt?: string;
  passwortHash?: string;
  fehlversuche?: number;
  mussPasswortAendern?: boolean;
  zweiFaktorPflicht?: boolean;
  zweiFaktor?: BenutzerZweiFaktorConfig;
}

export interface SsoKonfiguration {
  aktiviert: boolean;
  providerTyp: 'keycloak' | 'entra_id' | 'google' | 'generic_oidc' | 'saml2';
  bezeichnung: string;
  issuerUrl: string; // z.B. https://sso.pflege.de/realms/pflegedienst
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  autoUserProvisioning: boolean;
  defaultRolle: BenutzerRolle;
  rollenMapping: {
    ssoGruppe: string;
    zielRolle: BenutzerRolle;
  }[];
}

export interface ActiveSessionUser {
  id: string;
  benutzername: string;
  email: string;
  name: string;
  role: BenutzerRolle;
  auth: string;
  abteilung: string;
}

export interface EinrichtungsProfil {
  name: string;
  ikNummer: string;
  ort: string;
  versorgungsform: 'Ambulanter Pflegedienst' | 'Tagespflege' | 'Stationäre Einrichtung';
  bundesland: string;
}

export interface AuditLogEintrag {
  id: string;
  zeitstempel: string;
  benutzer: string;
  rolle: BenutzerRolle;
  aktion:
    | 'SYSTEM_SETUP'
    | 'LOGIN_SUCCESS'
    | 'LOGIN_SSO'
    | 'LOGIN_FAILED'
    | 'LOGOUT'
    | 'PASSWORD_CHANGE'
    | 'MFA_SETUP'
    | 'MFA_VERIFIED'
    | 'MFA_FAILED'
    | 'PASSKEY_REGISTER'
    | 'PASSKEY_LOGIN'
    | 'PASSKEY_REMOVE'
    | 'ROLE_CHANGE'
    | 'ROLE_CONFIG_CHANGE'
    | 'ROLE_CREATE'
    | 'ROLE_DELETE'
    | 'ADDON_INSTALL'
    | 'ADDON_UPDATE'
    | 'ADDON_REMOVE'
    | 'TI_DISPATCH'
    | 'PATIENT_READ'
    | 'PATIENT_UPDATE'
    | 'TOUR_PLAN_UPDATE'
    | 'MED_DISPENSE'
    | 'SSO_CONFIG_CHANGE'
    | 'EXPORT_DTA';
  ressource: string;
  details: string;
  ipAdresse: string;
}

export type AddonKategorie =
  | 'telematik'
  | 'abrechnung'
  | 'sensorik'
  | 'kommunikation'
  | 'sonstiges';

export type AddonTransport =
  | 'rest_webhook'
  | 'grpc'
  | 'unix_socket'
  | 'wasm_sandbox';

export type AddonAuthTyp =
  | 'mtls_smcb'
  | 'oauth2_client_credentials'
  | 'api_token';

export type TiDienst =
  | 'KIM 1.5'
  | 'ePA 3.0'
  | 'TI-Messenger'
  | 'eVO / HKP'
  | 'VSDM'
  | 'QES / SMC-B';

export type AddonScope =
  | 'klienten:read'
  | 'klienten:write'
  | 'medikation:read'
  | 'medikation:write'
  | 'sis:read'
  | 'kim:send'
  | 'kim:receive'
  | 'epa:read'
  | 'epa:write'
  | 'vsdm:verify'
  | 'abrechnung:export';

export interface TiMiddlewareProfil {
  telematikId: string;
  mandantId: string;
  clientSystemId: string;
  workplaceId: string;
  kimAdresse: string;
  gematikZulassung: string;
  konnektorTyp: 'TI-Gateway (TIaaS)' | 'Highspeed-Konnektor (PTV5+)' | 'Lokaler Konnektor';
  smcbStatus: 'aktiv' | 'pin_erforderlich' | 'abgelaufen';
  unterstuetzteDienste: TiDienst[];
}

export interface PflegeAddon {
  id: string;
  name: string;
  version: string;
  anbieter: string;
  kategorie: AddonKategorie;
  beschreibung: string;
  aktiv: boolean;
  status: 'verbunden' | 'inaktiv' | 'fehler';
  transport: AddonTransport;
  endpointUrl: string;
  authTyp: AddonAuthTyp;
  tlsZertifikatPfad?: string;
  webhookSecret?: string;
  scopes: AddonScope[];
  hooks: string[];
  tiProfil?: TiMiddlewareProfil;
  letzterHeartbeat: string;
  latenzMs?: number;
  installiertAm: string;
}

export interface TiTransaktion {
  id: string;
  zeitstempel: string;
  addonId: string;
  addonName: string;
  dienst: 'KIM 1.5' | 'ePA 3.0' | 'VSDM';
  klientName: string;
  empfaengerOderZiel: string;
  dokumentTyp: string;
  status: 'zugestellt' | 'verifiziert' | 'fehler';
  referenzId: string;
  latenzMs: number;
}


