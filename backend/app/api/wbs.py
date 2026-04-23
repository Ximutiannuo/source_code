from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.dependencies import get_current_active_user, require_permission
from app.models.wbs import WBSNode
from pydantic import BaseModel

router = APIRouter()

class WBSNodeRead(BaseModel):
    id: int
    code: str
    name: str
    level: int
    parent_id: Optional[int]
    
    class Config:
        from_attributes = True

class WBSTreeNode(WBSNodeRead):
    children: List["WBSTreeNode"] = []

@router.get("/", response_model=List[WBSNodeRead])
async def get_wbs_list(
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("wbs:read"))
):
    return db.query(WBSNode).all()

@router.get("/tree", response_model=List[WBSTreeNode])
async def get_wbs_tree(
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("wbs:read"))
):
    nodes = db.query(WBSNode).all()
    node_map = {node.id: WBSTreeNode.from_orm(node) for node in nodes}
    tree = []
    
    for node in nodes:
        tree_node = node_map[node.id]
        if node.parent_id:
            parent = node_map.get(node.parent_id)
            if parent:
                parent.children.append(tree_node)
            else:
                tree.append(tree_node)
        else:
            tree.append(tree_node)
            
    return tree
