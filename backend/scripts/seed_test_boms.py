import sys
import os
import random
from datetime import datetime, timedelta

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import SessionLocal
from app.models.bom import Material, BOMHeader, BOMItem

def seed_test_boms():
    db = SessionLocal()
    try:
        print("Creating test materials...")
        # Create some base materials
        material_data = [
            {"code": "MAT-001", "name": "Steel Plate 10mm", "category": "Raw Material", "unit": "m2", "material_type": "RAW"},
            {"code": "MAT-002", "name": "Steel Plate 20mm", "category": "Raw Material", "unit": "m2", "material_type": "RAW"},
            {"code": "MAT-003", "name": "Bolt M12x50", "category": "Standard Part", "unit": "pcs", "material_type": "STD"},
            {"code": "MAT-004", "name": "Nut M12", "category": "Standard Part", "unit": "pcs", "material_type": "STD"},
            {"code": "MAT-005", "name": "Hydraulic Pump", "category": "Equipment", "unit": "set", "material_type": "SUB"},
            {"code": "MAT-006", "name": "Control Valve", "category": "Equipment", "unit": "pcs", "material_type": "SUB"},
            {"code": "MAT-007", "name": "Electrical Cable 5-core", "category": "Electrical", "unit": "m", "material_type": "RAW"},
            {"code": "MAT-008", "name": "Sensor Unit A1", "category": "Electronics", "unit": "pcs", "material_type": "SUB"},
            {"code": "MAT-009", "name": "Gasket DN100", "category": "Seal", "unit": "pcs", "material_type": "STD"},
            {"code": "MAT-010", "name": "Bearing 6205", "category": "Standard Part", "unit": "pcs", "material_type": "STD"},
        ]

        for m_info in material_data:
            existing = db.query(Material).filter(Material.code == m_info["code"]).first()
            if not existing:
                m = Material(**m_info, current_stock=random.randint(10, 100))
                db.add(m)
        
        db.commit()

        print("Creating 8 random BOMs...")
        products = [
            ("PROD-V-100", "Pressure Vessel Assembly", "Vessels"),
            ("PROD-H-200", "Hydraulic System Package", "Hydraulics"),
            ("PROD-C-300", "Main Control Cabinet", "Electronics"),
            ("PROD-F-400", "Heavy Duty Support Frame", "Structures"),
            ("PROD-P-500", "Multi-stage Pump Unit", "Pumps"),
            ("PROD-R-600", "Refrigeration Unit", "Cooling"),
            ("PROD-V-700", "High Pressure Valve Bank", "Valves"),
            ("PROD-G-800", "Industrial Gearbox Box", "Mechanical"),
        ]

        for i, (p_code, p_name, p_family) in enumerate(products):
            # Header
            header = BOMHeader(
                product_code=p_code,
                version="v1.0",
                bom_type="MBOM",
                status="RELEASED",
                description=f"Standard configuration for {p_name}",
                is_active=True,
                product_family=p_family,
                business_unit="Mechanical Division",
                project_code=f"PROJ-2026-{random.randint(100, 999)}",
                plant_code="PLANT-A",
                discipline="Mechanical",
                source_system="SOLIDWORKS",
                effective_date=datetime.now()
            )
            db.add(header)
            db.flush() # Get header.id

            # Items (3-6 items per BOM)
            num_items = random.randint(3, 6)
            selected_mats = random.sample(material_data, num_items)
            
            for j, mat in enumerate(selected_mats):
                item = BOMItem(
                    header_id=header.id,
                    child_item_code=mat["code"],
                    quantity=random.uniform(1, 10),
                    component_type="KEY" if j == 0 else "NORMAL",
                    find_number=str((j+1) * 10),
                    item_level=1,
                    item_category="Purchased" if mat["material_type"] == "SUB" else "Raw",
                    procurement_type="BUY" if mat["material_type"] in ["STD", "SUB"] else "MAKE",
                    unit_price=random.uniform(50, 500)
                )
                item.total_price = item.quantity * item.unit_price
                db.add(item)
        
        db.commit()
        print("Successfully generated 8 BOMs and associated materials.")

    except Exception as e:
        db.rollback()
        print(f"Error seeding BOMs: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_test_boms()
