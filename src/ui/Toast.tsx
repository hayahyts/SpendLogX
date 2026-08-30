/**
 * The save confirmation.
 *
 * Save dismisses the sheet immediately — no spinner anywhere in this app — and
 * this rises from the bottom to say what happened, with an Undo that actually
 * reverses it. Auto-dismisses after 4.2s.
 */

import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type ReactNode,
} from 'react'
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import { useStore } from '@/store/store'
import { dark } from './theme'
import { motion, radius } from './theme'
import { fonts, micro } from './type'

interface ToastApi {
  show: (message: string, undoTxnId?: string) => void
}

const ToastContext = createContext<ToastApi>({ show: () => {} })

export function useToast(): ToastApi {
  return useContext(ToastContext)
}

export function ToastHost({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; undoId?: string } | null>(null)
  const { deleteTxn } = useStore()
  const rise = useRef(new Animated.Value(0)).current
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((message: string, undoTxnId?: string) => {
    setToast(undoTxnId === undefined ? { message } : { message, undoId: undoTxnId })
  }, [])

  useEffect(() => {
    if (toast === null) return
    rise.setValue(0)
    Animated.timing(rise, {
      toValue: 1, duration: motion.toast, useNativeDriver: true,
    }).start()
    timer.current = setTimeout(() => setToast(null), motion.toastDwell)
    return () => {
      if (timer.current !== null) clearTimeout(timer.current)
    }
  }, [toast, rise])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast !== null && (
        <Animated.View
          style={[
            styles.toast,
            {
              opacity: rise,
              transform: [
                { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
                { scale: rise.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
              ],
            },
          ]}
        >
          <View style={styles.check}>
            <Text style={{ fontFamily: fonts.archivo700, fontSize: 11, color: dark.ground }}>✓</Text>
          </View>
          <Text style={styles.message} numberOfLines={2}>{toast.message}</Text>
          {toast.undoId !== undefined && (
            <Pressable
              onPress={() => {
                if (toast.undoId !== undefined) deleteTxn(toast.undoId)
                setToast(null)
              }}
              hitSlop={10}
            >
              <Text style={[micro(10, 0.14), { color: dark.gold }]}>undo</Text>
            </Pressable>
          )}
        </Animated.View>
      )}
    </ToastContext.Provider>
  )
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute', left: 16, right: 16, bottom: 104,
    flexDirection: 'row', alignItems: 'center', gap: 11,
    backgroundColor: dark.ground,
    borderRadius: radius.rowGroupLarge,
    paddingVertical: 13, paddingHorizontal: 16,
  },
  check: {
    width: 20, height: 20, borderRadius: 999,
    backgroundColor: dark.gold, alignItems: 'center', justifyContent: 'center',
  },
  message: { flex: 1, fontFamily: fonts.body, fontSize: 12.5, color: dark.ink },
})
