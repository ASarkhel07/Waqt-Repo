import { Cabin_700Bold } from '@expo-google-fonts/cabin';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  ListRenderItem,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── Constants ────────────────────────────────────────────────────────────────

const DOG_IMAGE = require('@/assets/images/border_collie_img.jpeg');

const ORANGE = '#F5A855';
const GRAY_DOT = 'rgba(180, 176, 176, 0.6)';
const GRAY_LINE = 'rgba(150, 146, 146, 0.35)';

const YEAR = 2026;
const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// Card heights
const REGULAR_CARD_H = 130;
const TODAY_CARD_H = 200;

// Row height building blocks (kept in sync with StyleSheet values below)
const TIMELINE_TOP_PAD = 10;
const DATE_LABEL_H = 52;   // lineHeight for fontSize 44
const DATE_MARGIN_B = 10;
const ROW_BOTTOM_PAD = 14;
const TODAY_ROW_EXTRA = 34; // additional bottom breathing room for today

const REGULAR_DAY_H =
  TIMELINE_TOP_PAD + DATE_LABEL_H + DATE_MARGIN_B + REGULAR_CARD_H + ROW_BOTTOM_PAD;
// = 10 + 52 + 10 + 130 + 14 = 216

const TODAY_DAY_H =
  TIMELINE_TOP_PAD + DATE_LABEL_H + DATE_MARGIN_B + TODAY_CARD_H + ROW_BOTTOM_PAD + TODAY_ROW_EXTRA;
// = 10 + 52 + 10 + 200 + 14 + 34 = 320

const HEADER_H = 62;              // "Your Timeline" row
const INITIAL_CONTENT_PAD = 210;  // starts content lower on first load

// ─── Entry data ───────────────────────────────────────────────────────────────

type EntryType =
  | { type: 'image'; title: string; imageSource: ReturnType<typeof require> }
  | { type: 'text'; text: string }
  | { type: 'none' };

// month (0-indexed) → day → entry
const ENTRY_DATA: Record<number, Record<number, EntryType>> = {
  1: {
    4: { type: 'image', title: 'Timber', imageSource: DOG_IMAGE },
    6: { type: 'text', text: '"Birthday!"' },
    10: { type: 'text', text: 'Morning hike' },
    14: { type: 'text', text: "Valentine's Day" },
    18: { type: 'text', text: 'Team meeting' },
    22: { type: 'text', text: 'Creative session' },
  },
};

function getEntry(month: number, day: number): EntryType {
  return ENTRY_DATA[month]?.[day] ?? { type: 'none' };
}

// ─── Timeline item types ──────────────────────────────────────────────────────

interface HeaderItem {
  type: 'header';
  key: string;
}

interface DayItem {
  type: 'day';
  key: string;
  dateLabel: string;
  month: number;
  dayNum: number;
  isToday: boolean;
  hasEntry: boolean;
  entry: EntryType;
}

type TimelineItem = HeaderItem | DayItem;

// ─── Build full-year data (module-level, computed once on app start) ──────────

const _now = new Date();
const _todayYear = _now.getFullYear();
const _todayMonth = _now.getMonth();
const _todayDay = _now.getDate();

function buildYearTimeline(): TimelineItem[] {
  const items: TimelineItem[] = [{ type: 'header', key: 'header' }];

  for (let month = 0; month < 12; month++) {
    const daysInMonth = new Date(YEAR, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const isToday =
        _todayYear === YEAR && _todayMonth === month && _todayDay === day;
      const entry = isToday ? { type: 'none' as const } : getEntry(month, day);

      items.push({
        type: 'day',
        key: `${month}-${day}`,
        dateLabel: `${SHORT_MONTHS[month]} ${day}`,
        month,
        dayNum: day,
        isToday,
        hasEntry: !isToday && entry.type !== 'none',
        entry,
      });
    }
  }

  return items;
}

const ALL_ITEMS = buildYearTimeline();
const TODAY_INDEX = ALL_ITEMS.findIndex(
  (item) => item.type === 'day' && (item as DayItem).isToday,
);

// Precompute cumulative y-offsets for getItemLayout — O(1) layout lookups
const ITEM_OFFSETS: number[] = [];
{
  let y = INITIAL_CONTENT_PAD;
  for (const item of ALL_ITEMS) {
    ITEM_OFFSETS.push(y);
    if (item.type === 'header') y += HEADER_H;
    else if ((item as DayItem).isToday) y += TODAY_DAY_H;
    else y += REGULAR_DAY_H;
  }
}

// ─── Entry icon overlay ───────────────────────────────────────────────────────

const ENTRY_ICONS: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: 'camera-outline', label: 'Photo' },
  { icon: 'mic-outline', label: 'Voice' },
  { icon: 'create-outline', label: 'Text' },
  { icon: 'videocam-outline', label: 'Video' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function OverlayCard({ onClose }: { onClose: () => void }) {
  return (
    <TouchableOpacity style={styles.overlayCard} activeOpacity={1} onPress={onClose}>
      {ENTRY_ICONS.map(({ icon, label }) => (
        <TouchableOpacity
          key={icon}
          style={styles.overlayIconButton}
          onPress={() => {/* TODO: navigate to entry creation */}}
        >
          <Ionicons name={icon} size={34} color="#1C1A1A" />
          <Text style={styles.overlayIconLabel}>{label}</Text>
        </TouchableOpacity>
      ))}
    </TouchableOpacity>
  );
}

function DayCard({
  item,
  isActive,
  onPress,
}: {
  item: DayItem;
  isActive: boolean;
  onPress: () => void;
}) {
  if (isActive) {
    // Today's overlay is taller to match the card
    return (
      <OverlayCard onClose={onPress} />
    );
  }

  if (item.isToday) {
    return (
      <TouchableOpacity style={styles.todayCard} activeOpacity={0.85} onPress={onPress}>
        <Ionicons name="add-circle-outline" size={40} color="rgba(255,255,255,0.7)" />
        <Text style={styles.createMemoryText}>Create a memory</Text>
      </TouchableOpacity>
    );
  }

  const { entry } = item;

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
        <Image source={entry.imageSource} style={styles.cardImage} resizeMode="cover" />
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
  item,
  isLast,
  isActive,
  onPress,
}: {
  item: DayItem;
  isLast: boolean;
  isActive: boolean;
  onPress: () => void;
}) {
  const dotColor = item.hasEntry || item.isToday ? ORANGE : GRAY_DOT;
  const lineColor = item.hasEntry || item.isToday ? ORANGE : GRAY_LINE;

  return (
    <View style={[styles.dayRow, item.isToday && styles.todayRow]}>
      {/* Left timeline rail */}
      <View style={styles.timelineColumn}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        {!isLast && <View style={[styles.line, { backgroundColor: lineColor }]} />}
      </View>

      {/* Right content */}
      <View style={[styles.contentColumn, item.isToday && styles.todayContentColumn]}>
        <Text style={styles.dateLabel}>{item.dateLabel}</Text>
        <DayCard item={item} isActive={isActive} onPress={onPress} />
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TimelineScreen() {
  const flatListRef = useRef<FlatList<TimelineItem>>(null);
  const [activeCard, setActiveCard] = useState<string | null>(null);
  const [fontsLoaded] = useFonts({ 'Cabin-Bold': Cabin_700Bold });

  // Scroll to today after fonts (and thus the FlatList) are ready
  useEffect(() => {
    if (!fontsLoaded || TODAY_INDEX < 0) return;
    const timer = setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        index: TODAY_INDEX,
        viewPosition: 0.08, // today appears near the top of the viewport
        animated: false,
      });
    }, 120);
    return () => clearTimeout(timer);
  }, [fontsLoaded]);

  const handleCardPress = useCallback((key: string) => {
    setActiveCard((prev) => (prev === key ? null : key));
  }, []);

  const getItemLayout = useCallback(
    (_: unknown, index: number): { length: number; offset: number; index: number } => {
      const item = ALL_ITEMS[index];
      const length =
        item.type === 'header'
          ? HEADER_H
          : (item as DayItem).isToday
          ? TODAY_DAY_H
          : REGULAR_DAY_H;
      return { length, offset: ITEM_OFFSETS[index], index };
    },
    [],
  );

  const renderItem: ListRenderItem<TimelineItem> = useCallback(
    ({ item, index }) => {
      if (item.type === 'header') {
        return (
          <View style={styles.stickyHeader}>
            <Text style={styles.headerTitle}>Your Timeline</Text>
          </View>
        );
      }

      return (
        <DayRow
          item={item as DayItem}
          isLast={index === ALL_ITEMS.length - 1}
          isActive={activeCard === item.key}
          onPress={() => handleCardPress(item.key)}
        />
      );
    },
    [activeCard, handleCardPress],
  );

  if (!fontsLoaded) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <FlatList
          ref={flatListRef}
          data={ALL_ITEMS}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          stickyHeaderIndices={[0]}
          extraData={activeCard}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onScrollToIndexFailed={(info) => {
            // Fallback: use precomputed offset directly
            flatListRef.current?.scrollToOffset({
              offset: Math.max(0, ITEM_OFFSETS[info.index] - 80),
              animated: false,
            });
          }}
        />
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const TIMELINE_DOT_SIZE = 15;
const TIMELINE_COL_WIDTH = 50;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A2A',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: INITIAL_CONTENT_PAD,
    paddingLeft: 14,
    paddingRight: 18,
    paddingBottom: 100,
  },

  // ── Sticky header ──
  stickyHeader: {
    backgroundColor: '#0A0A2A',
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 12,
    elevation: 10, // Android z-order fix for sticky items
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
    paddingTop: TIMELINE_TOP_PAD,
  },
  todayRow: {
    // no extra outer styles needed; inner card handles the height
  },
  timelineColumn: {
    width: TIMELINE_COL_WIDTH,
    alignItems: 'center',
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
    paddingBottom: ROW_BOTTOM_PAD,
  },
  todayContentColumn: {
    paddingBottom: ROW_BOTTOM_PAD + TODAY_ROW_EXTRA,
  },
  dateLabel: {
    fontFamily: 'Cabin-Bold',
    color: '#FEFEFE',
    fontSize: 44,
    marginBottom: DATE_MARGIN_B,
    lineHeight: DATE_LABEL_H,
  },

  // ── Today card (taller, with CTA) ──
  todayCard: {
    backgroundColor: 'rgba(245, 168, 85, 0.10)',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 168, 85, 0.32)',
    borderRadius: 28,
    height: TODAY_CARD_H,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  createMemoryText: {
    fontFamily: 'Cabin-Bold',
    color: 'rgba(255,255,255,0.65)',
    fontSize: 17,
    letterSpacing: 0.2,
  },

  // ── Regular cards ──
  emptyCard: {
    backgroundColor: 'rgba(131, 124, 124, 0.35)',
    borderRadius: 28,
    height: REGULAR_CARD_H,
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
    height: REGULAR_CARD_H,
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
    height: REGULAR_CARD_H,
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

  // ── Overlay (entry type picker) ──
  overlayCard: {
    backgroundColor: 'rgba(212, 207, 202, 0.92)',
    borderRadius: 28,
    height: REGULAR_CARD_H,
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
