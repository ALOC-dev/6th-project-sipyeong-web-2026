"use client";

import type { RefObject } from "react";
import { WEATHER_BANDS, WeatherIcon } from "./grade-weather";
import styles from "./help-dialog.module.css";
import { DialogClose } from "./help-button";

export function SemesterGpaDialog({ dialogRef }: { dialogRef: RefObject<HTMLDialogElement | null> }) {
  return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="semester-gpa-help-title">
    <span className={styles.handle} aria-hidden="true" />
    <DialogClose label="학기별 평점 안내 닫기" onClick={() => dialogRef.current?.close()} />
    <h2 id="semester-gpa-help-title">학기별 평점</h2>
    {/* 범위 표와 실제 날씨가 동일한 WEATHER_BANDS를 읽으므로 기준이 어긋나지 않는다. */}
    <ul className={styles.weatherList}>{WEATHER_BANDS.map((band) => <li key={band.type}>
      <span className={styles.icon}><WeatherIcon type={band.type} /></span>
      <strong>{band.label}</strong>
    </li>)}</ul>
    <h3>기준</h3>
    <dl className={styles.basis}>
      <div><dt>지난 학기</dt><dd>취득 평점</dd></div>
      <div><dt>이번 학기</dt><dd>취득 평점 또는 플래너 목표 평점</dd></div>
    </dl>
    <p className={styles.note}>평점이 없는 학기는 표시하지 않아요. 이번 학기는 수강 과목이 있으면 플래너 목표 평점을 표시해요.</p>
  </dialog>;
}
