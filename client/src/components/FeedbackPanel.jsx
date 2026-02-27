function Meter({ label, value, accent = 'bg-indigo-400', suffix = '' }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm text-indigo-100/80">
        <span>{label}</span>
        <span>{value}{suffix}</span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div className={`h-2 rounded-full ${accent}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export default function FeedbackPanel({ feedback, liveTip }) {
  return (
    <aside className="feedback-card h-full w-full rounded-3xl border border-white/15 shadow-glow min-h-0 overflow-hidden">
      <div className="feedback-card-surface bg-panel backdrop-blur-xl" aria-hidden="true" />
      <div className="relative z-[1] h-full p-5 flex flex-col min-h-0">
        <h3 className="text-xl font-semibold tracking-wide text-indigo-100 flex-none">Performance Coach</h3>
        <div className="mt-4 flex-1 min-h-0 overflow-y-auto no-scrollbar pr-1">
          <div className="rounded-2xl bg-white/10 p-4 text-indigo-100/90">
            <p className="text-xs uppercase tracking-widest text-indigo-200">Live Tip</p>
            <p className="mt-1 text-sm">{liveTip}</p>
          </div>

          <div className="mt-5 space-y-3">
            <Meter label="Confidence" value={feedback.confidence} accent="bg-amber-300" suffix="%" />
            <Meter label="Vocabulary" value={feedback.vocabulary} accent="bg-indigo-300" suffix="%" />
            <Meter label="Clarity" value={feedback.clarity} accent="bg-emerald-300" suffix="%" />
          </div>

          <div className="mt-5 text-sm text-indigo-100/90 space-y-2">
            <p className="font-medium">Grammar Issues</p>
            <ul className="list-disc pl-5 text-indigo-100/75">
              {feedback.grammarIssues?.map((issue) => <li key={issue}>{issue}</li>)}
            </ul>
          </div>

          <div className="mt-4 text-sm text-indigo-100/90 space-y-2">
            <p className="font-medium">Improve</p>
            <ul className="list-disc pl-5 text-indigo-100/75">
              {feedback.tips?.map((tip) => <li key={tip}>{tip}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </aside>
  );
}
