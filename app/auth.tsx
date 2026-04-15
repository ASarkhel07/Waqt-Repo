import { RadialBackground } from '@/components/radial-background';
import { supabase } from '@/lib/supabase';
import { Cabin_400Regular, Cabin_700Bold } from '@expo-google-fonts/cabin';
import { AntDesign, Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── Constants ────────────────────────────────────────────────────────────────

const PEACH  = '#FFD5B0';
const ORANGE = '#F2A65A';

// ─── TODO: Google OAuth ───────────────────────────────────────────────────────
// Wire this up once the Google Cloud OAuth client ID is ready.
//
// import * as AuthSession from 'expo-auth-session';
// import * as WebBrowser from 'expo-web-browser';
// WebBrowser.maybeCompleteAuthSession();
//
// async function signInWithGoogle() {
//   const redirectUri = AuthSession.makeRedirectUri({ scheme: 'waqtapp' });
//   const { data, error } = await supabase.auth.signInWithOAuth({
//     provider: 'google',
//     options: { redirectTo: redirectUri, skipBrowserRedirect: true },
//   });
//   if (error || !data.url) throw error ?? new Error('No OAuth URL returned');
//   const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
//   if (result.type === 'success') {
//     const url = result.url;
//     const get = (name: string) => url.match(new RegExp(`[#&?]${name}=([^&#]*)`))?.[ 1];
//     const access_token  = get('access_token');
//     const refresh_token = get('refresh_token');
//     if (access_token && refresh_token) {
//       await supabase.auth.setSession({ access_token, refresh_token });
//     }
//   }
// }

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AuthScreen() {
  const [fontsLoaded] = useFonts({
    'Cabin-Bold':    Cabin_700Bold,
    'Cabin-Regular': Cabin_400Regular,
  });

  const [mode,     setMode]     = useState<'login' | 'signup'>('signup');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [feedback, setFeedback] = useState('');

  function switchMode() {
    setMode(m => (m === 'login' ? 'signup' : 'login'));
    setFeedback('');
  }

  async function handleEmailAuth() {
    if (!email.trim() || !password) {
      setFeedback('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setFeedback('');
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) setFeedback(error.message);
        // On success the root layout's onAuthStateChange fires and redirects to /(tabs)
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) {
          setFeedback(error.message);
        } else {
          // Auto-create the profile row linked to the new auth user
          if (data.user) {
            await supabase.from('profiles').upsert({ id: data.user.id });
          }
          setFeedback('Account created! Check your email to confirm, then log in.');
        }
      }
    } finally {
      setLoading(false);
    }
  }

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
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >

            {/* ── Hero ──────────────────────────────────────────────────────── */}
            <View style={styles.hero}>
              {/* Decorative star at top-right, matching Figma */}
              <Text style={styles.starDecor}>✦</Text>
              <Text style={styles.appTitle}>Waqt</Text>
              <Text style={styles.tagline}>One moment. One day.</Text>
            </View>

            {/* ── Log In / Sign Up card ─────────────────────────────────────── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {mode === 'login' ? 'Log In' : 'Sign Up'}
              </Text>

              {/* Email */}
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="next"
              />
              <View style={styles.inputDivider} />

              {/* Password + submit arrow */}
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Password"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={handleEmailAuth}
                />
                <TouchableOpacity
                  style={styles.submitArrow}
                  onPress={handleEmailAuth}
                  disabled={loading}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Ionicons name="chevron-forward" size={22} color="white" />
                  )}
                </TouchableOpacity>
              </View>
              <View style={styles.inputDivider} />

              {/* Feedback / error message */}
              {!!feedback && (
                <Text style={styles.feedbackText}>{feedback}</Text>
              )}
            </View>

            {/* ── Toggle login ↔ signup ─────────────────────────────────────── */}
            <View style={styles.toggleRow}>
              <Text style={styles.toggleText}>
                {mode === 'login' ? "Don't Have an Account?" : 'Already Have an Account?'}
              </Text>
              <TouchableOpacity onPress={switchMode} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                <Text style={styles.toggleLink}>
                  {mode === 'login' ? ' sign up' : ' log in'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* ── Social buttons (non-functional until OAuth clients are ready) ── */}
            <TouchableOpacity
              style={[styles.socialButton, styles.socialButtonDisabled]}
              activeOpacity={0.78}
              disabled
            >
              <AntDesign name="google" size={24} color="white" style={styles.socialIcon} />
              <Text style={styles.socialButtonText}>Sign in with Google</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.socialButton, styles.socialButtonDisabled]}
              activeOpacity={0.78}
              disabled
            >
              <AntDesign name="apple" size={26} color="white" style={styles.socialIcon} />
              <Text style={styles.socialButtonText}>Sign in with Apple</Text>
            </TouchableOpacity>

            {/* ── Terms ─────────────────────────────────────────────────────── */}
            <View style={styles.termsContainer}>
              <Text style={styles.termsText}>
                By creating an account you agree to accept our
              </Text>
              <View style={styles.termsLinkRow}>
                <Text style={[styles.termsText, styles.termsLink]}>Terms of Service</Text>
                <Text style={styles.termsText}> and </Text>
                <Text style={[styles.termsText, styles.termsLink]}>Privacy Policy</Text>
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
    paddingHorizontal: 26,
    paddingBottom: 36,
  },

  // ── Hero ──
  hero: {
    paddingTop: 56,
    paddingBottom: 44,
  },
  starDecor: {
    position: 'absolute',
    top: 8,
    right: -8,
    fontSize: 90,
    color: ORANGE,
    opacity: 0.55,
    lineHeight: 100,
  },
  appTitle: {
    fontFamily: 'Cabin-Bold',
    color: PEACH,
    fontSize: 72,
    letterSpacing: -1,
  },
  tagline: {
    fontFamily: 'Cabin-Bold',
    color: ORANGE,
    fontSize: 20,
    marginTop: 4,
  },

  // ── Form card ──
  card: {
    backgroundColor: 'rgba(131,124,124,0.28)',
    borderRadius: 18,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 22,
    marginBottom: 20,
  },
  cardTitle: {
    fontFamily: 'Cabin-Bold',
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 18,
  },
  input: {
    fontFamily: 'Cabin-Bold',
    color: 'white',
    fontSize: 17,
    paddingVertical: 10,
  },
  inputDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginBottom: 12,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  submitArrow: {
    paddingLeft: 14,
    paddingVertical: 8,
  },
  feedbackText: {
    fontFamily: 'Cabin-Regular',
    color: PEACH,
    fontSize: 13,
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 18,
  },

  // ── Toggle ──
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 22,
  },
  toggleText: {
    fontFamily: 'Cabin-Bold',
    color: 'white',
    fontSize: 15,
  },
  toggleLink: {
    fontFamily: 'Cabin-Bold',
    color: ORANGE,
    fontSize: 15,
  },

  // ── Social buttons ──
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 25,
    height: 50,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  socialButtonDisabled: {
    opacity: 0.45,
  },
  socialIcon: {
    position: 'absolute',
    left: 22,
  },
  socialButtonText: {
    fontFamily: 'Cabin-Bold',
    color: 'white',
    fontSize: 18,
  },

  // ── Terms ──
  termsContainer: {
    alignItems: 'center',
    marginTop: 4,
    gap: 2,
  },
  termsLinkRow: {
    flexDirection: 'row',
  },
  termsText: {
    fontFamily: 'Cabin-Bold',
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    textAlign: 'center',
  },
  termsLink: {
    textDecorationLine: 'underline',
  },
});
