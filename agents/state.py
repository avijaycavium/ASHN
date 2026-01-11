"""
IncidentState - The central state schema for the agentic workflow.
This tracks the incident lifecycle from detection through verification.
"""
from typing import TypedDict, Literal, Optional, Annotated
from pydantic import BaseModel
import operator


class MetricDeviation(BaseModel):
    """Represents a metric deviation from baseline"""
    metric_name: str
    baseline: float
    current: float
    threshold: float
    deviation_sigma: float


class RemediationAction(BaseModel):
    """Represents a remediation action taken"""
    action_type: str
    command: str
    target_device: str
    executed: bool = False
    success: bool = False
    output: Optional[str] = None


class VerificationCheck(BaseModel):
    """Represents a verification check result"""
    check_name: str
    passed: bool
    expected: str
    actual: str


class InternalLogEntry(BaseModel):
    """Represents a detailed internal log entry for agent transparency"""
    timestamp: str
    stage: str
    agent: str
    log_type: str  # "network_data", "llm_context", "decision", "tool_call", "reasoning"
    title: str
    content: dict  # Flexible content structure


class IncidentState(TypedDict):
    """
    Central state for the LangGraph workflow.
    Tracks all information as the incident flows through agents.
    """
    incident_id: str
    fault_type: Literal["bgp_link_flap", "bgp_session_instability", "traffic_drop", "cpu_spike", "memory_exhaustion", "unknown"]
    stage: Literal["detection", "rca", "remediation", "verification", "resolved", "failed"]
    device_id: str
    device_name: str
    device_type: str
    severity: Literal["critical", "high", "medium", "low"]
    
    detection_confidence: float
    detection_method: str
    metric_deviations: list[dict]
    
    root_cause: str
    rca_confidence: float
    rca_hypothesis: str
    rca_evidence: list[str]
    affected_devices: list[str]
    
    remediation_plan: list[str]
    remediation_actions: list[dict]
    remediation_risk: str
    
    verification_checks: list[dict]
    verification_passed: bool
    
    ttd_seconds: float
    ttr_seconds: float
    tttr_seconds: float
    
    events: Annotated[list[dict], operator.add]
    internal_logs: Annotated[list[dict], operator.add]  # Detailed internal agent logs
    error: Optional[str]


def create_initial_state(
    incident_id: str,
    device_id: str,
    device_name: str,
    device_type: str,
    fault_type: str,
    severity: str = "medium"
) -> IncidentState:
    """Create an initial incident state for the workflow"""
    return IncidentState(
        incident_id=incident_id,
        fault_type=fault_type,
        stage="detection",
        device_id=device_id,
        device_name=device_name,
        device_type=device_type,
        severity=severity,
        detection_confidence=0.0,
        detection_method="",
        metric_deviations=[],
        root_cause="",
        rca_confidence=0.0,
        rca_hypothesis="",
        rca_evidence=[],
        affected_devices=[device_id],
        remediation_plan=[],
        remediation_actions=[],
        remediation_risk="low",
        verification_checks=[],
        verification_passed=False,
        ttd_seconds=0.0,
        ttr_seconds=0.0,
        tttr_seconds=0.0,
        events=[],
        internal_logs=[],
        error=None
    )
