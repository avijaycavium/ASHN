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


def run_server(host: str = "0.0.0.0", port: int = 5001):
    """Run the Flask server"""
    logger.info(f"Starting AASHN Agent Server on {host}:{port}")
    app.run(host=host, port=port, debug=False, threaded=True)


if __name__ == "__main__":
    run_server()
