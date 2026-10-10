import Darwin
import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings

// The app and extension share one opaque selection and grant record. A file lock
// keeps an expired callback from restoring shields after an emergency release.
@available(iOS 16.0, *)
enum FocusStorage {
  static let storeName = ManagedSettingsStore.Name("InterviewFocus")
  static let expiryActivity = DeviceActivityName("InterviewFocus.unlockExpiry")
  static let recoveryActivity = DeviceActivityName("InterviewFocus.recovery")

  struct State: Codable {
    var selection = FamilyActivitySelection(includeEntireCategory: false)
    var enabled = false
    var unlockUntil: Date?
    var emergencyReleased = false

    private enum CodingKeys: String, CodingKey {
      case selection, enabled, unlockUntil, emergencyReleased
    }

    init() {}

    init(from decoder: Decoder) throws {
      let values = try decoder.container(keyedBy: CodingKeys.self)
      selection = try values.decodeIfPresent(FamilyActivitySelection.self, forKey: .selection) ?? FamilyActivitySelection(includeEntireCategory: false)
      enabled = try values.decodeIfPresent(Bool.self, forKey: .enabled) ?? false
      unlockUntil = try values.decodeIfPresent(Date.self, forKey: .unlockUntil)
      emergencyReleased = try values.decodeIfPresent(Bool.self, forKey: .emergencyReleased) ?? false
    }
  }

  enum Failure: LocalizedError {
    case message(String)
    var errorDescription: String? {
      switch self {
      case .message(let message): return message
      }
    }
  }

  static var authorized: Bool {
    AuthorizationCenter.shared.authorizationStatus == .approved
  }

  private static func transaction<T>(resetUnreadable: Bool = false, _ operation: (inout State, ManagedSettingsStore) throws -> T) throws -> T {
    guard let group = Bundle.main.object(forInfoDictionaryKey: "InterviewFocusAppGroup") as? String,
      let directory = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) else {
      throw Failure.message("Screen Time App Group is unavailable. Check signing and rebuild this app.")
    }
    let descriptor = Darwin.open(directory.appendingPathComponent("interview-focus.lock").path, O_CREAT | O_RDWR, 0o600)
    guard descriptor >= 0 else { throw Failure.message("Unable to open the Screen Time state lock.") }
    defer { Darwin.close(descriptor) }
    guard flock(descriptor, LOCK_EX) == 0 else { throw Failure.message("Unable to lock Screen Time state.") }
    defer { flock(descriptor, LOCK_UN) }

    let stateURL = directory.appendingPathComponent("interview-focus.json")
    var state = State()
    if FileManager.default.fileExists(atPath: stateURL.path) {
      do {
        state = try JSONDecoder().decode(State.self, from: Data(contentsOf: stateURL))
      } catch {
        if !resetUnreadable { throw Failure.message("Saved Screen Time selection could not be read. Use emergency release, then select apps again.") }
      }
    }
    let settings = ManagedSettingsStore(named: storeName)
    var previousState = state
    do {
      let result = try operation(&state, settings)
      try JSONEncoder().encode(state).write(to: stateURL, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
      return result
    } catch {
      if resetUnreadable { settings.clearAllSettings() }
      else { apply(&previousState, to: settings, checkAuthorization: false) }
      throw error
    }
  }

  private static func apply(_ state: inout State, to settings: ManagedSettingsStore, checkAuthorization: Bool = true) {
    if checkAuthorization {
      switch AuthorizationCenter.shared.authorizationStatus {
      case .denied:
        let released = state.emergencyReleased
        state = State()
        state.emergencyReleased = released
        settings.clearAllSettings()
        return
      case .notDetermined:
        // This is also the initial value after launch. It does not prove that a
        // previously authorized selection was revoked.
        return
      default: break
      }
    }
    if state.emergencyReleased {
      state.enabled = false
      state.unlockUntil = nil
      settings.clearAllSettings()
      return
    }
    if let expiry = state.unlockUntil, expiry <= Date() { state.unlockUntil = nil }
    if state.enabled && state.unlockUntil == nil && !state.selection.applicationTokens.isEmpty {
      settings.shield.applications = state.selection.applicationTokens
    } else {
      settings.clearAllSettings()
    }
  }

  static func reconcile(checkAuthorization: Bool = true) throws {
    try transaction { state, settings in apply(&state, to: settings, checkAuthorization: checkAuthorization) }
  }

  static func status() throws -> [String: Any] {
    try transaction { state, settings in
      apply(&state, to: settings)
      let count = state.selection.applicationTokens.count
      let blocking = !(settings.shield.applications?.isEmpty ?? true)
      let reason: String
      if state.emergencyReleased {
        reason = "Emergency release is active. App blocking stays off until you choose Resume app blocking."
      } else if AuthorizationCenter.shared.authorizationStatus == .notDetermined {
        reason = "Screen Time access has not been checked this launch. Tap Allow Screen Time to check access before changing focus settings."
      } else if !authorized {
        reason = "Allow Screen Time access to shield selected apps. You can revoke access in iPhone Settings."
      } else if count == 0 {
        reason = "Screen Time access granted. Choose individual apps to protect."
      } else if blocking {
        reason = "Selected apps are shielded. Pass practice to earn access, or use emergency release."
      } else if let expiry = state.unlockUntil {
        reason = "Selected apps are unlocked until \(ISO8601DateFormatter().string(from: expiry))."
      } else {
        reason = "Selected apps are available. Start a focus session to shield them."
      }
      return ["supported": true, "authorized": authorized, "selectedCount": count, "blocking": blocking, "emergencyReleased": state.emergencyReleased, "reason": reason]
    }
  }

  static func selection() throws -> FamilyActivitySelection {
    try transaction { state, _ in state.selection }
  }

  static func saveSelection(_ selection: FamilyActivitySelection) throws {
    guard authorized else { throw Failure.message("Screen Time access was revoked. Authorize again before selecting apps.") }
    try transaction { state, settings in
      var appsOnly = FamilyActivitySelection(includeEntireCategory: false)
      appsOnly.applicationTokens = selection.applicationTokens
      state.selection = appsOnly
      if appsOnly.applicationTokens.isEmpty { state.enabled = false; state.unlockUntil = nil }
      apply(&state, to: settings)
    }
  }

  private static func ensureRecoveryMonitor() throws {
    let center = DeviceActivityCenter()
    if !center.activities.contains(recoveryActivity) {
      try center.startMonitoring(recoveryActivity, during: DeviceActivitySchedule(
        intervalStart: DateComponents(hour: 0, minute: 0, second: 0),
        intervalEnd: DateComponents(hour: 23, minute: 59, second: 59),
        repeats: true
      ))
    }
  }

  static func lock() throws {
    guard authorized else { throw Failure.message("Screen Time access is required to shield apps.") }
    try ensureRecoveryMonitor()
    try transaction { state, settings in
      guard !state.selection.applicationTokens.isEmpty else { throw Failure.message("Choose at least one individual app first.") }
      state.emergencyReleased = false
      state.enabled = true
      state.unlockUntil = nil
      apply(&state, to: settings)
    }
    DeviceActivityCenter().stopMonitoring([expiryActivity])
  }

  static func unlock(until timestamp: Double) throws {
    let expiry = Date(timeIntervalSince1970: timestamp)
    guard timestamp.isFinite, expiry > Date() else { throw Failure.message("Unlock expiry must be a future date.") }
    try transaction { state, settings in
      if state.emergencyReleased {
        settings.clearAllSettings()
        return
      }
      guard authorized else { throw Failure.message("Screen Time access was revoked. Apps are no longer shielded.") }
      guard !state.selection.applicationTokens.isEmpty else { throw Failure.message("Choose at least one individual app first.") }
      try ensureRecoveryMonitor()
      state.enabled = true
      state.unlockUntil = expiry
      // Apple requires a monitoring interval of at least fifteen minutes. A past
      // start keeps even short rewards inside an ongoing sixteen-minute interval.
      let start = min(Date().addingTimeInterval(-1), expiry.addingTimeInterval(-16 * 60))
      let calendar = Calendar.current
      let fields: Set<Calendar.Component> = [.year, .month, .day, .hour, .minute, .second]
      var startComponents = calendar.dateComponents(fields, from: start)
      var endComponents = calendar.dateComponents(fields, from: expiry)
      startComponents.timeZone = calendar.timeZone
      endComponents.timeZone = calendar.timeZone
      try DeviceActivityCenter().startMonitoring(expiryActivity, during: DeviceActivitySchedule(
        intervalStart: startComponents, intervalEnd: endComponents, repeats: false
      ))
      settings.clearAllSettings()
    }
  }

  static func release(forgetSelection: Bool = false, emergency: Bool = false) throws {
    // Clear first even when App Group storage is unavailable or corrupted.
    ManagedSettingsStore(named: storeName).clearAllSettings()
    defer { DeviceActivityCenter().stopMonitoring([expiryActivity, recoveryActivity]) }
    try transaction(resetUnreadable: true) { state, settings in
      let released = state.emergencyReleased || emergency
      if forgetSelection { state = State() }
      state.emergencyReleased = released
      state.enabled = false
      state.unlockUntil = nil
      settings.clearAllSettings()
    }
  }
}
