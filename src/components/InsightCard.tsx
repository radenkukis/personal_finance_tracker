/**
 * Kartu temuan. Sengaja bisa tampil tanpa AI sama sekali: `Finding` dari
 * detectors.ts sudah membawa judul dan penjelasan siap baca. Bila narasi AI
 * tersedia, teksnya yang dipakai — bentuk kartunya tetap sama.
 */
import { View } from 'react-native';
import { Card, IconBadge, Txt } from '@/components/ui';
import { colors, space } from '@/lib/theme';
import type { Finding } from '@/analytics/detectors';
import type { Feather } from '@expo/vector-icons';

type FeatherName = keyof typeof Feather.glyphMap;

const TONE: Record<Finding['severity'], { color: string; icon: FeatherName }> = {
  danger: { color: colors.expense, icon: 'alert-octagon' },
  warning: { color: colors.warning, icon: 'alert-triangle' },
  good: { color: colors.accent, icon: 'check-circle' },
  info: { color: colors.info, icon: 'info' },
};

const KIND_ICON: Partial<Record<Finding['kind'], FeatherName>> = {
  recurring: 'repeat',
  spike: 'trending-up',
  category_surge: 'bar-chart-2',
  budget_risk: 'target',
  budget_over: 'alert-octagon',
};

export function InsightCard({ finding }: { finding: Finding }) {
  const tone = TONE[finding.severity];
  const icon = KIND_ICON[finding.kind] ?? tone.icon;

  return (
    <Card style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
      <IconBadge name={icon} color={tone.color} diameter={30} />
      <View style={{ flex: 1 }}>
        <Txt variant="bodyStrong" color={tone.color}>
          {finding.title}
        </Txt>
        <Txt variant="caption" color={colors.textMuted} style={{ marginTop: 3, lineHeight: 17 }}>
          {finding.detail}
        </Txt>
      </View>
    </Card>
  );
}
