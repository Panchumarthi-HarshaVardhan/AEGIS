# ============================================================
# JARVIS Guardian AI — OCR Engine
# Screenshot character recognition via pytesseract / fallback
# ============================================================

import os
import cv2
from typing import Dict, Any

class OCREngine:
    def __init__(self):
        self.tesseract_available = True
        try:
            import pytesseract
            # Test availability
            pytesseract.get_tesseract_version()
        except Exception:
            self.tesseract_available = False
            print("OCREngine: Tesseract OCR is not installed or not in PATH. OCR will run in simulation mode.")

    async def extract_text(self, image_path: str) -> Dict[str, Any]:
        """Extracts text content from a screenshot image."""
        if not os.path.exists(image_path):
            return {"success": False, "error": "Image file not found"}

        if not self.tesseract_available:
            # Fallback simulator (reads text from image name or context if available, or returns mock operating text)
            return {
                "success": True,
                "text": (
                    "JARVIS Screen OCR Simulation Mode:\n"
                    "Tesseract binary was not found. Install tesseract on your system ('brew install tesseract' on macOS).\n"
                    "Active Workspace: /Users/pharshavardhan/Documents/Jarvis\n"
                    "Open Apps: VS Code, Chrome Browser, Terminal\n"
                    "Active terminal output: npm run dev status - active"
                ),
                "simulated": True
            }

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
                "simulated": False
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"OCR Extraction failed: {str(e)}",
                "text": ""
            }
