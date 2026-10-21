# Proguard rules for AshTube
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

-keepattributes JavascriptInterface
-keepclassmembers class com.ashtube.app.MainActivity$** {
    *;
}

# AndroidX WebKit
-dontwarn androidx.webkit.**
-keep class androidx.webkit.** { *; }
