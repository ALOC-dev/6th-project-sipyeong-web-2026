import styles from "./weather-icon.module.css";

export type Sky = "sun" | "sunc" | "cloud" | "none";

const CLOUD = "M7 19h10.5a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.2A3.4 3.4 0 0 0 7 19z";

export function gpaSky(gpa: number | undefined): Sky {
  if (gpa === undefined) return "none";
  if (gpa >= 4) return "sun";
  return gpa >= 3.7 ? "sunc" : "cloud";
}

function SunOrMoon() {
  return (
    <>
      <g className={styles.day}>
        <circle cx="12" cy="12" r="4.6" fill="#FFC83D" />
        <path
          d="M12 2.6v2M12 19.4v2M2.6 12h2M19.4 12h2M5.4 5.4l1.4 1.4M17.2 17.2l1.4 1.4M5.4 18.6l1.4-1.4M17.2 6.8l1.4-1.4"
          stroke="#FFC83D"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
      <g className={styles.night}>
        <path fill="#F1E7C8" d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </g>
    </>
  );
}

export function WeatherIcon({ sky, className }: { sky: Sky; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      {sky === "sun" && <SunOrMoon />}
      {sky === "sunc" && (
        <>
          <g transform="translate(-1.5 -2.5) scale(.78)"><SunOrMoon /></g>
          <path transform="translate(1.5 1)" style={{ fill: "var(--cl, #fff)" }} d={CLOUD} />
        </>
      )}
      {sky === "cloud" && <path transform="translate(0 -1)" style={{ fill: "var(--cl, #fff)" }} d={CLOUD} />}
      {sky === "none" && (
        <path transform="translate(0 -1)" style={{ fill: "none", stroke: "var(--cl, #fff)" }} strokeWidth="1.6" d={CLOUD} />
      )}
    </svg>
  );
}
