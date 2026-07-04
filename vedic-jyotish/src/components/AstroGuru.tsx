import { useState, useRef, useEffect } from 'react';
import { AstrologicalProfile } from '../types';
import { Send, Sparkles, RefreshCw, AlertCircle, MessageSquare, Compass, ShieldAlert } from 'lucide-react';

interface AstroGuruProps {
  birthProfile: AstrologicalProfile | null;
}

interface Message {
  role: 'user' | 'model';
  content: string;
}

const SUGGESTED_QUESTIONS = [
  "What is the significance of my Lagna house and planetary placements?",
  "Tell me about my active yogas and how they influence my career.",
  "Are there any major doshas like Manglik or Pitra Dosha I should resolve?",
  "What are some personalized remedies to improve my financial health?",
  "Which auspicious gemstone is best aligned with my Nakshatra?"
];

export default function AstroGuru({ birthProfile }: AstroGuruProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      content: `Pranam ${birthProfile?.birthDetails?.fullName || 'Seeker'}. I am Acharya Shastri. Your cosmic charts are placed before me. Ask me any question regarding your Janam Kundli, active Mahadashas, career paths, marital matches, or beneficial spiritual remedies.`
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (messageText: string) => {
    if (!messageText.trim()) return;
    setError('');
    setLoading(true);
    setInput('');

    const newMessages = [...messages, { role: 'user', content: messageText } as Message];
    setMessages(newMessages);

    try {
      const response = await fetch('/api/astrology-guru', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          history: messages,
          birthProfile: birthProfile
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'The alignment was interrupted. Please check back.');
      }

      setMessages((prev) => [...prev, { role: 'model', content: data.reply }]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Connecting to Acharya Shastri failed. Please verify your GEMINI_API_KEY is configured correctly.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="astro-guru-component" className="bg-[#13131a] rounded-3xl border border-gold-900/40 p-6 flex flex-col h-[600px] relative overflow-hidden">
      {/* Decorative starry backdrop */}
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-4 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-saffron-600 to-gold-400 flex items-center justify-center text-xl shadow-md border border-gold-500/30">
              🕉️
            </div>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#13131a]" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gold-100 font-display tracking-wide">Acharya Shastri</h4>
            <p className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
              <Sparkles className="w-2.5 h-2.5 animate-pulse" />
              AI ASTROLOGY GURU • ONLINE
            </p>
          </div>
        </div>

        {birthProfile && (
          <div className="text-right hidden sm:block">
            <span className="text-[10px] font-mono text-neutral-400 block">Active Chart</span>
            <span className="text-xs font-semibold text-gold-300 font-display">{birthProfile.birthDetails.fullName}</span>
          </div>
        )}
      </div>

      {/* Messages viewport */}
      <div className="grow overflow-y-auto space-y-4 pr-1 z-10 min-h-0">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-saffron-700 to-saffron-900 text-amber-50 border border-saffron-600/30 rounded-tr-none shadow-md shadow-saffron-950/10'
                  : 'bg-[#1b1b24] text-neutral-200 border border-neutral-800/60 rounded-tl-none whitespace-pre-line'
              }`}
            >
              {msg.role === 'model' && (
                <div className="flex items-center gap-1 mb-1.5 text-[10px] font-bold tracking-widest text-gold-400 font-display">
                  GURU SHASTRI
                </div>
              )}
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[#1b1b24] text-neutral-400 border border-neutral-800 rounded-2xl rounded-tl-none px-4 py-3 text-xs flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-gold-500" />
              <span>Acharya Shastri is interpreting your stars...</span>
            </div>
          </div>
        )}
        {error && (
          <div className="p-3 bg-red-950/40 border border-red-800 text-red-300 rounded-xl text-xs flex items-start gap-2 max-w-lg">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Astral Link Interrupted</p>
              <p className="mt-1 text-red-400">{error}</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions (only shows when there are few messages) */}
      {messages.length <= 2 && (
        <div className="py-3 shrink-0 z-10 border-t border-neutral-800/40 mt-3 overflow-x-auto whitespace-nowrap flex gap-2 scrollbar-none">
          {SUGGESTED_QUESTIONS.map((q, idx) => (
            <button
              key={idx}
              id={`suggested-question-${idx}`}
              onClick={() => handleSend(q)}
              className="text-xs bg-[#191922] border border-neutral-800 text-neutral-300 rounded-full px-4 py-2 hover:bg-[#20202b] hover:text-white transition inline-flex items-center gap-1.5 shrink-0"
            >
              <Compass className="w-3 h-3 text-gold-400" />
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Chat input form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(input);
        }}
        className="mt-4 flex gap-2 shrink-0 z-10"
      >
        <input
          id="chat-input-text"
          type="text"
          disabled={loading}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your planetary periods, careers, relationships..."
          className="grow bg-[#1b1b24] border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-gold-500 transition"
        />
        <button
          id="btn-chat-send"
          type="submit"
          disabled={loading || !input.trim()}
          className="bg-gold-500 hover:bg-gold-400 text-neutral-950 px-4 py-3 rounded-xl transition flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-4.5 h-4.5" />
        </button>
      </form>
    </div>
  );
}
