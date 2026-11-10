import type { TikTokGiftKind } from '@/types';

/**
 * What each gift does in the bar, for the two places that show it: the full
 * rules list in the lobby and the compact board on the broadcast overlay.
 *
 * Keep the ids in step with GIFT_RULES in server/index.ts — that table decides
 * the behaviour, this one only describes it.
 */
export interface GiftRule {
  kind?: TikTokGiftKind;
  /** Emoji stand-in until the real TikTok artwork arrives */
  fallback: string;
  gift: string;
  /** Coin price, shown so viewers can see the ladder */
  cost?: number;
  /** Two or three words for the overlay, where there is no room to explain */
  short: string;
  /** The full sentence, for the lobby */
  effect: string;
}

export const GIFT_RULES: GiftRule[] = [
  { kind: 'tiktok', fallback: '🎵', gift: 'TikTok', cost: 1, short: 'ĐỔI SKIN', effect: 'Đổi nhân vật cho người tặng' },
  { kind: 'rose', fallback: '🌹', gift: 'Hoa hồng', cost: 1, short: 'CAMERA', effect: 'Camera lia vào người tặng' },
  { kind: 'gg', fallback: '🙌', gift: 'GG', cost: 1, short: 'CẢ SÀN QUẨY', effect: 'Cả sàn nhảy bật lên theo làn sóng' },
  { kind: 'heart', fallback: '💗', gift: 'Finger Heart', cost: 5, short: 'MƯA TIM', effect: 'Mưa tim bay quanh người tặng' },
  { kind: 'rosa', fallback: '💐', gift: 'Rosa', cost: 10, short: 'RA QUẦY BAR', effect: 'Người tặng ra quầy bar order rượu, camera đi theo' },
  { kind: 'perfume', fallback: '🧴', gift: 'Perfume', cost: 20, short: 'ĐỔI MÀU SÀN', effect: 'Sàn nhảy chuyển màu pastel 8 giây' },
  { kind: 'doughnut', fallback: '🍩', gift: 'Doughnut', cost: 30, short: 'PHÌNH TO', effect: 'Người tặng phình to gấp đôi trong 6 giây' },
  { kind: 'confetti', fallback: '🎉', gift: 'Confetti', cost: 100, short: 'PHÁO GIẤY', effect: 'Bắn pháo giấy toàn phòng' },
  { kind: 'money', fallback: '💸', gift: 'Money Gun', cost: 500, short: 'MƯA TIỀN', effect: 'Mưa tiền vàng · Banner tên cỡ lớn' },
  { kind: 'galaxy', fallback: '🌌', gift: 'Galaxy', cost: 1000, short: 'GALAXY MODE', effect: 'Tắt đèn phòng, laser + strobe hết cỡ 10 giây' },
];

/**
 * Rows with no gift behind them. Likes are free, and "every gift" is a
 * catch-all — neither has an icon to show, so the overlay board skips them
 * and only the lobby list carries them.
 */
export const EXTRA_RULES: GiftRule[] = [
  { fallback: '❤️', gift: 'Tim x5+', short: 'CAMERA', effect: 'Camera lia vào người thả tim · Hiện số tim cạnh tên' },
  { fallback: '🎁', gift: 'Mọi quà', short: 'TÍCH ĐIỂM', effect: 'Camera lia vào người tặng · Tích điểm, Top 3 lên sân khấu, Top 1 đứng giữa' },
];
