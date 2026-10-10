import DeviceActivity
import ManagedSettings

class InterviewActivityMonitor: DeviceActivityMonitor {
  override func intervalDidStart(for activity: DeviceActivityName) {
    super.intervalDidStart(for: activity)
    reconcile(activity)
  }

  override func intervalDidEnd(for activity: DeviceActivityName) {
    super.intervalDidEnd(for: activity)
    reconcile(activity)
  }

  private func reconcile(_ activity: DeviceActivityName) {
    guard activity == FocusStorage.expiryActivity || activity == FocusStorage.recoveryActivity else { return }
    // AuthorizationCenter starts undetermined in a new process and may only be
    // read on the main queue. iOS invalidates tokens if authorization is revoked.
    do { try FocusStorage.reconcile(checkAuthorization: false) }
    catch { ManagedSettingsStore(named: FocusStorage.storeName).clearAllSettings() }
  }
}
