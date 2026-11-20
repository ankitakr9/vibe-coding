import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Download, FileCode2 } from 'lucide-react';
import type { FraudRuleConfig, JavaProjectFile } from '../shared/types';

interface JavaProjectViewProps {
  token: string;
  rules: FraudRuleConfig;
}

export function JavaProjectView({ token, rules }: JavaProjectViewProps) {
  const [files, setFiles] = useState<JavaProjectFile[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch('/api/java-project', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data: { files: JavaProjectFile[] }) => {
        if (!active) return;
        setFiles(data.files ?? []);
        setSelectedPath((prev) =>
          prev && data.files.some((f) => f.path === prev)
            ? prev
            : data.files[2]?.path ?? data.files[0]?.path ?? ''
        );
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, rules]);

  const grouped = useMemo(() => {
    const map = new Map<string, JavaProjectFile[]>();
    for (const file of files) {
      const list = map.get(file.category) ?? [];
      list.push(file);
      map.set(file.category, list);
    }
    return Array.from(map.entries());
  }, [files]);

  const activeFile = files.find((f) => f.path === selectedPath) ?? files[0] ?? null;

  const handleCopy = async () => {
    if (!activeFile) return;
    try {
      await navigator.clipboard.writeText(activeFile.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked in sandbox
    }
  };

  const handleDownloadZip = async () => {
    setDownloading(true);
    try {
      const res = await fetch('/api/java-project/download', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'veritas-fraudguard-java.zip';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#0B1528]">
            Fullstack Java Spring Boot Project
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Java 21 + Spring Boot 3.4 Maven codebase featuring Spring Security 6 JWT authentication, BCrypt registration, RBAC <span className="font-mono">@PreAuthorize</span> guards, hybrid rule + ML scoring, and STOMP WebSocket alerts.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownloadZip}
          disabled={downloading}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1D4ED8] px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[#1E40AF] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="h-4 w-4" />
          {downloading ? 'Building Archive...' : 'Download Java Project (.zip)'}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-b border-[#DCE3EE] py-3 text-xs text-slate-600 font-mono tabular-nums">
        <span>Java 21 LTS · Spring Boot 3.4.2</span>
        <span>Spring Security 6 + JJWT RBAC</span>
        <span>Rule + Logistic ML Scoring</span>
        <span>Block threshold: {rules.blockThreshold}/100</span>
        <span>{files.length} source files</span>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
          Loading generated Java Spring Boot files...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          <nav
            aria-label="Java project files"
            className="rounded-xl border border-[#DCE3EE] bg-white shadow-[0_1px_2px_rgba(11,21,40,0.04)] p-4 lg:col-span-4 space-y-5"
          >
            {grouped.map(([category, catFiles]) => (
              <div key={category}>
                <h2 className="px-2 text-xs font-semibold text-slate-500">{category}</h2>
                <ul className="mt-1.5 space-y-0.5">
                  {catFiles.map((file) => {
                    const fileName = file.path.split('/').pop() ?? file.path;
                    const isSelected = activeFile?.path === file.path;
                    return (
                      <li key={file.path}>
                        <button
                          type="button"
                          onClick={() => setSelectedPath(file.path)}
                          className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                            isSelected
                              ? 'bg-[#1D4ED8] text-white font-semibold shadow-xs'
                              : 'text-slate-700 hover:bg-[#F3F6FA]'
                          }`}
                        >
                          <FileCode2
                            className={`h-3.5 w-3.5 shrink-0 ${
                              isSelected ? 'text-blue-100' : 'text-slate-400'
                            }`}
                          />
                          <span className="truncate font-mono">{fileName}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <section className="rounded-xl border border-[#DCE3EE] bg-white shadow-[0_1px_2px_rgba(11,21,40,0.04)] overflow-hidden lg:col-span-8">
            {activeFile && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E4E9F2] bg-[#F7F9FC] px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-semibold text-[#0B1528] truncate">
                      {activeFile.path}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">{activeFile.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-700" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-[#1D4ED8]" />
                    )}
                    {copied ? 'Copied' : 'Copy File'}
                  </button>
                </div>

                <div className="max-h-[620px] overflow-auto bg-[#0B1528] p-5 text-slate-100">
                  <pre className="font-mono text-xs leading-6">
                    {activeFile.content.split('\n').map((line, idx) => (
                      <div key={idx} className="table-row">
                        <span className="table-cell select-none pr-5 text-right text-slate-600 tabular-nums">
                          {idx + 1}
                        </span>
                        <span className="table-cell whitespace-pre text-slate-100">{line}</span>
                      </div>
                    ))}
                  </pre>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
