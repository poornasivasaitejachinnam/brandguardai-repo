import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.compliance_service import ComplianceService


class ComplianceServiceTests(unittest.TestCase):
    def test_detects_prohibited_phrase_from_configured_rule(self):
        result = ComplianceService.evaluate(
            'Our results are guaranteed.',
            [{
                'rule_id': 3,
                'category': 'claims',
                'rule_title': 'Prohibited claims',
                'rule_description': 'Do not use: “guaranteed”',
                'severity': 'high',
            }],
        )
        self.assertEqual(len(result['issues']), 1)
        self.assertEqual(result['issues'][0]['rule_id'], 3)
        self.assertEqual(result['compliance_score'], 80)

    def test_detects_missing_mandatory_phrase(self):
        result = ComplianceService.evaluate(
            'A simple message.',
            [{
                'rule_id': 5,
                'category': 'terminology',
                'rule_title': 'Mandatory phrase',
                'rule_description': 'Must include: “Built on trust”',
                'severity': 'medium',
            }],
        )
        self.assertEqual(result['issues'][0]['detected_text'], '')
        self.assertIn('Built on trust', result['issues'][0]['suggestion'])

    def test_no_rules_does_not_invent_brand_violations(self):
        result = ComplianceService.evaluate('A regular marketing sentence.', [])
        self.assertEqual(result['issues'], [])
        self.assertEqual(result['compliance_score'], 100)


if __name__ == '__main__':
    unittest.main()
