import { Cabin_400Regular, Cabin_700Bold } from '@expo-google-fonts/cabin';
import { Ionicons } from '@expo/vector-icons';
import { RadialBackground } from '@/components/radial-background';
import { useFonts } from 'expo-font';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Image,
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

const PEACH = '#FFD5B0';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function todayLabel(): string {
  const now = new Date();
  return `${SHORT_MONTHS[now.getMonth()]} ${now.getDate()}`;
}

// ─── Image Picker Logic ───────────────────────────────────────────────────────

async function requestAndPickFromLibrary(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(
      'Permission needed',
      'Please allow access to your photo library in Settings to pick a photo.',
    );
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
  });
  if (result.canceled) return null;
  return result.assets[0].uri;
}

async function requestAndPickFromCamera(): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(
      'Permission needed',
      'Please allow camera access in Settings to take a photo.',
    );
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
  });
  if (result.canceled) return null;
  return result.assets[0].uri;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PhotoEntryScreen() {
  const { date } = useLocalSearchParams<{ date?: string }>();

  const [fontsLoaded] = useFonts({
    'Cabin-Bold': Cabin_700Bold,
    'Cabin-Regular': Cabin_400Regular,
  });

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  // `date` is already formatted as "MMM D" (e.g. "Feb 4") from the timeline
  const dateLabel = typeof date === 'string' && date.length > 0 ? date : todayLabel();

  function showPhotoOptions() {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
        },
        async (buttonIndex) => {
          if (buttonIndex === 1) {
            const uri = await requestAndPickFromCamera();
            if (uri) setPhotoUri(uri);
          } else if (buttonIndex === 2) {
            const uri = await requestAndPickFromLibrary();
            if (uri) setPhotoUri(uri);
          }
        },
      );
    } else {
      // Android: simple Alert as action sheet
      Alert.alert('Add Photo', 'Choose an option', [
        { text: 'Take Photo', onPress: async () => { const uri = await requestAndPickFromCamera(); if (uri) setPhotoUri(uri); } },
        { text: 'Choose from Library', onPress: async () => { const uri = await requestAndPickFromLibrary(); if (uri) setPhotoUri(uri); } },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }

  if (!fontsLoaded) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      <RadialBackground />
      <StatusBar style="light" />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={28} color="white" />
          </TouchableOpacity>

          <Text style={styles.pageTitle}>Photo Entry</Text>
        </View>

        {/* ── Date row ── */}
        <View style={styles.dateRow}>
          <Text style={styles.dateLabel}>{dateLabel}</Text>
          <TouchableOpacity style={styles.checkButton} activeOpacity={0.75}>
            <Ionicons name="checkmark" size={26} color="white" />
          </TouchableOpacity>
        </View>

        {/* ── Scrollable content ── */}
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
            {/* ── Photo area ── */}
            <TouchableOpacity
              style={styles.photoBox}
              activeOpacity={0.85}
              onPress={showPhotoOptions}
            >
              {photoUri ? (
                <>
                  <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
                  {/* Camera icon overlay for re-picking */}
                  <View style={styles.cameraIconOverlay}>
                    <Ionicons name="camera" size={22} color="white" />
                  </View>
                </>
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="camera-outline" size={48} color="rgba(255,255,255,0.55)" />
                  <Text style={styles.photoPlaceholderText}>Tap to add a photo</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* ── Text entry area ── */}
            <View style={styles.textBox}>
              <TextInput
                style={styles.titleInput}
                placeholder="Title..."
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={title}
                onChangeText={setTitle}
                returnKeyType="next"
                maxLength={80}
              />
              <View style={styles.divider} />
              <TextInput
                style={styles.bodyInput}
                placeholder="Write about it..."
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={body}
                onChangeText={setBody}
                multiline
                textAlignVertical="top"
                returnKeyType="default"
              />
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

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  backButton: {
    marginRight: 8,
  },
  pageTitle: {
    fontFamily: 'Cabin-Bold',
    color: PEACH,
    fontSize: 38,
    letterSpacing: 0.2,
  },

  // ── Date row ──
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  dateLabel: {
    fontFamily: 'Cabin-Bold',
    color: 'white',
    fontSize: 42,
    flex: 1,
  },
  checkButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Scroll ──
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    gap: 20,
  },

  // ── Photo ──
  photoBox: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  cameraIconOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 20,
    padding: 6,
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  photoPlaceholderText: {
    fontFamily: 'Cabin-Regular',
    color: 'rgba(255,255,255,0.45)',
    fontSize: 16,
  },

  // ── Text area ──
  textBox: {
    backgroundColor: 'rgba(131,124,124,0.28)',
    borderRadius: 18,
    padding: 20,
    minHeight: 180,
  },
  titleInput: {
    fontFamily: 'Cabin-Bold',
    color: 'white',
    fontSize: 32,
    marginBottom: 10,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginBottom: 12,
  },
  bodyInput: {
    fontFamily: 'Cabin-Regular',
    color: 'rgba(255,255,255,0.85)',
    fontSize: 16,
    lineHeight: 24,
    minHeight: 100,
  },
});
