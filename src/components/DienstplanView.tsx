import React, { useState } from 'react';
import { CalendarCheck, User, Clock, ShieldCheck } from 'lucide-react';
import { Mitarbeiter } from '../types/pflege';

interface DienstplanViewProps {
  mitarbeiter: Mitarbeiter[];
}

const DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const INITIAL_PLAN: Record<string, string[]> = {
  'm-1': ['FD', 'FD', 'FD', 'FD', 'Büro', 'Frei', 'Frei'],
  'm-2': ['FD', 'FD', 'FD', 'Frei', 'Frei', 'FD', 'FD'],
  'm-3': ['SD', 'SD', 'SD', 'SD', 'SD', 'Frei', 'Frei'],
  'm-4': ['FD', 'FD', 'Frei', 'FD', 'FD', 'SD', 'SD'],
};

export const DienstplanView: React.FC<DienstplanViewProps> = ({ mitarbeiter }) => {
  const [plan, setPlan] = useState<Record<string, string[]>>(INITIAL_PLAN);

  const toggleShift = (mId: string, dayIdx: number) => {
    const shiftCycle = ['FD', 'SD', 'TD', 'ND', 'Büro', 'Frei'];
    setPlan((prev) => {
      const currentShifts = [...(prev[mId] || ['FD', 'FD', 'FD', 'FD', 'FD', 'Frei', 'Frei'])];
      const cur = currentShifts[dayIdx];
      const nextIdx = (shiftCycle.indexOf(cur) + 1) % shiftCycle.length;
      currentShifts[dayIdx] = shiftCycle[nextIdx];
      return { ...prev, [mId]: currentShifts };
    });
  };

  const getShiftBadge = (shift: string) => {
    switch (shift) {
      case 'FD':
        return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'SD':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'ND':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Büro':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-500 border-slate-200';
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 border border-slate-200 rounded-lg shadow-xs">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-800 uppercase tracking-wider mb-1">
            <CalendarCheck className="w-3.5 h-3.5" />
            <span>Personalmanagement &amp; Dienstplanung</span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">
            Wochendienstplan &amp; Schichtdisposition
          </h1>
          <p className="text-xs text-slate-500">
            Klicken Sie auf eine Schicht im Kalender, um zwischen Frühdienst (FD), Spätdienst (SD), Teildienst (TD) und Frei zu wechseln
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-teal-500"></span>
            <span className="text-slate-600 font-medium">FD (06:00 - 14:30)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-amber-500"></span>
            <span className="text-slate-600 font-medium">SD (14:00 - 21:30)</span>
          </div>
        </div>
      </div>

      {/* Roster Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
            <tr>
              <th className="p-3 w-64">Mitarbeiter &amp; Qualifikation</th>
              {DAYS.map((d) => (
                <th key={d} className="p-3 text-center">
                  {d}
                </th>
              ))}
              <th className="p-3 text-center">Soll / Ist</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {mitarbeiter.map((m) => {
              const shifts = plan[m.id] || ['FD', 'FD', 'FD', 'FD', 'FD', 'Frei', 'Frei'];
              const workDays = shifts.filter((s) => s !== 'Frei').length;
              const hoursWorked = workDays * 7.5;

              return (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-slate-200 text-slate-800 font-bold flex items-center justify-center font-mono text-xs">
                        {m.kuerzel}
                      </span>
                      <div>
                        <div className="font-bold text-slate-900">
                          {m.nachname}, {m.vorname}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[200px]">
                          {m.qualifikation}
                        </div>
                      </div>
                    </div>
                  </td>

                  {shifts.map((shift, dayIdx) => (
                    <td key={dayIdx} className="p-2 text-center">
                      <button
                        onClick={() => toggleShift(m.id, dayIdx)}
                        className={`w-14 py-1.5 rounded text-xs font-mono font-bold border transition-colors cursor-pointer ${getShiftBadge(
                          shift
                        )}`}
                      >
                        {shift}
                      </button>
                    </td>
                  ))}

                  <td className="p-3 text-center font-mono text-xs font-semibold">
                    <span className={hoursWorked > m.wochenstunden ? 'text-amber-700' : 'text-slate-800'}>
                      {hoursWorked}h / {m.wochenstunden}h
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
