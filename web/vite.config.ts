import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const root = path.dirname(fileURLToPath(import.meta.url));
// 커밋되는 정적 JSON "DB"는 리포 루트 /data 에 위치한다.
const dataDir = path.resolve(root, "..", "data");

/**
 * 리포 루트의 /data 를 개발 서버에서는 미들웨어로 서빙하고,
 * 빌드 시에는 산출물(dist/data)로 복사한다. 외부 의존성 없이 처리.
 */
function serveDataPlugin(): Plugin {
  return {
    name: "serve-root-data",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        const url = decodeURIComponent(req.url.split("?")[0]);
        const match = url.match(/^\/data\/(.+)$/);
        if (!match) return next();
        const filePath = path.join(dataDir, match[1]);
        if (!filePath.startsWith(dataDir) || !fs.existsSync(filePath)) {
          res.statusCode = 404;
          return res.end("not found");
        }
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache");
        fs.createReadStream(filePath).pipe(res);
      });
    },
    closeBundle() {
      const out = path.resolve(root, "dist", "data");
      if (!fs.existsSync(dataDir)) return;
      // games/(원본 박스스코어)·roster.json·official.json 은 프론트가 직접 읽지 않으므로
      // 배포 산출물에서 제외(용량 절감). 집계 결과만 복사.
      const skip = new Set(["games", "roster.json", "official.json"]);
      fs.cpSync(dataDir, out, {
        recursive: true,
        filter: (src) => {
          const rel = path.relative(dataDir, src);
          const top = rel.split(path.sep)[0];
          return !skip.has(top) && !rel.includes(`${path.sep}official.json`);
        },
      });
    },
  };
}

export default defineConfig({
  // GitHub Pages 프로젝트 사이트 경로. 배포 워크플로에서 VITE_BASE 로 주입.
  base: process.env.VITE_BASE || "/",
  plugins: [react(), serveDataPlugin()],
});
