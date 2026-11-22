import React, { useState, useEffect } from 'react';
import {
  Building2,
  Database,
  ShieldCheck,
  KeyRound,
  Check,
  X,
  ArrowRight,
  ArrowLeft,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Server,
  RefreshCw,
} from 'lucide-react';
import {
  AppBenutzer,
  EinrichtungsProfil,
  SsoKonfiguration,
} from '../types/pflege';
import { MariaDbConfig } from './MariaDbConfigModal';
import { createPasswordRecord, validatePasswordPolicy } from '../utils/authCrypto';
import { PWAInstallButton } from './PWAInstallButton';
import { ServerDbInfo, testDatabaseConnection } from '../utils/apiClient';

export interface SetupCompletionPayload {
  einrichtung: EinrichtungsProfil;
  mariaDb: MariaDbConfig;
  adminUser: AppBenutzer;
  ssoPatch?: Partial<SsoKonfiguration>;
  loadDemoCareData: boolean;
}

interface SetupWizardViewProps {
  initialMariaDb: MariaDbConfig;
  initialSsoConfig: SsoKonfiguration;
  serverDbInfo?: ServerDbInfo | null;
  onCompleteSetup: (payload: SetupCompletionPayload) => Promise<void> | void;
}

const BUNDESLAENDER = [
  'Baden-Württemberg',
  'Bayern',
  'Berlin',
  'Brandenburg',
  'Bremen',
  'Hamburg',
  'Hessen',
  'Mecklenburg-Vorpommern',
  'Niedersachsen',
  'Nordrhein-Westfalen',
  'Rheinland-Pfalz',
  'Saarland',
  'Sachsen',
  'Sachsen-Anhalt',
  'Schleswig-Holstein',
  'Thüringen',
];

export const SetupWizardView: React.FC<SetupWizardViewProps> = ({
  initialMariaDb,
  initialSsoConfig,
  serverDbInfo,
  onCompleteSetup,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Einrichtung (leer, damit der Nutzer direkt seine eigene Pflegeeinrichtung einträgt)
  const [einrichtungName, setEinrichtungName] = useState('');
  const [ikNummer, setIkNummer] = useState('');
  const [ort, setOrt] = useState('');
  const [versorgungsform, setVersorgungsform] =
    useState<EinrichtungsProfil['versorgungsform']>('Ambulanter Pflegedienst');
  const [bundesland, setBundesland] = useState('Berlin');

  // Step 2: MariaDB (im Debian-Paket und Docker-Container automatisch vorkonfiguriert!)
  const [dbConfig, setDbConfig] = useState<MariaDbConfig>({
    ...initialMariaDb,
    host: serverDbInfo?.host || initialMariaDb.host,
    port: serverDbInfo?.port || initialMariaDb.port,
    database: serverDbInfo?.database || initialMariaDb.database,
    user: serverDbInfo?.user || initialMariaDb.user,
    ssl: serverDbInfo?.ssl ?? initialMariaDb.ssl,
  });
  const [showAdvancedDb, setShowAdvancedDb] = useState(false);
  const [isTestingDb, setIsTestingDb] = useState(false);
  const [dbStatus, setDbStatus] = useState<{
    checked: boolean;
    connected: boolean;
    storageMode: 'mariadb' | 'preview-memory';
    version: string;
  }>({
    checked: Boolean(serverDbInfo),
    connected: Boolean(serverDbInfo?.connected),
    storageMode: serverDbInfo?.storageMode || 'mariadb',
    version: serverDbInfo?.version || 'MariaDB 10.11',
  });

  // Step 3: Erster Benutzer (Rolle immer fest auf Admin!)
  const [adminVorname, setAdminVorname] = useState('');
  const [adminNachname, setAdminNachname] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminAbteilung, setAdminAbteilung] = useState('Pflegedienstleitung & IT');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [usernameTouched, setUsernameTouched] = useState(false);

  // Step 4: SSO & Start (standardmäßig leere Produktiv-Datenbank ohne Demo-Daten!)
  const [enableSsoNow, setEnableSsoNow] = useState(false);
  const [ssoProviderTyp, setSsoProviderTyp] =
    useState<SsoKonfiguration['providerTyp']>(initialSsoConfig.providerTyp);
  const [ssoIssuerUrl, setSsoIssuerUrl] = useState(initialSsoConfig.issuerUrl);
  const [ssoClientId, setSsoClientId] = useState(initialSsoConfig.clientId);
  const [loadDemoCareData, setLoadDemoCareData] = useState(false);

  useEffect(() => {
    let active = true;
    testDatabaseConnection()
      .then((res) => {
        if (!active) return;
        setDbConfig((prev) => ({
          ...prev,
          host: res.host || prev.host,
          port: res.port || prev.port,
          database: res.database || prev.database,
          user: res.user || prev.user,
        }));
        setDbStatus({
          checked: true,
          connected: res.connected,
          storageMode: res.storageMode,
          version: res.version,
        });
      })
      .catch(() => {
        if (!active) return;
        setDbStatus((prev) => ({ ...prev, checked: true }));
      });
    return () => {
      active = false;
    };
  }, []);

  const pwPolicy = validatePasswordPolicy(adminPassword);

  const suggestUsername = (vorname: string, nachname: string) => {
    const clean = (val: string) =>
      val
        .trim()
        .toLowerCase()
        .replace(/ä/g, 'ae')
        .replace(/ö/g, 'oe')
        .replace(/ü/g, 'ue')
        .replace(/ß/g, 'ss')
        .replace(/[^a-z0-9]/g, '');
    const v = clean(vorname);
    const n = clean(nachname);
    if (!v && !n) return '';
    if (!v) return n;
    if (!n) return v;
    return `${v.charAt(0)}.${n}`;
  };

  const handleNameChange = (field: 'vorname' | 'nachname', value: string) => {
    const nextVorname = field === 'vorname' ? value : adminVorname;
    const nextNachname = field === 'nachname' ? value : adminNachname;
    if (field === 'vorname') setAdminVorname(value);
    else setAdminNachname(value);

    if (!usernameTouched) {
      setAdminUsername(suggestUsername(nextVorname, nextNachname));
    }
  };

  const handleTestDbConnection = async () => {
    setErrorMsg(null);
    setIsTestingDb(true);
    try {
      const res = await testDatabaseConnection();
      setDbConfig((prev) => ({
        ...prev,
        host: res.host || prev.host,
        port: res.port || prev.port,
        database: res.database || prev.database,
        user: res.user || prev.user,
      }));
      setDbStatus({
        checked: true,
        connected: res.connected,
        storageMode: res.storageMode,
        version: res.version,
      });
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'MariaDB-Verbindung konnte nicht geprüft werden.'
      );
    } finally {
      setIsTestingDb(false);
    }
  };

  const validateAndNext = () => {
    setErrorMsg(null);

    if (step === 1) {
      if (!einrichtungName.trim()) {
        setErrorMsg('Bitte geben Sie den Namen Ihrer Pflegeeinrichtung an.');
        return;
      }
      if (!/^\d{9}$/.test(ikNummer.trim())) {
        setErrorMsg('Die Institutionskennzeichen-Nummer (IK) muss genau 9 Ziffern enthalten.');
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      if (!dbConfig.host.trim() || !dbConfig.database.trim() || !dbConfig.user.trim()) {
        setErrorMsg('Bitte füllen Sie alle MariaDB-Pflichtfelder aus.');
        return;
      }
      setStep(3);
      return;
    }

    if (step === 3) {
      if (!adminVorname.trim() || !adminNachname.trim()) {
        setErrorMsg('Bitte geben Sie Vor- und Nachnamen des ersten Administrators an.');
        return;
      }
      if (!adminUsername.trim() || adminUsername.trim().length < 3) {
        setErrorMsg('Der Benutzername muss mindestens 3 Zeichen lang sein.');
        return;
      }
      if (!adminEmail.trim() || !adminEmail.includes('@')) {
        setErrorMsg('Bitte geben Sie eine gültige dienstliche E-Mail-Adresse ein.');
        return;
      }
      if (!pwPolicy.valid) {
        setErrorMsg(
          'Das Administrator-Passwort erfüllt noch nicht alle Anforderungen der BSI-Passwortrichtlinie.'
        );
        return;
      }
      if (adminPassword !== adminPasswordConfirm) {
        setErrorMsg('Die beiden eingegebenen Passwörter stimmen nicht überein.');
        return;
      }
      setStep(4);
    }
  };

  const handleFinishSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (enableSsoNow && (!ssoIssuerUrl.trim() || !ssoClientId.trim())) {
      setErrorMsg('Bitte Issuer URL und Client ID für SSO angeben oder SSO vorerst deaktivieren.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { salt, hash } = await createPasswordRecord(adminPassword);
      const today = new Date().toISOString().slice(0, 10);
      const nowStamp = new Date().toISOString().replace('T', ' ').slice(0, 16);

      // Guaranteed: first user ALWAYS gets role 'Admin'
      const firstAdminUser: AppBenutzer = {
        id: 'usr-admin-1',
        benutzername: adminUsername.trim(),
        email: adminEmail.trim(),
        vorname: adminVorname.trim(),
        name: adminNachname.trim(),
        rolle: 'Admin',
        authMethode: 'lokal',
        abteilung: adminAbteilung.trim() || 'Systemadministration',
        aktiv: true,
        letzterLogin: nowStamp,
        erstelltAm: today,
        passwortSalt: salt,
        passwortHash: hash,
        fehlversuche: 0,
        mussPasswortAendern: false,
      };

      await onCompleteSetup({
        einrichtung: {
          name: einrichtungName.trim(),
          ikNummer: ikNummer.trim(),
          ort: ort.trim() || 'Deutschland',
          versorgungsform,
          bundesland,
        },
        mariaDb: dbConfig,
        adminUser: firstAdminUser,
        ssoPatch: {
          aktiviert: enableSsoNow,
          providerTyp: ssoProviderTyp,
          issuerUrl: ssoIssuerUrl.trim() || initialSsoConfig.issuerUrl,
          clientId: ssoClientId.trim() || initialSsoConfig.clientId,
        },
        loadDemoCareData,
      });
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Ersteinrichtung konnte nicht gespeichert werden.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepsMeta = [
    { num: 1 as const, label: 'Einrichtung', icon: Building2 },
    { num: 2 as const, label: 'MariaDB', icon: Database },
    { num: 3 as const, label: 'Erster Admin', icon: ShieldCheck },
    { num: 4 as const, label: 'SSO & Start', icon: KeyRound },
  ];

  return (
    <div className="min-h-[100dvh] bg-slate-100 text-slate-900 flex flex-col justify-between safe-bottom">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 safe-top flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-teal-700 text-white flex items-center justify-center font-bold text-sm tracking-tight shadow-xs shrink-0">
            PR
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900 leading-none">
              PflegeRust
            </span>
            <span className="text-[10px] text-teal-700 font-mono font-medium mt-0.5 truncate">
              Ersteinrichtungsassistent · Debian 12 &amp; MariaDB
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <PWAInstallButton variant="header" />
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-500">
            <Server className="w-3.5 h-3.5 text-teal-700" />
            <span>Neuinstallation · Keine Benutzer vorhanden</span>
          </div>
        </div>
      </header>

      {/* Main Wizard Container */}
      <main className="flex-1 flex items-center justify-center p-3 sm:p-6">
        <div className="w-full max-w-2xl space-y-4 sm:space-y-5">
          {/* Step Progress Bar */}
          <div className="bg-white border border-slate-200 rounded-lg p-3 sm:p-4 shadow-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {stepsMeta.map((s) => {
                const Icon = s.icon;
                const isDone = step > s.num;
                const isCurrent = step === s.num;
                return (
                  <div
                    key={s.num}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-md border text-xs transition-colors ${
                      isCurrent
                        ? 'bg-teal-50 border-teal-700 text-teal-900 font-semibold'
                        : isDone
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800 font-medium'
                        : 'bg-slate-50 border-slate-200 text-slate-400'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        isCurrent
                          ? 'bg-teal-800 text-white'
                          : isDone
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {isDone ? <Check className="w-3 h-3" /> : s.num}
                    </div>
                    <Icon className="w-3.5 h-3.5 hidden sm:block shrink-0" />
                    <span className="truncate">{s.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded-lg px-4 py-3 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Step Card */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
            {/* Step 1: Einrichtung */}
            {step === 1 && (
              <div className="p-6 space-y-5">
                <div className="border-b border-slate-100 pb-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">
                    Schritt 1 von 4 · Stammdaten der Einrichtung
                  </div>
                  <h1 className="text-xl font-bold text-slate-900 mt-1">
                    Willkommen bei PflegeRust
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    Richten Sie Ihren Pflegedienst, die MariaDB-Datenbank und den ersten Systemadministrator ein.
                  </p>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">
                      Name des Pflegedienstes / der Einrichtung *
                    </label>
                    <input
                      type="text"
                      value={einrichtungName}
                      onChange={(e) => setEinrichtungName(e.target.value)}
                      placeholder="z.B. Ambulanter Pflegedienst Sonnenschein GmbH"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1.5">
                        Institutionskennzeichen (IK-Nummer, 9-stellig) *
                      </label>
                      <input
                        type="text"
                        maxLength={9}
                        value={ikNummer}
                        onChange={(e) => setIkNummer(e.target.value.replace(/\D/g, ''))}
                        placeholder="461102934"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1.5">
                        Versorgungsform
                      </label>
                      <select
                        value={versorgungsform}
                        onChange={(e) =>
                          setVersorgungsform(
                            e.target.value as EinrichtungsProfil['versorgungsform']
                          )
                        }
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                      >
                        <option value="Ambulanter Pflegedienst">Ambulanter Pflegedienst</option>
                        <option value="Tagespflege">Tagespflege</option>
                        <option value="Stationäre Einrichtung">Stationäre Einrichtung</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1.5">
                        Standort / Ort
                      </label>
                      <input
                        type="text"
                        value={ort}
                        onChange={(e) => setOrt(e.target.value)}
                        placeholder="z.B. Berlin"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1.5">
                        Bundesland (für SGB XI Leistungskomplexe)
                      </label>
                      <select
                        value={bundesland}
                        onChange={(e) => setBundesland(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                      >
                        {BUNDESLAENDER.map((bl) => (
                          <option key={bl} value={bl}>
                            {bl}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: MariaDB (automatisch vorkonfiguriert – einfach auf Weiter klicken) */}
            {step === 2 && (
              <div className="p-6 space-y-5">
                <div className="border-b border-slate-100 pb-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">
                    Schritt 2 von 4 · Datenbankanbindung
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 mt-1">
                    MariaDB ist vorkonfiguriert &amp; bereit
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Die Datenbank, Zugangsdaten und InnoDB-Tabellen werden im Debian-Paket und Docker-Container automatisch eingerichtet. Sie können direkt auf <strong>Weiter</strong> klicken.
                  </p>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-bold text-sm text-emerald-950">
                            {dbStatus.connected
                              ? 'MariaDB-Server erfolgreich verbunden'
                              : 'Vorkonfigurierte MariaDB-Anbindung aktiv'}
                          </div>
                          <p className="text-xs text-emerald-800 mt-0.5">
                            {dbStatus.connected
                              ? `Dauerhafte Speicherung aktiv (${dbStatus.version}). Alle Änderungen an Klienten, Touren, Benutzern, Rollen und 2FA werden direkt in MariaDB gespeichert.`
                              : `Auf Debian (.deb) und im Docker-Container wird MariaDB beim Start automatisch mit sicherem Zufallspasswort eingerichtet. Hier können Sie direkt auf „Weiter“ klicken.`}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleTestDbConnection}
                        disabled={isTestingDb}
                        className="px-2.5 py-1.5 rounded-md border border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100 font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isTestingDb ? 'animate-spin' : ''}`} />
                        <span>{isTestingDb ? 'Prüfe...' : 'Neu prüfen'}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-200/80 font-mono text-[11px]">
                      <div className="bg-white/80 rounded px-2.5 py-1.5 border border-emerald-200/70">
                        <span className="text-slate-500 block font-sans text-[10px]">Host</span>
                        <span className="font-semibold text-slate-900">{dbConfig.host}:{dbConfig.port}</span>
                      </div>
                      <div className="bg-white/80 rounded px-2.5 py-1.5 border border-emerald-200/70">
                        <span className="text-slate-500 block font-sans text-[10px]">Datenbank</span>
                        <span className="font-semibold text-slate-900">{dbConfig.database}</span>
                      </div>
                      <div className="bg-white/80 rounded px-2.5 py-1.5 border border-emerald-200/70">
                        <span className="text-slate-500 block font-sans text-[10px]">DB-Benutzer</span>
                        <span className="font-semibold text-slate-900">{dbConfig.user}</span>
                      </div>
                      <div className="bg-white/80 rounded px-2.5 py-1.5 border border-emerald-200/70">
                        <span className="text-slate-500 block font-sans text-[10px]">Zeichensatz</span>
                        <span className="font-semibold text-slate-900">utf8mb4 / InnoDB</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => setShowAdvancedDb((prev) => !prev)}
                      className="text-xs font-semibold text-teal-800 hover:text-teal-900 underline cursor-pointer"
                    >
                      {showAdvancedDb
                        ? 'Erweiterte Datenbank-Details ausblenden'
                        : 'Erweiterte Datenbank-Details anzeigen (optional)'}
                    </button>
                  </div>

                  {showAdvancedDb && (
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
                      <p className="text-[11px] text-slate-600">
                        Die Zugangsdaten werden serverseitig sicher über <code className="font-mono">/etc/pflegerust/db.env</code> (Debian) bzw. Container-Umgebungsvariablen verwaltet.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block font-semibold text-slate-700 mb-1">
                            MariaDB Hostname / IP
                          </label>
                          <input
                            type="text"
                            value={dbConfig.host}
                            onChange={(e) => setDbConfig({ ...dbConfig, host: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono bg-white"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Port</label>
                          <input
                            type="number"
                            value={dbConfig.port}
                            onChange={(e) =>
                              setDbConfig({ ...dbConfig, port: Number(e.target.value) || 3306 })
                            }
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono bg-white"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Datenbankname
                          </label>
                          <input
                            type="text"
                            value={dbConfig.database}
                            onChange={(e) => setDbConfig({ ...dbConfig, database: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono bg-white"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            DB-Benutzer
                          </label>
                          <input
                            type="text"
                            value={dbConfig.user}
                            onChange={(e) => setDbConfig({ ...dbConfig, user: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Erster Benutzer = Admin (locked) */}
            {step === 3 && (
              <div className="p-6 space-y-5">
                <div className="border-b border-slate-100 pb-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">
                    Schritt 3 von 4 · Erster Systembenutzer
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 mt-1">
                    Ersten Administrator anlegen
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Der erste angelegte Benutzer erhält zwingend und unveränderlich die Rolle <strong>Admin</strong> zur Einrichtung weiterer Mitarbeiter, Klienten und SSO-Anbindungen.
                  </p>
                </div>

                {/* Locked Admin Role Notice */}
                <div className="p-3 rounded-md bg-purple-50 border border-purple-200 text-purple-900 text-xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-purple-700 shrink-0" />
                    <span>
                      Zugewiesene Rolle für den Erstbenutzer:{' '}
                      <strong className="font-mono">Admin (Systemadministrator)</strong>
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-purple-200 font-mono text-[10px] font-semibold text-purple-800 shrink-0">
                    <Lock className="w-3 h-3" />
                    Festgelegt
                  </span>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1.5">
                        Vorname *
                      </label>
                      <input
                        type="text"
                        required
                        value={adminVorname}
                        onChange={(e) => handleNameChange('vorname', e.target.value)}
                        placeholder="z.B. Mario"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1.5">
                        Nachname *
                      </label>
                      <input
                        type="text"
                        required
                        value={adminNachname}
                        onChange={(e) => handleNameChange('nachname', e.target.value)}
                        placeholder="z.B. Günther"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1.5">
                        Benutzername *
                      </label>
                      <input
                        type="text"
                        required
                        value={adminUsername}
                        onChange={(e) => {
                          setUsernameTouched(true);
                          setAdminUsername(e.target.value);
                        }}
                        placeholder="z.B. m.guenther"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1.5">
                        Dienstliche E-Mail *
                      </label>
                      <input
                        type="email"
                        required
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        placeholder="admin@pflegedienst.de"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1.5">
                        Rolle (RBAC)
                      </label>
                      <input
                        type="text"
                        readOnly
                        value="Admin – Systemadministrator"
                        className="w-full px-3 py-2 text-sm bg-slate-100 border border-slate-200 rounded-md text-slate-700 font-semibold cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1.5">
                        Abteilung
                      </label>
                      <input
                        type="text"
                        value={adminAbteilung}
                        onChange={(e) => setAdminAbteilung(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1.5">
                          Administrator-Passwort *
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            value={adminPassword}
                            onChange={(e) => setAdminPassword(e.target.value)}
                            autoComplete="new-password"
                            placeholder="Sicheres Passwort"
                            className="w-full px-3 py-2 pr-9 text-sm border border-slate-300 rounded-md"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((p) => !p)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                          >
                            {showPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1.5">
                          Passwort wiederholen *
                        </label>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={adminPasswordConfirm}
                          onChange={(e) => setAdminPasswordConfirm(e.target.value)}
                          autoComplete="new-password"
                          placeholder="Passwort bestätigen"
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 p-3 bg-slate-50 border border-slate-200 rounded-md text-[11px]">
                      {[
                        { ok: pwPolicy.checks.minLength, label: 'Mindestens 8 Zeichen' },
                        { ok: pwPolicy.checks.hasUpper, label: 'Mind. 1 Großbuchstabe (A–Z)' },
                        { ok: pwPolicy.checks.hasLower, label: 'Mind. 1 Kleinbuchstabe (a–z)' },
                        { ok: pwPolicy.checks.hasDigit, label: 'Mind. 1 Ziffer (0–9)' },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className={`flex items-center gap-1.5 ${
                            item.ok ? 'text-emerald-700 font-medium' : 'text-slate-500'
                          }`}
                        >
                          {item.ok ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <X className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          <span>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: SSO & Abschluss */}
            {step === 4 && (
              <form id="setup-finish-form" onSubmit={handleFinishSetup} className="p-6 space-y-5">
                <div className="border-b border-slate-100 pb-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">
                    Schritt 4 von 4 · SSO &amp; Systemstart
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 mt-1">
                    Optionale SSO-Anbindung &amp; Abschluss
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Prüfen Sie Ihre Angaben. SSO kann direkt jetzt oder später in der Nutzerverwaltung eingerichtet werden.
                  </p>
                </div>

                {/* Optional SSO Toggle */}
                <div className="p-4 rounded-md border border-slate-200 bg-slate-50/70 space-y-3 text-xs">
                  <label className="flex items-center justify-between gap-3 cursor-pointer">
                    <div>
                      <span className="font-bold text-slate-900 block">
                        Single Sign-On (OIDC / Keycloak / Entra ID) direkt aktivieren
                      </span>
                      <span className="text-slate-500 text-[11px]">
                        Der angelegte lokale Admin bleibt als Notfall-Zugang stets bestehen.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={enableSsoNow}
                      onChange={(e) => setEnableSsoNow(e.target.checked)}
                      className="rounded text-teal-700 w-4 h-4"
                    />
                  </label>

                  {enableSsoNow && (
                    <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Provider</label>
                        <select
                          value={ssoProviderTyp}
                          onChange={(e) =>
                            setSsoProviderTyp(e.target.value as SsoKonfiguration['providerTyp'])
                          }
                          className="w-full p-2 border border-slate-300 rounded bg-white"
                        >
                          <option value="keycloak">Keycloak (OIDC)</option>
                          <option value="entra_id">Microsoft Entra ID</option>
                          <option value="google">Google Workspace</option>
                          <option value="generic_oidc">Generisches OIDC</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Client ID *
                        </label>
                        <input
                          type="text"
                          value={ssoClientId}
                          onChange={(e) => setSsoClientId(e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded font-mono"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block font-semibold text-slate-700 mb-1">
                          Issuer URL *
                        </label>
                        <input
                          type="url"
                          value={ssoIssuerUrl}
                          onChange={(e) => setSsoIssuerUrl(e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Initial Data Choice (Leere Produktiv-Datenbank als Standard!) */}
                <div className="space-y-2 text-xs">
                  <div className="font-semibold text-slate-800">Anfangsbestand der Klientendaten</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setLoadDemoCareData(false)}
                      className={`p-3 rounded-md border text-left transition-colors cursor-pointer ${
                        !loadDemoCareData
                          ? 'border-teal-700 bg-teal-50/60'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-bold text-slate-900">
                        Leere Produktiv-Datenbank (Empfohlen)
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        0 Klienten, 0 Touren – direkt bereit für Ihre echten Klienten, Mitarbeiter und SNAP-Import.
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLoadDemoCareData(true)}
                      className={`p-3 rounded-md border text-left transition-colors cursor-pointer ${
                        loadDemoCareData
                          ? 'border-teal-700 bg-teal-50/60'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-bold text-slate-900">Optional: Beispiel-Klienten laden</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Legt einige Test-Klienten zum Ausprobieren an (jederzeit später änderbar).
                      </div>
                    </button>
                  </div>
                </div>

                {/* Summary Box */}
                <div className="p-4 rounded-md bg-slate-50 border border-slate-200 text-xs space-y-2">
                  <div className="font-bold text-slate-900">Zusammenfassung der Ersteinrichtung</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-4 text-[11px]">
                    <div>
                      <span className="text-slate-500">Einrichtung:</span>{' '}
                      <span className="font-semibold text-slate-900">{einrichtungName}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">IK-Nummer:</span>{' '}
                      <span className="font-mono font-semibold text-slate-900">{ikNummer}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">MariaDB:</span>{' '}
                      <span className="font-mono text-slate-900">
                        {dbConfig.user}@{dbConfig.host}:{dbConfig.port}/{dbConfig.database}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Erster Benutzer:</span>{' '}
                      <span className="font-semibold text-slate-900">
                        {adminVorname} {adminNachname}
                      </span>{' '}
                      (<span className="font-mono text-purple-800 font-bold">Admin</span>)
                    </div>
                  </div>
                </div>
              </form>
            )}

            {/* Footer Controls */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              <div>
                {step > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null);
                      setStep((prev) => (prev - 1) as 1 | 2 | 3 | 4);
                    }}
                    className="px-3.5 py-2 rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Zurück</span>
                  </button>
                )}
              </div>

              <div>
                {step < 4 ? (
                  <button
                    type="button"
                    onClick={validateAndNext}
                    className="px-4 py-2 rounded-md bg-teal-800 hover:bg-teal-900 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>Weiter</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    form="setup-finish-form"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-md bg-teal-800 hover:bg-teal-900 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-xs"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>
                      {isSubmitting
                        ? 'Initialisiere System...'
                        : 'Ersteinrichtung abschließen & als Admin anmelden'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-3 px-6 text-center text-[11px] text-slate-500 border-t border-slate-200 bg-white">
        PflegeRust Debian Server · Ersteinrichtung (erster Benutzer erhält automatisch Admin-Rechte)
      </footer>
    </div>
  );
};
