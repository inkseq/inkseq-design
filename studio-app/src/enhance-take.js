// Which takes can be enhanced to 1080P/2K (h3-studio#795).
export const ENHANCE_RECIPE = 'enhance-v1';

// A finished take with its own library entity that is not itself an enhanced copy.
export function enhanceable(take) {
  return !!(take?.status === 'done' && take.asset?.entity?.id && !take.enhanced);
}
