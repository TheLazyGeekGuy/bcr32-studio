// Constants shared by the sequencer view and the MIDI import dialog.
export const trackColors = ['#5fbf6f', '#e08a3c', '#4f8fd9', '#5fbf6f']
export const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
export const noteName = (n: number) => noteNames[n % 12] + (Math.floor(n / 12) - 1)
// Computer keyboard as one octave, like most DAWs: white keys A S D F G H J K, black keys W E T Y U.
export const keyboardNotes: Record<string, number> = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12 }
export const stepGrids = [{ label: '1/4', divisor: 1 }, { label: '1/8', divisor: 2 }, { label: '1/16', divisor: 4 }, { label: '1/32', divisor: 8 }]
// Option lists from the BCR32 manual (Rev1). The order of the codes is deduced, not observed: note lengths follow the
// same list as the global quantization setting; clock dividers and directions are listed as the manual gives them.
export const noteLengths = ['96', 't32', '32', 't16', '16', 't8', '8', 't4', '4', 't2', '2', 't1b', '1b', 't2b', '2b', '4b']
export const clockDividers = [1, 2, 4, 8, 16, 32, 24, 12, 6, 3]
export const directions = ['Forward', 'Backward', 'Pip 0', 'Random', 'Pendulum']
