import { integer } from './firmware-codec'

// Default table initialised by firmware 1.0.2 at 0x0803277C, dispatched at 0x0803186C.
// Values may be reconfigured on the device. These builders are offline; no MIDI sender uses them.
export const zaqRemoteDefaults = [
  [0, 0, 0, 127, 'pattern'], [1, 1, 0, 63, 'pattern-high'], [2, 2, 0, 127, 'pattern-quantized'], [3, 3, 0, 63, 'pattern-high-quantized'],
  [4, 4, 0, 1, 'transport'], [4, 4, 2, 2, 'transport-action'], [5, 5, 0, 7, 'track-mute'], [6, 6, 0, 127, 'voice-mute'],
  [7, 7, 0, 7, 'track-roll'], [7, 7, 53, 53, 'rolls-off'], [8, 8, 0, 127, 'voice-roll'],
  [9, 9, 0, 127, 'track-bound-6a'], [10, 10, 0, 127, 'track-bound-6b'], [11, 11, 0, 127, 'track-offset'],
  [12, 12, 0, 19, 'direction-code'], [13, 13, 0, 39, 'division-code'], [13, 13, 40, 79, 'division-reordered'],
  [14, 15, 0, 127, 'step-rest'], [16, 17, 0, 127, 'step-mask'], [4, 4, 3, 3, 'action-08035b18'], [4, 4, 4, 4, 'action-08035ab4'],
  [7, 7, 8, 16, 'roll-quantization-all'], [7, 7, 17, 52, 'roll-quantization-track'], [18, 20, 0, 127, 'tempo'],
  [21, 21, 0, 16, 'scale'], [22, 22, 0, 11, 'scale-base'], [23, 23, 0, 31, 'track-operation'],
] as const
export const zaqRemoteChannel = (channel: number, cc: number, value: number) => [0xb0 + integer(channel, 1, 16) - 1, integer(cc, 0, 127), integer(value, 0, 127)]
export function zaqTempoPreview(channel: number, bpm: number): number[] {
  integer(bpm, 30, 300)
  const n = bpm + 76
  return zaqRemoteChannel(channel, 18 + Math.floor(n / 128), n % 128)
}
export function zaqStepFlagPreview(channel: number, track: number, step: number, on: boolean, kind: 'rest' | 'mask'): number[] {
  integer(track, 0, 3); integer(step, 0, 31)
  if (typeof on !== 'boolean' || kind !== 'rest' && kind !== 'mask') throw Error('Invalid step flag')
  return zaqRemoteChannel(channel, (kind === 'rest' ? 14 : 16) + Math.floor(track / 2), track % 2 * 64 + step * 2 + Number(on))
}
