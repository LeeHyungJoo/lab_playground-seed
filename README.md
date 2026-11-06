# AI Engineering Daily

AI 개발 실전 활용 사례를 **매일 오전 6시(KST)** 수집·요약하고 GitHub Pages에 자동 게시하는 정적 웹사이트입니다.

**기능:** 최신 브리핑, 날짜별 아카이브, 현재 페이지의 키워드 검색, 카테고리 필터, RSS, 모바일 반응형 UI.

## 1. 로컬에서 실행

요구 환경: Node.js 22+, Python 3.12+.

```bash
npm install
npm run dev
```

`http://localhost:4321/` 에서 확인합니다. 초기 `posts.json`은 비어 있으므로 첫 화면에 준비 중 상태가 표시됩니다.

브리핑 수집 테스트:

```bash
python -m pip install -r requirements.txt
python scripts/generate.py --dry-run
```

실제 생성:

```bash
export OPENAI_API_KEY='YOUR_API_KEY'  # Windows PowerShell: $env:OPENAI_API_KEY='...'
python scripts/generate.py
npm run build
```

OpenAI API 사용료가 별도로 발생합니다. ChatGPT 구독과 API 요금은 별개입니다.

## 2. GitHub Pages에 게시

1. GitHub에서 **공개 저장소** `ai-engineering-daily`를 만듭니다. ZIP을 풀고 **숨김 폴더 `.github`까지 포함한 모든 파일**을 저장소 루트에 업로드하거나 `git push`합니다.
2. 첫 설치 시 `npm install`을 실행합니다. 재현 가능한 빌드를 위해 생성된 `package-lock.json`도 커밋하는 것을 권장합니다.
3. 저장소 **Settings → Pages → Build and deployment → Source: GitHub Actions**를 선택합니다.
4. **Settings → Secrets and variables → Actions → Secrets**에서 `OPENAI_API_KEY`를 추가합니다.
5. 같은 화면의 **Variables**에서 `SITE_URL`을 설정합니다. 예: `https://YOUR_USERNAME.github.io/ai-engineering-daily/` (저장소 이름을 바꾸면 경로도 바꿉니다). 사용자 도메인이라면 `https://news.example.com/`처럼 입력합니다.
6. **Settings → Actions → General → Workflow permissions**에서 GitHub Actions의 저장소 콘텐츠 쓰기 권한을 허용합니다. 조직 정책에 따라 제한될 수 있습니다.
7. **Actions → Generate and deploy AI briefing → Run workflow**로 수동 실행하여 결과를 확인합니다.
8. 정상 배포 후 `https://YOUR_USERNAME.github.io/ai-engineering-daily/`에 접속합니다.

> GitHub Actions의 `schedule`은 **기본 브랜치에서만** 실행됩니다. 예약 시각은 06:00 KST이지만 실행 지연 또는 드문 누락이 발생할 수 있습니다. Actions가 장기간 비활성화된 공개 저장소에서 자동 비활성화되는 경우도 확인하세요.

## 3. 데이터 및 동작

- `scripts/generate.py`는 RSS 제목/요약/날짜를 수집합니다. **기사 전체 본문은 읽지 않습니다.**
- 최근 7일 내의 게시물 중 기존 아카이브에 없는 링크만 후보로 보냅니다.
- OpenAI Responses API에서 3~5개를 선별하고 한국어 요약/실무 적용 아이디어를 생성합니다.
- 모델이 반환한 URL은 반드시 수집한 URL과 일치해야 게시합니다. 제목/출처/발행일은 원본 RSS에서 가져옵니다.
- 게시물은 `src/data/posts.json`에 날짜별로 저장됩니다. 동일 날짜 재실행은 중복 발행하지 않습니다.
- 새 기사가 없으면 기존 페이지를 그대로 배포합니다. RSS 장애 시 해당 피드는 건너뜁니다.
- 생성된 JSON은 GitHub Actions가 저장소에 자동 커밋하므로 배포 기록이 남습니다.
- 검색과 카테고리 필터는 **현재 열려 있는 브리핑 페이지 안에서** 작동합니다. 전체 날짜를 통합 검색하는 기능은 포함되지 않습니다.
- RSS 주소는 `/ai-engineering-daily/rss.xml` (또는 설정한 사이트 base 경로)입니다.

## 4. 수정할 곳

| 목적 | 파일 |
| --- | --- |
| RSS 소스 추가/제거 | `scripts/generate.py`의 `FEEDS` |
| AI 선별 기준 변경 | `scripts/generate.py`의 `instructions` |
| 카테고리 수정 | `scripts/generate.py`의 `CATEGORIES` 및 `src/data/site.ts` |
| 디자인 변경 | `src/styles/global.css` |
| 발송 시각 변경 | `.github/workflows/daily.yml`의 `cron` (UTC 기준) |
| 페이지 URL 변경 | GitHub Actions Variable `SITE_URL` |

## 5. 운영 주의 사항

- 공개 저장소에 API 키를 절대 커밋하지 마세요. Secrets를 사용합니다.
- RSS 제공자의 접근/재배포 정책을 준수하고 원문 링크를 유지하세요.
- 요약은 원문 전체가 아닌 피드 발췌를 근거로 작성하므로 중요한 사실은 원문에서 재확인하세요.
- OpenAI API 오류나 빌드 실패 시 Actions 로그에서 확인하고 수동 재실행할 수 있습니다.
- 공개 저장소에 대한 자동 커밋을 허용하지 않는 브랜치 보호 규칙이 있다면 봇 커밋 단계에서 실패할 수 있습니다.
- 비용 및 품질 관리를 위해 사용량 제한, 추가 소스 검증, 모니터링을 추후 도입할 수 있습니다.
