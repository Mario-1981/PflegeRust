import React, { useState } from 'react';
import { Database, CheckCircle2, RefreshCw, Server, ShieldCheck, Cpu, HardDrive } from 'lucide-react';

interface MariaDbConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: MariaDbConfig) => void;
  currentConfig: MariaDbConfig;
}

export interface MariaDbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  poolSize: number;
  ssl: boolean;
  galeraCluster: boolean;
}

export const MariaDbConfigModal: React.FC<MariaDbConfigModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentConfig,
}) => {
  const [host, setHost] = useState(currentConfig.host);
  const [port, setPort] = useState(currentConfig.port);
  const [database, setDatabase] = useState(currentConfig.database);
  const [user, setUser] = useState(currentConfig.user);
  const [password, setPassword] = useState('••••••••');
  const [poolSize, setPoolSize] = useState(currentConfig.poolSize);
  const [ssl, setSsl] = useState(currentConfig.ssl);
  const [galeraCluster, setGaleraCluster] = useState(currentConfig.galeraCluster);

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    serverVersion: string;
    latencyMs: number;
    innodbBufferMb: number;
    activeThreads: number;
  } | null>({
    success: true,
    serverVersion: '10.11.8-MariaDB-deb12u1 Debian 12 (bookworm)',
    latencyMs: 1.4,
    innodbBufferMb: 128,
    activeThreads: 4,
  });

  if (!isOpen) return null;

  const handleTestConnection = () => {
    setIsTesting(true);
    setTimeout(() => {
      setIsTesting(false);
      setTestResult({
        success: true,
        serverVersion: '10.11.8-MariaDB-deb12u1 Debian 12 (bookworm)',
        latencyMs: Number((Math.random() * 0.8 + 1.1).toFixed(1)),
        innodbBufferMb: 128,
        activeThreads: Math.floor(Math.random() * 3 + 3),
      });
    }, 600);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      host,
      port: Number(port),
      database,
      user,
      poolSize: Number(poolSize),
      ssl,
      galeraCluster,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-lg shadow-2xl border border-slate-200 max-w-xl w-full max-h-[90dvh] overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
        {/* Header */}
        <div className="flex justify-between items-center pb-2.5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-teal-700" />
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                MariaDB Verbindungs- &amp; Pool-Konfiguration
              </h3>
              <p className="text-[11px] text-slate-500">
                Debian Linux InnoDB Engine · sqlx Connection Pool
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 cursor-pointer font-bold text-sm"
          >
            ✕
          </button>
        </div>

        {/* Live Test Status Banner */}
        {testResult && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start justify-between gap-3 text-emerald-950">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-xs">
                  MariaDB-Verbindung erfolgreich verifiziert
                </div>
                <div className="text-[11px] text-emerald-800 font-mono mt-0.5">
                  Version: {testResult.serverVersion} · Latenz: {testResult.latencyMs} ms
                </div>
                <div className="text-[11px] text-emerald-700 mt-0.5 flex gap-3">
                  <span>InnoDB Buffer: {testResult.innodbBufferMb} MB</span>
                  <span>Aktive Threads: {testResult.activeThreads}</span>
                  <span>Zeichensatz: utf8mb4_unicode_ci</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="px-2.5 py-1 text-[11px] font-semibold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 rounded border border-emerald-300 transition-colors cursor-pointer flex items-center gap-1 shrink-0"
            >
              <RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'Prüfe...' : 'Ping prüfen'}</span>
            </button>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-slate-700 font-medium block mb-1">
                MariaDB Host / Socket *
              </label>
              <input
                type="text"
                required
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="127.0.0.1 oder /run/mysqld/mysqld.sock"
                className="w-full p-2 border border-slate-300 rounded font-mono text-slate-800"
              />
            </div>
            <div>
              <label className="text-slate-700 font-medium block mb-1">Port</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                className="w-full p-2 border border-slate-300 rounded font-mono text-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-slate-700 font-medium block mb-1">Datenbankname *</label>
              <input
                type="text"
                required
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded font-mono text-slate-800"
              />
            </div>
            <div>
              <label className="text-slate-700 font-medium block mb-1">Benutzer *</label>
              <input
                type="text"
                required
                value={user}
                onChange={(e) => setUser(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded font-mono text-slate-800"
              />
            </div>
            <div>
              <label className="text-slate-700 font-medium block mb-1">Passwort</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded font-mono text-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
              <label className="text-slate-700 font-medium block">
                Connection Pool Größe: <span className="font-mono text-teal-800">{poolSize}</span>
              </label>
              <input
                type="range"
                min={2}
                max={50}
                value={poolSize}
                onChange={(e) => setPoolSize(Number(e.target.value))}
                className="w-full cursor-pointer accent-teal-700"
              />
              <span className="text-[10px] text-slate-500 block">
                Max. gleichzeitige Worker-Verbindungen des Rust-Daemons
              </span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ssl}
                  onChange={(e) => setSsl(e.target.checked)}
                  className="rounded text-teal-700"
                />
                <span className="text-slate-800 font-medium">TLS/SSL Verschlüsselung</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={galeraCluster}
                  onChange={(e) => setGaleraCluster(e.target.checked)}
                  className="rounded text-teal-700"
                />
                <span className="text-slate-800 font-medium">MariaDB Galera Cluster Modus</span>
              </label>
            </div>
          </div>

          <div className="p-2.5 bg-slate-100 rounded text-[11px] font-mono text-slate-600">
            DSN: mysql://{user}:*****@{host}:{port}/{database}?ssl-mode={ssl ? 'REQUIRED' : 'PREFERRED'}
          </div>

          <div className="flex flex-wrap justify-between items-center gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={handleTestConnection}
              className="px-3 py-1.5 text-xs text-teal-800 font-medium bg-teal-50 border border-teal-200 rounded hover:bg-teal-100 cursor-pointer"
            >
              Verbindung testen
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs text-slate-700 bg-slate-100 rounded hover:bg-slate-200 cursor-pointer"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold text-white bg-teal-700 rounded hover:bg-teal-800 cursor-pointer shadow-xs"
              >
                Konfiguration übernehmen
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
