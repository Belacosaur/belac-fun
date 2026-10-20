export function Money({ value }: { value: string | null }) {
  if (value === null) {
    return <span>Unknown</span>;
  }
  const numeric = Number(value);
  if (Object.is(numeric, -0) || numeric === 0) {
    return <span>A$0.00</span>;
  }
  const formatted = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "USD",
    signDisplay: "exceptZero",
  }).format(numeric);
  const sign = numeric > 0 ? "+" : "−";
  return (
    <span className="tabular-nums">
      {sign} {formatted.replace("-", "")}
    </span>
  );
}

export function SourceBadge({ grade }: { grade: string }) {
  return <span>{grade}</span>;
}
