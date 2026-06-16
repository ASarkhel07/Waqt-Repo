import { Cabin_400Regular, Cabin_700Bold } from '@expo-google-fonts/cabin';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import { RadialBackground } from '@/components/radial-background';
import { supabase } from '@/lib/supabase';
import { StatusBar } from 'expo-status-bar';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── Constants ─────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const H_PAD = 22;
const CARD_H_PAD = 14;
const CELL_SIZE = (SCREEN_WIDTH - H_PAD * 2 - CARD_H_PAD * 2) / 7;
const BAR_WIDTH = SCREEN_WIDTH - H_PAD * 2;

const ORANGE = '#F2A65A';
const GRAY = '#8E8E93';
const DIM = 'rgba(142,142,147,0.35)';

const YEAR = 2026;
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// ─── Entry types ───────────────────────────────────────────────────────────────

type DayEntry =
  | { type: 'text';  id: string; title: string | null; body: string | null; coverUrl: string | null }
  | { type: 'image'; id: string; imageUrl: string | null; caption: string | null };

// TEST BYPASS: fallback user ID when not signed in
const TEST_USER_ID = 'test-user-00000000-0000-0000-0000-000000000000';

// ─── Date helpers ──────────────────────────────────────────────────────────────

/** Number of days in a given month (0-indexed). */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** 0 = Sunday … 6 = Saturday for the 1st of the month. */
function firstWeekdayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

/**
 * Build a calendar grid for the given month.
 * Returns rows of 7 cells; cells are `null` for padding before/after the month.
 */
function buildCalendarWeeks(year: number, month: number): (number | null)[][] {
  const total = daysInMonth(year, month);
  const leadingBlanks = firstWeekdayOfMonth(year, month);

  const cells: (number | null)[] = [
    ...Array<null>(leadingBlanks).fill(null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];

  // Pad trailing cells to complete the last row
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StarIndicator() {
  return <Text style={styles.starText}>✦</Text>;
}

function DayCell({
  day,
  entryMap,
  isToday,
  isPast,
  onPress,
}: {
  day: number | null;
  entryMap: Map<number, DayEntry>;
  isToday: boolean;
  isPast: boolean;
  onPress: () => void;
}) {
  const entry = day !== null ? entryMap.get(day) : undefined;
  const hasEntry = entry !== undefined;
  const tappable = (isPast || isToday) && hasEntry;

  const inner = day !== null ? (
    <View style={styles.dayCellInner}>
      <Text style={[styles.dayNumber, hasEntry && styles.entryNumber]}>
        {day}
      </Text>
      {isToday
        ? <StarIndicator />
        : hasEntry
          ? <View style={styles.entryDot} />
          : <View style={styles.starPlaceholder} />}
    </View>
  ) : null;

  if (tappable) {
    return (
      <TouchableOpacity style={styles.dayCell} activeOpacity={0.6} onPress={onPress}>
        {inner}
      </TouchableOpacity>
    );
  }

  return <View style={styles.dayCell}>{inner}</View>;
}

// ─── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ entryCount, totalDays }: { entryCount: number; totalDays: number }) {
  const fillWidth = totalDays > 0 ? (entryCount / totalDays) * BAR_WIDTH : 0;

  return (
    <View style={styles.progressSection}>
      <View style={styles.progressTrack}>
        <View style={styles.progressGhost} />
        <LinearGradient
          colors={['#6B3D00', ORANGE]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.progressFill, { width: fillWidth }]}
        />
      </View>
      <Text style={styles.entriesLabel}>
        {entryCount}/{totalDays} monthly entries
      </Text>
    </View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────

async function fetchEntryDaysForMonth(month: number, userId: string): Promise<Map<number, DayEntry>> {
  const map = new Map<number, DayEntry>();
  const startDate = `${YEAR}-${String(month + 1).padStart(2, '0')}-01`;
  const endDate   = `${YEAR}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth(YEAR, month)).padStart(2, '0')}`;

  const [{ data: textData }, { data: imageData }] = await Promise.all([
    supabase
      .from('text_entry')
      .select('id, entry_date, title, body, cover_image_url')
      .eq('user_id', userId)
      .gte('entry_date', startDate)
      .lte('entry_date', endDate),
    supabase
      .from('image_entries')
      .select('id, created_at, image_url, caption')
      .eq('user_id', userId)
      .gte('created_at', `${startDate}T00:00:00.000Z`)
      .lte('created_at', `${endDate}T23:59:59.999Z`),
  ]);

  // Text entries first
  for (const row of textData ?? []) {
    const day = parseInt((row.entry_date as string).slice(8, 10), 10);
    map.set(day, { type: 'text', id: row.id, title: row.title, body: row.body, coverUrl: row.cover_image_url });
  }
  // Image entries override text entries for the same day (matches timeline priority)
  for (const row of imageData ?? []) {
    const day = parseInt((row.created_at as string).slice(8, 10), 10);
    map.set(day, { type: 'image', id: row.id, imageUrl: row.image_url, caption: row.caption });
  }

  return map;
}

export default function CalendarScreen() {
  // Derive today once so we can highlight the current date cell
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();   // 0-indexed
  const todayDay = today.getDate();      // 1-indexed day number

  // Default to the current month
  const [monthIndex, setMonthIndex] = useState(todayMonth);
  const [entryMap, setEntryMap] = useState<Map<number, DayEntry>>(new Map());

  const [fontsLoaded] = useFonts({
    'Cabin-Bold': Cabin_700Bold,
    'Cabin-Regular': Cabin_400Regular,
  });

  const loadEntries = useCallback((month: number) => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      const userId = user?.id ?? TEST_USER_ID;
      fetchEntryDaysForMonth(month, userId)
        .then(setEntryMap)
        .catch(console.error);
    });
  }, []);

  // Reload whenever the month changes
  useEffect(() => {
    loadEntries(monthIndex);
  }, [monthIndex, loadEntries]);

  // Reload whenever this tab comes into focus (picks up newly saved entries)
  useFocusEffect(
    useCallback(() => {
      loadEntries(monthIndex);
    }, [monthIndex, loadEntries]),
  );

  if (!fontsLoaded) return <View style={styles.container} />;

  // Wrap-around navigation: Dec → Jan, Jan → Dec
  const goBack = () => setMonthIndex((i) => (i === 0 ? 11 : i - 1));
  const goForward = () => setMonthIndex((i) => (i === 11 ? 0 : i + 1));

  const totalDays = daysInMonth(YEAR, monthIndex);
  const entryCount = entryMap.size;
  const weeks = buildCalendarWeeks(YEAR, monthIndex);
  const monthLabel = `${MONTH_NAMES[monthIndex]} ${YEAR}`;

  function handleDayPress(day: number, isToday: boolean) {
    const entry = entryMap.get(day);
    if (!entry) return;
    const dateLabel = `${SHORT_MONTHS[monthIndex]} ${day}`;
    if (entry.type === 'image') {
      router.push({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pathname: '/photo-entry' as any,
        params: {
          date:            dateLabel,
          readOnly:        'true',
          isToday:         isToday ? 'true' : 'false',
          entryId:         entry.id,
          prefillImageUrl: entry.imageUrl ?? '',
          prefillCaption:  entry.caption  ?? '',
        },
      });
    } else {
      router.push({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pathname: '/note-entry' as any,
        params: {
          date:         dateLabel,
          readOnly:     'true',
          isToday:      isToday ? 'true' : 'false',
          entryId:      entry.id,
          prefillTitle: entry.title    ?? '',
          prefillBody:  entry.body     ?? '',
          prefillCover: entry.coverUrl ?? '',
        },
      });
    }
  }

  return (
    <View style={styles.container}>
      <RadialBackground />
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>

        {/* ── Page title ── */}
        <View style={styles.headerSection}>
          <Text style={styles.pageTitle}>Your Progress</Text>
        </View>

        {/* ── Progress bar ── */}
        <View style={styles.progressWrapper}>
          <ProgressBar entryCount={entryCount} totalDays={totalDays} />
        </View>

        {/* ── Calendar card ── */}
        <View style={styles.calendarCard}>

          {/* Month navigation */}
          <View style={styles.monthNav}>
            <TouchableOpacity style={styles.navBtn} onPress={goBack} activeOpacity={0.6}>
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <Text style={styles.monthLabel}>{monthLabel}</Text>

            <TouchableOpacity style={styles.navBtn} onPress={goForward} activeOpacity={0.6}>
              <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Day-of-week header row */}
          <View style={styles.dayHeaderRow}>
            {DAY_LABELS.map((label, i) => (
              <View key={label} style={styles.dayHeaderCell}>
                <Text style={[styles.dayHeaderText, i === 0 && styles.sundayHeader]}>
                  {label}
                </Text>
              </View>
            ))}
          </View>

          {/* Separator */}
          <View style={styles.divider} />

          {/* Date grid — rebuilt every time monthIndex changes */}
          <View style={styles.dateGrid}>
            {weeks.map((week, wi) => (
              <View key={wi} style={styles.weekRow}>
                {week.map((day, di) => {
                  const isToday =
                    day !== null &&
                    YEAR === todayYear &&
                    monthIndex === todayMonth &&
                    day === todayDay;
                  const isPast =
                    day !== null && (
                      monthIndex < todayMonth ||
                      (monthIndex === todayMonth && day < todayDay)
                    );
                  return (
                    <DayCell
                      key={di}
                      day={day}
                      entryMap={entryMap}
                      isToday={isToday}
                      isPast={isPast}
                      onPress={() => day !== null && handleDayPress(day, isToday)}
                    />
                  );
                })}
              </View>
            ))}
          </View>

        </View>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090921', // darkest gradient stop — shown before gradient renders
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: H_PAD,
  },

  // ── Title ──
  headerSection: {
    marginTop: 130,
    marginBottom: 18,
  },
  pageTitle: {
    fontFamily: 'Cabin-Bold',
    color: '#FFD5B0',
    fontSize: 42,
    letterSpacing: 0.2,
  },

  // ── Progress bar ──
  progressWrapper: {
    marginBottom: 38,
  },
  progressSection: {
    gap: 10,
  },
  progressTrack: {
    height: 20,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  progressGhost: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(242, 166, 90, 0.25)',
    borderRadius: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 12,
  },
  entriesLabel: {
    fontFamily: 'Cabin-Bold',
    color: ORANGE,
    fontSize: 17,
  },

  // ── Calendar card ──
  calendarCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: CARD_H_PAD,
    paddingTop: 20,
    paddingBottom: 18,
  },

  // ── Month navigation ──
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
    paddingHorizontal: 4,
  },
  navBtn: {
    padding: 4,
    width: 34,
    alignItems: 'center',
  },
  monthLabel: {
    fontFamily: 'Cabin-Regular',
    color: '#FBF8FF',
    fontSize: 22,
    textAlign: 'center',
    flex: 1,
  },

  // ── Day headers ──
  dayHeaderRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  dayHeaderCell: {
    width: CELL_SIZE,
    alignItems: 'center',
  },
  dayHeaderText: {
    fontFamily: 'Cabin-Bold',
    color: GRAY,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  sundayHeader: {
    color: ORANGE,
  },

  // ── Divider ──
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginBottom: 14,
    marginHorizontal: 2,
  },

  // ── Date grid ──
  dateGrid: {
    gap: 4,
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    width: CELL_SIZE,
    alignItems: 'center',
    paddingVertical: 6,
  },
  dayCellInner: {
    alignItems: 'center',
    gap: 3,
  },
  dayNumber: {
    fontFamily: 'Cabin-Bold',
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 22,
  },
  dayNumberNoEntry: {
    fontFamily: 'Cabin-Regular',
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 22,
  },
  sundayNumber: {
    color: ORANGE,
  },
  entryNumber: {
    color: ORANGE,
  },

  // ── Star indicator ──
  starText: {
    color: ORANGE,
    fontSize: 9,
    lineHeight: 11,
  },
  starPlaceholder: {
    height: 11,
  },
  entryDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: ORANGE,
  },
});
