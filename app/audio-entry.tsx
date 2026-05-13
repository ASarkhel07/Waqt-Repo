import { RadialBackground } from '@/components/radial-background';
import { supabase } from '@/lib/supabase';
import { Cabin_400Regular, Cabin_700Bold } from '@expo-google-fonts/cabin';
import { Ionicons } from '@expo/vector-icons';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import {
    AudioModule,
    RecordingPresets,
    setAudioModeAsync,
    useAudioRecorder,
    useAudioRecorderState,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { useFonts } from 'expo-font';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── Constants ────────────────────────────────────────────────────────────────

const PEACH = '#FFD5B0';
const NUM_BARS = 28;
const BAR_MAX_H = 46;

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function todayLabel(): string {
  const now = new Date();
  return `${SHORT_MONTHS[now.getMonth()]} ${now.getDate()}`;
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type RecordPhase = 'idle' | 'recording' | 'paused';

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AudioEntryScreen() {
  const { date } = useLocalSearchParams<{ date?: string }>();

  const [fontsLoaded] = useFonts({
    'Cabin-Bold':    Cabin_700Bold,
    'Cabin-Regular': Cabin_400Regular,
  });

  const dateLabel = typeof date === 'string' && date.length > 0 ? date : todayLabel();

  // ── Audio recorder ──
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  // Poll at 80 ms so metering data updates the waveform smoothly
  const recState = useAudioRecorderState(audioRecorder, 80);

  // ── Recording phase (separate from expo-audio's isRecording so we can
  //    distinguish "never started" vs "paused") ──
  const [phase, setPhase] = useState<RecordPhase>('idle');

  // ── Our own elapsed-ms timer (reliable through pause / resume cycles) ──
  const [elapsedMs, setElapsedMs]   = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Waveform bars ──
  const barScales = useRef(
    Array.from({ length: NUM_BARS }, () => new Animated.Value(0.1))
  ).current;

  // --Recording state--
  const [saving, setSaving] = useState(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Drive waveform from metering whenever the recorder produces a new sample
  useEffect(() => {
    if (phase !== 'recording') return;

    // Map dBFS metering (-60…0) to a 0-1 level; fall back to 0.25 if absent
    const raw = recState.metering;
    const level = (raw != null && raw > -160)
      ? Math.max(0, Math.min(1, (raw + 60) / 60))
      : 0.25;

    barScales.forEach(bar => {
      // Add per-bar randomness so adjacent bars look independent
      const target = Math.max(0.08, Math.min(1, level * 0.75 + Math.random() * 0.35));
      Animated.spring(bar, {
        toValue: target,
        useNativeDriver: true,
        damping: 11,
        stiffness: 210,
        mass: 0.35,
      }).start();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recState.durationMillis, phase]);   // durationMillis ticks every 80 ms → drives animation

  function resetBars() {
    barScales.forEach(bar => {
      Animated.spring(bar, {
        toValue: 0.1,
        useNativeDriver: true,
        damping: 10,
        stiffness: 180,
      }).start();
    });
  }

  // ── Recording controls ──

  async function startRecording() {
    const { granted } = await AudioModule.requestRecordingPermissionsAsync();
    if (!granted) return;
    // iOS requires this before any recording can start
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await audioRecorder.prepareToRecordAsync({ isMeteringEnabled: true });
    audioRecorder.record();
    setPhase('recording');
    // Start elapsed timer
    timerRef.current = setInterval(() => setElapsedMs(ms => ms + 100), 100);
  }

  function pauseRecording() {
    audioRecorder.pause();
    setPhase('paused');
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  function resumeRecording() {
    audioRecorder.record();
    setPhase('recording');
    timerRef.current = setInterval(() => setElapsedMs(ms => ms + 100), 100);
  }

  /* OLD STOP RECORDING FUNCTION
  async function stopRecording() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    await audioRecorder.stop();
    setPhase('idle');
    setElapsedMs(0);
    resetBars();
    // TODO: persist audioRecorder.uri when database layer is ready
  }
  */

  async function stopRecording(){
    // stop timer and finalize audio file
    if (timerRef.current){
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    await audioRecorder.stop();

    const durationSecounds = Math.round(elapsedMs / 1000);
    const localUri = audioRecorder.uri;

    //ui reset
    setPhase('idle');
    setElapsedMs(0);
    resetBars();

    //no file? bail out
    if (!localUri) return;

    setSaving(true);
    try{
      // get logged in user's id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Read as base64 then decode with base64-arraybuffer (not atob) —
      // atob in React Native's Hermes engine corrupts binary bytes above 127.
      // base64-arraybuffer handles all byte values correctly.
      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const arrayBuffer = decodeBase64(base64);

      // Unique storage path: {user_id}/{timestamp}.m4a
      const storagePath = `${user.id}/${Date.now()}.m4a`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('audio')
        .upload(storagePath, arrayBuffer, { contentType: 'audio/m4a', upsert: false });

      if (uploadError) { console.error('Upload failed:', uploadError.message); return; }

      // Store the storage path in audio_url (not a public URL — bucket is private).
      // A signed URL is generated from this path when playback is implemented.
      const { error: insertError} = await supabase
        .from('audio_entries')
        .insert({
          user_id: user.id,
          audio_url: storagePath,
          duration_seconds: durationSecounds,
          title: dateLabel,
        });

        if(insertError) { console.error('DB insert failed:', insertError.message); }
    } finally {
      setSaving(false);
    }
  }

  function handleMainPress() {
    if (phase === 'idle')      startRecording();
    else if (phase === 'recording') pauseRecording();
    else                        resumeRecording();
  }

  if (!fontsLoaded) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      <RadialBackground />
      <StatusBar style="light" />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Audio Entry</Text>
        </View>

        {/* ── Date row ── */}
        <View style={styles.dateRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={32} color="white" />
          </TouchableOpacity>
          <Text style={styles.dateLabel}>{dateLabel}</Text>
        </View>

        {/* ── Centre area: hint text OR timer + waveform ── */}
        <View style={styles.centreArea}>
          {phase === 'idle' ? (
            <Text style={styles.hintText}>Press record to take a voice note</Text>
          ) : (
            <>
              <Text style={styles.timerText}>{formatDuration(elapsedMs)}</Text>

              <View style={styles.waveformRow}>
                {barScales.map((scale, i) => (
                  <Animated.View
                    key={i}
                    style={[styles.waveBar, { transform: [{ scaleY: scale }] }]}
                  />
                ))}
              </View>
            </>
          )}
        </View>

        {/* ── Bottom controls ── */}
        <View style={styles.controlsArea}>

          {/* Main button: record → pause → resume */}
          <TouchableOpacity
            style={[
              styles.mainButton,
              phase === 'recording' && styles.mainButtonRecording,
            ]}
            activeOpacity={0.75}
            onPress={handleMainPress}
            disabled={saving}
          >
            {phase === 'idle' && <View style={styles.recordDot} />}
            {phase === 'recording' && <Ionicons name="pause" size={30} color="white" />}
            {phase === 'paused'    && <Ionicons name="play"  size={30} color="white" style={styles.playIconOffset} />}
          </TouchableOpacity>

          {/* Stop button — only visible when a recording has started */}
          {phase !== 'idle' && (
            <TouchableOpacity
              style={styles.stopButton}
              activeOpacity={0.75}
              onPress={stopRecording}
              disabled={saving}
            >
              <View style={styles.stopSquare} />
            </TouchableOpacity>
          )}

        </View>

      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const MAIN_BTN  = 80;
const STOP_BTN  = 66;

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
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 2,
  },
  pageTitle: {
    fontFamily: 'Cabin-Bold',
    color: PEACH,
    fontSize: 40,
    letterSpacing: 0.2,
  },

  // ── Date row ──
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 4,
  },
  dateLabel: {
    fontFamily: 'Cabin-Bold',
    color: 'white',
    fontSize: 46,
  },

  // ── Centre ──
  centreArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 48,      // visually pushes content upward
  },
  hintText: {
    fontFamily: 'Cabin-Regular',
    color: 'rgba(255,255,255,0.38)',
    fontSize: 16,
    textAlign: 'center',
  },
  timerText: {
    fontFamily: 'Cabin-Bold',
    color: 'white',
    fontSize: 52,
    letterSpacing: 2,
    marginBottom: 28,
  },
  waveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: BAR_MAX_H,
    gap: 3,
  },
  waveBar: {
    width: 3,
    height: BAR_MAX_H,
    borderRadius: 2,
    backgroundColor: PEACH,
  },

  // ── Bottom controls ──
  controlsArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 52,
    gap: 32,
  },

  // Main button (record / pause / resume)
  mainButton: {
    width: MAIN_BTN,
    height: MAIN_BTN,
    borderRadius: MAIN_BTN / 2,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainButtonRecording: {
    borderColor: 'rgba(224,48,48,0.5)',
    backgroundColor: 'rgba(224,48,48,0.12)',
  },
  recordDot: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E03030',
  },
  playIconOffset: {
    marginLeft: 4,   // optical correction for play triangle
  },

  // Stop button
  stopButton: {
    width: STOP_BTN,
    height: STOP_BTN,
    borderRadius: STOP_BTN / 2,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopSquare: {
    width: 20,
    height: 20,
    borderRadius: 3,
    backgroundColor: 'white',
  },
});
