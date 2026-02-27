import React from 'react';
import './styles.css';

export default function App() {
  return (
    <div className="app-root">
      <header className="app-header">AI Classroom Simulator</header>

      <main className="app-main">
        <section className="chat-panel">
          <div className="chat-messages" aria-label="Chat messages">
            {/* Existing chat message list should render here. */}
          </div>
          <div className="chat-controls">
            {/* Existing chat composer and controls should render here. */}
          </div>
        </section>

        <aside className="coach-panel" aria-label="Coach panel">
          {/* Existing coach content should render here. */}
        </aside>
      </main>
    </div>
  );
}
