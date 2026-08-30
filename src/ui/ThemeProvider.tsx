/**
 * Theme plumbing. Follows the phone; the add sheet opts out and stays dark.
 */

import { createContext, useContext, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import { useFonts } from 'expo-font'
import {
  PublicSans_400Regular, PublicSans_600SemiBold,
} from '@expo-google-fonts/public-sans'
import { type Palette, dark, light, sheet } from './theme'

const ThemeContext = createContext<{ c: Palette; scheme: 'light' | 'dark' }>({
  c: light,
  scheme: 'light',
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  return (
    <ThemeContext.Provider value={{ c: scheme === 'dark' ? dark : light, scheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

/** Forces the dark composition regardless of the phone. Used by the add sheet. */
export function SheetTheme({ children }: { children: ReactNode }) {
  return (
    <ThemeContext.Provider value={{ c: sheet, scheme: 'dark' }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

/** Just the palette, which is what almost every component wants. */
export function useColors(): Palette {
  return useContext(ThemeContext).c
}

/**
 * Archivo at four weights and three widths, plus Public Sans.
 *
 * The width instances are cut from the variable font at build time because RN
 * cannot vary an axis at runtime — see `scripts/build-fonts.ts`.
 */
export function useAppFonts() {
  const [loaded, error] = useFonts({
    Archivo_600: require('../../assets/fonts/Archivo-w100-600.ttf'),
    Archivo_700: require('../../assets/fonts/Archivo-w100-700.ttf'),
    Archivo_800: require('../../assets/fonts/Archivo-w100-800.ttf'),
    Archivo_900: require('../../assets/fonts/Archivo-w100-900.ttf'),
    Archivo105_600: require('../../assets/fonts/Archivo-w105-600.ttf'),
    Archivo112_800: require('../../assets/fonts/Archivo-w112-800.ttf'),
    Archivo125_900: require('../../assets/fonts/Archivo-w125-900.ttf'),
    PublicSans_400Regular,
    PublicSans_600SemiBold,
  })
  return { loaded, error }
}
