---
kind: tech-spec
title: "프로젝트 문서 키트 명령어"
status: "구현됨"
owner: ""
reviewers: []
last_updated: "2026-09-15"
related_issue: ""
html: "./tech-spec.html"
---

# 프로젝트 문서 키트 명령어

## 요약

UIKit 프로젝트에서 명령어 한 번으로 `AGENTS.md`와 개발 문서의 출발점을 만들어요. 사용자는 키트 저장소를 직접 복제하거나 스크립트 경로를 찾지 않아도 돼요. 기존 스킬을 `npx`로 설치하는 경험에 가깝게, 이 저장소의 버전 태그를 지정해 실행하는 방식을 제안해요.

명령어는 생성할 파일을 먼저 보여주고 확인받은 뒤 적용해요. 기존 파일은 덮어쓰지 않아요. `Root.md`가 문서 길잡이를 맡고, 상세 아키텍처 문서는 UIKit에 적용 가능한 설계 예시를 구체적으로 보여줘요. 현재 프로젝트를 분석한 결과라고 주장하지 않아요. `project-docs-v1.0.0` 태그를 발행했고, 임시 UIKit 프로젝트에서 원격 실행을 검증했어요.

RxSwift를 채택한 프로젝트는 선택 옵션으로 타입·연산자, 바인딩 정책, Input/Output 패턴 문서 세 개를 함께 받을 수 있어요. 생성된 정책 문서는 실제 구현과 팀의 합의를 확인한 뒤 적용해요.

## 배경

이 작업 전 저장소는 전역 스킬 설치 방법을 제공했지만, 프로젝트 자체에 `AGENTS.md`와 문서 초안을 배치하는 명령어는 없었어요. 이전 초안은 저장소를 내려받아 `python3 scripts/project_docs.py`를 실행하도록 했어요. 대상 프로젝트 문서 몇 개를 만들기 위해 별도 저장소를 복제하고 스크립트 경로를 알아야 하므로 원하는 사용 경험과 맞지 않아요.

[npm 실행 명령](https://docs.npmjs.com/cli/npm-exec/)은 GitHub 저장소를 패키지로 지정해 실행할 수 있고, [GitHub 패키지 주소에 태그나 커밋을 지정](https://docs.npmjs.com/cli/v11/using-npm/package-spec/)할 수 있어요. 따라서 첫 버전은 npm 레지스트리에 별도 패키지를 게시하지 않고, 이 저장소에 작은 실행 파일과 문서 키트를 포함하는 방향으로 설계해요. npm이 실행에 필요한 패키지를 내려받아 캐시에 보관할 수는 있지만, 사용자가 저장소를 직접 복제하거나 대상 프로젝트에 설치할 필요는 없어요.

첫 배포 때 README가 아직 발행하지 않은 `project-docs-v1.0.0` 태그를 먼저 안내해 원격 명령이 CLI에 도달하지 못했어요. npm 환경에 따라 유효하지 않은 Git 참조가 뚜렷한 안내 없이 종료될 수 있어 사용자는 아무 반응이 없는 것으로 느낄 수 있었어요. 같은 명령을 `main` 참조로 실행했을 때는 생성 목록이 출력돼 CLI 구현이 아니라 릴리스 태그 누락이 원인임을 확인했어요.

기존 문서 초안은 UIKit이라는 이유만으로 특정 패턴이나 라이브러리를 현재 프로젝트의 사실처럼 단정하지 않았어요. 다만 아키텍처에 `확인 필요` 표만 놓으면 개발자가 설계를 비교하거나 새 기능의 작업 순서를 판단하기 어려워요. 그래서 계층형 UIKit 설계를 **검토할 예시**로 제공하고 실제 프로젝트의 구조와 구별해요. RxSwift, Tuist 또는 특정 Git 정책을 이미 채택했다고 단정하지 않아요. RxSwift 문서 세 개는 해당 라이브러리를 사용하는 프로젝트가 선택해 추가해요.

## 목표

- 사용자는 대상 프로젝트 루트에서 버전이 고정된 `npx` 명령어 한 번으로 UIKit 문서 키트를 실행할 수 있어야 해요.
- 명령어는 대상 경로와 생성·건너뛰기 목록을 보여준 뒤, 터미널에서는 사용자의 확인을 받아 적용해야 해요.
- 사용자는 `--dry-run`으로 쓰기 없이 확인하거나, 자동화 환경에서 `--apply`로 적용을 명시할 수 있어야 해요.
- 기존 파일과 사용자가 수정한 문서는 덮어쓰지 않아야 하고, 재실행해도 내용이 바뀌지 않아야 해요.
- 대상 프로젝트의 앱 코드, 패키지 의존성, 잠금 파일을 변경하지 않아야 해요.
- 키트는 스킬이 아니라 프로젝트 문서 생성 도구로 제공하고, 확인되지 않은 프로젝트 사실은 초안으로 남겨야 해요.
- 문서 길잡이에서 아키텍처와 테스트 문서를 표로 찾아갈 수 있어야 해요. 아키텍처 문서에는 계층별 책임, 코드 의존성, 사용자 동작의 데이터 흐름과 기능 추가 순서를 실제 예시로 설명해야 해요.
- RxSwift를 쓰는 프로젝트는 `--include rxswift` 한 번으로 서로 연결된 참고·정책 검토·Input/Output 문서 세 개를 추가할 수 있어야 해요.

## 목표가 아닌 것

- 첫 버전에서 Swift 코드를 자동 분석해 모듈 구조나 테스트 명령을 확정하지 않아요.
- 기존 `AGENTS.md`나 문서를 병합·교체하거나 생성된 문서를 자동 업그레이드하지 않아요.
- 전역 명령어 설치, npm 레지스트리 게시, 원격 사용자 템플릿 로딩은 포함하지 않아요.
- 앱 소스, Xcode 프로젝트, CI 설정 또는 대상 프로젝트의 `package.json`을 생성·수정하지 않아요.
- `npx skills add`로 문서 키트를 스킬처럼 설치하지 않아요. 실행 경험만 비슷하게 제공해요.

## 계획

### 배포와 파일 구성

이 저장소 루트에 단일 실행 파일을 가진 `package.json`을 추가해요. [npm의 실행 파일 설정](https://docs.npmjs.com/files/package.json/)인 `bin` 필드로 `project-docs` 명령을 연결하고, `files` 허용 목록에는 실행 파일과 키트만 넣어요. 런타임 의존성이나 설치·빌드 스크립트는 두지 않아 원격 실행 시 불필요한 설치 작업을 줄여요. CLI는 Node.js 표준 라이브러리만 사용하고, 템플릿은 실행 파일의 패키지 위치를 기준으로 찾아요.

```text
package.json
bin/project-docs.js
project-doc-kits/ios-uikit/
├── kit.json
├── AGENTS.md.tmpl
└── docs/
    ├── Root.md.tmpl
    ├── architecture/
    │   ├── architecture.md.tmpl
    │   ├── rxswift.md.tmpl
    │   ├── rxswift-binding-policy.md.tmpl
    │   └── rxswift-input-output.md.tmpl
    └── development/
        ├── testing.md.tmpl
        └── gitflow.md.tmpl
tests/project-docs.test.js
```

`.tmpl`은 키트의 `AGENTS.md`가 이 저장소의 작업 지침으로 읽히지 않게 해요. `kit.json`은 템플릿, 대상 상대 경로, 기본·선택 여부를 선언해요. 기본 생성 대상은 `AGENTS.md`, `docs/Root.md`, `docs/architecture/architecture.md`, `docs/development/testing.md`예요. `docs/development/gitflow.md`는 `--include gitflow`을 지정한 경우에만 만들어요. `--include rxswift`는 `docs/architecture/` 아래 RxSwift 문서 세 개를 함께 만들어요. 두 선택 옵션을 함께 지정할 수 있어요.

### 명령어와 적용 흐름

사용자가 UIKit 프로젝트 루트에서 실행하는 명령이에요. `--package`와 실행 파일 이름을 분리해 npm이 실행할 진입점을 명확히 해요.

```bash
npx --yes --package=github:indextrown/codex-skillbook#project-docs-v1.0.0 -- project-docs init ios-uikit
npx --yes --package=github:indextrown/codex-skillbook#project-docs-v1.0.0 -- project-docs init ios-uikit --dry-run
npx --yes --package=github:indextrown/codex-skillbook#project-docs-v1.0.0 -- project-docs init ios-uikit --include gitflow --apply
npx --yes --package=github:indextrown/codex-skillbook#project-docs-v1.0.0 -- project-docs init ios-uikit --include rxswift --apply
npx --yes --package=github:indextrown/codex-skillbook#project-docs-v1.0.0 -- project-docs init ios-uikit --include gitflow --include rxswift --apply
```

대상은 기본적으로 현재 작업 디렉터리이고, 경로를 직접 지정할 때만 `--target /absolute/path/MyUIKitApp`을 사용해요. `--project-name`을 생략하면 대상 폴더 이름을 문서 제목에 사용해요. CLI는 npm 자체의 최초 패키지 실행 확인과 별개로, 프로젝트에 쓸 파일 목록을 보여준 뒤 `적용할까요? [y/N]`를 물어요. `--dry-run`은 확인 질문 없이 목록만 보여주고, `--apply`는 CLI의 적용 질문을 건너뛰어요. 터미널이 아닌 환경에서는 `--apply`가 없으면 쓰지 않고 종료해요. npm 패키지 실행 확인을 생략하는 `npx --yes`와 CLI의 `--apply`는 서로 다른 동작임을 문서에 명시해요.

`package.json`의 버전을 올린 변경이 `main`에 병합된 뒤 전용 릴리스 워크플로를 실행해요. 워크플로는 패키지 버전, 테스트와 패키징을 확인하고, 병합 커밋의 GitHub 주소로 임시 프로젝트 스모크 테스트를 통과한 경우에만 `project-docs-v<version>` 태그를 만들어요. README는 태그 발행이 끝난 뒤 해당 버전을 안내해요.

파일별 결과는 `CREATE`, `UNCHANGED`, `SKIP_EXISTING`으로 출력해요. 기존 파일이 있으면 내용이 같아도 덮어쓰지 않고, 내용이 다른 경우에는 `SKIP_EXISTING`으로 알려줘요. 일부가 건너뛰어졌다면 전체 적용으로 오해하지 않도록 요약과 종료 상태에 반영해요.

### 프로젝트 적용 예시

가상의 UIKit 프로젝트 `MyUIKitApp` 루트에서 기본 명령을 실행하고 적용을 확인한 경우예요. 실행 전에는 다음 파일이 있다고 가정해요.

```text
MyUIKitApp/
├── MyUIKitApp.xcodeproj/
├── MyUIKitApp/
├── MyUIKitAppTests/
└── README.md
```

적용 후에는 기존 앱 파일을 유지하면서 문서 네 개가 추가돼요.

```text
MyUIKitApp/
├── AGENTS.md                         ← 새로 생성
├── MyUIKitApp.xcodeproj/             ← 기존 유지
├── MyUIKitApp/                       ← 기존 유지
├── MyUIKitAppTests/                  ← 기존 유지
├── README.md                         ← 기존 유지
└── docs/
    ├── Root.md                       ← 새로 생성, 문서 길잡이
    ├── architecture/
    │   └── architecture.md           ← 새로 생성, 상세 설계 예시
    └── development/
        └── testing.md               ← 새로 생성
```

`--include gitflow`을 지정하면 `docs/development/gitflow.md`를 추가해요. `--include rxswift`를 지정하면 `docs/architecture/rxswift.md`, `rxswift-binding-policy.md`, `rxswift-input-output.md`를 추가해요. 두 옵션을 함께 쓰면 `architecture/`에는 기본 아키텍처 문서와 RxSwift 문서 세 개가, `development/`에는 `testing.md`와 `gitflow.md`가 생겨요. `--dry-run`은 이 트리를 만들지 않고 파일별 예정 상태만 보여줘요. 같은 경로에 문서가 이미 있으면 해당 파일은 보존하고 결과에 `UNCHANGED` 또는 `SKIP_EXISTING`으로 표시해요.

### 생성 문서의 내용

`AGENTS.md`에는 코드·프로젝트 설정을 먼저 확인하라는 지침, 문서 읽기 순서와 문서 갱신 조건을 담아요. `Root.md`는 아키텍처·테스트 문서의 질문별 길잡이 표예요. 기본 생성에 없는 선택 문서 `gitflow.md`를 깨진 링크로 걸지 않고, 선택적으로 생성했을 때의 경로만 알려줘요.

`docs/architecture/architecture.md`는 App·Presentation·Domain·Data·Infrastructure의 역할과 경계를 구체적으로 설명해요. `Presentation → Domain ← Data → Infrastructure`라는 코드 의존성과 App의 구현체 조립을 설명해요. 가상의 프로필 새로고침에서 사용자 입력, UseCase, Repository 계약과 구현, 응답 변환, 화면 상태 갱신을 순서대로 따라가요. 기능 추가 체크리스트에는 어떤 계층을 언제 만들고 무엇을 검증할지 적어요. RxSwift 같은 라이브러리는 선택 가능한 구현 도구로만 언급해요. 이 설계와 경로는 대상 코드베이스의 검증된 사실이 아니므로 개발자가 실제 구조에 맞게 고쳐야 해요.

`testing.md`에는 확인한 테스트 타깃과 실행 명령을 적을 자리를 둬요. 선택 문서인 `gitflow.md`는 기본 브랜치, 브랜치 이름, 커밋 형식, 리뷰·병합 기준을 먼저 확인하게 해요. 그다음 Git 기본 명령으로 최신화, 작업 브랜치 생성, 변경 확인, 관련 파일만 stage, 커밋·push, PR, 병합 후 정리까지 따라갈 수 있는 예시를 제공해요. `main`, 브랜치 접두사, Conventional Commits와 릴리스 규칙은 확인 전까지 팀 정책으로 단정하지 않아요.

선택 문서 `rxswift.md`는 RxSwift·RxCocoa 타입, 구독 메서드, 연산자 비교와 최종 선택표를 담아요. 읽기 순서를 제시하고 나머지 두 문서로 연결해요. `rxswift-binding-policy.md`는 메모리, DisposeBag, Relay, UI 스레드와 Driver 사용 여부를 팀 정책 검토안으로 정리해요. `rxswift-input-output.md`는 Input을 먼저 만들고 UI 이벤트를 개별 바인딩하는 흐름, `transform`, View의 Binder, 대표 Input/Output 연결 예시를 담아요. 타입·화면 이름은 가상 UIKit 예시로 표시해요. `defaultTapThrottle()` 같은 별도 확장은 사용 전 확인 대상으로 표시해요. 기본 키트가 RxSwift 도입이나 Driver 미사용을 요구하지 않도록 세 문서를 선택적으로 생성하고, 선택하지 않은 경우 길잡이에 깨진 링크를 만들지 않아요.

프로젝트 고유 정보는 자동 생성된 사실처럼 쓰지 않고 `확인 필요`로 표시해요. 설계 예시는 현재 프로젝트의 결정과 명확히 구분해요. CLI는 프로젝트 이름처럼 사용자가 제공한 값만 치환해요. 생성 후 개발자가 실제 코드, 설정과 팀 규칙을 확인해 문서를 완성해야 해요.

### 쓰기 안전성과 검증

CLI는 쓰기 전에 대상 루트를 확인하고, 키트의 모든 대상 경로가 그 안에 머무르는지 검사해요. 경로 순회, 대상 또는 상위 경로의 심볼릭 링크, 파일·디렉터리 충돌은 거부해요. 템플릿 내용은 명령으로 실행하지 않아요. 파일 생성은 기존 파일을 대체하지 않는 방식으로 수행해 미리보기 이후 다른 작업이 파일을 만들어도 덮어쓰지 않아요. 자동 삭제 명령은 제공하지 않아요.

로컬 패키지는 `npm pack --dry-run`으로 실행 파일과 키트만 포함하는지 확인해요. 테스트는 `--dry-run`의 무변경, 확인 거절, 기본·선택 파일, 기존 파일 보존, 재실행, 경로·심볼릭 링크 거부와 `확인 필요` 표기를 검증해요. 릴리스 전에는 병합 커밋의 GitHub 주소로 임시 프로젝트에서 원격 실행을 확인하고, 통과한 커밋에만 버전 태그를 붙여요. 이때 대상 프로젝트에 `package.json`, 잠금 파일이나 키트 저장소가 새로 생기지 않는지도 검사해요.

`project-docs-v1.0.0`은 임시 폴더에서 원격으로 다시 검증했어요. `--dry-run`은 파일을 만들지 않고 기본 네 파일을 표시했고, `--apply`는 기본 네 파일을 만들었어요. `gitflow`, `rxswift`, 두 옵션 동시 지정은 각각 5개, 7개, 8개 파일을 만들었어요.

## 고려 사항

- GitHub 주소로 실행해도 npm은 패키지를 네트워크에서 가져와 캐시에 저장할 수 있어요. 여기서 “저장소를 내려받지 않는다”는 사용자가 직접 복제하거나 대상 프로젝트 안에 키트 저장소를 두지 않는다는 뜻이에요.
- 원격 명령 실행에는 Node.js와 npm이 필요해요. 실행할 코드의 출처와 재현성을 위해 README에는 고정된 릴리스 태그를 안내하고, 확인하지 않은 `main` 브랜치 실행을 기본 예시로 쓰지 않아요.
- README가 존재하지 않는 태그를 가리키면 CLI가 실행되기 전에 npm이 종료될 수 있어요. 새 버전은 원격 스모크 테스트 뒤 태그를 발행하고, 발행이 끝난 태그만 README에 반영해요.
- `AGENTS.md`는 실제 작업 지침이 돼요. 템플릿에 확인되지 않은 팀 정책을 넣지 않고, 생성 후 프로젝트 담당자의 검토가 필요하다고 표시해요. 아키텍처 예시도 현재 코드의 증거로 취급하지 않아요.
- `Root.md`는 문서의 역할을 분명히 보여주지만 GitHub에서 폴더 첫 화면으로 자동 노출되는 이름은 아니에요. `AGENTS.md`와 README에서 시작 경로를 명시해요.
- Git 흐름 문서는 팀 정책을 모르면 오해를 만들 수 있어 첫 버전에서는 선택 파일로 유지해요. RxSwift 문서 세 개도 라이브러리를 쓰지 않는 프로젝트에 적용하지 않도록 선택 파일로 유지해요. Driver 미사용과 별도 확장은 생성 대상의 확인된 규칙으로 단정하지 않아요.
- 더 짧은 `npx @scope/project-docs` 명령이 필요해지면 npm 게시 권한, 패키지 이름과 릴리스 절차를 별도로 결정해요. 첫 버전의 필수 조건은 아니에요.

## 진행 체크리스트

- [x] 1. 사용 경험과 문서 구성 확정
  - [x] 1-1. 개발자가 `npx` GitHub 태그 실행, 현재 디렉터리 기본 대상과 `--target` 예외를 승인해요.
  - [x] 1-2. 대화형 확인, `--dry-run`, `--apply`와 기존 파일 보존 동작을 승인해요.
  - [x] 1-3. Node.js·npm 최소 지원 버전과 릴리스 태그 이름을 정해요.
  - [x] 1-4. `Root.md` 길잡이와 별도 아키텍처 설계 예시로 바꾼 문서 구성을 개발자가 검토하고 승인해요.
- [x] 2. 실행 패키지와 UIKit 키트 구성
  - [x] 2-1. 루트 `package.json`에 단일 `bin`과 `files` 허용 목록을 설정하고 설치·빌드 스크립트가 없는지 확인해요.
  - [x] 2-2. `kit.json`에 기본 네 파일과 선택 `gitflow.md`·RxSwift 문서 세 개의 대상 경로를 등록해요.
  - [x] 2-3. `AGENTS.md.tmpl`과 문서 템플릿이 설계 예시와 대상 프로젝트의 확인된 사실을 구별하는지 검토해요.
- [x] 3. 미리보기와 확인 흐름 구현
  - [x] 3-1. `init ios-uikit --dry-run`이 대상 절대 경로와 파일별 상태를 출력하고 디스크를 바꾸지 않는 테스트가 통과해요.
  - [x] 3-2. 터미널에서 확인을 거절하면 파일이 생성되지 않고, 비대화형 실행은 `--apply` 없이 쓰지 않아요.
  - [x] 3-3. npm의 패키지 실행 확인과 CLI의 프로젝트 쓰기 확인을 README에서 구분해요.
- [x] 4. 안전한 적용 구현
  - [x] 4-1. 없는 파일만 생성하고 기존 `AGENTS.md`와 문서의 바이트가 그대로 남는 테스트가 통과해요.
  - [x] 4-2. 같은 명령을 다시 실행하면 생성 파일이 `UNCHANGED`로 표시되고 내용이 바뀌지 않아요.
  - [x] 4-3. 경로 순회, 상위·대상 심볼릭 링크, 파일·디렉터리 충돌을 거부하는 테스트가 통과해요.
  - [x] 4-4. 일부 `SKIP_EXISTING` 발생 시 생성 파일과 미적용 파일, 종료 상태를 구분해 보여줘요.
- [x] 5. 패키징과 원격 실행 검증
  - [x] 5-1. `npm pack --dry-run` 결과에 CLI와 템플릿만 포함되고 설치·빌드 스크립트가 실행되지 않는지 확인해요.
  - [x] 5-2. 릴리스 태그의 GitHub 주소로 임시 UIKit 프로젝트에서 명령어를 실행해요.
  - [x] 5-3. 실행 전후 대상 프로젝트의 앱 코드, `package.json`, 잠금 파일과 기존 문서가 바뀌지 않았는지 비교해요.
  - [x] 5-4. README에 저장소 복제 없는 실행 예시, 두 선택 옵션과 동시 지정, RxSwift 문서 세 개의 생성 경로, 버전 갱신과 `확인 필요` 항목의 검토 방법을 적어요.
  - [x] 5-5. 테스트한 커밋에만 `project-docs-v<version>` 태그를 발행하는 전용 워크플로를 추가해요.
