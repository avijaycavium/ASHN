"""
Detection Node - Anomaly detection and fault classification
Uses metric analysis and rule-based detection with AI enhancement
"""
import time
from datetime import datetime
from typing import Dict, Any
import logging

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from ..state import IncidentState
from ..tools.prometheus import PrometheusTools
from ..tools.gns3 import GNS3Tools

logger = logging.getLogger(__name__)


FAULT_SIGNATURES = {
    "bgp_link_flap": {
        "metrics": ["bgp_session_state", "link_flap_count"],
        "conditions": ["rapid_state_changes", "interface_errors"],
        "description": "BGP session flapping due to unstable physical or logical link"
    },
    "bgp_session_instability": {
        "metrics": ["bgp_session_state", "bgp_prefixes_received"],
        "conditions": ["session_down", "prefix_withdrawal"],
        "description": "BGP session instability without physical link issues"
    },
    "traffic_drop": {
        "metrics": ["traffic_utilization", "packet_loss"],
        "conditions": ["sudden_traffic_decrease", "packet_loss_spike"],
        "description": "Unexpected traffic drop indicating routing or forwarding issues"
    },
    "cpu_spike": {
        "metrics": ["cpu_utilization"],
        "conditions": ["cpu_above_threshold"],
        "description": "CPU utilization spike affecting device performance"
    },
    "memory_exhaustion": {
        "metrics": ["memory_utilization"],
        "conditions": ["memory_above_threshold"],
        "description": "Memory utilization approaching critical levels"
    }
}


def detection_node(state: IncidentState) -> Dict[str, Any]:
    """
    Detection Node - Analyzes metrics and confirms/classifies the fault
    
    This node:
    1. Collects current metrics from Prometheus
    2. Compares against baseline thresholds
    3. Uses AI to classify the fault type
    4. Calculates detection confidence
    
    Args:
        state: Current incident state
        
    Returns:
        Updated state fields
    """
    start_time = time.time()
    
    prometheus = PrometheusTools(simulate=True)
    gns3 = GNS3Tools(simulate=True)
    
    device_id = state.get("device_id", "")
    device_name = state.get("device_name", "")
    claimed_fault = state.get("fault_type", "unknown")
    
    logger.info(f"Detection node analyzing device {device_name} for fault type: {claimed_fault}")
    
    anomalies = prometheus.detect_anomalies(device_id)
    health_metrics = prometheus.get_device_health_metrics(device_id)
    
    node_info = gns3.get_node_by_name(device_name)
    gns3_status = node_info.get("status", "unknown") if node_info else "unknown"
    
    metric_deviations = []
    for anomaly in anomalies:
        metric_deviations.append({
            "metric_name": anomaly.get("metric", ""),
            "baseline": 0,
            "current": anomaly.get("value", 0),
            "threshold": 0,
            "deviation_sigma": 3.0,
            "severity": anomaly.get("severity", "medium")
        })
    
    confirmed_fault, confidence, method = _classify_fault(
        claimed_fault, anomalies, health_metrics, gns3_status
    )
    
    ttd = time.time() - start_time
    
    event = {
        "timestamp": datetime.utcnow().isoformat(),
        "stage": "detection",
        "agent": "DetectionAgent",
        "action": "fault_confirmed" if confidence > 0.5 else "fault_analysis",
        "details": {
            "claimed_fault": claimed_fault,
            "confirmed_fault": confirmed_fault,
            "confidence": confidence,
            "anomalies_found": len(anomalies),
            "gns3_status": gns3_status,
            "detection_method": method
        }
    }
    
    return {
        "stage": "rca",
        "fault_type": confirmed_fault,
        "detection_confidence": confidence,
        "detection_method": method,
        "metric_deviations": metric_deviations,
        "ttd_seconds": ttd,
        "events": [event]
    }


def _classify_fault(
    claimed_fault: str,
    anomalies: list,
    health_metrics: dict,
    gns3_status: str
) -> tuple[str, float, str]:
    """
    Classify the fault type based on evidence
    
    Returns:
        (fault_type, confidence, detection_method)
    """
    evidence_scores = {ft: 0.0 for ft in FAULT_SIGNATURES.keys()}
    evidence_scores["unknown"] = 0.1
    
    for anomaly in anomalies:
        metric = anomaly.get("metric", "")
        severity = anomaly.get("severity", "warning")
        
        severity_weight = 1.5 if severity == "critical" else 1.0
        
        for fault_type, signature in FAULT_SIGNATURES.items():
            if metric in signature["metrics"]:
                evidence_scores[fault_type] += 0.3 * severity_weight
    
    if claimed_fault in FAULT_SIGNATURES:
        evidence_scores[claimed_fault] += 0.4
    
    if gns3_status == "stopped":
        evidence_scores["bgp_session_instability"] += 0.3
        evidence_scores["traffic_drop"] += 0.2
    
    best_match = max(evidence_scores, key=lambda x: evidence_scores[x])
    confidence = min(evidence_scores[best_match], 1.0)
    
    if anomalies:
        method = "metric_anomaly_detection"
    elif claimed_fault != "unknown":
        method = "operator_reported"
    else:
        method = "proactive_analysis"
    
    return best_match, confidence, method


def detection_node_with_ai(state: IncidentState, llm: ChatOpenAI) -> Dict[str, Any]:
    """
    Enhanced detection node that uses AI for classification
    """
    base_result = detection_node(state)
    
    try:
        system_prompt = """You are a network fault detection specialist for enterprise SONiC networks.
Analyze the provided metrics and anomalies to confirm the fault type and provide confidence score.

Fault types you can identify:
- bgp_link_flap: Rapid BGP session state changes, often due to physical link issues
- bgp_session_instability: BGP session down without physical link problems
- traffic_drop: Unexpected traffic decrease, routing or forwarding issues
- cpu_spike: High CPU utilization affecting performance
- memory_exhaustion: High memory usage approaching critical levels

Respond with:
1. Confirmed fault type
2. Confidence (0.0 to 1.0)
3. Brief reasoning"""

        human_message = f"""
Device: {state.get('device_name')}
Claimed Fault: {state.get('fault_type')}
Detected Anomalies: {base_result.get('metric_deviations')}
Detection Confidence: {base_result.get('detection_confidence')}
"""
        
        response = llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=human_message)
        ])
        
        base_result["events"].append({
            "timestamp": datetime.utcnow().isoformat(),
            "stage": "detection",
            "agent": "DetectionAgent",
            "action": "ai_classification",
            "details": {"ai_response": response.content[:500]}
        })
        
    except Exception as e:
        logger.warning(f"AI classification failed, using rule-based: {e}")
    
    return base_result
