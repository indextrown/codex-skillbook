# codex-skillbook

Codex에서 반복하는 작업을 같은 기준으로 처리할 수 있도록, 전역 스킬을 모아 둔 저장소입니다. 스킬 이름을 선택하면 필요한 상황과 상세 워크플로우를 확인할 수 있습니다.

## Codex 스킬이란?

스킬은 Codex가 반복되는 작업을 처리할 때 참고하는 지침과 자료 묶음입니다. 각 스킬은 `SKILL.md`를 중심으로 언제 사용해야 하는지, 어떤 순서로 작업할지, 필요한 참조 자료나 스크립트를 함께 정의합니다.

스킬을 설치해 두면 PR 작성, 구현 계획 수립, 한국어 문서 다듬기처럼 자주 하는 작업에서 매번 기준을 설명하지 않아도 됩니다. 같은 절차와 점검 기준을 꾸준히 적용할 수 있습니다.

## 스킬을 사용하면 좋은 점

- 반복 작업의 절차와 체크리스트를 한 번 정의해 재사용할 수 있습니다.
- 참조 문서와 스크립트를 작업 흐름에 함께 묶어 둘 수 있습니다.
- Codex가 작업 목적에 맞는 기준을 먼저 읽고 일관되게 처리할 수 있습니다.

## `AGENTS.md`와 무엇이 다른가?

| 구분 | 스킬 | `AGENTS.md` |
| --- | --- | --- |
| 역할 | 특정 작업을 어떤 절차로 처리할지 정합니다. | 저장소에서 지켜야 할 규칙과 작업 방식을 정합니다. |
| 적용 시점 | 요청이 스킬 설명과 맞거나 스킬 이름을 직접 지정했을 때 사용합니다. | Codex가 작업을 시작하기 전에 현재 작업 경로의 지침으로 읽습니다. |
| 잘 맞는 내용 | PR 작성, 문서 다듬기, 구현 계획처럼 반복되는 작업 흐름 | 코드 스타일, 테스트 명령, 디렉터리별 제약, PR 전 확인 사항 |

둘은 함께 쓰는 것이 좋습니다. `AGENTS.md`에는 이 저장소에서 따라야 할 공통 규칙을 두고, 스킬에는 특정 작업을 처리하는 재사용 가능한 워크플로우를 둡니다.

## Codex에서 스킬 사용하기

Codex는 스킬 이름과 설명을 보고 요청에 맞는 스킬을 찾습니다. 특정 스킬을 명시적으로 호출하려면 요청 첫 줄에 스킬 이름 앞에 `$`를 붙입니다.

```text
$<스킬-이름>

<요청 내용>
```

### Codex CLI

작업할 저장소에서 Codex를 실행한 뒤, 채팅에 작업을 요청합니다.

```bash
cd my-project
codex
```

```text
$global-humanize-korean

README의 한국어 문장을 다듬어줘.
```

### Codex 앱

Codex 앱에서 대상 저장소를 열고 작업 내용을 입력합니다. CLI와 마찬가지로 `$`를 붙인 스킬 이름으로 원하는 워크플로우를 바로 지정할 수 있습니다.

```text
$global-planning-pipeline

로그인 후 앱이 멈추는 문제의 원인을 점검하고 수정 계획을 세워줘.
```

## 설치, 업데이트 및 삭제

```bash
# 최초 설치: Codex 전역에 모든 스킬 설치
npx skills add indextrown/codex-skillbook --skill '*' --agent codex --global --yes

# Codex 전역에 설치된 스킬 목록
npx skills list --global --agent codex

# 이후 전체 업데이트
npx skills update --global

# 특정 스킬만 업데이트
npx skills update --global global-humanize-korean

# 특정 스킬 삭제
npx skills remove global-humanize-korean --agent codex --global --yes
```

## 프로젝트 문서 키트 사용하기

프로젝트 문서 키트는 UIKit 프로젝트에 `AGENTS.md`, `CLAUDE.md`와 개발 문서를 만들어요. 처음 설치할 때도, 최신 템플릿을 반영할 때도 같은 명령을 사용해요. 키트 저장소를 직접 복제하거나 프로젝트에 npm 의존성을 추가하지 않아요.

Node.js 22 이상과 npm 10 이상이 필요해요. 명령은 별도 버전을 지정하지 않고 이 저장소의 기본 브랜치에 병합된 최신 키트를 사용해요.

### 빠르게 시작하기

UIKit 프로젝트 루트에서 다음 명령을 실행해요.

```bash
cd /absolute/path/MyUIKitApp

npx --yes --package=github:indextrown/codex-skillbook -- project-docs init ios-uikit
```

명령은 파일별 변경 사항을 먼저 보여주고 `적용할까요? [y/N]`를 물어요. 승인하면 현재 문서 키트의 문서 15개를 모두 만들어요.

```text
MyUIKitApp/
├── .project-docs/
│   └── manifest.json                 ← 안전한 갱신에 쓰는 내용 해시
├── AGENTS.md                         ← 공통 AI 작업 지침
├── CLAUDE.md                         ← Claude Code용 `AGENTS.md` 연결
└── docs/
    ├── architecture/
    │   ├── architecture.md           ← UIKit 아키텍처 검토 예시
    │   ├── dicontainer.md            ← DI 객체 생성과 공유 기준
    │   ├── view-viewmodel-protocols.md ← View·ViewModel 계약과 주입
    │   ├── rxswift.md                ← RxSwift·RxCocoa 타입과 연산자
    │   ├── rxswift-binding-policy.md ← Rx 바인딩 정책 검토안
    │   └── rxswift-input-output.md   ← ViewModel Input·Output 패턴
    └── development/
        ├── ai-attribution.md         ← 커밋·PR의 AI 작성 표기 규칙
        ├── gitflow.md                ← 브랜치·커밋·PR 작업 흐름
        ├── swiftstyle.md             ← Swift 코드 스타일 검토안
        ├── korean-editing.md         ← 문서·PR 구성과 윤문 원칙
        ├── examples/
        │   ├── korean-editing-examples.md ← 문서 윤문 전후 비교
        │   └── pr-writing-examples.md    ← 변경 규모별 PR 작성 예시
        └── testing.md                ← 테스트 가이드
```

`AGENTS.md`에서 작업에 필요한 문서와 적용 기준을 바로 찾아갈 수 있어요. `CLAUDE.md`는 [Claude Code의 파일 가져오기 문법](https://code.claude.com/docs/en/memory#agentsmd)인 `@AGENTS.md`를 사용해 같은 작업 기준을 불러와요. 공통 규칙을 두 파일에 중복해서 관리하지 않아요.

생성 문서는 모두 필수 문서예요. 아키텍처, DI Container, View·ViewModel 프로토콜, RxSwift, Git 작업 흐름과 Swift 스타일 문서는 프로젝트를 자동 분석해 확정한 규칙이 아니라 검토할 초안이에요. 생성 후 실제 코드와 팀 규칙에 맞게 다듬어 주세요.

이전 명령에 있던 `--include gitflow`과 `--include rxswift`는 호환을 위해 계속 허용하지만, 이제 모든 문서를 기본 생성하므로 지정하지 않아도 돼요.

### 쓰기 전에 확인하기

파일을 만들지 않고 결과만 확인하려면 `--dry-run`을 사용해요. CI처럼 질문에 답할 수 없는 환경에서는 `--apply`로 적용을 명시해요.

```bash
# 프로젝트를 바꾸지 않고 예정 상태만 확인해요.
npx --yes --package=github:indextrown/codex-skillbook -- project-docs init ios-uikit --dry-run

# 문서 키트의 확인 질문 없이 적용해요.
npx --yes --package=github:indextrown/codex-skillbook -- project-docs init ios-uikit --apply
```

현재 디렉터리 대신 다른 프로젝트에 적용하려면 `--target /absolute/path/MyUIKitApp`을 사용해요. 문서에 표시할 이름은 `--project-name MyUIKitApp`으로 바꿀 수 있어요. `npx --yes`는 npm의 패키지 실행 질문만 생략하고, 문서 키트의 적용 질문은 생략하지 않아요.

### 같은 명령으로 최신 문서 반영하기

처음 사용한 `init ios-uikit` 명령을 다시 실행하면 최신 템플릿과 현재 문서를 비교해요. 별도 `update` 명령은 필요하지 않아요.

`.project-docs/manifest.json`에는 마지막으로 적용한 문서의 내용 해시만 저장해요. 버전 번호는 없어요. 현재 파일의 해시가 마지막 적용 해시와 같을 때만 새 템플릿으로 갱신하므로, 사용자가 손댄 문서는 덮어쓰지 않아요. 팀원이 같은 기준으로 갱신할 수 있도록 이 파일도 문서와 함께 커밋해 주세요.

이미 `docs/` 폴더가 있어도 괜찮아요. 키트가 관리하는 경로만 확인하고 다른 문서는 건드리지 않아요. 관리 이력이 없는 기존 파일은 현재 템플릿과 완전히 같을 때만 추적을 시작하고, 내용이 다르면 그대로 보존해요.

키트에서 제외된 문서는 마지막 적용 뒤 수정되지 않았다면 재실행할 때 `DELETE`로 표시하고 자동 삭제해요. 이전 키트가 만든 `docs/Root.md`도 이 조건에 해당하면 삭제돼요. 앞선 갱신에서 관리 기록만 제거된 경우에는 이전 생성 템플릿과 내용이 정확히 같을 때만 삭제해요. 사용자가 수정했거나 직접 만든 `Root.md`는 보존하고, 관리 중인 파일이 이미 없다면 `RETIRED`로 관리 기록만 정리해요.

| 상태 | 의미 |
| --- | --- |
| `CREATE` | 없는 문서를 새로 만들어요. |
| `UPDATE` | 키트가 만들었고 사용자가 수정하지 않은 문서를 최신화해요. |
| `TRACK` | 현재 템플릿과 같은 기존 문서를 변경 없이 관리 대상으로 등록해요. |
| `UNCHANGED` | 문서와 템플릿이 이미 같아요. |
| `DELETE` | 키트에서 제외됐고 사용자가 수정하지 않은 기존 관리 문서를 삭제해요. |
| `RETIRED` | 키트에서 제외된 문서가 이미 없어서 관리 기록만 제거해요. |
| `SKIP_MODIFIED` | 키트 적용 후 사용자가 수정한 문서라서 보존해요. |
| `SKIP_RETIRED_MODIFIED` | 키트에서 제외됐지만 사용자가 수정한 문서라서 보존해요. |
| `SKIP_UNTRACKED` | 관리 이력이 없는 기존 문서라서 보존해요. |

보존한 파일이 있으면 종료 코드 `2`를 반환해 자동화에서도 부분 적용을 구분할 수 있어요. 경로 순회, 심볼릭 링크, 파일·디렉터리 충돌은 적용 전에 거부해요.

### 프로젝트에서 고친 문서를 키트에 올리기

프로젝트에서 문서를 고치다가 모든 프로젝트에 필요한 개선이 생기면 `contribute`로 이 저장소에 PR을 올려요. 저장소를 직접 복제하거나 템플릿 경로를 찾지 않아도 돼요.

수정한 문서를 모두 한 번에 올릴 때는 `--all`을 붙여요. 마지막 적용 뒤 내용이 바뀐 관리 문서를 자동으로 모아요.

```bash
# 1. 수정한 문서 전체의 템플릿 변경을 먼저 확인해요. push하지 않아요.
npx --yes --package=github:indextrown/codex-skillbook -- project-docs contribute ios-uikit --all --dry-run

# 2. 확인을 받은 뒤 브랜치를 push하고 draft PR 하나를 만들어요.
npx --yes --package=github:indextrown/codex-skillbook -- project-docs contribute ios-uikit --all
```

일부 문서만 올리려면 경로를 직접 적어요. 여러 개를 이어서 적을 수 있고, 인자 없이 실행하면 수정한 문서 목록을 보여줘요.

```bash
npx --yes --package=github:indextrown/codex-skillbook -- project-docs contribute ios-uikit
npx --yes --package=github:indextrown/codex-skillbook -- project-docs contribute ios-uikit docs/development/testing.md --dry-run
npx --yes --package=github:indextrown/codex-skillbook -- project-docs contribute ios-uikit docs/development/testing.md docs/development/swiftstyle.md
```

명령은 이 저장소의 `main`을 임시 폴더에 가져와서 로컬 수정분만 `project-doc-kits/ios-uikit/*.tmpl`에 옮겨요. 수정하지 않은 줄은 템플릿 원문을 그대로 써서 `{{PROJECT_NAME}}` 자리 표시자를 지켜요. 그다음 템플릿 diff를 보여주고, 확인을 받으면 `docs/contribute-<문서>-<시각>` 브랜치를 push하고 `gh`로 draft PR을 만들어요. 임시 폴더는 끝나면 지워요. `gh`가 없으면 PR을 만들 수 있는 주소를 알려줘요. PR 제목은 `--title`로 바꿀 수 있어요.

- 이 저장소는 공개 저장소예요. 프로젝트 이름이 남은 줄은 따로 경고하지만, 타깃 이름·서버 주소처럼 프로젝트 전용 내용은 찾아내지 못해요. push 전에 diff를 꼭 확인해 주세요.
- `--all`은 프로젝트 전용으로 고친 문서도 함께 모아요. 공개해도 되는 문서만 남도록 diff를 보고, 섞여 있으면 경로를 직접 지정해요.
- 마지막 적용 뒤 원격 템플릿이 바뀐 문서는 옮기지 않아요. 어느 부분이 로컬 수정인지 가를 수 없어 원격 변경을 되돌릴 수 있기 때문이에요. 경로를 지정했으면 오류로 멈추고, `--all`이면 그 문서만 건너뛰고 안내해요. 이런 문서는 안내하는 템플릿 파일을 이 저장소에서 직접 수정해 PR을 올려요.
- 저장소에 push할 권한과 `git`의 `user.name`·`user.email` 설정이 필요해요.
- PR 본문에는 변경한 템플릿 목록과 확인 항목만 들어가요. 변경 이유를 채운 뒤 draft를 해제해 주세요.
- PR이 merge된 뒤 프로젝트에서 `init ios-uikit`을 실행하면 로컬 문서와 템플릿이 같아져 `TRACK`으로 다시 관리돼요.

### push 전 코드 리뷰 git hook 설정하기

git 저장소 루트에서 `init`을 터미널로 실행하면, 문서를 적용한 뒤 `push 전 Claude 코드 리뷰 git hook을 설정할까요? [y/N]`를 한 번 물어요. 승낙하면 브랜치를 push하기 직전에 Claude Code의 `code-review` 스킬이 변경을 리뷰하고, 막아야 할 문제가 있으면 push를 중단해요. hook만 따로 설정하거나 나중에 설정하려면 다음 명령을 실행해요.

```bash
npx --yes --package=github:indextrown/codex-skillbook -- project-docs hooks ios-uikit
```

| 경우 | 동작 |
| --- | --- |
| 승낙 | `.githooks/pre-push`를 만들고 `git config core.hooksPath .githooks`를 설정한 뒤 `.gitignore`에 `.githooks/`를 추가해요. 개인 설정이라 hook 파일은 커밋하지 않아요. |
| 거절 | `git config project-docs.gitHooks declined`로 기록하고 `init`에서 다시 묻지 않아요. |
| `--apply`(비대화형) | hook은 설정하지 않고 위 명령만 안내해요. 질문 없이 설정하려면 `hooks ios-uikit --apply`를 써요. |
| 다른 hook 설정이 있음 | `core.hooksPath`가 다른 경로이거나, `.githooks/`가 이미 커밋돼 있거나, `.git/hooks`에 사용 중인 hook(Git LFS 등)이 있으면 바꾸지 않아요. `core.hooksPath`를 바꾸면 `.git/hooks`가 더 이상 실행되지 않기 때문이에요. |

hook을 갱신할지 판단하는 해시는 커밋되는 `.project-docs/manifest.json`이 아니라 로컬 git 설정(`project-docs.pre-push.hash`)에 저장해요. 수정하지 않은 hook만 최신 템플릿으로 갱신하고, 직접 고친 hook은 `SKIP_MODIFIED`로 보존해요. 리뷰에는 로그인한 `claude` CLI, `jq`, `perl`이 필요하고 push마다 API 비용이 들어요.

## 자주 사용하는 스킬

| 한글 제목 | 스킬 | 설명 |
| --- | --- | --- |
| 이슈·브랜치·PR 파이프라인 | [global-branch-planning-pipeline](./skills/global-branch-planning-pipeline/SKILL.md) | 이슈 생성부터 브랜치, 구현, 커밋, PR까지의 작업 흐름을 일관되게 관리합니다.<br><br>**사용 예시**<br>`$global-branch-planning-pipeline 인증 흐름을 개선하는 작업을 이슈부터 PR까지 진행해줘.` |
| App Store 릴리즈 문구 | [global-app-store-release](./skills/global-app-store-release/SKILL.md) | PR·커밋 이력에서 사용자 변경을 골라 다국어 App Store 릴리즈 노트와 심사 메모를 작성합니다.<br><br>**사용 예시**<br>`$global-app-store-release 이번 버전의 App Store 릴리즈 노트를 준비해줘.` |
| GitHub 저장소 초기 설정 | [global-github-repository-setup](./skills/global-github-repository-setup/SKILL.md) | 표준 레이블과 이슈 브랜치 자동화를 안전하게 설정하고, 기존 레이블을 보존합니다.<br><br>**사용 예시**<br>`$global-github-repository-setup 이 저장소에 표준 GitHub 초기 설정을 적용해줘.` |
| 한국어 문체 다듬기 | [global-humanize-korean](./skills/global-humanize-korean/SKILL.md) | 의미와 사실은 유지하면서 AI 번역투와 기계적인 문장을 자연스러운 한국어로 다듬습니다.<br><br>**사용 예시**<br>`$global-humanize-korean README의 한국어 문장을 자연스럽게 다듬어줘.` |
| 구현 계획 수립 | [global-planning-pipeline](./skills/global-planning-pipeline/SKILL.md) | 구현 전에 작업 계획, 방향성, 리팩터링 접근 방법을 검토하고 정리합니다.<br><br>**사용 예시**<br>`$global-planning-pipeline 로그인 후 앱이 멈추는 문제의 원인을 점검하고 수정 계획을 세워줘.` |
| 역할 분리 계획 수립 | [global-async-planning-pipeline](./skills/global-async-planning-pipeline/SKILL.md) | Researcher, Planner, Reviewer 서브 에이전트가 순서대로 근거·계획·검토 결과를 인계합니다.<br><br>**사용 예시**<br>`$global-async-planning-pipeline 로그인 후 앱이 멈추는 문제를 역할별 서브 에이전트로 점검하고 수정 계획을 세워줘.` |
| 아이디어 그릴링 | [global-grilling](./skills/global-grilling/SKILL.md) | 중요한 미결정 사항을 질문으로 확인해요. 개발 기능은 결정을 확인한 뒤 테크 스펙 초안으로 인계하고, 승인 전에는 구현하지 않아요.<br><br>**사용 예시**<br>`$global-grilling 프로젝트별 이메일 알림 기능 아이디어를 질문으로 검토해줘.` |
| 테크 스펙 작성 | [global-tech-spec](./skills/global-tech-spec/SKILL.md) | 기능 요구사항이나 그릴링 결정을 `docs/tech-specs/001-<feature-slug>/`의 Markdown·HTML로 정리해요. 훅으로 두 파일을 동기화하고 개발자의 수정·승인을 거쳐요.<br><br>**사용 예시**<br>`$global-tech-spec 프로젝트별 이메일 알림 설정 기능의 테크 스펙을 만들어줘.` |
| 기술 문서 작성 | [global-technical-writing](./skills/global-technical-writing/SKILL.md) | 기술 문서를 구조화하고, 명확하고 자연스러운 한국어 문체로 작성하거나 다듬습니다.<br><br>**사용 예시**<br>`$global-technical-writing API 인증 가이드를 사용자가 바로 따라 할 수 있게 작성해줘.` |

## 레거시 스킬

| 한글 제목 | 스킬 | 설명 |
| --- | --- | --- |
| 스킬 찾기 | [find-skills](./legacy/find-skills/SKILL.md) | 필요한 기능을 제공하는 설치 가능한 스킬을 찾고 설치할 수 있게 돕습니다. |
| 코드 질문·원인 분석 | [global-ask](./legacy/global-ask/SKILL.md) | 코드 변경 없이 오류와 경고의 원인을 분석하고, 개선 방향이나 학습 방법을 안내합니다. |
| 자동 커밋·푸시 | [global-auto-commit](./legacy/global-auto-commit/SKILL.md) | 변경사항을 점검하고 저장소 규칙에 맞춰 커밋하며, 필요하면 푸시까지 진행합니다. |
| GitHub 이슈 작성 | [global-auto-issue](./legacy/global-auto-issue/SKILL.md) | 문제 상황과 저장소 규칙을 바탕으로 GitHub 이슈를 작성하고 등록합니다. |
| GitHub PR 생성 | [global-auto-pr](./legacy/global-auto-pr/SKILL.md) | 현재 브랜치의 변경사항을 바탕으로 GitHub 풀 리퀘스트를 작성하고 생성합니다. |
| PR 준비 | [global-pr-prep](./legacy/global-pr-prep/SKILL.md) | PR에 필요한 브랜치명, 변경 요약, 커밋·푸시 명령, 제목과 본문을 준비합니다. |
