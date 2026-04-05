import uuid
from datetime import datetime

from pydantic import BaseModel


class MessageOut(BaseModel):
    id: uuid.UUID
    lesson_id: uuid.UUID
    sender_id: uuid.UUID
    content: str
    message_type: str
    created_at: datetime

    model_config = {"from_attributes": True}
