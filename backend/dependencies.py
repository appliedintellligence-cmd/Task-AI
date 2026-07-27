from typing import Annotated

from fastapi import Header, HTTPException

from services.supabase import verify_token


async def authenticated_user(
    authorization: Annotated[str | None, Header()] = None,
) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Unauthorized")

    scheme, separator, token = authorization.partition(" ")
    if not separator or scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status_code=401, detail="Unauthorized")

    user_id = await verify_token(token.strip())
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return user_id
