import { useState } from 'react';
import { Volume2, Square } from 'lucide-react';

export default function TTSButton({ text }) {
  const [speaking, setSpeaking] = useState(false);

  const speak = () => {
    if (!window.speechSynthesis) {
      alert('Your browser does not support text-to-speech.');
      return;
    }
    // Strip HTML tags before speaking
    const plainText = text.replace(/<[^>]+>/g, '');
    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance.lang = 'en-US';
    utterance.rate = 0.85;   // Slightly slower — better for dyslexia
    utterance.pitch = 1;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const stop = () => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  return (
    <button
      onClick={speaking ? stop : speak}
      aria-label={speaking ? 'Stop reading aloud' : 'Read aloud'}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)] ${
        speaking
          ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
          : 'bg-[color:var(--color-accent)] text-[color:var(--color-accent-text)] hover:opacity-90 shadow-sm'
      }`}
    >
      {speaking ? (
        <>
          <Square size={18} className="fill-current" aria-hidden="true" />
          <span className="hidden sm:inline">Stop Reading</span>
        </>
      ) : (
        <>
          <Volume2 size={18} aria-hidden="true" />
          <span className="hidden sm:inline">Read Aloud</span>
        </>
      )}
    </button>
  );
}
