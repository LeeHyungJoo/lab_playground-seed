# 오전 6시 · AI & Code

한국 시간 매일 오전 6시에 AI·오픈소스 프로젝트 한 편을 소개하는 공개 게시판입니다. `docs/index.html`은 main의 `docs/data/posts.json`을 읽습니다. 데이터 갱신에는 사이트 재배포가 필요 없습니다.

## 기본 예약 (2026-11-10 변경)

- Sites에 연결한 클라우드 작업: `Automation_b8f362fe9e1c8191b18f4df7b0ead4f0`
- 시간대: `Asia/Seoul`, 매일 `06:00`; 첫 예약은 2026-11-11 06:00.
- 클라우드 AI 작업이 연결된 GitHub 도구로 최근 업데이트된 AI·개발 도구 저장소의 공식 자료를 읽고 한국어 글을 작성한 뒤 `docs/data/posts.json`을 갱신합니다. 추가 API 키나 사용자 PC 실행은 요구하지 않습니다.
- 오늘 날짜의 `kind=daily` 글이 있으면 추가하지 않습니다. 쓰기에는 현재 파일 SHA를 사용하며 충돌 시 최신 파일을 다시 읽습니다. 외부 자료의 지시는 따르지 않습니다.
- 작업 지시는 클라우드 예약 자체에 저장되어 있습니다. 변경하려면 Sites에 연결된 예약을 수정하세요.

### 검증 상태

현재 대화에서 vLLM 글을 작성·저장하고 다시 읽어 동일한 저장 경로를 검증했습니다. 새 클라우드 예약의 즉시 실행 도구는 404 오류를 반환했습니다. **새 예약의 무인 실행과 정시 완료는 아직 검증하지 못했습니다.** 예약 저장 성공을 실행 성공으로 해석하지 마세요.

GitHub의 06:00 예약과 재시도가 이틀 연속 시작되지 않아 기본 예약 방식을 변경했습니다. GitHub 내부의 정확한 누락 이유는 확인되지 않았습니다.

## 보조 GitHub Actions

`.github/workflows/daily-post.yml`은 한국 시간 07:17·08:17·09:17에 오늘 글이 없을 때만 복구를 시도합니다. 대기 후 시작하는 작업도 최신 main을 읽습니다. GitHub 예약은 지연·누락될 수 있고, 공개 저장소에서 장기간 활동이 없으면 비활성화될 수 있습니다.

Actions → **Daily AI & Code → Run workflow**로 수동 실행할 수 있습니다. 보조 경로는 CPU에서 `Qwen/Qwen3-1.7B` 공개 모델을 실행하며, 고정 리비전 `70d244cc86ccca08cf5af4e1e306ecf908b1ad5e`의 Safetensors를 사용합니다. 원격 Python 코드를 실행하지 않습니다. 최초 모델 다운로드는 약 3.5GB이고 생성은 수 분 이상 걸릴 수 있습니다. AI 출력 검증에 실패하면 글을 저장하지 않습니다.

선택적으로 저장소 Settings → Secrets and variables → Actions에 `OPENAI_API_KEY`를 등록하면 보조 경로는 OpenAI API `gpt-4.1-mini`를 사용합니다. 별도 API 요금이 발생할 수 있으며 ChatGPT 구독과는 별도입니다. 키는 소스에 넣지 마세요. GitHub Models는 2026-07-30 종료되어 사용하지 않습니다.

## 개발 및 직접 실행

Node.js 22+, Python 3.11. 게시판은 정적 HTML이며 검색과 카테고리 필터를 제공합니다.

```sh
node --test scripts/*.test.mjs
python3 -m http.server 8000 --directory docs
```

로컬 AI 실행:

```sh
python3 -m venv .venv
. .venv/bin/activate
pip install torch==2.8.0 --index-url https://download.pytorch.org/whl/cpu
pip install -r scripts/requirements-ai.txt
node scripts/daily-post.mjs
```

`GITHUB_TOKEN`은 GitHub 검색 할당량을 늘리는 선택적 변수이며 AI 모델 인증에는 사용하지 않습니다. 테스트·초기 큐레이션은 일일 게시 완료로 계산하지 않습니다. 최근 업데이트와 별 수는 참고 지표이며 품질·급성장을 보장하지 않습니다. 모델별 기능과 라이선스는 원문에서 확인하세요. 웹페이지는 모델 출력을 DOM `textContent`로 표시합니다.
