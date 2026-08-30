/**
 * Sign in.
 *
 * Follows the phone's theme. One field, one button, one sentence about how the
 * link works. No lock icons and no reassurance badges — the design is explicit
 * that trust comes from plain words here, not from security theatre.
 */

import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Body, gutter } from '@/ui/primitives'
import { useColors } from '@/ui/ThemeProvider'
import { radius } from '@/ui/theme'
import { cedi, fonts } from '@/ui/type'

export default function SignIn() {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const [email, setEmail] = useState('')
  const valid = /.+@.+\..+/.test(email.trim())

  return (
    <View style={[styles.screen, { backgroundColor: c.ground, paddingTop: insets.top }]}>
      <View style={[gutter, styles.body]}>
        <Text style={[cedi(76), { color: c.gold, fontFamily: fonts.archivo125_900 }]}>₵</Text>

        <Text style={{ fontFamily: fonts.archivo112_800, fontSize: 30, color: c.ink, marginTop: 18 }}>
          SpendLogX
        </Text>
        <Body size={13} style={{ marginTop: 8, maxWidth: 280 }}>
          Where the money went, and what is left.
        </Body>

        <View style={[styles.field, { backgroundColor: c.card, marginTop: 34 }]}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={c.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            style={{ fontFamily: fonts.body, fontSize: 14, color: c.ink, padding: 0 }}
          />
        </View>

        <Pressable
          disabled={!valid}
          onPress={() =>
            router.push({ pathname: '/onboarding/household', params: { email: email.trim() } })
          }
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: valid ? c.gold : c.sunken,
              opacity: pressed && valid ? 0.85 : 1,
            },
          ]}
        >
          <Text
            style={{
              fontFamily: fonts.archivo700, fontSize: 13.5,
              color: valid ? c.goldInk : c.zero,
            }}
          >
            Continue with this email
          </Text>
        </Pressable>

        <Body size={11.5} style={{ marginTop: 14, maxWidth: 300 }}>
          No password to lose. The email is your identity on this phone; nothing
          is sent anywhere until syncing arrives.
        </Body>
      </View>

      <View style={[gutter, styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <Body size={11}>Data stays on device until it syncs</Body>
        <Body size={11}>Ghana · GHS</Body>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1, justifyContent: 'center' },
  field: { borderRadius: radius.fieldLarge, paddingVertical: 15, paddingHorizontal: 16 },
  button: {
    marginTop: 12, borderRadius: radius.fieldLarge,
    paddingVertical: 16, alignItems: 'center',
  },
  footer: { flexDirection: 'row', justifyContent: 'space-between' },
})
