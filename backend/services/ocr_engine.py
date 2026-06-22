# ============================================================
# JARVIS Guardian AI — OCR Engine
# Screenshot character recognition via Swift Vision on macOS / pytesseract / fallback
# ============================================================

import os
import subprocess
import cv2
from typing import Dict, Any

class OCREngine:
    def __init__(self):
        # Determine paths and tool availability
        self.swift_available = False
        try:
            # Check if swift command exists
            res = subprocess.run(["swift", "--version"], capture_output=True, text=True)
            self.swift_available = (res.returncode == 0)
        except Exception:
            self.swift_available = False

        self.tesseract_available = True
        try:
            import pytesseract
            pytesseract.get_tesseract_version()
        except Exception:
            self.tesseract_available = False

        print(f"OCREngine initialized: Swift={self.swift_available}, Tesseract={self.tesseract_available}")

    async def extract_text(self, image_path: str) -> Dict[str, Any]:
        """Extracts text content from a screenshot image."""
        if not os.path.exists(image_path):
            return {"success": False, "error": "Image file not found"}

        # Method 1: Native macOS Vision OCR via Swift script
        if self.swift_available:
            ocr_swift_path = os.path.join(os.path.dirname(__file__), "ocr.swift")
            if os.path.exists(ocr_swift_path):
                try:
                    result = subprocess.run(
                        ["swift", ocr_swift_path, image_path],
                        capture_output=True,
                        text=True,
                        check=True
                    )
                    text = result.stdout.strip()
                    return {
                        "success": True,
                        "text": text,
                        "method": "vision_native",
                        "simulated": False
                    }
                except Exception as e:
                    print(f"OCREngine: Native Swift Vision OCR failed, falling back: {e}")

        # Method 2: Tesseract OCR fallback
        if self.tesseract_available:
            try:
                import pytesseract
                # Read image via OpenCV
                img = cv2.imread(image_path)
                # Convert to gray
                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                # Apply thresholding to clean up background
                gray = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]
                
                text = pytesseract.image_to_string(gray)
                return {
                    "success": True,
                    "text": text.strip(),
                    "method": "pytesseract",
                    "simulated": False
                }
            except Exception as e:
                print(f"OCREngine: pytesseract extraction failed, falling back: {e}")

        # Method 3: Simulation Fallback Mode
        # Extract name or keywords if available, or return hardcoded mock
        return {
            "success": True,
            "text": (
                "JARVIS Screen OCR Simulation Mode:\n"
                "Tesseract binary was not found. Install tesseract on your system ('brew install tesseract' on macOS).\n"
                "Active Workspace: /Users/pharshavardhan/Documents/Jarvis\n"
                "Open Apps: VS Code, Chrome Browser, Terminal\n"
                "Active terminal output: npm run dev status - active"
            ),
            "method": "simulation",
            "simulated": True
        }
