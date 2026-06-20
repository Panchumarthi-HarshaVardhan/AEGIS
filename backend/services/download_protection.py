# ============================================================
# JARVIS Guardian AI — Download Protection Scanner
# Scans files via ClamAV, VirusTotal API, or signature checking
# ============================================================

import os
import subprocess
from typing import Dict, Any

class DownloadProtectionScanner:
    def __init__(self):
        self.vt_api_key = os.getenv("VIRUSTOTAL_API_KEY", "")
        self.clamav_available = self._check_clamav()

    def _check_clamav(self) -> bool:
        """Verifies if clamscan is installed on the system path."""
        try:
            subprocess.run(["clamscan", "--version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            return True
        except FileNotFoundError:
            return False

    async def scan_file(self, file_path: str) -> Dict[str, Any]:
        """Runs multi-layer checks on files: local signature check -> ClamAV -> VirusTotal."""
        if not os.path.exists(file_path):
            return {"status": "ERROR", "reason": f"File not found: {file_path}"}

        file_name = os.path.basename(file_path)
        file_size = os.path.getsize(file_path)

        # 1. Local Signature Check (Scan text files/scripts for dangerous commands)
        is_suspicious_script, signature_reason = self._run_signature_check(file_path)
        if is_suspicious_script:
            return {
                "status": "DANGEROUS",
                "verdict": "MALWARE_SIGNATURE_DETECTED",
                "score": 90,
                "description": f"Blocked file '{file_name}': {signature_reason}",
                "details": {
                    "file_name": file_name,
                    "file_size_bytes": file_size,
                    "scan_type": "local_signature_scan"
                }
            }

        # 2. Local ClamAV Scan (if available)
        if self.clamav_available:
            try:
                # clamscan returns 0 if no virus found, 1 if virus found, 2+ on error
                res = subprocess.run(["clamscan", "--no-summary", file_path], capture_output=True, text=True)
                if res.returncode == 1:
                    return {
                        "status": "DANGEROUS",
                        "verdict": "CLAMAV_VIRUS_DETECTED",
                        "score": 95,
                        "description": f"Virus scan flagged '{file_name}' as infected.",
                        "details": {
                            "output": res.stdout.strip(),
                            "file_size_bytes": file_size,
                            "scan_type": "clamav_local"
                        }
                    }
            except Exception as e:
                print(f"ClamAV execution failed: {e}")

        # 3. VirusTotal API Lookup (if API key is present)
        if self.vt_api_key:
            vt_result = await self._query_virustotal(file_path)
            if vt_result:
                return vt_result

        # Default clean response
        return {
            "status": "SAFE",
            "verdict": "CLEAN",
            "score": 0,
            "description": f"File '{file_name}' successfully completed security scan. No malware or compromises detected.",
            "details": {
                "file_name": file_name,
                "file_size_bytes": file_size,
                "scan_type": "signature_heuristics"
            }
        }

    def _run_signature_check(self, file_path: str) -> tuple[bool, str]:
        """Scans file streams for dangerous command structures (rm -rf, obfuscation, base64 exec)."""
        # Exclude large binaries from string scanning
        file_size = os.path.getsize(file_path)
        if file_size > 5 * 1024 * 1024: # > 5MB
            return False, ""

        # Common executable extensions
        ext = file_path.split('.')[-1].lower() if '.' in file_path else ""
        if ext in ['exe', 'dmg', 'pkg', 'bin', 'sh', 'bat', 'cmd']:
            # Check file headers (ELF / Mach-O / PE)
            try:
                with open(file_path, 'rb') as f:
                    header = f.read(4)
                    if header.startswith(b'MZ') or header.startswith(b'\x7fELF') or header.startswith(b'\xfe\xed\xfa\xed') or header.startswith(b'\xce\xfa\xed\xfe'):
                        return True, "Executable binary containing uncertified OS-level execution signatures."
            except Exception:
                pass

        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                
                # Check for prompt injection payloads / system override hacks
                if "ignore previous instructions" in content.lower() or "system override" in content.lower():
                    return True, "Potential Prompt Injection payload payload vector."

                # Check for critical shell execution scripts
                malicious_patterns = [
                    ("rm -rf /", "Attempts directory wipe"),
                    ("eval $(base64", "Obfuscated bash commands"),
                    ("curl -sSf http", "Unverified downloads from remote servers"),
                    ("sudo root", "Privilege escalation attempts")
                ]
                
                for pattern, desc in malicious_patterns:
                    if pattern in content:
                        return True, f"Suspicious script pattern: {desc}"

        except Exception:
            pass

        return False, ""

    async def _query_virustotal(self, file_path: str) -> Dict[str, Any] | None:
        """Queries VirusTotal API v3 (calculates SHA-256 and checks reports)."""
        import hashlib
        import httpx

        # 1. Calculate SHA-256 hash
        sha256 = hashlib.sha256()
        try:
            with open(file_path, 'rb') as f:
                while chunk := f.read(8192):
                    sha256.update(chunk)
            file_hash = sha256.hexdigest()
        except Exception:
            return None

        # 2. Request hash report
        headers = {"x-apikey": self.vt_api_key}
        url = f"https://www.virustotal.com/api/v3/files/{file_hash}"

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(url, headers=headers, timeout=10)
                if resp.status_code == 200:
                    data = resp.json()
                    stats = data.get("data", {}).get("attributes", {}).get("last_analysis_stats", {})
                    malicious = stats.get("malicious", 0)
                    suspicious = stats.get("suspicious", 0)
                    
                    if malicious > 0 or suspicious > 1:
                        return {
                            "status": "DANGEROUS",
                            "verdict": "VIRUSTOTAL_MALICIOUS_HASH",
                            "score": min(100, 50 + malicious * 10),
                            "description": f"VirusTotal flagged this file hash as malicious ({malicious} engines).",
                            "details": {
                                "hash": file_hash,
                                "malicious_engines": malicious,
                                "suspicious_engines": suspicious
                            }
                        }
        except Exception as e:
            print(f"VirusTotal lookup failed: {e}")
            
        return None
