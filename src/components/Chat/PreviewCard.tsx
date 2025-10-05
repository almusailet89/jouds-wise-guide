import { Button } from "@/components/ui/button";

type Preview = {
  title?: string;
  summary?: string;
  items?: Array<{ label: string; value: string }>;
  confirm_action?: { tool: string; payload: unknown };
};

export default function PreviewCard({
  data,
  onConfirm,
  onCancel,
}: {
  data: Preview;
  onConfirm: (action: Preview["confirm_action"]) => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-2xl border p-4 shadow-sm bg-white/70">
      <div className="font-semibold">{data.title ?? "Preview"}</div>
      {data.summary && <p className="text-sm mt-1">{data.summary}</p>}
      {data.items?.length ? (
        <ul className="mt-3 text-sm space-y-1">
          {data.items.map((x, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span className="text-muted-foreground">{x.label}</span>
              <span className="font-medium">{x.value}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-4 flex gap-2 justify-end">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onConfirm(data.confirm_action ?? null)}>Confirm</Button>
      </div>
    </div>
  );
}
