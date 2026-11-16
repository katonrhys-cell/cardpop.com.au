import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}) {
  return (
    <div
      className={cn(// Neutral grey, not a tint of the brand red: at 10% the red read as pink
      // blocks that flashed in before every grid and then turned grey (the
      // image placeholders) and then into photos.
      "animate-pulse rounded-md bg-muted", className)}
      {...props} />
  );
}

export { Skeleton }