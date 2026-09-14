---
title: RxSwift와 RxCocoa 타입 및 연산자 가이드
description: RxSwift와 RxCocoa의 스트림 타입과 연산자를 비교하고 UIKit 화면 연결에 맞는 선택을 돕는 가이드예요.
---

# RxSwift와 RxCocoa 타입 및 연산자 가이드

Rx 코드는 값을 시간 순서대로 전달하는 스트림을 만들고, 연산자로 가공한 뒤, 구독자에게 연결하는 구조예요. 이름이 비슷해 보여도 각 타입과 메서드는 담당하는 역할이 달라요.

이 문서에서는 `Observable`, Subject, Relay, Trait와 `subscribe`, `bind`, `drive`, `emit`의 차이를 설명해요. 마지막 선택표에서는 상황별로 어떤 타입과 메서드를 사용해야 하는지 바로 확인할 수 있어요. 코드의 화면·모델 이름은 설명을 위한 예시이며 대상 프로젝트에 실제로 존재한다는 뜻은 아니에요.

## Rx 문서 읽는 순서

| 순서 | 문서 | 확인할 내용 |
| --- | --- | --- |
| 1 | 이 문서 | RxSwift·RxCocoa 타입과 연산자의 동작을 찾아봐요. |
| 2 | [바인딩 정책](rxswift-binding-policy.md) | 구독 수명, 스레드, `Driver` 사용 여부 등 팀이 결정할 기준을 확인해요. |
| 3 | [Input/Output 패턴](rxswift-input-output.md) | UIKit 이벤트를 ViewModel에 전달하고 결과를 UI에 연결하는 예시를 따라가요. |

세 문서는 `--include rxswift`로 함께 생성돼요. 타입 설명은 라이브러리의 기능을, 바인딩 정책은 팀이 검토할 선택지를 다뤄요. 대상 프로젝트의 실제 의존성과 규칙은 개발자가 확인해야 해요.

## 어떤 모듈에서 제공하나요

| 모듈 | 주요 기능 |
| --- | --- |
| `RxSwift` | `Observable`, Subject, `Single`, `Completable`, `Maybe`, 연산자, `Disposable` |
| `RxRelay` | `PublishRelay`, `BehaviorRelay`, `ReplayRelay` |
| `RxCocoa` | `ControlEvent`, `ControlProperty`, `Driver`, `Signal`, `Binder`, UIKit의 `rx` 확장 |

## Rx 흐름을 먼저 이해해요

Rx 코드는 보통 아래 순서로 동작해요.

```text
이벤트 발생
  -> Observable 또는 Relay
  -> map, filter, flatMapLatest 같은 연산자
  -> Driver 또는 Signal 같은 UI 출력
  -> bind, drive, emit으로 화면에 연결
```

스트림은 세 종류의 이벤트를 전달할 수 있어요.

| 이벤트 | 의미 |
| --- | --- |
| `.next(value)` | 새로운 값을 전달해요. 여러 번 전달할 수 있어요. |
| `.error(error)` | 오류와 함께 스트림을 종료해요. 이후에는 어떤 이벤트도 전달하지 않아요. |
| `.completed` | 정상적으로 스트림을 종료해요. 이후에는 어떤 이벤트도 전달하지 않아요. |

`Relay`, `Driver`, `Signal`, `ControlEvent`는 오류를 전달하지 않아요. UI 이벤트나 화면 상태처럼 오류 때문에 스트림 자체가 끝나면 곤란한 곳에서 사용해요.

## Observable은 값의 흐름이에요

`Observable<Element>`은 여러 값을 시간 순서대로 전달할 수 있는 가장 기본적인 타입이에요. 값이 없을 수도 있고, 여러 개일 수도 있어요. 정상 완료하거나 오류로 끝날 수도 있어요.

```swift
let numbers = Observable.from([1, 2, 3])

numbers
    .map { $0 * 2 }
    .subscribe(onNext: { number in
        print(number)
    })
    .disposed(by: disposeBag)
```

`Observable`이라는 이름만으로 Hot과 Cold를 판단할 수는 없어요. 이벤트를 어디서 만드는지에 따라 달라져요.

| 구분 | 동작 | 대표 예시 |
| --- | --- | --- |
| Cold Observable | 구독할 때마다 작업을 새로 시작해요. | 일반적인 네트워크 요청, `Observable.create`, `Observable.deferred` |
| Hot Observable | 구독 여부와 관계없이 이미 발생하는 이벤트를 관찰해요. | 버튼 탭, Subject, Relay |

## Observer는 값을 받는 쪽이에요

`Observable`이 값을 보내는 쪽이라면 `Observer`는 값을 받는 쪽이에요. `Subject`와 `Relay`는 값을 받을 수도 있고 다른 구독자에게 다시 전달할 수도 있어요.

```text
Observable -> Observer
```

`subscribe`는 Observable과 Observer를 연결해요.

## Disposable은 구독을 종료해요

`subscribe`, `bind`, `drive`, `emit`은 대부분 `Disposable`을 반환해요. 구독이 더 이상 필요 없을 때 `dispose()`를 호출하면 이벤트 전달을 중단해요.

`DisposeBag`은 여러 Disposable을 한 번에 관리해요. `DisposeBag`이 해제되면 내부 구독도 함께 종료돼요.

```swift
observable
    .subscribe(onNext: { value in
        print(value)
    })
    .disposed(by: disposeBag)
```

ViewController가 가진 `DisposeBag`은 ViewController의 수명과 UI 구독의 수명을 맞추는 데 사용해요.

## Subject는 값을 받고 다시 전달해요

Subject는 `Observable`이면서 `Observer`예요. 외부 콜백을 Rx 스트림으로 바꾸거나 테스트에서 원하는 이벤트를 직접 발생시킬 때 사용할 수 있어요.

Subject는 `.error`와 `.completed`를 받을 수 있어요. 한 번 종료되면 다시 값을 전달할 수 없어요.

| 타입 | 초기값 | 새 구독자에게 과거 값 전달 | 주 용도 |
| --- | --- | --- | --- |
| `PublishSubject` | 없음 | 전달하지 않음 | 지금부터 발생하는 이벤트 |
| `BehaviorSubject` | 필요 | 최신 값 1개 | 현재 상태와 종료 이벤트가 모두 필요한 경우 |
| `ReplaySubject` | 설정에 따라 다름 | 지정한 개수만큼 전달 | 과거 이벤트 재생 |
| `AsyncSubject` | 없음 | 완료할 때 마지막 값 1개 | 완료 시점의 마지막 결과 |

### PublishSubject

구독 이후에 발생한 값만 전달해요.

```swift
let tapped = PublishSubject<Void>()

tapped.onNext(())
```

### BehaviorSubject

초기값이 필요하고 새 구독자에게 최신 값을 전달해요.

```swift
let state = BehaviorSubject<String>(value: "idle")

state.onNext("loading")
```

### ReplaySubject

지정한 개수의 이전 값을 새 구독자에게 다시 전달해요.

```swift
let messages = ReplaySubject<String>.create(bufferSize: 2)
```

### AsyncSubject

스트림이 완료될 때 마지막 값만 전달해요.

```swift
let result = AsyncSubject<Int>()

result.onNext(1)
result.onNext(2)
result.onCompleted() // 구독자는 2를 받아요.
```

## Relay는 종료되지 않는 값 통로예요

Relay는 Subject를 감싸지만 `.error`와 `.completed`를 받지 않아요. 값은 `onNext` 대신 `accept`로 전달해요.

UI 상태와 사용자 입력처럼 앱이 살아 있는 동안 계속 사용할 스트림에는 Subject보다 Relay가 안전해요.

| 타입 | 초기값 | 새 구독자에게 과거 값 전달 | 주 용도 |
| --- | --- | --- | --- |
| `PublishRelay` | 없음 | 전달하지 않음 | 일회성 입력과 명령 |
| `BehaviorRelay` | 필요 | 최신 값 1개 | 현재 화면 상태 |
| `ReplayRelay` | 설정에 따라 다름 | 지정한 개수만큼 전달 | 종료 없는 이벤트 재생 |

### PublishRelay

현재부터 발생하는 이벤트만 전달해요.

```swift
let alertRelay = PublishRelay<String>()

alertRelay.accept("위치 요청 실패")
```

### BehaviorRelay

현재 값을 보관하며 `.value`로 최신 값을 읽을 수 있어요.

```swift
let stateRelay = BehaviorRelay<String>(value: "idle")

stateRelay.accept("loading")
print(stateRelay.value)
```

### ReplayRelay

지정한 개수의 이전 이벤트를 다시 전달해요.

```swift
let recentSearches = ReplayRelay<String>.create(bufferSize: 3)
```

Relay는 메인 스레드를 자동으로 보장하지 않아요. 여러 스레드에서 값을 넣는다면 스케줄러와 동시 접근을 따로 관리해야 해요.

## 한 번의 비동기 작업에는 PrimitiveSequence를 사용해요

네트워크 요청이나 저장 작업처럼 결과 개수가 정해진 작업에는 일반 `Observable`보다 의도가 분명한 타입을 사용할 수 있어요.

| 타입 | 성공 결과 | 실패 가능 | 주 용도 |
| --- | --- | --- | --- |
| `Single<Element>` | 값 1개 | 가능 | API 요청, 위치 한 번 조회 |
| `Completable` | 값 없이 완료 | 가능 | 저장, 삭제, 로그아웃 |
| `Maybe<Element>` | 값 0개 또는 1개 | 가능 | 값이 없을 수 있는 단일 조회 |
| `Infallible<Element>` | 값 0개 이상 | 불가능 | 실패하지 않는 일반 스트림 |

```swift
let coordinate: Single<Coordinate> = provider.requestLocation()
let save: Completable = Completable.empty()
let cachedValue: Maybe<String> = Maybe.empty()
let safeValues: Infallible<Int> = Infallible.just(1)
```

## RxCocoa 타입은 UI에 필요한 규칙을 보장해요

`Observable`은 실행 스레드, 오류, 이벤트 공유 방법을 직접 결정해야 해요. RxCocoa의 Trait와 `Binder`는 UI에서 자주 필요한 규칙을 타입으로 표현해요.

| 타입 | 최신 값 재전달 | 메인 스레드 | 오류 | 주 용도 |
| --- | --- | --- | --- | --- |
| `ControlEvent` | 없음 | 보장 | 전달하지 않음 | 버튼 탭과 화면 생명주기 |
| `ControlProperty` | 현재 값 전달 | 보장 | 전달하지 않음 | 텍스트와 선택 상태 같은 UI 속성 |
| `Driver` | 연결 중 최신 값 1개 | 보장 | 전달하지 않음 | 화면이 계속 표시할 상태 |
| `Signal` | 없음 | 보장 | 전달하지 않음 | 알림과 화면 이동 같은 일회성 명령 |
| `Binder` | 해당 없음 | 기본적으로 보장 | 받지 않음 | 값을 UI 속성에 쓰는 목적지 |

### ControlEvent

UIKit에서 발생한 사용자 입력을 표현해요. 초기값이나 과거 이벤트를 전달하지 않아요.

```swift
let tapped: ControlEvent<Void> = locationButton.rx.tap
```

화면 생명주기를 Rx 이벤트로 감싼 확장이 있다면 `ControlEvent<Void>`로 표현할 수 있어요. 이 확장은 모든 프로젝트에 기본으로 제공되지는 않아요.

### ControlProperty

UI가 가진 현재 값과 이후 변경을 함께 표현해요. 읽기와 쓰기가 모두 가능한 속성에 주로 사용해요.

```swift
let text: ControlProperty<String?> = textField.rx.text
```

### Driver

화면이 계속 표시해야 하는 현재 상태에 사용해요. 메인 스레드 전달, 오류 없음, 구독 간 작업 공유, 연결 중 최신 값 재전달을 보장해요.

```swift
let state: Driver<State> = stateRelay.asDriver()

state
    .drive(onNext: { state in
        print(state)
    })
    .disposed(by: disposeBag)
```

### Signal

한 번 발생하고 지나가는 UI 명령에 사용해요. 메인 스레드에서 전달하고 오류가 없지만 이전 값을 재전달하지 않아요.

```swift
let alert: Signal<String> = alertRelay.asSignal()

alert
    .emit(onNext: { alert in
        print(alert)
    })
    .disposed(by: disposeBag)
```

### Binder

값을 받기만 하는 UI 목적지예요. 직접 만들 수도 있지만 `label.rx.text`, `button.rx.isEnabled`처럼 RxCocoa가 제공하는 Binder를 주로 사용해요.

```swift
viewModel.title
    .bind(to: titleLabel.rx.text)
    .disposed(by: disposeBag)
```

## 같은 버튼을 RxSwift와 RxCocoa로 연결해요

UIKit 버튼 탭을 ViewModel의 `currentLocationTapped` Input으로 전달한다고 가정해요. RxCocoa를 사용하지 않아도 구현할 수 있지만, UIKit 콜백을 Rx 이벤트로 바꾸는 코드를 직접 작성해야 해요.

### RxCocoa 없이 PublishSubject로 연결하기

RxSwift만 사용하면 `UIButton`의 Target-Action을 `PublishSubject<Void>`로 전달해요.

```swift
import RxSwift
import UIKit

final class LocationViewController: UIViewController {
    private let locationButton = UIButton(type: .system)
    private let currentLocationTapped = PublishSubject<Void>()

    override func viewDidLoad() {
        super.viewDidLoad()

        locationButton.addTarget(
            self,
            action: #selector(didTapCurrentLocation),
            for: .touchUpInside
        )

        let input = LocationViewModel.Input(
            currentLocationTapped: currentLocationTapped.asObservable()
        )
    }

    /// UIKit 버튼 탭을 RxSwift 이벤트로 변환합니다.
    @objc private func didTapCurrentLocation() {
        currentLocationTapped.onNext(())
    }
}
```

이 방식의 흐름은 아래와 같아요.

```text
UIButton 터치
  -> addTarget
  -> @objc 메서드
  -> PublishSubject.onNext(())
  -> ViewModel Input
```

`PublishSubject`는 UIKit 콜백과 RxSwift 사이의 수동 연결 통로예요. RxCocoa를 사용할 수 없거나 Rx로 제공되지 않는 외부 SDK 콜백을 연결할 때 같은 방식이 필요할 수 있어요.

### RxCocoa의 ControlEvent로 연결하기

RxCocoa는 `UIButton`의 탭을 `ControlEvent<Void>`로 제공해요. 별도의 Subject, Target-Action, `@objc` 메서드가 필요하지 않아요.

```swift
import RxCocoa
import RxSwift
import UIKit

final class LocationViewController: UIViewController {
    private let locationButton = UIButton(type: .system)

    override func viewDidLoad() {
        super.viewDidLoad()

        let input = LocationViewModel.Input(
            currentLocationTapped: locationButton.rx.tap.asObservable()
        )
    }
}
```

이 방식의 흐름은 아래와 같아요.

```text
UIButton 터치
  -> button.rx.tap
  -> ViewModel Input
```

버튼을 눌렀을 때 ViewModel Input 전달 외에 직접 실행할 코드가 있다면 `bind(onNext:)`를 사용할 수 있어요.

```swift
locationButton.rx.tap
    .bind(onNext: {
        print("위치 버튼 탭")
    })
    .disposed(by: disposeBag)
```

### 두 방식을 비교해요

| 비교 항목 | UIKit + RxSwift | RxCocoa |
| --- | --- | --- |
| 버튼 이벤트 시작점 | `addTarget` | `button.rx.tap` |
| Rx 이벤트 변환 | `PublishSubject.onNext(())`를 직접 호출 | `ControlEvent<Void>`가 자동 제공 |
| 필요한 중간 객체 | `PublishSubject<Void>` | 없음 |
| Objective-C 메서드 | `@objc` 메서드 필요 | 필요 없음 |
| 메인 스레드와 오류 규칙 | 직접 관리 | `ControlEvent`가 메인 스레드와 오류 없음 보장 |
| 적합한 상황 | RxCocoa가 없거나 지원되지 않는 콜백 | UIKit 컨트롤을 일반적으로 연결할 때 |

두 방식 모두 같은 ViewModel Input을 만들 수 있어요. RxCocoa를 사용하는 프로젝트에서는 중간 Subject를 만들지 않고 `rx.tap`을 직접 전달하는 방식을 우선해요. RxCocoa가 지원하지 않는 콜백만 Subject나 Relay로 감싸는 편이 좋아요.

이 비교에서는 두 연결 방식의 차이를 보여주려고 `Observable<Void>` Input을 사용했어요. Input 객체를 먼저 만들고 `PublishRelay<Void>`에 개별 바인딩하는 팀 패턴은 [Input/Output 패턴](rxswift-input-output.md)에서 확인해요.

## subscribe, bind, drive, emit을 구분해요

이 메서드들은 스트림을 최종 소비자에게 연결해요. 반환된 `Disposable`을 보관해야 실제 화면 수명과 구독 수명을 맞출 수 있어요.

### subscribe

가장 기본적인 구독 방법이에요. `.next`, `.error`, `.completed`를 모두 처리할 수 있어요. UI 전용 규칙은 보장하지 않아요.

```swift
observable
    .subscribe(
        onNext: { value in
            print(value)
        },
        onError: { error in
            print(error)
        },
        onCompleted: {
            print("완료")
        }
    )
    .disposed(by: disposeBag)
```

일반 비동기 흐름, 데이터 계층, 디버깅처럼 오류와 완료를 직접 처리해야 할 때 사용해요.

### bind(to:)

값을 다른 Observer, Relay, Subject, Binder에 그대로 전달해요. 중간에 별도 동작이 필요하지 않을 때 사용해요.

```swift
textField.rx.text.orEmpty
    .bind(to: queryRelay)
    .disposed(by: disposeBag)
```

```swift
viewModel.title
    .bind(to: titleLabel.rx.text)
    .disposed(by: disposeBag)
```

### bind(onNext:)

값을 받을 때 메서드 호출이나 여러 동작을 직접 실행해야 할 때 사용해요.

```swift
locationButton.rx.tap
    .bind(onNext: {
        print("위치 버튼 탭")
    })
    .disposed(by: disposeBag)
```

`bind`는 UI 바인딩처럼 오류가 없어야 하는 흐름에 사용해요. 오류가 발생할 수 있는 Observable이라면 먼저 `catch` 등으로 오류 정책을 정해야 해요.

### drive

`Driver`를 UI나 클로저에 연결해요. `Driver`의 메인 스레드, 오류 없음, 최신 상태 공유 규칙을 유지해요.

```swift
output.state
    .drive(onNext: { [weak self] state in
        self?.renderState(state)
    })
    .disposed(by: disposeBag)
```

### emit

`Signal`을 UI나 클로저에 연결해요. 과거 이벤트를 재실행하지 않는 일회성 흐름에 사용해요.

```swift
output.alert
    .emit(onNext: { [weak self] alert in
        self?.renderAlert(alert)
    })
    .disposed(by: disposeBag)
```

## 자주 쓰는 생성 연산자

| 연산자 | 설명 | 간단한 예시 |
| --- | --- | --- |
| `just` | 값 하나를 전달해요. | `Observable.just(1)` |
| `from` | 배열 등의 각 요소를 순서대로 전달해요. | `Observable.from([1, 2, 3])` |
| `of` | 전달한 인자를 각각 이벤트로 만들어요. | `Observable.of(1, 2, 3)` |
| `create` | 이벤트 발생 규칙을 직접 만들어요. | `Observable<Int>.create { observer in ... }` |
| `deferred` | 구독할 때 Observable을 새로 만들어요. | `Observable.deferred { makeRequest() }` |
| `empty` | 값 없이 바로 완료해요. | `Observable<Int>.empty()` |
| `never` | 값도 종료도 전달하지 않아요. | `Observable<Int>.never()` |

## 값을 바꾸고 걸러내는 연산자

| 연산자 | 설명 | 간단한 예시 |
| --- | --- | --- |
| `map` | 각 값을 다른 값으로 바꿔요. | `.map { $0.name }` |
| `compactMap` | `nil`을 제거하면서 값을 바꿔요. | `.compactMap { Int($0) }` |
| `filter` | 조건을 만족하는 값만 통과시켜요. | `.filter { $0.isValid }` |
| `distinctUntilChanged` | 직전 값과 같은 연속 값을 제거해요. | `.distinctUntilChanged()` |
| `scan` | 이전 누적값으로 새 값을 만들어요. | `.scan(0, accumulator: +)` |
| `startWith` | 구독 직후 지정한 값을 먼저 전달해요. | `.startWith(.idle)` |
| `skip` | 앞에서 지정한 개수만큼 건너뛰어요. | `.skip(1)` |
| `take` | 앞에서 지정한 개수만 받아요. | `.take(1)` |

## 비동기 작업을 연결하는 연산자

| 연산자 | 새 입력이 오면 기존 작업을 어떻게 하나요 | 적합한 상황 |
| --- | --- | --- |
| `flatMap` | 기존 작업과 새 작업을 모두 유지해요. | 여러 요청을 동시에 처리할 때 |
| `flatMapLatest` | 이전 내부 구독을 해제하고 최신 결과만 전달해요. 실제 작업 취소 여부는 원본 구현에 달려 있어요. | 검색어 자동 완성 |
| `flatMapFirst` | 기존 작업이 끝날 때까지 새 입력을 무시해요. | 중복 로그인이나 위치 요청 방지 |
| `concatMap` | 앞 작업이 끝날 때까지 새 작업을 대기시켜요. | 요청 순서를 반드시 지킬 때 |

```swift
query
    .flatMapLatest { keyword in
        repository.search(keyword)
    }
```

위치 요청 중 연속 탭을 무시하려면 `flatMapFirst`를 선택할 수 있어요.

## 여러 스트림을 합치는 연산자

| 연산자 | 동작 | 적합한 상황 |
| --- | --- | --- |
| `merge` | 같은 타입의 여러 스트림 이벤트를 하나로 합쳐요. | 자동 요청과 버튼 요청 합치기 |
| `combineLatest` | 각 스트림의 최신 값을 조합해요. | 이메일과 비밀번호 유효성 조합 |
| `zip` | 각 스트림의 같은 순번 값을 한 쌍으로 묶어요. | 순서가 맞는 결과 조합 |
| `withLatestFrom` | 기준 이벤트가 발생할 때 다른 스트림의 최신 값을 가져와요. | 버튼 탭 시 최신 입력값 사용 |

```swift
loginButton.rx.tap
    .withLatestFrom(credentials)
```

## 시간과 중복 입력을 다루는 연산자

| 연산자 | 동작 | 적합한 상황 |
| --- | --- | --- |
| `debounce` | 일정 시간 새 이벤트가 없을 때 마지막 값을 전달해요. | 검색어 입력 |
| `throttle` | 일정 시간 동안 이벤트 전달 횟수를 제한해요. | 연속 버튼 탭 방지 |
| `delay` | 이벤트 전달을 늦춰요. | 표시 타이밍 조정과 테스트 |
| `timeout` | 제한 시간 안에 이벤트가 없으면 오류를 발생시켜요. | 위치 조회와 네트워크 제한 시간 |

## 오류를 다루는 연산자

| 연산자 | 동작 | 간단한 예시 |
| --- | --- | --- |
| `catch` | 오류를 다른 Observable로 바꿔요. | `.catch { _ in .just([]) }` |
| `catchAndReturn` | 오류가 발생하면 지정한 값을 전달해요. | `.catchAndReturn([])` |
| `retry` | 오류가 발생하면 다시 구독해요. | `.retry(2)` |
| `materialize` | 이벤트를 값으로 바꿔 오류도 일반 값처럼 다뤄요. | `.materialize()` |

오류를 무조건 빈 값으로 바꾸면 원인을 잃을 수 있어요. 사용자에게 보여줄 오류, 재시도할 오류, 기록만 할 오류를 먼저 구분한 뒤 연산자를 선택해요.

## 스레드를 정하는 연산자

| 연산자 | 바꾸는 위치 | 적합한 상황 |
| --- | --- | --- |
| `subscribe(on:)` | 구독과 원본 작업이 시작되는 스케줄러 | 파일 읽기, 무거운 계산 시작 |
| `observe(on:)` | 이후 이벤트를 받는 스케줄러 | 결과를 메인 스레드에서 UI에 반영 |

```swift
repository.load()
    .subscribe(on: ConcurrentDispatchQueueScheduler(qos: .userInitiated))
    .observe(on: MainScheduler.instance)
```

`Driver`, `Signal`, `ControlEvent`, `ControlProperty`는 메인 스레드 전달을 보장하므로 UI 연결 직전에 `observe(on: MainScheduler.instance)`를 반복할 필요가 없어요.

## 부수 효과와 공유를 다루는 연산자

| 연산자 | 동작 | 적합한 상황 |
| --- | --- | --- |
| `do` | 값은 바꾸지 않고 로그나 상태 기록을 실행해요. | 세션 요청 횟수 기록 |
| `share` | 여러 구독자가 하나의 원본 작업을 공유해요. | 네트워크 요청 중복 방지 |
| `take(until:)` | 다른 스트림이 이벤트를 내면 현재 구독을 끝내요. | 화면이 사라질 때 요청 취소 |

```swift
let sharedRequest = repository.load()
    .share(replay: 1, scope: .whileConnected)
```

`share` 없이 Cold Observable을 여러 번 구독하면 네트워크 요청이나 계산도 여러 번 실행될 수 있어요.

## Subject와 Relay를 남용하지 않아요

기존 UIKit 콜백을 Rx로 바꿔야 할 때 Subject나 Relay가 필요할 수 있어요. 하지만 RxCocoa가 이미 제공하는 이벤트를 다시 Subject로 전달할 필요는 없어요.

```swift
// 불필요한 중간 통로
button.rx.tap
    .bind(to: buttonTappedRelay)

// Input에서 직접 사용
let buttonTapped = button.rx.tap.asObservable()
```

다른 스트림 안에서 `subscribe`를 다시 호출하는 중첩 구독도 피해야 해요. `flatMap`, `flatMapLatest`, `flatMapFirst` 중 동시 실행 정책에 맞는 연산자를 사용해요.

## 위치 조회 화면에서는 이렇게 사용할 수 있어요

아래 표는 RxSwift와 RxCocoa를 채택한 가상 UIKit 화면의 타입 선택 예시예요.

| 위치 | 타입 | 이유 |
| --- | --- | --- |
| `locationButton.rx.tap` | `ControlEvent<Void>` | UIKit 버튼 입력이기 때문이에요. |
| 화면 생명주기 Rx 확장(있는 경우) | `ControlEvent<Void>` | 화면 생명주기 이벤트를 감싸서 전달해요. |
| ViewModel `Input` | `Observable<Void>` | UI와 테스트가 서로 다른 입력 스트림을 넣을 수 있어요. |
| `stateRelay` | `BehaviorRelay<State>` | ViewModel 내부에서 현재 상태를 보관해요. |
| Output `state` | `Driver<State>` | UI가 최신 상태를 메인 스레드에서 받아요. |
| `cameraCommandRelay` | `PublishRelay<CameraCommand>` | 내부에서 일회성 카메라 명령을 발생시켜요. |
| Output `cameraCommand` | `Signal<CameraCommand>` | 과거 카메라 명령을 재실행하지 않아요. |
| `alertRelay` | `PublishRelay<String>` | 내부에서 일회성 알림을 발생시켜요. |
| Output `alert` | `Signal<String>` | 이전 알림을 다시 표시하지 않아요. |
| `requestLocation()` | `Single<Coordinate>` | 위치를 한 번 성공하거나 오류로 종료해요. |

## 최종 선택표

이 표는 RxSwift·RxCocoa에서 가능한 타입 선택을 정리한 일반 참고표예요. 프로젝트에서 `Driver`·`Signal`을 쓰지 않기로 결정했다면 해당 행을 팀 권장안으로 해석하지 말고 [바인딩 정책](rxswift-binding-policy.md)을 우선 확인해요.

| 상황 | 만들 타입 | 연결 방법 |
| --- | --- | --- |
| 일반적인 여러 값과 오류를 처리해요. | `Observable` | `subscribe` |
| API가 값 하나 또는 오류를 반환해요. | `Single` | `subscribe` |
| 값 없이 성공 또는 오류만 필요해요. | `Completable` | `subscribe` |
| 값이 없을 수도 있는 단일 결과가 필요해요. | `Maybe` | `subscribe` |
| 버튼 탭이나 화면 생명주기를 받아요. | `ControlEvent` | `bind` 또는 Input에 직접 전달 |
| 텍스트 필드의 현재 값과 변경을 받아요. | `ControlProperty` | `bind` |
| ViewModel 내부에서 현재 상태를 보관해요. | `BehaviorRelay` | `accept` |
| ViewModel 내부에서 일회성 이벤트를 발생시켜요. | `PublishRelay` | `accept` |
| 화면이 계속 표시할 최신 상태를 출력해요. | `Driver` | `drive` |
| 알림, 화면 이동, 카메라 이동을 한 번 실행해요. | `Signal` | `emit` |
| 값을 Relay나 UI 속성에 그대로 전달해요. | `Observable` 또는 `ControlProperty` | `bind(to:)` |
| 값을 받을 때 직접 여러 동작을 실행해요. | `Observable` 또는 `ControlEvent` | `bind(onNext:)` |
| 오류와 완료를 직접 처리해야 해요. | `Observable` | `subscribe` |

가장 짧게 기억하면 아래와 같아요.

```text
일반 스트림은 Observable
UI 입력은 ControlEvent
내부 상태는 BehaviorRelay
내부 사건은 PublishRelay
화면 상태 출력은 Driver
일회성 UI 출력은 Signal
오류까지 처리하면 subscribe
그대로 연결하면 bind(to:)
직접 동작하면 bind(onNext:)
Driver는 drive
Signal은 emit
```
