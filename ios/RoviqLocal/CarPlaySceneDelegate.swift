import CarPlay
import CoreLocation
import MapKit

// Connection requires an Apple-approved CarPlay category and matching entitlement.
@MainActor
final class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate, CLLocationManagerDelegate {
    private var controller: CPInterfaceController?
    private let location = CLLocationManager()
    private var task: Task<Void, Never>?
    private var timeout: Task<Void, Never>?
    private var places: [RoviqPlace] = []
    func templateApplicationScene(_ scene: CPTemplateApplicationScene, didConnect interfaceController: CPInterfaceController) {
        controller = interfaceController
        location.delegate = self
        location.desiredAccuracy = kCLLocationAccuracyHundredMeters
        load()
    }
    func templateApplicationScene(_ scene: CPTemplateApplicationScene, didDisconnectInterfaceController interfaceController: CPInterfaceController) {
        task?.cancel(); timeout?.cancel(); location.stopUpdatingLocation(); controller = nil
    }
    private func message(_ title: String, retry: Bool = false) {
        let row = CPListItem(text: title, detailText: retry ? "Tap to retry" : nil)
        if retry { row.handler = { [weak self] _, done in self?.load(); done() } }
        controller?.setRootTemplate(CPListTemplate(title: "ROVIQ Local", sections: [CPListSection(items: [row])]), animated: false, completion: nil)
    }
    private func load() {
        task?.cancel(); timeout?.cancel()
        switch location.authorizationStatus {
        case .notDetermined:
            message("Allow location on your iPhone")
            location.requestWhenInUseAuthorization()
        case .authorizedAlways, .authorizedWhenInUse:
            message("Finding nearby stops…")
            location.requestLocation()
            timeout = Task { [weak self] in
                try? await Task.sleep(nanoseconds: 15_000_000_000)
                guard !Task.isCancelled else { return }
                self?.message("Location timed out", retry: true)
            }
        default: message("Enable ROVIQ location in iPhone Settings", retry: true)
        }
    }
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        if controller != nil && manager.authorizationStatus != .notDetermined { load() }
    }
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        timeout?.cancel(); message("Location unavailable", retry: true)
    }
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        timeout?.cancel()
        guard let fix = locations.last, abs(fix.timestamp.timeIntervalSinceNow) < 60, fix.horizontalAccuracy >= 0 else { message("Waiting for a fresh location", retry: true); return }
        task?.cancel()
        task = Task { [weak self] in
            do {
                let result = try await RoviqAPI.nearby(fix.coordinate)
                guard !Task.isCancelled, let self = self, self.controller != nil else { return }
                self.places = result
                self.showPlaces()
            } catch {
                guard !Task.isCancelled else { return }
                self?.message("Cannot load places. Check your connection.", retry: true)
            }
        }
    }
    private func showPlaces() {
        guard !places.isEmpty else { message("No curated stops nearby yet", retry: true); return }
        let rows = places.prefix(CPListTemplate.maximumItemCount).map { place in
            let distance = place.distance_km.map { String(format: "%.1f km", $0) } ?? ""
            let row = CPListItem(text: place.name, detailText: [place.isPick ? "ROVIQ Pick" : place.category, distance].filter { !$0.isEmpty }.joined(separator: " · "))
            row.handler = { [weak self] _, done in self?.showDetail(place); done() }
            return row
        }
        controller?.setRootTemplate(CPListTemplate(title: "Nearby stops", sections: [CPListSection(items: rows)]), animated: false, completion: nil)
    }
    private func showDetail(_ place: RoviqPlace) {
        let go = CPListItem(text: "Navigate to \(place.name)", detailText: String(place.reason.prefix(100)))
        go.handler = { _, done in
            let destination = MKMapItem(placemark: MKPlacemark(coordinate: CLLocationCoordinate2D(latitude: place.lat, longitude: place.lng)))
            destination.name = place.name
            destination.openInMaps(launchOptions: [MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeDriving])
            done()
        }
        controller?.pushTemplate(CPListTemplate(title: place.name, sections: [CPListSection(items: [go])]), animated: true, completion: nil)
    }
}
