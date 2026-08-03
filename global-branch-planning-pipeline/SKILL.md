---
name: global-branch-planning-pipeline
description: 범용 구현 오케스트레이션 워크플로우. 사용자가 계획만이 아니라 이슈 생성, 이슈 기반 브랜치 생성, 현재 변경사항을 올바른 브랜치로 옮기기, 구현 진행, 마지막 PR 생성까지 한 흐름으로 다뤄야 할 때 사용한다. 특히 기본 브랜치에서 바로 작업해버렸거나, 구현 전에 issue/branch bootstrap이 필요한 경우에 적합하다.
---

# Global Branch Planning Pipeline

## 목적

구현 전에 방향을 정리하는 것에서 끝나지 않고, 저장소 규칙에 맞는 `issue -> branch -> implement -> commit -> PR` 흐름으로 작업을 안전하게 진입시키는 범용 스킬이다.

이 스킬은 "계획 전용"이 아니다. 대신 현재 git 상태와 저장소 규칙을 먼저 읽고, 언제 이슈를 만들고 언제 브랜치를 만들고 언제 PR 단계로 넘길지 오케스트레이션한다.

## 사용할 때

아래와 같은 요청에 사용한다.

- "이 작업 계획 세우고 브랜치까지 잡아줘"
- "main에서 작업했는데 이슈/브랜치 정리해서 이어서 해줘"
- "구현 전에 이슈부터 파고 브랜치 만들어줘"
- "이 변경을 이슈 기준 브랜치로 옮겨서 진행해줘"
- "작업 시작부터 PR 직전/PR 생성까지 흐름 맞춰줘"

아래 경우에는 이 스킬보다 다른 스킬이 더 적합할 수 있다.

- 계획과 리스크 검토만 필요함: `global-planning-pipeline`
- 이슈만 작성/생성하면 됨: `global-auto-issue`
- 커밋만 하면 됨: `global-auto-commit`
- PR만 만들면 됨: `global-auto-pr`

## 핵심 원칙

1. 먼저 현재 저장소 규칙을 읽는다.
2. 작업 시작 전에는 기본적으로 `git pull origin main`을 먼저 실행해 최신 상태로 맞춘다.
3. 기본 브랜치에서의 직접 작업은 가능한 빨리 issue 기반 브랜치로 구조화한다.
4. 저장소의 명시적 규칙이 없으면 브랜치명을 반드시 `<type>/#<issue-number>` 형식으로 만든다.
5. 모든 PR은 관련 GitHub Issue 하나와 연결하고, 제목을 `[#<issue-number>] <issue-title>` 형식으로 고정한다.
6. 사용자가 명시적으로 요청한 원격 write만 수행한다.
7. 계획, 이슈, 브랜치, 커밋, PR을 한 번에 섞지 말고 현재 상태에 맞는 다음 단계만 진행한다.

## 사전 점검

실행 초반에 가능한 범위에서 아래를 확인한다.

1. `AGENTS.md`와 상위/하위 적용 지침
2. `README.md`, `CONTRIBUTING.md`, `.github/*` 안의 이슈/브랜치/PR 규칙
3. 작업 시작 전에 `git pull origin main`으로 최신화할 수 있는 상태인지 여부
4. 기본 브랜치와 현재 브랜치
5. working tree가 깨끗한지 여부
6. 이미 연결된 이슈나 기존 open PR이 있는지 여부

최소 확인 항목 예:

```bash
git pull origin main
git branch --show-current
git status --short
git remote -v
gh auth status
gh repo view --json defaultBranchRef,nameWithOwner,url
```

working tree가 dirty해서 `git pull origin main`이 안전하지 않다면, 무리하게 pull을 밀어붙이지 말고 현재 변경 상태를 먼저 설명한 뒤 적절한 구조화 또는 정리 단계로 들어간다.

## 워크플로우 결정 트리

### 1. 현재 요청의 목표를 분류한다

먼저 사용자의 의도를 아래 중 하나로 분류한다.

- 계획 + 구현 시작
- 구현 계속 진행
- 이슈/브랜치 구조화
- 커밋 요청
- PR 요청

사용자가 "PR 올려줘"처럼 후반 단계만 요청했다면 앞단계를 다시 강제로 반복하지 않는다. 다만 PR 생성이 unsafe한 상태면 필요한 직전 단계로 되돌린다.

### 2. 저장소 규칙을 읽고 branch naming 전략을 정한다

브랜치명 규칙 우선순위:

1. `.github/issue-branch.yml`
2. `AGENTS.md`, `CONTRIBUTING.md`, 저장소 문서
3. 관례가 보이는 기존 브랜치명
4. fallback 규칙

fallback은 아래를 기본값으로 사용한다.

```text
<type>/#<issue-number>
```

예:

- `feat/#42`
- `fix/#18`
- `docs/#7`

fallback에서는 `#`을 생략하거나 issue 번호 뒤에 slug를 붙이지 않는다. 브랜치를 만들기 전에 Issue를 먼저 생성하거나 기존 Issue를 확정해 번호를 확보한다. 저장소가 `feature/#42`, `feat/42-short-slug`처럼 다른 형식을 명시적으로 요구할 때만 저장소 규칙을 우선한다.

### 2.1 Issue/PR 템플릿을 결정한다

템플릿 우선순위:

1. 저장소의 `.github` Issue/PR 템플릿
2. `CONTRIBUTING.md`, `AGENTS.md` 등에서 명시한 본문 형식
3. 이 스킬의 기본 템플릿

저장소에 해당 템플릿이 없으면 임의 형식을 새로 만들지 말고 아래 기본 템플릿을 사용한다. 사용자에게 받은 사실에 맞게 각 섹션을 채우고, 확인하지 않은 내용을 지어내지 않는다.

기본 Issue 템플릿:

```markdown
## Summary

## Background / Problem

## Proposed Work

## Acceptance Criteria

- [ ] 완료 조건을 작성한다.

## Notes
```

기본 PR 템플릿:

```markdown
## Summary

## Changes

## Testing

## Related Issues

Closes #<issue-number>

## Notes
```

Issue와 PR 본문은 shell inline 문자열로 전달하지 말고 임시 body file로 만든다. 저장소 템플릿을 사용했는지, 스킬 기본 템플릿을 사용했는지 최종 결과에서 구분해 보고한다.

### 3. 현재 git 상태에 따라 분기한다

#### 케이스 A. 기본 브랜치이고 변경사항이 이미 있다

이 케이스는 "main에서 작업해버림" 구조다.

처리 순서:

1. 사용자의 작업 의도가 구현인지 확인한다.
2. 관련 open issue가 있으면 재사용하고, 없으면 새 issue를 만든다.
3. issue 번호 기반 브랜치를 만든다.
4. 현재 변경사항은 버리지 말고 새 브랜치 위에서 그대로 이어간다.
5. 이후 구현, 검증, 커밋은 새 브랜치에서 진행한다.

이 상황에서는 issue/branch rescue가 목적이므로, 사용자가 구현을 요청한 맥락이면 별도 장황한 확인 없이 진행해도 된다.

#### 케이스 B. 기본 브랜치이고 변경사항이 없다

이 케이스는 "아직 시작 전" 상태다.

처리 순서:

1. 바로 원격 write 하지 않는다.
2. `이슈를 생성할까요?`처럼 짧고 명시적인 확인을 요청한다.
3. 사용자가 수락하면 issue를 생성한다.
4. issue 번호 기반 브랜치를 만든다.
5. 그 브랜치에서 구현을 시작한다.

기본 브랜치가 깨끗할 때는 사용자가 실제로 원격 write를 원하는지 확인하는 것이 기본값이다.

#### 케이스 C. 이미 issue 기반 브랜치에 있다

예:

- `feat/#42`
- `fix/#18`

처리 순서:

1. 새 issue나 새 브랜치를 만들지 않는다.
2. 현재 브랜치가 저장소 규칙에 맞는지 확인한다.
3. 맞으면 그대로 구현을 이어간다.
4. PR 요청이 들어오기 전까지는 PR 단계를 당기지 않는다.

#### 케이스 D. feature branch이지만 issue 기반 규칙이 아니다

예:

- `feature/login-page`
- `work/refactor-auth`

처리 순서:

1. 저장소가 issue-first인지 확인한다.
2. issue-first 저장소면 기존 브랜치를 유지할지, issue를 만든 뒤 issue 기반 브랜치로 옮길지 판단한다.
3. 판단 근거가 애매하면 사용자에게 짧게 확인한다.

이때는 자동 rename보다 "새 issue branch 생성 후 변경사항을 옮기는 방식"이 더 안전하다.

### 4. 구현과 커밋 단계

이 스킬은 구현을 실제로 진행할 수 있고, 커밋 단계에 들어가면 저장소 규칙을 우선 적용하되 규칙이 없을 때 사용할 fallback도 함께 제공한다.

커밋 단계에 들어가면 가능하면 아래 규칙을 따른다.

- 저장소의 커밋 규칙 우선
- 없으면 `global-auto-commit`의 기준을 따른다
- 금지 파일, 비밀 파일, 생성 로그, 빌드 산출물은 stage하지 않는다

사용자가 커밋을 요청하지 않았다면, 구현 후 자동 커밋까지 밀어붙이지 않는다. 다만 저장소 규칙상 PR 전 커밋이 당연히 필요하므로 PR 요청이 들어오면 필요한 최소 커밋 단계로 이어진다.

## 커밋 규칙

이 스킬은 `issue -> branch -> commit -> PR` 흐름을 조율할 때 커밋 메시지 일관성도 함께 유지한다.

커밋 메시지 우선순위:

1. 저장소의 명시적 커밋 규칙
2. `AGENTS.md`, `CONTRIBUTING.md`, `README.md`의 커밋 관례
3. 최근 커밋 로그에서 확인되는 관례
4. fallback 규칙

fallback 규칙은 아래 Conventional Commits 형식을 기본으로 사용한다.

```text
<type>: <summary>
```

기본 타입:

- `feat`: 새 기능, 새 플로우, 사용자 가치가 늘어나는 변경
- `fix`: 버그 수정, 깨진 동작 복구, 회귀 해결
- `refactor`: 동작 변경 없이 구조만 개선
- `docs`: 문서 수정만 있는 변경
- `test`: 테스트 추가/수정
- `chore`: 운영성 변경, 스크립트, 설정, 정리 작업
- `ci`: CI/CD, 워크플로우, 자동화 파이프라인 변경
- `build`: 빌드 시스템, 의존성, 패키지 매니저 변경
- `style`: 포맷팅, lint 정리처럼 동작 영향이 없는 변경

기본 규칙:

- 최종 커밋 메시지는 기본적으로 한 줄 제목만 사용한다.
- 커밋 제목 앞에 issue 번호를 기계적으로 붙이지 않는다.
- issue 번호를 넣어야 한다면 저장소 관례가 분명할 때만 summary 뒤에 `(#<issue-number>)` 형태로 붙인다.
- 브랜치명과 issue 제목은 참고하되, 커밋 메시지는 실제 코드 변경 단위를 설명해야 한다.
- 서로 다른 목적의 변경이 섞여 있으면 한 커밋으로 뭉개지 않는다.

금지되는 기본 형식:

```text
[#11] 로그인 화면 수정
#11 fix payment issue
issue #11 authentication cleanup
feat/#15 인증 상태 관리 분리
```

### 5. PR 단계

PR은 사용자가 명시적으로 요청했을 때만 생성한다.

PR 요청 시 처리 순서:

1. working tree에 커밋되지 않은 변경이 있으면 바로 PR을 만들지 않는다.
2. 필요한 경우 먼저 커밋 단계로 진행한다.
3. 현재 브랜치가 기본 브랜치면 PR 생성을 중단하고 issue branch 구조화부터 진행한다.
4. 이미 같은 head branch의 open PR이 있으면 새 PR을 만들지 않는다.
5. 관련 issue를 찾는다. 없으면 PR을 만들지 않고 issue 생성 승인을 받은 뒤 issue부터 만든다.
6. 기존 open PR에 관련 issue가 없으면 issue 생성 승인 후 제목과 본문을 보정한다.
7. 저장소 PR 템플릿이 없으면 이 스킬의 기본 PR 템플릿으로 본문을 작성한다.

PR 제목은 예외 없이 아래 형식을 사용한다.

```text
[#<issue-number>] <issue-title>
```

`<issue-title>`에는 issue 제목 앞의 선택적 분류 라벨(예: `[docs]`, `[bug]`)을 넣지 않는다. PR 본문에는 반드시 `Closes #<issue-number>`를 넣어 GitHub에서 issue를 연결한다.

## 커밋/PR 일관성 기준

이 스킬은 아래 정렬을 기본값으로 삼는다.

1. issue 제목은 작업 단위를 설명한다.
2. branch는 issue 번호와 작업 종류를 표현한다.
3. commit은 실제 변경 단위를 설명한다.
4. PR 제목은 반드시 `[#<issue-number>] <issue-title>`로 issue와 다시 연결된다.

즉, branch는 추적용 식별자, commit은 구현 단위, PR은 리뷰 단위로 역할을 나눈다.

## 커밋과 PR 예시

### 예시 1. 저장소가 issue-first + PR 제목에 issue 제목을 쓰는 경우

issue:

```text
세션 타임아웃 복구를 추가한다
```

branch:

```text
fix/#42
```

good commits:

```text
fix: refresh token 만료 처리 복구
test: 세션 타임아웃 회귀 테스트 추가
```

good PR title:

```text
[#42] 세션 타임아웃 복구를 추가한다
```

bad commit:

```text
[#42] 세션 타임아웃 복구를 추가한다
```

설명:
커밋은 issue 제목 복붙이 아니라 실제 변경 단위를 써야 하고, PR 제목이 issue 제목과 연결을 담당한다.

### 예시 2. issue 제목에 분류 라벨이 있는 경우

issue:

```text
[bug] 로그인 후 세션이 즉시 만료되는 문제
```

branch:

```text
fix/#42
```

good commits:

```text
fix: prevent immediate session expiry after login
test: cover login session refresh flow
```

good PR title:

```text
[#42] 로그인 후 세션이 즉시 만료되는 문제
```

설명:
PR은 issue 번호를 앞에 붙이고 issue 제목의 분류 라벨만 제거한다. `[fix] ...`나 `[#42] [bug] ...` 형식은 사용하지 않는다.

### 예시 3. 문서 작업인 경우

issue:

```text
설치 가이드에 로컬 실행 절차를 추가한다
```

branch:

```text
docs/#7
```

good commit:

```text
docs: add local run steps to setup guide
```

good PR title:

```text
[#7] 설치 가이드에 로컬 실행 절차를 추가한다
```

## 이슈 생성 기준

이 스킬은 issue를 자주 만들 수 있지만, 무조건 만들지는 않는다.

아래 순서를 따른다.

1. 기존 open issue 재사용 가능성을 먼저 본다.
2. 명백한 중복 issue가 있으면 새 issue를 만들지 않는다.
3. PR을 만들 작업에 issue가 없으면 사용자 승인을 받아 issue를 먼저 만든다.
4. 기본 브랜치에 변경이 이미 있고 구현을 구조화하는 문맥이면 issue 생성 후 branch rescue를 진행한다.
5. 기본 브랜치가 깨끗하면 사용자 수락 후 issue를 만든다.
6. 이슈 제목/본문/라벨 규칙은 가능하면 `global-auto-issue`의 기준을 따른다.
7. 저장소 Issue 템플릿이 없으면 이 스킬의 기본 Issue 템플릿으로 본문을 작성한다.

## 안전 장치

- `.env`, 인증키, 토큰, 개인 정보, 로그 원문, 빌드 산출물은 issue/commit/PR 어느 단계에서도 기본 입력으로 사용하지 않는다.
- `main` 또는 기본 브랜치에 직접 커밋하거나 직접 PR 소스로 사용하지 않는다.
- 관련 issue가 없는 PR을 생성하거나 유지하지 않는다.
- 사용자가 원하지 않은 merge, follow-up remote write, reviewer 지정, assignee 지정은 자동으로 하지 않는다.
- 저장소 규칙과 현재 상태가 충돌하면, 파일을 건드리기 전에 그 충돌을 먼저 설명한다.

## 응답 방식

상태 기반으로 다음 단계만 짧게 안내한다.

예:

- "현재 `main`에서 변경이 있으니 issue를 만들고 issue branch로 옮겨서 계속 진행하겠습니다."
- "현재 기본 브랜치가 깨끗합니다. issue를 먼저 생성할까요?"
- "이미 issue 기반 브랜치에 있으니 그대로 구현을 이어가겠습니다."
- "PR에 연결된 issue가 없으니 issue를 만든 뒤 제목을 `[#이슈번호] 제목`으로 맞추겠습니다."
- "PR 요청이지만 uncommitted 변경이 있어 먼저 커밋 단계를 정리해야 합니다."

## 하지 말아야 할 일

- 계획 전용 요청인데 이슈나 브랜치를 멋대로 만들지 않는다.
- 기본 브랜치가 깨끗한데 사용자 확인 없이 issue를 바로 만들지 않는다.
- 저장소 규칙을 읽지 않고 브랜치명 패턴을 단정하지 않는다.
- 저장소 규칙이 없는데 `feat/42-slug`, `codex/feat/42-slug`처럼 `#` 없는 fallback 브랜치를 만들지 않는다.
- dirty working tree 상태에서 검토 없이 PR부터 만들지 않는다.
- issue 번호 없이 `[type] 작업 요약` 또는 `[#이슈번호] [type] 작업 요약` 형식의 PR 제목을 쓰지 않는다.
- 기존 global issue/commit/PR 규칙과 어긋나는 독자 포맷을 새로 만들지 않는다.
