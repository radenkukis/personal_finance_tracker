/**
 * Primitif UI dasar. Sengaja sedikit dan tegas: satu bentuk tombol,
 * satu bentuk input, satu bentuk kartu — supaya seluruh app terasa satu bahasa.
 */
import { forwardRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { card, colors, radius, size, space, type } from '@/lib/theme';

// ---------------------------------------------------------------------
// Teks
// ---------------------------------------------------------------------

type TextVariant = keyof typeof type;

export function Txt({
  variant = 'body',
  color = colors.text,
  style,
  children,
  numberOfLines,
  onPress,
}: {
  variant?: TextVariant;
  color?: string;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
  /** Untuk tautan teks seperti "Lihat semua". */
  onPress?: () => void;
}) {
  return (
    <Text
      style={[type[variant] as TextStyle, { color }, style]}
      numberOfLines={numberOfLines}
      onPress={onPress}
      accessibilityRole={onPress ? 'link' : undefined}
      suppressHighlighting={!onPress}
    >
      {children}
    </Text>
  );
}

// ---------------------------------------------------------------------
// Kartu
// ---------------------------------------------------------------------

export function Card({
  style,
  children,
  padded = true,
}: {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  padded?: boolean;
}) {
  return <View style={[card, !padded && { padding: 0 }, style]}>{children}</View>;
}

/** Judul mungil di atas sebuah bagian. */
export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionLabel}>
      <Txt variant="overline" color={colors.textFaint}>
        {children}
      </Txt>
      {right}
    </View>
  );
}

// ---------------------------------------------------------------------
// Tombol
// ---------------------------------------------------------------------

interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  title: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: keyof typeof Feather.glyphMap;
  loading?: boolean;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  title,
  variant = 'primary',
  icon,
  loading = false,
  full = false,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const tone = BUTTON_TONES[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: tone.bg, borderColor: tone.border },
        full && { alignSelf: 'stretch' },
        pressed && { opacity: 0.75 },
        isDisabled && { opacity: 0.45 },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" color={tone.fg} />
      ) : (
        <>
          {icon ? <Feather name={icon} size={size.iconSm} color={tone.fg} /> : null}
          <Text style={[type.bodyStrong, { color: tone.fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

const BUTTON_TONES = {
  primary: { bg: colors.accent, fg: '#04140F', border: colors.accent },
  secondary: { bg: colors.surfaceRaised, fg: colors.text, border: colors.hairlineStrong },
  ghost: { bg: 'transparent', fg: colors.textMuted, border: 'transparent' },
  danger: { bg: colors.expenseDim, fg: colors.expense, border: 'transparent' },
} as const;

// ---------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------

interface FieldProps extends TextInputProps {
  label?: string;
  error?: string | null;
  icon?: keyof typeof Feather.glyphMap;
}

export const Field = forwardRef<TextInput, FieldProps>(function Field(
  { label, error, icon, style, ...rest },
  ref,
) {
  return (
    <View style={{ gap: space.xs }}>
      {label ? (
        <Txt variant="overline" color={colors.textFaint}>
          {label}
        </Txt>
      ) : null}
      <View style={[styles.field, !!error && { borderColor: colors.expense }]}>
        {icon ? <Feather name={icon} size={size.iconSm} color={colors.textFaint} /> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textFaint}
          style={[styles.fieldInput, style]}
          {...rest}
        />
      </View>
      {error ? (
        <Txt variant="caption" color={colors.expense}>
          {error}
        </Txt>
      ) : null}
    </View>
  );
});

// ---------------------------------------------------------------------
// Lain-lain
// ---------------------------------------------------------------------

/** Lingkaran berisi ikon — dipakai di baris transaksi & kartu insight. */
export function IconBadge({
  name,
  color,
  bg,
  diameter = 34,
}: {
  name: keyof typeof Feather.glyphMap;
  color: string;
  bg?: string;
  diameter?: number;
}) {
  return (
    <View
      style={{
        width: diameter,
        height: diameter,
        borderRadius: diameter / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bg ?? withAlpha(color, 0.14),
      }}
    >
      <Feather name={name} size={Math.round(diameter * 0.46)} color={color} />
    </View>
  );
}

/** Keadaan kosong yang membimbing, bukan sekadar "belum ada data". */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <IconBadge name={icon} color={colors.textFaint} diameter={44} />
      <Txt variant="bodyStrong" style={{ marginTop: space.md, textAlign: 'center' }}>
        {title}
      </Txt>
      <Txt
        variant="caption"
        color={colors.textMuted}
        style={{ marginTop: space.xs, textAlign: 'center', maxWidth: 260 }}
      >
        {body}
      </Txt>
      {action ? <View style={{ marginTop: space.lg }}>{action}</View> : null}
    </View>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.hairline }} />;
}

/** #RRGGBB + alpha -> rgba(). Untuk warna kategori yang datang dari database. */
export function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const styles = StyleSheet.create({
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  button: {
    height: size.touchMin,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: size.touchMin,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surfaceRaised,
  },
  fieldInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    padding: 0,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.xxl,
    paddingHorizontal: space.lg,
  },
});
