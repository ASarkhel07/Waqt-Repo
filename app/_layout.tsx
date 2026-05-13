// URL polyfill must come first so Supabase's fetch/URL calls work on React Native
import 'react-native-url-polyfill/auto';

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import type { Session } from '@supabase/supabase-js';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';

// ─── Auth guard ───────────────────────────────────────────────────────────────
// Watches the Supabase session and redirects between /auth and /(tabs).
// Must be called inside the navigation context (i.e. inside the Stack).

function AuthGate({ session, initialized }: { session: Session | null; initialized: boolean }) {
  const segments   = useSegments();
  const router     = useRouter();

  useEffect(() => {
    if (!initialized) return;

    const onAuthScreen = segments[0] === 'auth';

    // AUTH BYPASS: disabled for testing — re-enable before shipping
    // if (!session && !onAuthScreen) {
    //   router.replace('/auth');
    // } else if (session && onAuthScreen) {
    //   router.replace('/(tabs)');
    // }
    if (session && onAuthScreen) {
      router.replace('/(tabs)');
    }
  }, [session, segments, initialized]);

  return null;
}

// ─── Root layout ──────────────────────────────────────────────────────────────

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [session,     setSession]     = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // AUTH BYPASS: skip waiting on getSession so the app loads immediately
    setInitialized(true);
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    // Keep session in sync across the app's lifetime
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Blank screen while we're checking AsyncStorage — avoids a flash
  if (!initialized) {
    return <View style={{ flex: 1, backgroundColor: '#090921' }} />;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)"      options={{ headerShown: false }} />
        <Stack.Screen name="auth"        options={{ headerShown: false }} />
        <Stack.Screen name="photo-entry" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="note-entry"   options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="audio-entry"  options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="modal"       options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>

      {/* Rendered inside the Stack so useSegments/useRouter work correctly */}
      <AuthGate session={session} initialized={initialized} />

      <StatusBar style="light" />
    </ThemeProvider>
  );
}
