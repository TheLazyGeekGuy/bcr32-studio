# Mouse-controlled SysEx values

The owner confirms encoder8 at `http://127.0.0.1:5187/editor/`, manipulated with the mouse. With value transmission enabled, an explicit rotary gesture must render the selected exact custom program with the chosen value and transmit its bytes to this editor's bound output. Example: `.tx $F0 $7D val $F7`, value87 → `F0 7D 57 F7`.

The same value path covers screen/slider gestures and pushes/buttons without merging assignments. Rapid rotations keep the latest value per control; button press/release retain order. Unknown/advanced programs remain local with an explicit reason. No emission on opening, selection, source changes, import, simulation, received MIDI, rebind, or enabling output. Lock, disable, rebind, source replacement and dispose cancel pending gestures. A later user gesture may use the new binding. No fallback CC or OFF is fabricated.

Transmitting payloads intended for another manufacturer is not a documented BCR32 ring-value setter. Delivery means verified bytes through the broker and monitor, not an acknowledgement from an external synth.
