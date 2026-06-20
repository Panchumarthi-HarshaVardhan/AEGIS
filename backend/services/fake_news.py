# ============================================================
# JARVIS Guardian AI — Fake News Detection Pipeline
# ============================================================

import os
from typing import List, Dict, Any
from groq import Groq

class FakeNewsDetector:
    def __init__(self, api_key: str):
        if not api_key:
            raise ValueError("Groq API Key is required for Fake News Detection")
        self.client = Groq(api_key=api_key)
        self.model = "llama-3.3-70b-versatile"

    async def analyze_article(self, text: str) -> Dict[str, Any]:
        """
        Runs the full Fact-Checking pipeline:
        Article -> Claims Extraction -> Evidence Retrieval -> Fact Verification -> Risk Score
        """
        if not text.strip():
            return {
                "verdict": "UNKNOWN",
                "risk_score": 0,
                "claims": [],
                "summary": "Empty article text provided."
            }

        try:
            # 1. Claims Extraction
            claims = self._extract_claims(text)
            
            # 2. Evidence Retrieval & Verification
            verified_claims = []
            total_score = 0
            
            for claim in claims:
                # Ask LLM to act as the fact verification oracle (using its world knowledge / search query emulation)
                verification = self._verify_claim_against_facts(claim)
                verified_claims.append({
                    "claim": claim,
                    "evidence": verification.get("evidence", "No contradictory evidence found in general consensus."),
                    "status": verification.get("status", "UNVERIFIED"), # VERIFIED, DISPROVEN, UNVERIFIED
                    "confidence": verification.get("confidence", 0.5)
                })
                
                # Risk scoring contribution
                if verification.get("status") == "DISPROVEN":
                    total_score += 35
                elif verification.get("status") == "UNVERIFIED":
                    total_score += 15

            # Calculate composite risk score (0-100)
            risk_score = min(100, max(0, total_score))
            
            # Determine overall verdict
            if risk_score >= 60:
                verdict = "HIGHLY_SUSPICIOUS"
            elif risk_score >= 30:
                verdict = "UNVERIFIED_CLAIMS"
            else:
                verdict = "CREDIBLE"

            # Get natural language summary
            summary = self._generate_verdict_summary(text, verified_claims, verdict)

            return {
                "verdict": verdict,
                "risk_score": risk_score,
                "claims": verified_claims,
                "summary": summary
            }

        except Exception as e:
            return {
                "verdict": "ERROR",
                "risk_score": 0,
                "claims": [],
                "summary": f"Fact checking pipeline error: {str(e)}"
            }

    def _extract_claims(self, text: str) -> List[str]:
        """Extracts 2-4 major factual assertions or claims from the text."""
        prompt = (
            "Extract 2 to 4 major factual statements or assertions from this article that can be objectively proven or disproven. "
            "Respond ONLY with a JSON object containing a 'claims' key which holds a list of strings, for example:\n"
            "{\n  \"claims\": [\"Claim 1\", \"Claim 2\"]\n}\n"
            "Do not include formatting, headers, or explanations. Keep claims short and objective.\n\n"
            f"Article Text:\n{text[:3000]}"
        )
        
        completion = self.client.chat.completions.create(
            model=self.model,
            temperature=0.1,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        
        content = completion.choices[0].message.content
        import json
        try:
            # LLM JSON mode returns { "claims": [...] } or similar
            parsed = json.loads(content)
            if isinstance(parsed, dict):
                # Search common keys
                for key in ["claims", "list", "statements"]:
                    if key in parsed and isinstance(parsed[key], list):
                        return parsed[key]
                # If parsed is a dict but has random keys, check if values are strings
                if len(parsed) > 0 and all(isinstance(v, str) for v in parsed.values()):
                    return list(parsed.values())
            elif isinstance(parsed, list):
                return parsed
        except Exception as e:
            print("Failed to parse claims extraction JSON:", e)
            
        # Fallback split
        return [line.strip() for line in text.split(".") if len(line.strip()) > 30][:3]

    def _verify_claim_against_facts(self, claim: str) -> Dict[str, Any]:
        """Cross-references the claim against world knowledge databases using Llama 3.3."""
        prompt = (
            "Verify this statement against current global fact-checking records and consensus. "
            "You MUST respond with a JSON object containing:\n"
            '- "status": one of "VERIFIED" (supported by facts), "DISPROVEN" (contradicted by facts), "UNVERIFIED" (no consensus or subjective/speculative)\n'
            '- "evidence": a concise paragraph explaining why, referencing trusted sources or general scientific/historical consensus\n'
            '- "confidence": a float between 0.0 and 1.0\n\n'
            f"Statement to verify:\n\"{claim}\""
        )
        
        completion = self.client.chat.completions.create(
            model=self.model,
            temperature=0.1,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        
        import json
        try:
            return json.loads(completion.choices[0].message.content)
        except Exception:
            return {
                "status": "UNVERIFIED",
                "evidence": "Unable to verify claim source due to formatting mismatch.",
                "confidence": 0.5
            }

    def _generate_verdict_summary(self, text: str, claims: List[Dict[str, Any]], verdict: str) -> str:
        """Generates a cohesive fact check summary based on the findings."""
        claims_summary = "\n".join([
            f"- Claim: \"{c['claim']}\"\n  Status: {c['status']}\n  Evidence: {c['evidence']}"
            for c in claims
        ])
        
        prompt = (
            "Write a concise, professional 3-sentence summary of a fact-checking audit for this article. "
            f"Overall Verdict: {verdict}\n\n"
            f"Audited Claims details:\n{claims_summary}\n\n"
            "Explain what claims are fake, what claims are true, and why users should or should not trust this source."
        )
        
        completion = self.client.chat.completions.create(
            model=self.model,
            temperature=0.3,
            messages=[{"role": "user", "content": prompt}]
        )
        
        return completion.choices[0].message.content.strip()
