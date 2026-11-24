import React, { useState } from 'react';
import { Check, Copy, Download, FileCode2 } from 'lucide-react';
import { JAVA_SOURCE_FILES } from '../data/javaSourceFiles';

export function JavaSourcePanel() {
  const [selectedName, setSelectedName] = useState(JAVA_SOURCE_FILES[0].fileName);
  const [copied, setCopied] = useState(false);

  const activeFile =
    JAVA_SOURCE_FILES.find((f) => f.fileName === selectedName) ?? JAVA_SOURCE_FILES[0];

  const handleCopy = async () => {
    await navigator.clipboard.writeText(activeFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownloadFile = () => {
    const blob = new Blob([activeFile.code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = activeFile.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
          Core Java &amp; JavaFX Reference Project
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Complete Java 17 implementation covering Collections, JavaFX desktop GUI, Scanner CLI, File I/O persistence, and parameterized SQLite JDBC.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* File Explorer Column */}
        <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70">
            <h2 className="text-xs font-semibold text-slate-700">Project Source Files</h2>
          </div>
          <nav className="divide-y divide-slate-100">
            {JAVA_SOURCE_FILES.map((file) => {
              const isSelected = file.fileName === activeFile.fileName;
              return (
                <button
                  key={file.fileName}
                  type="button"
                  onClick={() => {
                    setSelectedName(file.fileName);
                    setCopied(false);
                  }}
                  className={`w-full text-left px-4 py-3.5 transition-colors cursor-pointer ${
                    isSelected ? 'bg-emerald-50/70' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileCode2
                      className={`w-4 h-4 shrink-0 ${
                        isSelected ? 'text-emerald-700' : 'text-slate-400'
                      }`}
                    />
                    <span
                      className={`font-mono text-sm font-medium ${
                        isSelected ? 'text-emerald-950' : 'text-slate-900'
                      }`}
                    >
                      {file.fileName}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 pl-6">{file.concept}</p>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Source Code Viewer Column */}
        <section className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-sm font-semibold text-slate-900 truncate">
                {activeFile.packagePath}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{activeFile.summary}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopy}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Code'}</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadFile}
                className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .java</span>
              </button>
            </div>
          </div>

          <pre className="p-5 bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed overflow-x-auto max-h-[560px]">
            <code>{activeFile.code}</code>
          </pre>
        </section>
      </div>
    </div>
  );
}
