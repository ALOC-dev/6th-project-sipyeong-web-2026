// 첨부 HTML의 메뉴·바로가기 SVG 경로를 공통 컴포넌트로 옮겼다.
// 페이지마다 경로를 따로 적지 않아 로드맵 등 아이콘 모양이 달라지지 않는다.
const icons = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z" />,
  checklist: <><path d="M10 6h10M10 12h10M10 18h10" /><path d="m3.5 6 1.5 1.5L8 4.5M3.5 12l1.5 1.5L8 10.5M3.5 18l1.5 1.5L8 16.5" /></>,
  award: <><circle cx="12" cy="9" r="5" /><path d="M9 13.5 7.5 21 12 18.5 16.5 21 15 13.5" /></>,
  road: <><circle cx="6" cy="19" r="2" /><circle cx="18" cy="5" r="2" /><path d="M8 19h8a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h8" /></>,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.4-3.8 4.4-6 8-6s6.6 2.2 8 6" /></>,
  upload: <path d="M12 16V4M6 10l6-6 6 6M4 20h16" />,
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  file: <path d="M14 3H6v18h12V7l-4-4ZM14 3v5h4" />,
};
export type AppIconName = keyof typeof icons;

export function AppIcon({ name, className }: { name: AppIconName; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {icons[name]}
  </svg>;
}

export function BrandMark() {
  return <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
    <path d="M7 17a5 5 0 0 1 10 0Z" fill="#FFC83D" />
    <path d="M12 7.5v2M17.3 11.7l1.4-1.4M6.7 11.7l-1.4-1.4" stroke="#FFC83D" strokeWidth="2" strokeLinecap="round" />
    <path d="M2.5 17h19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>;
}
