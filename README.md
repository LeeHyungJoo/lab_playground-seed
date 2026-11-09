# 오전 6시 · AI & Code

한국 시간 매일 오전 6시에 GitHub의 AI·개발 도구 프로젝트 하나를 선정해 한국어로 소개하는 게시판입니다.

## 자동 게시

GitHub Actions가 프로젝트 검색 → 공식 README 확인 → 한국어 AI 요약 → 출력 검증 → `docs/data/posts.json` 커밋을 실행합니다. 사이트는 이 파일을 읽으므로 새 글마다 사이트를 다시 배포할 필요가 없습니다.

**추가 API 키 없이 실행됩니다.** 기본은 Actions CPU에서 `Qwen/Qwen3-1.7B` 공개 모델을 직접 실행하는 방식입니다. Apache-2.0 모델의 고정 리비전 `70d244cc86ccca08cf5af4e1e306ecf908b1ad5e`을 사용하며, 원격 Python 코드 실행은 사용하지 않습니다. 최초 실행은 약 3.5GB의 가중치를 내려받아 수 분 이상 걸릴 수 있습니다. 이후 모델 캐시를 재사용합니다. 작은 모델 특성상 요약 품질에 한계가 있으므로 원문을 함께 확인하세요.

GitHub Models는 2026-07-30 종료되어 사용하지 않습니다. 공식 공지: https://github.blog/changelog/2026-07-30-github-models-is-now-retired/

더 큰 모델로 요약하려면 저장소 Settings → Secrets and variables → Actions에 `OPENAI_API_KEY`를 선택적으로 등록합니다. 이때 OpenAI API `gpt-4.1-mini`를 사용하며 별도 API 요금이 발생할 수 있습니다. ChatGPT 구독과는 별도입니다. 키는 소스에 넣지 마세요.

## 예약과 수동 실행

- `.github/workflows/daily-post.yml`: UTC 21:00 = 다음 날 한국 시간 06:00.
- 예약 이벤트 누락·일시 오류에 대비해 한국 시간 06:17, 06:37, 07:17, 08:17, 09:17에도 확인합니다. 당일 글이 이미 있으면 AI 실행과 추가 게시를 건너뜁니다. GitHub 예약 자체는 정시 실행이나 이벤트 전달을 보장하지 않습니다.
- Actions → **Daily AI & Code → Run workflow**: 지금 실행.
- 한국 날짜 기준 하루 한 편. 테스트·초기 큐레이션은 일일 게시 완료로 계산하지 않습니다.
- 이미 소개한 저장소는 제외합니다. 최근 30일 업데이트된 프로젝트를 찾고 신규 프로젝트를 우선합니다. 별 수는 참고 지표이며 성장률을 뜻하지 않습니다.
- AI 출력이나 API 요청이 실패하면 글을 저장하지 않고 워크플로를 실패 처리합니다. 실패 로그는 Actions에서 확인하세요.
- GitHub 예약 실행은 지연될 수 있으며 공개 저장소는 60일간 활동이 없으면 예약이 비활성화될 수 있습니다.

## 개발

Node.js 22+, Python 3.11. 게시판은 정적 HTML입니다.

```sh
node --test scripts/*.test.mjs
python3 -m http.server 8000 --directory docs
```

기본 로컬 AI 게시 실행:

```sh
python3 -m venv .venv
. .venv/bin/activate
pip install torch==2.8.0 --index-url https://download.pytorch.org/whl/cpu
pip install -r scripts/requirements-ai.txt
node scripts/daily-post.mjs
```

`GITHUB_TOKEN`은 GitHub 검색 할당량을 늘리는 선택적 환경변수입니다. AI 모델 인증에는 사용하지 않습니다. README는 신뢰할 수 없는 자료로 취급하고 출력은 DOM `textContent`로 표시합니다.

## 사이트

`docs/index.html`은 검색·카테고리 필터와 모바일 화면을 제공합니다. 별도의 공개 배포가 필요하면 GitHub Settings → Pages → Deploy from a branch → main /docs를 선택하세요. Sites 배포본은 별도로 관리됩니다.
