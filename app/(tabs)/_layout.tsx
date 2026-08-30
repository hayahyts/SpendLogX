/**
 * The tab shell.
 *
 * Tabs switch instantly — no transition — which is why this uses a plain Slot
 * with our own bar rather than a navigator that animates between them.
 */

import { usePathname, router, Slot } from 'expo-router'
import { View } from 'react-native'
import { TabBar, type TabKey } from '@/ui/TabBar'
import { useColors } from '@/ui/ThemeProvider'

const ROUTES: Record<TabKey, string> = {
  home: '/(tabs)/',
  log: '/(tabs)/log',
  report: '/(tabs)/report',
  people: '/(tabs)/people',
}

function activeFrom(pathname: string): TabKey {
  if (pathname.endsWith('/log')) return 'log'
  if (pathname.endsWith('/report')) return 'report'
  if (pathname.endsWith('/people')) return 'people'
  return 'home'
}

export default function TabsLayout() {
  const c = useColors()
  const pathname = usePathname()

  return (
    <View style={{ flex: 1, backgroundColor: c.ground }}>
      <Slot />
      <TabBar
        active={activeFrom(pathname)}
        onSelect={(k) => router.replace(ROUTES[k] as never)}
        onAdd={() => router.push('/add')}
      />
    </View>
  )
}
