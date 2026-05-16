import { RadialBackground } from '@/components/radial-background';
import { supabase } from '@/lib/supabase';
import { Cabin_400Regular, Cabin_700Bold } from '@expo-google-fonts/cabin';
import { Ionicons } from '@expo/vector-icons';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import {
    AudioModule,
    AudioQuality,
    IOSOutputFormat,
    RecordingOptions,
    setAudioModeAsync,
    useAudioPlayer,
    useAudioPlayerStatus,
    useAudioRecorder,
    useAudioRecorderState,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { useFonts } from 'expo-font';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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

type RecordPhase = 'idle' | 'recording' | 'paused' | 'playback';

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AudioEntryScreen() {
  const { date, audioUrl } = useLocalSearchParams<{ date?: string; audioUrl?: string }>();

  const [fontsLoaded] = useFonts({
    'Cabin-Bold':    Cabin_700Bold,
    'Cabin-Regular': Cabin_400Regular,
  });

  const dateLabel = typeof date === 'string' && date.length > 0 ? date : todayLabel();

  // ── Audio recorder ──
  // Record as WAV (LINEARPCM) instead of m4a/AAC. AVPlayer can't reliably play
  // AAC-in-m4a files produced by AVAudioRecorder (moov atom positioning issue),
  // but WAV files always play because the header is at the start of the file.
  const recordingOptions: RecordingOptions = {
    extension: '.wav',
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
    android: {
      outputFormat: 'mpeg4',
      audioEncoder: 'aac',
    },
    ios: {
      outputFormat: IOSOutputFormat.LINEARPCM,
      audioQuality: AudioQuality.MEDIUM,
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
    },
    web: {
      mimeType: 'audio/wav',
      bitsPerSecond: 128000,
    },
  };
  const audioRecorder = useAudioRecorder(recordingOptions);
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

  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [recordedDuration, setRecordedDuration] = useState(0);

  // Player state. The actual <PlaybackPlayer> uses key={playbackUri} so it
  // remounts when the URI changes, guaranteeing useAudioPlayer creates a fresh player.
  const [playbackUri, setPlaybackUri] = useState<string | null>(null);
  // Status mirrored up from the child via callback
  const [playerStatus, setPlayerStatus] = useState({ playing: false, isLoaded: false, isBuffering: false, duration: 0 });
  const playerRef = useRef<{ play: () => void; pause: () => void } | null>(null);
  // Compat shim so existing code can call player.play()/pause()
  const player = useMemo(() => ({
    play: () => playerRef.current?.play(),
    pause: () => playerRef.current?.pause(),
  }), []);

  // Queues a play intent when the user presses play before the player finishes loading.
  const [pendingPlay, setPendingPlay] = useState(false);
  useEffect(() => {
    if (pendingPlay && playerStatus.isLoaded && !playerStatus.playing) {
      player.play();
      setPendingPlay(false);
    }
  }, [playerStatus.isLoaded, pendingPlay]);

  // If launched from the timeline: download the audio to local cache, then
  // set playbackUri → child PlaybackPlayer mounts with a fresh useAudioPlayer.
  useEffect(() => {
    if (!audioUrl) return;
    (async () => {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const ext = (audioUrl as string).match(/\.(\w{2,4})(?:\?|$)/)?.[1] ?? 'wav';
      const destPath = FileSystem.cacheDirectory + `waqt_playback.${ext}`;
      try {
        const { uri: cached } = await FileSystem.downloadAsync(audioUrl as string, destPath);
        setPlaybackUri(cached);
      } catch {
        setPlaybackUri(audioUrl as string);
      }
      setPhase('playback');
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup timer on unmount (player lifecycle is managed by the hook).
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

  async function stopRecording() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

    // Capture duration NOW — before setElapsedMs(0) wipes it
    const finalDurationMs = elapsedMs;
    const durationSeconds = Math.round(finalDurationMs / 1000);

    const stopResult = await audioRecorder.stop();
    // Some expo-audio versions put the URI in the return value; others on .uri
    const localUri = (stopResult as any)?.uri ?? audioRecorder.uri ?? null;

    // Reset recording UI immediately so the screen feels responsive
    setElapsedMs(0);
    resetBars();

    if (!localUri) { setPhase('idle'); return; }

    setSaving(true);
    try {
      // Use getSession() (reads cached session) rather than getUser() (network
      // round-trip) — the latter fails intermittently in React Native.
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) { setPhase('idle'); return; }

      // Read as base64 then decode with base64-arraybuffer (not atob) —
      // atob in React Native's Hermes engine corrupts binary bytes above 127.
      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const arrayBuffer = decodeBase64(base64);

      const storagePath = `${user.id}/${Date.now()}.wav`;
      const { error: uploadError } = await supabase.storage
        .from('audio')
        .upload(storagePath, arrayBuffer, { contentType: 'audio/wav', upsert: false });

      if (uploadError) { setPhase('idle'); return; }

      // Store the full public URL so the timeline can play directly.
      const publicUrl = supabase.storage.from('audio').getPublicUrl(storagePath).data.publicUrl;

      await supabase
        .from('audio_entries')
        .insert({
          user_id: user.id,
          audio_url: publicUrl,
          duration_seconds: durationSeconds,
          title: dateLabel,
        });

      setSavedPath(publicUrl);
      setRecordedDuration(finalDurationMs);
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      // Set the local URI → child PlaybackPlayer remounts with a fresh player.
      setPlaybackUri(localUri);
      setPhase('playback');
    } finally {
      setSaving(false);
    }
  }

  function handleMainPress() {
    if (phase === 'idle')      startRecording();
    else if (phase === 'recording') pauseRecording();
    else                        resumeRecording();
  }

  function togglePlayback() {
    if (playerStatus.playing) {
      player.pause();
      setPendingPlay(false);
    } else if (playerStatus.isLoaded) {
      player.play();
    } else {
      // Still buffering — queue intent; auto-fires when isLoaded becomes true
      setPendingPlay(true);
    }
  }

  function handleDoneListening() {
    player.pause();
    setSavedPath(null);
    router.back();
  }

  if (!fontsLoaded) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      <RadialBackground />
      <StatusBar style="light" />

      {/* Hidden player child — remounts when playbackUri changes (key prop) */}
      {playbackUri && (
        <PlaybackPlayer
          key={playbackUri}
          uri={playbackUri}
          onStatus={setPlayerStatus}
          registerControls={(c) => { playerRef.current = c; }}
        />
      )}

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

        {/* ── Centre area ── */}
        <View style={styles.centreArea}>
          {phase === 'idle' ? (
            <Text style={styles.hintText}>Press record to take a voice note</Text>
          ) : phase === 'playback' ? (
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.timerText}>{formatDuration(recordedDuration)}</Text>
              <Text style={styles.savedText}>Recording saved</Text>
            </View>
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
        {phase === 'playback' ? (
          <View style={styles.controlsArea}>
            {/* Play / Pause the saved recording */}
            <TouchableOpacity style={styles.mainButton} activeOpacity={0.75} onPress={togglePlayback}>
              <Ionicons
                name={playerStatus.playing ? 'pause' : 'play'}
                size={30}
                color={pendingPlay || playerStatus.isBuffering ? 'rgba(255,255,255,0.4)' : 'white'}
                style={!playerStatus.playing ? styles.playIconOffset : undefined}
              />
            </TouchableOpacity>
            {/* Done — go back to the timeline */}
            <TouchableOpacity style={styles.stopButton} activeOpacity={0.75} onPress={handleDoneListening}>
              <Ionicons name="checkmark" size={22} color="white" />
            </TouchableOpacity>
          </View>
        ) : (
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
              {phase === 'idle'      && <View style={styles.recordDot} />}
              {phase === 'recording' && <Ionicons name="pause" size={30} color="white" />}
              {phase === 'paused'    && <Ionicons name="play"  size={30} color="white" style={styles.playIconOffset} />}
            </TouchableOpacity>

            {/* Stop button — only visible once a recording has started */}
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
        )}

      </SafeAreaView>
    </View>
  );
}

// ─── Playback player child ────────────────────────────────────────────────────
// Lives inside a component keyed on `uri` so a new useAudioPlayer instance is
// created every time the URI changes — guaranteed fresh native player.

type PlaybackStatus = { playing: boolean; isLoaded: boolean; isBuffering: boolean; duration: number };

function PlaybackPlayer({
  uri,
  onStatus,
  registerControls,
}: {
  uri: string;
  onStatus: (s: PlaybackStatus) => void;
  registerControls: (c: { play: () => void; pause: () => void }) => void;
}) {
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);

  // Forward status to parent
  useEffect(() => {
    onStatus({
      playing: status.playing,
      isLoaded: status.isLoaded,
      isBuffering: status.isBuffering,
      duration: status.duration,
    });
  }, [status.playing, status.isLoaded, status.isBuffering, status.duration]);

  // Expose imperative play/pause to parent
  useEffect(() => {
    registerControls({
      play: () => player.play(),
      pause: () => player.pause(),
    });
  }, [player, status.isLoaded]);

  return null;
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
  savedText: {
    fontFamily: 'Cabin-Regular',
    color: 'rgba(255,255,255,0.40)',
    fontSize: 15,
    marginTop: 6,
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
