export const TOTAL_SOUNDS = 0;

export function onSoundProgress(_cb: (loaded: number, total: number) => void) {}
export function initSounds(): Promise<void> { return Promise.resolve(); }
export function unlockAudio() {}
export function playCorrect() {}
export function playWrong()   {}
export function playStreak()  {}
