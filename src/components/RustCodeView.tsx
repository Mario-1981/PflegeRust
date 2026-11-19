import React, { useState } from 'react';
import {
  Code2,
  Download,
  Copy,
  Check,
  FolderTree,
  Terminal,
  Cpu,
  Layers,
  FileText,
  Database,
} from 'lucide-react';
import { RUST_CODEBASE, RustFile } from '../data/rustCodebase';
import { downloadRustDebianZip } from '../utils/zipExport';

export const RustCodeView: React.FC = () => {
  const [selectedPath, setSelectedPath] = useState<string>('src/db.rs');
  const [copied, setCopied] = useState(false);

  const selectedFile = RUST_CODEBASE.find((f) => f.path === selectedPath) || RUST_CODEBASE[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const categories = ['Database Schema', 'Rust Core', 'Migration', 'Debian Package', 'Config'] as const;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-teal-800 text-xs font-semibold uppercase tracking-wider mb-1">
            <Cpu className="w-3.5 h-3.5" />
            <span>Nativer Rust Code &amp; MariaDB (InnoDB) Anbindung</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Quellcode-Repository: pfleged &amp; MariaDB Driver
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Asynchrones sqlx MariaDB Connection Pooling · InnoDB Foreign Keys · Debian .deb Paketierung
          </p>
        </div>

        <button
          onClick={() => downloadRustDebianZip()}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-md transition-colors shadow-xs cursor-pointer whitespace-nowrap"
        >
          <Download className="w-4 h-4" />
          <span>Vollständiges MariaDB Rust-Projekt (.deb) als ZIP laden</span>
        </button>
      </div>

      {/* Main Split: File Tree (3 cols) & Code Viewer (9 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Tree */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-3 space-y-4 h-[750px] overflow-y-auto">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900 pb-2 border-b border-slate-200">
            <FolderTree className="w-4 h-4 text-teal-700" />
            <span>Dateibaum des Rust + MariaDB Projekts</span>
          </div>

          {categories.map((cat) => {
            const files = RUST_CODEBASE.filter((f) => f.category === cat);
            if (files.length === 0) return null;
            return (
              <div key={cat} className="space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-2 flex items-center justify-between">
                  <span>{cat}</span>
                  {cat === 'Database Schema' && (
                    <Database className="w-3 h-3 text-teal-600" />
                  )}
                </div>
                <div className="space-y-0.5">
                  {files.map((file) => {
                    const isSelected = selectedPath === file.path;
                    return (
                      <button
                        key={file.path}
                        onClick={() => setSelectedPath(file.path)}
                        className={`w-full text-left px-2.5 py-1.5 rounded text-xs font-mono transition-colors flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-teal-700 text-white font-bold shadow-xs'
                            : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <span className="truncate">{file.path}</span>
                        {file.path.endsWith('.rs') ? (
                          <span
                            className={`text-[10px] px-1 rounded ${
                              isSelected ? 'bg-teal-800 text-teal-100' : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            rs
                          </span>
                        ) : file.path.endsWith('.sql') ? (
                          <span
                            className={`text-[10px] px-1 rounded ${
                              isSelected ? 'bg-teal-800 text-teal-100' : 'bg-teal-100 text-teal-800'
                            }`}
                          >
                            sql
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 space-y-2 mt-4">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-teal-700" />
              <span>MariaDB auf Debian 12 einrichten:</span>
            </div>
            <pre className="p-2 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded overflow-x-auto leading-relaxed">
{`# 1. MariaDB Server installieren
sudo apt install -y mariadb-server libmariadb-dev

# 2. Schema einspielen
sudo mariadb -u root < schema.sql

# 3. Rust Paket bauen
dpkg-buildpackage -us -uc -b`}
            </pre>
          </div>
        </div>

        {/* Right Code Viewer */}
        <div className="lg:col-span-8 bg-slate-950 border border-slate-800 rounded-lg overflow-hidden flex flex-col h-[750px]">
          {/* File bar */}
          <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-teal-400" />
              <span className="font-mono text-xs font-bold text-white">
                {selectedFile.path}
              </span>
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                · {selectedFile.description}
              </span>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Kopiert!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Kopieren</span>
                </>
              )}
            </button>
          </div>

          {/* Code content */}
          <div className="flex-1 overflow-y-auto p-4 text-xs font-mono text-slate-300 leading-relaxed">
            <pre className="font-mono text-[12px]">
              <code>{selectedFile.content}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
