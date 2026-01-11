"""
GNS3 Tools - Integration with GNS3 network simulation
Provides node control and topology management
"""
import requests
import os
from typing import Optional, List, Dict
import logging

logger = logging.getLogger(__name__)


class GNS3Tools:
    """Tools for interacting with GNS3 simulation environment"""
    
    def __init__(
        self,
        server_url: Optional[str] = None,
        project_id: Optional[str] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
        simulate: bool = True
    ):
        """
        Initialize GNS3 tools
        
        Args:
            server_url: GNS3 server URL
            project_id: GNS3 project UUID
            username: Optional authentication username
            password: Optional authentication password
            simulate: If True, return simulated responses
        """
        self.server_url = server_url or os.getenv("GNS3_SERVER_URL", "http://localhost:3080")
        self.project_id = project_id or os.getenv("GNS3_PROJECT_ID", "")
        self.username = username or os.getenv("GNS3_USERNAME")
        self.password = password or os.getenv("GNS3_PASSWORD")
        self.simulate = simulate or os.getenv("GNS3_ENABLED", "false").lower() != "true"
        
        self.session = requests.Session()
        if self.username and self.password:
            self.session.auth = (self.username, self.password)
    
    def _api_request(self, method: str, endpoint: str, json_data: Optional[dict] = None) -> dict:
        """Make an API request to GNS3 server"""
        if self.simulate:
            return self._simulate_request(method, endpoint, json_data)
        
        url = f"{self.server_url}/v2{endpoint}"
        
        try:
            response = self.session.request(
                method=method,
                url=url,
                json=json_data,
                timeout=30
            )
            response.raise_for_status()
            return {
                "success": True,
                "data": response.json() if response.content else {},
                "status_code": response.status_code
            }
        except requests.exceptions.RequestException as e:
            logger.error(f"GNS3 API request failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "status_code": getattr(e.response, 'status_code', None) if hasattr(e, 'response') else None
            }
    
    def _simulate_request(self, method: str, endpoint: str, json_data: Optional[dict] = None) -> dict:
        """Simulate GNS3 API responses"""
        
        if "nodes" in endpoint and method.upper() == "GET":
            return {
                "success": True,
                "data": [
                    {"node_id": "node-1", "name": "core-1", "status": "started", "node_type": "dynamips"},
                    {"node_id": "node-2", "name": "spine-1", "status": "started", "node_type": "dynamips"},
                    {"node_id": "node-3", "name": "spine-2", "status": "stopped", "node_type": "dynamips"},
                    {"node_id": "node-4", "name": "tor-1", "status": "started", "node_type": "dynamips"},
                ]
            }
        
        elif "links" in endpoint and method.upper() == "GET":
            return {
                "success": True,
                "data": [
                    {
                        "link_id": "link-1",
                        "nodes": [
                            {"node_id": "node-1", "port_number": 0},
                            {"node_id": "node-2", "port_number": 0}
                        ]
                    },
                    {
                        "link_id": "link-2",
                        "nodes": [
                            {"node_id": "node-1", "port_number": 1},
                            {"node_id": "node-3", "port_number": 0}
                        ]
                    },
                ]
            }
        
        elif "/start" in endpoint:
            return {"success": True, "data": {"status": "started"}}
        
        elif "/stop" in endpoint:
            return {"success": True, "data": {"status": "stopped"}}
        
        elif "/reload" in endpoint:
            return {"success": True, "data": {"status": "started"}}
        
        else:
            return {"success": True, "data": {}}
    
    def get_nodes(self) -> dict:
        """Get all nodes in the project"""
        return self._api_request("GET", f"/projects/{self.project_id}/nodes")
    
    def get_node(self, node_id: str) -> dict:
        """Get a specific node by ID"""
        return self._api_request("GET", f"/projects/{self.project_id}/nodes/{node_id}")
    
    def get_links(self) -> dict:
        """Get all links in the project"""
        return self._api_request("GET", f"/projects/{self.project_id}/links")
    
    def start_node(self, node_id: str) -> dict:
        """Start a node"""
        return self._api_request("POST", f"/projects/{self.project_id}/nodes/{node_id}/start")
    
    def stop_node(self, node_id: str) -> dict:
        """Stop a node"""
        return self._api_request("POST", f"/projects/{self.project_id}/nodes/{node_id}/stop")
    
    def reload_node(self, node_id: str) -> dict:
        """Reload/restart a node"""
        return self._api_request("POST", f"/projects/{self.project_id}/nodes/{node_id}/reload")
    
    def suspend_node(self, node_id: str) -> dict:
        """Suspend a node"""
        return self._api_request("POST", f"/projects/{self.project_id}/nodes/{node_id}/suspend")
    
    def get_node_by_name(self, name: str) -> Optional[dict]:
        """Find a node by its name"""
        result = self.get_nodes()
        if not result.get("success"):
            return None
        
        for node in result.get("data", []):
            if node.get("name", "").lower() == name.lower():
                return node
        return None
    
    def failover_to_backup_path(self, primary_node: str, backup_node: str) -> dict:
        """
        Initiate failover from primary to backup path
        
        This stops the primary and ensures backup is running
        """
        results = []
        
        stop_result = self.stop_node(primary_node)
        results.append({
            "action": "stop_primary",
            "node": primary_node,
            "success": stop_result.get("success", False)
        })
        
        start_result = self.start_node(backup_node)
        results.append({
            "action": "start_backup",
            "node": backup_node,
            "success": start_result.get("success", False)
        })
        
        return {
            "success": all(r["success"] for r in results),
            "actions": results
        }
    
    def restart_node_for_recovery(self, node_id: str) -> dict:
        """
        Restart a node as a remediation action
        
        Useful for clearing transient issues
        """
        stop_result = self.stop_node(node_id)
        if not stop_result.get("success"):
            return stop_result
        
        import time
        time.sleep(2)
        
        return self.start_node(node_id)
    
    def get_node_console_output(self, node_id: str) -> dict:
        """Get console output from a node (for diagnostics)"""
        if self.simulate:
            return {
                "success": True,
                "output": f"Console output for node {node_id}:\n> show version\nSONiC Software Version: SONiC.4.2.0\n> "
            }
        
        return self._api_request("GET", f"/projects/{self.project_id}/nodes/{node_id}/console")
