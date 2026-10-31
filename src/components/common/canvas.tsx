/**
 * The fixed backdrop every glass surface frosts over: soft colour blobs plus a
 * faint noise overlay to prevent banding. Purely decorative.
 */
const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export function Canvas() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-canvas">
      <div className="absolute -top-[18%] -left-[10%] h-[55vmax] w-[55vmax] rounded-full bg-indigo-300/30 blur-[120px]" />
      <div className="absolute top-[10%] -right-[15%] h-[45vmax] w-[45vmax] rounded-full bg-violet-300/25 blur-[120px]" />
      <div className="absolute -bottom-[25%] left-[20%] h-[50vmax] w-[50vmax] rounded-full bg-sky-300/25 blur-[120px]" />
      <div className="absolute right-[10%] -bottom-[10%] h-[28vmax] w-[28vmax] rounded-full bg-rose-200/25 blur-[110px]" />
      <div className="absolute inset-0 opacity-[0.025] mix-blend-multiply" style={{ backgroundImage: NOISE }} />
    </div>
  );
}
