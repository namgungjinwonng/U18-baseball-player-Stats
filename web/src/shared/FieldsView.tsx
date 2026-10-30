// 안내 「야구장 현황」 — 시·도 → 시·군·구를 고르면 야구장 목록(고등학교 우선)이 나오고, 고르면 무료 지도에 위치와 길찾기 링크를 보여 준다
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useFields } from "./data";
import { Ico } from "./navIcons";
import { copyFieldAddress, fieldAddress, fieldAppLinks, hasDetailedAddress, mapPlatform, openAppOrFallback, type MapAppLink } from "./fieldLinks";
import { FIELD_GROUPS as GROUPS, filterFields, sidoCounts as countSido, sidoOptions, sigunguCounts } from "./fieldFilter";
import type { Field, FieldKind } from "./types";

const FieldsMap = lazy(() => import("./FieldsMap"));

const shortDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}` : "";
};
const approxTag = (f: Field) => f.approx && !f.name.includes("(추정)");

export function FieldsView({ wrapClass }: { wrapClass: string }) {
  const { data, loading } = useFields();
  const [params, setParams] = useSearchParams();
  const sido = params.get("sido") ?? "";
  const sgg = params.get("sgg") ?? "";
  const q = params.get("q") ?? "";
  const selId = params.get("id") ?? "";
  const update = useCallback((patch: Record<string, string>) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      return next;
    }, { replace: true });
  }, [setParams]);

  const all = useMemo(() => data?.fields ?? [], [data]);
  const sidoCounts = useMemo(() => countSido(all), [all]);
  const sggList = useMemo(() => sigunguCounts(all, sido), [all, sido]);
  const shown = useMemo(() => filterFields(all, sido, sgg, q), [all, sido, sgg, q]);
  const selected = useMemo(() => all.find((f) => f.id === selId) ?? null, [all, selId]);
  const addressText = useRef<HTMLSpanElement>(null);
  const [copyStatus, setCopyStatus] = useState({ id: "", text: "" });
  const address = selected ? fieldAddress(selected) : "";
  const platform = useMemo(() => mapPlatform(navigator.userAgent, navigator.maxTouchPoints), []);
  const apps = selected ? fieldAppLinks(selected, platform) : null;
  // 모바일은 앱 실행을 먼저 시도하고, 앱이 안 열리면 링크 주소(웹 지도·설치 페이지)로 넘긴다. PC 는 링크 그대로 연다.
  const openApp = (link: MapAppLink) => (e: MouseEvent) => {
    if (!link.app) return;
    e.preventDefault();
    openAppOrFallback(link);
  };
  const copyAddress = async () => {
    if (!selected || !address) return;
    const result = await copyFieldAddress(address, navigator.clipboard ? () => navigator.clipboard.writeText(address) : undefined, () => {
      const el = addressText.current;
      if (!el) return;
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    });
    setCopyStatus({ id: selected.id, text: result === "copied" ? "전체 주소를 복사했습니다." : "주소를 선택했습니다. 길게 누르거나 복사 메뉴를 이용해 주세요." });
  };
  const select = useCallback((f: Field) => update({ id: f.id }), [update]);

  // 분류 목록은 접어 두고 펼친 분류만 보인다. 지역을 바꾸면 다시 모두 접는다.
  const [open, setOpen] = useState<Set<FieldKind>>(() => new Set());
  useEffect(() => { setOpen(new Set()); }, [sido, sgg]);
  // 지도 점이나 주소로 고른 곳은 그 분류를 펼쳐 목록에서도 보이게 한다.
  useEffect(() => {
    if (selected) setOpen((prev) => (prev.has(selected.kind) ? prev : new Set(prev).add(selected.kind)));
  }, [selected]);
  const toggle = (kind: FieldKind) => setOpen((prev) => {
    const next = new Set(prev);
    if (!next.delete(kind)) next.add(kind);
    return next;
  });
  // 이름 검색 결과는 숨기지 않도록 모두 펼친다.
  const searching = q.trim() !== "";
  const isOpen = (kind: FieldKind) => searching || open.has(kind);
  // 지도는 펼친 분류만 찍는다(아무것도 안 펼쳤으면 지역 전체). 고른 곳은 항상 남긴다.
  const mapFields = useMemo(() => {
    if (!sido && !searching) return all;
    if (searching || !open.size) return shown;
    return shown.filter((f) => open.has(f.kind) || f.id === selId);
  }, [all, shown, sido, searching, open, selId]);

  if (loading) return <div className={wrapClass}><div className="state">불러오는 중…</div></div>;
  if (!data) return <div className={wrapClass}><div className="state muted">야구장 자료를 아직 준비하지 못했습니다.</div></div>;

  return (
    <div className={wrapClass}>
      <h2 className="heading-xl"><Ico name="field" variant="title" />야구장 현황</h2>
      <p className="fields-note">
        KBSA 등록 정보·학교 위치·공개 기관 자료·OpenStreetMap으로 정리했습니다. (추정) 표시는 이름이나 위치가 실제와 다를 수 있으니 방문 전에 확인해 주세요.
        {data.updated && ` · ${shortDate(data.updated)} 갱신`}
      </p>

      <div className="fields-filters">
        <select aria-label="시·도" value={sido} onChange={(e) => update({ sido: e.target.value, sgg: "", id: "" })}>
          <option value="">시·도 선택</option>
          {sidoOptions(sidoCounts).map((s) => <option key={s} value={s}>{s} ({sidoCounts.get(s)})</option>)}
        </select>
        <select aria-label="시·군·구" value={sgg} disabled={!sido} onChange={(e) => update({ sgg: e.target.value, id: "" })}>
          <option value="">{sido ? "시·군·구 전체" : "시·군·구"}</option>
          {sggList.map(([s, n]) => <option key={s} value={s}>{s} ({n})</option>)}
        </select>
        <input type="search" aria-label="이름 검색" placeholder="학교·구장 이름 검색" value={q} onChange={(e) => update({ q: e.target.value, id: "" })} />
      </div>

      <Suspense fallback={<div className="fields-map fields-map--loading">지도를 불러오는 중…</div>}>
        <FieldsMap fields={mapFields} selected={selected} onSelect={select} />
      </Suspense>

      {selected && (
        <div className="fields-card">
          <div className="fields-card__name">
            {selected.name}{approxTag(selected) && <span className="fields-approx">(추정)</span>}
          </div>
          <div className="fields-card__meta">
            {selected.kind}{selected.team && selected.team !== selected.name ? ` · KBSA ${selected.team}` : ""} · {selected.sido} {selected.sigungu}
          </div>
          {address ? (
            <div className="fields-card__address">
              <div className="fields-card__address-label" id="field-address-label">전체주소</div>
              <div className="fields-card__address-row" role="group" aria-labelledby="field-address-label">
                <span aria-hidden="true">: </span>
                <span id="field-full-address" ref={addressText} className="fields-card__addr" tabIndex={-1}>{address}</span>
                <button type="button" className="fields-card__copy" aria-label="전체 주소 복사" onClick={() => void copyAddress()}>복사</button>
              </div>
              {!hasDetailedAddress(address) && <p className="fields-card__note">상세 번지·건물번호 미확인 주소입니다. 지도 위치와 함께 확인해 주세요.</p>}
              {copyStatus.id === selected.id && <p role="status" className="fields-card__note">{copyStatus.text}</p>}
            </div>
          ) : <p className="fields-card__note">전체 주소·번지가 확인되지 않았습니다. 임의 주소 대신 지도 좌표를 제공합니다.</p>}
          {selected.note && <div className="fields-card__note">{selected.note}</div>}
          {selected.approx && <p className="fields-card__note">추정 위치입니다. 지도 앱은 주소·이름으로 검색하고, 웹 지도의 핀은 추정 좌표이니 실제 장소를 확인해 주세요.</p>}
          <div className="fields-card__links">
            <a href={apps!.kakao.href} onClick={openApp(apps!.kakao)}
              {...(platform === "desktop" ? { target: "_blank", rel: "noreferrer" } : {})}>카카오맵 검색 ↗</a>
            {apps!.tmap && <a href={apps!.tmap.href} onClick={openApp(apps!.tmap)}>Tmap 검색 ↗</a>}
          </div>
        </div>
      )}

      {!sido && !q.trim() ? (
        <div className="fields-sido">
          {sidoOptions(sidoCounts).map((s) => (
            <button key={s} type="button" onClick={() => update({ sido: s, sgg: "", id: "" })}>
              <b>{s}</b><small>{sidoCounts.get(s)}곳</small>
            </button>
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="state muted">조건에 맞는 야구장이 없습니다.</div>
      ) : (
        GROUPS.map(({ kind, label }, i) => {
          const rows = shown.filter((f) => f.kind === kind);
          if (!rows.length) return null;
          const expanded = isOpen(kind);
          return (
            <section key={kind} className="fields-group">
              <h3 className="fields-group__title">
                <button type="button" className="fields-group__toggle" aria-expanded={expanded}
                  aria-controls={`fields-group-${i}`} disabled={searching} onClick={() => toggle(kind)}>
                  <span>{label} <small>{rows.length}</small></span>
                  <span className="fields-group__chevron" aria-hidden="true">{expanded ? "▲" : "▼"}</span>
                </button>
              </h3>
              <ul id={`fields-group-${i}`} className="fields-list" hidden={!expanded}>
                {rows.map((f) => (
                  <li key={f.id}>
                    <button type="button" className={f.id === selId ? "is-on" : undefined} onClick={() => select(f)}>
                      <span className="fields-list__name">
                        {f.name}{approxTag(f) && <span className="fields-approx">(추정)</span>}
                      </span>
                      <span className="fields-list__meta">{f.sigungu}{f.team && f.team !== f.name ? ` · ${f.team}` : ""}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
      {!!data.sources?.length && <div className="fields-note">추가 자료 출처{data.sources.map((s) => <p key={s.id}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> · {s.license}</p>)}</div>}
    </div>
  );
}
