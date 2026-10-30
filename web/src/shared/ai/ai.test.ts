// AI 경기분석 테스트 — 키 암호화 왕복, 기록 JSON·응답 검증(입력에 없는 숫자), 저장 키, 설정 기본값, 오류 분류, Gemini 요청 형식.
import "fake-indexeddb/auto";
import { IDBObjectStore } from "fake-indexeddb";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildAnalysisInput } from "../analysisInput";
import type { SeasonGame } from "../analysis/core";
import { regPA, regOuts, seasonConfig, type QualifyContext } from "../leaders";
import { buildTeamDetailGrades } from "../teamDetailGrades";
import type { Player, ScheduleGame } from "../types";
import { teamTotals, topPlayers } from "../versus";
import { currentModel, geminiResetHourKst, hourText, loadSettings, retentionDays, saveSettings, type AiSettings } from "./config";
import { buildPayload, buildUserPrompt, focusList, parseAnswer, systemPrompt, unknownNumbers, InvalidAnswer, MAX_LINES, type AiExtra } from "./prompt";
import { AiError, generate, geminiErrorKind, openaiErrorKind } from "./providers";
import { acknowledgeStorageWarning, clearEntries, entryBytes, entryCount, entryKey, errorNotice, getStorageStats, isExpired, loadEntry, loadMatchupEntries, pendingStorageWarning, saveEntry, storageStats, storageWarningLevel, WARNING_BYTES, WARNING_COUNT, type AiEntry } from "./store";
import { loadApiKey, newMasterKey, saveApiKey, seal, unseal } from "./vault";

// --- localStorage 대용 (node) ---
const mem = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
};

// 1) 암호화: 왕복, 매번 다른 IV, 암호 키는 꺼낼 수 없음, 다른 키로는 못 품
{
  const key = await newMasterKey();
  const box1 = await seal(key, "AIzaSyTEST-1234567890");
  const box2 = await seal(key, "AIzaSyTEST-1234567890");
  assert.equal(await unseal(key, box1), "AIzaSyTEST-1234567890");
  assert.notDeepEqual([...box1.iv], [...box2.iv], "IV는 매번 새로");
  assert.ok(!new TextDecoder().decode(box1.data).includes("AIza"), "저장 값에 원문이 보이지 않음");
  await assert.rejects(crypto.subtle.exportKey("raw", key), "암호 키는 꺼낼 수 없어야 함");
  await assert.rejects(unseal(await newMasterKey(), box1), "다른 키로는 풀리지 않음");
}

// 2) 실데이터 기록 JSON (+보강: 학교 상세 등급·주요 선수·기록 분석 문장)
const D = new URL("../../../../data/", import.meta.url);
const read = (p: string) => JSON.parse(readFileSync(new URL(p, D), "utf8"));
const Y = 2026;
const years: number[] = read("years.json");
const seasonGames = read(`${Y}/schedule.json`).games;
const records: Player[] = read(`${Y}/records/players.json`).filter((p: Player) => p.name && p.name !== "()" && p.number);
const mkInput = (a: string, b: string) => buildAnalysisInput({
  a, b, seasonGames, h2hGames: years.flatMap((y) => read(`${y}/schedule.json`).games), records,
  strength: read(`${Y}/strength.json`).teams, lg: read(`${Y}/averages.json`).overall, year: Y, allYears: true,
});
const input = mkInput("강릉고", "원주고");
const detail = buildTeamDetailGrades(Y, [], seasonGames, records, read(`${Y}/strength.json`));
const anyCtx = {} as QualifyContext; // 규정 미달 포함(relaxed) 목록은 규정 맥락을 쓰지 않는다
const extra: AiExtra = {
  grades: { a: detail.find((r) => r.name === "강릉고") ?? null, b: detail.find((r) => r.name === "원주고") ?? null },
  players: { a: topPlayers(records, "강릉고", anyCtx, 3, true), b: topPlayers(records, "원주고", anyCtx, 3, true) },
  notes: [{ cat: "key", text: "강릉고가 비교한 12개 지표 가운데 12개에서 앞선다." }, { cat: "form", text: "강릉고는 최근 5경기 4승이다." }],
};
const plain = buildPayload(input);
assert.ok(!("주요선수" in plain) && !("참고분석" in plain), "보강 없으면 기존 필드만");
const payload = buildPayload(input, extra);
assert.deepEqual(payload.학교, ["강릉고", "원주고"]);
const avgRow = payload.팀지표!.find((r) => r.지표 === "팀 타율")! as Record<string, string | null>;
assert.match(String(avgRow["강릉고"]), /^\.\d{3}$/, "타율은 .312 표기");
assert.match(String(avgRow["강릉고 등급"]), /^[A-E][+-]?$/, "학교 상세 등급");
assert.match(String(avgRow["차이(강릉고-원주고)"]), /^[+-]\.\d{3}$/, "차이는 같은 표기에 부호");
assert.equal(payload.맞대결?.기준, "통산");
assert.ok(payload.최근경기!["강릉고"].length <= 10);
const stars = payload.주요선수!["강릉고"];
assert.ok(stars.타자.length > 0 && stars.타자.length <= 3 && stars.투수.length <= 2, "주요 선수 타자 3·투수 2 이내");
assert.deepEqual(payload.참고분석, extra.notes!.map((n) => n.text));
// 공통 상대 요약 — 대전고는 두 학교 모두 졌다(실데이터 2026). 모델이 "모두 잡았다"고 지어내지 않도록 미리 계산해 준다.
assert.ok(payload.공통상대!.every((r) => ["강릉고 우세", "원주고 우세", "같음"].includes(String(r.비교))));
assert.ok(payload.공통상대요약?.["두 학교 모두 이기지 못한 상대"].includes("대전고"));
assert.ok(!payload.공통상대요약?.["강릉고 우세 상대"].includes("대전고"));
assert.equal(buildPayload(mkInput("개성고", "경기고")).맞대결, null, "맞대결이 없으면 빼서 '0승 0패'를 막는다");

// 방향별 자료 — 타격·마운드는 선수 위주, 맞대결·흐름은 팀 지표·등급·선수 없이 흐름만(종합과 겹치지 않게)
const extra5: AiExtra = { ...extra, players: { a: topPlayers(records, "강릉고", anyCtx, 5, true), b: topPlayers(records, "원주고", anyCtx, 5, true) } };
const bat = buildPayload(input, extra5, "batting", "away");
assert.deepEqual(Object.keys(bat).sort(), ["관점", "리그평균", "세부지표", "시즌", "주요선수", "팀지표", "학교"].sort());
assert.ok(bat.주요선수!["강릉고"].타자.length > 3 && bat.주요선수!["강릉고"].타자.length <= 5, "타격: 타자 5명까지");
assert.ok(bat.주요선수!["강릉고"].투수.length <= 2 && "출루율" in bat.주요선수!["강릉고"].타자[0]);
const pit = buildPayload(input, extra5, "pitching", "away");
assert.ok(pit.주요선수!["원주고"].투수.length > 2 && pit.주요선수!["원주고"].투수.length <= 4, "마운드: 투수 4명까지");
assert.match(String(pit.주요선수!["원주고"].투수[0]["K/9"]), /^\d+\.\d{2}$/, "투수 K/9를 미리 계산해 준다");
const flow = buildPayload(input, extra5, "h2h", "away");
assert.ok(!("팀지표" in flow) && !("주요선수" in flow) && !("리그평균" in flow) && !("세부지표" in flow), "맞대결·흐름은 팀 지표·선수 제외");
assert.ok("맞대결" in flow && "공통상대요약" in flow && "최근경기" in flow && "최근흐름" in flow);
assert.deepEqual(flow.참고분석, ["강릉고는 최근 5경기 4승이다."], "맞대결·흐름은 흐름 분류 문장만");
assert.ok(buildUserPrompt(bat, undefined, "batting", "away").includes("우리팀 핵심 타자: '주요선수' 강릉고 타자") && buildUserPrompt(bat, undefined, "batting", "away").includes("타자 이름"));
assert.ok(buildUserPrompt(flow, undefined, "h2h", "away").includes("팀 지표·등급·선수 이야기는 쓰지 않는다"));
assert.ok(buildUserPrompt(payload).includes("맞대결·공통 상대·최근 흐름은 5번 항목에서 한 번만 짧게 쓴다"), "종합은 흐름 중복을 제한");
assert.ok(buildUserPrompt(payload).includes("다른 항목에서는 다시 꺼내지 않는다"));

// 최근 흐름 — 입력을 바꾸지 않고 날짜 역순 최근 5경기만 집계한다.
const games = (outcomes: SeasonGame["outcome"][]): SeasonGame[] => outcomes.map((outcome, i) => ({
  date: `2026-10-${String(i + 1).padStart(2, "0")}`, outcome, rf: i + 1, ra: 1,
}));
const formOf = (gs?: SeasonGame[]) => buildPayload({ ...input, seasonA: gs }, {}, "h2h").최근흐름!["강릉고"];
const winGames = games(["패", "패", "승", "승", "승", "승"]);
const original = structuredClone(winGames);
assert.deepEqual(formOf(winGames), { "최근 5경기": "4승 1패", 득점: 20, 실점: 5, 연속: "4연승" });
assert.deepEqual(winGames, original, "최근 흐름 계산은 원본 경기 배열을 변경하지 않음");
assert.equal(formOf(games(["승", "패", "패"]))?.연속, "2연패");
assert.deepEqual(formOf(games(["승", "무", "무"])), { "최근 3경기": "1승 0패 2무", 득점: 6, 실점: 3, 연속: "가장 최근 경기 무" });
assert.deepEqual(formOf(games(["패"])), { "최근 1경기": "0승 1패", 득점: 1, 실점: 1, 연속: "가장 최근 경기 패" });
assert.equal(formOf(games(["승", "승", "승", "승", "승", "승"]))?.연속, "5연승", "연속 기록도 최근 5경기 창 기준");
assert.equal(formOf([]), null);
assert.equal(formOf(), null);
assert.deepEqual(payload.최근흐름, flow.최근흐름, "종합과 흐름은 같은 최근 요약을 사용");

const prompt = buildUserPrompt(payload, ["이전 줄 하나"], "overall", "away");
assert.ok(prompt.includes("구성:\n1) 총평") &&prompt.includes("우리팀 공격: 강릉고 타선"), "종합 6항목 구성에 학교 이름");
assert.ok(prompt.includes("이전 분석") && prompt.includes("이전 줄 하나"));
assert.ok(!buildUserPrompt(payload).includes("이전 분석"));
assert.ok(buildUserPrompt(payload, undefined, "pitching", "away").includes("공략할 상대 투수: '주요선수' 원주고 투수"));
assert.ok(buildUserPrompt(flow, undefined, "h2h", "away").includes("맞대결 경기들의 내용(어느 학교가 이겼는지 학교 이름으로"));
assert.ok(buildUserPrompt(flow, undefined, "h2h", "away").includes("우리팀 최근 흐름: 강릉고의 '최근흐름' 최근 5경기 전적·득실·연속 기록이 뜻하는 것"));
assert.ok(buildUserPrompt(flow, undefined, "h2h", "away").includes("상대팀 최근 흐름: 원주고의 '최근흐름' 최근 5경기"));
// 관점 — 양팀 비교는 중립 해설(관점 없음), HOME 기준은 HOME 학교가 우리팀, AWAY·HOME 기준에만 방향 3개 추가
assert.ok(!("관점" in payload), "양팀 비교는 관점 없이");
assert.ok(buildUserPrompt(payload).includes("강릉고 공격 대 원주고 수비") && !buildUserPrompt(payload).includes("우리팀"), "양팀 비교 종합은 중립");
assert.ok(!systemPrompt("both").includes("우리팀") && systemPrompt("home").includes("'우리팀 ○○'"));
assert.deepEqual(buildPayload(input, extra, "overall", "home").관점, { 우리팀: "원주고", 상대팀: "강릉고" });
assert.ok(buildUserPrompt(payload, undefined, "overall", "home").includes("총평: 우리팀 원주고 입장에서 본 상대팀 강릉고"), "HOME 기준은 원주고가 우리팀");
assert.deepEqual(focusList("both").map((f) => f.id), ["overall", "batting", "pitching", "h2h"]);
assert.deepEqual(focusList("away").map((f) => f.id), ["overall", "batting", "pitching", "h2h", "attack", "gameplan", "threats"]);
assert.ok(buildUserPrompt(payload, undefined, "attack", "away").includes("상대 마운드 약점: 원주고 마운드"));
assert.ok(buildUserPrompt(payload, undefined, "attack", "home").includes("상대 마운드 약점: 강릉고 마운드"));
assert.ok(buildUserPrompt(payload, undefined, "gameplan", "away").includes("작전·타순·선발 예고·누가 던질지는 단정하지 않는다"));
assert.ok(buildUserPrompt(payload, undefined, "threats", "home").includes("경계 타자 1: '주요선수' 강릉고 타자"));
assert.ok(buildUserPrompt(payload, undefined, "attack").includes("총평: 두 팀의 성격 차이"), "양팀 비교에 없는 방향은 종합으로");
const threats = buildPayload(input, extra5, "threats", "away");
assert.ok(threats.주요선수!["원주고"].타자.length > 3 && !("맞대결" in threats), "경계 선수는 타자 5명까지·맞대결 제외");
assert.ok("최근흐름" in buildPayload(input, extra5, "gameplan", "away"), "경기 운영은 득실 흐름 포함");
for (const p of ["both", "away", "home"] as const) for (const f of focusList(p)) assert.ok(!/\{[AB]\}/.test(buildUserPrompt(payload, undefined, f.id, p)), `자리표시 {A}{B}가 남지 않음 ${p} ${f.id}`);
assert.ok(prompt.length < 12000, `프롬프트 ${prompt.length}자`);

// 3) 응답 검증 — 입력에 있는 숫자만, 목록 기호·항목 제목 제거, 6줄 제한, 3줄 미만이면 실패
const era = payload.팀지표!.find((r) => r.지표 === "팀 ERA")! as Record<string, string | null>;
const ace = stars.투수[0];
const lines = [
  `- 2026 시즌 강릉고는 팀 타율 ${avgRow["강릉고"]}로 원주고(${avgRow["원주고"]})보다 높다.`,
  `총평. 팀 ERA는 강릉고 ${era["강릉고"]}로 마운드가 단단하다.`,
  `통산 맞대결은 강릉고 기준 ${payload.맞대결?.["강릉고 기준 전적"]}이다.`,
  "강릉고 타율은 .999로 리그 최고다.", // 지어낸 숫자
  `관전 포인트 1: 강릉고 ${ace.이름}은 ${ace.이닝}이닝을 던졌다.`,
];
const parsed = parseAnswer(JSON.stringify({ lines }), payload);
assert.equal(parsed.dropped.length, 1, "지어낸 숫자 줄 제거");
assert.ok(parsed.lines[0].startsWith("2026 시즌"), "첫 숫자 2026은 목록 기호가 아님");
assert.ok(parsed.lines[1].startsWith("팀 ERA") && parsed.lines[3].startsWith("강릉고 "), "항목 제목(총평./관전 포인트 1:) 제거");
assert.deepEqual(parseAnswer(JSON.stringify({ lines: ["우리팀 공격: 강릉고 타선이 앞선다.", "경계할 상대 타자: 원주고 중심 타선이다.", "우리팀 공격은 출루로 풀어 간다."] }), payload).lines,
  ["강릉고 타선이 앞선다.", "원주고 중심 타선이다.", "우리팀 공격은 출루로 풀어 간다."], "우리팀 관점 항목 제목도 떼고, 문장 속 표현은 남긴다");
assert.ok(parsed.lines.every((l) => !/^[-•]|^\d+\.\s/.test(l)));
assert.equal(parseAnswer("```json\n" + JSON.stringify({ lines }) + "\n```", payload).lines.length, 4, "코드 블록 감싼 응답 허용");
assert.equal(parseAnswer(JSON.stringify({ lines: [...lines, ...lines] }), payload).lines.length, MAX_LINES);
assert.throws(() => parseAnswer(JSON.stringify({ lines: lines.slice(3, 4) }), payload), InvalidAnswer);
assert.throws(() => parseAnswer("분석입니다", payload), InvalidAnswer);
assert.deepEqual(unknownNumbers("타율 .312, 0.312, 31.2%", [0.3124, 31.2]), [], "자릿수 맞춰 반올림한 값 허용");
assert.deepEqual(unknownNumbers("득점 87점", [86]), ["87"], "큰 정수는 입력에 있어야 함");
assert.deepEqual(unknownNumbers("최근 5경기 4승", []), [], "작은 정수(경기 수 등)는 허용");

// 4) 저장 — AWAY·HOME 순서별 키, 관점·방향별 저장·읽기
assert.notEqual(entryKey("강릉고", "원주고", 2026, true), entryKey("원주고", "강릉고", 2026, true), "AWAY·HOME이 바뀌면 다른 분석");
assert.notEqual(entryKey("강릉고", "원주고", 2026, true), entryKey("강릉고", "원주고", 2026, false));
const k = entryKey("강릉고", "원주고", 2026, true);
const now = Date.now();
const savedEntry: AiEntry = { lines: ["저장된 종합 분석"], provider: "gemini-free", model: "gemini-3.5-flash-lite", at: new Date(now).toISOString(), focus: "overall" };
await saveEntry(k, savedEntry);
assert.equal((await loadEntry(k))?.model, "gemini-3.5-flash-lite");
await saveEntry(k, { ...savedEntry, lines: ["타격 분석"], focus: "batting" });
await saveEntry(k, { ...savedEntry, lines: ["마운드 분석"], focus: "pitching" });
await saveEntry(k, { ...savedEntry, lines: ["흐름 분석"], focus: "h2h", edge: { base: "강릉고 우위 7:3", adjusted: "강릉고 우위 6:4" } });
assert.deepEqual((await loadEntry(k, "h2h"))?.edge, { base: "강릉고 우위 7:3", adjusted: "강릉고 우위 6:4" }, "예상 우위 비율도 저장·복원");
await saveEntry(k, { ...savedEntry, lines: ["갱신한 타격"], focus: "batting" });
assert.deepEqual((await loadEntry(k, "batting"))?.lines, ["갱신한 타격"], "다시 분석은 해당 방향만 갱신");
assert.deepEqual((await loadEntry(k))?.lines, savedEntry.lines, "종합은 유지");
assert.equal(Object.keys(await loadMatchupEntries(k)).length, 4, "네 방향을 개별 저장");
await saveEntry(k, { ...savedEntry, lines: ["AWAY 기준 종합"], perspective: "away" });
await saveEntry(k, { ...savedEntry, lines: ["HOME 기준 공략"], focus: "attack", perspective: "home" });
assert.deepEqual((await loadEntry(k, "overall", Date.now(), "away"))?.lines, ["AWAY 기준 종합"], "관점별로 따로 저장");
assert.equal((await loadEntry(k, "overall", Date.now(), "away"))?.perspective, "away");
assert.deepEqual((await loadEntry(k))?.lines, savedEntry.lines, "양팀 비교 종합(관점 나누기 전 저장 ID)은 그대로");
assert.deepEqual(Object.keys(await loadMatchupEntries(k)).sort(), ["away:overall", "batting", "h2h", "home:attack", "overall", "pitching"].sort());
const otherKey = entryKey("덕수고", "충암고", 2026, true);
assert.equal(await loadEntry(otherKey, "batting"), null, "다른 대진은 분석 전");
assert.equal(await loadEntry(entryKey("강릉고", "원주고", 2027, true)), null, "다른 시즌은 분리");
assert.equal(await loadEntry(entryKey("강릉고", "원주고", 2026, false)), null, "맞대결 범위 분리");

// 생성 시점부터 설정한 기간이 지나면 해당 항목만 삭제하고 다른 항목과 API 키 설정은 유지한다.
saveSettings({ provider: "gemini-free", models: {}, retentionDays: 7 });
await saveEntry(k, { ...savedEntry, at: new Date(now - 7 * 86400_000).toISOString(), focus: "overall" });
assert.equal(await loadEntry(k, "overall", now), null, "만료 경계 포함");
assert.ok(await loadEntry(k, "batting", now), "다른 방향의 새 기록은 보존");
assert.ok(!isExpired(savedEntry, 7, now + 7 * 86400_000 - 1));
assert.ok(isExpired(savedEntry, 7, now + 7 * 86400_000));
assert.ok(!isExpired(savedEntry, 0, now + 365 * 86400_000));
assert.ok(isExpired({ ...savedEntry, at: "invalid" }, 0, now));
assert.equal(retentionDays({ provider: "gemini-free", models: {} }), 30);
assert.equal(retentionDays({ provider: "gemini-free", models: {}, retentionDays: -1 }), 30);
assert.equal(retentionDays({ provider: "gemini-free", models: {}, retentionDays: 0 }), 0);
assert.equal(loadSettings().retentionDays, 7);

// 기존 localStorage 결과를 원래 방향으로 옮기고, 더 최신인 개별 결과를 덮어쓰지 않는다.
saveSettings({ provider: "gemini-free", models: {}, retentionDays: 0 });
mem.set("u18-ai-analysis-v1", JSON.stringify({ [otherKey]: { ...savedEntry, focus: "pitching" }, [k]: { ...savedEntry, at: new Date(now - 1).toISOString(), focus: "batting" } }));
assert.deepEqual((await loadEntry(otherKey, "pitching"))?.lines, savedEntry.lines);
assert.deepEqual((await loadEntry(k, "batting"))?.lines, ["갱신한 타격"]);
assert.ok(!mem.has("u18-ai-analysis-v1"), "이관 성공 후에만 기존 저장소 정리");
const originalPut = IDBObjectStore.prototype.put;
IDBObjectStore.prototype.put = function () { throw new DOMException("가상 저장공간 부족", "QuotaExceededError"); };
try {
  await assert.rejects(saveEntry(k, { ...savedEntry, lines: ["실패한 갱신"], focus: "batting" }));
  mem.set("u18-ai-analysis-v1", JSON.stringify({ [otherKey]: { ...savedEntry, focus: "h2h" } }));
  await assert.rejects(loadEntry(otherKey, "h2h"));
  assert.ok(mem.has("u18-ai-analysis-v1"), "저장소 오류 시 이관 전 원본을 보존");
} finally { IDBObjectStore.prototype.put = originalPut; }
assert.deepEqual((await loadEntry(k, "batting"))?.lines, ["갱신한 타격"], "저장 실패는 기존 결과를 지우지 않음");
assert.ok(await loadEntry(otherKey, "h2h"), "저장소 복구 후 기존 결과 이관 재시도");

// 용량은 JSON UTF-8 바이트이며 3,000건 또는 20MB가 경고 기준이다. 개수 때문에 기록을 버리지 않는다.
assert.ok(entryBytes(savedEntry) > JSON.stringify(savedEntry).length, "한국어 UTF-8 바이트 반영");
assert.equal(WARNING_COUNT, 3000);
assert.equal(storageStats(Array.from({ length: WARNING_COUNT - 1 }, () => savedEntry)).warning, false);
assert.equal(storageStats(Array.from({ length: WARNING_COUNT }, () => savedEntry)).warning, true);
assert.equal(storageStats([{ ...savedEntry, lines: ["x".repeat(WARNING_BYTES)] }]).warning, true);
assert.equal(storageWarningLevel({ count: WARNING_COUNT, bytes: 0, averageBytes: 0, warning: true }), 1);
assert.equal(storageWarningLevel({ count: 1, bytes: WARNING_BYTES, averageBytes: WARNING_BYTES, warning: true }), 2);
assert.equal(storageWarningLevel({ count: WARNING_COUNT, bytes: WARNING_BYTES, averageBytes: 0, warning: true }) & ~1, 2, "건수 경고 확인 후에도 20MB 도달 시 새 경고");
await clearEntries();
await Promise.all(Array.from({ length: WARNING_COUNT + 1 }, (_, i) => saveEntry(`test-${i}`, savedEntry)));
assert.equal(await entryCount(), WARNING_COUNT + 1, "기존 200개 제한으로 삭제하지 않음");
assert.equal((await pendingStorageWarning())?.count, WARNING_COUNT + 1);
await acknowledgeStorageWarning();
assert.equal(await pendingStorageWarning(), null, "확인한 경고는 임계치 아래로 내려갈 때까지 반복하지 않음");
const beforeClear = await getStorageStats();
assert.equal(beforeClear.averageBytes, beforeClear.bytes / beforeClear.count);
await saveApiKey("gemini", "FAKE-TEST-KEY-NOT-A-CREDENTIAL");
await clearEntries();
assert.equal(await entryCount(), 0);
assert.equal(await loadApiKey("gemini"), "FAKE-TEST-KEY-NOT-A-CREDENTIAL", "분석 기록 정리는 암호화 API 키를 보존");
assert.equal(loadSettings().provider, "gemini-free", "분석 초기화는 공급자 설정을 보존");
await saveEntry(k, savedEntry);
assert.equal((await getStorageStats()).count, 1);

// 2027 시즌 초 가상 시뮬레이션 — 실제 시즌 데이터나 API를 변경·호출하지 않고 현재 계산 함수를 실행한다.
const simNames = ["가상A고", "가상B고", "가상C고", "가상D고", "가상E고"];
const simulateEarlySeason = (n: number) => {
  const simGames: ScheduleGame[] = simNames.flatMap((name, i) => Array.from({ length: n }, (_, j) => ({
    game_idx: `sim-${i}-${j}`, title: "2027 가상 주말리그", date: `2027-03-${String(j + 1).padStart(2, "0")}`,
    time: "10:00", venue: "가상구장", round: "리그전", status: "완료",
    away: { name, score: 4 + i, result: "승" }, home: { name: "가상상대고", score: 2, result: "패" },
  })));
  const simPlayers: Player[] = n ? simNames.map((team, i) => ({
    id: `sim-${i}`, name: `가상선수${i + 1}`, team, number: "1", season: 2027, position: "투수",
    batting: { g: n, pa: n * 11, ab: n * 10, h: n * (i + 1), r: n * 2, b2: 0, b3: 0, hr: 0, rbi: n, bb: n, hbp: 0, so: n * (i + 1), sb: n * (i % 2), avg: (i + 1) / 10, obp: (i + 2) / 11, slg: (i + 1) / 10 },
    pitching: { g: n, w: n, l: 0, sv: 0, ip: n * 3, h: n * (6 - i), r: n * (5 - i), er: n * (5 - i), bb: n, so: n * (i + 2), era: (5 - i) * 3, whip: (7 - i) / 3 },
  })) : [];
  const simInput = buildAnalysisInput({ a: simNames[0], b: simNames[1], seasonGames: simGames, h2hGames: simGames, records: simPlayers, year: 2027, allYears: true });
  const simGrades = buildTeamDetailGrades(2027, [], simGames, simPlayers);
  const simCtx: QualifyContext = { scope: "season", config: seasonConfig(2027), teamGames: Object.fromEntries(simNames.map((name) => [name, n])) };
  return {
    games: n, pa: regPA(simCtx, simNames[0]), innings: regOuts(simCtx, simNames[0]) / 3,
    panelAvailable: !!teamTotals(simPlayers, simNames[0]) && !!teamTotals(simPlayers, simNames[1]),
    gradedSchools: simGrades.filter((g) => g.grades.avg != null).length,
    recent: buildPayload(simInput, {}, "h2h").최근흐름?.[simNames[0]],
  };
};
const earlySeason = [0, 1, 3, 5].map(simulateEarlySeason);
assert.deepEqual(earlySeason.map((s) => [s.games, s.pa, s.innings, s.gradedSchools, s.panelAvailable]), [
  [0, 0, 0, 0, false], [1, 3, 1, 0, true], [3, 9, 3, 0, true], [5, 15, 5, 5, true],
]);
assert.equal(earlySeason[0].recent, null);
assert.equal(earlySeason[1].recent?.["최근 1경기"], "1승 0패");
assert.equal(earlySeason[2].recent?.["최근 3경기"], "3승 0패");
assert.match(systemPrompt(), /경기 수가 5경기 미만인 학교는 표본이 적다는 점/);
const unevenCtx: QualifyContext = { scope: "season", config: seasonConfig(2027), teamGames: { 가상A고: 1, 가상B고: 10 } };
assert.equal(regPA(unevenCtx, "가상A고"), 9, "다른 학교가 10경기를 치렀으면 1경기 학교도 하한 3경기 적용");
console.log("2027 가상 시즌 초 시뮬레이션", JSON.stringify(earlySeason));

// 5) 설정 기본값·모델 폴백
const s: AiSettings = { provider: "gemini-free", models: {} };
assert.equal(currentModel(s).id, "gemini-3.5-flash-lite", "무료 기본 Flash-Lite");
assert.equal(currentModel({ ...s, models: { "gemini-free": "gemini-3.8-flash" } }).id, "gemini-3.8-flash");
assert.equal(currentModel({ ...s, models: { "gemini-free": "없는-모델" } }).id, "gemini-3.5-flash-lite", "없는 모델은 기본으로");
assert.equal(currentModel({ provider: "claude", models: {} }).id, "claude-opus-5-5");
assert.equal(currentModel({ provider: "openai", models: {} }).id, "gpt-6.1-sol");

// 6) 무료 한도 초기화 시각(한국) — 여름 16시, 겨울 17시
assert.equal(geminiResetHourKst(new Date("2026-07-01T03:00:00Z")), 16);
assert.equal(geminiResetHourKst(new Date("2026-12-01T03:00:00Z")), 17);
assert.equal(hourText(16), "오후 4시");
assert.ok(errorNotice("quota", "gemini-free", new Date("2026-07-01T03:00:00Z")).includes("오후 4시"));
assert.ok(errorNotice("quota", "claude").includes("잔액"));

// 7) Gemini 오류 분류
assert.equal(geminiErrorKind(429), "quota");
assert.equal(geminiErrorKind(400, "API key not valid. Please pass a valid API key."), "auth");
assert.equal(geminiErrorKind(403), "auth");
assert.equal(geminiErrorKind(404), "model");
assert.equal(geminiErrorKind(500), "busy");
assert.equal(geminiErrorKind(503), "busy");
assert.ok(errorNotice("busy", "gemini-free").includes("붐빕니다"));

// 8) Gemini 요청 형식(가짜 fetch) — 헤더에 키, JSON 응답 강제, 생각 부분 제외, 429는 한도 소진
{
  const realFetch = globalThis.fetch;
  let seen: { url: string; init: RequestInit } | null = null;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    seen = { url, init };
    return new Response(JSON.stringify({
      candidates: [{ finishReason: "STOP", content: { parts: [{ text: "생각", thought: true }, { text: '{"lines":["x"]}' }] } }],
    }), { status: 200 });
  }) as typeof fetch;
  const text = await generate({ provider: "gemini-free", model: "gemini-3.5-flash-lite", apiKey: "K", system: "S", user: "U" });
  assert.equal(text, '{"lines":["x"]}');
  const req = seen!;
  assert.ok(req.url.endsWith("/models/gemini-3.5-flash-lite:generateContent"));
  assert.equal((req.init.headers as Record<string, string>)["x-goog-api-key"], "K");
  assert.ok(!req.url.includes("key="), "키는 주소에 넣지 않음");
  const body = JSON.parse(String(req.init.body));
  assert.equal(body.generationConfig.responseMimeType, "application/json");
  assert.equal(body.systemInstruction.parts[0].text, "S");
  assert.equal(body.generationConfig.thinkingConfig?.thinkingLevel, "high", "Gemini 3 계열은 생각 수준 high");

  globalThis.fetch = (async () => new Response(JSON.stringify({ error: { message: "Quota exceeded", status: "RESOURCE_EXHAUSTED" } }), { status: 429 })) as typeof fetch;
  await assert.rejects(generate({ provider: "gemini-free", model: "m", apiKey: "K", system: "S", user: "U" }), (e) => e instanceof AiError && e.kind === "quota");
  // 서버 혼잡(503)은 한 번 다시 보낸다 — 두 번째에 성공하면 결과, 또 503이면 '붐빔'
  let calls = 0;
  globalThis.fetch = (async () => (++calls === 1
    ? new Response(JSON.stringify({ error: { message: "high demand" } }), { status: 503 })
    : new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: '{"lines":["z"]}' }] } }] }), { status: 200 })
  )) as typeof fetch;
  assert.equal(await generate({ provider: "gemini-free", model: "gemini-3.5-flash-lite", apiKey: "K", system: "S", user: "U" }), '{"lines":["z"]}');
  assert.equal(calls, 2, "503 뒤 1번 재시도");
  calls = 0;
  globalThis.fetch = (async () => (++calls, new Response(JSON.stringify({ error: { message: "high demand" } }), { status: 503 }))) as typeof fetch;
  await assert.rejects(generate({ provider: "gemini-free", model: "m", apiKey: "K", system: "S", user: "U" }), (e) => e instanceof AiError && e.kind === "busy");
  assert.equal(calls, 2, "재시도는 1번만");
  globalThis.fetch = (async () => { throw new TypeError("Failed to fetch"); }) as typeof fetch;
  await assert.rejects(generate({ provider: "gemini-free", model: "m", apiKey: "K", system: "S", user: "U" }), (e) => e instanceof AiError && e.kind === "network");
  globalThis.fetch = realFetch;
}

// 9) GPT(Responses API) 요청 형식·응답 해석·오류 분류
assert.equal(openaiErrorKind(429), "quota");
assert.equal(openaiErrorKind(401), "auth");
assert.equal(openaiErrorKind(404), "model");
{
  const realFetch = globalThis.fetch;
  let seen: { url: string; init: RequestInit } | null = null;
  const reply = (body: unknown, status = 200) => (async (url: string, init: RequestInit) => {
    seen = { url, init };
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
  const req = { provider: "openai" as const, model: "gpt-6.1-sol", apiKey: "K", system: "S", user: "U" };
  globalThis.fetch = reply({ status: "completed", output: [
    { type: "reasoning", summary: [] },
    { type: "message", role: "assistant", content: [{ type: "output_text", text: '{"lines":["y"]}' }] },
  ] });
  assert.equal(await generate(req), '{"lines":["y"]}');
  const r = seen!;
  assert.ok(r.url.endsWith("/v1/responses"));
  assert.equal((r.init.headers as Record<string, string>).authorization, "Bearer K");
  const body = JSON.parse(String(r.init.body));
  assert.equal(body.instructions, "S");
  assert.equal(body.text.format.type, "json_schema");
  assert.equal(body.text.format.strict, true);
  assert.equal(body.text.format.schema.additionalProperties, false);
  globalThis.fetch = reply({ status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: "no" }] }] });
  await assert.rejects(generate(req), (e) => e instanceof AiError && e.kind === "blocked");
  globalThis.fetch = reply({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, output: [] });
  await assert.rejects(generate(req), (e) => e instanceof AiError && e.kind === "invalid");
  globalThis.fetch = reply({ error: { message: "Credit balance exhausted", code: "credit_balance_exhausted" } }, 429);
  await assert.rejects(generate(req), (e) => e instanceof AiError && e.kind === "quota");
  globalThis.fetch = realFetch;
}

console.log("AI 경기분석 테스트 통과 (암호화·기록 JSON·응답 검증·저장·설정·초기화 시각·오류 분류·Gemini·GPT 요청 형식)");
