from fastapi import APIRouter, Response

router = APIRouter()


@router.get("/health")
def health(response: Response) -> dict[str, str]:
    # The project website wakes the app and shows when it is ready. Only this answer, which
    # says nothing but "ok", can be read from another site; every other route stays same-origin.
    response.headers["Access-Control-Allow-Origin"] = "*"
    return {"status": "ok"}
