import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { getBiometricUnlockEnabled } from '@/lib/biometric-preference';
import { getBiometricLabel, promptBiometricAuth } from '@/lib/local-authentication';

interface Options {
  session: unknown;
  initialized: boolean;
}

interface BiometricUnlockResult {
  shouldShowLock:  boolean;
  biometricLabel:  string;
  lastError:       string | null;
  tryAgain:        () => void;
  isAuthenticating: boolean;
}

export function useBiometricUnlock({ session, initialized }: Options): BiometricUnlockResult {
  const [preferenceLoaded, setPreferenceLoaded] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [isUnlocked,       setIsUnlocked]       = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [lastError,        setLastError]        = useState<string | null>(null);
  const [biometricLabel,   setBiometricLabel]   = useState('Biometric unlock');

  // Track previous AppState to detect background→active transitions
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Effect 1: Hydrate preference + label on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [enabled, label] = await Promise.all([
        getBiometricUnlockEnabled(),
        getBiometricLabel(),
      ]);
      if (!cancelled) {
        setBiometricEnabled(enabled);
        setBiometricLabel(label);
        setPreferenceLoaded(true);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Effect 2: Prompt for auth when conditions are met
  useEffect(() => {
    if (!initialized || !session || !biometricEnabled || !preferenceLoaded || isUnlocked || isAuthenticating) {
      return;
    }

    let cancelled = false;

    async function authenticate() {
      setIsAuthenticating(true);
      setLastError(null);
      try {
        const result = await promptBiometricAuth();
        if (cancelled) return;
        if (result.success) {
          setIsUnlocked(true);
        } else {
          const errorMessage =
            'error' in result && result.error
              ? result.error === 'user_cancel'
                ? 'Authentication cancelled'
                : result.error
              : 'Authentication failed';
          setLastError(errorMessage);
        }
      } catch (e) {
        if (!cancelled) {
          setLastError(e instanceof Error ? e.message : 'Authentication error');
        }
      } finally {
        if (!cancelled) setIsAuthenticating(false);
      }
    }

    authenticate();
    return () => { cancelled = true; };
  }, [initialized, session, biometricEnabled, preferenceLoaded, isUnlocked, isAuthenticating]);

  // Effect 3: Re-lock when app returns from background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;
      if (nextState === 'active' && (prev === 'background' || prev === 'inactive')) {
        if (biometricEnabled) {
          setIsUnlocked(false);
          setLastError(null);
        }
      }
    });
    return () => subscription.remove();
  }, [biometricEnabled]);

  function tryAgain() {
    setLastError(null);
    setIsUnlocked(false);
  }

  const shouldShowLock = preferenceLoaded && biometricEnabled && !isUnlocked && !!session;

  return { shouldShowLock, biometricLabel, lastError, tryAgain, isAuthenticating };
}
