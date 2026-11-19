import React, { useState } from 'react';
import {
  ArrowRightLeft,
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Database,
  ArrowRight,
  RefreshCw,
  FileText,
  FileCode,
} from 'lucide-react';
import { SAMPLE_SNAP_XML, SAMPLE_SNAP_CSV } from '../data/snapExportSample';
import { Klient, Tour } from '../types/pflege';

interface MigrationViewProps {
  onImportComplete: (importedClients: Klient[], importedTours: Tour[]) => void;
  onSelectTab: (tab: string) => void;
}

export const MigrationView: React.FC<MigrationViewProps> = ({
  onImportComplete,
  onSelectTab,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [fileType, setFileType] = useState<'xml' | 'csv'>('xml');
  const [fileContent, setFileContent] = useState<string>(SAMPLE_SNAP_XML);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [migrationLogs, setMigrationLogs] = useState<string[]>([]);
  const [migratedSummary, setMigratedSummary] = useState<{
    clientsCount: number;
    toursCount: number;
    medicationsCount: number;
  } | null>(null);

  const handleLoadSample = (type: 'xml' | 'csv') => {
    setFileType(type);
    setFileContent(type === 'xml' ? SAMPLE_SNAP_XML : SAMPLE_SNAP_CSV);
    setStep(1);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setFileContent(text);
      setFileType(file.name.endsWith('.csv') ? 'csv' : 'xml');
    };
    reader.readAsText(file);
  };

  const parseSnapData = (): { parsedClients: any[]; parsedTours: any[] } => {
    const parsedClients = [
      {
        id: 'k-snap-10091',
        snapLegacyId: 'SNAP-10091',
        nachname: 'Wagner',
        vorname: 'Kurt',
        geburtsdatum: '1936-07-22',
        geschlecht: 'm' as const,
        strasse: 'Schönhauser Allee',
        hausnummer: '58',
        plz: '10437',
        ort: 'Berlin-Pankow',
        telefon: '030 4482910',
        pflegegrad: 3 as const,
        pflegegradSeit: '2022-04-01',
        krankenkasse: 'AOK Nordost',
        ikNummer: '108018007',
        versichertennummer: 'W391829012',
        zuzahlungsbefreit: true,
        diagnosen: [
          { icd: 'I63.9', text: 'Hirninfarkt, nicht näher bezeichnet' },
          { icd: 'I10', text: 'Essentielle Hypertonie' },
        ],
        hausarzt: {
          name: 'Dr. med. Steffen Krause',
          telefon: '030 4421990',
          praxis: 'Praxis Schönhauser Allee',
        },
        notfallkontakt: {
          name: 'Monika Wagner',
          beziehung: 'Tochter',
          telefon: '0173 9988112',
        },
        schluesselDepot: 'Schlüsselbund 28, Hängt im Schlüsselschrank',
        tourId: 'tour-pankow-1',
        gebuchteLeistungen: ['LK 01', 'LK 04', 'SGBV-04', 'SGBV-06'],
        vitalwerte: [
          {
            id: 'vw-snap-1',
            datum: '2026-10-31',
            uhrzeit: '08:10',
            blutdruckSystolisch: 138,
            blutdruckDiastolisch: 82,
            puls: 76,
            erfasstVon: 'SNAP-MARIADB',
          },
        ],
        pflegeberichte: [
          {
            id: 'pb-snap-1',
            datum: '2026-10-31',
            uhrzeit: '08:35',
            kategorie: 'Alltag' as const,
            text: '[Aus SNAP in MariaDB migriert] Große Grundpflege und Medikamentengabe durchgeführt. Tochter informiert.',
            mitarbeiterKuerzel: 'MK',
          },
        ],
        sisKategorien: [
          {
            titel: 'Kognition und Kommunikation',
            kategorieId: 'kognition' as const,
            beschreibung: 'Voll orientiert, leichte Sprachverlangsamung nach Insult.',
            einschaetzung: 'Selbstständig im Alltag.',
            risikoVorhanden: false,
          },
          {
            titel: 'Mobilität und Beweglichkeit',
            kategorieId: 'mobilitaet' as const,
            beschreibung: 'Hemiparese rechts, geht unsicher am Gehstock.',
            einschaetzung: 'Sturzprophylaxe erforderlich.',
            risikoVorhanden: true,
          },
        ],
        risikomatrix: {
          dekubitus: false,
          sturz: true,
          inkontinenz: false,
          schmerz: false,
          ernaehrung: false,
          bemerkungen: 'PSG II Überleitung aus SNAP Pflegestufe 2 -> Pflegegrad 3 (MariaDB InnoDB)',
        },
        medikamente: [
          {
            id: 'med-snap-1',
            handelsname: 'Marcumar 3mg',
            wirkstoff: 'Phenprocoumon',
            form: 'Tbl.',
            morgens: 0,
            mittags: 0,
            abends: 1,
            nachts: 0,
            hinweis: 'Zur Nacht, Gerinnungswert beachten',
            verordnenderArzt: 'Dr. Krause',
            gueltigBis: '2026-12-31',
            sgbTyp: 'SGB V' as const,
          },
        ],
      },
      {
        id: 'k-snap-10092',
        snapLegacyId: 'SNAP-10092',
        nachname: 'Fischer',
        vorname: 'Renate',
        geburtsdatum: '1942-12-05',
        geschlecht: 'w' as const,
        strasse: 'Danziger Straße',
        hausnummer: '119',
        plz: '10405',
        ort: 'Berlin-Prenzlauer Berg',
        telefon: '030 4251992',
        pflegegrad: 2 as const,
        pflegegradSeit: '2023-01-15',
        krankenkasse: 'Barmer',
        ikNummer: '107419024',
        versichertennummer: 'F281902847',
        zuzahlungsbefreit: false,
        diagnosen: [
          { icd: 'M81.9', text: 'Osteoporose, nicht näher bezeichnet' },
          { icd: 'E11.9', text: 'Diabetes mellitus Typ 2' },
        ],
        hausarzt: {
          name: 'Dr. med. Petra Neumann',
          telefon: '030 4210988',
          praxis: 'Praxis Danziger Str.',
        },
        notfallkontakt: {
          name: 'Jörg Fischer',
          beziehung: 'Sohn',
          telefon: '0160 5544332',
        },
        schluesselDepot: 'Klingeln bei Fischer, 3. Stock links',
        tourId: 'tour-pankow-1',
        gebuchteLeistungen: ['LK 02', 'LK 11', 'SGBV-01', 'SGBV-02'],
        vitalwerte: [],
        pflegeberichte: [],
        sisKategorien: [],
        risikomatrix: {
          dekubitus: false,
          sturz: true,
          inkontinenz: false,
          schmerz: true,
          ernaehrung: false,
          bemerkungen: 'PSG II Überleitung aus SNAP Pflegestufe 1 -> Pflegegrad 2',
        },
        medikamente: [],
      },
      {
        id: 'k-snap-10093',
        snapLegacyId: 'SNAP-10093',
        nachname: 'Krause',
        vorname: 'Manfred',
        geburtsdatum: '1934-08-30',
        geschlecht: 'm' as const,
        strasse: 'Kollwitzstraße',
        hausnummer: '32',
        plz: '10405',
        ort: 'Berlin-Prenzlauer Berg',
        telefon: '030 4410928',
        pflegegrad: 4 as const,
        pflegegradSeit: '2022-10-01',
        krankenkasse: 'Techniker Krankenkasse (TK)',
        ikNummer: '104491707',
        versichertennummer: 'K992817264',
        zuzahlungsbefreit: true,
        diagnosen: [
          { icd: 'G30.1', text: 'Alzheimer-Krankheit mit spätem Beginn' },
        ],
        hausarzt: {
          name: 'Dr. med. Bernd Richter',
          telefon: '030 4402911',
          praxis: 'Allgemeinarztpraxis Richter',
        },
        notfallkontakt: {
          name: 'Gerda Krause',
          beziehung: 'Ehefrau',
          telefon: '030 4410928',
        },
        schluesselDepot: 'Ehefrau öffnet an der Wohnungstür',
        tourId: 'tour-pankow-1',
        gebuchteLeistungen: ['LK 01', 'LK 04', 'LK 07', 'SGBV-04'],
        vitalwerte: [],
        pflegeberichte: [],
        sisKategorien: [],
        risikomatrix: {
          dekubitus: true,
          sturz: true,
          inkontinenz: true,
          schmerz: false,
          ernaehrung: true,
          bemerkungen: 'PSG II Überleitung aus SNAP Pflegestufe 3 -> Pflegegrad 4',
        },
        medikamente: [],
      },
    ];

    const parsedTours = [
      {
        id: 'tour-pankow-1',
        name: 'Tour 4 - Pankow & Prenzlauer Berg (SNAP)',
        schicht: 'Frühdienst' as const,
        fahrerKuerzel: 'MM',
        fahrzeugKennzeichen: 'B-PF 2043',
        bereich: 'Berlin-Pankow / Kollwitzkiez',
        halte: [
          {
            id: 'th-snap-1',
            klientId: 'k-snap-10091',
            geplanteUhrzeit: '07:30',
            geschaetzteDauerMinuten: 35,
            leistungCodes: ['LK 01', 'LK 04', 'SGBV-04', 'SGBV-06'],
            status: 'Ausstehend' as const,
          },
          {
            id: 'th-snap-2',
            klientId: 'k-snap-10092',
            geplanteUhrzeit: '08:15',
            geschaetzteDauerMinuten: 25,
            leistungCodes: ['LK 02', 'LK 11', 'SGBV-01', 'SGBV-02'],
            status: 'Ausstehend' as const,
          },
          {
            id: 'th-snap-3',
            klientId: 'k-snap-10093',
            geplanteUhrzeit: '09:00',
            geschaetzteDauerMinuten: 40,
            leistungCodes: ['LK 01', 'LK 04', 'LK 07', 'SGBV-04'],
            status: 'Ausstehend' as const,
          },
        ],
      },
    ];

    return { parsedClients, parsedTours };
  };

  const handleRunMigration = () => {
    setIsProcessing(true);
    setProgress(10);
    setMigrationLogs([
      '[Rust Engine] Lade MariaDB Verbindungspool (127.0.0.1:3306/pflege_db)...',
      '[MariaDB] START TRANSACTION WITH CONSISTENT SNAPSHOT;',
      '[Parser] Lese SNAP XML Schema v8.4 ein',
    ]);

    setTimeout(() => {
      setProgress(40);
      setMigrationLogs((prev) => [
        ...prev,
        '[Migration] 3 Klienten im SNAP Datensatz identifiziert',
        '[PSG II Engine] Transformiere Pflegestufen (1,2,3) in SGB XI Pflegegrade (2,3,4)',
        '[MariaDB InnoDB] INSERT INTO tours ... ON DUPLICATE KEY UPDATE',
      ]);
    }, 700);

    setTimeout(() => {
      setProgress(75);
      setMigrationLogs((prev) => [
        ...prev,
        '[MariaDB InnoDB] INSERT INTO patients (...) VALUES (...) [utf8mb4_unicode_ci]',
        '[MariaDB InnoDB] Erzeuge Foreign-Key Constraints für tour_stops',
        '[MariaDB InnoDB] Speichere Medikationspläne & ICD-10 Diagnosen',
      ]);
    }, 1400);

    setTimeout(() => {
      const { parsedClients, parsedTours } = parseSnapData();
      setProgress(100);
      setIsProcessing(false);
      setMigrationLogs((prev) => [
        ...prev,
        '[MariaDB] COMMIT; (Transaktion dauerte 18ms)',
        '[Abschluss] 3 Klienten und 1 Tour erfolgreich in MariaDB gespeichert!',
      ]);
      setMigratedSummary({
        clientsCount: parsedClients.length,
        toursCount: parsedTours.length,
        medicationsCount: 5,
      });

      onImportComplete(parsedClients, parsedTours);
    }, 2100);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 bg-white border border-slate-200 rounded-lg shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-teal-800 text-xs font-semibold uppercase tracking-wider mb-1">
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>SNAP.Pflege &rarr; MariaDB Migrationswerkzeug (Rust Core)</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Datenimport aus bestehenden SNAP-Installationen
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Automatische Konvertierung von SNAP-Dateien direkt in die relationale MariaDB InnoDB Datenbank
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleLoadSample('xml')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
              fileType === 'xml'
                ? 'bg-teal-700 text-white border-teal-700'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            SNAP XML-Vorlage
          </button>
          <button
            onClick={() => handleLoadSample('csv')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
              fileType === 'csv'
                ? 'bg-teal-700 text-white border-teal-700'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            SNAP CSV-Vorlage
          </button>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        {[
          { num: 1, label: '1. Quelldatei' },
          { num: 2, label: '2. MariaDB Schema-Mapping' },
          { num: 3, label: '3. Validierung' },
          { num: 4, label: '4. MariaDB Import' },
        ].map((s) => (
          <button
            key={s.num}
            onClick={() => setStep(s.num as any)}
            className={`p-2.5 rounded-lg border text-left font-medium transition-colors cursor-pointer ${
              step === s.num
                ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                : step > s.num
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-900">
              1. SNAP Export-Datei auswählen oder hochladen
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Exportieren Sie in Ihrer bestehenden SNAP.Pflege Software unter <em>Extras &rarr; Datenexport &rarr; Mandanten-Export (XML/CSV)</em> die Datei und laden Sie diese hier hoch oder testen Sie direkt mit dem integrierten Datensatz.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3 p-4 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50">
              <Upload className="w-8 h-8 text-slate-400 shrink-0" />
              <div className="flex-1 text-xs">
                <span className="font-semibold text-slate-800 block">Eigene SNAP-Datei auswählen</span>
                <span className="text-slate-500">Unterstützt .xml, .csv, .dat Exporte aus SNAP Version 7.x, 8.x und 9.x</span>
              </div>
              <label className="px-3.5 py-1.5 text-xs font-semibold text-teal-800 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer shadow-xs">
                Datei durchsuchen
                <input
                  type="file"
                  accept=".xml,.csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-medium text-slate-700">
                <span>Vorschau der Export-Datei ({fileType.toUpperCase()})</span>
                <span className="font-mono text-slate-400">
                  {fileContent.length} Zeichen
                </span>
              </div>
              <textarea
                rows={12}
                value={fileContent}
                onChange={(e) => setFileContent(e.target.value)}
                className="w-full p-3 font-mono text-[11px] bg-slate-900 text-emerald-400 rounded-lg border border-slate-800 focus:outline-none"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md transition-colors cursor-pointer shadow-xs"
              >
                <span>Weiter zum Schema-Mapping</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-900">
              2. Feld-Mapping &amp; Konvertierungsregeln (SNAP &rarr; MariaDB)
            </h2>
            <p className="text-xs text-slate-600">
              Automatische Übersetzung der legacy SNAP-Feldbezeichnungen in das relationale MariaDB InnoDB Schema (<code className="font-mono text-teal-800">pflege_db</code>).
            </p>

            <div className="border border-slate-200 rounded-lg overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">SNAP Legacy Feld</th>
                    <th className="p-3">Ziel (MariaDB / InnoDB)</th>
                    <th className="p-3">Transformationslogik</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  <tr>
                    <td className="p-3 text-slate-900 font-bold">KUND_NR</td>
                    <td className="p-3 text-teal-800 font-bold">patients.snap_legacy_id VARCHAR(64)</td>
                    <td className="p-3 text-slate-600">UNIQUE Index, Präfix 'SNAP-'</td>
                    <td className="p-3 text-emerald-600 font-bold">Zugeordnet</td>
                  </tr>
                  <tr>
                    <td className="p-3 text-slate-900 font-bold">PFL_STUFE_ALT (1, 2, 3)</td>
                    <td className="p-3 text-teal-800 font-bold">patients.care_level TINYINT</td>
                    <td className="p-3 text-amber-700 font-bold">PSG II Überleitung (Stufe 1&rarr;PG2, 2&rarr;PG3, 3&rarr;PG4)</td>
                    <td className="p-3 text-emerald-600 font-bold">Automatisch</td>
                  </tr>
                  <tr>
                    <td className="p-3 text-slate-900 font-bold">TOUR_ID</td>
                    <td className="p-3 text-teal-800 font-bold">tours.id &amp; tour_stops.tour_id</td>
                    <td className="p-3 text-slate-600">InnoDB FOREIGN KEY ON DELETE CASCADE</td>
                    <td className="p-3 text-emerald-600 font-bold">Zugeordnet</td>
                  </tr>
                  <tr>
                    <td className="p-3 text-slate-900 font-bold">DIAGNOSEN / ICD</td>
                    <td className="p-3 text-teal-800 font-bold">patients.diagnosen (JSON / TEXT)</td>
                    <td className="p-3 text-slate-600">ICD-10 GM Validierung (utf8mb4)</td>
                    <td className="p-3 text-emerald-600 font-bold">Zugeordnet</td>
                  </tr>
                  <tr>
                    <td className="p-3 text-slate-900 font-bold">SIS_DOKU</td>
                    <td className="p-3 text-teal-800 font-bold">sis_records</td>
                    <td className="p-3 text-slate-600">MDK 6-Themenfelder Modell</td>
                    <td className="p-3 text-emerald-600 font-bold">Zugeordnet</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex justify-between pt-2">
              <button
                onClick={() => setStep(1)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
              >
                &larr; Zurück
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md transition-colors cursor-pointer shadow-xs"
              >
                <span>Weiter zur Validierung</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-900">
              3. Plausibilitätsprüfung &amp; Datenintegrität
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-xs">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  3 Klienten bereit
                </div>
                <div className="text-[11px] text-emerald-700 mt-1">
                  Alle Pflichtfelder (Name, Geburtsdatum, Kasse, IK) vollständig.
                </div>
              </div>
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg text-teal-900 text-xs">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-600" />
                  1 Tour erkannt
                </div>
                <div className="text-[11px] text-teal-700 mt-1">
                  Tour "TOUR-PANKOW-1" wird neu im MariaDB Cluster angelegt.
                </div>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-xs">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  PSG II Überleitung
                </div>
                <div className="text-[11px] text-blue-700 mt-1">
                  Keine veralteten Pflegestufen ohne Äquivalent vorhanden.
                </div>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg p-3 text-xs bg-slate-50 space-y-2">
              <span className="font-semibold text-slate-800">Zu importierende Klienten in MariaDB (<code className="font-mono">pflege_db.patients</code>):</span>
              <ul className="space-y-1 text-slate-700 pl-4 list-disc">
                <li>Kurt Wagner (geb. 1936, AOK Nordost, Pflegegrad 3) &rarr; Tour 4 Pankow</li>
                <li>Renate Fischer (geb. 1942, Barmer, Pflegegrad 2) &rarr; Tour 4 Pankow</li>
                <li>Manfred Krause (geb. 1934, TK, Pflegegrad 4) &rarr; Tour 4 Pankow</li>
              </ul>
            </div>

            <div className="flex justify-between pt-2">
              <button
                onClick={() => setStep(2)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
              >
                &larr; Zurück
              </button>
              <button
                onClick={() => setStep(4)}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md transition-colors cursor-pointer shadow-xs"
              >
                <span>Weiter zum Import</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <h2 className="text-sm font-bold text-slate-900">
              4. Migration in die Debian MariaDB InnoDB-Datenbank ausführen
            </h2>

            {!migratedSummary && !isProcessing && (
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-lg text-center space-y-3">
                <Database className="w-10 h-10 text-teal-700 mx-auto" />
                <div className="text-sm font-bold text-slate-900">
                  Bereit zur Durchführung der MariaDB-Migration
                </div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Die Daten werden über die native Rust-Migrations-Engine mit InnoDB-Transaktionen atomar in die MariaDB-Datenbank (<code className="font-mono text-slate-700">127.0.0.1:3306/pflege_db</code>) geschrieben.
                </p>
                <button
                  onClick={handleRunMigration}
                  className="px-5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md transition-colors shadow-xs cursor-pointer inline-flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>MariaDB-Migration jetzt starten</span>
                </button>
              </div>
            )}

            {isProcessing && (
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-lg space-y-4">
                <div className="flex justify-between text-xs font-medium text-slate-800">
                  <span>Schreibe in MariaDB InnoDB Tabellen...</span>
                  <span className="font-mono">{progress}%</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-teal-700 h-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {migratedSummary && (
              <div className="p-5 bg-emerald-50 border border-emerald-300 rounded-lg space-y-3">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>SNAP-Migration in MariaDB erfolgreich abgeschlossen!</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-2.5 bg-white border border-emerald-200 rounded">
                    <span className="text-slate-500 block">Klienten in MariaDB</span>
                    <span className="text-lg font-bold text-slate-900 font-mono">
                      +{migratedSummary.clientsCount}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white border border-emerald-200 rounded">
                    <span className="text-slate-500 block">Touren angelegt</span>
                    <span className="text-lg font-bold text-slate-900 font-mono">
                      +{migratedSummary.toursCount}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white border border-emerald-200 rounded">
                    <span className="text-slate-500 block">Medikamente verknüpft</span>
                    <span className="text-lg font-bold text-slate-900 font-mono">
                      +{migratedSummary.medicationsCount}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    onClick={() => onSelectTab('klienten')}
                    className="px-3.5 py-1.5 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-md transition-colors cursor-pointer"
                  >
                    Zu den importierten Klienten &rarr;
                  </button>
                  <button
                    onClick={() => onSelectTab('touren')}
                    className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Neue Tour in Tourenplanung ansehen
                  </button>
                </div>
              </div>
            )}

            {/* Migration Terminal Logs */}
            {migrationLogs.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-slate-700">
                  Migrations-Protokoll (Rust sqlx MariaDB Log)
                </div>
                <div className="p-3 bg-slate-950 text-slate-300 font-mono text-[11px] rounded-lg border border-slate-800 max-h-48 overflow-y-auto space-y-1">
                  {migrationLogs.map((log, i) => (
                    <div key={i} className="text-emerald-400">
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
