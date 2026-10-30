// 전국 야구장 현황 수집 순수 함수(팀명→학교명, 주소 후보, 시·도/시·군·구, 이름 거르기, 공원 추정)를 검증한다.
import assert from "node:assert/strict";
import { completeFieldAddress, hasFieldAddressNumber, osmTagFieldAddress, refineFieldAddress, stripResidentialUnit } from "./fieldsAddressUtil.js";
import { addressCandidates, cleanFieldName, dedupeSameNameFields, distance, fullNomAddress, matchesStreetOrLot, isFieldName, isOutdoorBaseballTags, isProName, isSchoolResult, isOfficeAddress, mergeFieldData, parkOf, regionOf, schoolName, shortSido, teamInfoFromHtml, validateField, type Field } from "./fieldsUtil.js";

assert.equal(schoolName("강원 경포중"), "경포중학교");
assert.equal(schoolName("마산용마고"), "마산용마고등학교");
assert.equal(schoolName("경기상업고"), "경기상업고등학교");
assert.equal(schoolName("경희대"), "경희대학교");
assert.equal(schoolName("GD챌린저스BC(U-18)"), null, "클럽은 주소로 찾는다");
assert.equal(schoolName("경기 남사중야구단(U-15)"), null);

assert.equal(shortSido("서울특별시"), "서울");
assert.equal(shortSido("충청북도"), "충북");
assert.equal(shortSido("강원"), "강원");

assert.deepEqual(addressCandidates("경기 고양시 일산구 덕이동 70-16신주소(덕이로 172번길)"),
  ["경기 고양시 일산구 덕이동 70-16", "경기 고양시 일산구 덕이동", "경기 고양시 일산구"]);
assert.deepEqual(addressCandidates("서울 종로구 청운동89번지"), ["서울 종로구 청운동 89번지", "서울 종로구 청운동"]);
assert.deepEqual(addressCandidates("서울특별시 강동구 올림픽로 594 (성내동)7층"), ["서울특별시 강동구 올림픽로 594", "서울특별시 강동구 올림픽로"]);

assert.deepEqual(regionOf({ "ISO3166-2-lvl4": "KR-11", borough: "종로구", city: "서울특별시" }), ["서울", "종로구"]);
assert.deepEqual(regionOf({ "ISO3166-2-lvl4": "KR-41", borough: "분당구", city: "성남시" }), ["경기", "성남시"]);
assert.deepEqual(regionOf({ "ISO3166-2-lvl4": "KR-26", county: "기장군" }), ["부산", "기장군"]);
assert.deepEqual(regionOf({ "ISO3166-2-lvl4": "KR-42", city: "강릉시" }), ["강원", "강릉시"]);
assert.deepEqual(regionOf({ "ISO3166-2-lvl4": "KR-50" }), ["세종", "세종"]);
assert.equal(regionOf({ city: "어딘가" }), null);
assert.deepEqual(regionOf({ city: "광주", state: "전남광주통합특별시", borough: "남구" }), ["광주", "남구"], "실제 누락 재현 — ISO 코드 없음");
assert.deepEqual(regionOf({ state: "경기도", city: "광주시" }), ["경기", "광주시"], "경기 광주시와 광역시 혼동 금지");
assert.deepEqual(regionOf({ state: "전남광주통합특별시", county: "화순군" }), ["전남", "화순군"]);
assert.deepEqual(regionOf({ state: "대전광역시", city_district: "중구" }), ["대전", "중구"]);
assert.deepEqual(regionOf({ "ISO3166-2-lvl4": "KR-47", city: "대구광역시", county: "달성군" }), ["대구", "달성군"], "주변 도 ISO보다 명시된 광역시 행정구역 우선");
assert.deepEqual(regionOf({ state: "충청북도", city: "청주시 상당구" }), ["충북", "청주시"]);
assert.equal(regionOf({ state: "경기도", town: "양서면" }), null, "읍면을 시군으로 쓰지 않음");
assert.ok(isSchoolResult({ name: "광주동성고등학교", category: "building", type: "school" }, "광주동성고등학교"));
assert.ok(!isSchoolResult({ name: "대전고등학교", category: "highway", type: "bus_stop" }, "대전고등학교"));
assert.ok(!isSchoolResult({ name: "대전중학교", category: "amenity", type: "school" }, "대전고등학교"));
assert.deepEqual(teamInfoFromHtml('<th class="label"> 주소 </th><td colspan="3">광주광역시 남구<br>서문대로 20</td><th>지역</th><td>광주</td>'), { sido: "광주", addr: "광주광역시 남구 서문대로 20" });
assert.ok(isOfficeAddress("경기도 안양시 예시아파트 101동 1001호"));
assert.ok(!isOfficeAddress("경기도 안양시 체육공원로 12"));
assert.equal(fullNomAddress({ state: "대전광역시", borough: "중구", road: "대흥로", house_number: "110" }), "대전광역시 중구 대흥로 110");
assert.equal(fullNomAddress(undefined, "원문 전체 주소 123"), "원문 전체 주소 123");
assert.ok(matchesStreetOrLot("대전광역시 중구 대흥로 110", { road: "대흥로", house_number: "110" }));
assert.ok(!matchesStreetOrLot("부산 연제구 사직2동 930", { borough: "연제구" }));
assert.ok(matchesStreetOrLot("서울 중랑구 망우동 4", { quarter: "망우동", house_number: "4" }));

assert.ok(!isFieldName("벅수당구장"));
assert.ok(!isFieldName("스트라이크존 스크린야구"));
assert.ok(!isOutdoorBaseballTags({ name: "KBO 스토어", sport: "baseball", shop: "sports" }));
assert.ok(!isOutdoorBaseballTags({ name: "야구장", sport: "baseball", indoor: "yes" }));
assert.ok(!isOutdoorBaseballTags({ sport: "baseball", disused: "yes" }));
assert.ok(!isOutdoorBaseballTags({ name: "야구장농원", amenity: "restaurant" }));
assert.ok(!isOutdoorBaseballTags({ name: "코리아풋볼파크", leisure: "sports_centre" }));
assert.ok(!isOutdoorBaseballTags({ name: "기장체육관", sport: "baseball;badminton", building: "yes", leisure: "sports_centre" }));
assert.ok(!isOutdoorBaseballTags({ name: "송도스포츠센터(LNG야구장)", highway: "bus_stop", public_transport: "platform" }));
assert.ok(!isOutdoorBaseballTags({ name: "순환43: LNG야구장", route: "bus", type: "route" }));
assert.ok(!isOutdoorBaseballTags({ name: "베이스볼파크로", highway: "tertiary" }));
assert.ok(isOutdoorBaseballTags({ name: "한화생명볼파크", leisure: "stadium" }));
assert.ok(isOutdoorBaseballTags({ sport: "baseball", leisure: "pitch" }));
assert.ok(isFieldName("퍼스트리그야구장"));
assert.ok(isProName("광주기아챔피언스필드"));
assert.ok(!isProName("목동야구장"));

const parks = [
  { name: "올림픽공원", minlat: 37.5, minlon: 127.1, maxlat: 37.53, maxlon: 127.13 },
  { name: "작은공원", minlat: 37.51, minlon: 127.11, maxlat: 37.512, maxlon: 127.112 },
];
assert.equal(parkOf({ lat: 37.511, lon: 127.111 }, parks), "작은공원", "가장 작은 공원");
assert.equal(parkOf({ lat: 37.52, lon: 127.12 }, parks), "올림픽공원");
assert.equal(parkOf({ lat: 36, lon: 127 }, parks), null);
assert.ok(Math.abs(distance({ lat: 37.5, lon: 127 }, { lat: 37.51, lon: 127 }) - 1112) < 5);
console.log("fieldsUtil tests passed");

// 보정 후 추가 출처를 병합한다. 좌표 반올림·추정 표시·삭제·근접 동명·별개 구장·잘못된 입력을 검증한다.
const field = (id: string, name = "한강 야구장", lat = 37.52123456): Field => ({ id, name, kind: "야구장", sido: "서울", sigungu: "영등포구", lat, lon: 126.9 });
const sources = [{ id: "city", title: "지자체 공개 자료", url: "https://example.go.kr/fields", license: "공공누리 1유형" }];
const base = [field("osm:way/1", "한강 야구장(추정)"), field("osm:way/2", "실내 배팅장")];
const before = JSON.stringify(base);
const merged = mergeFieldData(base, {
  "osm:way/1": { name: "한강 야구장", approx: false, source: "https://example.go.kr/fields" },
  "osm:way/2": { remove: true, reason: "OSM 태그상 실내 연습 시설" },
  "osm:way/404": { note: "없어진 OSM ID", reason: "재수집으로 사라짐" },
}, { fetchedAt: "2026-10-29", sources, fields: [field("extra:city:1", "한강 야구장", 37.5213), field("extra:city:2", "한강 제2야구장", 37.522), field("extra:city:3", "한강 야구장", 37.6)] });
assert.equal(merged.fields.length, 3);
assert.deepEqual(merged.removed, ["osm:way/2"]);
assert.deepEqual(merged.duplicateExtras, ["extra:city:1"]);
assert.deepEqual(merged.unmatchedOverrides, ["osm:way/404"]);
assert.equal(merged.fields.find((f) => f.id === "osm:way/1")!.lat, 37.521235);
assert.equal(merged.fields.find((f) => f.id === "osm:way/1")!.approx, false);
assert.equal(JSON.stringify(base), before, "원본 불변");
assert.equal(mergeFieldData(base.slice(0, 1), {}, { fetchedAt: "", sources: [], fields: [] }).fields[0].name, "한강 야구장");
assert.equal(mergeFieldData(base.slice(0, 1), {}, { fetchedAt: "", sources: [], fields: [] }).fields[0].approx, true);
assert.throws(() => mergeFieldData(base, { "osm:way/1": { name: "근거 없음" } }, { fetchedAt: "", sources: [], fields: [] }));
assert.throws(() => mergeFieldData([field("same"), field("same")], {}, { fetchedAt: "", sources: [], fields: [] }));
assert.throws(() => mergeFieldData([], {}, { fetchedAt: "", sources, fields: [field("extra:city:1"), field("extra:city:1")] }));
assert.throws(() => mergeFieldData([], {}, { fetchedAt: "", sources: [], fields: [field("extra:city:1")] }));
assert.throws(() => mergeFieldData([], {}, { fetchedAt: "", sources, fields: [field("extra:unknown:1")] }));
assert.throws(() => validateField({ ...field("bad"), lat: 0 }));
assert.throws(() => validateField({ ...field("bad"), sigungu: "분당구", sido: "경기" }));

// 동명 중복 정리 — 같은 시·군·구에서 500m 안으로 이어지는 같은 이름은 하나만 남긴다(사용자 검토 2026-10-30).
const at = (id: string, name: string, lat: number, extra: Partial<Field> = {}): Field => ({ ...field(id, name, lat), ...extra });
const park = [
  at("osm:way/11", "삼락공원 야구장", 37.5000, { approx: true }),
  at("osm:way/12", "삼락공원 야구장", 37.5030, { approx: false, addr: "서울특별시 영등포구 여의동로 330" }), // 333m
  at("osm:way/13", "삼락공원 야구장", 37.5060, { approx: true }), // 12와 333m — 단일 연결로 한 묶음
];
const dd = dedupeSameNameFields(park);
assert.deepEqual(dd.fields.map((f) => f.id), ["osm:way/12"], "정확한 위치·번지 있는 항목을 남긴다");
assert.deepEqual(dd.deduplicated, [{ kept: "osm:way/12", removed: ["osm:way/11", "osm:way/13"] }]);
// 지역명만 붙은 임시 이름이라도 멀리 떨어지면 다른 구장이다.
assert.equal(dedupeSameNameFields([at("osm:way/21", "이천시 야구장", 37.50), at("osm:way/22", "이천시 야구장", 37.52)]).fields.length, 2, "2.2km — 별개 구장");
// 시·군·구가 다르면 이름이 같아도 남긴다.
assert.equal(dedupeSameNameFields([at("osm:way/31", "리틀야구장", 37.5), { ...at("osm:way/32", "리틀야구장", 37.5001), sigungu: "구로구" }]).fields.length, 2);
// 띄어쓰기·(추정) 차이는 같은 이름으로 본다. 정확도가 같으면 프로·공식 구장 출처를 남긴다.
assert.deepEqual(dedupeSameNameFields([at("osm:way/41", "창원 NC파크", 37.5), at("pro:창원NC파크", "창원NC파크", 37.5005)]).fields.map((f) => f.id), ["pro:창원NC파크"]);
// 병합은 보정 뒤의 이름으로 묶는다 — 보정으로 이름이 같아진 두 다이아몬드가 하나가 된다.
const renamed = mergeFieldData([at("osm:way/51", "송포동 야구장", 37.5), at("osm:way/52", "송포동 야구장", 37.5011)], {
  "osm:way/51": { name: "고양장항야구장", source: "https://m.gys.or.kr/page/facilities/s_sports/jh_baseball.php" },
  "osm:way/52": { name: "고양장항야구장", source: "https://m.gys.or.kr/page/facilities/s_sports/jh_baseball.php" },
}, { fetchedAt: "", sources: [], fields: [] });
assert.equal(renamed.fields.length, 1);
assert.equal(renamed.deduplicated[0].removed.length, 1);
// 꼬리 「야구장」 중복 이름을 바로잡고, 같은 자리 원래 항목과 하나로 합친다. 추정 표시는 바꾸지 않는다.
assert.equal(cleanFieldName("청주야구장 야구장"), "청주야구장");
assert.equal(cleanFieldName("서울대공원 야구장 야구장"), "서울대공원 야구장");
assert.equal(cleanFieldName("야구장 야구장"), "야구장");
assert.equal(cleanFieldName("화성히어로즈 베이스볼파크 야구장"), "화성히어로즈 베이스볼파크");
assert.equal(cleanFieldName("한강공원 야구장"), "한강공원 야구장", "정상 이름은 그대로");
const doubled = mergeFieldData([at("osm:node/71", "청주야구장", 37.5), at("osm:way/72", "청주야구장 야구장", 37.50002)], {}, { fetchedAt: "", sources: [], fields: [] });
assert.deepEqual(doubled.fields.map((f) => [f.id, f.name, f.approx]), [["osm:node/71", "청주야구장", undefined]]);
// 보정으로 분류를 바꿀 수 있고, 허용되지 않은 분류는 거부한다.
const reclassified = mergeFieldData([at("extra:city:9", "창원NC파크마산구장", 37.5)], {
  "extra:city:9": { name: "창원NC파크", kind: "프로야구장", reason: "KBO 홈구장" },
}, { fetchedAt: "", sources: [], fields: [] }).fields[0];
assert.equal(reclassified.kind, "프로야구장");
assert.equal(reclassified.name, "창원NC파크");
assert.throws(() => mergeFieldData([at("osm:way/61", "야구장", 37.5)], { "osm:way/61": { kind: "축구장" as Field["kind"], reason: "x" } }, { fetchedAt: "", sources: [], fields: [] }));
assert.throws(() => validateField({ ...field("bad"), kind: "축구장" as Field["kind"] }));
assert.throws(() => validateField({ ...field("bad"), sido: "경북", sigungu: "대구광역시" }));
console.log("fields 보정·추가·중복·근거·좌표·표시 규칙 테스트 통과");
const goyang = { sido: "경기", sigungu: "고양시" };
assert.equal(completeFieldAddress(goyang, "일산동구 장항동 660-65번지 일원"), "경기도 고양시 일산동구 장항동 660-65번지 일원");
assert.equal(completeFieldAddress(goyang, "경기도 고양시 일산동구 장항동 660-65"), "경기도 고양시 일산동구 장항동 660-65");
assert.equal(completeFieldAddress(goyang, "수원시 중앙로 10"), null);
assert.equal(completeFieldAddress(goyang, "장대들길 송포동 장항1동"), null);
assert.ok(!hasFieldAddressNumber("고양시 덕이로172번길"));
assert.ok(hasFieldAddressNumber("고양시 덕이로172번길 10"));
assert.equal(osmTagFieldAddress({ sido: "경남", sigungu: "김해시" }, { "addr:street": "장척로", "addr:housenumber": "678", "addr:town": "상동면" }), "경상남도 김해시 상동면 장척로 678");
assert.equal(osmTagFieldAddress(goyang, { "addr:street": "구룡리", "addr:housenumber": "673" }), null, "도로명이 아닌 태그를 임의 도로명으로 복원하지 않음");
assert.equal(osmTagFieldAddress(goyang, { "addr:street": "중앙로", "addr:housenumber": "1", "addr:city": "수원시" }), null);
const point = { ...field("osm:way/janghang"), sido: "경기", sigungu: "고양시", lat: 37.650535, lon: 126.737589, name: "송포동 야구장", approx: true };
const fixedPoint = mergeFieldData([point], { [point.id]: { name: "고양장항야구장", addr: "경기도 고양시 일산동구 장항동 660-65", source: "https://m.gys.or.kr/page/facilities/s_sports/jh_baseball.php" } }, { fetchedAt: "", sources: [], fields: [] }).fields[0];
assert.equal(fixedPoint.lat, point.lat);
assert.equal(fixedPoint.lon, point.lon);
assert.equal(fixedPoint.approx, true, "주소 보정만으로 위치를 정확하다고 자동 확정하지 않음");
console.log("야구장 주소 순서·도로명 숫자·지역 충돌·좌표 보존 검증 통과");
// 주소 표기 정제 — 실제 수집 원문으로 검증한다. 번지·도로를 새로 만들거나 숫자를 옮기지 않는다.
const refine = (sido: string, sigungu: string, name: string, addr: string, team?: string) => refineFieldAddress({ sido, sigungu, name, addr, team });
const cases: [string, string, string, string, string][] = [
  // 한국식 원문: 시·도 전체 명칭, 괄호 앞 띄어쓰기, 끝에 붙은 자기 이름 제거
  ["전북", "익산시", "원광대학교", "전라북도 익산시 익산대로 460(신동)", "전북특별자치도 익산시 익산대로 460 (신동)"],
  ["강원", "횡성군", "한국골프과학기술대학교", "강원도 횡성군 우천면 하대5길 109한국골프대학교", "강원특별자치도 횡성군 우천면 하대5길 109 (한국골프대학교)"],
  ["대구", "수성구", "수성대학교", "대구광역시 수성구 달구벌대로528길 15 (만촌동)수성대학교", "대구광역시 수성구 달구벌대로528길 15 (만촌동)"],
  ["울산", "남구", "문수야구장", "울산 남구 문수로 44", "울산광역시 남구 문수로 44"],
  // 학교 위치 자료의 괄호 안 시·도·시·군·구 반복 제거, 법정동 "3가"는 붙여 둠
  ["서울", "성북구", "경동고등학교", "서울특별시 성북구 보문로29길 49 (서울특별시 성북구 삼선동3가 43-1)", "서울특별시 성북구 보문로29길 49 (삼선동3가 43-1)"],
  ["광주", "남구", "광주동성고등학교", "전남광주통합특별시 남구 서문대로627번길 20 (전남광주통합특별시 남구 진월동 406)", "전남광주통합특별시 남구 서문대로627번길 20 (진월동 406)"],
  // 붙여 쓴 지번 띄우기, 다른 학교 이름은 참고항목으로
  ["광주", "남구", "동성중학교", "광주 남구 진월동406번지 광주동성중학교", "광주광역시 남구 진월동 406번지"],
  ["전북", "전주시", "전북 전주시전라BC", "전북 전주시 덕진구 덕진동1가1200번지 전라중학교", "전북특별자치도 전주시 덕진구 덕진동1가 1200번지 (전라중학교)"],
  ["강원", "춘천시", "강원고등학교", "강원 춘천시 동면 장학리산36번지", "강원특별자치도 춘천시 동면 장학리 산36번지"],
  // 상세주소(층·호)는 쉼표 뒤, 참고항목은 괄호
  ["부산", "남구", "부산 남구부머스주니어(U-15)", "부산광역시 남구 수영로 192 (대연동)지하층", "부산광역시 남구 수영로 192, 지하층 (대연동)"],
  ["경기", "수원시", "경기 서호중BC(U-15)", "경기도 수원시 장안구 경수대로 893 (조원동)수원케이티위즈파크", "경기도 수원시 장안구 경수대로 893 (조원동, 수원케이티위즈파크)"],
  ["경남", "김해시", "경남 진례중SBC(U-15)", "경상남도 김해시 칠산로 150-61 (이동)772-6", "경상남도 김해시 칠산로 150-61 (이동 772-6)"],
  ["경남", "함안군", "경남 함안BSC(U-15)", "경상남도 함안군 가야읍 함안대로 619가야읍 가야리 9-2", "경상남도 함안군 가야읍 함안대로 619 (가야리 9-2)"],
  ["충남", "천안시", "천안CSBC(U-18)", "충청남도 천안시 동남구 성남면 용원1길 48가동", "충청남도 천안시 동남구 성남면 용원1길 48, 가동"],
  ["경기", "수원시", "수원종합운동장 야구장", "경기도 수원시 조원동 경수대로 893", "경기도 수원시 경수대로 893 (조원동)"],
  // 뜻이 모호한 숫자는 옮기지 않음, 옛 구 이름은 현재 구로
  ["경기", "부천시", "진영고등학교", "경기도 부천시 호현로 387(소사본동) 41", "경기도 부천시 호현로 387 (소사본동) 41"],
  ["인천", "미추홀구", "인하대학교", "인천광역시 남구 인하로 100(용현동)", "인천광역시 미추홀구 인하로 100 (용현동)"],
  ["경기", "고양시", "고양 리틀 야구장", "경기도 고양시 일산서구 중앙로 1601 일원", "경기도 고양시 일산서구 중앙로 1601 일원"],
  // 지도 역주소: 작은 단위부터 → 한국식, 법정동 우선, 시설명·자전거길·강·아파트·영문·우편번호 제거
  ["서울", "강동구", "게내수변공원 야구장", "아리수로87길 고덕동 고덕2동 강동구", "서울특별시 강동구 고덕동 아리수로87길"],
  ["충남", "아산시", "실옥동 야구장", "국교천 자전거길 실옥동 석정리 아산시", "충청남도 아산시 실옥동"],
  ["인천", "연수구", "연수구 야구장", "인천신항대로892번길 연수구 인천광역시 22012", "인천광역시 연수구 인천신항대로892번길"],
  ["서울", "서대문구", "연세대학교 야구장", "연세대학교 야구장 Wonchul-gil 신촌동 서대문구", "서울특별시 서대문구 신촌동"],
  ["서울", "관악구", "낙성대동 야구장", "관악로 건영아파트 낙성대동 관악구", "서울특별시 관악구 낙성대동 관악로"],
  ["서울", "성북구", "녹지운동장", "고려대로17길 안암동2가 안암동 성북구", "서울특별시 성북구 안암동2가 고려대로17길"],
  ["경기", "광주시", "광주시 G-스타디움 야구장", "광주시 G-스타디움 야구장 경안천 자전거길 양벌동 오포2동", "경기도 광주시 양벌동"],
  ["경기", "남양주시", "삼패야구장", "삼패야구장 한강 자전거길 삼패동 평구", "경기도 남양주시 삼패동"],
  ["경기", "화성시", "화성히어로즈베이스볼파크", "화성히어로즈베이스볼파크 베이스볼파크로 새솔동 비봉면", "경기도 화성시 새솔동 베이스볼파크로"],
  // 시설 자신의 건물번호만 쓰고, 앞 상호(두배로 삼겹)의 번호는 쓰지 않음
  ["강원", "춘천시", "고구마섬야구장 야구장", "고구마섬야구장 3005 영서로 사농동", "강원특별자치도 춘천시 영서로 3005 (사농동)"],
  ["서울", "중구", "동화동 야구장", "두배로 삼겹(본점) 403-38 다산로36길 동화동", "서울특별시 중구 동화동 다산로36길"],
  // 도로 없이 앞에 온 숫자는 국도 번호(47번)·올레길 코스(7-1)일 수 있어 번지로 쓰지 않음
  ["경기", "남양주시", "삼육훼미리 야구장", "삼육훼미리 야구장 47 신월2리 진접읍", "경기도 남양주시 진접읍 신월2리"],
  ["제주", "서귀포시", "대천동 야구장", "7-1 Ollegil 대천동 서귀포시 제주특별자치도", "제주특별자치도 서귀포시 대천동"],
  // 다른 시·군이 섞이면 시·군까지만
  ["경북", "구미시", "등락지구 유소년체육시설 야구장", "낙동강 자전거도로 중리 구미시 칠곡군", "경상북도 구미시"],
  // 쉼표로 나뉜 Nominatim display_name
  ["경기", "고양시", "송포동 야구장", "장대들길, 송포동, 장항1동, 일산동구, 고양시, 경기도, 10234, 대한민국", "경기도 고양시 일산동구 송포동 장대들길"],
];
for (const [sido, sigungu, name, raw, want] of cases) {
  const got = refine(sido, sigungu, name, raw);
  assert.equal(got, want, `${name}: ${raw}`);
  assert.equal(refine(sido, sigungu, name, got!), got, `정제 멱등성 — ${name}`);
  // 원문에 없던 숫자(건물번호·지번)를 만들지 않는다.
  for (const n of got!.match(/\d+(?:-\d+)?/g) ?? []) assert.ok(raw.includes(n), `없는 번지 생성 — ${name}: ${n}`);
}
assert.equal(refineFieldAddress({ sido: "서울", sigungu: "강동구", name: "x", addr: undefined }), undefined);
assert.equal(refineFieldAddress({ sido: "서울", sigungu: "강동구", name: "x", addr: "  " }), undefined);
assert.ok(!hasFieldAddressNumber("서울특별시 구로구 구로2동"), "행정동 안의 숫자는 번지가 아님");
assert.ok(!hasFieldAddressNumber("대전광역시 유성구 어은동 대학로291번라길"));
assert.ok(hasFieldAddressNumber("대구광역시 북구 고성3가 2"));
// 병합할 때 정제가 적용되고, 보정 원문은 그대로 둔다.
const refinedOnMerge = mergeFieldData([{ ...field("osm:way/1473256077"), sido: "서울", sigungu: "강동구", name: "게내수변공원 야구장", addr: "아리수로87길 고덕동 고덕2동 강동구" }], {}, { fetchedAt: "", sources: [], fields: [] }).fields[0];
assert.equal(refinedOnMerge.addr, "서울특별시 강동구 고덕동 아리수로87길");
// 팀 등록지 동·호수 — 개인 집 주소일 수 있어 공개 주소·대조 키에서 뺀다(예시는 가상 주소).
assert.equal(stripResidentialUnit("경기도 안양시 동안구 예시로 10 (예시동, 예시아파트)101동 1001호"), "경기도 안양시 동안구 예시로 10 (예시동)");
assert.equal(stripResidentialUnit("울산광역시 남구 예시로12번길 3, 202동 2002호 (예시동, 예시타운)"), "울산광역시 남구 예시로12번길 3 (예시동)");
assert.equal(stripResidentialUnit("서울특별시 광진구 예시로9길 5 (예시동, 예시 아파트)303호"), "서울특별시 광진구 예시로9길 5 (예시동)");
assert.equal(stripResidentialUnit("충청남도 아산시 신창면 예시대로 123 (예시아파트)303동 3003호"), "충청남도 아산시 신창면 예시대로 123");
assert.equal(stripResidentialUnit("경기도 파주시 파평면 예시로446번길 37-55, 1층"), "경기도 파주시 파평면 예시로446번길 37-55, 1층", "호수가 없으면 그대로");
assert.equal(stripResidentialUnit("서울특별시 서초구 예시로 12 (서초동)"), "서울특별시 서초구 예시로 12 (서초동)");
assert.equal(stripResidentialUnit("서울특별시 구로구 구로2동"), "서울특별시 구로구 구로2동", "행정동 숫자는 동·호수가 아님");
assert.equal(stripResidentialUnit("인천광역시 연수구 송도2동 랜드마크시티 1호 체육공원 야구장"), "인천광역시 연수구 송도2동 랜드마크시티 1호 체육공원 야구장", "시설 이름의 호는 그대로");
assert.equal(stripResidentialUnit("경기도 안산시 단원구 안산시제22호근린공원"), "경기도 안산시 단원구 안산시제22호근린공원");
assert.equal(stripResidentialUnit("충청북도 청주시 흥덕구 예시로7번길 9, 상가동 1-404호 (예시동, 예시 하트리움)"), "충청북도 청주시 흥덕구 예시로7번길 9, 상가동 (예시동)");
const unitField = mergeFieldData([{ id: "kbsa:9", name: "예시BC (팀 등록지·야구장 아님)", kind: "고등학교", sido: "경기", sigungu: "안양시", lat: 37.39, lon: 126.96,
  addr: "경기도 안양시 동안구 예시로 10 (예시동, 예시아파트)101동 1001호", addrKey: "|경기도 안양시 동안구 예시로 10 (예시동, 예시아파트)101동 1001호", approx: true }], {}, { fetchedAt: "", fields: [], sources: [] }).fields[0];
assert.ok(!/호/.test(unitField.addr ?? "") && !/호/.test(unitField.addrKey ?? ""), "병합하면 주소·대조 키 모두 동·호수가 빠진다");
assert.equal(unitField.addrKey, "|경기도 안양시 동안구 예시로 10 (예시동)", "수집기 대조 키와 같은 규칙");
console.log("야구장 주소 표기 정제·멱등성·번지 비생성 검증 통과");
