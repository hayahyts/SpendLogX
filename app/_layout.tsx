import { useEffect } from 'react'
import { View } from 'react-native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StoreProvider } from '@/store/store'
import { initialState } from '@/store/demo'
import { ThemeProvider, useAppFonts, useColors } from '@/ui/ThemeProvider'
import { ToastHost } from '@/ui/Toast'

void SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const { loaded, error } = useAppFonts()

  useEffect(() => {
    if (loaded || error) void SplashScreen.hideAsync()
  }, [loaded, error])

  if (!loaded && !error) return null

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StoreProvider initial={initialState()}>
          <ToastHost>
            <Shell />
          </ToastHost>
        </StoreProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}

function Shell() {
  const c = useColors()
  return (
    <View style={{ flex: 1, backgroundColor: c.ground }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: c.ground },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="add"
          options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
        />
      </Stack>
      <StatusBar style="auto" />
    </View>
  )
}
