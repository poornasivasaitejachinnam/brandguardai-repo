from pydantic import BaseModel, Field
from typing import List, Optional


class BrandRule(BaseModel):
    rule_id: Optional[int] = None
    category: str = 'other'
    rule_title: str
    rule_description: Optional[str] = None
    severity: str = 'medium'


class AnalysisRequest(BaseModel):
    content: str = Field(..., min_length=1)
    brand: Optional[dict] = None
    guideline_rules: List[BrandRule] = Field(default_factory=list)
    category_id: Optional[int] = 1


class IssueResult(BaseModel):
    rule_id: Optional[int] = None
    type: str
    severity: str
    message: str
    suggestion: str
    detected_text: Optional[str] = None


class AnalysisResponse(BaseModel):
    summary: str
    status: str
    compliance_score: int
    issues: List[IssueResult]
    recommendations: List[str]
