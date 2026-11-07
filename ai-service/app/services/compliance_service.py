import re
from typing import Any


SEVERITY_WEIGHT = {
    'low': 5,
    'medium': 12,
    'high': 20,
    'critical': 30,
}


def _phrases_from_rule(text: str) -> list[str]:
    quoted = re.findall(r'["“”\']([^"“”\']{1,100})["“”\']', text)
    if quoted:
        return [phrase.strip() for phrase in quoted if phrase.strip()]

    tail = re.split(r':', text, maxsplit=1)
    if len(tail) == 2:
        value = re.sub(
            r'^\s*(must include|include|use|avoid|do not use|never use|prohibited|forbidden)\s+',
            '',
            tail[1],
            flags=re.IGNORECASE,
        )
        return [phrase.strip(' .') for phrase in re.split(r',|;|\band\b', value) if phrase.strip(' .')]
    return []


class ComplianceService:
    @staticmethod
    def evaluate(content: str, guideline_rules: list[dict[str, Any]]) -> dict[str, Any]:
        issues: list[dict[str, Any]] = []
        lower_content = content.casefold()

        for rule in guideline_rules:
            title = rule.get('rule_title') or 'Brand rule'
            description = rule.get('rule_description') or ''
            rule_text = f'{title}. {description}'.strip()
            normalized = rule_text.casefold()
            category = (rule.get('category') or 'other').casefold()
            severity = (rule.get('severity') or 'medium').casefold()
            phrases = _phrases_from_rule(rule_text)

            if re.search(r'\b(prohibit|prohibited|forbidden|avoid|do not use|never use|banned)\b', normalized):
                for phrase in phrases:
                    if re.search(rf'(?<!\w){re.escape(phrase)}(?!\w)', content, re.IGNORECASE):
                        issues.append({
                            'rule_id': rule.get('rule_id'),
                            'type': category,
                            'severity': severity,
                            'message': f"Content uses wording prohibited by “{title}”: {phrase}.",
                            'suggestion': 'Replace the flagged wording with approved brand terminology.',
                            'detected_text': phrase,
                        })
                continue

            if re.search(r'\b(must include|must contain|required phrase|mandatory phrase|include the phrase)\b', normalized):
                for phrase in phrases:
                    if phrase.casefold() not in lower_content:
                        issues.append({
                            'rule_id': rule.get('rule_id'),
                            'type': category,
                            'severity': severity,
                            'message': f"Required wording from “{title}” is missing: {phrase}.",
                            'suggestion': f'Include “{phrase}” naturally in the content.',
                            'detected_text': '',
                        })
                continue

            replacement = re.search(
                r'\buse\s+["“]?(.+?)["”]?\s+instead of\s+["“]?(.+?)["”]?(?:\.|$)',
                rule_text,
                re.IGNORECASE,
            )
            if replacement:
                preferred, incorrect = (part.strip(' "\'“”') for part in replacement.groups())
                if re.search(rf'(?<!\w){re.escape(incorrect)}(?!\w)', content, re.IGNORECASE):
                    issues.append({
                        'rule_id': rule.get('rule_id'),
                        'type': category,
                        'severity': severity,
                        'message': f"“{incorrect}” does not follow “{title}”.",
                        'suggestion': f'Use “{preferred}” instead.',
                        'detected_text': incorrect,
                    })

            if category == 'tone':
                if re.search(r'!{2,}', content) and re.search(r'\b(calm|professional|formal|restrained)\b', normalized):
                    issues.append({
                        'rule_id': rule.get('rule_id'),
                        'type': 'tone',
                        'severity': severity,
                        'message': f'Excessive exclamation marks conflict with “{title}”.',
                        'suggestion': 'Use measured punctuation to match the configured brand tone.',
                        'detected_text': '!!',
                    })
                if re.search(r'\b(all caps|uppercase|capitalization)\b', normalized):
                    caps = re.findall(r'\b[A-Z]{4,}\b', content)
                    for term in caps:
                        issues.append({
                            'rule_id': rule.get('rule_id'),
                            'type': 'tone',
                            'severity': severity,
                            'message': f'All-caps wording conflicts with “{title}”.',
                            'suggestion': f'Use standard capitalization for “{term}”.',
                            'detected_text': term,
                        })

        penalty = sum(SEVERITY_WEIGHT.get(issue['severity'], 12) for issue in issues)
        score = max(0, 100 - penalty)
        if score >= 85:
            status = 'compliant'
        elif score >= 60:
            status = 'partially_compliant'
        else:
            status = 'non_compliant'

        recommendations = [
            issue['suggestion'] for issue in issues
        ]
        if not guideline_rules:
            recommendations.append('No active guideline rules were configured for this brand.')
        elif not issues:
            recommendations.append('No violations were detected against the active brand rules.')

        return {
            'summary': f'Rule-based analysis completed against {len(guideline_rules)} active rule(s); {len(issues)} issue(s) detected.',
            'status': status,
            'compliance_score': score,
            'issues': issues,
            'recommendations': list(dict.fromkeys(recommendations)),
        }
