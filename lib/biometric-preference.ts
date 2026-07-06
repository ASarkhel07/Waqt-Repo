import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@waqt/biometric_unlock_enabled';

export async function getBiometricUnlockEnabled(): Promise<boolean> {
  const val = await AsyncStorage.getItem(KEY);
  return val === 'true';
}

export async function setBiometricUnlockEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY, enabled ? 'true' : 'false');
}