import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.config.settings import get_settings
from app.database.migrations import migrate
from app.main import app
from app.repositories.session_repository import SessionRepository
from fastapi.testclient import TestClient


class SessionRegressionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.settings = get_settings()
        self.original_data_directory = self.settings.data_directory
        self.temp_directory = Path(tempfile.mkdtemp(prefix="clario-session-test-"))
        self.settings.data_directory = self.temp_directory
        migrate()
        self.client = TestClient(app)

    def tearDown(self) -> None:
        self.client.close()
        self.settings.data_directory = self.original_data_directory

    def _create_saved_session(self) -> tuple[str, Path, str]:
        upload_response = self.client.post(
            "/api/v1/files/upload",
            files=[("files", ("saved.csv", io.BytesIO(b"Item,Quantity\nBond Paper,10\n"), "text/csv"))],
        )
        self.assertEqual(upload_response.status_code, 200)
        uploaded = upload_response.json()[0]

        draft_response = self.client.post(
            "/api/v1/validation/sessions/draft",
            json={
                "project_name": "Saved session",
                "preset": "custom_comparison_builder",
                "file_names": [uploaded["name"]],
                "uploaded_file_ids": [uploaded["id"]],
            },
        )
        self.assertEqual(draft_response.status_code, 201)
        session_id = draft_response.json()["id"]
        session_directory = self.settings.sessions_directory / "Saved session"
        persisted_file = session_directory / "uploads" / f'{uploaded["id"]}.csv'
        self.assertTrue(persisted_file.exists())
        return session_id, session_directory, uploaded["id"]

    def test_remove_saved_file_deletes_metadata_and_disk_file(self) -> None:
        session_id, session_directory, file_id = self._create_saved_session()

        response = self.client.delete(f"/api/v1/validation/sessions/{session_id}/files/{file_id}")
        self.assertEqual(response.status_code, 204)

        metadata = json.loads((session_directory / "session.json").read_text(encoding="utf-8"))
        self.assertFalse(any(str(item.get("id")) == file_id for item in metadata.get("files", [])))
        self.assertNotIn("saved.csv", metadata.get("file_names", []))
        self.assertFalse((session_directory / "uploads" / f"{file_id}.csv").exists())

        state = self.client.get(f"/api/v1/validation/sessions/{session_id}")
        self.assertEqual(state.status_code, 200)
        self.assertEqual(state.json()["files"], [])

    def test_reopened_session_can_add_file_and_persist_it(self) -> None:
        session_id, session_directory, original_file_id = self._create_saved_session()

        self.client.delete(f"/api/v1/validation/sessions/{session_id}/files/{original_file_id}")
        new_upload = self.client.post(
            "/api/v1/files/upload",
            files=[("files", ("new-file.csv", io.BytesIO(b"Item,Quantity\nPen,5\n"), "text/csv"))],
        )
        self.assertEqual(new_upload.status_code, 200)
        new_file_id = new_upload.json()[0]["id"]

        response = self.client.post(
            f"/api/v1/validation/sessions/{session_id}/files",
            json={"file_id": new_file_id},
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["id"], new_file_id)

        metadata = json.loads((session_directory / "session.json").read_text(encoding="utf-8"))
        self.assertEqual([item["id"] for item in metadata["files"]], [new_file_id])
        self.assertEqual(metadata["file_names"], ["new-file.csv"])
        self.assertTrue((session_directory / "uploads" / f"{new_file_id}.csv").exists())

        state = self.client.get(f"/api/v1/validation/sessions/{session_id}")
        self.assertEqual(state.status_code, 200)
        self.assertEqual([item["id"] for item in state.json()["files"]], [new_file_id])

    def test_saved_session_lookup_preserves_existing_session_id(self) -> None:
        session_id, _, _ = self._create_saved_session()

        with patch.object(SessionRepository, "create_draft", wraps=SessionRepository().create_draft) as create_draft:
            state = self.client.get(f"/api/v1/validation/sessions/{session_id}")
            self.assertEqual(state.status_code, 200)
            self.assertEqual(state.json()["result"]["id"], session_id)
            create_draft.assert_not_called()


if __name__ == "__main__":
    unittest.main()
