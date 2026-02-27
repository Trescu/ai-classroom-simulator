import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff, SendHorizonal, Sparkles } from 'lucide-react';
import ChatMessage from './components/ChatMessage';
import FeedbackPanel from './components/FeedbackPanel';

const initialFeedback = {
  confidence: 68,
  vocabulary: 62,
  clarity: 66,
  level: 'B1',
  tips: ['Start class to receive personalized coaching.'],
  grammarIssues: ['Waiting for first response'],
};

export default function App() {
  const [mode, setMode] = useState('learner');
  const [scenario, setScenario] = useState('interview');
  const [messages, setMessages] = useState([]);
  const [turn, setTurn] = useState(0);
  const [input, setInput] = useState('');
  const [liveTip, setLiveTip] = useState('Add one concrete example to show your impact.');
  const [feedback, setFeedback] = useState(initialFeedback);
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  const canUseSpeech = useMemo(
    () => typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window),
    []
  );

  useEffect(() => {
    if (import.meta.env.PROD) return;

    const logOverflow = () => {
      const root = document.documentElement;
      const scrollHeight = root.scrollHeight;
      const clientHeight = root.clientHeight;

      if (scrollHeight <= clientHeight + 1) return;

      const firstOverflow = Array.from(document.querySelectorAll('*')).find((el) => {
        const rect = el.getBoundingClientRect();
        return rect.bottom > window.innerHeight + 1;
      });

      const styles = firstOverflow ? window.getComputedStyle(firstOverflow) : null;
      console.warn('[overflow-debug] viewport overflow detected', {
        scrollHeight,
        clientHeight,
        viewportHeight: window.innerHeight,
        firstOverflowClassName: firstOverflow?.className || '(none)',
        firstOverflowTag: firstOverflow?.tagName || '(none)',
        computed: styles
          ? {
              height: styles.height,
              minHeight: styles.minHeight,
              padding: styles.padding,
              margin: styles.margin,
            }
          : null,
      });
    };

    logOverflow();
    window.addEventListener('resize', logOverflow);
    return () => window.removeEventListener('resize', logOverflow);
  }, [messages.length, loading, input, mode, scenario]);

  const speak = (text) => {
    if (!window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1.05;
    window.speechSynthesis.speak(utterance);
  };

  const callTurn = async (userInput = '') => {
    setLoading(true);
    const transcript = [...messages, userInput ? { speaker: 'You', text: userInput, role: 'user' } : null].filter(Boolean);
    try {
      const res = await fetch('/api/classroom/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, scenario, turn, transcript, userInput }),
      });
      const data = await res.json();
      const appended = [...transcript, ...(data.turns || [])];
      setMessages(appended);
      setFeedback(data.feedback || initialFeedback);
      setLiveTip(data.liveTip || liveTip);
      setTurn((t) => t + 1);
      (data.turns || []).forEach((t, idx) => setTimeout(() => speak(`${t.speaker}. ${t.text}`), idx * 200));
    } finally {
      setLoading(false);
    }
  };

  const startClass = () => {
    setMessages([]);
    setTurn(0);
    callTurn('');
  };

  const sendInput = () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');
    callTurn(text);
  };

  const toggleListening = () => {
    if (!canUseSpeech) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event) => {
      const text = Array.from(event.results).map((r) => r[0].transcript).join(' ');
      setInput(text);
    };

    recognition.start();
  };

  return (
    <div className="app-shell bg-[#080b25] bg-[radial-gradient(circle_at_top,_rgba(87,68,207,0.5),_transparent_45%),radial-gradient(circle_at_bottom_right,_rgba(37,190,222,0.3),_transparent_30%)] text-white">
      <div className="app-frame mx-auto w-full max-w-7xl rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
        <header className="px-6 py-5 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-3xl font-bold tracking-wide">AI CLASSROOM SIMULATOR</p>
            <p className="text-indigo-200">Job interview & language practice with multi-agent AI</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={mode} onChange={(e) => setMode(e.target.value)} className="bg-white/10 rounded-xl px-3 py-2">
              <option value="learner">Learner Mode</option>
              <option value="teacher">Teacher Mode</option>
            </select>
            <select value={scenario} onChange={(e) => setScenario(e.target.value)} className="bg-white/10 rounded-xl px-3 py-2">
              <option value="interview">Tech Interview</option>
              <option value="language">Language Class</option>
            </select>
          </div>
        </header>

        <main className="app-main p-3 lg:p-4">
          <div className="main-grid gap-3 lg:gap-4">
            <section className="chat-panel rounded-3xl border border-white/10 bg-panel p-4">
              <div className="messages-area space-y-3 pr-1">
              {messages.map((message, idx) => <ChatMessage key={`${idx}-${message.speaker}`} message={message} />)}
              {loading && <p className="text-indigo-300 animate-pulse">AI is speaking...</p>}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={startClass} className="rounded-xl px-4 py-2 bg-emerald-500/70 hover:bg-emerald-500">Start Class</button>
                <button onClick={() => callTurn('')} className="rounded-xl px-4 py-2 bg-indigo-500/70 hover:bg-indigo-500">Next Turn</button>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={toggleListening}
                  className={`rounded-full p-3 ${isListening ? 'bg-rose-500' : 'bg-white/10'} border border-white/20`}
                  title={canUseSpeech ? 'Voice input' : 'Speech recognition not supported in this browser'}
                >
                  {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendInput()}
                  className="flex-1 rounded-full bg-black/20 border border-white/10 px-4 py-3 outline-none"
                  placeholder="Type or speak your answer..."
                />
                <button onClick={sendInput} className="rounded-full p-3 bg-blue-500 hover:bg-blue-400">
                  <SendHorizonal size={18} />
                </button>
              </div>
            </section>

            <div className="coach-column min-h-0 overflow-hidden">
              <FeedbackPanel feedback={feedback} liveTip={liveTip} />
            </div>
          </div>
        </main>

        <footer className="px-6 pb-5 text-indigo-200/90 flex items-center gap-2 text-sm">
          <Sparkles size={14} /> Real-time coaching • Voice-first • Multi-agent orchestration
        </footer>
      </div>
    </div>
  );
}
