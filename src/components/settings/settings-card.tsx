export function SettingsCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="surface overflow-hidden rounded-panel">
      <div className="grid gap-6 p-5 sm:p-6 md:grid-cols-[minmax(0,15rem)_1fr]">
        <div>
          <h2 className="text-section text-slate-900">{title}</h2>
          <p className="mt-1 text-body text-slate-600">{description}</p>
        </div>
        <div>{children}</div>
      </div>
      {footer ? (
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-3 sm:px-6">
          {footer}
        </div>
      ) : null}
    </section>
  );
}
