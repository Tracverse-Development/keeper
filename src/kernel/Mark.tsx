/** The Umoja Ark ark-and-waves mark (brand kit 2026-10), in gold, at any size. */
import markUrl from '../../assets/brand/umoja-ark-mark-gold.svg';

export function Mark({ size = 40, className }: { size?: number; className?: string }) {
  return <img src={markUrl} width={size} height={size} alt="" aria-hidden className={className} draggable={false} />;
}
