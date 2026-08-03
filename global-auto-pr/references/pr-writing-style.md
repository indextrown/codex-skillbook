# Generic PR Writing Style

이 문서는 `global-auto-pr`가 여러 저장소에서 일관된 PR 문체를 만들기 위한 기준이다. 저장소에 PR 템플릿, CONTRIBUTING 문서, 기존 PR 관례가 있으면 그 규칙을 이 문서보다 우선한다.

## 제목

기본 원칙:

- 사용자가 PR 제목을 지정하면 그대로 사용한다.
- 관련 이슈를 찾았고 저장소 관례상 이슈 제목을 PR 제목으로 쓰는 흐름이면 이슈 제목을 우선한다.
- 이슈가 없거나 관례가 불분명하면 diff와 커밋을 바탕으로 짧고 구체적인 제목을 직접 작성한다.

권장 형식:

```text
[type] 작업 요약
```

자주 쓰는 type:

- `[feat]`: 기능 추가
- `[fix]`: 버그 수정
- `[refactor]`: 구조 개선
- `[docs]`: 문서 변경
- `[test]`: 테스트 변경
- `[chore]`: 설정, 자동화, 정리

좋은 제목:

- `[feat] Add onboarding progress tracking`
- `[fix] Resolve duplicate request submission`
- `[refactor] Split authentication state handling`
- `[docs] Update release checklist`

## 변경 사항 섹션

기본은 bullet 중심이다.

```text
- Added <feature/flow> to <scope>.
- Updated <module/file> to <new behavior>.
- Refactored <old structure> into <new structure>.
- Documented <decision/setup> in <document>.
```

한국어 저장소나 사용자가 한국어로 요청한 경우에는 아래 문체를 사용한다.

```text
- <대상>이 <동작>하도록 구현했습니다.
- <기존 구조>를 <새 구조>로 변경했습니다.
- <파일/모듈>에 <역할>을 추가했습니다.
- <문서>에 <내용>을 정리했습니다.
```

기술 설명은 간결하지만 구체적으로 쓴다.

- 모듈명, 파일명, 타입명, 명령어는 backtick으로 감싼다.
- 단순 "수정했습니다"보다 무엇이 바뀌었는지 쓴다.
- 여러 레이어가 바뀌면 데이터 흐름, UI 흐름, API 흐름, 문서 영향이 드러나게 쓴다.

## 상세 섹션

아래 상황이면 `Changes`, `Notes`, 또는 템플릿의 관련 섹션에 하위 섹션을 추가한다.

- 크래시나 장애: `Problem`, `Root Cause`, `Solution`, `Validation`
- 아키텍처 변경: `Structure`, `Impact`, `Migration`
- 설정/SDK/빌드 변경: `Configuration`, `Validation`, `Follow-up`
- 성능/비용 비교: 표나 before/after bullet

## 관련 이슈

이슈 번호가 있으면 저장소 관례에 맞게 쓴다.

```text
Closes #123
```

여러 개면 bullet을 여러 줄로 작성한다. 이슈가 없으면 템플릿이 요구하지 않는 한 빈 섹션을 만들지 않는다.

## 스크린샷

UI 변경이 없으면 "Not applicable" 또는 템플릿 기본값을 사용한다.

UI 변경이 있고 사용자가 이미지 URL을 제공하지 않았으면 "Screenshots need to be attached separately."처럼 후속 작업을 명확히 적는다.

## 테스트

실제로 확인한 것만 쓴다.

좋은 예:

```text
- Ran `npm test`.
- Ran `xcodebuild ... build`.
- Not run: local environment does not have required credentials.
```

피해야 할 예:

```text
- Tests passed.
```

테스트 명령과 결과를 확인하지 않았다면 완료한 것처럼 쓰지 않는다.

## 피해야 할 것

- 자동 리뷰 도구의 요약을 사람이 작성한 것처럼 추가하지 않는다.
- diff를 그대로 장황하게 나열하지 않는다.
- 확인하지 않은 테스트를 체크리스트에서 체크하지 않는다.
- 비밀값, 토큰, 인증 파일 내용, 환경 변수 실제 값을 본문에 쓰지 않는다.
- 저장소 관례를 확인하지 않은 채 특정 라벨, reviewer, 이슈 종료 키워드를 강제하지 않는다.
