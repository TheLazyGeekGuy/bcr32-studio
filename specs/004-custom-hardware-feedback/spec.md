# Physical ring/value feedback for mouse-operated custom controls

Owner clarification: the expected destination is the BCR32 encoder8's physical ring/value. Alpha.19 emitted the programmed synthesizer payload to the BCR32 USB output, which does not establish a native encoder value update. This is not the requested acceptance.

Until a BCR32 current-value operation is identified and qualified, custom rotary/button/screen gestures must remain local preview and explicitly report unavailable hardware feedback. They must not send the external-instrument payload to BCR32 as a substitute or fabricate a fallback CC. Preserve the native `.tx` assignment, its local editing/export/STORE workflow, standard CC/NRPN value behavior and passive SysEx RX. Opening and simulation remain inert.

Success for the native feature remains pending a documented/observed setter and independent physical ring/value acceptance, without assignment rewrites. The scope delivered now is the correction of misleading output behavior and capability reporting, not implementation of an unknown hardware command.
