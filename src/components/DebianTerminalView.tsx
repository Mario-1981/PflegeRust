import React, { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, CornerDownLeft, Database } from 'lucide-react';

interface DebianTerminalViewProps {
  klientenCount: number;
}

export const DebianTerminalView: React.FC<DebianTerminalViewProps> = ({ klientenCount }) => {
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<Array<{ cmd: string; output: string }>>([
    {
      cmd: 'uname -a',
      output: 'Linux debian-srv 6.1.0-21-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.90-1 x86_64 GNU/Linux',
    },
    {
      cmd: 'systemctl status mariadb.service',
      output: `● mariadb.service - MariaDB 10.11.8 database server
     Loaded: loaded (/lib/systemd/system/mariadb.service; enabled; preset: enabled)
     Active: active (running) since Mon 2026-11-02 04:20:10 CET; 1h 55min ago
   Main PID: 1120 (mariadbd)
     Status: "Taking your SQL requests now..."
      Tasks: 32 (limit: 4915)
     Memory: 112.4M
     CGroup: /system.slice/mariadb.service
             └─1120 /usr/sbin/mariadbd`,
    },
    {
      cmd: 'systemctl status pfleged.service',
      output: `● pfleged.service - PflegeRust - Pflegemanagement Daemon & SNAP Integration (MariaDB)
     Loaded: loaded (/lib/systemd/system/pfleged.service; enabled; preset: enabled)
     Active: active (running) since Mon 2026-11-02 04:30:12 CET; 1h 45min ago
   Main PID: 1842 (pfleged)
      Tasks: 8 (limit: 2048)
     Memory: 28.4M (limit: 1G)
     CGroup: /system.slice/pfleged.service
             └─1842 /usr/bin/pfleged daemon --bind 127.0.0.1 --port 8080`,
    },
  ]);

  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const executeCommand = (cmdText: string) => {
    const trimmed = cmdText.trim();
    if (!trimmed) return;

    let output = '';
    const parts = trimmed.split(' ');
    const mainCmd = parts[0];

    switch (mainCmd) {
      case 'clear':
        setHistory([]);
        setCommand('');
        return;
      case 'help':
        output = `Verfügbare Debian & MariaDB Befehle:
  pfleged status                                - Status des Rust-Daemons & MariaDB Pool
  pfleged users list                            - Alle Benutzer und RBAC-Rollen anzeigen
  pfleged sso test                              - OIDC Discovery & SSO-Verbindung testen
  mariadb -u pfleged -p pflege_db -e "..."     - SQL-Befehle direkt an MariaDB senden
  systemctl status mariadb                      - Status des MariaDB-Datenbankdienstes
  systemctl status pfleged                      - Status des Rust-Daemons
  mysqlcheck pflege_db                          - Tabellenintegrität der InnoDB-Tabellen prüfen
  free -m                                       - Arbeitsspeicher prüfen
  snap-migrate --source <file>                  - SNAP-Migration in MariaDB starten
  uname -a                                      - Kernel- und Debian-Informationen
  clear                                         - Terminal leeren`;
        break;
      case 'pfleged':
        if (parts.includes('users')) {
          output = `+----+----------------+-------------------------+----------------------+----------------+--------+
| ID | BENUTZERNAME   | NAME                    | ROLLE                | AUTH-METHODE   | STATUS |
+----+----------------+-------------------------+----------------------+----------------+--------+
|  1 | m.mustermann   | Maria Mustermann        | PDL                  | Keycloak OIDC  | AKTIV  |
|  2 | admin.pflege   | Jens Sommer             | Admin                | Lokal          | AKTIV  |
|  3 | t.becker       | Tobias Becker           | Pflegefachkraft      | Keycloak OIDC  | AKTIV  |
|  4 | s.kowalski     | Sabine Kowalski         | Pflegefachkraft      | Entra ID SSO   | AKTIV  |
|  5 | a.lehmann      | Alexander Lehmann       | Pflegehelfer         | Lokal          | AKTIV  |
|  6 | k.abrechnung   | Karin Vogel             | Verwaltung_Abrechn.  | Keycloak OIDC  | AKTIV  |
+----+----------------+-------------------------+----------------------+----------------+--------+
6 Benutzer in MariaDB users registriert (4 via SSO federiert).`;
        } else if (parts.includes('sso')) {
          output = `[pfleged SSO] Prüfe OIDC Discovery für https://sso.pflegedienst-berlin.de/realms/pflegedienst...
[pfleged SSO] HTTP 200 OK (14 ms)
  - Issuer: https://sso.pflegedienst-berlin.de/realms/pflegedienst
  - Authorization Endpoint: .../protocol/openid-connect/auth
  - Token Endpoint: .../protocol/openid-connect/token
  - UserInfo Endpoint: .../protocol/openid-connect/userinfo
  - JWKS Keyset: 3 RSA Keys geladen (RS256)
  - Auto-Provisioning: Aktiviert
  - Rollenmapping: 5 Gruppenregeln aktiv (Keycloak Realm Roles -> PflegeRust RBAC)
[pfleged SSO] Status: BEREIT & SICHER (TLS 1.3)`;
        } else if (parts.includes('status')) {
          output = `[pfleged] Systemstatus (Debian Bookworm):
  - Datenbank: MariaDB 10.11.8-MariaDB-deb12u1 (InnoDB)
  - Verbindungs-DSN: mysql://pfleged:geheim@127.0.0.1:3306/pflege_db
  - sqlx Connection Pool: 10 aktive Verbindungen (Idle Timeout: 600s)
  - Aktive Klienten: ${klientenCount}
  - Authentifizierung: OpenID Connect SSO (Keycloak) & Lokales Fallback
  - Status: Gesund (REST API lauscht auf 127.0.0.1:8080)`;
        } else if (parts.includes('--version') || parts.includes('-V')) {
          output = 'pfleged 1.5.0 (compiled with rustc 1.78.0, sqlx-mysql 0.7, openidconnect 3.4 on debian-12-x86_64)';
        } else {
          output = `pfleged 1.5.0
Pflegemanagement wie SNAP, in Rust mit MariaDB & SSO für Debian Linux

USAGE:
    pfleged [OPTIONS] [SUBCOMMAND]

OPTIONS:
    --database-url <DSN>    MariaDB Verbindungs-URL [default: mysql://pfleged:geheim@127.0.0.1:3306/pflege_db]

SUBCOMMANDS:
    daemon         Startet den Hintergrunddienst mit MariaDB Pool & OIDC Provider
    users          Benutzerverwaltung (list, create, disable)
    sso            Single Sign-On Diagnose (test, discover)
    migrate-snap   Importiert SNAP.Pflege Exporte direkt in MariaDB InnoDB
    status         Prüft MariaDB Verbindung, Latenz und Touren`;
        }
        break;
      case 'mariadb':
      case 'mysql':
        if (trimmed.includes('SHOW TABLES') || trimmed.includes('show tables')) {
          output = `+---------------------+
| Tables_in_pflege_db |
+---------------------+
| medications         |
| patients            |
| tour_stops          |
| tours               |
| vital_signs         |
+---------------------+
5 rows in set (0.001 sec)`;
        } else if (trimmed.includes('COUNT') || trimmed.includes('count')) {
          output = `+----------+
| COUNT(*) |
+----------+
|       ${klientenCount} |
+----------+
1 row in set (0.001 sec)`;
        } else {
          output = `MariaDB [pflege_db]> SELECT VERSION();
+------------------------------------+
| VERSION()                          |
+------------------------------------+
| 10.11.8-MariaDB-deb12u1            |
+------------------------------------+
1 row in set (0.000 sec)`;
        }
        break;
      case 'mysqlcheck':
        output = `pflege_db.medications                              OK
pflege_db.patients                                 OK
pflege_db.tour_stops                               OK
pflege_db.tours                                    OK
pflege_db.vital_signs                              OK`;
        break;
      case 'snap-migrate':
        output = `[snap-migrate] Verbinde mit MariaDB DSN mysql://pfleged:***@127.0.0.1:3306/pflege_db...
[snap-migrate] START TRANSACTION WITH CONSISTENT SNAPSHOT;
[snap-migrate] 3 Patienten und 1 Tour erkannt.
[snap-migrate] PSG II Überleitung: Pflegestufen (1,2,3) erfolgreich in Pflegegrade (1-5) transformiert.
[snap-migrate] INSERT INTO patients (...) ON DUPLICATE KEY UPDATE...
[snap-migrate] COMMIT;
[snap-migrate] 3 Klienten erfolgreich in MariaDB InnoDB importiert.`;
        break;
      case 'systemctl':
        if (trimmed.includes('mariadb')) {
          output = `● mariadb.service - MariaDB 10.11.8 database server
   Loaded: loaded (/lib/systemd/system/mariadb.service; enabled; preset: enabled)
   Active: active (running)`;
        } else {
          output = `● pfleged.service - PflegeRust - Pflegemanagement Daemon & SNAP Integration (MariaDB)
   Loaded: loaded (/lib/systemd/system/pfleged.service; enabled; preset: enabled)
   Active: active (running)
   Memory: 28.4M`;
        }
        break;
      case 'free':
        output = `               total        used        free      shared  buff/cache   available
Mem:            7912        1340        5710          22         860        6310
Swap:           2048           0        2048
* pfleged (Rust + sqlx MariaDB Pool) verbraucht nur 28.4 MB RAM!`;
        break;
      default:
        output = `bash: ${mainCmd}: Befehl nicht gefunden. Geben Sie 'help' ein.`;
    }

    setHistory((prev) => [...prev, { cmd: trimmed, output }]);
    setCommand('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      executeCommand(command);
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-800 uppercase tracking-wider mb-1">
            <TerminalIcon className="w-3.5 h-3.5" />
            <span>Debian Linux &amp; MariaDB Shell</span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">
            Interaktive Konsole: pfleged, MariaDB &amp; CLI
          </h1>
          <p className="text-xs text-slate-500">
            Führen Sie MariaDB-Abfragen, Rust-Daemons und systemd-Befehle direkt auf dem Debian Server aus
          </p>
        </div>

        {/* Quick Click Commands */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            'pfleged status',
            'mariadb -u pfleged -p pflege_db -e "SHOW TABLES;"',
            'mysqlcheck pflege_db',
            'systemctl status mariadb',
            'help',
          ].map((quickCmd) => (
            <button
              key={quickCmd}
              onClick={() => executeCommand(quickCmd)}
              className="px-2.5 py-1 text-xs font-mono font-medium text-slate-700 bg-slate-100 hover:bg-teal-700 hover:text-white rounded border border-slate-200 transition-colors cursor-pointer"
            >
              {quickCmd.length > 28 ? quickCmd.slice(0, 26) + '...' : quickCmd}
            </button>
          ))}
        </div>
      </div>

      {/* Terminal Window */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden flex flex-col h-[600px] shadow-lg font-mono text-xs">
        {/* Window Chrome */}
        <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-rose-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
            <span className="text-slate-400 text-[11px] ml-2">
              root@debian-srv: ~ (bash 5.2) · MariaDB 10.11 connected
            </span>
          </div>
          <span className="text-[11px] text-teal-400">
            pfleged.service active (sqlx-pool)
          </span>
        </div>

        {/* Output area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 text-slate-300">
          <div className="text-slate-500 text-[11px]">
            PflegeRust Linux Environment (Debian GNU/Linux 12 bookworm x86_64)
            <br />
            Datenbank: <span className="text-teal-400 font-bold">MariaDB 10.11.8 (InnoDB, utf8mb4)</span>
            <br />
            Geben Sie <span className="text-teal-400 font-bold">help</span> ein für eine Liste von Befehlen.
          </div>

          {history.map((item, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center gap-2 text-teal-400 font-bold">
                <span className="text-slate-500">root@debian-srv:~#</span>
                <span>{item.cmd}</span>
              </div>
              <pre className="text-slate-300 whitespace-pre-wrap font-mono text-[11px] pl-4 leading-relaxed">
                {item.output}
              </pre>
            </div>
          ))}
          <div ref={terminalEndRef} />
        </div>

        {/* Input prompt */}
        <div className="p-3 bg-slate-900/90 border-t border-slate-800 flex items-center gap-2">
          <span className="text-teal-400 font-bold">root@debian-srv:~#</span>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="z.B. pfleged status oder mariadb -u pfleged -p pflege_db -e 'SHOW TABLES;'..."
            className="flex-1 bg-transparent text-emerald-300 font-mono text-xs focus:outline-none"
            autoFocus
          />
          <button
            onClick={() => executeCommand(command)}
            className="px-2 py-1 text-[11px] font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors cursor-pointer flex items-center gap-1"
          >
            <CornerDownLeft className="w-3 h-3" />
            <span>Enter</span>
          </button>
        </div>
      </div>
    </div>
  );
};
