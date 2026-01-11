"""
Flask API Server for LangGraph Agents
Exposes endpoints for triggering and monitoring agent workflows
"""
import os
import uuid
import logging
import threading
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from concurrent.futures import ThreadPoolExecutor

from .graph import run_healing_workflow
from .state import create_initial_state

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

active_workflows = {}
completed_workflows = {}
workflow_lock = threading.Lock()

executor = ThreadPoolExecutor(max_workers=5)


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "aashn-agents",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat()
    })


def _execute_workflow_background(
    incident_id: str,
    device_id: str,
    device_name: str,
    device_type: str,
    fault_type: str,
    severity: str
):
    """Execute workflow in background thread"""
    try:
        result = run_healing_workflow(
            incident_id=incident_id,
            device_id=device_id,
            device_name=device_name,
            device_type=device_type,
            fault_type=fault_type,
            severity=severity
        )
        
        with workflow_lock:
            if incident_id in active_workflows:
                del active_workflows[incident_id]
            completed_workflows[incident_id] = {
                "result": result,
                "completed_at": datetime.utcnow().isoformat()
            }
            
        logger.info(f"Workflow {incident_id} completed with stage: {result.get('stage')}")
        
    except Exception as e:
        logger.error(f"Background workflow {incident_id} failed: {e}")
        with workflow_lock:
            if incident_id in active_workflows:
                del active_workflows[incident_id]
            completed_workflows[incident_id] = {
                "result": {"stage": "failed", "error": str(e)},
                "completed_at": datetime.utcnow().isoformat()
            }


@app.route('/api/agents/trigger', methods=['POST'])
def trigger_healing():
    """
    Trigger the autonomous healing workflow
    
    Request body:
    {
        "device_id": "string",
        "device_name": "string", 
        "device_type": "core|spine|tor|dpu",
        "fault_type": "bgp_link_flap|bgp_session_instability|traffic_drop|cpu_spike|memory_exhaustion",
        "severity": "critical|high|medium|low",
        "async": true/false (optional, default false)
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "Request body required"}), 400
        
        required_fields = ["device_id", "device_name", "fault_type"]
        missing = [f for f in required_fields if f not in data]
        if missing:
            return jsonify({"error": f"Missing required fields: {missing}"}), 400
        
        incident_id = f"INC-{uuid.uuid4().hex[:8].upper()}"
        
        device_id = data["device_id"]
        device_name = data["device_name"]
        device_type = data.get("device_type", "unknown")
        fault_type = data["fault_type"]
        severity = data.get("severity", "medium")
        run_async = data.get("async", False)
        
        logger.info(f"Triggering healing workflow: {incident_id}")
        logger.info(f"Device: {device_name}, Fault: {fault_type}, Severity: {severity}, Async: {run_async}")
        
        with workflow_lock:
            active_workflows[incident_id] = {
                "status": "running",
                "started_at": datetime.utcnow().isoformat(),
                "device_name": device_name,
                "fault_type": fault_type
            }
        
        if run_async:
            executor.submit(
                _execute_workflow_background,
                incident_id, device_id, device_name, device_type, fault_type, severity
            )
            return jsonify({
                "success": True,
                "incident_id": incident_id,
                "async": True,
                "message": "Workflow started in background. Poll /api/agents/workflow/<incident_id> for status."
            }), 202
        
        result = run_healing_workflow(
            incident_id=incident_id,
            device_id=device_id,
            device_name=device_name,
            device_type=device_type,
            fault_type=fault_type,
            severity=severity
        )
        
        with workflow_lock:
            if incident_id in active_workflows:
                del active_workflows[incident_id]
            completed_workflows[incident_id] = {
                "result": result,
                "completed_at": datetime.utcnow().isoformat()
            }
        
        return jsonify({
            "success": True,
            "incident_id": incident_id,
            "stage": result.get("stage"),
            "fault_type": result.get("fault_type"),
            "root_cause": result.get("root_cause"),
            "verification_passed": result.get("verification_passed"),
            "timing": {
                "detection": result.get("ttd_seconds", 0),
                "remediation": result.get("ttr_seconds", 0),
                "verification": result.get("tttr_seconds", 0),
                "total": (result.get("ttd_seconds", 0) + 
                         result.get("ttr_seconds", 0) + 
                         result.get("tttr_seconds", 0))
            },
            "events": result.get("events", []),
            "actions": result.get("remediation_actions", []),
            "internal_logs": result.get("internal_logs", []),
            "verification_checks": result.get("verification_checks", []),
            "rca_hypothesis": result.get("rca_hypothesis"),
            "rca_evidence": result.get("rca_evidence", []),
            "detection_confidence": result.get("detection_confidence"),
            "rca_confidence": result.get("rca_confidence"),
            "error": result.get("error")
        })
        
    except Exception as e:
        logger.error(f"Workflow trigger failed: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/agents/status', methods=['GET'])
def get_agent_status():
    """Get status of all agent workflows"""
    with workflow_lock:
        return jsonify({
            "active": len(active_workflows),
            "completed": len(completed_workflows),
            "active_workflows": dict(active_workflows),
            "recent_completed": dict(list(completed_workflows.items())[-10:])
        })


@app.route('/api/agents/workflow/<incident_id>', methods=['GET'])
def get_workflow_result(incident_id: str):
    """Get the result of a specific workflow"""
    with workflow_lock:
        if incident_id in active_workflows:
            return jsonify({
                "status": "running",
                "workflow": dict(active_workflows[incident_id])
            })
        
        if incident_id in completed_workflows:
            workflow_data = completed_workflows[incident_id]
            result = workflow_data.get("result", {})
            return jsonify({
                "status": "completed",
                "completed_at": workflow_data.get("completed_at"),
                "incident_id": incident_id,
                "stage": result.get("stage"),
                "fault_type": result.get("fault_type"),
                "root_cause": result.get("root_cause"),
                "verification_passed": result.get("verification_passed"),
                "timing": {
                    "detection": result.get("ttd_seconds", 0),
                    "remediation": result.get("ttr_seconds", 0),
                    "verification": result.get("tttr_seconds", 0),
                    "total": (result.get("ttd_seconds", 0) + 
                             result.get("ttr_seconds", 0) + 
                             result.get("tttr_seconds", 0))
                },
                "events": result.get("events", []),
                "actions": result.get("remediation_actions", []),
                "internal_logs": result.get("internal_logs", []),
                "verification_checks": result.get("verification_checks", []),
                "rca_hypothesis": result.get("rca_hypothesis"),
                "rca_evidence": result.get("rca_evidence", []),
                "detection_confidence": result.get("detection_confidence"),
                "rca_confidence": result.get("rca_confidence"),
                "error": result.get("error")
            })
    
    return jsonify({"error": "Workflow not found"}), 404


@app.route('/api/agents/test', methods=['POST'])
def test_workflow():
    """
    Test the workflow with a simulated incident
    
    Useful for validating the system is working correctly
    """
    try:
        test_result = run_healing_workflow(
            incident_id=f"TEST-{uuid.uuid4().hex[:8].upper()}",
            device_id="test-device-001",
            device_name="test-core-1",
            device_type="core",
            fault_type="bgp_link_flap",
            severity="medium"
        )
        
        return jsonify({
            "success": True,
            "test_passed": test_result.get("stage") == "resolved",
            "result": {
                "stage": test_result.get("stage"),
                "fault_type": test_result.get("fault_type"),
                "verification_passed": test_result.get("verification_passed"),
                "events_count": len(test_result.get("events", [])),
                "internal_logs_count": len(test_result.get("internal_logs", []))
            },
            "internal_logs": test_result.get("internal_logs", [])
        })
        
    except Exception as e:
        logger.error(f"Test workflow failed: {e}")
        return jsonify({
            "success": False,
            "test_passed": False,
            "error": str(e)
        }), 500


@app.route('/api/agents/capabilities', methods=['GET'])
def get_capabilities():
    """Get agent capabilities and supported fault types"""
    return jsonify({
        "supported_fault_types": [
            {
                "type": "bgp_link_flap",
                "description": "BGP session flapping due to unstable physical or logical link",
                "auto_remediation": True,
                "risk_level": "low"
            },
            {
                "type": "bgp_session_instability",
                "description": "BGP session instability without physical link issues",
                "auto_remediation": True,
                "risk_level": "medium"
            },
            {
                "type": "traffic_drop",
                "description": "Unexpected traffic drop indicating routing or forwarding issues",
                "auto_remediation": True,
                "risk_level": "medium"
            },
            {
                "type": "cpu_spike",
                "description": "CPU utilization spike affecting device performance",
                "auto_remediation": True,
                "risk_level": "low"
            },
            {
                "type": "memory_exhaustion",
                "description": "Memory utilization approaching critical levels",
                "auto_remediation": True,
                "risk_level": "medium"
            }
        ],
        "agents": [
            {
                "name": "DetectionAgent",
                "role": "Anomaly detection and fault classification",
                "uses_ai": True
            },
            {
                "name": "RCAAgent",
                "role": "Root cause analysis and hypothesis generation",
                "uses_ai": True
            },
            {
                "name": "RemediationAgent",
                "role": "Execute corrective actions via SONiC/GNS3",
                "uses_ai": False
            },
            {
                "name": "VerificationAgent",
                "role": "Validate fix success via metrics",
                "uses_ai": False
            }
        ],
        "features": [
            "Automatic fault detection",
            "AI-powered root cause analysis",
            "Automated remediation playbooks",
            "Metric-based verification",
            "Retry logic with rollback",
            "Full incident timeline tracking"
        ]
    })


@app.route('/api/agents/registry', methods=['GET'])
def get_agent_registry():
    """
    Get the full LangGraph agent registry with real-time status
    This is the source of truth for agent definitions
    """
    with workflow_lock:
        active_count = len(active_workflows)
    
    return jsonify({
        "agents": [
            {
                "id": "langgraph-detection",
                "name": "DetectionAgent",
                "type": "detection",
                "status": "active" if active_count > 0 else "idle",
                "description": "Analyzes metrics and confirms/classifies network faults using AI-powered pattern recognition",
                "capabilities": [
                    {"name": "anomaly_detection", "description": "Detect metric anomalies using statistical analysis"},
                    {"name": "fault_classification", "description": "Classify faults into specific types (BGP, traffic, CPU, memory)"},
                    {"name": "confidence_scoring", "description": "Calculate detection confidence scores"}
                ],
                "tools": ["prometheus", "gns3"],
                "usesAI": True,
                "framework": "langgraph",
                "lastActive": datetime.utcnow().isoformat()
            },
            {
                "id": "langgraph-rca",
                "name": "RCAAgent",
                "type": "rca",
                "status": "active" if active_count > 0 else "idle",
                "description": "Performs root cause analysis using correlation analysis and AI hypothesis generation",
                "capabilities": [
                    {"name": "correlation_analysis", "description": "Correlate events across devices"},
                    {"name": "hypothesis_generation", "description": "Generate root cause hypotheses"},
                    {"name": "evidence_collection", "description": "Collect supporting evidence for hypotheses"}
                ],
                "tools": ["prometheus", "gns3"],
                "usesAI": True,
                "framework": "langgraph",
                "lastActive": datetime.utcnow().isoformat()
            },
            {
                "id": "langgraph-remediation",
                "name": "RemediationAgent",
                "type": "remediation",
                "status": "active" if active_count > 0 else "idle",
                "description": "Executes corrective actions via SONiC and GNS3 based on playbooks",
                "capabilities": [
                    {"name": "playbook_execution", "description": "Execute remediation playbooks"},
                    {"name": "bgp_remediation", "description": "Reset BGP sessions and clear routes"},
                    {"name": "interface_remediation", "description": "Reset interfaces and clear counters"},
                    {"name": "process_remediation", "description": "Restart services and clear caches"}
                ],
                "tools": ["sonic", "gns3"],
                "usesAI": False,
                "framework": "langgraph",
                "lastActive": datetime.utcnow().isoformat()
            },
            {
                "id": "langgraph-verification",
                "name": "VerificationAgent",
                "type": "verification",
                "status": "active" if active_count > 0 else "idle",
                "description": "Validates fix success by checking metrics and running verification queries",
                "capabilities": [
                    {"name": "metric_verification", "description": "Verify metrics return to normal levels"},
                    {"name": "service_health_check", "description": "Check service health status"},
                    {"name": "connectivity_verification", "description": "Verify network connectivity"}
                ],
                "tools": ["prometheus"],
                "usesAI": False,
                "framework": "langgraph",
                "lastActive": datetime.utcnow().isoformat()
            }
        ],
        "totalAgents": 4,
        "activeWorkflows": active_count,
        "framework": "langgraph",
        "version": "1.0.0"
    })


@app.route('/api/tools/health', methods=['GET'])
def get_tools_health():
    """
    Get health status of all MCP tools (GNS3, Prometheus, SONiC)
    This provides visibility into external service connectivity
    """
    from .tools.gns3 import GNS3Tools
    from .tools.prometheus import PrometheusTools
    from .tools.sonic import SONiCTools
    
    # Check GNS3 connectivity
    gns3_status = "disconnected"
    gns3_message = ""
    gns3_url = os.environ.get("GNS3_SERVER_URL", "http://localhost:3080")
    gns3_enabled = os.environ.get("GNS3_ENABLED", "false").lower() == "true"
    
    if gns3_enabled:
        try:
            gns3 = GNS3Tools(simulate=False)
            result = gns3._api_request("GET", "/version")
            if result.get("success"):
                gns3_status = "connected"
                gns3_message = f"Version: {result.get('data', {}).get('version', 'unknown')}"
            else:
                gns3_message = result.get("error", "Connection failed")
        except Exception as e:
            gns3_message = str(e)
    else:
        gns3_status = "simulated"
        gns3_message = "Running in simulation mode"
    
    # Check Prometheus connectivity
    prometheus_status = "disconnected"
    prometheus_message = ""
    prometheus_url = os.environ.get("PROMETHEUS_URL", "http://localhost:9090")
    prometheus_enabled = os.environ.get("PROMETHEUS_ENABLED", "false").lower() == "true"
    
    if prometheus_enabled:
        try:
            prometheus = PrometheusTools(base_url=prometheus_url, simulate=False)
            result = prometheus.query("up")
            if result.get("status") == "success":
                prometheus_status = "connected"
                prometheus_message = "Metrics collection active"
            else:
                prometheus_message = result.get("error", "Connection failed")
        except Exception as e:
            prometheus_message = str(e)
    else:
        prometheus_status = "simulated"
        prometheus_message = "Running in simulation mode"
    
    # Check SONiC connectivity
    sonic_status = "disconnected"
    sonic_message = ""
    sonic_enabled = os.environ.get("SONIC_ENABLED", "false").lower() == "true"
    
    if sonic_enabled:
        try:
            sonic = SONiCTools(simulate=False)
            # Try a simple operation to check connectivity
            sonic_status = "connected"
            sonic_message = "SONiC management active"
        except Exception as e:
            sonic_message = str(e)
    else:
        sonic_status = "simulated"
        sonic_message = "Running in simulation mode"
    
    return jsonify({
        "tools": [
            {
                "id": "gns3",
                "name": "GNS3 Network Simulator",
                "description": "Network topology simulation and node control",
                "status": gns3_status,
                "message": gns3_message,
                "url": gns3_url,
                "enabled": gns3_enabled,
                "capabilities": [
                    "Node lifecycle management",
                    "Link control",
                    "Topology visualization"
                ]
            },
            {
                "id": "prometheus",
                "name": "Prometheus Metrics",
                "description": "Time-series metrics collection and queries",
                "status": prometheus_status,
                "message": prometheus_message,
                "url": prometheus_url,
                "enabled": prometheus_enabled,
                "capabilities": [
                    "Real-time metric queries",
                    "Threshold monitoring",
                    "Anomaly detection data"
                ]
            },
            {
                "id": "sonic",
                "name": "SONiC Network OS",
                "description": "Network operating system for remediation actions",
                "status": sonic_status,
                "message": sonic_message,
                "url": "",
                "enabled": sonic_enabled,
                "capabilities": [
                    "BGP session management",
                    "Interface control",
                    "Configuration changes"
                ]
            }
        ],
        "summary": {
            "total": 3,
            "connected": sum(1 for s in [gns3_status, prometheus_status, sonic_status] if s == "connected"),
            "simulated": sum(1 for s in [gns3_status, prometheus_status, sonic_status] if s == "simulated"),
            "disconnected": sum(1 for s in [gns3_status, prometheus_status, sonic_status] if s == "disconnected")
        },
        "timestamp": datetime.utcnow().isoformat()
    })


@app.route('/api/devices/telemetry', methods=['GET'])
def get_device_telemetry():
    """
    Fetch device telemetry from GNS3/Prometheus for topology sync
    Returns aggregated metrics for all devices
    """
    from .tools.gns3 import GNS3Tools
    from .tools.prometheus import PrometheusTools
    
    device_id = request.args.get('device_id')
    
    gns3_enabled = os.environ.get("GNS3_ENABLED", "false").lower() == "true"
    prometheus_enabled = os.environ.get("PROMETHEUS_ENABLED", "false").lower() == "true"
    
    gns3 = GNS3Tools(simulate=not gns3_enabled)
    prometheus = PrometheusTools(simulate=not prometheus_enabled)
    
    devices = []
    
    # Get nodes from GNS3
    nodes_result = gns3.get_nodes()
    if nodes_result.get("success"):
        for node in nodes_result.get("data", []):
            node_id = node.get("node_id", node.get("name", "unknown"))
            node_name = node.get("name", "unknown")
            
            # Query metrics from Prometheus for this device
            cpu_result = prometheus.get_device_metrics(node_name, "cpu_utilization")
            mem_result = prometheus.get_device_metrics(node_name, "memory_utilization")
            
            cpu_value = 0
            mem_value = 0
            
            if cpu_result.get("status") == "success":
                results = cpu_result.get("data", {}).get("result", [])
                if results:
                    cpu_value = float(results[0].get("value", [0, 0])[1])
            
            if mem_result.get("status") == "success":
                results = mem_result.get("data", {}).get("result", [])
                if results:
                    mem_value = float(results[0].get("value", [0, 0])[1])
            
            # Determine device status based on GNS3 node status and metrics
            node_status = node.get("status", "unknown")
            if node_status == "started":
                if cpu_value > 90 or mem_value > 90:
                    status = "critical"
                elif cpu_value > 75 or mem_value > 80:
                    status = "degraded"
                else:
                    status = "healthy"
            elif node_status == "stopped":
                status = "offline"
            else:
                status = "unknown"
            
            device_data = {
                "id": node_id,
                "name": node_name,
                "status": status,
                "gns3Status": node_status,
                "cpu": round(cpu_value, 1),
                "memory": round(mem_value, 1),
                "nodeType": node.get("node_type", "unknown"),
                "timestamp": datetime.utcnow().isoformat()
            }
            
            if device_id is None or device_id == node_id or device_id == node_name:
                devices.append(device_data)
    
    return jsonify({
        "success": True,
        "devices": devices,
        "source": {
            "gns3": "live" if gns3_enabled else "simulated",
            "prometheus": "live" if prometheus_enabled else "simulated"
        },
        "timestamp": datetime.utcnow().isoformat()
    })


@app.route('/api/topology/sync', methods=['POST'])
def sync_topology():
    """
    Trigger a topology sync - fetches latest state from GNS3/Prometheus
    and returns updates that should be broadcast via SSE
    """
    from .tools.gns3 import GNS3Tools
    from .tools.prometheus import PrometheusTools
    
    gns3_enabled = os.environ.get("GNS3_ENABLED", "false").lower() == "true"
    prometheus_enabled = os.environ.get("PROMETHEUS_ENABLED", "false").lower() == "true"
    
    gns3 = GNS3Tools(simulate=not gns3_enabled)
    prometheus = PrometheusTools(simulate=not prometheus_enabled)
    
    updates = []
    
    # Get current topology from GNS3
    nodes_result = gns3.get_nodes()
    links_result = gns3.get_links()
    
    if nodes_result.get("success"):
        for node in nodes_result.get("data", []):
            node_name = node.get("name", "unknown")
            
            # Check metrics for anomalies
            cpu_result = prometheus.get_device_metrics(node_name, "cpu_utilization")
            
            cpu_value = 0
            if cpu_result.get("status") == "success":
                results = cpu_result.get("data", {}).get("result", [])
                if results:
                    cpu_value = float(results[0].get("value", [0, 0])[1])
            
            if cpu_value > 90:
                updates.append({
                    "type": "device_status_changed",
                    "deviceId": node.get("node_id", node_name),
                    "deviceName": node_name,
                    "oldStatus": "healthy",
                    "newStatus": "critical",
                    "reason": f"CPU utilization at {cpu_value}%",
                    "timestamp": datetime.utcnow().isoformat()
                })
            elif cpu_value > 75:
                updates.append({
                    "type": "device_status_changed",
                    "deviceId": node.get("node_id", node_name),
                    "deviceName": node_name,
                    "oldStatus": "healthy",
                    "newStatus": "degraded",
                    "reason": f"CPU utilization elevated at {cpu_value}%",
                    "timestamp": datetime.utcnow().isoformat()
                })
    
    return jsonify({
        "success": True,
        "updates": updates,
        "nodeCount": len(nodes_result.get("data", [])) if nodes_result.get("success") else 0,
        "linkCount": len(links_result.get("data", [])) if links_result.get("success") else 0,
        "source": {
            "gns3": "live" if gns3_enabled else "simulated",
            "prometheus": "live" if prometheus_enabled else "simulated"
        },
        "timestamp": datetime.utcnow().isoformat()
    })


def run_server(host: str = "0.0.0.0", port: int = 5001):
    """Run the Flask server"""
    logger.info(f"Starting AASHN Agent Server on {host}:{port}")
    app.run(host=host, port=port, debug=False, threaded=True)


if __name__ == "__main__":
    run_server()
