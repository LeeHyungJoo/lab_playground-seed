# 盡人事待天命 · 진인사대천명

**하루를 기록하고, 생각을 나누는 공간.**

개발과 삶의 아티클, 행사별 사진첩, 가족의 게시판을 담는 정적 웹사이트입니다. 기존 공개 주소와 `docs/data/posts.json` 배열을 유지합니다.

- 공개 사이트: https://morning-code-lab.flowystarfish.chatgpt.site
- 최상위 메뉴: 아티클 / 사진첩 / 게시판
- 아티클: 개발(AI·개발도구), 삶(소식·철학·경제·건강)
- 사진첩·게시판: 샘플 UI만 구현. 실제 가족사진·업로드·로그인·DB·NAS는 포함하지 않습니다.

## 실행

Node.js 22 이상. 외부 JavaScript 라이브러리나 설치 단계가 필요하지 않습니다.

```sh
npm test
npm run build
python3 -m http.server 8000 --directory dist
npm run publication:plan
```

라우팅은 `?view=articles&scope=life&category=philosophy&page=1`, `?article=...`, `?view=albums&album=...`, `?view=board&post=welcome`처럼 쿼리 문자열을 사용합니다. 정적 호스팅에서 직접 접근·새로고침이 가능합니다. 기존 `#board`와 `#about` 링크도 아티클 화면에서 유지합니다.

## 하루 세 그룹 자동 발행

기존 Sites 연결 클라우드 작업 `Automation_b8f362fe9e1c8191b18f4df7b0ead4f0`을 재사용합니다. 한국 시간 매일 06:00, `Asia/Seoul`입니다. 사용자 PC를 켜 두거나 API 키를 등록할 필요가 없습니다.

1. 클라우드 작업이 기존 글·발행 이력·정책을 읽고 **없는 그룹만** 조사합니다.
2. 생성 결과와 보류 사유를 `content/inbox/YYYY-MM-DD.json`에 저장합니다.
3. 후보 커밋으로 `Validate and publish daily articles` GitHub Actions가 실행됩니다.
4. Node.js 검증기가 날짜·그룹·순환·중복·분량·출처·뉴스 72시간을 검사합니다.
5. 성공한 그룹만 원본에 추가하고, 글 배열과 발행 이력을 같은 Git 커밋으로 저장합니다. 충돌 시 최신 main에서 다시 계산합니다.

하루 목표는 **개발 1 + 소식 1 + 교양 1**입니다. 뉴스가 검증되지 않으면 해당 그룹을 보류합니다. 빈자리를 가짜 글로 채우지 않습니다. 성공 그룹은 보존하고 실패 그룹만 재시도할 수 있습니다. 교양은 2026-11-13 철학을 기준으로 달력 날짜별 철학 → 경제 → 건강 순환입니다.

실제 스케줄러의 시작·완료 시각은 지연될 수 있습니다. `publishedAt`은 한국 시간 06:00으로 설정하고 화면은 그 이전에 글을 표시하지 않습니다. 발행이 늦게 끝나면 완료 이후 나타납니다. 정각 완료를 보장하지 않습니다.

- 편집 지침: [docs/automation/editorial-guide.md](docs/automation/editorial-guide.md)
- 기계 판독 정책: [docs/data/editorial-policy.json](docs/data/editorial-policy.json)
- 발행 이력: [docs/data/publication-state.json](docs/data/publication-state.json)
- 분석·설계·제약·검증 보고: [docs/automation/implementation-report.md](docs/automation/implementation-report.md)

## 데이터와 역할

| 경로 | 역할 |
|---|---|
| `docs/index.html`, `docs/assets/`, `docs/app.mjs` | 브랜딩·화면·반응형 스타일 |
| `docs/lib/catalog.mjs` | 카테고리·기존 글 정규화·URL 상태·읽기 시간 |
| `docs/lib/repository.mjs` | 현재 JSON 조회 어댑터; 추후 API/DB로 교체할 경계 |
| `docs/lib/views.mjs` | 목록·상세·사진첩·게시판 렌더링, 문자열 이스케이프 |
| `docs/data/posts.json` | 기존 배열 형식을 유지한 실제 발행 글 |
| `docs/data/albums.json`, `docs/data/board.json` | 샘플 사진첩·환영 공지 |
| `content/inbox/` | 발행 전 후보와 보류 사유 |
| `scripts/publication.mjs` | 공통 발행·중복·출처·정책 검증 |
| `scripts/publication-cli.mjs` | 계획 조회·저장 잠금·오류 기록·파일 복원 |
| `scripts/publish-git.mjs` | 격리된 CI에서의 Git 트랜잭션과 충돌 재시도 |
| `.github/workflows/publish-content.yml` | 유일한 일일 발행 워크플로 |
| `.openai/hosting.json` | 기존 Sites ID와 정적 출력 위치 |

## 수동 복구

후보를 수정하고 같은 날짜 파일을 다시 저장하거나, Actions의 **Validate and publish daily articles → Run workflow**를 실행합니다. 로컬에서는 아래 명령으로 동일 검증을 적용할 수 있습니다. 온라인 검증에는 공개 출처에 대한 네트워크 접근이 필요합니다.

```sh
node scripts/publication-cli.mjs publish --date=2026-11-13
```

`publication-state.json`의 그룹별 `status`, `code`, `message`, `attempts`, 날짜별 `runs`를 확인합니다. `held`는 확인 가능한 자료 부족 또는 뉴스 검증 보류, `failed`는 생성·구조·정책 오류, `missing`은 후보가 없는 상태입니다. 기존 데이터가 손상됐으면 덮어쓰지 않습니다.

기존 `daily-post.mjs`, `ai-summary.mjs`, `local-summary.py`의 개발 검색·요약 정책은 유지합니다. **Manual development recovery**는 필요할 때만 직접 실행하는 별도 개발 복구 도구이며 예약 실행하지 않습니다. 같은 날짜 개발 글이 있으면 건너뜁니다. 새로운 개발 후보도 공통 검증·이력 저장을 거칩니다.

이 수동 도구의 로컬 Qwen 실행만 Python과 다음 패키지를 요구합니다. 일일 클라우드 경로에는 필요하지 않습니다.

```sh
python3 -m venv .venv
. .venv/bin/activate
pip install torch==2.8.0 --index-url https://download.pytorch.org/whl/cpu
pip install -r scripts/requirements-ai.txt
node scripts/daily-post.mjs
```

선택적으로 `OPENAI_API_KEY`를 Actions Secret에 설정하면 수동 개발 복구에서 OpenAI API를 사용합니다. 별도 API 과금이 발생할 수 있습니다. 종료된 GitHub Models는 사용하지 않습니다.

## 이후 NAS·DB 연결

현재 JSON 저장을 그대로 사용합니다. 나중에 조회 어댑터를 인증된 API로 바꾸고, 아티클 ID·날짜+그룹·사건 키에 DB 제약을 설정하면 됩니다. 사진 파일은 NAS/오브젝트 저장소, 앨범 메타데이터와 게시판은 DB로 옮길 수 있습니다. 인증·권한·파일 접근 제어·첨부파일·댓글은 그 단계에서 구현해야 합니다. NAS 주소나 인증 키를 클라이언트에 직접 넣지 마세요.
