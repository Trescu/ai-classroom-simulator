function Meter({ label, value, accent = 'bg-indigo-300', suffix = '%' }) {
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

export default function TeacherPanel({ feedback, liveTip }) {
  const metrics = feedback?.teacherMetrics || {
    studentGrowth: feedback?.confidence ?? 60,
    engagement: feedback?.clarity ?? 60,
    clarityTrend: feedback?.vocabulary ?? 60,
    commonErrors: feedback?.grammarIssues || ['No class data yet'],
  };

  return (
    <div className="h-full min-h-0 p-5 flex flex-col">
      <h3 className="text-xl font-semibold tracking-wide text-indigo-100 flex-none">Classroom Analytics</h3>
      <div className="mt-4 flex-1 min-h-0 overflow-y-auto no-scrollbar pr-1">
        <div className="rounded-2xl bg-white/10 p-4 text-indigo-100/90">
          <p className="text-xs uppercase tracking-widest text-indigo-200">Teacher Tip</p>
          <p className="mt-1 text-sm">{liveTip}</p>
        </div>

        <div className="mt-5 space-y-3">
          <Meter label="Student Growth" value={metrics.studentGrowth} accent="bg-emerald-300" />
          <Meter label="Engagement" value={metrics.engagement} accent="bg-amber-300" />
          <Meter label="Clarity Trend" value={metrics.clarityTrend} accent="bg-cyan-300" />
        </div>

        <div className="mt-5 text-sm text-indigo-100/90 space-y-2">
          <p className="font-medium">Common Errors</p>
          <ul className="list-disc pl-5 text-indigo-100/75">
            {(metrics.commonErrors || []).map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>

        <div className="mt-4 text-sm text-indigo-100/90 space-y-2">
          <p className="font-medium">Teaching Actions</p>
          <ul className="list-disc pl-5 text-indigo-100/75">
            {(feedback?.tips || []).map((tip) => <li key={tip}>{tip}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}
