import { currentDevice } from './devices'

// Front-panel names and positions of the current model (src/device-bcr32.ts), for the panel, the PDF sheet, the Cubase
// script and rectangle selection.
export const { encoderNames, buttonNames } = currentDevice.panel
export const encoderPosition = (id: number) => currentDevice.panel.encoderPosition(id)
export const buttonPosition = (order: number) => currentDevice.panel.buttonPosition(order)
export const extraButtonPosition = (id: number) => currentDevice.panel.extraButtonPosition(id)
