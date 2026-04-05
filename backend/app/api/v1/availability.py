import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_teacher
from app.models.user import User
from app.schemas.availability import AvailabilityCreate, AvailabilityUpdate, AvailabilityOut
from app.services import availability_service

router = APIRouter(prefix="/availability", tags=["Availability"])


@router.get("", response_model=list[AvailabilityOut])
async def list_my_availability(
    current_user: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """获取自己的可用时间"""
    assert current_user.teacher_profile is not None
    rows = await availability_service.list_for_teacher(
        db, current_user.teacher_profile.id
    )
    return [AvailabilityOut.model_validate(a) for a in rows]


@router.post("", response_model=AvailabilityOut, status_code=status.HTTP_201_CREATED)
async def create_availability(
    data: AvailabilityCreate,
    current_user: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """添加可用时间段"""
    assert current_user.teacher_profile is not None
    try:
        return await availability_service.create_availability(
            db, current_user.teacher_profile.id, data
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/{availability_id}", response_model=AvailabilityOut)
async def update_availability(
    availability_id: uuid.UUID,
    data: AvailabilityUpdate,
    current_user: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """修改可用时间段"""
    assert current_user.teacher_profile is not None
    try:
        return await availability_service.update_availability(
            db, current_user.teacher_profile.id, availability_id, data
        )
    except LookupError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="时段不存在")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{availability_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_availability(
    availability_id: uuid.UUID,
    current_user: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """删除可用时间段"""
    assert current_user.teacher_profile is not None
    try:
        await availability_service.delete_availability(
            db, current_user.teacher_profile.id, availability_id
        )
    except LookupError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="时段不存在")
