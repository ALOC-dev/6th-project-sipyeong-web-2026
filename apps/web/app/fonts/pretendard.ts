import localFont from "next/font/local";

export const pretendard = localFont({
  src: [
    { path: "./Pretendard-Regular.woff2", weight: "100 500", style: "normal" },
    { path: "./Pretendard-Bold.woff2", weight: "600 900", style: "normal" },
  ],
  variable: "--font-pretendard",
  display: "swap",
});
