import io, json, tempfile
from pathlib import Path
from fastapi.testclient import TestClient

from app.main import app
from app.config.settings import get_settings
from app.database.migrations import migrate

settings = get_settings()
tmp = Path(tempfile.mkdtemp(prefix='clario-probe-'))
settings.data_directory = tmp
migrate()

client = TestClient(app)
files = [
    ('files', ('alpha.csv', io.StringIO('a,b\n1,2\n').read().encode('utf-8'))),
    ('files', ('beta.csv', io.StringIO('a,b\n3,4\n').read().encode('utf-8'))),
]
# Rebuild with real bytes to avoid tuple mismatch
payload = [
    ('files', ('alpha.csv', b'a,b\n1,2\n')),
    ('files', ('beta.csv', b'a,b\n3,4\n')),
]
resp = client.post('/api/v1/files/upload', files=payload)
print('UPLOAD', resp.status_code)
print(resp.json())
created = client.post('/api/v1/validation/sessions/draft', json={
    'project_name': 'Probe Session',
    'preset': 'custom_comparison_builder',
    'file_names': ['alpha.csv', 'beta.csv'],
    'uploaded_file_ids': [item['id'] for item in resp.json()],
})
print('DRAFT', created.status_code, created.json())
state = client.get(f"/api/v1/validation/sessions/{created.json()['id']}")
print('STATE', state.status_code)
print(json.dumps(state.json(), indent=2))
