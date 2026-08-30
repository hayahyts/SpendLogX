/**
 * Household setup — step 1 of 2.
 *
 * Two steps, not three: the design's third step reported an import, and this
 * app imports nothing. Onboarding ends at accounts.
 */

import { useRef, useState } from 'react'
import {
  ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInput as TI,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  newHouseholdId, newInviteCode, newLocalUserId, useStore,
} from '@/store/store'
import { supabase } from '@/sync/client'
import { joinHousehold } from '@/sync/transport'
import { Body, Micro, gutter } from '@/ui/primitives'
import { useColors } from '@/ui/ThemeProvider'
import { radius } from '@/ui/theme'
import { fonts } from '@/ui/type'

const CODE_LENGTH = 6

export default function HouseholdSetup() {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const { email } = useLocalSearchParams<{ email?: string }>()
  const { state, completeOnboarding } = useStore()
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [name, setName] = useState('')
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const boxes = useRef<(TI | null)[]>([])

  const ready = mode === 'create' ? name.trim() !== '' : code.every((x) => x !== '')
  const address = email ?? 'you@this-phone'

  /**
   * Creating mints the household here; joining takes it from the server,
   * name and code included, so the second phone cannot overwrite the first
   * phone's household with its own placeholder on its first push.
   */
  async function proceed() {
    // Signing out and back in walks this path again; the household already
    // exists then, so it is not recreated.
    if (state.members.length > 0) return router.push('/onboarding/accounts')

    setBusy(true)
    setError(null)
    try {
      const userId = supabase === null
        ? newLocalUserId()
        : (await supabase.auth.getSession()).data.session?.user.id ?? newLocalUserId()

      if (mode === 'create') {
        completeOnboarding({
          householdId: newHouseholdId(),
          householdName: name.trim(),
          inviteCode: newInviteCode(),
          email: address,
          userId,
          role: 'owner',
        })
      } else {
        if (supabase === null) throw new Error('Joining a household needs a connection.')
        const joined = await joinHousehold(
          supabase, code.join(''), address.split('@')[0] ?? 'Member',
        )
        completeOnboarding({
          householdId: joined.id,
          householdName: joined.name,
          inviteCode: joined.inviteCode,
          email: address,
          userId,
          role: 'member',
        })
      }
      router.push('/onboarding/accounts')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: c.ground, paddingTop: insets.top + 20 }]}>
      <View style={[gutter, { flex: 1 }]}>
        <Micro size={9}>Step 1 of 2</Micro>
        <Text style={{ fontFamily: fonts.archivo112_800, fontSize: 25, color: c.ink, marginTop: 10 }}>
          Who is in this?
        </Text>
        <Body size={12.5} style={{ marginTop: 8, maxWidth: 300 }}>
          A household shares one set of accounts and one set of balances. Both of
          you see the same figures.
        </Body>

        {/* create */}
        <Pressable
          onPress={() => setMode('create')}
          style={[
            styles.card,
            {
              backgroundColor: c.card,
              borderColor: mode === 'create' ? c.gold : 'transparent',
              borderWidth: mode === 'create' ? 2 : 2,
              marginTop: 26,
            },
          ]}
        >
          <View style={styles.cardHead}>
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 14, color: c.ink }}>
              Create a household
            </Text>
            {mode === 'create' && (
              <View style={[styles.check, { backgroundColor: c.gold }]}>
                <Text style={{ fontFamily: fonts.archivo700, fontSize: 11, color: c.goldInk }}>✓</Text>
              </View>
            )}
          </View>
          {mode === 'create' && (
            <View style={[styles.field, { backgroundColor: c.ground, marginTop: 14 }]}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Household name"
                placeholderTextColor={c.muted}
                style={{ fontFamily: fonts.body, fontSize: 13.5, color: c.ink, padding: 0 }}
              />
            </View>
          )}
        </Pressable>

        {/* join */}
        <Pressable
          onPress={() => setMode('join')}
          style={[
            styles.card,
            {
              backgroundColor: c.card,
              borderColor: mode === 'join' ? c.gold : 'transparent',
              borderWidth: 2, marginTop: 12,
            },
          ]}
        >
          <View style={styles.cardHead}>
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 14, color: c.ink }}>
              Join by invite
            </Text>
            {mode === 'join' && (
              <View style={[styles.check, { backgroundColor: c.gold }]}>
                <Text style={{ fontFamily: fonts.archivo700, fontSize: 11, color: c.goldInk }}>✓</Text>
              </View>
            )}
          </View>
          {mode === 'join' && (
            <View style={styles.codeRow}>
              {code.map((ch, i) => (
                <TextInput
                  key={i}
                  ref={(el) => { boxes.current[i] = el }}
                  value={ch}
                  maxLength={1}
                  autoCapitalize="characters"
                  onChangeText={(v) => {
                    const next = [...code]
                    next[i] = v.toUpperCase()
                    setCode(next)
                    if (v !== '' && i < CODE_LENGTH - 1) boxes.current[i + 1]?.focus()
                  }}
                  style={[
                    styles.codeBox,
                    { backgroundColor: c.ground, color: c.ink, borderColor: c.line },
                  ]}
                />
              ))}
            </View>
          )}
        </Pressable>
      </View>

      <View style={[gutter, { paddingBottom: insets.bottom + 20 }]}>
        {error !== null && (
          <Body size={12} style={{ marginBottom: 12, color: c.spent }}>
            {error}
          </Body>
        )}
        <Pressable
          disabled={!ready || busy}
          onPress={() => void proceed()}
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
              Continue to accounts
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  card: { borderRadius: radius.balanceCard, padding: 18 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  check: { width: 20, height: 20, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  field: { borderRadius: radius.field, paddingVertical: 13, paddingHorizontal: 14 },
  codeRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  codeBox: {
    flex: 1, height: 44, borderRadius: radius.field, borderWidth: 1,
    textAlign: 'center', fontFamily: fonts.archivo700, fontSize: 17,
  },
  button: {
    borderRadius: radius.fieldLarge, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center', minHeight: 52,
  },
})
