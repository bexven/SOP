/** The plain white workspace behind every page (the colour blobs were removed in the ClickUp-style redesign). */
export function Canvas() {
  return <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-canvas" />;
}
