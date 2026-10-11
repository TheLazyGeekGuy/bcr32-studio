export function estimateTurns(minimum: number, maximum: number, pulsesOnArc: number, arcPercent: number, pulsesPerStep: number) {
  if (![minimum, maximum, pulsesOnArc, arcPercent, pulsesPerStep].every(Number.isFinite) || pulsesOnArc <= 0 || arcPercent <= 0 || arcPercent > 100 || pulsesPerStep <= 0 || maximum < minimum) return null
  const steps = maximum - minimum
  const pulsesPerTurn = pulsesOnArc / (arcPercent / 100)
  return { steps, pulsesPerTurn, stepsPerTurn: pulsesPerTurn / pulsesPerStep, turns: steps * pulsesPerStep / pulsesPerTurn }
}

export function estimateResolution(minimum: number, maximum: number, incrementsPerTurn: number, leds = 21) {
  if (![minimum, maximum, incrementsPerTurn, leds].every(Number.isFinite) || maximum < minimum || incrementsPerTurn <= 0 || leds < 2 || !Number.isInteger(leds)) return null
  const steps = maximum - minimum
  return { steps, turns: steps / incrementsPerTurn, ledIntervals: leds - 1, stepsPerLed: steps / (leds - 1) }
}
