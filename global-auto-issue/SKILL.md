---
name: global-auto-issue
description: 범용 GitHub Issue 자동 작성 및 게시 워크플로우. 사용자가 "이슈 만들어줘", "깃허브 이슈 올려줘", "문제 상황으로 issue 생성해줘", "버그 이슈 등록해줘", "기능 요청 이슈 만들어줘"처럼 설명한 문제상황을 바탕으로 저장소에 GitHub Issue를 생성하라고 요청할 때 사용한다. 저장소의 이슈 템플릿, 라벨, 기존 이슈 문체, 사용자 설명을 반영해 `gh issue create`로 이슈를 생성한다.
---

# Global Auto Issue

## 목적

사용자가 설명한 문제상황, 버그, 개선 제안, 기능 요청을 현재 GitHub 저장소의 이슈 템플릿과 문체에 맞게 정리하고 GitHub Issue로 게시한다.

실제 이슈 생성은 사용자가 이슈 생성/게시를 명시한 경우에만 수행한다. 사용자가 "본문만 작성해", "초안만 만들어줘", "이슈 내용만 정리해줘"처럼 요청하면 `gh issue create`를 실행하지 않는다.

## 참고 파일

이슈 작성 전에 가능한 범위에서 아래 파일을 읽는다.

1. 저장소의 이슈 템플릿
   - `.github/ISSUE_TEMPLATE.md`
   - `.github/issue_template.md`
   - `.github/ISSUE_TEMPLATE/*.md`
   - `.github/ISSUE_TEMPLATE/*.yml`
   - `.github/ISSUE_TEMPLATE/*.yaml`
2. `references/issue-writing-style.md`
3. 저장소에 있는 이슈/기여/운영 규칙
   - 예: `AGENTS.md`, `CONTRIBUTING.md`, `.github/CONTRIBUTING.md`, `README.md`

템플릿이나 규칙 파일이 없으면 파일을 생성하지 말고, 현재 확인 가능한 정보로 일반적인 이슈 본문을 작성한다.

## 사전 점검

아래 순서로 확인한다.

1. 사용자 요청에서 이슈의 목적을 분류한다.
   - bug, feature, enhancement, refactor, docs, chore, question 중 가장 가까운 유형
2. `git remote -v`와 `gh auth status`로 GitHub remote와 인증 상태를 확인한다.
3. `gh repo view --json nameWithOwner,url,hasIssuesEnabled`로 저장소와 Issues 활성화 여부를 확인한다.
4. 저장소의 이슈 템플릿과 작성 규칙을 확인한다.
5. `gh label list --limit 100`로 사용 가능한 라벨을 확인한다.
6. 제목 후보를 만들고, 중복 이슈를 검색한다.

중복 확인 예:

```bash
gh issue list --state open --search "<keyword> in:title" --json number,title,url,state,labels
```

명백한 중복 이슈가 있으면 새 이슈를 만들지 말고 기존 이슈 URL을 보고한다. 사용자가 "그래도 새로 만들어"라고 명시한 경우에만 새 이슈 생성을 검토한다.

## 정보 수집

이슈 제목과 본문을 만들 때 아래 정보를 사용한다.

- 사용자 설명의 문제상황
- 에러 메시지, 경고 문구, 재현 경로
- 기대 동작과 실제 동작
- 영향 범위와 우선순위
- 관련 파일, 화면, 모듈, 명령어
- 사용자가 제공한 로그/스크린샷/환경 정보
- 현재 저장소의 관련 코드나 문서

민감 정보가 포함될 수 있는 파일이나 로그 원문은 기본 입력으로 사용하지 않는다. 사용자가 명시적으로 참고를 요청한 경우에도 필요한 범위에서 요약 정보만 사용하고 이슈 본문에 비밀값, 토큰, 개인정보를 붙이지 않는다.

## 제목 작성

제목 우선순위:

1. 사용자가 이슈 제목을 명시하면 그 제목을 사용한다.
2. 저장소 이슈 템플릿이나 기존 이슈의 제목 관례가 확실하면 그 관례를 따른다.
3. 관례가 없으면 문제의 핵심이 드러나는 짧은 제목을 직접 작성한다.

기본 형식:

```text
[type] 문제 또는 요청 요약
```

type 예시:

- `bug`: 깨진 동작, 에러, 크래시, 회귀
- `feature`: 새 기능 요청
- `enhancement`: 기존 기능 개선
- `refactor`: 구조 개선 제안
- `docs`: 문서 개선
- `chore`: 설정, 자동화, 운영 작업
- `question`: 확인이 필요한 질문

좋은 예:

```text
[bug] 로그인 후 세션이 즉시 만료되는 문제
[feature] 관리자 알림 필터를 추가한다
[enhancement] 검색 결과 빈 상태 안내를 개선한다
[docs] 배포 체크리스트에 롤백 절차를 추가한다
```

## 본문 작성

저장소의 이슈 템플릿이 있으면 템플릿의 섹션과 순서를 유지한다. 템플릿이 없으면 아래 구성을 기본으로 사용한다.

```text
## Summary

## Problem

## Steps to Reproduce

## Expected Behavior

## Actual Behavior

## Scope / Impact

## Notes
```

작성 규칙:

- 템플릿의 안내용 HTML 주석은 제거해도 된다.
- 사용자가 제공하지 않은 정보는 지어내지 않는다.
- 모르는 항목은 `Unknown`, `Not provided`, `추가 확인 필요`처럼 표시한다.
- 파일명, 모듈명, 화면명, 명령어는 backtick으로 감싼다.
- 버그 이슈는 재현 단계, 기대 동작, 실제 동작을 우선 정리한다.
- 기능 요청은 배경, 사용자 가치, 수용 기준을 우선 정리한다.
- 개선/리팩터링 이슈는 현재 문제, 제안 방향, 영향 범위를 우선 정리한다.
- 로그나 에러 메시지는 필요한 짧은 부분만 포함한다. 비밀값은 제거한다.

## 라벨

라벨은 저장소의 기존 라벨을 먼저 확인해 실제 존재하는 것만 사용한다.

권장 매핑:

- bug/error/crash/regression -> `bug`, `fix`
- feature/request/new flow -> `feature`, `enhancement`
- docs/readme/guide -> `docs`, `documentation`
- refactor/architecture/cleanup -> `refactor`, `cleanup`
- ci/build/release -> `ci`, `build`, `chore`
- question/investigation -> `question`, `needs triage`

담당자 지정은 하지 않는다.

- 이슈 생성 시 `--assignee`, `--assign`, `--assignee @me` 옵션을 사용하지 않는다.
- 사용자가 assignee 지정을 요청해도 기본적으로 "담당자는 개발자가 이슈 생성 후 직접 지정한다"는 흐름을 안내한다.
- 라벨 권한 문제로 실패하면 이슈 생성 자체를 반복하지 말고 실패 이유를 보고한다.

## 게시 절차

이슈 본문은 shell inline 문자열보다 임시 body file로 전달한다.

1. 제목과 본문을 짧게 요약하되, 사용자가 이미 이슈 생성을 요청했다면 별도 승인 대기 없이 계속 진행한다.
2. 이슈 본문을 임시 파일에 작성한다.
3. 아래 형식으로 이슈를 생성한다.

```bash
gh issue create \
  --title "<title>" \
  --body-file <body-file>
```

4. 라벨 옵션은 실제 존재하고 적용 가능할 때만 붙인다.
5. assignee 옵션은 붙이지 않는다. 담당자는 개발자가 GitHub에서 직접 지정한다.
6. 이슈 생성 후 URL을 보고한다.

## 실패와 중단 기준

아래 상황에서는 이슈를 생성하지 않는다.

- `gh auth status`가 실패한다.
- GitHub remote 또는 저장소를 확인할 수 없다.
- 저장소에서 Issues가 비활성화되어 있다.
- 명백한 중복 open issue가 있다.
- 사용자 설명만으로 제목/본문을 만들 수 없을 정도로 핵심 정보가 부족하다.
- 이슈 본문에 비밀값, 토큰, 개인정보가 포함될 위험이 있다.

중단 시에는 무엇이 막혔는지와 필요한 다음 사용자 입력을 짧게 제시한다.

## 최종 응답

이슈를 생성했다면 아래를 보고한다.

- Issue URL
- 제목
- 저장소
- 라벨 적용 여부
- assignee 미지정 여부
- 중복 확인 요약

이슈를 생성하지 않았다면 중단 이유와 필요한 다음 조치를 보고한다.
