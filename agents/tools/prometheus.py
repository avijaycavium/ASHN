"""
Prometheus Tools - Query metrics for anomaly detection and verification
"""
import requests
from typing import Optional, List, Dict
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class PrometheusTools:
    """Tools for querying Prometheus metrics"""
    
    METRIC_THRESHOLDS = {
        "bgp_session_state": {"critical": 0, "warning": 1},
        "interface_errors_rate": {"critical": 100, "warning": 50},
        "traffic_utilization": {"critical": 95, "warning": 80},
        "cpu_utilization": {"critical": 90, "warning": 75},
        "memory_utilization": {"critical": 90, "warning": 80},
        "bgp_prefixes_received": {"critical_drop": 50, "warning_drop": 25},
        "link_flap_count": {"critical": 5, "warning": 3},
    }
    
    def __init__(self, base_url: str = "http://localhost:9090", simulate: bool = True):
        """
        Initialize Prometheus tools
        
        Args:
            base_url: Prometheus server URL
            simulate: If True, return simulated data
        """
        self.base_url = base_url
        self.simulate = simulate
        self.session = requests.Session()
    
    def query(self, promql: str) -> dict:
        """
        Execute a PromQL query
        
        Args:
            promql: The PromQL query string
        
        Returns:
            Query results
        """
        if self.simulate:
            return self._simulate_query(promql)
        
        try:
            response = self.session.get(
                f"{self.base_url}/api/v1/query",
                params={"query": promql},
                timeout=10
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Prometheus query failed: {e}")
            return {"status": "error", "error": str(e)}
    
    def query_range(self, promql: str, start: datetime, end: datetime, step: str = "15s") -> dict:
        """Execute a range query for time series data"""
        if self.simulate:
            return self._simulate_range_query(promql, start, end)
        
        try:
            response = self.session.get(
                f"{self.base_url}/api/v1/query_range",
                params={
                    "query": promql,
                    "start": start.isoformat(),
                    "end": end.isoformat(),
                    "step": step
                },
                timeout=10
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Prometheus range query failed: {e}")
            return {"status": "error", "error": str(e)}
    
    def _simulate_query(self, promql: str) -> dict:
        """Simulate Prometheus query responses"""
        query_lower = promql.lower()
        
        if "bgp_session" in query_lower:
            return {
                "status": "success",
                "data": {
                    "resultType": "vector",
                    "result": [
                        {"metric": {"device": "core-1", "neighbor": "10.0.0.2"}, "value": [1704067200, "1"]},
                        {"metric": {"device": "core-1", "neighbor": "10.0.0.3"}, "value": [1704067200, "1"]},
                        {"metric": {"device": "core-1", "neighbor": "10.0.0.4"}, "value": [1704067200, "0"]},
                    ]
                }
            }
        
        elif "interface_errors" in query_lower or "error" in query_lower:
            return {
                "status": "success",
                "data": {
                    "resultType": "vector",
                    "result": [
                        {"metric": {"device": "spine-1", "interface": "Ethernet8"}, "value": [1704067200, "156"]},
                        {"metric": {"device": "spine-2", "interface": "Ethernet4"}, "value": [1704067200, "23"]},
                    ]
                }
            }
        
        elif "cpu" in query_lower:
            return {
                "status": "success",
                "data": {
                    "resultType": "vector",
                    "result": [
                        {"metric": {"device": "core-1"}, "value": [1704067200, "45"]},
                        {"metric": {"device": "spine-1"}, "value": [1704067200, "62"]},
                    ]
                }
            }
        
        elif "memory" in query_lower:
            return {
                "status": "success",
                "data": {
                    "resultType": "vector",
                    "result": [
                        {"metric": {"device": "core-1"}, "value": [1704067200, "58"]},
                        {"metric": {"device": "spine-1"}, "value": [1704067200, "72"]},
                    ]
                }
            }
        
        elif "traffic" in query_lower or "utilization" in query_lower:
            return {
                "status": "success",
                "data": {
                    "resultType": "vector",
                    "result": [
                        {"metric": {"device": "core-1", "interface": "Ethernet0"}, "value": [1704067200, "78"]},
                        {"metric": {"device": "core-1", "interface": "Ethernet4"}, "value": [1704067200, "92"]},
                    ]
                }
            }
        
        else:
            return {
                "status": "success",
                "data": {"resultType": "vector", "result": []}
            }
    
    def _simulate_range_query(self, promql: str, start: datetime, end: datetime) -> dict:
        """Simulate range query with time series data"""
        import random
        
        duration = (end - start).total_seconds()
        num_points = min(int(duration / 15), 100)
        
        values = []
        for i in range(num_points):
            ts = start.timestamp() + (i * 15)
            val = 50 + random.uniform(-10, 10)
            if "error" in promql.lower():
                val = random.uniform(0, 50)
            values.append([ts, str(val)])
        
        return {
            "status": "success",
            "data": {
                "resultType": "matrix",
                "result": [
                    {"metric": {"device": "core-1"}, "values": values}
                ]
            }
        }
    
    def get_device_metrics(self, device_id: str, metric_name: str) -> dict:
        """
        Get a specific metric value for a device
        
        Args:
            device_id: Device identifier
            metric_name: Metric name (cpu_utilization, memory_utilization, etc.)
        
        Returns:
            Query results for the metric
        """
        return self.query(f'{metric_name}{{device="{device_id}"}}')
    
    def detect_anomalies(self, device_id: str) -> List[Dict]:
        """
        Detect metric anomalies for a device
        
        Returns list of detected anomalies with severity
        """
        anomalies = []
        
        bgp_result = self.query(f'bgp_session_state{{device="{device_id}"}}')
        if bgp_result.get("status") == "success":
            for result in bgp_result.get("data", {}).get("result", []):
                value = float(result.get("value", [0, "1"])[1])
                if value == 0:
                    anomalies.append({
                        "metric": "bgp_session_state",
                        "value": value,
                        "severity": "critical",
                        "description": f"BGP session down for neighbor {result.get('metric', {}).get('neighbor', 'unknown')}"
                    })
        
        error_result = self.query(f'rate(interface_errors_total{{device="{device_id}"}}[5m])')
        if error_result.get("status") == "success":
            for result in error_result.get("data", {}).get("result", []):
                value = float(result.get("value", [0, "0"])[1])
                threshold = self.METRIC_THRESHOLDS["interface_errors_rate"]
                if value >= threshold["critical"]:
                    anomalies.append({
                        "metric": "interface_errors_rate",
                        "value": value,
                        "severity": "critical",
                        "description": f"High error rate on interface {result.get('metric', {}).get('interface', 'unknown')}"
                    })
                elif value >= threshold["warning"]:
                    anomalies.append({
                        "metric": "interface_errors_rate",
                        "value": value,
                        "severity": "warning",
                        "description": f"Elevated error rate on interface {result.get('metric', {}).get('interface', 'unknown')}"
                    })
        
        return anomalies
    
    def get_device_health_metrics(self, device_id: str) -> Dict:
        """Get comprehensive health metrics for a device"""
        return {
            "cpu_utilization": self.query(f'cpu_utilization{{device="{device_id}"}}'),
            "memory_utilization": self.query(f'memory_utilization{{device="{device_id}"}}'),
            "bgp_sessions": self.query(f'bgp_session_state{{device="{device_id}"}}'),
            "interface_errors": self.query(f'rate(interface_errors_total{{device="{device_id}"}}[5m])'),
            "traffic_utilization": self.query(f'interface_utilization{{device="{device_id}"}}'),
        }
    
    def verify_metric_recovery(self, device_id: str, metric_name: str, expected_state: str) -> Dict:
        """
        Verify that a metric has recovered to expected state
        
        Returns verification result with pass/fail status
        """
        result = self.query(f'{metric_name}{{device="{device_id}"}}')
        
        if result.get("status") != "success":
            return {
                "passed": False,
                "metric": metric_name,
                "expected": expected_state,
                "actual": "query_failed",
                "error": result.get("error", "Unknown error")
            }
        
        data = result.get("data", {}).get("result", [])
        if not data:
            return {
                "passed": False,
                "metric": metric_name,
                "expected": expected_state,
                "actual": "no_data"
            }
        
        current_value = data[0].get("value", [0, ""])[1]
        passed = str(current_value) == str(expected_state)
        
        return {
            "passed": passed,
            "metric": metric_name,
            "expected": expected_state,
            "actual": current_value
        }
