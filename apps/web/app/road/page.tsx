"use client";

import { useEffect, useRef, useState } from "react";
import {
  ALLC, FUT, GRAD_SEM, LEFT, MAX_CR, NOW, PLAN_G, SEMS, crOf, evenSplit, fillSlot, fmt, gaps, newRoad, obj, offers, recommend, roadStore, sky, topTags,
} from "../plan-data";
import type { Course, Roads } from "../plan-data";
import { HELP, HelpRows, Qm, Sheet, Shell, SkyHead, XIcon, cx, s, useToast } from "../sky-ui";
import { WeatherIcon } from "../weather-icon";

const CATS = [["all", "추천순"], ["전공필수", "전공필수"], ["전공선택", "전공선택"], ["공학소양", "공학소양"], ["교양", "교양"], ["md", "디그리"]];
const DIVS = ["교양선택", "교양필수", "전공선택", "전공필수"];
type Kind = "dist" | "add" | "list" | "sems" | "goal";

export default function Road() {
  const roads = roadStore.use();
  const main = roads.list.find((r) => r.id === roads.main);
  const [toast, toastNode] = useToast();
  const [sheet, setSheet] = useState<Kind | null>(null);
  const [want, setWant] = useState<number[]>([]);
  const [addK, setAddK] = useState(0);
  const [addF, setAddF] = useState("all");
  const [addQ, setAddQ] = useState("");
  const [own, setOwn] = useState({ n: "", c: "3", d: DIVS[0] });
  const [rename, setRename] = useState<string | null>(null);
  const [topRn, setTopRn] = useState<string | null>(null);
  const [askId, setAskId] = useState<string | null>(null);
  const ask = useRef<HTMLDialogElement>(null);
  const board = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const d = ask.current;
    if (askId && d && !d.open) d.showModal();
  }, [askId]);

  function update(fn: (r: Roads) => void) {
    const next = structuredClone(roads);
    fn(next);
    roadStore.set(next);
  }
  const mainOf = (r: Roads) => r.list.find((x) => x.id === r.main)!;

  function openDist() {
    setWant(main ? main.sems.map((x) => x.want ?? crOf(x)) : evenSplit());
    setSheet("dist");
  }
  function go() {
    if (roads.list.length >= 10) return toast("로드맵은 10개까지 저장할 수 있습니다");
    update((r) => { const road = newRoad(r.list, recommend(want, main)); r.list.unshift(road); r.main = road.id; });
    setTopRn(null);
    setSheet(null);
    scrollTo({ top: 0 });
    toast("추천 결과를 메인 로드맵으로 저장했습니다");
  }
  function del(k: number, j: number) {
    const n = main!.sems[k].c[j][0].replace("*", "");
    update((r) => { mainOf(r).sems[k].c.splice(j, 1); });
    toast(`${obj(n)} 삭제했습니다`);
  }
  function openAdd(k: number, f = "all") {
    setAddK(k); setAddF(f); setAddQ(""); setSheet("add");
  }
  function pick(i: number) {
    const p = ALLC[i], at = main!.sems.find((x) => x.c.some((c) => c[0] === p.n));
    if (at) return toast(`이미 ${at.t} 계획에 있습니다`);
    update((r) => { const sem = mainOf(r).sems[addK]; sem.c.push([p.n, p.d, p.memo ?? "", p.md ?? "", 3, 1]); fillSlot(sem, p.d, 3); });
    toast(`${main!.sems[addK].t}에 ${obj(p.n)} 추가했습니다`);
  }
  function register() {
    const n = own.n.trim(), c = Number(own.c);
    if (!n) return toast("이름을 입력하세요");
    if (!Number.isInteger(c) || c < 1 || c > 9) return toast("학점을 확인하세요");
    update((r) => { const sem = mainOf(r).sems[addK]; sem.c.push([n, own.d, "", "", c, 2]); fillSlot(sem, own.d, c); });
    setOwn({ ...own, n: "" });
    toast(`${main!.sems[addK].t}에 ${obj(n)} 등록했습니다`);
  }
  function rn(id: string, v: string, done: () => void) {
    if (!v.trim()) return toast("이름을 입력하세요");
    update((r) => { r.list.find((x) => x.id === id)!.name = v.trim(); });
    done();
  }
  function remove(yes: boolean) {
    ask.current?.close();
    if (yes && askId) {
      update((r) => { r.list = r.list.filter((x) => x.id !== askId); if (r.main === askId) r.main = r.list[0]?.id ?? null; });
      toast("삭제했습니다");
    }
    setAskId(null);
  }

  const total = main ? main.sems.reduce((a, x) => a + crOf(x), 0) : 0;
  const lab = (t: string) => `${+t.slice(0, 4) - 2023}-${t.slice(5)}`;
  const cols = [
    ...SEMS.map(([t, g]) => ({ t, k: "past", w: sky(g), label: lab(t), aria: `${t} 평점 ${g.toFixed(2)}` })),
    { t: NOW.t, k: "now", w: sky(3.75), label: "지금", aria: `${NOW.t} 수강 중` },
    ...FUT.map((t) => ({ t, k: "fut", w: sky(4.03), label: lab(t), aria: `${t} 계획` })),
  ];
  const cards = [
    { t: `${NOW.t} 수강 중`, cr: NOW.cr, want: undefined as number | undefined, g: "목표 평점 3.75", c: NOW.c, k: -1 },
    ...(main ? main.sems.map((x, k) => ({ t: `${x.t} 계획`, cr: crOf(x), want: x.want, g: PLAN_G, c: x.c, k })) : []),
  ];
  const g = main ? gaps(main.sems) : [];
  const sem = main?.sems[addK];
  const slot = sem?.c.find((c) => c[0] === "*교양선택");
  const q = addQ.trim();
  const rows = ALLC.filter((p) => (addF === "all" || (addF === "md" ? !!p.md : addF === "교양" ? p.d.startsWith("교양") : p.d === addF)) && (!q || p.n.includes(q)));
  const sum = want.reduce((a, b) => a + b, 0);
  const clamp = (v: number) => Math.max(0, Math.min(MAX_CR, Math.round(v || 0)));
  const askRoad = roads.list.find((x) => x.id === askId);

  return (
    <Shell at="/road">
      <section className={s.view}>
        <SkyHead sub="2026-2 수강 중" title="로드맵" foot={[`${GRAD_SEM} 졸업 예정`, main ? `계획 ${97 + total}학점` : "로드맵 없음"]}>
          <div className={s.skPad}>
            <div className={s.semsBox}>
              <div className={s.gh}><span>학기별 평점</span><Qm k="sems" label="학기별 평점" onHelp={() => setSheet("sems")} /></div>
              <div className={s.sems}>
                {cols.map((x, i) => (
                  <button key={x.t} type="button" className={x.k === "past" ? undefined : s[x.k]} aria-label={x.aria}
                    onClick={() => { if (x.k === "fut") board.current?.children[i - SEMS.length]?.scrollIntoView({ block: "start" }); }}>
                    {x.label}<WeatherIcon sky={x.w} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </SkyHead>

        <div className={s.stack}>
          <div className={s.card}>
            {!main ? (
              <>
                <div className={s.ct}><h2>남은 학기 계획</h2></div>
                <p className={s.rdMsg}>{FUT[0]}부터 {GRAD_SEM}까지 {LEFT}학점을 채울 과목을 추천합니다</p>
                <div className={s.rdAct}>
                  <button className={cx(s.cta, s.tap)} type="button" onClick={openDist}>추천 받기</button>
                  {roads.list.length > 0 && <button className={cx(s.cta, s.tint, s.tap)} type="button" onClick={() => setSheet("list")}>저장된 로드맵</button>}
                </div>
              </>
            ) : (
              <>
                {topRn !== null ? (
                  <>
                    <input className={s.srch} value={topRn} maxLength={20} aria-label="로드맵 이름" autoFocus onChange={(e) => setTopRn(e.target.value)} />
                    <div className={s.mact} style={{ margin: "0 0 14px" }}>
                      <button className={cx(s.cta, s.tint, s.tap)} type="button" onClick={() => setTopRn(null)}>취소</button>
                      <button className={cx(s.cta, s.tap)} type="button" onClick={() => rn(main.id, topRn, () => setTopRn(null))}>확인</button>
                    </div>
                  </>
                ) : (
                  <div className={s.ct}><h2>{main.name}</h2><button className={s.more} type="button" onClick={() => setTopRn(main.name)}>이름 바꾸기</button></div>
                )}
                <p className={s.rdMsg}>메인 로드맵, {fmt(main.at)} 저장</p>
                {g.length ? <ul className={s.rdWarn}>{g.map((x) => <li key={x}>{x}</li>)}</ul> : <p className={s.rdOk}>졸업요건을 모두 채우는 계획입니다</p>}
                <div className={s.rdAct}>
                  <button className={cx(s.cta, s.tint, s.tap)} type="button" onClick={() => setSheet("list")}>저장된 로드맵 {roads.list.length}개</button>
                  <button className={cx(s.cta, s.tint, s.tap)} type="button" onClick={openDist}>새로 추천</button>
                </div>
              </>
            )}
          </div>
          {main && (
            <div className={s.card}>
              <div className={s.ct}><h2>평점 계획<Qm k="goal" label="평점 계획" onHelp={() => setSheet("goal")} /></h2></div>
              <div className={s.calc}><div><span>목표 평점</span><b>3.88</b></div><div><span>남은 학기 평균</span><b>4.03</b></div></div>
            </div>
          )}
          <div className={s.semcards} ref={board}>
            {cards.map((col) => {
              const diff = col.want != null && col.want !== col.cr;
              return (
                <div key={col.t} className={s.card}>
                  <div className={s.ct}><h2>{col.t}</h2><span className={cx(s.ctR, diff && s.diff)}>{diff && `요청 ${col.want}, `}{col.cr}학점</span></div>
                  <p className={s.cgoal}>{col.g}</p>
                  {col.c.map(([n, d, why, md, cr = 3, mine]: Course, j) => {
                    const ph = n[0] === "*", nm = ph ? n.slice(1) : n;
                    return (
                      <div key={`${n}-${j}`} className={cx(s.crow, ph ? s.ph : s.tap)}>
                        <span className={s.tx}>
                          {ph ? <><b>{nm} {cr}학점</b><span>과목 미선택</span></>
                            : <><b>{nm}</b><span>{d} {cr}학점{why && `, ${why}`}{mine === 2 && ", 직접 등록"}</span>{md && <em>{md}</em>}</>}
                        </span>
                        {ph && <button className={cx(s.lock, s.tap)} type="button" onClick={() => openAdd(col.k, "교양")}>선택</button>}
                        {col.k >= 0 && <button className={cx(s.x, s.tap)} type="button" aria-label={`${nm} 삭제`} onClick={() => del(col.k, j)}><XIcon /></button>}
                      </div>
                    );
                  })}
                  {col.k >= 0 && <button className={cx(s.addc, s.tap)} type="button" onClick={() => openAdd(col.k)}>과목 추가</button>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <Sheet open={!!sheet} onClose={() => { setSheet(null); setRename(null); }}
        title={sheet === "dist" ? "학기별 학점" : sheet === "add" ? `${sem?.t}에 과목 추가` : sheet === "list" ? "저장된 로드맵" : sheet ? HELP[sheet][0] : ""}>
        {(sheet === "sems" || sheet === "goal") && <HelpRows k={sheet} />}
        {sheet === "dist" && (
          <>
            {FUT.map((t, i) => (
              <div key={t} className={s.dist}>
                <b>{t}</b>
                <span className={s.stp}>
                  <button className={s.tap} type="button" aria-label={`${t} 1학점 줄이기`} onClick={() => setWant(want.map((v, x) => x === i ? clamp(v - 1) : v))}>−</button>
                  <input type="number" inputMode="numeric" min="0" max={MAX_CR} value={want[i]} aria-label={`${t} 학점`} onChange={(e) => setWant(want.map((v, x) => x === i ? clamp(+e.target.value) : v))} />
                  <button className={s.tap} type="button" aria-label={`${t} 1학점 늘리기`} onClick={() => setWant(want.map((v, x) => x === i ? clamp(v + 1) : v))}>+</button>
                </span>
              </div>
            ))}
            <div className={s.dsum}><span>합계 {sum}학점</span><span className={sum < LEFT ? s.bad : undefined}>{sum < LEFT ? `졸업까지 ${LEFT - sum}학점 부족` : `졸업까지 ${LEFT}학점 필요`}</span></div>
            <div className={s.rdAct}>
              <button className={cx(s.cta, s.tint, s.tap)} type="button" onClick={() => setWant(evenSplit())}>초기화</button>
              <button className={cx(s.cta, s.tap)} type="button" onClick={go}>추천 받기</button>
            </div>
          </>
        )}
        {sheet === "add" && sem && (
          <>
            <input className={s.srch} type="search" placeholder="과목명 검색" autoComplete="off" value={addQ} aria-label="과목명 검색" onChange={(e) => setAddQ(e.target.value)} />
            <div className={s.chips}>{CATS.map(([k, l]) => <button key={k} type="button" aria-pressed={k === addF} onClick={() => setAddF(k)}>{l}</button>)}</div>
            <div className={s.addl}>
              {slot && <p className={s.slot}>{sem.t} 교양선택 {slot[4]}학점이 비어 있습니다</p>}
              {rows.map((p) => {
                const at = main!.sems.find((x) => x.c.some((c) => c[0] === p.n));
                const tags = topTags(p, 2, offers(p, sem.t) ? [] : [["warn", `${p.off}학기 개설`, 9]]);
                return (
                  <div key={p.n} className={s.crow}>
                    <span className={s.tx}><b>{p.n}</b><span>{p.d} 3학점</span>
                      {tags.length > 0 && <span className={s.why}>{tags.map(([c, t]) => <i key={t} className={cx(s.pill, c && s[c])}>{t}</i>)}</span>}
                    </span>
                    <button className={cx(s.lock, s.tap)} type="button" aria-pressed={!!at} onClick={() => pick(ALLC.indexOf(p))}>{at ? `${at.t}에 있음` : "추가"}</button>
                  </div>
                );
              })}
              {!rows.length && <p className={cx(s.small, s.c3)} style={{ margin: "4px 0 14px" }}>검색 결과가 없습니다</p>}
            </div>
            <div className={s.k}>직접 등록</div>
            <div className={s.own}>
              <input type="text" placeholder="과목명" autoComplete="off" aria-label="이름" value={own.n} onChange={(e) => setOwn({ ...own, n: e.target.value })} />
              <input type="number" inputMode="numeric" min="1" max="9" aria-label="학점" value={own.c} onChange={(e) => setOwn({ ...own, c: e.target.value })} />
              <select aria-label="이수구분" value={own.d} onChange={(e) => setOwn({ ...own, d: e.target.value })}>{DIVS.map((d) => <option key={d}>{d}</option>)}</select>
            </div>
            <button className={cx(s.cta, s.tint, s.tap)} type="button" style={{ marginTop: 10 }} onClick={register}>등록</button>
          </>
        )}
        {sheet === "list" && (roads.list.length ? roads.list.map((r) => {
          const m = r.id === roads.main;
          return (
            <div key={r.id} className={s.rl}>
              {rename !== null && rename.startsWith(`${r.id}:`) ? (
                <>
                  <input className={s.srch} value={rename.slice(r.id.length + 1)} maxLength={20} aria-label="로드맵 이름" autoFocus onChange={(e) => setRename(`${r.id}:${e.target.value}`)} />
                  <div className={s.mact}>
                    <button className={cx(s.cta, s.tint, s.tap)} type="button" onClick={() => setRename(null)}>취소</button>
                    <button className={cx(s.cta, s.tap)} type="button" onClick={() => rn(r.id, rename.slice(r.id.length + 1), () => setRename(null))}>확인</button>
                  </div>
                </>
              ) : (
                <>
                  <div className={s.rlH}><b>{r.name}</b><span className={cx(s.small, m ? s.c2 : s.c3)}>{m ? "메인" : ""}</span></div>
                  <div className={cx(s.small, s.c3)}>{fmt(r.at)} 저장, {r.sems.map((x) => `${x.t} ${crOf(x)}`).join(", ")}학점</div>
                  <div className={s.rlA}>
                    {!m && <button className={cx(s.lock, s.tap)} type="button" onClick={() => { update((x) => { x.main = r.id; }); toast("메인 로드맵을 바꿨습니다"); }}>메인으로</button>}
                    <button className={cx(s.lock, s.tap)} type="button" onClick={() => setRename(`${r.id}:${r.name}`)}>이름 바꾸기</button>
                    <button className={cx(s.lock, s.tap)} type="button" onClick={() => setAskId(r.id)}>삭제</button>
                  </div>
                </>
              )}
            </div>
          );
        }) : <p className={cx(s.small, s.c3)}>저장된 로드맵이 없습니다</p>)}
      </Sheet>

      <dialog ref={ask} className={s.ask} aria-labelledby="askT" aria-describedby="askD" onClose={() => setAskId(null)}>
        <h3 id="askT">로드맵 삭제</h3>
        <p style={{ fontWeight: 600 }}>{askRoad?.name}</p>
        <p className={cx(s.small, s.c3)} id="askD">삭제하면 되돌릴 수 없습니다</p>
        <div className={s.mact}>
          <button className={cx(s.cta, s.tint, s.tap)} type="button" onClick={() => remove(false)}>취소</button>
          <button className={cx(s.cta, s.bad, s.tap)} type="button" onClick={() => remove(true)}>삭제</button>
        </div>
      </dialog>
      {toastNode}
    </Shell>
  );
}
