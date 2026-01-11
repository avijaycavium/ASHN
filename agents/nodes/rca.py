"""
RCA Node - Root Cause Analysis using AI
Analyzes incident evidence and generates remediation recommendations
"""
import time
from datetime import datetime
from typing import Dict, Any
import logging
import os

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from ..state import IncidentState
from ..tools.sonic import SONiCTools
from ..tools.prometheus import PrometheusTools

logger = logging.getLogger(__name__)


RCA_KNOWLEDGE_BASE = {
    "bgp_link_flap": {
        "common_causes": [
            "Physical link degradation (fiber, transceiver)",
            "MTU mismatch between peers",
            "Duplex/speed auto-negotiation issues",
            "BGP hold timer too aggressive",
            "Transceiver overheating"
        ],
        "diagnostic_commands": [
            "show interface transceiver",
            "show bgp neighbors",
            "show interface counters errors",
            "show logging last 100"
        ],
        "remediation_options": [
            "Adjust BGP timers (increase hold time)",
            "Enable BFD for faster detection",
            "Replace faulty transceiver",
            "Check and fix MTU settings"
        ]
    },
    "bgp_session_instability": {
        "common_causes": [
            "Route policy misconfiguration",
            "Prefix limit exceeded",
            "Authentication mismatch",
            "CPU overload affecting BGP process",
            "Route flapping from upstream"
        ],
        "diagnostic_commands": [
            "show bgp summary",
            "show route-policy",
            "show cpu processes",
            "show bgp neighbor detail"
        ],
        "remediation_options": [
            "Clear BGP session to reset state",
            "Adjust prefix limits",
            "Verify route policy configuration",
            "Enable route dampening"
        ]
    },
    "traffic_drop": {
        "common_causes": [
            "Routing table corruption",
            "ECMP path failure",
            "ACL blocking traffic",
            "Buffer exhaustion",
            "Microbursts causing drops"
        ],
        "diagnostic_commands": [
            "show ip route",
            "show interfaces counters",
            "show acl",
            "show buffer"
        ],
        "remediation_options": [
            "Failover to backup path",
            "Clear routing table and reconverge",
            "Adjust buffer allocation",
            "Review and fix ACL rules"
        ]
    },
    "cpu_spike": {
        "common_causes": [
            "Route churn/instability",
            "Control plane attack",
            "Memory leak in process",
            "Excessive logging",
            "Protocol storm"
        ],
        "diagnostic_commands": [
            "show cpu processes",
            "show memory",
            "show copp statistics"
        ],
        "remediation_options": [
            "Enable CoPP rate limiting",
            "Restart offending process",
            "Reduce logging verbosity",
            "Apply control plane protection"
        ]
    },
    "memory_exhaustion": {
        "common_causes": [
            "Route table overflow",
            "Memory leak in application",
            "Too many BGP routes",
            "Configuration bloat"
        ],
        "diagnostic_commands": [
            "show memory",
            "show bgp summary",
            "show running-config"
        ],
        "remediation_options": [
            "Clear stale routes",
            "Restart memory-leaking process",
            "Apply route summarization",
            "Increase prefix filtering"
        ]
    }
}


def rca_node(state: IncidentState) -> Dict[str, Any]:
    """
    RCA Node - Performs root cause analysis
    
    This node:
    1. Gathers diagnostic information from the device
    2. Analyzes patterns against known issues
    3. Uses AI to generate root cause hypothesis
    4. Recommends remediation actions
    
    Args:
        state: Current incident state
        
    Returns:
        Updated state with RCA findings
    """
    start_time = time.time()
    
    fault_type = state.get("fault_type", "unknown")
    device_name = state.get("device_name", "")
    metric_deviations = state.get("metric_deviations", [])
    
    logger.info(f"RCA node analyzing fault: {fault_type} on device {device_name}")
    
    sonic = SONiCTools(simulate=True)
    prometheus = PrometheusTools(simulate=True)
    
    diagnostic_data = _gather_diagnostics(sonic, fault_type)
    
    knowledge = RCA_KNOWLEDGE_BASE.get(fault_type, {})
    common_causes = knowledge.get("common_causes", ["Unknown cause"])
    remediation_options = knowledge.get("remediation_options", [])
    
    root_cause, hypothesis, evidence, confidence = _analyze_root_cause(
        fault_type, metric_deviations, diagnostic_data, common_causes
    )
    
    remediation_plan = _generate_remediation_plan(fault_type, root_cause, remediation_options)
    
    affected_devices = _identify_affected_devices(device_name, fault_type)
    
    risk = _assess_remediation_risk(fault_type, remediation_plan)
    
    event = {
        "timestamp": datetime.utcnow().isoformat(),
        "stage": "rca",
        "agent": "RCAAgent",
        "action": "root_cause_identified",
        "details": {
            "root_cause": root_cause,
            "hypothesis": hypothesis,
            "confidence": confidence,
            "affected_devices": affected_devices,
            "remediation_risk": risk
        }
    }
    
    return {
        "stage": "remediation",
        "root_cause": root_cause,
        "rca_hypothesis": hypothesis,
        "rca_evidence": evidence,
        "rca_confidence": confidence,
        "affected_devices": affected_devices,
        "remediation_plan": remediation_plan,
        "remediation_risk": risk,
        "events": [event]
    }


def _gather_diagnostics(sonic: SONiCTools, fault_type: str) -> Dict[str, Any]:
    """Gather diagnostic information from the device"""
    diagnostics = {}
    
    diagnostics["bgp_neighbors"] = sonic.get_bgp_neighbors()
    diagnostics["interface_status"] = sonic.get_interface_status()
    
    return diagnostics


def _analyze_root_cause(
    fault_type: str,
    metric_deviations: list,
    diagnostics: dict,
    common_causes: list
) -> tuple[str, str, list, float]:
    """
    Analyze evidence to determine root cause
    
    Returns:
        (root_cause, hypothesis, evidence, confidence)
    """
    evidence = []
    
    for deviation in metric_deviations:
        evidence.append(f"Metric '{deviation.get('metric_name')}' deviated by {deviation.get('deviation_sigma', 0):.1f} sigma")
    
    bgp_output = diagnostics.get("bgp_neighbors", {}).get("output", "")
    if "Active" in bgp_output or "never" in bgp_output:
        evidence.append("BGP neighbor in Active/Down state detected")
    
    intf_output = diagnostics.get("interface_status", {}).get("output", "")
    if "down" in intf_output.lower():
        evidence.append("Interface in down state detected")
    
    if common_causes:
        most_likely = common_causes[0]
    else:
        most_likely = f"Unknown cause for {fault_type}"
    
    hypothesis = f"Based on {len(evidence)} pieces of evidence, the most likely cause is: {most_likely}"
    
    confidence = min(0.3 + (len(evidence) * 0.15), 0.95)
    
    return most_likely, hypothesis, evidence, confidence


def _generate_remediation_plan(fault_type: str, root_cause: str, options: list) -> list:
    """Generate ordered remediation steps"""
    plan = []
    
    if fault_type == "bgp_link_flap":
        plan = [
            "1. Increase BGP hold timer to 180 seconds",
            "2. Enable BFD for rapid failure detection",
            "3. Monitor for stability for 60 seconds",
            "4. If still flapping, shutdown and re-enable interface"
        ]
    elif fault_type == "bgp_session_instability":
        plan = [
            "1. Clear BGP session to reset state",
            "2. Verify BGP neighbor configuration",
            "3. Check and adjust prefix limits if needed",
            "4. Monitor session state for 30 seconds"
        ]
    elif fault_type == "traffic_drop":
        plan = [
            "1. Check routing table integrity",
            "2. Failover traffic to backup path",
            "3. Clear routing table on affected device",
            "4. Force reconvergence",
            "5. Verify traffic restoration"
        ]
    elif fault_type == "cpu_spike":
        plan = [
            "1. Identify top CPU-consuming process",
            "2. Enable CoPP rate limiting",
            "3. Restart offending process if safe",
            "4. Monitor CPU for recovery"
        ]
    elif fault_type == "memory_exhaustion":
        plan = [
            "1. Clear stale routes and caches",
            "2. Apply route summarization",
            "3. Restart if memory doesn't recover",
            "4. Monitor memory utilization"
        ]
    else:
        plan = ["1. Gather additional diagnostics", "2. Escalate to human operator"]
    
    return plan


def _identify_affected_devices(device_name: str, fault_type: str) -> list:
    """Identify devices that may be affected by this incident"""
    affected = [device_name]
    
    if fault_type in ["bgp_link_flap", "bgp_session_instability"]:
        pass
    
    return affected


def _assess_remediation_risk(fault_type: str, plan: list) -> str:
    """Assess the risk level of the remediation plan"""
    high_risk_actions = ["restart", "reload", "failover", "shutdown"]
    
    for step in plan:
        step_lower = step.lower()
        if any(action in step_lower for action in high_risk_actions):
            return "medium"
    
    return "low"


def rca_node_with_ai(state: IncidentState, llm: ChatOpenAI) -> Dict[str, Any]:
    """
    Enhanced RCA node that uses AI for analysis
    """
    base_result = rca_node(state)
    
    try:
        system_prompt = """You are a senior network engineer specializing in SONiC-based data center fabrics.
Perform root cause analysis on the provided incident data.

Your analysis should:
1. Identify the most likely root cause
2. Explain your reasoning with evidence
3. Suggest specific remediation actions
4. Assess the risk of each action

Be precise and technical. Focus on actionable insights."""

        human_message = f"""
Incident Analysis Request:
- Device: {state.get('device_name')} ({state.get('device_type')})
- Fault Type: {state.get('fault_type')}
- Severity: {state.get('severity')}
- Metric Deviations: {state.get('metric_deviations')}
- Initial Detection Confidence: {state.get('detection_confidence')}

Please provide:
1. Root cause hypothesis
2. Supporting evidence
3. Recommended remediation steps
4. Risk assessment
"""
        
        response = llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=human_message)
        ])
        
        base_result["rca_hypothesis"] = response.content[:1000]
        base_result["events"].append({
            "timestamp": datetime.utcnow().isoformat(),
            "stage": "rca",
            "agent": "RCAAgent",
            "action": "ai_analysis_complete",
            "details": {"ai_response_length": len(response.content)}
        })
        
    except Exception as e:
        logger.warning(f"AI RCA failed, using rule-based: {e}")
    
    return base_result
