# 오전 6시 · AI & Code

한국 시간 매일 오전 6시에 GitHub의 AI·개발 도구 프로젝트 하나를 선정해 한국어로 소개하는 게시판입니다.

- `docs/index.html`: 모바일 대응 게시판, 검색과 카테고리 필터. 공개 저장소의 JSON을 직접 읽으므로 게시 후 사이트 재배포가 필요 없습니다.
- `docs/data/posts.json`: 날짜별 글과 공식 출처. 하루 한 편, 저장소 중복 제외.
- `scripts/daily-post.mjs`: 최근 업데이트된 프로젝트 검색 → 신규 프로젝트 우선 → 공식 README 기반 AI 요약 → 검증 후 저장. API 오류 시 기존 글 유지.
- `.github/workflows/daily-post.yml`: UTC 21:00 = 다음 날 한국 시간 06:00. GitHub 예약 실행은 지연될 수 있으며 공개 저장소는 60일간 활동이 없으면 예약이 비활성화될 수 있습니다.

## 시작

Node.js 22 이상. 외부 패키지 불필요.

```sh
node --test scripts/daily-post.test.mjs
python3 -m http.server 8000 --directory docs
```

Actions의 **Daily AI & Code → Run workflow**로 수동 실행 가능합니다. 첫 코드 추가 시에도 실행됩니다.
기본은 `GITHUB_TOKEN`과 `models: read` 권한으로 GitHub Models의 `openai/gpt-4.1-mini`를 사용합니다. 계정/조직에서 GitHub Models 접근이 허용되어야 합니다. 차단되거나 할당량이 부족하면 저장소 Settings → Secrets and variables → Actions에 **OPENAI_API_KEY**를 추가하세요. 이 경우 OpenAI API `gpt-4.1-mini`를 사용하며 API 요금이 발생할 수 있습니다. 비밀키를 코드나 게시글에 넣지 마세요.

직접 실행하려면 `GITHUB_TOKEN` 또는 `OPENAI_API_KEY`를 환경변수로 제공합니다. 같은 한국 날짜의 글이 있으면 추가하지 않습니다. README를 신뢰할 수 없는 자료로 처리하며, 모델 출력은 DOM textContent로 표시합니다.

GitHub Pages로 별도 공개하려면 Settings → Pages → Deploy from a branch → main /docs를 선택하세요. Sites 배포본은 별도로 제공됩니다.
