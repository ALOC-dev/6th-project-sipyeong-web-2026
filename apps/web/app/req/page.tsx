"use client";

import { Fragment, useState } from "react";
import { LANG, extraStore, state, withExtra } from "../plan-data";
import type { Item } from "../plan-data";
import { Chev, HELP, HelpRows, Qm, Sheet, Shell, SkyHead, cx, s, useToast } from "../sky-ui";
import { WeatherIcon } from "../weather-icon";
import type { Sky } from "../weather-icon";

const WS: Record<string, Sky> = { ok: "sun", soon: "sunc", "": "cloud" };
const MODS: [string, Sky, string, boolean][] = [
  ["빅데이터 초급", "sun", "신청하기", true],
  ["차세대통신 초급", "sunc", "수강 중", false],
  ["머신러닝 입문", "sunc", "수강 중", false],
  ["빅데이터 중급", "cloud", "진행 중", false],
  ["AI기반경영전략", "cloud", "진행 중", false],
];

function Row({ it, onEdit }: { it: Item; onEdit: (k: "lang" | "vol") => void }) {
  const st = state(it), num = !!it.need;
  const dw = num ? Math.min(100, (it.d! / it.need!) * 100) : 0, pw = num ? Math.min(100 - dw, (it.p! / it.need!) * 100) : 0;
  const v = !num ? it.v : st === "ok" ? "충족" : st === "soon" ? "충족 예정" : it.u ? `${it.need! - it.d!}${it.u} 부족` : `${it.need! - it.d!}학점 미이수`;
  const head = (
    <>
      <WeatherIcon sky={WS[st]} />
      <b>{it.n}{it.tag && <> <span className={s.pill}>{it.tag}</span></>}</b>
      <span className={s.v}>{v}</span>
    </>
  );
  const names = (cs: string[], m: boolean) => cs.map((c, i) => <Fragment key={c}>{i > 0 && ", "}<span className={m ? s.m : undefined}>{c}</span></Fragment>);
  const sub = [
    it.miss && <div key="m" className={s.cc}>미이수 {names(it.miss, true)}</div>,
    it.prog && <div key="p" className={s.cc}>수강 중 {names(it.prog, false)}</div>,
    it.own && <div key="o" className={s.cc}>직접 입력</div>,
  ].filter(Boolean);
  return (
    <div className={s.ck}>
      {it.ex
        ? <button className={cx(s.ckH, s.ckb, s.tap)} type="button" aria-label={`${it.n} 입력`} onClick={() => onEdit(it.ex!)}>{head}<Chev /></button>
        : <div className={s.ckH}>{head}</div>}
      {num && (
        <div className={s.ckR}>
          <span>{it.d}</span>
          <div className={cx(s.bar, st === "ok" && s.ok)}><i style={{ width: `${dw}%` }} /><i className={s.p} style={{ width: `${pw}%` }} /></div>
          <span>{it.need}</span>
        </div>
      )}
      {sub.length > 0 && <div className={s.ckSub}>{sub}</div>}
    </div>
  );
}

export default function Req() {
  const extra = extraStore.use();
  const items = withExtra(extra);
  const [toast, toastNode] = useToast();
  const [sheet, setSheet] = useState<string | null>(null);
  const [form, setForm] = useState({ t: LANG[0][0], s: "" });
  const cnt = (x: string) => items.filter((i) => state(i) === x).length;
  const close = () => setSheet(null);
  const exItem = items.find((i) => i.ex === sheet);
  const test = LANG.find((x) => x[0] === form.t)!;

  function edit(k: "lang" | "vol") {
    setForm(k === "lang" ? { t: extra.lang?.t ?? LANG[0][0], s: extra.lang ? String(extra.lang.s) : "" } : { t: "", s: extra.vol != null ? String(extra.vol) : "" });
    setSheet(k);
  }
  function save(clear: boolean) {
    const k = sheet as "lang" | "vol", next = { ...extra };
    if (clear) delete next[k];
    else {
      const v = Number(form.s);
      if (form.s === "" || !Number.isInteger(v) || v < 0 || v > (k === "lang" ? test[2] : 999)) return toast(k === "lang" ? "점수를 확인하세요" : "시간을 확인하세요");
      if (k === "lang") next.lang = { t: test[0], s: v };
      else next.vol = v;
    }
    extraStore.set(next);
    close();
    toast(clear ? "입력을 지웠습니다" : "저장했습니다");
  }
  const has = sheet === "lang" ? !!extra.lang : extra.vol != null;

  return (
    <Shell at="/req">
      <section className={s.view}>
        <SkyHead sub="컴퓨터과학부 2024학년도 교육과정" title="졸업요건" foot={[`충족 ${cnt("ok")}개, 이번 학기 수강 포함 ${cnt("ok") + cnt("soon")}개`, `전체 ${items.length}개`]} />
        <div className={s.g2}>
          <div className={s.card}>
            <div className={s.ct}><h2>체크리스트<Qm k="check" label="체크리스트" onHelp={setSheet} /></h2></div>
            {items.map((it) => <Row key={it.n} it={it} onEdit={edit} />)}
          </div>
          <div className={cx(s.stack, s.sticky)}>
            <div className={s.card}>
              <div className={s.ct}><h2>인정 학점 계산<Qm k="calc" label="인정 학점 계산" onHelp={setSheet} /></h2></div>
              <div className={s.calc}>
                <div><span>성적표 이수학점</span><b>79</b></div>
                <div><span>재수강 이전 기록 제외<small>미적분학 2024-1 C+</small></span><b>−3</b></div>
                <div><span>P/F 과목<small>진로탐색과 설계, 평점 계산 제외</small></span><b>1 포함</b></div>
                <div><span>교양 인정 한도<small>48학점 중 27학점 사용</small></span><b>0</b></div>
                <div className={s.tot}><span>졸업 인정학점</span><b>76</b></div>
              </div>
            </div>
            <div className={s.card}>
              <div className={s.ct}><h2>마이크로디그리</h2><button className={s.more} type="button">전체<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg></button></div>
              {MODS.map(([n, w, t, act]) => (
                <button key={n} className={cx(s.bl, s.tap)} type="button">
                  <span className={s.bi}><WeatherIcon sky={w} /></span>
                  <span className={s.tx}><b>{n}</b><span className={act ? s.act : undefined}>{t}</span></span>
                  <Chev />
                </button>
              ))}
            </div>
            <div className={s.card}>
              <div className={s.ct}><h2>기준 데이터</h2></div>
              <div className={s.kv}>사용한 자료</div>
              <ul className={s.src}><li>2024학년도 컴퓨터과학부 교육과정</li><li>졸업최저이수학점표</li><li>10.31 업로드한 성적표</li></ul>
              <div className={s.kv}>반영하지 않는 것</div>
              <ul className={s.src}><li>복수전공, 부전공</li><li>학점교류, 계절학기 타교 이수</li></ul>
              <p className={cx(s.small, s.c3)} style={{ marginTop: 14 }}>실제 졸업 심사 결과와 다를 수 있습니다</p>
            </div>
          </div>
        </div>
      </section>

      <Sheet open={!!sheet} title={exItem ? exItem.n : sheet ? HELP[sheet][0] : ""} onClose={close}>
        {sheet && HELP[sheet] && <HelpRows k={sheet} />}
        {sheet === "lang" && (
          <>
            <div className={s.irow}><label htmlFor="exT">시험</label>
              <select id="exT" value={form.t} onChange={(e) => setForm({ ...form, t: e.target.value })}>{LANG.map(([t]) => <option key={t}>{t}</option>)}</select></div>
            <div className={s.irow}><label htmlFor="exS">점수</label>
              <input id="exS" type="number" inputMode="numeric" min="0" value={form.s} onChange={(e) => setForm({ ...form, s: e.target.value })} /></div>
            <p className={cx(s.small, s.c3, s.hint)}>기준 {test[1]}점, 만점 {test[2]}점</p>
          </>
        )}
        {sheet === "vol" && (
          <>
            <div className={s.irow}><label htmlFor="exS">봉사 시간</label>
              <input id="exS" type="number" inputMode="numeric" min="0" value={form.s} onChange={(e) => setForm({ ...form, s: e.target.value })} /></div>
            <p className={cx(s.small, s.c3, s.hint)}>기준 {exItem?.need}시간</p>
          </>
        )}
        {exItem && (
          <div className={s.mact}>
            {has && <button className={cx(s.cta, s.tint, s.tap)} type="button" onClick={() => save(true)}>입력 지우기</button>}
            <button className={cx(s.cta, s.tap)} type="button" onClick={() => save(false)}>저장</button>
          </div>
        )}
      </Sheet>
      {toastNode}
    </Shell>
  );
}
