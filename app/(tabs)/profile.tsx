import { RadialBackground } from '@/components/radial-background';
import { supabase } from '@/lib/supabase';
import { Cabin_700Bold } from '@expo-google-fonts/cabin';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── Colours (shared with other screens) ─────────────────────────────────────

const PEACH = '#FFD5B0';   // page titles
const ORANGE = '#F2A65A';  // accent text & icons

// ─── Menu items ───────────────────────────────────────────────────────────────

type MenuItem = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  children?: { label: string; icon: keyof typeof Ionicons.glyphMap }[];
};

const MENU_ITEMS: MenuItem[] = [
  { label: 'Stats', icon: 'bar-chart-outline' },
  {
    label: 'Settings',
    icon: 'settings-outline',
    children: [
      { label: 'Notifications', icon: 'notifications-outline' },
    ],
  },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const [fontsLoaded] = useFonts({ 'Cabin-Bold': Cabin_700Bold, ...Ionicons.font });
  const [fullName, setFullName] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      // Use saved name, or fall back to the part of the email before @
      setFullName(data?.full_name ?? user.email?.split('@')[0] ?? null);
    }
    fetchProfile();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    // AuthGate in _layout.tsx detects the cleared session and redirects to /auth
  }

  if (!fontsLoaded) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      <RadialBackground />
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Profile</Text>
          <Text style={styles.greeting}>Hello, {fullName ?? '...'}</Text>
        </View>

        {/* ── Menu ── */}
        <View style={styles.menu}>
          {MENU_ITEMS.map(({ label, icon, children }) => (
            <View key={label}>
              <TouchableOpacity style={styles.menuRow} activeOpacity={0.65}>
                <Ionicons name={icon} size={40} color="rgba(255,255,255,0.85)" style={styles.menuIcon} />
                <Text style={styles.menuText}>{label}</Text>
              </TouchableOpacity>

              {children?.map((child) => (
                <TouchableOpacity key={child.label} style={styles.subMenuRow} activeOpacity={0.65}>
                  <Ionicons name={child.icon} size={26} color="rgba(255,255,255,0.55)" />
                  <Text style={styles.subMenuText}>{child.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}

          {/* ── Sign Out ── */}
          <TouchableOpacity
            style={[styles.menuRow, styles.menuRowWithIcon]}
            activeOpacity={0.65}
            onPress={handleSignOut}
          >
            <Ionicons
              name="log-out-outline"
              size={40}
              color="rgba(255,100,100,0.85)"
              style={styles.menuIcon}
            />
            <Text style={[styles.menuText, styles.signOutText]}>Sign Out</Text>
          </TouchableOpacity>
        </View>

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

  // ── Header ──
  header: {
    paddingHorizontal: 24,
    paddingTop: 48,
    marginBottom: 100,
  },
  pageTitle: {
    fontFamily: 'Cabin-Bold',
    color: PEACH,
    fontSize: 42,
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  greeting: {
    fontFamily: 'Cabin-Bold',
    color: ORANGE,
    fontSize: 20,
  },

  // ── Menu ──
  menu: {
    paddingHorizontal: 40,
    gap: 22,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  menuIcon: {},
  menuText: {
    fontFamily: 'Cabin-Bold',
    color: ORANGE,
    fontSize: 42,
    lineHeight: 50,
  },
  subMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
    marginLeft: 58, // aligns with parent label (icon 40 + gap 18)
  },
  subMenuText: {
    fontFamily: 'Cabin-Bold',
    color: 'rgba(255,255,255,0.55)',
    fontSize: 22,
  },
  signOutText: {
    color: 'rgba(255,100,100,0.85)',
  },
});
