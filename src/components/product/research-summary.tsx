import { ExternalLinkIcon } from "lucide-react";
import type { ProductDetail } from "@/lib/server/queries/product";
import { formatBdt, formatDate, formatRmb } from "@/lib/format";

export function ResearchSummary({ product }: { product: ProductDetail }) {
  const rows: [string, React.ReactNode][] = [
    [
      "Supplier",
      product.supplierUrl ? (
        <a href={product.supplierUrl} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 truncate text-indigo-700 hover:underline">
          <span className="truncate">{product.supplierUrl.replace(/^https?:\/\//, "")}</span>
          <ExternalLinkIcon className="size-3 shrink-0" />
        </a>
      ) : (
        "—"
      ),
    ],
    ["China price", product.chinaPriceRmb ? <span className="num">{formatRmb(product.chinaPriceRmb)}</span> : "—"],
    ["Shipping / unit", product.shippingPerUnitRmb ? <span className="num">{formatRmb(product.shippingPerUnitRmb)}</span> : "—"],
    ["Selling price", product.sellingPriceBdt ? <span className="num">{formatBdt(product.sellingPriceBdt)}</span> : "—"],
    ["Target launch", product.targetLaunchDate ? <span className="num">{formatDate(new Date(`${product.targetLaunchDate}T00:00:00Z`))}</span> : "—"],
  ];
  const texts: [string, string | null][] = [
    ["Target customer", product.targetCustomer],
    ["Problem it solves", product.problemSolved],
    ["Selling angle", product.sellingAngle],
  ];
  return (
    <section className="surface rounded-panel p-4 sm:p-5" aria-label="Research">
      <h2 className="text-section text-slate-900">Research</h2>
      <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map(([k, val]) => (
          <div key={k} className="min-w-0">
            <dt className="text-meta text-slate-500">{k}</dt>
            <dd className="mt-0.5 truncate text-body text-slate-900">{val}</dd>
          </div>
        ))}
      </dl>
      {texts.some(([, t]) => t) ? (
        <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4">
          {texts.map(([k, t]) =>
            t ? (
              <div key={k}>
                <dt className="text-meta text-slate-500">{k}</dt>
                <dd className="mt-0.5 text-body whitespace-pre-line text-slate-800">{t}</dd>
              </div>
            ) : null,
          )}
        </dl>
      ) : null}
      {product.referenceLinks.length ? (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="text-meta text-slate-500">Reference links</p>
          <ul className="mt-1.5 flex flex-wrap gap-2">
            {product.referenceLinks.map((l, i) => (
              <li key={l + i}>
                <a href={l} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-[16rem] items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-meta text-slate-700 hover:bg-slate-200/80">
                  <span className="truncate">{l.replace(/^https?:\/\/(www\.)?/, "")}</span>
                  <ExternalLinkIcon className="size-3 shrink-0" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
