"""
Remediation Node - Executes corrective actions
Applies SONiC commands and GNS3 operations to fix identified issues
"""
import time
from datetime import datetime
from typing import Dict, Any, List
import logging

from ..state import IncidentState
from ..tools.sonic import SONiCTools
from ..tools.gns3 import GNS3Tools

logger = logging.getLogger(__name__)


REMEDIATION_PLAYBOOKS = {
    "bgp_link_flap": [
        {
            "action_type": "adjust_bgp_timers",
            "description": "Increase BGP hold timer to reduce flapping sensitivity",
            "command": "configure terminal\\nrouter bgp\\ntimers bgp 60 180",
            "risk": "low"
        },
        {
            "action_type": "clear_interface_counters",
            "description": "Clear interface error counters for baseline",
            "command": "clear counters all",
            "risk": "low"
        }
    ],
    "bgp_session_instability": [
        {
            "action_type": "clear_bgp_session",
            "description": "Clear BGP session to reset neighbor state",
            "command": "clear bgp * all",
            "risk": "medium"
        },
        {
            "action_type": "soft_reconfiguration",
            "description": "Apply soft reconfiguration to refresh routes",
            "command": "clear bgp * soft in",
            "risk": "low"
        }
    ],
    "traffic_drop": [
        {
            "action_type": "failover_path",
            "description": "Failover traffic to backup ECMP path",
            "command": "configure terminal\\ninterface Ethernet8\\nshutdown",
            "risk": "medium"
        },
        {
            "action_type": "adjust_bgp_weight",
            "description": "Adjust BGP weight to prefer backup path",
            "command": "configure terminal\\nrouter bgp\\nneighbor 10.0.0.2 weight 200",
            "risk": "low"
        }
    ],
    "cpu_spike": [
        {
            "action_type": "enable_copp",
            "description": "Enable Control Plane Policing to protect CPU",
            "command": "configure terminal\\ncopp enable",
            "risk": "low"
        },
        {
            "action_type": "reduce_logging",
            "description": "Reduce logging verbosity to decrease CPU load",
            "command": "configure terminal\\nlogging level warning",
            "risk": "low"
        }
    ],
    "memory_exhaustion": [
        {
            "action_type": "clear_route_cache",
            "description": "Clear route cache to free memory",
            "command": "clear ip route cache",
            "risk": "low"
        },
        {
            "action_type": "clear_arp_cache",
            "description": "Clear ARP cache to free memory",
            "command": "clear arp-cache",
            "risk": "low"
        }
    ]
}


def remediation_node(state: IncidentState) -> Dict[str, Any]:
    """
    Remediation Node - Executes corrective actions
    
    This node:
    1. Retrieves the remediation plan from RCA
    2. Executes actions in order
    3. Records success/failure of each action
    4. Prepares for verification
    
    Args:
        state: Current incident state
        
    Returns:
        Updated state with remediation results
    """
    start_time = time.time()
    
    fault_type = state.get("fault_type", "unknown")
    device_name = state.get("device_name", "")
    device_id = state.get("device_id", "")
    remediation_plan = state.get("remediation_plan", [])
    remediation_risk = state.get("remediation_risk", "medium")
    
    logger.info(f"Remediation node executing actions for {fault_type} on {device_name}")
    
    sonic = SONiCTools(simulate=True)
    gns3 = GNS3Tools(simulate=True)
    
    playbook = REMEDIATION_PLAYBOOKS.get(fault_type, [])
    
    actions_executed = []
    all_succeeded = True
    
    for action_def in playbook:
        if remediation_risk == "low" and action_def.get("risk") in ["high"]:
            logger.info(f"Skipping high-risk action: {action_def['action_type']}")
            continue
        
        action_result = _execute_action(
            action_def,
            device_name,
            sonic,
            gns3
        )
        
        actions_executed.append(action_result)
        
        if not action_result.get("success", False):
            all_succeeded = False
            if action_def.get("risk") == "high":
                logger.error(f"Critical action failed: {action_def['action_type']}")
                break
        
        time.sleep(0.5)
    
    ttr = time.time() - start_time
    
    event = {
        "timestamp": datetime.utcnow().isoformat(),
        "stage": "remediation",
        "agent": "RemediationAgent",
        "action": "remediation_complete" if all_succeeded else "remediation_partial",
        "details": {
            "actions_attempted": len(actions_executed),
            "actions_succeeded": sum(1 for a in actions_executed if a.get("success")),
            "total_time": ttr
        }
    }
    
    return {
        "stage": "verification",
        "remediation_actions": actions_executed,
        "ttr_seconds": ttr,
        "events": [event]
    }


def _execute_action(
    action_def: dict,
    device_name: str,
    sonic: SONiCTools,
    gns3: GNS3Tools
) -> Dict[str, Any]:
    """
    Execute a single remediation action
    
    Returns:
        Action result with success status
    """
    action_type = action_def.get("action_type", "")
    command = action_def.get("command", "")
    description = action_def.get("description", "")
    
    logger.info(f"Executing action: {action_type} - {description}")
    
    result = {
        "action_type": action_type,
        "command": command,
        "target_device": device_name,
        "description": description,
        "executed": True,
        "success": False,
        "output": "",
        "timestamp": datetime.utcnow().isoformat()
    }
    
    try:
        if action_type == "failover_path":
            node = gns3.get_node_by_name(device_name)
            if node:
                gns3_result = gns3.reload_node(node.get("node_id", ""))
                result["success"] = gns3_result.get("success", False)
                result["output"] = str(gns3_result.get("data", {}))
            else:
                sonic_result = sonic.execute_vtysh(command)
                result["success"] = sonic_result.get("success", False)
                result["output"] = sonic_result.get("output", "")
        
        elif action_type == "clear_bgp_session":
            sonic_result = sonic.clear_bgp_session("*")
            result["success"] = sonic_result.get("success", False)
            result["output"] = sonic_result.get("output", "")
        
        elif action_type == "adjust_bgp_weight":
            sonic_result = sonic.set_bgp_neighbor_weight("10.0.0.2", 200)
            result["success"] = sonic_result.get("success", False)
            result["output"] = sonic_result.get("output", "")
        
        elif action_type == "shutdown_interface":
            interface = command.split("interface ")[-1].split("\\n")[0] if "interface" in command else "Ethernet8"
            sonic_result = sonic.shutdown_interface(interface)
            result["success"] = sonic_result.get("success", False)
            result["output"] = sonic_result.get("output", "")
        
        else:
            sonic_result = sonic.execute_vtysh(command)
            result["success"] = sonic_result.get("success", False)
            result["output"] = sonic_result.get("output", "")
            
            if sonic_result.get("error"):
                result["error"] = sonic_result["error"]
        
    except Exception as e:
        logger.error(f"Action execution failed: {e}")
        result["success"] = False
        result["error"] = str(e)
    
    return result


def emergency_rollback(state: IncidentState) -> Dict[str, Any]:
    """
    Emergency rollback - Undo remediation actions if verification fails
    
    This is called if verification shows the remediation made things worse
    """
    actions = state.get("remediation_actions", [])
    device_name = state.get("device_name", "")
    
    sonic = SONiCTools(simulate=True)
    gns3 = GNS3Tools(simulate=True)
    
    rollback_actions = []
    
    for action in reversed(actions):
        if not action.get("success"):
            continue
        
        action_type = action.get("action_type", "")
        
        if action_type == "shutdown_interface":
            interface = action.get("command", "").split("interface ")[-1].split("\\n")[0]
            result = sonic.enable_interface(interface)
            rollback_actions.append({
                "action_type": "enable_interface",
                "success": result.get("success", False),
                "original_action": action_type
            })
    
    event = {
        "timestamp": datetime.utcnow().isoformat(),
        "stage": "remediation",
        "agent": "RemediationAgent",
        "action": "emergency_rollback",
        "details": {
            "rollback_actions": len(rollback_actions),
            "reason": "verification_failed"
        }
    }
    
    return {
        "events": [event],
        "remediation_actions": rollback_actions
    }
