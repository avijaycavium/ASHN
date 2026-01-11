"""
SONiC Tools - Commands for SONiC network operating system
Provides BGP, interface, and system management capabilities
"""
import subprocess
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class SONiCTools:
    """Tools for interacting with SONiC switches via vtysh and sonic-cli"""
    
    def __init__(self, simulate: bool = True):
        """
        Initialize SONiC tools
        
        Args:
            simulate: If True, return simulated responses instead of executing real commands
        """
        self.simulate = simulate
    
    def execute_vtysh(self, command: str, device_ip: Optional[str] = None) -> dict:
        """
        Execute a vtysh command on a SONiC switch
        
        Args:
            command: The vtysh command to execute
            device_ip: Target device IP (for remote execution)
        
        Returns:
            dict with success status and output
        """
        if self.simulate:
            return self._simulate_vtysh(command)
        
        try:
            full_cmd = f"vtysh -c '{command}'"
            if device_ip:
                full_cmd = f"ssh admin@{device_ip} {full_cmd}"
            
            result = subprocess.run(
                full_cmd,
                shell=True,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            return {
                "success": result.returncode == 0,
                "output": result.stdout,
                "error": result.stderr if result.returncode != 0 else None
            }
        except subprocess.TimeoutExpired:
            return {"success": False, "output": "", "error": "Command timeout"}
        except Exception as e:
            return {"success": False, "output": "", "error": str(e)}
    
    def _simulate_vtysh(self, command: str) -> dict:
        """Simulate vtysh command responses for demo purposes"""
        cmd_lower = command.lower()
        
        if "show bgp summary" in cmd_lower:
            return {
                "success": True,
                "output": """
BGP router identifier 10.0.0.1, local AS number 65001
Neighbor        V    AS MsgRcvd MsgSent TblVer  InQ OutQ  Up/Down State/PfxRcd
10.0.0.2        4 65002    1452    1389      0    0    0 01:23:45       12
10.0.0.3        4 65003    1128    1089      0    0    0 00:45:12        8
10.0.0.4        4 65004       0       0      0    0    0    never   Active
""",
                "error": None
            }
        
        elif "show interface status" in cmd_lower:
            return {
                "success": True,
                "output": """
Interface      Lanes  Speed  MTU  Alias  Admin  Oper
Ethernet0      0,1    100G   9100  Eth1/1   up    up
Ethernet4      4,5    100G   9100  Eth1/2   up    up
Ethernet8      8,9    100G   9100  Eth1/3   up   down
Ethernet12    12,13   100G   9100  Eth1/4   up    up
""",
                "error": None
            }
        
        elif "neighbor" in cmd_lower and "weight" in cmd_lower:
            return {
                "success": True,
                "output": "BGP neighbor weight updated successfully",
                "error": None
            }
        
        elif "shutdown" in cmd_lower:
            return {
                "success": True,
                "output": "Interface shutdown complete",
                "error": None
            }
        
        elif "no shutdown" in cmd_lower:
            return {
                "success": True,
                "output": "Interface enabled",
                "error": None
            }
        
        elif "clear bgp" in cmd_lower:
            return {
                "success": True,
                "output": "BGP session cleared successfully",
                "error": None
            }
        
        else:
            return {
                "success": True,
                "output": f"Command executed: {command}",
                "error": None
            }
    
    def get_bgp_neighbors(self, device_ip: Optional[str] = None) -> dict:
        """Get BGP neighbor information"""
        return self.execute_vtysh("show bgp summary", device_ip)
    
    def get_interface_status(self, device_ip: Optional[str] = None) -> dict:
        """Get interface status information"""
        return self.execute_vtysh("show interface status", device_ip)
    
    def set_bgp_neighbor_weight(self, neighbor_ip: str, weight: int, device_ip: Optional[str] = None) -> dict:
        """
        Adjust BGP neighbor weight for traffic engineering
        
        Args:
            neighbor_ip: The BGP neighbor IP address
            weight: The weight value to set (higher = preferred)
        """
        command = f"configure terminal\\nrouter bgp\\nneighbor {neighbor_ip} weight {weight}"
        return self.execute_vtysh(command, device_ip)
    
    def shutdown_interface(self, interface: str, device_ip: Optional[str] = None) -> dict:
        """Shutdown an interface (for isolation/remediation)"""
        command = f"configure terminal\\ninterface {interface}\\nshutdown"
        return self.execute_vtysh(command, device_ip)
    
    def enable_interface(self, interface: str, device_ip: Optional[str] = None) -> dict:
        """Enable an interface"""
        command = f"configure terminal\\ninterface {interface}\\nno shutdown"
        return self.execute_vtysh(command, device_ip)
    
    def clear_bgp_session(self, neighbor_ip: str, device_ip: Optional[str] = None) -> dict:
        """Clear BGP session for a specific neighbor"""
        command = f"clear bgp * {neighbor_ip}"
        return self.execute_vtysh(command, device_ip)
    
    def get_bgp_route_info(self, prefix: str, device_ip: Optional[str] = None) -> dict:
        """Get detailed BGP route information for a prefix"""
        return self.execute_vtysh(f"show bgp {prefix}", device_ip)
