/**
 * Sign in.
 *
 * Follows the phone's theme. One field, one button, one sentence about how the
 * code works. No lock icons and no reassurance badges — the design is explicit
 * that trust comes from plain words here, not from security theatre.
 *
 * A code rather than a link: a link has to reopen the app, and a six-digit
 * number typed from the email works the same on every phone with nothing to
 * configure.
 *
 * Signing in is optional. It is what makes two phones share a household, and
 * nothing else — the app is complete without it, so a failure here offers to
 * carry on rather than blocking the way in.
 */

import { useState } from 'react'
import {
  ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SYNC_CONFIGURED, supabase } from '@/sync/client'
import { Body, gutter } from '@/ui/primitives'
import { useColors } from '@/ui/ThemeProvider'
import { radius } from '@/ui/theme'
import { cedi, fonts } from '@/ui/type'

type Stage = 'email' | 'code'

export default function SignIn() {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const [stage, setStage] = useState<Stage>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const address = email.trim()
  const validEmail = /.+@.+\..+/.test(address)
  const validCode = code.trim().length >= 6

  function onward() {
    router.push({ pathname: '/onboarding/household', params: { email: address } })
  }

  async function sendCode() {
    if (supabase === null) return onward()
    setBusy(true)
    setError(null)
    try {
      const { error: failure } = await supabase.auth.signInWithOtp({
        email: address,
        options: { shouldCreateUser: true },
      })
      if (failure) throw failure
      setStage('code')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function verifyCode() {
    if (supabase === null) return onward()
    setBusy(true)
    setError(null)
    try {
      const { error: failure } = await supabase.auth.verifyOtp({
        email: address,
        token: code.trim(),
        type: 'email',
      })
      if (failure) throw failure
      onward()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const ready = stage === 'email' ? validEmail : validCode
  const label = stage === 'email'
    ? SYNC_CONFIGURED ? 'Email me a code' : 'Continue with this email'
    : 'Verify and continue'

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
          {stage === 'email' ? (
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={c.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!busy}
              style={{ fontFamily: fonts.body, fontSize: 14, color: c.ink, padding: 0 }}
            />
          ) : (
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="6-digit code"
              placeholderTextColor={c.muted}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              maxLength={8}
              editable={!busy}
              style={{
                fontFamily: fonts.archivo700, fontSize: 20, color: c.ink,
                padding: 0, letterSpacing: 4,
              }}
            />
          )}
        </View>

        <Pressable
          disabled={!ready || busy}
          onPress={() => void (stage === 'email' ? sendCode() : verifyCode())}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: ready && !busy ? c.gold : c.sunken,
              opacity: pressed && ready ? 0.85 : 1,
            },
          ]}
        >
          {busy ? (
            <ActivityIndicator color={c.goldInk} />
          ) : (
            <Text
              style={{
                fontFamily: fonts.archivo700, fontSize: 13.5,
                color: ready ? c.goldInk : c.zero,
              }}
            >
              {label}
            </Text>
          )}
        </Pressable>

        {error !== null && (
          <>
            <Body size={11.5} style={{ marginTop: 12, maxWidth: 300, color: c.spent }}>
              {error}
            </Body>
            {/* Sync is the only thing an account buys, so a failure here is
                not a locked door. */}
            <Pressable onPress={onward} style={{ marginTop: 10 }}>
              <Text style={{ fontFamily: fonts.bodySemi, fontSize: 12.5, color: c.gold }}>
                Continue on this phone only →
              </Text>
            </Pressable>
          </>
        )}

        {stage === 'code' && error === null && (
          <Body size={11.5} style={{ marginTop: 14, maxWidth: 300 }}>
            We sent a six-digit code to {address}. It expires in an hour.
          </Body>
        )}

        {stage === 'email' && error === null && (
          <Body size={11.5} style={{ marginTop: 14, maxWidth: 300 }}>
            {SYNC_CONFIGURED
              ? 'No password to lose. The code signs you in and lets a second phone share this household.'
              : 'No password to lose. The email is your identity on this phone.'}
          </Body>
        )}
      </View>

      <View style={[gutter, styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <Body size={11}>
          {SYNC_CONFIGURED ? 'Saved on this phone, then synced' : 'Data stays on this phone'}
        </Body>
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
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center', minHeight: 52,
  },
  footer: { flexDirection: 'row', justifyContent: 'space-between' },
})
