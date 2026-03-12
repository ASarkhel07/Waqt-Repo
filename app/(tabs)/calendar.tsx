import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { Cabin_700Bold, Cabin_400Regular } from '@expo-google-fonts/cabin';

// ─── Constants ─────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const H_PAD = 22;
const ORANGE = '#F2A65A';
const GRAY = '#8E8E93';
const DIM = 'rgba(142,142,147,0.4)';

// ─── Calendar data for Feb 2026 ────────────────────────────────────────────────
// Feb 1 2026 = Sunday → perfect 4×7 grid, no overflow days

const TOTAL_DAYS = 28;
const ENTRY_DAYS = new Set([4, 6, 10, 14, 18, 22]);
const ENTRY_COUNT = ENTRY_DAYS.size;

const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const WEEKS: number[][] = [
  [1, 2, 3, 4, 5, 6, 7],
  [8, 9, 10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19, 20, 21],
  [22, 23, 24, 25, 26, 27, 28],
];

// ─── Month navigation state (static for now) ──────────────────────────────────

type MonthInfo = { label: string; year: number; month: number };

const MONTHS: MonthInfo[] = [
  { label: 'January 2026', year: 2026, month: 0 },
  { label: 'February 2026', year: 2026, month: 1 },
  { label: 'March 2026', year: 2026, month: 2 },
];

// ─── Sub-components ────────────────────────────────────────────────────────────

function StarIndicator() {
  return <Text style={styles.starText}>✦</Text>;
}

function DayCell({ day, colIndex }: { day: number; colIndex: number }) {
  const isSunday = colIndex === 0;
  const hasEntry = ENTRY_DAYS.has(day);

  return (
    <View style={styles.dayCell}>
      <View style={styles.dayCellInner}>
        <Text style={[styles.dayNumber, isSunday && styles.sundayNumber]}>{day}</Text>
        {hasEntry ? <StarIndicator /> : <View style={styles.starPlaceholder} />}
      </View>
    </View>
  );
}

// ─── Progress bar ──────────────────────────────────────────────────────────────

const BAR_WIDTH = SCREEN_WIDTH - H_PAD * 2;

function ProgressBar() {
  const fillRatio = ENTRY_COUNT / TOTAL_DAYS;
  const fillWidth = fillRatio * BAR_WIDTH;

  return (
    <View style={styles.progressSection}>
      <View style={styles.progressTrack}>
        {/* Full-width ghost bar */}
        <View style={styles.progressGhost} />
        {/* Filled portion */}
        <View style={[styles.progressFill, { width: fillWidth }]} />
      </View>
      <Text style={styles.entriesLabel}>
        {ENTRY_COUNT}/{TOTAL_DAYS} monthly entries
      </Text>
    </View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function CalendarScreen() {
  const [monthIndex, setMonthIndex] = useState(1); // default to February 2026

  const [fontsLoaded] = useFonts({
    'Cabin-Bold': Cabin_700Bold,
    'Cabin-Regular': Cabin_400Regular,
  });

  if (!fontsLoaded) {
    return <View style={styles.container} />;
  }

  const currentMonth = MONTHS[monthIndex];
  const canGoPrev = monthIndex > 0;
  const canGoNext = monthIndex < MONTHS.length - 1;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>

        {/* ── Page title ── */}
        <View style={styles.headerSection}>
          <Text style={styles.pageTitle}>Your Progress</Text>
        </View>

        {/* ── Progress bar + count ── */}
        <View style={styles.progressWrapper}>
          <ProgressBar />
        </View>

        {/* ── Calendar card ── */}
        <View style={styles.calendarCard}>

          {/* Month navigation */}
          <View style={styles.monthNav}>
            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => canGoPrev && setMonthIndex((i) => i - 1)}
              activeOpacity={canGoPrev ? 0.6 : 1}
            >
              <Ionicons
                name="chevron-back"
                size={22}
                color={canGoPrev ? '#FFFFFF' : 'rgba(255,255,255,0.25)'}
              />
            </TouchableOpacity>

            <Text style={styles.monthLabel}>{currentMonth.label}</Text>

            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => canGoNext && setMonthIndex((i) => i + 1)}
              activeOpacity={canGoNext ? 0.6 : 1}
            >
              <Ionicons
                name="chevron-forward"
                size={22}
                color={canGoNext ? '#FFFFFF' : 'rgba(255,255,255,0.25)'}
              />
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

          {/* Thin separator */}
          <View style={styles.divider} />

          {/* Date grid */}
          <View style={styles.dateGrid}>
            {WEEKS.map((week, wi) => (
              <View key={wi} style={styles.weekRow}>
                {week.map((day, di) => (
                  <DayCell key={day} day={day} colIndex={di} />
                ))}
              </View>
            ))}
          </View>

        </View>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const CARD_H_PAD = 14; // must match calendarCard.paddingHorizontal
const CELL_SIZE = (SCREEN_WIDTH - H_PAD * 2 - CARD_H_PAD * 2) / 7;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A2A',
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
    paddingHorizontal: 14,
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
  sundayNumber: {
    color: ORANGE,
  },
  dimNumber: {
    color: DIM,
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
