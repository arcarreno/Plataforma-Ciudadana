export const colors = {
  alabaster: '#EDEAE0',
  guinda: '#7d2447',
  guindaLight: '#a3325f',
  guindaDark: '#5c1a34',
  grayInstitutional: '#636569',
  alabasterDark: '#d5d2c8',
} as const

export const fontSizeOptions = ['normal', 'large', 'xlarge'] as const
export type FontSize = (typeof fontSizeOptions)[number]

export const fontSizeValues: Record<FontSize, string> = {
  normal: '100%',
  large: '150%',
  xlarge: '200%',
}

export const fontLabels: Record<FontSize, string> = {
  normal: 'A',
  large: 'A+',
  xlarge: 'A++',
}

export const contrastOptions = ['light', 'dark'] as const
export type Contrast = (typeof contrastOptions)[number]
