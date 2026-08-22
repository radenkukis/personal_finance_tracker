import { useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, SectionList, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Button, Divider, EmptyState, Field, Txt } from '@/components/ui';
import { TransactionRow } from '@/components/TransactionRow';
import { useData } from '@/store/data';
import { colors, radius, size, space } from '@/lib/theme';
import { dayKey, relativeDay } from '@/lib/format';
import { useMoney } from '@/hooks/useMoney';
import type { TransactionWithRefs } from '@/types/db';

type Filter = 'all' | 'expense' | 'income';

export default function RiwayatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { transactions, refresh, deleteTransaction } = useData();
  const { money } = useMoney();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const sections = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const filtered = transactions.filter((t) => {
      if (filter !== 'all' && t.kind !== filter) return false;
      if (!needle) return true;
      return [t.merchant, t.note, t.category?.name, t.account?.name, t.raw_input]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(needle));
    });

    // Dikelompokkan per hari, dengan total harian di judul kelompok —
    // pertanyaan "kemarin habis berapa" terjawab tanpa menjumlah sendiri.
    const groups = new Map<string, TransactionWithRefs[]>();
    for (const t of filtered) {
      const key = dayKey(new Date(t.occurred_at));
      const bucket = groups.get(key);
      if (bucket) bucket.push(t);
      else groups.set(key, [t]);
    }

    return [...groups.entries()].map(([key, data]) => ({
      key,
      title: relativeDay(new Date(data[0]!.occurred_at)),
      total: data
        .filter((t) => t.kind === 'expense')
        .reduce((acc, t) => acc + Number(t.amount), 0),
      data,
    }));
  }, [transactions, query, filter]);

  function confirmDelete(tx: TransactionWithRefs) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Hapus transaksi?',
      `${tx.merchant ?? tx.category?.name ?? 'Transaksi'} · ${money(Number(tx.amount))}`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: () => void deleteTransaction(tx.id),
        },
      ],
    );
  }

  return (
    <View style={{ flex: 1, paddingTop: insets.top + space.md }}>
      <View style={{ paddingHorizontal: space.lg, gap: space.md }}>
        <Txt variant="title">Riwayat</Txt>

        <Field
          icon="search"
          value={query}
          onChangeText={setQuery}
          placeholder="Cari tempat, kategori, catatan…"
          autoCapitalize="none"
        />

        <View style={{ flexDirection: 'row', gap: 6 }}>
          {(
            [
              ['all', 'Semua'],
              ['expense', 'Keluar'],
              ['income', 'Masuk'],
            ] as const
          ).map(([value, label]) => (
            <Pressable
              key={value}
              onPress={() => setFilter(value)}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === value }}
              style={{
                paddingHorizontal: space.lg,
                paddingVertical: 7,
                borderRadius: radius.pill,
                backgroundColor: filter === value ? colors.accentDim : colors.surfaceRaised,
                borderWidth: 1,
                borderColor: filter === value ? colors.accent : 'transparent',
              }}
            >
              <Txt variant="caption" color={filter === value ? colors.accent : colors.textMuted}>
                {label}
              </Txt>
            </Pressable>
          ))}
        </View>
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
            <TransactionRow tx={item} onPress={() => confirmDelete(item)} />
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon={query ? 'search' : 'inbox'}
            title={query ? 'Tidak ada yang cocok' : 'Belum ada transaksi'}
            body={
              query
                ? 'Coba kata kunci lain, atau ubah filternya.'
                : 'Semua yang kamu catat akan muncul di sini, dikelompokkan per hari.'
            }
            action={
              query ? undefined : (
                <Button title="Catat sekarang" icon="plus" onPress={() => router.push('/add')} />
              )
            }
          />
        }
      />

      {transactions.length > 0 ? (
        <View style={styles.hint}>
          <Feather name="info" size={11} color={colors.textFaint} />
          <Txt variant="caption" color={colors.textFaint}>
            Ketuk transaksi untuk menghapus
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
