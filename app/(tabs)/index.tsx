import { RadialBackground } from '@/components/radial-background';
import { supabase } from '@/lib/supabase';
import { Cabin_700Bold } from '@expo-google-fonts/cabin';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { router, useFocusEffect } from 'expo-router';
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

function toISODate(year: number, month: number, day: number): string {
  // month is 0-indexed (matching JS Date), so add 1 for ISO format
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

async function getDaysEntries(year: number, month: number, day: number) {
  const { data, error } = await supabase
    .from('text_entry')
    .select('*')
    .eq('entry_date', toISODate(year, month, day));
  if (error) throw error;
  return data ?? [];
}

async function hasDaysEntries(year: number, month: number, day: number): Promise<boolean> {
  // Build start/end using a real Date so month-end rollover is handled correctly
  const start = new Date(year, month, day);
  const end   = new Date(year, month, day + 1);
  const fmt   = (d: Date) => d.toISOString().split('T')[0]; // "YYYY-MM-DD"
  const { count, error } = await supabase
    .from('text_entry')
    .select('*', { count: 'exact', head: true })
    .gte('entry_date', fmt(start))
    .lt('entry_date', fmt(end));
  if (error) throw error;
  return (count ?? 0) > 0;
}

//Note: This area is referred to as the module level, outside the component.
async function fetchYearEntries(userId: string): Promise<Map<string, NotePreview>> { 
  const {data, error} = await supabase
  .from('text_entry')
  .select('id, entry_date, title, body, cover_image_url')
  .eq('user_id', userId)
  .gte('entry_date', `${YEAR}-01-01`)
  .lte('entry_date', `${YEAR}-12-31`);

  if(error){
    console.warn('fetchYearEntries error:', error.message);
    return new Map();
  }

  const map = new Map<string, NotePreview>();
  for(const row of data ?? []){
    map.set(row.entry_date, {id: row.id, title: row.title, body: row.body, coverUrl: row.cover_image_url});
  }
  return map;
}

//Function for images
async function fetchYearEntriesImage(userId: string): Promise<Map<string, ImagePreview>>{
  const {data, error} = await supabase
  .from('image_entries')
  .select('id, created_at, caption, image_url')
  .eq('user_id', userId)
  .gte('created_at', `${YEAR}-01-01`)
  .lte('created_at', `${YEAR}-12-31`);

  if(error){
    console.warn('fetchYearEntriesImage error:', error.message);
    return new Map();
  }

  const map = new Map<string, ImagePreview>();
  for(const row of data ?? []){
    // created_at is a full ISO timestamp ("2026-04-25T18:30:00Z").
    // Slice the first 10 chars to get the "YYYY-MM-DD" date key that
    // matches the isoDate field on each DayItem.
    const dateKey = (row.created_at as string).slice(0, 10);
    map.set(dateKey, {id: row.id, caption: row.caption, imageUrl: row.image_url});
  }
  return map;
}

async function fetchYearEntriesAudio(userId: string): Promise<Map<string, AudioPreview>> {
  const {data, error} = await supabase
    .from('audio_entries')
    .select('created_at, audio_url, duration_seconds, title') // created_at needed for date key
    .eq('user_id', userId)
    .gte('created_at', `${YEAR}-01-01`)
    .lte('created_at', `${YEAR}-12-31`);

  if (error) {
    console.warn('fetchYearEntriesAudio error:', error.message);
    return new Map();
  }

  const map = new Map<string, AudioPreview>();
  for (const row of data ?? []) {
    const dateKey = (row.created_at as string).slice(0, 10);
    // Old entries stored a bare storage path; new entries store the full public URL.
    // Normalise both so the player always receives a valid https:// URL.
    const rawUrl: string = row.audio_url ?? '';
    const audioUrl = rawUrl.startsWith('http')
      ? rawUrl
      : supabase.storage.from('audio').getPublicUrl(rawUrl).data.publicUrl;
    map.set(dateKey, {
      audioUrl,
      durationSeconds: row.duration_seconds,
      title: row.title,
    });
  }
  if ((data ?? []).length === 0) {
    console.log('[AudioMap] no rows returned — check audio_entries SELECT RLS policy');
  }
  return map;
}

// ─── Entry data ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ImageSource = any;

type EntryType =
  | { type: 'image'; title: string; imageSource: ImageSource }
  | { type: 'text'; text: string }
  | { type: 'none' };

type NotePreview = {
  id: string | null;
  title: string | null;
  body: string | null;
  coverUrl: string | null;
}

type ImagePreview = {
  id: string | null;
  caption: string | null;
  imageUrl: string | null;
}

type AudioPreview ={
  audioUrl: string | null;
  durationSeconds: number | null;
  title: string | null;
}

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
  isPast: boolean;
  hasEntry: boolean;
  entry: EntryType;
  isoDate: string;
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

      // Compare full ISO date strings — handles month boundaries correctly.
      // e.g. "2026-01-20" < "2026-05-16" → Jan 20 is correctly marked past in May.
      const isoDate = toISODate(YEAR, month, day);
      const todayIso = toISODate(todayYear, todayMonth, todayDay);

      items.push({
        type: 'day',
        key: `${month}-${day}`,
        dateLabel: `${SHORT_MONTHS[month]} ${day}`,
        month,
        dayNum: day,
        isToday,
        isPast: !isToday && isoDate < todayIso,
        hasEntry: !isToday && entry.type !== 'none',
        entry,
        isoDate,
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

//formatting the seconds for audio preview
function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Entry icon overlay ───────────────────────────────────────────────────────

const ENTRY_ICONS: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: 'camera-outline', label: 'Photo' },
  { icon: 'mic-outline', label: 'Voice' },
  { icon: 'create-outline', label: 'Text' },
  //{ icon: 'videocam-outline', label: 'Video' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function OverlayCard({ onClose, dateLabel }: { onClose: () => void; dateLabel: string }) {
  function handleIconPress(label: string) {
    onClose();
    if (label === 'Photo') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.push({ pathname: '/photo-entry' as any, params: { date: dateLabel } });
    } else if (label === 'Text') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.push({ pathname: '/note-entry' as any, params: { date: dateLabel } });
    } else if (label === 'Voice') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.push({ pathname: '/audio-entry' as any, params: { date: dateLabel } });
    }
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
  todayHasEntry,
  notePreview,
  imagePreview,
  audioPreview,
}: {
  item: DayItem;
  isActive: boolean;
  onPress: () => void;
  todayHasEntry?: boolean;
  notePreview?: NotePreview | null;
  imagePreview?: ImagePreview | null;
  audioPreview?: AudioPreview | null;
}) {
  if (isActive) {
    return (
      <OverlayCard onClose={onPress} dateLabel={item.dateLabel} />
    );
  }

  if (item.isToday) {
    // If a note was saved for today, show its preview instead of the generic "Memory saved!" card.
    if (notePreview) {
      return (
        <TouchableOpacity style={styles.noteCard} activeOpacity={0.85} onPress={onPress}>
          <Ionicons
            name="create-outline"
            size={16}
            color="rgba(255,255,255,0.4)"
            style={styles.noteCardIcon}
          />
          {notePreview.title ? (
            <Text style={styles.noteCardTitle} numberOfLines={1}>
              {notePreview.title}
            </Text>
          ) : (
            <Text style={styles.noteCardNoTitle}>Untitled</Text>
          )}
          {notePreview.body ? (
            <Text style={styles.noteCardBody} numberOfLines={2}>
              {notePreview.body}
            </Text>
          ) : null}
        </TouchableOpacity>
      );
    }

    //If an image was saved for today, shows its respective preview
    if (imagePreview) {
      return (
        <TouchableOpacity style={styles.imageCard} activeOpacity={0.85} onPress={onPress}>
          {imagePreview.imageUrl ? (
            <Image
              source={{ uri: imagePreview.imageUrl }}
              style={styles.cardImage}
              resizeMode="cover"
              onError={(e) => console.warn('[Image] failed to load:', imagePreview.imageUrl, e.nativeEvent.error)}
            />
          ) : (
            // imageUrl is null — the upload to Supabase Storage failed at save time.
            <View style={styles.imageFallback}>
              <Ionicons name="alert-circle-outline" size={28} color="rgba(255,255,255,0.4)" />
            </View>
          )}
          <View style={styles.imageContentOverlay}>
            <Ionicons name="camera-outline" size={22} color="white" />
            {imagePreview.caption ? (
              <Text style={styles.imageTitleText} numberOfLines={1}>
                {imagePreview.caption}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>
      );
    }

    if(audioPreview) {
      return (
        <TouchableOpacity style={styles.audioCard} activeOpacity={0.85} onPress={onPress}>
          <Ionicons name="mic-outline" size={20} color={PEACH} />
          <Text style={styles.audioCardTitle}>
            {audioPreview.title ?? 'Voice note'}
          </Text>
          {audioPreview.durationSeconds ? (
            <Text style={styles.audioCardDuration}>
              {formatSeconds(audioPreview.durationSeconds)}
            </Text>
          ) : null}
        </TouchableOpacity>
      );
    }


    const cardStyle = todayHasEntry ? styles.todayCardWithEntry : styles.todayCard;
    const iconColor = todayHasEntry ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.7)';
    const labelText = todayHasEntry ? 'Memory saved!' : 'Create a memory';
    const iconName = todayHasEntry ? 'checkmark-circle-outline' : 'add-circle-outline';
    return (
      <TouchableOpacity style={cardStyle} activeOpacity={0.85} onPress={onPress}>
        <Ionicons name={iconName} size={40} color={iconColor} />
        <Text style={styles.createMemoryText}>{labelText}</Text>
      </TouchableOpacity>
    );
  }

  const { entry } = item;

  // Real Supabase audio entry — navigate directly to audio-entry for playback.
  if (audioPreview) {
    return (
      <TouchableOpacity style={styles.audioCard} activeOpacity={0.85} onPress={onPress}>
        <Ionicons name="mic-outline" size={20} color={PEACH} />
        <Text style={styles.audioCardTitle}>
          {audioPreview.title ?? 'Voice note'}
        </Text>
        {audioPreview.durationSeconds ? (
          <Text style={styles.audioCardDuration}>
            {formatSeconds(audioPreview.durationSeconds)}
          </Text>
        ) : null}
      </TouchableOpacity>
    );
  }

  // Real Supabase image entry — show photo card with caption.
  if (imagePreview) {
    return (
      <TouchableOpacity style={styles.imageCard} activeOpacity={0.85} onPress={onPress}>
        {imagePreview.imageUrl ? (
          <Image
            source={{ uri: imagePreview.imageUrl }}
            style={styles.cardImage}
            resizeMode="cover"
            onError={(e) => console.warn('[Image] failed to load:', imagePreview.imageUrl, e.nativeEvent.error)}
          />
        ) : (
          <View style={styles.imageFallback}>
            <Ionicons name="alert-circle-outline" size={28} color="rgba(255,255,255,0.4)" />
          </View>
        )}
        <View style={styles.imageContentOverlay}>
          <Ionicons name="camera-outline" size={22} color="white" />
          {imagePreview.caption ? (
            <Text style={styles.imageTitleText} numberOfLines={1}>
              {imagePreview.caption}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  }

  // Real Supabase text entry — check this before hardcoded ENTRY_DATA.
  if (notePreview) {
    return (
      <TouchableOpacity style={styles.noteCard} activeOpacity={0.85} onPress={onPress}>
        <Ionicons
          name="create-outline"
          size={16}
          color="rgba(255,255,255,0.4)"
          style={styles.noteCardIcon}
        />
        {notePreview.title ? (
          <Text style={styles.noteCardTitle} numberOfLines={1}>
            {notePreview.title}
          </Text>
        ) : (
          <Text style={styles.noteCardNoTitle}>Untitled</Text>
        )}
        {notePreview.body ? (
          <Text style={styles.noteCardBody} numberOfLines={2}>
            {notePreview.body}
          </Text>
        ) : null}
      </TouchableOpacity>
    );
  }

  if (entry.type === 'none') {
    return (
      <TouchableOpacity style={styles.emptyCard} activeOpacity={0.8} onPress={onPress} disabled={true}>
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
  todayHasEntry,
  notePreview,
  imagePreview,
  audioPreview,
}: {
  item: DayItem;
  isLast: boolean;
  isActive: boolean;
  onPress: () => void;
  todayHasEntry?: boolean;
  notePreview?: NotePreview | null;
  imagePreview?: ImagePreview | null;
  audioPreview?: AudioPreview | null;
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
        <DayCard
          item={item}
          isActive={isActive}
          onPress={onPress}
          todayHasEntry={todayHasEntry}
          notePreview={notePreview}
          imagePreview={imagePreview}
          audioPreview={audioPreview}
        />
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TimelineScreen() {
  const flatListRef = useRef<FlatList<TimelineItem>>(null);
  const [activeCard, setActiveCard] = useState<string | null>(null);
  const [fontsLoaded] = useFonts({ 'Cabin-Bold': Cabin_700Bold });
  const [entryMap, setEntryMap] = useState<Map<string, NotePreview>>(new Map());
  const [imageMap, setImageMap] = useState<Map<string, ImagePreview>>(new Map());
  const [audioMap, setAudioMap] = useState<Map<string, AudioPreview>>(new Map());

  // Compute today fresh every time the screen mounts so the "today" card
  // is never stale after midnight or after leaving the app open overnight.
  const { allItems, todayIndex, itemOffsets } = useMemo(() => {
    const now = new Date();
    const allItems = buildYearTimeline(now.getFullYear(), now.getMonth(), now.getDate());
    const todayIndex = allItems.findIndex((item) => item.isToday);
    const itemOffsets = buildOffsets(allItems);
    return { allItems, todayIndex, itemOffsets };
  }, []); // [] = recompute once per component mount

  const [todayHasEntry, setTodayHasEntry] = useState(false);

  useEffect(() => {
    const now = new Date();
    hasDaysEntries(now.getFullYear(), now.getMonth(), now.getDate())
      .then(setTodayHasEntry)
      .catch(console.error);
  }, []);

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

  useFocusEffect(
    useCallback(() => {
      supabase.auth.getUser().then(({data: {user}}) => {
        if(!user) return;
        fetchYearEntries(user.id).then(setEntryMap).catch(console.error);
      });
    }, [])
  )

  useFocusEffect(
    useCallback(() => {
      supabase.auth.getUser().then(({data: {user}}) => {
        if(!user) return;
        fetchYearEntriesImage(user.id).then(setImageMap).catch(console.error);
      });
    }, [])
  )

  useFocusEffect(
    useCallback(() => {
      supabase.auth.getUser().then(({data: {user}}) => {
        if(!user) return;
        fetchYearEntriesAudio(user.id).then(setAudioMap).catch(console.error);
      });
    }, [])
  )

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
    ({ item, index }) => {
      const notePreview  = entryMap.get(item.isoDate)  ?? null;
      const imagePreview = imageMap.get(item.isoDate)  ?? null;
      const audioPreview = audioMap.get(item.isoDate)  ?? null;

      // Decide what tapping a card does:
      //  • audio entry      → open audio-entry for playback
      //  • text/image entry → open the entry screen (editable on today, view-only on past days)
      //  • empty (no entry) → open the overlay picker to create one
      let onPress: () => void;
      if (audioPreview?.audioUrl) {
        onPress = () => router.push({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          pathname: '/audio-entry' as any,
          params: { date: item.dateLabel, audioUrl: audioPreview.audioUrl },
        });
      } else if (notePreview) {
        onPress = () => router.push({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          pathname: '/note-entry' as any,
          params: {
            date:         item.dateLabel,
            readOnly:     'true',
            isToday:      item.isToday ? 'true' : 'false',
            entryId:      notePreview.id ?? '',
            prefillTitle: notePreview.title    ?? '',
            prefillBody:  notePreview.body     ?? '',
            prefillCover: notePreview.coverUrl ?? '',
          },
        });
      } else if (imagePreview) {
        onPress = () => router.push({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          pathname: '/photo-entry' as any,
          params: {
            date:            item.dateLabel,
            readOnly:        'true',
            isToday:         item.isToday ? 'true' : 'false',
            entryId:         imagePreview.id ?? '',
            prefillImageUrl: imagePreview.imageUrl ?? '',
            prefillCaption:  imagePreview.caption  ?? '',
          },
        });
      } else {
        onPress = () => { if (!item.isPast) handleCardPress(item.key); };
      }

      return (
        <DayRow
          item={item}
          isLast={index === allItems.length - 1}
          isActive={activeCard === item.key}
          onPress={onPress}
          todayHasEntry={item.isToday ? todayHasEntry : undefined}
          notePreview={notePreview}
          imagePreview={imagePreview}
          audioPreview={audioPreview}
        />
      );
    },
    [allItems, activeCard, handleCardPress, todayHasEntry, entryMap, imageMap, audioMap],
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
          extraData={[activeCard, todayHasEntry, entryMap, imageMap, audioMap]}
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
  todayCardWithEntry: {
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(52, 199, 89, 0.45)',
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
  imageFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
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
  //Note Preview Card Styles
  noteCard: {
    backgroundColor: 'rgba(40, 65, 129, 0.45)',
    borderRadius: 28,
    height: REGULAR_CARD_H,     // same height as all regular cards
    paddingHorizontal: 18,
    paddingVertical: 14,
    justifyContent: 'flex-start',
    gap: 4,
  },
  noteCardIcon: {
    marginBottom: 2,
  },
  noteCardTitle: {
    fontFamily: 'Cabin-Bold',
    color: 'rgba(255,255,255,0.92)',
    fontSize: 18,
    lineHeight: 22,
  },
  noteCardNoTitle: {
    fontFamily: 'Cabin-Bold',
    color: 'rgba(255,255,255,0.3)',
    fontSize: 18,
    fontStyle: 'italic',
  },
  noteCardBody: {
    fontFamily: 'Cabin-Regular',
    color: 'rgba(255,255,255,0.50)',
    fontSize: 13,
    lineHeight: 19,
  },

  // ── Audio preview card ──
  audioCard: {
    backgroundColor: 'rgba(80, 40, 120, 0.45)',
    borderRadius: 28,
    height: REGULAR_CARD_H,
    paddingHorizontal: 18,
    paddingVertical: 14,
    justifyContent: 'flex-start',
    gap: 6,
  },
  audioCardTitle: {
    fontFamily: 'Cabin-Bold',
    color: 'rgba(255,255,255,0.92)',
    fontSize: 18,
    lineHeight: 22,
  },
  audioCardDuration: {
    fontFamily: 'Cabin-Regular',
    color: PEACH,
    fontSize: 13,
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
