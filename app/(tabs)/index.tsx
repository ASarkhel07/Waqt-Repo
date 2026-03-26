import { Cabin_700Bold } from '@expo-google-fonts/cabin';
import { Ionicons } from '@expo/vector-icons';
import { RadialBackground } from '@/components/radial-background';
import { useFonts } from 'expo-font';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
const PEACH = '#FFD5B0';
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

const SCROLL_TOP_PAD = 8; // small gap between fixed header and first day

// ─── Entry data ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ImageSource = any;

type EntryType =
  | { type: 'image'; title: string; imageSource: ImageSource }
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

type TimelineItem = DayItem;

// ─── Build full-year data ─────────────────────────────────────────────────────
// Accepts today's date so it can be called fresh inside the component each mount,
// ensuring "today" is never stale if the date changes while the app is running.

function buildYearTimeline(
  todayYear: number,
  todayMonth: number,
  todayDay: number,
): DayItem[] {
  const items: DayItem[] = [];

  for (let month = 0; month < 12; month++) {
    const daysInMonth = new Date(YEAR, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const isToday =
        todayYear === YEAR && todayMonth === month && todayDay === day;
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

function buildOffsets(items: DayItem[]): number[] {
  const offsets: number[] = [];
  let y = SCROLL_TOP_PAD;
  for (const item of items) {
    offsets.push(y);
    y += item.isToday ? TODAY_DAY_H : REGULAR_DAY_H;
  }
  return offsets;
}

// ─── Entry icon overlay ───────────────────────────────────────────────────────

const ENTRY_ICONS: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: 'camera-outline', label: 'Photo' },
  { icon: 'mic-outline', label: 'Voice' },
  { icon: 'create-outline', label: 'Text' },
  { icon: 'videocam-outline', label: 'Video' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function OverlayCard({ onClose, dateLabel }: { onClose: () => void; dateLabel: string }) {
  function handleIconPress(label: string) {
    onClose();
    if (label === 'Photo') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.push({ pathname: '/photo-entry' as any, params: { date: dateLabel } });
    }
    // Voice / Text / Video will be wired up when those screens are built
  }

  return (
    <TouchableOpacity style={styles.overlayCard} activeOpacity={1} onPress={onClose}>
      {ENTRY_ICONS.map(({ icon, label }) => (
        <TouchableOpacity
          key={icon}
          style={styles.overlayIconButton}
          onPress={() => handleIconPress(label)}
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
    return (
      <OverlayCard onClose={onPress} dateLabel={item.dateLabel} />
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
  const dotColor = item.hasEntry || item.isToday ? PEACH : GRAY_DOT;
  const lineColor = item.hasEntry || item.isToday ? PEACH : GRAY_LINE;

  return (
    <View style={[styles.dayRow, item.isToday && styles.todayRow]}>
      {/* Left timeline rail */}
      <View style={styles.timelineColumn}>
        {item.isToday ? (
          <Text style={styles.todayStar}>✦</Text>
        ) : (
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
        )}
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

  // Compute today fresh every time the screen mounts so the "today" card
  // is never stale after midnight or after leaving the app open overnight.
  const { allItems, todayIndex, itemOffsets } = useMemo(() => {
    const now = new Date();
    const allItems = buildYearTimeline(now.getFullYear(), now.getMonth(), now.getDate());
    const todayIndex = allItems.findIndex((item) => item.isToday);
    const itemOffsets = buildOffsets(allItems);
    return { allItems, todayIndex, itemOffsets };
  }, []); // [] = recompute once per component mount

  // Scroll to today after fonts (and thus the FlatList) are ready
  useEffect(() => {
    if (!fontsLoaded || todayIndex < 0) return;
    const timer = setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        index: todayIndex,
        viewPosition: 0.08,
        animated: false,
      });
    }, 120);
    return () => clearTimeout(timer);
  }, [fontsLoaded, todayIndex]);

  const handleCardPress = useCallback((key: string) => {
    setActiveCard((prev) => (prev === key ? null : key));
  }, []);

  const getItemLayout = useCallback(
    (_: unknown, index: number): { length: number; offset: number; index: number } => {
      const length = allItems[index].isToday ? TODAY_DAY_H : REGULAR_DAY_H;
      return { length, offset: itemOffsets[index], index };
    },
    [allItems, itemOffsets],
  );

  const renderItem: ListRenderItem<DayItem> = useCallback(
    ({ item, index }) => (
      <DayRow
        item={item}
        isLast={index === allItems.length - 1}
        isActive={activeCard === item.key}
        onPress={() => handleCardPress(item.key)}
      />
    ),
    [allItems, activeCard, handleCardPress],
  );

  if (!fontsLoaded) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      <RadialBackground />
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Fixed header — transparent so the gradient shows through */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Your Timeline</Text>
        </View>

        <FlatList
          ref={flatListRef}
          data={allItems}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          extraData={activeCard}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onScrollToIndexFailed={(info) => {
            flatListRef.current?.scrollToOffset({
              offset: Math.max(0, itemOffsets[info.index] - 80),
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
    backgroundColor: '#090921', // darkest gradient stop — shown before gradient renders
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: SCROLL_TOP_PAD,
    paddingLeft: 14,
    paddingRight: 18,
    paddingBottom: 100,
  },

  // ── Fixed header (transparent — gradient shows through) ──
  header: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 14,
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
  todayStar: {
    color: ORANGE,
    fontSize: 18,
    textAlign: 'center',
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
    height: TODAY_CARD_H,
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
