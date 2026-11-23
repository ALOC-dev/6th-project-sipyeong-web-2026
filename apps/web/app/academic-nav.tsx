import Link from "next/link";
import styles from "./page.module.css";

const iconPaths = {
  home: "m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9",
  checklist:
    "m3 6 1 1 2-2M9 6h12M3 12l1 1 2-2M9 12h12M3 18l1 1 2-2M9 18h12",
  award:
    "M8 14 6 22l6-3 6 3-2-8M17 8a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z",
  road:
    "M5 3v5c0 5 14 3 14 8v5M2 3h6M16 21h6M12 7v2M12 13v2",
  chart: "M4 20h17M7 16v-5M12 16V5M17 16V8",
  user:
    "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM5 21v-2a7 7 0 0 1 14 0v2",
  file: "M14 3H6v18h12V7l-4-4ZM14 3v5h4",
  upload: "M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5",
  external: "M14 3h7v7m0-7L11 13M10 5H4v15h15v-6",
};

export type IconName = keyof typeof iconPaths;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={iconPaths[name]} />
    </svg>
  );
}


const entries: { label: string; icon: IconName; href?: string }[] = [
  { label: "홈", icon: "home", href: "/" },
  { label: "졸업요건", icon: "checklist", href: "/req" },
  { label: "디그리", icon: "award" },
  { label: "로드맵", icon: "road" },
  { label: "학점", icon: "chart", href: "/grades" },
  { label: "내 정보", icon: "user", href: "/my" },
];

export function AcademicNav({ current }: { current: string }) {
  return (
    <nav className={styles.bottomNav} aria-label="주 메뉴">
      {entries.map(({ label, icon, href }) => href ? (
        <Link key={href} href={href} className={href === current ? styles.activeNav : undefined}
          aria-current={href === current ? "page" : undefined}>
          <Icon name={icon} /><span>{label}</span>
        </Link>
      ) : (
        <button key={label} type="button" disabled><Icon name={icon} /><span>{label}</span></button>
      ))}
    </nav>
  );
}
