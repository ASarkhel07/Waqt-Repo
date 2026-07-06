import { RadialBackground } from '@/components/radial-background';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const ORANGE = '#F2A65A';

interface Props {
  label:           string;
  error:           string | null;
  isAuthenticating: boolean;
  onTryAgain:      () => void;
  onSignOut:       () => void;
}

export function BiometricLockScreen({ label, error, isAuthenticating, onTryAgain, onSignOut }: Props) {
  return (
    <View style={styles.overlay}>
      <RadialBackground />

      <View style={styles.content}>
        <Ionicons name="scan-outline" size={80} color="white" style={styles.icon} />

        <Text style={styles.title}>Unlock Waqt</Text>
        <Text style={styles.subtitle}>Use {label} to continue</Text>

        {!!error && (
          <Text style={styles.errorText}>{error}</Text>
        )}

        {isAuthenticating ? (
          <ActivityIndicator size="large" color={ORANGE} style={styles.spinner} />
        ) : (
          <TouchableOpacity style={styles.tryAgainBtn} onPress={onTryAgain} activeOpacity={0.8}>
            <Text style={styles.tryAgainText}>Try Again</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={onSignOut} style={styles.signOutBtn} activeOpacity={0.7}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#090921',
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 36,
    width: '100%',
  },
  icon: {
    marginBottom: 28,
    opacity: 0.95,
  },
  title: {
    fontFamily: 'Cabin-Bold',
    fontSize: 30,
    color: 'white',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontFamily: 'Cabin-Regular',
    fontSize: 17,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 28,
    textAlign: 'center',
  },
  errorText: {
    fontFamily: 'Cabin-Regular',
    fontSize: 14,
    color: '#FF8A80',
    marginBottom: 20,
    textAlign: 'center',
  },
  spinner: {
    marginVertical: 20,
  },
  tryAgainBtn: {
    backgroundColor: ORANGE,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    width: '100%',
  },
  tryAgainText: {
    fontFamily: 'Cabin-Bold',
    color: 'white',
    fontSize: 17,
  },
  signOutBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  signOutText: {
    fontFamily: 'Cabin-Regular',
    color: 'rgba(255,255,255,0.45)',
    fontSize: 15,
    textDecorationLine: 'underline',
  },
});
