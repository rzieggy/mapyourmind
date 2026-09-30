#!/bin/zsh
set -euo pipefail
cd "${0:A:h}"
for script in web/*.js; do node --check "$script"; done
app="dist/mapyourmind.app"
mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources/web" .build-cache
swiftc -O -target arm64-apple-macosx13.0 -module-cache-path .build-cache -framework Cocoa -framework WebKit -framework PDFKit src/*.swift -o "$app/Contents/MacOS/mapyourmind"
rm -rf "$app/Contents/Resources/web"
mkdir -p "$app/Contents/Resources/web"
cp -R web/. "$app/Contents/Resources/web/"
cp assets/AppIcon.icns "$app/Contents/Resources/AppIcon.icns"
cp tests/integration.js "$app/Contents/Resources/integration.js"
for test in tests/*.js; do cp "$test" "$app/Contents/Resources/"; done
cp tests/navigation.js "$app/Contents/Resources/navigation.js"
cp tests/notebook.js "$app/Contents/Resources/notebook.js"
cp Info.plist "$app/Contents/Info.plist"
codesign --force --deep --sign - "$app"
"$app/Contents/MacOS/mapyourmind" --storage-test
