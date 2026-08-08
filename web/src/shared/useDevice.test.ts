// 화면 폭과 주 입력 방식에 따른 모바일·데스크톱 분기를 검증한다.
import assert from "node:assert/strict";
import { deviceForViewport } from "./useDevice";

assert.equal(deviceForViewport(390, true), "mobile", "외부 모바일 화면은 모바일 UI");
assert.equal(deviceForViewport(1024, false), "mobile", "기존 1024px 경계는 모바일 UI");
assert.equal(deviceForViewport(1224, true), "mobile", "폴더블 펼친 터치 화면은 모바일 UI");
assert.equal(deviceForViewport(1224, false), "desktop", "같은 폭의 마우스 기반 화면은 데스크톱 UI");
assert.equal(deviceForViewport(1367, true), "desktop", "터치 확장 경계를 넘으면 데스크톱 UI");
assert.equal(deviceForViewport(390, true, "desktop"), "desktop", "강제 데스크톱 쿼리 유지");

console.log("✓ 외부 모바일·폴더블 전개·일반 데스크톱 화면 분기 검증 통과");
