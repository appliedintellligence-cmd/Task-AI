from fastapi import APIRouter, Depends, HTTPException

from dependencies import authenticated_user
from services.supabase import delete_account

router = APIRouter()


@router.delete("/account")
async def remove_account(user_id: str = Depends(authenticated_user)):
    try:
        delete_account(user_id)
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="Account deletion could not be completed. Please try again or contact support.",
        ) from exc
    return {"ok": True}
