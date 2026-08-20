import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors, radius, size, space } from '@/lib/theme';

/**
 * expo-router 57 tidak lagi mengekspor tipe @react-navigation secara publik,
 * jadi tipe props tab bar diturunkan dari komponen Tabs itu sendiri.
 */
type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];
type TabRoute = TabBarProps['state']['routes'][number];

const TABS = [
  { name: 'index', label: 'Beranda', icon: 'home' },
  { name: 'transactions', label: 'Riwayat', icon: 'list' },
  { name: 'chat', label: 'Tanya', icon: 'message-circle' },
  { name: 'settings', label: 'Atur', icon: 'sliders' },
] as const;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
      tabBar={(props) => <CompactTabBar {...props} />}
    >
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.label }} />
      ))}
    </Tabs>
  );
}

/**
 * Tab bar sendiri, bukan bawaan — supaya tombol tambah bisa duduk di tengah
 * dan tinggi bar tetap padat (58px) sesuai bahasa desain.
 */
function CompactTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Dua tab kiri, tombol tambah, dua tab kanan.
  const left = state.routes.slice(0, 2);
  const right = state.routes.slice(2, 4);

  const renderTab = (route: TabRoute, index: number) => {
    const meta = TABS.find((t) => t.name === route.name);
    if (!meta) return null;
    const focused = state.index === index;

    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={meta.label}
        onPress={() => {
          if (!focused) navigation.navigate(route.name);
        }}
        style={styles.tab}
      >
        <Feather
          name={meta.icon}
          size={size.iconMd}
          color={focused ? colors.accent : colors.textFaint}
        />
        <View
          style={[styles.dot, { backgroundColor: focused ? colors.accent : 'transparent' }]}
        />
      </Pressable>
    );
  };

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom || space.sm }]}>
      <View style={styles.side}>{left.map((r: TabRoute, i: number) => renderTab(r, i))}</View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tambah transaksi"
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push('/add');
        }}
        style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.94 }] }]}
      >
        <Feather name="plus" size={22} color="#04140F" />
      </Pressable>

      <View style={styles.side}>{right.map((r: TabRoute, i: number) => renderTab(r, i + 2))}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    paddingTop: space.sm,
    paddingHorizontal: space.sm,
  },
  side: { flex: 1, flexDirection: 'row' },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 40,
  },
  dot: { width: 4, height: 4, borderRadius: 2 },
  fab: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: space.sm,
    marginTop: -14,
    borderWidth: 4,
    borderColor: colors.bg,
  },
});
