import { useState } from 'react';

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
      className="flex items-center gap-2 px-4 py-2 rounded-lg
                 bg-blue-600 text-white hover:bg-blue-700
                 focus-visible:outline focus-visible:outline-2"
    >
      {speaking ? '⏹ Stop Reading' : '🔊 Read Aloud'}
    </button>
  );
}