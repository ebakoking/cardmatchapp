import { COLORS } from './colors';

export const FONTS = {
  h1: { fontSize: 32, fontWeight: '700' as const, color: COLORS.text },
  h2: { fontSize: 24, fontWeight: '600' as const, color: COLORS.text },
  h3: { fontSize: 18, fontWeight: '600' as const, color: COLORS.text },
  body: { fontSize: 16, fontWeight: '400' as const, color: COLORS.text },
  caption: {
    fontSize: 14,
    fontWeight: '400' as const,
    color: COLORS.textMuted,
  },
  button: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: COLORS.text,
  },
};

