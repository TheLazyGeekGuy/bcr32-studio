#!/usr/bin/env node
'use strict'

// BCR-32 observation helper.  It never emits a configuration write.
// The sole output operation is the documented, read-only product query used by
// ControlTribe itself: F0 00 20 32 7F 64 00 F7.

const midi = require('@julusian/midi')

const DEFAULT_PORT = 'Behringer BCR-32  Behringer BCR-32'
const PRODUCT_QUERY = [0xf0, 0x00, 0x20, 0x32, 0x7f, 0x64, 0x00, 0xf7]
const SYSEX_PREFIX = PRODUCT_QUERY.slice(0, 6)

function hex(message) {
  return message.map((byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ')
}

function parseArgs(argv) {
  const options = { port: DEFAULT_PORT, channel: 1, ccBase: 0 }
  const positional = []
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--port' || arg === '--channel' || arg === '--cc-base') {
      const value = argv[++i]
      if (value === undefined) throw new Error(`Missing value after ${arg}`)
      if (arg === '--port') options.port = value
      if (arg === '--channel') options.channel = Number(value)
      if (arg === '--cc-base') options.ccBase = Number(value)
    } else if (arg === '--help' || arg === '-h') {
      options.help = true
    } else {
      positional.push(arg)
    }
  }
  options.command = positional[0] || 'help'
  if (!Number.isInteger(options.channel) || options.channel < 1 || options.channel > 16) {
    throw new Error('--channel must be between 1 and 16')
  }
  if (!Number.isInteger(options.ccBase) || options.ccBase < 0 || options.ccBase > 96) {
    throw new Error('--cc-base must be between 0 and 96')
  }
  return options
}

function getPorts(PortType) {
  const port = new PortType()
  const names = Array.from({ length: port.getPortCount() }, (_, index) => port.getPortName(index))
  return { port, names }
}

function selectPort(names, query, direction) {
  const matches = names
    .map((name, index) => ({ name, index }))
    .filter(({ name }) => name.toLowerCase().includes(query.toLowerCase()))
  if (matches.length === 1) return matches[0]
  if (matches.length === 0) throw new Error(`No MIDI ${direction} port matches "${query}"`)
  throw new Error(`Several MIDI ${direction} ports match "${query}": ${matches.map(({ name }) => name).join(' | ')}. Use --port to choose one.`)
}

function listPorts() {
  const inputs = getPorts(midi.Input)
  const outputs = getPorts(midi.Output)
  console.log('MIDI inputs (device → computer)')
  inputs.names.forEach((name, index) => console.log(`  [${index}] ${name}`))
  console.log('\nMIDI outputs (computer → device)')
  outputs.names.forEach((name, index) => console.log(`  [${index}] ${name}`))
}

function isBcrSysEx(message) {
  return message.length >= 8 && SYSEX_PREFIX.every((byte, index) => message[index] === byte) && message[0] === 0xf0 && message.at(-1) === 0xf7
}

function describe(message) {
  const status = message[0]
  if (isBcrSysEx(message)) {
    const command = message[6]
    if (command === 0x00 && message.length >= 13) {
      const data = message.slice(7, -1)
      // Same layout as parseFirmwareReply in src/web-midi.ts: 01 p1 p2 p3 p4 p5 -> p1.p4.p5 (one observed sample).
      if (data[0] === 0x01 && data.length === 6) return `BCR-32: product/firmware reply ${data[1]}.${data[4]}.${data[5]}, payload ${hex(data)}`
      if (data[0] === 0x01) return `BCR-32: product/firmware reply, payload ${hex(data)}`
    }
    return `BCR-32 SysEx, command 0x${command.toString(16).padStart(2, '0')}, payload ${hex(message.slice(7, -1)) || '(empty)'}`
  }
  const type = status & 0xf0
  const channel = (status & 0x0f) + 1
  if (type === 0xb0 && message.length >= 3) return `CC channel ${channel}, controller ${message[1]}, value ${message[2]}`
  if (type === 0x90 && message.length >= 3) return `Note On channel ${channel}, note ${message[1]}, velocity ${message[2]}`
  if (type === 0x80 && message.length >= 3) return `Note Off channel ${channel}, note ${message[1]}, velocity ${message[2]}`
  if (type === 0xc0 && message.length >= 2) return `Program Change channel ${channel}, program ${message[1]}`
  if (type === 0xe0 && message.length >= 3) return `Pitch Bend channel ${channel}, value ${(message[2] << 7) | message[1]}`
  return 'Undecoded MIDI message'
}

function openInput(options, callback) {
  const { port, names } = getPorts(midi.Input)
  const selected = selectPort(names, options.port, 'input')
  port.ignoreTypes(false, false, false)
  port.on('message', (_deltaTime, message) => callback(message))
  port.openPort(selected.index)
  return { port, selected }
}

function openOutput(options) {
  const { port, names } = getPorts(midi.Output)
  const selected = selectPort(names, options.port, 'output')
  port.openPort(selected.index)
  return { port, selected }
}

async function probe(options) {
  let input
  let output
  let timeout
  try {
    input = openInput(options, (message) => {
      if (!isBcrSysEx(message) || message[6] !== 0x00) return
      console.log(`← ${hex(message)}\n  ${describe(message)}`)
      process.exitCode = 0
      clearTimeout(timeout)
      setTimeout(close, 100)
    })
    output = openOutput(options)
    console.log(`Input: ${input.selected.name}\nOutput: ${output.selected.name}`)
    console.log(`→ ${hex(PRODUCT_QUERY)}\n  Product/firmware query (read-only) sent; waiting 1.5 s…`)
    output.port.sendMessage(PRODUCT_QUERY)
    timeout = setTimeout(() => {
      console.error('No product/firmware reply within 1.5 s. Check the cable, the port and that no other application holds the device.')
      process.exitCode = 2
      close()
    }, 1500)
    function close() {
      if (input) input.port.closePort()
      if (output) output.port.closePort()
    }
  } catch (error) {
    if (input) input.port.closePort()
    if (output) output.port.closePort()
    throw error
  }
}

function printPlan(options) {
  console.log(`Target plan: 32 encoders, 7-bit absolute CC, channel ${options.channel}, range 0–127`)
  console.log(' Encoder  CC  Type  Min value   Max value   Mode')
  for (let encoder = 1; encoder <= 32; encoder += 1) {
    const cc = options.ccBase + encoder - 1
    console.log(`${String(encoder).padStart(8)}  ${String(cc).padStart(2)}  CC${' '.repeat(4)}0${' '.repeat(11)}127${' '.repeat(9)}Absolute`)
  }
  console.log(`\nThis plan writes nothing to the BCR-32. In ControlTribe: Encoder N → Type CC, CH ${options.channel}, Param CC, Value 1 = 0, Value 2 = 127, Mode Absolute.`)
}

function monitor(options, walk) {
  const lastValues = Array(32).fill(null)
  let expected = 1
  const keepAlive = setInterval(() => {}, 1000)
  function close() {
    clearInterval(keepAlive)
    input.port.closePort()
  }
  const input = openInput(options, (message) => {
    const date = new Date(), two = (n) => String(n).padStart(2, '0')
    const now = `${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}.${String(date.getMilliseconds()).padStart(3, '0')}`
    console.log(`[${now}] ← ${hex(message)}\n  ${describe(message)}`)
    const status = message[0]
    const isExpectedChannelCc = (status & 0xf0) === 0xb0 && (status & 0x0f) + 1 === options.channel && message.length >= 3
    if (!isExpectedChannelCc) return
    if (!walk) {
      console.log('  Raw reception: no physical control ← CC mapping is assumed.')
      return
    }
    const encoder = message[1] - options.ccBase + 1
    if (encoder < 1 || encoder > 32) {
      console.log(`  Outside the CC plan ${options.ccBase}–${options.ccBase + 31}.`)
      return
    }
    lastValues[encoder - 1] = message[2]
    if (walk) {
      if (encoder === expected) {
        console.log(`  ✓ Encoder ${encoder} confirmed: CC ${message[1]}, value ${message[2]}.`)
        expected += 1
        if (expected === 33) {
          console.log('✓ All 32 encoders sent the expected mapping.')
          close()
          return
        }
        console.log(`  Now slowly turn encoder ${expected} (CC ${options.ccBase + expected - 1}).`)
      } else {
        console.log(`  ! Expected: encoder ${expected}, CC ${options.ccBase + expected - 1}. Received: CC ${message[1]} (planned encoder ${encoder}).`)
      }
    }
  })
  process.once('SIGINT', () => {
    close()
    process.exit(0)
  })
  console.log(`Listening: ${input.selected.name}`)
  if (walk) console.log(`Now slowly turn encoder ${expected} (CC ${options.ccBase}). Ctrl-C to stop.`)
  else console.log(`Monitor on: all incoming messages; channel ${options.channel} shown for reference only. No physical mapping is inferred. Ctrl-C to stop.`)
}

function usage() {
  console.log(`Usage: npm run midi -- <command> [options]

Commands
  ports     List the visible MIDI ports.
  probe     Send only the read-only product/firmware query.
  plan      Print the target CC grid (nothing is written to the device).
  monitor   Print every incoming MIDI message from the BCR-32.
  walk      Confirm the encoders one after the other, CC 0–31 by default.

Options
  --port <name>      Port name substring (default: exact BCR-32 name).
  --channel <1..16>  Expected channel (default: 1).
  --cc-base <0..96>  CC of encoder 1 (default: 0).

Examples
  npm run midi -- probe
  npm run midi -- plan
  npm run midi -- walk
  npm run midi -- monitor --channel 2 --cc-base 32`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help || options.command === 'help') return usage()
  if (options.command === 'ports') return listPorts()
  if (options.command === 'probe') return probe(options)
  if (options.command === 'plan') return printPlan(options)
  if (options.command === 'monitor') return monitor(options, false)
  if (options.command === 'walk') return monitor(options, true)
  throw new Error(`Unknown command: ${options.command}`)
}

main().catch((error) => {
  console.error(`Error: ${error.message}`)
  process.exitCode = 1
})
