import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff, SendHorizonal, Sparkles } from 'lucide-react';
import ChatMessage from './components/ChatMessage';
import Dropdown from './components/Dropdown';
import FeedbackPanel from './components/FeedbackPanel';
import TeacherPanel from './components/TeacherPanel';

const SESSION_STATE = {
  IDLE: 'IDLE',
  CLASS_STARTED: 'CLASS_STARTED',
  WAITING_USER: 'WAITING_USER',
  AI_TURN: 'AI_TURN',
  FINISHED: 'FINISHED',
  ERROR: 'ERROR',
};

const initialFeedback = {
  confidence: 68,
  vocabulary: 62,
  clarity: 66,
  level: 'B1',
  tips: ['Start class to receive personalized coaching.'],
  grammarIssues: ['Waiting for first response'],
};

const modeOptions = [
  { value: 'learner', label: 'Learner Mode' },
  { value: 'teacher', label: 'Teacher Mode' },
];

const scenarioOptions = [
  { value: 'tech_interview', label: 'Tech Interview' },
  { value: 'language_class', label: 'Language Class' },
];

const createInitialSession = () => ({
  id: '',
  stageIndex: 0,
  turnIndex: 0,
  speakerRotationIndex: 0,
  history: [],
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const defaultLiveTipForMode = (mode) =>
  mode === 'teacher'
    ? 'Prompt the learner to give one measurable result in their next answer.'
    : 'Add one concrete example to show your impact.';

export default function App() {
  const [mode, setMode] = useState('learner');
  const [scenario, setScenario] = useState('tech_interview');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [liveTip, setLiveTip] = useState(defaultLiveTipForMode('learner'));
  const [feedback, setFeedback] = useState(initialFeedback);
  const [session, setSession] = useState(createInitialSession());
  const [sessionState, setSessionState] = useState(SESSION_STATE.IDLE);
  const [errorText, setErrorText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const messagesRef = useRef(null);
  const latestRequestRef = useRef(null);

  const canUseSpeech = useMemo(
    () => typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window),
    []
  );

  const canSendInput = sessionState === SESSION_STATE.WAITING_USER;
  const canUseNextTurn = sessionState === SESSION_STATE.WAITING_USER || sessionState === SESSION_STATE.IDLE;
  const speakingNow = sessionState === SESSION_STATE.CLASS_STARTED || sessionState === SESSION_STATE.AI_TURN;
  const busy = [SESSION_STATE.CLASS_STARTED, SESSION_STATE.AI_TURN].includes(sessionState);

  useEffect(() => {
    if (sessionState === SESSION_STATE.IDLE) {
      setLiveTip(defaultLiveTipForMode(mode));
    }
  }, [mode, sessionState]);

  useEffect(() => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages]);

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
  }, [messages.length, input, mode, scenario, sessionState]);

  const speakAsync = (text) =>
    new Promise((resolve) => {
      if (!window.speechSynthesis || !text) {
        resolve();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1.05;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    });

  const renderTurnsWithPlayback = async (turns) => {
    for (const turn of turns) {
      setMessages((prev) => [...prev, turn]);
      await Promise.race([speakAsync(`${turn.speaker}. ${turn.text}`), wait(900)]);
      await wait(100);
    }
  };

  const callTurn = async ({
    action,
    userText = '',
    preState,
    playbackState = SESSION_STATE.AI_TURN,
    sessionOverride,
  }) => {
    const requestSession = sessionOverride || session;
    setSessionState(preState);
    setErrorText('');
    latestRequestRef.current = { action, userText };

    try {
      const res = await fetch('/api/classroom/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          scenario,
          action,
          session: requestSession,
          userText,
          recentTurns: (requestSession?.history || []).slice(-6),
        }),
      });

      if (!res.ok) {
        throw new Error(`Request failed with ${res.status}`);
      }

      const data = await res.json();
      const turns = Array.isArray(data.turns) ? data.turns : [];

      if (data.session) {
        setSession(data.session);
      }
      setFeedback(data.feedback || initialFeedback);
      setLiveTip(data.liveTip || defaultLiveTipForMode(mode));

      if (turns.length > 0) {
        setSessionState(playbackState);
        await renderTurnsWithPlayback(turns);
      }

      setSessionState(SESSION_STATE.WAITING_USER);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Turn processing failed.');
      setSessionState(SESSION_STATE.ERROR);
    }
  };

  const startClass = async () => {
    setMessages([]);
    setFeedback(initialFeedback);
    setLiveTip(mode === 'teacher'
      ? 'Start class to view teacher-focused classroom analytics.'
      : 'Start class to receive personalized coaching.');
    setInput('');
    const freshSession = createInitialSession();
    setSession(freshSession);
    await callTurn({
      action: 'start',
      userText: '',
      preState: SESSION_STATE.CLASS_STARTED,
      playbackState: SESSION_STATE.CLASS_STARTED,
      sessionOverride: freshSession,
    });
  };

  const sendInput = async () => {
    if (!canSendInput) return;
    const text = input.trim();
    if (!text) return;

    setMessages((prev) => [...prev, { speaker: 'You', role: 'user', text }]);
    setInput('');
    await callTurn({ action: 'user_turn', userText: text, preState: SESSION_STATE.AI_TURN });
  };

  const nextTurn = async () => {
    if (sessionState === SESSION_STATE.IDLE) {
      await startClass();
      return;
    }
    if (sessionState !== SESSION_STATE.WAITING_USER) return;
    await callTurn({ action: 'next_turn', userText: '', preState: SESSION_STATE.AI_TURN });
  };

  const retryLast = async () => {
    const payload = latestRequestRef.current;
    if (!payload) return;
    await callTurn({ action: payload.action, userText: payload.userText, preState: SESSION_STATE.AI_TURN });
  };

  const toggleListening = () => {
    if (!canUseSpeech || !canSendInput) return;

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
            <p className="mt-1 text-xs uppercase tracking-widest text-indigo-100/80">Mode: {mode}</p>
          </div>
          <div className="flex items-center gap-2">
            <Dropdown value={mode} options={modeOptions} onChange={setMode} ariaLabel="Select mode" />
            <Dropdown value={scenario} options={scenarioOptions} onChange={setScenario} ariaLabel="Select scenario" />
          </div>
        </header>

        <main className="app-main p-3 lg:p-4">
          <div className="main-grid gap-3 lg:gap-4">
            <section className="chat-panel rounded-3xl border border-white/10 bg-panel p-4">
              <div ref={messagesRef} className="messages-area no-scrollbar space-y-3 pr-1">
                {messages.map((message, idx) => <ChatMessage key={`${idx}-${message.speaker}`} message={message} />)}
                {speakingNow && <p className="text-indigo-300 animate-pulse">Teacher speaking...</p>}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  onClick={startClass}
                  disabled={busy}
                  className="rounded-xl px-4 py-2 bg-emerald-500/70 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Start Class
                </button>
                <button
                  onClick={nextTurn}
                  disabled={!canUseNextTurn || busy}
                  className="rounded-xl px-4 py-2 bg-indigo-500/70 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next Turn
                </button>
                <span className="text-xs text-indigo-200/80 uppercase tracking-widest">
                  {sessionState}
                </span>
                {sessionState === SESSION_STATE.ERROR && (
                  <button
                    onClick={retryLast}
                    className="rounded-xl px-3 py-1.5 text-xs bg-rose-500/70 hover:bg-rose-500"
                  >
                    Recover
                  </button>
                )}
              </div>

              {sessionState === SESSION_STATE.ERROR && (
                <p className="mt-2 text-sm text-rose-200/90">Session error: {errorText || 'Unknown issue.'}</p>
              )}

              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={toggleListening}
                  disabled={!canSendInput}
                  className={`rounded-full p-3 ${isListening ? 'bg-rose-500' : 'bg-white/10'} border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={canUseSpeech ? 'Voice input' : 'Speech recognition not supported in this browser'}
                >
                  {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
                <input
                  value={input}
                  disabled={!canSendInput}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendInput()}
                  className="flex-1 rounded-full bg-black/20 border border-white/10 px-4 py-3 outline-none disabled:opacity-60"
                  placeholder={canSendInput ? 'Type or speak your answer...' : 'Wait for your turn...'}
                />
                <button
                  onClick={sendInput}
                  disabled={!canSendInput || !input.trim()}
                  className="rounded-full p-3 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <SendHorizonal size={18} />
                </button>
              </div>
            </section>

            <div className="coach-column h-full min-h-0 overflow-hidden">
              <aside className="relative h-full min-h-0 overflow-hidden rounded-3xl border border-white/10 bg-panel backdrop-blur-xl">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.18),transparent_48%),linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02)_44%,rgba(255,255,255,0))]"
                />
                <div className="relative z-10 h-full min-h-0">
                  {mode === 'teacher'
                    ? <TeacherPanel feedback={feedback} liveTip={liveTip} />
                    : <FeedbackPanel feedback={feedback} liveTip={liveTip} />}
                </div>
              </aside>
            </div>
          </div>
        </main>

        <footer className="px-6 pb-5 text-indigo-200/90 flex items-center gap-2 text-sm">
          <Sparkles size={14} /> Real-time coaching - Voice-first - Multi-agent orchestration
        </footer>
      </div>
    </div>
  );
}
