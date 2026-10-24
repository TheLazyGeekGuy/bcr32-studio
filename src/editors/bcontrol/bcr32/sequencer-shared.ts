// Constants shared by the sequencer view and the MIDI import dialog.
export const trackColors = ['#5fbf6f', '#e08a3c', '#4f8fd9', '#5fbf6f']
export const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
// Named like the BCR32 display (manual Rev1: octaves −2 to +8, default step C3 = MIDI 60), not like most DAWs (C4 = 60).
export const noteName = (n: number) => noteNames[n % 12] + (Math.floor(n / 12) - 2)
// Computer keyboard as one octave, like most DAWs: white keys A S D F G H J K, black keys W E T Y U.
export const keyboardNotes: Record<string, number> = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12 }
export const stepGrids = [{ label: '1/4', divisor: 1 }, { label: '1/8', divisor: 2 }, { label: '1/16', divisor: 4 }, { label: '1/32', divisor: 8 }]
// Option lists from the BCR32 manual (Rev1). The order of the codes is deduced, not observed: note lengths follow the
// same list as the global quantization setting; clock dividers and directions are listed as the manual gives them.
export const noteLengths = ['96', 't32', '32', 't16', '16', 't8', '8', 't4', '4', 't2', '2', 't1b', '1b', 't2b', '2b', '4b']
// Note delay in MIDI clock ticks (24 per quarter, BCR2000 Zaquencer manual 1.04 §6.4); the BCR32 panel offers −5…+5,
// one tick short of a 1/16 step (6 ticks), so a note never crosses its neighbour.
export const noteDelayRange = 5
export const clockDividers = [1, 2, 4, 8, 16, 32, 24, 12, 6, 3]
export const directions = ['Forward', 'Backward', 'Pip 0', 'Random', 'Pendulum']
