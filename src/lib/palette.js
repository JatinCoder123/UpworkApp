export const PALETTE_KEY = 'pitchflow-palette'
// index.css holds the colours: lime is the base token set, :root[data-palette='blue'] redefines it.
// The swatch shows each palette's accent, surface and ink.
export const PALETTES = [
  { id: 'blue', name: 'Blue', note: 'Blue, white and black', swatch: ['#2563eb', '#ffffff', '#0b1220'] },
  { id: 'lime', name: 'Lime', note: 'The original olive and lime', swatch: ['#c8e875', '#f8f8f2', '#243126'] },
]
export const DEFAULT_PALETTE = 'blue'

export const storedPalette = () => {
  let stored = null
  try { stored = localStorage.getItem(PALETTE_KEY) } catch { stored = null }
  return PALETTES.some((palette) => palette.id === stored) ? stored : DEFAULT_PALETTE
}
