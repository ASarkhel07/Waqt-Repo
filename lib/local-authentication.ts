import * as LocalAuthentication from 'expo-local-authentication';

export async function checkBiometricSupport(): Promise<{ supported: boolean; enrolled: boolean }> {
  const supported = await LocalAuthentication.hasHardwareAsync();
  const enrolled  = supported ? await LocalAuthentication.isEnrolledAsync() : false;
  return { supported, enrolled };
}

export async function getBiometricLabel(): Promise<string> {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return 'Face ID';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return 'Touch ID';
    }
  } catch {
    // fall through to default
  }
  return 'Biometric unlock';
}

export async function promptBiometricAuth(
  message?: string,
): Promise<LocalAuthentication.LocalAuthenticationResult> {
  return LocalAuthentication.authenticateAsync({
    promptMessage:          message ?? 'Unlock Waqt',
    disableDeviceFallback:  false,
    fallbackLabel:          'Use Passcode',
  });
}
