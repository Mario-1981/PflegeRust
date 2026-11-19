import React, { useState, useEffect } from 'react';
import {
  Plug,
  ShieldCheck,
  Radio,
  Plus,
  Settings,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Send,
  FileJson,
  Code2,
  Copy,
  Check,
  X,
  Lock,
  Activity,
  Server,
} from 'lucide-react';
import {
  AddonAuthTyp,
  AddonKategorie,
  AddonScope,
  AddonTransport,
  Klient,
  PflegeAddon,
  TiDienst,
  TiTransaktion,
} from '../types/pflege';
import {
  ALLE_ADDON_HOOKS,
  ALLE_ADDON_SCOPES,
  ALLE_TI_DIENSTE,
  EXAMPLE_TI_MANIFEST_JSON,
} from '../data/addonsData';

interface AddonsViewProps {
  addons: PflegeAddon[];
  klienten: Klient[];
  tiTransaktionen: TiTransaktion[];
  canManageAddons: boolean;
  canUseTelematik: boolean;
  onToggleAddon: (addonId: string) => void;
  onUpdateAddon: (updated: PflegeAddon) => void;
  onInstallAddon: (addon: PflegeAddon) => boolean;
  onRemoveAddon: (addonId: string) => void;
  onTestAddonHealth: (addonId: string) => void;
  onDispatchTiAction: (tx: Omit<TiTransaktion, 'id' | 'zeitstempel'>) => void;
}

const TRANSPORT_LABELS: Record<AddonTransport, string> = {
  rest_webhook: 'REST / Webhook (HTTPS)',
  grpc: 'gRPC / HTTP2 (TLS)',
  unix_socket: 'Debian Unix-Socket (systemd)',
  wasm_sandbox: 'WASM Sandbox (In-Process)',
};

const AUTH_LABELS: Record<AddonAuthTyp, string> = {
  mtls_smcb: 'mTLS + SMC-B Zertifikat',
  oauth2_client_credentials: 'OAuth 2.0 Client Credentials',
  api_token: 'Bearer API-Token + HMAC',
};

const KATEGORIE_LABELS: Record<AddonKategorie, string> = {
  telematik: 'Telematik (TI)',
  abrechnung: 'Abrechnung / DTA',
  sensorik: 'Vital-Sensorik / IoT',
  kommunikation: 'Kommunikation',
  sonstiges: 'Sonstiges',
};

export const AddonsView: React.FC<AddonsViewProps> = ({
  addons,
  klienten,
  tiTransaktionen,
  canManageAddons,
  canUseTelematik,
  onToggleAddon,
  onUpdateAddon,
  onInstallAddon,
  onRemoveAddon,
  onTestAddonHealth,
  onDispatchTiAction,
}) => {
  const [activeTab, setActiveTab] = useState<'installed' | 'telematik' | 'install' | 'sdk'>(
    canManageAddons ? 'installed' : 'telematik'
  );
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [editingAddon, setEditingAddon] = useState<PflegeAddon | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [testingAddonId, setTestingAddonId] = useState<string | null>(null);

  // Install tab states
  const [installMode, setInstallMode] = useState<'form' | 'json'>('form');
  const [manifestJson, setManifestJson] = useState<string>(EXAMPLE_TI_MANIFEST_JSON);
  const [installError, setInstallError] = useState<string | null>(null);

  // New addon form states
  const [formName, setFormName] = useState('');
  const [formAnbieter, setFormAnbieter] = useState('');
  const [formVersion, setFormVersion] = useState('1.0.0');
  const [formKategorie, setFormKategorie] = useState<AddonKategorie>('telematik');
  const [formBeschreibung, setFormBeschreibung] = useState('');
  const [formTransport, setFormTransport] = useState<AddonTransport>('rest_webhook');
  const [formEndpoint, setFormEndpoint] = useState('https://ti-middleware.anbieter.de/api/v2');
  const [formAuthTyp, setFormAuthTyp] = useState<AddonAuthTyp>('mtls_smcb');
  const [formCertPath, setFormCertPath] = useState('/etc/pflegerust/certs/smcb-client.pem');
  const [formScopes, setFormScopes] = useState<AddonScope[]>([
    'klienten:read',
    'medikation:read',
    'kim:send',
    'kim:receive',
    'epa:write',
    'vsdm:verify',
  ]);
  const [formHooks, setFormHooks] = useState<string[]>([
    'ti.kim.send_document',
    'ti.epa.push_mio',
    'ti.vsdm.verify_egk',
  ]);
  // TI profile fields in install form
  const [formTelematikId, setFormTelematikId] = useState('4-SMC-B-80276883110000148291');
  const [formMandantId, setFormMandantId] = useState('MANDANT_01');
  const [formClientSystemId, setFormClientSystemId] = useState('PFLEGERUST_DEBIAN_01');
  const [formWorkplaceId, setFormWorkplaceId] = useState('PDL_AP_01');
  const [formKimAdresse, setFormKimAdresse] = useState('pflegedienst@pflege.kim.telematik');
  const [formGematikZulassung, setFormGematikZulassung] = useState('TI 2.0 Gateway / PTV5+');
  const [formKonnektorTyp, setFormKonnektorTyp] = useState<
    'TI-Gateway (TIaaS)' | 'Highspeed-Konnektor (PTV5+)' | 'Lokaler Konnektor'
  >('TI-Gateway (TIaaS)');
  const [formTiDienste, setFormTiDienste] = useState<TiDienst[]>([
    'KIM 1.5',
    'ePA 3.0',
    'VSDM',
  ]);

  // Telematik dispatch console states
  const activeTiAddons = addons.filter((a) => a.kategorie === 'telematik' && a.aktiv);
  const [selectedTiAddonId, setSelectedTiAddonId] = useState<string>(activeTiAddons[0]?.id || '');
  const [selectedKlientId, setSelectedKlientId] = useState<string>(klienten[0]?.id || '');
  const [tiActionType, setTiActionType] = useState<'KIM 1.5' | 'ePA 3.0' | 'VSDM'>('KIM 1.5');
  const [kimRecipient, setKimRecipient] = useState('praxis.weber@kvberlin.kim.telematik');
  const [kimDocType, setKimDocType] = useState('Pflegeüberleitungsbogen (KBV MIO FHIR R4)');
  const [epaDocType, setEpaDocType] = useState('Elektronischer Medikationsplan (eMP / BMP)');
  const [isDispatchingTi, setIsDispatchingTi] = useState(false);

  // SDK copy feedback
  const [copiedBlock, setCopiedBlock] = useState<string | null>(null);

  useEffect(() => {
    if (!canManageAddons && activeTab !== 'telematik') {
      setActiveTab('telematik');
    } else if (!canUseTelematik && activeTab === 'telematik') {
      setActiveTab('installed');
    }
  }, [canManageAddons, canUseTelematik, activeTab]);

  useEffect(() => {
    if (!activeTiAddons.some((a) => a.id === selectedTiAddonId)) {
      setSelectedTiAddonId(activeTiAddons[0]?.id || '');
    }
  }, [addons, selectedTiAddonId]);

  const filteredAddons = addons.filter(
    (a) => categoryFilter === 'all' || a.kategorie === categoryFilter
  );

  const handleRunHealthcheck = (addonId: string) => {
    setTestingAddonId(addonId);
    setTimeout(() => {
      onTestAddonHealth(addonId);
      setTestingAddonId(null);
    }, 450);
  };

  const handleInstallFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formAnbieter.trim() || !formEndpoint.trim()) {
      setInstallError('Bitte füllen Sie Name, Anbieter und Endpoint-URL aus.');
      return;
    }

    const slug = formName
      .toLowerCase()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 36);

    const newAddon: PflegeAddon = {
      id: `addon-${slug || Date.now()}`,
      name: formName.trim(),
      version: formVersion.trim() || '1.0.0',
      anbieter: formAnbieter.trim(),
      kategorie: formKategorie,
      beschreibung:
        formBeschreibung.trim() ||
        'Externes PflegeRust Add-on zur Anbindung zertifizierter Schnittstellen.',
      aktiv: true,
      status: 'verbunden',
      transport: formTransport,
      endpointUrl: formEndpoint.trim(),
      authTyp: formAuthTyp,
      tlsZertifikatPfad: formAuthTyp === 'mtls_smcb' ? formCertPath.trim() : undefined,
      scopes: formScopes,
      hooks: formHooks,
      tiProfil:
        formKategorie === 'telematik'
          ? {
              telematikId: formTelematikId.trim(),
              mandantId: formMandantId.trim(),
              clientSystemId: formClientSystemId.trim(),
              workplaceId: formWorkplaceId.trim(),
              kimAdresse: formKimAdresse.trim(),
              gematikZulassung: formGematikZulassung.trim() || 'TI 2.0 Konform',
              konnektorTyp: formKonnektorTyp,
              smcbStatus: 'aktiv',
              unterstuetzteDienste: formTiDienste.length > 0 ? formTiDienste : ['KIM 1.5'],
            }
          : undefined,
      letzterHeartbeat: new Date().toISOString().replace('T', ' ').slice(0, 19),
      latenzMs: Math.floor(22 + Math.random() * 40),
      installiertAm: new Date().toISOString().slice(0, 10),
    };

    if (onInstallAddon(newAddon)) {
      setInstallError(null);
      setFormName('');
      setFormAnbieter('');
      setFormBeschreibung('');
      setActiveTab('installed');
    }
  };

  const handleInstallJsonSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsed = JSON.parse(manifestJson);
      if (!parsed.id || !parsed.name || !parsed.endpointUrl) {
        setInstallError(
          'Ungültiges Manifest: Die Felder "id", "name" und "endpointUrl" sind Pflichtfelder.'
        );
        return;
      }

      const newAddon: PflegeAddon = {
        id: String(parsed.id).trim(),
        name: String(parsed.name).trim(),
        version: String(parsed.version || '1.0.0'),
        anbieter: String(parsed.anbieter || 'Externer Anbieter'),
        kategorie: (['telematik', 'abrechnung', 'sensorik', 'kommunikation', 'sonstiges'].includes(
          parsed.kategorie
        )
          ? parsed.kategorie
          : 'telematik') as AddonKategorie,
        beschreibung: String(parsed.beschreibung || 'Per JSON-Manifest installiertes Add-on.'),
        aktiv: true,
        status: 'verbunden',
        transport: (['rest_webhook', 'grpc', 'unix_socket', 'wasm_sandbox'].includes(
          parsed.transport
        )
          ? parsed.transport
          : 'rest_webhook') as AddonTransport,
        endpointUrl: String(parsed.endpointUrl).trim(),
        authTyp: (['mtls_smcb', 'oauth2_client_credentials', 'api_token'].includes(parsed.authTyp)
          ? parsed.authTyp
          : 'mtls_smcb') as AddonAuthTyp,
        tlsZertifikatPfad: parsed.tlsZertifikatPfad ? String(parsed.tlsZertifikatPfad) : undefined,
        scopes: Array.isArray(parsed.scopes) ? parsed.scopes : ['klienten:read'],
        hooks: Array.isArray(parsed.hooks) ? parsed.hooks : [],
        tiProfil: parsed.tiProfil
          ? {
              telematikId: String(parsed.tiProfil.telematikId || ''),
              mandantId: String(parsed.tiProfil.mandantId || 'MANDANT_01'),
              clientSystemId: String(parsed.tiProfil.clientSystemId || 'PFLEGERUST'),
              workplaceId: String(parsed.tiProfil.workplaceId || 'AP_01'),
              kimAdresse: String(parsed.tiProfil.kimAdresse || ''),
              gematikZulassung: String(parsed.tiProfil.gematikZulassung || 'TI 2.0 Gateway'),
              konnektorTyp: parsed.tiProfil.konnektorTyp || 'TI-Gateway (TIaaS)',
              smcbStatus: parsed.tiProfil.smcbStatus || 'aktiv',
              unterstuetzteDienste: Array.isArray(parsed.tiProfil.unterstuetzteDienste)
                ? parsed.tiProfil.unterstuetzteDienste
                : ['KIM 1.5'],
            }
          : undefined,
        letzterHeartbeat: new Date().toISOString().replace('T', ' ').slice(0, 19),
        latenzMs: Math.floor(25 + Math.random() * 35),
        installiertAm: new Date().toISOString().slice(0, 10),
      };

      if (onInstallAddon(newAddon)) {
        setInstallError(null);
        setActiveTab('installed');
      }
    } catch (err) {
      setInstallError('JSON-Syntaxfehler im Manifest. Bitte prüfen Sie die Formatierung.');
    }
  };

  const handleDispatchTiSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tiAddon = activeTiAddons.find((a) => a.id === selectedTiAddonId) || activeTiAddons[0];
    const klient = klienten.find((k) => k.id === selectedKlientId) || klienten[0];
    if (!tiAddon || !klient) return;

    setIsDispatchingTi(true);
    setTimeout(() => {
      const refPrefix = tiActionType === 'KIM 1.5' ? 'KIM' : tiActionType === 'ePA 3.0' ? 'EPA3' : 'VSDM';
      const refCode = `${refPrefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random()
        .toString(16)
        .slice(2, 8)
        .toUpperCase()}`;

      onDispatchTiAction({
        addonId: tiAddon.id,
        addonName: tiAddon.name,
        dienst: tiActionType,
        klientName: `${klient.nachname}, ${klient.vorname}`,
        empfaengerOderZiel:
          tiActionType === 'KIM 1.5'
            ? kimRecipient.trim()
            : tiActionType === 'ePA 3.0'
            ? `ePA Aktensystem (${klient.versichertennummer})`
            : `${klient.krankenkasse} (IK ${klient.ikNummer})`,
        dokumentTyp:
          tiActionType === 'KIM 1.5'
            ? kimDocType
            : tiActionType === 'ePA 3.0'
            ? epaDocType
            : 'Versichertenstammdaten-Abgleich (eGK / VSDM)',
        status: tiActionType === 'VSDM' ? 'verifiziert' : 'zugestellt',
        referenzId: refCode,
        latenzMs: Math.floor(140 + Math.random() * 290),
      });
      setIsDispatchingTi(false);
    }, 550);
  };

  const copySnippet = (key: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedBlock(key);
    setTimeout(() => setCopiedBlock(null), 2000);
  };

  const rustTraitSnippet = `#[async_trait]
pub trait TelematikAddon: Send + Sync {
    fn manifest(&self) -> &AddonManifest;

    /// Prüft Konnektor / TI-Gateway, SMC-B Zertifikat & Fachdienst-Erreichbarkeit
    async fn health_check(&self) -> Result<TiHealthStatus, AddonError>;

    /// Versand eines verschlüsselten Dokuments via KIM 1.5 (eArztbrief / MIO / HKP)
    async fn send_kim_document(&self, req: KimSendRequest) -> Result<TiDispatchReceipt, AddonError>;

    /// Einstellung von FHIR R4 MIO Pflegeüberleitungsbogen oder BMP in die ePA 3.0
    async fn push_epa_document(&self, req: EpaPushRequest) -> Result<TiDispatchReceipt, AddonError>;

    /// Versichertenstammdaten-Abgleich (VSDM) über TI-Gateway / Konnektor
    async fn verify_vsdm(&self, req: VsdmCheckRequest) -> Result<VsdmResult, AddonError>;
}`;

  const webhookSpecSnippet = `POST https://<middleware-endpoint>/v1/ti/kim/send
Content-Type: application/json
X-PflegeRust-Addon-Id: addon-ti-gateway-tiaas
X-PflegeRust-Signature: sha256=<HMAC-SHA256(body, webhook_secret)>
X-TI-Mandant-Id: MANDANT_BERLIN_01
X-TI-ClientSystem-Id: PFLEGERUST_DEBIAN_01

{
  "telematik_id": "4-SMC-B-80276883110000148291",
  "sender_kim": "pd-berlin-zentrum@pflege.kim.telematik",
  "recipient_kim": "praxis.weber@kvberlin.kim.telematik",
  "document_type": "KBV_MIO_ULB_FHIR_R4",
  "patient_versichertennummer": "A123456789",
  "payload_base64": "<FHIR-R4-Bundle>"
}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-800 uppercase tracking-wider mb-1">
            <Plug className="w-3.5 h-3.5" />
            <span>Modulares Add-on-System &amp; Deutsche Telematikinfrastruktur (TI 2.0)</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Add-ons &amp; Telematik-Middleware
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Offene Schnittstelle für zertifizierte TI-Middleware-Anbieter (KIM 1.5, ePA 3.0, eVO/HKP, VSDM, TI-Messenger) &amp; externe Dienste
          </p>
        </div>

        {/* Sub-tabs strictly filtered by RBAC */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
          {canManageAddons && (
            <button
              type="button"
              onClick={() => setActiveTab('installed')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                activeTab === 'installed'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Add-ons ({addons.filter((a) => a.aktiv).length}/{addons.length} aktiv)
            </button>
          )}
          {canUseTelematik && (
            <button
              type="button"
              onClick={() => setActiveTab('telematik')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                activeTab === 'telematik'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Telematik (TI) Dienste
            </button>
          )}
          {canManageAddons && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('install')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  activeTab === 'install'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                + Add-on installieren
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('sdk')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  activeTab === 'sdk'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Anbieter-SDK &amp; TI-API
              </button>
            </>
          )}
        </div>
      </div>

      {/* TAB 1: INSTALLED ADD-ONS */}
      {canManageAddons && activeTab === 'installed' && (
        <div className="space-y-4">
          {/* Summary & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 border border-slate-200 rounded-lg text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'all', label: `Alle (${addons.length})` },
                {
                  id: 'telematik',
                  label: `Telematik / TI (${addons.filter((a) => a.kategorie === 'telematik').length})`,
                },
                {
                  id: 'abrechnung',
                  label: `Abrechnung (${addons.filter((a) => a.kategorie === 'abrechnung').length})`,
                },
                {
                  id: 'kommunikation',
                  label: `Kommunikation (${addons.filter((a) => a.kategorie === 'kommunikation').length})`,
                },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    categoryFilter === cat.id
                      ? 'bg-teal-700 text-white font-semibold'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('install')}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>TI-Middleware / Add-on hinzufügen</span>
            </button>
          </div>

          {/* Add-on Cards */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {filteredAddons.map((addon) => (
              <div
                key={addon.id}
                className={`bg-white border rounded-lg p-5 flex flex-col justify-between gap-4 transition-colors ${
                  addon.aktiv ? 'border-slate-200 shadow-xs' : 'border-slate-200/80 bg-slate-50/50'
                }`}
              >
                <div className="space-y-3">
                  {/* Card Top Row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900">{addon.name}</span>
                        <span className="font-mono text-[11px] text-slate-500">v{addon.version}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2">
                        <span>{addon.anbieter}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-medium text-teal-800">
                          {KATEGORIE_LABELS[addon.kategorie]}
                        </span>
                      </div>
                    </div>

                    {/* Active toggle */}
                    <button
                      type="button"
                      onClick={() => onToggleAddon(addon.id)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors cursor-pointer shrink-0 ${
                        addon.aktiv
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {addon.aktiv ? 'Aktiv' : 'Deaktiviert'}
                    </button>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">{addon.beschreibung}</p>

                  {/* Connection Metadata */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-md bg-slate-50 border border-slate-200/80 text-[11px]">
                    <div className="min-w-0">
                      <span className="text-slate-400 block">Endpunkt ({TRANSPORT_LABELS[addon.transport]})</span>
                      <span className="font-mono text-slate-800 truncate block" title={addon.endpointUrl}>
                        {addon.endpointUrl}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Authentifizierung &amp; Status</span>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-700">{AUTH_LABELS[addon.authTyp]}</span>
                        {addon.aktiv && addon.latenzMs !== undefined && (
                          <span className="font-mono text-emerald-700 font-semibold tabular-nums">
                            {addon.latenzMs} ms
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* TI Profile block for Telematik Add-ons */}
                  {addon.tiProfil && (
                    <div className="p-3 rounded-md bg-teal-50/60 border border-teal-200/80 space-y-2 text-[11px]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-teal-950 flex items-center gap-1.5">
                          <Radio className="w-3.5 h-3.5 text-teal-700" />
                          <span>{addon.tiProfil.konnektorTyp} · {addon.tiProfil.gematikZulassung}</span>
                        </span>
                        <span className="font-mono text-[10px] font-semibold text-emerald-800">
                          SMC-B: {addon.tiProfil.smcbStatus.toUpperCase()}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-teal-900">
                        <div className="truncate">
                          <span className="text-teal-700">Telematik-ID: </span>
                          <span className="font-mono">{addon.tiProfil.telematikId}</span>
                        </div>
                        <div className="truncate">
                          <span className="text-teal-700">KIM-Adresse: </span>
                          <span className="font-mono">{addon.tiProfil.kimAdresse}</span>
                        </div>
                      </div>
                      <div className="text-teal-900 pt-1 border-t border-teal-200/60 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10px]">
                        <span className="font-sans font-semibold text-teal-800">TI-Dienste:</span>
                        {addon.tiProfil.unterstuetzteDienste.map((d, idx) => (
                          <React.Fragment key={d}>
                            {idx > 0 && <span className="text-teal-400">·</span>}
                            <span>{d}</span>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Scopes (Least Privilege) */}
                  <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                    <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="font-medium text-slate-500">Freigegebene Scopes:</span>
                    <span className="font-mono text-[10px] text-slate-700">
                      {addon.scopes.join(', ') || 'Keine'}
                    </span>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-[11px] text-slate-400 font-mono">
                    Heartbeat: {addon.letzterHeartbeat}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={!addon.aktiv || testingAddonId === addon.id}
                      onClick={() => handleRunHealthcheck(addon.id)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium border transition-colors ${
                        !addon.aktiv
                          ? 'text-slate-400 bg-slate-100 border-slate-200 cursor-not-allowed'
                          : 'text-teal-800 bg-white border-teal-200 hover:bg-teal-50 cursor-pointer'
                      }`}
                    >
                      <RefreshCw
                        className={`w-3 h-3 ${testingAddonId === addon.id ? 'animate-spin' : ''}`}
                      />
                      <span>{testingAddonId === addon.id ? 'Prüfe...' : 'Verbindung prüfen'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditingAddon(JSON.parse(JSON.stringify(addon)))}
                      className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 cursor-pointer"
                    >
                      <Settings className="w-3 h-3" />
                      <span>Konfigurieren</span>
                    </button>

                    {confirmRemoveId === addon.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveId(null)}
                          className="px-2 py-1 text-[11px] text-slate-600 bg-slate-100 rounded hover:bg-slate-200 cursor-pointer"
                        >
                          Nein
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onRemoveAddon(addon.id);
                            setConfirmRemoveId(null);
                          }}
                          className="px-2 py-1 text-[11px] font-semibold text-white bg-rose-600 rounded hover:bg-rose-700 cursor-pointer"
                        >
                          Entfernen
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmRemoveId(addon.id)}
                        title="Add-on deinstallieren"
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: TELEMATIK (TI) DIENSTE CONSOLE */}
      {canUseTelematik && activeTab === 'telematik' && (
        <div className="space-y-5">
          {activeTiAddons.length === 0 ? (
            <div className="p-6 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-sm">Kein Telematik-Middleware-Add-on aktiv</div>
                  <p className="mt-1 text-amber-900 leading-relaxed">
                    Um KIM 1.5, ePA 3.0 oder VSDM zu nutzen, muss mindestens ein zertifiziertes TI-Middleware-Add-on installiert und aktiviert sein.
                  </p>
                </div>
              </div>
              {canManageAddons && (
                <button
                  type="button"
                  onClick={() => setActiveTab('installed')}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md cursor-pointer shrink-0"
                >
                  TI-Add-on aktivieren
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left: Interactive TI Action Dispatcher (7 cols) */}
              <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <Radio className="w-4 h-4 text-teal-700" />
                      <span>Telematik-Aktion über Middleware ausführen</span>
                    </h2>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Aufrufe werden signiert an das gewählte TI-Middleware-Add-on übergeben und im DSGVO Audit-Log erfasst.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleDispatchTiSubmit} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-700 font-medium block mb-1">
                        Aktives TI-Middleware-Add-on
                      </label>
                      <select
                        value={selectedTiAddonId}
                        onChange={(e) => setSelectedTiAddonId(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded bg-white font-medium text-slate-800"
                      >
                        {activeTiAddons.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({a.tiProfil?.konnektorTyp || 'TI'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-700 font-medium block mb-1">Klient auswählen</label>
                      <select
                        value={selectedKlientId}
                        onChange={(e) => setSelectedKlientId(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded bg-white font-medium text-slate-800"
                      >
                        {klienten.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.nachname}, {k.vorname} ({k.versichertennummer})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Service selector */}
                  <div>
                    <label className="text-slate-700 font-medium block mb-1.5">TI-Fachdienst</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['KIM 1.5', 'ePA 3.0', 'VSDM'] as const).map((svc) => (
                        <button
                          key={svc}
                          type="button"
                          onClick={() => setTiActionType(svc)}
                          className={`p-2.5 rounded-md border text-center font-semibold transition-colors cursor-pointer ${
                            tiActionType === svc
                              ? 'bg-teal-700 text-white border-teal-700'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {svc}
                        </button>
                      ))}
                    </div>
                  </div>

                  {tiActionType === 'KIM 1.5' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-md">
                      <div>
                        <label className="text-slate-700 font-medium block mb-1">
                          Empfänger KIM-Adresse *
                        </label>
                        <input
                          type="email"
                          required
                          value={kimRecipient}
                          onChange={(e) => setKimRecipient(e.target.value)}
                          placeholder="hausarzt@kv.kim.telematik"
                          className="w-full p-2 bg-white border border-slate-300 rounded font-mono text-[11px]"
                        />
                      </div>
                      <div>
                        <label className="text-slate-700 font-medium block mb-1">
                          Dokumententyp (FHIR / KIM)
                        </label>
                        <select
                          value={kimDocType}
                          onChange={(e) => setKimDocType(e.target.value)}
                          className="w-full p-2 bg-white border border-slate-300 rounded"
                        >
                          <option value="Pflegeüberleitungsbogen (KBV MIO FHIR R4)">
                            Pflegeüberleitungsbogen (KBV MIO)
                          </option>
                          <option value="HKP-Verordnungsrückfrage (§ 132a SGB V)">
                            HKP-Verordnungsrückfrage (§ 132a)
                          </option>
                          <option value="Aktualisierter Medikationsplan (BMP)">
                            Aktualisierter Medikationsplan (BMP)
                          </option>
                          <option value="eArztbrief / Wunddokumentation">
                            eArztbrief / Wunddokumentation
                          </option>
                        </select>
                      </div>
                    </div>
                  )}

                  {tiActionType === 'ePA 3.0' && (
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md space-y-2">
                      <label className="text-slate-700 font-medium block">
                        Dokument in ePA 3.0 Aktensystem einstellen
                      </label>
                      <select
                        value={epaDocType}
                        onChange={(e) => setEpaDocType(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-300 rounded"
                      >
                        <option value="Elektronischer Medikationsplan (eMP / BMP)">
                          Elektronischer Medikationsplan (eMP / BMP)
                        </option>
                        <option value="KBV MIO Pflege-Überleitungsbogen (FHIR R4)">
                          KBV MIO Pflege-Überleitungsbogen (FHIR R4)
                        </option>
                        <option value="SIS-Risikomatrix & Notfalldaten (NFD)">
                          SIS-Risikomatrix &amp; Notfalldaten (NFD)
                        </option>
                      </select>
                    </div>
                  )}

                  {tiActionType === 'VSDM' && (
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md text-[11px] text-slate-600">
                      Prüft Krankenversicherungsstatus, IK-Nummer und Zuzahlungsbefreiung des gewählten Klienten über den VSDM-Hook der aktiven TI-Middleware.
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isDispatchingTi || klienten.length === 0}
                      className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>
                        {isDispatchingTi
                          ? 'Übertrage über TI-Middleware...'
                          : `${tiActionType} über Add-on ausführen`}
                      </span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Right: Active TI Gateway Status Summary (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 text-xs">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-teal-700" />
                    <span>Aktive TI-Middleware-Anbindungen ({activeTiAddons.length})</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {activeTiAddons.map((a) => (
                      <div key={a.id} className="py-2.5 first:pt-0 last:pb-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900">{a.name}</span>
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-mono">
                            <CheckCircle2 className="w-3 h-3" />
                            {a.latenzMs || 35} ms
                          </span>
                        </div>
                        {a.tiProfil && (
                          <div className="text-[11px] text-slate-500 font-mono space-y-0.5">
                            <div>SMC-B: {a.tiProfil.telematikId}</div>
                            <div>KIM: {a.tiProfil.kimAdresse}</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1.5">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-teal-700" />
                    <span>Warum ein Add-on-Modell für die TI?</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    PflegeRust bleibt schlank, sicher und herstellerunabhängig. Zertifizierte TI-Middleware-Anbieter (TI-Gateway / TIaaS, KIM-Clientmodul, ePA-Adapter) docken über standardisierte mTLS-, REST- oder Debian-Unix-Socket-Schnittstellen an – ohne Eingriff in den Kern.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TI Transaction History */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-teal-700" />
                <span>TI-Übertragungsprotokoll ({tiTransaktionen.length})</span>
              </div>
              <span className="font-mono text-[11px] text-slate-500">
                Signiert via SMC-B / mTLS
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Zeitstempel</th>
                    <th className="p-3">Dienst</th>
                    <th className="p-3">Klient</th>
                    <th className="p-3">Empfänger / Ziel</th>
                    <th className="p-3">Dokument / Vorgang</th>
                    <th className="p-3">Referenz &amp; Latenz</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tiTransaktionen.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        {tx.zeitstempel}
                      </td>
                      <td className="p-3 font-mono font-bold text-teal-800 whitespace-nowrap">
                        {tx.dienst}
                      </td>
                      <td className="p-3 font-medium text-slate-900 whitespace-nowrap">
                        {tx.klientName}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-700">
                        {tx.empfaengerOderZiel}
                      </td>
                      <td className="p-3 text-slate-700">
                        <div>{tx.dokumentTyp}</div>
                        <div className="text-[10px] text-slate-400">via {tx.addonName}</div>
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        <div>{tx.referenzId}</div>
                        <div className="text-[10px] text-slate-400">{tx.latenzMs} ms</div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {tx.status === 'verifiziert' ? 'Verifiziert' : 'Zugestellt'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: INSTALL ADD-ON / IMPORT MANIFEST */}
      {canManageAddons && activeTab === 'install' && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-5 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Neues Add-on oder TI-Middleware-Anbieter registrieren
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Integrieren Sie einen beliebigen Telematik-Middleware-Partner per Formular oder standardisiertem JSON-Manifest.
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setInstallMode('form');
                  setInstallError(null);
                }}
                className={`px-3 py-1 rounded text-xs font-medium cursor-pointer ${
                  installMode === 'form'
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                Geführtes Formular
              </button>
              <button
                type="button"
                onClick={() => {
                  setInstallMode('json');
                  setInstallError(null);
                }}
                className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium cursor-pointer ${
                  installMode === 'json'
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                <FileJson className="w-3.5 h-3.5" />
                <span>JSON-Manifest</span>
              </button>
            </div>
          </div>

          {installError && (
            <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              {installError}
            </div>
          )}

          {installMode === 'form' ? (
            <form onSubmit={handleInstallFormSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-slate-700 font-medium block mb-1">Add-on Name *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="z.B. secunet TI-Gateway Connector"
                    className="w-full p-2 border border-slate-300 rounded font-medium"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-medium block mb-1">Anbieter / Hersteller *</label>
                  <input
                    type="text"
                    required
                    value={formAnbieter}
                    onChange={(e) => setFormAnbieter(e.target.value)}
                    placeholder="z.B. RISE / secunet / CGM / RED"
                    className="w-full p-2 border border-slate-300 rounded"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-700 font-medium block mb-1">Kategorie</label>
                    <select
                      value={formKategorie}
                      onChange={(e) => setFormKategorie(e.target.value as AddonKategorie)}
                      className="w-full p-2 border border-slate-300 rounded bg-white"
                    >
                      <option value="telematik">Telematik (TI)</option>
                      <option value="abrechnung">Abrechnung / DTA</option>
                      <option value="kommunikation">Kommunikation</option>
                      <option value="sensorik">Sensorik / IoT</option>
                      <option value="sonstiges">Sonstiges</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-700 font-medium block mb-1">Version</label>
                    <input
                      type="text"
                      value={formVersion}
                      onChange={(e) => setFormVersion(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded font-mono"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-medium block mb-1">Beschreibung</label>
                <input
                  type="text"
                  value={formBeschreibung}
                  onChange={(e) => setFormBeschreibung(e.target.value)}
                  placeholder="Kurze Beschreibung der bereitgestellten TI- oder Fachfunktionen..."
                  className="w-full p-2 border border-slate-300 rounded"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-slate-700 font-medium block mb-1">Transportprotokoll</label>
                  <select
                    value={formTransport}
                    onChange={(e) => setFormTransport(e.target.value as AddonTransport)}
                    className="w-full p-2 border border-slate-300 rounded bg-white"
                  >
                    <option value="rest_webhook">REST / Webhook (HTTPS)</option>
                    <option value="grpc">gRPC / HTTP2 (TLS)</option>
                    <option value="unix_socket">Debian Unix-Socket (systemd)</option>
                    <option value="wasm_sandbox">WASM Sandbox</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-slate-700 font-medium block mb-1">Endpoint-URL / Socket-Pfad *</label>
                  <input
                    type="text"
                    required
                    value={formEndpoint}
                    onChange={(e) => setFormEndpoint(e.target.value)}
                    placeholder="https://ti-gateway.anbieter.de/api/v2 oder unix:///run/pflegerust/ti.sock"
                    className="w-full p-2 border border-slate-300 rounded font-mono text-[11px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-700 font-medium block mb-1">Authentifizierung</label>
                  <select
                    value={formAuthTyp}
                    onChange={(e) => setFormAuthTyp(e.target.value as AddonAuthTyp)}
                    className="w-full p-2 border border-slate-300 rounded bg-white"
                  >
                    <option value="mtls_smcb">mTLS + SMC-B Zertifikat</option>
                    <option value="oauth2_client_credentials">OAuth 2.0 Client Credentials</option>
                    <option value="api_token">Bearer API-Token + HMAC</option>
                  </select>
                </div>
                {formAuthTyp === 'mtls_smcb' && (
                  <div>
                    <label className="text-slate-700 font-medium block mb-1">
                      TLS Client-Zertifikat Pfad (Debian)
                    </label>
                    <input
                      type="text"
                      value={formCertPath}
                      onChange={(e) => setFormCertPath(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded font-mono text-[11px]"
                    />
                  </div>
                )}
              </div>

              {/* Conditional TI Middleware Fields */}
              {formKategorie === 'telematik' && (
                <div className="p-4 rounded-lg bg-teal-50/50 border border-teal-200 space-y-3">
                  <div className="font-bold text-teal-950 flex items-center gap-1.5">
                    <Radio className="w-4 h-4 text-teal-700" />
                    <span>Telematikinfrastruktur (TI) Konnektor- &amp; SMC-B-Parameter</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-teal-900 font-medium block mb-1">Konnektor / Anbindung</label>
                      <select
                        value={formKonnektorTyp}
                        onChange={(e) => setFormKonnektorTyp(e.target.value as any)}
                        className="w-full p-2 bg-white border border-teal-300 rounded"
                      >
                        <option value="TI-Gateway (TIaaS)">TI-Gateway (TIaaS)</option>
                        <option value="Highspeed-Konnektor (PTV5+)">Highspeed-Konnektor (PTV5+)</option>
                        <option value="Lokaler Konnektor">Lokaler Konnektor</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-teal-900 font-medium block mb-1">SMC-B Telematik-ID</label>
                      <input
                        type="text"
                        value={formTelematikId}
                        onChange={(e) => setFormTelematikId(e.target.value)}
                        className="w-full p-2 bg-white border border-teal-300 rounded font-mono text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="text-teal-900 font-medium block mb-1">KIM-Absenderadresse</label>
                      <input
                        type="text"
                        value={formKimAdresse}
                        onChange={(e) => setFormKimAdresse(e.target.value)}
                        className="w-full p-2 bg-white border border-teal-300 rounded font-mono text-[11px]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="text-teal-900 font-medium block mb-1">Mandant-ID</label>
                      <input
                        type="text"
                        value={formMandantId}
                        onChange={(e) => setFormMandantId(e.target.value)}
                        className="w-full p-1.5 bg-white border border-teal-300 rounded font-mono text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="text-teal-900 font-medium block mb-1">ClientSystem-ID</label>
                      <input
                        type="text"
                        value={formClientSystemId}
                        onChange={(e) => setFormClientSystemId(e.target.value)}
                        className="w-full p-1.5 bg-white border border-teal-300 rounded font-mono text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="text-teal-900 font-medium block mb-1">Workplace-ID</label>
                      <input
                        type="text"
                        value={formWorkplaceId}
                        onChange={(e) => setFormWorkplaceId(e.target.value)}
                        className="w-full p-1.5 bg-white border border-teal-300 rounded font-mono text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="text-teal-900 font-medium block mb-1">gematik Zulassung</label>
                      <input
                        type="text"
                        value={formGematikZulassung}
                        onChange={(e) => setFormGematikZulassung(e.target.value)}
                        className="w-full p-1.5 bg-white border border-teal-300 rounded text-[11px]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-teal-900 font-medium block mb-1.5">
                      Unterstützte TI-Dienste
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {ALLE_TI_DIENSTE.map((dienst) => {
                        const active = formTiDienste.includes(dienst);
                        return (
                          <label
                            key={dienst}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border cursor-pointer text-[11px] font-medium ${
                              active
                                ? 'bg-teal-700 text-white border-teal-700'
                                : 'bg-white text-slate-700 border-slate-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={active}
                              onChange={() =>
                                setFormTiDienste((prev) =>
                                  active ? prev.filter((d) => d !== dienst) : [...prev, dienst]
                                )
                              }
                            />
                            <span>{dienst}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Scopes & Hooks */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-900">Datenzugriffs-Scopes (Zero-Trust)</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {ALLE_ADDON_SCOPES.map((sc) => {
                      const checked = formScopes.includes(sc.id);
                      return (
                        <label
                          key={sc.id}
                          className="flex items-start gap-2 p-1.5 rounded bg-white border border-slate-200 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setFormScopes((prev) =>
                                checked ? prev.filter((s) => s !== sc.id) : [...prev, sc.id]
                              )
                            }
                            className="mt-0.5 accent-teal-700"
                          />
                          <div>
                            <div className="font-mono text-[11px] font-semibold text-slate-800">
                              {sc.id}
                            </div>
                            <div className="text-[10px] text-slate-500">{sc.label}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-900">Registrierte Event- &amp; RPC-Hooks</div>
                  <div className="space-y-1.5">
                    {ALLE_ADDON_HOOKS.map((hk) => {
                      const checked = formHooks.includes(hk.id);
                      return (
                        <label
                          key={hk.id}
                          className="flex items-center gap-2 p-1.5 rounded bg-white border border-slate-200 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setFormHooks((prev) =>
                                checked ? prev.filter((h) => h !== hk.id) : [...prev, hk.id]
                              )
                            }
                            className="accent-teal-700"
                          />
                          <span className="font-mono text-[11px] text-slate-800">{hk.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveTab('installed')}
                  className="px-3.5 py-2 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md cursor-pointer shadow-xs"
                >
                  Add-on registrieren &amp; aktivieren
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleInstallJsonSubmit} className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-800">
                  Add-on Manifest (addon-manifest.json)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setManifestJson(EXAMPLE_TI_MANIFEST_JSON);
                    setInstallError(null);
                  }}
                  className="text-[11px] font-medium text-teal-800 hover:underline cursor-pointer"
                >
                  TI-Middleware Beispiel laden
                </button>
              </div>
              <textarea
                rows={18}
                value={manifestJson}
                onChange={(e) => {
                  setManifestJson(e.target.value);
                  setInstallError(null);
                }}
                className="w-full p-3 bg-slate-900 text-teal-200 font-mono text-[11px] rounded-lg border border-slate-700 leading-relaxed"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('installed')}
                  className="px-3.5 py-2 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md cursor-pointer"
                >
                  Manifest prüfen &amp; installieren
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* TAB 4: PROVIDER SDK & TI-API DOCUMENTATION */}
      {canManageAddons && activeTab === 'sdk' && (
        <div className="space-y-5 text-xs">
          <div className="p-4 bg-white border border-slate-200 rounded-lg space-y-2">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Code2 className="w-4 h-4 text-teal-700" />
              <span>Anbieter-Schnittstelle für TI-Middleware &amp; Drittanbieter</span>
            </h2>
            <p className="text-slate-600 leading-relaxed">
              TI-Middleware-Anbieter (TI-Gateway / TIaaS, KIM 1.5 Fachdienste, ePA 3.0 Aktensysteme) integrieren sich über ein standardisiertes JSON-Manifest sowie das signierte HTTP/mTLS- bzw. Debian-Unix-Socket-Protokoll. Alle Aufrufe aus PflegeRust werden über das Rust-Trait <code className="font-mono text-teal-800">TelematikAddon</code> gekapselt und gegen die freigegebenen Scopes geprüft.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="font-bold text-slate-900 font-mono">src/addons/mod.rs · Rust Trait</span>
                <button
                  type="button"
                  onClick={() => copySnippet('rust', rustTraitSnippet)}
                  className="flex items-center gap-1 text-[11px] text-teal-800 hover:text-teal-950 cursor-pointer"
                >
                  {copiedBlock === 'rust' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedBlock === 'rust' ? 'Kopiert' : 'Kopieren'}</span>
                </button>
              </div>
              <pre className="p-4 bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto flex-1 leading-relaxed">
                {rustTraitSnippet}
              </pre>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="font-bold text-slate-900 font-mono">HTTP / mTLS + HMAC Webhook Contract</span>
                <button
                  type="button"
                  onClick={() => copySnippet('http', webhookSpecSnippet)}
                  className="flex items-center gap-1 text-[11px] text-teal-800 hover:text-teal-950 cursor-pointer"
                >
                  {copiedBlock === 'http' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedBlock === 'http' ? 'Kopiert' : 'Kopieren'}</span>
                </button>
              </div>
              <pre className="p-4 bg-slate-900 text-teal-200 font-mono text-[11px] overflow-x-auto flex-1 leading-relaxed">
                {webhookSpecSnippet}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIGURE EXISTING ADD-ON */}
      {canManageAddons && editingAddon && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Add-on konfigurieren: {editingAddon.name}
                </h3>
                <p className="text-[11px] text-slate-500 font-mono">ID: {editingAddon.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingAddon(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                onUpdateAddon(editingAddon);
                setEditingAddon(null);
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-medium block mb-1">Transport</label>
                  <select
                    value={editingAddon.transport}
                    onChange={(e) =>
                      setEditingAddon({
                        ...editingAddon,
                        transport: e.target.value as AddonTransport,
                      })
                    }
                    className="w-full p-2 border border-slate-300 rounded bg-white"
                  >
                    <option value="rest_webhook">REST / Webhook (HTTPS)</option>
                    <option value="grpc">gRPC / HTTP2 (TLS)</option>
                    <option value="unix_socket">Debian Unix-Socket</option>
                    <option value="wasm_sandbox">WASM Sandbox</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-700 font-medium block mb-1">Authentifizierung</label>
                  <select
                    value={editingAddon.authTyp}
                    onChange={(e) =>
                      setEditingAddon({
                        ...editingAddon,
                        authTyp: e.target.value as AddonAuthTyp,
                      })
                    }
                    className="w-full p-2 border border-slate-300 rounded bg-white"
                  >
                    <option value="mtls_smcb">mTLS + SMC-B Zertifikat</option>
                    <option value="oauth2_client_credentials">OAuth 2.0 Client Credentials</option>
                    <option value="api_token">Bearer API-Token + HMAC</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-medium block mb-1">Endpoint-URL / Socket</label>
                <input
                  type="text"
                  required
                  value={editingAddon.endpointUrl}
                  onChange={(e) =>
                    setEditingAddon({ ...editingAddon, endpointUrl: e.target.value })
                  }
                  className="w-full p-2 border border-slate-300 rounded font-mono text-[11px]"
                />
              </div>

              {editingAddon.authTyp === 'mtls_smcb' && (
                <div>
                  <label className="text-slate-700 font-medium block mb-1">
                    mTLS Zertifikatspfad (Debian Linux)
                  </label>
                  <input
                    type="text"
                    value={editingAddon.tlsZertifikatPfad || ''}
                    onChange={(e) =>
                      setEditingAddon({ ...editingAddon, tlsZertifikatPfad: e.target.value })
                    }
                    className="w-full p-2 border border-slate-300 rounded font-mono text-[11px]"
                  />
                </div>
              )}

              {editingAddon.tiProfil && (
                <div className="p-3.5 rounded-lg bg-teal-50/60 border border-teal-200 space-y-3">
                  <div className="font-bold text-teal-950">Telematik-Parameter (SMC-B &amp; Mandant)</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-teal-900 font-medium block mb-1">Telematik-ID (SMC-B)</label>
                      <input
                        type="text"
                        value={editingAddon.tiProfil.telematikId}
                        onChange={(e) =>
                          setEditingAddon({
                            ...editingAddon,
                            tiProfil: { ...editingAddon.tiProfil!, telematikId: e.target.value },
                          })
                        }
                        className="w-full p-1.5 bg-white border border-teal-300 rounded font-mono text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="text-teal-900 font-medium block mb-1">KIM-Adresse</label>
                      <input
                        type="text"
                        value={editingAddon.tiProfil.kimAdresse}
                        onChange={(e) =>
                          setEditingAddon({
                            ...editingAddon,
                            tiProfil: { ...editingAddon.tiProfil!, kimAdresse: e.target.value },
                          })
                        }
                        className="w-full p-1.5 bg-white border border-teal-300 rounded font-mono text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="text-teal-900 font-medium block mb-1">Mandant-ID</label>
                      <input
                        type="text"
                        value={editingAddon.tiProfil.mandantId}
                        onChange={(e) =>
                          setEditingAddon({
                            ...editingAddon,
                            tiProfil: { ...editingAddon.tiProfil!, mandantId: e.target.value },
                          })
                        }
                        className="w-full p-1.5 bg-white border border-teal-300 rounded font-mono text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="text-teal-900 font-medium block mb-1">Workplace-ID</label>
                      <input
                        type="text"
                        value={editingAddon.tiProfil.workplaceId}
                        onChange={(e) =>
                          setEditingAddon({
                            ...editingAddon,
                            tiProfil: { ...editingAddon.tiProfil!, workplaceId: e.target.value },
                          })
                        }
                        className="w-full p-1.5 bg-white border border-teal-300 rounded font-mono text-[11px]"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-slate-700 font-medium block">
                  Freigegebene Datenzugriffs-Scopes
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {ALLE_ADDON_SCOPES.map((sc) => {
                    const checked = editingAddon.scopes.includes(sc.id);
                    return (
                      <label
                        key={sc.id}
                        className="flex items-center gap-1.5 p-1.5 rounded bg-slate-50 border border-slate-200 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setEditingAddon({
                              ...editingAddon,
                              scopes: checked
                                ? editingAddon.scopes.filter((s) => s !== sc.id)
                                : [...editingAddon.scopes, sc.id],
                            })
                          }
                          className="accent-teal-700"
                        />
                        <span className="font-mono text-[10px] text-slate-800">{sc.id}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingAddon(null)}
                  className="px-3 py-1.5 text-xs text-slate-700 bg-slate-100 rounded hover:bg-slate-200 cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-teal-700 rounded hover:bg-teal-800 cursor-pointer"
                >
                  Konfiguration speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
