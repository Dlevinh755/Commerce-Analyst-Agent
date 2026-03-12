from pydantic import BaseModel, Field


class SQLGenerationOutput(BaseModel):
    sql: str = Field(description="Safe SQL query for analytics")
    reasoning: str = Field(description="Short explanation of why this SQL answers the question")
    confidence: float = Field(ge=0.0, le=1.0)


class ResultSummaryOutput(BaseModel):
    summary: str = Field(description="Business-friendly Vietnamese summary")