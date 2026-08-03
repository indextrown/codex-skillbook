---
name: global-pr-prep
description: GitHub 기여 또는 코드·문서 변경을 PR로 준비할 때, 사용자가 "브랜치명 추천", "PR 준비 정리", "커밋과 푸시 명령어", "PR 제목·본문 써줘"처럼 요청하면 사용한다. 저장소 관례와 실제 수정 대상을 확인해 브랜치 생성 명령어, 정확한 파일·줄 위치, 패치, commit/push 명령어, PR 제목과 본문을 한 번에 작성한다. 실제 커밋·푸시·PR 생성은 수행하지 않는다.
---

# Global PR Prep

변경을 구현하거나 게시하지 않고, 사용자가 그대로 실행·복사할 수 있는 PR 준비 패키지를 만든다. 실제 커밋, push, PR 생성을 요청하면 `global-auto-commit` 또는 `global-auto-pr` 흐름으로 넘긴다.

## 조사

1. 저장소와 기본 브랜치, remote/fork 구조, 현재 브랜치, working tree 상태를 확인한다. 변경이 있으면 이를 보존하고, 안전한 명령만 제시한다.
2. 사용자가 준 링크·파일·문제 설명에서 정확한 변경 대상을 확인한다. 실제 최신 파일을 읽어 파일 경로와 줄 번호를 확인하고, 줄 번호가 기준 브랜치의 현재 상태임을 명시한다.
3. 최근 merged PR 3~5개와 관련 파일의 과거 PR/커밋을 확인해 branch, commit, PR title/body 관례를 따른다. GitHub 문맥에서는 GitHub connector를 우선 사용하고, 부족한 정보만 `gh` 또는 GitHub API로 보완한다.
4. 수정이 기술적으로 필요한지 검증한다. 문서 예제라면 실제 API 제약이나 인접한 올바른 예제를 근거로 확인한다. 확신할 수 없으면 추정이라고 표시하고, 수정 명령어를 단정하지 않는다.

## 명령어 작성 규칙

- 사용자가 실행할 순서대로, 실제 확인한 base branch와 remote 이름을 넣어 명령어를 작성한다. 위험하거나 불명확한 placeholder 명령어를 실제 명령어처럼 제시하지 않는다.
- 깨끗한 기본 브랜치에서 시작할 수 있을 때만 다음 순서를 사용한다. remote 이름은 조사 결과로 대체한다.

```bash
git switch <base-branch>
git pull --ff-only <remote> <base-branch>
git switch -c <branch-name>
```

- base branch가 아닌 곳에서 시작하거나 working tree가 더러우면 `git switch`를 권하지 말고, 현재 상태와 별도 worktree/브랜치가 필요한 이유를 짧게 설명한다.
- 커밋 명령어에는 변경할 파일을 명시적으로 stage한다.

```bash
git add <file-path>
git commit -m "<commit-message>"
```

- push는 최초 upstream 설정까지 포함한다.

```bash
git push -u <push-remote> <branch-name>
```

- 실제 `git commit`, `git push`, `gh pr create`는 실행하지 않는다. 사용자가 그 행위를 명시적으로 요청했을 때에만 해당 전문 스킬을 사용한다.

## 출력 형식

아래 섹션을 이 순서로 짧고 완결되게 출력한다. 저장소 관례에 맞는 영문 branch/commit/PR text를 쓰고, 설명은 사용자의 언어에 맞춘다.

### 1. 제안 요약

- PR 목적과 범위를 한두 문장으로 설명한다.
- 참고한 최근 PR 또는 저장소 관례를 한 문장으로 적고 링크한다.

### 2. 브랜치 생성

branch 이름을 먼저 제시한 뒤, 복사 가능한 `bash` 블록으로 branch 생성 명령어를 제공한다.

### 3. 수정 위치와 패치

- 기준 브랜치의 현재 파일 경로와 수정할 원본 줄 번호를 bullet로 나열한다. 예: `Sources/.../Bindings.md` — 21, 36, 52번 줄의 선언 바로 위.
- 각 위치가 동일한 변경이면 한 번의 최소 diff로 보여 준다.
- 줄 번호는 다른 변경으로 이동할 수 있으므로, 고유한 코드 문구와 상대 위치도 함께 쓴다.

### 4. 커밋

커밋 메시지와 `git add`/`git commit` 명령어를 제공한다. 저장소가 Conventional Commit을 쓰면 그 형식을 따른다.

### 5. Push

최초 push 명령어를 제공한다.

### 6. PR

아래 항목을 각각 명확히 출력한다.

- **Title:** 한 줄
- **Body:** 바로 붙여 넣을 수 있는 `md` 코드 블록

저장소의 PR template이 없으면 간결한 `## Summary`와 `## Testing`을 기본으로 사용한다. 사실로 검증하지 않은 테스트를 실행했다고 쓰지 않는다. 문서만 바꾼 경우에는 `- Documentation changes only.`를 사용한다.

## 품질 기준

- branch, commit, PR title은 같은 변경을 같은 동사와 용어로 설명한다.
- 파일 경로, 줄 번호, 코드 조각, remote, base branch는 조사로 확인된 사실만 쓴다.
- PR 본문은 변경 이유와 구체적인 변경을 설명하되, 리뷰어가 diff에서 바로 알 수 있는 내용을 장황하게 반복하지 않는다.
- 하나의 PR은 하나의 독립된 문제만 다룬다. 범위가 넓어지면 분리안을 제안한다.
