import { cn } from "cn";

export type Col<T> = { key: string; label: React.ReactNode; render: (row: T) => React.ReactNode; align?: "right" | "left" };

/** A plain table with hairline separators, in the style of a UIKit list. */
export function DataTable<T>({ rows, cols, rowKey }: { rows: T[]; cols: Col<T>[]; rowKey: (r: T) => string }) {
  return (
    <div className="scrollbar-none -mx-4 overflow-x-auto px-4">
      <table className="w-full text-[15px]">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.key} className={cn("footnote text-label-2 h-9 whitespace-nowrap px-2 text-left font-medium first:pl-0 last:pr-0", c.align === "right" && "text-right")}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} className="[&>td]:hairline last:[&>td]:shadow-none">
              {cols.map((c) => (
                <td key={c.key} className={cn("num h-11 whitespace-nowrap px-2 align-middle first:pl-0 last:pr-0", c.align === "right" && "text-right")}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
