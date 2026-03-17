import { Cabin_400Regular, Cabin_700Bold } from '@expo-google-fonts/cabin';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
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
const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// Known journal entries per month (0-indexed). Add more here as the user journals.
const ENTRIES_BY_MONTH: Record<number, Set<number>> = {
  1: new Set([4, 6, 10, 14, 18, 22]), // February
};

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
  colIndex,
  entryDays,
  isToday,
}: {
  day: number | null;
  colIndex: number;
  entryDays: Set<number>;
  isToday: boolean;
}) {
  const hasEntry = day !== null && entryDays.has(day);

  return (
    <View style={styles.dayCell}>
      {day !== null && (
        <View style={styles.dayCellInner}>
          <Text
            style={[
              styles.dayNumber,
              hasEntry && styles.entryNumber,
            ]}
          >
            {day}
          </Text>
          {isToday ? <StarIndicator /> : <View style={styles.starPlaceholder} />}
        </View>
      )}
    </View>
  );
}

// ─── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ entryCount, totalDays }: { entryCount: number; totalDays: number }) {
  const fillWidth = totalDays > 0 ? (entryCount / totalDays) * BAR_WIDTH : 0;

  return (
    <View style={styles.progressSection}>
      <View style={styles.progressTrack}>
        <View style={styles.progressGhost} />
        <View style={[styles.progressFill, { width: fillWidth }]} />
      </View>
      <Text style={styles.entriesLabel}>
        {entryCount}/{totalDays} monthly entries
      </Text>
    </View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function CalendarScreen() {
  // Derive today once so we can highlight the current date cell
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();   // 0-indexed
  const todayDay = today.getDate();      // 1-indexed day number

  // Default to the current month
  const [monthIndex, setMonthIndex] = useState(todayMonth);

  const [fontsLoaded] = useFonts({
    'Cabin-Bold': Cabin_700Bold,
    'Cabin-Regular': Cabin_400Regular,
  });

  if (!fontsLoaded) return <View style={styles.container} />;

  // Wrap-around navigation: Dec → Jan, Jan → Dec
  const goBack = () => setMonthIndex((i) => (i === 0 ? 11 : i - 1));
  const goForward = () => setMonthIndex((i) => (i === 11 ? 0 : i + 1));

  const totalDays = daysInMonth(YEAR, monthIndex);
  const entryDays = ENTRIES_BY_MONTH[monthIndex] ?? new Set<number>();
  const entryCount = entryDays.size;
  const weeks = buildCalendarWeeks(YEAR, monthIndex);
  const monthLabel = `${MONTH_NAMES[monthIndex]} ${YEAR}`;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#171854', '#10103B', '#090921']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
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
                  return (
                    <DayCell
                      key={di}
                      day={day}
                      colIndex={di}
                      entryDays={entryDays}
                      isToday={isToday}
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
    marginTop: 52,
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
    backgroundColor: ORANGE,
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
});
