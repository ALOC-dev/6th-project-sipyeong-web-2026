// HTML의 SKY 색상표와 같은 보간법이다. 진행률과 배경색이 함께 움직인다.
const SKY = [
  [0, "#1B3770", "#3A5E9E"], [20, "#14509C", "#3A70B6"],
  [50, "#0E54AE", "#3A74C0"], [80, "#174A92", "#3B6AAE"],
  [100, "#122A5A", "#30507F"],
] as const;
function mix(start: string, end: string, ratio: number) {
  const channels = [1, 3, 5].map((offset) => {
    const a = parseInt(start.slice(offset, offset + 2), 16);
    const b = parseInt(end.slice(offset, offset + 2), 16);
    return Math.round(a + (b - a) * ratio);
  });
  return `rgb(${channels.join(",")})`;
}
export function getSkyColors(value: number) {
  const percentage = Math.min(100, Math.max(0, value));
  const index = Math.max(1, SKY.findIndex(([stop]) => stop >= percentage));
  const [start, topStart, bottomStart] = SKY[index - 1];
  const [end, topEnd, bottomEnd] = SKY[index];
  const ratio = (percentage - start) / (end - start);
  return { top: mix(topStart, topEnd, ratio), bottom: mix(bottomStart, bottomEnd, ratio) };
}
