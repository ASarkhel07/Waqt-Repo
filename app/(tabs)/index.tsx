import { Cabin_700Bold } from '@expo-google-fonts/cabin';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── Constants ────────────────────────────────────────────────────────────────

const DOG_IMAGE_URL =
  'https://www.figma.com/api/mcp/asset/0e61c1c3-5267-453a-b35b-643cfdf8df6a';

const ORANGE = '#F5A855';
const GRAY_DOT = 'rgba(180, 176, 176, 0.6)';
const GRAY_LINE = 'rgba(150, 146, 146, 0.35)';
const CARD_HEIGHT = 130;
const TIMELINE_DOT_SIZE = 15;
const TIMELINE_COL_WIDTH = 50;

// How far from the top the title starts before the user scrolls
const INITIAL_TOP_PADDING = 210;

// ─── Data ─────────────────────────────────────────────────────────────────────

type EntryType =
  | { type: 'image'; title: string; imageUrl: string }
  | { type: 'text'; text: string }
  | { type: 'none' };

interface DayData {
  date: string;
  entry: EntryType;
}

const FEBRUARY_DATA: DayData[] = [
  { date: 'Feb 1', entry: { type: 'none' } },
  { date: 'Feb 2', entry: { type: 'none' } },
  { date: 'Feb 3', entry: { type: 'none' } },
  { date: 'Feb 4', entry: { type: 'image', title: 'Timber', imageUrl: DOG_IMAGE_URL } },
  { date: 'Feb 5', entry: { type: 'none' } },
  { date: 'Feb 6', entry: { type: 'text', text: '"Birthday!"' } },
  { date: 'Feb 7', entry: { type: 'none' } },
  { date: 'Feb 8', entry: { type: 'none' } },
  { date: 'Feb 9', entry: { type: 'none' } },
  { date: 'Feb 10', entry: { type: 'text', text: 'Morning hike' } },
  { date: 'Feb 11', entry: { type: 'none' } },
  { date: 'Feb 12', entry: { type: 'none' } },
  { date: 'Feb 13', entry: { type: 'none' } },
  { date: 'Feb 14', entry: { type: 'text', text: "Valentine's Day" } },
  { date: 'Feb 15', entry: { type: 'none' } },
  { date: 'Feb 16', entry: { type: 'none' } },
  { date: 'Feb 17', entry: { type: 'none' } },
  { date: 'Feb 18', entry: { type: 'text', text: 'Team meeting' } },
  { date: 'Feb 19', entry: { type: 'none' } },
  { date: 'Feb 20', entry: { type: 'none' } },
  { date: 'Feb 21', entry: { type: 'none' } },
  { date: 'Feb 22', entry: { type: 'text', text: 'Creative session' } },
  { date: 'Feb 23', entry: { type: 'none' } },
  { date: 'Feb 24', entry: { type: 'none' } },
  { date: 'Feb 25', entry: { type: 'none' } },
  { date: 'Feb 26', entry: { type: 'none' } },
  { date: 'Feb 27', entry: { type: 'none' } },
  { date: 'Feb 28', entry: { type: 'none' } },
];

// ─── Entry icon picker overlay ─────────────────────────────────────────────────

const ENTRY_ICONS: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: 'camera-outline', label: 'Photo' },
  { icon: 'mic-outline', label: 'Voice' },
  { icon: 'create-outline', label: 'Text' },
  { icon: 'videocam-outline', label: 'Video' },
];

// ─── Sub-components ────────────────────────────────────────────────────────────

function OverlayCard({ onClose }: { onClose: () => void }) {
  return (
    <TouchableOpacity
      style={styles.overlayCard}
      activeOpacity={1}
      onPress={onClose}
    >
      {ENTRY_ICONS.map(({ icon, label }) => (
        <TouchableOpacity
          key={icon}
          style={styles.overlayIconButton}
          onPress={() => {/* future: navigate to entry creation */}}
        >
          <Ionicons name={icon} size={34} color="#1C1A1A" />
          <Text style={styles.overlayIconLabel}>{label}</Text>
        </TouchableOpacity>
      ))}
    </TouchableOpacity>
  );
}

function DayCard({
  day,
  isActive,
  onPress,
}: {
  day: DayData;
  isActive: boolean;
  onPress: () => void;
}) {
  if (isActive) {
    return <OverlayCard onClose={onPress} />;
  }

  const { entry } = day;

  if (entry.type === 'none') {
    return (
      <TouchableOpacity style={styles.emptyCard} activeOpacity={0.8} onPress={onPress}>
        <Text style={styles.noMomentText}>No moment</Text>
      </TouchableOpacity>
    );
  }

  if (entry.type === 'image') {
    return (
      <TouchableOpacity style={styles.imageCard} activeOpacity={0.85} onPress={onPress}>
        <Image source={{ uri: entry.imageUrl }} style={styles.cardImage} resizeMode="cover" />
        <View style={styles.imageContentOverlay}>
          <Ionicons name="camera-outline" size={22} color="white" />
          <Text style={styles.imageTitleText}>{entry.title}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.textCard} activeOpacity={0.85} onPress={onPress}>
      <Text style={styles.textCardContent}>{entry.text}</Text>
      <Ionicons
        name="chevron-forward"
        size={22}
        color="rgba(255,255,255,0.55)"
        style={styles.forwardIcon}
      />
    </TouchableOpacity>
  );
}

function DayRow({
  day,
  isLast,
  isActive,
  onPress,
}: {
  day: DayData;
  isLast: boolean;
  isActive: boolean;
  onPress: () => void;
}) {
  const hasEntry = day.entry.type !== 'none';
  const dotColor = hasEntry ? ORANGE : GRAY_DOT;
  const lineColor = hasEntry ? ORANGE : GRAY_LINE;

  return (
    <View style={styles.dayRow}>
      {/* Left timeline rail */}
      <View style={styles.timelineColumn}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        {!isLast && <View style={[styles.line, { backgroundColor: lineColor }]} />}
      </View>

      {/* Right content */}
      <View style={styles.contentColumn}>
        <Text style={styles.dateLabel}>{day.date}</Text>
        <DayCard day={day} isActive={isActive} onPress={onPress} />
      </View>
    </View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function TimelineScreen() {
  const [activeCard, setActiveCard] = useState<string | null>(null);

  const [fontsLoaded] = useFonts({ 'Cabin-Bold': Cabin_700Bold });

  if (!fontsLoaded) {
    return <View style={styles.container} />;
  }

  const handleCardPress = (date: string) => {
    setActiveCard((prev) => (prev === date ? null : date));
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          stickyHeaderIndices={[0]}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Sticky header: starts at INITIAL_TOP_PADDING, snaps to top on scroll ── */}
          <View style={styles.stickyHeader}>
            <Text style={styles.headerTitle}>Your Timeline</Text>
          </View>

          {/* ── Timeline days ── */}
          {FEBRUARY_DATA.map((day, index) => (
            <DayRow
              key={day.date}
              day={day}
              isLast={index === FEBRUARY_DATA.length - 1}
              isActive={activeCard === day.date}
              onPress={() => handleCardPress(day.date)}
            />
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A2A',
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: INITIAL_TOP_PADDING,
    paddingLeft: 14,
    paddingRight: 18,
    paddingBottom: 100,
  },

  // Sticky "Your Timeline" header — background matches screen so it covers content when stuck
  stickyHeader: {
    backgroundColor: '#0A0A2A',
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 12,
  },
  headerTitle: {
    fontFamily: 'Cabin-Bold',
    color: '#FFD5B0',
    fontSize: 38,
    letterSpacing: 0.3,
  },

  // ── Day row ──
  dayRow: {
    flexDirection: 'row',
    minHeight: 195,
  },
  timelineColumn: {
    width: TIMELINE_COL_WIDTH,
    alignItems: 'center',
    paddingTop: 10,
  },
  dot: {
    width: TIMELINE_DOT_SIZE,
    height: TIMELINE_DOT_SIZE,
    borderRadius: TIMELINE_DOT_SIZE / 2,
  },
  line: {
    width: 2.5,
    flex: 1,
    marginTop: 3,
  },
  contentColumn: {
    flex: 1,
    paddingBottom: 14,
  },
  dateLabel: {
    fontFamily: 'Cabin-Bold',
    color: '#FEFEFE',
    fontSize: 44,
    marginBottom: 10,
    lineHeight: 52,
  },

  // ── Cards ──
  emptyCard: {
    backgroundColor: 'rgba(131, 124, 124, 0.35)',
    borderRadius: 28,
    height: CARD_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noMomentText: {
    fontFamily: 'Cabin-Bold',
    color: 'rgba(255, 255, 255, 0.22)',
    fontSize: 16,
  },
  imageCard: {
    borderRadius: 28,
    height: CARD_HEIGHT,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  imageContentOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    padding: 12,
  },
  imageTitleText: {
    fontFamily: 'Cabin-Bold',
    color: '#FFFFFF',
    fontSize: 16,
  },
  textCard: {
    backgroundColor: 'rgba(40, 65, 129, 0.45)',
    borderRadius: 28,
    height: CARD_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  textCardContent: {
    fontFamily: 'Cabin-Bold',
    color: 'rgba(255, 255, 255, 0.88)',
    fontSize: 26,
    flex: 1,
    textAlign: 'center',
  },
  forwardIcon: {
    position: 'absolute',
    right: 14,
  },

  // ── Entry-type overlay (shown when card is tapped) ──
  overlayCard: {
    backgroundColor: 'rgba(212, 207, 202, 0.92)',
    borderRadius: 28,
    height: CARD_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 8,
  },
  overlayIconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
  },
  overlayIconLabel: {
    color: '#1C1A1A',
    fontSize: 11,
    fontFamily: 'Cabin-Bold',
  },
});
