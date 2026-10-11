export const buttonNames = ['PITCH', 'VEL', 'MUTE', 'DELAY', 'LEN', 'CTRL α', 'CTRL β', 'WAVE', 'CHORD', 'SKIP', 'START', 'SEQ LEN', 'OFFSET', 'DIV', 'SHUFFLE', 'DIR', 'T1', 'T2', 'T3', 'T4', 'INST SEL', 'MIXER', 'LOOP', 'PLAY / STOP', 'FOOTSW 1', 'FOOTSW 2']
export const encoderNames = ['BPM', 'CLOCK', 'CLOCK OUT', 'MIDI THRU', 'NOTES', 'SCALE', 'ROOT', 'TRANSPOSE', 'WAVE / TRIG', 'GAIN / TRIG CC', 'RATE / QUANT', 'OFFSET / Q-MIX', 'MODE T1', 'MODE T2', 'MODE T3', 'MODE T4', 'UAB T1', 'CH T1', 'UAB T2', 'CH T2', 'UAB T3', 'CH T3', 'UAB T4', 'CH T4', 'CTRL α T1', 'CTRL β T1', 'CTRL α T2', 'CTRL β T2', 'CTRL α T3', 'CTRL β T3', 'CTRL α T4', 'CTRL β T4']
export const encoderPosition = (id: number) => ({ x: 107 + ((id - 1) % 8) * 161.4, y: 567 + Math.floor((id - 1) / 8) * 215.5 })
export const buttonPosition = (index: number) => index < 16
  ? { x: 37 + (index % 8) * 161.4, y: index < 8 ? 247 : 369, width: 140 }
  : { x: index % 2 ? 1583 : 1422, y: index < 18 ? 247 : 369, width: 96 }
