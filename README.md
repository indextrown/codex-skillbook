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

명령은 파일별 변경 사항을 먼저 보여주고 `적용할까요? [y/N]`를 물어요. 승인하면 다음 파일을 만들어요.

```text
MyUIKitApp/
├── .project-docs/
│   └── manifest.json                 ← 안전한 갱신에 쓰는 내용 해시
├── AGENTS.md                         ← 공통 AI 작업 지침
├── CLAUDE.md                         ← Claude Code용 `AGENTS.md` 연결
└── docs/
    ├── architecture/
    │   ├── architecture.md           ← UIKit 아키텍처 검토 예시
    │   └── dicontainer.md            ← DI 객체 생성과 공유 기준
    └── development/
        ├── swiftstyle.md              ← Swift 코드 스타일 검토안
        └── testing.md                 ← 테스트 가이드
```

`AGENTS.md`에서 작업에 필요한 문서와 적용 기준을 바로 찾아갈 수 있어요. `CLAUDE.md`는 [Claude Code의 파일 가져오기 문법](https://code.claude.com/docs/en/memory#agentsmd)인 `@AGENTS.md`를 사용해 같은 작업 기준을 불러와요. 공통 규칙을 두 파일에 중복해서 관리하지 않아요.

아키텍처와 DI Container 문서는 프로젝트를 자동 분석한 결과가 아니에요. Swift 스타일 가이드도 범용 검토안이므로 생성 후 실제 코드와 팀 규칙에 맞게 다듬어 주세요.

### 필요한 문서만 추가하기

Git 작업 흐름이나 RxSwift 문서가 필요한 프로젝트에서만 선택 옵션을 사용해요.

```bash
# Git 작업 흐름 문서 한 개를 추가해요.
npx --yes --package=github:indextrown/codex-skillbook -- project-docs init ios-uikit --include gitflow

# RxSwift 타입·바인딩·Input/Output 문서 세 개를 추가해요.
npx --yes --package=github:indextrown/codex-skillbook -- project-docs init ios-uikit --include rxswift

# 두 문서 묶음을 함께 추가해요.
npx --yes --package=github:indextrown/codex-skillbook -- project-docs init ios-uikit --include gitflow --include rxswift
```

`gitflow`은 커밋 규칙과 PR 제목·본문 작성 흐름을 담은 `docs/development/gitflow.md`를 만들어요. `rxswift`는 `docs/architecture/` 아래에 `rxswift.md`, `rxswift-binding-policy.md`, `rxswift-input-output.md`를 만들어요.

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
