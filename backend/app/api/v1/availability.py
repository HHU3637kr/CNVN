import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_current_teacher
from app.schemas.availability import AvailabilityCreate, AvailabilityUpdate, AvailabilityOut

router = APIRouter(prefix="/availability", tags=["Availability"])


@router.get("", response_model=list[AvailabilityOut])
async def list_my_availability(
    current_user: dict = Depends(get_current_teacher),
):
    """获取自己的可用时间"""
    raise HTTPException(status_code=501, detail="Not implemented")


@router.post("", response_model=AvailabilityOut, status_code=status.HTTP_201_CREATED)
async def create_availability(
    data: AvailabilityCreate,
    current_user: dict = Depends(get_current_teacher),
):
    """添加可用时间段"""
    raise HTTPException(status_code=501, detail="Not implemented")


@router.put("/{availability_id}", response_model=AvailabilityOut)
async def update_availability(
    availability_id: uuid.UUID,
    data: AvailabilityUpdate,
    current_user: dict = Depends(get_current_teacher),
):
    """修改可用时间段"""
    raise HTTPException(status_code=501, detail="Not implemented")


@router.delete("/{availability_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_availability(
    availability_id: uuid.UUID,
    current_user: dict = Depends(get_current_teacher),
):
    """删除可用时间段"""
    raise HTTPException(status_code=501, detail="Not implemented")
