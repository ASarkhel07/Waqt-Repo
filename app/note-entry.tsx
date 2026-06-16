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
import React, { useEffect, useRef, useState } from 'react';
import {
    ActionSheetIOS,
    Alert,
    Animated,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Constants ────────────────────────────────────────────────────────────────

const PEACH = '#FFD5B0';

// Hero height states
const HERO_H       = 265; // resting height
const HERO_H_SMALL = 120; // collapsed height when keyboard is open

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function localDateString(d: Date): string {
  // Use local date parts (not UTC) so the saved date matches the user's timezone
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayLabel(): string {
  const now = new Date();
  return `${SHORT_MONTHS[now.getMonth()]} ${now.getDate()}`;
}

// ─── Cover image picker ───────────────────────────────────────────────────────

async function pickFromLibrary(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission needed', 'Allow photo library access in Settings.');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [16, 9],
    quality: 0.8,
  });
  return result.canceled ? null : result.assets[0].uri;
}

async function pickFromCamera(): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission needed', 'Allow camera access in Settings.');
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [16, 9],
    quality: 0.8,
  });
  return result.canceled ? null : result.assets[0].uri;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NoteEntryScreen() {
  const { date, readOnly, isToday, entryId, prefillTitle, prefillBody, prefillCover } = useLocalSearchParams<{
    date?: string;
    readOnly?: string;
    isToday?: string;
    entryId?: string;
    prefillTitle?: string;
    prefillBody?: string;
    prefillCover?: string;
  }>();
  const insets = useSafeAreaInsets();
  const isReadOnly    = readOnly === 'true';
  const isTodayEntry  = isToday  === 'true';

  const [fontsLoaded] = useFonts({
    'Cabin-Bold':    Cabin_700Bold,
    'Cabin-Regular': Cabin_400Regular,
  });

  const [title,         setTitle]         = useState(prefillTitle ?? '');
  const [body,          setBody]          = useState(prefillBody  ?? '');
  const [coverUri,      setCoverUri]      = useState<string | null>(prefillCover || null);
  const [isBodyFocused, setIsBodyFocused] = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [isEditing,     setIsEditing]     = useState(false);

  const effectiveReadOnly = isReadOnly && !isEditing;

  const dateLabel = typeof date === 'string' && date.length > 0 ? date : todayLabel();

  // ── Animated collapsible hero ──────────────────────────────────────────────
  const heroHeight = useRef(new Animated.Value(HERO_H)).current;

  useEffect(() => {
    const shrink = () =>
      Animated.timing(heroHeight, {
        toValue: HERO_H_SMALL,
        duration: 260,
        useNativeDriver: false,
      }).start();

    const expand = () =>
      Animated.timing(heroHeight, {
        toValue: HERO_H,
        duration: 280,
        useNativeDriver: false,
      }).start();

    // iOS fires "Will" events before the animation starts — smoother result
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvt, shrink);
    const hideSub = Keyboard.addListener(hideEvt, expand);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [heroHeight]);

  // Fade the top-bar based on body TextInput focus, not keyboard height,
  // so it only disappears when the user is actively writing the note body.
  const topBarOpacity = useRef(new Animated.Value(1)).current;

  function handleBodyFocus() {
    setIsBodyFocused(true);
    Animated.timing(topBarOpacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }

  function handleBodyBlur() {
    setIsBodyFocused(false);
    Animated.timing(topBarOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }

  // ── Cover image options ────────────────────────────────────────────────────
  function showCoverOptions() {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: coverUri
            ? ['Cancel', 'Take Photo', 'Choose from Library', 'Remove Cover']
            : ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: coverUri ? 3 : undefined,
        },
        async (i) => {
          if (i === 1) { const u = await pickFromCamera();  if (u) setCoverUri(u); }
          if (i === 2) { const u = await pickFromLibrary(); if (u) setCoverUri(u); }
          if (i === 3 && coverUri) setCoverUri(null);
        },
      );
    } else {
      Alert.alert('Cover Image', 'Choose an option', [
        { text: 'Take Photo',           onPress: async () => { const u = await pickFromCamera();  if (u) setCoverUri(u); } },
        { text: 'Choose from Library',  onPress: async () => { const u = await pickFromLibrary(); if (u) setCoverUri(u); } },
        ...(coverUri ? [{ text: 'Remove Cover', style: 'destructive' as const, onPress: () => setCoverUri(null) }] : []),
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }

  // ── Persist to Supabase ───────────────────────────────────────────────────

  async function uploadCoverImage(localUri: string, userId: string): Promise<string | null> {
    try {
      const ext      = localUri.split('.').pop()?.split('?')[0] ?? 'jpg';
      const filePath = `${userId}/${Date.now()}.${ext}`;

      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const { error } = await supabase.storage
        .from('entry-covers')
        .upload(filePath, decode(base64), { contentType: `image/${ext}`, upsert: false });

      if (error) { console.warn('Cover upload error:', error.message); return null; }

      const { data } = supabase.storage.from('entry-covers').getPublicUrl(filePath);
      return data.publicUrl;
    } catch (e) {
      console.warn('Cover upload exception:', e);
      return null;
    }
  }

  async function handleSave() {
    if (saving) return;
    if (!title.trim() && !body.trim()) {
      Alert.alert('Nothing to save', 'Add a title or some text before saving.');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // TEST BYPASS: use a dummy ID when not signed in
      const userId = user?.id ?? 'test-user-00000000-0000-0000-0000-000000000000';

      if (entryId && isEditing) {
        // UPDATE existing entry
        let coverImageUrl: string | null = prefillCover || null;
        if (coverUri && coverUri !== (prefillCover || null)) {
          coverImageUrl = await uploadCoverImage(coverUri, userId);
        } else if (!coverUri) {
          coverImageUrl = null;
        }

        const { error } = await supabase.from('text_entry').update({
          title:           title.trim() || null,
          body:            body.trim()  || null,
          cover_image_url: coverImageUrl,
        }).eq('id', entryId);

        if (error) { Alert.alert('Update failed', error.message); return; }
      } else {
        // INSERT new entry
        let coverImageUrl: string | null = null;
        if (coverUri) {
          coverImageUrl = await uploadCoverImage(coverUri, userId);
        }

        const { error } = await supabase.from('text_entry').insert({
          user_id:          userId,
          title:            title.trim() || null,
          body:             body.trim()  || null,
          cover_image_url:  coverImageUrl,
          entry_date:       localDateString(new Date()),
        });

        if (error) { Alert.alert('Save failed', error.message); return; }
      }

      router.back();
    } finally {
      setSaving(false);
    }
  }

  if (!fontsLoaded) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      <RadialBackground />
      <StatusBar style="light" />

      {/* ── Collapsible hero ──────────────────────────────────────────────── */}
      <Animated.View style={[styles.heroWrapper, { height: heroHeight }]}>

        {/* Cover image when set; otherwise the heroWrapper's dark navy bg shows */}
        {coverUri && (
          <Image source={{ uri: coverUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        )}
        {/* Overlay only when a cover image is present to keep text readable */}
        {coverUri && <View style={styles.heroOverlay} />}

        {/* Top nav — Back / Checkmark — fades out as hero collapses */}
        <Animated.View style={[styles.topBar, { paddingTop: insets.top + 6, opacity: topBarOpacity }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={20} color="white" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

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
        </Animated.View>

        {/* Title input — sits near the bottom of the hero */}
        <View style={styles.heroTextArea}>
          <TextInput
            style={styles.titleInput}
            placeholder="Enter Title"
            placeholderTextColor="rgba(255,255,255,0.45)"
            value={title}
            onChangeText={setTitle}
            returnKeyType="next"
            maxLength={60}
            editable={!isBodyFocused && !effectiveReadOnly}
          />
        </View>

        {/* Camera icon — hidden in read-only mode */}
        {!effectiveReadOnly && (
          <TouchableOpacity style={styles.cameraIcon} onPress={showCoverOptions} activeOpacity={0.75}>
            <Ionicons name="camera-outline" size={26} color="rgba(255,255,255,0.75)" />
          </TouchableOpacity>
        )}

      </Animated.View>

      {/* ── Writing area ──────────────────────────────────────────────────── */}
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
          <Text style={styles.dateLabel}>{dateLabel}</Text>

          <TextInput
            style={styles.bodyInput}
            placeholder="Write about it..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={body}
            onChangeText={setBody}
            onFocus={handleBodyFocus}
            onBlur={handleBodyBlur}
            multiline
            textAlignVertical="top"
            returnKeyType="default"
            scrollEnabled={false}
            editable={!effectiveReadOnly}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090921',
  },

  // ── Hero ──
  heroWrapper: {
    // Dark navy — distinct from the RadialBackground gradient colour
    backgroundColor: '#0D0D2E',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,8,32,0.50)',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    fontFamily: 'Cabin-Bold',
    color: 'white',
    fontSize: 17,
  },
  checkButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
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
    fontFamily: 'Cabin-Bold',
    color: 'white',
    fontSize: 15,
  },
  heroTextArea: {
    position: 'absolute',
    bottom: 36,
    left: 18,
    right: 56,
  },
  titleInput: {
    fontFamily: 'Cabin-Bold',
    color: 'white',
    fontSize: 38,
    lineHeight: 44,
    paddingVertical: 0,
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 14,
    right: 16,
  },

  // ── Writing area ──
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 60,
  },
  dateLabel: {
    fontFamily: 'Cabin-Bold',
    color: PEACH,
    fontSize: 48,
    marginBottom: 14,
  },
  bodyInput: {
    fontFamily: 'Cabin-Regular',
    color: 'rgba(255,255,255,0.85)',
    fontSize: 17,
    lineHeight: 28,
    minHeight: 240,
  },
});
