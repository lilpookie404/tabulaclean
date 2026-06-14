"""Public errors raised by the upload-session subsystem."""

from __future__ import annotations


class UploadError(Exception):
    """An upload failure safe to return to a client."""

    def __init__(self, status_code: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
