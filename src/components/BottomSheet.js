import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Dimensions, TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../theme';

const { height: SH } = Dimensions.get('window');

/**
 * Reusable bottom action sheet + confirm dialog.
 *
 * Usage — Action Sheet:
 *   <BottomSheet visible={show} onClose={() => setShow(false)}
 *     actions={[
 *       { label: 'Edit', icon: 'pencil-outline', onPress: handleEdit },
 *       { label: 'Delete', icon: 'delete-outline', onPress: handleDelete, destructive: true },
 *     ]}
 *   />
 *
 * Usage — Confirm Dialog:
 *   <BottomSheet visible={show} onClose={() => setShow(false)}
 *     confirm={{
 *       title: 'Delete Post',
 *       message: 'This action cannot be undone.',
 *       confirmLabel: 'Delete',
 *       destructive: true,
 *       onConfirm: handleDelete,
 *     }}
 *   />
 */
const BottomSheet = ({ visible, onClose, actions, confirm, title }) => {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SH)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
    } else {
      slideAnim.setValue(SH);
    }
  }, [visible]);

  const close = () => {
    Animated.timing(slideAnim, { toValue: SH, duration: 200, useNativeDriver: true }).start(() => onClose());
  };

  if (!visible) return null;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={close}>
      <TouchableWithoutFeedback onPress={close}>
        <View style={s.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View style={[s.sheet, { paddingBottom: insets.bottom + 16, transform: [{ translateY: slideAnim }] }]}>
              <View style={s.handle} />

              {/* ── Action Sheet Mode ── */}
              {actions && !confirm && (
                <>
                  {title && <Text style={s.sheetTitle}>{title}</Text>}
                  {actions.map((action, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[s.actionRow, i === 0 && { marginTop: 4 }]}
                      activeOpacity={0.6}
                      onPress={() => { close(); setTimeout(() => action.onPress?.(), 300); }}
                    >
                      {action.icon && (
                        <View style={[s.iconWrap, action.destructive && s.iconDestructive]}>
                          <MaterialCommunityIcons
                            name={action.icon}
                            size={20}
                            color={action.destructive ? COLORS.DANGER : COLORS.TEXT}
                          />
                        </View>
                      )}
                      <Text style={[s.actionLabel, action.destructive && s.destructiveLabel]}>
                        {action.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={s.cancelBtn} onPress={close} activeOpacity={0.7}>
                    <Text style={s.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* ── Confirm Dialog Mode ── */}
              {confirm && (
                <View style={s.confirmWrap}>
                  <View style={[s.confirmIcon, confirm.destructive && { backgroundColor: COLORS.DANGER + '15' }]}>
                    <MaterialCommunityIcons
                      name={confirm.destructive ? 'alert-circle-outline' : 'help-circle-outline'}
                      size={32}
                      color={confirm.destructive ? COLORS.DANGER : COLORS.ACCENT}
                    />
                  </View>
                  <Text style={s.confirmTitle}>{confirm.title}</Text>
                  {confirm.message && <Text style={s.confirmMsg}>{confirm.message}</Text>}
                  <View style={s.confirmBtns}>
                    <TouchableOpacity style={s.confirmCancel} onPress={close} activeOpacity={0.7}>
                      <Text style={s.confirmCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.confirmAction, confirm.destructive && s.confirmDestructive]}
                      activeOpacity={0.7}
                      onPress={() => { close(); setTimeout(() => confirm.onConfirm?.(), 300); }}
                    >
                      <Text style={[s.confirmActionText, confirm.destructive && { color: '#fff' }]}>
                        {confirm.confirmLabel || 'Confirm'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: COLORS.OVERLAY, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.CARD, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.SURFACE, alignSelf: 'center', marginBottom: 16 },

  sheetTitle: { fontSize: 16, fontWeight: '700', color: COLORS.TEXT, textAlign: 'center', marginBottom: 12 },

  // Action rows
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: COLORS.BORDER,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.SURFACE,
    alignItems: 'center', justifyContent: 'center',
  },
  iconDestructive: { backgroundColor: COLORS.DANGER + '12' },
  actionLabel: { fontSize: 16, fontWeight: '600', color: COLORS.TEXT },
  destructiveLabel: { color: COLORS.DANGER },

  cancelBtn: {
    marginTop: 12, paddingVertical: 14, borderRadius: 14,
    backgroundColor: COLORS.SURFACE, alignItems: 'center',
  },
  cancelText: { fontSize: 16, fontWeight: '600', color: COLORS.TEXT_MUTED },

  // Confirm dialog
  confirmWrap: { alignItems: 'center', paddingVertical: 8 },
  confirmIcon: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.ACCENT + '15',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  confirmTitle: { fontSize: 18, fontWeight: '800', color: COLORS.TEXT, marginBottom: 8 },
  confirmMsg: { fontSize: 14, color: COLORS.TEXT_MUTED, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  confirmBtns: { flexDirection: 'row', gap: 12, width: '100%' },
  confirmCancel: {
    flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: COLORS.SURFACE, alignItems: 'center',
  },
  confirmCancelText: { fontSize: 15, fontWeight: '600', color: COLORS.TEXT_MUTED },
  confirmAction: {
    flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: COLORS.ACCENT, alignItems: 'center',
  },
  confirmDestructive: { backgroundColor: COLORS.DANGER },
  confirmActionText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

export default React.memo(BottomSheet);
