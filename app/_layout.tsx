import { useEffect, useMemo } from 'react'
import { View } from 'react-native'
import { Stack, router, usePathname } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StoreProvider, useAppState } from '@/store/store'
import { emptyState, isoDate } from '@/store/store'
import { DEMO_ENABLED, initialState } from '@/store/demo'
import { openPersistence } from '@/db/persist'
import { SyncProvider } from '@/sync/SyncProvider'
import { ThemeProvider, useAppFonts, useColors } from '@/ui/ThemeProvider'
import { ToastHost } from '@/ui/Toast'

void SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const { loaded, error } = useAppFonts()

  // Demo mode stays in memory so review data never lands in the real database.
  // Real mode opens SQLite, hydrates what is stored, and writes every action
  // through — which is what makes closing the app safe.
  const { initial, persist, db } = useMemo(() => {
    if (DEMO_ENABLED) return { initial: initialState(), persist: undefined, db: null }
    const today = isoDate(new Date().toISOString().slice(0, 10))
    const p = openPersistence(today)
    return {
      initial: p?.stored ?? emptyState(today),
      persist: p?.persist,
      db: p?.db ?? null,
    }
  }, [])

  useEffect(() => {
    if (loaded || error) void SplashScreen.hideAsync()
  }, [loaded, error])

  if (!loaded && !error) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <ThemeProvider>
        <StoreProvider initial={initial} persist={persist}>
          <SyncProvider db={db}>
            <ToastHost>
              <OnboardingGate />
              <Shell />
            </ToastHost>
          </SyncProvider>
        </StoreProvider>
      </ThemeProvider>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

/**
 * A fresh install has no household yet, and everything downstream assumes one:
 * route it to onboarding until sign-in and household setup have run.
 */
function OnboardingGate() {
  const state = useAppState()
  const pathname = usePathname()
  const needsOnboarding = !DEMO_ENABLED && state.members.length === 0

  useEffect(() => {
    if (needsOnboarding && !pathname.startsWith('/onboarding')) {
      router.replace('/onboarding/sign-in')
    }
  }, [needsOnboarding, pathname])

  return null
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
