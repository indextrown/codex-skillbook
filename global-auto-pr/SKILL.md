---
name: global-auto-pr
description: 범용 GitHub Pull Request 자동 작성 및 게시 워크플로우. 사용자가 "PR 올려줘", "pr 생성해", "자동 PR", "풀리퀘 만들어줘", "github pr 올려줘"처럼 현재 브랜치의 커밋과 diff를 바탕으로 PR 제목/본문을 만들고 게시하라고 요청할 때 사용한다. 저장소의 PR 템플릿, git log/diff, 커밋 내용, 관련 이슈, 기존 PR 문체를 반영해 `gh pr create`로 PR을 생성한다.
---

# Global Auto PR

## 목적

현재 저장소의 브랜치, 커밋, 변경사항을 분석해 저장소의 PR 템플릿과 문체에 맞는 PR 제목/본문을 작성하고 GitHub에 게시한다.

실제 PR 게시는 사용자가 PR 생성/게시를 명시한 경우에만 수행한다. 사용자가 "본문만 작성해", "초안만 만들어줘", "PR 메시지만 만들어줘"처럼 요청하면 `gh pr create`를 실행하지 않는다.

## 참고 파일

PR 작성 전에 가능한 범위에서 아래 파일을 읽는다.

1. 저장소의 PR 템플릿
   - `.github/PULL_REQUEST_TEMPLATE.md`
   - `.github/pull_request_template.md`
   - `.github/PULL_REQUEST_TEMPLATE/*.md`
   - `.github/pull_request_template/*.md`
2. `references/pr-writing-style.md`
3. 저장소에 있는 PR/릴리즈/커밋 작성 규칙
   - 예: `AGENTS.md`, `CONTRIBUTING.md`, `.github/CONTRIBUTING.md`, `README.md`

템플릿이나 규칙 파일이 없으면 파일을 생성하지 말고, 현재 확인 가능한 정보로 일반적인 PR 본문을 작성한다.

## 사전 점검

아래 순서로 확인한다.

1. `git status --short`로 working tree 상태를 확인한다.
2. uncommitted 변경이 있으면 PR 생성 전에 중단한다. 사용자가 명시적으로 원하면 먼저 커밋/푸시 워크플로우를 진행하게 안내한다.
3. `.env`, 인증키, 토큰, 비밀번호, 개인 정보, 배포 서명 파일, 생성 로그, 빌드 산출물처럼 PR에 포함되면 위험한 파일이 변경사항에 보이면 PR 생성을 중단하고 사용자에게 보고한다.
4. `git branch --show-current`로 현재 브랜치를 확인한다.
5. 현재 브랜치가 기본 브랜치이면 PR 생성을 중단한다.
6. `git remote -v`와 `gh auth status`로 GitHub remote와 인증 상태를 확인한다.
7. `gh repo view --json defaultBranchRef,nameWithOwner,url`로 기본 브랜치와 저장소를 확인한다.
8. `git fetch origin <base>`로 base 브랜치 정보를 갱신한다.
9. `git log --oneline origin/<base>..HEAD`로 PR에 들어갈 커밋이 있는지 확인한다.
10. `gh pr list --head <current-branch> --state open --json number,title,url`로 중복 PR이 있는지 확인한다.

중복 PR이 있으면 새 PR을 만들지 말고 기존 PR URL을 보고한다. 사용자가 "기존 PR 업데이트"를 명시한 경우에만 `gh pr edit`을 검토한다.

## 분석 명령

PR 제목과 본문을 만들 때 아래 정보를 사용한다.

```bash
git log --oneline origin/<base>..HEAD
git diff --stat origin/<base>...HEAD
git diff --name-status origin/<base>...HEAD
git diff --shortstat origin/<base>...HEAD
```

필요하면 변경 파일을 선별해 `git diff origin/<base>...HEAD -- <path>`로 확인한다.

로그, 대화 기록, 로컬 자동화 산출물은 비밀이나 개인정보가 포함될 수 있으므로 기본 입력으로 사용하지 않는다. 사용자가 명시적으로 참고를 요청한 경우에만 필요한 범위에서 요약 정보만 읽고 PR 본문에 원문을 붙이지 않는다.

## 이슈와 제목 추론

관련 이슈 번호는 아래 순서로 찾는다.

1. 브랜치명에서 `#<number>` 또는 `<prefix>/<number>-...` 형태를 찾는다.
2. 커밋 메시지에서 `#<number>`를 찾는다.
3. 사용자 요청에 포함된 이슈 번호를 사용한다.

이슈 번호를 찾으면 가능하면 이슈 제목을 조회한다.

```bash
gh issue view <issue-number> --json number,title,url,state
```

제목 우선순위:

1. 사용자가 PR 제목을 명시하면 그 제목을 사용한다.
2. 관련 이슈 번호를 찾고 이슈 제목을 가져올 수 있으면, 저장소 관례에 맞게 이슈 제목을 우선 사용한다.
3. 이슈가 없거나 이슈 제목을 가져올 수 없으면 커밋과 diff를 바탕으로 제목을 직접 작성한다.

직접 제목을 작성할 때는 저장소의 기존 PR 제목 문체를 우선 따른다. 관례를 알 수 없으면 아래 형식을 사용한다.

```text
[type] 작업 요약
```

type 예시:

- `feat`: 기능 추가
- `fix`: 버그 수정
- `hotfix`: 긴급 수정
- `chore`: 설정, 자동화, 기타 작업
- `refactor`: 구조 개선
- `test`: 테스트 추가/수정
- `docs`: 문서 추가/수정

## 본문 작성

저장소의 PR 템플릿이 있으면 템플릿의 섹션과 순서를 유지한다. 템플릿이 없으면 아래 구성을 기본으로 사용한다.

```text
## Summary

## Changes

## Testing

## Related Issues

## Notes
```

작성 규칙:

- 템플릿의 안내용 HTML 주석은 제거해도 된다.
- 변경 사항은 보통 3-8개의 bullet로 작성한다.
- bullet은 구체적으로 쓴다. 단순히 "수정했습니다"보다 대상과 변화가 드러나야 한다.
- 파일명, 모듈명, 타입명, 명령어는 backtick으로 감싼다.
- 기술적 배경이 중요한 PR은 `Problem`, `Solution`, `Validation`, `Follow-up` 같은 하위 섹션을 추가한다.
- 자동 리뷰 도구의 요약 블록은 직접 작성하지 않는다.
- UI 변경이 있고 사용자가 이미지/GIF URL을 제공하지 않았으면 스크린샷이 별도 첨부 필요하다고 적는다.
- 검증하지 않은 테스트나 동작 확인을 완료한 것처럼 쓰지 않는다.

체크리스트가 있으면 사실대로 표시한다.

- 커밋/PR 컨벤션: 현재 제목과 커밋 메시지가 저장소 규칙에 맞을 때만 체크한다.
- 테스트/빌드: 실제로 실행했거나 사용자가 실행 결과를 제공한 항목만 체크한다.
- 문서: 문서 변경이 필요했고 반영되어 있을 때만 체크한다.
- 이슈: 관련 이슈 번호를 작성했을 때만 체크한다.

## 라벨과 리뷰어

PR 유형과 라벨은 저장소의 기존 라벨을 먼저 확인한다.

```bash
gh label list --limit 100
```

저장소에 맞는 라벨이 있으면 하나 이상의 라벨을 붙인다. 라벨이 없거나 권한이 없으면 라벨 없이 PR을 생성하고 사유를 보고한다.

assignee/reviewer는 아래 기준으로 처리한다.

- 사용자가 지정한 assignee/reviewer가 있으면 사용한다.
- 사용자가 지정하지 않았고 저장소 관례가 불분명하면 `--assignee @me`만 사용하거나 생략한다.
- reviewer 권한 문제로 실패해도 PR 생성 자체를 반복하지 말고 실패 이유를 보고한다.

## 게시 절차

PR 본문은 shell inline 문자열보다 임시 body file로 전달한다.

1. 제목과 본문을 사용자에게 짧게 요약하되, 사용자가 이미 PR 생성을 요청했다면 별도 승인 대기 없이 계속 진행한다.
2. 브랜치가 원격에 없거나 원격보다 앞서 있으면 `git push -u origin <current-branch>` 또는 `git push`를 실행한다. PR 생성 요청은 현재 브랜치 게시를 포함한다고 본다.
3. 아래 형식으로 PR을 생성한다.

```bash
gh pr create \
  --base <base> \
  --head <current-branch> \
  --title "<title>" \
  --body-file <body-file>
```

4. 사용자가 draft를 요청했거나 검증이 불충분해 draft가 더 적절하면 `--draft`를 붙인다.
5. assignee, reviewer, label 옵션은 확인된 경우에만 붙인다.
6. PR 생성 후 URL을 보고한다.

라벨이나 reviewer 추가가 권한 문제로 실패하면 PR 생성 자체를 재시도하지 말고, PR URL과 후속 조치만 보고한다.

## 실패와 중단 기준

아래 상황에서는 PR을 생성하지 않는다.

- working tree에 커밋되지 않은 변경이 있다.
- 금지 파일, 비밀, 개인정보, 불필요한 생성물이 변경사항에 포함되어 있다.
- 현재 브랜치가 기본 브랜치이다.
- base 대비 커밋이 없다.
- `gh auth status`가 실패한다.
- 같은 head branch의 open PR이 이미 있다.
- PR 제목/본문을 만들기에 diff 정보가 부족하다.

중단 시에는 무엇이 막혔는지와 다음 명령 또는 다음 사용자 입력을 짧게 제시한다.

## 최종 응답

PR을 생성했다면 아래를 보고한다.

- PR URL
- 제목
- base/head branch
- 관련 이슈
- push 여부
- 라벨/assignee/reviewer 적용 여부
- 검증/미검증 요약

PR을 생성하지 않았다면 중단 이유와 필요한 다음 조치를 보고한다.
