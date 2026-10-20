import type { TimelinePoint } from "./api";

export function EquityChart({ points }: { points: TimelinePoint[] }) {
  const measured = points.filter((point) => point.equityUsd !== null);
  const width = 320;
  const height = 120;
  const values = measured.map((point) => Number(point.equityUsd));
  const min = Math.min(100, ...values, 100);
  const max = Math.max(100, ...values, 100);
  const span = max - min || 1;
  const coords = measured.map((point, index) => {
    const x = measured.length === 1 ? width / 2 : (index / (measured.length - 1)) * width;
    const y = height - ((Number(point.equityUsd) - min) / span) * height;
    return `${x},${y}`;
  });
  return (
    <figure>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Portfolio value in USD">
        <line x1="0" y1={height - ((100 - min) / span) * height} x2={width} y2={height - ((100 - min) / span) * height} stroke="currentColor" />
        {coords.length > 1 ? <polyline fill="none" stroke="currentColor" points={coords.join(" ")} /> : null}
      </svg>
      <table>
        <caption>Portfolio history. Gaps are missing valuations, not zero.</caption>
        <thead>
          <tr>
            <th>Time</th>
            <th>Equity USD</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.at}>
              <td>{point.at}</td>
              <td>{point.equityUsd ?? "Gap"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
