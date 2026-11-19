import React, { useState } from 'react';
import { ReceiptText, Building2, Download, CheckCircle, FileCode } from 'lucide-react';
import { Klient } from '../types/pflege';
import { STANDARD_LEISTUNGEN } from '../data/mockData';

interface AbrechnungViewProps {
  klienten: Klient[];
}

export const AbrechnungView: React.FC<AbrechnungViewProps> = ({ klienten }) => {
  const [selectedMonth, setSelectedMonth] = useState('2026-10');
  const [exportSuccess, setExportSuccess] = useState(false);

  // Group by health insurance
  const kassenMap: Record<string, { count: number; sgbXI: number; sgbV: number }> = {};

  klienten.forEach((k) => {
    const kasse = k.krankenkasse;
    if (!kassenMap[kasse]) {
      kassenMap[kasse] = { count: 0, sgbXI: 0, sgbV: 0 };
    }
    kassenMap[kasse].count += 1;
    // Estimate monthly values based on Pflegegrad
    const sgbXIVal = k.pflegegrad === 1 ? 125 : k.pflegegrad === 2 ? 761 : k.pflegegrad === 3 ? 1432 : k.pflegegrad === 4 ? 1778 : 2200;
    const sgbVVal = k.gebuchteLeistungen.filter((l) => l.startsWith('SGBV')).length * 180;
    kassenMap[kasse].sgbXI += sgbXIVal;
    kassenMap[kasse].sgbV += sgbVVal;
  });

  const totalSgbXI = Object.values(kassenMap).reduce((sum, v) => sum + v.sgbXI, 0);
  const totalSgbV = Object.values(kassenMap).reduce((sum, v) => sum + v.sgbV, 0);
  const totalSum = totalSgbXI + totalSgbV;

  const handleExportDta = () => {
    setExportSuccess(true);
    setTimeout(() => setExportSuccess(false), 3000);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 border border-slate-200 rounded-lg shadow-xs">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-800 uppercase tracking-wider mb-1">
            <ReceiptText className="w-3.5 h-3.5" />
            <span>Kostenträger-Abrechnung</span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">
            Leistungsabrechnung nach SGB XI (§ 105) und SGB V (§ 302)
          </h1>
          <p className="text-xs text-slate-500">
            DTA-konforme Datenfernübertragung nach Richtlinien der GKV-Spitzenverbände
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="p-2 bg-slate-50 border border-slate-300 rounded-md text-xs font-mono font-medium text-slate-800"
          >
            <option value="2026-10">Oktober 2026</option>
            <option value="2026-11">November 2026 (Laufend)</option>
          </select>
          <button
            onClick={handleExportDta}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md transition-colors shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>DTA-Export erstellen</span>
          </button>
        </div>
      </div>

      {exportSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>DTA-Datei für {selectedMonth} erfolgreich generiert und signiert (EDIFACT/XML).</span>
        </div>
      )}

      {/* Financial Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <span className="text-slate-500 text-xs font-medium block">
            Gesamtvolumen SGB XI (Pflegekassen)
          </span>
          <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {totalSgbXI.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
          </span>
          <span className="text-[11px] text-slate-500 block mt-1">
            Sachleistungsanspruch nach § 36 SGB XI
          </span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <span className="text-slate-500 text-xs font-medium block">
            Gesamtvolumen SGB V (Krankenkassen HKP)
          </span>
          <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {totalSgbV.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
          </span>
          <span className="text-[11px] text-slate-500 block mt-1">
            Behandlungspflege nach § 37 SGB V
          </span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <span className="text-slate-500 text-xs font-medium block">
            Abrechnungssumme Netto
          </span>
          <span className="text-2xl font-bold text-teal-800 font-mono tabular-nums">
            {totalSum.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
          </span>
          <span className="text-[11px] text-teal-700 block mt-1 font-medium">
            {klienten.length} Klienten abgerechnet
          </span>
        </div>
      </div>

      {/* Kostenträger Breakdown */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-800">
          Aufschlüsselung nach Krankenkassen &amp; Kostenträgern
        </div>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
            <tr>
              <th className="p-3">Kostenträger</th>
              <th className="p-3 text-center">Klienten</th>
              <th className="p-3 text-right">SGB XI Sachleistung</th>
              <th className="p-3 text-right">SGB V Behandlungspflege</th>
              <th className="p-3 text-right">Gesamtbetrag</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
            {Object.entries(kassenMap).map(([kasse, data]) => {
              const kasseSum = data.sgbXI + data.sgbV;
              return (
                <tr key={kasse} className="hover:bg-slate-50">
                  <td className="p-3 font-sans font-bold text-slate-900">
                    {kasse}
                  </td>
                  <td className="p-3 text-center text-slate-700">
                    {data.count}
                  </td>
                  <td className="p-3 text-right text-slate-800 tabular-nums">
                    {data.sgbXI.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </td>
                  <td className="p-3 text-right text-slate-800 tabular-nums">
                    {data.sgbV.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </td>
                  <td className="p-3 text-right font-bold text-teal-800 tabular-nums">
                    {kasseSum.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* Leistungskomplexe Katalog */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-800">
          Gültiger Leistungskomplex-Katalog (Berlin / Rahmenvertrag § 89 SGB XI)
        </div>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-left text-xs">
          <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
            <tr>
              <th className="p-2.5 font-mono">Code</th>
              <th className="p-2.5">Leistungsbeschreibung</th>
              <th className="p-2.5 font-mono text-center">Typ</th>
              <th className="p-2.5 font-mono text-center">Punkte</th>
              <th className="p-2.5 font-mono text-center">Richtzeit</th>
              <th className="p-2.5 font-mono text-right">Vergütung</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-[11px]">
            {STANDARD_LEISTUNGEN.map((lk) => (
              <tr key={lk.code} className="hover:bg-slate-50 font-mono">
                <td className="p-2.5 font-bold text-slate-900">{lk.code}</td>
                <td className="p-2.5 font-sans text-slate-800">{lk.bezeichnung}</td>
                <td className="p-2.5 text-center text-slate-600">{lk.typ}</td>
                <td className="p-2.5 text-center text-slate-700">{lk.punkte || '-'}</td>
                <td className="p-2.5 text-center text-slate-700">{lk.dauerMinuten} min</td>
                <td className="p-2.5 text-right font-bold text-slate-900">
                  {lk.standardPreis.toFixed(2)} €
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
};
