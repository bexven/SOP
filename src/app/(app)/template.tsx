/**
 * Re-mounts on every navigation, so each page's top-level blocks glide in (`.page-flow` in globals.css)
 * instead of snapping into place. Loading placeholders inside it fade in only after a short beat.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-flow min-w-0">{children}</div>;
}
