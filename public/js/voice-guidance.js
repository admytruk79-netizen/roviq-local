const KEY = 'roviq_voice_enabled';

let enabled = (() => {
  try {
    const v = localStorage.getItem(KEY);
    return v === null ? true : v === '1';
  } catch {
    return true;
  }
})();

function supported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function speak(text, { interrupt = false } = {}) {
  if (!enabled || !supported() || !text) return;
  try {
    if (interrupt) window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  } catch {}
}

function setEnabled(value) {
  enabled = !!value;
  try {
    localStorage.setItem(KEY, enabled ? '1' : '0');
  } catch {}
  if (!enabled) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
}

function isEnabled() {
  return enabled;
}

export { speak, setEnabled, isEnabled, supported };
