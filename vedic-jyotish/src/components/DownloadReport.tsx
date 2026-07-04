import { useState } from 'react';
import { AstrologicalProfile } from '../types';
import { FileText, Download, Printer, RefreshCw, AlertCircle, Sparkles, BookOpen } from 'lucide-react';

interface DownloadReportProps {
  birthProfile: AstrologicalProfile | null;
}

export default function DownloadReport({ birthProfile }: DownloadReportProps) {
  const [report, setReport] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateReport = async () => {
    if (!birthProfile) return;
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birthProfile })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate report. Make sure GEMINI_API_KEY is active.');
      }

      setReport(data.report);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Connecting to report generator service failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!report) return;
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Janam_Patrika_Report_${birthProfile?.birthDetails.fullName.replace(/\s+/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Janam Patrika Report - ${birthProfile?.birthDetails.fullName}</title>
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; padding: 40px; color: #333; }
              h1 { color: #864f21; border-bottom: 2px solid #e7d5a5; padding-bottom: 10px; }
              h2 { color: #bf8433; margin-top: 30px; }
              h3 { color: #a56828; }
              pre { background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }
              blockquote { border-left: 4px solid #cb9d4c; padding-left: 15px; margin-left: 0; font-style: italic; color: #555; }
              table { width: 100%; border-collapse: collapse; margin: 20px 0; }
              th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
              th { background: #fbf8f1; }
            </style>
          </head>
          <body>
            <div style="text-align: center; margin-bottom: 40px;">
              <h2 style="margin: 0; color: #ff681a; font-size: 28px;">🕉️ VEDIC JYOTISH 🕉️</h2>
              <p style="margin: 5px 0; font-weight: bold; text-transform: uppercase; letter-spacing: 2px;">Comprehensive Astrological Patrika</p>
            </div>
            <div>${report.replace(/\n/g, '<br/>')}</div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div id="download-report-component" className="bg-[#13131a] rounded-3xl border border-gold-900/40 p-6 md:p-8 space-y-6">
      <div className="border-b border-neutral-800 pb-5">
        <h3 className="text-xl font-display font-bold text-gold-100 flex items-center gap-2">
          <FileText className="text-saffron-500 w-5.5 h-5.5" />
          AI Janam Patrika PDF & Text Reports
        </h3>
        <p className="text-xs text-neutral-400 mt-1">
          Compile a complete, personalized 5-page Kundli dossier analyzing house planetary details, yogas, dasha periods, and remedy guidelines.
        </p>
      </div>

      {!birthProfile ? (
        <div className="text-center py-12 bg-[#1b1b24]/40 rounded-2xl border border-dashed border-neutral-800">
          <AlertCircle className="w-10 h-10 text-neutral-600 mx-auto mb-2" />
          <p className="text-sm text-neutral-400 font-semibold">Please set up your birth details first</p>
          <p className="text-xs text-neutral-500 mt-1">We need your coordinates and alignment parameters to build the report.</p>
        </div>
      ) : !report ? (
        <div className="bg-[#1b1b24] p-8 rounded-2xl border border-neutral-800/80 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-saffron-600/15 text-saffron-400 flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h4 className="text-sm font-semibold text-gold-100 font-display">Compile Premium Vedic Report</h4>
            <p className="text-xs text-neutral-400">
              Acharya Shastri will use advanced intelligence to construct a customized text report mapping active planetary houses, remedies, and transit outcomes.
            </p>
          </div>
          
          {error && (
            <div className="p-3 bg-red-950/40 border border-red-800 text-red-300 rounded-xl text-xs flex items-start gap-2 max-w-md mx-auto text-left">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            id="btn-trigger-report-generation"
            onClick={generateReport}
            disabled={loading}
            className="bg-gradient-to-r from-saffron-600 to-gold-500 hover:from-saffron-500 hover:to-gold-400 text-neutral-950 font-bold py-2.5 px-6 rounded-xl text-xs transition shadow-lg shadow-saffron-900/10 flex items-center justify-center gap-1.5 mx-auto"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Drafting Horoscopes...
              </>
            ) : (
              'Compile Full Report'
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Action Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#191922] p-4 rounded-xl border border-neutral-800/60">
            <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
              <Sparkles className="w-4 h-4 text-gold-400" />
              Report Compiled Successfully
            </span>
            <div className="flex gap-2">
              <button
                id="btn-download-md-report"
                onClick={handleDownload}
                className="bg-gold-500 hover:bg-gold-400 text-neutral-950 font-bold px-4 py-2 rounded-lg text-xs transition flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Download Markdown
              </button>
              <button
                id="btn-print-html-report"
                onClick={handlePrint}
                className="bg-neutral-800 hover:bg-neutral-700 text-white font-semibold px-4 py-2 rounded-lg text-xs transition flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                Print / Save PDF
              </button>
            </div>
          </div>

          {/* Report Preview */}
          <div className="bg-[#1b1b24] p-6 rounded-2xl border border-neutral-800/80 max-h-[400px] overflow-y-auto whitespace-pre-wrap text-xs text-neutral-300 leading-relaxed font-mono">
            {report}
          </div>

          <div className="flex justify-end">
            <button
              id="btn-regenerate-report"
              onClick={generateReport}
              disabled={loading}
              className="text-neutral-500 hover:text-neutral-300 text-xs flex items-center gap-1.5 font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Re-Compile Report
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
