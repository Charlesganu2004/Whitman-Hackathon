import Combine
import ExpoModulesCore
import FamilyControls
import SwiftUI
import UIKit

public class InterviewFocusModule: Module {
  private var authorizationObserver: AnyCancellable?
  private var foregroundObserver: NSObjectProtocol?
  private var picker: UIViewController?
  private var hasObservedAuthorization = false

  public func definition() -> ModuleDefinition {
    Name("InterviewFocus")

    OnCreate {
      if #available(iOS 16.0, *) {
        self.authorizationObserver = AuthorizationCenter.shared.$authorizationStatus
          .receive(on: DispatchQueue.main)
          .sink { status in
            if FocusStorage.authorized {
              self.hasObservedAuthorization = true
              try? FocusStorage.reconcile()
            } else if status == .denied || self.hasObservedAuthorization {
              self.hasObservedAuthorization = false
              try? FocusStorage.release(forgetSelection: true)
            }
          }
        self.foregroundObserver = NotificationCenter.default.addObserver(
          forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main
        ) { _ in try? FocusStorage.reconcile() }
      }
    }

    OnDestroy {
      self.authorizationObserver?.cancel()
      if let observer = self.foregroundObserver { NotificationCenter.default.removeObserver(observer) }
      DispatchQueue.main.async {
        self.picker?.dismiss(animated: false)
        self.picker = nil
      }
    }

    AsyncFunction("focusStatus") { () -> [String: Any] in
      guard #available(iOS 16.0, *) else {
        return ["supported": false, "authorized": false, "selectedCount": 0, "blocking": false, "emergencyReleased": false, "reason": "App shielding requires iOS 16 or later."]
      }
      do { return try FocusStorage.status() }
      catch {
        try? FocusStorage.release()
        return ["supported": true, "authorized": FocusStorage.authorized, "selectedCount": 0, "blocking": false, "emergencyReleased": false, "reason": error.localizedDescription]
      }
    }.runOnQueue(.main)

    AsyncFunction("authorizeFocus") { (promise: Promise) in
      guard #available(iOS 16.0, *) else {
        promise.reject("FOCUS_UNSUPPORTED", "App shielding requires iOS 16 or later.")
        return
      }
      Task { @MainActor in
        do {
          try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
          guard FocusStorage.authorized else { throw FocusStorage.Failure.message("Screen Time access was not granted.") }
          try FocusStorage.reconcile()
          promise.resolve(nil)
        } catch { promise.reject("FOCUS_AUTHORIZATION", error.localizedDescription) }
      }
    }.runOnQueue(.main)

    AsyncFunction("chooseFocusApps") { (promise: Promise) in
      guard #available(iOS 16.0, *) else {
        promise.reject("FOCUS_UNSUPPORTED", "App shielding requires iOS 16 or later.")
        return
      }
      guard FocusStorage.authorized else {
        promise.reject("FOCUS_AUTHORIZATION", "Allow Screen Time access first.")
        return
      }
      guard self.picker == nil, let presenter = self.presenter() else {
        promise.reject("FOCUS_PICKER", "Close the current dialog before choosing apps.")
        return
      }
      do {
        let selection = try FocusStorage.selection()
        let controller = UIHostingController(rootView: FocusPicker(selection: selection) { result in
          defer { self.picker?.dismiss(animated: true); self.picker = nil }
          switch result {
          case .success(let selection):
            do { try FocusStorage.saveSelection(selection); promise.resolve(nil) }
            catch { promise.reject("FOCUS_SELECTION", error.localizedDescription) }
          case .failure(let error): promise.reject("FOCUS_CANCELLED", error.localizedDescription)
          }
        })
        controller.isModalInPresentation = true
        self.picker = controller
        presenter.present(controller, animated: true)
      } catch { promise.reject("FOCUS_SELECTION", error.localizedDescription) }
    }.runOnQueue(.main)

    AsyncFunction("lockFocus") { () throws in
      guard #available(iOS 16.0, *) else { return }
      try FocusStorage.lock()
    }.runOnQueue(.main)

    AsyncFunction("unlockFocus") { (untilTimestamp: Double) throws in
      guard #available(iOS 16.0, *) else { return }
      try FocusStorage.unlock(until: untilTimestamp)
    }.runOnQueue(.main)

    AsyncFunction("emergencyRelease") { () throws in
      guard #available(iOS 16.0, *) else { return }
      try FocusStorage.release(emergency: true)
    }.runOnQueue(.main)
  }

  private func presenter() -> UIViewController? {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    guard let window = scenes.first(where: { $0.activationState == .foregroundActive })?.windows.first(where: { $0.isKeyWindow }),
      var controller = window.rootViewController else { return nil }
    while let presented = controller.presentedViewController { controller = presented }
    return controller
  }
}

@available(iOS 16.0, *)
private struct FocusPicker: View {
  @State var selection: FamilyActivitySelection
  var completion: (Result<FamilyActivitySelection, Error>) -> Void

  var body: some View {
    NavigationStack {
      VStack(alignment: .leading, spacing: 12) {
        Text("Choose individual apps. Website and category selections are not shielded.")
          .font(.footnote).padding(.horizontal)
        Text("Keep Interview Unlocked unselected so you can practice and use emergency release. If you select it accidentally, revoke this app’s Screen Time access in iPhone Settings.")
          .font(.footnote).padding(.horizontal)
        FamilyActivityPicker(selection: $selection)
      }
      .navigationTitle("Apps to protect")
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { completion(.failure(FocusStorage.Failure.message("App selection cancelled."))) }
        }
        ToolbarItem(placement: .confirmationAction) {
          Button("Save") { completion(.success(selection)) }
        }
      }
    }
  }
}
