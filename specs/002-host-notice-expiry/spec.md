# Recovery notification expiry

The informational “Native MIDI presence recovered.” notice must disappear after four seconds in both standalone and workspace shells. A later warning must remain visible; dismissing/replacing a notice or unmounting must cancel its pending expiry. Expiry does not change connection state. Existing notices without an explicit transient policy remain persistent.
