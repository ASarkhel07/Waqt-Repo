import { RadialBackground } from '@/components/radial-background';
import { supabase } from '@/lib/supabase';
import { Cabin_400Regular, Cabin_700Bold } from '@expo-google-fonts/cabin';
import { Ionicons } from '@expo/vector-icons';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
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
  const { date, readOnly, isToday, entryId, prefillImageUrl, prefillCaption } = useLocalSearchParams<{
    date?: string;
    readOnly?: string;
    isToday?: string;
    entryId?: string;
    prefillImageUrl?: string;
    prefillCaption?: string;
  }>();
  const isReadOnly   = readOnly === 'true';
  const isTodayEntry = isToday  === 'true';

  const [fontsLoaded] = useFonts({
    'Cabin-Bold': Cabin_700Bold,
    'Cabin-Regular': Cabin_400Regular,
  });

  const [photoUri, setPhotoUri] = useState<string | null>(prefillImageUrl || null);
  const [caption, setCaption] = useState(prefillCaption ?? '');
  const [saving,    setSaving]    = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const effectiveReadOnly = isReadOnly && !isEditing;

  // `date` is already formatted as "MMM D" (e.g. "Feb 4") from the timeline
  const dateLabel = typeof date === 'string' && date.length > 0 ? date : todayLabel();

  // SUPABASE FUNCTIONS
  async function uploadImageToSupabase(localUri: string, userId: string): Promise<string | null> {
    try {
      const ext = localUri.split('.').pop()?.split('?')[0] ?? 'jpg';
      const filePath = `${userId}/${Date.now()}.${ext}`;

      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const { error } = await supabase.storage
        .from('images')
        .upload(filePath, decode(base64), { contentType: `image/${ext}`, upsert: false });

      if (error) { console.warn('Image upload error:', error.message); return null;}

      const { data } = supabase.storage.from('images').getPublicUrl(filePath);
      return data.publicUrl;
    } catch (e) {
      console.warn('Image upload exception:', e);
      return null;
    }
  }

  async function handleSave() {
    if (saving) return;
    if (!photoUri) {
      Alert.alert('Nothing to save', 'Add a photo before saving.');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // TEST BYPASS: use a dummy ID when not signed in
      const userId = user?.id ?? 'test-user-00000000-0000-0000-0000-000000000000';

      if (entryId && isEditing) {
        // UPDATE existing entry — only re-upload if the user picked a new photo
        let finalImageUrl: string | null = prefillImageUrl || null;
        if (photoUri && photoUri !== (prefillImageUrl || null)) {
          finalImageUrl = await uploadImageToSupabase(photoUri, userId);
        }

        const { error } = await supabase.from('image_entries').update({
          caption:   caption.trim() || null,
          image_url: finalImageUrl,
        }).eq('id', entryId);

        if (error) { Alert.alert('Update failed', error.message); return; }
      } else {
        // INSERT new entry
        const imageUrl = await uploadImageToSupabase(photoUri, userId);

        const { error } = await supabase.from('image_entries').insert({
          user_id:    userId,
          created_at: new Date().toISOString(),
          caption:    caption.trim() || null,
          image_url:  imageUrl,
        });

        if (error) { Alert.alert('Save failed', error.message); return; }
      }

      router.back();
    } finally {
      setSaving(false);
    }
  }

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
          {isReadOnly && isTodayEntry && !isEditing && (
            <TouchableOpacity style={styles.editButton} onPress={() => setIsEditing(true)} activeOpacity={0.75}>
              <Ionicons name="create-outline" size={20} color="white" />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          )}
          {!effectiveReadOnly && (
            <TouchableOpacity
              style={[styles.checkButton, saving && styles.checkButtonSaving]}
              activeOpacity={0.75}
              onPress={handleSave}
              disabled={saving}
            >
              <Ionicons name="checkmark" size={26} color={saving ? 'rgba(255,255,255,0.4)' : 'white'} />
            </TouchableOpacity>
          )}
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
              activeOpacity={effectiveReadOnly ? 1 : 0.85}
              onPress={effectiveReadOnly ? undefined : showPhotoOptions}
              disabled={effectiveReadOnly}
            >
              {photoUri ? (
                <>
                  <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
                  {/* Camera icon overlay — hidden in read-only mode */}
                  {!effectiveReadOnly && (
                    <View style={styles.cameraIconOverlay}>
                      <Ionicons name="camera" size={22} color="white" />
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="camera-outline" size={48} color="rgba(255,255,255,0.55)" />
                  <Text style={styles.photoPlaceholderText}>Tap to add a photo</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* ── Caption ── */}
            <View style={styles.captionBox}>
              <TextInput
                style={styles.captionInput}
                placeholder="Add a caption..."
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={caption}
                onChangeText={setCaption}
                returnKeyType="done"
                maxLength={100}
                editable={!effectiveReadOnly}
              />
              {!effectiveReadOnly && (
                <Text style={styles.captionCounter}>{100 - caption.length}</Text>
              )}
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
    aspectRatio: 4 / 5, // slightly portrait — photo takes up more of the screen
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

  // ── Caption ──
  captionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  captionInput: {
    flex: 1,
    fontFamily: 'Cabin-Regular',
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
  },
  captionCounter: {
    fontFamily: 'Cabin-Regular',
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    alignSelf: 'flex-end',
    paddingBottom: 2,
  },
  checkButtonSaving: {
    borderColor: 'rgba(255,255,255,0.2)',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  editButtonText: {
    fontFamily: 'Cabin-Regular',
    color: 'white',
    fontSize: 15,
  },
});
