-- Fix permissions for welding sync (Uppercase version)
-- Run this as root in MySQL

-- Grant permissions to role_system_admin for PRECOMCONTROL database
GRANT ALL PRIVILEGES ON `PRECOMCONTROL`.* TO 'role_system_admin'@'%';
GRANT ALL PRIVILEGES ON `PRECOMCONTROL`.* TO 'role_system_admin'@'localhost';

-- Also grant to other roles just in case
GRANT SELECT ON `PRECOMCONTROL`.* TO 'role_planning_manager'@'%';
GRANT SELECT ON `PRECOMCONTROL`.* TO 'role_planning_manager'@'localhost';
GRANT SELECT ON `PRECOMCONTROL`.* TO 'role_planning_supervisor'@'%';
GRANT SELECT ON `PRECOMCONTROL`.* TO 'role_planning_supervisor'@'localhost';
GRANT SELECT ON `PRECOMCONTROL`.* TO 'role_planner'@'%';
GRANT SELECT ON `PRECOMCONTROL`.* TO 'role_planner'@'localhost';

FLUSH PRIVILEGES;
