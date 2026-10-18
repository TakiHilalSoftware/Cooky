/**
 * Path of an eight-point zellige star ({8/2}: two overlapping squares),
 * centred at (cx, cy) with outer radius r. Pure geometry, shared by the logo,
 * the hero tile panel and empty-state illustrations.
 */
export function starPath(cx: number, cy: number, r: number): string {
  // Inner radius where the two squares' edges cross.
  const inner = (r * Math.cos(Math.PI / 4)) / Math.cos(Math.PI / 8);
  const points: string[] = [];
  for (let i = 0; i < 16; i++) {
    const radius = i % 2 === 0 ? r : inner;
    const angle = (i * Math.PI) / 8 - Math.PI / 2;
    points.push(`${round(cx + radius * Math.cos(angle))} ${round(cy + radius * Math.sin(angle))}`);
  }
  return `M${points.join("L")}Z`;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
