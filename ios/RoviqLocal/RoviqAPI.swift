import Foundation
import CoreLocation

struct RoviqPlace: Decodable {
    let id: Int
    let name: String
    let lat: Double
    let lng: Double
    let category: String
    let why_stop: String?
    let description: String?
    let distance_km: Double?
    let trust_level: String?
    let is_drivers_pick: Int?
    var isPick: Bool { trust_level == "roviq" || is_drivers_pick == 1 }
    var reason: String { why_stop ?? description ?? category }
}
enum RoviqAPI {
    static let base = URL(string: "https://roviq-local2.admytruk79.workers.dev/")!
    private struct Catalog: Decodable { let success: Bool; let places: [RoviqPlace] }
    static func nearby(_ position: CLLocationCoordinate2D) async throws -> [RoviqPlace] {
        var url = URLComponents(url: base.appendingPathComponent("api/places"), resolvingAgainstBaseURL: false)!
        url.queryItems = [URLQueryItem(name: "status", value: "approved"), URLQueryItem(name: "lat", value: String(position.latitude)), URLQueryItem(name: "lng", value: String(position.longitude)), URLQueryItem(name: "radius_km", value: "80")]
        var request = URLRequest(url: url.url!)
        request.timeoutInterval = 15
        request.cachePolicy = .reloadIgnoringLocalCacheData
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else { throw URLError(.badServerResponse) }
        let catalog = try JSONDecoder().decode(Catalog.self, from: data)
        guard catalog.success else { throw URLError(.cannotParseResponse) }
        return catalog.places.filter { CLLocationCoordinate2DIsValid(CLLocationCoordinate2D(latitude: $0.lat, longitude: $0.lng)) }
            .sorted { ($0.distance_km ?? .infinity) < ($1.distance_km ?? .infinity) }
    }
}
