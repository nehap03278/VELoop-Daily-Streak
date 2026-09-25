import coin from '../assets/rewards/coin.webp';
import giftBox from '../assets/rewards/gift-box.webp';
import giftCard from '../assets/rewards/gift-card.webp';
import crown from '../assets/rewards/crown.webp';

/**
 * The backend decides *which* asset a reward uses (assetType); the image files themselves are static
 * frontend assets, which is fine because an image is not a business value.
 */
const ASSETS = {
  coin,
  'gift-box': giftBox,
  'gift-card': giftCard,
  crown,
};

export function rewardImage(assetType) {
  return ASSETS[assetType] || coin;
}
