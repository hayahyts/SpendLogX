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
        {/* Pickers open over the add sheet and inherit its dark composition. */}
        <Stack.Screen
          name="picker/category"
          options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="picker/person"
          options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
        />
        {/* Detail screens push over the tabs with a rise and fade. */}
        <Stack.Screen name="txn/[id]" options={{ animation: 'fade_from_bottom' }} />
        <Stack.Screen name="person/[id]" options={{ animation: 'fade_from_bottom' }} />
        <Stack.Screen name="category/[id]" options={{ animation: 'fade_from_bottom' }} />
      </Stack>
      <StatusBar style="auto" />
    </View>
  )
}
