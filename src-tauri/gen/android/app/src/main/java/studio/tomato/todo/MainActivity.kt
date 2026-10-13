package studio.tomato.todo

import android.os.Bundle
import androidx.activity.enableEdgeToEdge
import android.webkit.WebView
import android.view.ViewGroup
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.activity.OnBackPressedCallback

class MainActivity : TauriActivity() {
  override val handleBackNavigation: Boolean = false
  private var appWebView: WebView? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() {
        val view = appWebView
        if (view == null) {
          moveTaskToBack(true)
          return
        }
        view.evaluateJavascript("Boolean(window.tomatoBack && window.tomatoBack())") { handled ->
          if (handled != "true") moveTaskToBack(true)
        }
      }
    })
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    appWebView = webView
    // The native viewport excludes system bars, display cutouts and the keyboard.
    // CSS can then use the visible WebView size without guessing device insets.
    ViewCompat.setOnApplyWindowInsetsListener(webView) { view, insets ->
      val safe = insets.getInsets(
        WindowInsetsCompat.Type.systemBars() or
          WindowInsetsCompat.Type.displayCutout() or WindowInsetsCompat.Type.ime()
      )
      val layout = view.layoutParams as ViewGroup.MarginLayoutParams
      if (layout.leftMargin != safe.left || layout.topMargin != safe.top ||
          layout.rightMargin != safe.right || layout.bottomMargin != safe.bottom) {
        layout.setMargins(safe.left, safe.top, safe.right, safe.bottom)
        view.layoutParams = layout
      }
      WindowInsetsCompat.CONSUMED
    }
    ViewCompat.requestApplyInsets(webView)
  }
}
