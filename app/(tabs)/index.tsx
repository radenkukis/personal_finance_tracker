import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Divider, EmptyState, IconBadge, SectionLabel, Txt, withAlpha } from '@/components/ui';
import { SafeToSpendCard } from '@/components/SafeToSpendCard';
import { StatStrip } from '@/components/StatStrip';
import { InsightCard } from '@/components/InsightCard';
import { TransactionRow } from '@/components/TransactionRow';
import { DayTrendChart } from '@/components/charts/DayTrendChart';
import { MiniDonut } from '@/components/charts/MiniDonut';
import { useDashboard } from '@/hooks/useDashboard';
import { useData } from '@/store/data';
import { useSession } from '@/store/session';
import { colors, size, space } from '@/lib/theme';
import { monthLabel } from '@/lib/format';

/** Dashboard hanya memperlihatkan tiga temuan teratas; sisanya jadi kebisingan. */
const MAX_INSIGHTS = 3;

export default function BerandaScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { refresh, error } = useData();
  const { profile } = useSession();
  const d = useDashboard();

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const greeting = profile?.display_name ? `Halo, ${profile.display_name}` : 'Halo';

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingTop: insets.top + space.md,
        paddingHorizontal: space.lg,
        paddingBottom: size.tabBarHeight + space.xxl,
        gap: space.lg,
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textMuted} />
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Txt variant="title">{greeting}</Txt>
        <Txt variant="caption" color={colors.textFaint}>
          {monthLabel(new Date())}
        </Txt>
      </View>

      {error ? (
        /*
         * Gagal memuat BUKAN berarti datanya kosong. Sebelum ini keduanya
         * tampil bersamaan, sehingga user melihat "belum ada transaksi"
         * padahal datanya ada — cuma gagal diambil.
         */
        <Card style={{ borderColor: withAlpha(colors.expense, 0.5) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <IconBadge name="wifi-off" color={colors.expense} diameter={32} />
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong" color={colors.expense}>
                Data belum berhasil dimuat
              </Txt>
              <Txt variant="caption" color={colors.textMuted} style={{ marginTop: 2, lineHeight: 17 }}>
                Transaksimu tetap aman tersimpan. Biasanya karena koneksi
                terputus sebentar.
              </Txt>
            </View>
          </View>
          <Button
            title="Coba lagi"
            variant="secondary"
            icon="refresh-cw"
            onPress={onRefresh}
            loading={refreshing}
            style={{ marginTop: space.md }}
          />
          <Txt variant="caption" color={colors.textFaint} style={{ marginTop: space.sm }}>
            {error}
          </Txt>
        </Card>
      ) : d.isEmpty && !d.loading ? (
        <Card>
          <EmptyState
            icon="edit-3"
            title="Belum ada transaksi"
            body="Tulis saja apa adanya, misalnya “kopi 25rb” atau “kemarin bensin 50k gopay”. Sisanya app yang rapikan."
            action={
              <Button
                title="Catat yang pertama"
                icon="plus"
                onPress={() => router.push('/add')}
              />
            }
          />
        </Card>
      ) : (
        <>
          <SafeToSpendCard data={d.safe} spentToday={d.spentToday} />

          <StatStrip
            income={d.monthIncome}
            expense={d.monthExpense}
            previousExpense={d.previousMonthExpense}
          />

          {d.findings.length > 0 ? (
            <View>
              <SectionLabel>Yang perlu kamu tahu</SectionLabel>
              <View style={{ gap: space.sm }}>
                {d.findings.slice(0, MAX_INSIGHTS).map((f, i) => (
                  <InsightCard key={`${f.kind}-${i}`} finding={f} />
                ))}
              </View>
            </View>
          ) : null}

          <View>
            <SectionLabel>Pengeluaran harian</SectionLabel>
            <Card>
              <DayTrendChart series={d.series} projection={d.projection} />
            </Card>
          </View>

          <View>
            <SectionLabel>Ke mana uangnya</SectionLabel>
            <Card>
              <MiniDonut slices={d.slices} />
            </Card>
          </View>

          <View>
            <SectionLabel
              right={
                <Txt variant="caption" color={colors.accent} onPress={() => router.push('/transactions')}>
                  Lihat semua
                </Txt>
              }
            >
              Terakhir dicatat
            </SectionLabel>
            <Card padded={false} style={{ overflow: 'hidden' }}>
              {d.recent.map((tx, i) => (
                <View key={tx.id}>
                  {i > 0 ? <Divider /> : null}
                  <TransactionRow tx={tx} onPress={() => router.push('/transactions')} />
                </View>
              ))}
            </Card>
          </View>
        </>
      )}
    </ScrollView>
  );
}
