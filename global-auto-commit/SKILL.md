---
name: global-auto-commit
description: 범용 git 커밋 및 선택적 푸시 워크플로우. 사용자가 "커밋해", "커밋하고 푸시해", "자동 커밋", "push까지 해줘"처럼 현재 저장소 변경사항을 커밋하거나 원격에 푸시하라고 요청할 때 사용한다. 변경사항을 점검하고 저장소 컨벤션에 맞는 커밋 메시지를 작성한 뒤 관련 파일만 stage/commit한다.
---

# Global Auto Commit

## 목적

현재 저장소의 변경사항을 점검하고 저장소 규칙에 맞는 커밋 메시지로 커밋한다. 사용자가 명시적으로 push까지 요청한 경우에만 현재 브랜치를 원격에 push한다.

## 커밋 메시지 규칙

저장소에 커밋 컨벤션이 있으면 그 규칙을 우선한다.

확인할 수 있는 컨벤션 예:

- `AGENTS.md`
- `CONTRIBUTING.md`
- `.github/CONTRIBUTING.md`
- `README.md`
- 최근 커밋 메시지: `git log --oneline -n 20`

저장소 컨벤션이 없으면 아래 Conventional Commits 형식을 기본으로 사용한다.

```text
type: concise summary
```

최종 커밋 메시지는 기본적으로 한 줄 제목만 사용한다.

```text
<type>: <summary>
```

이슈 번호는 사용자가 명시적으로 요구했거나 저장소의 최근 커밋 관례가 확실할 때만 포함한다. 확실한 근거 없이 브랜치명이나 이슈 번호를 커밋 제목 앞에 붙이지 않는다.

금지되는 기본 형식:

```text
[#11] 커밋내용
#11 커밋내용
issue #11 커밋내용
feat/#11 커밋내용
```

사용자가 한국어로 요청했거나 저장소 커밋이 한국어 중심이면 summary는 한국어로 쓴다. 저장소가 영어 중심이면 영어로 쓴다.

기본 타입:

- `feat`: 새 기능, 새 화면, 사용자에게 보이는 기능 추가
- `fix`: 버그 수정, 깨진 동작 복구, 배포 후 문제 해결
- `refactor`: 동작 변경 없이 코드 구조 개선
- `docs`: 문서, AGENTS.md, README 성격의 변경만 있는 경우
- `test`: 테스트 추가/수정
- `chore`: 정리 작업, 로컬 설정, 스크립트 변경, 기타 운영성 변경
- `ci`: 배포/자동화/파이프라인/검증 스크립트 변경
- `build`: 빌드 시스템, 패키지 매니저, 의존성 변경
- `style`: 포맷팅, lint 수정처럼 동작 변경이 없는 스타일 변경

예:

```text
docs: Codex 작업 규칙 정리
feat: 로그인 화면 추가
fix: 결제 중복 요청 문제 해결
refactor: 인증 상태 관리 분리
fix: resolve duplicate request submission
refactor: split authentication state handling
```

나쁜 예:

```text
[#11] 로그인 화면 추가
#11 fix payment issue
feature/#15 인증 상태 관리 분리
커밋내용 수정
```

이슈를 커밋에 남겨야 할 때는 저장소 관례가 있는 경우에만 summary 뒤쪽에 자연스럽게 붙인다.

```text
fix: 결제 중복 요청 문제 해결 (#11)
```

## 워크플로우

1. `git status --short`로 전체 변경사항을 확인한다.
2. `git diff --stat`, `git diff --name-status`, 필요한 파일별 diff를 읽어 변경 의도를 파악한다.
3. untracked 파일이 있으면 포함해야 하는 파일인지 확인하고, 생성물/로그/비밀 파일은 제외한다.
4. 커밋 대상에 금지 파일이 섞였는지 확인한다.
5. 변경사항이 서로 무관하게 섞여 있으면 하나의 커밋으로 묶지 말고 사용자에게 분리 기준을 확인한다.
6. 변경 성격에 맞춰 타입과 커밋 메시지를 만든다.
7. 관련 파일만 `git add <path>`로 stage한다. `git add .`는 사용하지 않는다.
8. `git diff --cached --stat`과 필요하면 `git diff --cached --name-status`로 stage 결과를 다시 확인한다.
9. `git commit -m "<message>"`를 실행한다.
10. 사용자가 push를 명시한 경우에만 현재 브랜치를 확인한 뒤 `git push`를 실행한다.
11. 최종 응답에 커밋 해시, 메시지, push 여부를 짧게 보고한다.

## 커밋 금지 대상

아래 파일은 사용자가 별도로 승인하지 않는 한 stage하지 않는다.

- `.env`, `*.env`, `*.local`, `*.secret`
- 인증키, API 키, 서버 접속 정보, 서비스 계정 JSON, 토큰, 비밀번호가 포함된 파일
- 개인 정보, 고객 데이터, 프로덕션 데이터 덤프
- `.codex/logs/*.jsonl`, 대화 로그, 자동화 로그 원문
- `.DS_Store`, OS/IDE 임시 파일
- 빌드 산출물과 캐시 디렉터리
  - 예: `dist/`, `build/`, `.next/`, `.turbo/`, `.cache/`, `DerivedData/`, `.build/`, `node_modules/`
- 패키지 매니저나 프로젝트 도구가 자동 생성한 파일 중 의도하지 않은 변경
- 모바일/데스크톱 배포 산출물
  - 예: `*.ipa`, `*.apk`, `*.aab`, `*.dSYM`, `*.dSYM.zip`
- 플랫폼별 민감 설정 파일
  - 예: `GoogleService-Info.plist`, `google-services.json`, `*.xcconfig`

금지 대상이 변경사항에 보이면 커밋하지 말고 사용자에게 알려야 한다.

## Stage 기준

- 커밋 의도와 직접 관련된 파일만 stage한다.
- 서로 다른 목적의 변경이 섞여 있으면 커밋을 나누는 방향을 제안한다.
- lockfile 변경은 의존성 변경과 함께 있을 때만 포함한다. 원인을 설명할 수 없으면 확인한다.
- 포맷팅 대량 변경이 기능 변경과 섞여 있으면 분리 커밋을 제안한다.
- 삭제 파일은 의도된 삭제인지 diff와 문맥으로 확인한 뒤 stage한다.

## Push 규칙

- 사용자가 "push", "푸시", "올려", "원격에 올려"처럼 명시한 경우에만 push한다.
- push 전 `git branch --show-current`로 현재 브랜치를 확인한다.
- 기본 브랜치에 직접 push하려는 상황이면 중단하고 사용자에게 확인한다.
- 원격 브랜치가 없어서 push가 실패하면 `git push -u origin <branch>` 실행 가능 여부를 사용자에게 확인한다.
- push 실패 시 무리하게 재시도하지 말고 에러 요지를 보고한다.

## 최종 응답

커밋했다면 아래를 보고한다.

- 커밋 해시
- 커밋 메시지
- stage한 주요 파일
- push 여부

커밋하지 않았다면 중단 이유와 필요한 다음 조치를 보고한다.
