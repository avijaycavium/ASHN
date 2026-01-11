"""
LangGraph Workflow - Orchestrates the autonomous healing pipeline
Detection → RCA → Remediation → Verification
"""
import os
import logging
from typing import Literal
from datetime import datetime

from langgraph.graph import StateGraph, START, END
from langchain_openai import ChatOpenAI
from pydantic import SecretStr

from .state import IncidentState, create_initial_state
from .nodes.detection import detection_node, detection_node_with_ai
from .nodes.rca import rca_node, rca_node_with_ai
from .nodes.remediation import remediation_node, emergency_rollback
from .nodes.verification import verification_node

logger = logging.getLogger(__name__)


def get_llm() -> ChatOpenAI | None:
    """Get the OpenAI LLM client using Replit AI Integration
    
    Returns None if no API key is available, enabling graceful fallback to rule-based logic.
    """
    api_key = os.environ.get("REPLIT_AI_API_KEY") or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        logger.warning("No API key found. AI-enhanced features will use rule-based fallback.")
        return None
    try:
        return ChatOpenAI(
            model="gpt-4o",
            base_url="https://ai.replit.dev",
            api_key=SecretStr(api_key),
            temperature=0.3
        )
    except Exception as e:
        logger.warning(f"Failed to initialize LLM: {e}. Using rule-based fallback.")
        return None


def should_continue_after_detection(state: IncidentState) -> Literal["rca", "end_unconfirmed"]:
    """
    Decide whether to continue to RCA or end early
    
    If detection confidence is too low, we may need human review
    """
    confidence = state.get("detection_confidence", 0)
    fault_type = state.get("fault_type", "unknown")
    
    if confidence < 0.3 or fault_type == "unknown":
        logger.warning(f"Low confidence detection ({confidence}), may need review")
        return "end_unconfirmed"
    
    return "rca"


def should_continue_after_rca(state: IncidentState) -> Literal["remediation", "end_no_action"]:
    """
    Decide whether to proceed with remediation
    
    High-risk situations may require human approval
    """
    rca_confidence = state.get("rca_confidence", 0)
    risk = state.get("remediation_risk", "high")
    
    if rca_confidence < 0.4:
        logger.warning(f"Low RCA confidence ({rca_confidence}), skipping remediation")
        return "end_no_action"
    
    if risk == "high" and rca_confidence < 0.8:
        logger.warning("High-risk remediation with low confidence, skipping")
        return "end_no_action"
    
    return "remediation"


def should_retry_or_end(state: IncidentState) -> Literal["resolved", "failed", "retry_rca"]:
    """
    Decide next step after verification
    
    - If passed: resolved
    - If failed once: retry with different approach
    - If failed multiple times: mark as failed
    """
    passed = state.get("verification_passed", False)
    events = state.get("events", [])
    
    verification_attempts = sum(1 for e in events if e.get("action") == "verification_failed")
    
    if passed:
        return "resolved"
    
    if verification_attempts >= 2:
        logger.error("Verification failed after multiple attempts")
        return "failed"
    
    logger.info("Verification failed, retrying RCA with new approach")
    return "retry_rca"


def detection_wrapper(state: IncidentState) -> dict:
    """Wrapper that optionally uses AI for detection"""
    llm = get_llm()
    if llm is None:
        logger.info("Using rule-based detection (no AI key available)")
        return detection_node(state)
    try:
        return detection_node_with_ai(state, llm)
    except Exception as e:
        logger.warning(f"AI detection failed, using rule-based: {e}")
        return detection_node(state)


def rca_wrapper(state: IncidentState) -> dict:
    """Wrapper that optionally uses AI for RCA"""
    llm = get_llm()
    if llm is None:
        logger.info("Using rule-based RCA (no AI key available)")
        return rca_node(state)
    try:
        return rca_node_with_ai(state, llm)
    except Exception as e:
        logger.warning(f"AI RCA failed, using rule-based: {e}")
        return rca_node(state)


def end_unconfirmed(state: IncidentState) -> dict:
    """End node for unconfirmed incidents"""
    event = {
        "timestamp": datetime.utcnow().isoformat(),
        "stage": "detection",
        "agent": "Orchestrator",
        "action": "incident_unconfirmed",
        "details": {
            "reason": "Low detection confidence or unknown fault type",
            "confidence": state.get("detection_confidence", 0)
        }
    }
    return {
        "stage": "failed",
        "error": "Incident could not be confirmed with sufficient confidence",
        "events": [event]
    }


def end_no_action(state: IncidentState) -> dict:
    """End node when remediation is not attempted"""
    event = {
        "timestamp": datetime.utcnow().isoformat(),
        "stage": "rca",
        "agent": "Orchestrator",
        "action": "remediation_skipped",
        "details": {
            "reason": "Low RCA confidence or high risk",
            "rca_confidence": state.get("rca_confidence", 0),
            "risk": state.get("remediation_risk", "unknown")
        }
    }
    return {
        "stage": "failed",
        "error": "Remediation skipped due to low confidence or high risk",
        "events": [event]
    }


def end_resolved(state: IncidentState) -> dict:
    """End node for successfully resolved incidents"""
    ttd = state.get("ttd_seconds", 0)
    ttr = state.get("ttr_seconds", 0)
    tttr = state.get("tttr_seconds", 0)
    total = ttd + ttr + tttr
    
    event = {
        "timestamp": datetime.utcnow().isoformat(),
        "stage": "resolved",
        "agent": "Orchestrator",
        "action": "incident_resolved",
        "details": {
            "total_time": total,
            "ttd": ttd,
            "ttr": ttr,
            "tttr": tttr,
            "fault_type": state.get("fault_type"),
            "root_cause": state.get("root_cause")
        }
    }
    return {
        "stage": "resolved",
        "events": [event]
    }


def end_failed(state: IncidentState) -> dict:
    """End node for failed incidents"""
    event = {
        "timestamp": datetime.utcnow().isoformat(),
        "stage": "failed",
        "agent": "Orchestrator",
        "action": "incident_failed",
        "details": {
            "reason": "Verification failed after multiple attempts",
            "fault_type": state.get("fault_type"),
            "actions_taken": len(state.get("remediation_actions", []))
        }
    }
    return {
        "stage": "failed",
        "error": "Automated remediation unsuccessful, escalating to human operator",
        "events": [event]
    }


def build_healing_graph() -> StateGraph:
    """
    Build the LangGraph workflow for autonomous healing
    
    Graph structure:
    
    START
      │
      ▼
    Detection ──(low confidence)──► end_unconfirmed
      │
      │(confirmed)
      ▼
    RCA ──(low confidence/high risk)──► end_no_action
      │
      │(proceed)
      ▼
    Remediation
      │
      ▼
    Verification ──(passed)──► end_resolved
      │                │
      │(failed)        │
      │                ▼
      └─(retry)──► RCA (loop back)
      │
      └─(max retries)──► end_failed
    """
    
    graph = StateGraph(IncidentState)
    
    graph.add_node("detection", detection_wrapper)
    graph.add_node("rca", rca_wrapper)
    graph.add_node("remediation", remediation_node)
    graph.add_node("verification", verification_node)
    
    graph.add_node("end_unconfirmed", end_unconfirmed)
    graph.add_node("end_no_action", end_no_action)
    graph.add_node("end_resolved", end_resolved)
    graph.add_node("end_failed", end_failed)
    
    graph.add_edge(START, "detection")
    
    graph.add_conditional_edges(
        "detection",
        should_continue_after_detection,
        {
            "rca": "rca",
            "end_unconfirmed": "end_unconfirmed"
        }
    )
    
    graph.add_conditional_edges(
        "rca",
        should_continue_after_rca,
        {
            "remediation": "remediation",
            "end_no_action": "end_no_action"
        }
    )
    
    graph.add_edge("remediation", "verification")
    
    graph.add_conditional_edges(
        "verification",
        should_retry_or_end,
        {
            "resolved": "end_resolved",
            "failed": "end_failed",
            "retry_rca": "rca"
        }
    )
    
    graph.add_edge("end_unconfirmed", END)
    graph.add_edge("end_no_action", END)
    graph.add_edge("end_resolved", END)
    graph.add_edge("end_failed", END)
    
    return graph


healing_workflow = build_healing_graph().compile()


def run_healing_workflow(
    incident_id: str,
    device_id: str,
    device_name: str,
    device_type: str,
    fault_type: str,
    severity: str = "medium"
) -> dict:
    """
    Run the complete healing workflow for an incident
    
    Args:
        incident_id: Unique identifier for the incident
        device_id: ID of the affected device
        device_name: Name of the affected device
        device_type: Type of device (core, spine, tor, dpu)
        fault_type: Type of fault detected
        severity: Incident severity level
        
    Returns:
        Final state after workflow completion
    """
    initial_state = create_initial_state(
        incident_id=incident_id,
        device_id=device_id,
        device_name=device_name,
        device_type=device_type,
        fault_type=fault_type,
        severity=severity
    )
    
    logger.info(f"Starting healing workflow for incident {incident_id}")
    logger.info(f"Device: {device_name} ({device_type}), Fault: {fault_type}, Severity: {severity}")
    
    try:
        final_state = healing_workflow.invoke(initial_state)
        
        logger.info(f"Workflow completed: {final_state.get('stage')}")
        
        return dict(final_state)
        
    except Exception as e:
        logger.error(f"Workflow failed with error: {e}")
        return {
            **initial_state,
            "stage": "failed",
            "error": str(e),
            "events": [{
                "timestamp": datetime.utcnow().isoformat(),
                "stage": "error",
                "agent": "Orchestrator",
                "action": "workflow_error",
                "details": {"error": str(e)}
            }]
        }


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    result = run_healing_workflow(
        incident_id="test-001",
        device_id="device-1",
        device_name="core-1",
        device_type="core",
        fault_type="bgp_link_flap",
        severity="high"
    )
    
    print("\n" + "="*50)
    print("WORKFLOW RESULT")
    print("="*50)
    print(f"Final Stage: {result.get('stage')}")
    print(f"Fault Type: {result.get('fault_type')}")
    print(f"Root Cause: {result.get('root_cause')}")
    print(f"Verification Passed: {result.get('verification_passed')}")
    print(f"\nTiming:")
    print(f"  Detection: {result.get('ttd_seconds', 0):.2f}s")
    print(f"  Remediation: {result.get('ttr_seconds', 0):.2f}s")
    print(f"  Verification: {result.get('tttr_seconds', 0):.2f}s")
    print(f"\nEvents ({len(result.get('events', []))}):")
    for event in result.get('events', []):
        print(f"  [{event.get('stage')}] {event.get('agent')}: {event.get('action')}")
