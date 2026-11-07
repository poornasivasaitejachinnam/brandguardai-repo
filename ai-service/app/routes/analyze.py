from fastapi import APIRouter
from app.schemas.analyze import AnalysisRequest, AnalysisResponse
from app.services.compliance_service import ComplianceService

router = APIRouter()


@router.get('/health')
async def health_check():
    return {'ok': True, 'service': 'BrandGuard AI service'}


@router.post('/analyze', response_model=AnalysisResponse)
async def analyze(payload: AnalysisRequest):
    rules = [rule.model_dump() for rule in payload.guideline_rules]
    result = ComplianceService.evaluate(payload.content, rules)
    return {
        'summary': result['summary'],
        'status': result['status'],
        'compliance_score': result['compliance_score'],
        'issues': result['issues'],
        'recommendations': result['recommendations'],
    }
