import UIKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {}

class PhoneSceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options: UIScene.ConnectionOptions) {
        guard let scene = scene as? UIWindowScene else { return }
        let window = UIWindow(windowScene: scene)
        window.rootViewController = PhoneViewController()
        window.makeKeyAndVisible()
        self.window = window
    }
}
