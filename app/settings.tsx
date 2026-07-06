import { RadialBackground } from '@/components/radial-background';
import { getBiometricUnlockEnabled, setBiometricUnlockEnabled } from '@/lib/biometric-preference';
import { checkBiometricSupport, getBiometricLabel, promptBiometricAuth } from '@/lib/local-authentication';
import { supabase } from '@/lib/supabase';
import { Cabin_400Regular, Cabin_700Bold } from '@expo-google-fonts/cabin';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── Constants ────────────────────────────────────────────────────────────────

const PEACH  = '#FFD5B0';
const ORANGE = '#F2A65A';


// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const [fontsLoaded] = useFonts({
    'Cabin-Bold':    Cabin_700Bold,
    'Cabin-Regular': Cabin_400Regular,
  });

  // ── Notification toggles ──
  const [dailyReminder,   setDailyReminder]   = useState(false);
  const [weeklyDigest,    setWeeklyDigest]    = useState(false);

  // ── Biometric / Security state ──
  const [biometricEnabled,   setBiometricEnabled]   = useState(false);
  const [biometricLabel,     setBiometricLabel]     = useState('Biometric unlock');
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricEnrolled,  setBiometricEnrolled]  = useState(false);

  // ── Display name state ──
  const [displayName,   setDisplayName]   = useState('');
  const [initialName,   setInitialName]   = useState<string | null>(null);
  const [emailFallback, setEmailFallback] = useState<string | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [success,       setSuccess]       = useState<string | null>(null);

  // ── Load biometric settings on mount ──
  useEffect(() => {
    async function loadBiometric() {
      const [enabled, label, support] = await Promise.all([
        getBiometricUnlockEnabled(),
        getBiometricLabel(),
        checkBiometricSupport(),
      ]);
      setBiometricEnabled(enabled);
      setBiometricLabel(label);
      setBiometricSupported(support.supported);
      setBiometricEnrolled(support.enrolled);
    }
    loadBiometric();
  }, []);

  // ── Handle biometric toggle ──
  const handleBiometricToggle = useCallback(async (value: boolean) => {
    if (!value) {
      await setBiometricUnlockEnabled(false);
      setBiometricEnabled(false);
      return;
    }
    if (!biometricEnrolled) {
      Alert.alert(
        'No biometrics enrolled',
        `Please set up ${biometricLabel} in your device settings first.`,
      );
      return;
    }
    const result = await promptBiometricAuth(`Enable ${biometricLabel} for Waqt`);
    if (result.success) {
      await setBiometricUnlockEnabled(true);
      setBiometricEnabled(true);
    }
  }, [biometricEnrolled, biometricLabel]);

  // ── Fetch profile on mount ──
  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) {
        if (!cancelled) setError('You must be signed in.');
        setLoading(false);
        return;
      }
      setEmailFallback(user.email?.split('@')[0] ?? null);
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      if (!cancelled) {
        if (fetchError) {
          setError(fetchError.message);
        } else {
          const name = data?.full_name ?? null;
          setInitialName(name);
          setDisplayName(name ?? '');
        }
        setLoading(false);
      }
    }
    loadProfile();
    return () => { cancelled = true; };
  }, []);

  // ── Save handler ──
  const handleSave = useCallback(async () => {
    setError(null);
    setSuccess(null);
    const trimmed = displayName.trim();
    if (trimmed.length > 50) return;
    const valueToSave = trimmed.length === 0 ? null : trimmed;
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    if (!user) {
      setError('You must be signed in.');
      setSaving(false);
      return;
    }
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ full_name: valueToSave })
      .eq('id', user.id);
    if (updateError) {
      setError(updateError.message);
    } else {
      setInitialName(valueToSave);
      setDisplayName(valueToSave ?? '');
      setSuccess('Display name saved.');
    }
    setSaving(false);
  }, [displayName]);

  const trimmed = displayName.trim();
  const isSaveDisabled =
    saving ||
    loading ||
    (trimmed === (initialName ?? ''));

  if (!fontsLoaded) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      <RadialBackground />
      <StatusBar style="light" />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={10}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >

            {/* ── Header ── */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => router.back()}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.backBtn}
              >
                <Ionicons name="chevron-back" size={30} color="white" />
              </TouchableOpacity>
              <Text style={styles.pageTitle}>Settings</Text>
            </View>

            {/* ── Account section ── */}
            <View style={[styles.section, { marginBottom: 16 }]}>
              <Text style={styles.sectionTitle}>Account</Text>

              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <Ionicons name="person-outline" size={24} color={ORANGE} />
                  <Text style={styles.rowLabel}>Display name</Text>
                </View>
              </View>

              {loading ? (
                <ActivityIndicator color={ORANGE} style={{ marginVertical: 12 }} />
              ) : (
                <TextInput
                  style={styles.textInput}
                  value={displayName}
                  onChangeText={text => {
                    setDisplayName(text);
                    setSuccess(null);
                    setError(null);
                  }}
                  placeholder={emailFallback ?? 'Your name'}
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  maxLength={50}
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={isSaveDisabled ? undefined : handleSave}
                />
              )}

              <TouchableOpacity
                style={[styles.saveBtn, isSaveDisabled && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={isSaveDisabled}
                activeOpacity={0.75}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.saveBtnText}>Save</Text>
                )}
              </TouchableOpacity>

              {!!error && (
                <Text style={styles.errorText}>{error}</Text>
              )}
              {!!success && (
                <Text style={styles.successText}>{success}</Text>
              )}
            </View>

            {/* ── Security section ── */}
            <View style={[styles.section, { marginBottom: 16 }]}>
              <Text style={styles.sectionTitle}>Security</Text>

              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <Ionicons name="lock-closed-outline" size={24} color={ORANGE} />
                  <Text style={styles.rowLabel}>{biometricLabel}</Text>
                </View>
                <Switch
                  value={biometricEnabled}
                  onValueChange={handleBiometricToggle}
                  trackColor={{ false: 'rgba(255,255,255,0.15)', true: ORANGE }}
                  thumbColor="white"
                  disabled={!biometricSupported}
                />
              </View>

              {!biometricSupported && (
                <Text style={styles.helperText}>
                  Biometric authentication is not available on this device.
                </Text>
              )}
              {biometricSupported && !biometricEnrolled && (
                <Text style={styles.helperText}>
                  No biometrics enrolled. Set up {biometricLabel} in device settings to enable this.
                </Text>
              )}
            </View>

            {/* ── Notifications section ── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notifications</Text>

              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <Ionicons name="notifications-outline" size={24} color={ORANGE} />
                  <Text style={styles.rowLabel}>Daily reminder</Text>
                </View>
                <Switch
                  value={dailyReminder}
                  onValueChange={setDailyReminder}
                  trackColor={{ false: 'rgba(255,255,255,0.15)', true: ORANGE }}
                  thumbColor="white"
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <Ionicons name="mail-outline" size={24} color={ORANGE} />
                  <Text style={styles.rowLabel}>Weekly digest</Text>
                </View>
                <Switch
                  value={weeklyDigest}
                  onValueChange={setWeeklyDigest}
                  trackColor={{ false: 'rgba(255,255,255,0.15)', true: ORANGE }}
                  thumbColor="white"
                />
              </View>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090921',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 36,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 8,
  },
  backBtn: {
    marginRight: 4,
  },
  pageTitle: {
    fontFamily: 'Cabin-Bold',
    color: PEACH,
    fontSize: 36,
    letterSpacing: 0.2,
  },

  // ── Section ──
  section: {
    marginHorizontal: 22,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 14,
  },
  sectionTitle: {
    fontFamily: 'Cabin-Bold',
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  rowLabel: {
    fontFamily: 'Cabin-Bold',
    color: 'white',
    fontSize: 17,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },

  // ── Display name input ──
  textInput: {
    fontFamily: 'Cabin-Regular',
    color: 'white',
    fontSize: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginBottom: 12,
  },

  // ── Save button ──
  saveBtn: {
    backgroundColor: ORANGE,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    fontFamily: 'Cabin-Bold',
    color: 'white',
    fontSize: 16,
  },

  // ── Helper text ──
  helperText: {
    fontFamily: 'Cabin-Regular',
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 6,
    lineHeight: 17,
  },

  // ── Feedback ──
  errorText: {
    fontFamily: 'Cabin-Regular',
    color: '#FF8A80',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  successText: {
    fontFamily: 'Cabin-Regular',
    color: PEACH,
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
});
