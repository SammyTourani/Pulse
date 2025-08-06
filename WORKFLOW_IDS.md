# Pulse Workflow ID Reference

This file contains the actual n8n workflow IDs for easy reference during development and maintenance.

## Gmail Bricks

| Brick Name | Workflow ID | n8n URL |
|------------|-------------|---------|
| `gmail.search_messages` | `A7KEFe9iCNKHoiEB` | http://localhost:5678/workflow/A7KEFe9iCNKHoiEB |
| `gmail.create_email_draft` | `7wzqiWBOLY4z5nTV` | http://localhost:5678/workflow/7wzqiWBOLY4z5nTV |
| `gmail.send_email` | `6yLecDWftZ3gpfkU` | http://localhost:5678/workflow/6yLecDWftZ3gpfkU |

## Gateway Workflow

| Name | Workflow ID | n8n URL |
|------|-------------|---------|
| `pulse.gateway.working` | `pulse-gateway-working-v1` | http://localhost:5678/workflow/pulse-gateway-working-v1 |

## Notes

- These IDs are used in the `pulse.gateway.working` workflow's `executeWorkflow` nodes
- If you recreate any workflows, update both this reference and the gateway configuration
- The gateway routes requests to these specific workflow IDs based on the `brick` parameter

## Last Updated

August 6, 2025
