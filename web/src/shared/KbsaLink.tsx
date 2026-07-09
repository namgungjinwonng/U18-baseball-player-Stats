// KBSA 선수 페이지로 이동하는 링크 버튼 — 선수 상세(기록 보유/무기록 폴백) 공용.
import { kbsaPlayerUrl } from "./kbsa";

export function KbsaLink({ personNo }: { personNo?: string }) {
  if (!personNo) return null;
  return (
    <a
      className="chip kbsa-link"
      href={kbsaPlayerUrl(personNo)}
      target="_blank"
      rel="noreferrer"
    >
      KBSA 선수정보 ↗
    </a>
  );
}
