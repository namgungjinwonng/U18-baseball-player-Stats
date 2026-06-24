// PWA 설치 + 인앱 브라우저 처리 (u81-baseball 방식 미러).
import { useEffect, useState } from "react";

const BASE = import.meta.env.BASE_URL;

// manifest 링크 주입 + 서비스워커 등록 (base 경로 반영).
export function initPwa() {
  if (typeof document === "undefined") return;
  if (!document.querySelector('link[rel="manifest"]')) {
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = `${BASE}manifest.webmanifest`;
    document.head.appendChild(link);
  }
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register(`${BASE}sw.js`, { scope: BASE }).catch(() => {});
    });
  }
}

const ua = () => navigator.userAgent || "";
const isIOS = () => /iPhone|iPad|iPod/i.test(ua());
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as { standalone?: boolean }).standalone === true;

interface BIPEvent extends Event {
  prompt: () => void;
  userChoice: Promise<{ outcome: string }>;
}

export function usePwaInstall() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone());

  useEffect(() => {
    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setDeferred(null);
  };

  return { canInstall: !!deferred, installed, install, ios: isIOS() };
}

// 설치 버튼 — 설치 가능하면 노출, 설치되면 숨김. iOS는 안내 토글.
export function InstallButton() {
  const { canInstall, installed, install, ios } = usePwaInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (installed) return null; // 이미 설치됨 → 숨김

  if (canInstall) {
    return (
      <button className="install-btn" onClick={install}>
        📲 앱 설치
      </button>
    );
  }
  // iOS(Safari)는 beforeinstallprompt 미지원 → 수동 안내
  if (ios) {
    return (
      <span className="install-wrap">
        <button className="install-btn" onClick={() => setShowGuide((v) => !v)}>
          📲 설치 방법
        </button>
        {showGuide && (
          <div className="install-guide">
            공유 버튼 <b>⎙</b> → <b>홈 화면에 추가</b>를 누르면 설치됩니다.
          </div>
        )}
      </span>
    );
  }
  return null; // 안드로이드 Chrome 등은 beforeinstallprompt 발생 시 노출
}

// 카카오톡 등 인앱 브라우저 → 외부 브라우저로 열기 안내 배너.
export function InAppBanner() {
  const [info, setInfo] = useState<{ android: boolean; kakao: boolean } | null>(null);

  useEffect(() => {
    const u = ua();
    const kakao = /KAKAOTALK/i.test(u);
    const inApp = kakao || /Instagram|FBAN|FBAV|FB_IAB|Line\/|NAVER/i.test(u);
    if (inApp) setInfo({ android: /Android/i.test(u), kakao });
  }, []);

  if (!info) return null;

  const openExternal = () => {
    const href = location.href;
    if (info.kakao) {
      location.href = "kakaotalk://web/openExternal?url=" + encodeURIComponent(href);
    } else if (info.android) {
      location.href =
        "intent://" + href.replace(/^https?:\/\//, "") +
        "#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=" +
        encodeURIComponent(href) + ";end";
    }
  };

  const canRedirect = info.kakao || info.android;
  return (
    <div className="inapp-banner">
      📲 인앱 브라우저에서는 앱 설치가 안 됩니다.{" "}
      {canRedirect ? "아래 버튼으로 다른 브라우저에서 열어 설치하세요." : "우측 메뉴 → Safari로 열어 설치하세요."}
      {canRedirect && (
        <button onClick={openExternal}>
          {info.kakao ? "기본 브라우저로 열기" : "Chrome으로 열기"}
        </button>
      )}
    </div>
  );
}
