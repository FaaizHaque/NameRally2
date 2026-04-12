#!/usr/bin/env python3
"""
App Store Connect Screenshot Resizer
Resizes screenshots to valid App Store dimensions while retaining quality.

Valid portrait sizes:
  1284 x 2778 — iPhone 6.7" (12/13/14 Pro Max, 14 Plus) — recommended
  1242 x 2688 — iPhone 6.5" (XS Max, 11 Pro Max)

Usage:
  python3 resize_screenshots.py screenshot1.png screenshot2.png ...
  python3 resize_screenshots.py *.png
"""

import sys
import os
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Installing Pillow...")
    os.system("pip3 install Pillow")
    from PIL import Image

# Target: 1284x2778 (iPhone 6.7") — best for modern iPhones
TARGET_W, TARGET_H = 1284, 2778

def resize_screenshot(input_path: str, output_dir: str = "resized") -> str:
    img = Image.open(input_path)
    orig_w, orig_h = img.size
    print(f"  Input:  {orig_w} x {orig_h}px")

    # Determine orientation
    is_landscape = orig_w > orig_h
    if is_landscape:
        tw, th = TARGET_H, TARGET_W   # 2778 x 1284
    else:
        tw, th = TARGET_W, TARGET_H   # 1284 x 2778

    # Scale to fill target, crop center if aspect ratio differs
    scale = max(tw / orig_w, th / orig_h)
    new_w = int(orig_w * scale)
    new_h = int(orig_h * scale)
    img = img.resize((new_w, new_h), Image.LANCZOS)

    # Center crop
    left = (new_w - tw) // 2
    top  = (new_h - th) // 2
    img = img.crop((left, top, left + tw, top + th))

    os.makedirs(output_dir, exist_ok=True)
    name = Path(input_path).stem
    output_path = os.path.join(output_dir, f"{name}_{tw}x{th}.png")
    img.save(output_path, "PNG", optimize=True)
    print(f"  Output: {tw} x {th}px  →  {output_path}")
    return output_path

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    files = sys.argv[1:]
    print(f"Resizing {len(files)} screenshot(s) to {TARGET_W}x{TARGET_H} (App Store 6.7\")...\n")
    for f in files:
        if not os.path.exists(f):
            print(f"  Skipping {f} — file not found")
            continue
        print(f"Processing: {f}")
        try:
            resize_screenshot(f)
        except Exception as e:
            print(f"  ERROR: {e}")
    print("\nDone! Upload the files from the 'resized/' folder to App Store Connect.")
