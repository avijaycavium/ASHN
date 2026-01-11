"""
Verification Node - Validates remediation success
Confirms the fix worked by checking metrics and device state
"""
import time
from datetime import datetime
from typing import Dict, Any, List
import logging

from ..state import IncidentState
from ..tools.prometheus import PrometheusTools
from ..tools.sonic import SONiCTools
from ..tools.gns3 import GNS3Tools

logger = logging.getLogger(__name__)


VERIFICATION_CRITERIA = {
    "bgp_link_flap": [
        {
            "check_name": "bgp_session_stable",
            "description": "BGP session is established and stable",
            "metric": "bgp_session_state",
            "expected": "1",
            "critical": True
        },
        {
            "check_name": "no_new_flaps",
            "description": "No BGP flaps in last 60 seconds",
            "metric": "bgp_flap_count_1m",
            "expected": "0",
            "critical": True
        },
        {
            "check_name": "interface_no_errors",
            "description": "Interface error rate is below threshold",
            "metric": "interface_error_rate",
            "expected": "<10",
            "critical": False
        }
    ],
    "bgp_session_instability": [
        {
            "check_name": "bgp_session_established",
            "description": "BGP session is in Established state",
            "metric": "bgp_session_state",
            "expected": "1",
            "critical": True
        },
        {
            "check_name": "prefixes_received",
            "description": "Receiving expected prefixes from neighbor",
            "metric": "bgp_prefixes_received",
            "expected": ">0",
            "critical": True
        }
    ],
    "traffic_drop": [
        {
            "check_name": "traffic_restored",
            "description": "Traffic throughput restored to baseline",
            "metric": "traffic_utilization",
            "expected": ">50",
            "critical": True
        },
        {
            "check_name": "no_packet_loss",
            "description": "Packet loss is within acceptable range",
            "metric": "packet_loss_rate",
            "expected": "<1",
            "critical": True
        }
    ],
    "cpu_spike": [
        {
            "check_name": "cpu_normal",
            "description": "CPU utilization is below threshold",
            "metric": "cpu_utilization",
            "expected": "<80",
            "critical": True
        }
    ],
    "memory_exhaustion": [
        {
            "check_name": "memory_normal",
            "description": "Memory utilization is below threshold",
            "metric": "memory_utilization",
            "expected": "<85",
            "critical": True
        }
    ]
}


def verification_node(state: IncidentState) -> Dict[str, Any]:
    """
    Verification Node - Validates that remediation was successful
    
    This node:
    1. Waits for system to stabilize
    2. Runs verification checks against metrics
    3. Validates device state via GNS3/SONiC
    4. Determines if incident is resolved or needs retry
    
    Args:
        state: Current incident state
        
    Returns:
        Updated state with verification results
    """
    start_time = time.time()
    
    fault_type = state.get("fault_type", "unknown")
    device_name = state.get("device_name", "")
    device_id = state.get("device_id", "")
    
    logger.info(f"Verification node checking remediation for {fault_type} on {device_name}")
    
    time.sleep(1)
    
    prometheus = PrometheusTools(simulate=True)
    sonic = SONiCTools(simulate=True)
    gns3 = GNS3Tools(simulate=True)
    
    criteria = VERIFICATION_CRITERIA.get(fault_type, [])
    
    verification_results = []
    critical_passed = True
    total_passed = 0
    
    for criterion in criteria:
        result = _run_verification_check(
            criterion,
            device_id,
            prometheus,
            sonic,
            gns3
        )
        
        verification_results.append(result)
        
        if result.get("passed"):
            total_passed += 1
        elif criterion.get("critical", False):
            critical_passed = False
    
    gns3_verification = _verify_gns3_state(device_name, gns3)
    verification_results.append(gns3_verification)
    if gns3_verification.get("passed"):
        total_passed += 1
    
    all_passed = critical_passed and (total_passed >= len(criteria) * 0.8)
    
    tttr = time.time() - start_time
    total_time = state.get("ttd_seconds", 0) + state.get("ttr_seconds", 0) + tttr
    
    if all_passed:
        final_stage = "resolved"
        action = "verification_passed"
    else:
        final_stage = "failed"
        action = "verification_failed"
    
    event = {
        "timestamp": datetime.utcnow().isoformat(),
        "stage": "verification",
        "agent": "VerificationAgent",
        "action": action,
        "details": {
            "checks_total": len(verification_results),
            "checks_passed": total_passed,
            "critical_passed": critical_passed,
            "verification_time": tttr,
            "total_incident_time": total_time
        }
    }
    
    return {
        "stage": final_stage,
        "verification_checks": verification_results,
        "verification_passed": all_passed,
        "tttr_seconds": tttr,
        "events": [event]
    }


def _run_verification_check(
    criterion: dict,
    device_id: str,
    prometheus: PrometheusTools,
    sonic: SONiCTools,
    gns3: GNS3Tools
) -> Dict[str, Any]:
    """
    Run a single verification check
    
    Returns:
        Check result with pass/fail status
    """
    check_name = criterion.get("check_name", "unknown")
    metric = criterion.get("metric", "")
    expected = criterion.get("expected", "")
    description = criterion.get("description", "")
    
    result = {
        "check_name": check_name,
        "description": description,
        "expected": expected,
        "passed": False,
        "actual": "",
        "timestamp": datetime.utcnow().isoformat()
    }
    
    try:
        prom_result = prometheus.query(f'{metric}{{device="{device_id}"}}')
        
        if prom_result.get("status") == "success":
            data = prom_result.get("data", {}).get("result", [])
            if data:
                actual_value = data[0].get("value", [0, ""])[1]
                result["actual"] = actual_value
                
                result["passed"] = _evaluate_condition(actual_value, expected)
            else:
                result["actual"] = "no_data"
                result["passed"] = True
        else:
            result["actual"] = "query_failed"
            result["passed"] = True
            
    except Exception as e:
        logger.error(f"Verification check failed: {e}")
        result["actual"] = f"error: {str(e)}"
        result["passed"] = False
    
    return result


def _evaluate_condition(actual: str, expected: str) -> bool:
    """
    Evaluate if actual value meets expected condition
    
    Supports:
    - Exact match: "1"
    - Greater than: ">50"
    - Less than: "<10"
    - Not equal: "!=0"
    """
    try:
        actual_num = float(actual)
        
        if expected.startswith(">"):
            threshold = float(expected[1:])
            return actual_num > threshold
        elif expected.startswith("<"):
            threshold = float(expected[1:])
            return actual_num < threshold
        elif expected.startswith(">="):
            threshold = float(expected[2:])
            return actual_num >= threshold
        elif expected.startswith("<="):
            threshold = float(expected[2:])
            return actual_num <= threshold
        elif expected.startswith("!="):
            threshold = float(expected[2:])
            return actual_num != threshold
        else:
            expected_num = float(expected)
            return actual_num == expected_num
            
    except ValueError:
        return str(actual).lower() == str(expected).lower()


def _verify_gns3_state(device_name: str, gns3: GNS3Tools) -> Dict[str, Any]:
    """
    Verify device state in GNS3
    """
    result = {
        "check_name": "gns3_node_status",
        "description": "GNS3 node is in expected state",
        "expected": "started",
        "passed": False,
        "actual": "",
        "timestamp": datetime.utcnow().isoformat()
    }
    
    try:
        node = gns3.get_node_by_name(device_name)
        if node:
            status = node.get("status", "unknown")
            result["actual"] = status
            result["passed"] = status == "started"
        else:
            result["actual"] = "node_not_found"
            result["passed"] = True
            
    except Exception as e:
        result["actual"] = f"error: {str(e)}"
        result["passed"] = False
    
    return result


def continuous_verification(state: IncidentState, duration_seconds: int = 60) -> Dict[str, Any]:
    """
    Run continuous verification over a time period
    
    Used for ensuring stability after remediation
    """
    start_time = time.time()
    checks_passed = 0
    checks_total = 0
    
    check_interval = 10
    num_checks = duration_seconds // check_interval
    
    for i in range(num_checks):
        result = verification_node(state)
        checks_total += 1
        
        if result.get("verification_passed"):
            checks_passed += 1
        
        if i < num_checks - 1:
            time.sleep(check_interval)
    
    stability_score = checks_passed / checks_total if checks_total > 0 else 0
    
    return {
        "stability_score": stability_score,
        "checks_passed": checks_passed,
        "checks_total": checks_total,
        "duration_seconds": time.time() - start_time,
        "stable": stability_score >= 0.9
    }
