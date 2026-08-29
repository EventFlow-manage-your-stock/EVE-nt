// Subtelny, ciepły dźwięk powiadomienia (Soft Ambient Chime) generowany przez Web Audio API
export function playNotificationSound(priority: string = 'normalny') {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const isHigh = priority === 'wysoki' || priority === 'krytyczny';

    // Częstotliwości składowe ciepłego akordu (G5 / B5 lub A5 / C#6 dla wysokiego priorytetu)
    const tones = isHigh ? [554.37, 880.00] : [392.00, 523.25, 659.25];

    // Filtr dolnoprzepustowy (usuwa ostre wysokie tony i trzaski)
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.001, now);
    masterGain.gain.linearRampToValueAtTime(0.08, now + 0.04); // Bardzo miękki narost (Attack)
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65); // Długi, łagodny zanik (Decay)

    filter.connect(masterGain);
    masterGain.connect(ctx.destination);

    tones.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine'; // Wyłącznie gładka fala sinusoidalna
      const noteTime = now + (index * 0.04); // Subtelne arpeggio
      osc.frequency.setValueAtTime(freq, noteTime);

      const noteGain = ctx.createGain();
      noteGain.gain.setValueAtTime(0.7, noteTime);
      noteGain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.55);

      osc.connect(noteGain);
      noteGain.connect(filter);

      osc.start(noteTime);
      osc.stop(noteTime + 0.6);
    });
  } catch {
    // Bezpieczne pominięcie w przypadku braku wcześniejszej interakcji z dokumentem
  }
}