import { useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, SectionList, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Button, Card, Divider, EmptyState, Field, Txt, withAlpha } from '@/components/ui';
import { TransactionRow } from '@/components/TransactionRow';
import { TransactionFilters } from '@/components/TransactionFilters';
import { useData } from '@/store/data';
import { colors, radius, size, space } from '@/lib/theme';
import { dayKey } from '@/lib/format';
import { useMoney } from '@/hooks/useMoney';
import { useT } from '@/hooks/useT';
import { activeFilterCount, applyFilters, EMPTY_FILTERS, type Filters } from '@/lib/filters';
import type { TransactionWithRefs } from '@/types/db';

export default function RiwayatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { transactions, refresh, deleteTransaction } = useData();
  const { money } = useMoney();
  const { d, fill, relativeDay } = useT();

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const activeCount = activeFilterCount(filters);

  const { sections, total, count } = useMemo(() => {
    const filtered = applyFilters(transactions, filters, query);

    // Dikelompokkan per hari, dengan total harian di judul kelompok —
    // pertanyaan "kemarin habis berapa" terjawab tanpa menjumlah sendiri.
    const groups = new Map<string, TransactionWithRefs[]>();
    for (const t of filtered) {
      const key = dayKey(new Date(t.occurred_at));
      const bucket = groups.get(key);
      if (bucket) bucket.push(t);
      else groups.set(key, [t]);
    }

    return {
      sections: [...groups.entries()].map(([key, data]) => ({
        key,
        title: relativeDay(new Date(data[0]!.occurred_at)),
        total: data
          .filter((t) => t.kind === 'expense')
          .reduce((acc, t) => acc + Number(t.amount), 0),
        data,
      })),
      // Total keseluruhan hasil penyaringan — inti gunanya memfilter.
      total: filtered
        .filter((t) => t.kind === 'expense')
        .reduce((acc, t) => acc + Number(t.amount), 0),
      count: filtered.length,
    };
  }, [transactions, query, filters, relativeDay]);

  function confirmDelete(tx: TransactionWithRefs) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      d.history.deleteTitle,
      `${tx.merchant ?? tx.note ?? tx.category?.name ?? d.common.uncategorized} · ${money(Number(tx.amount))}`,
      [
        { text: d.common.cancel, style: 'cancel' },
        { text: d.common.delete, style: 'destructive', onPress: () => void deleteTransaction(tx.id) },
      ],
    );
  }

  const filtering = activeCount > 0 || query.trim().length > 0;

  return (
    <View style={{ flex: 1, paddingTop: insets.top + space.md }}>
      <View style={{ paddingHorizontal: space.lg, gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Txt variant="title">{d.history.title}</Txt>
          {filtering ? (
            <Txt variant="caption" color={colors.textFaint}>
              {fill(d.history.resultSummary, { count, amount: money(total) })}
            </Txt>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Field
              icon="search"
              value={query}
              onChangeText={setQuery}
              placeholder={d.history.searchPlaceholder}
              autoCapitalize="none"
            />
          </View>
          <Pressable
            onPress={() => setShowFilters((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={d.history.filters}
            accessibilityState={{ expanded: showFilters }}
            style={[
              styles.filterBtn,
              (showFilters || activeCount > 0) && {
                borderColor: colors.accent,
                backgroundColor: withAlpha(colors.accent, 0.12),
              },
            ]}
          >
            <Feather
              name="sliders"
              size={16}
              color={activeCount > 0 ? colors.accent : colors.textMuted}
            />
            {activeCount > 0 ? (
              <View style={styles.badge}>
                <Txt variant="caption" color={colors.bg}>
                  {activeCount}
                </Txt>
              </View>
            ) : null}
          </Pressable>
        </View>

        {showFilters ? (
          <Card>
            <TransactionFilters value={filters} onChange={setFilters} />
          </Card>
        ) : null}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: space.lg,
          paddingTop: space.lg,
          paddingBottom: size.tabBarHeight + space.xxl,
        }}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await refresh();
              setRefreshing(false);
            }}
            tintColor={colors.textMuted}
          />
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Txt variant="overline" color={colors.textFaint}>
              {section.title}
            </Txt>
            {section.total > 0 ? (
              <Txt variant="caption" color={colors.textFaint}>
                {money(section.total)}
              </Txt>
            ) : null}
          </View>
        )}
        renderItem={({ item, index, section }) => (
          <View
            style={[
              styles.card,
              index === 0 && styles.cardTop,
              index === section.data.length - 1 && styles.cardBottom,
            ]}
          >
            {index > 0 ? <Divider /> : null}
            <TransactionRow
              tx={item}
              onPress={() => router.push({ pathname: '/edit/[id]', params: { id: item.id } })}
              onLongPress={() => confirmDelete(item)}
            />
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon={filtering ? 'search' : 'inbox'}
            title={filtering ? d.history.noMatchTitle : d.history.emptyTitle}
            body={filtering ? d.history.noMatchBody : d.history.emptyBody}
            action={
              filtering ? (
                <Button
                  title={d.history.clearFilters}
                  variant="secondary"
                  icon="rotate-ccw"
                  onPress={() => {
                    setFilters(EMPTY_FILTERS);
                    setQuery('');
                  }}
                />
              ) : (
                <Button title={d.history.recordNow} icon="plus" onPress={() => router.push('/add')} />
              )
            }
          />
        }
      />

      {transactions.length > 0 ? (
        <View style={styles.hint}>
          <Feather name="info" size={11} color={colors.textFaint} />
          <Txt variant="caption" color={colors.textFaint}>
            {d.history.hint}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}

const styles = {
  sectionHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginTop: space.lg,
    marginBottom: space.sm,
  },
  filterBtn: {
    width: size.touchMin,
    height: size.touchMin,
    borderRadius: radius.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  badge: {
    position: 'absolute' as const,
    top: 4,
    right: 4,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    paddingHorizontal: 3,
    backgroundColor: colors.accent,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  card: {
    backgroundColor: colors.surface,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.hairline,
  },
  cardTop: {
    borderTopWidth: 1,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    overflow: 'hidden' as const,
  },
  cardBottom: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    overflow: 'hidden' as const,
  },
  hint: {
    position: 'absolute' as const,
    bottom: size.tabBarHeight + space.md,
    alignSelf: 'center' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingHorizontal: space.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
  },
};
