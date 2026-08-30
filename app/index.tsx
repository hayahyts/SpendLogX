/**
 * Placeholder shell. Screens are designed before they are built, so this exists
 * only to prove the app boots and the domain layer is reachable from it.
 */

import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { format, parseCedis } from '@/domain/money'
import { label, periodContaining, isoDate } from '@/domain/period'

export default function Index() {
  const today = isoDate(new Date().toISOString().slice(0, 10))
  const month = periodContaining('month', today)

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.body}>
        <Text style={styles.title}>SpendLogX</Text>
        <Text style={styles.meta}>{label(month)}</Text>
        <Text style={styles.amount}>{format(parseCedis('0'))}</Text>
        <Text style={styles.note}>Awaiting designs.</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 6 },
  title: { fontSize: 28, fontWeight: '700' },
  meta: { fontSize: 15, opacity: 0.6 },
  amount: { fontSize: 40, fontWeight: '600', fontVariant: ['tabular-nums'], marginTop: 12 },
  note: { fontSize: 14, opacity: 0.5, marginTop: 4 },
})
