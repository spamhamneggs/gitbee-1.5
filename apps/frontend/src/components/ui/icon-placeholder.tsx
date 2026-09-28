import { RiStarLine } from "react-icons/ri";

// Default star icon for DiceUI RatingItem. Accepts (and ignores) the
// per-library icon-name props so the vendored component compiles as-is.
export function IconPlaceholder({
  className,
}: {
  className?: string;
  [key: string]: unknown;
}) {
  return <RiStarLine className={className} aria-hidden />;
}
