const avatars = {
  Teacher: '👩‍🏫',
  Alex: '🧑‍💻',
  Sofia: '👩',
  Jamal: '🧑🏾',
  You: '🧑',
};

export default function ChatMessage({ message }) {
  return (
    <div className="flex gap-3">
      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-400 to-cyan-400 grid place-items-center text-lg">
        {avatars[message.speaker] || '🤖'}
      </div>
      <div className="flex-1 rounded-2xl bg-white/10 border border-white/10 p-3">
        <p className="text-sm font-semibold text-indigo-100">{message.speaker}</p>
        <p className="mt-1 text-indigo-50/90 leading-relaxed">{message.text}</p>
      </div>
    </div>
  );
}
