import UIKit
import WebKit
import MapKit

final class PhoneViewController: UIViewController, WKNavigationDelegate {
    private let web = WKWebView()
    private let status = UILabel()
    private let retry = UIButton(type: .system)
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        web.navigationDelegate = self
        status.numberOfLines = 0
        status.textAlignment = .center
        retry.setTitle("Retry", for: .normal)
        retry.addTarget(self, action: #selector(load), for: .touchUpInside)
        let stack = UIStackView(arrangedSubviews: [status, retry, web])
        stack.axis = .vertical
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            stack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            stack.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor)
        ])
        load()
    }
    @objc private func load() {
        status.text = "Loading ROVIQ Local…"
        status.isHidden = false
        retry.isHidden = true
        web.load(URLRequest(url: RoviqAPI.base))
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { status.isHidden = true; retry.isHidden = true }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { failed() }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { failed() }
    private func failed() { status.text = "Cannot load ROVIQ Local. Check your connection."; status.isHidden = false; retry.isHidden = false }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if url.scheme == "https", url.host == RoviqAPI.base.host { decisionHandler(.allow); return }
        decisionHandler(.cancel)
        if url.host == "www.google.com", url.path.hasPrefix("/maps/dir"),
           let destination = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "destination" })?.value {
            let coordinates = destination.split(separator: ",").compactMap { Double($0) }
            if coordinates.count == 2 {
                let item = MKMapItem(placemark: MKPlacemark(coordinate: CLLocationCoordinate2D(latitude: coordinates[0], longitude: coordinates[1])))
                item.openInMaps(launchOptions: [MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeDriving])
                return
            }
        }
        if ["https", "tel", "maps"].contains(url.scheme ?? "") { UIApplication.shared.open(url) }
    }
}
